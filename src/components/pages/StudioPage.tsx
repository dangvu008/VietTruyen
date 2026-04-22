import React from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  FileText,
  Globe2,
  LayoutList,
  PenTool,
  Sparkles,
  Users,
} from 'lucide-react';
import type { Project } from '../../types/story';
import { getNextChapterSequenceNumber, sortChaptersBySequence } from '../../lib/memory/chapter_order';
import type { TabId } from '../layout/TopMenu';
import { useTranslation } from '../../hooks/use_translation';
import { useAiStore } from '../../store/use_ai_store';

type StepState = 'complete' | 'ready' | 'attention';

export interface StudioStep {
  tab: TabId;
  title: string;
  description: string;
  cta: string;
  state: StepState;
  metric: string;
}

export interface StudioWorkflow {
  steps: StudioStep[];
  nextAction: StudioStep;
  completedCount: number;
  totalCount: number;
  progressPercent: number;
  foundationScore: number;
  ideaReady: boolean;
  foundationReady: boolean;
  hasDraft: boolean;
  polishedCount: number;
}

const hasText = (value?: string) => Boolean(value?.trim());

const getWorldScore = (project: Project) => {
  let score = 0;
  if (hasText(project.world.geography) || hasText(project.world.magicSystem)) score += 1;
  if (hasText(project.world.rules) || hasText(project.world.techLevel)) score += 1;
  if ((project.world.factions || []).length > 0) score += 1;
  return score;
};

