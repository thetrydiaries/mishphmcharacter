// Shared layer stack + tint helper for the Konva compositor and the plain-canvas
// renderers (MiniCard, charmRender). Kept in its own module so the component files
// only export components (React Fast Refresh requirement).

// Character art space — every asset PNG is drawn at this fixed size.
export const ART_W = 630
export const ART_H = 880

// Layer stack, bottom to top. 'frame' is intentionally excluded — the portrait card
// frame doesn't fit a charm aspect ratio; the charm background is a solid fill.
export const LAYER_STACK = [
  { key: 'hair_back',  folder: 'hair_back',   tintKey: 'hair' },     // z=1  hair bulk/length — behind body AND face
  { key: 'body',       folder: 'body',        tintKey: 'skin' },     // z=2  body silhouette (skin tone)
  { key: 'face',       folder: 'face',        tintKey: 'skin' },     // z=3  face shape (skin tone)
  { key: 'outfit',     folder: 'outfit',      tintKey: 'outfit' },   // z=4  clothing overlay
  { key: 'facialhair', folder: 'facialhair',  tintKey: 'hair' },     // z=5  beard/stubble/none
  { key: 'nose',       folder: 'nose',        tintKey: null },       // z=6
  { key: 'mouth',      folder: 'mouth',       tintKey: 'lips' },     // z=7  all mouths tint to lips colour (white-fill); toggle per guest
  { key: 'eyes',       folder: 'eyes',        tintKey: null },       // z=8  real colour
  { key: 'twinkle',    folder: 'twinkle',     tintKey: null },       // z=9  eye shine
  { key: 'brows',      folder: 'brows',       tintKey: 'hair' },     // z=10 tinted to hair colour (asset must be white-fill)
  { key: 'hair_front', folder: 'hair_front',  tintKey: 'hair' },     // z=11 fringe/bangs (over face)
  { key: 'accessory',  folder: 'accessories', tintKey: null },       // z=12 glasses/earrings (array) — above hair_front
]

// Per-asset tint overrides: specific assets that tint even though their layer normally
// renders in real colour. Keyed by asset name → colour key. Lets a single white-fill
// asset (e.g. lipstick) pick up its own colour without tinting the rest of the layer.
export const ASSET_TINT_OVERRIDES = {
  // Mouths tint to 'lips' via the layer tintKey (covers every mouth asset) — no per-asset entry needed.
  // Earrings drawn in white-fill → tint to a chosen metal colour (gold/silver/rose).
  // (classic accessories_earpiercings_gold/_silver are pre-coloured — not listed, stay real colour.)
  accessories_hoop:     'metal',
  accessories_studs:    'metal',
  accessories_nosering: 'metal',
  // Blush drawn white-fill → tint to a chosen blush colour.
  blush:                'blush',
  accessories_blush:    'blush',
  blush_baby:           'blush',
  accessories_child_blush: 'blush',
  // Smile lines drawn white-fill → tint to control shade (darker = pick a darker colour).
  accessories_smileline: 'smileline',
  // Tie / bowtie drawn white-fill → tint to a chosen colour (independent of outfit).
  accessories_tie:       'tie',
  accessories_bowtie:    'tie',
  // Baby bib drawn white-fill → its own colour, independent of the main outfit tint.
  outfit_babybib:        'bib',
  // Hair ties drawn white-fill → their own colour, independent of the main outfit tint.
  outfit_hairties:       'hairtie',
}

// Fallback colour when a tint key isn't present on the recipe (e.g. lips, which the AI
// doesn't detect). Keeps a white asset from rendering untinted-white before the operator
// touches the picker.
export const TINT_DEFAULTS = { lips: '#C85A5A', metal: '#D4AF37', blush: '#E8A0A0', smileline: '#8A6A5A', tie: '#2D3561', bib: '#D9C7E8', hairtie: '#E86A9A' }

// Effective tint hex for a layer+asset, or null if it should draw in its real colour.
// Asset-name overrides win over the layer's default tintKey.
// `tints[key] === false` disables tinting for that key (asset renders real colour).
export function resolveTint(layer, assetName, colours = {}, tints = {}) {
  const key = ASSET_TINT_OVERRIDES[assetName] ?? layer.tintKey
  if (!key) return null
  if (tints[key] === false) return null
  return colours[key] ?? TINT_DEFAULTS[key] ?? '#FFFFFF'
}

// Effective opacity for a layer+asset. A per-asset entry (keyed by asset name, e.g. a
// mole's own slider) wins over the layer-level opacity; both default to fully opaque.
export function resolveOpacity(layerKey, assetName, opacities = {}) {
  return opacities[assetName] ?? opacities[layerKey] ?? 1
}

// Colour overlay tint: assets drawn with white/near-white fills + pure black outlines.
//   tint × white = tint exactly   ·   tint × black = black (outlines stay crisp)
export function applyColourOverlay(img, tintHex) {
  const canvas = document.createElement('canvas')
  canvas.width = ART_W
  canvas.height = ART_H
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = tintHex
  ctx.fillRect(0, 0, ART_W, ART_H)
  ctx.globalCompositeOperation = 'multiply'
  ctx.drawImage(img, 0, 0, ART_W, ART_H)
  ctx.globalCompositeOperation = 'destination-in'
  ctx.drawImage(img, 0, 0, ART_W, ART_H)
  return canvas
}
