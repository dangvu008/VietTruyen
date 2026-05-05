/**
 * Script: convert_templates.ts
 * Purpose: Auto-convert remaining .md genre templates to TypeScript StoryTemplate objects
 * Usage: npx tsx scripts/convert_templates.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MD_DIR = path.resolve(__dirname, '../src/data/genre_templates');
const TS_DIR = path.resolve(__dirname, '../src/data/story_templates');

// Already converted
const DONE = new Set([
  '修仙.md', '规则怪谈.md', '种田.md', '末世.md',
  '科幻.md', '西幻.md', '都市脑洞.md',
  '高武.md', '无限流.md',
  // Romance covers 青春甜宠 + 豪门总裁
]);

// Mapping: Chinese filename → { id, nameVi, tags[], keywords[] }
export const TEMPLATE_META: Record<string, {
  id: string; nameVi: string; tags: string[]; keywords: string[];
}> = {
  '克苏鲁.md': { id: 'cthulhu', nameVi: 'Cthulhu / Vũ Trụ Kinh Hoàng', tags: ['cthulhu','cosmic-horror','lovecraft'], keywords: ['cthulhu','lovecraft','cổ thần','vũ trụ kinh hoàng'] },
  '历史古代.md': { id: 'historical', nameVi: 'Lịch Sử Cổ Đại', tags: ['historical','ancient','dynasty'], keywords: ['lịch sử','cổ đại','triều đại','vương triều'] },
  '历史脑洞.md': { id: 'alt-history', nameVi: 'Lịch Sử Xuyên Không / Não Động', tags: ['alt-history','time-travel','historical'], keywords: ['xuyên không lịch sử','lịch sử não động','cải biến lịch sử'] },
  '古言.md': { id: 'ancient-romance', nameVi: 'Cổ Đại Ngôn Tình', tags: ['ancient-romance','historical-romance'], keywords: ['cổ ngôn','cổ đại ngôn tình','cổ đại tình yêu'] },
  '多子多福.md': { id: 'harem-family', nameVi: 'Đa Tử Đa Phúc / Hậu Cung Gia Đình', tags: ['harem','family','children'], keywords: ['đa tử','hậu cung','gia đình đông con'] },
  '女频悬疑.md': { id: 'female-suspense', nameVi: 'Nữ Tần Huyền Nghi', tags: ['female-lead','suspense','mystery'], keywords: ['nữ tần huyền nghi','nữ chính huyền nghi'] },
  '宫斗宅斗.md': { id: 'palace-intrigue', nameVi: 'Cung Đấu / Trạch Đấu', tags: ['palace','intrigue','politics','female-lead'], keywords: ['cung đấu','trạch đấu','hậu cung','nội đấu','gia tộc'] },
  '年代.md': { id: 'era-story', nameVi: 'Niên Đại / Thời Kỳ Đặc Biệt', tags: ['era','nostalgia','slice-of-life'], keywords: ['niên đại','thập niên','70s','80s','90s'] },
  '幻想言情.md': { id: 'fantasy-romance', nameVi: 'Huyễn Tưởng Ngôn Tình', tags: ['fantasy-romance','supernatural-romance'], keywords: ['huyễn tưởng ngôn tình','yêu đương huyễn tưởng'] },
  '悬疑灵异.md': { id: 'supernatural-mystery', nameVi: 'Huyền Nghi Linh Dị', tags: ['supernatural','mystery','ghost','horror'], keywords: ['linh dị','huyền nghi','ma quỷ','trừ tà'] },
  '悬疑脑洞.md': { id: 'brainwave-suspense', nameVi: 'Huyền Nghi Não Động', tags: ['suspense','brainwave','twist'], keywords: ['huyền nghi não động','phản chuyển','twist'] },
  '抗战谍战.md': { id: 'war-espionage', nameVi: 'Kháng Chiến / Điệp Chiến', tags: ['war','espionage','military','spy'], keywords: ['kháng chiến','điệp chiến','gián điệp','quân sự'] },
  '替身文.md': { id: 'substitute', nameVi: 'Thế Thân Văn / Thay Thế', tags: ['substitute','identity','romance'], keywords: ['thế thân','thay thế','mạo danh'] },
  '民国言情.md': { id: 'republic-romance', nameVi: 'Dân Quốc Ngôn Tình', tags: ['republic-era','romance','historical'], keywords: ['dân quốc','dân quốc ngôn tình'] },
  '游戏体育.md': { id: 'game-sports', nameVi: 'Game / Thể Thao', tags: ['game','sports','esports','competition'], keywords: ['game','thể thao','thi đấu'] },
  '狗血言情.md': { id: 'melodrama', nameVi: 'Cẩu Huyết Ngôn Tình / Melodrama', tags: ['melodrama','drama','romance','angst'], keywords: ['cẩu huyết','melodrama','kịch tính','ngược'] },
  '现实题材.md': { id: 'realistic', nameVi: 'Hiện Thực Đề Tài', tags: ['realistic','contemporary','slice-of-life'], keywords: ['hiện thực','đời thường','xã hội'] },
  '现言脑洞.md': { id: 'modern-brainwave', nameVi: 'Hiện Đại Ngôn Tình Não Động', tags: ['modern-romance','brainwave','twist'], keywords: ['hiện đại não động','ngôn tình não động'] },
  '电竞.md': { id: 'esports', nameVi: 'Điện Cạnh / E-Sports', tags: ['esports','gaming','competition'], keywords: ['điện cạnh','esports','e-sports','game thủ'] },
  '直播文.md': { id: 'livestream', nameVi: 'Trực Tiếp Văn / Livestream', tags: ['livestream','internet','entertainment'], keywords: ['trực tiếp','livestream','phát sóng'] },
  '知乎短篇.md': { id: 'short-fiction', nameVi: 'Đoản Thiên / Truyện Ngắn', tags: ['short-story','flash-fiction'], keywords: ['đoản thiên','truyện ngắn','ngắn gọn'] },
  '系统流.md': { id: 'system-flow', nameVi: 'Hệ Thống Lưu / System', tags: ['system','litrpg','gamelit'], keywords: ['hệ thống lưu','system','litrpg','ký đáo','trừu thưởng'] },
  '职场婚恋.md': { id: 'workplace-romance', nameVi: 'Chức Trường Hôn Luyến', tags: ['workplace','marriage','romance','modern'], keywords: ['chức trường','hôn luyến','văn phòng','kết hôn'] },
  '豪门总裁.md': { id: 'ceo-romance', nameVi: 'Hào Môn Tổng Tài', tags: ['ceo','rich','romance','modern'], keywords: ['hào môn','tổng tài','đại gia','giàu có'] },
  '都市异能.md': { id: 'urban-superpower', nameVi: 'Đô Thị Dị Năng', tags: ['urban','superpower','awakening'], keywords: ['đô thị dị năng','linh khí khôi phục','giác tỉnh','dị năng'] },
  '都市日常.md': { id: 'urban-daily', nameVi: 'Đô Thị Nhật Thường', tags: ['urban','daily','slice-of-life','modern'], keywords: ['đô thị nhật thường','đời thường','cuộc sống'] },
  '青春甜宠.md': { id: 'sweet-youth', nameVi: 'Thanh Xuân Ngọt Sủng', tags: ['sweet','youth','school','romance'], keywords: ['thanh xuân','ngọt sủng','vườn trường','học đường'] },
  '黑暗题材.md': { id: 'dark-theme', nameVi: 'Hắc Ám Đề Tài / Anti-Hero', tags: ['dark','anti-hero','villain','grimdark'], keywords: ['hắc ám','phản diện','anti-hero','villain','tàn khốc'] },
};

// ─── MD Parser ────────────────────────────────────────────

interface ParsedSection {
  level: number;
  heading: string;
  content: string;
}

interface MarkdownTable {
  headers: string[];
  rows: string[][];
}

export function parseMdSections(md: string): ParsedSection[] {
  const lines = md.split('\n');
  const sections: ParsedSection[] = [];
  let currentLevel = 0;
  let currentHeading = '';
  let currentContent: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      if (currentHeading) {
        sections.push({
          level: currentLevel,
          heading: currentHeading,
          content: currentContent.join('\n').trim(),
        });
      }
      currentLevel = headingMatch[1].length;
      currentHeading = headingMatch[2].trim();
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }
  if (currentHeading) {
    sections.push({
      level: currentLevel,
      heading: currentHeading,
      content: currentContent.join('\n').trim(),
    });
  }
  return sections;
}

function findSectionIndex(sections: ParsedSection[], keywords: string[]): number {
  return sections.findIndex((section) => keywords.some((keyword) => section.heading.includes(keyword)));
}

function getDirectChildSections(sections: ParsedSection[], parentIndex: number): ParsedSection[] {
  if (parentIndex < 0) return [];
  const parent = sections[parentIndex];
  const results: ParsedSection[] = [];

  for (let index = parentIndex + 1; index < sections.length; index += 1) {
    const current = sections[index];
    if (current.level <= parent.level) break;
    if (current.level === parent.level + 1) {
      results.push(current);
    }
  }

  return results;
}

function normalizeLine(line: string): string {
  return line
    .trim()
    .replace(/^[-*]\s*/, '')
    .replace(/^\d+\.\s*/, '')
    .replace(/^\|\s*/, '')
    .replace(/\s*\|$/, '')
    .trim();
}

