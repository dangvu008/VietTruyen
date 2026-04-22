/**
 * File: GenreLibraryPage.tsx
 * Purpose: Browsing and selecting predefined genre profiles for a project
 * Layer: UI Page
 * Domain: Foundation -> [Genre profiles, Constraints, Pacing rules]
 */

import React, { useMemo, useState } from 'react';
import { 
  BookMarked, 
  CheckCircle2, 
  Info, 
  ShieldAlert, 
  TrendingUp,
  Zap
} from 'lucide-react';
import PageHeader from '../layout/PageHeader';
import { useProjectStore, getActiveProject } from '../../store/use_project_store';
import { GENRE_PROFILES } from '../../data/genre_profiles';
import type { GenreProfile } from '../../types/genre_profile';
import { createEmptyStrandTracker } from '../../types/strand_weave';

const GenreLibraryPage: React.FC = () => {
  const store = useProjectStore();
  const project = getActiveProject(store);
  
  const [selectedGenreId, setSelectedGenreId] = useState<string | null>(null);

  const profiles = useMemo(() => Object.values(GENRE_PROFILES), []);

  if (!project) return null;

  const currentGenreId = project.genreProfileId;

  const handleApply = (profile: GenreProfile) => {
    store.updateProject(project.id, {
      genreProfileId: profile.id,
      genre: profile.name,
      // Khi apply genre profile, update strand tracker
      strandTracker: project.strandTracker || createEmptyStrandTracker()
    });
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: 1200 }}>
      <PageHeader
        title="📚 Thư viện Thể loại"
        subtitle="Chọn Profile cho dự án để AI hiểu rõ nhịp độ, sảng điểm và cấm kỵ của thể loại"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {profiles.map((profile) => {
          const isCurrent = currentGenreId === profile.id;
          const isSelected = selectedGenreId === profile.id;
          
          return (
            <div 
              key={profile.id}
              className={`group bg-[#0F1115]est p-8 rounded-2xl transition-all duration-300 relative overflow-hidden border ${
                isCurrent 
                  ? 'border-[#2DD4BF] shadow-xl translate-y-[-4px] bg-[#2DD4BF]/5' 
                  : isSelected 
                    ? 'border-[#F59E0B] shadow-lg bg-[#F59E0B]/5'
                    : 'border-transparent hover:shadow-xl hover:translate-y-[-4px] hover:border-surface-container-low'
              }`}
              onClick={() => setSelectedGenreId(profile.id)}
            >
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-2">
                  <h3 className="font-headline text-xl font-semibold mb-1 text-[#F8FAFC]">{profile.name}</h3>
                </div>
                {isCurrent && (
                  <span className="text-[10px] uppercase tracking-widest font-bold bg-[#2DD4BF] text-bg-deep px-2 py-1 rounded">Đang áp dụng</span>
                )}
              </div>

              <p className="font-body text-sm text-[#E2E8F0] mb-6 line-clamp-2">
                {profile.description}
              </p>

              <div className="flex flex-wrap gap-2 mb-6">
                {profile.tags.map(tag => (
                  <span key={tag} className="text-[11px] font-bold px-2 py-1 bg-[#0F1115] text-secondary rounded">
                    #{tag}
                  </span>
                ))}
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-[#050608] rounded-xl p-4 flex flex-col items-center justify-center text-center shadow-inner">
                  <Zap size={16} className="text-[#F59E0B] mb-2" />
                  <span className="text-[10px] text-[#94A3B8] uppercase tracking-widest font-semibold mb-1">Sảng điểm</span>
                  <span className="text-sm font-bold text-[#F8FAFC] capitalize">
                    {profile.coolPointConfig.densityPerChapter}
                  </span>
                </div>
                <div className="bg-[#050608] rounded-xl p-4 flex flex-col items-center justify-center text-center shadow-inner">
                  <TrendingUp size={16} className="text-[#2DD4BF] mb-2" />
                  <span className="text-[10px] text-[#94A3B8] uppercase tracking-widest font-semibold mb-1">Hook</span>
                  <span className="text-sm font-bold text-[#F8FAFC] capitalize">
                    {profile.hookConfig.strengthBaseline}
                  </span>
                </div>
              </div>

              {/* Extended Details (if selected) */}
              {isSelected && (
                <div className="mt-6 pt-6 border-t border-[#1E232B] space-y-6 animate-fade-in">
                  <div>
                    <h4 className="flex items-center gap-2 text-[11px] font-bold text-[#F8FAFC] mb-3 uppercase tracking-widest">
                      <Info size={14} className="text-accent-blue" />
                      Lưu ý cốt lõi
                    </h4>
                    <ul className="list-disc pl-5 space-y-2">
                      {profile.notes.map((note, idx) => (
                        <li key={idx} className="text-sm text-[#E2E8F0]">
                          {note}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="flex items-center gap-2 text-[11px] font-bold text-[#F8FAFC] mb-3 uppercase tracking-widest">
                      <ShieldAlert size={14} className="text-rose-400" />
                      Cấu trúc nhịp độ
                    </h4>
                    <div className="bg-[#050608] rounded-xl p-4 text-sm text-[#E2E8F0] space-y-2 shadow-inner border border-surface-container-low">
                      <div className="flex justify-between items-center">
                        <span className="text-xs uppercase tracking-wider font-semibold text-[#94A3B8]">Giới hạn Stagnation:</span>
                        <span className="font-mono text-[#F8FAFC] bg-[#0A0C10] px-2 py-1 rounded">{profile.pacingConfig.stagnationThreshold} chương</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs uppercase tracking-wider font-semibold text-[#94A3B8]">Khoảng cách Cao Trào:</span>
                        <span className="font-mono text-[#F8FAFC] bg-[#0A0C10] px-2 py-1 rounded">{profile.pacingConfig.strandFireGapMax} chương</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs uppercase tracking-wider font-semibold text-[#94A3B8]">Chương đệm liên tiếp:</span>
                        <span className="font-mono text-[#F8FAFC] bg-[#0A0C10] px-2 py-1 rounded">Tối đa {profile.pacingConfig.transitionMaxConsecutive}</span>
                      </div>
                    </div>
                  </div>

                  {!isCurrent && (
                    <button 
                      className="btn-primary w-full mt-6 py-3 rounded-xl font-bold shadow-lg shadow-accent-teal/20"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleApply(profile);
                      }}
                    >
                      <CheckCircle2 size={18} className="mr-2" /> Áp dụng Thể loại này
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GenreLibraryPage;
