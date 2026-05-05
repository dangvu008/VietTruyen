# Spec: Controlled Cast Expansion

## Objective
Giữ truyện dài không bị nhàm vì lặp đi lặp lại vài nhân vật, nhưng cũng không cho AI thêm nhân vật tùy tiện. Nhân vật mới chỉ nên xuất hiện khi phục vụ rõ một chức năng trong cốt truyện, thế giới, hoặc nhịp cảm xúc.

## Tech Stack
TypeScript, Vitest, prompt builders trong `src/lib/ai/`.

## Commands
- Build: `npm run build`
- Test all: `npm run test:run`
- Test target: `npm run test:run -- src/lib/ai/character_cast_guardrails.test.ts`

## Project Structure
- `src/lib/ai/creation_prompts.ts` → prompt tạo framework ban đầu
- `src/lib/ai/outline_planner.ts` → prompt lập tổng cương / quyển cương / chương cương
- `src/lib/ai/surprise_prompts.ts` → prompt planner/writer cho chương
- `src/lib/ai/character_cast_guardrails.ts` → helper guardrail dùng chung
- `src/lib/ai/*.test.ts` → test đơn vị

## Code Style
```ts
export function buildRuleBlock(name: string, lines: string[]): string {
  return [`## ${name}`, ...lines].join('\n');
}
```

Quy ước:
- Hàm nhỏ, semantic naming.
- Prompt rules ở một helper dùng chung, tránh copy-paste giữa nhiều prompt.
- Không thay đổi contract dữ liệu nếu chỉ cần siết hành vi AI bằng prompt.

## Testing Strategy
- Unit test cho helper guardrail.
- Verification bằng `npm run build` để chắc prompt integrations không phá type.

## Boundaries
- Always: giữ backward-compatible với ledger hiện có; chứng minh bằng test/build.
- Ask first: thêm schema/store/UI mới cho character suggestion canon.
- Never: auto-add nhân vật mới vào `project.characters` mà không có rule kiểm soát rõ.

## Success Criteria
- Có một helper trung tâm mô tả rule mở rộng cast có kiểm soát.
- Prompt framework ban đầu yêu cầu cast đa chức năng, không chỉ xung đột.
- Prompt outline yêu cầu xoay vòng cast và chỉ thêm nhân vật mới khi beat/arc cần.
- Prompt writer yêu cầu chỉ đặt tên nhân vật mới khi có chức năng rõ, và `introducedEntities` không chứa crowd entity vô thưởng vô phạt.

## Open Questions
- Chưa triển khai UI hoặc store cho hàng chờ “character suggestions”.
- Chưa auto-promote entity mới vào canon; thay đổi này chỉ siết hành vi sinh nội dung.
