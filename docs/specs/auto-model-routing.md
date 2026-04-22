# Spec: Auto Model Routing

## Objective
Thêm cơ chế tự động chọn AI model theo từng loại tác vụ để tối ưu chi phí và token, đồng thời cho phép người dùng:
- bật hoặc tắt Smart Routing,
- chọn một model cố định cho toàn bộ app khi Smart Routing tắt,
- gán model thủ công cho từng tác vụ khi Smart Routing bật.

Success nghĩa là người dùng có thể chuyển rõ ràng giữa `tự động` và `thủ công`, còn runtime AI luôn lấy đúng model theo cấu hình đó.

## Assumptions
1. App hiện đã có `activeModelId = 'auto'` như một dạng Smart Routing cơ bản.
2. Các tác vụ AI đang đi qua `getModelForTask(...)` và có thể mở rộng mà không cần đổi giao thức backend.
3. Mục tiêu là tối ưu chọn model ở frontend/store level, không thay đổi proxy API.

## Commands
Build: `npm run build`
Test: `npm run test:run`
Dev: `npm run dev`

## Project Structure
`src/lib/ai/model_router.ts` → logic chọn model theo task
`src/store/use_ai_store.ts` → persisted AI settings
`src/components/pages/AiSettingsPage.tsx` → trang cấu hình AI đầy đủ
`src/components/shared/AiOptionsTab.tsx` → quick settings trong assistant
`src/components/shared/AiModelSelector.tsx` → dropdown chọn nhanh model
`src/lib/**/*.test.ts` → unit tests cho logic routing

## Code Style
Giữ logic routing thuần, ưu tiên helper nhỏ và type rõ ràng:

```ts
const overrideModelId = taskModelOverrides[taskType];
if (overrideModelId && overrideModelId !== 'auto') {
  return available.find((model) => model.id === overrideModelId);
}
```

## Testing Strategy
- Unit test cho `model_router.ts`
- Kiểm tra các trường hợp:
  - manual override thắng Smart Routing
  - Smart Routing dùng override theo task nếu có
  - Smart Routing fallback theo tier preference nếu không có override
  - override không khả dụng thì fallback an toàn
- Chạy build TypeScript/Vite để bắt vỡ type ở các call site

## Boundaries
- Always: giữ backward compatibility với persisted state cũ, không đổi contract proxy API
- Ask first: thêm dependency mới, đổi backend API, xóa model mặc định
- Never: hardcode API key, phá flow manual hiện có

## Success Criteria
1. Có công tắc bật/tắt Smart Routing trong UI settings.
2. Khi Smart Routing tắt, app dùng model manual đã chọn cho mọi tác vụ.
3. Khi Smart Routing bật, app tự chọn model theo task type và tier preference.
4. Người dùng có thể gán model riêng cho từng task trong Smart Routing.
5. Có test chứng minh routing đúng ở các nhánh chính.

## Open Questions
- Chưa thêm UI mapping cho mọi task label qua i18n; trước mắt dùng label tiếng Việt cục bộ trong AI settings.
