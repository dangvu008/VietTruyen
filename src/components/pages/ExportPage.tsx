/**
 * File: ExportPage.tsx
 * Purpose: Trang xuất bản — export project ra TXT/MD/HTML/DOCX
 * Layer: UI Page
 * Domain: Export → [format, options, download]
 */
import React, { useState } from 'react';
import { FileOutput, Download } from 'lucide-react';
import type { Project } from '../../types/story';
import { exportProject, type ExportFormat, type ExportOptions } from '../../core/exporter';
import PageHeader from '../layout/PageHeader';

interface ExportPageProps {
  project: Project;
}

const ExportPage: React.FC<ExportPageProps> = ({ project }) => {
  const [format, setFormat] = useState<ExportFormat>('md');
  const [status, setStatus] = useState('');
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
      setStatus('Đang xuất file...');
      await exportProject(project, format, options);
      setStatus('✅ Xuất file thành công.');
    } catch {
      setStatus('❌ Xuất file thất bại. Kiểm tra dependency (docx) nếu dùng DOCX.');
    }
  };

  const CHECKBOX_OPTIONS: { key: keyof ExportOptions; label: string }[] = [
    { key: 'includeBible', label: 'Series Bible' },
    { key: 'includeWorld', label: 'Thế giới' },
    { key: 'includeCharacters', label: 'Nhân vật' },
    { key: 'includeOutline', label: 'Dàn ý' },
    { key: 'includeChapters', label: 'Chương truyện' },
    { key: 'includeNotes', label: 'Ghi chú' },
  ];

  return (
    <div className="animate-fade-in max-w-2xl">
      <PageHeader
        title="Xuất bản"
        subtitle="Xuất dự án ra file để lưu trữ hoặc chia sẻ"
      />

      <div className="card mb-4">
        <h3 className="font-display font-semibold text-text-primary text-sm mb-4 flex items-center gap-2">
          <FileOutput size={16} className="text-accent-amber" /> Tùy chọn xuất
        </h3>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="label">Định dạng</label>
            <select className="input-base" value={format}
              onChange={(e) => setFormat(e.target.value as ExportFormat)}>
              <option value="txt">TXT — Văn bản thuần</option>
              <option value="md">Markdown</option>
              <option value="html">HTML</option>
              <option value="docx">DOCX — Word</option>
            </select>
          </div>
          <div>
            <label className="label">Bao gồm</label>
            <div className="space-y-2">
              {CHECKBOX_OPTIONS.map((opt) => (
                <label key={opt.key} className="flex items-center gap-3 text-sm text-text-secondary 
                                                cursor-pointer hover:text-text-primary transition-colors">
                  <input type="checkbox" checked={options[opt.key]}
                    onChange={(e) => setOptions({ ...options, [opt.key]: e.target.checked })}
                    className="accent-accent-amber rounded" />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
        </div>

        <button onClick={handleExport} className="btn-primary mt-5">
          <Download size={16} /> Xuất file
        </button>
        {status && (
          <p className={`text-sm mt-3 ${status.includes('✅') ? 'text-accent-teal' : status.includes('❌') ? 'text-accent-rose' : 'text-text-muted'}`}>
            {status}
          </p>
        )}
      </div>

      <div className="card">
        <h3 className="font-display font-semibold text-text-primary text-sm mb-2">Lưu ý</h3>
        <p className="text-sm text-text-secondary">
          Tùy chọn <span className="text-accent-amber font-medium">DOCX</span> cần cài thêm dependency <code className="text-accent-amber bg-bg-elevated px-1.5 py-0.5 rounded">docx</code> nếu chưa có.
        </p>
      </div>
    </div>
  );
};

export default ExportPage;
