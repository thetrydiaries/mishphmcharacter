import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCompositor } from '../context/compositorContext'
import MiniCard from '../components/compositor/MiniCard'
import { DEFAULT_CHARM_SIZES } from '../data/charmSizes'
import { exportApprovedZip, exportContactSheet } from '../lib/batchExport'
import { saveProjectFile, readProjectFile } from '../lib/projectFile'

const STATUS_LABEL = { pending: 'Pending', approved: 'Approved', needs_revision: 'Needs revision' }
const FILTERS = ['all', 'pending', 'approved', 'needs_revision']

export default function Review() {
  const navigate = useNavigate()
  const {
    order, guests, totalGuests, approvedCount,
    setCurrent, setStatusById, setName, removeGuest, setOrder,
    loadProject, newProject, saveError, externalChange, dismissExternalChange,
  } = useCompositor()

  const [availableAssets, setAvailableAssets] = useState(null)
  const [availableStyles, setAvailableStyles] = useState([])
  const [filter, setFilter] = useState('all')
  const [busy, setBusy] = useState(null)          // export status text
  const loadFileRef = useRef(null)

  const size = DEFAULT_CHARM_SIZES.find(s => s.id === order.charmSizeId) ?? DEFAULT_CHARM_SIZES[0]
  const backgroundUrl = (availableAssets?.backgrounds ?? []).find(b => b.name === order.backgroundId)?.url ?? null

  useEffect(() => {
    fetch('/api/styles').then(r => r.json()).then(d => setAvailableStyles(d.styles ?? [])).catch(() => {})
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch(`/api/assets?style=${encodeURIComponent(order.styleId)}`)
      .then(r => r.json())
      .then(data => { if (!cancelled) setAvailableAssets(data) })
      .catch(() => { if (!cancelled) setAvailableAssets({}) })
    return () => { cancelled = true }
  }, [order.styleId])

  const shown = guests.filter(g => filter === 'all' || g.status === filter)
  const isEmpty = totalGuests === 0 || (totalGuests === 1 && guests[0].aiRecipe === null)

  function openGuest(id) {
    const idx = guests.findIndex(g => g.id === id)
    if (idx >= 0) { setCurrent(idx); navigate('/compositor') }
  }

  function approveAllVisible() {
    shown.filter(g => g.status !== 'approved').forEach(g => setStatusById(g.id, 'approved'))
  }

  async function handleExportZip() {
    if (!availableAssets) return
    setBusy('Rendering approved cards…')
    try {
      const { count } = await exportApprovedZip(guests, availableAssets, size, (d, t) => setBusy(`Rendering ${d}/${t}…`), backgroundUrl)
      setBusy(count ? `Exported ${count} card${count === 1 ? '' : 's'} (ZIP)` : 'No approved cards to export')
    } catch (e) { setBusy('Export failed: ' + e.message) }
    setTimeout(() => setBusy(null), 2500)
  }

  async function handleContactSheet() {
    if (!availableAssets) return
    setBusy('Building contact PDF…')
    try {
      const { count, pages } = await exportContactSheet(guests, availableAssets, size, { scope: 'all', backgroundUrl })
      setBusy(count ? `Contact PDF: ${count} guests, ${pages} page${pages === 1 ? '' : 's'}` : 'No guests to export')
    } catch (e) { setBusy('Export failed: ' + e.message) }
    setTimeout(() => setBusy(null), 2500)
  }

  async function handleLoadFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const project = await readProjectFile(file)
      loadProject(project)
      setBusy(`Loaded ${project.guests.length} guests`)
      setTimeout(() => setBusy(null), 2000)
    } catch (err) { setBusy(err.message); setTimeout(() => setBusy(null), 3000) }
  }

  function startNewWedding() {
    if (window.confirm('Start a new wedding? This clears the current batch from this browser. Save a project backup first if you need it.')) {
      newProject()
      setFilter('all')
    }
  }

  return (
    <div style={styles.page}>
      {saveError && (
        <div style={styles.saveErrorBar}>
          ⚠ Couldn’t save to this browser (storage full or blocked). Recent changes live only in this tab —
          click <strong>Save project</strong> to download a backup now.
        </div>
      )}
      {externalChange && (
        <div style={styles.externalBar}>
          This batch was changed in another tab.{' '}
          <button style={styles.inlineBtn} onClick={() => window.location.reload()}>Reload</button> to see the latest, or{' '}
          <button style={styles.inlineBtn} onClick={dismissExternalChange}>dismiss</button>.
        </div>
      )}

      {/* Header */}
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Review</h1>
          <p style={styles.subtitle}>
            {isEmpty ? 'No guests yet' : <><strong>{approvedCount}</strong> of <strong>{totalGuests}</strong> approved</>}
          </p>
        </div>
        <div style={styles.orderControls}>
          <label style={styles.ctlLabel}>Style</label>
          <select value={order.styleId} onChange={e => setOrder({ styleId: e.target.value })} style={styles.select}>
            {(availableStyles.length ? availableStyles : [order.styleId]).map(s =>
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
          <label style={styles.ctlLabel}>Charm</label>
          <select value={order.charmSizeId} onChange={e => setOrder({ charmSizeId: e.target.value })} style={styles.select}>
            {DEFAULT_CHARM_SIZES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
      </header>

      {/* Toolbar */}
      <div style={styles.toolbar}>
        <div style={styles.filterGroup}>
          {FILTERS.map(f => (
            <button key={f}
              style={{ ...styles.filterBtn, ...(filter === f ? styles.filterBtnActive : {}) }}
              onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : STATUS_LABEL[f]}
              {f !== 'all' && <span style={styles.filterCount}> {guests.filter(g => g.status === f).length}</span>}
            </button>
          ))}
        </div>
        <div style={styles.actionGroup}>
          <button style={styles.btn} onClick={() => navigate('/upload')}>+ Upload photos</button>
          <button style={styles.btn} onClick={approveAllVisible} disabled={!shown.length}>Approve all shown</button>
          <button style={styles.btnPrimary} onClick={handleExportZip} disabled={!approvedCount || !availableAssets}>Export approved (ZIP)</button>
          <button style={styles.btn} onClick={handleContactSheet} disabled={isEmpty || !availableAssets}>Contact PDF</button>
          <span style={styles.divider} />
          <button style={styles.btnGhost} onClick={() => saveProjectFile(order, guests)} disabled={isEmpty}>Save project</button>
          <button style={styles.btnGhost} onClick={() => loadFileRef.current?.click()}>Load project</button>
          <input ref={loadFileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleLoadFile} />
          {!isEmpty && <button style={styles.btnGhost} onClick={startNewWedding}>New wedding</button>}
        </div>
      </div>

      {busy && <div style={styles.busyBar}>{busy}</div>}

      {/* Grid */}
      {isEmpty ? (
        <div style={styles.emptyState}>
          <p style={styles.emptyText}>No guests yet. Upload a batch of photos to get started.</p>
          <button style={styles.btnPrimary} onClick={() => navigate('/upload')}>+ Upload photos</button>
        </div>
      ) : (
        <div style={styles.grid}>
          {shown.map(guest => (
            <div key={guest.id} style={styles.card}>
              <div style={styles.previews}>
                {guest.photo
                  ? <img src={guest.photo} alt={`Photo of ${guest.name}`} style={styles.photo} />
                  : <div style={styles.photoBlank}>no photo</div>}
                <MiniCard recipe={guest.recipe} availableAssets={availableAssets} width={110} backgroundUrl={backgroundUrl} />
              </div>

              <input
                style={styles.nameInput}
                value={guest.name}
                onChange={e => setName(guest.id, e.target.value)}
                aria-label="Guest name"
              />

              <div style={{ ...styles.statusBadge, ...statusStyle(guest.status) }}>
                {STATUS_LABEL[guest.status]}
                {guest.flags?.length > 0 && <span title="AI couldn't match these layers" style={styles.flagDot}> ⚑{guest.flags.length}</span>}
              </div>

              <div style={styles.cardActions}>
                <button style={styles.cardBtn} onClick={() => openGuest(guest.id)}>Open</button>
                <button
                  style={{ ...styles.cardBtn, ...(guest.status === 'approved' ? styles.approvedBtn : {}) }}
                  onClick={() => setStatusById(guest.id, guest.status === 'approved' ? 'pending' : 'approved')}>
                  {guest.status === 'approved' ? '✓' : 'Approve'}
                </button>
                <button
                  style={{ ...styles.cardBtn, ...(guest.status === 'needs_revision' ? styles.flagBtn : {}) }}
                  onClick={() => setStatusById(guest.id, guest.status === 'needs_revision' ? 'pending' : 'needs_revision')}>
                  ⚑
                </button>
                <button style={styles.removeBtn} onClick={() => removeGuest(guest.id)} title="Remove guest">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function statusStyle(status) {
  if (status === 'approved') return { background: 'var(--green-bg)', color: 'var(--green)' }
  if (status === 'needs_revision') return { background: 'var(--red-bg)', color: 'var(--red)' }
  return { background: 'var(--surface-raised)', color: 'var(--text-muted)' }
}

const styles = {
  page: { minHeight: '100svh', background: 'var(--bg)', padding: '24px 32px 48px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap', gap: 16 },
  title: { fontFamily: 'var(--font-heading)', fontSize: 30, margin: 0 },
  subtitle: { fontSize: 14, color: 'var(--text-muted)', marginTop: 4 },
  orderControls: { display: 'flex', alignItems: 'center', gap: 8 },
  ctlLabel: { fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' },
  select: { fontFamily: 'var(--font-ui)', fontSize: 13, padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' },
  toolbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' },
  filterGroup: { display: 'flex', gap: 4, background: 'var(--surface)', padding: 4, borderRadius: 8, border: '1px solid var(--border)' },
  filterBtn: { fontFamily: 'var(--font-ui)', fontSize: 13, padding: '5px 12px', borderRadius: 6, border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer' },
  filterBtnActive: { background: 'var(--accent-bg)', color: 'var(--accent-dark)', fontWeight: 600 },
  filterCount: { opacity: 0.7, fontSize: 11 },
  actionGroup: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  divider: { width: 1, height: 22, background: 'var(--border)', margin: '0 2px' },
  btn: { fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 500, padding: '7px 14px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' },
  btnPrimary: { fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600, padding: '7px 14px', borderRadius: 7, border: '1px solid var(--accent)', background: 'var(--accent)', color: '#fff', cursor: 'pointer' },
  btnGhost: { fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 500, padding: '7px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'none', color: 'var(--text-muted)', cursor: 'pointer' },
  busyBar: { padding: '8px 14px', background: 'var(--accent-bg)', border: '1px solid var(--accent)', borderRadius: 8, fontSize: 13, color: 'var(--accent-dark)', marginBottom: 16 },
  saveErrorBar: { padding: '10px 14px', background: 'var(--red-bg)', border: '1px solid var(--red)', borderRadius: 8, fontSize: 13, color: 'var(--red)', marginBottom: 14, lineHeight: 1.5 },
  externalBar: { padding: '10px 14px', background: 'var(--accent-bg)', border: '1px solid var(--accent)', borderRadius: 8, fontSize: 13, color: 'var(--accent-dark)', marginBottom: 14 },
  inlineBtn: { fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600, color: 'var(--accent-dark)', background: 'none', border: 'none', padding: 0, textDecoration: 'underline', cursor: 'pointer' },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '80px 20px', color: 'var(--text-muted)' },
  emptyText: { fontSize: 15 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 16 },
  card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, boxShadow: 'var(--shadow-sm)' },
  previews: { display: 'flex', gap: 8, alignItems: 'flex-start', justifyContent: 'center' },
  photo: { width: 84, height: 112, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' },
  photoBlank: { width: 84, height: 112, borderRadius: 6, border: '1px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--text-muted)', background: 'var(--surface-raised)' },
  nameInput: { fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 600, padding: '5px 8px', borderRadius: 6, border: '1px solid transparent', background: 'var(--surface-raised)', color: 'var(--text)', width: '100%' },
  statusBadge: { fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 5, textAlign: 'center' },
  flagDot: { fontWeight: 700 },
  cardActions: { display: 'flex', gap: 5 },
  cardBtn: { flex: 1, fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 500, padding: '6px 4px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' },
  approvedBtn: { background: 'var(--green-bg)', color: 'var(--green)', borderColor: 'var(--green)' },
  flagBtn: { background: 'var(--red-bg)', color: 'var(--red)', borderColor: 'var(--red)' },
  removeBtn: { fontFamily: 'var(--font-ui)', fontSize: 12, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer' },
}