function extractLabelValue(line: string, labels: string[]): string {
  const normalized = normalizeLine(line);
  for (const label of labels) {
    if (normalized.includes(`**${label}**`)) {
      return normalized.replace(new RegExp(`.*\\*\\*${label}\\*\\*[:：]\\s*`), '').trim();
    }
    if (normalized.startsWith(`${label}:`) || normalized.startsWith(`${label}：`)) {
      return normalized.replace(new RegExp(`^${label}[:：]\\s*`), '').trim();
    }
  }
  return '';
}

function extractFirstLabelValue(lines: string[], labels: string[]): string {
  for (const line of lines) {
    const value = extractLabelValue(line, labels);
    if (value) return value;
  }
  return '';
}

function summarizeContent(content: string): string {
  const lines = content
    .split('\n')
    .map(normalizeLine)
    .filter((line) => line && line !== '```' && !/^:?-{3,}:?$/.test(line));

  if (lines.length === 0) return '';

  return lines
    .map((line) => {
      if (!line.includes('|')) return line;
      const cells = line.split('|').map((cell) => cell.trim()).filter(Boolean);
      return cells.join(' / ');
    })
    .join(' ');
}

function splitMarkdownTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|\s*/, '')
    .replace(/\s*\|$/, '')
    .split('|')
    .map((cell) => normalizeLine(cell))
    .filter(Boolean);
}

