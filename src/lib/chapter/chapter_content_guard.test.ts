import { describe, expect, it } from 'vitest';

import { guardChapterContent } from './chapter_content_guard';

describe('chapter_content_guard', () => {
  it('extracts prose when writer markers and ledger leak into the response', () => {
    const raw = `@@LEDGER@@
{"summary":"Lục Phong chạm vào cấm chế.","beatStatus":"hit","usedCharacterNames":["Lục Phong"],"introducedEntities":[],"foreshadowPlanted":[],"preservedAnchorIds":[]}
@@CONTENT@@
Lục Phong chạm tay lên vách đá lạnh buốt, nghe từng mạch linh lực rít qua kẽ tay.`;

    expect(guardChapterContent(raw)).toEqual(
      expect.objectContaining({
        content: 'Lục Phong chạm tay lên vách đá lạnh buốt, nghe từng mạch linh lực rít qua kẽ tay.',
        sanitized: true,
        rejected: false,
      }),
    );
  });

  it('rejects metadata-only payloads so they never become chapter prose', () => {
    const raw = `@@LEDGER@@
{"summary":"Lục Phong chạm vào cấm chế.","beatStatus":"hit","usedCharacterNames":["Lục Phong"],"introducedEntities":[],"foreshadowPlanted":[],"preservedAnchorIds":[]}`;

    expect(guardChapterContent(raw)).toEqual(
      expect.objectContaining({
        content: '',
        sanitized: true,
        rejected: true,
      }),
    );
  });

  it('keeps interrupted autosave drafts recoverable by stripping metadata without rejecting emptiness', () => {
    const raw = `@@LEDGER@@
{"summary":"Lục Phong chạm vào cấm chế.","beatStatus":"hit","usedCharacterNames":["Lục Phong"],"introducedEntities":[],"foreshadowPlanted":[],"preservedAnchorIds":[]}`;

    expect(guardChapterContent(raw, { allowEmptyAfterSanitize: true })).toEqual(
      expect.objectContaining({
        content: '',
        sanitized: true,
        rejected: false,
      }),
    );
  });

  it('extracts prose from a raw chapter JSON payload instead of keeping the serialized object', () => {
    const raw = `{"chapter":1,"title":"Linh Gia Cứu Hoang Thần Tố","content":"Sóng xiên thành vách bạc, cuốn từ chân trời trào đến bìa rừng dừa nước. Chiếc thuyền nan buồm dệt lỗ chỗ, trôi lững lờ giữa vùng biển lạ."}`;

    expect(guardChapterContent(raw)).toEqual(
      expect.objectContaining({
        content:
          'Sóng xiên thành vách bạc, cuốn từ chân trời trào đến bìa rừng dừa nước. Chiếc thuyền nan buồm dệt lỗ chỗ, trôi lững lờ giữa vùng biển lạ.',
        sanitized: true,
        rejected: false,
      }),
    );
  });

  it('strips trailing quote-brace artifacts from interrupted writer output', () => {
    const raw = `Cuộc trò chuyện sẽ đến sau."}`;

    expect(guardChapterContent(raw)).toEqual(
      expect.objectContaining({
        content: 'Cuộc trò chuyện sẽ đến sau.',
        sanitized: true,
        rejected: false,
      }),
    );
  });

  it('strips technical terms concatenated with Vietnamese text (e.g. "vậtRuntime")', () => {
    const raw = `– Hắn hiểu rồi! – Giọng tu sĩ giáo phái Thiên Hải trên chiến thuyền đối diện vút lên the thé. – Phế vậtRuntime! Đem anh ta đến giáo chủ!`;

    const result = guardChapterContent(raw);
    expect(result.content).not.toContain('Runtime');
    expect(result.content).toContain('Phế vật');
    expect(result.content).toContain('Đem anh ta đến giáo chủ');
    expect(result.sanitized).toBe(true);
    expect(result.rejected).toBe(false);
  });

  it('strips standalone technical terms surrounded by Vietnamese prose', () => {
    const raw = `Hắn nhìn lên trời, Promise rồi quay đầu bỏ đi.`;

    const result = guardChapterContent(raw);
    expect(result.content).not.toContain('Promise');
    expect(result.sanitized).toBe(true);
    expect(result.rejected).toBe(false);
  });

  it('extracts prose from inline JSON fragments within text', () => {
    const raw = `{"chapter": 1, "title": "Linh Gia Cứu Hoang Thần Tổ", "content": "Sóng biển cuồn cuộn, gió đưa cánh buồm rách lên cao."}`;

    const result = guardChapterContent(raw);
    expect(result.content).toContain('Sóng biển cuồn cuộn');
    expect(result.content).not.toContain('"chapter"');
    expect(result.sanitized).toBe(true);
    expect(result.rejected).toBe(false);
  });

  it('preserves legitimate English words in modern setting stories', () => {
    const raw = `CEO Nguyễn Văn An bước vào phòng họp, laptop trước mặt đã mở sẵn bản trình bày.`;

    const result = guardChapterContent(raw);
    // "CEO" and "laptop" are not in the banned technical terms list
    expect(result.content).toContain('CEO');
    expect(result.content).toContain('laptop');
    expect(result.rejected).toBe(false);
  });
});
