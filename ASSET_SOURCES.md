# Asset and data sources

## Real consultation and strategy photographs

The strategy steps and FAQ use photographer-created stock photographs, not AI-generated pictures. Step 3 retains the user's original house photograph. All new photographs were downloaded from Pexels on 2026-09-25 as compressed 1600-pixel-wide JPEGs. Their content is unchanged; framing and overlays use CSS.

| Placement | Saved asset | Photographer and original source |
| --- | --- | --- |
| Step 1 — first conversation | `public/images/strategy-step-consultation.jpg` | Kindel Media — [Couple listening to an adviser explaining documents, 7979438](https://www.pexels.com/photo/a-couple-listening-to-the-person-explaining-the-details-of-the-documents-on-the-table-7979438/) |
| Step 2 — financing | `public/images/strategy-step-financing.jpg` | RDNE Stock project — [Real estate agent using a calculator, 8292839](https://www.pexels.com/photo/a-real-estate-agent-using-a-calculator-8292839/) |
| Step 3 — property matching | `public/images/house-garden-dusk.jpg` | Original user-supplied photograph |
| Step 4 — review and decision | `public/images/strategy-step-decision.jpg` | RDNE Stock project — [Property documents on a clipboard, 8292784](https://www.pexels.com/photo/person-reading-and-holding-document-files-on-clip-board-8292784/) |
| FAQ — personal advice | `public/images/faq-property-consultation.jpg` | Alena Darmel — [Property blueprint discussion, 7641854](https://www.pexels.com/photo/man-showing-a-property-blueprint-to-a-couple-7641854/) |

License: [Pexels License](https://www.pexels.com/license/), permitting commercial website use and cropping. Stock models and properties are illustrative; they are not presented as actual Investo employees, customers, endorsers or listings.

Original file endpoints:
- https://images.pexels.com/photos/7979438/pexels-photo-7979438.jpeg
- https://images.pexels.com/photos/8292839/pexels-photo-8292839.jpeg
- https://images.pexels.com/photos/8292784/pexels-photo-8292784.jpeg
- https://images.pexels.com/photos/7641854/pexels-photo-7641854.jpeg

## Strategy section property video

- Video: `public/videos/strategy-property-tour.mp4` (1280 × 720, approximately 13 seconds).
- Matching poster: `public/images/strategy-property-video-poster.jpg`.
- Source: [European style buildings, Mixkit 4352](https://mixkit.co/free-stock-video/european-style-buildings-4352/).
- Video download: https://assets.mixkit.co/videos/4352/4352-720.mp4
- Poster download: https://assets.mixkit.co/videos/4352/4352-thumb-720-0.jpg
- License: [Mixkit Stock Video Free License](https://mixkit.co/license/), commercial and personal website use permitted by the individual source page; checked 2026-09-25.
- Authentic stock footage of Paris apartment buildings, used illustratively. These are not represented as actual Investo listings or a German location.
- Files are hosted locally and copied unchanged. The video loops silently while the section is visible, pauses offscreen, and offers translated play/pause controls. Reduced-motion users initially see the matching still poster and can start playback manually. Mobile framing is square, with the desktop video fitting beside the strategy steps.

## User-supplied house photographs

Four original JPG attachments supplied by the user on 2026-09-24 replace the repeated property image. Files are copied unchanged; framing uses CSS object positioning.

- `public/images/house-blue-porch.jpg` — attachment 3; former hero property photograph, retained but no longer displayed.
- `public/images/house-garden-dusk.jpg` — attachment 1; property-matching step in the Strategy Check section.
- `public/images/house-warm-evening.jpg` — attachment 2; former FAQ image, retained but no longer displayed.
- `public/images/house-turquoise-terrace.jpg` — attachment 4; former closing strategy image, retained but no longer displayed.

Descriptive alt text is available in German, English and French. These are illustrative photographs; their locations are not asserted.

## Hero apartment photograph (restored 29 September 2026)

`public/images/berlin-apartments.jpg`

- Subject: Modern apartment building, Berlin, Germany.
- Photographer: Grant Lemons.
- Source: https://commons.wikimedia.org/wiki/File:Modern_apartment_building_(Unsplash).jpg
- Original Unsplash page: https://unsplash.com/photos/jTCLppdwSEc
- License: CC0 1.0, as documented on the Wikimedia Commons source page (originally published before the Unsplash license change).
- Used as illustrative property photography, not as a claim that this building is an Investo listing. Alt text marks it as a symbolic image.
- Restored only in the hero property tab on 29 September 2026 following the requested replacement of the detached house with apartments in Germany. Other section photographs remain unchanged. Existing responsive WebP versions are reused; the Commons source and CC0 status were rechecked.

## Financing partner logos

`public/images/partner-1.jpg` through `partner-8.jpg` copied from the existing client website https://www.investo-immobilien.de/ on 2026-09-24.

1. ING — https://framerusercontent.com/images/MDgUbpLo2oQcw9ee7GT1HCwyk.jpg
2. Sparkasse — https://framerusercontent.com/images/24uAlVe0h9111vbjgc31Bscb5Y.jpg
3. Volksbanken Raiffeisenbanken — https://framerusercontent.com/images/G3O4kghYI5WusxaBNDLSMEXhZkY.jpg
4. Schwäbisch Hall — https://framerusercontent.com/images/MIFBGkaDyUY4cwWd8VzkBS0fzA.jpg
5. HypoVereinsbank — https://framerusercontent.com/images/bNVPIg2cR1VkIKs54H5LEonN0.jpg
6. Interhyp — https://framerusercontent.com/images/wJNAaNOBMcIVdsHQXAjfXVHWWrA.jpg
7. Deutsche Bank — https://framerusercontent.com/images/6AEvOWCnXrJlPNCxCh9VSdWhXYc.jpg
8. Dr. Klein — https://framerusercontent.com/images/xAk4DJVWmSgAtlKgZDJVnvxxxk.jpg

## Company details

Confirmed against https://www.investo-immobilien.de/ and https://www.investo-immobilien.de/impressum on 2026-09-24.

Investo Immobilien UG; managing director Alpaslan Coskun; Maximilianstraße 15c, 87719 Mindelheim; +49 (0) 175 7111 188; info@investo-immobilien.de; HRB 22308, Amtsgericht Memmingen; VAT ID DE463921337.

Existing unrelated remote assets and the existing founder video are retained from the supplied source.


## Responsive media and local fonts (September 2026)

The WebP files in public/images/optimized are resized and compressed versions of the existing supplied or credited photographs and logos. No new AI images were introduced. src/content/image-manifest.json retains the original URL/path mapping.

Inter and Lora are now served locally. Font source URLs and the bundled SIL Open Font License files are in public/fonts/SOURCES.md.

The former blue-house hero derivative retains its 4:3 crop. The current Berlin apartment hero uses existing responsive derivatives of the full photograph with CSS framing for mobile and desktop. The faint villa-background derivative has its existing grayscale effect encoded into the image to avoid a large runtime filter. Original photographs remain available.
