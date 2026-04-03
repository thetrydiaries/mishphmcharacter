export default function BottomBar({ currentIndex, totalGuests, onPrev, onNext }) {
  const current = currentIndex + 1

  return (
    <footer style={styles.bar}>
      <button
        style={{ ...styles.navBtn, ...(currentIndex === 0 ? styles.navBtnDisabled : {}) }}
        onClick={onPrev}
        disabled={currentIndex === 0}
        title="Previous guest (←)"
      >
        ← Previous
      </button>

      <span style={styles.counter}>
        <span style={styles.counterCurrent}>{current}</span>
        <span style={styles.counterSep}> of </span>
        <span style={styles.counterTotal}>{totalGuests}</span>
      </span>

      <button
        style={{
          ...styles.navBtn,
          ...(currentIndex === totalGuests - 1 ? styles.navBtnDisabled : {}),
        }}
        onClick={onNext}
        disabled={currentIndex === totalGuests - 1}
        title="Next guest (→)"
      >
        Next →
      </button>
    </footer>
  )
}

const styles = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
    height: 48,
    background: 'var(--surface)',
    borderTop: '1px solid var(--border)',
    flexShrink: 0,
  },
  navBtn: {
    fontFamily: 'var(--font-ui)',
    fontSize: 13,
    fontWeight: 500,
    padding: '6px 16px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'none',
    color: 'var(--text)',
    cursor: 'pointer',
    transition: 'background 0.12s',
  },
  navBtnDisabled: {
    opacity: 0.35,
    cursor: 'default',
  },
  counter: {
    fontFamily: 'var(--font-ui)',
    fontSize: 13,
  },
  counterCurrent: {
    fontWeight: 600,
    color: 'var(--accent-dark)',
  },
  counterSep: {
    color: 'var(--text-muted)',
  },
  counterTotal: {
    color: 'var(--text-muted)',
  },
}
