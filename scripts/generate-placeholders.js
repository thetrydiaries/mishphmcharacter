#!/usr/bin/env node
/**
 * generate-placeholders.js
 *
 * Creates test PNG assets at 630×880px for each category so the compositor
 * can be tested before real hand-drawn assets are ready.
 *
 * Run from project root:
 *   node scripts/generate-placeholders.js
 *
 * Zero npm dependencies — uses only Node.js built-ins (zlib, fs, path).
 *
 * Each placeholder:
 *   - Transparent background (RGBA)
 *   - Black outline border
 *   - A coloured shape in the approximate position for that layer
 *   - Colours match CLAUDE.md tinting rules:
 *       hair → #000000 fill (tinted at runtime)
 *       face/body/outfit → #888888 fill (tinted at runtime)
 *       eyes/accessories → real colour (not tinted)
 *       frames → full colour (creative)
 */

const zlib = require('zlib')
const fs = require('fs')
const path = require('path')

const ASSETS_ROOT = path.join(__dirname, '..', 'assets')
const W = 630
const H = 880

// ─── Minimal PNG encoder (no dependencies) ───────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
    t[i] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8)
  return (c ^ 0xFFFFFFFF) >>> 0
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const lenBuf = Buffer.alloc(4)
  lenBuf.writeUInt32BE(data.length)
  const forCrc = Buffer.concat([typeBuf, data])
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(forCrc))
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf])
}

/**
 * createPNG(pixelFn) → Buffer
 * pixelFn(x, y) → [r, g, b, a]  (each 0–255)
 */
function createPNG(pixelFn) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(W, 0)
  ihdr.writeUInt32BE(H, 4)
  ihdr[8] = 8  // bit depth
  ihdr[9] = 6  // RGBA
  // compression=0, filter=0, interlace=0 already

  const rowBytes = 1 + W * 4
  const raw = Buffer.alloc(H * rowBytes)
  for (let y = 0; y < H; y++) {
    raw[y * rowBytes] = 0  // filter: None
    for (let x = 0; x < W; x++) {
      const [r, g, b, a] = pixelFn(x, y)
      const off = y * rowBytes + 1 + x * 4
      raw[off]     = r
      raw[off + 1] = g
      raw[off + 2] = b
      raw[off + 3] = a
    }
  }

  const compressed = zlib.deflateSync(raw, { level: 1 })
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

// ─── Shape helpers ────────────────────────────────────────────────────────────

function inEllipse(x, y, cx, cy, rx, ry) {
  const dx = (x - cx) / rx
  const dy = (y - cy) / ry
  return dx * dx + dy * dy <= 1
}

function inRect(x, y, rx, ry, rw, rh) {
  return x >= rx && x <= rx + rw && y >= ry && y <= ry + rh
}

function isOutlineEllipse(x, y, cx, cy, rx, ry, thickness) {
  const inside  = inEllipse(x, y, cx, cy, rx, ry)
  const outside = inEllipse(x, y, cx, cy, rx + thickness, ry + thickness)
  return outside && !inside
}

function isOutlineRect(x, y, rx, ry, rw, rh, thickness) {
  const inside  = inRect(x, y, rx + thickness, ry + thickness, rw - thickness * 2, rh - thickness * 2)
  const outside = inRect(x, y, rx, ry, rw, rh)
  return outside && !inside
}

// ─── Pixel painters ──────────────────────────────────────────────────────────

function transparent() { return [0, 0, 0, 0] }
function black() { return [0, 0, 0, 255] }
function grey() { return [136, 136, 136, 255] }
function hex(h) {
  const n = parseInt(h.replace('#', ''), 16)
  return [(n >> 16) & 0xFF, (n >> 8) & 0xFF, n & 0xFF, 255]
}

// ─── Asset definitions ───────────────────────────────────────────────────────
// Each asset: { file, pixelFn(x,y) → [r,g,b,a] }

