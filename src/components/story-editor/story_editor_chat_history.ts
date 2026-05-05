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

interface CreationSyncSource {
  projectId: string;
  chapterId: string;
}

function trimMessageContent(content: string): string {
  const normalized = content.trim().replace(/\s+/g, ' ');
  if (normalized.length <= MAX_HISTORY_CONTENT_LENGTH) return normalized;
  return `${normalized.slice(0, MAX_HISTORY_CONTENT_LENGTH)}…`;
}

export function normalizeStoryEditorMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.slice(-MAX_STORED_MESSAGES);
}

function toPersistedStoryEditorMessage(message: ChatMessage): ChatMessage | null {
  const hadTransientState = Boolean(
    message.isStreaming ||
      message.isDrafting ||
      message.isPartialStop,
  );

  if (message.role === 'assistant' && hadTransientState && !message.content.trim()) {
    return null;
  }

  const {
    isStreaming: _isStreaming,
    isDrafting: _isDrafting,
    isPartialStop: _isPartialStop,
    ...persistedMessage
  } = message;

  return persistedMessage;
}

export function normalizePersistedStoryEditorMessages(messages: ChatMessage[]): ChatMessage[] {
  return normalizeStoryEditorMessages(
    messages
      .map(toPersistedStoryEditorMessage)
      .filter((message): message is ChatMessage => message !== null),
  );
}

function getCreationSyncedEditorId(messageId: string, syncSource?: CreationSyncSource): string {
  if (!syncSource) return `creation-${messageId}`;

  const prefix = `editor:${syncSource.projectId}:${syncSource.chapterId}:`;
  if (messageId.startsWith(prefix)) {
    return messageId.slice(prefix.length);
  }

  return `creation-${messageId}`;
}

export function mergeStoryEditorChatMessages(
  seedMessages: ChatMessage[],
  localMessages: ChatMessage[],
): ChatMessage[] {
  const mergedById = new Map<string, ChatMessage>();

  [...localMessages, ...seedMessages].forEach((message) => {
    mergedById.set(message.id, message);
  });

  return normalizeStoryEditorMessages(Array.from(mergedById.values()));
}

export function buildStoryEditorSeedMessages(
  messages: CreationMessage[],
  syncSource?: CreationSyncSource,
): ChatMessage[] {
  return messages
    .filter(
      (message) =>
        message.role !== 'system' && CREATION_DISCUSSION_TYPES.has(message.type),
    )
    .map((message) => {
      const content = message.content.trim();
      if (!content) return null;

      return {
        id: getCreationSyncedEditorId(message.id, syncSource),
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
