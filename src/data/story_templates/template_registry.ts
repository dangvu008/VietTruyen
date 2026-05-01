/**
 * File: template_registry.ts
 * Purpose: Central registry mapping genre → StoryTemplate + lookup helpers
 * Layer: Data (Registry)
 * Domain: StoryTemplate → [creation_orchestrator, context_builder, chapter_writer_ai]
 * Deps: types/story_template, data/story_templates/*
 *
 * Data Contract:
 * - getTemplateByGenreId(id) → StoryTemplate | undefined
 * - findTemplateByKeywords(genre, tags) → StoryTemplate | undefined
 * - getAllTemplateIds() → string[]
 */

import type { StoryTemplate, StoryTemplatePromptSlice } from '../../types/story_template';

// ─── Imports: Core 10 (hand-crafted) ────────────────────────
import { XIANXIA_TEMPLATE } from './xianxia_template';
import { RULES_MYSTERY_TEMPLATE } from './rules_mystery_template';
import { ROMANCE_TEMPLATE } from './romance_template';
import { FARMING_TEMPLATE } from './farming_template';
import { APOCALYPSE_TEMPLATE } from './apocalypse_template';
import { SCIFI_TEMPLATE } from './scifi_template';
import { WESTERN_FANTASY_TEMPLATE } from './western_fantasy_template';
import { URBAN_BRAINWAVE_TEMPLATE } from './urban_brainwave_template';
import { HIGH_MARTIAL_TEMPLATE } from './high_martial_template';
import { INFINITE_FLOW_TEMPLATE } from './infinite_flow_template';

// ─── Imports: Auto-converted (28 templates) ─────────────────
import { CTHULHU_TEMPLATE } from './cthulhu_template';
import { HISTORICAL_TEMPLATE } from './historical_template';
import { ALT_HISTORY_TEMPLATE } from './alt_history_template';
import { ANCIENT_ROMANCE_TEMPLATE } from './ancient_romance_template';
import { HAREM_FAMILY_TEMPLATE } from './harem_family_template';
import { FEMALE_SUSPENSE_TEMPLATE } from './female_suspense_template';
import { PALACE_INTRIGUE_TEMPLATE } from './palace_intrigue_template';
import { ERA_STORY_TEMPLATE } from './era_story_template';
import { FANTASY_ROMANCE_TEMPLATE } from './fantasy_romance_template';
import { SUPERNATURAL_MYSTERY_TEMPLATE } from './supernatural_mystery_template';
import { BRAINWAVE_SUSPENSE_TEMPLATE } from './brainwave_suspense_template';
import { WAR_ESPIONAGE_TEMPLATE } from './war_espionage_template';
import { SUBSTITUTE_TEMPLATE } from './substitute_template';
import { REPUBLIC_ROMANCE_TEMPLATE } from './republic_romance_template';
import { GAME_SPORTS_TEMPLATE } from './game_sports_template';
import { MELODRAMA_TEMPLATE } from './melodrama_template';
import { REALISTIC_TEMPLATE } from './realistic_template';
import { MODERN_BRAINWAVE_TEMPLATE } from './modern_brainwave_template';
import { ESPORTS_TEMPLATE } from './esports_template';
import { LIVESTREAM_TEMPLATE } from './livestream_template';
import { SHORT_FICTION_TEMPLATE } from './short_fiction_template';
import { SYSTEM_FLOW_TEMPLATE } from './system_flow_template';
import { WORKPLACE_ROMANCE_TEMPLATE } from './workplace_romance_template';
import { CEO_ROMANCE_TEMPLATE } from './ceo_romance_template';
import { URBAN_SUPERPOWER_TEMPLATE } from './urban_superpower_template';
import { URBAN_DAILY_TEMPLATE } from './urban_daily_template';
import { SWEET_YOUTH_TEMPLATE } from './sweet_youth_template';
import { DARK_THEME_TEMPLATE } from './dark_theme_template';

// ─── Registry ───────────────────────────────────────────────

const TEMPLATE_MAP: Map<string, StoryTemplate> = new Map();

function register(template: StoryTemplate): void {
  TEMPLATE_MAP.set(template.id, template);
}