function makeFace(variant) {
  const shapes = {
    oval:     { cx: W / 2, cy: 340, rx: 150, ry: 180 },
    round:    { cx: W / 2, cy: 340, rx: 165, ry: 165 },
    square:   { cx: W / 2, cy: 340, rx: 155, ry: 155 },
    heart:    { cx: W / 2, cy: 320, rx: 155, ry: 160 },
    oblong:   { cx: W / 2, cy: 360, rx: 135, ry: 200 },
    diamond:  { cx: W / 2, cy: 340, rx: 130, ry: 175 },
  }
  const { cx, cy, rx, ry } = shapes[variant] || shapes.oval
  return (x, y) => {
    if (isOutlineEllipse(x, y, cx, cy, rx, ry, 4)) return black()
    if (inEllipse(x, y, cx, cy, rx, ry)) return grey()  // mid-grey → skin tint at runtime
    return transparent()
  }
}

function makeHairBack(variant) {
  // Hair BACK layer: sits behind the face (z=1).
  // Fill is pure black — multiply tint makes it the hair colour at runtime.
  // Shape is the full bulk/length/silhouette of the hair.
  const regions = {
    'wavy_shoulder':  { topY: 80,  botY: 520, rx: 180, ry: 240 },
    'straight_long':  { topY: 80,  botY: 580, rx: 158, ry: 250 },
    'straight_short': { topY: 80,  botY: 270, rx: 162, ry: 130 },
    'curly_short':    { topY: 70,  botY: 280, rx: 185, ry: 145 },
  }
  const r = regions[variant] || regions['wavy_shoulder']
  const cx = W / 2
  const cy = (r.topY + r.botY) / 2
  const ry = (r.botY - r.topY) / 2
  return (x, y) => {
    if (isOutlineEllipse(x, y, cx, cy, r.rx, ry, 4)) return black()
    if (inEllipse(x, y, cx, cy, r.rx, ry)) return black()  // pure black → tinted at runtime
    return transparent()
  }
}

function makeHairFront(variant) {
  // Hair FRONT layer: sits on top of the face (z=9).
  // Fringe / face-framing pieces. Fill is pure black — same tint as hair_back.
  // hair_front_none is transparent — required for guests with no fringe.
  if (variant === 'none') return () => transparent()

  const shapes = {
    // Blunt fringe: horizontal band across the forehead
    fringe: (x, y) => {
      if (inRect(x, y, W/2 - 140, 155, 280, 55)) {
        // Rounded bottom edge via ellipse cutout
        if (y > 185 && inEllipse(x, y, W/2, 190, 140, 20)) return transparent()
        return black()
      }
      return transparent()
    },
    // Curtain fringe: two arched pieces parted in the middle
    curtains: (x, y) => {
      const leftCurtain  = inEllipse(x, y, W/2 - 80, 200, 75, 60) && x < W/2 - 5
      const rightCurtain = inEllipse(x, y, W/2 + 80, 200, 75, 60) && x > W/2 + 5
      if ((leftCurtain || rightCurtain) && y > 140 && y < 250) return black()
      return transparent()
    },
  }
  const fn = shapes[variant] || shapes.fringe
  return fn
}

function makeBody(variant) {
  // Body silhouette — mid-grey for outfit tinting
  const widths = { slim: 130, average: 160, broad: 190 }
  const bw = widths[variant] || widths.average
  const bx = W / 2 - bw / 2
  const by = 480
  const bh = 360
  return (x, y) => {
    if (isOutlineRect(x, y, bx, by, bw, bh, 4)) return black()
    if (inRect(x, y, bx, by, bw, bh)) return grey()  // mid-grey → outfit tint at runtime
    return transparent()
  }
}

