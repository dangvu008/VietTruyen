/**
 * File: outline_planner.ts
 * Purpose: AI-powered 3-tier outline generation (总纲 → 卷纲 → 章纲)
 * Layer: Application (AI)
 * Domain: Planning → [master outline, volume outline, chapter outline]
 *
 * Data Contract:
 * - Input:  Project bible (genre, logline, characters, world) + tier configuration
 * - Output: MasterOutline | VolumeOutline | ChapterOutline[]
 * - Consumer: OutlinePage.tsx → project store
 *
 * Flow: Gather project context → Build prompt for tier → AI generates → Parse JSON → Return
 * Refusal rule: Missing logline or genre → throw with guidance
 * Edge Cases: AI returns fewer volumes/chapters than requested → pad with placeholders
 * Domain Map Ref: OUTLINE-PLANNER-v1
 */

import type {
  Project,
  MasterOutline,
  VolumeOutline,
  ChapterOutline,
} from '../../types/story';
import { callAiModelTracked } from './tracked_ai_client';
import { getModelForTask } from './model_router';
import { useAiStore } from '../../store/use_ai_store';
import { createId } from '../../core/id';
import { quickTruncate } from './token_estimator';

// ─── System Prompts ─────────────────────────────────────

const MASTER_OUTLINE_SYSTEM = `Bạn là nhà quy hoạch cốt truyện cấp cao cho tiểu thuyết mạng.
Nhiệm vụ: Tạo TỔNG CƯƠNG (总纲) — bản thiết kế tổng thể cho toàn bộ truyện.
Quy tắc:
- Chia truyện thành các QUYỂN (volumes) hợp lý
- Mỗi quyển có premise → escalation → climax → exit state
- Xác định 3-Act Structure: Kết thúc Hồi 1, Midpoint Hồi 2, Kết thúc Hồi 2
- Đảm bảo arc progression liên tục, không có volume "filler"
- LUÔN trả về JSON hợp lệ. Không markdown, không giải thích ngoài JSON.`;

const VOLUME_OUTLINE_SYSTEM = `Bạn là Biên kịch chuyên chia chapter cho tiểu thuyết mạng.
Nhiệm vụ: Tạo QUYỂN CƯƠNG (卷纲) — phân chia chi tiết từng chương trong 1 quyển.
Quy tắc:
- Mỗi chương phải có mục tiêu rõ ràng, xung đột, và hooks
- Đảm bảo escalation dần đều, climax đúng vị trí
- Hook cuối mỗi chương phải kéo sang chương sau
- LUÔN trả về JSON hợp lệ.`;

const CHAPTER_OUTLINE_SYSTEM = `Bạn là Đạo diễn cảnh cho tiểu thuyết mạng.
Nhiệm vụ: Tạo CHƯƠNG CƯƠNG (章纲) chi tiết cho 1 chương cụ thể.
Quy tắc:
- Chia thành beats: Opening → Development → Turning Point → Cliffhanger
- Xác định nhân vật on-stage, cảm xúc, và power level
- LUÔN trả về JSON hợp lệ.`;

// ─── Resolvers ──────────────────────────────────────────

async function resolveModel() {
  const aiStore = useAiStore.getState();
  const model = getModelForTask(
    'plan_chapter',
    aiStore.models,
    undefined,
    aiStore.activeModelId,
    aiStore.taskModelOverrides
  );
  if (!model) throw new Error('Không tìm thấy AI model cho lập dàn ý.');
  return model;
}

function cleanJson(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
}

// ─── Master Outline (总纲) ──────────────────────────────

