/**
 * File: template_injector.ts
 * Purpose: Inject StoryTemplate context vào creation prompts và chapter writer prompts
 * Layer: Application (AI)
 * Domain: StoryTemplate → [creation_prompts, context_builder, chapter_writer_ai]
 * Deps: data/story_templates/template_registry, types/story_template
 *
 * Data Contract:
 * - injectTemplateToFrameworkPrompt(genre, tags) → template text block | ''
 * - injectTemplateToWriterPrompt(genre, tags, chapterIndex) → writer guidance | ''
 * - getTemplateOutlineHint(genre, tags, chapterIndex) → arc-specific hint | ''
 */

import {
  findTemplateByKeywords,
  buildTemplatePromptSlice,
  serializeTemplateForPrompt,
} from '../../data/story_templates/template_registry';
import type { StoryTemplate, TemplateDialogueRule, TemplateLanguageRegister } from '../../types/story_template';
import { useTemplateStore } from '../../store/use_template_store';

type LanguageRegisterProfile = TemplateLanguageRegister;

// ─── Custom-first Lookup ──────────────────────────────────────

/**
 * Tìm template: custom templates (user-extracted) ưu tiên trước, sau đó mới registry built-in.
 * Điều này đảm bảo template mà user trích xuất từ tác phẩm bất hủ luôn được dùng ưu tiên.
 */
function findTemplateWithCustomPriority(
  genre: string,
  tags?: string[],
): StoryTemplate | undefined {
  // [Domain:StoryTemplate] STEP 1 — Search custom (user-extracted) templates first
  const customTemplates = useTemplateStore.getState().customTemplates;
  if (customTemplates.length > 0) {
    // Match theo tags/genre trong custom list
    const genreLower = genre.toLowerCase();
    const tagSet = new Set((tags ?? []).map((t) => t.toLowerCase()));

    const customMatch = customTemplates.find((t) => {
      const nameLower = t.name.toLowerCase();
      const templateTagSet = new Set(t.tags.map((tag) => tag.toLowerCase()));
      // Match nếu genre string xuất hiện trong tên/tags hoặc có tag chung
      const nameMatch = nameLower.includes(genreLower) || genreLower.includes('custom');
      const tagOverlap = [...tagSet].some((tag) => templateTagSet.has(tag));
      return nameMatch || tagOverlap;
    });

    if (customMatch) return customMatch;
  }

  // [Domain:StoryTemplate] STEP 2 — Fallback to built-in registry
  return findTemplateByKeywords(genre, tags);
}