// Core 10
register(XIANXIA_TEMPLATE);
register(RULES_MYSTERY_TEMPLATE);
register(ROMANCE_TEMPLATE);
register(FARMING_TEMPLATE);
register(APOCALYPSE_TEMPLATE);
register(SCIFI_TEMPLATE);
register(WESTERN_FANTASY_TEMPLATE);
register(URBAN_BRAINWAVE_TEMPLATE);
register(HIGH_MARTIAL_TEMPLATE);
register(INFINITE_FLOW_TEMPLATE);

// Auto-converted 28
register(CTHULHU_TEMPLATE);
register(HISTORICAL_TEMPLATE);
register(ALT_HISTORY_TEMPLATE);
register(ANCIENT_ROMANCE_TEMPLATE);
register(HAREM_FAMILY_TEMPLATE);
register(FEMALE_SUSPENSE_TEMPLATE);
register(PALACE_INTRIGUE_TEMPLATE);
register(ERA_STORY_TEMPLATE);
register(FANTASY_ROMANCE_TEMPLATE);
register(SUPERNATURAL_MYSTERY_TEMPLATE);
register(BRAINWAVE_SUSPENSE_TEMPLATE);
register(WAR_ESPIONAGE_TEMPLATE);
register(SUBSTITUTE_TEMPLATE);
register(REPUBLIC_ROMANCE_TEMPLATE);
register(GAME_SPORTS_TEMPLATE);
register(MELODRAMA_TEMPLATE);
register(REALISTIC_TEMPLATE);
register(MODERN_BRAINWAVE_TEMPLATE);
register(ESPORTS_TEMPLATE);
register(LIVESTREAM_TEMPLATE);
register(SHORT_FICTION_TEMPLATE);
register(SYSTEM_FLOW_TEMPLATE);
register(WORKPLACE_ROMANCE_TEMPLATE);
register(CEO_ROMANCE_TEMPLATE);
register(URBAN_SUPERPOWER_TEMPLATE);
register(URBAN_DAILY_TEMPLATE);
register(SWEET_YOUTH_TEMPLATE);
register(DARK_THEME_TEMPLATE);

// ─── Lookup Functions ───────────────────────────────────────

/** Lấy template theo genre ID chính xác */
export function getTemplateByGenreId(genreId: string): StoryTemplate | undefined {
  return TEMPLATE_MAP.get(genreId);
}

/** Lấy tất cả template IDs */
export function getAllTemplateIds(): string[] {
  return [...TEMPLATE_MAP.keys()];
}

/** Lấy tất cả templates */
export function getAllTemplates(): StoryTemplate[] {
  return [...TEMPLATE_MAP.values()];
}

/**
 * Merge custom templates vào lookup tạm thời.
 * Dùng khi cần tìm template bao gồm cả custom — gọi từ template_injector.
 */
export function findTemplateInMerged(
  genreId: string,
  customTemplates: StoryTemplate[],
): StoryTemplate | undefined {
  // Custom override first
  const custom = customTemplates.find((t) => t.id === genreId);
  if (custom) return custom;
  return TEMPLATE_MAP.get(genreId);
}

/**
 * Tìm template phù hợp nhất dựa trên genre string + tags.
 * Heuristic: khớp ID → khớp keyword → khớp template tags.
 */
