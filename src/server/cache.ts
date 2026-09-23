import "server-only";
import { revalidateTag } from "next/cache";

export const TAGS = {
  coaches: "coaches",
  programs: "programs",
  plans: "membership-plans",
  events: "events",
  announcements: "announcements",
  courts: "courts",
} as const;

/** Expires cached public data immediately after an admin change. */
export function invalidate(...tags: (typeof TAGS)[keyof typeof TAGS][]) {
  for (const tag of tags) revalidateTag(tag, { expire: 0 });
}
