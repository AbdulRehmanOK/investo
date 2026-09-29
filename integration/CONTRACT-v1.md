# Investo: landing-page developer integration contract

Version 1 — 24 September 2026. This document replaces the alternative intake proposals in the earlier landing-page review. Website source has not been changed.

## What to build

Keep the React questionnaire, but implement a server endpoint such as `POST /api/inquiries`. Its job is to validate the submission, reuse/create a Propstack contact, then create a distinct Propstack inquiry activity. Propstack sends the signed event to n8n. n8n creates/reuses the follow-up task and stores its processing receipt in Data Tables.

The public browser must never call Propstack or the signed n8n webhook with a private API key. Do not add a second native form submission in parallel. The n8n webhook is for Propstack, not a public form endpoint.

## Browser → website backend

```json
{
  "schema_version": "investo.inquiry.v1",
  "submission_id": "fc50777d-e630-4773-bfcc-9f09150af6a4",
  "form_id": "strategy-check-v1",
  "language": "de",
  "contact": {
    "first_name": "Example",
    "last_name": "Investor",
    "email": "person@example.com",
    "phone": "+491234567890"
  },
  "answers": {
    "income_band": "3.000–5.000 €",
    "investment_goals": ["Vermögensaufbau"],
    "experience_raw": "Einsteiger"
  },
  "contact_permission": {"granted": true, "text_version": "client-approved-v1"},
  "attribution": {"utm_source": "google", "utm_medium": "cpc", "utm_campaign": "strategy"}
}
```

- Generate one UUID per deliberate submission. Reuse it on retries, refresh/resume and uncertain responses. A new later inquiry gets a new UUID.
- The backend adds authoritative receipt time. Do not trust browser timestamps for deduplication, consent evidence time or task scheduling.
- Reject unknown schema/form versions, oversized input, invalid enums, malformed email/phone and missing required fields. Put explicit length limits on every string and array. Escape any user text inserted into HTML.
- Server must rate-limit and apply bot protection. CORS alone is not authentication or bot protection. Keep private credentials in server secret storage; never `VITE_*`, source control, URLs or browser logs.
- Server must reject/ignore client-supplied CRM owner IDs, statuses, scores, approval flags, property IDs, `dry_run`, or “already deduplicated” claims. These are not authoritative.
- Preserve input while a request is pending or fails. Show success only after durable acceptance. Do not describe a request as a booked appointment.

## Backend idempotency

Use durable storage with an atomic unique reservation on `submission_id`, plus a hash of the validated payload. Same ID/same payload returns the previous receipt; same ID/different payload returns 409. Persist progress (contact ID, inquiry ID, uncertain operation) between calls. Serialize contact resolution by normalized email to avoid concurrent duplicate contacts.

On timeout during inquiry creation, do not blindly POST again. Search the contact's activities for the exact `INV-SUBMISSION:<uuid>` marker, reconcile and return its receipt. An unresolved operation stays pending/review; do not claim success or create a new UUID. n8n protects callback duplication but cannot make the website's inquiry POST itself transactional.

Suggested public responses:

- 201/200 `{ "accepted": true, "submission_id": "..." }` only after the inquiry is stored in Propstack (or return a clearly labelled 202 pending receipt if the backend itself has a durable queue and status endpoint).
- 422 field validation errors; 409 ID/payload conflict; 429 throttling with Retry-After; 503 retryable service failure. Never expose vendor responses, API keys or other contact information.

## Backend → Propstack

Base `https://api.propstack.de/v1`; authentication `X-API-KEY` from private server storage.

1. `GET /contacts?email=<encoded-normalized-email>&archived=-1&include_children=true`. Verify exact email match in results; do not use a fuzzy name match. Multiple matches, archived/locked/deleted records or withdrawn permission require review. Do not silently reactivate them.
2. Reuse the exact contact. Preserve its owner, original acquisition source and established lifecycle. Record later answers/attribution in the inquiry instead of overwriting advisor-reviewed information.
3. For a genuinely new contact, `POST /contacts` with `{ "client": { ... } }`. Propstack can update by email on this endpoint, so lookup and concurrency protection still matter. Use source `364441` for this strategy-check form, contact status `348539` if setting a new-contact status, and selected custom fields below.
4. Owner is assigned server-side: use shared holding owner `443334` (info@investo-immobilien.de) for new contacts. Preserve existing Alpaslan `443333`, Akay `443427` or shared ownership. No round robin. Unsupported/missing owners require review. Advisors claim both contact and open callback task.
5. Store consultation permission evidence (purpose, approved text/version, receipt time) in the inquiry. `accept_contact:true` must reflect valid captured permission; a later submission must not silently reverse a withdrawal. Do not set newsletter consent, GDPR agreement, approval or finance readiness from a generic checkbox.
6. Create the inquiry even when the contact already exists:

