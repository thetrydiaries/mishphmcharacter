require('dotenv').config()
const express = require('express')
const cors = require('cors')
const path = require('path')
const fs = require('fs')
const supabase = require('./supabase')
const analyseRoute = require('./routes/analyse')

const app = express()
const PORT = process.env.PORT || 3001

const ASSETS_ROOT = path.join(__dirname, '..', 'assets')

// Top-level dirs that are shared across all art styles (not a style, not under a style).
const SHARED_DIRS = ['frames', 'backgrounds']
// Mapping category → folder name (categories whose folder differs from the recipe key).
const CATEGORY_FOLDER = { frame: 'frames', accessory: 'accessories' }
const DEFAULT_STYLE = 'classic'

// List available art styles = top-level asset dirs that aren't shared dirs or hidden.
function listStyles() {
  if (!fs.existsSync(ASSETS_ROOT)) return []
  return fs.readdirSync(ASSETS_ROOT, { withFileTypes: true })
    .filter(e => e.isDirectory() && !e.name.startsWith('.') && !SHARED_DIRS.includes(e.name))
    .map(e => e.name)
}

// List PNGs in a dir as [{ name, url }]. urlBase is the public path prefix.
function listPngs(dir, urlBase) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir)
    .filter(f => f.toLowerCase().endsWith('.png'))
    .map(f => ({ name: path.basename(f, '.png'), url: `${urlBase}/${f}` }))
}

// ─── Startup check: warn if any mapping rule points at a missing asset ─────────
// For the default style, missing assets are warnings (silent blank layers).
// For other styles (still being drawn), just report progress — no noise.
function checkMappingAgainstAssets() {
  try {
    const mapping = JSON.parse(fs.readFileSync(path.join(__dirname, 'assetMapping.json'), 'utf8'))

    // All asset names the mapping can produce, grouped by folder.
    const referencedByFolder = {}
    for (const [category, config] of Object.entries(mapping.categories)) {
      const folder = CATEGORY_FOLDER[category] || category
      const names = [config.default, ...config.rules.map(r => r.asset)]
        .flat()
        .filter(a => typeof a === 'string')
      referencedByFolder[folder] = new Set([...(referencedByFolder[folder] || []), ...names])
    }

    for (const style of listStyles()) {
      const missing = []
      let total = 0, present = 0
      for (const [folder, names] of Object.entries(referencedByFolder)) {
        // Shared folders (frames) live at top level, not under the style.
        const dir = SHARED_DIRS.includes(folder)
          ? path.join(ASSETS_ROOT, folder)
          : path.join(ASSETS_ROOT, style, folder)
        const have = new Set(listPngs(dir, '').map(a => a.name))
        for (const name of names) {
          total++
          if (have.has(name)) present++
          else missing.push(`${folder}: "${name}"`)
        }
      }
      if (style === DEFAULT_STYLE) {
        if (missing.length) {
          console.warn(`\n[mapping-check] ${style}: ${missing.length} rule(s) point at missing assets:`)
          missing.forEach(m => console.warn('  ⚠ ' + m))
          console.warn('')
        } else {
          console.log(`[mapping-check] ${style}: all mapping rules resolve ✓`)
        }
      } else {
        console.log(`[mapping-check] ${style}: ${present}/${total} referenced assets present (${total - present} not yet drawn)`)
      }
    }
  } catch (err) {
    console.warn('[mapping-check] skipped:', err.message)
  }
}

app.use(cors())
app.use(express.json())

// Serve all PNG assets statically (every style + shared dirs live under /assets)
app.use('/assets', express.static(ASSETS_ROOT))

// POST /api/analyse — upload a photo, run Claude Vision, return recipe + flags
app.use('/api/analyse', analyseRoute)

// GET /api/styles — list available art styles
app.get('/api/styles', (req, res) => {
  res.json({ styles: listStyles(), default: DEFAULT_STYLE })
})

// Read a style's character categories as { category: [{name,url}] }.
function readStyleCats(style) {
  const out = {}
  const styleRoot = path.join(ASSETS_ROOT, style)
  if (!fs.existsSync(styleRoot)) return out
  for (const e of fs.readdirSync(styleRoot, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name.startsWith('.')) continue
    out[e.name] = listPngs(path.join(styleRoot, e.name), `/assets/${style}/${e.name}`)
  }
  return out
}

// GET /api/assets?style=classic — character categories for a style + shared dirs.
// Styles are self-contained: each serves only its own folder. A missing asset in a
// style renders as a blank layer until it's drawn (no cross-style reuse).
app.get('/api/assets', (req, res) => {
  try {
    const styles = listStyles()
    const style = req.query.style || DEFAULT_STYLE
    if (!styles.includes(style)) {
      return res.status(404).json({ error: `Unknown style "${style}". Available: ${styles.join(', ')}` })
    }

    const result = {}

    // This style's own character categories only — no fallback to another style
    for (const [cat, list] of Object.entries(readStyleCats(style))) result[cat] = list

    // Shared dirs (frames, backgrounds) live at the top level, same for every style
    for (const shared of SHARED_DIRS) {
      const dir = path.join(ASSETS_ROOT, shared)
      if (fs.existsSync(dir)) result[shared] = listPngs(dir, `/assets/${shared}`)
    }

    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.get('/health/db', async (req, res) => {
  const { error } = await supabase.from('_health').select('*').limit(1)
  if (error && error.code !== 'PGRST116') {
    return res.status(500).json({ status: 'error', message: error.message })
  }
  res.json({ status: 'ok' })
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
  checkMappingAgainstAssets()
})
