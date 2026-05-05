/**
 * File: AiAssistant.tsx
 * Purpose: Reusable AI assistant surface — embedded workspace on dashboard + drawer on task pages
 * Layer: UI Shared
 * Domain: AI → [guided chat, routing, execution handoff]
 *
 * v3: API keys handled by proxy. No client-side key validation.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, RotateCcw, Send, Sparkles, X } from 'lucide-react';
import VoiceMicButton from './VoiceMicButton';
import { useAiStore } from '../../store/use_ai_store';
import type { Project } from '../../types/story';
import AiOptionsTab from './AiOptionsTab';
import { TokenLimitError } from '../../lib/ai/ai_client';
import { callAiModelTracked } from '../../lib/ai/tracked_ai_client';
import { getModelForTask } from '../../lib/ai/model_router';
import type { AssistantHandoffRoute } from '../../lib/assistant/assistant_intents';
import { isAssistantHandoffRoute } from '../../lib/assistant/assistant_intents';
import { useAssistantSessionStore } from '../../store/use_assistant_session_store';
import { answerPlotQuestion, isPlotQuestion } from '../../lib/ai/plot_qa';
import { useTranslation } from '../../hooks/use_translation';
import type { AnyTabId } from '../../types/navigation';
import { getOrGenerateStoryPreview } from '../../lib/ai/story_preview';

interface Message {
  role: 'user' | 'ai';
  content: string;
}

type AssistantTab = 'chat' | 'options';

export interface AssistantAction {
  id: string;
  label: string;
  description: string;
  prompt?: string;
  tab?: AnyTabId;
  tone?: 'primary' | 'secondary' | 'ghost';
}

interface AiAssistantProps {
  isOpen?: boolean;
  onClose?: () => void;
  contextHint?: string;
  project?: Project;
  onOpenSettings?: () => void;
  onNavigate?: (tab: AnyTabId) => void;
  variant?: 'drawer' | 'workspace';
  headline?: string;
  description?: string;
  actions?: AssistantAction[];
}

const SUGGESTION_MAP: Record<string, string[]> = {
  dashboard: [
    'Hãy hỏi tôi 3 câu ngắn để chốt ý tưởng truyện này.',
    'Dựa trên trạng thái hiện tại, bước quan trọng nhất tôi nên làm tiếp là gì?',
    'Nếu tôi muốn viết ngay, AI còn thiếu dữ kiện nào từ tôi?',
  ],
  studio: [
    'Hãy hỏi tôi 3 câu ngắn để chốt ý tưởng truyện này.',
    'Dựa trên trạng thái hiện tại, bước quan trọng nhất tôi nên làm tiếp là gì?',
    'Nếu tôi muốn viết ngay, AI còn thiếu dữ kiện nào từ tôi?',
  ],
  bible: [
    'Giúp tôi biến ý tưởng thô thành logline và hướng truyện.',
    'Hãy hỏi tôi những gì còn thiếu để khóa premise của truyện.',
    'Đề xuất giọng văn phù hợp với thể loại tôi đang viết.',
  ],
  characters: [
    'Hãy hỏi tôi để hoàn thiện nhân vật chính và phản diện.',
    'Tạo mâu thuẫn thú vị giữa hai nhân vật quan trọng.',
    'Nhân vật nào đang thiếu động cơ rõ ràng?',
  ],
  world: [
    'Hãy hỏi tôi để khóa logic thế giới và các quy tắc nền.',
    'Thiết kế hệ thống phe phái cho truyện này.',
    'Điểm nào trong worldbuilding của tôi còn mơ hồ?',
  ],
  outline: [
    'Hãy hỏi tôi để biến ý tưởng hiện tại thành dàn ý khả dụng.',
    'Đề xuất các beat chính cho arc đầu tiên.',
    'Phần outline nào còn thiếu để AI viết chương ổn định?',
  ],
  writer: [
    'Hãy hỏi tôi để lập brief cho chương tiếp theo.',
    'Giúp tôi mở đầu chương mới với hook tốt hơn.',
    'Đề xuất cách kết chương để kéo độc giả sang chương sau.',
  ],
  chapters: [
    'Tóm tắt nhanh tình trạng truyện tới chương gần nhất.',
    'Chương gần nhất đang mở ra hướng nào cho chương sau?',
    'Mầm mối nào trong truyện vẫn chưa được giải?',
  ],
  review: [
    'Kiểm tra giúp tôi xem chương này có lệch canon không.',
    'Nêu 3 điểm cần sửa trước khi xuất bản.',
    'Nếu phải nâng nhịp chương này, nên sửa phần nào trước?',
  ],
};

const ASSISTANT_EXPERT_LABELS: Record<string, string> = {
  'van-hoc': 'Văn học',
  'xay-dung-tg': 'Xây dựng thế giới',
  'tuyen-nhan-vat': 'Tuyến nhân vật',
  'quan-tri-boi-canh': 'Quản trị bối cảnh',
};

function getProjectSnapshot(project?: Project) {
  return getProjectFacts(project).join(' ');
}

function getProjectFacts(project?: Project): string[] {
  if (!project) return [];

  const hasOutline = project.outline.length > 0 || (project.masterOutline?.volumes.length ?? 0) > 0;
  const hasWorld =
    Boolean(project.world.geography?.trim()) ||
    Boolean(project.world.magicSystem?.trim()) ||
    Boolean(project.world.rules?.trim()) ||
    Boolean(project.world.techLevel?.trim()) ||
    (project.world.factions?.length ?? 0) > 0;

  return [
    `Dự án hiện tại: "${project.title}".`,
    `Số nhân vật: ${project.characters.length}.`,
    `Số chương: ${project.chapters.length}.`,
    `Đã có dàn ý: ${hasOutline ? 'có' : 'chưa'}.`,
    `Đã có worldbuilding nền: ${hasWorld ? 'có' : 'chưa'}.`,
  ];
}

const AiAssistant: React.FC<AiAssistantProps> = ({
  isOpen = false,
  onClose,
  contextHint = 'bible',
  project,
  onOpenSettings,
  onNavigate,
  variant = 'drawer',
  headline,
  description,
  actions = [],
}) => {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<AssistantTab>('chat');
  const [storyPreview, setStoryPreview] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isWorkspace = variant === 'workspace';
  const _isWriterContext = ['writer', 'chapters', 'writing-wizard', 'review', 'export'].includes(contextHint);
  const isDark = true; // Always output dark theme to sync with EtherealLayout Nocturnal Editor design
  const isVisible = isWorkspace || isOpen;

  const {
    activeModelId,
    models,
    taskModelOverrides,
    modelHealth,
    preferredProvider,
    temperature,
    topP,
    contextSize,
    autoSummarize,
    persona,
    activeExperts,
  } = useAiStore();
  const suggestions = useMemo(
    () => SUGGESTION_MAP[contextHint] || SUGGESTION_MAP.bible,
    [contextHint]
  );
  const projectSnapshot = useMemo(() => getProjectSnapshot(project), [project]);
  const visibleSuggestions = useMemo(
    () => (isWorkspace ? suggestions.slice(0, 2) : suggestions),
    [isWorkspace, suggestions]
  );
  const workspaceActions = useMemo(
    () => (isWorkspace ? actions.slice(0, 2) : actions),
    [actions, isWorkspace]
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading]);

  useEffect(() => {
    if (project?.id) {
      getOrGenerateStoryPreview(project.id).then((preview) => setStoryPreview(preview));
    }
  }, [project?.id, project?.chapters?.length]);

  useEffect(() => {
    if (!isVisible) {
      setActiveTab('chat');
    }
  }, [isVisible]);

  const handleSend = async (text?: string) => {
    const prompt = text || input.trim();
    if (!prompt || loading) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: prompt }]);
    setLoading(true);

    try {
      if (project && isPlotQuestion(prompt, project)) {
        const plotModel = getModelForTask('answer_plot', models, undefined, activeModelId, taskModelOverrides, modelHealth, [], preferredProvider);
        const plotAnswer = await answerPlotQuestion({
          project,
          question: prompt,
          model: plotModel,
          // Proxy architecture: no client-side key needed. Sentinel bypasses the
          // !apiKey guard inside answerPlotQuestion so the AI fallback path runs.
          apiKey: '__proxy__',
        });

        setMessages((prev) => [...prev, { role: 'ai', content: plotAnswer.answer }]);
        return;
      }

      const activeModel = getModelForTask('chat', models, undefined, activeModelId, taskModelOverrides, modelHealth, [], preferredProvider);
      if (!activeModel) {
        throw new Error('Chưa chọn model AI. Vào Cài đặt AI để cấu hình.');
      }

      const expertModes = activeExperts.length > 0
        ? activeExperts.map((expertId) => ASSISTANT_EXPERT_LABELS[expertId] || expertId).join(', ')
        : 'Không bật chuyên gia nào';

      const systemPrompt = `Bạn là trợ lý điều phối sáng tác của VietTruyen.
Vai trò của bạn là giúp người dùng đạt mục tiêu nhanh nhất bằng hội thoại.

Hồ sơ trợ lý:
- Cá tính AI: ${persona}
- Chuyên gia đang bật: ${expertModes}
- Ngân sách bộ nhớ mục tiêu: khoảng ${contextSize} tokens
- Tự động tóm tắt: ${autoSummarize ? 'bật' : 'tắt'}

Luôn tuân thủ:
1. Xác định mục tiêu thực tế mà người dùng muốn đạt được.
2. Nếu brief còn thiếu, hỏi tiếp từ 1 đến 3 câu ngắn, đi thẳng vào thông tin còn thiếu.
3. Ưu tiên hướng dẫn theo nhiệm vụ và bước kế tiếp.
4. Trả lời bằng tiếng Việt, ngắn gọn, thực dụng.

ĐẶC BIỆT QUAN TRỌNG VỀ ĐIỀU HƯỚNG:
Nếu bạn đã thu thập ĐỦ thông tin ngắn gọn (brief) từ người dùng để họ bắt đầu viết chương, tạo thế giới, làm dàn ý, tạo nhân vật, bạn PHẢI đính kèm 1 block JSON ở CUỐI CÙNG câu trả lời để hệ thống tự động chuyển trang và lưu dữ liệu.

Định dạng JSON phải CHÍNH XÁC như sau (nằm gọn trong block \`\`\`json):
\`\`\`json
{
  "route": "writer",
  "payload": {
    "chapterBrief": "Tóm tắt brief bạn vừa gom được...",
    "chapterGoal": "Mục tiêu..."
  }
}
\`\`\`
- Các route hợp lệ: "writer" (viết chương), "bible" (nền truyện), "characters" (nhân vật), "outline" (dàn ý).
- payload tùy thuộc vào route (ví dụ character có "name", "role", "description").
- Đối với dàn ý (outline), payload phải có định dạng "beats": [{"title": "Beat 1", "summary": "Nội dung beat 1"}].
- Chỉ đưa JSON vào khi thực sự ĐÃ ĐỦ THÔNG TIN và sẵn sàng hành động. Nếu còn đang hỏi, KHÔNG trả về JSON.

Context hiện tại: user đang ở phần "${contextHint}".
${projectSnapshot}
--- NỘI DUNG GỐC CỦA TRUYỆN ---
${storyPreview ? storyPreview.slice(0, 1500) : 'Trống (chưa có nội dung gốc)'}
--- KẾT THÚC NỘI DUNG GỐC ---`;

      const response = await callAiModelTracked({
        provider: activeModel.provider,
        modelId: activeModel.modelId,
        modelName: activeModel.name || activeModel.modelId,
        baseUrl: activeModel.baseUrl,
        systemPrompt,
        userPrompt: prompt,
        taskType: 'chat',
        temperature,
        topP,
      });

      let cleanResponse = response;
      let handoffData: { route: AssistantHandoffRoute; payload: unknown } | null = null;

      const jsonMatch = response.match(/\`\`\`json\n([\s\S]*?)\n\`\`\`/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1]) as { route?: unknown; payload?: unknown };
          if (isAssistantHandoffRoute(parsed.route) && parsed.payload) {
            handoffData = {
              route: parsed.route,
              payload: parsed.payload,
            };
            cleanResponse = response.replace(/\`\`\`json\n[\s\S]*?\n\`\`\`/, '').trim();
          }
        } catch (e) {
          console.warn('Failed to parse handoff JSON from AI', e);
        }
      }

      setMessages((prev) => [...prev, { role: 'ai', content: cleanResponse }]);

      if (handoffData && onNavigate) {
        useAssistantSessionStore.getState().setHandoff(
          handoffData.route,
          handoffData.payload,
          cleanResponse
        );
        setTimeout(() => {
          if (onClose) onClose();
          onNavigate(handoffData.route);
        }, 3000);
      }
    } catch (error: any) {
      let errorMsg: string;
      if (error instanceof TokenLimitError) {
        errorMsg = `⚠️ Đã hết token tháng này (${error.tokensUsed.toLocaleString()}/${error.tokensLimit.toLocaleString()}). Nâng cấp gói để tiếp tục.`;
      } else {
        errorMsg = `❌ Lỗi: ${error.message || 'Không thể kết nối AI. Vui lòng thử lại.'}`;
      }
      setMessages((prev) => [...prev, { role: 'ai', content: errorMsg }]);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: AssistantAction) => {
    if (action.prompt) {
      await handleSend(action.prompt);
      return;
    }

    if (action.tab === 'ai-settings' && onOpenSettings) {
      onOpenSettings();
      return;
    }

    if (action.tab && onNavigate) {
      onNavigate(action.tab);
    }
  };

  if (!isVisible) return null;

  const introTitle = headline || t('app.aiAssistant');
  const introDescription =
    description ||
    'Hỏi bất kỳ điều gì về sáng tác truyện. Nếu brief chưa đủ, trợ lý sẽ hỏi tiếp trước khi đề xuất bước thực thi.';

  const renderEmptyState = () => {
    if (isWorkspace) {
      return (
        <div className="space-y-4 animate-fade-in">
          <div className="flex flex-wrap gap-2">
            {visibleSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => void handleSend(suggestion)}
                className={`px-4 py-3 text-left text-sm transition-all border-l-2 ${
                  isDark
                    ? 'border-transparent bg-transparent text-[#9c8e82] hover:border-[#f2c08d] hover:bg-white/5 hover:text-[#e8e1dc]'
                    : 'border-transparent bg-surface-container text-on-surface-variant hover:border-primary/40 hover:bg-primary-container/30 hover:text-primary'
                }`}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      );
    }
    
    return (
      <div className="space-y-6 animate-fade-in pt-4">
        <div>
          <div className={`flex gap-4 px-2`}>
            <span className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center ${
              isDark ? 'text-[#f2c08d]' : 'text-accent-teal'
            }`}>
              <Sparkles size={18} />
            </span>
            <div>
              <p className={`text-base font-medium tracking-wide ${isDark ? 'text-[#e8e1dc]' : 'text-text-primary'}`}>{introTitle}</p>
              <p className={`mt-2 text-[15px] leading-relaxed ${isDark ? 'text-[#9c8e82]' : 'text-text-secondary'}`}>{introDescription}</p>
            </div>
          </div>
        </div>

        {actions.length > 0 && (
          <div className="space-y-2">
            {actions.map((action) => (
              <button
                key={action.id}
                onClick={() => void handleAction(action)}
                className={`w-full px-4 py-3 text-left transition-colors border-l-2 ${
                  isDark
                    ? 'border-transparent hover:border-[#d4a574] hover:bg-white/5'
                    : 'border-transparent hover:border-accent-teal/40 hover:bg-surface-container-low'
                }`}
              >
                <p className={`text-[15px] font-medium ${isDark ? 'text-[#d4c4b7]' : 'text-text-primary'}`}>{action.label}</p>
                <p className={`mt-1 text-sm leading-5 ${isDark ? 'text-[#887d74]' : 'text-text-secondary'}`}>{action.description}</p>
              </button>
            ))}
          </div>
        )}

        <div className="space-y-2">
          {visibleSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => void handleSend(suggestion)}
              className={`w-full px-4 py-3 text-left text-[15px] transition-all border-l-2 ${
                isDark
                  ? 'border-[#50453b] bg-transparent text-[#9c8e82] hover:border-[#f2c08d] hover:bg-white/5 hover:text-[#e8e1dc]'
                  : 'border-outline bg-transparent text-on-surface-variant hover:border-primary/40 hover:bg-primary-container/20 hover:text-primary'
              }`}
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderMessages = () => (
    <div className="space-y-3">
      {messages.length === 0 && renderEmptyState()}

      {messages.map((msg, index) => (
        <div
          key={`${msg.role}-${index}`}
          className={`group flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
        >
          <div
            className={`max-w-[88%] text-[15px] leading-relaxed animate-slide-in-up ${
              msg.role === 'user'
                ? isDark 
                  ? 'bg-[#f2c08d] text-[#151310] font-medium px-5 py-3 rounded-bl-sm rounded-l-2xl rounded-t-2xl shadow-ambient' 
                  : 'bg-primary text-on-primary shadow-[0_6px_20px_-8px_rgba(184,90,8,0.6)] font-medium px-5 py-3 rounded-bl-sm rounded-l-2xl rounded-t-2xl'
                : isDark
                  ? 'text-[#d4c4b7] border-l-[3px] border-[#d4a574] pl-5 py-1'
                  : 'text-on-surface border-l-[3px] border-primary pl-5 py-1'
            }`}
          >
            <p className="whitespace-pre-wrap">{msg.content}</p>
          </div>
          {msg.role === 'user' && (
            <div className="opacity-0 transition-opacity group-hover:opacity-100 pr-1 mt-0.5">
              <button
                onClick={() => setInput(msg.content)}
                className={`flex items-center gap-1.5 text-[11px] ${isDark ? 'text-[#8f7f73] hover:text-[#d4c4b7]' : 'text-on-surface-variant hover:text-on-surface'}`}
                title="Điền lại yêu cầu này vào khung chat"
              >
                <RotateCcw size={13} /> Thử lại
              </button>
            </div>
          )}
        </div>
      ))}

      {loading && (
        <div className={`mr-auto flex max-w-[88%] items-center gap-3 text-[15px] py-2 ${
          isDark
            ? 'text-[#9c8e82]'
            : 'text-secondary'
        }`}>
          <Loader2 size={16} className="animate-spin text-[#d4a574]" />
          <span>Đang phân tích...</span>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );

  const drawerShellClassName = `fixed inset-y-0 right-0 z-50 flex w-[26rem] flex-col border-l shadow-2xl shadow-black/40 animate-slide-in-right ${
    isDark ? 'bg-[#151310] border-[#50453b]' : 'bg-bg-surface border-border-subtle'
  }`;
  const workspaceShellClassName = `flex min-h-[620px] flex-col overflow-hidden rounded-none border ${
    isDark ? 'bg-[#151310] border-[#50453b]' : 'bg-surface border-outline-variant'
  }`;

  const renderTabButton = (tab: AssistantTab, label: string) => {
    const isActive = activeTab === tab;
    return (
      <button
        type="button"
        onClick={() => setActiveTab(tab)}
        className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
          isActive
            ? 'bg-[#f2c08d] text-[#151310]'
            : 'text-[#9c8e82] hover:bg-white/5 hover:text-[#e8e1dc]'
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <div className={isWorkspace ? workspaceShellClassName : drawerShellClassName}>
      <div className={`pb-4 mb-4 flex-shrink-0 ${isWorkspace ? 'px-6 py-5' : 'px-4 py-3'}`}>
        {isWorkspace ? (
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="inline-flex rounded-full border border-[#50453b] bg-[#1d1b18] p-1">
                {renderTabButton('chat', 'Chat')}
                {renderTabButton('options', 'Tuỳ chọn AI')}
              </div>
              <p className="mt-3 text-sm leading-6 text-[#9c8e82]">
                {activeTab === 'chat' ? introDescription : 'Điều chỉnh model, generation params và hồ sơ trợ lý ngay trong panel này.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Sparkles size={16} className={`shrink-0 ${isDark ? 'text-[#a3b8ff]' : 'text-accent-teal'}`} />
              <div className="inline-flex rounded-full border border-[#50453b] bg-[#1d1b18] p-1">
                {renderTabButton('chat', 'Chat')}
                {renderTabButton('options', 'Tuỳ chọn AI')}
              </div>
            </div>
            <button
              onClick={onClose}
               className={`shrink-0 rounded-lg p-1.5 transition-colors ${
                 isDark
                   ? 'text-white/40 hover:bg-white/5 hover:text-white/80'
                   : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
               }`}
            >
              <X size={18} />
            </button>
          </div>
        )}
      </div>

      {isWorkspace ? (
        <>
          {activeTab === 'chat' && workspaceActions.length > 0 && (
            <div className="flex-shrink-0 border-b border-outline-variant px-6 pb-4">
              <div className="flex flex-wrap gap-2">
                {workspaceActions.map((action, index) => (
                  <button
                    key={action.id}
                    onClick={() => void handleAction(action)}
                    className={`border-b-2 px-1 py-1 text-sm font-medium transition-colors ${
                      index === 0
                        ? isDark ? 'border-[#f2c08d] text-[#f2c08d]' : 'border-primary text-primary'
                        : isDark ? 'border-transparent text-[#9c8e82] hover:border-[#50453b] hover:text-[#d4c4b7]' : 'border-transparent text-on-surface-variant hover:border-outline hover:text-on-surface'
                    }`}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="mx-auto max-w-3xl">
              {activeTab === 'chat' ? <>{renderMessages()}</> : <AiOptionsTab onOpenSettings={onOpenSettings} />}
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'chat' ? renderMessages() : <AiOptionsTab onOpenSettings={onOpenSettings} />}
        </div>
      )}

      {activeTab === 'chat' && (
        <div className={`mt-auto flex-shrink-0 ${isWorkspace ? 'border-t border-[#50453b] p-6' : 'pt-4 p-5'}`}>
        <div className={isWorkspace ? 'mx-auto max-w-3xl' : ''}>
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  if (e.nativeEvent.isComposing) return;
                  e.preventDefault();
                  void handleSend();
                }
              }}
              placeholder={t('app.assistantPromptPlaceholder')}
              className={`flex-1 text-[15px] px-3 py-2.5 outline-none transition-colors border-b-2 ${
                isDark 
                  ? 'border-[#50453b] bg-transparent text-[#e8e1dc] placeholder-[#887d74] focus:border-[#f2c08d]' 
                  : 'border-outline bg-transparent text-on-surface placeholder-on-surface-variant focus:border-primary'
              }`}
              disabled={loading}
            />
            <VoiceMicButton
              onText={(text) => setInput(text)}
              disabled={loading}
              variant="dark"
              size={16}
            />
            <button
              onClick={() => void handleSend()}
              disabled={!input.trim() || loading}
              className="btn-ai btn-sm shrink-0"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
        </div>
      )}
    </div>
  );
};

export default AiAssistant;
