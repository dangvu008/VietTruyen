import React from 'react';
import { 
  CheckCircle2, 
  BarChart2, 
  Zap, 
  ArrowRight,
  ShieldAlert,
  FileText,
  Users,
  PenTool
} from 'lucide-react';

interface ImportSuccessViewProps {
  onAnalyzeCore: () => void;
  onEditNow: () => void;
}

const ImportSuccessView: React.FC<ImportSuccessViewProps> = ({ onAnalyzeCore, onEditNow }) => {
  return (
    <div className="animate-fade-in w-full max-w-5xl mx-auto px-4 py-12">
      <div className="text-center mb-12 flex flex-col items-center">
        <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(16,185,129,0.2)]">
           <CheckCircle2 size={40} className="text-emerald-500" />
        </div>
        <h1 className="font-headline text-4xl font-bold text-white mb-3">Import Thành Công</h1>
        <p className="text-[#94A3B8] font-body">Bản thảo của bạn đã được khởi tạo dự án với thông số cơ bản như sau.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Basic Stats */}
        <div className="md:col-span-1 bg-[#0F1115] border border-white/5 rounded-[24px] p-6 shadow-ambient overflow-hidden">
           <div className="flex items-center gap-2 mb-6">
              <BarChart2 size={18} className="text-accent-teal" />
              <h2 className="text-sm font-bold text-[#F8FAFC] uppercase tracking-widest">Phân tích cơ bản</h2>
              <span className="ml-auto text-[10px] font-bold uppercase px-2 py-0.5 bg-accent-teal/10 text-accent-teal rounded-full">Miễn phí</span>
           </div>

           <div className="space-y-4">
             <div className="bg-[#0A0C10] p-4 rounded-xl border border-white/5">
                <p className="text-xs text-[#94A3B8] font-semibold uppercase tracking-wider mb-1 flex items-center gap-1"><FileText size={12} /> Tổng số chương</p>
                <p className="text-2xl font-display text-white">847 <span className="text-sm font-body text-[#94A3B8] font-normal tracking-wide">chương</span></p>
             </div>
             <div className="bg-[#0A0C10] p-4 rounded-xl border border-white/5">
                <p className="text-xs text-[#94A3B8] font-semibold uppercase tracking-wider mb-1 flex items-center gap-1"><Zap size={12} /> Phân bổ trung bình</p>
                <p className="text-2xl font-display text-white">3,240 <span className="text-sm font-body text-[#94A3B8] font-normal tracking-wide">ký tự/chương</span></p>
             </div>
             <div className="bg-[#0A0C10] p-4 rounded-xl border border-white/5">
                <p className="text-xs text-[#94A3B8] font-semibold uppercase tracking-wider mb-1 flex items-center gap-1"><Users size={12} /> Tên định danh</p>
                <div className="flex flex-wrap gap-1 mt-2">
                   <span className="px-2 py-1 bg-[#1E232B] rounded text-[10px] text-[#E2E8F0] font-semibold">Gia Cát Lượng</span>
                   <span className="px-2 py-1 bg-[#1E232B] rounded text-[10px] text-[#E2E8F0] font-semibold">Tào Tháo</span>
                   <span className="px-2 py-1 bg-[#1E232B] rounded text-[10px] text-[#E2E8F0] font-semibold">Quan Vũ</span>
                   <span className="px-2 py-1 bg-[#1E232B] rounded text-[10px] text-[#94A3B8] font-semibold">+ 42 khác</span>
                </div>
             </div>
           </div>
        </div>

        {/* Action Panel */}
        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 h-full">

           {/* Deep Analysis */}
           <div className="bg-[#0F1115] border border-accent-amber/20 rounded-[24px] p-6 shadow-[0_8px_32px_rgba(245,158,11,0.06)] flex flex-col relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-accent-amber/5 to-transparent pointer-events-none" />
              
              <div className="flex items-center gap-2 mb-4 relative z-10">
                 <ShieldAlert size={20} className="text-accent-amber" />
                 <h2 className="text-sm font-bold text-[#F8FAFC] uppercase tracking-widest">Phân tích chuyên sâu</h2>
              </div>
              
              <p className="text-xs text-[#E2E8F0] leading-relaxed mb-6 relative z-10">
                Sử dụng AI phân tích logic, vạch lá tìm sâu, kiểm tra lỗi Hán Việt, lỗi logic và sự nhất quán của các nhân vật.
              </p>

              <div className="mt-auto relative z-10 bg-[#0A0C10]/60 p-3 rounded-xl border border-white/5 mb-4 backdrop-blur-md">
                 <div className="flex justify-between items-center text-xs mb-1">
                    <span className="text-[#94A3B8]">Dự kiến tốn khoảng:</span>
                    <span className="font-bold text-accent-amber">~2,400 tokens</span>
                 </div>
                 <div className="flex justify-between items-center text-xs">
                    <span className="text-[#94A3B8]">Thời gian dự kiến:</span>
                    <span className="font-bold text-white">45s - 1 phút</span>
                 </div>
              </div>

              <button 
                onClick={onAnalyzeCore}
                className="w-full py-4 bg-accent-amber/20 hover:bg-accent-amber/30 text-accent-amber border border-accent-amber/40 rounded-xl font-bold uppercase tracking-widest text-xs transition-colors flex items-center justify-center gap-2 relative z-10"
              >
                Phân tích bằng AI <Zap size={14} />
              </button>
           </div>

           {/* Edit Directly */}
           <div className="bg-[#0F1115] border border-white/5 rounded-[24px] p-6 shadow-ambient flex flex-col relative group">
              <div className="flex items-center gap-2 mb-4">
                 <PenTool size={20} className="text-white" />
                 <h2 className="text-sm font-bold text-[#F8FAFC] uppercase tracking-widest">Vào sửa ngay</h2>
              </div>
              
              <p className="text-xs text-[#E2E8F0] leading-relaxed mb-6">
                Bỏ qua bước phân tích AI tổng thể. Trực tiếp mổ xẻ và chỉnh sửa từng chương trên Editor chuyên dụng.
              </p>

              <div className="mt-auto">
                 <button 
                    onClick={onEditNow}
                    className="w-full py-4 bg-white text-[#0A0C10] hover:bg-[#E2E8F0] rounded-xl font-bold uppercase tracking-widest text-xs transition-colors shadow-lg shadow-white/10 flex items-center justify-center gap-2"
                  >
                    Vào thẳng Editor <ArrowRight size={14} />
                 </button>
              </div>
           </div>

        </div>
      </div>
    </div>
  );
};

export default ImportSuccessView;
