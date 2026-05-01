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
  CheckCircle2,
  Lock,
  GitCompare,
  Layers3,
  BookOpenCheck,
  SlidersHorizontal,
  RefreshCw,
  Copy,
  Puzzle,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { extractTemplateFromText } from '../../lib/ai/template_extractor';
import type { ExtractionProgress } from '../../lib/ai/template_extractor';
import type { StoryTemplate } from '../../types/story_template';
import { useCustomTemplateStore } from '../../store/use_custom_template_store';
import {
  getAcceptString,
  type LlmInputPreprocessStats,
} from '../../lib/document';
import {
  deleteProjectData,
} from '../../db/narrative_db';
import {
  finalizeAdaptationPreviewProject,
} from '../../lib/adaptation/adaptation_preview_project';
import {
  analyzeAdaptationPreviewProject,
  buildAdaptationConfigFromDraft,
  type AdaptationAnalysisStats,
  prepareAdaptationSourceDraft,
} from '../../lib/adaptation/adaptation_import_pipeline';
import { useProjectStore } from '../../store/use_project_store';
import { useNotificationStore } from '../../store/use_notification_store';
import { useAiStore } from '../../store/use_ai_store';
import type { AdaptationConfig } from '../../types/adaptation';
import type { ProjectTabId } from '../../types/navigation';
import type { Project } from '../../types/story';
import { createUniqueProjectTitleSuggestion, findProjectByTitle } from '../../lib/project/project_title';
import { getModelForTask } from '../../lib/ai/model_router';
import { callAiModelTracked } from '../../lib/ai/tracked_ai_client';
import {
  buildNovelPolishInstruction,
  getNovelPolishMode,
  type NovelPolishModeId,
} from '../../lib/ai/novel_polish';
import { NovelPolishTool } from '../story-editor/NovelPolishTool';
import { AiConnectionDebugPanel } from '../shared/AiConnectionDebugPanel';

interface AdaptationPageProps {
  onComplete?: (projectId: string, destinationTab?: ProjectTabId) => void;
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
  const [analysisStats, setAnalysisStats] = useState<AdaptationAnalysisStats | null>(null);
  const [analysisMessage, setAnalysisMessage] = useState('');
  const [analysisProgress, setAnalysisProgress] = useState<{ processed: number; total: number } | null>(null);

  // Template extraction state
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState<ExtractionProgress | null>(null);
  const [extractedTemplate, setExtractedTemplate] = useState<StoryTemplate | null>(null);

  const [prompt, setPrompt] = useState('');
  const [isPolishing, setIsPolishing] = useState(false);
  const [polishError, setPolishError] = useState('');
  const [polishResult, setPolishResult] = useState('');
  const [polishModeId, setPolishModeId] = useState<NovelPolishModeId | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [duplicateResolution, setDuplicateResolution] = useState<'overwrite' | 'keep_both' | null>(null);
  const [sourceRole, setSourceRole] = useState<'main_draft' | 'reference'>('main_draft');
  const [rewriteStrength, setRewriteStrength] = useState<'light' | 'balanced' | 'bold'>('balanced');
  const [startPoint, setStartPoint] = useState<'chapter_1' | 'continue_after_import'>('chapter_1');

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
  const { models, activeModelId, taskModelOverrides } = useAiStore((state) => ({
    models: state.models,
    activeModelId: state.activeModelId,
    taskModelOverrides: state.taskModelOverrides,
  }));
  const polishModel = useMemo(
    () => getModelForTask('polish_style', models, undefined, activeModelId, taskModelOverrides),
    [models, activeModelId, taskModelOverrides]
  );
  const adaptationPolishSource = useMemo(() => {
    const trimmed = uploadText.trim();
    if (!trimmed) return '';
    if (trimmed.length <= 3200) return trimmed;
    return `${trimmed.slice(0, 3200).trim()}\n\n...[Đã cắt bớt từ bản nhập để chạy polish nhanh]`;
  }, [uploadText]);

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
    setSourceRole('main_draft');
    setRewriteStrength('balanced');
    setStartPoint('chapter_1');
    setPolishError('');
    setPolishResult('');
    setPolishModeId(null);
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
      const draft = await prepareAdaptationSourceDraft(file, {
        onParseProgress: (message) => {
          if (analysisRunIdRef.current !== runId) return;
          setAnalysisMessage(message);
        },
      });

