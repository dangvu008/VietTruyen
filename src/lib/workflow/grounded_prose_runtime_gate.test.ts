import { describe, expect, it } from 'vitest';
import {
  buildGroundedProseHash,
  evaluateGroundedProseRuntimeGate,
} from './grounded_prose_runtime_gate';
import {
  GROUNDED_PROSE_CAUSALITY_SCHEMA,
  GROUNDED_PROSE_COLD_READER_SCHEMA,
  GROUNDED_PROSE_LINE_AUDIT_SCHEMA,
  type BlindColdReaderArtifact,
  type CausalitySkeletonArtifact,
  type LineAuditArtifact,
} from '../../types/grounded_prose';

function makeArtifacts() {
  const proseHash = buildGroundedProseHash('Lục Trầm mở cửa. Gió lạnh lùa vào. Hắn kéo áo rồi bước ra.');
  const causalitySkeleton: CausalitySkeletonArtifact = {
    schemaVersion: GROUNDED_PROSE_CAUSALITY_SCHEMA,
    chapterNumber: 1,
    proseHash,
    pass: true,
    blockers: [],
    beats: [
      {
        id: 'beat-1',
        stimulus: 'Gió lạnh lùa vào khi cửa mở.',
        perception: 'Lục Trầm cảm nhận cái lạnh.',
        response: 'Hắn kéo áo.',
        consequence: 'Hắn bước ra ngoài trong trạng thái đã phản ứng với thời tiết.',
      },
    ],
  };
  const coldReader: BlindColdReaderArtifact = {
    schemaVersion: GROUNDED_PROSE_COLD_READER_SCHEMA,
    chapterNumber: 1,
    proseHash,
    pass: true,
    blockers: [],
    findings: [],
  };
  const lineAudit: LineAuditArtifact = {
    schemaVersion: GROUNDED_PROSE_LINE_AUDIT_SCHEMA,
    chapterNumber: 1,
    proseHash,
    pass: true,
    blockers: [],
    verdicts: [],
  };
  return { proseHash, causalitySkeleton, coldReader, lineAudit };
}

describe('evaluateGroundedProseRuntimeGate', () => {
  it('passes only when all required artifacts are present and consistent', () => {
    const artifacts = makeArtifacts();
    expect(evaluateGroundedProseRuntimeGate({ chapterNumber: 1, ...artifacts })).toEqual([]);
  });

  it('fails closed when any artifact is missing', () => {
    const artifacts = makeArtifacts();
    const blockers = evaluateGroundedProseRuntimeGate({
      chapterNumber: 1,
      proseHash: artifacts.proseHash,
      causalitySkeleton: null,
      coldReader: artifacts.coldReader,
      lineAudit: artifacts.lineAudit,
    });
    expect(blockers).toContain('missing_causality_skeleton');
  });

  it('rejects stale artifacts whose prose hash no longer matches', () => {
    const artifacts = makeArtifacts();
    artifacts.coldReader.proseHash = 'stale-hash';
    const blockers = evaluateGroundedProseRuntimeGate({ chapterNumber: 1, ...artifacts });
    expect(blockers).toContain('cold_reader_stale_prose_hash');
  });

  it('rejects causality beats with missing causal links', () => {
    const artifacts = makeArtifacts();
    artifacts.causalitySkeleton.beats[0].stimulus = '';
    const blockers = evaluateGroundedProseRuntimeGate({ chapterNumber: 1, ...artifacts });
    expect(blockers).toContain('causality_missing_stimulus:beat-1');
  });

  it('rejects high-severity cold-reader findings even if the line auditor tries to keep them', () => {
    const artifacts = makeArtifacts();
    artifacts.coldReader.findings = [
      {
        id: 'f-1',
        category: 'semantic_opacity',
        severity: 'high',
        excerpt: 'Con đường không chịu giống trong trí nhớ.',
        reason: 'Cold reader cannot resolve the intended literal meaning naturally.',
      },
    ];
    artifacts.lineAudit.verdicts = [
      {
        findingId: 'f-1',
        action: 'KEEP_WITH_REASON',
        reason: 'The road description contrasts memory with present perception.',
        sceneFunction: 'contrast',
      },
    ];
    const blockers = evaluateGroundedProseRuntimeGate({ chapterNumber: 1, ...artifacts });
    expect(blockers).toContain('cold_reader_high:f-1');
  });

  it('rejects DELETE or REWRITE verdicts until the fix is actually applied to prose', () => {
    const artifacts = makeArtifacts();
    artifacts.coldReader.findings = [
      {
        id: 'f-2',
        category: 'decorative_glue',
        severity: 'medium',
        excerpt: 'Cảm giác ấy quá rõ ràng.',
        reason: 'The sentence adds forced interpretation without a scene-level cause.',
      },
    ];
    artifacts.lineAudit.pass = false;
    artifacts.lineAudit.blockers = ['rewrite_required'];
    artifacts.lineAudit.verdicts = [
      {
        findingId: 'f-2',
        action: 'DELETE',
        reason: 'Deleting the sentence loses no causal information.',
      },
    ];
    const blockers = evaluateGroundedProseRuntimeGate({ chapterNumber: 1, ...artifacts });
    expect(blockers).toContain('line_audit_unapplied_delete:f-2');
  });

  it('requires exactly one line-audit verdict per cold-reader finding', () => {
    const artifacts = makeArtifacts();
    artifacts.coldReader.findings = [
      {
        id: 'f-3',
        category: 'behavior_template_feel',
        severity: 'medium',
        excerpt: 'Hắn không lập tức đứng dậy.',
        reason: 'This reads like a repeated cautious-main-character template.',
      },
    ];
    const blockers = evaluateGroundedProseRuntimeGate({ chapterNumber: 1, ...artifacts });
    expect(blockers).toContain('line_audit_missing_finding:f-3');
  });
});
