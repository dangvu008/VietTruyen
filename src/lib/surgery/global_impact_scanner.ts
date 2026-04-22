import { createId } from '../../core/id';
import {
  getEntityDependencies,
  getProjectArcs,
  getSurgerySpec,
  storeImpactScan,
  storeSurgerySpec,
} from '../../db/narrative_db';
import { getProjectSnapshot, useProjectStore } from '../../store/use_project_store';
import type {
  ImpactRecord,
  ImpactScanResult,
  RemovalDirective,
  SurgerySpec,
} from '../../types/surgery';
import type { Arc, Chapter, Project } from '../../types/story';
import { buildProjectIndex } from './dependency_indexer';
import {
  buildRecommendedAction,
  deriveReasonType,
  deriveSeverity,
  getArcForChapter,
  includesLoose,
  isClimaxLike,
} from './shared';

function getProjectTextCorpus(project: Project): string {
  return [
    project.logline,
    project.mainPlot,
    project.endgame,
    ...(project.outline || []).map((beat) => `${beat.title}\n${beat.summary}\n${beat.focus}`),
    ...(project.foreshadowings || []).map((item) => item.description),
  ]
    .filter(Boolean)
    .join('\n');
}

function createImpactRecord(params: {
  projectId: string;
  specId: string;
  directive: RemovalDirective;
  chapter: Chapter;
  arc?: Arc;
  reason: string;
  severity: ImpactRecord['severity'];
  reasonType: ImpactRecord['reasonType'];
}): ImpactRecord {
  return {
    id: createId(),
    projectId: params.projectId,
    specId: params.specId,
    directiveId: params.directive.id,
    targetLabel: params.directive.targetLabel,
    reasonType: params.reasonType,
    severity: params.severity,
    reason: params.reason,
    recommendedPolicy:
      params.directive.policy === 'hard_delete' && (params.severity === 'high' || params.severity === 'critical')
        ? 'replace_function'
        : params.directive.policy,
    recommendedAction: buildRecommendedAction(params.directive, params.severity, params.reasonType),
    arcId: params.arc?.id,
    chapterId: params.chapter.id,
    chapterIndex: params.chapter.sequenceNumber ?? 0,
    sourceChapterIds: [params.chapter.id],
    affectedEntityIds: params.directive.targetId ? [params.directive.targetId] : [],
  };
}

function searchDirectiveHits(project: Project, directive: RemovalDirective): Chapter[] {
  const chapters = project.chapters || [];
  return chapters.filter((chapter) => {
    const haystack = [
      chapter.title,
      chapter.summary || '',
      chapter.content.slice(0, 1200),
    ].join('\n');
    return includesLoose(haystack, directive.targetLabel);
  });
}

function collectForeshadowingRecords(project: Project, arcs: Arc[], spec: SurgerySpec, directive: RemovalDirective): ImpactRecord[] {
  const matching = (project.foreshadowings || []).filter((item) => {
    if (directive.targetId && item.relatedEntityId === directive.targetId) return true;
    return includesLoose(item.description, directive.targetLabel);
  });

  if (matching.length === 0) return [];

  const firstChapter = project.chapters[0];
  if (!firstChapter) return [];
  const firstArc = getArcForChapter(arcs, firstChapter.sequenceNumber ?? 1) || arcs[0];

  return matching.map((foreshadowing) =>
    createImpactRecord({
      projectId: project.id,
      specId: spec.id,
      directive,
      chapter: firstChapter,
      arc: firstArc,
      severity: 'medium',
      reasonType: 'foreshadowing',
      reason: `Phục bút "${foreshadowing.description}" đang bám vào "${directive.targetLabel}".`,
    })
  );
}

