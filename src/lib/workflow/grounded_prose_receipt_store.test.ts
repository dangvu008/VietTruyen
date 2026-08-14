import { describe, expect, it } from 'vitest';
import {
  GROUNDED_PROSE_CAUSALITY_SCHEMA,
  GROUNDED_PROSE_COLD_READER_SCHEMA,
  GROUNDED_PROSE_GATE_SCHEMA,
  GROUNDED_PROSE_LINE_AUDIT_SCHEMA,
  type GroundedProseRuntimeGateArtifact,
} from '../../types/grounded_prose';
import {
  assertGroundedProseGateReceiptForContent,
  hashGroundedProseContent,
  saveGroundedProseGateReceipt,
} from './grounded_prose_receipt_store';

function passGate(chapterNumber: number, content: string): GroundedProseRuntimeGateArtifact {
  const proseHash = hashGroundedProseContent(content);
  return {
    schemaVersion: GROUNDED_PROSE_GATE_SCHEMA,
    chapterNumber,
    proseHash,
    decision: 'PASS',
    blockers: [],
    causalitySkeleton: {
      schemaVersion: GROUNDED_PROSE_CAUSALITY_SCHEMA,
      chapterNumber,
      proseHash,
      pass: true,
      blockers: [],
      beats: [{
        id: 'beat-1',
        stimulus: 'Một tiếng động vang lên.',
        perception: 'Nhân vật nghe thấy.',
        response: 'Nhân vật quay lại.',
        consequence: 'Nhân vật phát hiện người đến.',
      }],
    },
    coldReader: {
      schemaVersion: GROUNDED_PROSE_COLD_READER_SCHEMA,
      chapterNumber,
      proseHash,
      pass: true,
      blockers: [],
      findings: [],
    },
    lineAudit: {
      schemaVersion: GROUNDED_PROSE_LINE_AUDIT_SCHEMA,
      chapterNumber,
      proseHash,
      pass: true,
      blockers: [],
      verdicts: [],
    },
    createdAt: new Date().toISOString(),
  };
}

describe('grounded prose receipt store', () => {
  it('accepts the exact prose that produced a PASS receipt', () => {
    const projectId = `receipt-pass-${Date.now()}`;
    const content = 'Gió lùa qua cửa. Hắn ngẩng đầu nhìn ra sân.';
    saveGroundedProseGateReceipt(projectId, 1, passGate(1, content));

    expect(() => assertGroundedProseGateReceiptForContent(projectId, 1, content)).not.toThrow();
  });

  it('rejects modified prose after the receipt was created', () => {
    const projectId = `receipt-stale-${Date.now()}`;
    const content = 'Hắn đặt chén trà xuống.';
    saveGroundedProseGateReceipt(projectId, 2, passGate(2, content));

    expect(() => assertGroundedProseGateReceiptForContent(
      projectId,
      2,
      `${content} Rồi hắn đứng dậy.`,
    )).toThrow(/stale/i);
  });
});
