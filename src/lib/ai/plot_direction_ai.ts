/**
 * File: plot_direction_ai.ts
 * Purpose: Ask AI for 2-3 viable plot directions before committing a Surgery rewrite
 * Layer: Application (AI)
 * Domain: Surgery -> [plot direction preview, decision support]
 */
import { callAiModelTracked } from './tracked_ai_client';
import type { AiModel, Arc, Project } from '../../types/story';
import type { ImpactRecord, ImpactScanResult, SurgerySpec } from '../../types/surgery';
import type {
  PlotDirectionOption,
  PlotDirectionPreviewResult,
  PlotDirectionRisk,
  PlotDirectionStance,
} from '../../types/plot_direction';

export interface PlotDirectionAnalysisInput {
  project: Project;
  spec: SurgerySpec;
  scan: ImpactScanResult;
  arcs: Arc[];
}

interface AnalyzePlotDirectionsParams extends PlotDirectionAnalysisInput {
  activeModel: AiModel;
}

const VALID_STANCES = new Set<PlotDirectionStance>(['preserve', 'pivot', 'twist', 'experimental']);
const VALID_RISKS = new Set<PlotDirectionRisk>(['low', 'medium', 'high']);

function trimText(input: string | undefined, maxLength: number): string {
  if (!input) return '';
  const clean = input.replace(/\s+/g, ' ').trim();
  return clean.length > maxLength ? `${clean.slice(0, maxLength - 1)}…` : clean;
}

function compactRecord(record: ImpactRecord): string {
  return [
    `Ch ${record.chapterIndex}`,
    record.reasonType,
    record.severity,
    record.targetLabel,
    trimText(record.reason, 220),
    `Action: ${trimText(record.recommendedAction, 180)}`,
  ]
    .filter(Boolean)
    .join(' | ');
}

function pickRepresentativeRecords(records: ImpactRecord[]): ImpactRecord[] {
  const severityRank: Record<ImpactRecord['severity'], number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  return records
    .slice()
    .sort((left, right) => severityRank[left.severity] - severityRank[right.severity] || left.chapterIndex - right.chapterIndex)
    .slice(0, 10);
}

export function buildPlotDirectionSystemPrompt(): string {
  return [
    'You are a Vietnamese long-form webnovel story architect.',
    'Help the writer decide whether a requested plot surgery should proceed and which direction it should take.',
    'Return concise Vietnamese JSON only. No markdown.',
    'Respect the current genre/register; avoid modern technical phrasing unless the story already uses it.',
  ].join(' ');
}

export function buildPlotDirectionUserPrompt(input: PlotDirectionAnalysisInput): string {
  const directives = input.spec.directives.map((directive) => ({
    target: directive.targetLabel,
    type: directive.targetType,
    policy: directive.policy,
    effectiveFromChapter: directive.effectiveFromChapter,
    notes: directive.notes,
  }));
  const arcSummaries = input.arcs.slice(0, 8).map((arc) => (
    `${arc.label} (${arc.chapterStart}-${arc.chapterEnd}): ${trimText(arc.summary || arc.exitState || arc.premise, 260)}`
  ));
  const impactRecords = pickRepresentativeRecords(input.scan.records).map(compactRecord);
  const unresolvedForeshadowing = (input.project.foreshadowings || [])
    .filter((item) => !item.isResolved)
    .slice(0, 8)
    .map((item) => trimText(item.description, 160));
  const outline = (input.project.outline || [])
    .slice(0, 8)
    .map((beat) => `${beat.title}: ${trimText(beat.summary || beat.focus, 180)}`);

  return `PROJECT
Title: ${input.project.title}
Genre: ${input.project.genre}
Logline: ${trimText(input.project.logline, 360)}
Main plot: ${trimText(input.project.mainPlot, 520)}
Endgame: ${trimText(input.project.endgame, 360)}

SURGERY REQUEST
Spec: ${input.spec.title}
Description: ${trimText(input.spec.description, 360)}
Directives: ${JSON.stringify(directives)}
Blocked reasons: ${JSON.stringify(input.spec.blockedReasons || [])}

IMPACT SUMMARY
Records: ${input.scan.summary.totalRecords}
Direct/causal hits: ${input.scan.summary.directHits}
Critical hits: ${input.scan.summary.criticalHits}
Impacted arcs: ${input.scan.summary.impactedArcCount}
Impacted chapters: ${input.scan.summary.impactedChapterCount}

REPRESENTATIVE IMPACTS
${impactRecords.join('\n') || '(none)'}

CURRENT ARCS
${arcSummaries.join('\n') || '(no arc index)'}

OUTLINE BEATS
${outline.join('\n') || '(none)'}

UNRESOLVED FORESHADOWING
${unresolvedForeshadowing.join('\n') || '(none)'}

Return JSON with this shape:
{
  "decisionSummary": "1-2 Vietnamese sentences explaining whether the change is safe and what the writer must decide.",
  "directions": [
    {
      "id": "short_id",
      "title": "Vietnamese option title",
      "stance": "preserve | pivot | twist | experimental",
      "summary": "What the story becomes if this option is chosen.",
      "riskLevel": "low | medium | high",
      "affectedRange": "Estimated chapter/arc range",
      "rewritePolicy": "hard_delete | merge_role | replace_function | downgrade_presence | branch_earlier | review",
      "downstreamImpact": ["2-4 concrete consequences"],
      "tradeoffs": ["1-3 costs or lost opportunities"],
      "whyChoose": "When this is the right choice"
    }
  ]
}

Rules:
- Return exactly 2 or 3 directions.
- At least one direction should preserve most current canon.
- If the scan is blocked or critical, include one safer alternative to hard delete.
- Do not write replacement prose; this is a decision preview, not the rewrite.`;
}