export async function generateMasterOutline(project: Project): Promise<MasterOutline> {
  if (!project.logline && !project.mainPlot) {
    throw new Error('Cần có logline hoặc cốt truyện chính để tạo tổng cương.');
  }

  const model = await resolveModel();
  const now = new Date().toISOString();

  const userPrompt = `Tạo TỔNG CƯƠNG cho truyện:

THÔNG TIN DỰ ÁN:
- Tên: ${project.title}
- Thể loại: ${project.genre}
- Logline: ${quickTruncate(project.logline || project.mainPlot, 300)}
- Kết thúc dự kiến: ${quickTruncate(project.endgame || 'Chưa xác định', 200)}
- Tổng chương dự kiến: ${project.targetChapters || 100}
- Phong cách: ${project.writingStyle || 'Không rõ'}
- Giọng văn: ${project.tone || 'Không rõ'}

NHÂN VẬT CHÍNH:
${project.characters.slice(0, 5).map(c => `- ${c.name} (${c.role}): ${quickTruncate(c.traits, 80)}`).join('\n') || '(Chưa có)'}

THẾ GIỚI:
${quickTruncate(project.worldSetting || project.world?.geography || '', 200)}

Trả về JSON:
{
  "totalVolumes": 5,
  "totalChapters": ${project.targetChapters || 100},
  "logline": "Tóm tắt 1 câu toàn bộ truyện",
  "threeActStructure": {
    "act1End": 25,
    "act2Midpoint": 50,
    "act2End": 75
  },
  "volumes": [
    {
      "volumeIndex": 0,
      "title": "Tên quyển 1",
      "premise": "Tiền đề quyển",
      "escalation": "Leo thang",
      "climax": "Cao trào",
      "exitState": "Trạng thái kết thúc quyển",
      "chapterRange": [1, 20]
    }
  ]
}`;

  const response = await callAiModelTracked({
    provider: model.provider,
    modelId: model.modelId,
    modelName: model.name,
    baseUrl: model.baseUrl,
    systemPrompt: MASTER_OUTLINE_SYSTEM,
    userPrompt,
    taskType: 'plan_chapter',
    responseFormat: 'json_object',
  });

  const parsed = JSON.parse(cleanJson(response));

  return {
    id: createId(),
    projectId: project.id,
    totalChapters: parsed.totalChapters || project.targetChapters || 100,
    totalVolumes: parsed.totalVolumes || parsed.volumes?.length || 3,
    logline: String(parsed.logline || project.logline),
    threeActStructure: {
      act1End: parsed.threeActStructure?.act1End || 25,
      act2Midpoint: parsed.threeActStructure?.act2Midpoint || 50,
      act2End: parsed.threeActStructure?.act2End || 75,
    },
    volumes: (parsed.volumes || []).map((v: any, i: number) => ({
      id: createId(),
      volumeIndex: v.volumeIndex ?? i,
      title: String(v.title || `Quyển ${i + 1}`),
      premise: String(v.premise || ''),
      escalation: String(v.escalation || ''),
      climax: String(v.climax || ''),
      exitState: String(v.exitState || ''),
      chapterRange: Array.isArray(v.chapterRange) ? v.chapterRange : [1, 20],
      chapters: [],
    })),
    createdAt: now,
    updatedAt: now,
  };
}

// ─── Volume Outline (卷纲) ──────────────────────────────

