import { supabase } from './supabase_client';
import type { StoryTemplate } from '../../types/story_template';
import { attachTemplateSharingMetadata } from '../story_templates/shared_template_fingerprint';

export interface SharedStoryTemplateRecord {
  id: string;
  userId: string;
  sourceTitle: string;
  sourceFingerprint: string;
  template: StoryTemplate;
  createdAt: string;
  updatedAt: string;
}

interface PublishSharedTemplateInput {
  userId: string;
  sourceTitle: string;
  sourceFingerprint: string;
  template: StoryTemplate;
}

function isNoRowsError(error: unknown): boolean {
  return Boolean(
    error
      && typeof error === 'object'
      && 'code' in error
      && (error as { code?: string }).code === 'PGRST116',
  );
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(
    error
      && typeof error === 'object'
      && 'code' in error
      && (error as { code?: string }).code === '23505',
  );
}

function mapSharedTemplateRow(row: Record<string, unknown>): SharedStoryTemplateRecord {
  const id = row.id as string;
  const userId = row.user_id as string;
  const sourceTitle = row.source_title as string;
  const sourceFingerprint = row.source_fingerprint as string;
  const templatePayload = (row.template_payload as StoryTemplate | null) ?? {
    id,
    name: row.template_name as string,
    coreSellingPoint: '',
    tags: [],
    subGenres: [],
    worldRules: [],
    coolPatterns: [],
    conflictPatterns: [],
    outlineArcs: [],
    pitfalls: [],
    bestPractices: [],
    entityTags: [],
  };

  return {
    id,
    userId,
    sourceTitle,
    sourceFingerprint,
    template: attachTemplateSharingMetadata(templatePayload, {
      ...templatePayload.sharing,
      visibility: 'shared',
      sourceFingerprint,
      sourceTitle,
      sharedTemplateId: id,
      sharedByUserId: userId,
    }),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function findSharedTemplateBySourceFingerprint(
  sourceFingerprint: string,
): Promise<SharedStoryTemplateRecord | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await ((supabase as any).from('shared_story_templates') as any)
    .select('*')
    .eq('source_fingerprint', sourceFingerprint)
    .eq('is_public', true)
    .single();

  if (error) {
    if (isNoRowsError(error)) {
      return null;
    }
    throw error;
  }

  return mapSharedTemplateRow(data as Record<string, unknown>);
}

export async function publishSharedTemplate(
  input: PublishSharedTemplateInput,
): Promise<SharedStoryTemplateRecord> {
  const sharedTemplatePayload = attachTemplateSharingMetadata(input.template, {
    ...input.template.sharing,
    visibility: 'shared',
    sourceFingerprint: input.sourceFingerprint,
    sourceTitle: input.sourceTitle,
    sharedByUserId: input.userId,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await ((supabase as any).from('shared_story_templates') as any)
    .insert({
      user_id: input.userId,
      source_title: input.sourceTitle,
      source_fingerprint: input.sourceFingerprint,
      template_name: sharedTemplatePayload.name,
      template_payload: JSON.parse(JSON.stringify(sharedTemplatePayload)),
      is_public: true,
    })
    .select('*')
    .single();

  if (error) {
    if (isUniqueViolation(error)) {
      const existing = await findSharedTemplateBySourceFingerprint(input.sourceFingerprint);
      if (existing) {
        return existing;
      }
    }
    throw error;
  }

  return mapSharedTemplateRow(data as Record<string, unknown>);
}
