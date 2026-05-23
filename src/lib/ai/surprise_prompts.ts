import type { AnchorSet, ExpectationProfile, SurpriseBranch, TensionLevel } from '../../types/surprise';
import type { OutlineBeat, Project } from '../../types/story';
import { buildChapterCharacterGuardrails } from './character_cast_guardrails';
import { VIET_WRITER_PROSE_RULES } from './viet_writer_rules';

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
  currentBeat?: OutlineBeat;
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
    currentBeat,
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
8. Không tạo twist phá endgame hoặc world rules.
9. Các branch tạo ra phải tuân thủ mức độ suspense và twist của Outline Beat (nếu có), đồng thời hướng tới Author Intent.`;

  const user = `PROJECT: ${project.title || 'Dự án chưa đặt tên'}
TARGET CHAPTER INDEX: ${targetChapterIndex}
TENSION LEVEL: ${tensionLevel}
GENRE: ${project.genre}
MAIN PLOT: ${project.mainPlot || '(trống)'}
ENDGAME: ${project.endgame || '(trống)'}
AUTHOR INTENT: ${project.authorIntent || '(không có)'}
CURRENT FOCUS: ${project.currentFocus || '(không có)'}
BEAT SUSPENSE LEVEL: ${currentBeat?.suspenseLevel ? `${currentBeat.suspenseLevel}/5` : '(không có)'}
BEAT TWIST LEVEL: ${currentBeat?.plotTwistLevel ? `${currentBeat.plotTwistLevel}/5` : '(không có)'}
FORESHADOWING HINT: ${currentBeat?.foreshadowingHint || '(không có)'}
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