function makeOutfit(variant) {
  // Outfit sits over the body — also mid-grey for outfit tinting
  const shapes = {
    blazer: { bx: W/2 - 140, by: 460, bw: 280, bh: 200 },
    casual: { bx: W/2 - 130, by: 460, bw: 260, bh: 200 },
  }
  const { bx, by, bw, bh } = shapes[variant] || shapes.blazer
  return (x, y) => {
    if (isOutlineRect(x, y, bx, by, bw, bh, 4)) return black()
    if (inRect(x, y, bx, by, bw, bh)) return grey()
    return transparent()
  }
}

function makeEyes(variant) {
  const cols = { almond: hex('#4A3520'), round: hex('#2A5C8A') }
  const colour = cols[variant] || cols.almond
  const eyeR = variant === 'round' ? 22 : 18
  return (x, y) => {
    const left  = inEllipse(x, y, W/2 - 65, 340, eyeR, eyeR * 0.7)
    const right = inEllipse(x, y, W/2 + 65, 340, eyeR, eyeR * 0.7)
    if (left || right) return colour  // real colour — not tinted
    return transparent()
  }
}

function makeBrows(variant) {
  const archY = variant === 'arched' ? -8 : 0
  return (x, y) => {
    const lx = W/2 - 65, rx = W/2 + 65, by2 = 305 + archY
    const inLeft  = inEllipse(x, y, lx, by2, 50, 6)
    const inRight = inEllipse(x, y, rx, by2, 50, 6)
    if (inLeft || inRight) return black()
    return transparent()
  }
}

function makeNose(variant) {
  const cy = 380
  return (x, y) => {
    if (inEllipse(x, y, W/2, cy, 18, 14)) return [0, 0, 0, 180]
    return transparent()
  }
}

function makeMouth(variant) {
  const shapes = {
    closedsmile: { cx: W/2, cy: 430, rx: 40, ry: 14 },
    neutral:     { cx: W/2, cy: 430, rx: 35, ry: 8  },
  }
  const { cx, cy, rx, ry } = shapes[variant] || shapes.closedsmile
  return (x, y) => {
    if (isOutlineEllipse(x, y, cx, cy, rx, ry, 3)) return black()
    return transparent()
  }
}

function makeFacialHair(variant) {
  if (variant === 'none') {
    return () => transparent()
  }
  // stubble: dots around lower face
  return (x, y) => {
    const inLower = inEllipse(x, y, W/2, 420, 120, 60)
    if (inLower && (x + y) % 5 === 0) return [50, 30, 20, 140]
    return transparent()
  }
}

function makeAccessory(variant) {
  if (variant === 'glasses_none') {
    return () => transparent()
  }
  // Round glasses: two circles
  const glassColour = hex('#2C2C2C')
  return (x, y) => {
    const left  = isOutlineEllipse(x, y, W/2 - 65, 345, 32, 28, 3)
    const right = isOutlineEllipse(x, y, W/2 + 65, 345, 32, 28, 3)
    // bridge
    const bridge = inRect(x, y, W/2 - 33, 343, 66, 4)
    if (left || right || bridge) return glassColour
    return transparent()
  }
}

function makeFrame(variant) {
  // Botanical frame: thick decorative border in warm green
  const colour = hex('#5C7A4A')
  const accent2 = hex('#8FAF6A')
  const borderW = 30
  return (x, y) => {
    const onBorder = !inRect(x, y, borderW, borderW, W - borderW * 2, H - borderW * 2)
    if (onBorder) return colour
    // Inner decorative line
    const innerBorder = !inRect(x, y, borderW + 8, borderW + 8, W - (borderW + 8) * 2, H - (borderW + 8) * 2)
    if (innerBorder) return accent2
    return transparent()
  }
}

// ─── Asset manifest ───────────────────────────────────────────────────────────