export function findTemplateByKeywords(
  genre: string,
  tags?: string[],
): StoryTemplate | undefined {
  const genreLower = genre.toLowerCase().trim();
  const allTags = (tags ?? []).map((t) => t.toLowerCase().trim());

  // [Domain:StoryTemplate] STEP 1 — Exact ID match
  const exactMatch = TEMPLATE_MAP.get(genreLower);
  if (exactMatch) return exactMatch;

  // [Domain:StoryTemplate] STEP 2 — Keyword matching map (150+ keywords → 38 template IDs)
  const KEYWORD_MAP: Record<string, string> = {
    // ═══ Xianxia / Tu Tiên ═══
    'tu tiên': 'xianxia', 'tiên hiệp': 'xianxia', 'huyền huyễn': 'xianxia',
    'tu chân': 'xianxia', 'cultivation': 'xianxia', 'xianxia': 'xianxia',
    'tu luyện': 'xianxia', 'dị giới đại lục': 'xianxia', 'sảng văn': 'xianxia',
    // ═══ Romance (generic) ═══
    'ngôn tình': 'romance', 'romance': 'romance', 'cưới trước yêu sau': 'romance',
    'đam mỹ': 'romance', 'bách hợp': 'romance', 'đô thị ngôn tình': 'romance',
    // ═══ Rules Mystery ═══
    'trinh thám': 'rules-mystery', 'quái đàm': 'rules-mystery',
    'quy tắc': 'rules-mystery', 'mystery': 'rules-mystery', 'detective': 'rules-mystery',
    'bí ẩn': 'rules-mystery',
    // ═══ Farming / Kingdom Building ═══
    'điền văn': 'farming', 'làm ruộng': 'farming', 'kinh doanh': 'farming',
    'farming': 'farming', 'kingdom': 'farming', 'xây dựng thế lực': 'farming',
    'lĩnh chúa': 'farming', 'nông trại': 'farming', 'cổ đại làm ruộng': 'farming',
    'không gian tùy thân': 'farming',
    // ═══ Apocalypse ═══
    'mạt thế': 'apocalypse', 'zombie': 'apocalypse', 'tang thi': 'apocalypse',
    'apocalypse': 'apocalypse', 'hậu tận thế': 'apocalypse', 'post-apocalyptic': 'apocalypse',
    'sinh tồn': 'apocalypse', 'dị biến': 'apocalypse', 'thiên tai': 'apocalypse',
    // ═══ Sci-Fi ═══
    'khoa huyễn': 'scifi', 'khoa học viễn tưởng': 'scifi', 'sci-fi': 'scifi',
    'scifi': 'scifi', 'science fiction': 'scifi', 'cyberpunk': 'scifi',
    'cơ giáp': 'scifi', 'liên sao': 'scifi', 'thái không': 'scifi', 'vũ trụ': 'scifi',
    // ═══ Western Fantasy ═══
    'tây huyễn': 'western-fantasy', 'western fantasy': 'western-fantasy',
    'dnd': 'western-fantasy', 'ma pháp': 'western-fantasy', 'hiệp sĩ': 'western-fantasy',
    'phù thủy': 'western-fantasy', 'tinh linh': 'western-fantasy', 'sử thi': 'western-fantasy',
    'fantasy': 'western-fantasy', 'long tộc': 'western-fantasy',
    // ═══ Urban Brainwave ═══
    'não động': 'urban-brainwave', 'dị tượng': 'urban-brainwave',
    // ═══ High Martial ═══
    'cao vũ': 'high-martial', 'vũ đạo': 'high-martial', 'toàn dân vũ đạo': 'high-martial',
    'cách đấu': 'high-martial', 'martial arts': 'high-martial',
    // ═══ Infinite Flow ═══
    'vô hạn lưu': 'infinite-flow', 'death game': 'infinite-flow',
    'phó bản': 'infinite-flow', 'xông quan': 'infinite-flow',
    // ═══ Cthulhu ═══
    'cthulhu': 'cthulhu', 'lovecraft': 'cthulhu', 'cổ thần': 'cthulhu',
    'vũ trụ kinh hoàng': 'cthulhu',
    // ═══ Historical ═══
    'lịch sử': 'historical', 'cổ đại': 'historical', 'triều đại': 'historical',
    'vương triều': 'historical',
    // ═══ Alt-History ═══
    'xuyên không lịch sử': 'alt-history', 'lịch sử não động': 'alt-history',
    'cải biến lịch sử': 'alt-history', 'xuyên không': 'alt-history',
    // ═══ Ancient Romance ═══
    'cổ ngôn': 'ancient-romance', 'cổ đại ngôn tình': 'ancient-romance',
    // ═══ Harem / Family ═══
    'đa tử': 'harem-family', 'hậu cung': 'harem-family', 'gia đình đông con': 'harem-family',
    // ═══ Female Suspense ═══
    'nữ tần huyền nghi': 'female-suspense', 'nữ chính huyền nghi': 'female-suspense',
    // ═══ Palace Intrigue ═══
    'cung đấu': 'palace-intrigue', 'trạch đấu': 'palace-intrigue',
    'nội đấu': 'palace-intrigue', 'gia tộc': 'palace-intrigue',
    // ═══ Era Story ═══
    'niên đại': 'era-story', 'thập niên': 'era-story',
    '70s': 'era-story', '80s': 'era-story', '90s': 'era-story',
    // ═══ Fantasy Romance ═══
    'huyễn tưởng ngôn tình': 'fantasy-romance', 'yêu đương huyễn tưởng': 'fantasy-romance',
    // ═══ Supernatural Mystery ═══
    'linh dị': 'supernatural-mystery', 'huyền nghi': 'supernatural-mystery',
    'ma quỷ': 'supernatural-mystery', 'trừ tà': 'supernatural-mystery',
    'kinh dị': 'supernatural-mystery', 'truyện ma': 'supernatural-mystery',
    'horror': 'supernatural-mystery',
    // ═══ Brainwave Suspense ═══
    'huyền nghi não động': 'brainwave-suspense', 'phản chuyển': 'brainwave-suspense',
    'twist': 'brainwave-suspense',
    // ═══ War / Espionage ═══
    'kháng chiến': 'war-espionage', 'điệp chiến': 'war-espionage',
    'gián điệp': 'war-espionage', 'quân sự': 'war-espionage',
    // ═══ Substitute ═══
    'thế thân': 'substitute', 'thay thế': 'substitute', 'mạo danh': 'substitute',
    // ═══ Republic Romance ═══
    'dân quốc': 'republic-romance', 'dân quốc ngôn tình': 'republic-romance',
    // ═══ Game / Sports ═══
    'game': 'game-sports', 'thể thao': 'game-sports', 'thi đấu': 'game-sports',
    // ═══ Melodrama ═══
    'cẩu huyết': 'melodrama', 'melodrama': 'melodrama', 'kịch tính': 'melodrama',
    'ngược': 'melodrama',
    // ═══ Realistic ═══
    'hiện thực': 'realistic', 'đời thường': 'realistic', 'xã hội': 'realistic',
    // ═══ Modern Brainwave ═══
    'hiện đại não động': 'modern-brainwave', 'ngôn tình não động': 'modern-brainwave',
    // ═══ E-Sports ═══
    'điện cạnh': 'esports', 'esports': 'esports', 'e-sports': 'esports', 'game thủ': 'esports',
    // ═══ Livestream ═══
    'trực tiếp': 'livestream', 'livestream': 'livestream', 'phát sóng': 'livestream',
    // ═══ Short Fiction ═══
    'đoản thiên': 'short-fiction', 'truyện ngắn': 'short-fiction',
    // ═══ System Flow ═══
    'hệ thống lưu': 'system-flow', 'hệ thống': 'system-flow',
    'system': 'system-flow', 'litrpg': 'system-flow',
    // ═══ Workplace / Marriage ═══
    'chức trường': 'workplace-romance', 'hôn luyến': 'workplace-romance',
    'văn phòng': 'workplace-romance', 'kết hôn': 'workplace-romance',
    // ═══ CEO Romance ═══
    'hào môn': 'ceo-romance', 'tổng tài': 'ceo-romance', 'đại gia': 'ceo-romance',
    // ═══ Urban Superpower ═══
    'đô thị dị năng': 'urban-superpower', 'linh khí khôi phục': 'urban-superpower',
    'giác tỉnh': 'urban-superpower', 'dị năng': 'urban-superpower',
    // ═══ Urban Daily ═══
    'đô thị nhật thường': 'urban-daily', 'cuộc sống': 'urban-daily',
    // ═══ Sweet Youth ═══
    'thanh xuân': 'sweet-youth', 'ngọt sủng': 'sweet-youth',
    'vườn trường': 'sweet-youth', 'học đường': 'sweet-youth',
    // ═══ Dark Theme ═══
    'hắc ám': 'dark-theme', 'phản diện': 'dark-theme',
    'anti-hero': 'dark-theme', 'villain': 'dark-theme', 'tàn khốc': 'dark-theme',
    // ═══ Catch-all urban ═══
    'đô thị': 'urban-brainwave', 'urban': 'urban-brainwave', 'hiện đại': 'urban-brainwave',
  };
  const keywordEntries = Object.entries(KEYWORD_MAP)
    .sort((a, b) => b[0].length - a[0].length);

  // [Domain:StoryTemplate] STEP 3 — Search in genre string
  for (const [keyword, templateId] of keywordEntries) {
    if (genreLower.includes(keyword)) {
      return TEMPLATE_MAP.get(templateId);
    }
  }

  // [Domain:StoryTemplate] STEP 4 — Search in tags
  for (const tag of allTags) {
    for (const [keyword, templateId] of keywordEntries) {
      if (tag.includes(keyword)) {
        return TEMPLATE_MAP.get(templateId);
      }
    }
  }

  // [Domain:StoryTemplate] STEP 5 — Search in template tags
  for (const template of TEMPLATE_MAP.values()) {
    const templateTags = template.tags.map((t) => t.toLowerCase());
    for (const tag of allTags) {
      if (templateTags.includes(tag)) {
        return template;
      }
    }
  }

  return undefined;
}

