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
const TEMPLATE_META: Record<string, {
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
  heading: string;
  content: string;
}

function parseMdSections(md: string): ParsedSection[] {
  const lines = md.split('\n');
  const sections: ParsedSection[] = [];
  let currentHeading = '';
  let currentContent: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,3}\s+(.+)/);
    if (headingMatch) {
      if (currentHeading) {
        sections.push({ heading: currentHeading, content: currentContent.join('\n').trim() });
      }
      currentHeading = headingMatch[1].trim();
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }
  if (currentHeading) {
    sections.push({ heading: currentHeading, content: currentContent.join('\n').trim() });
  }
  return sections;
}

function extractCoreSellingPoint(md: string): string {
  const match = md.match(/>\s*\*\*核心卖点\*\*:\s*(.+)/);
  return match ? match[1].trim() : '';
}

function extractSubGenres(sections: ParsedSection[]): Array<{name:string; description:string; coreAppeal:string}> {
  const genreSection = sections.find(s =>
    s.heading.includes('流派') || s.heading.includes('类型') || s.heading.includes('细分')
  );
  if (!genreSection) return [];

  const results: Array<{name:string; description:string; coreAppeal:string}> = [];
  const blocks = genreSection.content.split(/###\s+/);
  for (const block of blocks) {
    if (!block.trim()) continue;
    const lines = block.trim().split('\n');
    const name = lines[0]?.trim() || '';
    let desc = '', appeal = '';
    for (const line of lines) {
      if (line.includes('**特点**')) desc = line.replace(/.*\*\*特点\*\*[:：]\s*/, '').trim();
      if (line.includes('**核心爽点**')) appeal = line.replace(/.*\*\*核心爽点\*\*[:：]\s*/, '').trim();
    }
    if (name && (desc || appeal)) {
      results.push({ name, description: desc, coreAppeal: appeal || desc });
    }
  }
  return results;
}

function extractPitfalls(sections: ParsedSection[]): Array<{description:string; severity:string}> {
  const section = sections.find(s => s.heading.includes('雷区') || s.heading.includes('注意'));
  if (!section) return [];

  const results: Array<{description:string; severity:string}> = [];
  for (const line of section.content.split('\n')) {
    if (line.includes('❌')) {
      results.push({ description: line.replace(/.*❌\s*/, '').trim(), severity: 'warning' });
    }
  }
  return results;
}

function extractBestPractices(sections: ParsedSection[]): Array<{description:string}> {
  const section = sections.find(s => s.heading.includes('雷区') || s.heading.includes('建议'));
  if (!section) return [];

  const results: Array<{description:string}> = [];
  for (const line of section.content.split('\n')) {
    if (line.includes('✅')) {
      results.push({ description: line.replace(/.*✅\s*/, '').trim() });
    }
  }
  return results;
}

function extractOutlineArcs(sections: ParsedSection[]): Array<{title:string; chapterRange:string; coreFocus:string; coreConflict:string; climax:string}> {
  const arcSections = sections.filter(s =>
    s.heading.match(/卷[一二三四五六七八]/) || s.heading.match(/第[一二三四五]/)
  );

  return arcSections.map(s => {
    const chapterMatch = s.content.match(/(\d+)-(\d+)/);
    let focus = '', conflict = '', climax = '';
    for (const line of s.content.split('\n')) {
      if (line.includes('**核心**')) focus = line.replace(/.*\*\*核心\*\*[:：]\s*/, '').trim();
      if (line.includes('**高潮**')) climax = line.replace(/.*\*\*高潮\*\*[:：]\s*/, '').trim();
      if (line.includes('**地图**') || line.includes('**地位**') || line.includes('**能力**') || line.includes('**成长**'))
        conflict = line.replace(/.*\*\*[^*]+\*\*[:：]\s*/, '').trim();
    }
    return {
      title: s.heading,
      chapterRange: chapterMatch ? `${chapterMatch[1]}-${chapterMatch[2]}` : '1-100',
      coreFocus: focus || s.heading,
      coreConflict: conflict || '',
      climax: climax || '',
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

// ─── Generator ────────────────────────────────────────────

function generateTemplate(filename: string, md: string, meta: typeof TEMPLATE_META[string]): string {
  const sections = parseMdSections(md);
  const coreSellingPoint = extractCoreSellingPoint(md) || 'Thể loại đặc sắc.';
  const subGenres = extractSubGenres(sections);
  const pitfalls = extractPitfalls(sections);
  const bestPractices = extractBestPractices(sections);
  const outlineArcs = extractOutlineArcs(sections);
  const entityTags = extractEntityTags(md);
  const constraintPacks = extractConstraintPacks(md);

  const varName = meta.id.toUpperCase().replace(/-/g, '_') + '_TEMPLATE';
  const originalName = filename.replace('.md', '');

  return `/**
 * File: ${meta.id.replace(/-/g, '_')}_template.ts
 * Purpose: Story template cho thể loại ${meta.nameVi}
 * Layer: Data (Constants)
 * Domain: StoryTemplate
 * Deps: types/story_template
 * Generated by: scripts/convert_templates.ts
 */
import type { StoryTemplate } from '../../types/story_template';

export const ${varName}: StoryTemplate = ${JSON.stringify({
    id: meta.id,
    name: meta.nameVi,
    originalName,
    coreSellingPoint,
    tags: meta.tags,
    subGenres: subGenres.length > 0 ? subGenres : [{ name: meta.nameVi, description: coreSellingPoint, coreAppeal: coreSellingPoint }],
    worldRules: [],
    coolPatterns: [],
    conflictPatterns: [],
    outlineArcs: outlineArcs.length > 0 ? outlineArcs : [
      { title: 'Quyển 1: Khởi Đầu', chapterRange: '1-80', coreFocus: 'Giới thiệu thế giới.', coreConflict: 'Xung đột đầu tiên.', climax: 'Bước ngoặt.' },
      { title: 'Quyển 2: Phát Triển', chapterRange: '81-200', coreFocus: 'Mở rộng.', coreConflict: 'Xung đột chính.', climax: 'Đỉnh cao.' },
      { title: 'Quyển 3: Kết Thúc', chapterRange: '201-350', coreFocus: 'Giải quyết.', coreConflict: 'Đối đầu cuối.', climax: 'Viên mãn.' },
    ],
    pitfalls: pitfalls.length > 0 ? pitfalls : [{ description: 'Thiết lập trước sau mâu thuẫn.', severity: 'critical' }],
    bestPractices: bestPractices.length > 0 ? bestPractices : [{ description: 'Thiết lập tự nhất quán.' }],
    entityTags: entityTags.length > 0 ? entityTags : [{ type: 'nhan_vat', nameVi: 'Nhân vật', attributes: ['tính cách', 'vai trò'] }],
    constraintPacks: constraintPacks.length > 0 ? constraintPacks : [],
  }, null, 2)};
`;
}

// ─── Main ────────────────────────────────────────────────

function main() {
  const mdFiles = fs.readdirSync(MD_DIR).filter(f => f.endsWith('.md'));
  let generated = 0;
  const registryImports: string[] = [];
  const registryRegisters: string[] = [];
  const keywordEntries: string[] = [];

  for (const filename of mdFiles) {
    if (DONE.has(filename)) continue;
    const meta = TEMPLATE_META[filename];
    if (!meta) {
      console.log(`⚠️ No meta for ${filename}, skipping`);
      continue;
    }

    const md = fs.readFileSync(path.join(MD_DIR, filename), 'utf-8');
    const tsContent = generateTemplate(filename, md, meta);
    const tsFilename = `${meta.id.replace(/-/g, '_')}_template.ts`;
    const tsPath = path.join(TS_DIR, tsFilename);

    if (fs.existsSync(tsPath)) {
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

    console.log(`✅ ${filename} → ${tsFilename}`);
  }

  console.log(`\n═══ Generated ${generated} templates ═══\n`);
  console.log('=== Add to template_registry.ts imports: ===');
  console.log(registryImports.join('\n'));
  console.log('\n=== Add to register() calls: ===');
  console.log(registryRegisters.join('\n'));
  console.log('\n=== Add to KEYWORD_MAP: ===');
  console.log(keywordEntries.join('\n'));
}

main();
