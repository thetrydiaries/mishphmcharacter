import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCompositor } from '../context/CompositorProvider'

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
  const { addGuests, totalGuests } = useCompositor()
  const fileInputRef = useRef(null)

  const [dragging, setDragging] = useState(false)
  const [status, setStatus]     = useState('idle')  // idle | processing | done | error
  const [done, setDone]         = useState(0)
  const [total, setTotal]       = useState(0)
  const [currentName, setCurrentName] = useState(null)
  const [failures, setFailures] = useState([])

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

    if (newGuests.length) {
      // Give the state a tick to persist, then head to the review hub
      setStatus('done')
      setTimeout(() => navigate('/review'), failed.length ? 1400 : 500)
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
}
