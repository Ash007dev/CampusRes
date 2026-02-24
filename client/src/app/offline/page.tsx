'use client';

export default function OfflinePage() {
    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            color: 'white',
            fontFamily: 'Inter, system-ui, sans-serif',
            padding: '2rem',
            textAlign: 'center',
        }}>
            <div style={{
                background: 'rgba(255,255,255,0.05)',
                backdropFilter: 'blur(20px)',
                borderRadius: '24px',
                border: '1px solid rgba(255,255,255,0.1)',
                padding: '3rem',
                maxWidth: '480px',
                width: '100%',
            }}>
                <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📡</div>
                <h1 style={{
                    fontSize: '1.75rem',
                    fontWeight: 700,
                    marginBottom: '0.75rem',
                    background: 'linear-gradient(135deg, #60a5fa, #34d399)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                }}>
                    You&apos;re Offline
                </h1>
                <p style={{
                    color: '#94a3b8',
                    fontSize: '1rem',
                    lineHeight: 1.6,
                    marginBottom: '2rem',
                }}>
                    It looks like you&apos;ve lost your internet connection.
                    Don&apos;t worry — your bookings are safe! Please check your
                    connection and try again.
                </p>
                <button
                    onClick={() => window.location.reload()}
                    style={{
                        background: 'linear-gradient(135deg, #1e40af, #0d9488)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '12px',
                        padding: '0.875rem 2rem',
                        fontSize: '1rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'transform 0.2s, box-shadow 0.2s',
                        boxShadow: '0 4px 15px rgba(30, 64, 175, 0.3)',
                    }}
                    onMouseOver={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 6px 20px rgba(30, 64, 175, 0.4)';
                    }}
                    onMouseOut={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 4px 15px rgba(30, 64, 175, 0.3)';
                    }}
                >
                    Try Again
                </button>
            </div>
        </div>
    );
}
