import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div style={styles.root}>
      <h1 style={styles.heading}>mishphmcharacter</h1>
      <p style={styles.sub}>Internal illustration compositor — wedding favour tool</p>
      <Link to="/compositor" style={styles.link}>
        Open Compositor →
      </Link>
    </div>
  )
}

const styles = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100svh',
    gap: 16,
    background: 'var(--bg)',
  },
  heading: {
    fontFamily: 'var(--font-heading)',
    fontSize: 36,
    fontWeight: 500,
    color: 'var(--text)',
    letterSpacing: '-0.5px',
    margin: 0,
  },
  sub: {
    fontFamily: 'var(--font-ui)',
    fontSize: 14,
    color: 'var(--text-muted)',
    margin: 0,
  },
  link: {
    marginTop: 8,
    fontFamily: 'var(--font-ui)',
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--accent-dark)',
    textDecoration: 'none',
    padding: '10px 22px',
    border: '1px solid var(--accent)',
    borderRadius: 8,
    background: 'var(--accent-bg)',
    transition: 'background 0.15s',
  },
}
