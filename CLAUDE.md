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
| Frontend | React + Vite (runs on localhost:5174) |
| Canvas / compositor | Konva.js |
| Backend API | Node.js + Express (runs on localhost:3001) |
| Database | Supabase (PostgreSQL) |
| File storage | Supabase Storage |
| AI photo analysis | Claude Vision API (Anthropic) |
| Print export | node-canvas or Puppeteer (Phase 5) |
| Auth | Simple single-password or Supabase Auth |
| Hosting | Vercel (frontend) + Railway or Render (backend) |

The compositor must work offline once assets are loaded — all asset PNGs should be
cached so the illustrator can work without a constant connection.

---

## Project folder structure

```
/client
  index.html                          Google Fonts loaded here (Playfair Display, DM Sans)
  vite.config.js                      Vite proxy: /api and /assets → localhost:3001
  src/
    main.jsx
    App.jsx                           Routes: / and /compositor
    index.css                         Design tokens (CSS vars), base styles
    pages/
      Home.jsx                        Landing page with link to compositor
      Compositor.jsx                  Main compositor page — layout wrapper
    components/compositor/
      CompositorCanvas.jsx            Konva.js stage, 13-layer stack, colour overlay tint
      AssetPanel.jsx                  Collapsible category panels + colour pickers
      TopBar.jsx                      Guest name, status badge, Approve/Revision/Reset/Undo/Redo
      BottomBar.jsx                   Prev/Next navigation + guest counter
    hooks/
      useCompositor.js                useReducer state: undo/redo, asset swap, colour, nav, localStorage
    data/
      mockGuests.js                   5 hardcoded test guests (used until Phase 3 wires up Supabase)

/server
  index.js                            Express API + static /assets serving
  supabase.js                         Supabase client

/assets                               Hand-drawn PNG assets (630×880, RGBA)
  /hair_back                          Hair bulk/length/shape — renders behind face (z=1)
  /face                               Face shape — renders above hair_back (z=2)
  /body                               Body silhouette (z=3)
  /outfit                             Clothing overlay (z=3)
  /facialhair                         Beard/stubble/none (z=4)
  /nose                               (z=5)
  /mouth                              (z=6)
  /eyes                               Drawn in real colour (z=7)
  /twinkle                            Eye shine sparkle — or transparent 'none' (z=8)
  /brows                              (z=9)
  /accessories                        Glasses/earrings — drawn in real colour (z=10)
  /hair_front                         Fringe/bangs — renders over face (z=11)
  /frames

/scripts
  generate-placeholders.js            Node.js script (zero deps) — generates 630×880 test PNGs
                                      Run: node scripts/generate-placeholders.js

CLAUDE.md
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
z=0   Card frame (full-bleed background + decorative border — below all character layers)
z=1   Hair back (bulk, length, shape of hair — sits behind the head)
z=2   Face shape (face oval — drawn in white/near-white, tinted to skin tone)
z=3   Body + outfit (torso, arms, clothing — body silhouette then clothing overlay)
z=4   Facial hair (beard, stubble, moustache — or transparent 'none')
z=5   Nose
z=6   Mouth
z=7   Eyes (drawn in real colour — separate assets per eye colour)
z=8   Twinkle (eye shine — decorative sparkle overlay on eyes — or transparent 'none')
z=9   Eyebrows
z=10  Accessories (glasses, earrings, hat — drawn in real colour)
z=11  Hair front / bangs (fringe, face-framing pieces — or transparent 'none')
```

The hair split is the critical architectural decision: hair_back sits behind the face so the face oval is always visible, while hair_front (fringe/bangs) sits on top to frame the face naturally. hair_front_none.png (transparent) is required so guests with no fringe still render correctly.

Name + wedding date text is overlaid at export time. It is NOT a PNG asset.

### Tinting system (colour overlay)
The app uses canvas colour overlay to tint white/near-white assets at runtime.
This means one drawing covers infinite colour variations — no redraws needed.
The colour picker value becomes the exact colour of the filled areas, including pale/light tones.

