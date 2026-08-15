import type { FullWritePipelinePayload } from '../../types/workflow';

export const DEEP_WRITING_MODE_ID = 'quality' as const;

export interface DeepWritingModeProfile {
  id: typeof DEEP_WRITING_MODE_ID;
  label: string;
  shortLabel: string;
  description: string;
  directive: string;
}

export const DEEP_WRITING_MODE_PROFILE: DeepWritingModeProfile = {
  id: DEEP_WRITING_MODE_ID,
  label: 'Deep Writing',
  shortLabel: 'Sâu',
  description:
    'Đi sâu vào cảnh, giọng, nhịp, POV, nội tâm và subtext nhưng không tự tăng độ phức tạp cốt truyện.',
  directive: `## DEEP WRITING MODE — DEEP CRAFT, NOT DEEPER PLOT

Mục tiêu của mode này là tăng CHẤT LƯỢNG THỂ HIỆN của chính cảnh đang có, không phải làm cốt truyện phức tạp hơn.

1. SCENE INTENT LOCK
- Xác định chức năng thật của cảnh/chương, tuyến hành động vật lý đang diễn ra và thay đổi tối thiểu cần đạt trước khi kết cảnh.
- Không tự đổi branch, không tự nâng stakes, không thêm subplot chỉ vì đang ở Deep Writing Mode.

2. POV & KNOWLEDGE BOUNDARY
- Giữ POV ổn định. Chỉ cho nhân vật nghĩ, nhận biết và suy luận từ dữ kiện họ thực sự có.
- Author knowledge ≠ Character knowledge ≠ Reader knowledge.
- Không dùng nội tâm để lén giải thích canon mà nhân vật không có lý do nghĩ tới.

3. CHARACTER INTERIORITY
- Đi sâu vào nội tâm bằng phản ứng cụ thể, lựa chọn, né tránh, chú ý, ký ức gần hoặc cảm giác thân thể khi chúng thật sự phát sinh từ cảnh.
- Trait là khuynh hướng nền, không phải checklist biểu diễn.
- Không ép mọi câu thoại có subtext. Subtext chỉ được sinh từ động cơ, quan hệ và điều nhân vật chưa muốn nói thẳng đã có trong context.

4. SCENE EMBODIMENT
- Làm rõ không gian, vị trí, chuyển động và quan hệ vật thể đủ để độc giả có thể hình dung cảnh.
- Chọn 1-2 kênh cảm giác có giá trị cho khoảnh khắc; không bắt buộc đủ thị giác/thính giác/mùi/vị/xúc giác.
- Atmospheric detail ≠ Narrative signal. Chi tiết môi trường không tự động là clue, omen, foreshadowing hay symbol.

5. PROSE CRAFT
- Ưu tiên động từ cụ thể, hình ảnh rõ, nhịp câu biến thiên theo sức ép của cảnh.
- Cắt over-explaining, câu tổng kết cảm xúc, câu triết lý gượng và ẩn dụ chỉ để chứng minh văn hay.
- Mỗi đoạn phải có chức năng: tiến hành động, làm rõ nhận thức, thay đổi quan hệ/cảm xúc, hoặc tạo không khí cần thiết.

6. CONTINUITY AT MICRO LEVEL
- Giữ liên tục đồ vật, vị trí, thương thế, thời gian, xưng hô, mức hiểu biết, trạng thái cảm xúc và hậu quả từ đoạn trước.
- Khi chuyển cảnh/chuyển nhịp, phải có cầu nối nhân quả hoặc cảm giác đủ tự nhiên; không ghép các đoạn như module rời.

7. MINIMUM NECESSARY INVENTION
- Nếu cảnh vẫn hoạt động tốt mà không cần phát minh thêm lore/entity/twist/mystery/foreshadowing/symbolism, KHÔNG phát minh.
- Deep Writing không cấp thêm creative budget. Creative Complexity Governor vẫn là trần tuyệt đối.

8. REVISION STANDARD
- Tự kiểm tra câu văn ở mức đoạn: rõ ai đang làm gì, vì sao phản ứng này xảy ra lúc này, chi tiết nào thừa, câu nào giải thích quá mức.
- Khi một đoạn đã sống, tự nhiên và đúng truyện, để nó yên. Correct the broken, preserve the alive.

Đích cuối: chương phải có cảm giác được một tiểu thuyết gia viết kỹ hơn, không phải một planner nghĩ nhiều hơn.`,
};

export function isDeepWritingMode(payload: Pick<FullWritePipelinePayload, 'qualityMode'>): boolean {
  return (payload.qualityMode ?? DEEP_WRITING_MODE_ID) === DEEP_WRITING_MODE_ID;
}

export function buildDeepWritingNotes(existingNotes?: string): string {
  return [existingNotes?.trim(), DEEP_WRITING_MODE_PROFILE.directive]
    .filter(Boolean)
    .join('\n\n');
}
