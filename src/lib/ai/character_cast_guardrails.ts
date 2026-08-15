import type { Project } from '../../types/story';
import { assertEraRegisterConfigured } from './era_register_setup_gate';

type OutlineGuardrailScope = 'master' | 'volume' | 'chapter';

function compactText(value: string, maxLength = 140): string {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
}

function formatCast(project: Project, limit = 4): string {
  const cast = (project.characters || [])
    .slice(0, limit)
    .map((character) => `${character.name} (${character.role || 'chưa rõ vai'})`);

  return cast.length > 0 ? cast.join(', ') : 'chưa có cast lõi';
}

function formatForeshadowings(project: Project, limit = 2): string {
  const items = (project.foreshadowings || [])
    .filter((foreshadowing) => !foreshadowing.isResolved)
    .slice(0, limit)
    .map((foreshadowing) => compactText(foreshadowing.description, 110));

  return items.length > 0 ? items.join(' | ') : 'chưa có foreshadowing mở nổi bật';
}

function renderRuleBlock(title: string, lines: string[]): string {
  return [`## ${title}`, ...lines].join('\n');
}

export function buildCreationCharacterGuardrails(): string {
  return renderRuleBlock('FRAMEWORK SETUP HARD REQUIREMENTS', [
    '- Cast khởi đầu phải đủ sống động nhưng không thêm cho đủ quân số.',
    '- Hãy ưu tiên một cast lõi gọn, sau đó phân vai rõ cho từng người.',
    '- Nhân vật nên phủ được 3 nhóm chức năng: plot (đẩy cốt truyện), world (làm dày thế giới), emotional (tạo cảm xúc và điểm nhớ).',
    '- Nhân vật phụ không chỉ để gây xung đột; họ có thể là điểm nhấn không khí, phản chiếu nhân vật chính, hoặc giữ nhịp cảm xúc.',
    '- Không tạo hồ sơ riêng cho crowd character chỉ xuất hiện trang trí. Nếu một người chỉ lướt qua cho đủ cảnh, hãy để họ vô danh.',
    '- Mỗi nhân vật có tên phải có lý do tồn tại, mối liên hệ với cast lõi, và ảnh hưởng còn lại sau lần xuất hiện đầu tiên.',
    '- MANDATORY: bible.genre phải có đúng một primary genre; bible.subGenre chỉ chứa secondary genres đã được chọn hoặc đề xuất rõ là Candidate.',
    '- MANDATORY: bible.writingStyle phải là một hướng rộng, không phải thông số nhịp câu/đoạn, tỷ lệ miêu tả–đối thoại–nội tâm hoặc cường độ cảm xúc.',
    '- MANDATORY: bible.narrativeEraRegister phải có shape { frame, notes }.',
    '- frame chỉ được là contemporary | near_premodern | period | future | timeless_fantasy | mixed | custom.',
    '- Không output level, narratorLevel, dialogueLevel hoặc thoughtLevel; legacy intensity fields không còn là setup contract.',
    '- AI chỉ được đề xuất. Người viết phải review/xác nhận framework trước khi project_seed promote thành project truth.',
    '- Không hardcode frame theo thể loại: tiên hiệp, lịch sử, đô thị hoặc khoa huyễn đều không tự quyết định cách chính văn phải nghe.',
    '- World Period/techLevel mô tả thế giới có gì; Narrative Era Register mô tả văn bản nghe thuộc thời đại nào. Không được gộp hai khái niệm này.',
  ]);
}

export function buildOutlineCharacterGuardrails(
  project: Project,
  scope: OutlineGuardrailScope,
  rangeLabel?: string,
): string {
  // Setup/F0 invariant: outline generation may suggest an Era Register, but it may not
  // proceed until the per-story setting has been explicitly confirmed.
  assertEraRegisterConfigured(project, 'outline');

  const scopeLabelMap: Record<OutlineGuardrailScope, string> = {
    master: 'toàn truyện',
    volume: 'quyển/arc này',
    chapter: 'chương này',
  };

  const lines = [
    `- Bối cảnh planning: ${scopeLabelMap[scope]}. Cast lõi hiện có: ${formatCast(project)}.`,
    rangeLabel ? `- Phạm vi đang lập: ${rangeLabel}.` : '- Hãy dựa trên tiến trình outline hiện có để phân phối cast.',
    '- Phải xoay vòng cast theo từng chặng truyện, tránh để cùng một nhóm người lặp lại y nguyên qua nhiều beat nếu bối cảnh xã hội/cảm xúc đã đổi.',
    '- Chỉ thêm nhân vật mới khi beat hoặc arc cần một chức năng mà cast cũ không gánh hợp lý.',
    '- Chức năng hợp lệ của nhân vật mới gồm: plot, world, emotional.',
    '- Nếu chỉ cần một người đi ngang qua để chuyển cảnh hoặc lấp đầy khung hình, không được tạo người mới ngẫu nhiên với tên và hồ sơ đầy đủ.',
    `- Foreshadowing/phe phái đang mở có thể cần người đại diện, nhưng chỉ dùng khi ăn khớp với tiến trình truyện: ${formatForeshadowings(project)}.`,
    '- Khi đề xuất nhân vật mới trong outline, phải ngầm trả lời được: họ phục vụ đoạn nào, tác động gì, và có để lại dư âm hay tái xuất hay không.',
  ];

  return renderRuleBlock('OUTLINE CHARACTER EXPANSION RULES', lines);
}

export function buildChapterCharacterGuardrails(
  project: Project,
  targetChapterIndex: number,
): string {
  assertEraRegisterConfigured(project, 'prose');

  const currentBeat = project.outline?.[targetChapterIndex];
  const nextBeat = project.outline?.[targetChapterIndex + 1];

  const lines = [
    `- Beat hiện tại: ${currentBeat ? `${currentBeat.title} — ${compactText(currentBeat.summary, 120)}` : 'chưa có beat rõ ràng'}.`,
    `- Beat kế tiếp gần nhất: ${nextBeat ? `${nextBeat.title} — ${compactText(nextBeat.summary, 120)}` : 'chưa có beat kế tiếp'}.`,
    `- Cast lõi hiện có: ${formatCast(project)}.`,
    `- Foreshadowing đang mở: ${formatForeshadowings(project)}.`,
    '- Đừng chỉ lặp lại máy móc cùng vài nhân vật nếu cảnh đang mở sang quan hệ, không gian, hoặc tầng cảm xúc mới.',
    '- Chỉ đặt tên nhân vật mới khi họ có chức năng rõ ràng thuộc một trong ba nhóm: plot, world, emotional.',
    '- Nếu một nhân vật mới chỉ làm nền cho cảnh, hãy giữ họ ở mức vô danh thay vì canon hóa bằng tên riêng.',
    '- introducedEntities chỉ ghi những nhân vật hoặc entity có tên thực sự tạo hệ quả, có khả năng tái xuất, hoặc làm đổi trạng thái cảnh truyện.',
    '- Trước khi thêm người mới, hãy tự kiểm tra: vai này cast cũ có gánh được không; nếu không, người mới sẽ để lại dấu vết gì sau chương này?',
  ];

  return renderRuleBlock('CHAPTER CAST CONTROL', lines);
}
