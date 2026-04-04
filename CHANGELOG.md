# Changelog

All notable changes to mishphmcharacter are recorded here.
Format: newest first.

---

## [Unreleased] — Phase 4 iteration

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
