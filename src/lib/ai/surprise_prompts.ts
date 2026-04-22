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

  const system = `Bạn là tiểu thuyết gia tiếng Việt viết chương truyện mượt, giàu logic nội tại.
Mục tiêu: viết chương theo branch đã chọn mà vẫn giữ coherence.

QUY TẮC:
1. Tuyệt đối không meta commentary.
2. Không markdown, không bullet trong phần CONTENT.
3. Phải tôn trọng hard anchors.
4. Nếu tensionLevel là "subvert", phải gieo clue mới trong chương.
5. Phải trả đúng output contract với 2 sentinel @@LEDGER@@ và @@CONTENT@@.
6. LEDGER phải là JSON một dòng hợp lệ.
7. CONTENT chỉ là văn xuôi chương truyện.`;

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
