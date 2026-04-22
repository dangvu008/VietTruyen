/**
 * File: scene_chunker.ts
 * Purpose: Chia chương truyện thành các Scene nhỏ hơn cho Vector RAG
 * Layer: AI / Memory
 */

import type { Scene } from '../../types/chapter_summary';
import { callAiModelTracked } from '../ai/tracked_ai_client';

const CHUNKER_PROMPT = `Bạn là chuyên gia rã bản thảo tiểu thuyết.
Nhiệm vụ: Cắt 1 chương dài thành các cảnh (scene) nhỏ dưa trên sự thay đổi về Địa điểm, Thời gian, hoặc POV.
Kết quả trả về PHẢI là chuỗi JSON chứa mảng các Cảnh.

Format JSON:
{
  "scenes": [
    {
      "time": "thời gian",
      "location": "địa điểm",
      "pov_character": "nhân vật góc nhìn",
      "summary": "tóm tắt ngắn gọn",
      "content": "TRÍCH XUẤT NGUYÊN VĂN TỪ BẢN GỐC cho cảnh này (không được sửa đổi từ ngữ)"
    }
  ]
}
`;

export async function chunkChapterIntoScenes(
  chapterId: string,
  chapterText: string,
  provider: string,
  modelId: string,
  _apiKey: string
): Promise<Scene[]> {
  const userPrompt = `Nội dung chương: \n\n${chapterText}`;
  
  const response = await callAiModelTracked({
    provider,
    modelId,
    modelName: modelId,
    systemPrompt: CHUNKER_PROMPT,
    userPrompt: userPrompt,
    taskType: 'summarize',
    responseFormat: 'json_object'
  });

  try {
    const raw = JSON.parse(response);
    if (!raw.scenes || !Array.isArray(raw.scenes)) return [];

    return raw.scenes.map((s: any, idx: number) => ({
      id: `${chapterId}-scene-${idx}`,
      chapter_id: chapterId,
      sequence: idx,
      time: s.time || '',
      location: s.location || '',
      pov_character: s.pov_character || '',
      summary: s.summary || '',
      content: s.content || ''
    }));
  } catch (err) {
    console.warn('Scene chunker failed parsing:', err);
    return [];
  }
}
