import { useNavigate } from 'react-router-dom'

export default function Placeholder({ title = 'Page', message = 'Open on desktop for full experience.' }) {
  const navigate = useNavigate()
  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      background: 'var(--bg)',
      color: 'var(--text)'
    }}>
      <h1 style={{ margin: '0 0 12px 0', fontSize: '1.5rem', fontWeight: 600 }}>{title}</h1>
      <p style={{ margin: 0, fontSize: '1rem', color: 'var(--text-muted)', textAlign: 'center' }}>{message}</p>
      <button
        type="button"
        onClick={() => navigate(-1)}
        style={{
          marginTop: 24,
          padding: '12px 24px',
          fontSize: '1rem',
          fontWeight: 600,
          color: '#fff',
          background: 'var(--accent-blue)',
          border: 'none',
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer'
        }}
      >
        Back
      </button>
    </div>
  )
}
