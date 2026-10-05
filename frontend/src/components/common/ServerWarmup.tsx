import React, { useEffect } from 'react';
import { toast } from 'sonner';

const BASE_URL = import.meta.env.VITE_API_URL || '';

export const ServerWarmup: React.FC = () => {
  useEffect(() => {
    let isMounted = true;
    let wakeToastTimer: ReturnType<typeof setTimeout> | null = null;

    const pingBackend = async (isInitialWakeup = false) => {
      if (isInitialWakeup) {
        // If server hasn't answered after 2.5 seconds, notify user that it's spinning up
        wakeToastTimer = setTimeout(() => {
          if (isMounted) {
            toast.loading('Waking up free-tier backend server... (~30s)', {
              id: 'server-warmup',
              description: 'Render free tier spins down after inactivity. Loading telemetry engine...',
            });
          }
        }, 2500);
      }

      try {
        const url = BASE_URL ? `${BASE_URL}/healthz` : '/healthz';
        const res = await fetch(url);
        if (res.ok) {
          if (wakeToastTimer) clearTimeout(wakeToastTimer);
          // If we showed the waking-up toast, update it to success
          toast.success('Backend server connected!', {
            id: 'server-warmup',
            duration: 3000,
          });
        }
      } catch {
        // Network error / waiting for cold start
      }
    };

    // 1. Pre-flight immediate wakeup ping on app load
    pingBackend(true);

    // 2. Heartbeat ping every 10 minutes while user has the browser tab open
    const heartbeatInterval = setInterval(() => {
      pingBackend(false);
    }, 10 * 60 * 1000);

    return () => {
      isMounted = false;
      if (wakeToastTimer) clearTimeout(wakeToastTimer);
      clearInterval(heartbeatInterval);
    };
  }, []);

  return null;
};
