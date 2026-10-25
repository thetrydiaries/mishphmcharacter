import { Link } from 'react-router-dom'
import { useCompositor } from '../context/CompositorProvider'

export default function Home() {
  const { totalGuests, approvedCount, guests } = useCompositor()
  const hasBatch = totalGuests > 0 && guests[0]?.aiRecipe !== null

  return (
    <div style={styles.root}>
      <h1 style={styles.heading}>mishphmcharacter</h1>
      <p style={styles.sub}>Internal illustration compositor — wedding favour tool</p>

      {hasBatch && (
        <p style={styles.status}>
          {approvedCount} of {totalGuests} guests approved
        </p>
      )}

      <div style={styles.links}>
        <Link to="/upload" style={styles.linkPrimary}>Upload photos →</Link>
        <Link to="/review" style={styles.link}>{hasBatch ? `Review (${totalGuests})` : 'Review'}</Link>
      </div>
    </div>
  )
}

const styles = {
  root: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100svh', gap: 14, background: 'var(--bg)' },
  heading: { fontFamily: 'var(--font-heading)', fontSize: 36, fontWeight: 500, color: 'var(--text)', letterSpacing: '-0.5px', margin: 0 },
  sub: { fontFamily: 'var(--font-ui)', fontSize: 14, color: 'var(--text-muted)', margin: 0 },
  status: { fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--accent-dark)', margin: '4px 0 0' },
  links: { marginTop: 12, display: 'flex', gap: 12 },
  linkPrimary: { fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 600, color: '#fff', textDecoration: 'none', padding: '10px 22px', borderRadius: 8, background: 'var(--accent)', border: '1px solid var(--accent)' },
  link: { fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 500, color: 'var(--accent-dark)', textDecoration: 'none', padding: '10px 22px', border: '1px solid var(--accent)', borderRadius: 8, background: 'var(--accent-bg)' },
}