      if (analysisRunIdRef.current !== runId) {
        await clearPreviewProject(draft.previewProject.id);
        return;
      }

      previewProjectRef.current = draft.previewProject;
      setUploadText(draft.text);
      setInputStats(draft.inputStats);
      setUploadTitle(draft.title);
      setHasFile(true);
      setIsAnalyzing(true);
      setAnalysisMessage('Đang dựng chapter memory và dependency graph từ bản thảo...');

      const analysisResult = await analyzeAdaptationPreviewProject(draft.previewProject, {
        onProgress: (processed, total) => {
          if (analysisRunIdRef.current !== runId) return;
          setAnalysisProgress({ processed, total });
          setAnalysisMessage(`Đang index memory/graph ${processed}/${total} chương...`);
        },
      });

      if (analysisRunIdRef.current !== runId) {
        await clearPreviewProject(draft.previewProject.id);
        return;
      }

      setAnalysisStats(analysisResult.stats);
      setAnalysisMessage(analysisResult.readyMessage);
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
      const config: AdaptationConfig = buildAdaptationConfigFromDraft({
        sourceTitle: uploadTitle,
        sourceText: uploadText,
        newTitle: resolvedAdaptationTitle,
        prompt,
        sourceRole,
        rewriteStrength,
        startPoint,
      });

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

  const handleExtractTemplate = async () => {
    if (!uploadText.trim() || !isAiAnalyzed) return;
    setIsExtracting(true);
    setExtractedTemplate(null);
    setExtractionProgress(null);
    try {
      const template = await extractTemplateFromText(
        uploadText,
        uploadTitle || 'Bản thảo',
        (progress) => setExtractionProgress(progress),
      );
      setExtractedTemplate(template);
      // [Domain:StoryTemplate] Persist vào store để dùng lại sau khi chuyển trang
      useCustomTemplateStore.getState().addTemplate(template);
      useNotificationStore.getState().push({
        type: 'success',
        title: '🧩 Template đã trích xuất!',
        message: `"${template.name}" sẵn sàng dùng cho truyện mới.`,
      });
    } catch (err) {
      useNotificationStore.getState().push({
        type: 'error',
        title: 'Trích xuất thất bại',
        message: err instanceof Error ? err.message : 'Lỗi không xác định',
      });
    } finally {
      setIsExtracting(false);
    }
  };

  const handleRunNovelPolish = async ({
    mode,
    rawText,
  }: {
    mode: NovelPolishModeId;
    rawText: string;
  }) => {
    if (!polishModel) {
      setPolishError('Chưa có model AI khả dụng cho công cụ trau chuốt. Vào Cài đặt AI để cấu hình.');
      return;
    }

    setIsPolishing(true);
    setPolishError('');
    setPolishModeId(mode);

    try {
      const response = await callAiModelTracked({
        provider: polishModel.provider,
        modelId: polishModel.modelId,
        modelName: polishModel.name || polishModel.modelId,
        baseUrl: polishModel.baseUrl,
        systemPrompt: 'Bạn là biên tập viên văn xuôi chuyên sửa bản thảo tiểu thuyết bằng tiếng Việt.',
        userPrompt: buildNovelPolishInstruction({ mode, rawText }),
        taskType: 'polish_style',
      });

      setPolishResult(response.trim());
    } catch (error) {
      setPolishResult('');
      setPolishError(error instanceof Error ? error.message : 'Trau chuốt bản thảo thất bại.');
    } finally {
      setIsPolishing(false);
    }
  };

  const addTag = (tag: string) => {
    setPrompt((prev) => {
      if (prev.includes(tag)) return prev;
      return prev ? `${prev}, ${tag}` : tag;
    });
  };

