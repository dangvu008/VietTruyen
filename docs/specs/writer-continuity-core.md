# Spec: Writer Continuity Core

## Objective
Thêm một lõi viết truyện mới cho VietTruyen gồm 3 tính năng liên kết chặt với nhau:
- `Chapter Context Capsule`: tóm tắt cấu trúc của từng chương để làm ngữ cảnh bền vững.
- `Continuity Guard`: kiểm tra lệch canon, lệch mạch truyện, và lặp tình tiết trước khi tác giả chốt chương.
- `Self-Reflection`: cho AI tự rà lại bản nháp theo dàn ý và canon trước khi trả kết quả cuối.

Mục tiêu là tăng chất lượng viết chương dài hơi trong workflow canonical của VietTruyen mà không biến app thành chat-first tool.

## Product Fit
- `writer`: nơi chạy pipeline draft -> self-review -> rewrite.
- `chapters`: nơi lưu và xem capsule của từng chương như metadata bền vững.
- `review`: nơi hiển thị continuity report và cảnh báo theo chapter/project.

Không tạo top-level tab mới. Memory và retcon vẫn là hệ supporting phía sau.

## Core Experience
1. Tác giả mở `writer`, chọn chương, bấm viết AI.
2. Hệ thống dựng ngữ cảnh từ `bible`, `characters`, `world`, `outline`, các capsule gần nhất, và chapter hiện tại.
3. Nếu bật `Self-Reflection`, AI sinh draft lần 1, tự đối chiếu dàn ý/canon/văn phong, rồi rewrite một bản sạch hơn.
4. Khi lưu chương, hệ thống tạo hoặc cập nhật `Chapter Context Capsule`.
5. Tác giả mở `review` để xem `Continuity Guard` báo lỗi mạch truyện, OOC, mâu thuẫn rule, hoặc payoff bị bỏ quên.

## Feature Breakdown
### 1. Chapter Context Capsule
Capsule là metadata cấp chapter, nhỏ hơn nội dung chương nhưng giàu tín hiệu hơn `summary` hiện tại.

Capsule nên chứa:
- mục tiêu cảnh/chương
- nhân vật xuất hiện và trạng thái mới
- thay đổi canon hoặc dữ kiện mới
- bí mật, nợ tình tiết, foreshadowing mới gieo hoặc đã trả
- quan hệ với beat/volume hiện tại
- gợi ý cầu nối sang chương tiếp theo

Capsule là đầu vào chính cho các lần viết tiếp theo và cho continuity scan.

### 2. Continuity Guard
Guard đọc:
- `bible`, `characters`, `world`
- outline và master outline nếu có
- capsule của các chương gần nhất
- chapter hiện tại hoặc chapter vừa sửa

Guard trả ra issue có cấu trúc:
- `severity`: info | warning | critical
- `category`: canon | character_voice | timeline | foreshadowing | repetition | outline_drift
- `chapterId`
- `message`
- `evidence`
- `suggestion`

Guard không tự sửa nội dung. Nó chỉ phát hiện, xếp hạng, và đề xuất điểm cần xem lại.

### 3. Self-Reflection
Trong `writer`, thêm chất lượng chạy:
- `Fast`: draft thẳng, bỏ qua reflection loop
- `Balanced`: draft + 1 lượt self-review ngắn
- `Quality`: draft + structured self-review + rewrite

Checklist reflection tối thiểu:
- có bám beat/chapter goal không
- có lặp ý, lặp mô tả, hoặc văn phong máy không
- thoại có lệch chất nhân vật không
- có sai canon hoặc quên setup gần đó không
- nhịp chương có đúng mode của truyện không

## Proposed Data Contracts
Không thay `Project` ownership. Dữ liệu mới vẫn đi qua `use_project_store` hoặc storage liên quan chapter.

```ts
export interface ChapterContextCapsule {
  chapterId: string;
  projectId: string;
  summary: string;
  chapterGoal: string;
  beatRef?: string;
  activeCharacters: string[];
  canonDeltas: string[];
  relationshipDeltas: string[];
  openLoops: string[];
  resolvedLoops: string[];
  foreshadowingSignals: Array<{
    type: 'planted' | 'progressed' | 'resolved';
    content: string;
  }>;
  nextBridgeHint: string;
  generatedAt: string;
}

export interface ContinuityIssue {
  id: string;
  projectId: string;
  chapterId: string;
  severity: 'info' | 'warning' | 'critical';
  category:
    | 'canon'
    | 'character_voice'
    | 'timeline'
    | 'foreshadowing'
    | 'repetition'
    | 'outline_drift';
  message: string;
  evidence: string[];
  suggestion?: string;
}
```

`Chapter.summary` hiện tại vẫn giữ vai trò summary ngắn. Capsule là lớp metadata giàu ngữ cảnh hơn, không thay thế chapter content.

## Project Structure
- `src/types/story.ts`: mở rộng metadata chapter hoặc project-level references nếu cần.
- `src/types/chapter_summary.ts`: có thể tách hoặc nâng cấp thành nguồn contract cho capsule.
- `src/types/workflow.ts`: thêm cờ cho reflection quality mode và artifact mới.
- `src/store/use_project_store.ts`: lưu, cập nhật, hydrate capsule cùng chapter lifecycle.
- `src/store/use_workflow_session_store.ts`: orchestration cho reflection steps.
- `src/components/story-editor/StoryWorkspace.tsx`: trigger write flow và đọc quality mode.
- `src/components/pages/ChaptersPage.tsx`: hiển thị capsule và trạng thái đã index hay chưa.
- `src/components/pages/ReviewPage` hoặc bề mặt review tương đương: render continuity issues.

## Delivery Order
1. `Chapter Context Capsule`
2. `Continuity Guard`
3. `Self-Reflection`

Lý do: reflection và guard đều cần capsule làm lớp ngữ cảnh ổn định, nếu không sẽ tiếp tục phụ thuộc vào raw chapter text và prompt ngắn hạn.

## Boundaries
- Always: bám canonical tabs `writer`, `chapters`, `review`; giữ `use_project_store` là owner của project data.
- Always: offline-first, chapter content vẫn ưu tiên IndexedDB; metadata mới không được làm block editor.
- Ask first: thêm backend sync contract mới hoặc index dài hạn ngoài local storage/Dexie hiện có.
- Never: tạo top-level route mới cho memory, foreshadowing, continuity, hoặc reflection.
- Never: cho AI tự động overwrite chapter final mà không có bước user review rõ ràng.

## Success Criteria
- Mỗi chapter có thể có một capsule được tạo tự động sau save hoặc AI write.
- `writer` có ít nhất 3 mức chất lượng chạy, trong đó `Quality` dùng self-reflection loop.
- `review` hiển thị continuity issues theo category và severity.
- AI viết tiếp chương sau dùng capsule gần nhất thay vì chỉ dựa vào `summary` thủ công.
- Guard phát hiện được ít nhất các lỗi: sai canon nhân vật, lệch outline, lặp tình tiết, quên payoff gần.

## Open Questions
- Capsule nên lưu inline trong chapter metadata hay tách bảng riêng trong Dexie để dễ re-index?
- `review` sẽ chạy theo chapter hiện tại, theo batch nhiều chapter, hay cả hai?
- Có cần cho user chỉnh tay capsule để sửa AI summary sai, hay giai đoạn đầu chỉ regenerate?
