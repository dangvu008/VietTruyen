import type { GroundedProseRuntimeGateArtifact } from '../../types/grounded_prose';

const STORAGE_KEY = 'viettruyen:grounded-prose-receipts:v1';
const MAX_RECEIPTS = 500;

export interface GroundedProseGateReceiptRecord {
  projectId: string;
  chapterNumber: number;
  proseHash: string;
  gate: GroundedProseRuntimeGateArtifact;
  savedAt: string;
}

type ReceiptMap = Record<string, GroundedProseGateReceiptRecord>;

let memoryFallback: ReceiptMap = {};

function receiptKey(projectId: string, chapterNumber: number): string {
  return `${projectId}::${chapterNumber}`;
}

function readAll(): ReceiptMap {
  if (typeof localStorage === 'undefined') return memoryFallback;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ReceiptMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(records: ReceiptMap): void {
  memoryFallback = records;
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (error) {
    console.warn('[GroundedProseReceiptStore] Unable to persist receipt:', error);
  }
}

function prune(records: ReceiptMap): ReceiptMap {
  const entries = Object.entries(records);
  if (entries.length <= MAX_RECEIPTS) return records;

  entries.sort((a, b) => {
    const aTime = Date.parse(a[1].savedAt || a[1].gate.createdAt || '') || 0;
    const bTime = Date.parse(b[1].savedAt || b[1].gate.createdAt || '') || 0;
    return bTime - aTime;
  });

  return Object.fromEntries(entries.slice(0, MAX_RECEIPTS));
}

export function saveGroundedProseGateReceipt(
  projectId: string,
  chapterNumber: number,
  gate: GroundedProseRuntimeGateArtifact,
): GroundedProseGateReceiptRecord {
  if (gate.decision !== 'PASS') {
    throw new Error('Cannot persist a FAIL grounded-prose gate as a release receipt.');
  }
  if (gate.chapterNumber !== chapterNumber) {
    throw new Error('Grounded-prose gate chapter number does not match receipt target.');
  }
  if (!gate.proseHash?.trim()) {
    throw new Error('Grounded-prose gate receipt is missing prose hash.');
  }
  if (!gate.causalitySkeleton || !gate.coldReader || !gate.lineAudit) {
    throw new Error('Grounded-prose gate receipt is missing required audit artifacts.');
  }

  const record: GroundedProseGateReceiptRecord = {
    projectId,
    chapterNumber,
    proseHash: gate.proseHash,
    gate,
    savedAt: new Date().toISOString(),
  };

  const records = readAll();
  records[receiptKey(projectId, chapterNumber)] = record;
  writeAll(prune(records));
  return record;
}

export function getGroundedProseGateReceipt(
  projectId: string,
  chapterNumber: number,
): GroundedProseGateReceiptRecord | null {
  return readAll()[receiptKey(projectId, chapterNumber)] ?? null;
}

export function invalidateGroundedProseGateReceipt(
  projectId: string,
  chapterNumber: number,
): void {
  const records = readAll();
  const key = receiptKey(projectId, chapterNumber);
  if (!records[key]) return;
  delete records[key];
  writeAll(records);
}

export function assertGroundedProseGateReceipt(
  projectId: string,
  chapterNumber: number,
  proseHash: string,
): GroundedProseRuntimeGateArtifact {
  const receipt = getGroundedProseGateReceipt(projectId, chapterNumber);
  if (!receipt) {
    throw new Error(`Chapter ${chapterNumber} has no durable Grounded Prose PASS receipt.`);
  }
  if (receipt.proseHash !== proseHash || receipt.gate.proseHash !== proseHash) {
    throw new Error(`Chapter ${chapterNumber} Grounded Prose receipt is stale for the current prose.`);
  }
  if (receipt.gate.decision !== 'PASS') {
    throw new Error(`Chapter ${chapterNumber} Grounded Prose receipt is not PASS.`);
  }
  if (!receipt.gate.causalitySkeleton || !receipt.gate.coldReader || !receipt.gate.lineAudit) {
    throw new Error(`Chapter ${chapterNumber} Grounded Prose receipt is missing required artifacts.`);
  }
  return receipt.gate;
}
