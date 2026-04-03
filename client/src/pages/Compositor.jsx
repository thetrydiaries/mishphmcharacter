import { useEffect, useState, useRef, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { useCompositor } from '../hooks/useCompositor'
import CompositorCanvas, { CANVAS_W, CANVAS_H } from '../components/compositor/CompositorCanvas'
import AssetPanel from '../components/compositor/AssetPanel'
import TopBar from '../components/compositor/TopBar'
import BottomBar from '../components/compositor/BottomBar'

export default function Compositor() {
  const location   = useLocation()
  const compositor = useCompositor()
  const {
    currentGuest,
    currentIndex,
    totalGuests,
    canUndo,
    canRedo,
    swapAsset,
    setColour,
    loadFromAnalysis,
    approve,
    flagRevision,
    reset,
    undo,
    redo,
    prevGuest,
    nextGuest,
  } = compositor

  // If navigated from /upload, load the AI-matched recipe into the current guest slot
  useEffect(() => {
    if (location.state?.recipe) {
      loadFromAnalysis(location.state.recipe)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Flags and photo URL survive only for this compositor session (from router state)
  const flags    = location.state?.flags    ?? []
  const photoURL = location.state?.photoURL ?? currentGuest?.photo ?? null

  const [availableAssets, setAvailableAssets] = useState(null)
  const [assetsError, setAssetsError] = useState(null)

  // Canvas scale: fit the canvas into the available vertical space
  const [canvasScale, setCanvasScale] = useState(0.5)
  const workAreaRef = useRef(null)

  const updateScale = useCallback(() => {
    if (!workAreaRef.current) return
    const { clientHeight, clientWidth } = workAreaRef.current
    // Leave some padding; asset panel takes 280px from width
    const availH = clientHeight - 24
    const availW = clientWidth - 280 - 40  // 280 panel + 40 padding
    const scale = Math.min(availH / CANVAS_H, availW / CANVAS_W, 1)
    setCanvasScale(Math.max(0.2, scale))
  }, [])

  useEffect(() => {
    // Fetch available assets from backend
    fetch('/api/assets')
      .then(r => r.json())
      .then(data => setAvailableAssets(data))
      .catch(err => setAssetsError(err.message))
  }, [])

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

          {/* Konva canvas */}
          <div style={styles.stageWrap}>
            {assetsError && (
              <div style={styles.errorBanner}>
                Could not load assets: {assetsError}
              </div>
            )}
            <div
              style={{
                width: CANVAS_W * canvasScale,
                height: CANVAS_H * canvasScale,
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
                scale={canvasScale}
              />
            </div>
          </div>
        </div>

        {/* Right: asset switcher panel */}
        <AssetPanel
          recipe={currentGuest.recipe}
          availableAssets={availableAssets ?? {}}
          onSwapAsset={swapAsset}
          onSetColour={setColour}
          flaggedCategories={flags}
        />
      </div>

      <BottomBar
        currentIndex={currentIndex}
        totalGuests={totalGuests}
        onPrev={prevGuest}
        onNext={nextGuest}
      />
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
}
