'use client';
import { useEffect, useRef, useCallback } from 'react';
import { apiClient } from '@/lib/api';

/**
 * Heartbeat hook that keeps the user's presence alive.
 */
export function usePresenceHeartbeat(contextType?: string, contextId?: string) {
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const ping = useCallback(() => {
    apiClient.updatePresence({ status: 'online', context_type: contextType, context_id: contextId }).catch(() => {});
  }, [contextType, contextId]);

  useEffect(() => {
    ping();
    timer.current = setInterval(ping, 60000);

    const handleVisibility = () => {
      if (document.hidden) {
        apiClient.updatePresence({ status: 'idle' }).catch(() => {});
      } else {
        ping();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (timer.current) clearInterval(timer.current);
      document.removeEventListener('visibilitychange', handleVisibility);
      apiClient.setOffline().catch(() => {});
    };
  }, [ping]);
}
