const DEFAULT_TOTAL_BYTES = 5 * 1024 * 1024; // 5MB conservative estimate

export type QuotaLevel = 'ok' | 'warning' | 'critical';

export interface QuotaStatus {
  usedBytes: number;
  totalBytes: number;
  percent: number;
  level: QuotaLevel;
}

export function checkQuota(): QuotaStatus {
  let usedBytes = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key == null) continue;
    const value = localStorage.getItem(key);
    if (value == null) continue;
    usedBytes += (key.length + value.length) * 2;
  }

  const totalBytes = DEFAULT_TOTAL_BYTES;
  const percent = Math.round((usedBytes / totalBytes) * 100);

  let level: QuotaLevel = 'ok';
  if (percent >= 95) level = 'critical';
  else if (percent >= 80) level = 'warning';

  return { usedBytes, totalBytes, percent, level };
}

export function estimatePayloadBytes(value: string): number {
  return value.length * 2;
}

export function canSafelyWrite(key: string, value: string): boolean {
  const quota = checkQuota();
  const payloadBytes = estimatePayloadBytes(JSON.stringify(value)) + key.length * 2;
  const projectedPercent = ((quota.usedBytes + payloadBytes) / quota.totalBytes) * 100;
  return projectedPercent < 95;
}
