import React, { useEffect, useMemo, useState } from 'react';
import {
  Book,
  CheckSquare,
  FileOutput,
  Globe,
  LayoutList,
  Save,
  Users,
  X,
} from 'lucide-react';

import type { ProjectTabId } from '../../types/navigation';
import type { Project } from '../../types/story';

interface ProjectCommandCenterProps {
  project: Project;
  activeTab: ProjectTabId;
  onNavigate: (tab: ProjectTabId) => void;
  onUpdateProject: (id: string, patch: Partial<Project>) => void;
}

interface ProjectNavItem {
  id: ProjectTabId;
  label: string;
  metric: string;
  note: string;
  icon: React.ReactNode;
}

interface ProjectNavGroup {
  label: string;
  items: ProjectNavItem[];
}

const hasText = (value?: string) => Boolean(value?.trim());

const getWorldScore = (project: Project) => {
  let score = 0;
  if (hasText(project.world.geography) || hasText(project.world.magicSystem)) score += 1;
  if (hasText(project.world.rules) || hasText(project.world.techLevel)) score += 1;
  if ((project.world.factions || []).length > 0) score += 1;
  return score;
};

const formatProjectStamp = (value?: string) => {
  if (!value) return 'Chưa cập nhật';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Chưa cập nhật';

  return parsed.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const ProjectCommandCenter: React.FC<ProjectCommandCenterProps> = ({
  project,
  activeTab,
  onNavigate,
  onUpdateProject,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(project.title);
  const [draftLogline, setDraftLogline] = useState(project.logline);
  const [draftGenre, setDraftGenre] = useState(project.genre);
  const [draftTone, setDraftTone] = useState(project.tone);

  useEffect(() => {
    if (isEditing) return;
    setDraftTitle(project.title);
    setDraftLogline(project.logline);
    setDraftGenre(project.genre);
    setDraftTone(project.tone);
  }, [isEditing, project.genre, project.logline, project.title, project.tone]);

  const hasIdea = hasText(project.logline) || hasText(project.mainPlot) || hasText(project.endgame);
  const worldScore = getWorldScore(project);
  const outlineCount = project.outline.length || project.masterOutline?.volumes.length || 0;
  const polishedCount = project.chapters.filter((chapter) => chapter.status !== 'draft').length;
  const progressPercent = project.targetChapters
    ? Math.min(100, Math.round((project.chapters.length / project.targetChapters) * 100))
    : 0;

  const navGroups = useMemo<ProjectNavGroup[]>(
    () => [
      {
        label: 'THIẾT LẬP',
        items: [
          {
            id: 'bible',
            label: 'Nền truyện',
            metric: hasIdea ? 'Đã khóa' : 'Còn trống',
            note: hasIdea ? 'Logline hoặc trục truyện đã có' : 'Cần chốt trục cốt lõi',
            icon: <Book size={17} />,
          },
          {
            id: 'characters',
            label: 'Nhân vật',
            metric: `${project.characters.length}`,
            note: project.characters.length > 0 ? 'Hồ sơ đang hoạt động' : 'Chưa có nhân vật',
            icon: <Users size={17} />,
          },
          {
            id: 'world',
            label: 'Thế giới',
            metric: `${worldScore}/3`,
            note: worldScore > 0 ? 'Đã dựng luật vận hành' : 'Địa lý và luật chơi còn thiếu',
            icon: <Globe size={17} />,
          },
          {
            id: 'outline',
            label: 'Dàn ý',
            metric: `${outlineCount}`,
            note: outlineCount > 0 ? 'Nhịp triển khai hiện có' : 'Chưa có khung chương',
            icon: <LayoutList size={17} />,
          },
        ],
      },

      {
        label: 'HOÀN THIỆN',
        items: [
          {
            id: 'review',
            label: 'Kiểm duyệt',
            metric: `${polishedCount}`,
            note: polishedCount > 0 ? 'Chương đã qua rà soát' : 'Chưa có chương đã review',
            icon: <CheckSquare size={17} />,
          },
          {
            id: 'export',
            label: 'Xuất bản',
            metric: polishedCount > 0 ? 'Sẵn sàng' : 'Chờ review',
            note: polishedCount > 0 ? 'Có thể chuẩn bị đóng gói' : 'Cần hoàn thiện chương trước',
            icon: <FileOutput size={17} />,
          },
        ],
      },
    ],
    [hasIdea, outlineCount, polishedCount, progressPercent, project.chapters.length, project.characters.length, project.targetChapters, worldScore]
  );

  const handleSave = () => {
    onUpdateProject(project.id, {
      title: draftTitle.trim() || project.title,
      logline: draftLogline.trim(),
      genre: draftGenre.trim(),
      tone: draftTone.trim(),
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setDraftTitle(project.title);
    setDraftLogline(project.logline);
    setDraftGenre(project.genre);
    setDraftTone(project.tone);
    setIsEditing(false);
  };

  return (
    <section className="vt-panel relative overflow-hidden border border-white/10 p-5 sm:p-6">
      <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(240,197,154,0.45),transparent)]" />

      <div className="relative z-10 space-y-6">
        <div className="space-y-3">
          <span className="vt-kicker">story command center</span>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold tracking-[-0.03em] text-[#fff5ec]">
                {project.title}
              </h2>
              <p className="mt-2 text-sm leading-7 text-[#b8aa9f]">
                {project.logline || project.mainPlot || 'Thêm logline và các trục chính để truyện có điểm neo rõ ràng.'}
              </p>
            </div>
            <button
              onClick={() => setIsEditing((value) => !value)}
              className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-[#f2e7dc] transition-colors hover:bg-white/[0.06]"
            >
              {isEditing ? 'Đang sửa' : 'Chỉnh nhanh'}
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <article className="rounded-[20px] border border-white/10 bg-black/10 p-4">
            <p className="vt-kicker">tiến độ</p>
            <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#fff6ee]">{progressPercent}%</p>
            <p className="mt-2 text-sm text-[#a9988c]">{project.chapters.length}/{project.targetChapters || 0} chương</p>
          </article>
          <article className="rounded-[20px] border border-white/10 bg-black/10 p-4">
            <p className="vt-kicker">nền móng</p>
            <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#fff6ee]">
              {[hasIdea, project.characters.length > 0, worldScore > 0, outlineCount > 0].filter(Boolean).length}/4
            </p>
            <p className="mt-2 text-sm text-[#a9988c]">Ý tưởng, nhân vật, thế giới, dàn ý</p>
          </article>
          <article className="rounded-[20px] border border-white/10 bg-black/10 p-4">
            <p className="vt-kicker">cập nhật</p>
            <p className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-[#fff6ee]">{formatProjectStamp(project.updatedAt)}</p>
            <p className="mt-2 text-sm text-[#a9988c]">{polishedCount} chương đã polish</p>
          </article>
        </div>

        {isEditing && (
          <div className="rounded-[24px] border border-[#f0c59a]/15 bg-[#16110d]/80 p-4 sm:p-5">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <label className="vt-kicker">tiêu đề truyện</label>
                <input
                  value={draftTitle}
                  onChange={(event) => setDraftTitle(event.target.value)}
                  className="input-base"
                  placeholder="Tên truyện"
                />
              </div>
              <div className="grid gap-2">
                <label className="vt-kicker">logline</label>
                <textarea
                  value={draftLogline}
                  onChange={(event) => setDraftLogline(event.target.value)}
                  className="input-base min-h-[88px]"
                  placeholder="Một câu mô tả trục truyện"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <label className="vt-kicker">thể loại</label>
                  <input
                    value={draftGenre}
                    onChange={(event) => setDraftGenre(event.target.value)}
                    className="input-base"
                    placeholder="VD: Huyền huyễn"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="vt-kicker">tone</label>
                  <input
                    value={draftTone}
                    onChange={(event) => setDraftTone(event.target.value)}
                    className="input-base"
                    placeholder="VD: Tối, bi tráng, nhanh"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <button onClick={handleSave} className="vt-primary-button">
                  <Save size={16} />
                  Lưu thay đổi
                </button>
                <button onClick={handleCancel} className="vt-quiet-button">
                  <X size={16} />
                  Huỷ
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-5">
          {navGroups.map((group) => (
            <div key={group.label} className="space-y-2.5">
              <p className="px-1 text-[10px] font-bold uppercase tracking-[0.24em] text-[#7e6f63]">
                {group.label}
              </p>
              <div className="space-y-2">
                {group.items.map((item) => {
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onNavigate(item.id)}
                      className={`w-full rounded-[20px] border px-4 py-3 text-left transition-all duration-200 ${
                        isActive
                          ? 'border-[#f0c59a]/30 bg-[#f0c59a]/10 text-[#f4d4b3]'
                          : 'border-white/8 bg-white/[0.03] text-[#e8ddd3] hover:bg-white/[0.05]'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className={`mt-0.5 ${isActive ? 'text-[#f0c59a]' : 'text-[#97887c]'}`}>
                          {item.icon}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <span className="truncate text-sm font-medium">{item.label}</span>
                            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${isActive ? 'bg-[#f0c59a]/12 text-[#f0c59a]' : 'bg-white/[0.05] text-[#bcae9f]'}`}>
                              {item.metric}
                            </span>
                          </div>
                          <p className="mt-1 text-xs leading-5 text-[#98897d]">{item.note}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProjectCommandCenter;
