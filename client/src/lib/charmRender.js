// charmRender.js — plain-canvas compositing for the review grid and batch export.
// Mirrors the re-anchor logic in CompositorCanvas (portrait/square → fit width,
// landscape → fit height) so batch output matches what the compositor shows.

import { LAYER_STACK, applyColourOverlay, resolveTint, ART_W, ART_H } from '../components/compositor/layers'
import { charmGeometry } from '../data/charmSizes'

const imgCache = {}
export function loadImg(url) {
  if (imgCache[url]) return imgCache[url]
  const p = new Promise((resolve, reject) => {
    const el = new Image()
    el.crossOrigin = 'anonymous'
    el.onload = () => resolve(el)
    el.onerror = reject
    el.src = url
  })
  // Don't cache failures — a transient error would otherwise break this asset
  // for the rest of the session (every later export would silently drop it).
  p.catch(() => { delete imgCache[url] })
  imgCache[url] = p
  return p
}

// Composite a recipe's character layers onto a transparent ART_W×ART_H canvas.
export async function compositeCharacter(recipe, availableAssets) {
  const canvas = document.createElement('canvas')
  canvas.width = ART_W
  canvas.height = ART_H
  const ctx = canvas.getContext('2d')

  for (const layer of LAYER_STACK) {
    const val = recipe.assets[layer.key]
    const names = Array.isArray(val) ? val : (val ? [val] : [])
    ctx.globalAlpha = recipe.opacities?.[layer.key] ?? 1
    for (const name of names) {
      const asset = (availableAssets[layer.folder] ?? []).find(a => a.name === name)
      if (!asset) continue
      try {
        const img = await loadImg(asset.url)
        const tint = resolveTint(layer, name, recipe.colours, recipe.tints)
        if (tint) {
          ctx.drawImage(applyColourOverlay(img, tint), 0, 0)
        } else {
          ctx.drawImage(img, 0, 0, ART_W, ART_H)
        }
      } catch { /* skip missing layer */ }
    }
    ctx.globalAlpha = 1
  }
  return canvas
}

// Draw an image to cover a w×h box (object-fit: cover), centred.
export function drawCover(ctx, img, w, h) {
  const scale = Math.max(w / img.width, h / img.height)
  const dw = img.width * scale, dh = img.height * scale
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh)
}

// Render one guest's charm at true dpi, cropped to the trim box (full-bleed art to the edge).
// Returns a PNG data URL sized widthMM×heightMM @ dpi. Uses default framing (no per-session nudge).
export async function renderCharmPNG(recipe, availableAssets, size, { background = '#FAF3EC', backgroundUrl = null } = {}) {
  const g = charmGeometry(size)
  const character = await compositeCharacter(recipe, availableAssets)

  // Full canvas (trim + bleed): background fill, then optional background image (cover)
  const full = document.createElement('canvas')
  full.width = g.fullW
  full.height = g.fullH
  const fctx = full.getContext('2d')
  fctx.fillStyle = background
  fctx.fillRect(0, 0, g.fullW, g.fullH)
  if (backgroundUrl) {
    try { drawCover(fctx, await loadImg(backgroundUrl), g.fullW, g.fullH) } catch { /* fall back to solid */ }
  }

  // Re-anchor (same rule as CompositorCanvas)
  const isLandscape = g.trimW / g.trimH > 1.05
  const baseScale = isLandscape ? (g.trimH / ART_H) : (g.trimW / ART_W)
  const charW = ART_W * baseScale
  const charH = ART_H * baseScale
  const charX = g.bleedPx + (g.trimW - charW) / 2
  const charY = isLandscape ? g.bleedPx + (g.trimH - charH) / 2 : g.bleedPx

  // Clip to the full canvas so overflow past the bleed is trimmed
  fctx.save()
  fctx.beginPath()
  fctx.rect(0, 0, g.fullW, g.fullH)
  fctx.clip()
  fctx.drawImage(character, charX, charY, charW, charH)
  fctx.restore()

  // Crop to the trim box
  const trim = document.createElement('canvas')
  trim.width = g.trimW
  trim.height = g.trimH
  trim.getContext('2d').drawImage(full, g.bleedPx, g.bleedPx, g.trimW, g.trimH, 0, 0, g.trimW, g.trimH)
  return trim.toDataURL('image/png')
}
