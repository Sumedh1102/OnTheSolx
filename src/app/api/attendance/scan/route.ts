import { z } from "zod";
import { assertPermission } from "@/server/auth/guards";
import { assertSameOrigin, errorResponse, json, readJson } from "@/server/http";
import { checkInByQr } from "@/server/services/attendance";

const schema = z.object({ token: z.string().min(1).max(200), batchId: z.uuid() });

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const user = await assertPermission("attendance:scan");
    const input = schema.parse(await readJson(req));
    return json(await checkInByQr({ token: input.token, batchId: input.batchId, userId: user.id }));
  } catch (err) {
    return errorResponse(err);
  }
}
