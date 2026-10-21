# NIDE ward tracker

Next.js rebuild of the single-file ward tracker prototype (`../ward_patient_tracker_nide.html`, kept untouched as the reference spec) for the inpatient ward of the National Institute for Diabetes and Endocrinology, Cairo.

Stack: Next.js (App Router, TypeScript strict, Tailwind) on Vercel, Neon Postgres with Drizzle ORM, self-hosted Better Auth (same database), S3-compatible object storage for lab photos (Neon Object Storage or Cloudflare R2), shadcn tooling with Arc components (uiarc.dev, free tier).

Everything that touches the database, auth or storage is created lazily, so `bun run build` works with no environment variables.

## 1. Run it locally

Requirements: [Bun](https://bun.sh) 1.4 or newer, and Node.js 22 or newer. Bun installs the packages and runs the scripts (it loads `.env.local` then `.env` on its own, so scripts need no dotenv setup). Next.js itself runs on Node (`bun run dev` starts `next dev` under Node): under the Bun runtime (`bun --bun next dev`), Turbopack creates the link for externalized packages such as `pg` after Bun's resolver has cached the folder as missing, and every page fails with "Failed to load external module pg-…".

```bash
bun install
cp .env.example .env.local   # then fill it in, see below
bun run db:migrate              # apply the SQL in ./drizzle to your Neon database
bun run db:seed                 # wards and beds (idempotent)
bun run admin:create            # first admin, from SEED_ADMIN_* variables
bun run dev
```

Other scripts: `bun run typecheck`, `bun run lint`, `bun run test` (Vitest, not `bun test`), `bun run build`, `bun run db:generate` (after editing `src/db/schema`).

## 2. Create the Neon database

1. Create a Neon project and database.
2. Copy the pooled connection string into `DATABASE_URL`.
3. Generate `BETTER_AUTH_SECRET` (`openssl rand -base64 32`) and set `BETTER_AUTH_URL` to the app origin.
4. Run `bun run db:migrate`, then `bun run db:seed`.

## 3. Create the photo bucket (private)

Lab photos are never stored in the database. Only the object key, type and size are. Keep the bucket **private**; photos are shown through presigned GET links that expire after 60 seconds.

The client is provider-agnostic and is configured with the standard AWS SDK variables plus `S3_BUCKET`, `S3_FORCE_PATH_STYLE` (default `true`) and `S3_UPLOAD_MODE`.

### Option A: Neon Object Storage (default in `.env.example`)

1. Create a bucket in the Neon console and generate an access key pair.
2. Set `AWS_ENDPOINT_URL_S3` (`https://<branch>.storage.<cell>.<region>.aws.neon.tech`), `AWS_REGION` (for example `eu-central-1`), `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET`. Neon needs path-style addressing, which is the default here.
3. Browser uploads go straight to the bucket with a presigned PUT, which needs CORS on the bucket. **Check Neon's documentation for whether and how bucket CORS can be configured.** If it cannot, set `S3_UPLOAD_MODE=proxy`. The browser then POSTs the compressed photo to `/api/uploads/proxy`, an authenticated route that applies the same role, type and size checks and stores the object server-side. Photos are compressed to about 1600 px WebP first and are limited to 4 MB, which also keeps them under Vercel's request body limit.

### Option B: Cloudflare R2

1. Create a bucket (keep public access off) and an R2 API token with Object Read & Write for that bucket.
2. Set `AWS_ENDPOINT_URL_S3=https://<account_id>.r2.cloudflarestorage.com`, `AWS_REGION=auto`, the token's key pair, and `S3_BUCKET`.
3. Add this CORS policy to the bucket (R2 dashboard, bucket Settings, CORS Policy), listing every origin the app is served from:

```json
[
  {
    "AllowedOrigins": ["https://your-app.vercel.app", "http://localhost:3000"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Viewing photos does not need CORS: the page loads `<img src="/api/media/<id>">`, which checks the session and redirects to a presigned GET.

## 4. Create the first admin

Staff sign in with a **username** and password; there is no public sign-up and no email sign-in. Put `SEED_ADMIN_USERNAME`, `SEED_ADMIN_PASSWORD` (10 or more characters), `SEED_ADMIN_NAME` and optionally `SEED_ADMIN_BADGE` in `.env.local` (never on Vercel; the app never reads them), then run `bun run admin:create`. It creates the Better Auth user (admin plugin, role `admin`) and an admin `staff_profile`, and refuses to run if an admin already exists. The seeded password is temporary: sign in and you are asked to set your own. Then delete `SEED_ADMIN_PASSWORD` from `.env.local`. Further accounts are created on the **Staff** screen (admin only), the same way: username plus a temporary password that the person replaces at first sign-in. A password reset by an admin makes it temporary again.

Usernames are unique, case-insensitive, 3 to 30 letters, numbers, dots or underscores, and cannot be changed (Better Auth `username` plugin with `immutableUsername`). Better Auth still requires an email per user, so each gets a never-used placeholder on the reserved `.invalid` domain (`src/lib/username.ts`); `/sign-in/email` and `/is-username-available` are disabled.

## 5. Deploy to Vercel

1. Import the repository and set the **Root Directory** to `web`.
2. Add every variable from `.env.example` (except `SEED_ADMIN_*`) in Project Settings.
3. Set `BETTER_AUTH_URL` to the production origin, and add that origin to the bucket CORS (presigned mode).
4. Run migrations and seed against the production database from your machine (`DATABASE_URL=... bun run db:migrate && bun run db:seed`), then create the first attending the same way.
5. Deploy.

`vercel.json` pins functions to `fra1` (Frankfurt). Keep it in the same region as the Neon database: Vercel's default (`iad1`, Washington) would put a transatlantic round trip on every query. If the database is in another region, change `regions` to match.

Vercel detects `bun.lock` and installs with Bun; functions run on Node. Vercel's Bun runtime (`"bunVersion"` in `vercel.json`) is not enabled: since the switch to `pg` it has not been verified, and the dev-server problem above suggests testing a preview deployment carefully before trying it.

## How it works

- **Roles** (`src/lib/permissions.ts`): three roles. **Admin** can do everything, including staff management (create, edit, deactivate, reset password, delete). **Attending** and **resident** are the clinical roles: both can admit, edit the chart, insulin and drugs, record blood gases and bedside readings, attach and delete photos and ABG readings, discharge and re-admit. Everyone can edit the shift roster, and every role sets its own theme and password. At least one active admin must always exist. Every server action goes through `runAction` (`src/server/action.ts`), which authenticates, checks the permission, validates with zod and only then runs the handler. Hiding a button in the UI is convenience, not security.
- **Audit**: every mutation writes an `audit_log` row (actor, action, entity, before/after JSON) in the same transaction as the change.
- **Concurrency**: `admission.version` guards the chart document (patient details, plan, insulin, drug sheet). A stale save fails with "someone else updated this chart" and the chart shows a banner to load the latest version. ABG readings, photos and bedside RBG/acetone are append or last-write operations and do not conflict with chart edits.
- **Database clients** (`src/db/index.ts`): page reads use Neon's HTTP driver (`getReadDb`), one HTTPS request per query with no connection to open. Writes, transactions and Better Auth use node-postgres over TCP (`getDb`) with a small pool, attached to Vercel Fluid compute via `attachDatabasePool`.
- **Archive**: admissions with status `discharged`. Nothing is copied. Records are not deletable from the app (the prototype's archive delete was dropped on purpose; this is medicolegal data).
- **Live updates**: the board and chart call `router.refresh()` every 10 seconds while the tab is visible.
- **Clinical logic** lives in `src/lib/clinical/` as pure TypeScript with Vitest tests. It is a line-for-line port of the prototype's `analyzeABG`, `calculateABGStatus`, protocol guidance and `parseABGSlipText`.
- **Time**: all clinical times are Cairo wall-clock times stored as `timestamptz`.
- **Sessions**: sliding, 120 minutes idle by default (`SESSION_MAX_AGE_MINUTES`). Sign-in is rate limited (5 per minute per IP, database-backed).

## Not included

- Camera/Tesseract OCR of ABG slips. The paste-text parser is included and fills the ABG form.
- The prototype's JSON backup/restore and cloud-sync settings (replaced by the database).
- Real-time websockets (polling only, by design).
