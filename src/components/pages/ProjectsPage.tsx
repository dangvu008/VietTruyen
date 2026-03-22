/**
 * File: ProjectsPage.tsx
 * Purpose: Trang quản lý dự án — danh sách + dashboard dự án active
 * Layer: UI Page
 * Domain: Projects → [CRUD, progress tracking]
 */
import React from 'react';
import { Plus, Copy, Trash2, BookOpen, PenTool, Users as UsersIcon } from 'lucide-react';
import type { Project } from '../../types/story';
import PageHeader from '../layout/PageHeader';

interface ProjectsPageProps {
  projects: Project[];
  activeProject: Project;
  onCreateProject: (title: string) => void;
  onDuplicateProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
  onSetActiveProject: (id: string) => void;
  onUpdateProject: (id: string, patch: Partial<Project>) => void;
  onNavigate: (tab: string) => void;
}

const ProjectsPage: React.FC<ProjectsPageProps> = ({
  projects, activeProject,
  onCreateProject, onDuplicateProject, onDeleteProject, onSetActiveProject, onUpdateProject,
  onNavigate,
}) => {
  const progress = activeProject.targetChapters
    ? Math.min(100, Math.round((activeProject.chapters.length / activeProject.targetChapters) * 100))
    : 0;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Dự án"
        subtitle="Quản lý dự án sáng tác của bạn"
        action={
          <button onClick={() => onCreateProject('Dự án mới')} className="btn-primary">
            <Plus size={16} /> Tạo dự án
          </button>
        }
      />

      <div className="grid grid-cols-12 gap-6">
        {/* Project List */}
        <div className="col-span-4 space-y-3">
          {projects.map((project) => (
            <button
              key={project.id}
              onClick={() => onSetActiveProject(project.id)}
              className={`card-interactive w-full text-left ${
                project.id === activeProject.id ? 'border-accent-amber/40 bg-accent-amber/5' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-text-primary text-sm truncate">{project.title}</h3>
                  <p className="text-xs text-text-muted mt-0.5">
                    Cập nhật: {project.updatedAt.slice(0, 10)}
                  </p>
                </div>
                {project.id === activeProject.id && (
                  <span className="badge-amber shrink-0 ml-2">Active</span>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Active Project Dashboard */}
        <div className="col-span-8 space-y-5">
          <div className="card">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="font-display text-xl font-bold text-text-primary">{activeProject.title}</h2>
                <p className="text-sm text-text-secondary mt-0.5">Bảng điều khiển dự án</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => onDuplicateProject(activeProject.id)} className="btn-secondary btn-sm">
                  <Copy size={14} /> Nhân bản
                </button>
                <button
                  onClick={() => onDeleteProject(activeProject.id)}
                  className="btn btn-sm bg-transparent border border-accent-rose/30 text-accent-rose 
                             hover:bg-accent-rose/10 hover:border-accent-rose/50"
                >
                  <Trash2 size={14} /> Xóa
                </button>
              </div>
            </div>

            {/* Editable Fields */}
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <label className="label">Tên dự án</label>
                <input
                  className="input-base"
                  value={activeProject.title}
                  onChange={(e) => onUpdateProject(activeProject.id, { title: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Logline</label>
                <input
                  className="input-base"
                  value={activeProject.logline}
                  onChange={(e) => onUpdateProject(activeProject.id, { logline: e.target.value })}
                  placeholder="Một câu mô tả gọn về cốt truyện..."
                />
              </div>
              <div>
                <label className="label">Thể loại</label>
                <input
                  className="input-base"
                  value={activeProject.genre}
                  onChange={(e) => onUpdateProject(activeProject.id, { genre: e.target.value })}
                  placeholder="Tiên hiệp, sci-fi..."
                />
              </div>
              <div>
                <label className="label">Mục tiêu số chương</label>
                <input
                  type="number"
                  className="input-base"
                  value={activeProject.targetChapters}
                  onChange={(e) => onUpdateProject(activeProject.id, { targetChapters: Number(e.target.value) })}
                />
              </div>
            </div>

            {/* Progress */}
            <div>
              <div className="flex items-center justify-between text-xs text-text-muted mb-2">
                <span>Tiến độ</span>
                <span>{activeProject.chapters.length}/{activeProject.targetChapters} chương ({progress}%)</span>
              </div>
              <div className="w-full h-2 bg-bg-elevated rounded-full overflow-hidden">
                <div
                  className="h-2 rounded-full bg-accent-amber transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4">
            <button onClick={() => onNavigate('bible')} className="card-interactive text-center group">
              <BookOpen size={20} className="mx-auto text-accent-amber mb-2 group-hover:scale-110 transition-transform" />
              <p className="text-lg font-display font-bold text-text-primary">{activeProject.outline.length}</p>
              <p className="text-xs text-text-muted">Nhịp dàn ý</p>
            </button>
            <button onClick={() => onNavigate('characters')} className="card-interactive text-center group">
              <UsersIcon size={20} className="mx-auto text-accent-gold mb-2 group-hover:scale-110 transition-transform" />
              <p className="text-lg font-display font-bold text-text-primary">{activeProject.characters.length}</p>
              <p className="text-xs text-text-muted">Nhân vật</p>
            </button>
            <button onClick={() => onNavigate('writer')} className="card-interactive text-center group">
              <PenTool size={20} className="mx-auto text-accent-teal mb-2 group-hover:scale-110 transition-transform" />
              <p className="text-lg font-display font-bold text-text-primary">{activeProject.chapters.length}</p>
              <p className="text-xs text-text-muted">Chương</p>
            </button>
          </div>

          {/* Latest Chapter */}
          {activeProject.chapters[0] && (
            <div className="card">
              <h3 className="font-display font-semibold text-text-primary text-sm mb-3">Chương mới nhất</h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-text-primary text-sm">{activeProject.chapters[0].title}</p>
                  <p className="text-xs text-text-muted">{activeProject.chapters[0].updatedAt.slice(0, 10)}</p>
                </div>
                <span className="badge-amber">{activeProject.chapters[0].status}</span>
              </div>
              <p className="text-sm text-text-secondary mt-2 line-clamp-3">{activeProject.chapters[0].content}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectsPage;