function isMarkdownTableDivider(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.includes('|') && /^[:|\-\s]+$/.test(trimmed);
}

function parseMarkdownTables(content: string): MarkdownTable[] {
  const lines = content.split('\n');
  const tables: MarkdownTable[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const headerLine = lines[index];
    const dividerLine = lines[index + 1];
    if (!headerLine || !dividerLine) continue;
    if (!headerLine.includes('|') || !isMarkdownTableDivider(dividerLine)) continue;

    const headers = splitMarkdownTableRow(headerLine);
    if (headers.length === 0) continue;

    index += 2;
    const rows: string[][] = [];
    while (index < lines.length && lines[index].includes('|')) {
      const row = splitMarkdownTableRow(lines[index]);
      if (row.length > 0) {
        rows.push(row);
      }
      index += 1;
    }

    tables.push({ headers, rows });
    index -= 1;
  }

  return tables;
}

function hasConflictSignal(text: string): boolean {
  return /冲突|危机|矛盾|博弈|对手|反派|阻碍|追杀|压迫|议价|竞争|敌对|设局|拉扯/.test(text);
}

function isConflictNoiseHeading(heading: string): boolean {
  return /雷区|建议|实体标签|对话示例|速查|标签扩展|Prompt/.test(heading);
}

function isLikelyConflictSection(section: ParsedSection): boolean {
  if (isConflictNoiseHeading(section.heading)) return false;
  return (
    hasConflictSignal(section.heading) ||
    hasConflictSignal(section.content) ||
    /\*\*(?:冲突|核心冲突|核心矛盾|危机|障碍)\*\*/.test(section.content) ||
    parseMarkdownTables(section.content).some((table) =>
      [...table.headers, ...table.rows.flat()].some((cell) => hasConflictSignal(cell))
    )
  );
}

function findColumnIndex(headers: string[], aliases: string[]): number {
  const normalizedHeaders = headers.map((header) => normalizeLine(header));
  for (const alias of aliases) {
    const matchIndex = normalizedHeaders.findIndex((header) => header.includes(alias));
    if (matchIndex >= 0) return matchIndex;
  }
  return -1;
}

