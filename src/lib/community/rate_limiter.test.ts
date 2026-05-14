import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createRateLimiter } from './rate_limiter';

describe('createRateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('allows actions within limit', () => {
    const limiter = createRateLimiter({ maxActions: 3, windowMs: 1000 });
    expect(limiter.tryAcquire()).toBe(true);
    expect(limiter.tryAcquire()).toBe(true);
    expect(limiter.tryAcquire()).toBe(true);
    expect(limiter.remaining()).toBe(0);
  });

  it('blocks actions beyond limit', () => {
    const limiter = createRateLimiter({ maxActions: 2, windowMs: 1000 });
    limiter.tryAcquire();
    limiter.tryAcquire();
    expect(limiter.tryAcquire()).toBe(false);
  });

  it('allows actions after window expires', () => {
    const limiter = createRateLimiter({ maxActions: 1, windowMs: 1000 });
    limiter.tryAcquire();
    expect(limiter.tryAcquire()).toBe(false);

    vi.advanceTimersByTime(1100);
    expect(limiter.tryAcquire()).toBe(true);
  });

  it('reset clears all timestamps', () => {
    const limiter = createRateLimiter({ maxActions: 1, windowMs: 60000 });
    limiter.tryAcquire();
    expect(limiter.tryAcquire()).toBe(false);
    limiter.reset();
    expect(limiter.tryAcquire()).toBe(true);
  });
});
