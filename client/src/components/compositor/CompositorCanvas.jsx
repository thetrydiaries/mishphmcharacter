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
  { key: 'body',       folder: 'body',        tintKey: 'skin' },     // z=2  body silhouette (skin tone)
  { key: 'face',       folder: 'face',        tintKey: 'skin' },     // z=3  face shape (skin tone)
  { key: 'outfit',     folder: 'outfit',      tintKey: 'outfit' },   // z=4  clothing overlay
  { key: 'facialhair', folder: 'facialhair',  tintKey: 'hair' },     // z=5  beard/stubble/none (same colour as hair)
  { key: 'nose',       folder: 'nose',        tintKey: null },       // z=6
  { key: 'mouth',      folder: 'mouth',       tintKey: null },       // z=7
  { key: 'eyes',       folder: 'eyes',        tintKey: null },       // z=8  drawn in real colour
  { key: 'twinkle',    folder: 'twinkle',     tintKey: null },       // z=9  eye shine sparkle
  { key: 'brows',      folder: 'brows',       tintKey: null },       // z=10
  { key: 'accessory',  folder: 'accessories', tintKey: null },       // z=11 glasses/earrings/hat
  { key: 'hair_front', folder: 'hair_front',  tintKey: 'hair' },     // z=12 fringe/bangs (over face)
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

export default function CompositorCanvas({ recipe, availableAssets, scale, stageRef }) {
  const [layerImages, setLayerImages] = useState({})
  // Cache raw HTMLImageElements by URL so we don't re-fetch on colour change
  const imgCache = useRef({})

  useEffect(() => {
    if (!availableAssets) return
    let cancelled = false

    async function fetchImg(url) {
      if (imgCache.current[url]) return imgCache.current[url]
      const img = await new Promise((resolve, reject) => {
        const el = new Image()
        el.crossOrigin = 'anonymous'
        el.onload = () => resolve(el)
        el.onerror = reject
        el.src = url
      })
      imgCache.current[url] = img
      return img
    }

    async function loadAll() {
      const next = {}

      for (const layer of LAYER_STACK) {
        const assetValue = recipe.assets[layer.key]

        // Array-valued layer (accessories) — load each item independently
        if (Array.isArray(assetValue)) {
          const imgs = []
          for (const assetName of assetValue) {
            const asset = (availableAssets[layer.folder] ?? []).find(a => a.name === assetName)
            if (!asset) continue
            try {
              const img = await fetchImg(asset.url)
              if (cancelled) return
              imgs.push(img)
            } catch { continue }
          }
          next[layer.key] = imgs
          continue
        }

        // Single-value layer (everything else)
        if (!assetValue) continue
        const asset = (availableAssets[layer.folder] ?? []).find(a => a.name === assetValue)
        if (!asset) continue

        try {
          const img = await fetchImg(asset.url)
          if (cancelled) return
          next[layer.key] = layer.tintKey
            ? applyColourOverlay(img, recipe.colours[layer.tintKey] ?? '#FFFFFF')
            : img
        } catch { continue }
      }

      if (!cancelled) setLayerImages(next)
    }

    loadAll()
    return () => { cancelled = true }
  }, [recipe, availableAssets])

  return (
    <Stage
      ref={stageRef}
      width={CANVAS_W * scale}
      height={CANVAS_H * scale}
      scaleX={scale}
      scaleY={scale}
    >
      <Layer>
        {LAYER_STACK.map(layer => {
          const imgs = layerImages[layer.key]
          if (!imgs) return null
          // Array layer (accessories) — render one KonvaImage per active accessory
          if (Array.isArray(imgs)) {
            return imgs.map((img, i) => (
              <KonvaImage
                key={`${layer.key}-${i}`}
                image={img}
                x={0} y={0}
                width={CANVAS_W}
                height={CANVAS_H}
              />
            ))
          }
          // Single-image layer
          return (
            <KonvaImage
              key={layer.key}
              image={imgs}
              x={0} y={0}
              width={CANVAS_W}
              height={CANVAS_H}
            />
          )
        })}
      </Layer>
    </Stage>
  )
}
