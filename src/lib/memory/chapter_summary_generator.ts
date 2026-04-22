/**
 * File: chapter_summary_generator.ts
 * Purpose: Tự động generate ChapterSummary có cấu trúc (10 fields) sau khi viết xong chương
 * Layer: AI / Memory
 */

import type { ChapterSummary } from '../../types/chapter_summary';
import { callAiModelTracked } from '../ai/tracked_ai_client';
import type { Project } from '../../types/story';

const SUMMARY_PROMPT = `Bạn là chuyên gia phân tích tiểu thuyết.
Nhiệm vụ: Trích xuất một Tóm Tắt có cấu trúc JSON từ chương truyện vừa được viết xong.
Yêu cầu: Không bình luận thêm, chỉ trả về chuỗi JSON hợp lệ.

Cấu trúc JSON yêu cầu:
{
  "plot_summary": "Tóm tắt 100-150 ký tự tập trung vào hành động cốt lõi",
  "time": "Mốc thời gian trong chương",
  "location": "Bối cảnh chính",
  "characters": ["Tên A", "Tên B"],
  "state_changes": ["Pháp khí X bị hỏng", "A và B kết thù"],
  "hook": { 
    "type": "crisis" | "mystery" | "emotion" | "choice" | "desire" | "none", 
    "strength": "strong" | "medium" | "weak", 
    "content": "Nội dung giữ chân người đọc ở cuối chương" 
  },
  "foreshadowing": [
    { "type": "planted" | "progressed" | "resolved", "content": "Mầm mống gì" }
  ],
  "bridge_point": "Móc nối logic gợi mở cho chương sau",
  "strand_dominant": "quest" | "fire" | "constellation"
}
`;

export async function generateChapterSummary(
  _project: Project,
  chapterId: string,
  chapterText: string,
  provider: string,
  modelId: string,
  _apiKey: string
): Promise<ChapterSummary> {
  const userPrompt = `Hãy phân tích nội dung chương sau và trả về JSON tóm tắt:\n\n${chapterText}`;
  
  const response = await callAiModelTracked({
    provider,
    modelId,
    modelName: modelId,
    systemPrompt: SUMMARY_PROMPT,
    userPrompt: userPrompt,
    taskType: 'summarize',
    responseFormat: 'json_object'
  });

  try {
    const raw = JSON.parse(response);
    return {
      chapter_id: chapterId,
      time: raw.time || '',
      location: raw.location || '',
      characters: raw.characters || [],
      state_changes: raw.state_changes || [],
      hook: raw.hook || { type: 'none', strength: 'weak', content: '' },
      plot_summary: raw.plot_summary || '',
      foreshadowing: raw.foreshadowing || [],
      bridge_point: raw.bridge_point || '',
      strand_dominant: raw.strand_dominant || 'quest',
    };
  } catch (err) {
    console.error('Failed to parse summary output', err);
    throw new Error('Summary Generation Failed: Invalid JSON format');
  }
}
