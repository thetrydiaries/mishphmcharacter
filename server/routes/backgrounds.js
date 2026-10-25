const express = require('express')
const router = express.Router()
const multer = require('multer')
const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const BG_DIR = path.join(__dirname, '..', '..', 'assets', 'backgrounds')

// Cap upload size — unbounded memory is a DoS risk.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

function ensureDir() {
  if (!fs.existsSync(BG_DIR)) fs.mkdirSync(BG_DIR, { recursive: true })
}

// lowercase, underscores, no path separators — safe filename
function slugify(name) {
  return name.toLowerCase().replace(/\.[^.]+$/, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60) || 'background'
}

// Reject anything that could escape the backgrounds dir
function safeName(name) {
  return /^[a-z0-9_]+$/.test(name) ? name : null
}

// POST /api/backgrounds — upload an image, normalise to PNG, store in the library
router.post('/', upload.single('background'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
    ensureDir()

    // Normalise to PNG (handles HEIC/JPG/etc), cap dimensions so stored files stay sane
    const png = await sharp(req.file.buffer)
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer()

    let base = `bg_${slugify(req.file.originalname)}`
    let name = base
    let i = 2
    while (fs.existsSync(path.join(BG_DIR, `${name}.png`))) { name = `${base}_${i++}` }

    fs.writeFileSync(path.join(BG_DIR, `${name}.png`), png)
    res.json({ name, url: `/assets/backgrounds/${name}.png` })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/backgrounds/:name — remove a background from the library
router.delete('/:name', (req, res) => {
  const name = safeName(req.params.name)
  if (!name) return res.status(400).json({ error: 'Invalid name' })
  const file = path.join(BG_DIR, `${name}.png`)
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Not found' })
  try {
    fs.unlinkSync(file)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
