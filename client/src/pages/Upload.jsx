import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCompositor } from '../context/compositorContext'

const ACCEPTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.heic', '.heif']

function isValidFile(file) {
  const ext = '.' + file.name.split('.').pop().toLowerCase()
  return ACCEPTED_EXTENSIONS.includes(ext) || file.type.startsWith('image/')
}

// Sarah_Jones.jpg → "Sarah Jones"
function nameFromFilename(filename) {
  const base = filename.replace(/\.[^.]+$/, '')
  return base
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase()) || 'Guest'
}

async function analysePhoto(file) {
  const formData = new FormData()
  formData.append('photo', file)
  // Append ?mock=true if the page URL has it — lets you test the batch pipeline
  // end-to-end without spending Claude API calls.
  const mock = new URLSearchParams(window.location.search).get('mock') === 'true'
  const res = await fetch(`/api/analyse${mock ? '?mock=true' : ''}`, { method: 'POST', body: formData })
  if (!res.ok) {
    let msg = `Server error ${res.status}`
    try { msg = (await res.json())?.error || msg } catch { /* keep default */ }
    throw new Error(msg)
  }
  return res.json()
}

export default function Upload() {
  const navigate = useNavigate()
  const { addGuests, totalGuests, order, setOrder } = useCompositor()
  const fileInputRef = useRef(null)

  const [dragging, setDragging] = useState(false)
  const [status, setStatus]     = useState('idle')  // idle | processing | done | error
  const [done, setDone]         = useState(0)
  const [total, setTotal]       = useState(0)
  const [currentName, setCurrentName] = useState(null)
  const [failures, setFailures] = useState([])

  // Order-level look, chosen up front so the whole batch inherits it (no per-guest fiddling
  // later). Note: these are render settings — they do NOT affect the Claude analysis or its
  // cost; the same asset recipe comes back regardless of style/backdrop.
  const [availableStyles, setAvailableStyles] = useState([])
  const [backgrounds, setBackgrounds] = useState([])

  useEffect(() => {
    fetch('/api/styles')
      .then(r => r.json())
      .then(data => setAvailableStyles(data.styles ?? []))
      .catch(() => setAvailableStyles([]))
  }, [])

  // Backgrounds live in the current style's asset payload; refetch when the style changes.
  useEffect(() => {
    let cancelled = false
    fetch(`/api/assets?style=${encodeURIComponent(order.styleId)}`)
      .then(r => r.json())
      .then(data => { if (!cancelled) setBackgrounds(data?.backgrounds ?? []) })
      .catch(() => { if (!cancelled) setBackgrounds([]) })
    return () => { cancelled = true }
  }, [order.styleId])

  const processFiles = useCallback(async (fileList) => {
    const files = Array.from(fileList).filter(isValidFile)
    if (!files.length) {
      setFailures([{ name: '—', error: 'No supported image files (JPEG, PNG, HEIC).' }])
      setStatus('error')
      return
    }

    setStatus('processing')
    setTotal(files.length)
    setDone(0)
    setFailures([])

    const newGuests = []
    const failed = []

    // Sequential — avoids hammering the Claude API and keeps progress readable
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      setCurrentName(file.name)
      try {
        const result = await analysePhoto(file)
        newGuests.push({
          name: nameFromFilename(file.name),
          status: 'pending',
          photo: result.thumbnail ?? null,
          recipe: result.recipe,
          aiRecipe: result.recipe,
          flags: result.flags ?? [],
        })
      } catch (err) {
        failed.push({ name: file.name, error: err.message })
      }
      setDone(i + 1)
    }

    if (newGuests.length) addGuests(newGuests)
    setFailures(failed)

    if (newGuests.length && !failed.length) {
      // Clean run — head straight to the review hub
      setStatus('done')
      setTimeout(() => navigate('/review'), 500)
    } else if (newGuests.length) {
      // Some succeeded, some failed — stay put so the failed list is readable
      // and recoverable; the operator continues manually.
      setStatus('partial')
    } else {
      setStatus('error')
    }
  }, [addGuests, navigate])

  function onDrop(e) {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files?.length) processFiles(e.dataTransfer.files)
  }

  function onFileInput(e) {
    if (e.target.files?.length) processFiles(e.target.files)
    e.target.value = ''
  }

  const isIdle = status === 'idle' || status === 'error'
  const pct = total ? Math.round((done / total) * 100) : 0

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.heading}>Upload guest photos</h1>
        <p style={styles.sub}>
          Drop a batch of photos — Claude analyses each and builds a character. Name files after
          guests (e.g. <code style={styles.code}>sarah_jones.jpg</code>) to auto-fill names.
          {totalGuests > 0 && <> You have <strong>{totalGuests}</strong> guest{totalGuests === 1 ? '' : 's'} so far — new uploads are added to them.</>}
        </p>

        <div style={styles.settings}>
          <p style={styles.settingsHint}>Look for the whole order — applies to every guest, including any already added.</p>
          {availableStyles.length > 1 && (
            <label style={styles.settingRow}>
              <span style={styles.settingLabel}>Style</span>
              <select
                value={order.styleId}
                onChange={e => setOrder({ styleId: e.target.value })}
                disabled={!isIdle}
                style={styles.settingSelect}
              >
                {availableStyles.map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </label>
          )}
          <label style={styles.settingRow}>
            <span style={styles.settingLabel}>Backdrop</span>
            <select
              value={order.backgroundId ?? ''}
              onChange={e => setOrder({ backgroundId: e.target.value || null })}
              disabled={!isIdle}
              style={styles.settingSelect}
            >
              <option value="">None (plain)</option>
              {backgrounds.map(b => (
                <option key={b.name} value={b.name}>{b.name.replace(/^bg_/, '').replace(/_/g, ' ')}</option>
              ))}
            </select>
          </label>
        </div>

        <div
          style={{
            ...styles.dropZone,
            ...(dragging ? styles.dropZoneActive : {}),
            ...(status === 'error' ? styles.dropZoneError : {}),
            cursor: isIdle ? 'pointer' : 'default',
          }}
          onDragOver={e => { e.preventDefault(); if (isIdle) setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => isIdle && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.heic,.heif"
            style={{ display: 'none' }}
            onChange={onFileInput}
          />

          {isIdle && (
            <>
              <span style={styles.uploadIcon}>↑</span>
              <p style={styles.dropText}>Drop photos here or <span style={styles.browseLink}>browse</span></p>
              <p style={styles.hint}>JPEG · PNG · HEIC · select many at once</p>
            </>
          )}

          {status === 'processing' && (
            <>
              <p style={styles.dropText}>Analysing {done} of {total}…</p>
              <div style={styles.progressTrack}>
                <div style={{ ...styles.progressFill, width: `${pct}%` }} />
              </div>
              <p style={styles.hint}>{currentName}</p>
            </>
          )}

          {status === 'done' && (
            <>
              <span style={styles.doneIcon}>✓</span>
              <p style={styles.dropText}>Done — {done - failures.length} added</p>
              <p style={styles.hint}>Opening review…</p>
            </>
          )}

          {status === 'partial' && (
            <>
              <span style={styles.doneIcon}>✓</span>
              <p style={styles.dropText}>{done - failures.length} added · {failures.length} failed</p>
              <p style={styles.hint}>Review the failed photos below — nothing was lost, you can re-add them</p>
            </>
          )}
        </div>

        {failures.length > 0 && (
          <div style={styles.failBox}>
            <p style={styles.failHeading}>{failures.length} photo{failures.length === 1 ? '' : 's'} failed:</p>
            {failures.slice(0, 6).map((f, i) => (
              <p key={i} style={styles.failRow}><strong>{f.name}</strong> — {f.error}</p>
            ))}
            {failures.length > 6 && <p style={styles.failRow}>…and {failures.length - 6} more</p>}
          </div>
        )}

        {status === 'partial' && (
          <div style={styles.partialActions}>
            <button style={styles.reviewLink} onClick={() => navigate('/review')}>
              Continue to review ({totalGuests}) →
            </button>
            <button style={styles.secondaryBtn} onClick={() => { setStatus('idle'); setFailures([]) }}>
              Upload more
            </button>
          </div>
        )}

        {totalGuests > 0 && isIdle && (
          <button style={styles.reviewLink} onClick={() => navigate('/review')}>
            Go to review ({totalGuests}) →
          </button>
        )}
      </div>
    </div>
  )
}

const styles = {
  page: { minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 24 },
  card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '40px 48px', width: '100%', maxWidth: 520, boxShadow: 'var(--shadow-md)' },
  heading: { fontFamily: 'var(--font-heading)', fontSize: 24, marginBottom: 8 },
  sub: { color: 'var(--text-muted)', fontSize: 13, marginBottom: 24, lineHeight: 1.6 },
  code: { fontFamily: 'ui-monospace, monospace', fontSize: 12, background: 'var(--surface-raised)', padding: '1px 5px', borderRadius: 4 },
  settings: { marginBottom: 18, padding: '14px 16px', background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 10 },
  settingsHint: { fontSize: 12, color: 'var(--text-muted)', margin: 0 },
  settingRow: { display: 'flex', alignItems: 'center', gap: 10 },
  settingLabel: { fontSize: 13, fontWeight: 500, color: 'var(--text)', width: 70, flexShrink: 0 },
  settingSelect: { flex: 1, padding: '7px 9px', fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--text)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' },
  dropZone: { border: '2px dashed var(--border)', borderRadius: 10, padding: '52px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, background: 'var(--surface-raised)', transition: 'border-color 0.15s, background 0.15s', userSelect: 'none' },
  dropZoneActive: { borderColor: 'var(--accent)', background: 'var(--accent-bg)' },
  dropZoneError: { borderColor: 'var(--red)', background: 'var(--red-bg)' },
  uploadIcon: { fontSize: 36, lineHeight: 1, color: 'var(--text-muted)', marginBottom: 2 },
  doneIcon: { fontSize: 34, lineHeight: 1, color: 'var(--green)' },
  dropText: { fontSize: 14, color: 'var(--text)', textAlign: 'center', margin: 0 },
  browseLink: { color: 'var(--accent-dark)', textDecoration: 'underline' },
  hint: { fontSize: 12, color: 'var(--text-muted)', margin: 0, textAlign: 'center', wordBreak: 'break-all' },
  progressTrack: { width: '100%', maxWidth: 320, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', background: 'var(--accent)', borderRadius: 3, transition: 'width 0.25s ease' },
  failBox: { marginTop: 18, padding: '12px 14px', background: 'var(--red-bg)', border: '1px solid var(--red)', borderRadius: 8 },
  failHeading: { fontSize: 12, fontWeight: 600, color: 'var(--red)', margin: '0 0 6px' },
  failRow: { fontSize: 12, color: 'var(--text)', margin: '2px 0', lineHeight: 1.4 },
  reviewLink: { marginTop: 20, width: '100%', padding: '10px', fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 600, color: 'var(--accent-dark)', background: 'var(--accent-bg)', border: '1px solid var(--accent)', borderRadius: 8, cursor: 'pointer' },
  partialActions: { display: 'flex', flexDirection: 'column', gap: 8 },
  secondaryBtn: { width: '100%', padding: '9px', fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 500, color: 'var(--text-muted)', background: 'none', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer' },
}
