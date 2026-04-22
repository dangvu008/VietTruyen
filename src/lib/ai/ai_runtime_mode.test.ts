import { describe, expect, it } from 'vitest';
import { isAiRuntimeReady, resolveAiRuntimeMode } from './ai_runtime_mode';

describe('ai_runtime_mode', () => {
  it('returns local_proxy when local proxy is enabled', () => {
    const mode = resolveAiRuntimeMode({
      isAuthenticated: false,
      isGuest: true,
      localProxyEnabled: true,
      hasDirectApiKey: false,
    });

    expect(mode).toBe('local_proxy');
    expect(isAiRuntimeReady(mode)).toBe(true);
  });

  it('returns disabled for guest users when local proxy is disabled and no direct key exists', () => {
    const mode = resolveAiRuntimeMode({
      isAuthenticated: false,
      isGuest: true,
      localProxyEnabled: false,
      hasDirectApiKey: false,
    });

    expect(mode).toBe('disabled');
    expect(isAiRuntimeReady(mode)).toBe(false);
  });

  it('returns direct_provider for guest users when a direct key exists', () => {
    const mode = resolveAiRuntimeMode({
      isAuthenticated: false,
      isGuest: true,
      localProxyEnabled: false,
      hasDirectApiKey: true,
    });

    expect(mode).toBe('direct_provider');
    expect(isAiRuntimeReady(mode)).toBe(true);
  });
});
