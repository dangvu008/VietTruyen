/**
 * File: ExportPage.tsx
 * Purpose: Trang xuất bản — export project ra TXT/MD/HTML/DOCX
 * Layer: UI Page
 * Domain: Export → [format, options, download]
 */
import React, { useState } from 'react';
import type { Project } from '../../types/story';
import { exportProject, type ExportFormat, type ExportOptions } from '../../core/exporter';

interface ExportPageProps {
  project: Project;
}

const truncateStr = (value: string, limit: number) => {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit).trim()}...`;
};

const ExportPage: React.FC<ExportPageProps> = ({ project }) => {
  const [format, setFormat] = useState<ExportFormat>('md');
  const [status, setStatus] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [options, setOptions] = useState<ExportOptions>({
    includeBible: true,
    includeWorld: true,
    includeCharacters: true,
    includeOutline: true,
    includeChapters: true,
    includeNotes: false,
  });

  const handleExport = async () => {
    try {
      setIsExporting(true);
      setStatus('Đang khởi tạo tệp...');
      await exportProject(project, format, options);
      setStatus('✅ Xuất file thành công.');
    } catch {
      setStatus('❌ Thất bại. Vui lòng thử lại.');
    } finally {
      setIsExporting(false);
    }
  };

  const CHECKBOX_OPTIONS: { key: keyof ExportOptions; label: string; icon: string; desc: string }[] = [
    { key: 'includeBible', label: 'Story Bible', icon: 'menu_book', desc: 'Bao gồm toàn bộ cài đặt gốc' },
    { key: 'includeWorld', label: 'World', icon: 'public', desc: 'Bối cảnh thế giới' },
    { key: 'includeCharacters', label: 'Characters', icon: 'groups', desc: 'Hồ sơ nhân vật' },
    { key: 'includeOutline', label: 'Outline', icon: 'list_alt', desc: 'Đề cương cốt truyện' },
    { key: 'includeChapters', label: 'Chapters', icon: 'edit_document', desc: 'Toàn bộ nội dung chương' },
  ];

  const FORMATS: { id: ExportFormat; label: string; icon: string }[] = [
    { id: 'txt', label: 'TXT', icon: 'description' },
    { id: 'md', label: 'MD', icon: 'markdown' },
    { id: 'html', label: 'HTML', icon: 'code' },
    { id: 'docx', label: 'DOCX', icon: 'article' },
    { id: 'canon', label: 'CANON ZIP', icon: 'folder_zip' },
  ];

  const totalWords = project.chapters?.reduce((acc, ch) => acc + (ch.content?.split(/\s+/).length || 0), 0) || 0;
  const previewChapter = project.chapters?.[0]?.content || "Chưa có nội dung bản thảo để xem trước.";

  return (
    <div className="w-full h-full flex flex-col md:flex-row p-6 md:p-8 animate-fade-in font-sans" style={{ background: '#151310' }}>
      
      {/* Left Column: Controls (35%) */}
      <div className="w-full md:w-[35%] flex flex-col h-full pr-8" style={{ borderRight: '1px solid rgba(80,69,59,0.3)' }}>
        <header className="mb-8">
          <h1 className="text-3xl font-display font-light mb-2" style={{ color: '#e8e1dc' }}>Xuất Bản</h1>
          <p className="text-sm tracking-wide uppercase font-semibold" style={{ color: '#9c8e82' }}>Tùy Chọn Định Dạng</p>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 space-y-10">
          
          {/* Format Selection */}
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: '#d4c4b7' }}>Định Dạng Đầu Ra</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {FORMATS.map((fmt) => {
                const isActive = format === fmt.id;
                return (
                  <button
                    key={fmt.id}
                    onClick={() => setFormat(fmt.id)}
                    className="flex flex-col items-center justify-center py-4 rounded-2xl transition-all border group"
                    style={{
                      background: isActive ? '#f2c08d' : '#1d1b18',
                      borderColor: isActive ? '#f2c08d' : 'rgba(80,69,59,0.3)',
                      color: isActive ? '#151310' : '#8a7d73'
                    }}
                  >
                    <span className="material-symbols-outlined text-2xl mb-1 transition-transform group-hover:scale-110" style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}>
                      {fmt.icon}
                    </span>
                    <span className="text-xs font-bold tracking-wider">{fmt.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <hr style={{ borderColor: 'rgba(80,69,59,0.2)' }} />

          {/* Included Content */}
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: '#d4c4b7' }}>Nội Dung Xuất</h2>
            <div className="space-y-2">
              {CHECKBOX_OPTIONS.map((opt) => {
                const isSelected = options[opt.key];
                return (
                  <label
                    key={opt.key}
                    className="flex items-start gap-4 p-4 rounded-2xl cursor-pointer transition-all border"
                    style={{
                      background: isSelected ? 'rgba(242,192,141,0.05)' : '#1d1b18',
                      borderColor: isSelected ? 'rgba(242,192,141,0.3)' : 'transparent',
                    }}
                  >
                    <div className="mt-0.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => setOptions({ ...options, [opt.key]: e.target.checked })}
                        className="w-5 h-5 rounded"
                        style={{ accentColor: '#f2c08d' }}
                      />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold" style={{ color: isSelected ? '#f2c08d' : '#e8e1dc' }}>{opt.label}</p>
                      <p className="text-xs mt-1" style={{ color: '#9c8e82' }}>{opt.desc}</p>
                    </div>
                    <span className="material-symbols-outlined opacity-50" style={{ fontSize: '20px', color: isSelected ? '#f2c08d' : '#8a7d73' }}>{opt.icon}</span>
                  </label>
                );
              })}
            </div>
          </section>

        </div>

        {/* Action Button */}
        <div className="mt-8 pt-6 border-t" style={{ borderColor: 'rgba(80,69,59,0.3)' }}>
          <button 
             onClick={handleExport}
             disabled={isExporting}
             className="w-full flex items-center justify-center gap-3 py-4 rounded-xl transition-all active:scale-95 disabled:opacity-50 font-bold tracking-wide"
             style={{ background: '#f2c08d', color: '#151310' }}
           >
             {isExporting ? "Đang xử lý..." : "Bắt Đầu Trích Xuất"}
             {!isExporting && <span className="material-symbols-outlined text-lg">arrow_forward</span>}
           </button>
           {status && (
            <div className="mt-4 text-center text-sm font-medium" style={{ color: status.includes('✅') ? '#a5d0e6' : '#f2c08d' }}>
              {status}
            </div>
           )}
        </div>
      </div>

      {/* Right Column: Live Preview (65%) */}
      <div className="w-full md:w-[65%] h-full pl-8 flex flex-col pt-4 md:pt-0">
         <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: '#d4c4b7' }}>Bản Xem Trước Trực Tiếp</h2>
          <span className="text-xs font-semibold px-3 py-1 rounded-full" style={{ background: 'rgba(165,208,230,0.1)', color: '#a5d0e6' }}>
            {totalWords.toLocaleString()} Từ
          </span>
        </div>
        
        {/* Editor Parchment / Preview Area */}
        <div className="flex-1 rounded-2xl relative overflow-hidden flex flex-col shadow-2xl border" style={{ background: '#1d1b18', borderColor: 'rgba(80,69,59,0.2)' }}>
           {/* Top bar of preview */}
           <div className="h-12 w-full flex items-center px-6 gap-2" style={{ background: '#151310', borderBottom: '1px solid rgba(80,69,59,0.2)' }}>
              <div className="w-3 h-3 rounded-full opacity-30" style={{ background: '#f2c08d' }}></div>
              <div className="w-3 h-3 rounded-full opacity-30" style={{ background: '#f2c08d' }}></div>
              <div className="w-3 h-3 rounded-full opacity-30" style={{ background: '#f2c08d' }}></div>
              <div className="flex-1 text-center text-xs font-semibold opacity-50" style={{ color: '#d4c4b7' }}>
                {project.title || "Untitled Project"}.{format}
              </div>
           </div>

           {/* Content */}
           <div className="flex-1 p-10 md:p-14 overflow-y-auto custom-scrollbar relative">
             <div className="max-w-2xl mx-auto">
                <h1 className="text-4xl font-display font-light mb-8 text-center" style={{ color: '#e8e1dc' }}>{project.title || "Untitled Project"}</h1>
                
                {options.includeChapters && (
                   <article className="font-body text-lg leading-relaxed space-y-6" style={{ color: '#d4c4b7' }}>
                     <div className="whitespace-pre-wrap">{truncateStr(previewChapter, 1500)}</div>
                     {previewChapter.length > 1500 && (
                        <div className="w-full h-32 absolute bottom-0 left-0" style={{ background: 'linear-gradient(to bottom, transparent, #1d1b18)' }}></div>
                     )}
                   </article>
                )}
                {!options.includeChapters && (
                  <div className="flex items-center justify-center h-40">
                    <p className="text-sm italic" style={{ color: '#8a7d73' }}>Nội dung bản thảo đã bị ẩn (Bỏ chọn 'Chapters').</p>
                  </div>
                )}
             </div>
           </div>
        </div>
      </div>

    </div>
  );
};

export default ExportPage;
