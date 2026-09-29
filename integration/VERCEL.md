# Vercel deployment and inquiry API

## Delivery state

The public frontend is at https://investo-blush.vercel.app/. The repository includes the backend functions, shared PostgreSQL store and protected retry endpoint needed to run the existing Propstack integration on Vercel. Adding these files does not itself configure the Vercel account, credentials, database or scheduler. Production endpoint availability and live Propstack/n8n acceptance must be verified after deployment.

No production keys, database connection or Vercel account access have been supplied with this implementation. The new-contact shared owner is confirmed as 443334. Approval of the exact consultation consent remains a business decision. Do not set approval/readiness flags just to hide a configuration error.

## Project root, build and routing

Connect the project to `urrwa/investo`, using the intended production branch. In Vercel Project Settings set:

| Setting | Value |
| --- | --- |
| Root Directory | Repository root (`.` / leave blank); not `dist` |
| Framework Preset | Vite |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Node.js version | 22.x |

Keep `api/`, `server/`, `shared/`, `automation/`, `package.json` and `vercel.json` inside that root. The build command also prerenders the homepage. Deploy the repository, not a static-only ZIP containing `dist`.

Vercel discovers these Node functions:

| Public route | Entry file | Purpose |
| --- | --- | --- |
| `GET /api/inquiries/config` | `api/inquiries/config.js` | Public readiness and Turnstile site key |
| `POST /api/inquiries` | `api/inquiries.js` | Validated intake, durable receipt and bounded CRM processing |
| `GET /api/inquiries/status/:id` | `api/inquiries/status/[id].js` | Read-only receipt status with its Bearer receipt token |
| `GET /api/inquiries/retry` | `api/inquiries/retry.js` | Private scheduled recovery with the worker Bearer secret |

The shared runtime is `server/vercel-runtime.mjs`. API responses have `Cache-Control: no-store`. `vercel.json` rewrites only `/impressum`, `/datenschutz` and `/danke` (with or without trailing slashes) to `client.html`. Do not add a catch-all SPA rewrite that intercepts `/api/*`, and remove any conflicting project-level routing override. No public retry/reset/force-send endpoint is available without the worker secret.

## Server environment

Set the following in Vercel's private environment settings for the target environment, then redeploy. Use separate staging credentials/data where possible. Never commit `.env`, store secrets in `VITE_*`, paste secrets into URLs, or expose secrets in browser code. Only the Turnstile site key is intentionally public.

| Variable | Required configuration |
| --- | --- |
| `DATABASE_URL` | Private managed PostgreSQL connection string. `POSTGRES_URL` is an alias; `DATABASE_URL` takes precedence. Use shared durable storage reachable from the functions. |
| `PROPSTACK_API_KEY` | Private key for the account and permissions described in `CONTRACT-v1.md`. The API base is fixed to `https://api.propstack.de/v1`. |
| `PROPSTACK_NEW_CONTACT_OWNER_ID` | Set `443334` for the agreed shared info@ intake queue. Existing `443333` (Alpaslan) and `443427` (Akay) owners are preserved. No round robin. |
| `CONTACT_CONSENT_APPROVED` | `true` only after the owner approves the exact enabled-language wording in `shared/lead-schema.mjs` and `consent-text.json`. Current version is `2026-09-24-v1`; the version alone is not approval. |
| `TURNSTILE_SITE_KEY` | Public Cloudflare Turnstile site key registered for the deployed hostname. |
| `TURNSTILE_SECRET_KEY` | Matching private Turnstile secret. Verification also checks hostname, action `investo-inquiry`, and submission UUID. |
| `PUBLIC_SITE_URL` | Exact HTTPS origin, e.g. `https://investo-blush.vercel.app`, without a path, query, credentials or fragment. |
| `ALLOWED_ORIGINS` | Optional comma-separated additional exact HTTPS frontend origins, without trailing slash. The public site origin is allowed. Do not use wildcards or permit every preview deployment automatically. |
| `CRON_SECRET` | At least 32 random characters, shared only with the authorized retry scheduler. Send it as `Authorization: Bearer <secret>`, never a query parameter. |
| `INQUIRY_RETRY_SCHEDULE_CONFIRMED` | Keep `false` until the frequent authenticated retry schedule below is configured and verified; then set `true`. |

The Vercel runtime requires a valid owner, approved consent, CRM/bot credentials, healthy storage and confirmed retry configuration before reporting `available: true`. Missing or unreachable storage produces a safe `available: false` config response, not a successful submission. Readiness confirms configuration and database connectivity; it does not validate the Propstack key or prove the external callback workflow is running.

The Vercel functions use Vercel's trusted ingress client-IP header for throttling. `PORT`, `HOST`, `LEAD_DB_PATH` and `TRUST_PROXY` belong to the separate persistent Node server and are not Vercel function settings. Copying the local HTTP origins from `.env.example` into Vercel will fail the HTTPS-origin validation.

## PostgreSQL provisioning

