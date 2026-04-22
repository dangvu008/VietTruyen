/**
 * File: story_preview.ts
 * Purpose: Tạo bối cảnh (context mồi) cho các truy vấn AI (extract world, characters, outline)
 * Layer: Application (AI)
 * Domain: AI → [Trích xuất dữ liệu gốc truyện dựa trên chapters & tóm tắt]
 */

import { useProjectStore, getProjectSnapshot } from '../../store/use_project_store';
import type { Project } from '../../types/story';

/**
 * Trích xuất đoạn text tổng quát: ưu tiên dùng bản tóm tắt của tất cả các chương. 
 * Nếu các chương chưa có tóm tắt do vừa upload bằng raw text, lấy 1-3 chương đầu làm dữ liệu mồi.
 */
export function generatePreviewFromProject(project: Project, maxChars = 3500): string {
  if (!project.chapters || project.chapters.length === 0) return '';
  
  // 1. Ưu tiên nối những chapters có .summary (đã xử lý AI hoặc import format xịn)
  const chaptersWithSummary = project.chapters.filter(c => c.summary && c.summary.trim() !== '');
  if (chaptersWithSummary.length > 0) {
    const combined = chaptersWithSummary
      .map(c => `[Chương ${c.sequenceNumber || '?'}: ${c.title}]\n${c.summary}`)
      .join('\n\n');
    
    if (combined.length > maxChars) {
      return combined.slice(0, maxChars) + '\n...[Đã cắt bớt cho AI context]';
    }
    return combined;
  }
  
  // 2. Chấm dứt bằng việc lấy nội dung RAW vài chương đầu
  const content = project.chapters
    .slice(0, 3)
    .map(c => `[Chương ${c.sequenceNumber || '?'}: ${c.title}]\n${c.content}`)
    .join('\n\n');
    
  if (content.length > maxChars) {
    return content.slice(0, maxChars) + '\n...[Đã cắt bớt cho AI context]';
  }
  
  return content;
}

/**
 * Lấy `storyPreview` dựa trên project hiện tại.
 * Logic: nếu đã có preview cache thì gọi thẳng -> Không load full chapters từ Disk!
 * Chỉ khi cache trống, mới fetch full chapters, sinh ra preview, cache lại.
 */
export async function getOrGenerateStoryPreview(projectId: string): Promise<string> {
  const store = useProjectStore.getState();
  const project = store.projects.find(p => p.id === projectId);
  if (!project) return '';

  // Return cached result if exist to save I/O and processing operations
  if (project.storyPreview && project.storyPreview.trim() !== '') {
    return project.storyPreview;
  }

  // Reload the full snapshot because active `project.chapters` often has `content = ''` stripped
  const fullProject = await getProjectSnapshot(projectId);
  if (!fullProject) return '';

  const preview = generatePreviewFromProject(fullProject);
  
  // Update it back to store so it gets cached
  if (preview.trim() !== '') {
    store.updateProject(projectId, { storyPreview: preview });
  }

  return preview;
}
