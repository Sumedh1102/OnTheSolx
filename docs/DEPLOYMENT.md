# Deploying SmashPoint

The app is a standard Next.js server backed by PostgreSQL. Every deploy runs one release step,
`npm run db:deploy`, which:

1. applies pending database migrations (safe to run from several instances at once), then
2. on a real deployment, fills in anything missing: default settings, the court/program/plan
   catalogue from `scripts/lib/catalogue.ts`, and an admin account from `ADMIN_EMAIL` /
   `ADMIN_PASSWORD`. It never overwrites or deletes data.
3. With `SEED_DEMO_DATA=true` **and an empty database**, it loads the demo academy instead.

On startup in production the server checks its configuration and refuses to boot if something
unsafe is set (missing `AUTH_SECRET`, the sandbox payment gateway outside demo mode, Razorpay
selected without keys). The reason is printed in the logs.

## Pick a mode

| | Real academy | Public demo |
| --- | --- | --- |
| `PAYMENT_PROVIDER` | `razorpay` | `mock` |
| `DEMO_MODE` | unset | `true` |
| `SEED_DEMO_DATA` | unset | `true` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | your admin login | not needed |

A demo deployment shows the demo accounts (password `SmashPoint@123`) on the login page, so
anyone can sign in as admin and change the demo data. Don't put real people's data in it.

## Public demo, deployed by GitHub Actions

`.github/workflows/deploy-demo.yml` deploys the demo to Vercel without connecting Vercel to
GitHub. It creates the Vercel project if needed, sets the demo environment (generating
`AUTH_SECRET` and `CRON_SECRET` once), deploys, and smoke-tests the live URL. The run summary
shows the address.

1. Create a Postgres database for the demo (e.g. Neon, region *AWS Asia Pacific (Mumbai)*) and
   copy its **pooled** connection string.
2. Create a Vercel access token (vercel.com → Account Settings → Tokens).
3. In GitHub → Settings → Secrets and variables → Actions, add repository secrets
   `DATABASE_URL` and `VERCEL_TOKEN`.
4. Run the **Deploy demo** workflow (Actions tab → Run workflow). After that, every push to the
   branch redeploys.

The first build loads the demo academy into the empty database. A nightly job (03:00 IST)
reloads it, so dates stay current and visitors' changes are undone; it refuses to touch a
database that wasn't created as a demo.

## Option A: Vercel + Neon (recommended)

Both have free tiers and Mumbai regions, which keeps pages fast for players in Palghar.
Vercel's free Hobby plan is for non-commercial use; a business should use Pro.

1. **Database.** In Vercel → Storage, add **Neon** (or create a project at neon.tech) in
   *AWS Asia Pacific (Mumbai)*. Use the **pooled** connection string as `DATABASE_URL`.
2. **Project.** Vercel → Add New → Project → import this repository. Keep the detected
   Next.js settings. The build runs `vercel-build`, which applies migrations before building.
3. **Environment variables** (Production, and Preview if you use preview deployments):

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | added by the Neon integration, or paste the pooled URL |
   | `AUTH_SECRET` | `openssl rand -base64 32` |
   | `CRON_SECRET` | `openssl rand -hex 24` (Vercel Cron sends it automatically) |
   | `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | real mode: your first admin account |
   | `PAYMENT_PROVIDER`, `RAZORPAY_*` | real mode: see Payments below |
   | `DEMO_MODE`, `SEED_DEMO_DATA` | demo mode: `true` |
   | `RESEND_API_KEY`, `EMAIL_FROM` | recommended, see Email below |
   | `NEXT_PUBLIC_SITE_URL` | only once you add a custom domain, e.g. `https://smashpoint.in` |

4. **Deploy.** The build log shows `✅ Database schema is up to date` followed by what was set up.
5. **Custom domain.** Add it under Project → Domains, set `NEXT_PUBLIC_SITE_URL` to it and
   redeploy (the URL is baked into the client bundle at build time).

`vercel.json` pins functions to Mumbai (`bom1`) and runs the scheduled jobs once a day, which
is all the Hobby plan allows. For hourly booking reminders, either upgrade to Pro and change the
schedule to `0 * * * *`, or use the GitHub scheduler below.

## Option B: Docker (Railway, Render, Fly.io, Cloud Run, a VPS)

The `Dockerfile` builds a small standalone image. On start it runs the release step, then the
server. It listens on `$PORT` (default 3000) and has a health check at `/api/health`.

```bash
docker build --build-arg NEXT_PUBLIC_SITE_URL=https://smashpoint.in -t smashpoint .
docker run -p 3000:3000 --env-file .env.production smashpoint
```

Or the whole stack locally, with Postgres: `docker compose --profile app up --build`.

## Scheduled jobs

`GET /api/cron/reminders` (with `Authorization: Bearer $CRON_SECRET`) expires unpaid booking
holds and lapsed memberships, sends booking, class and renewal reminders, and cleans up old
sessions and rate-limit counters. It is idempotent, so running it more often is harmless.

- **Vercel:** `vercel.json` already schedules it (daily on Hobby).
- **Anywhere:** `.github/workflows/scheduler.yml` calls it hourly. Add repository secrets
  `APP_URL` (e.g. `https://smashpoint.in`) and `CRON_SECRET`. GitHub only runs scheduled
  workflows from the default branch.

## After the first deploy

- [ ] Sign in with the admin account and change its password (Profile).
- [ ] Update academy details (address, phone, map, stats, testimonials) in `src/content/site.ts`.
- [ ] Review courts, prices, peak hours and opening hours in Dashboard → Courts.
- [ ] Add coaches, then assign them to programs and batches.
- [ ] **Payments:** in the Razorpay dashboard create a webhook to
      `https://<your-domain>/api/payments/webhook/razorpay` for `payment.captured`,
      `payment.failed` and `order.paid`, and put its secret in `RAZORPAY_WEBHOOK_SECRET`.
      Test with `rzp_test_` keys first, then switch to live keys.
- [ ] **Email:** verify your sending domain in Resend and set `EMAIL_FROM` to an address on it.
      Password reset links, receipts and reminders are emailed.
- [ ] Point an uptime monitor at `https://<your-domain>/api/health`.
- [ ] Turn on automated backups / point-in-time restore for the database (Neon has it built in).
- [ ] Add the `APP_URL` and `CRON_SECRET` repository secrets if you use the GitHub scheduler.

## Operations

- **Logs:** configuration problems are logged with a `[config]` prefix at startup; unexpected
  errors with `[api]`, `[action]` or `[webhook]`. Error pages show a reference that matches the
  server log.
- **Schema changes:** edit `src/server/db/schema.ts`, run `npm run db:generate`, commit the new
  file in `drizzle/`. The next deploy applies it.
- **Rotating `AUTH_SECRET`** signs every user out. Rotating `CRON_SECRET` needs the same value in
  the scheduler.
- **Never run `npm run db:seed` against production.** It wipes tables, and refuses to run on a
  database that holds real data unless forced.
