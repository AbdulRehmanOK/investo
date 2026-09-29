# Document change checklist

## User-supplied hero interior — 29 September 2026

- Replaced the hero property tab's Berlin building photo with the supplied apartment dining/living interior, retaining the existing card, tabs and animations.
- Preserved the uploaded PNG and added responsive WebP versions. Image descriptions identify the interior without asserting an unverified location; the previous building attribution remains recorded in `ASSET_SOURCES.md`.
- Validation: TypeScript and production prerender build passed; desktop (1440px) and mobile (390px) photo framing and loading checked, with no horizontal overflow or console errors. The largest served WebP is 62 KB; the original upload is preserved.

## Screenshot revisions — 29 September 2026

English translation of the visible feedback dated 26 September 2026:
1. Replace the house with an apartment in Germany.
2. Remove the statistics strip because it is duplicated further down. The end of this note is partly obscured in the supplied screenshot.

- Replaced the detached-house hero photo with the existing real Berlin apartment-building photograph by Grant Lemons, using responsive local WebP files and translated illustrative alt text. Adjusted its crop while keeping the existing card, tabs and animations.
- Removed the standalone white 12+ / 100+ / 15+ / 50+ statistics strip and its unused component. The figures in the lower trust section remain, as does the separate hero credibility summary.
- Validation: TypeScript and production prerender build passed. Desktop and 390/320px mobile checks confirmed the new image loads, no horizontal overflow, the duplicate section is absent and the lower trust metrics remain. Existing DE/EN/FR image descriptions are reused. No new performance score is claimed.

## Minimal hero card accents — 26 September 2026

- Added the approved thin gold orbit with a slow traveling dot behind the existing hero card, plus a short gold highlight following its rounded edge. Existing layout, photographs, content, architectural illustration and interactive panels remain intact.
- Both accents use small SVG/CSS layers with no new dependencies or media assets. Motion pauses offscreen, when the document is hidden, or through the translated keyboard-accessible pause button. Reduced-motion preferences display static accents.
- Validation: TypeScript and production prerender build passed. Browser checks covered 1440px desktop and 390/320px mobile with no horizontal overflow, all three card panels, calculator updates, keyboard pause/resume, offscreen pausing, DE/EN/FR labels and no console errors. Reduced-motion and document-visibility handling were inspected in code. No new Lighthouse score is claimed for this addition.

## Architectural homepage motion — 26 September 2026

Visibility refinement: enlarged the architectural artwork, added a subtle navy frame, brighter/heavier gold lines, a clearer selected stage and stronger timeline routes. Retained finite animation and reduced-motion support.

- Added an original gold SVG architectural illustration beneath the hero CTA, with a short outline drawing and building entrance. Three translated stage controls synchronize with the existing strategy, financing and property panels; replay is available without auto-cycling content.
- Replaced the investment timeline's continuous ray and floating nodes with a finite route and milestone drawing on first viewport entry. Detail cards support keyboard activation, focus return and Escape. Long dialogs scroll within short screens.
- Kept existing real photographs, calculator state, lead form and legal routes. Added no media downloads or dependencies. The decorative artwork is static before hydration and under reduced-motion preferences; primary content is never hidden for an entrance animation.
- Validation: TypeScript and production prerender build; desktop and 320/390px browser checks, DE/EN/FR labels, synchronized controls and calculator, all five timeline dialogs, keyboard focus and the timeline-to-lead-form action. No real inquiry submitted. The final focused Lighthouse accessibility recheck scored 100 with no runtime warnings; the performance follow-up and its limitations are recorded in `PERFORMANCE.md`.

## Integration contract v1 (current implementation)

The supplied 24 September 2026 contract supersedes the earlier direct-to-n8n proposal below.

- Replaced `/api/leads` with versioned `/api/inquiries`. Retained the questionnaire and added exact CRM income bands, six investment goals with multiple selection, and explicit experience. Missing optional financial values stay unknown.
- Added server-only Propstack contact lookup/create and a separate inquiry per submission. Existing contact records and owners are preserved. Restricted, ambiguous or unassigned records enter review.
- Implemented the supplied source/status/category and numeric custom-field IDs in `automation/website-mapping.mjs`. Goals use comma-separated option IDs. All original answers and separate permission evidence are escaped into the inquiry.
- Added persisted operation progress, exact-email contact locks, process leases, restart recovery and reconciliation by the exact submission marker. Uncertain writes are never blindly repeated.
- Added Turnstile verification, persistent throttling, strict schema and length validation, private configuration and receipt-token access. Bot verification fails closed; there is no public n8n submission.
- Added session draft recovery, an explicit new-inquiry action after confirmation, and separate optional newsletter evidence without modifying CRM newsletter/GDPR flags.
- Preserved the contract, updated field mapping and examples, and replaced the integration guide. Live Propstack/n8n acceptance remains pending account access, CEO assignment and approved consent settings.

The earlier integration section is a historical record and no longer describes the active submission route.

## Lead form and server integration preparation

- Replaced the earlier demo questionnaire and local confirmation with a translated four-step lead form covering all requested contact, purchase, financial, preference and property fields.
- Added required contact consent and a separate optional, unchecked newsletter preference; versioned wording is included in German, English and French.
- Added server validation, fixed form/source metadata, landing URL and UTM attribution, unique submission IDs and server timestamps.
- Added a server-side authenticated n8n webhook adapter and persistent SQLite deduplication. A successful receipt requires an explicit acknowledgement containing the same submission ID. Ambiguous delivery remains pending instead of automatically retrying.
- Added `/danke` with server receipt verification and a once-per-session receipt success event. Refreshing never posts the form again.
- Added the complete proposed Propstack mapping, sample payload, consent texts, environment template and connection handover under `integration/`.
- No existing Propstack embed was supplied. The custom alternative is implemented; real n8n/Propstack configuration, CRM verification and public deployment are still pending. Static-only hosting cannot run the new lead backend.