export async function generateVolumeOutline(
  project: Project,
  masterOutline: MasterOutline,
  volumeIndex: number,
): Promise<VolumeOutline> {
  const volume = masterOutline.volumes[volumeIndex];
  if (!volume) throw new Error(`Volume ${volumeIndex} không tồn tại trong tổng cương.`);

  const model = await resolveModel();
  const [chStart, chEnd] = volume.chapterRange;
  const chapterCount = chEnd - chStart + 1;

  const userPrompt = `Tạo QUYỂN CƯƠNG chi tiết cho:

TRUYỆN: ${project.title} (${project.genre})
QUYỂN ${volumeIndex + 1}: "${volume.title}"
- Tiền đề: ${volume.premise}
- Leo thang: ${volume.escalation}
- Cao trào: ${volume.climax}
- Kết thúc: ${volume.exitState}
- Phạm vi: Chương ${chStart} - ${chEnd} (${chapterCount} chương)

NHÂN VẬT CHÍNH:
${project.characters.slice(0, 5).map(c => `- ${c.name}: ${quickTruncate(c.traits, 60)}`).join('\n')}

Trả về JSON:
{
  "chapters": [
    {
      "chapterNumber": ${chStart},
      "title": "Tên chương",
      "summary": "Tóm tắt nội dung chương (2-3 câu)",
      "conflict": "Xung đột chính",
      "focus": "Nhân vật trọng tâm",
      "hooks": ["Hook cuối chương"],
      "wordCountTarget": 3000
    }
  ]
}

Tạo đủ ${chapterCount} chương, từ chương ${chStart} đến ${chEnd}.`;

  const response = await callAiModelTracked({
    provider: model.provider,
    modelId: model.modelId,
    modelName: model.name,
    baseUrl: model.baseUrl,
    systemPrompt: VOLUME_OUTLINE_SYSTEM,
    userPrompt,
    taskType: 'plan_chapter',
    responseFormat: 'json_object',
  });

  const parsed = JSON.parse(cleanJson(response));

  const chapters: ChapterOutline[] = (parsed.chapters || []).map((ch: any, i: number) => ({
    id: createId(),
    chapterNumber: ch.chapterNumber ?? chStart + i,
    title: String(ch.title || `Chương ${chStart + i}`),
    summary: String(ch.summary || ''),
    conflict: String(ch.conflict || ''),
    focus: String(ch.focus || ''),
    hooks: Array.isArray(ch.hooks) ? ch.hooks.map(String) : [],
    wordCountTarget: ch.wordCountTarget || 3000,
  }));

  // Pad if AI returned fewer chapters
  while (chapters.length < chapterCount) {
    const nextNum = chStart + chapters.length;
    chapters.push({
      id: createId(),
      chapterNumber: nextNum,
      title: `Chương ${nextNum}`,
      summary: '',
      conflict: '',
      focus: '',
      hooks: [],
      wordCountTarget: 3000,
    });
  }

  return {
    ...volume,
    chapters: chapters.slice(0, chapterCount),
  };
}

// ─── Chapter Outline (章纲) ─────────────────────────────

export interface DetailedChapterOutline extends ChapterOutline {
  beats: {
    type: 'opening' | 'development' | 'turning_point' | 'cliffhanger';
    description: string;
    emotion: string;
  }[];
  charactersOnStage: string[];
  estimatedPacing: 'slow' | 'medium' | 'fast';
}

export async function generateDetailedChapterOutline(
  project: Project,
  chapterOutline: ChapterOutline,
  volumeContext: VolumeOutline,
): Promise<DetailedChapterOutline> {
  const model = await resolveModel();

  const userPrompt = `Tạo CHƯƠNG CƯƠNG chi tiết cho:

TRUYỆN: ${project.title} (${project.genre})
QUYỂN: "${volumeContext.title}"
CHƯƠNG ${chapterOutline.chapterNumber}: "${chapterOutline.title}"
- Tóm tắt: ${chapterOutline.summary}
- Xung đột: ${chapterOutline.conflict}
- Trọng tâm: ${chapterOutline.focus}
- Hooks: ${chapterOutline.hooks.join(', ') || 'Chưa có'}

NHÂN VẬT:
${project.characters.slice(0, 5).map(c => `- ${c.name} (${c.role})`).join('\n')}

Trả về JSON:
{
  "beats": [
    { "type": "opening", "description": "Mở đầu: ...", "emotion": "tò mò" },
    { "type": "development", "description": "Phát triển: ...", "emotion": "hồi hộp" },
    { "type": "turning_point", "description": "Bước ngoặt: ...", "emotion": "sốc" },
    { "type": "cliffhanger", "description": "Kết thúc treo: ...", "emotion": "khao khát" }
  ],
  "charactersOnStage": ["Tên nhân vật 1", "Tên nhân vật 2"],
  "estimatedPacing": "medium"
}`;

  const response = await callAiModelTracked({
    provider: model.provider,
    modelId: model.modelId,
    modelName: model.name,
    baseUrl: model.baseUrl,
    systemPrompt: CHAPTER_OUTLINE_SYSTEM,
    userPrompt,
    taskType: 'plan_chapter',
    responseFormat: 'json_object',
  });

  const parsed = JSON.parse(cleanJson(response));

  return {
    ...chapterOutline,
    beats: (parsed.beats || []).map((b: any) => ({
      type: b.type || 'development',
      description: String(b.description || ''),
      emotion: String(b.emotion || ''),
    })),
    charactersOnStage: Array.isArray(parsed.charactersOnStage)
      ? parsed.charactersOnStage.map(String)
      : [],
    estimatedPacing: parsed.estimatedPacing || 'medium',
  };
}
