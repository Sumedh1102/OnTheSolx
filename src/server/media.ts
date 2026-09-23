import "server-only";
import { db } from "@/server/db";
import { media } from "@/server/db/schema";
import { DomainError } from "@/server/errors";

const SIGNATURES = new Map<string, number[]>([
  ["image/jpeg", [0xff, 0xd8, 0xff]],
  ["image/png", [0x89, 0x50, 0x4e, 0x47]],
  ["image/webp", [0x52, 0x49, 0x46, 0x46]],
]);

/**
 * Validates an uploaded image by size and magic bytes (never trusting the client's
 * declared type alone), stores it in Postgres and returns its URL. Swap for S3/R2 by
 * replacing this function.
 */
export async function storeImage(file: File | null, ownerId: string): Promise<string> {
  if (!file || typeof file === "string" || file.size === 0) throw new DomainError("Choose an image to upload.");
  if (file.size > 2 * 1024 * 1024) throw new DomainError("Images must be 2 MB or smaller.");
  const signature = SIGNATURES.get(file.type);
  const buf = Buffer.from(await file.arrayBuffer());
  if (!signature || !signature.every((b, i) => buf[i] === b)) throw new DomainError("Upload a JPG, PNG or WebP image.");
  const [row] = await db.insert(media).values({ ownerId, contentType: file.type, byteSize: file.size, data: buf }).returning({ id: media.id });
  return `/api/media/${row!.id}`;
}
