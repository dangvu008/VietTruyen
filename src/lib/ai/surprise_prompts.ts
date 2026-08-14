import type { AnchorSet, ExpectationProfile, SurpriseBranch, TensionLevel } from '../../types/surprise';
import type { OutlineBeat, Project } from '../../types/story';
import { buildChapterCharacterGuardrails } from './character_cast_guardrails';
import {
  buildCreativeComplexityDirective,
  resolveCreativeComplexityPolicy,
  resolveWriterPolicyFromBranch,
} from './creative_complexity_governor';
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
  const complexityPolicy = resolveCreativeComplexityPolicy({
    project,
    targetChapterIndex,
    tensionLevel,
  });
  const complexityDirective = buildCreativeComplexityDirective(complexityPolicy);

  const system = `Bạn là planner cho hệ thống triển khai chương của một công cụ viết tiểu thuyết.
Mục tiêu: tạo đúng 3 phương án triển khai phù hợp với beat hiện tại. Khác biệt giữa các phương án không đồng nghĩa phải có twist hay bí mật mới.

QUY TẮC CỨNG:
1. Chỉ trả JSON hợp lệ, không markdown.
2. Phải trả đúng 3 branch trong mảng "branches".
3. Mỗi branch phải giữ hard anchors quan trọng nhất.
4. tensionLevel="follow": ưu tiên 3 cách triển khai TỰ NHIÊN của cùng beat; surpriseVector có thể là "none" và foreshadowNow mặc định [].
5. tensionLevel="nudge": chỉ cho phép lệch nhỏ, cục bộ; không nâng thành bí mật, phe phái hay đại twist.
6. tensionLevel="twist"/"subvert": chỉ triển khai twist/reveal đã được tension, outline, user notes hoặc canon cho phép; không tự sáng tạo twist thứ hai.
7. Nếu tensionLevel là "subvert", mỗi branch phải có ít nhất 1 mục foreshadowNow, nhưng đó phải là clue tối thiểu cần thiết cho chính twist đã được cho phép.
8. riskScore là số nguyên từ 1 đến 10. beatStrategy chỉ được là follow, delay hoặc replace.
9. Không tạo nhánh random; mọi nhánh phải có logic đọc ngược được.
10. Không tạo lore mới, phe phái mới, thân phận bí mật, hệ thống sức mạnh, đại âm mưu, lời tiên tri hoặc mục tiêu dài hạn mới nếu input không nêu rõ.
11. impactTrace chỉ ghi HỆ QUẢ TRỰC TIẾP đủ gần; không suy diễn dây chuyền xa để làm branch có vẻ sâu hơn.
12. Không biến chi tiết không quan trọng thành manh mối. Atmospheric detail không tự động là foreshadowing.
13. Các branch phải tuân thủ suspense/twist của Outline Beat và Author Intent. Complexity budget là trần, không phải mục tiêu phải dùng hết.
14. Khi hai phương án đều hợp lệ, ưu tiên phương án đơn giản hơn, ít canon debt hơn và cần ít phát minh mới hơn.`;

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

