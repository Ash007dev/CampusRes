'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [showPrompt, setShowPrompt] = useState(false);
    const [isInstalled, setIsInstalled] = useState(false);

    useEffect(() => {
        // Check if already installed
        if (window.matchMedia('(display-mode: standalone)').matches) {
            setIsInstalled(true);
            return;
        }

        const handleBeforeInstall = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);

            // Show prompt after a short delay (not immediately — better UX)
            const dismissed = localStorage.getItem('pwa-install-dismissed');
            if (!dismissed) {
                setTimeout(() => setShowPrompt(true), 3000);
            }
        };

        const handleAppInstalled = () => {
            setIsInstalled(true);
            setShowPrompt(false);
            setDeferredPrompt(null);
            console.log('[PWA] App installed successfully');
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstall);
        window.addEventListener('appinstalled', handleAppInstalled);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;

        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            console.log('[PWA] User accepted install prompt');
        } else {
            console.log('[PWA] User dismissed install prompt');
        }

        setDeferredPrompt(null);
        setShowPrompt(false);
    };

    const handleDismiss = () => {
        setShowPrompt(false);
        localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    };

    if (isInstalled || !showPrompt) return null;

    return (
        <div
            style={{
                position: 'fixed',
                bottom: '1.5rem',
                right: '1.5rem',
                zIndex: 9998,
                maxWidth: '360px',
                width: 'calc(100% - 3rem)',
                background: 'rgba(15, 23, 42, 0.95)',
                backdropFilter: 'blur(20px)',
                borderRadius: '20px',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                padding: '1.5rem',
                fontFamily: 'Inter, system-ui, sans-serif',
                animation: 'slideUp 0.5s ease-out',
            }}
        >
            <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

            <button
                onClick={handleDismiss}
                aria-label="Dismiss install prompt"
                style={{
                    position: 'absolute',
                    top: '0.75rem',
                    right: '0.75rem',
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    fontSize: '1.25rem',
                    cursor: 'pointer',
                    padding: '0.25rem',
                    lineHeight: 1,
                }}
            >
                ✕
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #1e40af, #0d9488)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.25rem',
                    flexShrink: 0,
                }}>
                    🏛️
                </div>
                <div>
                    <div style={{ color: 'white', fontWeight: 600, fontSize: '0.9375rem' }}>
                        Install CampusRes
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: '0.8125rem' }}>
                        Get it on your device
                    </div>
                </div>
            </div>

            <p style={{
                color: '#cbd5e1',
                fontSize: '0.8125rem',
                lineHeight: 1.5,
                marginBottom: '1rem',
            }}>
                Install Campus Resource Engine for quick access, offline support, and an app-like experience!
            </p>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                    onClick={handleDismiss}
                    style={{
                        flex: 1,
                        background: 'rgba(255,255,255,0.05)',
                        color: '#94a3b8',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '10px',
                        padding: '0.625rem',
                        fontSize: '0.8125rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                    }}
                >
                    Not Now
                </button>
                <button
                    onClick={handleInstall}
                    style={{
                        flex: 1,
                        background: 'linear-gradient(135deg, #1e40af, #0d9488)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        padding: '0.625rem',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(30, 64, 175, 0.3)',
                        transition: 'transform 0.2s, box-shadow 0.2s',
                    }}
                    onMouseOver={(e) => {
                        e.currentTarget.style.transform = 'scale(1.02)';
                    }}
                    onMouseOut={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                    }}
                >
                    Install App
                </button>
            </div>
        </div>
    );
}
