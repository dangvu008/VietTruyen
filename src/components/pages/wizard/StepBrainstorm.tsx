/**
 * File: StepBrainstorm.tsx
 * Purpose: Bước 2 wizard — Chat AI phát triển ý tưởng, extract structured data
 * Layer: UI (Wizard Step)
 * Domain: WritingWizard → [brainstorm chat, extraction]
 *
 * Reuses: brainstorm_prompts.ts (buildBrainstormDialoguePrompt, buildBrainstormExtractionPrompt)
 */
import { useState, useRef, useEffect } from 'react';
import { useWritingWizardStore } from '../../../store/use_writing_wizard_store';
import { useAiStore } from '../../../store/use_ai_store';
import { useProjectStore, getActiveProject } from '../../../store/use_project_store';
import {
  buildBrainstormDialoguePrompt,
  buildBrainstormExtractionPrompt,
} from '../../../lib/ai/brainstorm_prompts';
import { callAiModelTracked } from '../../../lib/ai/tracked_ai_client';
import { getModelForTask } from '../../../lib/ai/model_router';
import { createId } from '../../../core/id';
import type { BrainstormResult } from '../../../types/narrative_memory';

export default function StepBrainstorm() {
  const {
    ideaText,
    selectedGenre,
    brainstormMessages,
    addBrainstormMessage,
    isBrainstorming,
    setBrainstorming,
    brainstormError,
    setBrainstormError,
    setBrainstormResult,
    nextStep,
    prevStep,
  } = useWritingWizardStore();

  const [inputText, setInputText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [brainstormMessages]);

  // Auto-send first message if no messages yet
  useEffect(() => {
    if (brainstormMessages.length === 0 && ideaText.trim()) {
      handleSendMessage(ideaText + (selectedGenre ? ` (Thể loại: ${selectedGenre})` : ''));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSendMessage(text?: string) {
    const messageText = text || inputText.trim();
    if (!messageText || isBrainstorming) return;

    const userMsg = {
      id: createId(),
      role: 'user' as const,
      content: messageText,
      timestamp: new Date().toISOString(),
    };
    addBrainstormMessage(userMsg);
    if (!text) setInputText('');

    setBrainstorming(true);
    setBrainstormError(null);

    try {
      const aiState = useAiStore.getState();
      const model = getModelForTask(
        'brainstorm',
        aiState.models,
        undefined,
        aiState.activeModelId,
        aiState.taskModelOverrides
      );
      if (!model) throw new Error('Chưa cấu hình AI model.');

      const allMsgs = [...brainstormMessages, userMsg];
      const prompt = buildBrainstormDialoguePrompt(
        messageText,
        allMsgs.map((m) => ({ role: m.role, content: m.content }))
      );

      const response = await callAiModelTracked({
        provider: model.provider,
        modelId: model.modelId,
        modelName: model.name,
        baseUrl: model.baseUrl,
        systemPrompt: prompt.system,
        userPrompt: prompt.user,
        taskType: 'brainstorm',
      });

      addBrainstormMessage({
        id: createId(),
        role: 'ai',
        content: response,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      setBrainstormError(err.message || 'Lỗi khi brainstorm');
    } finally {
      setBrainstorming(false);
    }
  }

  async function handleExtractAndContinue() {
    setIsExtracting(true);
    setBrainstormError(null);

    try {
      const aiState = useAiStore.getState();
      const model = getModelForTask(
        'brainstorm',
        aiState.models,
        undefined,
        aiState.activeModelId,
        aiState.taskModelOverrides
      );
      if (!model) throw new Error('Chưa cấu hình AI model.');

      const prompt = buildBrainstormExtractionPrompt(
        brainstormMessages.map((m) => ({ role: m.role, content: m.content }))
      );

      const response = await callAiModelTracked({
        provider: model.provider,
        modelId: model.modelId,
        modelName: model.name,
        baseUrl: model.baseUrl,
        systemPrompt: prompt.system,
        userPrompt: prompt.user,
        taskType: 'brainstorm',
        responseFormat: 'json_object',
      });

      const cleanJson = response.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      const result: BrainstormResult = JSON.parse(cleanJson);

      // Apply genre if user selected one
      if (selectedGenre && result.bible) {
        result.bible.genre = selectedGenre;
      }

      setBrainstormResult(result);

      // Also update the project store with extracted data
      const project = getActiveProject(useProjectStore.getState());
      if (project && result.bible) {
        useProjectStore.getState().updateProject(project.id, {
          title: result.bible.title || project.title,
          genre: result.bible.genre || project.genre,
          subGenre: result.bible.subGenre || project.subGenre,
          logline: result.bible.logline || project.logline,
          endgame: result.bible.endgame || project.endgame,
          mainPlot: result.bible.mainPlot || project.mainPlot,
          writingStyle: result.bible.writingStyle || project.writingStyle,
          characterSetup: result.bible.characterSetup || project.characterSetup,
          worldSetting: result.bible.worldSetting || project.worldSetting,
          mainCharacterCount: result.bible.mainCharacterCount || project.mainCharacterCount,
          supportCharacterCount: result.bible.supportCharacterCount || project.supportCharacterCount,
        });
      }

      nextStep();
    } catch (err: any) {
      setBrainstormError(err.message || 'Lỗi khi trích xuất dữ liệu');
    } finally {
      setIsExtracting(false);
    }
  }

  const hasEnoughMessages = brainstormMessages.filter((m) => m.role === 'user').length >= 2;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── Header ── */}
      <div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 12px', borderRadius: 9999,
          background: 'rgba(242,192,141,0.1)', border: '1px solid rgba(242,192,141,0.2)',
          marginBottom: 12,
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#f2c08d', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            🧠 Bước 2 / 6
          </span>
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: '#e8e1dc', marginBottom: 6 }}>
          Phát triển ý tưởng với AI
        </h2>
        <p style={{ fontSize: 14, color: '#d4c4b7', lineHeight: 1.6 }}>
          Trả lời câu hỏi của AI để hình thành thế giới và nhân vật cho câu chuyện.
        </p>
      </div>

      {/* ── Chat Area ── */}
      <div style={{
        background: '#1e1b18', borderRadius: 20, border: '1px solid rgba(80,69,59,0.4)',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        maxHeight: 440,
      }}>
        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 8px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {brainstormMessages.map((msg) => (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                gap: 4,
              }}
            >
              <div style={{ fontSize: 10, color: '#9c8e82', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 2 }}>
                {msg.role === 'user' ? '✍️ BẠN' : '🤖 AI'}
              </div>
              <div style={{
                maxWidth: '80%',
                padding: '10px 16px',
                borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: msg.role === 'user'
                  ? 'rgba(212,165,116,0.15)'
                  : 'rgba(80,69,59,0.25)',
                border: msg.role === 'user'
                  ? '1px solid rgba(212,165,116,0.3)'
                  : '1px solid rgba(80,69,59,0.4)',
                color: '#e8e1dc',
                fontSize: 14,
                lineHeight: 1.65,
                whiteSpace: 'pre-wrap',
              }}>
                {msg.content}
              </div>
            </div>
          ))}
          {isBrainstorming && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
              <div style={{ fontSize: 10, color: '#9c8e82', fontWeight: 700, letterSpacing: '0.1em' }}>🤖 AI</div>
              <div style={{
                padding: '10px 16px', borderRadius: '16px 16px 16px 4px',
                background: 'rgba(80,69,59,0.25)', border: '1px solid rgba(80,69,59,0.4)',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                {[0, 0.2, 0.4].map((delay, i) => (
                  <span key={i} style={{
                    display: 'block', width: 6, height: 6, borderRadius: '50%',
                    background: '#d4a574',
                    animation: `pulse 1.2s ease-in-out ${delay}s infinite`,
                  }} />
                ))}
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input Row */}
        <div style={{
          borderTop: '1px solid rgba(80,69,59,0.4)',
          padding: '12px 16px',
          display: 'flex',
          gap: 10,
        }}>
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                if (e.nativeEvent.isComposing) return;
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Trả lời AI hoặc thêm chi tiết..."
            disabled={isBrainstorming || isExtracting}
            style={{
              flex: 1, background: 'transparent', border: 'none',
              color: '#e8e1dc', fontSize: 14, outline: 'none',
              fontFamily: 'Manrope, system-ui, sans-serif',
            }}
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={!inputText.trim() || isBrainstorming || isExtracting}
            style={{
              padding: '8px 18px', borderRadius: 9999, border: 'none',
              background: inputText.trim() ? 'linear-gradient(135deg, #f2c08d, #d4a574)' : 'rgba(80,69,59,0.3)',
              color: inputText.trim() ? '#472a03' : '#9c8e82',
              fontSize: 13, fontWeight: 700, cursor: inputText.trim() ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
            }}
          >
            Gửi
          </button>
        </div>
      </div>

      {brainstormError && (
        <div style={{
          padding: '10px 16px', borderRadius: 10,
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          color: '#fca5a5', fontSize: 13,
        }}>
          ⚠️ {brainstormError}
        </div>
      )}

      {/* ── Actions ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 }}>
        <button
          onClick={prevStep}
          style={{
            padding: '10px 20px', borderRadius: 9999,
            border: '1px solid rgba(80,69,59,0.5)',
            background: 'transparent', color: '#d4c4b7',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          ← Quay lại
        </button>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={nextStep}
            style={{
              padding: '10px 18px', borderRadius: 9999,
              border: '1px solid rgba(80,69,59,0.4)',
              background: 'transparent', color: '#9c8e82',
              fontSize: 13, cursor: 'pointer',
            }}
          >
            Bỏ qua
          </button>
          <button
            onClick={handleExtractAndContinue}
            disabled={!hasEnoughMessages || isBrainstorming || isExtracting}
            style={{
              padding: '10px 24px', borderRadius: 9999, border: 'none',
              background: hasEnoughMessages && !isBrainstorming && !isExtracting
                ? 'linear-gradient(135deg, #f2c08d, #d4a574)'
                : 'rgba(80,69,59,0.3)',
              color: hasEnoughMessages ? '#472a03' : '#9c8e82',
              fontSize: 13, fontWeight: 700,
              cursor: hasEnoughMessages ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
            }}
          >
            {isExtracting ? '⏳ Đang xử lý...' : 'Tạo nền truyện →'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}
