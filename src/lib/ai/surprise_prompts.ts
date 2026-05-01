import type { AnchorSet, ExpectationProfile, SurpriseBranch, TensionLevel } from '../../types/surprise';
import type { Project } from '../../types/story';

function formatAnchors(anchors: AnchorSet): string {
  return anchors.all
    .map((anchor) => `- [${anchor.id}] (${anchor.kind}, w=${anchor.weight}) ${anchor.detail}`)
    .join('\n');
}

export function buildBranchPlannerPrompts(opts: {
  project: Project;
  targetChapterIndex: number;
  tensionLevel: TensionLevel;
  anchors: AnchorSet;
  expectation: ExpectationProfile;
  prompt?: string;
  notes?: string;
  sourceOverride?: string;
}) {
  const {
    project,
    targetChapterIndex,
    tensionLevel,
    anchors,
    expectation,
    prompt,
    notes,
    sourceOverride,
  } = opts;

  const system = `Bạn là planner cho hệ thống Surprise Engine của một công cụ viết tiểu thuyết.
Mục tiêu: tạo đúng 3 nhánh chương bất ngờ nhưng vẫn giữ coherence.

QUY TẮC CỨNG:
1. Chỉ trả JSON hợp lệ, không markdown.
2. Phải trả đúng 3 branch trong mảng "branches".
3. Mỗi branch phải giữ hard anchors quan trọng nhất.
4. Nếu tensionLevel là "subvert", mỗi branch phải có ít nhất 1 mục foreshadowNow.
5. riskScore là số nguyên từ 1 đến 10.
6. beatStrategy chỉ được là follow, delay hoặc replace.
7. Không tạo nhánh random; mọi nhánh phải có logic đọc ngược được.
8. Không tạo twist phá endgame hoặc world rules.`;

  const user = `PROJECT: ${project.title || 'Dự án chưa đặt tên'}
TARGET CHAPTER INDEX: ${targetChapterIndex}
TENSION LEVEL: ${tensionLevel}
GENRE: ${project.genre}
MAIN PLOT: ${project.mainPlot || '(trống)'}
ENDGAME: ${project.endgame || '(trống)'}
OPTIONAL USER PROMPT: ${prompt || '(không có)'}
OPTIONAL USER NOTES: ${notes || '(không có)'}
SOURCE OVERRIDE: ${sourceOverride ? sourceOverride.slice(-500) : '(không có)'}

DOMINANT EXPECTATION:
${expectation.dominantExpectation}

ALTERNATIVE EXPECTATIONS:
${expectation.alternativeExpectations.join(' | ') || '(không có)'}

SETUP SIGNALS:
${expectation.setupSignals.join(' | ') || '(không có)'}

ANCHORS:
${formatAnchors(anchors)}

Trả JSON dạng:
{
  "branches": [
    {
      "id": "branch_1",
      "suggestedTitle": "Tên chương",
      "summary": "Mô tả nhánh 1-2 câu",
      "surpriseVector": "Điểm bất ngờ chính",
      "beatStrategy": "follow",
      "preservedAnchorIds": ["anchor_id"],
      "challengedExpectation": "Kỳ vọng bị thử thách",
      "foreshadowNow": ["clue 1"],
      "impactTrace": ["hệ quả 1", "hệ quả 2"],
      "riskScore": 4
    }
  ]
}`;

  return { system, user };
}

