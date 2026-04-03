import { useEffect, useRef, useState } from 'react'
import { Stage, Layer, Image as KonvaImage } from 'react-konva'

export const CANVAS_W = 630
export const CANVAS_H = 880

// ─── Layer stack: bottom to top ──────────────────────────────────────────────
// Matches CLAUDE.md z-order exactly.
// tintKey: which colour from recipe.colours to apply as colour overlay
const LAYER_STACK = [
  { key: 'frame',      folder: 'frames',      tintKey: null },       // z=0  card frame background
  { key: 'hair_back',  folder: 'hair_back',   tintKey: 'hair' },     // z=1  hair bulk/length (behind head)
  { key: 'face',       folder: 'face',        tintKey: 'skin' },     // z=2  face shape
  { key: 'body',       folder: 'body',        tintKey: 'outfit' },   // z=3a body silhouette
  { key: 'outfit',     folder: 'outfit',      tintKey: 'outfit' },   // z=3b clothing
  { key: 'facialhair', folder: 'facialhair',  tintKey: null },       // z=4  beard/stubble/none
  { key: 'nose',       folder: 'nose',        tintKey: null },       // z=5
  { key: 'mouth',      folder: 'mouth',       tintKey: null },       // z=6
  { key: 'eyes',       folder: 'eyes',        tintKey: null },       // z=7  drawn in real colour
  { key: 'twinkle',    folder: 'twinkle',     tintKey: null },       // z=8  eye shine sparkle
  { key: 'brows',      folder: 'brows',       tintKey: null },       // z=9
  { key: 'accessory',  folder: 'accessories', tintKey: null },       // z=10 glasses/earrings/hat
  { key: 'hair_front', folder: 'hair_front',  tintKey: 'hair' },     // z=11 fringe/bangs (over face)
]

// ─── Colour overlay tint ──────────────────────────────────────────────────────
// Assets must be drawn with white/near-white fills and pure black outlines.
// The colour picker value becomes the exact colour of the filled areas:
//   tint fill × white asset fill = tint exactly (full range, including pale tones)
//   tint fill × black outline   = black (outlines stay crisp)
// Eyes and accessories are drawn in real colour and are not tinted.
function applyColourOverlay(img, tintHex) {
  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_W
  canvas.height = CANVAS_H
  const ctx = canvas.getContext('2d')

  // 1. Fill with the target colour
  ctx.fillStyle = tintHex
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  // 2. Multiply the asset on top:
  //    tint × white fill   = tint colour exactly ✓
  //    tint × black outline = black ✓
  ctx.globalCompositeOperation = 'multiply'
  ctx.drawImage(img, 0, 0, CANVAS_W, CANVAS_H)

  // 3. Clip result to original asset alpha (preserves transparency)
  ctx.globalCompositeOperation = 'destination-in'
  ctx.drawImage(img, 0, 0, CANVAS_W, CANVAS_H)

  return canvas
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CompositorCanvas({ recipe, availableAssets, scale }) {
  const [layerImages, setLayerImages] = useState({})
  // Cache raw HTMLImageElements by URL so we don't re-fetch on colour change
  const imgCache = useRef({})

  useEffect(() => {
    if (!availableAssets) return
    let cancelled = false

    async function loadAll() {
      const next = {}

      for (const layer of LAYER_STACK) {
        const assetName = recipe.assets[layer.key]
        if (!assetName) continue

        const assetList = availableAssets[layer.folder] ?? []
        const asset = assetList.find(a => a.name === assetName)
        if (!asset) continue

        const url = asset.url

        // Load from cache or fetch
        let img = imgCache.current[url]
        if (!img) {
          try {
            img = await new Promise((resolve, reject) => {
              const el = new Image()
              el.crossOrigin = 'anonymous'
              el.onload = () => resolve(el)
              el.onerror = reject
              el.src = url
            })
            imgCache.current[url] = img
          } catch {
            continue
          }
        }

        if (cancelled) return

        // Tint layers that need it
        next[layer.key] = layer.tintKey
          ? applyColourOverlay(img, recipe.colours[layer.tintKey] ?? '#FFFFFF')
          : img
      }

      if (!cancelled) setLayerImages(next)
    }

    loadAll()
    return () => { cancelled = true }
  }, [recipe, availableAssets])

  return (
    <Stage
      width={CANVAS_W * scale}
      height={CANVAS_H * scale}
      scaleX={scale}
      scaleY={scale}
    >
      <Layer>
        {LAYER_STACK.map(layer =>
          layerImages[layer.key] ? (
            <KonvaImage
              key={layer.key}
              image={layerImages[layer.key]}
              x={0}
              y={0}
              width={CANVAS_W}
              height={CANVAS_H}
            />
          ) : null
        )}
      </Layer>
    </Stage>
  )
}
