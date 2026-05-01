# Đặc tả Canonical cho Agent của VietTruyen

Trạng thái: canonical  
Phiên bản: v1  
Độc giả chính: coding agent, implementation agent, reviewer agent

## 1. Mục tiêu

Đây là tài liệu nguồn chân lý để agent hiểu đúng sản phẩm hiện tại.

Tài liệu này ưu tiên hơn các tài liệu cũ khi có xung đột, đặc biệt:

- `SDD.md`
- `DESIGN.md`
- `docs/platform-orchestration-shift.md`
- `src/app/render_active_page.tsx`
- `src/components/layout/TopMenu.tsx`

## 2. Product Story Canonical

Sản phẩm canonical là:

- Một desktop workspace viết web novel.
- Có 2 lớp IA: `global shell` và `project workspace`.
- Không phải chat-first app.
- Không phải menu lớn theo mọi engine nội bộ.

Guest mode:

- Chỉ để test nội bộ.
- Không được xem là product flow chính.

## 3. Canonical Navigation

Nguồn chân lý:

- `src/types/navigation.ts`
- `src/App.tsx`
- `src/app/global_page_registry.tsx`
- `src/app/project_page_registry.tsx`

Global tabs canonical:

- `dashboard`
- `projects`
- `adaptation`
- `community`
- `ai-settings`

Project tabs canonical:

- `bible`
- `characters`
- `world`
- `outline`
- `writer`
- `chapters`
- `storymap`
- `review`
- `export`

## 4. Legacy Navigation Không Được Xem Là Canon

Những file sau là legacy, archive, hoặc tham khảo:

- `src/app/render_active_page.tsx`
- `src/components/layout/TopMenu.tsx`
- `src/components/layout/EtherealLayout.tsx`

Những màn sau có dấu vết mock/demo flow, không được xem là product truth:

- `src/components/pages/WriterPage.tsx`
- `src/components/pages/AdaptationPage.tsx`

Những tab sau không phải top-level canonical ở v1:

- `studio`
- `brainstorm`
- `chua-canon`
- `genre-library`
- `writing-wizard`
- `memory`
- `foreshadowing`
- `analytics`

Nếu cần tái sử dụng một module trong nhóm này:

- Không được tự động bung lại thành top-level route.
- Chỉ được hook vào flow canonical nếu có yêu cầu rõ ràng.

## 5. Canonical Product Surfaces

### Global Shell

`dashboard`

- Resume công việc.
- Chuyển vào dự án đang mở.

`projects`

- Tạo, tìm, mở, quản lý dự án.

`adaptation`

- Tạo project mới từ nguồn tải lên hoặc source project.

`community`

- Publish, feed, workshop, comments, reports.

`ai-settings`

- Model settings và runtime settings.

### Project Workspace

`bible`

- Khai báo identity và setup cốt lõi của truyện.

`characters`

- CRUD nhân vật và canon nhân vật.

`world`

- CRUD world rules và canon thế giới.

`outline`

- Planning 3-tier và beats.

`writer`

- Điểm vào chính của workflow viết.
- Màn editor/writing orchestration.

`chapters`

- Trung tâm manuscript management.
- Summary, version, branch, collab, discussion.

`storymap`

- Bản đồ trực quan toàn bộ câu chuyện (read-only).
- 3 views: Timeline (chương + arc + act structure), Nhân vật (character graph), Phục bút (foreshadowing tracker).
- Không edit trực tiếp — click để navigate sang tab tương ứng.
- Zero backend mới — toàn bộ dữ liệu từ Project type hiện có.

`review`

- Chạy checker và đọc review report.

`export`

- Xuất manuscript.

## 6. Hệ thống nâng cao: vai trò canonical

Không coi các hệ thống này là tab canonical riêng trong v1.

### Memory

Vai trò:

- Backend/supporting system.
- Tự động sync và index.
- Cấp context cho writer, review, retcon.

Nguồn chính:

- `src/components/system/MemoryBootstrap.tsx`
- `src/lib/memory/*`
- `src/db/narrative_db.ts`

### Retcon

Vai trò:

- Modal/contextual workflow khi user sửa canon.

Nguồn chính:

