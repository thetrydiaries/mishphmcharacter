// charmSizes.js — physical acrylic-charm size presets.
//
// IMPORTANT: widthMM / heightMM are the INSERT (cut) size — the paper you trim and
// slide inside the case — NOT the case's outer dimension. A charm sold as "40×40mm"
// usually means the OUTER case; the printable inner window is smaller. Measure the
// inner window and update these numbers. They are intentionally editable.
//
//   widthMM / heightMM — trim size of the insert (full-bleed artwork is trimmed to this)
//   bleedMM            — art extends this far PAST the trim line on every side (safety for hand-cutting)
//   safeMM             — keep faces / names at least this far INSIDE the trim line (the case lip overlaps the edge)
//   dpi                — export resolution; 300 = good, 480 = premium (bigger files)
//   cornerRadiusMM     — rounded-corner radius of the charm, for the mockup overlay only

export const MM_PER_INCH = 25.4

export const DEFAULT_CHARM_SIZES = [
  {
    id: 'square40',
    label: 'Square (40mm case)',
    widthMM: 34,          // placeholder — MEASURE the inner window and update
    heightMM: 34,         // placeholder
    bleedMM: 2,
    safeMM: 3,
    dpi: 300,
    cornerRadiusMM: 4,
  },
  {
    id: 'portrait46x32',
    label: 'Portrait (46×32mm case)',
    widthMM: 27,          // placeholder — 32mm case width; MEASURE the inner window and update
    heightMM: 40,         // placeholder — 46mm case height; MEASURE the inner window and update
    bleedMM: 2,
    safeMM: 3,
    dpi: 300,
    cornerRadiusMM: 4,
  },
]

// Convert millimetres to pixels at a given dpi.
export const mmToPx = (mm, dpi) => Math.round((mm / MM_PER_INCH) * dpi)

// Derive the pixel geometry for a charm size.
// Returns trim box, full box (trim + bleed on all sides), and safe box — all in px,
// with the trim box's top-left as the origin offset inside the full box.
export function charmGeometry(size) {
  const { widthMM, heightMM, bleedMM, safeMM, dpi, cornerRadiusMM } = size
  const bleedPx = mmToPx(bleedMM, dpi)
  const safePx = mmToPx(safeMM, dpi)
  const trimW = mmToPx(widthMM, dpi)
  const trimH = mmToPx(heightMM, dpi)
  return {
    dpi,
    bleedPx,
    safePx,
    trimW,
    trimH,
    fullW: trimW + bleedPx * 2,
    fullH: trimH + bleedPx * 2,
    cornerRadiusPx: mmToPx(cornerRadiusMM, dpi),
    aspect: widthMM / heightMM,
  }
}
