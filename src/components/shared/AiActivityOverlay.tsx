/**
 * File: AiActivityOverlay.tsx
 * Purpose: Floating overlay hiển thị AI model đang dùng + token usage real-time
 * Layer: UI (Shared Component)
 * Domain: AI → [activity monitoring, user feedback, transparency]
 * Deps: use_ai_activity_store, lucide-react, React
 */
import React, { useState, useEffect } from 'react';
import { Cpu, Zap, Clock, ChevronDown, ChevronUp, Coins, X } from 'lucide-react';
import { useAiActivityStore } from '../../store/use_ai_activity_store';
import type { ActiveAiCall, CompletedAiCall } from '../../store/use_ai_activity_store';
import ModelSelectorDropdown from './ModelSelectorDropdown';

// ─── Provider display config ────────────────────────────
const PROVIDER_COLORS: Record<string, string> = {
  gemini: '#4285F4',
  openrouter: '#FF6B35',
  openai: '#74AA9C',
  claude: '#CC9B7A',
  hocai: '#FF4081',
  ollama: '#8BC34A',
};

const PROVIDER_LABELS: Record<string, string> = {
  gemini: 'Gemini',
  openrouter: 'OpenRouter',
  openai: 'OpenAI',
  claude: 'Claude',
  hocai: 'HocAI',
  ollama: 'Ollama',
};

const TASK_LABELS: Record<string, string> = {
  brainstorm: 'Brainstorm',
  outline: 'Dàn bài',
  draft: 'Soạn thảo',
  review: 'Review',
  edit: 'Chỉnh sửa',
  summarize: 'Tóm tắt',
  analyze: 'Phân tích',
  qa: 'Hỏi đáp',
  generic: 'Chung',
  style_analysis: 'P.tích văn phong',
  chapter_write: 'Viết chương',
  world_build: 'Xây dựng TG',
  character: 'Nhân vật',
  data_extraction: 'Trích xuất',
  memory_sync: 'Đồng bộ nhớ',
  creation_discuss: 'Thảo luận',
  creation_plan: 'Lập kế hoạch',
  creation_build: 'Xây dựng',
};

function formatTokenCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatCost(usd: number): string {
  if (usd < 0.001) return '$0.00';
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(3)}`;
}

function formatDuration(ms: number): string {
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

function shortModelName(modelId: string, modelName: string): string {
  // Use modelName if it's short and descriptive
  if (modelName && modelName.length <= 28) return modelName;
  // Else shorten modelId
  const parts = modelId.split('/');
  const name = parts[parts.length - 1];
  return name.length > 28 ? name.slice(0, 25) + '...' : name;
}

// ─── Sub-components ─────────────────────────────────────

const ActiveCallRow: React.FC<{ call: ActiveAiCall }> = ({ call }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(Date.now() - call.startedAt);
    }, 500);
    return () => clearInterval(timer);
  }, [call.startedAt]);

  const providerColor = PROVIDER_COLORS[call.provider] || '#d4a574';

  return (
    <div className="ai-activity-call-row" style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 12px',
      borderRadius: 10,
      background: 'rgba(212,165,116,0.06)',
      border: '1px solid rgba(212,165,116,0.12)',
      animation: 'aiActivityPulse 2s ease-in-out infinite',
    }}>
      {/* Pulsing dot */}
      <div style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: providerColor,
        boxShadow: `0 0 8px ${providerColor}60`,
        animation: 'aiActivityDot 1.5s ease-in-out infinite',
        flexShrink: 0,
      }} />

      {/* Model info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 2,
        }}>
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            color: providerColor,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}>
            {PROVIDER_LABELS[call.provider] || call.provider}
          </span>
          <span style={{
            fontSize: 10,
            color: 'rgba(212,196,183,0.5)',
          }}>•</span>
          <span style={{
            fontSize: 11,
            fontWeight: 500,
            color: '#d4c4b7',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {shortModelName(call.modelId, call.modelName)}
          </span>
        </div>

        {/* Live stats row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: 10,
          color: '#9c8e82',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <Clock size={9} />
            {formatDuration(elapsed)}
          </span>
          {call.isStreaming && call.streamedChars > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <Zap size={9} />
              ~{formatTokenCount(call.outputTokens || Math.ceil(call.streamedChars / 4))} tok
            </span>
          )}
          <span style={{
            fontSize: 9,
            padding: '1px 5px',
            borderRadius: 4,
            background: 'rgba(212,165,116,0.1)',
            color: '#d4a574',
            fontWeight: 600,
          }}>
            {TASK_LABELS[call.taskType] || call.taskType}
          </span>
        </div>
      </div>

      {/* Streaming indicator */}
      {call.isStreaming && (
        <div style={{
          display: 'flex',
          gap: 2,
          alignItems: 'center',
        }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: 3,
                height: 10 + i * 3,
                borderRadius: 2,
                background: providerColor,
                opacity: 0.7,
                animation: `aiStreamBar 0.8s ease-in-out ${i * 0.15}s infinite alternate`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const CompletedCallRow: React.FC<{ call: CompletedAiCall }> = ({ call }) => {
  const providerColor = PROVIDER_COLORS[call.provider] || '#d4a574';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '6px 12px',
      borderRadius: 8,
      background: 'rgba(255,255,255,0.02)',
      opacity: 0.75,
      animation: 'aiActivityFadeIn 0.3s ease-out',
    }}>
      {/* Check mark */}
      <div style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: call.cached ? '#8BC34A' : providerColor,
        opacity: 0.6,
        flexShrink: 0,
      }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 10,
          color: '#8a7d73',
        }}>
          <span style={{ fontWeight: 600, color: providerColor, opacity: 0.7 }}>
            {shortModelName(call.modelId, call.modelName)}
          </span>
        </div>
      </div>

      {/* Token + cost */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 10,
        color: '#6f6259',
      }}>
        <span>{formatTokenCount(call.totalTokens)} tok</span>
        <span>{formatCost(call.estimatedCost)}</span>
        <span>{formatDuration(call.durationMs)}</span>
        {call.cached && (
          <span style={{
            fontSize: 8,
            padding: '1px 4px',
            borderRadius: 3,
            background: 'rgba(139,195,74,0.15)',
            color: '#8BC34A',
            fontWeight: 700,
          }}>CACHE</span>
        )}
      </div>
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────

export const AiActivityOverlay: React.FC = () => {
  const activeCalls = useAiActivityStore((s) => s.activeCalls);
  const recentCompleted = useAiActivityStore((s) => s.recentCompleted);
  const sessionTotalTokens = useAiActivityStore((s) => s.sessionTotalTokens);
  const sessionTotalCost = useAiActivityStore((s) => s.sessionTotalCost);
  const sessionCallCount = useAiActivityStore((s) => s.sessionCallCount);

  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [rightOffset, setRightOffset] = useState(16);

  // Auto-expand when there are active calls
  useEffect(() => {
    if (activeCalls.length > 0) {
      setDismissed(false);
    }
  }, [activeCalls.length]);

  useEffect(() => {
    const updateOverlayPosition = () => {
      const assistantPanel = document.getElementById('story-editor-assistant-panel');
      if (!assistantPanel) {
        setRightOffset(16);
        return;
      }

      const computedStyle = window.getComputedStyle(assistantPanel);
      const panelRect = assistantPanel.getBoundingClientRect();
      const isVisible = computedStyle.display !== 'none' && panelRect.width > 0;

      if (!isVisible || window.innerWidth < 1024) {
        setRightOffset(16);
        return;
      }

      setRightOffset(Math.round(window.innerWidth - panelRect.left + 16));
    };

    updateOverlayPosition();
    window.addEventListener('resize', updateOverlayPosition);
    return () => window.removeEventListener('resize', updateOverlayPosition);
  }, []);

  const isActive = activeCalls.length > 0;
  const hasAnything = isActive || recentCompleted.length > 0 || sessionCallCount > 0;

  // Don't render if nothing to show or dismissed
  if (!hasAnything || (dismissed && !isActive)) return null;

  return (
    <>
      {/* CSS Animations */}
      <style>{`
        @keyframes aiActivityPulse {
          0%, 100% { border-color: rgba(212,165,116,0.12); }
          50% { border-color: rgba(212,165,116,0.25); }
        }
        @keyframes aiActivityDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
        @keyframes aiStreamBar {
          from { transform: scaleY(0.6); }
          to { transform: scaleY(1.3); }
        }
        @keyframes aiActivityFadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 0.75; transform: translateY(0); }
        }
        @keyframes aiOverlaySlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div
        id="ai-activity-overlay"
        style={{
          position: 'fixed',
          bottom: 16,
          right: rightOffset,
          zIndex: 9999,
          width: expanded ? 360 : 'auto',
          maxWidth: 400,
          fontFamily: 'Manrope, system-ui, sans-serif',
          animation: 'aiOverlaySlideIn 0.3s ease-out',
        }}
      >
        {/* ── Collapsed: Compact pill ── */}
        {!expanded && (
          <button
            onClick={() => setExpanded(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 14px',
              borderRadius: 12,
              background: isActive
                ? 'linear-gradient(135deg, rgba(30,25,21,0.97), rgba(42,36,30,0.95))'
                : 'rgba(30,25,21,0.90)',
              border: `1px solid ${isActive ? 'rgba(212,165,116,0.25)' : 'rgba(255,255,255,0.06)'}`,
              boxShadow: isActive
                ? '0 4px 20px rgba(0,0,0,0.4), 0 0 12px rgba(212,165,116,0.08)'
                : '0 2px 12px rgba(0,0,0,0.3)',
              cursor: 'pointer',
              color: '#e8e1dc',
              fontSize: 11,
              fontWeight: 600,
              transition: 'all 0.2s ease',
            }}
          >
            <Cpu
              size={14}
              style={{
                color: isActive ? '#d4a574' : '#6f6259',
                animation: isActive ? 'aiActivityDot 1.5s ease-in-out infinite' : undefined,
              }}
            />

            {isActive ? (
              <>
                <span style={{ color: '#d4a574' }}>
                  {activeCalls[0] && shortModelName(activeCalls[0].modelId, activeCalls[0].modelName)}
                </span>
                {activeCalls.length > 1 && (
                  <span style={{ color: '#9c8e82', fontSize: 10 }}>
                    +{activeCalls.length - 1}
                  </span>
                )}
              </>
            ) : (
              <span style={{ color: '#9c8e82' }}>
                AI: {formatTokenCount(sessionTotalTokens)} tok
              </span>
            )}

            {sessionTotalCost > 0 && (
              <span style={{
                fontSize: 10,
                color: '#6f6259',
                padding: '1px 5px',
                borderRadius: 4,
                background: 'rgba(255,255,255,0.04)',
              }}>
                {formatCost(sessionTotalCost)}
              </span>
            )}

            <ChevronUp size={12} style={{ color: '#6f6259' }} />
          </button>
        )}

        {/* ── Expanded: Full panel ── */}
        {expanded && (
          <div style={{
            borderRadius: 16,
            background: 'linear-gradient(135deg, rgba(24,20,17,0.98), rgba(36,30,25,0.96))',
            border: '1px solid rgba(212,165,116,0.15)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 16px rgba(212,165,116,0.05)',
          }}>
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <Cpu size={14} style={{
                  color: isActive ? '#d4a574' : '#6f6259',
                  animation: isActive ? 'aiActivityDot 1.5s ease-in-out infinite' : undefined,
                }} />
                <span style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#e8e1dc',
                  letterSpacing: '0.02em',
                }}>
                  AI Monitor
                </span>
                {isActive && (
                  <span style={{
                    fontSize: 9,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: 'rgba(212,165,116,0.15)',
                    color: '#d4a574',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}>
                    {activeCalls.length} đang chạy
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  onClick={() => setExpanded(false)}
                  style={{
                    padding: 4,
                    borderRadius: 6,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#6f6259',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <ChevronDown size={14} />
                </button>
                {!isActive && (
                  <button
                    onClick={() => { setDismissed(true); setExpanded(false); }}
                    style={{
                      padding: 4,
                      borderRadius: 6,
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#6f6259',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Model Selector Bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 14px',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              background: 'rgba(0,0,0,0.15)',
            }}>
              <span style={{ fontSize: 11, color: '#9c8e82', fontWeight: 600 }}>Nguồn Model:</span>
              <ModelSelectorDropdown direction="up" />
            </div>

            {/* Session stats bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '6px 14px',
              background: 'rgba(255,255,255,0.02)',
              borderBottom: '1px solid rgba(255,255,255,0.03)',
              fontSize: 10,
              color: '#8a7d73',
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Zap size={9} />
                {formatTokenCount(sessionTotalTokens)} tokens
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Coins size={9} />
                {formatCost(sessionTotalCost)}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Cpu size={9} />
                {sessionCallCount} calls
              </span>
            </div>

            {/* Active calls */}
            <div style={{
              padding: '8px 10px',
              maxHeight: 300,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}>
              {activeCalls.map((call) => (
                <ActiveCallRow key={call.id} call={call} />
              ))}

              {/* Recent completed */}
              {recentCompleted.length > 0 && (
                <>
                  {activeCalls.length > 0 && (
                    <div style={{
                      height: 1,
                      background: 'rgba(255,255,255,0.04)',
                      margin: '4px 0',
                    }} />
                  )}
                  {recentCompleted.map((call) => (
                    <CompletedCallRow key={call.id} call={call} />
                  ))}
                </>
              )}

              {/* Empty state */}
              {!isActive && recentCompleted.length === 0 && (
                <div style={{
                  textAlign: 'center',
                  padding: '12px 0',
                  fontSize: 11,
                  color: '#6f6259',
                }}>
                  Chưa có hoạt động AI nào
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default AiActivityOverlay;
