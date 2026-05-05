/**
 * File: use_model_health_sync.ts
 * Purpose: React hook — auto health check on mount + periodic polling
 * Layer: Hook
 * Domain: AI → [proactive health check, periodic sync]
 *
 * Usage: Gọi useModelHealthSync() trong App root.
 * - On mount: check ngay nếu lastHealthCheckAt > 5 phút hoặc chưa có
 * - Periodic: poll mỗi 3 phút
 * - Cleanup: unmount → stop polling
 */
import { useEffect, useRef } from 'react';
import { useAiStore } from '../store/use_ai_store';
import {
  startPeriodicHealthCheck,
  stopPeriodicHealthCheck,
} from '../lib/ai/model_health_checker';

/** Khoảng thời gian giữa các lần auto-check (ms) */
const PERIODIC_INTERVAL_MS = 3 * 60 * 1000; // 3 phút

/** Stale threshold — nếu lastHealthCheckAt cũ hơn giá trị này thì check ngay */
const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 phút

function isHealthDataStale(lastHealthCheckAt?: string): boolean {
  if (!lastHealthCheckAt) return true;
  const age = Date.now() - new Date(lastHealthCheckAt).getTime();
  return age > STALE_THRESHOLD_MS;
}

export function useModelHealthSync(): void {
  const didInitialCheck = useRef(false);

  useEffect(() => {
    // [Domain:AI] STEP 1 — Initial check on mount if stale
    const checkHealth = async () => {
      const store = useAiStore.getState();
      if (store.models.length === 0) return;

      try {
        await store.checkAllProvidersHealth();
      } catch (error) {
        console.warn('[useModelHealthSync] Initial health check failed:', error);
      }
    };

    if (!didInitialCheck.current) {
      didInitialCheck.current = true;
      const { lastHealthCheckAt } = useAiStore.getState();
      if (isHealthDataStale(lastHealthCheckAt)) {
        // Delay để không block app startup
        const timerId = globalThis.setTimeout(() => {
          checkHealth();
        }, 2000); // 2s delay sau mount

        // [Domain:AI] STEP 2 — Start periodic polling
        startPeriodicHealthCheck(async () => {
          const store = useAiStore.getState();
          if (store.models.length === 0) return;
          await store.checkAllProvidersHealth();
        }, PERIODIC_INTERVAL_MS);

        return () => {
          globalThis.clearTimeout(timerId);
          stopPeriodicHealthCheck();
        };
      }
    }

    // [Domain:AI] STEP 2 — Start periodic polling (even if initial check was fresh)
    startPeriodicHealthCheck(async () => {
      const store = useAiStore.getState();
      if (store.models.length === 0) return;
      await store.checkAllProvidersHealth();
    }, PERIODIC_INTERVAL_MS);

    return () => {
      stopPeriodicHealthCheck();
    };
  }, []);
}
