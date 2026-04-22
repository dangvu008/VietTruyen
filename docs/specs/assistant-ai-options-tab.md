# Spec: Assistant AI Options Tab

## Objective
Thêm tab `Tuỳ chọn AI` vào Assistant drawer/widget để gom phần chọn model và các thiết lập cục bộ của Assistant vào cùng một chỗ, giảm nhiễu ở header và khớp mockup tabbed interface.

## Commands
- Build: `npm run build`
- Test: `npm run test:run -- src/lib/ai/ai_client.test.ts`

## Project Structure
- `src/store/use_ai_store.ts` lưu AI settings cục bộ qua Zustand persist
- `src/components/shared/AiAssistant.tsx` render tab `Chat` và `Tuỳ chọn AI`
- `src/components/shared/AiOptionsTab.tsx` chứa UI settings mới
- `src/lib/ai/tracked_ai_client.ts` và `src/lib/ai/ai_client.ts` truyền generation params cho Assistant chat

## Code Style
- Giữ component nhỏ, state cục bộ tối thiểu, ưu tiên derived state qua `useMemo`
- Không tạo store mới nếu state đã thuộc `use_ai_store`
- Chỉ nối runtime cho Assistant chat ở đợt này, tránh lan sang pipeline khác

## Testing Strategy
- Bổ sung test cho `callAiProxy` để xác nhận `temperature` và `topP` được truyền xuống request body
- Chạy build TypeScript/Vite để bắt lỗi tích hợp UI và type errors

## Boundaries
- Always: giữ `Smart Routing` là option đầu tiên, persist local settings, giữ giao diện dark/nocturnal
- Ask first: mở rộng effect của generation params sang các workflow AI khác ngoài Assistant chat
- Never: xoá logic model routing hiện tại hoặc đổi hành vi pipeline ngoài scope đã chốt

## Success Criteria
- Assistant có 2 tab `Chat` và `Tuỳ chọn AI`
- Header không còn dropdown `AiModelSelector`
- `use_ai_store` persist được `temperature`, `topP`, `contextSize`, `autoSummarize`, `persona`, `activeExperts`
- `temperature` và `topP` được truyền vào Assistant chat runtime
- UI mới mở lại vẫn giữ state từ localStorage
