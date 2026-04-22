import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  UploadCloud, 
  Activity, 
  Users, 
  Sparkles, 
  PenTool, 
  FileText,
  Type,
  ArrowRight,
  ShieldAlert,
  ChevronRight,
  CheckCircle2,
  Lock
} from 'lucide-react';
import {
  parseDocument,
  getAcceptString,
  preprocessTextForLlmInput,
  type LlmInputPreprocessStats,
} from '../../lib/document';
import {
  deleteProjectData,
  getEntityDefinitions,
  getProjectMemoryEmbeddings,
  getProjectNarrativeCommunities,
  getProjectNarrativeEdges,
  getProjectNarrativeNodes,
} from '../../db/narrative_db';
import { syncProjectMemoryBridge } from '../../lib/memory/memory_sync_bridge';
import {
  buildAdaptationPreviewProject,
  finalizeAdaptationPreviewProject,
} from '../../lib/adaptation/adaptation_preview_project';
import { useProjectStore } from '../../store/use_project_store';
import { useNotificationStore } from '../../store/use_notification_store';
import type { AdaptationConfig } from '../../types/adaptation';
import type { ProjectTabId } from '../../types/navigation';
import type { Project } from '../../types/story';
import { createUniqueProjectTitleSuggestion, findProjectByTitle } from '../../lib/project/project_title';

interface AdaptationPageProps {
  onComplete?: (projectId: string, destinationTab?: ProjectTabId) => void;
}

interface AnalysisStats {
  chapterCount: number;
  entityCount: number;
  graphNodeCount: number;
  graphEdgeCount: number;
  communityCount: number;
  embeddingCount: number;
}

