import { describe, expect, it, vi } from 'vitest';

describe('useNetworkStatus (unit logic)', () => {
  it('debounce prevents rapid state toggling', () => {
    vi.useFakeTimers();
    let isOnline = true;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    function applyStatus(online: boolean) {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        isOnline = online;
      }, 2000);
    }

    applyStatus(false);
    applyStatus(true);
    applyStatus(false);

    expect(isOnline).toBe(true);

    vi.advanceTimersByTime(2100);
    expect(isOnline).toBe(false);

    vi.useRealTimers();
  });

  it('wasOffline flag tracks reconnection', () => {
    let wasOffline = false;
    let isOnline = true;

    function handleOffline() { isOnline = false; }
    function handleOnline() {
      if (!isOnline) wasOffline = true;
      isOnline = true;
    }

    handleOffline();
    expect(isOnline).toBe(false);

    handleOnline();
    expect(isOnline).toBe(true);
    expect(wasOffline).toBe(true);
  });
});