function collectDownstreamArcRecords(
  project: Project,
  arcs: Arc[],
  spec: SurgerySpec,
  directive: RemovalDirective,
  directRecords: ImpactRecord[]
): ImpactRecord[] {
  const impactedArcIds = new Set(directRecords.map((record) => record.arcId).filter(Boolean));
  const impactedArcs = arcs.filter((arc) => impactedArcIds.has(arc.id));
  if (impactedArcs.length === 0) return [];

  const coverage = impactedArcs.length / Math.max(1, arcs.length);
  const hasCritical = directRecords.some((record) => record.severity === 'critical');
  if (coverage <= 0.25 && !hasCritical) return [];

  const firstImpactIndex = Math.min(...impactedArcs.map((arc) => arc.index));
  const downstreamArcs = arcs.filter((arc) => arc.index >= firstImpactIndex && !impactedArcIds.has(arc.id));
  const chapterMap = new Map(project.chapters.map((chapter) => [chapter.id, chapter]));

  return downstreamArcs.map((arc) => {
    const seedChapter = chapterMap.get(arc.chapterIds[0]) || project.chapters[0];
    const severity = coverage > 0.5 ? 'high' : 'medium';
    return createImpactRecord({
      projectId: project.id,
      specId: spec.id,
      directive,
      chapter: seedChapter,
      arc,
      severity,
      reasonType: 'downstream',
      reason: `Sau khi bỏ "${directive.targetLabel}", exit state của ${arc.label} vẫn cần được viết lại để vá hệ quả dây chuyền.`,
    });
  });
}

function collectEndingCriticalRecord(project: Project, arcs: Arc[], spec: SurgerySpec, directive: RemovalDirective): ImpactRecord[] {
  const corpus = getProjectTextCorpus(project);
  if (!includesLoose(corpus, directive.targetLabel)) return [];

  const lastArc = arcs[arcs.length - 1];
  const lastChapter = project.chapters[project.chapters.length - 1];
  if (!lastArc || !lastChapter) return [];

  return [
    createImpactRecord({
      projectId: project.id,
      specId: spec.id,
      directive,
      chapter: lastChapter,
      arc: lastArc,
      severity: 'critical',
      reasonType: 'ending-critical',
      reason: `"${directive.targetLabel}" vẫn xuất hiện trong logline/main plot/endgame hoặc payoff cuối.`,
    }),
  ];
}

async function collectDirectiveRecords(
  project: Project,
  arcs: Arc[],
  spec: SurgerySpec,
  directive: RemovalDirective
): Promise<ImpactRecord[]> {
  const chapterCount = project.chapters.length;
  const directHits: ImpactRecord[] = [];

  if (directive.targetType === 'character' && directive.targetId) {
    const dependencies = await getEntityDependencies(project.id, directive.targetId);
    const chapterMap = new Map(project.chapters.map((chapter) => [chapter.id, chapter]));

    for (const dependency of dependencies) {
      const chapter = chapterMap.get(dependency.chapterId);
      if (!chapter) continue;
      const arc = getArcForChapter(arcs, dependency.chapterIndex);
      const severity = deriveSeverity({
        importance: dependency.importance,
        chapterIndex: dependency.chapterIndex,
        chapterCount,
        isEndgame: dependency.chapterIndex >= Math.ceil(chapterCount * 0.9),
        isClimaxHint: isClimaxLike([chapter.title, chapter.summary || '', dependency.context].join(' ')),
      });
      const reasonType = deriveReasonType({
        directive,
        severity,
        isEndgame: severity === 'critical',
      });
      directHits.push(
        createImpactRecord({
          projectId: project.id,
          specId: spec.id,
          directive,
          chapter,
          arc,
          severity,
          reasonType,
          reason: dependency.context || `Chương này dùng trực tiếp thông tin của "${directive.targetLabel}".`,
        })
      );
    }
  }

  if (directHits.length === 0) {
    const textHits = searchDirectiveHits(project, directive);
    for (const chapter of textHits) {
      const severity = deriveSeverity({
        chapterIndex: chapter.sequenceNumber ?? 0,
        chapterCount,
        isEndgame: (chapter.sequenceNumber ?? 0) >= Math.ceil(chapterCount * 0.9),
        isClimaxHint: isClimaxLike([chapter.title, chapter.summary || ''].join(' ')),
      });
      directHits.push(
        createImpactRecord({
          projectId: project.id,
          specId: spec.id,
          directive,
          chapter,
          arc: getArcForChapter(arcs, chapter.sequenceNumber ?? 0),
          severity,
          reasonType: deriveReasonType({ directive, severity, isEndgame: severity === 'critical' }),
          reason: `Tìm thấy nhắc tới "${directive.targetLabel}" trong tiêu đề hoặc tóm tắt chương.`,
        })
      );
    }
  }

  const deduped = new Map<string, ImpactRecord>();
  for (const record of directHits) {
    deduped.set(`${record.directiveId}:${record.chapterId}:${record.reasonType}`, record);
  }

  const records = Array.from(deduped.values());
  return [
    ...records,
    ...collectForeshadowingRecords(project, arcs, spec, directive),
    ...collectDownstreamArcRecords(project, arcs, spec, directive, records),
    ...collectEndingCriticalRecord(project, arcs, spec, directive),
  ];
}

