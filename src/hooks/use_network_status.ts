import { useCallback, useEffect, useRef, useState } from 'react';

const DEBOUNCE_MS = 2000;

interface NetworkStatus {
  isOnline: boolean;
  wasOffline: boolean;
  lastOnlineAt: string | null;
}

export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [wasOffline, setWasOffline] = useState(false);
  const [lastOnlineAt, setLastOnlineAt] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyStatus = useCallback((online: boolean) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      setIsOnline((prev) => {
        if (!prev && online) {
          setWasOffline(true);
          setLastOnlineAt(new Date().toISOString());
        }
        return online;
      });
    }, DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    const handleOnline = () => applyStatus(true);
    const handleOffline = () => applyStatus(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [applyStatus]);

  return { isOnline, wasOffline, lastOnlineAt };
}