${buildChapterCharacterGuardrails(project, targetChapterIndex)}

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
  characterGuardrails?: string;
  branch: SurpriseBranch;
  tensionLevel: TensionLevel;
  prompt?: string;
  notes?: string;
  styleInstruction?: string;
}) {
  const { contextText, characterGuardrails, branch, tensionLevel, prompt, notes, styleInstruction } = opts;

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
10. Phải giữ register từ vựng đúng bối cảnh trong context. Nếu context là cổ đại/cổ phong thì tránh từ hiện đại/kỹ thuật như "va chạm vật lý", "phản xạ thần kinh", "tâm lý học", "logic", "thành phố", "cao ốc", "app", "CEO" trừ khi chính context xác nhận có yếu tố xuyên không hoặc pha thời đại.
11. XƯNG HÔ NHẤT QUÁN THEO CẶP (BẮT BUỘC):
   - Xưng hô tiếng Việt luôn đi theo CẶP cố định. Các cặp phổ biến: tao↔mày, ta↔ngươi, tôi↔anh, tôi↔cô, anh↔em, thiếp↔chàng, thần↔bệ hạ, nô tỳ↔nương nương, vãn bối↔tiền bối. Khi đã chọn cặp nào cho một mối quan hệ thì PHẢI giữ nguyên cặp đó xuyên suốt cảnh. Không được trộn lẫn: ví dụ "ta" phải đi với "ngươi", không được "ta" đi với "anh"; "tôi" phải đi với "anh/cô/ông", không được "tôi" đi với "ngươi".
   - Mỗi nhân vật chỉ dùng MỘT cặp xưng hô cho mỗi mối quan hệ trong cùng cảnh. Không được câu trước xưng "tôi" câu sau nhảy sang "ta" hay "tao". Nếu cần đổi cặp, phải có sự kiện cảm xúc rõ ràng (mất bình tĩnh, thay đổi quan hệ, tiết lộ thân phận).
   - Nếu context có hồ sơ xưng hô riêng của nhân vật thì phải ưu tiên hồ sơ đó trước luật template chung.
   - Không được trượt từ cặp cổ phong (ta↔ngươi, thiếp↔chàng, thần↔bệ hạ) sang cặp hiện đại (tôi↔anh, anh↔em) nếu context là cổ đại, và ngược lại.
   - "ta↔ngươi" không chỉ dành cho kẻ thù; trong cổ phong còn dùng khi giữ khoảng cách, thị uy, hoặc chưa thân. Nhưng nếu cảnh cần thân mật hoặc quân thần thì phải đổi sang cặp phù hợp hơn.
   - CẤM dùng cặp "tao↔mày" — xưng hô thô tục, phá giọng văn tiểu thuyết, trừ khi hồ sơ xưng hô nhân vật cho phép rõ ràng.
   - Trong phần @@ECOT_ANALYSIS@@, PHẢI liệt kê CẶP xưng hô cố định cho từng mối quan hệ có thoại (VD: "Lý Minh→Tiểu Hồng: ta↔ngươi; Tiểu Hồng→Lý Minh: thiếp↔chàng; Lý Minh→Trưởng lão: vãn bối↔tiền bối") rồi bám theo bảng đó khi viết CONTENT.
12. ANTI-AI STYLE (BẮT BUỘC): Cấm dùng các từ nối giáo khoa như "Tuy nhiên", "Điều quan trọng là", "Có thể nói rằng", "Tóm lại". Sử dụng câu đơn, câu phức xen kẽ để tạo nhịp điệu (sentence variance). Phải Show, Don't Tell - miêu tả biểu hiện vật lý thay vì gọi tên cảm xúc.
13. Nếu context có các mục như "BẢN ĐỒ TÂM LÝ CẢNH", "KẾ HOẠCH CẢNH GHOSTWRITER", "RÀNG BUỘC GIỌNG VĂN" thì phải tuân thủ chúng như ràng buộc ưu tiên cao, chỉ đứng sau hard canon.
14. Nếu context có mục "ERA, REGION, AND REGISTER LOCK" thì coi đó là luật ngôn ngữ ưu tiên cao: phải giữ đúng trục thời gian, trục văn minh-khu vực, tầng ngôn ngữ, và mode diễn giải; không được trộn thuật ngữ xuyên thời đại hay sai vùng văn hóa.
15. Không được thêm nhân vật mới chỉ để làm đông cảnh. Nếu cần người mới, họ phải có chức năng rõ ràng và để lại hệ quả hoặc dư âm đủ nhớ.
16. TUYỆT ĐỐI KHÔNG được đưa bất kỳ thuật ngữ lập trình, kỹ thuật máy tính, hoặc ký tự lạ nào vào phần CONTENT. Các từ như "Runtime", "Promise", "function", "module", "Error", "async", "null", "undefined", "JSON", "API", "config", "export", "import", "interface" v.v. là metadata nội bộ hệ thống, KHÔNG BAO GIỜ xuất hiện trong văn xuôi truyện. Nếu context chứa các từ này, phải bỏ qua hoàn toàn khi viết CONTENT.
17. ĐỊNH DẠNG VĂN XUÔI (BẮT BUỘC):
   - Mỗi đoạn văn (paragraph) cách nhau bằng MỘT dòng trống.
   - Mỗi lượt thoại của nhân vật đứng trên MỘT dòng riêng, bắt đầu bằng dấu "—" (em-dash) hoặc "–" (en-dash).
   - KHÔNG gộp nhiều lượt thoại lên cùng một dòng.
   - Dấu câu (chấm, phẩy, chấm hỏi, chấm than) đặt NGAY SAU từ cuối, KHÔNG có khoảng trắng phía trước.
   - Các câu trong cùng một đoạn viết liền nhau, KHÔNG xuống dòng giữa đoạn.
   - Chỉ dùng dòng trống để tách đoạn văn hoặc trước/sau khối thoại.
   - KHÔNG bắt đầu câu bằng dấu phẩy hoặc dấu câu.

${VIET_WRITER_PROSE_RULES}

⚠️ CRITICAL: Output PHẢI bắt đầu bằng dòng @@ECOT_ANALYSIS@@. Viết phân tích ngắn gọn về Động lực tâm lý nhân vật, Biểu hiện cơ thể dự kiến, và Danh sách từ cấm.
Tiếp theo là @@LEDGER@@ (JSON hợp lệ).
Cuối cùng là @@CONTENT@@ rồi mới viết văn xuôi truyện.

OUTPUT BẮT BUỘC (copy CHÍNH XÁC structure này):
@@ECOT_ANALYSIS@@
- Tâm lý: [Phân tích ngắn gọn cảm xúc cốt lõi của nhân vật POV]
- Biểu hiện: [Các cử chỉ vật lý, nhịp thở, ánh mắt để show cảm xúc này]
- Từ cấm: [Liệt kê 3 từ/cụm từ sáo rỗng cần tránh]
- Bảng xưng hô: [Liệt kê CẶP xưng hô cố định cho từng mối quan hệ có thoại. Mỗi dòng ghi: "NhânVậtA→NhânVậtB: cặp X↔Y". VD: "Lý Minh→Tiểu Hồng: ta↔ngươi; Tiểu Hồng→Lý Minh: thiếp↔chàng; Lý Minh→Trưởng lão: vãn bối↔tiền bối". Bám cặp này xuyên suốt CONTENT — không nhảy, không trộn.]
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

${characterGuardrails || ''}

${contextText}`;

  return { system, user };
}
