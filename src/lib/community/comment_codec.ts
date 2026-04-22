import type { StoryCommentKind } from '../../types/community';

export interface StoryCommentPayload {
  content: string;
  kind: StoryCommentKind;
  headline?: string;
}

interface StoredStoryCommentPayload {
  version: 1;
  body: string;
  kind: StoryCommentKind;
  headline?: string;
}

export function serializeStoryCommentPayload(payload: StoryCommentPayload): string {
  const normalizedHeadline = payload.headline?.trim();
  const body = payload.content.trim();

  const stored: StoredStoryCommentPayload = {
    version: 1,
    body,
    kind: payload.kind,
    ...(normalizedHeadline ? { headline: normalizedHeadline } : {}),
  };

  return JSON.stringify(stored);
}

export function parseStoryCommentPayload(rawContent: string): StoryCommentPayload {
  try {
    const parsed = JSON.parse(rawContent) as Partial<StoredStoryCommentPayload>;
    if (parsed && typeof parsed.body === 'string') {
      return {
        content: parsed.body,
        kind: isStoryCommentKind(parsed.kind) ? parsed.kind : 'discussion',
        headline: typeof parsed.headline === 'string' && parsed.headline.trim()
          ? parsed.headline.trim()
          : undefined,
      };
    }
  } catch {
    // Backward compatible with legacy plain-text comments.
  }

  return {
    content: rawContent,
    kind: 'discussion',
  };
}

function isStoryCommentKind(value: unknown): value is StoryCommentKind {
  return value === 'discussion' || value === 'scene' || value === 'plot-twist' || value === 'revision';
}
