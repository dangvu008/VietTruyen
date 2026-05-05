import { beforeEach, describe, expect, it, vi } from 'vitest';

function createStorageMock(initial: Record<string, string> = {}): Storage {
  const store = new Map<string, string>(Object.entries(initial));

  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
}

describe('use_template_store', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('migrates legacy extracted templates from the old custom template store', async () => {
    vi.stubGlobal(
      'localStorage',
      createStorageMock({
        'viet-truyen-custom-templates': JSON.stringify({
          state: {
            templates: [
              {
                id: 'legacy-template',
                name: '[Trích xuất] Legacy',
                coreSellingPoint: 'Legacy extracted template',
                tags: ['custom', 'extracted'],
                subGenres: [],
                worldRules: [],
                coolPatterns: [],
                conflictPatterns: [],
                outlineArcs: [],
                pitfalls: [],
                bestPractices: [],
                entityTags: [],
              },
            ],
          },
          version: 1,
        }),
      }),
    );

    const { useTemplateStore } = await import('./use_template_store');

    await useTemplateStore.persist.rehydrate();

    const migrated = useTemplateStore.getState().customTemplates;
    expect(migrated).toHaveLength(1);
    expect(migrated[0]).toMatchObject({
      id: 'legacy-template',
      name: '[Trích xuất] Legacy',
      isCustom: true,
    });
    expect(migrated[0].createdAt).toBeTruthy();
    expect(useTemplateStore.getState().getTemplateById('legacy-template')).toMatchObject({
      id: 'legacy-template',
      isCustom: true,
    });
  });

  it('persists share-by-default preference and dedupes templates by source fingerprint', async () => {
    vi.stubGlobal('localStorage', createStorageMock());

    const { useTemplateStore } = await import('./use_template_store');
    await useTemplateStore.persist.rehydrate();

    useTemplateStore.getState().setShareTemplatesByDefault(false);
    useTemplateStore.getState().addCustomTemplate({
      id: 'local-template-a',
      name: 'Template A',
      coreSellingPoint: 'A',
      tags: ['custom'],
      subGenres: [],
      worldRules: [],
      coolPatterns: [],
      conflictPatterns: [],
      outlineArcs: [],
      pitfalls: [],
      bestPractices: [],
      entityTags: [],
      sharing: {
        visibility: 'private',
        sourceFingerprint: 'stf_same_source',
      },
    });
    useTemplateStore.getState().addCustomTemplate({
      id: 'local-template-b',
      name: 'Template B',
      coreSellingPoint: 'B',
      tags: ['custom', 'shared'],
      subGenres: [],
      worldRules: [],
      coolPatterns: [],
      conflictPatterns: [],
      outlineArcs: [],
      pitfalls: [],
      bestPractices: [],
      entityTags: [],
      sharing: {
        visibility: 'shared',
        sourceFingerprint: 'stf_same_source',
      },
    });

    const state = useTemplateStore.getState();
    expect(state.shareTemplatesByDefault).toBe(false);
    expect(state.customTemplates).toHaveLength(1);
    expect(state.customTemplates[0]).toMatchObject({
      id: 'local-template-b',
      name: 'Template B',
      sharing: {
        visibility: 'shared',
        sourceFingerprint: 'stf_same_source',
      },
    });

    const raw = localStorage.getItem('viettruyen-custom-templates');
    expect(raw).toContain('"shareTemplatesByDefault":false');
  });
});
