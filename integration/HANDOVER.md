# Investo inquiry integration handover

## Current delivery

Implemented the supplied 24 September 2026 contract in the existing landing page. The authoritative request is preserved as CONTRACT-v1.md. The former website-to-n8n adapter is retired. No real CRM data or n8n workflow was modified. Vercel function routing and shared PostgreSQL support have been added to the repository; production deployment, secrets and live acceptance are not confirmed by this handover.

1. Landing page: public frontend https://investo-blush.vercel.app/; local http://127.0.0.1:3001/. Backend readiness must be checked after deploying the matching functions.
2. Form: Investo Strategy Check, four-step React/TypeScript questionnaire, Node/Express backend. Persistent Node hosting uses SQLite; Vercel functions use shared PostgreSQL.
3. Form ID: strategy-check-v1. Schema: investo.inquiry.v1. No Propstack embed or parallel native form.
4. Local staging: http://127.0.0.1:3001/?utm_source=staging&utm_medium=qa&utm_campaign=contract-v1. No separately configured public staging CRM environment is claimed.
5. Browser request example: example-submission.json. Complete website mapping: field-mapping.json. Server adapter: automation/website-mapping.mjs.
6. Exact DE/EN/FR consultation and separate newsletter wording: consent-text.json. Version 2026-09-24-v1 is a draft implementation version. The contract's client-approved-v1 example is not evidence that this wording was approved.
7. Thank-you route: /danke (https://investo-blush.vercel.app/danke on the current public origin). It requires a verified server receipt and does not promise an appointment or confirm that a callback task already exists.

The expected public API is GET /api/inquiries/config, POST /api/inquiries and GET /api/inquiries/status/:id. The separate GET /api/inquiries/retry worker requires the server-only scheduler secret. See VERCEL.md for project root, routing, environment setup and deployment checks.

Legal subpages are available at /impressum and /datenschutz. The privacy page contains the user-supplied policy in English with German and French translations, including its provider and tracking claims. The text was formatted and translated, not legally reviewed; its Framer, CleanTalk, Facebook Pixel and Google Ads references do not describe services configured in the current code. Policy content is maintained in src/content/privacy-policy.*.json.

## What changed

POST /api/inquiries validates schema, form ID, language, required contact fields, exact income band, investment goals and experience. The earlier extra questionnaire fields remain available; optional absent numeric answers are omitted, never converted to zero. Explicit property count is separate from experience and is never inferred.

Phone numbers must include +country-code or 00-country-code. Formatting spaces, dots, parentheses and hyphens are removed; local-only numbers and ambiguous optional trunk-zero notation are rejected. Email is trimmed/lowercased for exact contact lookup and locking. This is format validation, not verification of ownership or phone reachability.

Unrecognized browser fields are ignored, including owner/source/property IDs, scores, flags, timestamps and dry_run. Known fields have explicit limits; body size is capped at 16 KiB. HTML in the inquiry is escaped. Contact permission and optional newsletter preference are independent; neither sets GDPR approval, newsletter subscription or finance readiness.

The API returns accepted:true only after the inquiry exists in Propstack and a matching readback verifies it. Otherwise a durable receipt is pending or review with HTTP 202. Responses expose no CRM contact data, owner IDs, secrets or vendor errors.

## Server launch settings

Set PROPSTACK_API_KEY in private secret storage. API base is fixed to https://api.propstack.de/v1 with X-API-KEY authentication. Never place keys in VITE_* variables, source control, browser logs or URLs.

Configure TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY for the actual domain. The site key is public; the secret stays on the server. Server verification checks success, hostname, action investo-inquiry and cdata matching the submission UUID. Missing/failed verification cannot create a lead. The widget uses the official Cloudflare script; production CSP must allow its documented script/frame endpoints.

Approve the exact consent wording in all enabled languages before setting CONTACT_CONSENT_APPROVED=true. If the wording changes, change CONSENT_VERSION and regenerate consent-text.json with it. Historical evidence remains the stored snapshot.

Choose PROPSTACK_NEW_CONTACT_OWNER_ID only after agreeing the business rule: 443333 = Alpaslan, 443427 = Akay. Blank does not assign arbitrarily: the persistent Node server sends new contacts to local review with no CRM write, and the Vercel runtime keeps the form unavailable. No rotation/distribution rule was assumed. Existing eligible CEO owners are preserved. The choice and exact consent approval remain unresolved launch settings.

Set PUBLIC_SITE_URL to the HTTPS site origin and ALLOWED_ORIGINS to exact approved frontend origins. The backend applies durable per-IP limits of 10 submission attempts and 120 rate-limited API requests per minute with Retry-After, including failed bot attempts. The public readiness endpoint and separately authenticated retry worker are outside that shared limiter.

For Vercel, set the project root to the repository root, use Node.js 22.x, npm run build and output dist. Configure DATABASE_URL (or POSTGRES_URL) for shared managed PostgreSQL with verified TLS. The versioned migration creates the isolated investo_intake schema; the database role needs initialization permissions. Configure a random CRON_SECRET of at least 32 characters and a frequent authenticated retry schedule before setting INQUIRY_RETRY_SCHEDULE_CONFIRMED=true. The bundled daily Vercel cron is only a backup, not the required frequent recovery schedule. The Vercel runtime uses the platform ingress IP header and keeps config available:false until its settings and database are ready. Credentials are server-side; see VERCEL.md for the complete sequence.

For a persistent Node server, set HOST=0.0.0.0 only when needed by hosting and LEAD_DB_PATH to persistent protected storage. When behind a reverse proxy, set TRUST_PROXY to the exact trusted proxy IPs/CIDRs so the rate limit identifies the real visitor; do not trust arbitrary X-Forwarded-For. These local server settings do not configure Vercel functions.

For persistent hosting, run npm ci, npm run build and npm start. Host the frontend and API together, or route /api/* to the Node service and serve the SPA entry at /danke, /impressum and /datenschutz, including trailing slashes, for direct navigation and reloads. The Node server provides these routes; restart it after routing changes. On Vercel, api/ supplies the functions and vercel.json supplies explicit legal/thank-you rewrites. The static preview includes public/_redirects for Netlify-style rewrites; do not rewrite API or asset requests to the SPA. A static-only preview cannot deliver inquiries.

## Durable state and uncertainty

The inquiries table stores canonical payload, consent-text snapshot, authoritative received_at, token/payload/email hashes, status, operation phase, contact/owner/inquiry IDs and a process lease. A primary key reserves each submission UUID atomically. Same ID/same payload returns the existing receipt; same ID/different payload returns 409.

A separate unique email lock serializes this backend's contact lookup/create operations across processes sharing the same store: one SQLite file for persistent local hosting or one PostgreSQL database for Vercel instances. There is no automatic lease expiry for an uncertain contact-create lock: unresolved contact creation must not allow a later inquiry to create another contact. Other independent CRM writers can still race with Propstack's upsert-by-email endpoint; coordinate intake writers at launch.

Persisted intent precedes each mutating CRM call. Contact-create uncertainty uses exact-email lookup; inquiry-create uncertainty searches paginated contact activities and checks the leading exact INV-SUBMISSION marker, dedicated category/source, owner and single linked contact. Neither uncertain POST is automatically repeated. A confirmed inquiry ID is read back directly. Three unresolved reconciliation attempts enter review; vendor outages remain pending and retry only safe reads/unfinished pre-write work.

On persistent Node hosting, the process resumes pending work every 15 seconds (retry backoff 30 seconds after failures); at least one process must run continuously. Vercel instead performs bounded, awaited work during requests and uses the authenticated /api/inquiries/retry scheduler for pending work. It does not rely on timers after a response or on an ephemeral local file. Process leases expire after 90 seconds following a crash, are renewed during work, and fence stale or expired claims from state updates. Multiple processes/functions must share the same durable database.

Status endpoint: GET /api/inquiries/status/:id with Authorization: Bearer <receipt-token>. It is read-only, does not reveal contact/CRM data and does not retry a POST.

Operator inspection: review the protected inquiries table's status, phase and review_reason (investo_intake.inquiries in PostgreSQL). Do not expose it through a public endpoint. For a previously uncertain inquiry write, after investigating the incident, run node server/reconcile.mjs <submission-id> with the server key and the same database configured. The CLI selects PostgreSQL when DATABASE_URL or POSTGRES_URL is present, otherwise local SQLite. It performs fresh CRM reads and marker reconciliation, never manually marks a receipt accepted and never repeats inquiry creation. Restricted contacts, unknown owners and unresolved contact creation need an operator decision; there is no public reset/force-send endpoint.

The earlier submissions table, if present, is left untouched. Legacy pending n8n records and local SQLite inquiries are not automatically migrated into PostgreSQL or replayed. Review them separately before replacing a live deployment.

## Data handling

Unlike the earlier hash-only store, the durable queue stores personal/financial answers and consent evidence. Protect the local disk or managed database and its backups with access controls and encryption, select the hosting region under the owner's requirements, and apply the owner's retention policy. Exclude .data/, .env and .vercel/ from version control, archives and static hosting. Do not erase deduplication records without a reviewed retention/tombstone policy; deleting IDs can permit replays.

The browser retains the draft in sessionStorage to support refresh/resume. It is cleared after confirmed acceptance or an explicit new later inquiry; the receipt stays for status checks. Closing the tab ends normal session storage. If browser storage is blocked, drafts survive only while the page remains open. No automatic resend occurs on reload.

A deliberate Start another enquiry action after confirmation creates a new UUID. Pending/uncertain requests have no new-ID shortcut. The success event investo:lead-submitted contains only form_id, submission_id and received_at once per session receipt.

## Propstack mapping and downstream boundary

Uses the account IDs provided by the contract: source 364441, new-contact status 348539, phase option 355771, inquiry category 734823. Numeric income dropdowns and comma-separated goal IDs are defined in automation/website-mapping.mjs. The wrapper helper fieldValue reads custom field value wrappers.

Only genuinely new contacts receive initial selected custom fields, original attribution and captured accept_contact:true. Existing exact matches are not updated. Archived, locked, deleted, withdrawn/unknown-permission, ambiguous-email and unassigned/non-CEO contacts require review; later submission never reverses withdrawal.

Each accepted submission creates its own /tasks inquiry linked to exactly one contact, with no is_event, is_reminder, appointment timestamp, property or callback-task creation. The inquiry contains original answers, experience, source attribution and separate consent evidence.

Propstack must send its authenticated task-created event to the already specified n8n flow. That flow's durable inbox/Data Tables, signed webhook verification, fresh contact reads, callback category 710193 and incident handling are outside this website repository. No workflow export, credentials or deployment access was supplied here, so their configuration and live behavior remain unverified. The website does not POST to that webhook and does not claim callback completion.

## Acceptance evidence and launch checks

Automated tests use a simulated Propstack API and bot verifier. They cover new contacts, existing contacts and later inquiries, concurrent identical IDs, changed-payload conflicts, email serialization, restart persistence, accepted-then-timeout reconciliation, missing inquiry reconciliation, contact-create timeout, restricted contacts, enum/length/phone limits, HTML escaping, ignored privilege flags, bot failure, throttling and vendor outage. PostgreSQL-engine tests exercise shared-store behavior, and asynchronous-store tests check persistence ordering and bounded processing. These tests do not validate production database access, provider TLS, actual credentials or Vercel account settings.

Before launch with account access, verify the actual contact, dedicated inquiry and one callback task in a staging workflow for each contract scenario. Confirm exact IDs/response shapes, private key permissions, Turnstile production hostname, reverse-proxy IP handling, owner rule and approved consent wording. Mock tests and a green UI are not evidence that the external callback worker ran.

## Official implementation references

- https://docs.propstack.de/reference/kontakte
- https://docs.propstack.de/reference/aktivitaeten
- https://docs.propstack.de/reference/aktivitaeten-1
- https://docs.propstack.de/reference/webhooks
- https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/
