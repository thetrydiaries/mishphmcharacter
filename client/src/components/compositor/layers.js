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
  { key: 'mouth',      folder: 'mouth',       tintKey: null },       // z=7
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
  mouth_full_lipstick:  'lips',
  mouth_neutral_top:    'lips',
  mouth_neutral_bottom: 'lips',
  mouth_neutral_both:   'lips',
  mouth_neutral_colour: 'lips',
  // Earrings drawn in white-fill → tint to a chosen metal colour (gold/silver/rose).
  // (classic accessories_earpiercings_gold/_silver are pre-coloured — not listed, stay real colour.)
  accessories_hoop:     'metal',
  accessories_studs:    'metal',
}

// Fallback colour when a tint key isn't present on the recipe (e.g. lips, which the AI
// doesn't detect). Keeps a white asset from rendering untinted-white before the operator
// touches the picker.
export const TINT_DEFAULTS = { lips: '#C85A5A', metal: '#D4AF37' }

// Effective tint hex for a layer+asset, or null if it should draw in its real colour.
// Asset-name overrides win over the layer's default tintKey.
// `tints[key] === false` disables tinting for that key (asset renders real colour).
export function resolveTint(layer, assetName, colours = {}, tints = {}) {
  const key = ASSET_TINT_OVERRIDES[assetName] ?? layer.tintKey
  if (!key) return null
  if (tints[key] === false) return null
  return colours[key] ?? TINT_DEFAULTS[key] ?? '#FFFFFF'
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