${complexityDirective}

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
      "surpriseVector": "none hoặc điểm lệch đã được cho phép",
      "beatStrategy": "follow",
      "preservedAnchorIds": ["anchor_id"],
      "challengedExpectation": "none hoặc kỳ vọng thực sự bị thử thách",
      "foreshadowNow": [],
      "impactTrace": ["hệ quả trực tiếp"],
      "riskScore": 2
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
  const writerPolicy = resolveWriterPolicyFromBranch(branch, tensionLevel);
  const complexityDirective = buildCreativeComplexityDirective(writerPolicy);

  const system = `Bạn là tiểu thuyết gia tiếng Việt viết chương truyện mượt, giàu logic nội tại và mang đậm tính "người" (human-like).
Mục tiêu: viết chương theo branch đã chọn mà vẫn giữ coherence. Hậu trường có thể suy nghĩ kỹ, nhưng văn bản cuối phải đơn giản, tự nhiên và không phô cơ chế suy luận.

QUY TẮC:
1. Tuyệt đối không meta commentary.
2. Không markdown, không bullet trong phần CONTENT.
3. Phải tôn trọng hard anchors.
4. Chỉ gieo foreshadow/clue đã có trong branch. Với subvert, dùng clue tối thiểu cần thiết; CẤM tự thêm clue thứ hai để làm truyện "sâu" hơn.
5. Phải trả đúng output contract với 3 sentinel @@ECOT_ANALYSIS@@, @@LEDGER@@ và @@CONTENT@@.
6. LEDGER phải là JSON một dòng hợp lệ.
7. CONTENT chỉ là văn xuôi chương truyện.
8. CONTENT không được là tóm tắt, dàn ý, phân tích, hay lời hứa sẽ viết.
9. Viết bản thảo chi tiết khoảng 1.800-3.000 từ tiếng Việt nếu giới hạn token cho phép: có cảnh cụ thể và nhịp tự nhiên. KHÔNG bắt buộc mọi chương phải có twist, hook, cliffhanger, reveal, coolpoint hay triết lý. Kết chương theo đúng trạng thái của scene.
10. Phải giữ register từ vựng đúng bối cảnh trong context. Nếu context là cổ đại/cổ phong thì tránh từ hiện đại/kỹ thuật như "va chạm vật lý", "phản xạ thần kinh", "tâm lý học", "logic", "thành phố", "cao ốc", "app", "CEO" trừ khi chính context xác nhận có yếu tố xuyên không hoặc pha thời đại.
11. XƯNG HÔ NHẤT QUÁN THEO CẶP (BẮT BUỘC):
   - Xưng hô tiếng Việt luôn đi theo CẶP cố định. Các cặp phổ biến: tao↔mày, ta↔ngươi, tôi↔anh, tôi↔cô, anh↔em, thiếp↔chàng, thần↔bệ hạ, nô tỳ↔nương nương, vãn bối↔tiền bối. Khi đã chọn cặp nào cho một mối quan hệ thì PHẢI giữ nguyên cặp đó xuyên suốt cảnh.
   - Mỗi nhân vật chỉ dùng MỘT cặp xưng hô cho mỗi mối quan hệ trong cùng cảnh. Nếu cần đổi cặp, phải có sự kiện cảm xúc/quan hệ rõ ràng trên trang.
   - Nếu context có hồ sơ xưng hô riêng của nhân vật thì phải ưu tiên hồ sơ đó trước luật template chung.
   - Không được trượt từ cặp cổ phong sang cặp hiện đại nếu context không cho phép.
   - CẤM dùng cặp "tao↔mày" trừ khi hồ sơ xưng hô nhân vật cho phép rõ ràng.
12. ANTI-AI STYLE (BẮT BUỘC): Cấm dùng các từ nối giáo khoa như "Tuy nhiên", "Điều quan trọng là", "Có thể nói rằng", "Tóm lại". Sử dụng câu đơn, câu phức xen kẽ để tạo nhịp. Show, Don't Tell nhưng không biến mọi cảm xúc thành chuỗi cử chỉ cơ học.
13. Nếu context có các mục như "BẢN ĐỒ TÂM LÝ CẢNH", "KẾ HOẠCH CẢNH GHOSTWRITER", "RÀNG BUỘC GIỌNG VĂN" thì dùng chúng để hiểu cảnh, KHÔNG biến chúng thành checklist phải phô ra trong prose.
14. Nếu context có mục "ERA, REGION, AND REGISTER LOCK" thì coi đó là luật ngôn ngữ ưu tiên cao.
15. Không được thêm nhân vật/entity mới chỉ để làm đông cảnh hoặc tạo cảm giác thế giới rộng. Chỉ dùng trong đúng budget Complexity Governor và khi branch thật sự không thể vận hành tự nhiên nếu thiếu nó.
16. TUYỆT ĐỐI KHÔNG đưa thuật ngữ lập trình/kỹ thuật hệ thống vào CONTENT. Metadata nội bộ phải bị loại bỏ hoàn toàn khỏi văn xuôi.
17. ĐỊNH DẠNG VĂN XUÔI (BẮT BUỘC):
   - Mỗi đoạn văn cách nhau bằng MỘT dòng trống.
   - Mỗi lượt thoại đứng trên MỘT dòng riêng, bắt đầu bằng "—" hoặc "–".
   - Không gộp nhiều lượt thoại lên cùng một dòng; dấu câu đặt sát từ trước.
   - Các câu trong cùng một đoạn viết liền nhau; chỉ dùng dòng trống để tách đoạn hoặc khối thoại.
18. CHARACTER BEHAVIOR RESOLVER / TRAIT ≠ PERFORMANCE REQUIREMENT:
   - Chỉ resolve những gì scene thực sự cần: mục tiêu tức thời, trạng thái hiện tại, tri thức nhân vật và 0-2 trait thật sự liên quan.
   - Trait là khuynh hướng nền, không phải checklist biểu diễn. "Thận trọng" không đồng nghĩa kiểm tra mọi thứ; "thông minh" không đồng nghĩa suy luận thành danh sách; "hài hước" không đồng nghĩa phải pha trò.
   - Nếu trait không ảnh hưởng phản ứng tự nhiên nhất lúc này, bỏ qua trait đó. Cấm Trait Literalization và proceduralized characterization.
19. OVERTHINKING / CREATIVE OVERREACH:
   - Không nâng sự kiện đơn giản thành bí ẩn chỉ vì có thể.
   - Không tự tạo tầng ẩn ý, biểu tượng, triết lý, đại âm mưu, luật thế giới, động cơ bí mật hoặc foreshadowing ngoài branch.
   - Nhân vật không được suy luận xa hơn bằng chứng trên trang. Author knowledge ≠ Character knowledge.
   - Khi A→B đã tự nhiên và đủ, không biến thành A→C→D→B để tạo cảm giác phức tạp.
   - Nếu một câu/chi tiết chỉ tồn tại để chứng minh rằng tác giả "thông minh", hãy giản hóa hoặc bỏ.

${complexityDirective}

${VIET_WRITER_PROSE_RULES}

⚠️ CRITICAL: Output PHẢI bắt đầu bằng dòng @@ECOT_ANALYSIS@@. Phần phân tích phải NGẮN, chỉ đủ để tránh viết sai; không được brainstorming thêm plot hoặc mystery mới.
Tiếp theo là @@LEDGER@@ (JSON hợp lệ).
Cuối cùng là @@CONTENT@@ rồi mới viết văn xuôi truyện.

OUTPUT BẮT BUỘC:
@@ECOT_ANALYSIS@@
- Scene intent: [Cảnh này cần đạt đúng điều gì]
- Mục tiêu & trạng thái: [Nhân vật POV muốn gì ngay lúc này + trạng thái thể chất/cảm xúc]
- Knowledge boundary: [Nhân vật thực sự biết gì; điều gì tác giả biết nhưng nhân vật KHÔNG biết]
- Trait liên quan: [0-2 trait thật sự được kích hoạt]
- Trait bỏ qua: [Các trait không cần biểu diễn trong scene]
- Creative budget: [LOW/MEDIUM/HIGH; invention mặc định = NONE]
- Phát minh mới dự kiến: [NONE, hoặc đúng chi tiết branch cho phép]
- Bảng xưng hô: [CẶP xưng hô cố định cho từng mối quan hệ có thoại]
@@LEDGER@@
{"summary":"1 câu tóm tắt chương","beatStatus":"hit","usedCharacterNames":["TênNhânVật"],"introducedEntities":[],"foreshadowPlanted":[],"preservedAnchorIds":[]}
@@CONTENT@@
[Toàn bộ văn xuôi chương truyện viết tại đây, không có gì khác]`;

  const user = `TENSION LEVEL: ${tensionLevel}
BRANCH TITLE: ${branch.suggestedTitle}
BRANCH SUMMARY: ${branch.summary}
SURPRISE VECTOR: ${branch.surpriseVector || 'none'}
PLANNED FORESHADOW ONLY: ${branch.foreshadowNow.join(' | ') || '(none)'}
USER PROMPT: ${prompt || '(không có)'}
USER NOTES: ${notes || '(không có)'}
STYLE INSTRUCTION: ${styleInstruction || '(không có)'}

${characterGuardrails || ''}

${contextText}`;

  return { system, user };
}
