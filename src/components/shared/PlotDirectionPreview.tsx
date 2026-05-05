/**
 * File: PlotDirectionPreview.tsx
 * Purpose: Show 2-3 possible story directions before committing a Surgery rewrite
 * Layer: UI
 * Domain: Surgery -> [plot direction decision]
 */
import { AlertTriangle, CheckCircle2, GitBranch, Sparkles } from 'lucide-react';
import { usePlotDirection } from '../../hooks/use_plot_direction';
import type { Arc, Project } from '../../types/story';
import type { ImpactScanResult, SurgerySpec } from '../../types/surgery';
import type { PlotDirectionOption } from '../../types/plot_direction';

interface PlotDirectionPreviewProps {
  project: Project;
  spec: SurgerySpec;
  scan: ImpactScanResult;
  arcs: Arc[];
  onConfirm: (direction: PlotDirectionOption) => void | Promise<void>;
}

const riskClass = {
  low: 'text-[#2DD4BF] border-[#2DD4BF]/30 bg-[#2DD4BF]/10',
  medium: 'text-[#F59E0B] border-[#F59E0B]/30 bg-[#F59E0B]/10',
  high: 'text-[#EF4444] border-[#EF4444]/30 bg-[#EF4444]/10',
};

const stanceLabel: Record<PlotDirectionOption['stance'], string> = {
  preserve: 'Bảo toàn',
  pivot: 'Đổi trục',
  twist: 'Bẻ lái',
  experimental: 'Thử nghiệm',
};

export default function PlotDirectionPreview({
  project,
  spec,
  scan,
  arcs,
  onConfirm,
}: PlotDirectionPreviewProps) {
  const { preview, isAnalyzing, error, analyze } = usePlotDirection();
  const selectedId = spec.selectedPlotDirection?.id;

  const handleAnalyze = () => {
    void analyze({ project, spec, scan, arcs });
  };

  const handleConfirm = (direction: PlotDirectionOption) => {
    void onConfirm(direction);
  };

  return (
    <div className="bg-[#0F1115] rounded-2xl border border-[#1E232B] p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-display font-semibold text-[#F8FAFC] text-sm flex items-center gap-2">
            <GitBranch size={16} className="text-[#F59E0B]" />
            Hướng cốt truyện có thể rẽ
          </h3>
          <p className="text-xs text-[#94A3B8] mt-2">
            Xem trước hậu quả cốt truyện trước khi tạo hàng chờ viết lại.
          </p>
        </div>
        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing || scan.records.length === 0}
          className="btn-secondary btn-sm"
        >
          <Sparkles size={14} />
          {isAnalyzing ? 'Đang phân tích...' : 'Đề xuất hướng rẽ'}
        </button>
      </div>

      {spec.selectedPlotDirection && (
        <div className="rounded-xl border border-[#2DD4BF]/30 bg-[#2DD4BF]/10 p-3">
          <p className="text-xs font-semibold text-[#2DD4BF] flex items-center gap-2">
            <CheckCircle2 size={14} />
            Đã chọn: {spec.selectedPlotDirection.title}
          </p>
          <p className="text-sm text-[#E2E8F0] mt-2">{spec.selectedPlotDirection.summary}</p>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/10 p-3 text-sm text-[#FCA5A5] flex gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {preview && (
        <div className="space-y-3">
          <p className="text-sm text-[#E2E8F0]">{preview.decisionSummary}</p>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
            {preview.directions.map((direction) => (
              <div
                key={direction.id}
                className={`rounded-xl border p-4 bg-[#111827]/70 ${
                  selectedId === direction.id ? 'border-[#2DD4BF]/50' : 'border-[#1E232B]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#F8FAFC]">{direction.title}</p>
                    <p className="text-[11px] text-[#94A3B8] mt-1">{stanceLabel[direction.stance]} · {direction.affectedRange}</p>
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${riskClass[direction.riskLevel]}`}>
                    {direction.riskLevel}
                  </span>
                </div>

                <p className="text-sm text-[#E2E8F0] mt-3 leading-6">{direction.summary}</p>

                {direction.downstreamImpact.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[11px] uppercase text-[#94A3B8] font-semibold">Hệ quả</p>
                    <ul className="mt-1 space-y-1 text-xs text-[#CBD5E1]">
                      {direction.downstreamImpact.slice(0, 3).map((item) => (
                        <li key={item}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {direction.tradeoffs.length > 0 && (
                  <p className="text-xs text-[#94A3B8] mt-3">
                    Đánh đổi: {direction.tradeoffs.slice(0, 2).join(' · ')}
                  </p>
                )}

                <button
                  onClick={() => handleConfirm(direction)}
                  className={selectedId === direction.id ? 'btn-primary btn-sm w-full mt-4' : 'btn-secondary btn-sm w-full mt-4'}
                >
                  {selectedId === direction.id ? 'Đang dùng hướng này' : 'Chọn hướng này'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
