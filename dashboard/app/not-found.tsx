export default function NotFound() {
  return (
    <html lang="de">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#F7F8FC', color: '#14193A' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: '64px', fontWeight: 300, margin: '0 0 8px', color: '#1B2A5E' }}>404</h1>
            <p style={{ color: '#6B7280', marginBottom: '24px' }}>Seite nicht gefunden</p>
            <a
              href="/dashboard"
              style={{
                display: 'inline-block',
                padding: '10px 24px',
                background: '#1B2A5E',
                color: '#fff',
                borderRadius: '6px',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: 500,
              }}
            >
              Zurück zum Dashboard
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
