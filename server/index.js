require('dotenv').config()
const express = require('express')
const cors = require('cors')
const path = require('path')
const fs = require('fs')
const supabase = require('./supabase')

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

// Serve hand-drawn PNG assets statically
const ASSETS_ROOT = path.join(__dirname, '..', 'assets')
app.use('/assets', express.static(ASSETS_ROOT))

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
})
