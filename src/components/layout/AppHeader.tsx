import React from 'react';
import { ArrowLeft, Home } from 'lucide-react';

interface AppHeaderProps {
  onBack?: () => void;
  backLabel?: string;
  onGoHome?: () => void;
  breadcrumbs: React.ReactNode;
  rightActions?: React.ReactNode;
  primaryAction?: React.ReactNode;
}

const AppHeader: React.FC<AppHeaderProps> = ({
  onBack,
  backLabel = 'Quay lại',
  onGoHome,
  breadcrumbs,
  rightActions,
  primaryAction,
}) => {
  return (
    <div
      className="flex items-center justify-between gap-4 px-6 py-3 border-b shrink-0 backdrop-blur-sm z-30"
      style={{
        background: 'var(--vt-header-bg, rgba(18, 15, 13, 0.78))',
        borderColor: 'var(--vt-header-border, rgba(255, 255, 255, 0.05))',
      }}
    >
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        {onBack && (
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-[#f0e4d9] transition-colors hover:bg-white/[0.06]"
          >
            <ArrowLeft size={14} />
            {backLabel}
          </button>
        )}

        {onGoHome && (
          <button
            onClick={onGoHome}
            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-[#c5b5a8] transition-colors hover:bg-white/[0.06]"
          >
            <Home size={14} />
            Home
          </button>
        )}

        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px]">
            {breadcrumbs}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {primaryAction}
        {rightActions && <div className="flex items-center gap-2">{rightActions}</div>}
      </div>
    </div>
  );
};

export default AppHeader;