function dedupeConflictPatterns(
  entries: Array<{type:string; source:string; resolution:string}>,
): Array<{type:string; source:string; resolution:string}> {
  const seen = new Set<string>();

  return entries.filter((entry) => {
    const normalizedEntry = {
      type: entry.type.trim(),
      source: entry.source.trim(),
      resolution: entry.resolution.trim(),
    };
    if (!normalizedEntry.type || !normalizedEntry.source || !normalizedEntry.resolution) {
      return false;
    }

    const key = JSON.stringify(normalizedEntry);
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function extractConflictPatternsFromTables(
  content: string,
  fallbackType: string,
): Array<{type:string; source:string; resolution:string}> {
  return parseMarkdownTables(content).flatMap((table) => {
    const cells = [...table.headers, ...table.rows.flat()];
    if (!cells.some((cell) => hasConflictSignal(cell))) {
      return [];
    }

    const typeIndex = findColumnIndex(table.headers, [
      '冲突',
      '类型',
      '议题',
      '情感状态',
      '角色',
      '阶段',
      '时期',
      '层级',
      '势力',
      '关系',
    ]);
    const sourceIndex = findColumnIndex(table.headers, [
      '来源',
      '说明',
      '特点',
      '切入角度',
      '背景',
      '影响',
      '特征',
      '冲突来源',
      '核心矛盾',
    ]);
    const resolutionIndex = findColumnIndex(table.headers, [
      '解决',
      '结局',
      '注意事项',
      '处理',
      '剧情作用',
      '作用',
      '常见冲突',
      '障碍',
    ]);

    return table.rows
      .map((row) => {
        const type = row[typeIndex] || fallbackType;
        const source =
          row[sourceIndex] ||
          row.find((cell, index) => index !== typeIndex && index !== resolutionIndex && cell) ||
          row.join(' / ');
        const resolution =
          row[resolutionIndex] ||
          row.find((cell, index) => index !== typeIndex && index !== sourceIndex && cell) ||
          source;

        return {
          type,
          source,
          resolution,
        };
      })
      .filter((entry) => entry.type && entry.source && entry.resolution);
  });
}

function extractConflictPatternFromSection(
  section: ParsedSection,
): Array<{type:string; source:string; resolution:string}> {
  const contentLines = section.content.split('\n');
  const looksLikeSubGenreCard =
    Boolean(extractFirstLabelValue(contentLines, ['特点'])) &&
    Boolean(extractFirstLabelValue(contentLines, ['核心爽点', '爽点', '适配'])) &&
    !extractFirstLabelValue(contentLines, ['冲突', '核心冲突', '核心矛盾', '危机', '障碍']);

  if (looksLikeSubGenreCard) {
    return [];
  }

  const tableConflicts = extractConflictPatternsFromTables(section.content, section.heading);
  if (tableConflicts.length > 0) {
    return tableConflicts;
  }

  const source =
    extractFirstLabelValue(contentLines, ['来源', '特点', '场景', '冲突', '核心冲突', '核心矛盾', '危机', '障碍']) ||
    summarizeContent(section.content);
  const resolution =
    extractFirstLabelValue(contentLines, ['解决', '反制', '关键', '风险', '结局', '出路', '处理', '应对', '作用']) ||
    source;

  if (!source) {
    return [];
  }

  return [{
    type: section.heading,
    source,
    resolution,
  }];
}

function parseReferenceWorks(value: string): string[] | undefined {
  if (!value) return undefined;
  const titleMatches = [...value.matchAll(/《([^》]+)》/g)].map((match) => match[1].trim());
  if (titleMatches.length > 0) return titleMatches;

  const splitMatches = value
    .split(/[、,，/]/)
    .map((item) => item.trim())
    .filter(Boolean);

  return splitMatches.length > 0 ? splitMatches : undefined;
}

function extractCoreSellingPoint(md: string): string {
  const match = md.match(/>\s*\*\*核心卖点\*\*:\s*(.+)/);
  return match ? match[1].trim() : '';
}

function extractSubGenres(sections: ParsedSection[]): Array<{name:string; description:string; coreAppeal:string; referenceWorks?: string[]}> {
  const genreSectionIndex = findSectionIndex(sections, ['流派', '类型', '细分']);
  if (genreSectionIndex < 0) return [];

  const childSections = getDirectChildSections(sections, genreSectionIndex);
  if (childSections.length === 0) return [];

  return childSections
    .map((section) => {
      const lines = section.content.split('\n');
      const description = extractFirstLabelValue(lines, ['特点', '适配']) || summarizeContent(section.content);
      const coreAppeal = extractFirstLabelValue(lines, ['核心爽点', '爽点']) || description;
      const referenceWorks = parseReferenceWorks(extractFirstLabelValue(lines, ['代表作']));
      return {
        name: section.heading,
        description,
        coreAppeal,
        referenceWorks,
      };
    })
    .filter((item) => item.name && (item.description || item.coreAppeal));
}

function extractWorldRules(sections: ParsedSection[]): Array<{name:string; description:string}> {
  const worldSectionIndex = findSectionIndex(sections, ['世界观', '社会学', '规则']);
  if (worldSectionIndex < 0) return [];

  const childSections = getDirectChildSections(sections, worldSectionIndex);
  if (childSections.length > 0) {
    return childSections
      .map((section) => ({
        name: section.heading,
        description: summarizeContent(section.content),
      }))
      .filter((item) => item.description);
  }

  const parentSummary = summarizeContent(sections[worldSectionIndex].content);
  return parentSummary ? [{ name: sections[worldSectionIndex].heading, description: parentSummary }] : [];
}

function extractPowerSystem(sections: ParsedSection[]): {name:string; tiers:Array<{name:string; description:string; stats?:string}>; balanceRules?:string[]} | undefined {
  const systemSectionIndex = findSectionIndex(sections, ['战力体系', '力量体系', '境界', '等级体系']);
  if (systemSectionIndex < 0) return undefined;

  const parent = sections[systemSectionIndex];
  const childSections = getDirectChildSections(sections, systemSectionIndex);
  const tierLines = [parent.content, ...childSections.map((section) => section.content)]
    .join('\n')
    .split('\n')
    .map(normalizeLine);

  const tiers = tierLines
    .map((line) => {
      const match = line.match(/^(?:\d+\.\s*)?(?:\*\*)?([^:*：]+?)(?:\*\*)?[:：]\s*([^（(]+?)(?:[（(]([^）)]+)[）)])?$/);
      if (!match) return null;
      const name = match[1].trim();
      const description = match[2].trim();
      const stats = match[3]?.trim();
      if (!name || !description) return null;
      return { name, description, stats };
    })
    .filter((item): item is {name:string; description:string; stats?:string} => Boolean(item));

  if (tiers.length === 0) return undefined;

  const balanceSource = childSections.find((section) => /控制|规则|平衡/.test(section.heading));
  const balanceRules = balanceSource
    ? balanceSource.content
      .split('\n')
      .map(normalizeLine)
      .filter((line) => line.startsWith('**') || line.includes(':') || line.includes('：') || line.length > 8)
      .map((line) => line.replace(/^\*\*([^*]+)\*\*[:：]\s*/, '$1: ').trim())
      .filter(Boolean)
    : undefined;

  return {
    name: parent.heading,
    tiers,
    balanceRules: balanceRules && balanceRules.length > 0 ? balanceRules : undefined,
  };
}

function extractOpportunityArc(sections: ParsedSection[]): Array<{name:string; description:string}> {
  const opportunitySectionIndex = findSectionIndex(sections, ['机缘获取', '四步法', 'Opportunity Arc']);
  if (opportunitySectionIndex < 0) return [];

  return sections[opportunitySectionIndex].content
    .split('\n')
    .map(normalizeLine)
    .map((line) => {
      const match = line.match(/^\d+\.\s*(?:\*\*)?([^:*：]+?)(?:\*\*)?[:：]\s*(.+)$/);
      if (!match) return null;
      return {
        name: match[1].trim().replace(/\s+\(.+\)$/, ''),
        description: match[2].trim(),
      };
    })
    .filter((item): item is {name:string; description:string} => Boolean(item));
}

function extractCoolPatterns(sections: ParsedSection[]): Array<{name:string; scenario:string; appeal:string; keyNote?:string}> {
  const coolSectionIndex = findSectionIndex(sections, ['爽点套路', '经典爽点', '爽点']);
  if (coolSectionIndex < 0) return [];

  const childSections = getDirectChildSections(sections, coolSectionIndex);
  if (childSections.length === 0) return [];

  return childSections
    .map((section) => {
      const content = section.content.split('\n');
      const scenario = extractFirstLabelValue(content, ['场景', '特点']) || summarizeContent(section.content);
      const appeal = extractFirstLabelValue(content, ['爽点', '反转', '核心爽点']) || scenario;
      const keyNote = extractFirstLabelValue(content, ['关键']);
      return {
        name: section.heading,
        scenario,
        appeal,
        keyNote: keyNote || undefined,
      };
    })
    .filter((item) => item.scenario || item.appeal);
}

export function extractConflictPatterns(sections: ParsedSection[]): Array<{type:string; source:string; resolution:string}> {
  const conflictSectionIndex = findSectionIndex(sections, ['冲突', '斗争手段', '对手设计', '冲突模板']);
  if (conflictSectionIndex >= 0) {
    const childSections = getDirectChildSections(sections, conflictSectionIndex);
    const explicitConflicts = dedupeConflictPatterns(
      childSections.length > 0
        ? childSections.flatMap(extractConflictPatternFromSection)
        : extractConflictPatternFromSection(sections[conflictSectionIndex]),
    );

    if (explicitConflicts.length > 0) {
      return explicitConflicts;
    }
  }

  const heuristicConflicts = sections.flatMap((section, index) => {
    const childSections = getDirectChildSections(sections, index);
    const hasRelevantChild = childSections.some(isLikelyConflictSection);
    if (!isLikelyConflictSection(section) && !hasRelevantChild) {
      return [];
    }

    const sectionConflicts = isLikelyConflictSection(section)
      ? extractConflictPatternFromSection(section)
      : [];
    const childConflicts = childSections
      .filter(isLikelyConflictSection)
      .flatMap(extractConflictPatternFromSection);

    return [...sectionConflicts, ...childConflicts];
  });

  return dedupeConflictPatterns(heuristicConflicts);
}

function extractPitfalls(sections: ParsedSection[]): Array<{description:string; severity:'critical' | 'warning' | 'info'}> {
  const sectionIndex = findSectionIndex(sections, ['雷区', '避免']);
  if (sectionIndex < 0) return [];

  const section = sections[sectionIndex];
  const childSections = getDirectChildSections(sections, sectionIndex);
  const groups = childSections.length > 0 ? childSections : [section];

  return groups.flatMap((group) => {
    const severity = group.heading.includes('必须') ? 'critical' : 'warning';
    return group.content
      .split('\n')
      .map(normalizeLine)
      .filter((line) => line.includes('❌'))
      .map((line) => ({
        description: line.replace(/.*❌\s*/, '').trim(),
        severity,
      }));
  });
}

function extractBestPractices(sections: ParsedSection[]): Array<{description:string}> {
  const sectionIndex = findSectionIndex(sections, ['雷区', '建议']);
  if (sectionIndex < 0) return [];

  const section = sections[sectionIndex];
  const childSections = getDirectChildSections(sections, sectionIndex);
  const groups = childSections.length > 0 ? childSections : [section];

  return groups.flatMap((group) =>
    group.content
      .split('\n')
      .map(normalizeLine)
      .filter((line) => line.includes('✅'))
      .map((line) => ({
        description: line.replace(/.*✅\s*/, '').trim(),
      }))
  );
}

function extractOutlineArcs(sections: ParsedSection[]): Array<{title:string; chapterRange:string; coreFocus:string; coreConflict:string; climax:string; characterGrowth?:string}> {
  const outlineSectionIndex = findSectionIndex(sections, ['大纲结构', '大纲节奏']);
  const arcSections = outlineSectionIndex >= 0
    ? getDirectChildSections(sections, outlineSectionIndex)
    : sections.filter((section) => /^(卷|篇|阶段|Act|Part|第.+卷|第.+部)/.test(section.heading));

  return arcSections.map((section) => {
    const headingRange = section.heading.match(/(\d+)\s*[-~—至到]\s*(\d+)/);
    const contentRange = section.content.match(/(\d+)\s*[-~—至到]\s*(\d+)/);
    const chapterRange = headingRange
      ? `${headingRange[1]}-${headingRange[2]}`
      : contentRange
        ? `${contentRange[1]}-${contentRange[2]}`
        : '1-100';

    const content = section.content.split('\n');
    const coreFocus = extractFirstLabelValue(content, ['核心']) || summarizeContent(section.content);
    const coreConflict =
      extractFirstLabelValue(content, ['核心冲突', '地位', '地图', '能力', '格局']) ||
      extractFirstLabelValue(content, ['冲突']) ||
      '';
    const climax = extractFirstLabelValue(content, ['高潮']) || '';
    const characterGrowth = extractFirstLabelValue(content, ['成长']) || undefined;

    return {
      title: section.heading,
      chapterRange,
      coreFocus: coreFocus || section.heading,
      coreConflict,
      climax,
      characterGrowth,
    };
  });
}

function extractEntityTags(md: string): Array<{type:string; nameVi:string; attributes:string[]}> {
  const entityMatches = [...md.matchAll(/<entity\s+type="([^"]+)"[^>]*\/>/g)];
  return entityMatches.map(m => {
    const tag = m[0];
    const type = m[1];
    const attrs = [...tag.matchAll(/(\w+)="[^"]*"/g)]
      .map(a => a[1])
      .filter(a => !['type', 'name', 'desc', 'tier'].includes(a));
    return { type, nameVi: type, attributes: attrs };
  });
}

function extractConstraintPacks(md: string): string[] {
  const matches = [...md.matchAll(/Pack\s+[A-Z]\d+/g)];
  return matches.map(m => m[0]);
}

function extractTargetWordCount(md: string): string | undefined {
  const match = md.match(/大纲结构[（(]\s*(\d+)\s*万字/);
  if (!match) return undefined;
  const totalWords = Number(match[1]) * 10000;
  return `${totalWords.toLocaleString('en-US').replace(/,/g, '.')} chữ`;
}

function extractTargetChapterCount(outlineArcs: Array<{chapterRange:string}>): number | undefined {
  const ranges = outlineArcs
    .map((arc) => arc.chapterRange.match(/(\d+)\s*-\s*(\d+)/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => Number(match[2]));

  if (ranges.length === 0) return undefined;
  return Math.max(...ranges);
}

function loadExistingTemplateData(tsPath: string): Record<string, unknown> | null {
  if (!fs.existsSync(tsPath)) return null;

  try {
    const content = fs.readFileSync(tsPath, 'utf-8');
    const match = content.match(/=\s*({[\s\S]*});\s*$/);
    if (!match) return null;
    return Function(`"use strict"; return (${match[1]});`)() as Record<string, unknown>;
  } catch {
    return null;
  }
}

function pickPreservedFields(existingData: Record<string, unknown> | null): Record<string, unknown> {
  if (!existingData) return {};

  const preserveKeys = [
    'languageRegister',
    'strandWeaveHint',
    'characterArchetypes',
    'characterScaleHint',
  ];

  return preserveKeys.reduce<Record<string, unknown>>((result, key) => {
    if (existingData[key] !== undefined) {
      result[key] = existingData[key];
    }
    return result;
  }, {});
}

// ─── Generator ────────────────────────────────────────────

function buildConflictPatternsFromCoolPatterns(
  coolPatterns: Array<{name:string; scenario:string; appeal:string; keyNote?:string}>,
): Array<{type:string; source:string; resolution:string}> {
  return coolPatterns
    .slice(0, 4)
    .map((pattern) => ({
      type: pattern.name,
      source: pattern.scenario || pattern.appeal,
      resolution: pattern.keyNote || pattern.appeal || pattern.scenario,
    }))
    .filter((pattern) => pattern.type && pattern.source && pattern.resolution);
}

function buildConflictPatternsFromSubGenres(
  subGenres: Array<{name:string; description:string; coreAppeal:string}>,
): Array<{type:string; source:string; resolution:string}> {
  return subGenres
    .slice(0, 4)
    .map((subGenre) => ({
      type: subGenre.name,
      source: subGenre.description || subGenre.coreAppeal,
      resolution: subGenre.coreAppeal || subGenre.description,
    }))
    .filter((pattern) => pattern.type && pattern.source && pattern.resolution);
}

export function buildTemplateData(
  filename: string,
  md: string,
  meta: typeof TEMPLATE_META[string],
  preservedFields: Record<string, unknown> = {},
): Record<string, unknown> {
  const sections = parseMdSections(md);
  const coreSellingPoint = extractCoreSellingPoint(md) || 'Thể loại đặc sắc.';
  const subGenres = extractSubGenres(sections);
  const worldRules = extractWorldRules(sections);
  const powerSystem = extractPowerSystem(sections);
  const opportunityArc = extractOpportunityArc(sections);
  const coolPatterns = extractCoolPatterns(sections);
  const pitfalls = extractPitfalls(sections);
  const bestPractices = extractBestPractices(sections);
  const outlineArcs = extractOutlineArcs(sections);
  const entityTags = extractEntityTags(md);
  const constraintPacks = extractConstraintPacks(md);
  const targetWordCount = extractTargetWordCount(md);
  const targetChapterCount = extractTargetChapterCount(outlineArcs);
  const conflictPatterns = (() => {
    const extractedConflicts = extractConflictPatterns(sections);
    if (extractedConflicts.length > 0) return extractedConflicts;

    const coolPatternConflicts = buildConflictPatternsFromCoolPatterns(coolPatterns);
    if (coolPatternConflicts.length > 0) return coolPatternConflicts;

    const subGenreConflicts = buildConflictPatternsFromSubGenres(subGenres);
    if (subGenreConflicts.length > 0) return subGenreConflicts;

    return outlineArcs
      .filter((arc) => arc.coreConflict)
      .slice(0, 4)
      .map((arc) => ({
        type: arc.title,
        source: arc.coreConflict,
        resolution: arc.climax || arc.coreFocus,
      }));
  })();

  const varName = meta.id.toUpperCase().replace(/-/g, '_') + '_TEMPLATE';
  const originalName = filename.replace('.md', '');
  const baseTemplate = {
    id: meta.id,
    name: meta.nameVi,
    originalName,
    coreSellingPoint,
    tags: meta.tags,
    subGenres: subGenres.length > 0 ? subGenres : [{ name: meta.nameVi, description: coreSellingPoint, coreAppeal: coreSellingPoint }],
    worldRules,
    powerSystem,
    opportunityArc: opportunityArc.length > 0 ? opportunityArc : undefined,
    coolPatterns,
    conflictPatterns,
    outlineArcs: outlineArcs.length > 0 ? outlineArcs : [
      { title: 'Quyển 1: Khởi Đầu', chapterRange: '1-80', coreFocus: 'Giới thiệu thế giới.', coreConflict: 'Xung đột đầu tiên.', climax: 'Bước ngoặt.' },
      { title: 'Quyển 2: Phát Triển', chapterRange: '81-200', coreFocus: 'Mở rộng.', coreConflict: 'Xung đột chính.', climax: 'Đỉnh cao.' },
      { title: 'Quyển 3: Kết Thúc', chapterRange: '201-350', coreFocus: 'Giải quyết.', coreConflict: 'Đối đầu cuối.', climax: 'Viên mãn.' },
    ],
    targetWordCount,
    targetChapterCount,
    pitfalls: pitfalls.length > 0 ? pitfalls : [{ description: 'Thiết lập trước sau mâu thuẫn.', severity: 'critical' as const }],
    bestPractices: bestPractices.length > 0 ? bestPractices : [{ description: 'Thiết lập tự nhất quán.' }],
    entityTags: entityTags.length > 0 ? entityTags : [{ type: 'nhan_vat', nameVi: 'Nhân vật', attributes: ['tính cách', 'vai trò'] }],
    constraintPacks: constraintPacks.length > 0 ? constraintPacks : [],
  };
  const mergedTemplate = {
    ...baseTemplate,
    ...preservedFields,
  };

  return mergedTemplate;
}

export function generateTemplate(
  filename: string,
  md: string,
  meta: typeof TEMPLATE_META[string],
  preservedFields: Record<string, unknown> = {},
): string {
  const mergedTemplate = buildTemplateData(filename, md, meta, preservedFields);
  const varName = meta.id.toUpperCase().replace(/-/g, '_') + '_TEMPLATE';

  return `/**
 * File: ${meta.id.replace(/-/g, '_')}_template.ts
 * Purpose: Story template cho thể loại ${meta.nameVi}
 * Layer: Data (Constants)
 * Domain: StoryTemplate
 * Deps: types/story_template
 * Generated by: scripts/convert_templates.ts
 */
import type { StoryTemplate } from '../../types/story_template';

export const ${varName}: StoryTemplate = ${JSON.stringify(mergedTemplate, null, 2)};
`;
}

// ─── Main ────────────────────────────────────────────────

export function main(args: string[] = process.argv.slice(2)) {
  const force = args.includes('--force');
  const onlyArg = args.find((arg) => arg.startsWith('--only='));
  const onlyFiles = onlyArg
    ? new Set(onlyArg.replace('--only=', '').split(',').map((item) => item.trim()).filter(Boolean))
    : null;
  const mdFiles = fs.readdirSync(MD_DIR).filter(f => f.endsWith('.md'));
  let generated = 0;
  const registryImports: string[] = [];
  const registryRegisters: string[] = [];
  const keywordEntries: string[] = [];

  for (const filename of mdFiles) {
    if (onlyFiles && !onlyFiles.has(filename)) continue;
    if (DONE.has(filename)) continue;
    const meta = TEMPLATE_META[filename];
    if (!meta) {
      console.log(`⚠️ No meta for ${filename}, skipping`);
      continue;
    }

    const md = fs.readFileSync(path.join(MD_DIR, filename), 'utf-8');
    const tsFilename = `${meta.id.replace(/-/g, '_')}_template.ts`;
    const tsPath = path.join(TS_DIR, tsFilename);
    const existedBefore = fs.existsSync(tsPath);
    const preservedFields = pickPreservedFields(loadExistingTemplateData(tsPath));
    const tsContent = generateTemplate(filename, md, meta, preservedFields);

    if (existedBefore && !force) {
      console.log(`⏭️ ${tsFilename} already exists, skipping`);
      continue;
    }

    fs.writeFileSync(tsPath, tsContent, 'utf-8');
    generated++;

    const varName = meta.id.toUpperCase().replace(/-/g, '_') + '_TEMPLATE';
    registryImports.push(`import { ${varName} } from './${meta.id.replace(/-/g, '_')}_template';`);
    registryRegisters.push(`register(${varName});`);

    for (const kw of meta.keywords) {
      keywordEntries.push(`    '${kw}': '${meta.id}',`);
    }

    console.log(`${existedBefore && force ? '♻️' : '✅'} ${filename} → ${tsFilename}`);
  }

  console.log(`\n═══ Generated ${generated} templates ═══\n`);
  console.log('=== Add to template_registry.ts imports: ===');
  console.log(registryImports.join('\n'));
  console.log('\n=== Add to register() calls: ===');
  console.log(registryRegisters.join('\n'));
  console.log('\n=== Add to KEYWORD_MAP: ===');
  console.log(keywordEntries.join('\n'));
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}
