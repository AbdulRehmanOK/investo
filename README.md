# Investo Immobilien

React/TypeScript landing page with German, English and French. The latest integration follows `integration/CONTRACT-v1.md`.

## Run locally or on a persistent Node server
Requires Node.js 22.x (22.13 or later) and npm.

```sh
npm ci
npm run build
npm start
```

Open http://127.0.0.1:3001/. For development, run `npm run dev:api` and `npm run dev` in separate terminals. Vite on port 3000 proxies the API to 3001. If esbuild cannot access ancestor directories in a restricted environment, use `npm run build -- --configLoader runner`.

Copy `.env.example` to `.env` and configure private server settings. Without Propstack/Turnstile credentials and approved consent, the form remains a review preview and cannot submit. The confirmed new-contact owner is the shared info@ queue (443334), configured server-side; existing advisor owners are preserved.

## Inquiry flow
Browser -> POST /api/inquiries -> exact Propstack contact resolution -> distinct inquiry activity -> Propstack signed event -> existing n8n callback worker.

There is no browser or website-server POST to the n8n webhook. The previous /api/leads intake returns 410. Existing contacts are never edited by this implementation. The website neither books appointments nor creates callback tasks itself.

The API uses durable reservations, payload hashes, process leases, contact locks by normalized email, server timestamps, and readback/reconciliation. The persistent Node server uses SQLite and resumes pending work every 15 seconds. Vercel functions use shared PostgreSQL and an authenticated retry worker. Review incidents need operator attention. Static hosting alone cannot process inquiries.

## Deploy on Vercel

The frontend is hosted at https://investo-blush.vercel.app/. This repository now includes matching functions for `GET /api/inquiries/config`, `POST /api/inquiries`, and `GET /api/inquiries/status/:id`; their production deployment and live CRM behavior still require verification.

Use the repository root as Vercel's Root Directory, the Vite preset, `npm run build`, output `dist`, and Node.js 22.x. Do not set the project root to `dist`. `vercel.json` includes the functions and explicit legal/thank-you route rewrites without redirecting API requests to the frontend.

Configure private database, Propstack, Turnstile, consent, owner and retry-worker settings in Vercel, then redeploy. Shared PostgreSQL replaces SQLite for this deployment; never use `/tmp` as durable inquiry storage. The bundled daily cron is only a recovery backup. A verified frequent authenticated retry schedule is required before enabling live submissions. `/api/inquiries/config` returns `available: false` while required settings or storage are unavailable.

Follow [integration/VERCEL.md](integration/VERCEL.md) for exact environment names, deployment steps, retry scheduling and verification. No production credentials are included in the repository.

## Validate
```sh
npm run lint
npm test
npm run build
```

Tests use simulated CRM and bot-verification responses and an embedded PostgreSQL engine for storage behavior; they do not prove that production credentials, networking or the live n8n callback workflow are configured. See `integration/HANDOVER.md` for data handling, open launch settings, field mapping and acceptance checks.

Photos, smooth navigation, existing copy and the language selector are preserved. See `ASSET_SOURCES.md` and `CHANGES.md` for earlier changes.

## Performance

The production build includes a prerendered homepage, responsive local photographs, local fonts, deferred video loading, and compressed/cacheable static assets. Use `npm run build` so prerendering runs; calling Vite directly skips it. See `PERFORMANCE.md` for measurements, verification and hosting requirements.
