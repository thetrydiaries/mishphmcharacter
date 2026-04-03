# mishphmcharacter — Internal Compositor Tool
# CLAUDE.md — project context for Claude Code sessions

---

## What this is

An internal web app for a wedding favour business (Australian market) called mishphmcharacter.
We photograph wedding guests, use AI to suggest an illustrated character for each guest using a
library of hand-drawn PNG assets, then export print-ready trading cards (63×88mm).
The illustrator reviews and approves each card before export.

This is NOT a customer-facing product. Only the operator and illustrator use this tool.
There is no public sign-up, no customer login, no payment processing.

---

## Users

**Operator (primary user — the business owner)**
- Uploads guest photos in bulk
- Names guests, assigns table numbers
- Triggers AI analysis
- Adjusts outfit colours
- Manages exports
- Coordinates with illustrator

**Illustrator (reviewer)**
- Reviews AI-suggested illustrations in batch view
- Approves or flags each illustration
- Uses asset switcher to fix mismatches
- Leaves notes for operator
- Target: 15–20 minutes per wedding, not hours of drawing

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite (runs on localhost:5173) |
| Canvas / compositor | Konva.js |
| Backend API | Node.js + Express (runs on localhost:3001) |
| Database | Supabase (PostgreSQL) |
| File storage | Supabase Storage |
| AI photo analysis | Google Vision API (Phase 4) |
| Print export | node-canvas or Puppeteer (Phase 5) |
| Auth | Simple single-password or Supabase Auth |
| Hosting | Vercel (frontend) + Railway or Render (backend) |

The compositor must work offline once assets are loaded — all asset PNGs should be
cached so the illustrator can work without a constant connection.

---

## Project folder structure

```
/client          React frontend
/server          Express backend
/assets          Hand-drawn PNG asset files, subfolders by category:
  /assets/hair
  /assets/face
  /assets/eyes
  /assets/brows
  /assets/nose
  /assets/mouth
  /assets/facialhair
  /assets/body
  /assets/outfit
  /assets/accessories
  /assets/frames
CLAUDE.md        This file
```

---

## Asset system — critical to understand

### Format rules (non-negotiable)
- All assets are PNG with transparency (RGBA) — not JPG, not PSD
- Every file must be exactly 630 × 880 pixels — every single one, no exceptions
- Transparent background — not white. White pixels block layers beneath them
- Colour mode: sRGB (not CMYK)
- Outlines must be full black at 100% opacity — no semi-transparent strokes

### Layer order (bottom to top, z=1 is lowest)
```
z=1   Card frame (full-bleed background + decorative border)
z=2   Body + outfit (torso, arms, clothing)
z=3   Face shape (face oval — drawn in neutral grey, tinted to skin tone)
z=4   Facial hair (beard, stubble, moustache — or transparent 'none')
z=5   Nose
z=6   Mouth
z=7   Eyes (drawn in real colour — separate assets per eye colour)
z=8   Eyebrows
z=9   Hair (drawn in black, tinted at runtime to any hair colour)
z=10  Accessories (glasses, earrings, hat — drawn in real colour)
```

Name + wedding date text is overlaid at export time. It is NOT a PNG asset.

### Tinting system (multiply blend mode)
The app uses CSS/canvas multiply blending to colour greyscale assets at runtime.
This means one drawing covers infinite colour variations — no redraws needed.

