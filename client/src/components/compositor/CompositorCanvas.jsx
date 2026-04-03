import { useEffect, useRef, useState } from 'react'
import { Stage, Layer, Image as KonvaImage } from 'react-konva'

export const CANVAS_W = 630
export const CANVAS_H = 880

// ─── Layer stack: bottom to top ──────────────────────────────────────────────
// Matches CLAUDE.md z-order exactly.
// tintKey: which colour from recipe.colours to use for multiply tinting
const LAYER_STACK = [
  { key: 'frame',      folder: 'frames',      tintKey: null },      // z=0  card frame background
  { key: 'hair_back',  folder: 'hair_back',   tintKey: 'hair' },    // z=1  hair bulk/length (behind face)
  { key: 'body',       folder: 'body',        tintKey: 'outfit' },  // z=2a body silhouette
  { key: 'outfit',     folder: 'outfit',      tintKey: 'outfit' },  // z=2b clothing
  { key: 'face',       folder: 'face',        tintKey: 'skin' },    // z=3  face oval
  { key: 'facialhair', folder: 'facialhair',  tintKey: null },      // z=4  beard/stubble/none
  { key: 'nose',       folder: 'nose',        tintKey: null },      // z=5
  { key: 'mouth',      folder: 'mouth',       tintKey: null },      // z=6
  { key: 'eyes',       folder: 'eyes',        tintKey: null },      // z=7
  { key: 'brows',      folder: 'brows',       tintKey: null },      // z=8
  { key: 'hair_front', folder: 'hair_front',  tintKey: 'hair' },    // z=9  fringe/bangs (over face)
  { key: 'accessory',  folder: 'accessories', tintKey: null },      // z=10 glasses/earrings/hat
]

// ─── Multiply tint ────────────────────────────────────────────────────────────
// Draws the PNG, then overlays the tint colour using multiply blend mode,
// then clips back to the original alpha so transparency is preserved.
function applyMultiplyTint(img, tintHex) {
  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_W
  canvas.height = CANVAS_H
  const ctx = canvas.getContext('2d')

  // 1. Draw the original asset
  ctx.drawImage(img, 0, 0, CANVAS_W, CANVAS_H)

  // 2. Multiply blend: tint × pixel = colourised pixel
  //    Black outlines (0,0,0) × anything = black (preserved)
  //    Mid-grey fills (128,128,128) × tint = tinted fill
  //    White fills (255,255,255) × tint = tint colour exactly
  ctx.globalCompositeOperation = 'multiply'
  ctx.fillStyle = tintHex
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  // 3. Restore original alpha: keep composited result only where source was opaque
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
          ? applyMultiplyTint(img, recipe.colours[layer.tintKey] ?? '#888888')
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