export async function runGlobalImpactScan(projectId: string, specId: string): Promise<ImpactScanResult> {
  const project = await getProjectSnapshot(projectId);
  if (!project) {
    throw new Error('Không tìm thấy dự án để quét impact.');
  }

  const spec = await getSurgerySpec(specId);
  if (!spec) {
    throw new Error('Không tìm thấy Surgery Spec.');
  }

  let arcs = await getProjectArcs(projectId);
  if (arcs.length === 0) {
    arcs = (await buildProjectIndex(projectId)).arcs;
  }

  const allRecords: ImpactRecord[] = [];
  const blockedDirectiveIds: string[] = [];
  const blockedReasons: string[] = [];

  for (const directive of spec.directives) {
    const directiveRecords = await collectDirectiveRecords(project, arcs, spec, directive);
    allRecords.push(...directiveRecords);

    const impactedArcIds = new Set(directiveRecords.map((record) => record.arcId).filter(Boolean));
    const coverage = impactedArcIds.size / Math.max(1, arcs.length);
    const hasCritical = directiveRecords.some((record) => record.severity === 'critical');
    const mustReplace = directive.policy === 'hard_delete' && (coverage > 0.25 || hasCritical);

    if (mustReplace) {
      blockedDirectiveIds.push(directive.id);
      blockedReasons.push(
        `"${directive.targetLabel}" phủ ${Math.round(coverage * 100)}% số arc hoặc đã chạm endgame; không thể hard delete an toàn.`
      );
    }
  }

  const impactedArcIds = Array.from(new Set(allRecords.map((record) => record.arcId).filter(Boolean))) as string[];
  const impactedChapterIds = Array.from(new Set(allRecords.map((record) => record.chapterId).filter(Boolean))) as string[];
  const summary = {
    totalRecords: allRecords.length,
    directHits: allRecords.filter((record) => record.reasonType === 'direct' || record.reasonType === 'causal').length,
    criticalHits: allRecords.filter((record) => record.severity === 'critical').length,
    impactedArcCount: impactedArcIds.length,
    impactedChapterCount: impactedChapterIds.length,
  };

  const scan: ImpactScanResult = {
    id: createId(),
    projectId,
    specId,
    status: blockedDirectiveIds.length > 0 ? 'blocked' : 'ready',
    summary,
    impactedArcIds,
    impactedChapterIds,
    blockedDirectiveIds,
    records: allRecords.sort((left, right) => left.chapterIndex - right.chapterIndex),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await storeImpactScan(scan);
  await storeSurgerySpec({
    ...spec,
    status: 'scanned',
    scanId: scan.id,
    blockedReasons,
    updatedAt: new Date().toISOString(),
  });

  useProjectStore.getState().updateProject(projectId, {
    activeSurgerySpecId: spec.id,
    lastImpactScanId: scan.id,
  });

  return scan;
}
