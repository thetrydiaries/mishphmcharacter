# Changelog

All notable changes to mishphmcharacter are recorded here.
Format: newest first.

---

## [Refresh] — 2026-10-25 — Cousin's wedding (deadline 7 Nov 2026)

Interrogate gate passed (Go). Why recorded in CLAUDE.md.

### Phase A — Resurrect + unblock AI
- Fixed dead model id `claude-sonnet-4-6` → `claude-sonnet-5` (uploads would have 404'd)
- New `server/features.schema.js` — single source of truth for AI-detected features. Drives the system prompt, validates Claude's response, and generates the `?mock=true` payload, so enums can no longer drift
- Response validation: invalid/missing feature values coerce to a safe default and are reported in `validationWarnings` instead of silently blanking a layer
- Capped upload size at 10MB (`multer` limit) — closed an unbounded-memory DoS hole
- Startup mapping check in `server/index.js` — warns for any `assetMapping.json` rule pointing at a missing PNG; prints a clean ✓ when all resolve
- Fixed 9 missing-asset mappings caught by the check:
  - `brows` default pointed at non-existent `brow_natural` — every guest rendered with no eyebrows. Remapped to real `brows_*` files
  - Renamed misspelled asset `acessories_eyelashes.png` → `accessories_eyelashes.png`
  - Removed dead `face_heart` / `face_oblong` rules; replaced `hair_back_bob` stand-in; wired in new `hair_back_long_wavy` / `_medium` / `_short_wavy`

### Phase D — Art styles (plumbing)
- Restructured assets into `assets/<style>/<category>/` — existing hand-drawn set moved to `assets/classic/`, empty `assets/ghibli/` dirs created for drop-in. `assets/frames/` stays shared (style-agnostic)
- `recipe.style` key added (default `classic`); asset names stay shared across styles so one mapping serves all styles
- Server: `GET /api/styles` lists styles; `GET /api/assets?style=X` serves that style's categories + shared dirs; style param validated against real dirs (path traversal → 404)
- Startup mapping check is now per-style: default style warns on missing assets, other styles report drawing progress (e.g. `ghibli: 1/51 present`)
- Compositor: style dropdown (shown when >1 style), refetches assets on style change
- Static serving + `/api/assets` read live from disk — dropping new PNGs in needs no restart

### Phase B — Charm sizes + mockup
- New `client/src/data/charmSizes.js` — editable acrylic-charm size presets (square 40mm case, landscape 46×32mm case). Insert mm, bleed, safe margin, dpi, corner radius all configurable. Placeholder mm pending real insert-window measurement
- Compositor canvas now renders the character re-anchored into the charm aspect ratio (no asset redraws):
  - portrait / square charm → fit to width (head + shoulders, torso crops)
  - landscape charm → fit to height (face centred, side margins for a name)
- Mockup overlay guides: bleed edge, cut line (with charm corner radius), safe zone, keychain-hole indicator. Toggle on/off
- Charm controls in the compositor: size dropdown, zoom slider, vertical-nudge slider
- Export reworked: crops to the trim box, renders at the charm's true dpi, auto-hides guides. Verified square exports at 402×402px (34mm @ 300dpi). Files named `name_sizeid.png`
- `CANVAS_W` / `CANVAS_H` kept as back-compat aliases of new `ART_W` / `ART_H`

### Deferred (out of this refresh)
- Cousin-facing approval web app → cousin reviews via exported contact sheet instead
- Supabase DB → localStorage is enough for 40 guests

---

## [Unreleased] — Phase 5 planned
- Single PNG export via Konva `stage.toDataURL()` — Export button in TopBar, browser download named after guest
- Batch ZIP export of all approved cards
- PDF layout on A4 sheets
- Guest name + wedding date text overlay at export time

---

## [Unreleased] — Phase 4 iteration (continued)

### Hair mapping fixes
- Renamed `hair_length` category key → `hair_back` to match compositor and asset folder
- Renamed all `hair_length_*` asset references → `hair_back_*` to match files on disk
- Stand-ins set for missing assets (wavy/curly long, medium, curly short → `hair_back_straight_long` / `hair_back_short`) until real assets are drawn
- Fixed `hair_front` default: `hair_front_long` → `hair_front_none`

### Mock mode (query param)
- `?mock=true` on `/api/analyse` skips Claude API and returns `MOCK_FEATURES`
- Triggered by changing XHR URL in `Upload.jsx` — no env var or server restart needed

### Twinkle default
- All mock guests updated from `twinkle_none` → `twinkle_circle`
- Consistent with `assetMapping.json` default

### AI analysis prompt
- Added `gender` field (`female | male | other`) — used to auto-assign accessories
- Replaced `hasBangs: true | false` with `hairFrontStyle` (`none | fringe | curtains | side_part | slick | messy | long`) — Claude now picks the specific front hair style directly rather than a boolean
- Replaced `outfitFormality` (`formal | smart-casual | casual`) with `outfitStyle` (`shirt | buttonup | turtleneck | shirtpocket | none`) — maps directly to available outfit assets
- Added `outfitColour` hex field so the outfit colour picker pre-loads from the photo

### Asset mapping (`server/assetMapping.json`)
- `hair_front` rules rewritten to use `hairFrontStyle` — one rule per asset variant (`fringe`, `curtains`, `side_part`, `slick`, `messy`, `long`, `none`)
- `outfit` rules rewritten to match actual assets on disk (`outfit_shirt`, `outfit_buttonup`, `outfit_turtleneck`, `outfit_shirtpocket`, `outfit_none`). Default changed from non-existent `outfit_casual` to `outfit_shirt`
- `accessory` rules now enumerate gender × glasses combinations:
  - female + glasses → `[accessories_glasses, accessories_blush, acessories_eyelashes]`
  - female, no glasses → `[accessories_blush, acessories_eyelashes]`
  - non-female + glasses → `[accessories_glasses]`
  - default → `[]`

### Accessories — multi-select
- `recipe.assets.accessory` is now an array (was a single string)
- Compositor renders all accessories in the array simultaneously at z=11
- Asset panel uses toggle behaviour — click to add, click again to remove
- `_none` placeholder assets hidden from the accessories panel

### Mock mode removed
- `MOCK_FEATURES` constant and `MOCK_ANALYSIS` env var gate removed from `server/routes/analyse.js`
- All uploads now go directly to the Claude Vision API

### Debug panel (temporary)
- Compositor shows a collapsible drawer (bottom of screen) with raw Claude JSON and current recipe side by side
- Toggled via "Debug AI response" button (fixed, bottom-right)
- Only visible when navigated from `/upload` (requires `detectedFeatures` in router state)

---

## [Phase 2] — Compositor complete

- Konva.js canvas with 13-layer stack (z=0 frame → z=12 hair_front)
- Colour overlay tinting: assets drawn in white/near-white, tinted at runtime to exact picker colour
- Hair split: `hair_back` (z=1, behind face) + `hair_front` (z=12, over face for fringe/bangs)
- Body (z=2) linked to skin tone picker; outfit (z=4) linked to outfit colour picker
- Twinkle layer (z=9) added for eye shine
- Asset panel: collapsible categories, thumbnail grid, colour pickers for hair/skin/outfit
- Undo/redo (10-step history via `useReducer`)
- Approve / Flag for revision / Reset to AI suggestion actions
- Prev/Next guest navigation
- State persisted to `localStorage` (key: `mishph_compositor_v1`)

---

## [Phase 4 — initial] — Upload + AI wired

- `/upload` page: drag-drop or file picker, accepts JPEG/PNG/HEIC
- XHR upload with progress bar (0–80% upload, 80–100% Claude analysis)
- Backend: `sharp` converts uploaded image → JPEG (max 1024px wide) before sending to Claude
- Claude Vision API call (model: `claude-opus-4-5`) with structured JSON system prompt
- `server/assetMapping.json` maps Claude feature values to asset filenames — rule-based, no hardcoded logic
- Flagged categories (no matching rule) shown as yellow dots in asset panel
- Photo blob URL passed to compositor so guest photo is always visible alongside illustration
- `outfitColour` from Claude pre-loads the outfit colour picker

---

## [Phase 1] — Project scaffold

- React + Vite frontend (localhost:5174)
- Node.js + Express backend (localhost:3001)
- Supabase client wired (PostgreSQL + Storage)
- Vite proxy: `/api/*` and `/assets/*` → Express
- 5 mock guests in `client/src/data/mockGuests.js` for compositor testing
- `scripts/generate-placeholders.js` for generating test PNGs
