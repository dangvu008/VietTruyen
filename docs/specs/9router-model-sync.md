# Spec: 9router Model Sync

## Objective
VietTruyen can sync active 9router models into AI settings and avoid models that are temporarily failing. Users should be able to click a sync action in AI settings, see 9router models in the existing model list, and keep using Smart Routing while failing models are skipped.

## Tech Stack
React 18, Zustand, TypeScript, Vite, Vitest. 9router is consumed as an OpenAI-compatible local proxy.

## Commands
- Test focused logic: `npm run test:run -- src/lib/ai/nine_router_catalog.test.ts src/lib/ai/model_router.test.ts src/lib/ai/tracked_ai_client.test.ts`
- Build: `npm run build`
- Dev app: `npm run dev`
- Dev 9router: `npm run dev:9router`

## Project Structure
- `src/lib/ai/nine_router_catalog.ts` maps 9router responses into VietTruyen `AiModel` records.
- `src/store/use_ai_store.ts` stores 9router sync settings and model health.
- `src/lib/ai/model_router.ts` filters unavailable/cooldown models.
- `src/lib/ai/tracked_ai_client.ts` retries transient failures with the next available model.
- `src/components/pages/AiSettingsPage.tsx` exposes sync controls.

## Code Style
Use explicit domain names over generic utilities:

```ts
const syncedModels = mapNineRouterModels(response, baseUrl);
const healthyModel = getModelForTask(taskType, models, undefined, 'auto', overrides, modelHealth);
```

## Testing Strategy
Unit-test pure mapping and routing. Mock `callAiProxy` for retry behavior. UI changes rely on build/type checks unless a browser verification is specifically requested.

## Boundaries
- Always: validate external 9router response shape before adding models.
- Always: keep 9router API keys/secrets in 9router; VietTruyen only stores proxy URL and public model IDs.
- Ask first: adding dependencies, changing DB schema, or changing 9router internals.
- Never: persist provider secrets from `/api/providers`.

## Success Criteria
- 9router `/v1/models` response maps to deterministic `AiModel` IDs.
- AI store can merge synced 9router models without deleting non-9router models.
- Smart Routing skips models in cooldown/unavailable health state.
- Tracked AI calls retry a transient model failure with another eligible model.
- Settings page exposes a sync action.
