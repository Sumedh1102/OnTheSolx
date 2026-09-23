import "server-only";
import { eq, sql } from "drizzle-orm";
import type { DbOrTx } from "@/server/db";
import { coupons, type Coupon } from "@/server/db/schema";

export type CouponScope = "BOOKING" | "MEMBERSHIP" | "EVENT";

export async function resolveCoupon(
  conn: DbOrTx,
  rawCode: string,
  scope: CouponScope,
  amount: number,
  onDate: string,
): Promise<{ ok: true; coupon: Coupon } | { ok: false; message: string }> {
  const code = rawCode.trim().toUpperCase();
  const [coupon] = await conn.select().from(coupons).where(eq(coupons.code, code)).limit(1);
  if (!coupon || !coupon.isActive) return { ok: false, message: "That coupon code isn't valid." };
  if (coupon.scope !== "ALL" && coupon.scope !== scope) return { ok: false, message: "This coupon can't be used here." };
  if (coupon.validFrom && onDate < coupon.validFrom) return { ok: false, message: "This coupon isn't active yet." };
  if (coupon.validUntil && onDate > coupon.validUntil) return { ok: false, message: "This coupon has expired." };
  if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) return { ok: false, message: "This coupon has been fully redeemed." };
  if (amount < coupon.minAmount) return { ok: false, message: "Order amount is below this coupon's minimum." };
  return { ok: true, coupon };
}

export async function incrementCouponUse(conn: DbOrTx, couponId: string) {
  await conn
    .update(coupons)
    .set({ usedCount: sql`${coupons.usedCount} + 1` })
    .where(eq(coupons.id, couponId));
}
