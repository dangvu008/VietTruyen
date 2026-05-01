import type { SceneCard, SceneMindState } from '../../types/ghostwriter';
import type { Project } from '../../types/story';
import type { SceneTypeResult } from './scene_type_classifier';
import type { MemoryRouteResult } from './scene_memory_router';

function buildConflictBeat(sceneType: SceneTypeResult, beatSummary: string, fear: string): string {
  if (beatSummary.trim()) {
    return `${beatSummary}. Xung đột tức thời phải chạm đúng nỗi sợ: ${fear}`;
  }

  switch (sceneType.primary) {
    case 'combat':
      return `Đẩy cảnh theo áp lực ra đòn và phản đòn, buộc nhân vật trả giá trước khi có lợi thế.`;
    case 'emotion':
      return `Xung đột phải hiện ra qua điều không nói thẳng, không giải quyết bằng lời thú nhận sạch sẽ.`;
    case 'intrigue':
      return `Mỗi nhịp trao đổi phải làm tăng độ nghi ngờ hoặc khóa thêm một đường lui.`;
    default:
      return `Cảnh phải tạo thêm áp lực thay vì chỉ tóm tắt thông tin đã biết.`;
  }
}

export function buildSceneCard(
  project: Project,
  targetChapterIndex: number,
  sceneType: SceneTypeResult,
  route: MemoryRouteResult,
  mindState: SceneMindState
): SceneCard {
  const beat = project.outline?.[targetChapterIndex];
  const reveal = [beat?.focus, beat?.summary].filter(Boolean) as string[];
  const motifTargets = route.boostKeywords.slice(0, 3);

  return {
    sceneId: beat?.id || `scene-${targetChapterIndex + 1}`,
    intent: 'writing_scene',
    purpose: beat?.title || `Triển khai cảnh ${targetChapterIndex + 1} theo đúng canon hiện tại`,
    conflictBeat: buildConflictBeat(sceneType, beat?.summary || '', mindState.fear),
    reveal,
    withhold: [
      'Không giải thích hết động cơ ngay ở câu đầu.',
      'Không xả toàn bộ thông tin nền bằng độc thoại tóm tắt.',
    ],
    motifTargets,
    continuityObligations: [
      `Giữ đúng beat hiện tại: ${beat?.title || 'không lệch mục tiêu cảnh'}`,
      `Không phá canon hoặc trạng thái nhân vật đã xác lập.`,
    ],
    exitState: `Kết cảnh khi áp lực tăng lên hoặc một thông tin nhỏ đổi thế cờ, chưa xả hết payoff.`,
  };
}

export function renderSceneCardSection(card: SceneCard): string {
  const lines = [
    '## KẾ HOẠCH CẢNH GHOSTWRITER',
    `- Mục tiêu cảnh: ${card.purpose}`,
    `- Xung đột nhịp chính: ${card.conflictBeat}`,
    `- Phải hé lộ: ${card.reveal.join(' | ') || 'Ít nhất một thay đổi trạng thái có thể quan sát.'}`,
    `- Phải giữ lại: ${card.withhold.join(' | ')}`,
    `- Motif ưu tiên: ${card.motifTargets.join(' | ') || 'Không bắt buộc.'}`,
    `- Nghĩa vụ continuity: ${card.continuityObligations.join(' | ')}`,
    `- Exit state: ${card.exitState}`,
  ];

  return lines.join('\n');
}
