const STATUS_STYLES = {
  approved: {
    background: 'var(--green-bg)',
    color: 'var(--green)',
    border: '1px solid var(--green)',
    label: 'Approved',
  },
  needs_revision: {
    background: 'var(--red-bg)',
    color: 'var(--red)',
    border: '1px solid var(--red)',
    label: 'Needs Revision',
  },
  pending: {
    background: 'var(--surface-raised)',
    color: 'var(--text-muted)',
    border: '1px solid var(--border)',
    label: 'Pending',
  },
}

export default function TopBar({ guest, canUndo, canRedo, onApprove, onFlagRevision, onReset, onUndo, onRedo }) {
  const statusStyle = STATUS_STYLES[guest.status] ?? STATUS_STYLES.pending

  return (
    <header style={styles.bar}>
      {/* Left: guest name + status badge */}
      <div style={styles.left}>
        <h1 style={styles.name}>{guest.name}</h1>
        {guest.table && (
          <span style={styles.table}>Table {guest.table}</span>
        )}
        <span style={{ ...styles.badge, ...statusStyle }}>
          {statusStyle.label}
        </span>
      </div>

      {/* Right: action buttons */}
      <div style={styles.right}>
        <button
          style={{ ...styles.btn, ...styles.btnGhost }}
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          ↩ Undo
        </button>
        <button
          style={{ ...styles.btn, ...styles.btnGhost }}
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
        >
          ↪ Redo
        </button>
        <div style={styles.divider} />
        <button
          style={{ ...styles.btn, ...styles.btnGhost }}
          onClick={onReset}
          title="Reset to AI suggestion"
        >
          Reset
        </button>
        <button
          style={{ ...styles.btn, ...styles.btnRevision }}
          onClick={onFlagRevision}
          title="Flag for revision (R)"
        >
          Needs Revision
        </button>
        <button
          style={{ ...styles.btn, ...styles.btnApprove }}
          onClick={onApprove}
          title="Approve illustration (A)"
        >
          Approve
        </button>
      </div>
    </header>
  )
}

const styles = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 20px',
    height: 56,
    background: 'var(--surface)',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
    gap: 12,
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  name: {
    fontFamily: 'var(--font-heading)',
    fontSize: 20,
    fontWeight: 500,
    color: 'var(--text)',
    margin: 0,
    whiteSpace: 'nowrap',
  },
  table: {
    fontSize: 12,
    color: 'var(--text-muted)',
    whiteSpace: 'nowrap',
  },
  badge: {
    fontSize: 11,
    fontWeight: 500,
    padding: '3px 9px',
    borderRadius: 12,
    whiteSpace: 'nowrap',
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  divider: {
    width: 1,
    height: 20,
    background: 'var(--border)',
    margin: '0 4px',
  },
  btn: {
    fontFamily: 'var(--font-ui)',
    fontSize: 13,
    fontWeight: 500,
    padding: '6px 14px',
    borderRadius: 6,
    border: 'none',
    cursor: 'pointer',
    transition: 'opacity 0.15s',
    whiteSpace: 'nowrap',
  },
  btnGhost: {
    background: 'none',
    border: '1px solid var(--border)',
    color: 'var(--text-muted)',
    ':disabled': { opacity: 0.4, cursor: 'default' },
  },
  btnRevision: {
    background: 'var(--red-bg)',
    color: 'var(--red)',
    border: '1px solid var(--red)',
  },
  btnApprove: {
    background: 'var(--green)',
    color: '#fff',
    border: '1px solid var(--green)',
  },
}