Provision a managed PostgreSQL database with access controls, backups, capacity and region chosen for the owner's data-handling requirements. Use the provider's server-side connection URL (and compatible pooler if provided). The store enforces TLS certificate verification; disabling TLS or accepting an untrusted certificate is not supported. URL SSL parameters are normalized so they cannot disable verification. Credentials and provider errors are not returned to the browser.

On initialization, `server/migrations/001-inquiry-state.sql` creates the isolated `investo_intake` schema and its version record under a transaction and advisory lock. The database role must be allowed to create this schema/tables/indexes on first initialization and read/write its records afterward. `vercel.json` includes migration files in function bundles. The schema stores inquiries, contact locks and request-limit buckets; it does not replace unrelated tables.

All function instances and the private reconciliation CLI must use the same database. Reservations, process leases and contact locks therefore survive function shutdowns and concurrent invocations. Do not point separate functions at different databases, or use ephemeral SQLite in `/tmp`. Existing local SQLite records are not automatically migrated: review any real pending/review records before changing a live intake backend. Retain deduplication evidence under a reviewed retention policy.

## Reliable scheduled recovery

The POST handler performs bounded, awaited work and leaves unfinished submissions durably pending. It never depends on `setInterval` or unawaited background work after a function response. Recovery is handled by `GET /api/inquiries/retry`; valid requests await a bounded batch, and overlapping invocations use database leases.

`vercel.json` contains a daily Vercel cron (`0 3 * * *`) as a recovery backup. It is compatible with Vercel Hobby's daily scheduling limit. This backup alone is too infrequent for the inquiry flow. Before enabling the form, configure and verify one of:

1. On a Vercel plan that supports it, change the retry cron to every minute and deploy that configuration.
2. Keep the daily backup and configure an authorized external scheduler to call the retry endpoint every minute with `Authorization: Bearer <CRON_SECRET>`.

Keep the worker secret in the scheduler's credential store. Verify an unauthenticated request returns `401`, confirm authenticated invocation/logs after all integration settings are ready, and monitor repeated failures or growing pending/review queues. Once the schedule is configured, set `INQUIRY_RETRY_SCHEDULE_CONFIRMED=true`, redeploy, and complete the authenticated worker and staging acceptance checks. The endpoint is gated while the overall integration is disabled; a `503` is not proof of a working schedule.

This worker endpoint is separate from Propstack's signed event to the existing n8n callback workflow. A scheduler may wake the website's pending queue, but it must not submit the form directly to n8n, replace event authentication, or create callback tasks. The contract's browser → backend → Propstack inquiry → signed event → n8n boundary remains unchanged.

## Deployment checks

Run `npm run lint`, `npm test` and `npm run build` before deployment. Tests include simulated Propstack/Turnstile responses and PostgreSQL-engine storage checks; they do not prove production database connectivity, provider TLS, secrets or CRM/n8n behavior.

Implementation verification: 61 automated tests passed, TypeScript passed, and the production prerender build passed. The worker uses a 30-second processing budget within its 60-second function limit, with 3-second database query limits and time reserved for durable finalization. Repeated reconciliation budget exhaustion moves uncertain inquiries to operator review without another POST.

After Vercel reports a successful deployment:

1. Open `/api/inquiries/config`. Expect JSON with `available`, `turnstile_site_key` and `consent_version`, not an HTML page or Vercel 404. It is normal for `available` to stay false until all launch requirements are satisfied.
2. Check Vercel's deployment function list for all four entries above and verify the root/build/routing settings if a route is absent. Inspect private function logs without publishing connection strings, keys or personal data.
3. Check missing/invalid receipt tokens cannot read `/api/inquiries/status/:id`; authenticated status requests must be read-only. Confirm invalid or unconfigured submissions cannot create CRM records.
4. Verify direct navigation and reload of `/impressum`, `/datenschutz` and `/danke`, and confirm API paths are never rewritten to those frontend pages.
5. Complete controlled staging acceptance with approved test data: exactly one contact as appropriate, one distinct inquiry per submission, duplicate-click/reload protection, correct owner/consent/field mapping, pending recovery, and exactly one downstream callback task. Check the actual Propstack and n8n records; a green frontend is insufficient.

The thank-you URL is `https://investo-blush.vercel.app/danke` for the current frontend origin. It requires a verified receipt and does not promise that the callback worker has completed.

## Private reconciliation

For an investigated uncertain inquiry write, run `node server/reconcile.mjs <submission-id>` in a protected operator environment with the same `DATABASE_URL` (or `POSTGRES_URL`) and private Propstack key. With no PostgreSQL URL, the CLI uses the local SQLite path instead. It performs fresh CRM reads and marker reconciliation; it does not repeat the uncertain inquiry POST or manually force acceptance. Contact-resolution incidents and restricted records still require an operator decision. There is no browser-accessible operator console.

## Platform references

- [Vercel Node.js functions](https://vercel.com/docs/functions/runtimes/node-js)
- [Vercel project configuration](https://vercel.com/docs/project-configuration/vercel-json)
- [Vercel cron plans and limits](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- [Securing Vercel cron jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
- [SQLite and Vercel](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel)