- `src/store/use_retcon_store.ts`
- `src/components/shared/RetconImpactModal.tsx`

### Surgery

Vai trò:

- Advanced restructuring workflow.
- Không phải top-level canonical tab hiện tại.

Nguồn chính:

- `src/store/use_surgery_store.ts`
- `src/lib/surgery/*`

## 7. Canonical Data Contracts

Nguồn chân lý:

- `src/types/story.ts`
- `src/types/workflow.ts`

Entity canonical:

- `Project`
- `Chapter`
- `Character`
- `WorldRules`
- `OutlineBeat`
- `Foreshadowing`
- `MasterOutline`

Project là aggregate root.

Nguyên tắc:

- Mọi sửa đổi state cấp dự án đi qua `use_project_store`.
- Chapter payload ưu tiên lưu ở IndexedDB khi đã có nội dung.
- Store persisted localStorage chỉ giữ metadata nhẹ; chapter content đầy đủ hydrate từ Dexie.

## 8. Canonical State Ownership

### Project state

Nguồn chân lý:

- `src/store/use_project_store.ts`

Trách nhiệm:

- CRUD project.
- CRUD world, character, outline, chapter, foreshadowing.
- Adapt project.
- Hydrate/persist chapters.

### Workflow state

Nguồn chân lý:

- `src/store/use_workflow_session_store.ts`
- `src/lib/workflow/writer_orchestrator.ts`
- `src/lib/workflow/full_write_pipeline.ts`

Trách nhiệm:

- Tạo và theo dõi workflow session.
- Chạy plan/write/full pipeline.

### AI settings state

Nguồn chân lý:

- `src/store/use_ai_store.ts`
- `src/lib/ai/model_router.ts`

### Community state

Nguồn chân lý:

- `src/store/use_community_store.ts`
- `src/lib/supabase/community_service.ts`

## 9. Canonical Workflow Contract

Mục tiêu kiến trúc:

- UI không nên tự gọi AI theo kiểu ngẫu hứng.
- UI nên dispatch action/intent.
- Workflow layer thực thi orchestration.

Workflow steps hợp lệ:

- `idle`
- `planning`
- `context_building`
- `drafting`
- `reviewing`
- `polishing`
- `data_processing`
- `syncing`
- `persisting`
- `completed`
- `failed`
- `cancelled`

Intent canonical đã có:

- `plan_chapter_branches`
- `write_chapter_from_branch`
- `full_write_pipeline`

## 10. Mục tiêu refactor canonical

Nếu agent cần ra quyết định, ưu tiên:

1. Làm rõ và giữ vững dual-shell IA.
2. Đẩy `writer` về đúng vai trò workflow-first.
3. Giữ `chapters` là manuscript hub.
4. Giữ memory/retcon/surgery là support systems.
5. Không mở thêm route mới nếu không có quyết định sản phẩm mới.

## 11. Không được tự động mở rộng phạm vi

Agent không được tự động:

- Hồi sinh lại `TopMenu` hay router cũ làm navigation chính.
- Thêm top-level tab mới.
- Biến guest mode thành first-class product flow.
- Đẩy chat-first assistant thành trung tâm sản phẩm.
- Coi các mockup cũ là source of truth.

## 12. Nếu cần chọn giữa code và doc cũ

Thứ tự ưu tiên:

1. Tài liệu này
2. `docs/CANONICAL_PRODUCT_SPEC.md`
3. `src/types/navigation.ts`
4. `src/types/story.ts`
5. `src/types/workflow.ts`
6. `src/App.tsx` + page registries
7. Các doc cũ chỉ để tham khảo

## 13. Hướng dẫn cho agent khi sửa code

- Nếu sửa navigation, chỉ sửa theo `global/project shell`.
- Nếu thêm tính năng mới, gắn nó vào một surface canonical sẵn có trước.
- Nếu dùng module legacy, phải nói rõ nó đang được tái sử dụng ở mức nào.
- Nếu gặp xung đột giữa mockup đẹp và workflow thật, ưu tiên workflow thật.
- Nếu cần viết thêm doc, cập nhật 2 tài liệu canonical này trước.
- Neu can viet them doc, cap nhat 2 tai lieu canonical nay truoc.
