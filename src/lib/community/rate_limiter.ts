interface RateLimiterConfig {
  maxActions: number;
  windowMs: number;
}

interface RateLimiter {
  tryAcquire: () => boolean;
  remaining: () => number;
  reset: () => void;
}

export function createRateLimiter(config: RateLimiterConfig): RateLimiter {
  const timestamps: number[] = [];

  function pruneExpired(now: number): void {
    const cutoff = now - config.windowMs;
    while (timestamps.length > 0 && timestamps[0] <= cutoff) {
      timestamps.shift();
    }
  }

  return {
    tryAcquire(): boolean {
      const now = Date.now();
      pruneExpired(now);
      if (timestamps.length >= config.maxActions) return false;
      timestamps.push(now);
      return true;
    },

    remaining(): number {
      pruneExpired(Date.now());
      return Math.max(0, config.maxActions - timestamps.length);
    },

    reset(): void {
      timestamps.length = 0;
    },
  };
}

export const commentLimiter = createRateLimiter({ maxActions: 5, windowMs: 60_000 });
export const likeLimiter = createRateLimiter({ maxActions: 2, windowMs: 1_000 });