| What | How to draw | Why |
|---|---|---|
| Hair fills | Pure black (#000000) | Multiply × tint colour = tint colour exactly |
| Skin / face fill | Mid-grey (#888888) | Allows tint to retain luminosity |
| Clothing fills | Mid-grey (#777777) | Operator picks colour from guest photo |
| Eyes | Real colour (brown, blue, green etc) | Swapped as separate assets, not tinted |
| Outlines everywhere | Full black (#000000) at 100% opacity | Black × anything = black, stays crisp |
| Accessories | Real colour | Decorative, shouldn't shift |
| Card frames | Full colour | Creative choice per wedding style |

### Asset naming convention
Format: `category_variant.png` — lowercase, underscores, no spaces, no capitals.

Examples:
- `hair_curly_shoulder.png`
- `hair_straight_long.png`
- `hair_wavy_earLength.png` (camelCase for two-word variants)
- `eyes_almond.png`
- `face_oval.png`
- `outfit_top_blazer.png`
- `outfit_top_offShoulder.png`
- `accessory_glasses_round.png`
- `facialhair_none.png` (transparent PNG — required)
- `accessory_glasses_none.png` (transparent PNG — required)
- `frame_botanical.png`

Colour variants handled by tinting do NOT need separate files.

### MVP asset list (must-have before first test wedding)

| Category | Count | Examples |
|---|---|---|
| Face shape | 6 | Round, oval, square, heart, oblong, diamond |
| Eyes | 8 | Almond, round, monolid, hooded, downturned, wide-set, close-set, with glasses |
| Eyebrows | 6 | Thin arched, thick straight, natural, bushy, barely-there, strong |
| Nose | 5 | Button, straight, wide, curved, upturned |
| Mouth | 6 | Full lips, thin lips, wide smile, closed smile, neutral, open grin |
| Hair (style × length combos) | ~25–30 | Straight/wavy/curly/coily/bun/ponytail/braid/updo/half-up × short/ear/shoulder/mid-back/long |
| Facial hair | 6 | None, stubble, moustache, short beard, full beard, goatee |
| Body / frame | 3 | Slim, average, broad (silhouette only) |
| Outfit tops | 8 | Suit jacket, blazer, dress shirt, t-shirt, blouse, turtleneck, off-shoulder, formal dress top |
| Outfit bottoms | 5 | Long skirt, short skirt, trousers, suit trousers, jeans |
| Glasses | 4 | None, round frames, rectangular frames, sunglasses |
| Card frames | 4 | Botanical, geometric, minimal, vintage |

Total must-have: ~76 base assets. Colour variants handled by tinting (no extra files).

---

## Compositor architecture

Each illustration is stored in the database as a JSON recipe — NOT as a rendered image.

```json
{
  "guest_id": "abc123",
  "assets": {
    "frame": "frame_botanical",
    "body": "body_average",
    "face": "face_oval",
    "facialhair": "facialhair_none",
    "nose": "nose_button",
    "mouth": "mouth_closedSmile",
    "eyes": "eyes_almond",
    "brows": "brow_natural",
    "hair": "hair_curly_shoulder",
    "accessory_glasses": "accessory_glasses_none",
    "accessory_earring": "accessory_earring_hoops"
  },
  "colours": {
    "hair": "#3D1F0A",
    "skin": "#C08060",
    "outfit": "#2D3561"
  }
}
```

This means:
- No rendered image stored in DB — only the recipe
- Re-rendering is instant if assets are updated
- Export happens at print time by rendering the JSON recipe at full resolution

---

## Feature specifications

### Order management
- Create / edit / archive wedding orders
- Each order stores: couple names, wedding date, guest count, selected card frame, status
- Add guests with name + optional table number
- Progress summary: X of Y approved

### Bulk photo upload (most important workflow step)
- Drag-and-drop or file picker — accepts JPEG, PNG, HEIC
- Must handle 50–150 photos at once
- Photos auto-matched to guest names by filename where possible (Sarah_Jones.jpg → Sarah Jones)
- Unmatched photos shown in queue for manual assignment
- Upload progress shown per file
- AI analysis triggered automatically on upload completion
- IMPORTANT: HEIC is iPhone's default format. Backend must convert HEIC → JPEG before AI analysis.

### AI photo analysis + asset suggestion
- Uses Google Vision API to detect: skin tone, hair colour, hair length, hair style,
  glasses presence, facial hair presence, gender presentation, outfit formality
- Feature → asset mapping stored in a JSON config file (not hardcoded)
- Confidence score shown — low-confidence suggestions flagged for priority review
- Original photo always visible alongside the illustration
- THE AI DOES NOT GENERATE ILLUSTRATIONS — it only suggests which assets to use

### Illustration compositor (Picrew-style editor)
- Canvas: layered PNG composition rendered in real-time as assets are swapped (Konva.js)
- Left: live character canvas
- Right: scrollable asset category panels — click category to expand, click thumbnail to swap
- Colour pickers for: hair colour, skin tone, outfit colour
- Undo / redo (minimum 10 steps)
- Reset to AI suggestion button
- Navigation arrows: next/previous guest in batch
- Keyboard shortcuts: ← → for prev/next guest, A to approve, R to flag for revision
- Original guest photo always visible for comparison

### Illustrator review flow
- Batch view: grid of all illustrations for a wedding with status badges
- Statuses: Pending / Approved / Needs revision
- Notes field per illustration for illustrator ↔ operator communication
- Bulk approve: select multiple, approve in one click
- Filter by status
- Click any illustration to open full editor

### Print export
- Format: PNG at 300dpi, 630×880px (63×88mm trading card)
- Alternative: PDF with all cards laid out on A4 sheets
- Card frame + guest name + wedding date applied at export time (not in editor)
- Batch export: ZIP of all approved cards
- Single card re-export available

---

## User stories (priority order)

| ID | User | Want | Priority |
|---|---|---|---|
| US-01 | Operator | Upload batch of guest photos | Must-have |
| US-02 | Operator | See AI-suggested illustration after upload | Must-have |
| US-03 | Operator | Swap any asset category manually | Must-have |
| US-04 | Operator | Adjust outfit colour | Must-have |
| US-05 | Operator | Name each guest + link to table | Must-have |
| US-06 | Operator | Mark illustration approved / needs revision | Must-have |
| US-07 | Illustrator | Review batch in one screen | Must-have |
| US-08 | Illustrator | Leave note on illustration | Must-have |
| US-09 | Operator | Export all approved as print-ready files | Must-have |
| US-10 | Operator | Export single guest illustration | Should-have |
| US-11 | Operator | Select card frame for whole wedding | Should-have |
| US-12 | Operator | Preview card before print | Should-have |
| US-13 | Operator | Duplicate illustration as starting point | Nice-to-have |
| US-14 | Operator | See approved vs pending count | Nice-to-have |

---

## Success metrics

| Metric | Target |
|---|---|
| Illustrator time per wedding | < 20 minutes for a 70-guest batch |
| AI suggestion accuracy | > 70% of assets correct without manual change |
| Export failure rate | 0% — every approved illustration must export cleanly |
| Operator onboarding | Full order end-to-end without docs in < 30 minutes |

---

## Build phases

| Phase | Scope | Status |
|---|---|---|
| Phase 1 — Environment setup | Project scaffold, React app running, Supabase connected, GitHub set up | In progress |
| Phase 2 — Compositor | Konva.js canvas, asset panel, tinting, undo/redo, card preview | Not started |
| Phase 3 — Orders + guests | Wedding order dashboard, guest list, status tracking, notes | Not started |
| Phase 4 — Upload + AI | Bulk upload, HEIC conversion, Vision API, asset matching | Not started |
| Phase 5 — Export | 300dpi PNG export, PDF layout, batch ZIP download | Not started |
| Phase 6 — Test wedding | Real 50-guest order, measure success metrics, fix blockers | Not started |

## Current status
Phase 1 complete. Backend running on port 3001 with npm start. Frontend running on port 5174 with npm run dev.

---

## Out of scope — v1 (do not build these)

- Customer-facing portal (couples uploading their own photos)
- Blind box / 3D print workflow
- Payment processing
- Automated print lab integration
- Mobile-optimised interface (desktop-first only)
- Multi-language support

---

## Open questions (decisions still to be made)

- Will the illustrator access the compositor directly, or only review outputs the operator composites?
  (This affects whether we need a separate illustrator login/view)
- Which print lab? Their specs determine exact export dimensions and colour profile.
- How will new asset files be added after launch — shared folder drop-in, or a lightweight CMS?
- Do couples provide guest names + photos, or does the operator collect them independently?
- Should the guest's name appear on the card, or just the illustration?

---

## Key decisions — do not reverse these

- Internal tool only — no public sign-up
- Illustration = asset compositing, NOT AI image generation
- Each illustration stored as a JSON recipe (asset IDs + colour overrides), not as a rendered image
- Card frame chosen once per wedding (not per guest)
- Guest name + wedding date overlaid at export time, not in the editor
- All assets drawn by hand in Procreate, exported as individual PNGs
- Tinting via multiply blend mode — hair in black, skin/outfit in mid-grey
- sRGB colour mode throughout — never CMYK

---

## Do not

- Use AI image generation for illustrations (wrong approach — breaks the hand-drawn positioning)
- Store rendered card images in the database (store JSON recipes only)
- Build customer-facing features in v1
- Use CMYK colour mode anywhere in the pipeline
- Move or resize assets at compositor runtime (shared canvas — everything stacks at same position)
- Use semi-transparent strokes in assets (looks patchy when tinted)