const ASSETS = [
  // frames
  { dir: 'frames',     file: 'frame_botanical.png',        fn: makeFrame('botanical') },
  // body
  { dir: 'body',       file: 'body_slim.png',              fn: makeBody('slim') },
  { dir: 'body',       file: 'body_average.png',           fn: makeBody('average') },
  { dir: 'body',       file: 'body_broad.png',             fn: makeBody('broad') },
  // outfit
  { dir: 'outfit',     file: 'outfit_blazer.png',          fn: makeOutfit('blazer') },
  { dir: 'outfit',     file: 'outfit_casual.png',          fn: makeOutfit('casual') },
  // face
  { dir: 'face',       file: 'face_oval.png',              fn: makeFace('oval') },
  { dir: 'face',       file: 'face_round.png',             fn: makeFace('round') },
  { dir: 'face',       file: 'face_square.png',            fn: makeFace('square') },
  { dir: 'face',       file: 'face_heart.png',             fn: makeFace('heart') },
  { dir: 'face',       file: 'face_oblong.png',            fn: makeFace('oblong') },
  { dir: 'face',       file: 'face_diamond.png',           fn: makeFace('diamond') },
  // facial hair
  { dir: 'facialhair', file: 'facialhair_none.png',        fn: makeFacialHair('none') },
  { dir: 'facialhair', file: 'facialhair_stubble.png',     fn: makeFacialHair('stubble') },
  // nose
  { dir: 'nose',       file: 'nose_button.png',            fn: makeNose('button') },
  { dir: 'nose',       file: 'nose_straight.png',          fn: makeNose('straight') },
  // mouth
  { dir: 'mouth',      file: 'mouth_closedsmile.png',      fn: makeMouth('closedsmile') },
  { dir: 'mouth',      file: 'mouth_neutral.png',          fn: makeMouth('neutral') },
  // eyes
  { dir: 'eyes',       file: 'eyes_almond.png',            fn: makeEyes('almond') },
  { dir: 'eyes',       file: 'eyes_round.png',             fn: makeEyes('round') },
  // brows
  { dir: 'brows',      file: 'brow_natural.png',           fn: makeBrows('natural') },
  { dir: 'brows',      file: 'brow_arched.png',            fn: makeBrows('arched') },
  // hair_back (bulk/length/shape — sits behind face at z=1)
  { dir: 'hair_back',  file: 'hair_back_wavy_shoulder.png',  fn: makeHairBack('wavy_shoulder') },
  { dir: 'hair_back',  file: 'hair_back_straight_long.png',  fn: makeHairBack('straight_long') },
  { dir: 'hair_back',  file: 'hair_back_straight_short.png', fn: makeHairBack('straight_short') },
  { dir: 'hair_back',  file: 'hair_back_curly_short.png',    fn: makeHairBack('curly_short') },
  // hair_front (fringe/bangs — sits over face at z=9; hair_front_none is required)
  { dir: 'hair_front', file: 'hair_front_none.png',          fn: makeHairFront('none') },
  { dir: 'hair_front', file: 'hair_front_fringe.png',        fn: makeHairFront('fringe') },
  { dir: 'hair_front', file: 'hair_front_curtains.png',      fn: makeHairFront('curtains') },
  // accessories
  { dir: 'accessories', file: 'accessory_glasses_none.png',  fn: makeAccessory('glasses_none') },
  { dir: 'accessories', file: 'accessory_glasses_round.png', fn: makeAccessory('glasses_round') },
]

// ─── Generate ─────────────────────────────────────────────────────────────────

let count = 0
for (const { dir, file, fn } of ASSETS) {
  const outDir = path.join(ASSETS_ROOT, dir)
  const outPath = path.join(outDir, file)

  if (fs.existsSync(outPath)) {
    console.log(`  skip  ${dir}/${file}  (already exists)`)
    continue
  }

  process.stdout.write(`  gen   ${dir}/${file} … `)
  const buf = createPNG(fn)
  fs.writeFileSync(outPath, buf)
  console.log(`done (${(buf.length / 1024).toFixed(1)} KB)`)
  count++
}

console.log(`\nGenerated ${count} placeholder PNG${count !== 1 ? 's' : ''}.`)
console.log('Replace with real hand-drawn assets when ready — same filename, same 630×880 size.')