```json
{
  "task": {
    "note_type_id": 734823,
    "title": "INV Website-Anfrage | Strategie-Check",
    "broker_id": 443333,
    "client_ids": [123456],
    "client_source_id": 364441,
    "body": "<p>INV-SUBMISSION:fc50777d-e630-4773-bfcc-9f09150af6a4</p><p>Form: strategy-check-v1</p><p>Received: SERVER_ISO_TIMESTAMP</p><p>Approved permission text/version and escaped answers/attribution here.</p>"
  }
}
```

Send this to `POST /tasks`. Replace example contact/owner IDs with resolved values. Category `734823` is the actual dedicated `INV – Website-Anfrage` category. Use exactly one linked contact and a valid UUID marker. Do not set `is_event`, `is_reminder`, an appointment time, or a fake property.

The current worker accepts website sources `364440` (Investmentberatung), `364441` (Strategie-Check), `364442` (Kontaktformular), and `364443` (Objektanfrage). This landing form uses `364441`; do not allow arbitrary sources from browser input.

## CRM fields and exact answer values

Use `partial_custom_fields` to update selected values, never replace all `custom_fields`. **Live write/read tests confirmed that dropdowns require numeric option IDs and this account's multiselect requires comma-separated option IDs. Do not send German labels to the CRM or a JSON array for `investmentziel`.** Browser labels may remain readable; map them on the server.

| Value | Field / accepted values |
|---|---|
| New strategy-check phase | `lead_phase_aktuell`: `355771` = Strategie-Check vollständig — new contacts only |
| Income band | `nettohaushaltseinkommen`: `320198` = Unter 3.000 €; `320199` = 3.000–5.000 €; `320200` = 5.001–8.000 €; `320201` = 8.001–12.000 €; `320202` = Über 12.000 € |
| Goals | `investmentziel`: `320180` = Altersvorsorge; `320181` = Cashflow; `320184` = Diversifikation; `320183` = Kapitalerhalt; `320182` = Steueroptimierung; `320179` = Vermögensaufbau. Send e.g. `"320179,320180"` |
| First attribution | `utm_quelle`, `utm_medium`, `utm_kampagne`; preserve original values on repeat inquiries |
| Names / telephone | `first_name`, `last_name`, `home_cell`; use separate name inputs and deliberate international phone normalization |
| Experience | Store the original answer in the inquiry. Do not infer an exact property count. |

Current website income bands overlap CRM bands and must be corrected. Do not approximate old values. Missing financial values are unknown, never zero. Keep original answers in the inquiry for review.

Verified CRM fragment:

```json
{"client":{"partial_custom_fields":{"lead_phase_aktuell":355771,"nettohaushaltseinkommen":320199,"investmentziel":"320179,320180"}}}
```

Read responses wrap each custom field in `{ "value": ..., "pretty_value": ... }`; do not compare that object directly to a string. A supplied server mapping adapter is `automation/website-mapping.mjs`; it does not replace the backend's durable idempotency, authentication or contact-resolution implementation.

## What n8n does after the inquiry

Propstack → authenticated task-created webhook → durable event inbox → scheduled worker → fresh inquiry/contact reads → duplicate/reconciliation checks → callback task category `710193` for the existing eligible advisor/shared owner. Existing open callback tasks are reused; repeated delivery of the same submission does not create another task. Withdrawn/locked/archived contacts are suppressed. Missing owner and ambiguous writes go to the incident queue.

This flow does not currently book appointments, email customers, run PriceHubble valuations, reject finance applications or create property deals. The website must not promise those actions have occurred.

## Required developer acceptance tests

New inquiry, existing contact with later inquiry, double-click, concurrent identical requests, same UUID with changed payload, timeout after Propstack accepted the inquiry, invalid enum, bot/throttle, withdrawn contact and vendor outage. Verify the actual contact, inquiry and one callback task—not merely a green UI acknowledgement. Confirm keyboard/mobile form behavior and approved copy before launch.

References: [Propstack contacts](https://docs.propstack.de/reference/kontakte), [tasks](https://docs.propstack.de/reference/aktivitaeten), [activities](https://docs.propstack.de/reference/aktivitaeten-1), [signed webhooks](https://docs.propstack.de/reference/webhooks).