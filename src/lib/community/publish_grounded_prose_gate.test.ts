import { describe, expect, it } from 'vitest';
import type { Chapter } from '../../types/story';
import {
  GROUNDED_PROSE_CAUSALITY_SCHEMA,
  GROUNDED_PROSE_COLD_READER_SCHEMA,
  GROUNDED_PROSE_GATE_SCHEMA,
  GROUNDED_PROSE_LINE_AUDIT_SCHEMA,
  type GroundedProseRuntimeGateArtifact,
} from '../../types/grounded_prose';
import {
  hashGroundedProseContent,
  saveGroundedProseGateReceipt,
} from '../workflow/grounded_prose_receipt_store';
import { assertPublishStoryGroundedProseReceipts } from './publish_grounded_prose_gate';

function chapter(id: string, sequenceNumber: number, content: string): Chapter {
  return {
    id,
    sequenceNumber,
    title: `Chương ${sequenceNumber}`,
    content,
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

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
        id: 'b1',
        stimulus: 'Chuông cửa vang.',
        perception: 'Nhân vật nghe thấy.',
        response: 'Nhân vật mở cửa.',
        consequence: 'Khách bước vào.',
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

describe('community grounded prose publish gate', () => {
  it('blocks a chapter with no durable PASS receipt', () => {
    const projectId = `publish-missing-${Date.now()}`;
    const chapters = [chapter('c1', 1, 'Nội dung chưa được gate.')];

    expect(() => assertPublishStoryGroundedProseReceipts(projectId, chapters, {
      chapters: [{ title: 'Chương 1', content: chapters[0].content }],
    })).toThrow(/no durable Grounded Prose PASS receipt/i);
  });

  it('blocks publish when shared prose differs from project prose', () => {
    const projectId = `publish-mismatch-${Date.now()}`;
    const chapters = [chapter('c1', 1, 'Bản đã kiểm tra.')];
    saveGroundedProseGateReceipt(projectId, 1, passGate(1, chapters[0].content));

    expect(() => assertPublishStoryGroundedProseReceipts(projectId, chapters, {
      chapters: [{ title: 'Chương 1', content: 'Bản đã bị sửa sau kiểm tra.' }],
    })).toThrow(/does not match any current project chapter/i);
  });

  it('allows exact prose with a clean PASS receipt', () => {
    const projectId = `publish-pass-${Date.now()}`;
    const chapters = [chapter('c1', 1, 'Gió qua hiên. Hắn khép cửa lại.')];
    saveGroundedProseGateReceipt(projectId, 1, passGate(1, chapters[0].content));

    expect(() => assertPublishStoryGroundedProseReceipts(projectId, chapters, {
      chapters: [{ title: 'Chương 1', content: chapters[0].content }],
    })).not.toThrow();
  });
});
