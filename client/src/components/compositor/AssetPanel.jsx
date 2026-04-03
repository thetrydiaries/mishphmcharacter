import { useState } from 'react'

const CATEGORY_META = [
  { folder: 'frames',      label: 'Card Frame',     recipeKey: 'frame' },
  { folder: 'hair_back',   label: 'Hair (back)',    recipeKey: 'hair_back' },
  { folder: 'face',        label: 'Face Shape',     recipeKey: 'face' },
  { folder: 'body',        label: 'Body',           recipeKey: 'body' },
  { folder: 'outfit',      label: 'Outfit',         recipeKey: 'outfit' },
  { folder: 'facialhair',  label: 'Facial Hair',    recipeKey: 'facialhair' },
  { folder: 'nose',        label: 'Nose',           recipeKey: 'nose' },
  { folder: 'mouth',       label: 'Mouth',          recipeKey: 'mouth' },
  { folder: 'eyes',        label: 'Eyes',           recipeKey: 'eyes' },
  { folder: 'twinkle',     label: 'Twinkle',        recipeKey: 'twinkle' },
  { folder: 'brows',       label: 'Eyebrows',       recipeKey: 'brows' },
  { folder: 'hair_front',  label: 'Bangs / front',  recipeKey: 'hair_front' },
  { folder: 'accessories', label: 'Accessories',    recipeKey: 'accessory' },
]

const COLOUR_PICKERS = [
  { key: 'hair',   label: 'Hair colour' },
  { key: 'skin',   label: 'Skin tone' },
  { key: 'outfit', label: 'Outfit colour' },
]

export default function AssetPanel({ recipe, availableAssets, onSwapAsset, onSetColour }) {
  const [openCategory, setOpenCategory] = useState('hair')

  function toggleCategory(folder) {
    setOpenCategory(prev => prev === folder ? null : folder)
  }

  return (
    <aside style={styles.panel}>
      {/* Asset categories */}
      {CATEGORY_META.map(({ folder, label, recipeKey }) => {
        const assets = availableAssets?.[folder] ?? []
        const activeAsset = recipe.assets[recipeKey]
        const isOpen = openCategory === folder

        return (
          <div key={folder} style={styles.section}>
            <button
              style={{ ...styles.sectionHeader, ...(isOpen ? styles.sectionHeaderOpen : {}) }}
              onClick={() => toggleCategory(folder)}
            >
              <span style={styles.categoryLabel}>{label}</span>
              <span style={styles.chevron}>{isOpen ? '▲' : '▼'}</span>
              {activeAsset && (
                <span style={styles.activePill}>
                  {activeAsset.split('_').slice(1).join(' ') || activeAsset}
                </span>
              )}
            </button>

            {isOpen && (
              <div style={styles.thumbGrid}>
                {assets.length === 0 ? (
                  <p style={styles.emptyNote}>No assets in /{folder}/ yet</p>
                ) : (
                  assets.map(asset => (
                    <button
                      key={asset.name}
                      title={asset.name}
                      style={{
                        ...styles.thumbBtn,
                        ...(activeAsset === asset.name ? styles.thumbBtnActive : {}),
                      }}
                      onClick={() => onSwapAsset(recipeKey, asset.name)}
                    >
                      <img
                        src={asset.url}
                        alt={asset.name}
                        style={styles.thumbImg}
                        loading="lazy"
                      />
                      <span style={styles.thumbName}>
                        {asset.name.replace(/_/g, ' ')}
                      </span>
                    </button>
                  ))
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
          {COLOUR_PICKERS.map(({ key, label }) => (
            <div key={key} style={styles.colourRow}>
              <label style={styles.colourLabel}>{label}</label>
              <div style={styles.colourRight}>
                <div
                  style={{
                    ...styles.colourSwatch,
                    background: recipe.colours[key] ?? '#888888',
                  }}
                />
                <input
                  type="color"
                  value={recipe.colours[key] ?? '#888888'}
                  onChange={e => onSetColour(key, e.target.value)}
                  style={styles.colourInput}
                  title={`Pick ${label}`}
                />
              </div>
            </div>
          ))}
        </div>
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
    borderColor: 'var(--accent)',
    boxShadow: '0 0 0 1px var(--accent)',
  },
  thumbImg: {
    width: 60,
    height: 84,
    objectFit: 'contain',
    background: '#F5F2EE',
    borderRadius: 3,
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
}
