import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCompositor } from '../context/compositorContext'
import CompositorCanvas from '../components/compositor/CompositorCanvas'
import AssetPanel from '../components/compositor/AssetPanel'
import TopBar from '../components/compositor/TopBar'
import BottomBar from '../components/compositor/BottomBar'
import { DEFAULT_CHARM_SIZES, charmGeometry } from '../data/charmSizes'

export default function Compositor() {
  const navigate   = useNavigate()
  const {
    order,
    setOrder,
    currentGuest,
    currentIndex,
    totalGuests,
    canUndo,
    canRedo,
    swapAsset,
    setColour,
    setOpacity,
    approve,
    flagRevision,
    reset,
    undo,
    redo,
    prevGuest,
    nextGuest,
  } = useCompositor()

  // Order-level: one style + one charm size for the whole wedding
  const style = order.styleId
  const size  = DEFAULT_CHARM_SIZES.find(s => s.id === order.charmSizeId) ?? DEFAULT_CHARM_SIZES[0]

  // Reference photo + AI flags come from the current guest in the batch
  const photoURL         = currentGuest?.photo ?? null
  const flags            = currentGuest?.flags ?? []
  const detectedFeatures = null

  const [debugOpen, setDebugOpen] = useState(false)

  const [availableAssets, setAvailableAssets] = useState(null)
  const [assetsError, setAssetsError] = useState(null)
  const [availableStyles, setAvailableStyles] = useState([])
  const [assetsVersion, setAssetsVersion] = useState(0)   // bump to refetch after a bg upload/delete
  const bgInputRef = useRef(null)

  const backgrounds   = availableAssets?.backgrounds ?? []
  const backgroundUrl = backgrounds.find(b => b.name === order.backgroundId)?.url ?? null

  // Stable (effect dep) — surface a background that fails to load instead of silent plain fill
  const handleBgError = useCallback(() => setAssetsError('Background image failed to load — showing a plain backdrop.'), [])

  // ── Mockup view state (not persisted — per-session view only) ────────────────
  const [anchor, setAnchor]       = useState({ scaleMult: 1, offsetYFrac: 0 })
  const [showGuides, setShowGuides] = useState(true)

  const geometry = useMemo(() => charmGeometry(size), [size])

  // Keyboard shortcuts (compositor page only): ←/→ nav, A approve, R revision, undo/redo
  useEffect(() => {
    function onKeyDown(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.key === 'ArrowLeft')  { e.preventDefault(); prevGuest() }
      if (e.key === 'ArrowRight') { e.preventDefault(); nextGuest() }
      if (e.key === 'a' || e.key === 'A') approve()
      if (e.key === 'r' || e.key === 'R') flagRevision()
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [prevGuest, nextGuest, approve, flagRevision, undo, redo])

  // Canvas scale: fit the charm canvas into the available space
  const [canvasScale, setCanvasScale] = useState(0.5)
  const workAreaRef = useRef(null)
  const stageRef    = useRef(null)

  const exportPNG = useCallback(() => {
    const stage = stageRef.current
    if (!stage) return
    // Hide mockup guides, crop to the trim box, render at the charm's true dpi.
    const guides = stage.find('.guide')
    guides.forEach(n => n.hide())
    const { bleedPx, trimW, trimH } = geometry
    const dataURL = stage.toDataURL({
      x:          bleedPx * canvasScale,
      y:          bleedPx * canvasScale,
      width:      trimW   * canvasScale,
      height:     trimH   * canvasScale,
      pixelRatio: 1 / canvasScale,   // upscale display px back to full resolution
    })
    guides.forEach(n => n.show())
    const slug = (currentGuest?.name ?? 'guest').toLowerCase().replace(/\s+/g, '-')
    const a    = document.createElement('a')
    a.href     = dataURL
    a.download = `${slug}_${size.id}.png`
    a.click()
  }, [currentGuest?.name, geometry, canvasScale, size.id])

  const updateScale = useCallback(() => {
    if (!workAreaRef.current) return
    const { clientHeight, clientWidth } = workAreaRef.current
    // Leave some padding; asset panel takes 280px, photo column ~180px
    const availH = clientHeight - 80
    const availW = clientWidth - 280 - 180 - 60
    const scale = Math.min(availH / geometry.fullH, availW / geometry.fullW, 1)
    setCanvasScale(Math.max(0.15, scale))
  }, [geometry])

  useEffect(() => {
    // Fetch the list of art styles once
    fetch('/api/styles')
      .then(r => r.json())
      .then(data => setAvailableStyles(data.styles ?? []))
      .catch(() => setAvailableStyles([]))
  }, [])

  useEffect(() => {
    // Fetch assets for the current style; refetch when style changes or a bg is added/removed
    let cancelled = false
    fetch(`/api/assets?style=${encodeURIComponent(style)}`)
      .then(r => r.json())
      .then(data => { if (!cancelled) setAvailableAssets(data) })
      .catch(err => { if (!cancelled) setAssetsError(err.message) })
    return () => { cancelled = true }
  }, [style, assetsVersion])

  async function uploadBackground(file) {
    if (!file) return
    const fd = new FormData()
    fd.append('background', file)
    try {
      const res = await fetch('/api/backgrounds', { method: 'POST', body: fd })
      if (!res.ok) throw new Error((await res.json())?.error || 'Upload failed')
      const bg = await res.json()
      setAssetsVersion(v => v + 1)      // refetch so the new bg appears
      setOrder({ backgroundId: bg.name }) // select it
    } catch (err) {
      setAssetsError(err.message)
    }
  }

  async function removeBackground(name) {
    if (!window.confirm('Delete this background from the library?')) return
    try {
      const res = await fetch(`/api/backgrounds/${encodeURIComponent(name)}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || `Delete failed (${res.status})`)
      if (order.backgroundId === name) setOrder({ backgroundId: null })
      setAssetsVersion(v => v + 1)
    } catch (err) {
      setAssetsError(`Couldn’t delete background: ${err.message}`)
    }
  }

  useEffect(() => {
    if (!workAreaRef.current) return
    updateScale()
    const ro = new ResizeObserver(updateScale)
    ro.observe(workAreaRef.current)
    return () => ro.disconnect()
  }, [updateScale])

  if (!currentGuest) return <div style={styles.loading}>Loading…</div>

  return (
    <div style={styles.root}>
      <TopBar
        guest={currentGuest}
        canUndo={canUndo}
        canRedo={canRedo}
        onApprove={approve}
        onFlagRevision={flagRevision}
        onReset={reset}
        onUndo={undo}
        onRedo={redo}
        onExport={exportPNG}
      />

      {/* Main work area */}
      <div ref={workAreaRef} style={styles.workArea}>
        {/* Left: photo + canvas */}
        <div style={styles.canvasCol}>
          {/* Guest photo */}
          <div style={styles.photoPane}>
            {photoURL ? (
              <img
                src={photoURL}
                alt={`Photo of ${currentGuest.name}`}
                style={styles.photo}
              />
            ) : (
              <div style={styles.photoPlaceholder}>
                <span style={styles.photoIcon}>📷</span>
                <span style={styles.photoHint}>No photo uploaded</span>
              </div>
            )}
          </div>

          {/* Konva canvas + charm controls */}
          <div style={styles.stageWrap}>
            {assetsError && (
              <div style={styles.errorBanner}>
                Could not load assets: {assetsError}
              </div>
            )}

            {/* Charm size + mockup controls */}
            <div style={styles.charmControls}>
              {availableStyles.length > 1 && (
                <div style={styles.controlRow}>
                  <label style={styles.controlLabel}>Style</label>
                  <select
                    value={style}
                    onChange={e => setOrder({ styleId: e.target.value })}
                    style={styles.select}
                  >
                    {availableStyles.map(s => (
                      <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                    ))}
                  </select>
                  {!availableAssets && <span style={styles.dim}>loading…</span>}
                </div>
              )}
              <div style={styles.controlRow}>
                <label style={styles.controlLabel}>Charm</label>
                <select
                  value={order.charmSizeId}
                  onChange={e => setOrder({ charmSizeId: e.target.value })}
                  style={styles.select}
                >
                  {DEFAULT_CHARM_SIZES.map(s => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
                <span style={styles.dim}>{size.widthMM}×{size.heightMM}mm · {size.dpi}dpi</span>
              </div>

              <div style={styles.controlRow}>
                <label style={styles.controlLabel}>Backdrop</label>
                <select
                  value={order.backgroundId ?? ''}
                  onChange={e => setOrder({ backgroundId: e.target.value || null })}
                  style={styles.select}
                >
                  <option value="">None (plain)</option>
                  {backgrounds.map(b => (
                    <option key={b.name} value={b.name}>{b.name.replace(/^bg_/, '').replace(/_/g, ' ')}</option>
                  ))}
                </select>
                <button style={styles.smallBtn} onClick={() => bgInputRef.current?.click()}>Upload</button>
                {order.backgroundId && (
                  <button style={styles.smallBtn} onClick={() => removeBackground(order.backgroundId)} title="Delete from library">✕</button>
                )}
                <input ref={bgInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => { uploadBackground(e.target.files?.[0]); e.target.value = '' }} />
              </div>

              <div style={styles.controlRow}>
                <label style={styles.controlLabel}>Zoom</label>
                <input type="range" min="0.6" max="2" step="0.02"
                  value={anchor.scaleMult}
                  onChange={e => setAnchor(a => ({ ...a, scaleMult: Number(e.target.value) }))}
                  style={styles.slider} />
                <label style={styles.controlLabel}>Vert</label>
                <input type="range" min="-0.4" max="0.4" step="0.01"
                  value={anchor.offsetYFrac}
                  onChange={e => setAnchor(a => ({ ...a, offsetYFrac: Number(e.target.value) }))}
                  style={styles.slider} />
                <label style={styles.toggleLabel}>
                  <input type="checkbox" checked={showGuides}
                    onChange={e => setShowGuides(e.target.checked)} />
                  Guides
                </label>
              </div>
            </div>

            <div
              style={{
                width: geometry.fullW * canvasScale,
                height: geometry.fullH * canvasScale,
                boxShadow: '0 4px 20px rgba(44,44,44,0.15)',
                borderRadius: 4,
                overflow: 'hidden',
                flexShrink: 0,
                background: '#FAF8F5',
              }}
            >
              <CompositorCanvas
                recipe={currentGuest.recipe}
                availableAssets={availableAssets ?? {}}
                geometry={geometry}
                displayScale={canvasScale}
                anchor={anchor}
                showGuides={showGuides}
                backgroundUrl={backgroundUrl}
                onBackgroundError={handleBgError}
                stageRef={stageRef}
              />
            </div>
            {showGuides && (
              <div style={styles.guideLegend}>
                <span style={{ color: '#C97070' }}>— bleed</span>
                <span style={{ color: '#2C2C2C' }}>— cut line</span>
                <span style={{ color: '#7BAE7F' }}>— safe zone</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: asset switcher panel */}
        <AssetPanel
          recipe={currentGuest.recipe}
          availableAssets={availableAssets ?? {}}
          onSwapAsset={swapAsset}
          onSetColour={setColour}
          onSetOpacity={setOpacity}
          flaggedCategories={flags}
        />
      </div>

      <BottomBar
        currentIndex={currentIndex}
        totalGuests={totalGuests}
        onPrev={prevGuest}
        onNext={nextGuest}
        onBackToReview={() => navigate('/review')}
      />

      {/* ── DEBUG PANEL (temporary) ───────────────────────────────────────────── */}
      {detectedFeatures && (
        <>
          {/* Toggle button */}
          <button style={styles.debugToggle} onClick={() => setDebugOpen(o => !o)}>
            {debugOpen ? 'Hide' : 'Debug'} AI response
          </button>

          {/* Drawer */}
          {debugOpen && (
            <div style={styles.debugDrawer}>
              <div style={styles.debugCol}>
                <p style={styles.debugHeading}>Claude detected features</p>
                <pre style={styles.debugPre}>
                  {JSON.stringify(detectedFeatures, null, 2)}
                </pre>
              </div>
              <div style={styles.debugDivider} />
              <div style={styles.debugCol}>
                <p style={styles.debugHeading}>Current recipe</p>
                <pre style={styles.debugPre}>
                  {JSON.stringify(currentGuest.recipe, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

const styles = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100svh',
    overflow: 'hidden',
    background: 'var(--bg)',
  },
  workArea: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
    minHeight: 0,
  },
  canvasCol: {
    flex: 1,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 20,
    padding: 20,
    overflow: 'auto',
    minWidth: 0,
  },
  photoPane: {
    width: 160,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    paddingTop: 4,
  },
  photo: {
    width: 160,
    height: 200,
    objectFit: 'cover',
    borderRadius: 8,
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow-sm)',
    display: 'block',
  },
  photoPlaceholder: {
    width: 160,
    height: 200,
    borderRadius: 8,
    border: '2px dashed var(--border)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    color: 'var(--text-muted)',
    background: 'var(--surface-raised)',
  },
  photoIcon: {
    fontSize: 28,
    filter: 'grayscale(1)',
    opacity: 0.4,
  },
  photoHint: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 1.3,
    padding: '0 8px',
    color: 'var(--text-muted)',
  },
  stageWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  },
  charmControls: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: '10px 14px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    minWidth: 360,
  },
  controlRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  controlLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    minWidth: 34,
  },
  select: {
    fontFamily: 'var(--font-ui)',
    fontSize: 13,
    padding: '5px 8px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--surface-raised)',
    color: 'var(--text)',
  },
  dim: {
    fontSize: 11,
    color: 'var(--text-muted)',
    marginLeft: 'auto',
  },
  slider: {
    flex: 1,
    accentColor: 'var(--accent-dark)',
  },
  smallBtn: {
    fontFamily: 'var(--font-ui)',
    fontSize: 12,
    fontWeight: 500,
    padding: '5px 10px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--surface-raised)',
    color: 'var(--text)',
    cursor: 'pointer',
  },
  toggleLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 12,
    color: 'var(--text)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  guideLegend: {
    display: 'flex',
    gap: 14,
    fontSize: 11,
    fontWeight: 600,
  },
  errorBanner: {
    padding: '8px 14px',
    background: 'var(--red-bg)',
    color: 'var(--red)',
    borderRadius: 6,
    fontSize: 12,
    border: '1px solid var(--red)',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100svh',
    fontFamily: 'var(--font-ui)',
    color: 'var(--text-muted)',
  },
  debugToggle: {
    position: 'fixed',
    bottom: 48,
    right: 16,
    zIndex: 100,
    padding: '5px 12px',
    fontSize: 11,
    fontFamily: 'var(--font-ui)',
    background: '#1A1A2E',
    color: '#A0C4FF',
    border: '1px solid #3A3A6E',
    borderRadius: 6,
    cursor: 'pointer',
    opacity: 0.85,
  },
  debugDrawer: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    height: '42vh',
    zIndex: 99,
    background: '#0F0F1A',
    borderTop: '2px solid #3A3A6E',
    display: 'flex',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  debugCol: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    padding: '10px 14px',
  },
  debugHeading: {
    margin: '0 0 6px 0',
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: '#6A8FBF',
    fontFamily: 'var(--font-ui)',
    flexShrink: 0,
  },
  debugPre: {
    flex: 1,
    margin: 0,
    overflow: 'auto',
    fontSize: 11.5,
    lineHeight: 1.6,
    color: '#C8D8F0',
    fontFamily: 'ui-monospace, "Cascadia Code", "Fira Code", monospace',
    whiteSpace: 'pre',
  },
  debugDivider: {
    width: 1,
    background: '#3A3A6E',
    flexShrink: 0,
  },
}
