/**
 * File: AiAssistant.tsx
 * Purpose: Floating AI assistant panel - multi-provider AI cho hỗ trợ sáng tác
 * Layer: UI Shared
 * Domain: AI → [writing assistance, multi-model support]
 */
import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Send, Loader2 } from 'lucide-react';
import { useAiStore } from '../../store/use_ai_store';
import AiModelSelector from './AiModelSelector';
import { callAiModel } from '../../lib/ai/ai_client';

interface AiAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  contextHint?: string;
  onOpenSettings?: () => void;
}

interface Message {
  role: 'user' | 'ai';
  content: string;
}

const SUGGESTION_MAP: Record<string, string[]> = {
  bible: [
    'Gợi ý tên truyện hay cho thể loại tiên hiệp',
    'Giúp tôi viết logline hấp dẫn',
    'Đề xuất giọng văn phù hợp với truyện đô thị',
  ],
  characters: [
    'Tạo nhân vật phản diện thú vị',
    'Phát triển backstory cho nhân vật chính',
    'Gợi ý mối quan hệ giữa các nhân vật',
  ],
  world: [
    'Xây dựng hệ phép thuật độc đáo',
    'Mô tả địa hình thế giới fantasy',
    'Thiết kế hệ thống phe phái',
  ],
  write: [
    'Giúp tôi mở đầu chương mới',
    'Viết đoạn chuyển cảnh mượt mà',
    'Gợi ý cách kết thúc chương hấp dẫn',
  ],
};

const AiAssistant: React.FC<AiAssistantProps> = ({ isOpen, onClose, contextHint = 'bible', onOpenSettings }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { getActiveModel, apiKeys } = useAiStore();

  const suggestions = SUGGESTION_MAP[contextHint] || SUGGESTION_MAP.bible;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (text?: string) => {
    const prompt = text || input.trim();
    if (!prompt || loading) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: prompt }]);
    setLoading(true);

    try {
      const activeModel = getActiveModel();
      if (!activeModel) {
        throw new Error('Chưa chọn model AI. Vào Cài đặt AI để cấu hình.');
      }

      const provider = activeModel.provider;
      const apiKey = apiKeys[provider] || (window as any).__GEMINI_API_KEY__ || import.meta.env.VITE_GEMINI_API_KEY || '';

      if (!apiKey) {
        setMessages(prev => [...prev, {
          role: 'ai',
          content: `⚠️ Chưa có API key cho ${provider}. Vào Cài đặt AI → API Keys để thêm.`,
        }]);
        setLoading(false);
        return;
      }

      const systemPrompt = `Bạn là trợ lý sáng tác VietTruyen — chuyên hỗ trợ người viết truyện tiếng Việt. 
Trả lời ngắn gọn, sáng tạo, bằng tiếng Việt. Tập trung vào gợi ý thực tế cho sáng tác.
Context hiện tại: user đang ở phần "${contextHint}" của công cụ viết truyện.`;

      const response = await callAiModel(
        provider,
        apiKey,
        activeModel.modelId,
        activeModel.baseUrl,
        systemPrompt,
        prompt
      );

      setMessages(prev => [...prev, { role: 'ai', content: response }]);
    } catch (error: any) {
      setMessages(prev => [...prev, {
        role: 'ai',
        content: `❌ Lỗi: ${error.message || 'Không thể kết nối AI. Kiểm tra API key và thử lại.'}`,
      }]);
    }
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-bg-surface border-l border-border-subtle 
                    shadow-2xl shadow-black/40 flex flex-col z-50 animate-slide-in-right">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles size={16} className="text-accent-teal shrink-0" />
          <AiModelSelector onOpenSettings={onOpenSettings} />
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-text-muted hover:text-text-primary 
                     hover:bg-bg-elevated transition-colors cursor-pointer shrink-0"
        >
          <X size={18} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="animate-fade-in">
            <p className="text-sm text-text-secondary mb-4">
              ✨ Hỏi bất kỳ điều gì về sáng tác truyện. AI sẽ giúp bạn!
            </p>
            <div className="space-y-2">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(s)}
                  className="w-full text-left text-sm px-3 py-2.5 rounded-lg 
                             bg-bg-elevated text-text-secondary hover:text-accent-teal 
                             hover:bg-accent-teal/10 border border-border-subtle 
                             hover:border-accent-teal/20 transition-all cursor-pointer"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`text-sm leading-relaxed rounded-xl px-4 py-3 animate-slide-in-up ${
              msg.role === 'user'
                ? 'bg-accent-amber/10 text-accent-amber ml-8'
                : 'bg-bg-elevated text-text-primary mr-4 border border-border-subtle'
            }`}
          >
            <p className="whitespace-pre-wrap">{msg.content}</p>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-accent-teal text-sm px-4 py-3">
            <Loader2 size={16} className="animate-spin" />
            <span>Đang suy nghĩ...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border-subtle">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Hỏi trợ lý AI..."
            className="input-base flex-1 text-sm"
            disabled={loading}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            className="btn-ai btn-sm shrink-0"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AiAssistant;
