import {
  GROUNDED_PROSE_CAUSALITY_SCHEMA,
  GROUNDED_PROSE_COLD_READER_SCHEMA,
  GROUNDED_PROSE_GATE_SCHEMA,
  GROUNDED_PROSE_LINE_AUDIT_SCHEMA,
  type GroundedProseRuntimeGateArtifact,
} from '../../types/grounded_prose';
import {
  deleteGroundedProseReceiptFromCloud,
  fetchGroundedProseReceiptFromCloud,
  mirrorGroundedProseReceiptToCloud,
} from './grounded_prose_receipt_cloud';

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

function hashString(input: string): string {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

export function hashGroundedProseContent(content: string): string {
  return hashString(String(content || '').replace(/\r\n/g, '\n').trim());
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

function assertGateStructure(
  gate: GroundedProseRuntimeGateArtifact,
  chapterNumber: number,
  proseHash: string,
): void {
  if (gate.schemaVersion !== GROUNDED_PROSE_GATE_SCHEMA) {
    throw new Error(`Chapter ${chapterNumber} Grounded Prose receipt has an invalid gate schema.`);
  }
  if (gate.chapterNumber !== chapterNumber || gate.proseHash !== proseHash) {
    throw new Error(`Chapter ${chapterNumber} Grounded Prose receipt identity does not match current prose.`);
  }
  if (gate.decision !== 'PASS' || gate.blockers.length > 0) {
    throw new Error(`Chapter ${chapterNumber} Grounded Prose receipt is not a clean PASS.`);
  }

  const causality = gate.causalitySkeleton;
  const coldReader = gate.coldReader;
  const lineAudit = gate.lineAudit;

  if (!causality || !coldReader || !lineAudit) {
    throw new Error(`Chapter ${chapterNumber} Grounded Prose receipt is missing required artifacts.`);
  }

  if (
    causality.schemaVersion !== GROUNDED_PROSE_CAUSALITY_SCHEMA ||
    causality.chapterNumber !== chapterNumber ||
    causality.proseHash !== proseHash ||
    !causality.pass ||
    causality.blockers.length > 0 ||
    causality.beats.length === 0
  ) {
    throw new Error(`Chapter ${chapterNumber} causality artifact is not a clean PASS for current prose.`);
  }

  for (const beat of causality.beats) {
    if (!beat.id?.trim() || !beat.stimulus?.trim() || !beat.perception?.trim() || !beat.response?.trim() || !beat.consequence?.trim()) {
      throw new Error(`Chapter ${chapterNumber} causality artifact contains an incomplete beat.`);
    }
  }

  if (
    coldReader.schemaVersion !== GROUNDED_PROSE_COLD_READER_SCHEMA ||
    coldReader.chapterNumber !== chapterNumber ||
    coldReader.proseHash !== proseHash ||
    !coldReader.pass ||
    coldReader.blockers.length > 0 ||
    coldReader.findings.some((finding) => finding.severity === 'high')
  ) {
    throw new Error(`Chapter ${chapterNumber} cold-reader artifact is not a clean PASS for current prose.`);
  }

  if (
    lineAudit.schemaVersion !== GROUNDED_PROSE_LINE_AUDIT_SCHEMA ||
    lineAudit.chapterNumber !== chapterNumber ||
    lineAudit.proseHash !== proseHash ||
    !lineAudit.pass ||
    lineAudit.blockers.length > 0 ||
    lineAudit.verdicts.some((verdict) => verdict.action === 'DELETE' || verdict.action === 'REWRITE')
  ) {
    throw new Error(`Chapter ${chapterNumber} line-audit artifact is not a clean PASS for current prose.`);
  }

  const findingIds = new Set(coldReader.findings.map((finding) => finding.id));
  const verdictCounts = new Map<string, number>();
  for (const verdict of lineAudit.verdicts) {
    if (!findingIds.has(verdict.findingId)) {
      throw new Error(`Chapter ${chapterNumber} line audit references an unknown cold-reader finding.`);
    }
    verdictCounts.set(verdict.findingId, (verdictCounts.get(verdict.findingId) || 0) + 1);
    if (!verdict.reason?.trim()) {
      throw new Error(`Chapter ${chapterNumber} line audit contains a verdict without reason.`);
    }
    if (verdict.action === 'KEEP_WITH_REASON' && !verdict.sceneFunction?.trim()) {
      throw new Error(`Chapter ${chapterNumber} line audit keeps a finding without concrete scene function.`);
    }
  }

  for (const finding of coldReader.findings) {
    if ((verdictCounts.get(finding.id) || 0) !== 1) {
      throw new Error(`Chapter ${chapterNumber} cold-reader finding ${finding.id} lacks exactly one line-audit verdict.`);
    }
  }
}

function cacheReceipt(record: GroundedProseGateReceiptRecord): GroundedProseGateReceiptRecord {
  const records = readAll();
  records[receiptKey(record.projectId, record.chapterNumber)] = record;
  writeAll(prune(records));
  return record;
}

export function saveGroundedProseGateReceipt(
  projectId: string,
  chapterNumber: number,
  gate: GroundedProseRuntimeGateArtifact,
): GroundedProseGateReceiptRecord {
  assertGateStructure(gate, chapterNumber, gate.proseHash);

  const record: GroundedProseGateReceiptRecord = {
    projectId,
    chapterNumber,
    proseHash: gate.proseHash,
    gate,
    savedAt: new Date().toISOString(),
  };

  cacheReceipt(record);

  // Local persistence remains the immediate synchronous safety boundary. Cloud is
  // a durable cross-device mirror; an unavailable network must not erase a valid
  // local PASS, but release on another device will fail closed until the mirror exists.
  void mirrorGroundedProseReceiptToCloud(record).catch((error) => {
    console.warn('[GroundedProseReceiptStore] Cloud receipt mirror failed:', error);
  });

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
  if (records[key]) {
    delete records[key];
    writeAll(records);
  }

  void deleteGroundedProseReceiptFromCloud(projectId, chapterNumber).catch((error) => {
    console.warn('[GroundedProseReceiptStore] Cloud receipt invalidation failed:', error);
  });
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
  if (receipt.projectId !== projectId || receipt.chapterNumber !== chapterNumber) {
    throw new Error(`Chapter ${chapterNumber} Grounded Prose receipt identity is invalid.`);
  }
  if (receipt.proseHash !== proseHash) {
    throw new Error(`Chapter ${chapterNumber} Grounded Prose receipt is stale for the current prose.`);
  }

  assertGateStructure(receipt.gate, chapterNumber, proseHash);
  return receipt.gate;
}

export function assertGroundedProseGateReceiptForContent(
  projectId: string,
  chapterNumber: number,
  content: string,
): GroundedProseRuntimeGateArtifact {
  return assertGroundedProseGateReceipt(
    projectId,
    chapterNumber,
    hashGroundedProseContent(content),
  );
}

/**
 * Resolve a receipt across devices. Local cache is checked first; if missing or
 * stale, the canonical cloud mirror is fetched, structurally revalidated, then
 * cached locally. This function is the preferred release check for async edges.
 */
export async function ensureGroundedProseGateReceiptForContent(
  projectId: string,
  chapterNumber: number,
  content: string,
): Promise<GroundedProseRuntimeGateArtifact> {
  const proseHash = hashGroundedProseContent(content);

  try {
    return assertGroundedProseGateReceipt(projectId, chapterNumber, proseHash);
  } catch (localError) {
    let cloudReceipt;
    try {
      cloudReceipt = await fetchGroundedProseReceiptFromCloud(projectId, chapterNumber);
    } catch (cloudError) {
      const localMessage = localError instanceof Error ? localError.message : 'local receipt unavailable';
      const cloudMessage = cloudError instanceof Error ? cloudError.message : 'cloud receipt unavailable';
      throw new Error(
        `Chapter ${chapterNumber} has no usable Grounded Prose release receipt (${localMessage}; cloud: ${cloudMessage}).`,
      );
    }

    if (!cloudReceipt) {
      throw localError;
    }
    if (cloudReceipt.projectId !== projectId || cloudReceipt.chapterNumber !== chapterNumber) {
      throw new Error(`Chapter ${chapterNumber} cloud Grounded Prose receipt identity is invalid.`);
    }
    if (cloudReceipt.proseHash !== proseHash) {
      throw new Error(`Chapter ${chapterNumber} cloud Grounded Prose receipt is stale for the current prose.`);
    }

    assertGateStructure(cloudReceipt.gate, chapterNumber, proseHash);
    cacheReceipt(cloudReceipt);
    return cloudReceipt.gate;
  }
}
