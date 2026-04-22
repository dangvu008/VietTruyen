import React from 'react';
import { ChevronRight } from 'lucide-react';
import type { AdaptationType } from '../../types/adaptation';

interface ImportPreviewPanelProps {
  sourceMode: 'project' | 'upload';
  sourceTitle: string;
  adaptType: string;
  currentMode: {
    id: AdaptationType;
    label: string;
    emoji: string;
    desc: string;
    hint: string;
    hex: string;
  };
  newTitle: string;
  newGenre: string;
  keepCharacters: 'all' | 'selected' | 'none';
  selectedCharCount: number;
  totalCharCount: number;
  keepWorld: boolean;
  keepOutline: boolean;
  divergeAt?: number;
  newPovCharName?: string;
  isSummary: boolean;
  uploadTextLength: number;
}

export default function ImportPreviewPanel({
  sourceMode,
  sourceTitle,
  adaptType,
  currentMode,
  newTitle,
  newGenre,
  keepCharacters,
  selectedCharCount,
  totalCharCount,
  keepWorld,
  keepOutline,
  divergeAt,
  newPovCharName,
  isSummary,
  uploadTextLength
}: ImportPreviewPanelProps) {
  return (
    <div className="bg-surface-container-lowest p-6 rounded-2xl border border-white/5 shadow-glass">
      <h3 className="font-display font-semibold text-on-surface text-sm mb-4 flex items-center gap-2">
        <ChevronRight size={16} className="text-primary" /> Tóm tắt phóng tác
      </h3>
      <div className="text-sm text-on-surface-variant leading-relaxed space-y-3 font-body">
        <p>
          <span className="opacity-50 inline-block w-6 text-center">📖</span> 
          <span className="text-outline uppercase tracking-widest text-[10px] font-bold mr-2">Gốc:</span> 
          <span className="text-on-surface font-medium">{sourceTitle}</span>
        </p>
        <p>
          <span className="opacity-50 inline-block w-6 text-center">{currentMode.emoji}</span> 
          <span className="text-outline uppercase tracking-widest text-[10px] font-bold mr-2">Chế độ:</span> 
          <span className="font-medium" style={{ color: currentMode.hex }}>{currentMode.label}</span>
        </p>
        <p>
          <span className="opacity-50 inline-block w-6 text-center">🎯</span> 
          <span className="text-outline uppercase tracking-widest text-[10px] font-bold mr-2">Tên mới:</span> 
          <span className="text-on-surface font-medium">{newTitle || '(chưa đặt)'}</span>
        </p>
        <p>
          <span className="opacity-50 inline-block w-6 text-center">🏷</span> 
          <span className="text-outline uppercase tracking-widest text-[10px] font-bold mr-2">Thể loại:</span> 
          {newGenre}
        </p>
        
        {sourceMode === 'project' && (
          <div className="pt-2 mt-2 border-t border-white/5 space-y-2">
            <p>
              <span className="opacity-50 inline-block w-6 text-center">👥</span> 
              <span className="text-outline uppercase tracking-widest text-[10px] font-bold mr-2">Nhân vật:</span> 
              {
              keepCharacters === 'all' ? `Tất cả (${totalCharCount})` :
              keepCharacters === 'selected' ? `${selectedCharCount} đã chọn` :
              'Không giữ'
            }</p>
            <p>
              <span className="opacity-50 inline-block w-6 text-center">🌍</span> 
              <span className="text-outline uppercase tracking-widest text-[10px] font-bold mr-2">Thế giới:</span> 
              {keepWorld ? 'Giữ' : 'Bỏ'}
            </p>
            <p>
              <span className="opacity-50 inline-block w-6 text-center">📋</span> 
              <span className="text-outline uppercase tracking-widest text-[10px] font-bold mr-2">Dàn ý:</span> 
              {keepOutline ? 'Giữ' : 'Bỏ'}
            </p>
            {adaptType === 'what-if' && (
              <p>
                <span className="opacity-50 inline-block w-6 text-center">✂️</span> 
                <span className="text-outline uppercase tracking-widest text-[10px] font-bold mr-2">Rẽ nhánh sau:</span> 
                Chương {divergeAt}
              </p>
            )}
            {adaptType === 'new-pov' && newPovCharName && (
              <p>
                <span className="opacity-50 inline-block w-6 text-center">👁️</span> 
                <span className="text-outline uppercase tracking-widest text-[10px] font-bold mr-2">Kể từ góc:</span> 
                {newPovCharName}
              </p>
            )}
          </div>
        )}
        {sourceMode === 'upload' && (
          <div className="pt-2 mt-2 border-t border-white/5 space-y-2">
            <p>
              <span className="opacity-50 inline-block w-6 text-center">📄</span> 
              <span className="text-outline uppercase tracking-widest text-[10px] font-bold mr-2">Nội dung tải lên:</span> 
              {isSummary ? 'Tóm tắt' : 'Văn bản đầy đủ'} ({uploadTextLength.toLocaleString()} ký tự)
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
