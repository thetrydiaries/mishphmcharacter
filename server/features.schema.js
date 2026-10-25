// features.schema.js — single source of truth for AI-detected guest features.
//
// Used in three places so they can never drift apart:
//   1. buildSystemPrompt()  — generates the Claude Vision prompt from this schema
//   2. validateFeatures()   — coerces Claude's response to valid values, reports warnings
//   3. buildMockFeatures()  — generates a valid mock payload (?mock=true) from the `mock` field
//
// Enum values here MUST stay in sync with the rules in assetMapping.json. If you add an
// asset + a mapping rule for a new value, add that value to the matching enum below.

const SCHEMA = {
  gender:          { type: 'enum', values: ['female', 'male', 'other'],                                           mock: 'female' },
  hairLength:      { type: 'enum', values: ['short', 'medium', 'long'],                                           mock: 'long' },
  hairStyle:       { type: 'enum', values: ['straight', 'wavy', 'curly', 'bun', 'bob', 'slick'],                  mock: 'wavy' },
  hairFrontStyle:  { type: 'enum', values: ['none', 'fringe', 'curtains', 'side_part', 'slick', 'messy', 'long'], mock: 'curtains' },
  faceShape:       { type: 'enum', values: ['oval', 'round', 'square', 'diamond'],                                mock: 'oval' },
  eyeShape:        { type: 'enum', values: ['almond', 'round', 'monolid', 'hooded'],                              mock: 'almond' },
  eyeColour:       { type: 'enum', values: ['black', 'brown', 'blue', 'green'],                                   mock: 'brown' },
  browShape:       { type: 'enum', values: ['natural', 'arched', 'straight', 'bushy', 'barely-there'],            mock: 'natural' },
  noseShape:       { type: 'enum', values: ['button', 'straight', 'wide', 'curved', 'upturned'],                  mock: 'button' },
  mouthShape:      { type: 'enum', values: ['full', 'thin', 'wide', 'neutral'],                                   mock: 'full' },
  hasFacialHair:   { type: 'boolean',                                                                             mock: false },
  facialHairStyle: { type: 'enum', values: ['none', 'stubble', 'moustache', 'short beard', 'full beard', 'goatee'], mock: 'none' },
  hasGlasses:      { type: 'boolean',                                                                             mock: false },
  outfitStyle:     { type: 'enum', values: ['shirt', 'buttonup', 'turtleneck', 'shirtpocket', 'none'],            mock: 'shirtpocket' },
  skinTone:        { type: 'hex', example: '#C08060',                                                             mock: '#E8B89D' },
  hairColour:      { type: 'hex', example: '#3D1F0A',                                                             mock: '#8B5A2B' },
  outfitColour:    { type: 'hex', example: '#2D3561',                                                             mock: '#2D3561' },
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/

// Build the JSON-shape block for the system prompt directly from the schema.
function buildSystemPrompt() {
  const lines = Object.entries(SCHEMA).map(([field, def]) => {
    if (def.type === 'enum')    return `  "${field}": ${def.values.map(v => `"${v}"`).join(' | ')}`
    if (def.type === 'boolean') return `  "${field}": true | false`
    return `  "${field}": "<hex colour string that best matches, e.g. ${def.example}>"`
  })
  return `You are analysing a photo of a wedding guest to match them to illustrated character assets.
Look carefully at the person and return ONLY a valid JSON object with these exact fields — no explanation, no markdown, just the raw JSON:

{
${lines.join(',\n')}
}

If you cannot determine a value confidently, pick the closest match — never return null.`
}

// Coerce a features object to valid values. Returns { features, warnings }.
// Invalid/missing values fall back to the mock default and are reported in warnings
// so bad AI output surfaces instead of silently producing blank layers.
function validateFeatures(raw) {
  const features = {}
  const warnings = []
  const input = raw && typeof raw === 'object' ? raw : {}

  for (const [field, def] of Object.entries(SCHEMA)) {
    const value = input[field]

    if (def.type === 'enum') {
      if (def.values.includes(value)) {
        features[field] = value
      } else {
        features[field] = def.mock
        warnings.push(`${field}: "${value}" not in [${def.values.join(', ')}] — used "${def.mock}"`)
      }
    } else if (def.type === 'boolean') {
      if (typeof value === 'boolean') {
        features[field] = value
      } else {
        features[field] = def.mock
        warnings.push(`${field}: "${value}" not a boolean — used ${def.mock}`)
      }
    } else { // hex
      if (typeof value === 'string' && HEX_RE.test(value)) {
        features[field] = value
      } else {
        features[field] = def.mock
        warnings.push(`${field}: "${value}" not a #RRGGBB hex — used ${def.mock}`)
      }
    }
  }

  return { features, warnings }
}

function buildMockFeatures() {
  const features = {}
  for (const [field, def] of Object.entries(SCHEMA)) features[field] = def.mock
  return features
}

module.exports = { SCHEMA, buildSystemPrompt, validateFeatures, buildMockFeatures }