function extractJsonObject(text: string): string {
  const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace < 0 || lastBrace <= firstBrace) {
    throw new Error('AI không trả về JSON hướng cốt truyện hợp lệ.');
  }
  return cleaned.slice(firstBrace, lastBrace + 1);
}

function normalizeDirection(raw: Partial<PlotDirectionOption>, index: number): PlotDirectionOption {
  const title = String(raw.title || `Hướng ${index + 1}`).trim();
  const stance = VALID_STANCES.has(raw.stance as PlotDirectionStance)
    ? raw.stance as PlotDirectionStance
    : 'experimental';
  const riskLevel = VALID_RISKS.has(raw.riskLevel as PlotDirectionRisk)
    ? raw.riskLevel as PlotDirectionRisk
    : 'medium';

  return {
    id: String(raw.id || `${stance}_${index + 1}`).trim(),
    title,
    stance,
    summary: String(raw.summary || '').trim(),
    riskLevel,
    affectedRange: String(raw.affectedRange || 'Cần rà soát thêm').trim(),
    rewritePolicy: raw.rewritePolicy || 'review',
    downstreamImpact: Array.isArray(raw.downstreamImpact) ? raw.downstreamImpact.map(String).filter(Boolean) : [],
    tradeoffs: Array.isArray(raw.tradeoffs) ? raw.tradeoffs.map(String).filter(Boolean) : [],
    whyChoose: String(raw.whyChoose || 'Chọn khi hướng này khớp ý đồ tác giả.').trim(),
  };
}

export function parsePlotDirectionResponse(responseText: string): PlotDirectionPreviewResult {
  const parsed = JSON.parse(extractJsonObject(responseText)) as Partial<PlotDirectionPreviewResult>;
  const directions = Array.isArray(parsed.directions)
    ? parsed.directions
        .map((direction, index) => normalizeDirection(direction, index))
        .filter((direction) => direction.summary && direction.title)
        .slice(0, 3)
    : [];

  if (directions.length < 2) {
    throw new Error('AI cần trả về ít nhất 2 hướng cốt truyện để người dùng chọn.');
  }

  return {
    decisionSummary: String(parsed.decisionSummary || 'Hãy chọn một hướng cốt truyện trước khi tạo hàng chờ viết lại.').trim(),
    directions,
  };
}

export async function analyzePlotDirections(params: AnalyzePlotDirectionsParams): Promise<PlotDirectionPreviewResult> {
  const response = await callAiModelTracked({
    provider: params.activeModel.provider,
    modelId: params.activeModel.modelId,
    modelName: params.activeModel.name,
    baseUrl: params.activeModel.baseUrl,
    systemPrompt: buildPlotDirectionSystemPrompt(),
    userPrompt: buildPlotDirectionUserPrompt(params),
    taskType: 'analyze_retcon',
    responseFormat: 'json_object',
  });

  return parsePlotDirectionResponse(response);
}
