import { extractTemplateFromText, type ExtractionProgressCallback } from '../ai/template_extractor';
import { findSharedTemplateBySourceFingerprint, publishSharedTemplate } from '../supabase/shared_template_service';
import type { SharedStoryTemplateRecord } from '../supabase/shared_template_service';
import type { StoryTemplate } from '../../types/story_template';
import {
  attachTemplateSharingMetadata,
  createSharedTemplateSourceFingerprint,
} from './shared_template_fingerprint';

export interface ResolveExtractedTemplateFromSourceInput {
  sourceTitle: string;
  sourceText: string;
  shareByDefault: boolean;
  userId?: string | null;
  onProgress?: ExtractionProgressCallback;
}

export interface ResolveExtractedTemplateFromSourceResult {
  template: StoryTemplate;
  sourceFingerprint: string;
  reusedSharedTemplate: boolean;
  publishedSharedTemplate: boolean;
  shareRequested: boolean;
  shareFailed: boolean;
}

interface ResolveExtractedTemplateDeps {
  extractTemplateFromText?: typeof extractTemplateFromText;
  findSharedTemplateBySourceFingerprint?: typeof findSharedTemplateBySourceFingerprint;
  publishSharedTemplate?: typeof publishSharedTemplate;
}

function buildPrivateTemplate(
  template: StoryTemplate,
  sourceTitle: string,
  sourceFingerprint: string,
): StoryTemplate {
  return attachTemplateSharingMetadata(template, {
    ...template.sharing,
    visibility: 'private',
    sourceTitle,
    sourceFingerprint,
  });
}

function toSharedTemplate(record: SharedStoryTemplateRecord): StoryTemplate {
  return attachTemplateSharingMetadata(record.template, {
    ...record.template.sharing,
    visibility: 'shared',
    sourceTitle: record.sourceTitle,
    sourceFingerprint: record.sourceFingerprint,
    sharedTemplateId: record.id,
    sharedByUserId: record.userId,
  });
}

export async function resolveExtractedTemplateFromSource(
  input: ResolveExtractedTemplateFromSourceInput,
  deps: ResolveExtractedTemplateDeps = {},
): Promise<ResolveExtractedTemplateFromSourceResult> {
  const extractTemplateFromTextImpl = deps.extractTemplateFromText ?? extractTemplateFromText;
  const findSharedTemplateBySourceFingerprintImpl =
    deps.findSharedTemplateBySourceFingerprint ?? findSharedTemplateBySourceFingerprint;
  const publishSharedTemplateImpl = deps.publishSharedTemplate ?? publishSharedTemplate;

  const sourceFingerprint = createSharedTemplateSourceFingerprint(input.sourceTitle, input.sourceText);
  const shareRequested = input.shareByDefault;
  const canShare = shareRequested && Boolean(input.userId);

  if (canShare) {
    const existingSharedTemplate = await findSharedTemplateBySourceFingerprintImpl(sourceFingerprint);
    if (existingSharedTemplate) {
      return {
        template: toSharedTemplate(existingSharedTemplate),
        sourceFingerprint,
        reusedSharedTemplate: true,
        publishedSharedTemplate: false,
        shareRequested,
        shareFailed: false,
      };
    }
  }

  const extractedTemplate = await extractTemplateFromTextImpl(
    input.sourceText,
    input.sourceTitle,
    input.onProgress,
  );
  const privateTemplate = buildPrivateTemplate(extractedTemplate, input.sourceTitle, sourceFingerprint);

  if (!canShare) {
    return {
      template: privateTemplate,
      sourceFingerprint,
      reusedSharedTemplate: false,
      publishedSharedTemplate: false,
      shareRequested,
      shareFailed: false,
    };
  }

  try {
    const sharedTemplate = await publishSharedTemplateImpl({
      userId: input.userId!,
      sourceTitle: input.sourceTitle,
      sourceFingerprint,
      template: privateTemplate,
    });

    return {
      template: toSharedTemplate(sharedTemplate),
      sourceFingerprint,
      reusedSharedTemplate: false,
      publishedSharedTemplate: true,
      shareRequested,
      shareFailed: false,
    };
  } catch (error) {
    console.warn(
      '[shared_template_registry] Publish shared template failed; falling back to local template:',
      error,
    );
    return {
      template: privateTemplate,
      sourceFingerprint,
      reusedSharedTemplate: false,
      publishedSharedTemplate: false,
      shareRequested,
      shareFailed: true,
    };
  }
}
