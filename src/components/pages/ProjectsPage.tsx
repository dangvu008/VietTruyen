/**
 * File: ProjectsPage.tsx
 * Purpose: Trang quản lý dự án — hiển thị danh sách tất cả các dự án trong kho
 * Layer: UI Page
 * Domain: Projects
 */
import React, { useState } from 'react';
import {
  Search, BookOpen, Clock, Trash2, Users, FileText,
  Plus, LayoutGrid, List as ListIcon, Book,
  ChevronDown, Cloud, CloudOff, Loader2
} from 'lucide-react';
import type { Project, ProjectStorageMode } from '../../types/story';
import CreateProjectModal from '../shared/CreateProjectModal';
import { useProjectDisplayStats } from '../../hooks/use_project_display_stats';
import { useProjectStore } from '../../store/use_project_store';

interface ProjectsPageProps {
  /** @deprecated Wave 1: page subscribes internally — prop ignored. Kept for legacy render_active_page.tsx. */
  projects?: Project[];
  activeProject?: Project;
  onCreateProject: (title: string) => void;
  onDuplicateProject: (id: string) => void;
  onDeleteProject: (id: string) => void | Promise<void>;
  onSetActiveProject: (id: string) => void;
  onUpdateProject: (id: string, patch: Partial<Project>) => void;
  onSyncProjectToCloud: (id: string) => Promise<void>;
  onMakeLocalCopy: (id: string) => Promise<void>;
}

function getProjectStorageLabel(storageMode: ProjectStorageMode): {
  label: string;
  className: string;
  icon: typeof Cloud;
} {
  if (storageMode === 'cloud' || storageMode === 'provider') {
    return { label: 'Cloud', className: 'bg-sky-400/10 text-sky-300', icon: Cloud };
  }
  if (storageMode === 'local') {
    return { label: 'Local', className: 'bg-emerald-400/10 text-emerald-300', icon: CloudOff };
  }
  return { label: 'Local cache', className: 'bg-white/8 text-[#c9b6a5]', icon: CloudOff };
}