function collectTemplateSignals(
  template: StoryTemplate,
  genre: string,
  tags?: string[],
): string {
  return [
    template.id,
    template.name,
    template.originalName,
    template.coreSellingPoint,
    genre,
    ...(tags ?? []),
    ...template.tags,
    ...template.subGenres.map((subGenre) => `${subGenre.name} ${subGenre.description} ${subGenre.coreAppeal}`),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function hasAnySignal(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function inferLanguageRegisterProfile(
  template: StoryTemplate,
  genre: string,
  tags?: string[],
): LanguageRegisterProfile {
  if (template.languageRegister) {
    return template.languageRegister;
  }

  const signals = collectTemplateSignals(template, genre, tags);

  if (hasAnySignal(signals, ['scifi', 'sci-fi', 'science fiction', 'cyberpunk', 'khoa huyễn', 'khoa học viễn tưởng'])) {
    return {
      eraLabel: 'tương lai / khoa học viễn tưởng',
      narrationStyle: 'ngôi ba rõ nghĩa, trực tiếp, thiên về quan sát kỹ thuật và hành động có logic',
      hanVietDensity: 'light',
      preferredTerms: ['đô thị', 'khu', 'trạm', 'cảng', 'quỹ đạo', 'mô-đun', 'giao thức'],
      avoidTerms: ['phủ', 'trấn', 'châu', 'điện hạ', 'nương tử', 'chiếu chỉ'],
      preferredPronouns: ['tôi', 'anh', 'cô', 'ông', 'bà', 'cậu'],
      forbiddenPronouns: ['trẫm', 'bổn cung', 'thiếp', 'chàng', 'ngươi'],
      dialogueRules: [
        {
          context: 'đối thoại đời thường hoặc công sở',
          preferredPairs: ['tôi - anh', 'tôi - cô', 'anh - tôi'],
          forbiddenPairs: ['ta - ngươi', 'thiếp - chàng'],
          note: 'Giữ xưng hô hiện đại, tự nhiên theo tuổi và vị thế.',
        },
      ],
      hanVietGuidance: 'Ưu tiên từ hiện đại, kỹ thuật rõ nghĩa; chỉ dùng Hán Việt khi là danh xưng riêng hoặc thuật ngữ đã thiết lập.',
      dictionGuidance: 'Giữ register công nghệ hoặc đô thị tương lai, tránh cổ phong hóa lời kể nếu context không yêu cầu.',
    };
  }

  if (hasAnySignal(signals, ['republic', 'dân quốc', 'niên đại', 'thập niên', '70s', '80s', '90s', 'era-story'])) {
    return {
      eraLabel: 'cận đại / niên đại',
      narrationStyle: 'ngôi ba tiết chế, nhuốm màu thời đại, tránh slang quá mới',
      hanVietDensity: 'balanced',
      preferredTerms: ['thành', 'phố', 'ga tàu', 'công quán', 'nhà in', 'nhà hát', 'khu chợ'],
      avoidTerms: ['app', 'startup', 'CEO', 'cao ốc kính', 'livestream', 'raid boss'],
      preferredPronouns: ['tôi', 'anh', 'cô', 'cậu', 'ông', 'bà'],
      forbiddenPronouns: ['bổn cung', 'trẫm', 'thiếp'],
      dialogueRules: [
        {
          context: 'đối thoại xã giao cận đại',
          preferredPairs: ['tôi - anh', 'tôi - cô', 'ông - tôi'],
          forbiddenPairs: ['ta - ngươi'],
          note: 'Không kéo xưng hô phong kiến thuần cổ vào bối cảnh niên đại.',
        },
      ],
      hanVietGuidance: 'Dùng Hán Việt mức vừa phải, thiên về giọng văn cận đại; tránh cả khẩu ngữ Gen Z lẫn cổ phong quá đà.',
      dictionGuidance: 'Không khí nên là bán cổ điển, chuyển tiếp sang hiện đại sơ kỳ; đồ vật và chức danh phải đúng niên đại.',
    };
  }

  if (hasAnySignal(signals, ['modern', 'urban', 'đô thị', 'hiện đại', 'ceo', 'workplace', 'livestream', 'esports', 'vườn trường', 'thanh xuân'])) {
    return {
      eraLabel: 'hiện đại / đô thị',
      narrationStyle: 'ngôi ba hoặc ngôi một hiện đại, tự nhiên, sát nhịp sống và hội thoại đời thường',
      hanVietDensity: 'light',
      preferredTerms: ['thành phố', 'khu phố', 'cao ốc', 'văn phòng', 'trường học', 'điện thoại', 'mạng xã hội'],
      avoidTerms: ['kinh thành', 'phủ đệ', 'trấn', 'châu', 'điện hạ', 'nương nương'],
      preferredPronouns: ['tôi', 'anh', 'em', 'cậu', 'bạn', 'chị'],
      forbiddenPronouns: ['trẫm', 'bổn cung', 'ta - ngươi kiểu cổ phong'],
      dialogueRules: [
        {
          context: 'đối thoại thân mật hoặc tình cảm hiện đại',
          preferredPairs: ['anh - em', 'em - anh', 'tôi - anh'],
          forbiddenPairs: ['thiếp - chàng', 'ta - ngươi'],
          note: 'Cặp xưng hô phải phù hợp tuổi tác, mức thân mật và quyền lực.',
        },
      ],
      hanVietGuidance: 'Ưu tiên tiếng Việt tự nhiên, Hán Việt chỉ nên xuất hiện ở tên riêng, thuật ngữ chuyên môn, hoặc sắc thái trang trọng thật sự cần thiết.',
      dictionGuidance: 'Giữ lời kể sáng rõ, đời sống hiện đại; tránh cưỡng ép cổ phong hoặc xưng hô phong kiến nếu không có thiết lập xuyên không.',
    };
  }

  if (hasAnySignal(signals, ['xianxia', 'tu tiên', 'tiên hiệp', 'tu chân', 'võ hiệp', 'giang hồ', 'cao vũ', 'huyền huyễn', 'cổ phong'])) {
    return {
      eraLabel: 'cổ phong / tiên hiệp / võ hiệp',
      narrationStyle: 'ngôi ba cổ phong, tiết tấu trang trọng, tránh đại từ hiện đại trừ khi POV đặc biệt yêu cầu',
      hanVietDensity: 'dense',
      preferredTerms: ['thành', 'trấn', 'châu', 'phủ', 'sơn môn', 'động phủ', 'giang hồ', 'đạo hữu'],
      avoidTerms: ['thành phố', 'chung cư', 'app', 'CEO', 'quán bar', 'taxi'],
      preferredPronouns: ['ta', 'ngươi', 'bổn tọa', 'đạo hữu', 'lão phu', 'vãn bối'],
      forbiddenPronouns: ['tôi', 'anh', 'em', 'bạn'],
      dialogueRules: [
        {
          context: 'giữ khoảng cách, thị uy, hoặc đối đầu',
          preferredPairs: ['ta - ngươi', 'bổn tọa - ngươi'],
          forbiddenPairs: ['tôi - anh', 'anh - em'],
          note: '"Ta - ngươi" không chỉ là thù địch; còn dùng khi bề trên ép thế, người lạ giang hồ chưa thân, hoặc cần giữ khoảng cách lạnh.',
        },
        {
          context: 'hậu bối nói với trưởng bối',
          preferredPairs: ['vãn bối - tiền bối', 'đệ tử - sư tôn'],
          forbiddenPairs: ['tôi - ông'],
          note: 'Giữ đúng tôn ti môn phái.',
        },
      ],
      hanVietGuidance: 'Ưu tiên Hán Việt vừa đến đậm, nhưng phải đúng nghĩa và nhất quán; tránh nhồi các cụm sáo rỗng không phục vụ cảnh.',
      dictionGuidance: 'Địa danh, xưng hô, vật phẩm và nhịp câu phải cùng trường từ vựng cổ phong; không kéo register hiện đại vào cùng một cảnh.',
    };
  }

  if (hasAnySignal(signals, ['historical', 'ancient', 'cổ đại', 'triều đại', 'vương triều', 'cung đấu', 'trạch đấu', 'cổ ngôn'])) {
    return {
      eraLabel: 'cổ đại / lịch sử / cung trạch',
      narrationStyle: 'ngôi ba trang nhã, ưu tiên tả lễ nghi, thứ bậc và tâm lý ẩn ý; hạn chế đại từ hiện đại trong lời kể gần thoại',
      hanVietDensity: 'dense',
      preferredTerms: ['kinh thành', 'thành', 'phủ', 'trấn', 'châu', 'huyện', 'nội viện', 'điện', 'các'],
      avoidTerms: ['thành phố', 'căn hộ', 'cao ốc', 'CEO', 'livestream', 'app', 'quận trung tâm'],
      preferredPronouns: ['ta', 'ngươi', 'thiếp', 'chàng', 'thần', 'bệ hạ', 'điện hạ', 'nô tỳ'],
      forbiddenPronouns: ['tôi', 'anh', 'em', 'bạn'],
      dialogueRules: [
        {
          context: 'giữ khoảng cách, thị uy, hoặc đối đầu',
          preferredPairs: ['ta - ngươi', 'bổn cung - ngươi'],
          forbiddenPairs: ['tôi - anh', 'anh - em'],
          note: '"Ta - ngươi" không chỉ dành cho thù địch; còn hợp khi nhân vật cố ý dựng khoảng cách, tỏ quyền thế, hoặc chưa hề thân cận.',
        },
        {
          context: 'quân thần / tôn ti',
          preferredPairs: ['thần - bệ hạ', 'nô tỳ - nương nương'],
          forbiddenPairs: ['tôi - ông'],
          note: 'Xưng hô phải phản ánh cấp bậc rõ ràng.',
        },
        {
          context: 'thân mật tình cảm',
          preferredPairs: ['thiếp - chàng', 'ta - nàng'],
          forbiddenPairs: ['anh - em'],
          note: 'Chỉ dùng khi quan hệ và tone thực sự phù hợp.',
        },
      ],
      hanVietGuidance: 'Ưu tiên Hán Việt vừa hoặc đậm tùy tone, đặc biệt ở danh xưng, chức vị, địa danh; không dùng khẩu ngữ hiện đại làm gãy bối cảnh.',
      dictionGuidance: 'Nếu dùng địa danh kiểu Giang Nam, Lạc Dương, phủ họ Tạ, điện Trường Xuân thì danh từ đi kèm cũng phải cổ phong, không ghép với từ hiện đại như "thành phố".',
    };
  }

  return {
    eraLabel: 'trung tính / theo world-building',
    narrationStyle: 'giữ ngôi kể ổn định, không để lời kể trượt sang khẩu ngữ lạc bối cảnh',
    hanVietDensity: 'balanced',
    preferredTerms: ['địa danh', 'xưng hô', 'đồ vật', 'thiết chế xã hội'],
    avoidTerms: ['từ lạc register với world-building đã thiết lập'],
    preferredPronouns: ['xưng hô bám theo quan hệ và bối cảnh'],
    forbiddenPronouns: ['xưng hô phá world-building'],
    dialogueRules: [
      {
        context: 'mọi cảnh hội thoại',
        preferredPairs: ['giữ một cặp xưng hô nhất quán theo quan hệ hiện tại'],
        forbiddenPairs: ['nhảy ngôi đột ngột trong cùng lượt thoại'],
        note: 'Theo dõi speaker/listener và cảm xúc cảnh để tránh trượt xưng hô.',
      },
    ],
    hanVietGuidance: 'Mật độ Hán Việt nên bám theo world-building và tone thay vì chèn ngẫu nhiên.',
    dictionGuidance: 'Giữ một register xuyên suốt mỗi cảnh; nếu pha trộn thời đại thì phải có lý do diegetic rõ ràng.',
  };
}

function formatDialogueRule(rule: TemplateDialogueRule): string {
  const fragments = [`- ${rule.context}: ${rule.preferredPairs.join(', ')}`];
  if (rule.forbiddenPairs && rule.forbiddenPairs.length > 0) {
    fragments.push(`tránh ${rule.forbiddenPairs.join(', ')}`);
  }
  if (rule.note) {
    fragments.push(rule.note);
  }
  return fragments.join(' | ');
}

// ─── Framework Prompt Injection ─────────────────────────────

/**
 * Inject template context vào creation framework prompt.
 * Gọi từ `buildCreationFrameworkPrompt` để AI có khung mẫu khi tạo bible/outline.
 *
 * @returns Template text block hoặc chuỗi rỗng nếu không tìm thấy template
 */
export function injectTemplateToFrameworkPrompt(
  genre: string,
  tags?: string[],
): string {
  const template = findTemplateWithCustomPriority(genre, tags);
  if (!template) return '';

  const slice = buildTemplatePromptSlice(template);
  const serialized = serializeTemplateForPrompt(slice);
  const register = inferLanguageRegisterProfile(template, genre, tags);

  return `\n═══════════════════════════════════════════════════════════
KHUNG MẪU THAM KHẢO (Template cho thể loại "${template.name}")
Hãy BÁM SÁT khung này để tạo bible, outline và chapter skeleton.
Điều chỉnh linh hoạt theo ý tưởng riêng, nhưng KHÔNG VI PHẠM các lỗi cần tránh.
═══════════════════════════════════════════════════════════
${serialized}

🗣️ REGISTER NGÔN NGỮ
- Bối cảnh ưu tiên: ${register.eraLabel}
- Lời kể: ${register.narrationStyle}
- Từ vựng ưu tiên: ${register.preferredTerms.join(', ')}
- Từ/cụm nên tránh: ${register.avoidTerms.join(', ')}
- Xưng hô ưu tiên: ${register.preferredPronouns.join(', ')}
- Xưng hô cấm/hạn chế: ${register.forbiddenPronouns.join(', ')}
- Mẫu xưng hô theo cảnh:
${register.dialogueRules.map(formatDialogueRule).join('\n')}
- Hán Việt: ${register.hanVietGuidance}
- Lưu ý: ${register.dictionGuidance}
═══════════════════════════════════════════════════════════`;
}

// ─── Writer Prompt Injection ────────────────────────────────

/**
 * Inject template guidance cho chapter writer.
 * Gọi từ `buildChapterWriterPrompts` hoặc `buildSurpriseContext` để writer có
 * arc-specific guidance khi viết từng chương.
 *
 * @param chapterIndex 0-based index of target chapter
 * @returns Writer guidance text hoặc chuỗi rỗng
 */
export function injectTemplateToWriterPrompt(
  genre: string,
  tags?: string[],
  chapterIndex?: number,
): string {
  const template = findTemplateWithCustomPriority(genre, tags);
  if (!template) return '';
  const register = inferLanguageRegisterProfile(template, genre, tags);

  const parts: string[] = [];

  // [Domain:StoryTemplate] STEP 1 — Core genre guidance
  parts.push(`[GENRE TEMPLATE: ${template.name}]`);
  parts.push(`USP: ${template.coreSellingPoint}`);
  parts.push(`[ERA / REGISTER: ${register.eraLabel}]`);
  parts.push(`Lời kể: ${register.narrationStyle}`);
  parts.push(`Từ vựng ưu tiên: ${register.preferredTerms.join(', ')}`);
  parts.push(`Tránh từ lạc bối cảnh: ${register.avoidTerms.join(', ')}`);
  parts.push(`Xưng hô ưu tiên: ${register.preferredPronouns.join(', ')}`);
  parts.push(`Xưng hô cấm/hạn chế: ${register.forbiddenPronouns.join(', ')}`);
  parts.push('Mẫu xưng hô theo cảnh:');
  parts.push(...register.dialogueRules.map(formatDialogueRule));
  parts.push(`Hán Việt: ${register.hanVietGuidance}`);
  parts.push(`Register note: ${register.dictionGuidance}`);

  // [Domain:StoryTemplate] STEP 2 — Arc-specific guidance (nếu biết chapterIndex)
  if (chapterIndex !== undefined) {
    const arcHint = findArcForChapter(template, chapterIndex);
    if (arcHint) {
      parts.push(`[ARC: ${arcHint.title}]`);
      parts.push(`Focus: ${arcHint.coreFocus}`);
      parts.push(`Conflict: ${arcHint.coreConflict}`);
      if (arcHint.characterGrowth) {
        parts.push(`Growth: ${arcHint.characterGrowth}`);
      }
    }
  }

  // [Domain:StoryTemplate] STEP 3 — Cool patterns (gợi ý sảng điểm)
  if (template.coolPatterns.length > 0) {
    const topPatterns = template.coolPatterns.slice(0, 3);
    parts.push(`Sảng điểm khả dụng: ${topPatterns.map((p) => p.name).join(', ')}`);
  }

  // [Domain:StoryTemplate] STEP 4 — Opportunity arc / best practices / constraint packs
  if (template.opportunityArc && template.opportunityArc.length > 0) {
    parts.push(`Nhịp triển khai gợi ý: ${template.opportunityArc.map((step) => step.name).join(' → ')}`);
  }

  if (template.bestPractices.length > 0) {
    parts.push(`NÊN: ${template.bestPractices.slice(0, 3).map((practice) => practice.description).join(' | ')}`);
  }

  if (template.constraintPacks && template.constraintPacks.length > 0) {
    parts.push(`Constraint packs: ${template.constraintPacks.join(', ')}`);
  }

  // [Domain:StoryTemplate] STEP 5 — Critical pitfalls (chỉ gửi critical)
  const criticalPitfalls = template.pitfalls.filter((p) => p.severity === 'critical');
  if (criticalPitfalls.length > 0) {
    parts.push(`⛔ TRÁNH: ${criticalPitfalls.map((p) => p.description).join(' | ')}`);
  }

  return parts.join('\n');
}

// ─── Outline Hint ───────────────────────────────────────────

/**
 * Lấy gợi ý dàn ý cho 1 chương cụ thể dựa trên template.
 * Dùng trong `outline_planner` và `context_builder`.
 */
export function getTemplateOutlineHint(
  genre: string,
  tags?: string[],
  chapterIndex?: number,
): string {
  const template = findTemplateWithCustomPriority(genre, tags);
  if (!template) return '';

  if (chapterIndex === undefined) {
    // Trả về toàn bộ outline structure gọn
    return template.outlineArcs
      .map((arc) => `${arc.title} (Ch.${arc.chapterRange}): ${arc.coreFocus} → Climax: ${arc.climax}`)
      .join('\n');
  }

  const arc = findArcForChapter(template, chapterIndex);
  if (!arc) return '';

  return `[${arc.title}] ${arc.coreFocus} | Conflict: ${arc.coreConflict} | Climax: ${arc.climax}`;
}

// ─── Conflict Patterns ──────────────────────────────────────

/**
 * Lấy mẫu xung đột đặc trưng của template để gợi ý cho scene planner.
 */
export function getTemplateConflictPatterns(
  genre: string,
  tags?: string[],
): string {
  const template = findTemplateWithCustomPriority(genre, tags);
  if (!template || template.conflictPatterns.length === 0) return '';

  return template.conflictPatterns
    .map((cp) => `• ${cp.type} (nguồn: ${cp.source}) → ${cp.resolution}`)
    .join('\n');
}

// ─── Helpers ────────────────────────────────────────────────

/**
 * Tìm arc phù hợp cho chương hiện tại dựa trên chapter index.
 * Parse chapterRange (VD: "1-100") và so sánh.
 */
function findArcForChapter(
  template: StoryTemplate,
  chapterIndex: number,
): StoryTemplate['outlineArcs'][number] | undefined {
  const chapterNumber = chapterIndex + 1; // 0-based → 1-based

  for (const arc of template.outlineArcs) {
    const match = parseArcRange(arc);
    if (match) {
      const [start, end] = match;
      if (chapterNumber >= start && chapterNumber <= end) {
        return arc;
      }
    }
  }

  // Nếu vượt quá range, trả về arc cuối
  return template.outlineArcs[template.outlineArcs.length - 1];
}

function parseArcRange(
  arc: StoryTemplate['outlineArcs'][number],
): [number, number] | null {
  const titleMatch = arc.title.match(/(\d+)\s*-\s*(\d+)\s*章?/);
  if (titleMatch) {
    return [parseInt(titleMatch[1], 10), parseInt(titleMatch[2], 10)];
  }

  const rangeMatch = arc.chapterRange.match(/(\d+)\s*-\s*(\d+)/);
  if (rangeMatch) {
    return [parseInt(rangeMatch[1], 10), parseInt(rangeMatch[2], 10)];
  }

  return null;
}
