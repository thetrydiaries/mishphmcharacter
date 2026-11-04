import { useState, useEffect } from 'react'
import { ASSET_TINT_OVERRIDES, TINT_DEFAULTS, LAYER_STACK } from './layers'

// Normalise a typed hex string to #RRGGBB (upper), or null if not a valid hex.
// Accepts with/without leading #, and 3-digit shorthand (#abc → #AABBCC).
function normaliseHex(raw) {
  let v = String(raw).trim().replace(/^#/, '')
  if (/^[0-9a-fA-F]{3}$/.test(v)) v = v.split('').map(c => c + c).join('')
  if (/^[0-9a-fA-F]{6}$/.test(v)) return '#' + v.toUpperCase()
  return null
}

// Panel display order = top-to-bottom of the face (operator workflow),
// NOT canvas layer order. Render z-order lives in LAYER_STACK (layers.js) —
// reordering this list does not change how layers stack on the canvas.
// `zoom` crops the thumbnail into the face region for small features so the
// variant is actually visible at thumbnail size: { scale, oy } (oy = vertical origin).
const CATEGORY_META = [
  { folder: 'face',        label: 'Face Shape',     recipeKey: 'face' },
  { folder: 'hair_back',   label: 'Hair (back)',    recipeKey: 'hair_back' },
  { folder: 'hair_front',  label: 'Bangs / front',  recipeKey: 'hair_front' },
  { folder: 'brows',       label: 'Eyebrows',       recipeKey: 'brows',      zoom: { scale: 2.4, oy: '38%' } },
  { folder: 'eyes',        label: 'Eyes',           recipeKey: 'eyes',       zoom: { scale: 2.4, oy: '44%' } },
  { folder: 'twinkle',     label: 'Twinkle',        recipeKey: 'twinkle',    zoom: { scale: 2.6, oy: '44%' } },
  { folder: 'nose',        label: 'Nose',           recipeKey: 'nose',       zoom: { scale: 2.4, oy: '52%' } },
  { folder: 'mouth',       label: 'Mouth',          recipeKey: 'mouth',      zoom: { scale: 2.4, oy: '60%' } },
  { folder: 'facialhair',  label: 'Facial Hair',    recipeKey: 'facialhair', zoom: { scale: 1.8, oy: '58%' } },
  { folder: 'accessories', label: 'Accessories',    recipeKey: 'accessory' },
  { folder: 'outfit',      label: 'Outfit',         recipeKey: 'outfit' },
  { folder: 'body',        label: 'Body',           recipeKey: 'body' },
  { folder: 'frames',      label: 'Card Frame',     recipeKey: 'frame' },
]

const COLOUR_PICKERS = [
  { key: 'hair',   label: 'Hair colour' },
  { key: 'skin',   label: 'Skin tone' },
  { key: 'outfit', label: 'Outfit colour' },
]

// Colour pickers that only appear when an asset using that tint override is active
// (e.g. Lips shows only when a lipstick mouth is selected).
const OVERRIDE_PICKERS = {
  lips:  { key: 'lips',  label: 'Lips colour' },
  metal: { key: 'metal', label: 'Metal colour' },
  blush: { key: 'blush', label: 'Blush colour' },
  smileline: { key: 'smileline', label: 'Smile line colour' },
  tie: { key: 'tie', label: 'Tie colour' },
  bib: { key: 'bib', label: 'Bib colour' },
}

// Assets that get their own opacity slider (keyed by asset name, not layer) so a single
// piece can be faded without dimming the rest of its layer — e.g. softening a mole.
const PER_ASSET_OPACITY = {
  accessories_moles: 'Moles opacity',
  accessories_nose_mole: 'Nose mole opacity',
}

// Strip the folder prefix from an asset filename for display.
// e.g. folder 'hair_back' + 'hair_back_curly_shoulder' -> 'curly shoulder';
// 'mouth_closedsmile' -> 'closedsmile'; 'facialhair_none' -> 'none'.
function variantLabel(name, folder) {
  const prefix = `${folder}_`
  const stripped = name.startsWith(prefix) ? name.slice(prefix.length) : name
  return stripped.replace(/_/g, ' ') || name
}

// Which toggleable tint keys (lips, metal) are in play for the current recipe.
// Scans each layer's active asset: a per-asset override wins, else the layer's own
// tintKey. Only keys that have an OVERRIDE_PICKER surface here (hair/skin/outfit are
// always-on COLOUR_PICKERS and are excluded). `_none`/empty assets don't count.
function activeOverrideKeys(recipe) {
  const keys = new Set()
  for (const layer of LAYER_STACK) {
    const value = recipe.assets[layer.key]
    const names = Array.isArray(value) ? value : (value ? [value] : [])
    for (const name of names) {
      if (!name || String(name).endsWith('_none')) continue
      const key = ASSET_TINT_OVERRIDES[name] ?? layer.tintKey
      if (key && OVERRIDE_PICKERS[key]) keys.add(key)
    }
  }
  return keys
}

// One colour-picker row: swatch + native picker + editable hex field.
// The hex field keeps local text while typing so partial input doesn't fight the
// controlled value; on blur/Enter it commits a valid hex or reverts to current.
function ColourRow({ tintKey, label, toggleable, current, tintOn, onSetColour, onSetTint }) {
  const [text, setText] = useState(current)
  // Resync when the colour changes elsewhere (native picker, reset, guest nav).
  useEffect(() => { setText(current) }, [current])

  const disabled = toggleable && !tintOn
  const commit = () => {
    const hex = normaliseHex(text)
    if (hex) onSetColour(tintKey, hex)
    else setText(current)
  }

  return (
    <div style={styles.colourRow}>
      {toggleable ? (
        <label style={{ ...styles.colourLabel, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={tintOn}
            onChange={e => onSetTint(tintKey, e.target.checked)}
            style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
            title={`Tint ${label.toLowerCase()}`}
          />
          {label}
        </label>
      ) : (
        <label style={styles.colourLabel}>{label}</label>
      )}
      <div style={{ ...styles.colourRight, opacity: disabled ? 0.4 : 1 }}>
        <div style={{ ...styles.colourSwatch, background: current }} />
        <input
          type="color"
          value={current}
          onChange={e => onSetColour(tintKey, e.target.value)}
          disabled={disabled}
          style={styles.colourInput}
          title={disabled ? `${label} tint is off` : `Pick ${label}`}
        />
        <input
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
          disabled={disabled}
          spellCheck={false}
          maxLength={7}
          style={styles.hexInput}
          title={disabled ? `${label} tint is off` : `Hex code for ${label}`}
          aria-label={`${label} hex code`}
        />
      </div>
    </div>
  )
}

export default function AssetPanel({ recipe, availableAssets, onSwapAsset, onSetColour, onSetOpacity, onSetTint, flaggedCategories = [] }) {
  const [openCategory, setOpenCategory] = useState('face')

  function toggleCategory(folder) {
    setOpenCategory(prev => prev === folder ? null : folder)
  }

  return (
    <aside style={styles.panel}>
      {/* Asset categories */}
      {CATEGORY_META.map(({ folder, label, recipeKey, zoom }) => {
        const assets = availableAssets?.[folder] ?? []
        const recipeValue  = recipe.assets[recipeKey]
        const isMulti      = Array.isArray(recipeValue)
        const activeAsset  = isMulti ? null : recipeValue
        const activeAssets = isMulti ? recipeValue : null
        const isOpen    = openCategory === folder
        const isFlagged = flaggedCategories.includes(recipeKey)

        // Multi-select panels hide _none placeholder assets (empty array = nothing shown)
        const displayAssets = isMulti
          ? assets.filter(a => !a.name.endsWith('_none'))
          : assets

        return (
          <div key={folder} style={styles.section}>
            <button
              style={{ ...styles.sectionHeader, ...(isOpen ? styles.sectionHeaderOpen : {}) }}
              onClick={() => toggleCategory(folder)}
            >
              <span style={styles.categoryLabel}>{label}</span>
              {isFlagged && (
                <span style={styles.reviewDot} title="AI suggestion — please review" />
              )}
              <span style={styles.chevron}>{isOpen ? '▲' : '▼'}</span>
              {isMulti ? (
                activeAssets.length > 0 && (
                  <span style={styles.activePill}>{activeAssets.length} selected</span>
                )
              ) : (
                activeAsset && (
                  <span style={styles.activePill}>
                    {variantLabel(activeAsset, folder)}
                  </span>
                )
              )}
            </button>

            {isOpen && (
              <div style={styles.thumbGrid}>
                {displayAssets.length === 0 ? (
                  <p style={styles.emptyNote}>No assets in /{folder}/ yet</p>
                ) : (
                  displayAssets.map(asset => {
                    const isActive = isMulti
                      ? activeAssets.includes(asset.name)
                      : activeAsset === asset.name
                    return (
                      <button
                        key={asset.name}
                        title={asset.name}
                        style={{
                          ...styles.thumbBtn,
                          ...(isActive ? styles.thumbBtnActive : {}),
                        }}
                        onClick={() => onSwapAsset(recipeKey, asset.name)}
                      >
                        <div style={styles.thumbImgWrap}>
                          <img
                            src={asset.url}
                            alt={asset.name}
                            style={{
                              ...styles.thumbImg,
                              ...(zoom && !asset.name.endsWith('_none')
                                ? { transform: `scale(${zoom.scale})`, transformOrigin: `50% ${zoom.oy}` }
                                : {}),
                            }}
                            loading="lazy"
                          />
                        </div>
                        <span style={styles.thumbName}>
                          {variantLabel(asset.name, folder)}
                        </span>
                      </button>
                    )
                  })
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Colour pickers */}
      <div style={{ ...styles.section, borderTop: '2px solid var(--border)' }}>
        <div style={styles.sectionHeader}>
          <span style={styles.categoryLabel}>Colours</span>
        </div>
        <div style={styles.colourPickers}>
          {[
            ...COLOUR_PICKERS,
            // Override pickers (e.g. lips) are toggleable — tint can be switched off
            // so the asset renders in its own drawn colour instead.
            ...[...activeOverrideKeys(recipe)].map(k => OVERRIDE_PICKERS[k]).filter(Boolean).map(p => ({ ...p, toggleable: true })),
          ].map(({ key, label, toggleable }) => (
            <ColourRow
              key={key}
              tintKey={key}
              label={label}
              toggleable={toggleable}
              current={recipe.colours[key] ?? TINT_DEFAULTS[key] ?? '#888888'}
              tintOn={recipe.tints?.[key] !== false}
              onSetColour={onSetColour}
              onSetTint={onSetTint}
            />
          ))}
        </div>

        {/* Facial hair opacity — only when a (non-none) beard/stubble is active */}
        {recipe.assets.facialhair && recipe.assets.facialhair !== 'facialhair_none' && (
          <div style={styles.opacityRow}>
            <label style={styles.colourLabel}>Facial hair opacity</label>
            <div style={styles.opacityRight}>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={recipe.opacities?.facialhair ?? 1}
                onChange={e => onSetOpacity('facialhair', Number(e.target.value))}
                style={styles.opacitySlider}
                title="Facial hair opacity"
              />
              <span style={styles.opacityValue}>{Math.round((recipe.opacities?.facialhair ?? 1) * 100)}%</span>
            </div>
          </div>
        )}

        {/* Hair opacity — drives hair_back + hair_front together (shared tint) */}
        {recipe.assets.hair_back && (
          <div style={styles.opacityRow}>
            <label style={styles.colourLabel}>Hair opacity</label>
            <div style={styles.opacityRight}>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={recipe.opacities?.hair_back ?? 1}
                onChange={e => {
                  const v = Number(e.target.value)
                  onSetOpacity('hair_back', v)
                  onSetOpacity('hair_front', v)
                }}
                style={styles.opacitySlider}
                title="Hair opacity"
              />
              <span style={styles.opacityValue}>{Math.round((recipe.opacities?.hair_back ?? 1) * 100)}%</span>
            </div>
          </div>
        )}

        {/* Per-asset opacity — one slider per active asset flagged in PER_ASSET_OPACITY (e.g. moles) */}
        {(recipe.assets.accessory ?? [])
          .filter(name => PER_ASSET_OPACITY[name])
          .map(name => (
            <div key={name} style={styles.opacityRow}>
              <label style={styles.colourLabel}>{PER_ASSET_OPACITY[name]}</label>
              <div style={styles.opacityRight}>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={recipe.opacities?.[name] ?? 1}
                  onChange={e => onSetOpacity(name, Number(e.target.value))}
                  style={styles.opacitySlider}
                  title={PER_ASSET_OPACITY[name]}
                />
                <span style={styles.opacityValue}>{Math.round((recipe.opacities?.[name] ?? 1) * 100)}%</span>
              </div>
            </div>
          ))}
      </div>
    </aside>
  )
}

const styles = {
  panel: {
    width: 280,
    flexShrink: 0,
    height: '100%',
    overflowY: 'auto',
    background: 'var(--surface)',
    borderLeft: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
  },
  section: {
    borderBottom: '1px solid var(--border)',
  },
  sectionHeader: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 14px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    color: 'var(--text)',
    transition: 'background 0.15s',
  },
  sectionHeaderOpen: {
    background: 'var(--accent-bg)',
  },
  categoryLabel: {
    fontFamily: 'var(--font-ui)',
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text)',
    flex: 1,
  },
  reviewDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: '#E6B800',
    flexShrink: 0,
    display: 'inline-block',
  },
  chevron: {
    fontSize: 9,
    color: 'var(--text-muted)',
  },
  activePill: {
    fontSize: 11,
    color: 'var(--accent-dark)',
    background: 'var(--accent-bg)',
    padding: '2px 7px',
    borderRadius: 10,
    maxWidth: 90,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  thumbGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    padding: '8px 10px 12px',
    background: 'var(--surface-raised)',
  },
  emptyNote: {
    fontSize: 12,
    color: 'var(--text-muted)',
    fontStyle: 'italic',
    padding: '4px 4px 8px',
    width: '100%',
  },
  thumbBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 3,
    padding: 4,
    background: 'var(--surface)',
    border: '2px solid var(--border)',
    borderRadius: 6,
    cursor: 'pointer',
    width: 72,
    transition: 'border-color 0.12s, box-shadow 0.12s',
  },
  thumbBtnActive: {
    borderColor: 'var(--green)',
    background: 'var(--green-bg)',
    boxShadow: '0 0 0 2px var(--green)',
  },
  thumbImgWrap: {
    width: 60,
    height: 84,
    overflow: 'hidden',
    background: '#F5F2EE',
    borderRadius: 3,
  },
  thumbImg: {
    width: 60,
    height: 84,
    objectFit: 'contain',
    display: 'block',
  },
  thumbName: {
    fontSize: 9,
    color: 'var(--text-muted)',
    textAlign: 'center',
    lineHeight: 1.2,
    maxWidth: 64,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  colourPickers: {
    padding: '10px 14px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  colourRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  opacityRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: '0 14px 14px',
  },
  opacityRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    justifyContent: 'flex-end',
  },
  opacitySlider: {
    flex: 1,
    maxWidth: 120,
    cursor: 'pointer',
    accentColor: 'var(--accent)',
  },
  opacityValue: {
    fontSize: 12,
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-ui)',
    minWidth: 34,
    textAlign: 'right',
  },
  colourLabel: {
    fontSize: 13,
    color: 'var(--text)',
    fontFamily: 'var(--font-ui)',
  },
  colourRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  colourSwatch: {
    width: 22,
    height: 22,
    borderRadius: 4,
    border: '1px solid var(--border)',
    flexShrink: 0,
  },
  colourInput: {
    width: 36,
    height: 28,
    padding: 2,
    border: '1px solid var(--border)',
    borderRadius: 4,
    cursor: 'pointer',
    background: 'none',
  },
  hexInput: {
    width: 72,
    height: 28,
    padding: '0 6px',
    border: '1px solid var(--border)',
    borderRadius: 4,
    fontSize: 12,
    fontFamily: 'var(--font-mono, monospace)',
    textTransform: 'uppercase',
    color: 'var(--text)',
    background: 'var(--surface, #fff)',
  },
}
