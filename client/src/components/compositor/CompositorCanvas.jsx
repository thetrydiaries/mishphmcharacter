import { useEffect, useRef, useState } from 'react'
import { Stage, Layer, Group, Image as KonvaImage, Rect, Circle, Line } from 'react-konva'

// Character art space — every asset PNG is drawn at this fixed size.
export const ART_W = 630
export const ART_H = 880
// Back-compat exports (older imports referenced these names).
export const CANVAS_W = ART_W
export const CANVAS_H = ART_H

// ─── Layer stack: bottom to top ──────────────────────────────────────────────
// 'frame' is intentionally excluded here — the portrait card frame doesn't fit a
// charm aspect ratio. The charm background is a solid fill (uploaded backgrounds: Phase E).
// Exported so the review-grid MiniCard can composite the same stack on a plain canvas.
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
  { key: 'brows',      folder: 'brows',       tintKey: null },       // z=10
  { key: 'accessory',  folder: 'accessories', tintKey: null },       // z=11 glasses/earrings (array)
  { key: 'hair_front', folder: 'hair_front',  tintKey: 'hair' },     // z=12 fringe/bangs (over face)
]

// ─── Colour overlay tint ──────────────────────────────────────────────────────
// Assets drawn with white/near-white fills + pure black outlines.
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

// ─── Component ────────────────────────────────────────────────────────────────
// Props:
//   recipe           — guest recipe (assets + colours)
//   availableAssets  — { folder: [{name,url}] } from /api/assets
//   geometry         — charmGeometry(size): { fullW, fullH, trimW, trimH, bleedPx, safePx, cornerRadiusPx }
//   displayScale     — on-screen scale factor (geometry is full-resolution px)
//   anchor           — { scaleMult, offsetYFrac } re-anchor of the character inside the trim box
//   showGuides       — draw bleed/trim/safe/keychain overlay (named 'guide', hidden at export)
//   background       — solid fill colour behind the character
//   stageRef         — forwarded Konva stage ref (for export)
export default function CompositorCanvas({
  recipe,
  availableAssets,
  geometry,
  displayScale,
  anchor = { scaleMult: 1, offsetYFrac: 0 },
  showGuides = true,
  background = '#FAF3EC',
  stageRef,
}) {
  const [layerImages, setLayerImages] = useState({})
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

  if (!geometry) return null
  const { fullW, fullH, trimW, trimH, bleedPx, safePx, cornerRadiusPx } = geometry

  // Re-anchor the tall character art into the charm aspect:
  //   portrait / square charm → fit to WIDTH  (head + shoulders fill, torso crops off)
  //   landscape charm         → fit to HEIGHT (face fits vertically, margins on the sides)
  // Then apply the user's zoom multiplier and vertical offset.
  const isLandscape = trimW / trimH > 1.05
  const baseScale = isLandscape ? (trimH / ART_H) : (trimW / ART_W)
  const fitScale = baseScale * (anchor.scaleMult ?? 1)
  const charW = ART_W * fitScale
  const charH = ART_H * fitScale
  const charX = bleedPx + (trimW - charW) / 2            // horizontally centred in trim
  // Portrait: 0 = head at trim top. Landscape: vertically centred, then offset.
  const charY = isLandscape
    ? bleedPx + (trimH - charH) / 2 + (anchor.offsetYFrac ?? 0) * trimH
    : bleedPx + (anchor.offsetYFrac ?? 0) * trimH

  return (
    <Stage
      ref={stageRef}
      width={fullW * displayScale}
      height={fullH * displayScale}
      scaleX={displayScale}
      scaleY={displayScale}
    >
      {/* Background (full bleed) */}
      <Layer listening={false}>
        <Rect x={0} y={0} width={fullW} height={fullH} fill={background} />
      </Layer>

      {/* Character — clipped to the full canvas so overflow past bleed is trimmed */}
      <Layer listening={false}>
        <Group
          x={charX}
          y={charY}
          scaleX={fitScale}
          scaleY={fitScale}
          clipX={-charX / fitScale}
          clipY={-charY / fitScale}
          clipWidth={fullW / fitScale}
          clipHeight={fullH / fitScale}
        >
          {LAYER_STACK.map(layer => {
            const imgs = layerImages[layer.key]
            if (!imgs) return null
            if (Array.isArray(imgs)) {
              return imgs.map((img, i) => (
                <KonvaImage key={`${layer.key}-${i}`} image={img} x={0} y={0} width={ART_W} height={ART_H} />
              ))
            }
            return <KonvaImage key={layer.key} image={imgs} x={0} y={0} width={ART_W} height={ART_H} />
          })}
        </Group>
      </Layer>

      {/* Mockup guides — named 'guide' so export can hide them */}
      {showGuides && (
        <Layer listening={false}>
          {/* Bleed edge (outer) */}
          <Rect name="guide" x={0} y={0} width={fullW} height={fullH}
                stroke="#C97070" strokeWidth={1 / displayScale} dash={[6 / displayScale, 4 / displayScale]} />
          {/* Trim / cut line with charm corner radius */}
          <Rect name="guide" x={bleedPx} y={bleedPx} width={trimW} height={trimH}
                cornerRadius={cornerRadiusPx}
                stroke="#2C2C2C" strokeWidth={1.5 / displayScale} />
          {/* Safe zone (inner) */}
          <Rect name="guide" x={bleedPx + safePx} y={bleedPx + safePx}
                width={trimW - safePx * 2} height={trimH - safePx * 2}
                cornerRadius={Math.max(0, cornerRadiusPx - safePx)}
                stroke="#7BAE7F" strokeWidth={1 / displayScale} dash={[4 / displayScale, 4 / displayScale]} />
          {/* Keychain hole indicator (top centre, above the charm) */}
          <Circle name="guide" x={fullW / 2} y={bleedPx * 0.5}
                  radius={Math.max(3, bleedPx * 0.35)}
                  stroke="#7A6E66" strokeWidth={1 / displayScale} />
          <Line name="guide" points={[fullW / 2, bleedPx, fullW / 2, bleedPx * 0.5]}
                stroke="#7A6E66" strokeWidth={1 / displayScale} />
        </Layer>
      )}
    </Stage>
  )
}