| What | How to draw | Why |
|---|---|---|
| Hair back fills | White (#FFFFFF) | Overlay tint → colour picker value exactly |
| Hair front fills | White (#FFFFFF) | Same tint as hair_back — one colour picker covers both |
| Skin / face fill | White/near-white | Overlay tint → exact skin tone from picker |
| Clothing fills | White/near-white | Operator picks colour from guest photo |
| Eyes | Real colour (brown, blue, green etc) | Swapped as separate assets, not tinted |
| Twinkle | Real colour or transparent | Decorative sparkle — not tinted |
| Outlines everywhere | Full black (#000000) at 100% opacity | Black × anything = black, stays crisp |
| Accessories | Real colour | Decorative, shouldn't shift |
| Card frames | Full colour | Creative choice per wedding style |

### Asset naming convention
Format: `category_variant.png` — lowercase, underscores, no spaces, no capitals.

Examples:
- `hair_back_curly_shoulder.png`
- `hair_back_straight_long.png`
- `hair_back_wavy_earLength.png` (camelCase for two-word variants)
- `hair_front_fringe.png`
- `hair_front_curtains.png`
- `hair_front_none.png` (transparent PNG — **required**, for guests with no fringe)
- `eyes_almond.png`
- `face_oval.png`
- `outfit_blazer.png`
- `outfit_offShoulder.png`
- `accessory_glasses_round.png`
- `facialhair_none.png` (transparent PNG — required)
- `accessory_glasses_none.png` (transparent PNG — required)
- `twinkle_none.png` (transparent PNG — **required**, default for guests with no eye shine)
- `frame_botanical.png`

Colour variants handled by tinting do NOT need separate files.

### MVP asset list (must-have before first test wedding)

| Category | Count | Examples |
|---|---|---|
| Face shape | 6 | Round, oval, square, heart, oblong, diamond |
| Eyes | 8 | Almond, round, monolid, hooded, downturned, wide-set, close-set, with glasses |
| Twinkle | ~4 | None (transparent, required), small sparkle, star, multi-sparkle |
| Eyebrows | 6 | Thin arched, thick straight, natural, bushy, barely-there, strong |
| Nose | 5 | Button, straight, wide, curved, upturned |
| Mouth | 6 | Full lips, thin lips, wide smile, closed smile, neutral, open grin |
| Hair back (style × length combos) | ~25–30 | Straight/wavy/curly/coily/bun/ponytail/braid/updo/half-up × short/ear/shoulder/mid-back/long |
| Hair front / bangs | ~8–10 | None (transparent, required), blunt fringe, curtain fringe, wispy fringe, side-swept, micro fringe, face-framing pieces |
| Facial hair | 6 | None, stubble, moustache, short beard, full beard, goatee |
| Body / frame | 3 | Slim, average, broad (silhouette only) |
| Outfit tops | 8 | Suit jacket, blazer, dress shirt, t-shirt, blouse, turtleneck, off-shoulder, formal dress top |
| Outfit bottoms | 5 | Long skirt, short skirt, trousers, suit trousers, jeans |
| Glasses | 4 | None, round frames, rectangular frames, sunglasses |
| Card frames | 4 | Botanical, geometric, minimal, vintage |

Total must-have: ~88–92 base assets. Colour variants handled by tinting (no extra files).

---

## Compositor architecture

Each illustration is stored in the database as a JSON recipe — NOT as a rendered image.

```json
{
  "guest_id": "abc123",
  "assets": {
    "frame":      "frame_botanical",
    "hair_back":  "hair_back_curly_shoulder",
    "body":       "body_average",
    "outfit":     "outfit_blazer",
    "face":       "face_oval",
    "facialhair": "facialhair_none",
    "nose":       "nose_button",
    "mouth":      "mouth_closedsmile",
    "eyes":       "eyes_almond",
    "twinkle":    "twinkle_none",
    "brows":      "brow_natural",
    "hair_front": "hair_front_none",
    "accessory":  "accessory_glasses_none"
  },
  "colours": {
    "hair":   "#3D1F0A",
    "skin":   "#C08060",
    "outfit": "#2D3561"
  }
}
```

Note: `accessory` is currently a single slot (one asset from the accessories folder). Multi-accessory support (separate glasses + earrings keys) is planned for a future phase.

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
- Uses Claude Vision API (claude-opus-4-5) to detect: skin tone, hair colour, hair
  length, hair style, face shape, eye shape, eye colour, brow shape, nose shape,
  mouth shape, glasses presence, facial hair style, outfit formality
- Claude Vision can detect nearly every layer — far fewer manual flags than Google Vision
- Feature → asset mapping stored in `server/assetMapping.json` (not hardcoded)
- To add new assets or change mappings: edit `assetMapping.json` — no code changes needed
- Categories that always default (body type, frame, twinkle) are intentional — not flagged
- Categories where Claude's value has no matching rule are flagged yellow in the compositor
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
| Phase 1 — Environment setup | Project scaffold, React app running, Supabase connected, GitHub set up | Complete |
| Phase 2 — Compositor | Konva.js canvas, asset panel, tinting, undo/redo, card preview | Complete |
| Phase 3 — Orders + guests | Wedding order dashboard, guest list, status tracking, notes | Not started |
| Phase 4 — Upload + AI | Bulk upload, HEIC conversion, Claude Vision API, asset matching | In progress |
| Phase 5 — Export | 300dpi PNG export, PDF layout, batch ZIP download | Not started |
| Phase 6 — Test wedding | Real 50-guest order, measure success metrics, fix blockers | Not started |

## Current status

Phases 1, 2, and 4 (upload + AI) are complete or in progress.

- Backend: `cd server && npm start` → localhost:3001
- Frontend: `cd client && npm run dev` → localhost:5174
- Upload at: http://localhost:5174/upload
- Compositor at: http://localhost:5174/compositor

Phase 2 is functional with 5 mock guests. Phase 4 upload → Claude Vision → compositor flow is wired and working. Phase 3 (orders + guest management) replaces `mockGuests.js` with real DB queries — not yet started.

### API endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/assets` | Returns all asset PNGs grouped by category folder |
| POST | `/api/analyse` | Accepts a photo (multipart), converts HEIC→JPEG, calls Claude Vision, returns `{ recipe, flags, detectedFeatures }` |
| GET | `/health` | Server liveness check |
| GET | `/health/db` | Supabase connectivity check |

### Environment variables (server/.env)

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Claude Vision API key — add this before running Phase 4 |
| `SUPABASE_URL` | Phase 3+ | Supabase project URL |
| `SUPABASE_ANON_KEY` | Phase 3+ | Supabase anon key |

### assetMapping.json

`server/assetMapping.json` maps Claude Vision feature values to asset filenames. Rules per category are evaluated top-to-bottom; first full match wins. To add assets as the library grows: add a new rule with the conditions and asset filename — no code changes needed. If `rules` is empty, the category always uses its default and is never flagged.

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
- Tinting via colour overlay — assets drawn in white/near-white, colour picker value becomes exact fill colour (full range including pale tones)
- sRGB colour mode throughout — never CMYK
- Hair split into two layers: `hair_back` (z=1, behind face) and `hair_front` (z=11, over face for fringe/bangs). Do not collapse back to a single hair layer — the split is what makes the face oval always visible regardless of hair style.
- `hair_front_none.png` (fully transparent) must always exist — it is the default for guests with no fringe
- Body and outfit are separate recipe keys and separate asset folders — body is the silhouette/pose, outfit is the clothing overlay on top of it. Both use the outfit colour tint.
- Compositor state managed via `useReducer` (not external state library). History stack capped at 10 snapshots.
- Guest progress persisted to `localStorage` keyed by guest ID, so the illustrator doesn't lose work on page refresh. Key: `mishph_compositor_v1`.
- Vite dev proxy forwards `/api/*` and `/assets/*` to Express on port 3001. Frontend uses relative URLs — never hardcode `localhost:3001`.
- The `accessory` recipe key is a single slot for Phase 2. Multi-accessory support (simultaneous glasses + earrings) deferred to a later phase.

---

## Do not

- Use AI image generation for illustrations (wrong approach — breaks the hand-drawn positioning)
- Store rendered card images in the database (store JSON recipes only)
- Build customer-facing features in v1
- Use CMYK colour mode anywhere in the pipeline
- Move or resize assets at compositor runtime (shared canvas — everything stacks at same position)
- Use semi-transparent strokes in assets (looks patchy when tinted)
- Collapse `hair_back` and `hair_front` back into a single `hair` layer — the split is intentional and architectural
- Hardcode `localhost:3001` in the frontend — use relative URLs, the Vite proxy handles routing
