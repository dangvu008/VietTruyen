import type { OutlineBeat, Project } from '../../types/story';
import type { SurpriseBranch, TensionLevel } from '../../types/surprise';

export type CreativeComplexityLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface CreativeComplexityPolicy {
  level: CreativeComplexityLevel;
  reason: string[];
  maxNewNamedEntities: number;
  maxNewForeshadowSeeds: number;
  allowCliffhanger: boolean;
  allowUnplannedTwist: false;
  allowUnplannedLore: false;
  freeScope: string[];
  controlledScope: string[];
  lockedScope: string[];
}

function numericBeatLevel(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(5, parsed)) : 0;
}

function resolveLevel(beat: OutlineBeat | undefined, tensionLevel: TensionLevel): CreativeComplexityLevel {
  const suspense = numericBeatLevel(beat?.suspenseLevel);
  const twist = numericBeatLevel(beat?.plotTwistLevel);

  if (tensionLevel === 'subvert' || twist >= 4 || beat?.chapterRole === 'climax') return 'HIGH';
  if (tensionLevel === 'twist' || twist >= 3 || suspense >= 4 || beat?.chapterRole === 'pivot') return 'MEDIUM';
  return 'LOW';
}

export function resolveCreativeComplexityPolicy(opts: {
  project: Project;
  targetChapterIndex: number;
  tensionLevel: TensionLevel;
}): CreativeComplexityPolicy {
  const beat = opts.project.outline[opts.targetChapterIndex];
  const level = resolveLevel(beat, opts.tensionLevel);
  const hasPlannedForeshadow = Boolean(beat?.foreshadowingHint?.trim());
  const suspense = numericBeatLevel(beat?.suspenseLevel);
  const twist = numericBeatLevel(beat?.plotTwistLevel);
  const allowCliffhanger = suspense >= 4 || twist >= 4 || opts.tensionLevel === 'subvert';

  const reason = [
    `tension=${opts.tensionLevel}`,
    beat?.chapterRole ? `chapterRole=${beat.chapterRole}` : '',
    suspense ? `suspense=${suspense}/5` : '',
    twist ? `twist=${twist}/5` : '',
    hasPlannedForeshadow ? 'plannedForeshadow=yes' : 'plannedForeshadow=no',
  ].filter(Boolean);

  return {
    level,
    reason,
    maxNewNamedEntities: level === 'LOW' ? 0 : 1,
    maxNewForeshadowSeeds: hasPlannedForeshadow || opts.tensionLevel === 'subvert' ? 1 : 0,
    allowCliffhanger,
    allowUnplannedTwist: false,
    allowUnplannedLore: false,
    freeScope: [
      'câu chữ, nhịp văn, cử chỉ nhỏ, cảm giác, đối thoại',
      'chi tiết môi trường cục bộ không tạo canon mới',
      'phản ứng tự nhiên phát sinh từ tình huống hiện tại',
    ],
    controlledScope: [
      'NPC phụ/đạo cụ/chi tiết hậu cảnh chỉ khi scene thật sự cần',
      'chi tiết worldbuilding nhỏ chỉ khi không tạo luật, phe phái hay lịch sử mới',
      'kết chương có lực kéo nếu nó nảy sinh tự nhiên từ scene',
    ],
    lockedScope: [
      'lore/quy tắc thế giới/hệ thống sức mạnh mới',
      'phe phái, thân phận bí mật, đại âm mưu, lời tiên tri hoặc mục tiêu dài hạn mới',
      'power-up, twist, reveal hoặc foreshadowing dài hạn không có trong outline/branch/canon',
      'biến chi tiết không quan trọng thành manh mối chỉ để tạo cảm giác sâu sắc',
    ],
  };
}

export function resolveWriterPolicyFromBranch(
  branch: SurpriseBranch,
  tensionLevel: TensionLevel,
): CreativeComplexityPolicy {
  const level: CreativeComplexityLevel =
    tensionLevel === 'subvert' ? 'HIGH' : tensionLevel === 'twist' ? 'MEDIUM' : 'LOW';
  const plannedForeshadowCount = Math.min(1, branch.foreshadowNow.filter(Boolean).length);

  return {
    level,
    reason: [`tension=${tensionLevel}`, `branch=${branch.id}`, `beatStrategy=${branch.beatStrategy}`],
    maxNewNamedEntities: level === 'LOW' ? 0 : 1,
    maxNewForeshadowSeeds: plannedForeshadowCount,
    allowCliffhanger: tensionLevel === 'twist' || tensionLevel === 'subvert',
    allowUnplannedTwist: false,
    allowUnplannedLore: false,
    freeScope: [
      'cách diễn đạt, nhịp cảnh, cử chỉ, đối thoại và chi tiết cảm giác',
      'các lựa chọn vi mô không làm đổi canon hoặc hướng truyện',
    ],
    controlledScope: [
      'chi tiết phụ chỉ để scene vận hành tự nhiên',
      'một entity mới tối đa theo budget và chỉ khi branch thực sự đòi hỏi',
    ],
    lockedScope: [
      'mọi lore, cơ chế, phe phái, thân phận, năng lực, bí mật hoặc mục tiêu dài hạn mới',
      'twist/reveal/foreshadowing không có trong branch',
      'ẩn ý hoặc biểu tượng khiến chi tiết bình thường bị nâng thành manh mối',
    ],
  };
}

export function buildCreativeComplexityDirective(policy: CreativeComplexityPolicy): string {
  const cliffhanger = policy.allowCliffhanger
    ? 'Được dùng cliffhanger nếu chính diễn biến hiện tại tự nhiên dẫn tới nó; không được bịa thêm sự kiện chỉ để treo chương.'
    : 'KHÔNG mặc định tạo cliffhanger/hook. Kết chương yên, khép cảnh hoặc chuyển động nhẹ đều hợp lệ nếu đúng nhịp.';

  return [
    '## COMPLEXITY GOVERNOR / CREATIVE SCOPE',
    `Complexity budget: ${policy.level}. Đây là TRẦN độ phức tạp, không phải mục tiêu phải dùng hết.`,
    `Lý do: ${policy.reason.join(' | ') || 'conservative default'}.`,
    'Nguyên tắc lõi: THINK ENOUGH TO UNDERSTAND; DO NOT THINK UNTIL YOU INVENT A DIFFERENT STORY.',
    'Minimum Necessary Invention: nếu scene vẫn hoạt động tốt mà không cần phát minh thêm, KHÔNG phát minh.',
    `Budget entity mới có tên: ${policy.maxNewNamedEntities}. Budget foreshadow mới: ${policy.maxNewForeshadowSeeds}.`,
    cliffhanger,
    'FREE — được tự do: ' + policy.freeScope.join('; ') + '.',
    'CONTROLLED — chỉ dùng khi scene cần: ' + policy.controlledScope.join('; ') + '.',
    'LOCKED — không tự phát minh: ' + policy.lockedScope.join('; ') + '.',
    'Atmospheric detail ≠ Narrative signal. Không biến tiếng động, đồ vật, ánh mắt, câu nói hay người qua đường thành manh mối nếu kế hoạch không yêu cầu.',
    'Author knowledge ≠ Character knowledge ≠ Reader knowledge. Nhân vật chỉ được suy luận từ điều họ thực sự biết và bằng chứng đang có trên trang.',
    'Không được nhận điểm cộng vì cleverness tự thân: nhiều tầng ẩn ý, nhiều twist, văn hoa hơn hay phức tạp hơn KHÔNG mặc định tốt hơn.',
  ].join('\n');
}
