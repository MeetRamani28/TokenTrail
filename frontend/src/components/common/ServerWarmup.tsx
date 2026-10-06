import React, { useEffect } from 'react';
import { toast } from 'sonner';

const RENDER_BACKEND_URL = 'https://tokentrail-backend.onrender.com';
const RAW_URL = import.meta.env.VITE_API_URL || '';
const BACKEND_URL = RAW_URL && !RAW_URL.startsWith('/') ? RAW_URL : RENDER_BACKEND_URL;

export const ServerWarmup: React.FC = () => {
  useEffect(() => {
    let isMounted = true;
    let wakeToastTimer: ReturnType<typeof setTimeout> | null = null;
    let lastPingTime = Date.now();

    const pingBackend = async (isInitialWakeup = false) => {
      lastPingTime = Date.now();

      if (isInitialWakeup) {
        // If server hasn't answered after 3 seconds, notify user that it's spinning up
        wakeToastTimer = setTimeout(() => {
          if (isMounted) {
            toast.loading('Waking up free-tier backend server... (~30s)', {
              id: 'server-warmup',
              description: 'Render free tier spins down after inactivity. Loading telemetry engine...',
            });
          }
        }, 3000);
      }

      try {
        const primaryUrl = `${BACKEND_URL}/healthz`;
        const res = await fetch(primaryUrl, { mode: 'cors' });
        if (res.ok) {
          if (wakeToastTimer) clearTimeout(wakeToastTimer);
          if (isInitialWakeup) {
            toast.success('Backend server connected!', {
              id: 'server-warmup',
              duration: 3000,
            });
          }
        }
      } catch {
        // Fallback ping if primary failed
        try {
          await fetch(`${RENDER_BACKEND_URL}/healthz`, { mode: 'no-cors' });
        } catch {
          // Silent ignore
        }
      }
    };

    // 1. Pre-flight immediate wakeup ping on app load
    pingBackend(true);

    // 2. Heartbeat ping every 10 minutes (600,000ms) to prevent Render sleep mode
    const heartbeatInterval = setInterval(() => {
      pingBackend(false);
    }, 10 * 60 * 1000);

    // 3. Tab visibility listener: if user comes back to the tab after 9+ minutes, trigger ping
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const elapsed = Date.now() - lastPingTime;
        if (elapsed > 9 * 60 * 1000) {
          pingBackend(false);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted = false;
      if (wakeToastTimer) clearTimeout(wakeToastTimer);
      clearInterval(heartbeatInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return null;
};
