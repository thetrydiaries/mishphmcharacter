import { useEffect, useRef } from 'react'
import { ART_W, ART_H } from './CompositorCanvas'
import { compositeCharacter } from '../../lib/charmRender'

// Lightweight illustration preview for the review grid — composites a recipe onto a
// single plain canvas (no Konva stage), so 40 of these stay cheap. Shows the character
// at art aspect (not charm-cropped), best for cross-checking against the photo.

export default function MiniCard({ recipe, availableAssets, width = 150, background = '#FAF3EC' }) {
  const canvasRef = useRef(null)
  const height = Math.round(width * (ART_H / ART_W))

  useEffect(() => {
    if (!recipe || !availableAssets) return
    let cancelled = false
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    async function draw() {
      const character = await compositeCharacter(recipe, availableAssets)
      if (cancelled) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = background
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(character, 0, 0, ART_W, ART_H, 0, 0, canvas.width, canvas.height)
    }

    draw()
    return () => { cancelled = true }
  }, [recipe, availableAssets, background])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ width, height, display: 'block', borderRadius: 6, background }}
    />
  )
}
