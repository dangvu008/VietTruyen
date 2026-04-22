/**
 * File: story_editor_chat_history.ts
 * Purpose: Shared chat history helpers for story editor persistence and AI prompting
 * Layer: UI/Domain
 * Domain: StoryEditor
 */
import type { CreationMessage, CreationMessageType } from '../../types/creation_chat';
import type { ChatMessage } from './editor_types';

const MAX_STORED_MESSAGES = 40;
const MAX_HISTORY_MESSAGES = 8;
const MAX_HISTORY_CONTENT_LENGTH = 480;
const CREATION_DISCUSSION_TYPES = new Set<CreationMessageType>(['text', 'suggestions']);

function trimMessageContent(content: string): string {
  const normalized = content.trim().replace(/\s+/g, ' ');
  if (normalized.length <= MAX_HISTORY_CONTENT_LENGTH) return normalized;
  return `${normalized.slice(0, MAX_HISTORY_CONTENT_LENGTH)}…`;
}

export function normalizeStoryEditorMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.slice(-MAX_STORED_MESSAGES);
}

export function buildStoryEditorSeedMessages(messages: CreationMessage[]): ChatMessage[] {
  return messages
    .filter(
      (message) =>
        message.role !== 'system' && CREATION_DISCUSSION_TYPES.has(message.type),
    )
    .map((message) => {
      const content = message.content.trim();
      if (!content) return null;

      return {
        id: `creation-${message.id}`,
        role: message.role === 'user' ? 'user' : 'assistant',
        content,
        timestamp: message.timestamp,
      } satisfies ChatMessage;
    })
    .filter((message): message is ChatMessage => message !== null);
}

export function buildStoryEditorChatTranscript(messages: ChatMessage[]): string {
  const relevantMessages = messages
    .filter((message) => message.content.trim())
    .slice(-MAX_HISTORY_MESSAGES);

  if (relevantMessages.length === 0) {
    return '(Chưa có lịch sử trao đổi trước đó)';
  }

  return relevantMessages
    .map((message) => {
      const speaker = message.role === 'user' ? 'NGUOI VIET' : 'THE MUSE';
      return `${speaker}: ${trimMessageContent(message.content)}`;
    })
    .join('\n\n');
}