Validation: TypeScript and production build passed. Ten server test cases passed, covering required fields, consent separation, metadata, concurrent duplicates, persistent deduplication across restart, missing configuration, ambiguous responses and origin/rate checks. Browser checks passed for a complete English submission against a local mock webhook, mandatory consent, optional newsletter, double-click protection, a single success event, verified confirmation across reload, German/French forms at 390px, pending-state recovery at 320px, direct thank-you visits and no JavaScript errors. No real lead was sent to n8n or Propstack.

The sections below record earlier website changes; references to the old demo confirmation describe prior checks and are superseded by this lead form update.

## Smooth section navigation

Header anchor links now scroll smoothly to their target sections on desktop and mobile, retaining standard URL fragments and browser navigation. Reduced-motion preferences are respected.

## House photograph update

Replaced the four repeated Berlin building images with four distinct user-supplied house photos: blue house in the hero, garden house in Strategy Check, sunset house in FAQ, and turquoise terrace in the closing section. Each has individual CSS framing and descriptive alt text in all three languages. Original uploaded image files are preserved without retouching.

Implemented from the supplied English translation, with final German copy from the original document.

- Hero introduction and 100+ accompanied purchases: verified existing matching text.
- Strategy Check: monthly net household income question, explanatory sentence, all four ranges; removed irrelevant property-type descriptions; income label carried through to confirmation.
- Strategy Check section image: replaced with a photograph of a real Berlin residential building.
- Problem/solution heading, property-selection step and concluding statement: verified existing matching text.
- Five-step investment path and reassurance text: verified existing matching text.
- Investment philosophy: verified the three criteria and descriptions; corrected the section label.
- Example investment concepts and the returns/risk strip marked for removal: already absent from the supplied source; remain absent. The standalone credibility statistics strip is a different component and was retained.
- Financing partners: all eight logos from the existing Investo website included locally with meaningful names.
- Target groups: heading, explanatory copy and individual/strategic statement updated.
- Why Investo: all four comparison rows, labels, expanded explanations, popup headings and CTA labels updated.
- Trust: section label, introduction, three principles, video label, founder quote, names, contact description and circular badge updated. Existing video and lower video wording retained.
- Trust metrics: 12+ years, 100+ purchases, 15+ network experts, EUR 50+ million transaction volume, with requested descriptions. Standalone credibility descriptions aligned.
- FAQ: heading, introduction, four questions and answers, contact prompt and photograph updated.
- Closing section: heading, explanatory text, two buttons, four roadmap steps, three benefits and photograph updated.
- Footer: actual phone, email, address and company registration details from the existing website; working telephone/email links; privacy link points to the existing full policy. Removed prototype credit and sample company details.
- Calculator: nominal interest rate 4%; requested EUR 300 illustrative tax-benefit wording; property photo replaced.
- Repeated reminders at the end of the document addressed by the same component changes above.

Long comparison dialogs and the Strategy Check can scroll on small screens. The founder and statistics layout was adjusted to fit the requested longer copy. The Vite alias now uses an ESM-compatible path.

The source language and existing visual theme are preserved. No live deployment was performed.

## Verification

- TypeScript: `tsc --noEmit` passed.
- Production build: `vite build --configLoader runner` passed. The existing single-bundle size warning is non-blocking.
- Browser checks at desktop (1440px) and mobile (390px): questionnaire income options, back navigation and local confirmation; four comparison dialogs and their CTA connections; four FAQ accordions; contact links and imprint data; calculator amounts at two purchase prices; all nine unique local image files; immediately displayed metrics; mobile dialog scrolling.
- No page horizontal overflow at the tested widths and no JavaScript page errors in the browser tests.
- The original archive and extracted baseline remain unchanged.

The requested trust figures render immediately rather than briefly showing zero during scroll-triggered counting.

## Language selector fix

- Replaced the label-only selector with a shared German / English / French language context.
- Added English and French translations for page copy, navigation, calculator labels, FAQs, detail popups, form steps, validation, confirmation summaries, legal dialogs and image descriptions.
- Desktop menu and mobile select update the same language setting. The preference survives refreshes and synchronises across browser tabs; switching also works when browser storage is unavailable.
- HTML language, page title and calculator number formatting follow the selection. Form answers retain their original values while their displayed labels change, preserving an in-progress questionnaire.
- Verified desktop and mobile switching, returning to German, reload persistence, both translated four-step forms, translated summaries, FAQs and legal dialogs. No horizontal page overflow at 320, 390, 1024 and 1440 px, and no JavaScript errors in those checks.
- TypeScript checks and production build passed. Embedded videos and linked external documents retain their original language.

## Performance improvements — 26 September 2026

Prerendered homepage, responsive WebP media, local Inter/Lora fonts, visibility-controlled video/decorative motion, lazy lead/legal modules, static compression and immutable fingerprinted caching. Improved accessible controls, contrast, heading order and metadata. Preserved multilingual navigation, calculators, strategy-photo selection, form drafts and legal routes. Fixed the hero photo-overlay clipping at 320 px. Validation details and measured Lighthouse results are in PERFORMANCE.md.
