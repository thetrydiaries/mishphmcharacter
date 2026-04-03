import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

const ACCEPTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.heic', '.heif']

function isValidFile(file) {
  const ext = '.' + file.name.split('.').pop().toLowerCase()
  return (
    ACCEPTED_EXTENSIONS.includes(ext) ||
    file.type.startsWith('image/')
  )
}

export default function Upload() {
  const navigate     = useNavigate()
  const fileInputRef = useRef(null)

  const [dragging,  setDragging]  = useState(false)
  const [status,    setStatus]    = useState('idle')   // idle | uploading | error
  const [error,     setError]     = useState(null)
  const [fileName,  setFileName]  = useState(null)
  const [progress,  setProgress]  = useState(0)

  const processFile = useCallback(async (file) => {
    if (!isValidFile(file)) {
      setError('Unsupported file type. Please upload a JPEG, PNG, or HEIC photo.')
      setStatus('error')
      return
    }

    setFileName(file.name)
    setError(null)
    setStatus('uploading')
    setProgress(0)

    try {
      const formData = new FormData()
      formData.append('photo', file)

      // XHR so we can report upload progress
      const result = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', '/api/analyse')

        xhr.upload.addEventListener('progress', e => {
          if (e.lengthComputable) {
            // Upload counts as 0–80%; Claude analysis counts as the last 20%
            setProgress(Math.round((e.loaded / e.total) * 80))
          }
        })

        xhr.addEventListener('load', () => {
          setProgress(100)
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolve(JSON.parse(xhr.responseText))
            } catch {
              reject(new Error('Invalid response from server'))
            }
          } else {
            const msg = (() => {
              try { return JSON.parse(xhr.responseText)?.error }
              catch { return null }
            })()
            reject(new Error(msg || `Server error ${xhr.status}`))
          }
        })

        xhr.addEventListener('error', () => reject(new Error('Network error — is the server running?')))
        xhr.send(formData)
      })

      // Pass recipe, flags, and a local blob URL for the photo to the compositor
      const photoURL = URL.createObjectURL(file)
      navigate('/compositor', {
        state: { recipe: result.recipe, flags: result.flags, photoURL },
      })
    } catch (err) {
      setError(err.message)
      setStatus('error')
    }
  }, [navigate])

  function onDrop(e) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  function onFileInput(e) {
    const file = e.target.files[0]
    if (file) processFile(file)
    // Reset so the same file can be re-selected after an error
    e.target.value = ''
  }

  const isIdle = status === 'idle' || status === 'error'

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.heading}>Upload guest photo</h1>
        <p style={styles.sub}>
          JPEG, PNG, or HEIC — Claude will analyse the photo and pre-load the compositor
        </p>

        <div
          style={{
            ...styles.dropZone,
            ...(dragging      ? styles.dropZoneActive : {}),
            ...(status === 'error' ? styles.dropZoneError  : {}),
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
            accept=".jpg,.jpeg,.png,.heic,.heif"
            style={{ display: 'none' }}
            onChange={onFileInput}
          />

          {status === 'idle' && (
            <>
              <span style={styles.uploadIcon}>↑</span>
              <p style={styles.dropText}>
                Drop photo here or <span style={styles.browseLink}>browse</span>
              </p>
              <p style={styles.hint}>JPEG · PNG · HEIC &nbsp;·&nbsp; one photo per guest</p>
            </>
          )}

          {status === 'uploading' && (
            <>
              <p style={styles.dropText}>{fileName}</p>
              <div style={styles.progressTrack}>
                <div style={{ ...styles.progressFill, width: `${progress}%` }} />
              </div>
              <p style={styles.hint}>
                {progress < 80 ? `Uploading… ${progress}%` : 'Analysing with Claude…'}
              </p>
            </>
          )}

          {status === 'error' && (
            <>
              <span style={styles.errorIcon}>!</span>
              <p style={styles.errorText}>{error}</p>
              <p style={styles.hint}>Click or drop to try again</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100svh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg)',
    padding: 24,
  },
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: '40px 48px',
    width: '100%',
    maxWidth: 480,
    boxShadow: 'var(--shadow-md)',
  },
  heading: {
    fontFamily: 'var(--font-heading)',
    fontSize: 24,
    marginBottom: 8,
  },
  sub: {
    color: 'var(--text-muted)',
    fontSize: 13,
    marginBottom: 28,
    lineHeight: 1.5,
  },
  dropZone: {
    border: '2px dashed var(--border)',
    borderRadius: 10,
    padding: '52px 28px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
    background: 'var(--surface-raised)',
    transition: 'border-color 0.15s, background 0.15s',
    userSelect: 'none',
  },
  dropZoneActive: {
    borderColor: 'var(--accent)',
    background: 'var(--accent-bg)',
  },
  dropZoneError: {
    borderColor: 'var(--red)',
    background: 'var(--red-bg)',
  },
  uploadIcon: {
    fontSize: 36,
    lineHeight: 1,
    color: 'var(--text-muted)',
    marginBottom: 2,
    display: 'block',
  },
  dropText: {
    fontSize: 14,
    color: 'var(--text)',
    textAlign: 'center',
    margin: 0,
  },
  browseLink: {
    color: 'var(--accent-dark)',
    textDecoration: 'underline',
  },
  hint: {
    fontSize: 12,
    color: 'var(--text-muted)',
    margin: 0,
    textAlign: 'center',
  },
  progressTrack: {
    width: '100%',
    maxWidth: 300,
    height: 6,
    background: 'var(--border)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: 'var(--accent)',
    borderRadius: 3,
    transition: 'width 0.25s ease',
  },
  errorIcon: {
    fontSize: 30,
    fontWeight: 700,
    color: 'var(--red)',
    lineHeight: 1,
    display: 'block',
  },
  errorText: {
    fontSize: 13,
    color: 'var(--red)',
    textAlign: 'center',
    margin: 0,
    maxWidth: 320,
  },
}