  const promptIncludes = (tag: string) => prompt.includes(tag);

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
                {inputStats ? (
                  <div className="bg-[#0A0C10] p-4 rounded-2xl border border-white/5 col-span-2">
                    <p className="text-[10px] text-[#94A3B8] uppercase font-bold tracking-widest mb-1 flex items-center gap-1">
                      <Type size={12} /> Input Hygiene
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-2 text-sm font-semibold text-white">
                      <span>Giảm {inputStats.reductionPercent}% nhiễu token</span>
                      <span className="text-[#64748B]">•</span>
                      <span>Tiết kiệm ~{inputStats.reducedTokens.toLocaleString()} token</span>
                    </div>
                    <p className="mt-2 text-[11px] leading-5 text-[#94A3B8]">
                      Raw {inputStats.rawChars.toLocaleString()} ký tự {'->'} clean {inputStats.cleanChars.toLocaleString()} ký tự trước khi dựng memory.
                    </p>
                  </div>
                ) : null}
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
            <PenTool size={16} className="text-accent-amber" /> Hồ sơ phóng tác
          </h2>

          <div className="flex-1 flex flex-col relative z-10">
             <div className="mb-4 rounded-2xl border border-accent-teal/20 bg-accent-teal/10 p-4">
               <div className="mb-3 flex items-center gap-2">
                 <BookOpenCheck size={15} className="text-accent-teal" />
                 <p className="text-[11px] font-bold uppercase tracking-widest text-accent-teal">Sẵn sàng lập hồ sơ</p>
               </div>
               <div className="grid grid-cols-2 gap-2 text-xs">
                 <div className="rounded-xl border border-white/5 bg-[#0A0C10]/70 p-3">
                   <p className="text-[#94A3B8]">Canon</p>
                   <p className="mt-1 font-semibold text-white">{analysisStats?.chapterCount || 0} chương</p>
                 </div>
                 <div className="rounded-xl border border-white/5 bg-[#0A0C10]/70 p-3">
                   <p className="text-[#94A3B8]">Memory</p>
                   <p className="mt-1 font-semibold text-white">{analysisStats?.embeddingCount || 0} chunks</p>
                 </div>
               </div>
             </div>

             <label className="mb-2 block text-[11px] font-bold uppercase text-[#94A3B8]">File này dùng làm gì?</label>
             <div className="mb-4 grid grid-cols-2 gap-2">
               <button
                 type="button"
                 onClick={() => setSourceRole('main_draft')}
                 className={`rounded-xl border p-3 text-left text-xs transition-colors ${
                   sourceRole === 'main_draft'
                     ? 'border-accent-amber/60 bg-accent-amber/15 text-white'
                     : 'border-white/5 bg-[#0A0C10] text-[#CBD5E1] hover:border-white/20'
                 }`}
               >
                 <Layers3 size={14} className="mb-2 text-accent-amber" />
                 <span className="font-bold">Bản chính</span>
                 <span className="mt-1 block leading-4 text-[#94A3B8]">Tạo project phóng tác từ file này.</span>
               </button>
               <button
                 type="button"
                 onClick={() => setSourceRole('reference')}
                 className={`rounded-xl border p-3 text-left text-xs transition-colors ${
                   sourceRole === 'reference'
                     ? 'border-accent-amber/60 bg-accent-amber/15 text-white'
                     : 'border-white/5 bg-[#0A0C10] text-[#CBD5E1] hover:border-white/20'
                 }`}
               >
                 <GitCompare size={14} className="mb-2 text-accent-amber" />
                 <span className="font-bold">Tham chiếu</span>
                 <span className="mt-1 block leading-4 text-[#94A3B8]">Học canon, giọng văn, tuyến truyện.</span>
               </button>
             </div>