// ─── Prompt Slice Builder ───────────────────────────────────

/**
 * Tạo bản rút gọn của template để inject vào prompt.
 * Chỉ giữ thông tin cốt lõi, tiết kiệm token tối đa.
 */
export function buildTemplatePromptSlice(template: StoryTemplate): StoryTemplatePromptSlice {
  return {
    id: template.id,
    name: template.name,
    coreSellingPoint: template.coreSellingPoint,

    subGenreSummary: template.subGenres
      .map((sg) => `• ${sg.name}: ${sg.coreAppeal}`)
      .join('\n'),

    worldRulesSummary: template.worldRules
      .map((wr) => `• ${wr.name}: ${wr.description}`)
      .join('\n'),

    powerSystemSummary: template.powerSystem
      ? `${template.powerSystem.name}: ${template.powerSystem.tiers.map((t) => t.name).join(' → ')}`
      : undefined,

    outlineStructure: template.outlineArcs
      .map((arc) => `${arc.title} (Ch.${arc.chapterRange}, ${arc.percentageOfTotal ?? '?'}%): ${arc.coreFocus}`)
      .join('\n'),

    coolPatternsSummary: template.coolPatterns
      .map((cp) => `• ${cp.name}: ${cp.appeal}`)
      .join('\n'),

    pitfallsSummary: template.pitfalls
      .filter((p) => p.severity === 'critical')
      .map((p) => `⛔ ${p.description}`)
      .join('\n'),

    entityTagHints: template.entityTags
      .map((et) => `${et.nameVi} [${et.attributes.join(', ')}]`)
      .join('; '),
  };
}

/**
 * Serialize StoryTemplatePromptSlice thành text block gọn nhất để inject prompt.
 * Target: ~300-500 tokens thay vì ~2000+ tokens nếu gửi toàn bộ.
 */
export function serializeTemplateForPrompt(slice: StoryTemplatePromptSlice): string {
  const parts: string[] = [
    `📖 TEMPLATE TRUYỆN: ${slice.name}`,
    `USP: ${slice.coreSellingPoint}`,
    '',
    '🔥 Lưu phái:',
    slice.subGenreSummary,
    '',
    '🌍 Quy tắc thế giới:',
    slice.worldRulesSummary,
  ];

  if (slice.powerSystemSummary) {
    parts.push('', '⚔️ Hệ thống sức mạnh:', slice.powerSystemSummary);
  }

  parts.push(
    '',
    '📐 Cấu trúc dàn ý mẫu:',
    slice.outlineStructure,
    '',
    '✨ Sảng điểm cốt lõi:',
    slice.coolPatternsSummary,
    '',
    '🚫 LỖI CẦN TRÁNH:',
    slice.pitfallsSummary,
    '',
    '🏷️ Entity types: ' + slice.entityTagHints,
  );

  return parts.join('\n');
}