export function buildChapterWriterPrompts(opts: {
  contextText: string;
  branch: SurpriseBranch;
  tensionLevel: TensionLevel;
  prompt?: string;
  notes?: string;
  styleInstruction?: string;
}) {
  const { contextText, branch, tensionLevel, prompt, notes, styleInstruction } = opts;

  const system = `Bạn là tiểu thuyết gia tiếng Việt viết chương truyện mượt, giàu logic nội tại và mang đậm tính "người" (human-like).
Mục tiêu: viết chương theo branch đã chọn mà vẫn giữ coherence.

QUY TẮC:
1. Tuyệt đối không meta commentary.
2. Không markdown, không bullet trong phần CONTENT.
3. Phải tôn trọng hard anchors.
4. Nếu tensionLevel là "subvert", phải gieo clue mới trong chương.
5. Phải trả đúng output contract với 3 sentinel @@ECOT_ANALYSIS@@, @@LEDGER@@ và @@CONTENT@@.
6. LEDGER phải là JSON một dòng hợp lệ.
7. CONTENT chỉ là văn xuôi chương truyện.
8. CONTENT không được là tóm tắt, dàn ý, phân tích, hay lời hứa sẽ viết.
9. Viết bản thảo chi tiết khoảng 1.800-3.000 từ tiếng Việt nếu giới hạn token cho phép: có cảnh cụ thể, hành động, đối thoại, nội tâm, chuyển nhịp, và hook cuối chương.
10. Phải giữ register từ vựng đúng bối cảnh trong context. Nếu context là cổ đại/cổ phong thì tránh từ hiện đại như "thành phố", "cao ốc", "app", "CEO" trừ khi chính context xác nhận có yếu tố xuyên không hoặc pha thời đại.
11. Xưng hô phải nhất quán theo quan hệ, địa vị và cảm xúc của đúng cảnh đang viết. Nếu context có hồ sơ xưng hô riêng của nhân vật thì phải ưu tiên hồ sơ đó trước luật template chung. Không được trượt giữa "ta/ngươi", "thiếp/chàng", "thần/bệ hạ" sang "tôi/anh/em" nếu context là cổ đại. Lưu ý: "ta - ngươi" không chỉ dành cho kẻ thù; trong cổ phong nó còn có thể dùng khi giữ khoảng cách, thị uy, người trên nói với kẻ dưới, hoặc hai bên chưa thân. Nhưng nếu cảnh cần thân mật, cung kính, hoặc quân thần thì phải đổi sang cặp phù hợp hơn.
12. ANTI-AI STYLE (BẮT BUỘC): Cấm dùng các từ nối giáo khoa như "Tuy nhiên", "Điều quan trọng là", "Có thể nói rằng", "Tóm lại". Sử dụng câu đơn, câu phức xen kẽ để tạo nhịp điệu (sentence variance). Phải Show, Don't Tell - miêu tả biểu hiện vật lý thay vì gọi tên cảm xúc.
13. Nếu context có các mục như "BẢN ĐỒ TÂM LÝ CẢNH", "KẾ HOẠCH CẢNH GHOSTWRITER", "RÀNG BUỘC GIỌNG VĂN" thì phải tuân thủ chúng như ràng buộc ưu tiên cao, chỉ đứng sau hard canon.

⚠️ CRITICAL: Output PHẢI bắt đầu bằng dòng @@ECOT_ANALYSIS@@. Viết phân tích ngắn gọn về Động lực tâm lý nhân vật, Biểu hiện cơ thể dự kiến, và Danh sách từ cấm.
Tiếp theo là @@LEDGER@@ (JSON hợp lệ).
Cuối cùng là @@CONTENT@@ rồi mới viết văn xuôi truyện.

OUTPUT BẮT BUỘC (copy CHÍNH XÁC structure này):
@@ECOT_ANALYSIS@@
- Tâm lý: [Phân tích ngắn gọn cảm xúc cốt lõi của nhân vật POV]
- Biểu hiện: [Các cử chỉ vật lý, nhịp thở, ánh mắt để show cảm xúc này]
- Từ cấm: [Liệt kê 3 từ/cụm từ sáo rỗng cần tránh]
@@LEDGER@@
{"summary":"1 câu tóm tắt chương","beatStatus":"hit","usedCharacterNames":["TênNhânVật"],"introducedEntities":[],"foreshadowPlanted":[],"preservedAnchorIds":[]}
@@CONTENT@@
[Toàn bộ văn xuôi chương truyện viết tại đây, không có gì khác]`;

  const user = `TENSION LEVEL: ${tensionLevel}
BRANCH TITLE: ${branch.suggestedTitle}
BRANCH SUMMARY: ${branch.summary}
SURPRISE VECTOR: ${branch.surpriseVector}
USER PROMPT: ${prompt || '(không có)'}
USER NOTES: ${notes || '(không có)'}
STYLE INSTRUCTION: ${styleInstruction || '(không có)'}

${contextText}`;

  return { system, user };
}
