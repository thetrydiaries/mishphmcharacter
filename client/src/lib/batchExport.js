import JSZip from 'jszip'
import { jsPDF } from 'jspdf'
import { renderCharmPNG } from './charmRender'
import { charmGeometry } from '../data/charmSizes'

function slugify(name) {
  return (name || 'guest').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'guest'
}

// Ensure unique filenames when two guests share a name
function uniqueName(base, used) {
  let name = base, n = 2
  while (used.has(name)) { name = `${base}-${n++}` }
  used.add(name)
  return name
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function loadImage(src) {
  return new Promise((res, rej) => { const el = new Image(); el.onload = () => res(el); el.onerror = rej; el.src = src })
}

// Export every approved guest as a print-ready PNG, bundled into one ZIP (one download —
// browsers block firing many downloads at once). onProgress(done, total) for UI.
export async function exportApprovedZip(guests, availableAssets, size, onProgress, backgroundUrl = null) {
  const approved = guests.filter(g => g.status === 'approved')
  if (!approved.length) return { count: 0 }

  const zip = new JSZip()
  const used = new Set()
  for (let i = 0; i < approved.length; i++) {
    const g = approved[i]
    const dataURL = await renderCharmPNG(g.recipe, availableAssets, size, { backgroundUrl })
    const fname = uniqueName(`${slugify(g.name)}_${size.id}`, used)
    zip.file(`${fname}.png`, dataURL.split(',')[1], { base64: true })
    onProgress?.(i + 1, approved.length)
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  downloadBlob(blob, `charms_${size.id}_${approved.length}.zip`)
  return { count: approved.length }
}

// Draw one guest cell (reference photo + illustration + name) into ctx at (x,y).
async function drawContactCell(ctx, guest, availableAssets, size, backgroundUrl, { x, y, cellW, cellH }) {
  const g = charmGeometry(size)
  const aspect = g.trimW / g.trimH
  const cellPad = 14
  const gap = 12
  const labelH = 30
  const imgH = cellH - cellPad * 2 - labelH
  const innerW = cellW - cellPad * 2

  // illustration sized to its aspect within the image area; reference photo fills the rest on the left.
  const illW = Math.min(imgH * aspect, innerW * 0.55)
  const illH = illW / aspect
  const refW = innerW - illW - gap
  const topY = y + cellPad

  // reference photo (contain-fit, never distorts)
  const refX = x + cellPad
  ctx.fillStyle = '#F0ECE8'
  ctx.fillRect(refX, topY, refW, imgH)
  if (guest.photo) {
    try {
      const ref = await loadImage(guest.photo)
      const scale = Math.min(refW / ref.width, imgH / ref.height)
      const dw = ref.width * scale, dh = ref.height * scale
      ctx.drawImage(ref, refX + (refW - dw) / 2, topY + (imgH - dh) / 2, dw, dh)
    } catch {
      // Photo exists but won't decode (corrupt/truncated) — mark it so a real data problem
      // is visible, not mistaken for "this guest has no photo".
      ctx.fillStyle = '#B85C5C'; ctx.font = '400 13px system-ui, sans-serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('photo error', refX + refW / 2, topY + imgH / 2)
      ctx.textAlign = 'left'
    }
  } else {
    ctx.fillStyle = '#A89F97'; ctx.font = '400 13px system-ui, sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('no photo', refX + refW / 2, topY + imgH / 2)
    ctx.textAlign = 'left'
  }

  // illustration on the right
  const illX = refX + refW + gap
  const dataURL = await renderCharmPNG(guest.recipe, availableAssets, size, { backgroundUrl })
  const img = await loadImage(dataURL)
  ctx.drawImage(img, illX, topY, illW, illH)

  // name + status
  ctx.fillStyle = guest.status === 'approved' ? '#5A8A5E' : guest.status === 'needs_revision' ? '#B85C5C' : '#7A6E66'
  ctx.font = '500 16px system-ui, sans-serif'
  ctx.textBaseline = 'top'
  const label = guest.name + (guest.status === 'approved' ? ' ✓' : guest.status === 'needs_revision' ? ' ⚑' : '')
  ctx.fillText(label.length > 34 ? label.slice(0, 33) + '…' : label, x + cellPad, topY + imgH + 8)
}

// Build a multipage A4 PDF (grid of reference photo + illustration + name per guest) to
// send for review — one easy-to-flip document instead of a giant single image.
export async function exportContactSheet(guests, availableAssets, size, { scope = 'all', backgroundUrl = null, onProgress = null } = {}) {
  const list = scope === 'approved' ? guests.filter(g => g.status === 'approved') : guests
  if (!list.length) return { count: 0 }

  // A4 portrait at ~150dpi (1240×1754px). 2 cols × 5 rows = 10 guests per page.
  const PAGE_W = 1240, PAGE_H = 1754
  const cols = 2, rows = 5, perPage = cols * rows
  const margin = 44
  const titleH = 56
  const gridW = PAGE_W - margin * 2
  const gridH = PAGE_H - margin * 2 - titleH
  const cellW = gridW / cols
  const cellH = gridH / rows
  const pageCount = Math.ceil(list.length / perPage)

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [PAGE_W, PAGE_H] })

  for (let p = 0; p < pageCount; p++) {
    const canvas = document.createElement('canvas')
    canvas.width = PAGE_W
    canvas.height = PAGE_H
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, PAGE_W, PAGE_H)

    // Page title
    ctx.fillStyle = '#2C2C2C'
    ctx.font = '600 24px system-ui, sans-serif'
    ctx.textBaseline = 'top'
    ctx.fillText(`Character cards — ${size.label}  ·  page ${p + 1} of ${pageCount}`, margin, margin)

    const pageGuests = list.slice(p * perPage, (p + 1) * perPage)
    for (let i = 0; i < pageGuests.length; i++) {
      const col = i % cols
      const row = Math.floor(i / cols)
      const x = margin + col * cellW
      const y = margin + titleH + row * cellH
      await drawContactCell(ctx, pageGuests[i], availableAssets, size, backgroundUrl, { x, y, cellW, cellH })
      onProgress?.(p * perPage + i + 1, list.length)
    }

    if (p > 0) pdf.addPage([PAGE_W, PAGE_H], 'portrait')
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, PAGE_W, PAGE_H)
  }

  pdf.save(`contact-sheet_${list.length}-guests.pdf`)
  return { count: list.length, pages: pageCount }
}