             <label className="mb-2 block text-[11px] font-bold uppercase text-[#94A3B8]">Mức sáng tạo</label>
             <div className="mb-4 grid grid-cols-3 gap-2">
               {[
                 { id: 'light', label: 'Nhẹ', desc: 'Giữ sát' },
                 { id: 'balanced', label: 'Vừa', desc: 'Khuyến nghị' },
                 { id: 'bold', label: 'Mạnh', desc: 'Rẽ nhánh' },
               ].map((option) => (
                 <button
                   key={option.id}
                   type="button"
                   onClick={() => setRewriteStrength(option.id as typeof rewriteStrength)}
                   className={`rounded-xl border px-3 py-2 text-center transition-colors ${
                     rewriteStrength === option.id
                       ? 'border-accent-amber/60 bg-accent-amber/15'
                       : 'border-white/5 bg-[#0A0C10] hover:border-white/20'
                   }`}
                 >
                   <span className="block text-xs font-bold text-white">{option.label}</span>
                   <span className="mt-0.5 block text-[10px] text-[#94A3B8]">{option.desc}</span>
                 </button>
               ))}
             </div>

             <label className="mb-2 block text-[11px] font-bold uppercase text-[#94A3B8]">Điểm bắt đầu</label>
             <div className="mb-4 grid grid-cols-2 gap-2">
               <button
                 type="button"
                 onClick={() => setStartPoint('chapter_1')}
                 className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                   startPoint === 'chapter_1'
                     ? 'border-accent-teal/60 bg-accent-teal/10 text-white'
                     : 'border-white/5 bg-[#0A0C10] text-[#CBD5E1] hover:border-white/20'
                 }`}
               >
                 Tạo lại từ chương 1
               </button>
               <button
                 type="button"
                 onClick={() => setStartPoint('continue_after_import')}
                 className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                   startPoint === 'continue_after_import'
                     ? 'border-accent-teal/60 bg-accent-teal/10 text-white'
                     : 'border-white/5 bg-[#0A0C10] text-[#CBD5E1] hover:border-white/20'
                 }`}
               >
                 Viết tiếp sau bản nhập
               </button>
             </div>

             {duplicateProject && (
               <div className="mb-4 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4">
                 <div className="mb-2 flex items-center gap-2">
                   <ShieldAlert size={14} className="text-accent-amber" />
                   <p className="text-xs font-bold text-white">Trùng với tác phẩm đã có</p>
                 </div>
                 <p className="text-[11px] leading-5 text-[#CBD5E1]">
                   Chọn cách xử lý trước khi tạo hồ sơ để tránh ghi đè nhầm bản quan trọng.
                 </p>
                 <div className="mt-3 grid grid-cols-2 gap-2">
                   <button
                     type="button"
                     onClick={() => {
                       setDuplicateResolution('overwrite');
                       setUploadError('');
                     }}
                     className={`rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                       isOverwritingDuplicate
                         ? 'bg-accent-amber text-[#1E232B]'
                         : 'border border-accent-amber/40 text-accent-amber hover:bg-accent-amber/10'
                     }`}
                   >
                     <RefreshCw size={13} className="mr-1 inline" /> Ghi đè
                   </button>
                   <button
                     type="button"
                     onClick={() => {
                       setDuplicateResolution('keep_both');
                       setUploadError('');
                     }}
                     className={`rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                       isKeepingBothDuplicate
                         ? 'bg-accent-amber text-[#1E232B]'
                         : 'border border-accent-amber/40 text-accent-amber hover:bg-accent-amber/10'
                     }`}
                   >
                     <Copy size={13} className="mr-1 inline" /> Giữ cả 2
                   </button>
                 </div>
               </div>
             )}

             <label className="text-[11px] text-[#94A3B8] font-bold uppercase mb-2 block">Yêu cầu phóng tác</label>
             <textarea 
               rows={4}
               className="w-full bg-[#0A0C10] border border-[#1E232B] rounded-2xl p-4 text-sm text-white placeholder-[#94A3B8]/50 focus:outline-none focus:border-accent-amber/50 transition-colors resize-none mb-3"
               placeholder="Ví dụ: Giữ hệ thống tu luyện, giảm thoại giải thích, tăng nhịp cao trào và đổi sang ngôi kể thứ nhất..."
               value={prompt}
               onChange={(e) => setPrompt(e.target.value)}
             />

             <div className="mb-4">
               <NovelPolishTool
                 title="Trau chuốt bản thảo"
                 sourceText={adaptationPolishSource}
                 sourceActionLabel="Lấy từ bản nhập"
                 disabled={isPolishing || isImporting || !isAiAnalyzed}
                 onRun={(payload) => void handleRunNovelPolish(payload)}
               />
               {adaptationPolishSource && (
                 <p className="mt-2 text-[10px] leading-4 text-[#64748B]">
                   Nút lấy nhanh sẽ dùng một đoạn rút gọn từ bản nhập. Dán đoạn cụ thể nếu bạn muốn polish chính xác hơn.
                 </p>
               )}
               {polishError ? (
                 <div className="mt-3">
                   <AiConnectionDebugPanel
                     error={polishError}
                     onDismiss={() => setPolishError('')}
                   />
                 </div>
               ) : null}
               {polishResult && polishModeId ? (
                 <div className="mt-3 rounded-2xl border border-accent-amber/20 bg-[#0A0C10] p-4">
                   <div className="flex items-center justify-between gap-3">
                     <div>
                       <p className="text-[10px] font-bold uppercase tracking-widest text-accent-amber">
                         {getNovelPolishMode(polishModeId).label}
                       </p>
                       <p className="mt-1 text-[11px] text-[#94A3B8]">
                         {getNovelPolishMode(polishModeId).outputKind === 'report'
                           ? 'Bản báo lỗi để rà soát trước khi phóng tác.'
                           : 'Bản trau chuốt mẫu để tham chiếu khi viết lại.'}
                       </p>
                     </div>
                     <div className="flex items-center gap-2">
                       <button
                         type="button"
                         onClick={() => void navigator.clipboard.writeText(polishResult)}
                         className="rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-semibold text-[#CBD5E1] transition-colors hover:border-white/20 hover:text-white"
                       >
                         Sao chép
                       </button>
                       <button
                         type="button"
                         onClick={() =>
                           setPrompt((prev) => {
                             const seed = getNovelPolishMode(polishModeId).outputKind === 'report'
                               ? `Các lỗi cần tránh khi phóng tác:\n${polishResult}`
                               : `Mẫu văn phong muốn hướng tới:\n${polishResult}`;
                             return prev.trim() ? `${prev.trim()}\n\n${seed}` : seed;
                           })
                         }
                         className="rounded-lg bg-accent-amber px-3 py-1.5 text-[11px] font-semibold text-[#1E232B] transition-colors hover:bg-amber-400"
                       >
                         Đưa vào prompt
                       </button>
                     </div>
                   </div>
                   <div className="mt-3 max-h-56 overflow-y-auto rounded-xl border border-white/5 bg-white/[0.02] px-3 py-3 text-[12px] leading-6 text-[#E2E8F0] whitespace-pre-wrap">
                     {polishResult}
                   </div>
                 </div>
               ) : null}
             </div>

             <div className="mb-6 flex flex-wrap gap-2">
               {['Tối giản lời thoại', 'Thêm yếu tố kỳ ảo', 'Chuyển sang ngôi thứ nhất', 'Giữ tên nhân vật', 'Tránh sao chép nguyên văn'].map((tag) => (
                 <button
                   key={tag}
                   type="button"
                   onClick={() => addTag(tag)}
                   className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                     promptIncludes(tag)
                       ? 'bg-accent-teal/15 text-accent-teal ring-1 ring-accent-teal/30'
                       : 'bg-[#1E232B] text-[#E2E8F0] hover:bg-[#2A313C]'
                   }`}
                 >
                   {tag}
                 </button>
               ))}
               <button type="button" className="px-3 py-1.5 border border-dashed border-[#1E232B] hover:border-white/20 rounded-lg text-[11px] font-semibold text-[#94A3B8] hover:text-white transition-colors">
                 <SlidersHorizontal size={12} className="mr-1 inline" /> Tùy chỉnh
               </button>
             </div>

              <div className="mt-auto space-y-3">
                {/* Main CTA: Adaptation */}
                <button
                  onClick={handleStartAdaptation}
                  disabled={isImporting || isAnalyzing || !isAiAnalyzed || Boolean(duplicateProject && !duplicateResolution)}
                  className="w-full py-4 bg-gradient-to-r from-accent-amber to-amber-600 rounded-2xl font-bold text-white uppercase tracking-widest text-sm shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:shadow-[0_0_30px_rgba(245,158,11,0.5)] transition-all flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
                >
                  {isImporting
                    ? <Loader2 className="animate-spin" />
                    : isOverwritingDuplicate
                      ? 'Xác nhận & ghi đè hồ sơ'
                      : isKeepingBothDuplicate
                        ? 'Xác nhận & tạo bản mới'
                        : 'Xác nhận hồ sơ phóng tác'}
                  {!isImporting && <ArrowRight size={18} />}
                </button>

                {/* Secondary CTA: Extract Template */}
                <button
                  onClick={handleExtractTemplate}
                  disabled={isExtracting || !isAiAnalyzed || isImporting}
                  className="w-full py-3 border border-accent-teal/30 bg-accent-teal/5 hover:bg-accent-teal/10 rounded-2xl font-semibold text-accent-teal uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isExtracting ? (
                    <>
                      <Loader2 className="animate-spin" />
                      {extractionProgress?.label ?? 'Đang chiết xuất...'}
                    </>
                  ) : extractedTemplate ? (
                    <>
                      <CheckCircle2 size={14} className="text-emerald-400" />
                      Template đã trích xuất thành công
                    </>
                  ) : (
                    <>
                      <Puzzle size={14} />
                      Trích xuất làm Template cho truyện mới
                    </>
                  )}
                </button>

                {/* Extraction progress steps */}
                {isExtracting && extractionProgress && (
                  <div className="rounded-xl bg-[#0A0C10] border border-accent-teal/10 p-3 space-y-1.5">
                    {([1, 2, 3, 4] as const).map((phase) => (
                      <div key={phase} className={`flex items-center gap-2 text-[10px] transition-colors ${
                        extractionProgress.phase > phase
                          ? 'text-emerald-400'
                          : extractionProgress.phase === phase
                            ? 'text-accent-teal animate-pulse'
                            : 'text-[#64748B]'
                      }`}>
                        {extractionProgress.phase > phase
                          ? <CheckCircle2 size={10} />
                          : extractionProgress.phase === phase
                            ? <Loader2 className="animate-spin" />
                            : <ChevronRight size={10} className="opacity-30" />}
                        <span>{
                          phase === 1 ? 'Thế giới quan & Hệ thống' :
                          phase === 2 ? 'Sảng điểm & Pitfalls' :
                          phase === 3 ? 'Cấu trúc Arc & Dàn ý' :
                          'Tổng hợp Template'
                        }</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Extracted template preview */}
                {extractedTemplate && !isExtracting && (
                  <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-3">
                    <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1">✅ Template sẵn sàng</p>
                    <p className="text-xs text-[#E2E8F0] font-semibold">{extractedTemplate.name}</p>
                    <p className="text-[10px] text-[#94A3B8] mt-0.5 line-clamp-2">{extractedTemplate.coreSellingPoint}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {extractedTemplate.tags.slice(0, 4).map((tag) => (
                        <span key={tag} className="text-[9px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full">{tag}</span>
                      ))}
                    </div>
                    <p className="text-[9px] text-[#64748B] mt-2">Template đã lưu vào bộ nhớ phiên. Vào Cài đặt → Templates để xem và áp dụng.</p>
                  </div>
                )}

                <p className="text-center text-[10px] text-[#94A3B8] uppercase tracking-wider flex items-center justify-center gap-1">
                  <Lock size={10} /> Quá trình hoàn toàn bảo mật
                </p>
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