const truncate = (value: string, limit: number) => {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit).trim()}...`;
};

const formatStepState = (state: StepState) => {
  switch (state) {
    case 'complete':
      return 'Hoàn tất';
    case 'ready':
      return 'Sẵn sàng';
    default:
      return 'Cần bổ sung';
  }
};

const getStepTone = (state: StepState) => {
  switch (state) {
    case 'complete':
      return 'border-[#f0c59a]/25 bg-[#f0c59a]/10 text-[#f0c59a]';
    case 'ready':
      return 'border-white/12 bg-white/[0.05] text-[#f3e8dd]';
    default:
      return 'border-white/8 bg-white/[0.02] text-[#9f8f82]';
  }
};

const formatStamp = (value?: string) => {
  if (!value) return 'Chưa cập nhật';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Chưa cập nhật';

  return parsed.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const countCharacters = (value?: string) => value?.replace(/\s+/g, '').length ?? 0;

export const getStudioWorkflow = (
  project: Project,
  aiConfigured: boolean,
  t?: (key: string) => string,
): StudioWorkflow => {
  const tr = t || ((key: string) => key);
  const hasIdea = hasText(project.logline) || hasText(project.mainPlot) || hasText(project.endgame);
  const hasCharacters = project.characters.length > 0;
  const hasOutline = project.outline.length > 0 || (project.masterOutline?.volumes.length ?? 0) > 0;
  const hasWorld = getWorldScore(project) > 0;
  const foundationScore = [hasCharacters, hasWorld, hasOutline].filter(Boolean).length;
  const foundationReady = foundationScore === 3;
  const hasDraft = project.chapters.length > 0;
  const polishedCount = project.chapters.filter((chapter) => chapter.status !== 'draft').length;
  const nextChapterNumber = getNextChapterSequenceNumber(project.chapters || []);

  const nextFoundationTab: TabId = !hasCharacters ? 'characters' : !hasWorld ? 'world' : 'outline';
  const foundationCta = !hasCharacters
    ? tr('studio.steps.addProtagonist')
    : !hasWorld
      ? tr('studio.steps.addWorld')
      : tr('studio.steps.addOutline');

  const steps: StudioStep[] = [
    {
      tab: 'ai-settings',
      title: tr('studio.steps.enableAi'),
      description: tr('studio.steps.enableAiDesc'),
      cta: aiConfigured ? tr('studio.steps.aiReady') : tr('studio.steps.openAiSettings'),
      state: aiConfigured ? 'complete' : 'attention',
      metric: aiConfigured ? tr('studio.steps.canUseNow') : tr('studio.steps.missingApiKey'),
    },
    {
      tab: 'brainstorm',
      title: tr('studio.steps.lockIdea'),
      description: tr('studio.steps.lockIdeaDesc'),
      cta: hasIdea ? tr('studio.steps.reopenIdea') : tr('studio.steps.brainstormNow'),
      state: hasIdea ? 'complete' : aiConfigured ? 'ready' : 'attention',
      metric: hasIdea ? tr('studio.steps.hasDirection') : tr('studio.steps.needStartPoint'),
    },
    {
      tab: nextFoundationTab,
      title: tr('studio.steps.buildFoundation'),
      description: tr('studio.steps.buildFoundationDesc'),
      cta: foundationReady ? tr('studio.steps.foundationReady') : foundationCta,
      state: foundationReady ? 'complete' : hasIdea ? 'ready' : 'attention',
      metric: `${foundationScore}/3 ${tr('studio.steps.coreParts')}`,
    },
    {
      tab: hasDraft ? 'review' : 'writing-wizard',
      title: tr('studio.steps.writeChapters'),
      description: tr('studio.steps.writeChaptersDesc'),
      cta: hasDraft
        ? `${tr('studio.steps.continueChapter')} ${nextChapterNumber}`
        : tr('studio.steps.writeFirstChapter'),
      state: hasDraft ? 'complete' : foundationReady ? 'ready' : 'attention',
      metric: hasDraft ? `${project.chapters.length} ${tr('studio.steps.chaptersExist')}` : tr('studio.steps.noDraft'),
    },
    {
      tab: polishedCount > 0 ? 'export' : 'review',
      title: tr('studio.steps.reviewAndShip'),
      description: tr('studio.steps.reviewAndShipDesc'),
      cta: polishedCount > 0 ? tr('studio.steps.exportNow') : tr('studio.steps.reviewLatestChapter'),
      state: polishedCount > 0 ? 'complete' : hasDraft ? 'ready' : 'attention',
      metric: polishedCount > 0
        ? `${polishedCount} ${tr('studio.steps.reviewedChapters')}`
        : tr('studio.steps.reviewPending'),
    },
  ];

  const completedCount = steps.filter((step) => step.state === 'complete').length;
  const totalCount = steps.length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);
  const nextAction = steps.find((step) => step.state !== 'complete') ?? steps[steps.length - 1];

  return {
    steps,
    nextAction,
    completedCount,
    totalCount,
    progressPercent,
    foundationScore,
    ideaReady: hasIdea,
    foundationReady,
    hasDraft,
    polishedCount,
  };
};

interface StudioPageProps {
  project: Project;
  aiConfigured: boolean;
  aiModelLabel: string;
  onNavigate: (tab: TabId) => void;
  assistantPanel: React.ReactNode;
}

const StudioPage: React.FC<StudioPageProps> = ({
  project,
  aiConfigured,
  aiModelLabel,
  onNavigate,
  assistantPanel,
}) => {
  const { t } = useTranslation();
  const workflow = getStudioWorkflow(project, aiConfigured, t);
  const orderedChapters = sortChaptersBySequence(project.chapters || []);
  const latestChapter = orderedChapters[orderedChapters.length - 1] ?? null;
  const { subscription } = useAiStore();

  const tokenPercentage = Math.min(
    100,
    Math.round((subscription.tokensUsed / Math.max(subscription.tokensLimit || 1, 1)) * 100),
  );
  const remainingTokens = Math.max(0, (subscription.tokensLimit || 0) - subscription.tokensUsed);
  const latestSnippet = latestChapter?.content?.trim() ?? '';
  const latestParagraphs = latestSnippet
    ? latestSnippet
      .split(/\n{2,}|\n/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean)
      .slice(0, 3)
    : [];
  const latestExcerptBlocks =
    latestParagraphs.length > 0
      ? latestParagraphs
      : latestSnippet
        ? [truncate(latestSnippet, 720)]
        : ['Chương này chưa có nội dung hiển thị.'];
  const chapterBadge = latestChapter
    ? `Chương ${latestChapter.sequenceNumber ?? orderedChapters.length}`
    : 'Bản thảo trống';
  const storySummary =
    project.logline ||
    project.mainPlot ||
    'Ghim lại trục nhân vật, xung đột và lộ trình triển khai để bắt đầu chu kỳ viết ổn định.';

  const hasOutline = project.outline.length > 0 || (project.masterOutline?.volumes.length ?? 0) > 0;
  const worldScore = getWorldScore(project);
  const foundationRows = [
    {
      label: 'Nhân vật chính',
      detail:
        project.characters.length > 0
          ? `${project.characters.length} hồ sơ đang hoạt động`
          : 'Chưa có tuyến nhân vật nào được khóa.',
      ready: project.characters.length > 0,
      progress: project.characters.length > 0 ? 100 : 18,
      icon: <Users size={15} />,
    },
    {
      label: 'Thế giới truyện',
      detail:
        worldScore > 0
          ? `${worldScore}/3 cụm thông tin đã được dựng`
          : 'Địa lý, luật vận hành và phe phái vẫn đang trống.',
      ready: worldScore > 0,
      progress: worldScore > 0 ? Math.max(34, Math.round((worldScore / 3) * 100)) : 14,
      icon: <Globe2 size={15} />,
    },
    {
      label: 'Dàn ý triển khai',
      detail:
        hasOutline
          ? `${project.outline.length || project.masterOutline?.volumes.length || 1} mảng nội dung đã có`
          : 'Chưa có khung dàn ý để neo nhịp truyện.',
      ready: hasOutline,
      progress: hasOutline ? 100 : 16,
      icon: <LayoutList size={15} />,
    },
  ];

  const studioMetrics = [
    {
      label: 'workflow',
      value: `${workflow.progressPercent}%`,
      note: `${workflow.completedCount}/${workflow.totalCount} chặng đã chốt`,
    },
    {
      label: 'bản nháp',
      value: `${project.chapters.length}`,
      note: latestChapter ? `${chapterBadge} đang là mốc gần nhất` : 'Chưa có chương nào được viết',
    },
    {
      label: 'token tháng',
      value: `${tokenPercentage}%`,
      note: `Còn ${remainingTokens.toLocaleString('vi-VN')} token khả dụng`,
    },
  ];

  return (
    <div className="space-y-8 lg:space-y-10">
      <section className="vt-panel vt-subtle-grid isolate animate-fade-in overflow-hidden p-6 sm:p-8 lg:p-10">
        <div className="absolute inset-y-0 right-0 hidden w-[38%] bg-[radial-gradient(circle_at_top_right,_rgba(240,197,154,0.14),_transparent_55%)] lg:block" />
        <div className="absolute -right-8 top-6 hidden select-none font-script text-[13rem] leading-none text-white/[0.04] lg:block">
          {String(workflow.completedCount).padStart(2, '0')}
        </div>

        <div className="relative grid gap-10 xl:grid-cols-[minmax(0,1.25fr)_360px] xl:items-start">
          <div className="space-y-8">
            <div className="space-y-4">
              <span className="vt-kicker">creative operations</span>
              <div className="flex flex-wrap items-start gap-4">
                <h1 className="max-w-[12ch] text-balance font-script text-5xl leading-[0.92] tracking-[-0.045em] text-[#fff7ef] sm:text-6xl lg:text-[5.5rem]">
                  {project.title}
                </h1>
                <span className="vt-pill mt-2 border-[#f0c59a]/25 bg-[#f0c59a]/10 text-[#f0c59a]">
                  <Sparkles size={14} />
                  {workflow.progressPercent}% vận hành
                </span>
              </div>
              <p className="max-w-[54ch] text-base leading-8 text-[#c7b7ab] sm:text-lg">
                {storySummary}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <span
                className={`vt-pill ${
                  aiConfigured
                    ? 'border-[#f0c59a]/25 bg-[#f0c59a]/10 text-[#f0c59a]'
                    : 'text-[#9f8f82]'
                }`}
              >
                <Bot size={14} />
                {aiConfigured ? 'AI đã sẵn sàng' : 'Thiếu cấu hình AI'}
              </span>
              <span className="vt-pill">
                <BookOpen size={14} />
                {project.genre || 'Chưa chọn thể loại'}
              </span>
              <span className="vt-pill">
                <Users size={14} />
                {workflow.foundationReady ? 'Nền móng đủ dày' : `${workflow.foundationScore}/3 trụ nền`}
              </span>
              <span className="vt-pill">
                <PenTool size={14} />
                {workflow.hasDraft ? `${project.chapters.length} chương hiện có` : 'Chưa có bản nháp'}
              </span>
            </div>

            <div className="grid gap-5 sm:grid-cols-3">
              {studioMetrics.map((item) => (
                <article key={item.label} className="border-t border-white/10 pt-4">
                  <p className="vt-kicker">{item.label}</p>
                  <p className="vt-data mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#fff7ef]">
                    {item.value}
                  </p>
                  <p className="mt-2 max-w-[24ch] text-sm leading-6 text-[#a89a90]">{item.note}</p>
                </article>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => onNavigate(workflow.nextAction.tab)}
                className="vt-primary-button"
              >
                {workflow.nextAction.cta}
                <ArrowRight size={16} />
              </button>
              <button
                onClick={() => onNavigate(workflow.hasDraft ? 'review' : 'brainstorm')}
                className="vt-quiet-button"
              >
                {workflow.hasDraft ? 'Mở bàn viết' : 'Khoá ý tưởng'}
                <ArrowUpRight size={16} />
              </button>
            </div>
          </div>

          <aside className="rounded-[24px] border border-white/10 bg-black/20 p-5 backdrop-blur-md sm:p-6">
            <span className="vt-kicker">current pulse</span>
            <div className="mt-3 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-[#c8bbb1]">Hạng mục nên xử lý tiếp</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#fff4eb]">
                  {workflow.nextAction.title}
                </h2>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-medium ${getStepTone(workflow.nextAction.state)}`}>
                {formatStepState(workflow.nextAction.state)}
              </span>
            </div>

            <p className="mt-3 text-sm leading-7 text-[#bbaea4]">{workflow.nextAction.description}</p>

            <div className="mt-6 space-y-5">
              <div>
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.24em] text-[#9f8f82]">
                  <span>workflow</span>
                  <span className="vt-data">{workflow.completedCount}/{workflow.totalCount}</span>
                </div>
                <div className="mt-3 h-px overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full bg-[#f0c59a]"
                    style={{ width: `${workflow.progressPercent}%` }}
                  />
                </div>
              </div>

              <dl className="space-y-4 text-sm text-[#c9bbb0]">
                <div className="flex items-start justify-between gap-4 border-b border-white/8 pb-4">
                  <dt className="text-[#8f8176]">Mô hình AI</dt>
                  <dd className="max-w-[180px] text-right text-[#f0e4d9]">
                    {aiConfigured ? aiModelLabel : 'Chưa cấu hình'}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4 border-b border-white/8 pb-4">
                  <dt className="text-[#8f8176]">Token còn lại</dt>
                  <dd className="vt-data text-right text-[#f0e4d9]">
                    {remainingTokens.toLocaleString('vi-VN')}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4 border-b border-white/8 pb-4">
                  <dt className="text-[#8f8176]">Chương đã polish</dt>
                  <dd className="vt-data text-right text-[#f0e4d9]">
                    {workflow.polishedCount}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-[#8f8176]">Bản cập nhật gần nhất</dt>
                  <dd className="text-right text-[#f0e4d9]">
                    {latestChapter ? formatStamp(latestChapter.updatedAt) : 'Chưa có'}
                  </dd>
                </div>
              </dl>

              <button
                onClick={() => onNavigate(workflow.nextAction.tab)}
                className="flex w-full items-center justify-between rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-sm font-medium text-[#f7ece3] transition-all duration-300 hover:bg-white/[0.06] active:scale-[0.99]"
              >
                <span>{workflow.nextAction.cta}</span>
                <ChevronRight size={16} />
              </button>
            </div>
          </aside>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <article className="vt-panel animate-slide-in-up p-6 sm:p-8">
          <header className="relative z-10 flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="vt-kicker">latest manuscript</span>
              <h2 className="mt-2 max-w-[14ch] text-balance font-script text-4xl leading-[0.95] tracking-[-0.04em] text-[#fff7ef]">
                {latestChapter ? latestChapter.title : 'Chưa có bản thảo nào được mở'}
              </h2>
              <p className="mt-3 text-sm leading-7 text-[#b6a89d]">
                {latestChapter
                  ? `${chapterBadge} · ${formatStamp(latestChapter.updatedAt)} · ${countCharacters(latestChapter.content).toLocaleString('vi-VN')} ký tự`
                  : 'Khởi động chương đầu tiên để tạo một điểm neo cho vòng brainstorm, review và xuất bản.'}
              </p>
            </div>

            <button
              onClick={() => onNavigate(latestChapter ? 'review' : workflow.nextAction.tab)}
              className="vt-quiet-button self-start sm:self-auto"
            >
              {latestChapter ? 'Mở bàn viết' : workflow.nextAction.cta}
              <ArrowUpRight size={16} />
            </button>
          </header>

          <div className="relative z-10 mt-8">
            {latestChapter ? (
              <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_220px]">
                <div className="space-y-6 text-[15px] leading-8 text-[#efe2d8]">
                  {latestExcerptBlocks.map((paragraph, index) => (
                    <p key={`${latestChapter.id}-${index}`}>
                      {truncate(paragraph, 260)}
                    </p>
                  ))}
                </div>

                <aside className="space-y-5 border-t border-white/10 pt-6 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                  <div>
                    <p className="vt-kicker">status</p>
                    <p className="mt-2 text-lg font-medium text-[#fff2e7]">
                      {latestChapter.status === 'draft'
                        ? 'Đang ở dạng nháp'
                        : latestChapter.status === 'revised'
                          ? 'Đã qua chỉnh sửa'
                          : 'Đã khóa bản cuối'}
                    </p>
                  </div>
                  <div>
                    <p className="vt-kicker">điểm nối tiếp theo</p>
                    <p className="mt-2 text-sm leading-7 text-[#b7a89c]">
                      {workflow.hasDraft
                        ? 'Tiếp tục viết hoặc chuyển sang review để khóa nhịp và độ căng của chương.'
                        : 'Tạo chương đầu tiên để bắt đầu vòng lặp viết và phản hồi.'}
                    </p>
                  </div>
                  <div>
                    <p className="vt-kicker">gợi ý hành động</p>
                    <button
                      onClick={() => onNavigate(workflow.polishedCount > 0 ? 'export' : 'review')}
                      className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-[#f0c59a] transition-colors hover:text-[#f6d8b6]"
                    >
                      {workflow.polishedCount > 0 ? 'Chuẩn bị xuất bản' : 'Đưa vào review'}
                      <ArrowRight size={15} />
                    </button>
                  </div>
                </aside>
              </div>
            ) : (
              <div className="flex min-h-[280px] flex-col items-start justify-between gap-8 rounded-[24px] border border-dashed border-white/12 bg-black/10 p-6 sm:p-8">
                <div className="grid h-14 w-14 place-items-center rounded-[18px] border border-white/10 bg-white/[0.04] text-[#f0c59a]">
                  <FileText size={22} />
                </div>
                <div className="space-y-3">
                  <h3 className="text-2xl font-semibold tracking-[-0.03em] text-[#fff3ea]">
                    Chưa có bản thảo để đọc lại
                  </h3>
                  <p className="max-w-[54ch] text-sm leading-7 text-[#b5a79d]">
                    Mọi tín hiệu nền móng đang nằm sẵn ở panel bên phải. Khi đã có ý tưởng hoặc dàn ý, hãy mở trình viết để tạo chương đầu tiên và đưa hệ thống vào nhịp.
                  </p>
                </div>
                <button onClick={() => onNavigate(workflow.nextAction.tab)} className="vt-primary-button">
                  {workflow.nextAction.cta}
                  <ArrowRight size={16} />
                </button>
              </div>
            )}
          </div>
        </article>

        <aside className="vt-panel animate-slide-in-up p-6 sm:p-8" style={{ animationDelay: '80ms' }}>
          <div className="relative z-10">
            <span className="vt-kicker">story spine</span>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#fff4eb]">
              Nền móng dự án
            </h2>
            <p className="mt-3 text-sm leading-7 text-[#b5a79d]">
              Ba trục dưới đây quyết định xem project đã đủ chắc để viết liên tục hay vẫn cần bổ sung.
            </p>

            <ul className="mt-8 space-y-6">
              {foundationRows.map((item) => (
                <li key={item.label} className="space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-[#f0c59a]">
                        {item.icon}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-[#f3e6dc]">{item.label}</p>
                        <p className="mt-1 text-sm leading-6 text-[#a99b90]">{item.detail}</p>
                      </div>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${item.ready ? 'bg-[#f0c59a]/10 text-[#f0c59a]' : 'bg-white/[0.04] text-[#8d7f74]'}`}>
                      {item.ready ? 'Đủ' : 'Thiếu'}
                    </span>
                  </div>
                  <div className="h-px overflow-hidden rounded-full bg-white/10">
                    <div className="h-full bg-[#f0c59a]" style={{ width: `${item.progress}%` }} />
                  </div>
                </li>
              ))}
            </ul>

            <dl className="mt-8 space-y-4 border-t border-white/10 pt-6 text-sm">
              <div className="grid gap-1">
                <dt className="vt-kicker">logline</dt>
                <dd className="text-[#ece0d6]">{project.logline || 'Chưa chốt một câu tóm lược chính.'}</dd>
              </div>
              <div className="grid gap-1">
                <dt className="vt-kicker">tone</dt>
                <dd className="text-[#ece0d6]">{project.tone || 'Chưa xác định tông chủ đạo.'}</dd>
              </div>
              <div className="grid gap-1">
                <dt className="vt-kicker">endgame</dt>
                <dd className="text-[#ece0d6]">{project.endgame || 'Chưa khóa trạng thái kết cục.'}</dd>
              </div>
            </dl>
          </div>
        </aside>
      </section>

      <section className="vt-panel animate-slide-in-up p-6 sm:p-8" style={{ animationDelay: '120ms' }}>
        <div className="relative z-10">
          <div className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <span className="vt-kicker">workflow rail</span>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[#fff4ea]">
                Lộ trình từ ý tưởng đến xuất bản
              </h2>
            </div>
            <p className="max-w-[48ch] text-sm leading-7 text-[#b5a79d]">
              Thay vì bốn card nhỏ tách rời, toàn bộ quy trình được gom vào một đường ray duy nhất để bạn thấy ngay phần nào đang chặn tiến độ.
            </p>
          </div>

          <ol className="mt-4 divide-y divide-white/10">
            {workflow.steps.map((step, index) => (
              <li key={step.tab} className="grid gap-4 py-5 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
                <div className="flex items-center gap-3">
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border text-sm font-semibold ${getStepTone(step.state)}`}>
                    {step.state === 'complete' ? <CheckCircle2 size={17} /> : index + 1}
                  </span>
                  <span className={`rounded-full border px-3 py-1 text-xs font-medium ${getStepTone(step.state)}`}>
                    {formatStepState(step.state)}
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-lg font-medium tracking-[-0.02em] text-[#fff3e8]">{step.title}</h3>
                    <span className="text-sm text-[#8f8176]">{step.metric}</span>
                  </div>
                  <p className="max-w-[62ch] text-sm leading-7 text-[#b3a59a]">{step.description}</p>
                </div>

                <div className="flex items-center">
                  <button
                    onClick={() => onNavigate(step.tab)}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-[#f6ebe3] transition-all duration-300 hover:bg-white/[0.06] active:scale-[0.98]"
                  >
                    {step.cta}
                    <ChevronRight size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {assistantPanel ? (
        <section className="animate-slide-in-up space-y-4" style={{ animationDelay: '160ms' }}>
          <div className="flex flex-col gap-2">
            <span className="vt-kicker">assistant</span>
            <h2 className="text-2xl font-semibold tracking-[-0.03em] text-[#fff3e8]">
              Bàn cộng tác AI
            </h2>
          </div>
          {assistantPanel}
        </section>
      ) : null}
    </div>
  );
};

export default StudioPage;