const ProjectsPage: React.FC<ProjectsPageProps> = ({
  onCreateProject,
  onDeleteProject,
  onSetActiveProject,
  onSyncProjectToCloud,
  onMakeLocalCopy,
}) => {
  // [Wave 1] Subscribe to projects internally so App.tsx does not re-render on chapter edits.
  const projects = useProjectStore((state) => state.projects);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [runningStorageActionId, setRunningStorageActionId] = useState<string | null>(null);
  const projectStats = useProjectDisplayStats(projects);

  // Lọc project theo text search
  const filteredProjects = projects.filter(p => 
    p.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateProject = (title: string) => {
    onCreateProject(title);
    setShowCreateModal(false);
  };

  const runStorageAction = async (
    event: React.MouseEvent<HTMLButtonElement>,
    projectId: string,
    action: (id: string) => Promise<void>,
  ) => {
    event.stopPropagation();
    setRunningStorageActionId(projectId);
    try {
      await action(projectId);
    } catch (error) {
      console.error('[ProjectsPage] Storage action failed:', error);
    } finally {
      setRunningStorageActionId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#110f0d] text-[#e8e1dc] h-full animate-fade-in font-sans antialiased">
      <div className="flex-1 overflow-y-auto px-8 py-10">
        <div className="max-w-[1400px] mx-auto">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-[#fff3e9] tracking-tight">Kho Truyện Của Tôi</h2>
              <p className="text-[#8f7f72] mt-2">Quản lý các tác phẩm và hành trình sáng tác của bạn.</p>
            </div>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setShowCreateModal(true)}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#e5b589] hover:bg-[#ebd0b5] text-[#2c1e16] font-bold transition-transform active:scale-[0.98] shadow-[0_4px_16px_rgba(229,181,137,0.15)] text-sm"
              >
                <Plus size={16} strokeWidth={2.5} />
                Tác phẩm mới
              </button>

              <div className="flex items-center gap-1.5 bg-[#1c1917] p-1.5 rounded-xl border border-[#2a2420]">
                <button 
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-lg transition-all duration-200 ${viewMode === 'grid' ? 'bg-[#35281d] text-[#f0c59a] shadow-sm' : 'text-[#6f6259] hover:text-[#f2e6dc]'}`}
                >
                  <LayoutGrid size={18} />
                </button>
                <button 
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-lg transition-all duration-200 ${viewMode === 'list' ? 'bg-[#35281d] text-[#f0c59a] shadow-sm' : 'text-[#6f6259] hover:text-[#f2e6dc]'}`}
                >
                  <ListIcon size={18} />
                </button>
              </div>
            </div>
          </div>

          <div className="mb-8 flex flex-col gap-4 rounded-2xl border border-[#2a2420] bg-[#161412]/50 p-5 backdrop-blur-md lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full max-w-xl">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Search size={16} className="text-[#8f7f72]" />
              </div>
              <input
                type="text"
                className="w-full bg-[#1c1917] border border-[#2a2420] text-[#f2e6dc] text-sm rounded-full pl-10 pr-4 py-2.5 focus:outline-none focus:border-[#f0c59a]/50 focus:ring-1 focus:ring-[#f0c59a]/50 placeholder-[#6f6259] transition-all shadow-inner"
                placeholder="Tìm kiếm truyện của bạn..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-6">
              <button className="flex items-center gap-1.5 text-[#a29081] hover:text-[#f2e6dc] text-sm font-medium transition-colors">
                Thể loại <ChevronDown size={14} className="opacity-70" />
              </button>
              <button className="flex items-center gap-1.5 text-[#a29081] hover:text-[#f2e6dc] text-sm font-medium transition-colors">
                Sắp xếp <ChevronDown size={14} className="opacity-70" />
              </button>
            </div>
          </div>

          {/* Grid/List */}
          <div className={`grid gap-6 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 xlg:grid-cols-3 2xl:grid-cols-4' : 'grid-cols-1 max-w-5xl'}`}>
            {filteredProjects.map((project, idx) => {
              const stats = projectStats[project.id];
              const isFreshProject =
                project.chapters.length === 0 &&
                project.characters.length === 0 &&
                project.outline.length === 0 &&
                !project.logline.trim();

              const statusMap: Record<string, { label: string; padding: string; color: string }> = {
                'draft': { label: 'Bản nháp', padding: 'px-2.5 py-1', color: 'bg-white/8 text-[#c9b6a5]' },
                'ongoing': { label: 'Đang viết', padding: 'px-2.5 py-1', color: 'bg-[#e5b589]/15 text-[#e5b589]' },
                'paused': { label: 'Tạm dừng', padding: 'px-2.5 py-1', color: 'bg-red-500/15 text-red-400' },
                'completed': { label: 'Hoàn thành', padding: 'px-2.5 py-1', color: 'bg-emerald-500/15 text-emerald-400' },
              };
              
              const projectStatus = stats?.status || (isFreshProject ? 'draft' : 'ongoing');
              const statusData = statusMap[projectStatus] || statusMap['draft'];
              const statusLabel = statusData.label;
              const statusColor = statusData.color;
              const storage = getProjectStorageLabel(project.storageMode);
              const StorageIcon = storage.icon;
              const canonicalStorage = project.storageMode === 'cloud' || project.storageMode === 'provider'
                ? 'cloud'
                : 'local';
              const isStorageActionRunning = runningStorageActionId === project.id || project.syncStatus === 'syncing';

              const gradientIndex = (project.id.charCodeAt(0) + idx) % 3;
              const gradients = [
                'from-[#2a2d34] to-[#1c1f24]',
                'from-[#342a2a] to-[#241c1c]',
                'from-[#2a3431] to-[#1c2422]',
              ];
              const coverStyle = `bg-gradient-to-br ${gradients[gradientIndex]}`;

              return (
                <div 
                  key={project.id} 
                  className={`flex bg-[#1c1917] border border-[#2a2420] rounded-2xl overflow-hidden hover:border-[#f0c59a]/30 transition-all duration-300 group cursor-pointer hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)] ${viewMode === 'list' ? 'h-[200px]' : 'h-[240px]'}`}
                  onClick={() => onSetActiveProject(project.id)}
                >
                  <div className={`w-[130px] shrink-0 ${coverStyle} relative overflow-hidden flex items-center justify-center border-r border-[#2a2420]`}>
                    <div className="absolute inset-0 bg-black/10 transition-opacity group-hover:bg-transparent" />
                    <div className="p-4 bg-black/20 rounded-xl backdrop-blur-sm border border-white/5">
                      <BookOpen size={36} className="text-[#a29081]/50" strokeWidth={1.5} />
                    </div>
                  </div>

                  <div className="flex-1 p-5 flex flex-col min-w-0 relative justify-between">
                    <div>
                      <div className="flex items-start justify-between mb-2 gap-2">
                        <span className="px-2 py-0.5 bg-[#2a2420] text-[10px] font-bold tracking-widest text-[#a29081] uppercase rounded border border-white/5 truncate max-w-[120px]">
                          {project.genre || 'Chưa định hình'}
                        </span>
                        <button 
                          className="text-[#6f6259] hover:text-[#f0c59a] transition-colors p-1 -mr-2 -mt-1 rounded-md shrink-0 opacity-0 group-hover:opacity-100"
                          onClick={(e) => { e.stopPropagation(); onDeleteProject(project.id); }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <h3 className="text-[17px] font-bold text-[#f7ede5] leading-snug mb-3 line-clamp-2 pr-2 group-hover:text-[#f0c59a] transition-colors duration-300">
                        {project.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md border border-current/10 ${statusColor}`}>
                          {statusLabel}
                        </span>
                        <span className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md border border-current/10 ${storage.className}`}>
                          <StorageIcon size={11} />
                          {storage.label}
                        </span>
                        <span className="flex items-center gap-1.5 text-[11px] text-[#8f7f72] font-medium">
                          <Clock size={12} className="opacity-70" />
                          {project.updatedAt.slice(0, 10)}
                        </span>
                      </div>
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-[#8f7f72] mb-4 mt-2">
                        <div className="flex items-center gap-1.5">
                          <BookOpen size={14} className="text-[#a29081]" />
                          <span>{stats?.chapterCount ?? project.chapters.length} chương</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Users size={14} className="text-[#a29081]" />
                          <span>{stats?.characterText ?? `${project.characters.length} nhân vật`}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <FileText size={14} className="text-[#a29081]" />
                          <span>{stats?.beatText ?? `${project.outline.length} nhịp`}</span>
                        </div>
                      </div>
                      <div className="pt-4 border-t border-[#2a2420]">
                        <div className="flex justify-between text-[11px] text-[#8f7f72] font-medium items-center">
                          <span>Tổng số chữ đã viết</span>
                          <span className="text-[#e5b589] font-bold text-xs">{(stats?.wordCount ?? 0).toLocaleString()} từ</span>
                        </div>
                        <div className="mt-3 flex items-center justify-end">
                          {canonicalStorage === 'local' ? (
                            <button
                              type="button"
                              disabled={isStorageActionRunning}
                              onClick={(event) => runStorageAction(event, project.id, onSyncProjectToCloud)}
                              className="inline-flex items-center gap-1.5 rounded-md border border-sky-300/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-sky-300 transition-colors hover:bg-sky-300/10 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {isStorageActionRunning ? <Loader2 size={12} className="animate-spin" /> : <Cloud size={12} />}
                              Sync Cloud
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={isStorageActionRunning}
                              onClick={(event) => runStorageAction(event, project.id, onMakeLocalCopy)}
                              className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300 transition-colors hover:bg-emerald-300/10 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {isStorageActionRunning ? <Loader2 size={12} className="animate-spin" /> : <CloudOff size={12} />}
                              Copy Local
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          {filteredProjects.length === 0 && (
            <div className="text-center py-24 border border-dashed border-[#2a2420] rounded-3xl bg-[#1c1917]/30 mt-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#2a2420] text-[#a29081] mb-5">
                <Book size={24} />
              </div>
              <h3 className="text-xl font-bold text-[#f7ede5]">Không có tác phẩm nào</h3>
              <button 
                onClick={() => setShowCreateModal(true)}
                className="mt-6 inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#f0c59a]/10 text-[#f0c59a] font-medium hover:bg-[#f0c59a]/20 border border-[#f0c59a]/20 transition-all"
              >
                <Plus size={16} /> Bắt đầu viết
              </button>
            </div>
          )}
        </div>
      </div>

      <CreateProjectModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onConfirm={handleCreateProject}
        existingTitles={projects.map((project) => project.title)}
      />
    </div>
  );
};

export default ProjectsPage;
