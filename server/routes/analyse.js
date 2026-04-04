const express = require('express')
const router = express.Router()
const multer = require('multer')
const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const upload = multer({ storage: multer.memoryStorage() })

// Load mapping config once at startup — edit assetMapping.json to update rules without touching code
const MAPPING = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'assetMapping.json'), 'utf8')
)

const SYSTEM_PROMPT = `You are analysing a photo of a wedding guest to match them to illustrated character assets.
Look carefully at the person and return ONLY a valid JSON object with these exact fields — no explanation, no markdown, just the raw JSON:

{
  "gender": "female" | "male" | "other",
  "hairLength": "short" | "medium" | "long",
  "hairStyle": "straight" | "wavy" | "curly" | "bun" | "bob" | "slick",
  "hairFrontStyle": "none" | "fringe" | "curtains" | "side_part" | "slick" | "messy" | "long",
  "faceShape": "oval" | "round" | "square" | "diamond",
  "eyeShape": "almond" | "round" | "monolid" | "hooded",
  "eyeColour": "black" | "brown" | "blue" | "green",
  "browShape": "natural" | "arched" | "straight" | "bushy" | "barely-there",
  "noseShape": "button" | "straight" | "wide" | "curved" | "upturned",
  "mouthShape": "full" | "thin" | "wide" | "neutral",
  "hasFacialHair": true | false,
  "facialHairStyle": "none" | "stubble" | "moustache" | "short beard" | "full beard" | "goatee",
  "hasGlasses": true | false,
  "outfitStyle": "shirt" | "buttonup" | "turtleneck" | "shirtpocket" | "none",
  "skinTone": "<hex colour string that best matches their skin, e.g. #C08060>",
  "hairColour": "<hex colour string that best matches their hair, e.g. #3D1F0A>",
  "outfitColour": "<hex colour string that best matches their visible clothing, e.g. #2D3561>"
}

If you cannot determine a value confidently, pick the closest match — never return null.`

// ─── Mock features (?mock=true query param) ───────────────────────────────────
const MOCK_FEATURES = {
  gender:          'female',
  hairLength:      'long',
  hairStyle:       'short',
  hairFrontStyle:  'curtains',
  faceShape:       'diamond',
  eyeShape:        'hooded',
  eyeColour:       'blue',
  browShape:       'thick',
  noseShape:       'button',
  mouthShape:      'smile',
  hasFacialHair:   false,
  facialHairStyle: 'none',
  hasGlasses:      false,
  outfitStyle:     'shirtpocket',
  skinTone:        '#E8B89D',
  hairColour:      '#8B5A2B',
  outfitColour:    '#2D3561',
}

// Walk one category's rules. Returns { asset, flagged }.
// flagged=true only when there were rules to try but none matched (unexpected feature value).
// Empty rules = intentional default, never flagged.
function resolveCategory(config, features) {
  for (const rule of config.rules) {
    const allMatch = Object.entries(rule.conditions).every(
      ([key, value]) => features[key] === value
    )
    if (allMatch) return { asset: rule.asset, flagged: false }
  }

  return { asset: config.default, flagged: config.rules.length > 0 }
}

router.post('/', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No photo uploaded' })
    }

    let features

    if (req.query.mock === 'true') {
      // ── Mock mode — pass ?mock=true to skip the Claude API call ──────────────
      console.log('[analyse] MOCK MODE — skipping Claude API call')
      features = MOCK_FEATURES
    } else {
      // ── Convert image and call Claude Vision ────────────────────────────────
      console.log('[analyse] received file:', req.file.originalname, req.file.mimetype, req.file.size, 'bytes')

      const jpegBuffer = await sharp(req.file.buffer)
        .resize({ width: 1024, withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer()

      console.log('[analyse] converted to JPEG:', jpegBuffer.length, 'bytes')

      const base64 = jpegBuffer.toString('base64')

      console.log('[analyse] calling Claude Vision...')

      const apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key':         process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type':      'application/json',
        },
        body: JSON.stringify({
          model:      'claude-sonnet-4-6',
          max_tokens: 1024,
          system:     SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type:   'image',
                  source: { type: 'base64', media_type: 'image/jpeg', data: base64 },
                },
                { type: 'text', text: 'Analyse this wedding guest photo.' },
              ],
            },
          ],
        }),
      })

      if (!apiResponse.ok) {
        const errText = await apiResponse.text()
        throw new Error(`Claude API ${apiResponse.status}: ${errText}`)
      }

      const claudeResult = await apiResponse.json()

      // Strip accidental markdown fences before parsing
      const rawText = claudeResult.content[0].text
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/,           '')

      features = JSON.parse(rawText)
    }

    // ── Apply asset mapping rules ─────────────────────────────────────────────
    const assets = {}
    const flags  = []

    for (const [category, config] of Object.entries(MAPPING.categories)) {
      const { asset, flagged } = resolveCategory(config, features)
      assets[category] = asset
      if (flagged) flags.push(category)
    }

    const recipe = {
      assets,
      colours: {
        skin:   features.skinTone    || '#C08060',
        hair:   features.hairColour  || '#3D1F0A',
        outfit: features.outfitColour || '#2D3561',
      },
    }

    res.json({ recipe, flags, detectedFeatures: features })
  } catch (err) {
    console.error('[analyse] ERROR:', err.message)
    if (err.cause) console.error('[analyse] CAUSE:', err.cause)
    res.status(500).json({ error: err.message, cause: err.cause?.message ?? err.cause ?? null })
  }
})

module.exports = router
