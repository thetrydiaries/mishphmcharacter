require('dotenv').config()
const express = require('express')
const cors = require('cors')
const path = require('path')
const fs = require('fs')
const supabase = require('./supabase')
const analyseRoute = require('./routes/analyse')

const app = express()
const PORT = process.env.PORT || 3001

// ─── Startup check: warn if any mapping rule points at a missing asset ─────────
// Catches silent blank layers as the asset library grows. Mapping category → folder.
const CATEGORY_FOLDER = { frame: 'frames', accessory: 'accessories' }
function checkMappingAgainstAssets() {
  try {
    const assetsRoot = path.join(__dirname, '..', 'assets')
    const mapping = JSON.parse(fs.readFileSync(path.join(__dirname, 'assetMapping.json'), 'utf8'))
    const missing = []
    for (const [category, config] of Object.entries(mapping.categories)) {
      const folder = CATEGORY_FOLDER[category] || category
      const dir = path.join(assetsRoot, folder)
      const have = new Set(
        (fs.existsSync(dir) ? fs.readdirSync(dir) : [])
          .filter(f => f.toLowerCase().endsWith('.png'))
          .map(f => path.basename(f, '.png'))
      )
      const referenced = [config.default, ...config.rules.map(r => r.asset)]
        .flat()
        .filter(a => typeof a === 'string')
      for (const name of referenced) {
        if (!have.has(name)) missing.push(`${category}: "${name}" (looked in /assets/${folder})`)
      }
    }
    if (missing.length) {
      console.warn(`\n[mapping-check] ${missing.length} mapping rule(s) point at missing assets:`)
      missing.forEach(m => console.warn('  ⚠ ' + m))
      console.warn('')
    } else {
      console.log('[mapping-check] all mapping rules resolve to existing assets ✓')
    }
  } catch (err) {
    console.warn('[mapping-check] skipped:', err.message)
  }
}

app.use(cors())
app.use(express.json())

// Serve hand-drawn PNG assets statically
const ASSETS_ROOT = path.join(__dirname, '..', 'assets')
app.use('/assets', express.static(ASSETS_ROOT))

// POST /api/analyse — upload a photo, run Claude Vision, return recipe + flags
app.use('/api/analyse', analyseRoute)

// GET /api/assets — returns all assets grouped by category
app.get('/api/assets', (req, res) => {
  try {
    const entries = fs.readdirSync(ASSETS_ROOT, { withFileTypes: true })
    const categories = entries
      .filter(e => e.isDirectory())
      .map(e => e.name)

    const result = {}
    for (const category of categories) {
      const catPath = path.join(ASSETS_ROOT, category)
      const files = fs.readdirSync(catPath).filter(f => f.toLowerCase().endsWith('.png'))
      result[category] = files.map(f => ({
        name: path.basename(f, '.png'),
        url: `/assets/${category}/${f}`,
      }))
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
