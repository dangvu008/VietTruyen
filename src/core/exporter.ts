import type { Project } from '../types/story';
import { generateCanonBundleArchive } from '../lib/canon/canon_bundle';
import { sortChaptersBySequence } from '../lib/memory/chapter_order';

export type ExportFormat = 'txt' | 'md' | 'html' | 'docx' | 'canon';

export interface ExportOptions {
  includeBible: boolean;
  includeWorld: boolean;
  includeCharacters: boolean;
  includeOutline: boolean;
  includeChapters: boolean;
  includeNotes: boolean;
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '') || 'viettruyen';

const buildSections = (project: Project, options: ExportOptions) => {
  const sections: { title: string; content: string[] }[] = [];

  if (options.includeBible) {
    sections.push({
      title: 'Series Bible',
      content: [
        `Tên truyện: ${project.title}`,
        project.logline ? `Logline: ${project.logline}` : '',
        project.genre ? `Thể loại: ${project.genre}` : '',
        project.tone ? `Giọng văn: ${project.tone}` : '',
        project.endgame ? `Đích đến cuối cùng: ${project.endgame}` : '',
      ].filter(Boolean),
    });
  }

  if (options.includeWorld) {
    sections.push({
      title: 'Thế giới',
      content: [
        project.world.geography ? `Địa lý: ${project.world.geography}` : '',
        project.world.magicSystem ? `Hệ thống năng lượng: ${project.world.magicSystem}` : '',
        project.world.techLevel ? `Công nghệ: ${project.world.techLevel}` : '',
        project.world.currency ? `Tiền tệ: ${project.world.currency}` : '',
        project.world.factions.length ? `Phe phái: ${project.world.factions.join(', ')}` : '',
        project.world.rules ? `Luật thế giới: ${project.world.rules}` : '',
      ].filter(Boolean),
    });
  }

  if (options.includeCharacters) {
    sections.push({
      title: 'Nhân vật',
      content: project.characters.length
        ? project.characters.map(
            (char) =>
              `${char.name} - ${char.role}. Hành trình: ${char.arc || 'Chưa mô tả'}. Giai đoạn: ${
                char.currentStage || 'Khởi đầu'
              }.`
          )
        : ['Chưa có nhân vật.'],
    });
  }

  if (options.includeOutline) {
    sections.push({
      title: 'Dàn ý',
      content: project.outline.length
        ? project.outline.map((beat, index) => `${index + 1}. ${beat.title}: ${beat.summary}`)
        : ['Chưa có dàn ý.'],
    });
  }

  if (options.includeChapters) {
    const sorted = sortChaptersBySequence(project.chapters);
    sections.push({
      title: 'Chương truyện',
      content: sorted.length
        ? sorted.map((chapter, index) => `Chương ${index + 1}: ${chapter.title}\n${chapter.content}`)
        : ['Chưa có chương.'],
    });
  }

  if (options.includeNotes && project.notes) {
    sections.push({
      title: 'Ghi chú',
      content: [project.notes],
    });
  }

  return sections;
};

const buildPlainText = (project: Project, options: ExportOptions) => {
  const sections = buildSections(project, options);
  return sections
    .map((section) => `${section.title}\n${section.content.join('\n')}`)
    .join('\n\n');
};

const buildMarkdown = (project: Project, options: ExportOptions) => {
  const sections = buildSections(project, options);
  return sections
    .map((section) => `# ${section.title}\n\n${section.content.map((line) => `- ${line}`).join('\n')}`)
    .join('\n\n');
};

const buildHtml = (project: Project, options: ExportOptions) => {
  const sections = buildSections(project, options);
  const body = sections
    .map(
      (section) =>
        `<section><h2>${escapeHtml(section.title)}</h2>${section.content
          .map((line) => `<p>${escapeHtml(line)}</p>`)
          .join('')}</section>`
    )
    .join('');
  return `<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><title>${escapeHtml(
    project.title
  )}</title><style>body{font-family:serif;background:#0b1120;color:#e2e8f0;padding:32px;line-height:1.6}h1,h2{color:#38bdf8}section{margin-bottom:32px}</style></head><body><h1>${escapeHtml(
    project.title
  )}</h1>${body}</body></html>`;
};

const downloadBlob = (blob: Blob, filename: string) => {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
};

export const exportProject = async (
  project: Project,
  format: ExportFormat,
  options: ExportOptions
) => {
  const slug = slugify(project.title);

  if (format === 'txt') {
    const content = buildPlainText(project, options);
    downloadBlob(new Blob([content], { type: 'text/plain;charset=utf-8' }), `${slug}.txt`);
    return;
  }

  if (format === 'md') {
    const content = buildMarkdown(project, options);
    downloadBlob(new Blob([content], { type: 'text/markdown;charset=utf-8' }), `${slug}.md`);
    return;
  }

  if (format === 'html') {
    const content = buildHtml(project, options);
    downloadBlob(new Blob([content], { type: 'text/html;charset=utf-8' }), `${slug}.html`);
    return;
  }

  if (format === 'docx') {
    const { Document, Packer, Paragraph, HeadingLevel } = await import('docx');
    const sections = buildSections(project, options);
    const paragraphs = [];
    paragraphs.push(
      new Paragraph({
        text: project.title,
        heading: HeadingLevel.TITLE,
      })
    );
    sections.forEach((section) => {
      paragraphs.push(new Paragraph({ text: section.title, heading: HeadingLevel.HEADING_1 }));
      section.content.forEach((line) => paragraphs.push(new Paragraph({ text: line })));
    });
    const doc = new Document({ sections: [{ children: paragraphs }] });
    const blob = await Packer.toBlob(doc);
    downloadBlob(blob, `${slug}.docx`);
    return;
  }

  if (format === 'canon') {
    const archive = await generateCanonBundleArchive(project, options);
    downloadBlob(archive, `${slug}-canon.zip`);
  }
};
