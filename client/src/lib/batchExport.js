import JSZip from 'jszip'
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

function dataURLtoBlob(dataURL) {
  const [head, b64] = dataURL.split(',')
  const mime = head.match(/:(.*?);/)[1]
  const bin = atob(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

// Export every approved guest as a print-ready PNG, bundled into one ZIP (one download —
// browsers block firing many downloads at once). onProgress(done, total) for UI.
export async function exportApprovedZip(guests, availableAssets, size, onProgress) {
  const approved = guests.filter(g => g.status === 'approved')
  if (!approved.length) return { count: 0 }

  const zip = new JSZip()
  const used = new Set()
  for (let i = 0; i < approved.length; i++) {
    const g = approved[i]
    const dataURL = await renderCharmPNG(g.recipe, availableAssets, size)
    const fname = uniqueName(`${slugify(g.name)}_${size.id}`, used)
    zip.file(`${fname}.png`, dataURL.split(',')[1], { base64: true })
    onProgress?.(i + 1, approved.length)
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  downloadBlob(blob, `charms_${size.id}_${approved.length}.zip`)
  return { count: approved.length }
}

// Build a single contact-sheet image (grid of illustrations + names) to send for review.
export async function exportContactSheet(guests, availableAssets, size, { scope = 'all' } = {}) {
  const list = scope === 'approved' ? guests.filter(g => g.status === 'approved') : guests
  if (!list.length) return { count: 0 }

  const g = charmGeometry(size)
  const aspect = g.trimW / g.trimH
  const cellImgW = 220
  const cellImgH = Math.round(cellImgW / aspect)
  const pad = 16
  const labelH = 26
  const cols = Math.min(5, list.length)
  const rows = Math.ceil(list.length / cols)
  const cellW = cellImgW + pad * 2
  const cellH = cellImgH + labelH + pad * 2

  const sheet = document.createElement('canvas')
  sheet.width = cols * cellW
  sheet.height = rows * cellH + 50
  const ctx = sheet.getContext('2d')
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, sheet.width, sheet.height)

  // Title
  ctx.fillStyle = '#2C2C2C'
  ctx.font = '600 20px system-ui, sans-serif'
  ctx.textBaseline = 'top'
  ctx.fillText(`Character cards — ${list.length} guest${list.length === 1 ? '' : 's'} (${size.label})`, pad, 16)

  for (let i = 0; i < list.length; i++) {
    const guest = list[i]
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = col * cellW
    const y = 50 + row * cellH

    const dataURL = await renderCharmPNG(guest.recipe, availableAssets, size)
    const img = await new Promise((res, rej) => { const el = new Image(); el.onload = () => res(el); el.onerror = rej; el.src = dataURL })
    ctx.drawImage(img, x + pad, y + pad, cellImgW, cellImgH)

    // name + status
    ctx.fillStyle = guest.status === 'approved' ? '#5A8A5E' : guest.status === 'needs_revision' ? '#B85C5C' : '#7A6E66'
    ctx.font = '500 13px system-ui, sans-serif'
    ctx.textBaseline = 'top'
    const label = guest.name + (guest.status === 'approved' ? ' ✓' : guest.status === 'needs_revision' ? ' ⚑' : '')
    ctx.fillText(label.length > 26 ? label.slice(0, 25) + '…' : label, x + pad, y + pad + cellImgH + 6)
  }

  const blob = dataURLtoBlob(sheet.toDataURL('image/png'))
  downloadBlob(blob, `contact-sheet_${list.length}.png`)
  return { count: list.length }
}