const AdaptationPage: React.FC<AdaptationPageProps> = ({ onComplete }) => {
  const adaptProject = useProjectStore((state) => state.adaptProject);
  const promotePreviewProject = useProjectStore((state) => state.promotePreviewProject);
  const projects = useProjectStore((state) => state.projects);
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const updateProject = useProjectStore((state) => state.updateProject);
  const replaceProjectChapters = useProjectStore((state) => state.replaceProjectChapters);
  
  // States
  const [uploadText, setUploadText] = useState('');
  const [uploadTitle, setUploadTitle] = useState('');
  const [inputStats, setInputStats] = useState<LlmInputPreprocessStats | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [uploadError, setUploadError] = useState('');
  
  const [hasFile, setHasFile] = useState(false);
  const [isAiAnalyzed, setIsAiAnalyzed] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStats, setAnalysisStats] = useState<AnalysisStats | null>(null);
  const [analysisMessage, setAnalysisMessage] = useState('');
  const [analysisProgress, setAnalysisProgress] = useState<{ processed: number; total: number } | null>(null);
  
  const [prompt, setPrompt] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [duplicateResolution, setDuplicateResolution] = useState<'overwrite' | 'keep_both' | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewProjectRef = useRef<Project | null>(null);
  const promotedPreviewIdRef = useRef<string | null>(null);
  const analysisRunIdRef = useRef(0);
  const wordCount = useMemo(() => {
    const trimmedText = uploadText.trim();
    if (!trimmedText) return 0;
    return trimmedText.split(/\s+/).length;
  }, [uploadText]);
  const nextAdaptationTitle = useMemo(
    () => `${(uploadTitle || 'Bản thảo mới').trim() || 'Bản thảo mới'} — Phóng tác`,
    [uploadTitle]
  );
  const duplicateProject = useMemo(
    () => findProjectByTitle(projects, nextAdaptationTitle),
    [nextAdaptationTitle, projects]
  );
  const duplicateKeepBothTitle = useMemo(
    () => createUniqueProjectTitleSuggestion(projects, nextAdaptationTitle),
    [nextAdaptationTitle, projects]
  );
  const isOverwritingDuplicate = Boolean(duplicateProject && duplicateResolution === 'overwrite');
  const isKeepingBothDuplicate = Boolean(duplicateProject && duplicateResolution === 'keep_both');
  const resolvedAdaptationTitle = isKeepingBothDuplicate ? duplicateKeepBothTitle : nextAdaptationTitle;

  const clearPreviewProject = useCallback(async (projectId?: string) => {
    const targetProjectId = projectId ?? previewProjectRef.current?.id;
    if (!targetProjectId || promotedPreviewIdRef.current === targetProjectId) return;
    await deleteProjectData(targetProjectId);
    if (previewProjectRef.current?.id === targetProjectId) {
      previewProjectRef.current = null;
    }
  }, []);

  const resetUploadState = useCallback(() => {
    setHasFile(false);
    setUploadText('');
    setUploadTitle('');
    setInputStats(null);
    setIsAiAnalyzed(false);
    setIsAnalyzing(false);
    setAnalysisStats(null);
    setAnalysisMessage('');
    setAnalysisProgress(null);
    setUploadError('');
    setDuplicateResolution(null);
  }, []);

  useEffect(() => {
    return () => {
      void clearPreviewProject();
    };
  }, [clearPreviewProject]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const runId = analysisRunIdRef.current + 1;
    analysisRunIdRef.current = runId;
    setIsParsing(true);
    setUploadError('');
    setIsAiAnalyzed(false);
    setIsAnalyzing(false);
    setAnalysisStats(null);
    setAnalysisMessage('');
    setAnalysisProgress(null);
    setDuplicateResolution(null);

    await clearPreviewProject();

    try {
      const result = await parseDocument(file, { onProgress: () => {} });
      const preprocessed = preprocessTextForLlmInput(result.text);
      const cleanedText = preprocessed.cleanText || result.text;
      const resolvedTitle = result.title || file.name.replace(/\.[^.]+$/, '') || 'Bản thảo vô danh';
      const previewProject = buildAdaptationPreviewProject({
        title: resolvedTitle,
        text: cleanedText,
      });

      previewProjectRef.current = previewProject;
      setUploadText(cleanedText);
      setInputStats(preprocessed.stats);
      setUploadTitle(resolvedTitle);
      setHasFile(true);
      setIsAnalyzing(true);
      setAnalysisMessage('Đang dựng chapter memory và dependency graph từ bản thảo...');

      await syncProjectMemoryBridge(previewProject, {
        onProgress: (processed, total) => {
          if (analysisRunIdRef.current !== runId) return;
          setAnalysisProgress({ processed, total });
          setAnalysisMessage(`Đang index memory/graph ${processed}/${total} chương...`);
        },
      });

      if (analysisRunIdRef.current !== runId) {
        await clearPreviewProject(previewProject.id);
        return;
      }

      const [definitions, nodes, edges, communities, embeddings] = await Promise.all([
        getEntityDefinitions(previewProject.id),
        getProjectNarrativeNodes(previewProject.id),
        getProjectNarrativeEdges(previewProject.id),
        getProjectNarrativeCommunities(previewProject.id),
        getProjectMemoryEmbeddings(previewProject.id),
      ]);

      setAnalysisStats({
        chapterCount: previewProject.chapters.length,
        entityCount: definitions.length,
        graphNodeCount: nodes.length,
        graphEdgeCount: edges.length,
        communityCount: communities.length,
        embeddingCount: embeddings.length,
      });
      setAnalysisMessage('Memory và graph đã sẵn sàng cho bước phân tích/phóng tác tiếp theo.');
      setIsAiAnalyzed(true);

    } catch (err: unknown) {
      const previewId = previewProjectRef.current?.id;
      if (previewId) {
        await clearPreviewProject(previewId);
      }
      const message = err instanceof Error ? err.message : 'Lỗi không xác định';
      setUploadError(message);
      setHasFile(false);
    } finally {
      if (analysisRunIdRef.current === runId) {
        setIsParsing(false);
        setIsAnalyzing(false);
      }
    }
  };

  const handleStartAdaptation = async () => {
    if (!uploadText.trim()) return;
    
    setIsImporting(true);
    try {
      // In a real flow, this redirects to the Import Success Screen where we see chapters and deep analysis.
      // We will signal the parent to navigate to our new Import Success view or we handle it locally.
      // For now, we simulate this by calling a custom action or navigating to the mock screen.
      
      // Let's assume we create the project first
      const config: AdaptationConfig = {
        uploadedSource: {
          title: uploadTitle.trim() || 'Bản thảo vô danh',
          text: uploadText.trim(),
          isSummary: false,
        },
        adaptationType: 'reskin', // default
        newTitle: resolvedAdaptationTitle,
        newGenre: 'Kỳ ảo',
        newStyleId: 'tien-hiep',
        keepCharacters: 'none',
        selectedCharacterIds: [],
        keepWorld: false,
        keepOutline: false,
        keepForeshadowings: false,
        userNotes: prompt,
      };

      if (duplicateProject && !duplicateResolution) {
        setUploadError('Tác phẩm phóng tác này đã tồn tại. Hãy chọn ghi đè hoặc giữ cả 2 trước khi tiếp tục.');
        return;
      }

      if (previewProjectRef.current && isAiAnalyzed) {
        const finalizedPreview = finalizeAdaptationPreviewProject(previewProjectRef.current, config);

        if (duplicateProject && duplicateResolution === 'overwrite') {
          updateProject(duplicateProject.id, {
            title: finalizedPreview.title,
            logline: finalizedPreview.logline,
            genre: finalizedPreview.genre,
            subGenre: finalizedPreview.subGenre,
            writingStyle: finalizedPreview.writingStyle,
            tone: finalizedPreview.tone,
            styleId: finalizedPreview.styleId,
            targetChapters: finalizedPreview.targetChapters,
            endgame: finalizedPreview.endgame,
            mainCharacterCount: finalizedPreview.mainCharacterCount,
            supportCharacterCount: finalizedPreview.supportCharacterCount,
            characterSetup: finalizedPreview.characterSetup,
            worldSetting: finalizedPreview.worldSetting,
            mainPlot: finalizedPreview.mainPlot,
            world: finalizedPreview.world,
            characters: finalizedPreview.characters,
            outline: finalizedPreview.outline,
            foreshadowings: finalizedPreview.foreshadowings,
            notes: finalizedPreview.notes,
            canonVersion: finalizedPreview.canonVersion,
            storageMode: finalizedPreview.storageMode,
            arcCount: finalizedPreview.arcCount,
            hasGlobalIndex: finalizedPreview.hasGlobalIndex,
            sourceProjectId: finalizedPreview.sourceProjectId,
            adaptationType: finalizedPreview.adaptationType,
          });
          await replaceProjectChapters(duplicateProject.id, finalizedPreview.chapters, {
            storageMode: finalizedPreview.storageMode,
          });
          useNotificationStore.getState().push({
            type: 'success',
            title: 'Đã ghi đè tác phẩm',
            message: 'Bản thảo mới đã được cập nhật vào tác phẩm hiện có.',
          });
          onComplete?.(duplicateProject.id, 'chapters');
          return;
        }

        promotedPreviewIdRef.current = finalizedPreview.id;
        const promotedProject = await promotePreviewProject(finalizedPreview);
        previewProjectRef.current = promotedProject;
        onComplete?.(promotedProject.id, 'chapters');
        return;
      }

      const createdProject = await adaptProject(config);
      
      if (createdProject) {
        onComplete?.(createdProject.id, 'chapters');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsImporting(false);
    }
  };

  const addTag = (tag: string) => {
    setPrompt(prev => prev ? `${prev}, ${tag}` : tag);
  };

  return (
    <div className="animate-fade-in w-full max-w-7xl mx-auto px-4 pb-32">
      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
         <div className="absolute top-[-10%] right-[-5%] w-[40vw] h-[40vw] bg-accent-amber/5 blur-[120px] rounded-full mix-blend-screen pointer-events-none" />
      </div>

      <header className="mb-12 mt-8 text-center">
        <h1 className="font-headline text-5xl font-light text-primary mb-3 tracking-tight">Phóng Tác Truyện</h1>
        <p className="text-[#94A3B8] font-body text-sm tracking-wide uppercase opacity-70">
          Hãy biến bản thảo thô của bạn thành một tác phẩm nghệ thuật với sự hỗ trợ từ AI.
        </p>
      </header>

      {/* THREE COLUMN LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10">
        
        {/* === COLUMN 1: UPLOAD === */}
        <div className="bg-[#0F1115] border border-white/5 rounded-[24px] p-6 shadow-ambient flex flex-col relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
             <span className="font-headline text-8xl font-bold text-white">01</span>
          </div>
          
          <h2 className="text-sm font-bold text-[#F8FAFC] uppercase tracking-widest mb-6 flex items-center gap-2">
            <UploadCloud size={16} className="text-accent-amber" /> Tải lên bản thảo
          </h2>

          <div 
            className="flex-1 border-2 border-dashed border-[#1E232B] rounded-2xl flex flex-col items-center justify-center p-8 bg-[#0a0c10]/50 hover:bg-[#1E232B] transition-colors cursor-pointer group/drop"
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              className="hidden" 
              accept={getAcceptString()} 
              ref={fileInputRef}
              onChange={handleFileUpload}
            />
            
            {isParsing ? (
              <div className="text-center flex flex-col items-center justify-center animate-in fade-in duration-300">
                <div className="relative w-16 h-16 mb-4 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-2 border-[#1E232B]"></div>
                  <div className="absolute inset-0 rounded-full border-2 border-accent-amber border-t-transparent animate-spin"></div>
                  <UploadCloud size={24} className="text-accent-amber animate-bounce" />
                </div>
                <p className="text-sm text-[#F8FAFC] font-semibold mb-1">Đang đọc tài liệu...</p>
                <p className="text-xs text-[#94A3B8] animate-pulse">Vui lòng chờ trong giây lát</p>
              </div>
            ) : hasFile ? (
               <div className="text-center animate-in fade-in zoom-in duration-500">
                 <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4 relative overflow-hidden">
                    <div className="absolute inset-0 bg-emerald-500/20 animate-ping opacity-20"></div>
                    <CheckCircle2 size={32} className="text-emerald-500" />
                 </div>
                <p className="text-sm text-[#F8FAFC] font-semibold mb-1 truncate px-4">{uploadTitle || 'Tài liệu đã được tải lên'}</p>
                 {inputStats ? (
                   <div className="mt-2 text-[11px] leading-relaxed text-[#94A3B8]">
                     <p>
                       {inputStats.cleanChars.toLocaleString()} ký tự • ~
                       {inputStats.cleanTokens.toLocaleString()} token
                     </p>
                   </div>
                 ) : (
                   <p className="text-xs text-[#94A3B8]">
                     {uploadText.length.toLocaleString()} ký tự
                   </p>
                 )}
                 <button className="mt-4 text-xs font-semibold uppercase tracking-wider text-accent-amber hover:text-white transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    analysisRunIdRef.current += 1;
                    void clearPreviewProject();
                    resetUploadState();
                  }}
                 >
                   Chọn tệp khác
                 </button>
               </div>
            ) : (
              <div className="text-center">
                <UploadCloud size={48} className="text-[#1E232B] group-hover/drop:text-accent-amber transition-colors mx-auto mb-4" />
                <p className="text-[#F8FAFC] font-medium text-sm mb-1">Kéo thả tệp vào đây</p>
                <p className="text-xs text-[#94A3B8] mb-4">Hoặc tải lên từ máy tính (TXT, PDF, DOCX, EPUB)</p>
                <span className="px-4 py-2 bg-[#1E232B] rounded-lg text-xs font-semibold text-white uppercase tracking-wider">
                  Chọn tệp từ máy
                </span>
              </div>
            )}
            
            {uploadError && <p className="text-xs text-status-error mt-4 text-center">{uploadError}</p>}
            {duplicateProject && hasFile && (
              <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-left">
                <p className="text-sm font-semibold text-[#F8FAFC]">Đã có tác phẩm trùng tên</p>
                <p className="mt-1 text-xs leading-5 text-[#CBD5E1]">
                  <strong>{duplicateProject.title}</strong>
                  {' '}đã tồn tại trong thư viện. Hãy xác nhận ngay tại đây: ghi đè tác phẩm cũ hoặc giữ lại cả hai bản.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={`rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                      isOverwritingDuplicate
                        ? 'bg-accent-amber text-[#1E232B]'
                        : 'border border-accent-amber/40 text-accent-amber hover:bg-accent-amber/10'
                    }`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setDuplicateResolution('overwrite');
                      setUploadError('');
                    }}
                  >
                    {duplicateProject.id === activeProjectId ? 'Xác nhận ghi đè bản đang mở' : 'Xác nhận ghi đè'}
                  </button>
                  <button
                    type="button"
                    className={`rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                      isKeepingBothDuplicate
                        ? 'bg-accent-amber text-[#1E232B]'
                        : 'border border-accent-amber/40 text-accent-amber hover:bg-accent-amber/10'
                    }`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setDuplicateResolution('keep_both');
                      setUploadError('');
                    }}
                  >
                    Giữ cả 2
                  </button>
                </div>
                {isOverwritingDuplicate && (
                  <p className="mt-2 text-xs text-accent-amber">
                    Lần import này sẽ ghi đè metadata và danh sách chương của tác phẩm đang có.
                  </p>
                )}
                {isKeepingBothDuplicate && (
                  <p className="mt-2 text-xs text-accent-amber">
                    Bản mới sẽ được lưu thành <strong>{resolvedAdaptationTitle}</strong>.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* === COLUMN 2: AI ANALYSIS === */}
        <div className={`bg-[#0F1115] border border-white/5 rounded-[24px] p-6 shadow-ambient flex flex-col relative overflow-hidden transition-all duration-500 ${!hasFile ? 'opacity-50 grayscale pointer-events-none' : ''}`}>
           <div className="absolute top-0 right-0 p-4 opacity-10">
             <span className="font-headline text-8xl font-bold text-white">02</span>
          </div>

          <h2 className="text-sm font-bold text-[#F8FAFC] uppercase tracking-widest mb-6 flex items-center gap-2 relative z-10">
            <Activity size={16} className="text-accent-teal" /> Phân tích AI
          </h2>

          {isAnalyzing ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-4">
              <div className="w-8 h-8 border-2 border-accent-teal/30 border-t-accent-teal rounded-full animate-spin"></div>
              <p className="text-xs text-[#94A3B8] font-medium uppercase tracking-widest animate-pulse">
                {analysisProgress
                  ? `Đang index memory ${analysisProgress.processed}/${analysisProgress.total}`
                  : 'Đang dựng memory và graph...'}
              </p>
              {analysisMessage && (
                <p className="max-w-xs text-center text-xs text-[#64748B]">{analysisMessage}</p>
              )}
            </div>
          ) : !isAiAnalyzed ? (
             <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
               <ShieldAlert size={32} className="text-[#1E232B] mb-2" />
               <p className="text-sm text-[#94A3B8]">Tải tài liệu lên để AI có thể phân tích tổng quan nội dung của bạn.</p>
             </div>
          ) : (
            <div className="flex-1 flex flex-col gap-4 relative z-10">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#0A0C10] p-4 rounded-2xl border border-white/5">
                  <p className="text-[10px] text-[#94A3B8] uppercase font-bold tracking-widest mb-1 flex items-center gap-1"><FileText size={12}/> Số chữ</p>
                  <p className="text-2xl font-display text-white">{wordCount.toLocaleString()}</p>
                </div>
                <div className="bg-[#0A0C10] p-4 rounded-2xl border border-white/5 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-accent-purple/10 to-transparent"></div>
                  <p className="text-[10px] text-[#94A3B8] uppercase font-bold tracking-widest mb-1 flex items-center gap-1 relative z-10"><Sparkles size={12}/> Chapters</p>
                  <p className="text-base font-bold text-white relative z-10 line-clamp-1">{analysisStats?.chapterCount || 0} chương đã tách</p>
                </div>
                <div className="bg-[#0A0C10] p-4 rounded-2xl border border-white/5 col-span-2">
                  <p className="text-[10px] text-[#94A3B8] uppercase font-bold tracking-widest mb-1 flex items-center gap-1"><Users size={12}/> Memory + Graph</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="flex-1 text-sm font-semibold text-white">
                      {analysisStats?.entityCount || 0} entity defs • {analysisStats?.embeddingCount || 0} embedding chunks
                    </span>
                    <span className="text-xs font-medium text-accent-teal bg-accent-teal/10 px-2 py-0.5 rounded-full">Tốt</span>
                  </div>
                </div>
              </div>

              <div className="mt-2 bg-gradient-to-b from-[#1E232B]/50 to-transparent p-4 rounded-2xl border border-white/5 flex-1">
                <p className="text-[10px] text-[#94A3B8] uppercase font-bold tracking-widest mb-3">Memory Insights</p>
                
                <div className="space-y-3">
                  <div className="flex gap-2 items-start">
                     <span className="w-1.5 h-1.5 rounded-full bg-accent-amber mt-1.5 shrink-0"></span>
                     <p className="text-xs text-[#E2E8F0] leading-relaxed">
                       <strong className="text-white">Index coverage:</strong> {analysisStats?.chapterCount || 0} chương đã được nạp vào memory để phục vụ truy vấn và phân tích các lượt sau.
                     </p>
                  </div>
                  <div className="flex gap-2 items-start">
                     <span className="w-1.5 h-1.5 rounded-full bg-accent-teal mt-1.5 shrink-0"></span>
                     <p className="text-xs text-[#E2E8F0] leading-relaxed">
                       <strong className="text-white">Graph status:</strong> {analysisStats?.graphNodeCount || 0} nodes • {analysisStats?.graphEdgeCount || 0} edges • {analysisStats?.communityCount || 0} communities.
                     </p>
                  </div>
                  {analysisMessage && (
                    <div className="flex gap-2 items-start">
                      <span className="w-1.5 h-1.5 rounded-full bg-white/60 mt-1.5 shrink-0"></span>
                      <p className="text-xs text-[#E2E8F0] leading-relaxed">
                        <strong className="text-white">Ready:</strong> {analysisMessage}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* === COLUMN 3: DEEP ADAPTATION === */}
        <div className={`bg-[#0F1115] border border-white/5 rounded-[24px] p-6 shadow-ambient flex flex-col relative overflow-hidden transition-all duration-500 delay-100 ${!isAiAnalyzed ? 'opacity-50 grayscale pointer-events-none' : ''}`}>
           <div className="absolute top-0 right-0 p-4 opacity-5">
             <span className="font-headline text-8xl font-bold text-white">03</span>
          </div>

          <h2 className="text-sm font-bold text-[#F8FAFC] uppercase tracking-widest mb-6 flex items-center gap-2 relative z-10">
            <PenTool size={16} className="text-accent-amber" /> Phóng tác chuyên sâu
          </h2>

          <div className="flex-1 flex flex-col relative z-10">
             <label className="text-[11px] text-[#94A3B8] font-bold uppercase mb-2 block">Yêu cầu phóng tác</label>
             <textarea 
               rows={4}
               className="w-full bg-[#0A0C10] border border-[#1E232B] rounded-2xl p-4 text-sm text-white placeholder-[#94A3B8]/50 focus:outline-none focus:border-accent-amber/50 transition-colors resize-none mb-3"
               placeholder="Ví dụ: Làm cho câu chuyện kịch tính hơn, chuyển bối cảnh sang tương lai cyberpunk..."
               value={prompt}
               onChange={(e) => setPrompt(e.target.value)}
             />

             <div className="flex flex-wrap gap-2 mb-8">
               <button onClick={() => addTag('Tối giản lời thoại')} className="px-3 py-1.5 bg-[#1E232B] hover:bg-[#2A313C] rounded-lg text-[11px] font-semibold text-[#E2E8F0] transition-colors">Tối giản lời thoại</button>
               <button onClick={() => addTag('Thêm yếu tố kỳ ảo')} className="px-3 py-1.5 bg-[#1E232B] hover:bg-[#2A313C] rounded-lg text-[11px] font-semibold text-[#E2E8F0] transition-colors">Thêm yếu tố kỳ ảo</button>
               <button onClick={() => addTag('Chuyển sang ngôi thứ nhất')} className="px-3 py-1.5 bg-[#1E232B] hover:bg-[#2A313C] rounded-lg text-[11px] font-semibold text-[#E2E8F0] transition-colors">Chuyển sang ngôi 1</button>
               <button className="px-3 py-1.5 border border-dashed border-[#1E232B] hover:border-white/20 rounded-lg text-[11px] font-semibold text-[#94A3B8] hover:text-white transition-colors">+ Thêm tag</button>
             </div>

             <div className="mt-auto">
                <button 
                  onClick={handleStartAdaptation}
                  disabled={isImporting || isAnalyzing || !isAiAnalyzed || Boolean(duplicateProject && !duplicateResolution)}
                  className="w-full py-4 bg-gradient-to-r from-accent-amber to-amber-600 rounded-2xl font-bold text-white uppercase tracking-widest text-sm shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:shadow-[0_0_30px_rgba(245,158,11,0.5)] transition-all flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
                >
                  {isImporting
                    ? <Loader className="animate-spin" />
                    : isOverwritingDuplicate
                      ? 'Ghi đè tác phẩm'
                      : isKeepingBothDuplicate
                        ? 'Tạo thêm bản mới'
                        : 'Bắt đầu phóng tác'}
                  {!isImporting && <ArrowRight size={18} />}
                </button>
                <p className="text-center text-[10px] text-[#94A3B8] mt-3 uppercase tracking-wider flex items-center justify-center gap-1"><Lock size={10} /> Quá trình hoàn toàn bảo mật</p>
             </div>
          </div>
        </div>

      </div>

      {/* Decorative Bottom Area */}
      <div className="mt-20 flex flex-col items-center justify-center text-center relative max-w-2xl mx-auto opacity-40 hover:opacity-80 transition-opacity">
         <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-[#1E232B] to-transparent mb-8"></div>
         <Type size={32} className="text-[#94A3B8] mb-4" />
         <p className="font-display italic text-lg text-[#94A3B8] leading-relaxed">
           "Ngòi bút của bạn là khởi nguồn. AI chỉ là cơn gió thổi bùng lên ngọn lửa sáng tạo ẩn sâu trong đó."
         </p>
      </div>

    </div>
  );
};

// Simple loader
const Loader = ({ className }: { className?: string }) => (
  <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
  </svg>
)

export default AdaptationPage;
