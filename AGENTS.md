<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project notes (SmashPoint)

- Commands: `npm run dev`, `npm run typecheck` (runs `next typegen` first so `PageProps<"/route">` types exist), `npm test` (Vitest), `npm run db:migrate`, `npm run db:seed`, `npm run db:reset`.
- Units: money is integer paise; dates are `YYYY-MM-DD` strings in Asia/Kolkata (`src/lib/time.ts`); times of day are minutes from midnight.
- Formatting in client components must go through `src/lib/format.ts` (deterministic, no `Intl`) to avoid hydration mismatches.
- Server actions live in `src/server/actions/*`, return `ActionResult`, and start with `assertUser()` / `assertPermission()`; pages use `requireUser()` / `requirePermission()` from `src/server/auth/guards.ts`. Permissions are defined in `src/lib/rbac.ts`.
- Only export async actions from `"use server"` files; shared helpers go in `src/server/*`.
- Booking overlap is enforced by the `bookings_no_overlap` EXCLUDE constraint (`drizzle/0001_booking_constraints.sql`) as well as the row lock in `createBooking`; keep both.
- After mutating cached public data, call `invalidate(TAGS.x)` from `src/server/cache.ts`.
