// Shared layer stack + tint helper for the Konva compositor and the plain-canvas
// renderers (MiniCard, charmRender). Kept in its own module so the component files
// only export components (React Fast Refresh requirement).

// Character art space — every asset PNG is drawn at this fixed size.
export const ART_W = 630
export const ART_H = 880

// Layer stack, bottom to top. 'frame' is intentionally excluded — the portrait card
// frame doesn't fit a charm aspect ratio; the charm background is a solid fill.
export const LAYER_STACK = [
  { key: 'hair_back',  folder: 'hair_back',   tintKey: 'hair' },     // z=1  hair bulk/length (behind head)
  { key: 'body',       folder: 'body',        tintKey: 'skin' },     // z=2  body silhouette (skin tone)
  { key: 'face',       folder: 'face',        tintKey: 'skin' },     // z=3  face shape (skin tone)
  { key: 'outfit',     folder: 'outfit',      tintKey: 'outfit' },   // z=4  clothing overlay
  { key: 'facialhair', folder: 'facialhair',  tintKey: 'hair' },     // z=5  beard/stubble/none
  { key: 'nose',       folder: 'nose',        tintKey: null },       // z=6
  { key: 'mouth',      folder: 'mouth',       tintKey: null },       // z=7
  { key: 'eyes',       folder: 'eyes',        tintKey: null },       // z=8  real colour
  { key: 'twinkle',    folder: 'twinkle',     tintKey: null },       // z=9  eye shine
  { key: 'brows',      folder: 'brows',       tintKey: 'hair' },     // z=10 tinted to hair colour (asset must be white-fill)
  { key: 'accessory',  folder: 'accessories', tintKey: null },       // z=11 glasses/earrings (array)
  { key: 'hair_front', folder: 'hair_front',  tintKey: 'hair' },     // z=12 fringe/bangs (over face)
]

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
