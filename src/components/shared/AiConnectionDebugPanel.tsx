/**
 * File: AiConnectionDebugPanel.tsx
 * Purpose: Debug panel for AI connection failures — shows error details, config status, and troubleshooting steps
 * Layer: UI (Shared Component)
 * Domain: AI → [debug, error diagnostics, connection status]
 * Deps: lucide-react, use_ai_store, use_auth_store
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  RefreshCw,
  Server,
  Shield,
  Wifi,
  WifiOff,
  X,
  Zap,
  Bug,
} from 'lucide-react';
import { useAiStore } from '../../store/use_ai_store';
import { useAuthStore } from '../../store/use_auth_store';

// ─── Error classification ───────────────────────────────────

type ErrorCategory =
  | 'network'
  | 'auth'
  | 'provider'
  | 'config'
  | 'rate_limit'
  | 'unknown';

interface DiagResult {
  category: ErrorCategory;
  title: string;
  description: string;
  steps: string[];
  technicalDetail: string;
}

function classifyError(errorMessage: string): DiagResult {
  const msg = errorMessage.toLowerCase();
  const localProxyUrl = import.meta.env.VITE_LOCAL_AI_PROXY_URL || 'http://localhost:3030';

  // [Domain:AI] STEP 1 — Classify error type
  if (
    msg.includes('failed to fetch') ||
    msg.includes('fetch failed') ||
    msg.includes('networkerror') ||
    msg.includes('econnrefused') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('timed out') ||
    msg.includes('local ai proxy không phản hồi') ||
    msg.includes('không kết nối được tới provider')
  ) {
    return {
      category: 'network',
      title: 'Lỗi kết nối mạng',
      description: 'Không thể kết nối tới server AI. Có thể do mạng, proxy, hoặc server đang tắt.',
      steps: [
        'Kiểm tra kết nối internet',
        `Nếu dùng Local Proxy: kiểm tra service ở ${localProxyUrl}`,
        'Nếu đang dùng app desktop, 9Router sẽ được thử bật tự động lúc app khởi động',
        'Kiểm tra biến VITE_USE_LOCAL_AI_PROXY trong .env.local',
        'Thử tắt VPN nếu đang bật',
        'Kiểm tra firewall/antivirus có chặn kết nối không',
      ],
      technicalDetail: errorMessage,
    };
  }

  if (
    msg.includes('unauthorized') ||
    msg.includes('401') ||
    msg.includes('invalid api key') ||
    msg.includes('authentication')
  ) {
    return {
      category: 'auth',
      title: 'Lỗi xác thực',
      description: 'API key không hợp lệ hoặc đã hết hạn.',
      steps: [
        'Vào Cài đặt → AI để kiểm tra API key',
        'Đảm bảo key chưa hết hạn trên provider dashboard',
        'Nếu dùng Supabase proxy: kiểm tra session đăng nhập',
        'Thử đăng xuất rồi đăng nhập lại',
      ],
      technicalDetail: errorMessage,
    };
  }

  if (
    msg.includes('token limit') ||
    msg.includes('rate limit') ||
    msg.includes('429') ||
    msg.includes('quota')
  ) {
    return {
      category: 'rate_limit',
      title: 'Hết giới hạn sử dụng',
      description: 'Đã vượt quá giới hạn token hoặc request cho tháng này.',
      steps: [
        'Đợi reset giới hạn (thường đầu tháng)',
        'Chuyển sang model tiết kiệm hơn',
        'Nâng cấp plan trên provider',
        'Thêm API key của provider khác làm backup',
      ],
      technicalDetail: errorMessage,
    };
  }

  if (
    msg.includes('chưa cấu hình ai model') ||
    msg.includes('chưa có api key') ||
    msg.includes('guest mode') ||
    msg.includes('thiếu baseurl')
  ) {
    return {
      category: 'config',
      title: 'Chưa cấu hình AI',
      description: 'Cần cài đặt model AI và API key trước khi sử dụng.',
      steps: [
        'Vào Cài đặt → AI để thêm model',
        'Thêm API key cho ít nhất 1 provider (Gemini, OpenRouter, v.v.)',
        'Hoặc bật Local AI Proxy cho môi trường dev',
        'Kiểm tra file .env.local có đúng biến VITE_*_API_KEY',
      ],
      technicalDetail: errorMessage,
    };
  }

  if (
    msg.includes('proxy error') ||
    msg.includes('500') ||
    msg.includes('502') ||
    msg.includes('503')
  ) {
    return {
      category: 'provider',
      title: 'Lỗi từ AI Provider',
      description: 'Server AI gặp sự cố. Thường là tạm thời.',
      steps: [
        'Đợi 30 giây rồi thử lại',
        'Kiểm tra status page của provider (OpenAI, Google, Anthropic)',
        'Thử chuyển sang model/provider khác',
        'Nếu lỗi liên tục: kiểm tra logs trên Supabase dashboard',
      ],
      technicalDetail: errorMessage,
    };
  }

  return {
    category: 'unknown',
    title: 'Lỗi không xác định',
    description: 'Đã xảy ra lỗi không mong muốn khi gọi AI.',
    steps: [
      'Thử lại request',
      'Kiểm tra console trình duyệt (F12) để xem chi tiết',
      'Nếu lặp lại: gửi nội dung lỗi cho đội phát triển',
    ],
    technicalDetail: errorMessage,
  };
}

// ─── Config Status Checker ──────────────────────────────────

interface ConfigStatus {
  hasActiveModel: boolean;
  activeModelName: string;
  provider: string;
  isAuthenticated: boolean;
  isGuest: boolean;
  localProxyEnabled: boolean;
  localProxyUrl: string;
  hasDirectKeys: string[];
  supabaseConfigured: boolean;
}

function getConfigStatus(): ConfigStatus {
  const aiState = useAiStore.getState();
  const authState = useAuthStore.getState();

  const activeModel = aiState.models.find((m) => m.id === aiState.activeModelId);
  const localProxyEnabled = import.meta.env.VITE_USE_LOCAL_AI_PROXY === 'true';
  const localProxyUrl = import.meta.env.VITE_LOCAL_AI_PROXY_URL || 'http://localhost:3030';

  const directKeys: string[] = [];
  if (import.meta.env.VITE_GEMINI_API_KEY?.trim()) directKeys.push('Gemini');
  if (import.meta.env.VITE_OPENROUTER_API_KEY?.trim()) directKeys.push('OpenRouter');
  if (import.meta.env.VITE_OPENAI_API_KEY?.trim()) directKeys.push('OpenAI');
  if (import.meta.env.VITE_CLAUDE_API_KEY?.trim()) directKeys.push('Claude');
  if (import.meta.env.VITE_HOCAI_API_KEY?.trim()) directKeys.push('HocAI');

  // Also check store apiKeys
  for (const [provider, key] of Object.entries(aiState.apiKeys)) {
    if (key?.trim() && !directKeys.includes(provider)) {
      directKeys.push(provider);
    }
  }

  return {
    hasActiveModel: Boolean(activeModel),
    activeModelName: activeModel?.name || activeModel?.modelId || '(chưa chọn)',
    provider: activeModel?.provider || '(none)',
    isAuthenticated: authState.isAuthenticated,
    isGuest: authState.isGuest,
    localProxyEnabled,
    localProxyUrl,
    hasDirectKeys: directKeys,
    supabaseConfigured: Boolean(import.meta.env.VITE_SUPABASE_URL?.trim()),
  };
}

// ─── Component ──────────────────────────────────────────────

interface AiConnectionDebugPanelProps {
  error: string;
  onDismiss: () => void;
  onRetry?: () => void;
}

export const AiConnectionDebugPanel: React.FC<AiConnectionDebugPanelProps> = ({
  error,
  onDismiss,
  onRetry,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [configStatus, setConfigStatus] = useState<ConfigStatus | null>(null);
  const [copied, setCopied] = useState(false);
  const [networkOk, setNetworkOk] = useState<boolean | null>(null);

  const diag = classifyError(error);

  // [Domain:AI] STEP 1 — Load config status on expand
  useEffect(() => {
    if (expanded && !configStatus) {
      setConfigStatus(getConfigStatus());
    }
  }, [expanded, configStatus]);

  // [Domain:AI] STEP 2 — Quick network check
  useEffect(() => {
    if (expanded) {
      setNetworkOk(navigator.onLine);
    }
  }, [expanded]);

  const handleCopyError = useCallback(() => {
    const debugInfo = [
      `Error: ${error}`,
      `Category: ${diag.category}`,
      `Time: ${new Date().toISOString()}`,
      `UserAgent: ${navigator.userAgent}`,
      configStatus ? [
        `Model: ${configStatus.activeModelName}`,
        `Provider: ${configStatus.provider}`,
        `Auth: ${configStatus.isAuthenticated ? 'yes' : 'no'}`,
        `LocalProxy: ${configStatus.localProxyEnabled ? 'on' : 'off'}`,
        `DirectKeys: ${configStatus.hasDirectKeys.join(', ') || 'none'}`,
      ].join('\n') : '',
    ].join('\n');

    void navigator.clipboard.writeText(debugInfo);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [error, diag.category, configStatus]);

  // ── Category icon + color ──
  const getCategoryIcon = () => {
    switch (diag.category) {
      case 'network': return <WifiOff size={16} />;
      case 'auth': return <Shield size={16} />;
      case 'provider': return <Server size={16} />;
      case 'config': return <Zap size={16} />;
      case 'rate_limit': return <AlertTriangle size={16} />;
      default: return <Bug size={16} />;
    }
  };

  const getCategoryColor = () => {
    switch (diag.category) {
      case 'network': return '#f87171';
      case 'auth': return '#fbbf24';
      case 'config': return '#60a5fa';
      case 'rate_limit': return '#fb923c';
      case 'provider': return '#a78bfa';
      default: return '#f87171';
    }
  };

  const catColor = getCategoryColor();

  return (
    <div style={{
      borderRadius: 14,
      background: 'linear-gradient(135deg, rgba(30,20,16,0.98), rgba(40,28,22,0.95))',
      border: `1px solid ${catColor}30`,
      boxShadow: `0 4px 20px rgba(0,0,0,0.4), inset 0 1px 0 ${catColor}08`,
      overflow: 'hidden',
      fontFamily: 'Manrope, system-ui, sans-serif',
      animation: 'debugPanelSlideIn 0.3s ease-out',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: expanded ? `1px solid ${catColor}15` : 'none',
        cursor: 'pointer',
      }} onClick={() => setExpanded((v) => !v)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            borderRadius: 8,
            background: `${catColor}15`,
            color: catColor,
          }}>
            {getCategoryIcon()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 13,
              fontWeight: 700,
              color: catColor,
              letterSpacing: '0.02em',
            }}>
              {diag.title}
            </div>
            <div style={{
              fontSize: 12,
              color: '#9c8e82',
              marginTop: 2,
              lineHeight: 1.4,
            }}>
              {diag.description}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {onRetry && (
            <button
              onClick={(e) => { e.stopPropagation(); onRetry(); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '5px 10px',
                borderRadius: 8,
                border: `1px solid ${catColor}30`,
                background: `${catColor}10`,
                color: catColor,
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'Manrope, system-ui, sans-serif',
                transition: 'all 0.2s',
              }}
            >
              <RefreshCw size={11} />
              Thử lại
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 24,
              height: 24,
              borderRadius: 6,
              border: 'none',
              background: 'transparent',
              color: '#9c8e82',
              cursor: 'pointer',
              transition: 'transform 0.2s',
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          >
            <ChevronDown size={14} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDismiss(); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 24,
              height: 24,
              borderRadius: 6,
              border: 'none',
              background: 'transparent',
              color: '#9c8e82',
              cursor: 'pointer',
            }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Expanded Debug Content */}
      {expanded && (
        <div style={{
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}>
          {/* Troubleshooting Steps */}
          <div>
            <div style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#9c8e82',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: 8,
            }}>
              🔧 Hướng xử lý
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {diag.steps.map((step, i) => (
                <div key={i} style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  fontSize: 12,
                  color: '#d4c4b7',
                  lineHeight: 1.5,
                }}>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: catColor,
                    background: `${catColor}15`,
                    padding: '1px 6px',
                    borderRadius: 4,
                    flexShrink: 0,
                    marginTop: 1,
                  }}>
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Config Status */}
          {configStatus && (
            <div>
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#9c8e82',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: 8,
              }}>
                ⚙️ Trạng thái cấu hình
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '6px 12px',
                fontSize: 12,
                padding: '10px 12px',
                borderRadius: 10,
                background: 'rgba(80,69,59,0.1)',
                border: '1px solid rgba(80,69,59,0.2)',
              }}>
                <StatusRow
                  label="Kết nối mạng"
                  value={networkOk ? 'Online' : 'Offline'}
                  ok={networkOk === true}
                />
                <StatusRow
                  label="Model AI"
                  value={configStatus.activeModelName}
                  ok={configStatus.hasActiveModel}
                />
                <StatusRow
                  label="Provider"
                  value={configStatus.provider}
                  ok={configStatus.provider !== '(none)'}
                />
                <StatusRow
                  label="Đăng nhập"
                  value={configStatus.isAuthenticated ? 'Đã xác thực' : configStatus.isGuest ? 'Guest' : 'Chưa'}
                  ok={configStatus.isAuthenticated}
                />
                <StatusRow
                  label="Local Proxy"
                  value={configStatus.localProxyEnabled ? `ON (${configStatus.localProxyUrl})` : 'OFF'}
                  ok={configStatus.localProxyEnabled}
                />
                <StatusRow
                  label="Direct Keys"
                  value={configStatus.hasDirectKeys.length > 0 ? configStatus.hasDirectKeys.join(', ') : 'Không có'}
                  ok={configStatus.hasDirectKeys.length > 0}
                />
                <StatusRow
                  label="Supabase"
                  value={configStatus.supabaseConfigured ? 'Đã cấu hình' : 'Chưa'}
                  ok={configStatus.supabaseConfigured}
                />
              </div>
            </div>
          )}

          {/* Technical Detail */}
          <div>
            <div style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#9c8e82',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: 8,
            }}>
              🐛 Chi tiết kỹ thuật
            </div>
            <div style={{
              padding: '10px 12px',
              borderRadius: 8,
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(80,69,59,0.15)',
              fontFamily: 'monospace',
              fontSize: 11,
              color: '#9c8e82',
              lineHeight: 1.6,
              wordBreak: 'break-all',
              whiteSpace: 'pre-wrap',
            }}>
              {diag.technicalDetail}
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{
            display: 'flex',
            gap: 8,
            justifyContent: 'flex-end',
          }}>
            <button
              onClick={handleCopyError}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '6px 12px',
                borderRadius: 8,
                border: '1px solid rgba(80,69,59,0.3)',
                background: 'rgba(80,69,59,0.1)',
                color: '#d4c4b7',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'Manrope, system-ui, sans-serif',
                transition: 'all 0.2s',
              }}
            >
              <Copy size={11} />
              {copied ? '✅ Đã copy' : 'Copy debug info'}
            </button>
            <a
              href="/ai-settings"
              onClick={(e) => e.stopPropagation()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '6px 12px',
                borderRadius: 8,
                border: `1px solid ${catColor}30`,
                background: `${catColor}10`,
                color: catColor,
                fontSize: 11,
                fontWeight: 600,
                textDecoration: 'none',
                fontFamily: 'Manrope, system-ui, sans-serif',
                transition: 'all 0.2s',
              }}
            >
              <ExternalLink size={11} />
              Mở Cài đặt AI
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Sub-component: Status Row ──────────────────────────────

function StatusRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
    }}>
      <span style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: ok ? '#68d391' : '#f87171',
        flexShrink: 0,
      }} />
      <span style={{ color: '#9c8e82' }}>{label}:</span>
      <span style={{
        color: ok ? '#d4c4b7' : '#f87171',
        fontWeight: 500,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {value}
      </span>
    </div>
  );
}

export default AiConnectionDebugPanel;
