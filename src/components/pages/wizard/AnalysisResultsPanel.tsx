import type { CombinedReviewReport, CheckerReport } from '../../../core/checkers/checker_types';

interface AnalysisResultsPanelProps {
  report: CombinedReviewReport;
}

const getCheckerName = (agent: string) => {
  switch(agent) {
    case 'high_point': return 'Sảng';
    case 'ooc': return 'OOC';
    case 'pacing': return 'Nhịp độ';
    case 'reader_pull': return 'Sức hút';
    case 'consistency': return 'Logic';
    case 'continuity': return 'Mạch truyện';
    default: return agent;
  }
};

export default function AnalysisResultsPanel({ report }: AnalysisResultsPanelProps) {
  const allIssues = report.reports.flatMap((r: any) => 
    (r as CheckerReport)?.issues?.map(i => ({...i, agent: r.agent})) || []
  ) || [];

  return (
    <div className="space-y-12 animate-fade-in w-full">
      {/* Scorecard Section */}
      <section className="text-center">
        <div className="inline-block mb-8 relative">
          <div className="w-48 h-48 rounded-full border-[12px] border-surface-container flex items-center justify-center relative">
            {/* SVG Progress Circle */}
            <svg className="absolute inset-0 w-full h-full -rotate-90">
              <circle className="text-primary-container/30" cx="96" cy="96" fill="none" r="84" stroke="currentColor" strokeWidth="12" />
              <circle 
                className="text-primary transition-all duration-1000 ease-out" 
                cx="96" cy="96" fill="none" r="84" stroke="currentColor" 
                strokeDasharray="527" 
                strokeDashoffset={527 - (527 * (report.combined_score || 0)) / 100} 
                strokeLinecap="round" strokeWidth="12" 
              />
            </svg>
            <div className="flex flex-col items-center">
              <span className="text-5xl font-extrabold font-headline tracking-tighter text-[#F8FAFC]">
                {Math.round(report.combined_score || 0)}
              </span>
              <span className="text-xs font-semibold text-outline tracking-widest uppercase">/ 100</span>
            </div>
          </div>
        </div>

        {/* Secondary Metrics Bento Grid */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {report.reports.map((r: any) => {
            if (!r) return null;
            const rep = r as CheckerReport;
            return (
              <div key={rep.agent} className="bg-[#0F1115] p-3 md:p-4 rounded-2xl flex flex-col items-center justify-center border border-white/5 shadow-glass">
                <p className="text-[10px] uppercase tracking-widest text-outline mb-1 font-bold whitespace-nowrap overflow-hidden text-ellipsis w-full text-center">
                  {getCheckerName(rep.agent)}
                </p>
                <p className={`text-xl md:text-2xl font-bold font-headline ${rep.overall_score < 70 ? 'text-error' : 'text-primary'}`}>
                  {rep.overall_score}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Issues Section */}
      <section>
        <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
          <h2 className="text-xl font-bold font-headline text-on-background">Báo cáo Vấn đề</h2>
          <span className="text-xs font-medium text-primary bg-primary/10 px-3 py-1 rounded-full uppercase tracking-widest border border-primary/20">
            {allIssues.length} Phát hiện
          </span>
        </div>

        {allIssues.length === 0 ? (
          <div className="bg-[#0F1115]est p-8 rounded-2xl border border-white/5 text-center shadow-glass">
             <div className="inline-flex w-16 h-16 bg-green-500/10 text-green-500 rounded-full items-center justify-center mb-4">
                <span className="material-symbols-outlined text-4xl">check_circle</span>
             </div>
             <h3 className="text-lg text-primary font-bold">Chương xuất sắc!</h3>
             <p className="text-[#94A3B8] mt-2 text-sm">AI không tìm thấy vấn đề nghiêm trọng nào trong văn bản của bạn.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {allIssues.map((issue, idx) => {
              const isCritical = issue.severity === 'critical' || issue.severity === 'high';
              const borderColor = isCritical ? 'bg-error' : 'bg-orange-400';
              const iconColor = isCritical ? 'text-error' : 'text-orange-400';
              const iconBg = isCritical ? 'bg-error/10' : 'bg-orange-400/10';
              const iconName = isCritical ? 'error' : 'warning';
              const severityLabel = isCritical ? 'Lỗi tới hạn' : 'Cảnh báo';
              
              return (
                <div key={idx} className="bg-[#0F1115] p-6 rounded-2xl border border-white/5 shadow-glass relative overflow-hidden group">
                  <div className={`absolute top-0 left-0 w-1 h-full ${borderColor}`}></div>
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg ${iconBg} ${iconColor} border border-white/5`}>
                      <span className="material-symbols-outlined">{iconName}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                         <h3 className="font-bold text-[#F8FAFC] font-headline">{severityLabel}</h3>
                         <span className="text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full bg-[#1E232B] text-[#94A3B8] border border-white/5">
                           {getCheckerName(issue.agent)}
                         </span>
                      </div>
                      <p className="text-sm text-[#94A3B8] font-body leading-relaxed mb-4">
                        {issue.description}
                      </p>
                      
                      {/* AI Insight / Suggestion */}
                      <div className="bg-black/20 rounded-xl p-4 border border-primary/20 relative overflow-hidden">
                        <div className="flex items-center gap-2 mb-2 text-primary">
                          <span className="material-symbols-outlined text-sm">lightbulb</span>
                          <span className="text-xs font-bold uppercase tracking-tight">Gợi ý AI</span>
                        </div>
                        <p className="text-sm text-[#F8FAFC] font-body italic opacity-90">
                            {issue.suggestion}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Auto-fix Action */}
      {allIssues.length > 0 && (
        <div className="flex justify-center mt-8">
          <button disabled className="bg-gradient-to-r from-primary to-orange-400 text-black px-10 py-5 rounded-[24px] shadow-glow flex items-center justify-center gap-3 w-full md:w-auto opacity-50 cursor-not-allowed border border-white/10">
            <span className="material-symbols-outlined">magic_button</span>
            <span className="font-bold tracking-tight font-headline">🪄 Auto-fix bằng Polish (Sắp ra mắt)</span>
          </button>
        </div>
      )}
    </div>
  );
}
