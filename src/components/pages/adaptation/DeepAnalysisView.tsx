import React from 'react';
import { 
  CheckCircle2, 
  Wand2, 
  ArrowRight,
  ShieldAlert,
  ChevronDown,
  Info
} from 'lucide-react';

interface DeepAnalysisViewProps {
  onEnterEditor: () => void;
}

const DeepAnalysisView: React.FC<DeepAnalysisViewProps> = ({ onEnterEditor }) => {
  return (
    <div className="animate-fade-in w-full max-w-5xl mx-auto px-4 py-8">
      {/* Header Profile */}
      <div className="flex items-center gap-4 mb-10">
         <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center border border-white/10 shrink-0">
            <span className="font-headline font-bold text-lg text-white">TQ</span>
         </div>
         <div className="flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#94A3B8]">Phân tích hoàn tất</p>
            <h1 className="font-headline text-3xl font-bold text-white tracking-tight">Tam Quốc Diễn Nghĩa</h1>
         </div>
         <div className="flex gap-3">
            <button className="px-5 py-3 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors">
               Chi tiết JSON
            </button>
            <button 
               onClick={onEnterEditor}
               className="px-5 py-3 bg-white text-[#0A0C10] hover:bg-[#E2E8F0] rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shadow-lg shadow-white/10 flex items-center gap-2"
            >
               Vào Editor <ArrowRight size={14} />
            </button>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-8">
        {/* Main Score Area */}
        <div className="space-y-6">
           <div className="bg-[#0F1115] border border-white/5 rounded-[24px] p-8 shadow-ambient flex items-center justify-between">
              <div>
                 <h2 className="text-sm font-bold text-[#F8FAFC] uppercase tracking-widest mb-2">Chất lượng ngôn ngữ</h2>
                 <p className="text-xs text-[#94A3B8] max-w-md leading-relaxed">
                   AI đánh giá văn phong ở mức Tốt. Tuy nhiên vẫn tìm thấy một số rác từ quá trình crawl hoặc edit thô (CV). 
                 </p>
                 <div className="mt-6 flex flex-wrap gap-4">
                    <div className="flex items-center gap-2">
                       <span className="w-2 h-2 rounded-full bg-status-error"></span>
                       <span className="text-xs text-white">12 Chính tả</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <span className="w-2 h-2 rounded-full bg-accent-amber"></span>
                       <span className="text-xs text-white">08 Hán Việt sai</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <span className="w-2 h-2 rounded-full bg-accent-purple"></span>
                       <span className="text-xs text-white">05 Dịch không đúng</span>
                    </div>
                 </div>
              </div>
              
              {/* Score Circle */}
              <div className="relative w-32 h-32 flex items-center justify-center shrink-0">
                 <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="#1E232B" strokeWidth="8" />
                    <circle 
                      cx="50" cy="50" r="45" 
                      fill="none" 
                      stroke="#10B981" 
                      strokeWidth="8" 
                      strokeDasharray="283" 
                      strokeDashoffset={283 - (283 * 78) / 100}
                      strokeLinecap="round" 
                    />
                 </svg>
                 <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="font-display text-4xl font-bold text-white">78</span>
                    <span className="text-[10px] uppercase font-bold text-[#94A3B8] tracking-widest">/ 100</span>
                 </div>
              </div>
           </div>

           {/* Quick Fix Banner */}
           <div className="bg-gradient-to-r from-accent-amber/20 to-[#0F1115] border border-accent-amber/30 rounded-[20px] p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                 <div className="w-10 h-10 bg-accent-amber/20 rounded-full flex items-center justify-center">
                    <Wand2 size={20} className="text-accent-amber" />
                 </div>
                 <div>
                    <h3 className="text-sm font-bold text-white">Phát hiện 28 lỗi có thể tự động sửa</h3>
                    <p className="text-xs text-[#94A3B8] mt-1">Giúp bản thảo mượt mà và chuẩn xác hơn với 1 click.</p>
                 </div>
              </div>
              <button 
                className="px-6 py-3 bg-accent-amber text-black hover:bg-amber-400 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shadow-lg shadow-accent-amber/20"
              >
                 Auto-fix 28 lỗi
              </button>
           </div>

           {/* Errors Details */}
           <div className="bg-[#0F1115] border border-white/5 rounded-[24px] p-6 shadow-ambient">
              <div className="flex items-center justify-between mb-6">
                 <h2 className="text-sm font-bold text-[#F8FAFC] uppercase tracking-widest flex items-center gap-2">
                    <ShieldAlert size={16} className="text-white" /> Chi tiết lỗi phát hiện
                 </h2>
                 <span className="text-xs text-[#94A3B8] font-medium">Nhóm theo loại lỗi</span>
              </div>

              <div className="space-y-4">
                 {/* Error Group */}
                 <div className="border border-white/5 bg-[#0A0C10] rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition-colors">
                       <div className="flex items-center gap-3">
                          <span className="w-2 h-2 rounded-full bg-accent-amber"></span>
                          <span className="text-sm font-bold text-white">Lỗi dịch thuật / Từ lóng Convert</span>
                          <span className="px-2 py-0.5 bg-white/5 rounded text-xs text-[#94A3B8] font-medium">12 occurrences</span>
                       </div>
                       <ChevronDown size={16} className="text-[#94A3B8]" />
                    </div>
                    <div className="p-4 border-t border-white/5 bg-[#0A0C10] space-y-3">
                       <div className="flex items-center justify-between text-xs p-3 rounded-lg bg-[#0F1115] border border-white/5">
                          <div className="flex items-center gap-3">
                             <div className="text-[#E2E8F0]">
                                <span className="text-[#94A3B8] line-through decoration-status-error/50 mr-2">thống suất</span>
                                <ArrowRight size={12} className="inline text-[#94A3B8] mx-2" />
                                <span className="font-medium text-accent-teal">thống soái</span>
                             </div>
                          </div>
                          <span className="text-[#94A3B8]">Chương 1, 4, 7</span>
                       </div>
                       <div className="flex items-center justify-between text-xs p-3 rounded-lg bg-[#0F1115] border border-white/5">
                          <div className="flex items-center gap-3">
                             <div className="text-[#E2E8F0]">
                                <span className="text-[#94A3B8] line-through decoration-status-error/50 mr-2">tẩu mã quan</span>
                                <ArrowRight size={12} className="inline text-[#94A3B8] mx-2" />
                                <span className="font-medium text-accent-teal">cưỡi ngựa xem hoa / cửa ải</span>
                             </div>
                          </div>
                          <span className="text-[#94A3B8]">Chương 5</span>
                       </div>
                    </div>
                 </div>

                 {/* Another Group */}
                 <div className="border border-white/5 bg-[#0A0C10] rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition-colors">
                       <div className="flex items-center gap-3">
                          <span className="w-2 h-2 rounded-full bg-status-error"></span>
                          <span className="text-sm font-bold text-white">Lỗi chính tả cơ bản</span>
                          <span className="px-2 py-0.5 bg-white/5 rounded text-xs text-[#94A3B8] font-medium">08 occurrences</span>
                       </div>
                       <ChevronDown size={16} className="text-[#94A3B8] transform -rotate-90" />
                    </div>
                 </div>
              </div>
           </div>
        </div>

        {/* Story Analysis Sidebar */}
        <div className="space-y-6">
           <div className="bg-[#0F1115] border border-white/5 rounded-[24px] p-6 shadow-ambient">
              <h2 className="text-sm font-bold text-[#F8FAFC] uppercase tracking-widest mb-6">Phân tích cốt truyện</h2>
              
              <div className="space-y-4">
                 <div className="border border-white/5 bg-[#0A0C10] rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                       <span className="text-xs font-bold text-white">Thiết lập nhân vật</span>
                       <CheckCircle2 size={14} className="text-emerald-500" />
                    </div>
                    <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                       Các nhân vật giữ được tính cách đồng nhất. Tào Tháo và Lưu Bị hiện rõ sự đối nghịch nhân sinh quan.
                    </p>
                 </div>

                 <div className="border border-white/5 bg-[#0A0C10] rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                       <span className="text-xs font-bold text-white">Mạch truyện (Pacing)</span>
                       <Info size={14} className="text-accent-purple" />
                    </div>
                    <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                       Từ chương 5 đến chương 8 có nhiều đoạn thoại dài làm giảm nhịp độ trận đánh. Khuyên dùng: Rút ngắn mô tả quân phục.
                    </p>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default DeepAnalysisView;
