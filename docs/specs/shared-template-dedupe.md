# Spec: Shared Template Dedupe

## Objective
Thêm lựa chọn mặc định để chia sẻ template khi người dùng trích xuất từ bản thảo, và tránh sinh trùng nhiều shared template khi nhiều người cùng trích xuất từ cùng một tác phẩm.

## Assumptions
1. Shared template cần hoạt động giữa nhiều tài khoản, nên phải có persistence phía Supabase.
2. Dedupe đúng nhất là theo fingerprint của tác phẩm nguồn, không phải theo tên template.
3. Guest mode không có định danh bền vững trên cloud, nên chỉ tài khoản đăng nhập mới publish shared template.

## Commands
- Build: `npm run build`
- Test: `npm run test:run`

## Project Structure
- `src/components/pages/AdaptationPage.tsx`: UI trích xuất template và toggle chia sẻ mặc định.
- `src/store/use_template_store.ts`: local custom template store + preference chia sẻ mặc định.
- `src/lib/story_templates/*`: fingerprint/dedupe helpers và shared template registry logic.
- `src/lib/supabase/*`: persistence shared template qua Supabase.
- `supabase/migrations/*`: schema + RLS cho shared templates.

## Code Style
- Reuse `zustand` persistence cho preference local.
- Logic fingerprint/dedupe đặt ở helper/service riêng, tránh nhét vào component.
- Shared template insert phải idempotent: nếu canonical row đã tồn tại thì đọc lại thay vì tạo mới.

## Testing Strategy
- Unit test cho fingerprint và flow “reuse existing shared template”.
- Store test cho preference mặc định chia sẻ template.
- Build toàn repo để bắt lỗi type/integration.

## Boundaries
- Always: lưu local custom template sau khi extract/reuse để AI local vẫn đọc được.
- Ask first: mở community browser riêng cho shared template.
- Never: overwrite shared template đã tồn tại chỉ vì user khác extract lại cùng tác phẩm.

## Success Criteria
1. Người dùng có thể bật/tắt “chia sẻ template mặc định” ngay tại flow extract template.
2. Preference đó được nhớ lại ở các phiên sau.
3. Nếu shared template cho cùng tác phẩm đã tồn tại, hệ thống reuse bản có sẵn thay vì tạo bản mới.
4. Nếu chưa tồn tại, hệ thống tạo shared template canonical đúng một lần.
5. Guest hoặc user chưa đăng nhập không làm hỏng flow local extract.
