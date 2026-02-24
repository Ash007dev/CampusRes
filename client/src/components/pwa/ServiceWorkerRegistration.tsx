'use client';

import { useEffect, useState } from 'react';

export function ServiceWorkerRegistration() {
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

    useEffect(() => {
        if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
            return;
        }

        const registerSW = async () => {
            try {
                const reg = await navigator.serviceWorker.register('/sw.js', {
                    scope: '/',
                });

                setRegistration(reg);
                console.log('[PWA] Service Worker registered successfully');

                // Check for updates
                reg.addEventListener('updatefound', () => {
                    const newWorker = reg.installing;
                    if (!newWorker) return;

                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // New version available
                            setUpdateAvailable(true);
                            console.log('[PWA] New version available');
                        }
                    });
                });

                // Check for updates periodically (every 60 minutes)
                setInterval(() => {
                    reg.update();
                }, 60 * 60 * 1000);
            } catch (error) {
                console.error('[PWA] Service Worker registration failed:', error);
            }
        };

        registerSW();

        // Handle controller change (new SW activated)
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            // Only reload if we triggered the update
            if (updateAvailable) {
                window.location.reload();
            }
        });
    }, [updateAvailable]);

    const handleUpdate = () => {
        if (registration?.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
    };

    if (!updateAvailable) return null;

    return (
        <div
            style={{
                position: 'fixed',
                bottom: '1.5rem',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 9999,
                background: 'linear-gradient(135deg, #1e40af, #0d9488)',
                color: 'white',
                padding: '0.875rem 1.5rem',
                borderRadius: '16px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                fontFamily: 'Inter, system-ui, sans-serif',
                fontSize: '0.875rem',
                fontWeight: 500,
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.15)',
                animation: 'slideUp 0.4s ease-out',
            }}
        >
            <span>🔄 A new version is available!</span>
            <button
                onClick={handleUpdate}
                style={{
                    background: 'rgba(255,255,255,0.2)',
                    color: 'white',
                    border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: '8px',
                    padding: '0.5rem 1rem',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                    whiteSpace: 'nowrap',
                }}
                onMouseOver={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.3)';
                }}
                onMouseOut={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
                }}
            >
                Update Now
            </button>
        </div>
    );
}
