-- Database-level double-booking protection.
--
-- btree_gist lets a GiST index combine plain equality (court, date) with range overlap
-- (&&) on the booked minutes. Any attempt to insert or update an *active* booking that
-- overlaps another active booking on the same court and date fails with SQLSTATE 23P01,
-- no matter which code path (API, admin UI, script) issued it.
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_no_overlap"
  EXCLUDE USING gist (
    "court_id" WITH =,
    "date" WITH =,
    int4range("start_minute", "end_minute", '[)') WITH &&
  )
  WHERE ("status" IN ('PENDING', 'PAYMENT_INITIATED', 'PAID', 'CONFIRMED'));
--> statement-breakpoint
-- Only one payment may be marked PAID per booking.
CREATE UNIQUE INDEX "payments_one_paid_per_booking"
  ON "payments" ("booking_id")
  WHERE "status" = 'PAID' AND "booking_id" IS NOT NULL;
