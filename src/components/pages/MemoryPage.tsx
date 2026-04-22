import React, { useEffect, useMemo, useState } from 'react';
import { Database, Loader2, Search, ShieldAlert, TimerReset } from 'lucide-react';
import type { Project } from '../../types/story';
import type { AttributeDependency, EntityDefinition, EntitySnapshot, IndexJob, PropagationTask } from '../../types/narrative_memory';
import PageHeader from '../layout/PageHeader';
import {
  getEntityDefinitions,
  getEntityDependencies,
  getProjectIndexJobs,
  getProjectPropagationTasks,
} from '../../db/narrative_db';
import { getEntitySnapshotAt, getEntityTimelineSnapshots, searchMemory } from '../../lib/memory/memory_query';
import { sortChaptersBySequence } from '../../lib/memory/chapter_order';

interface MemoryPageProps {
  project: Project;
}

const MemoryPage: React.FC<MemoryPageProps> = ({ project }) => {
  const chapters = useMemo(() => sortChaptersBySequence(project.chapters || []), [project.chapters]);
  const maxChapter = chapters[chapters.length - 1]?.sequenceNumber || 1;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<EntityDefinition[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [chapterIndex, setChapterIndex] = useState(maxChapter);
  const [snapshot, setSnapshot] = useState<EntitySnapshot | null>(null);
  const [timeline, setTimeline] = useState<EntitySnapshot[]>([]);
  const [dependencies, setDependencies] = useState<AttributeDependency[]>([]);
  const [tasks, setTasks] = useState<PropagationTask[]>([]);
  const [jobs, setJobs] = useState<IndexJob[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setChapterIndex(maxChapter);
  }, [maxChapter]);

  useEffect(() => {
    const loadBase = async () => {
      const [definitions, projectTasks, indexJobs] = await Promise.all([
        getEntityDefinitions(project.id),
        getProjectPropagationTasks(project.id),
        getProjectIndexJobs(project.id),
      ]);
      setResults(definitions);
      setTasks(projectTasks);
      setJobs(indexJobs);
      if (!selectedEntityId && definitions[0]) {
        setSelectedEntityId(definitions[0].entityId);
      }
    };

    void loadBase();
  }, [project.id, project.updatedAt, selectedEntityId]);

  useEffect(() => {
    const runSearch = async () => {
      const nextResults = query.trim()
        ? await searchMemory(project.id, query)
        : await getEntityDefinitions(project.id);
      setResults(nextResults);
    };

    void runSearch();
  }, [project.id, project.updatedAt, query]);

  useEffect(() => {
    if (!selectedEntityId) return;
    setIsLoading(true);

    const loadEntity = async () => {
      const [nextSnapshot, nextTimeline, nextDependencies] = await Promise.all([
        getEntitySnapshotAt(project.id, selectedEntityId, chapterIndex),
        getEntityTimelineSnapshots(project.id, selectedEntityId),
        getEntityDependencies(project.id, selectedEntityId),
      ]);

      setSnapshot(nextSnapshot || null);
      setTimeline(nextTimeline);
      setDependencies(nextDependencies);
      setIsLoading(false);
    };

    void loadEntity();
  }, [project.id, project.updatedAt, selectedEntityId, chapterIndex]);

  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader
        title="Memory"
        subtitle="Timeline, dependency graph và task continuity của dự án"
      />

      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-4 space-y-4">
          <div className="bg-[#0F1115] rounded-2xl border border-[#1E232B] p-6">
            <label className="label flex items-center gap-2">
              <Search size={14} className="text-[#F59E0B]" />
              Tìm entity hoặc fact
            </label>
            <input
              className="input-base"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tên nhân vật, fact, attribute..."
            />
            <div className="mt-3 space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {results.map((entity) => (
                <button
                  key={entity.id}
                  onClick={() => setSelectedEntityId(entity.entityId)}
                  className={`w-full text-left p-3 rounded-xl border transition-colors ${
                    selectedEntityId === entity.entityId
                      ? 'border-[#F59E0B]/30 bg-[#F59E0B]/8'
                      : 'border-[#1E232B] bg-bg-surface hover:bg-[#0F1115]'
                  }`}
                >
                  <p className="text-sm font-semibold text-[#F8FAFC]">{entity.canonicalName}</p>
                  <p className="text-xs text-[#94A3B8] mt-1">{entity.entityType}</p>
                  <p className="text-xs text-[#E2E8F0] mt-2 line-clamp-2">
                    {Object.entries(entity.attributes)
                      .slice(0, 3)
                      .map(([key, value]) => `${key}: ${value}`)
                      .join(' · ')}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-[#0F1115] rounded-2xl border border-[#1E232B] p-6">
            <div className="flex items-center gap-2 mb-3">
              <TimerReset size={14} className="text-[#2DD4BF]" />
              <h3 className="font-semibold text-[#F8FAFC] text-sm">Backfill jobs</h3>
            </div>
            <div className="space-y-2">
              {jobs.length === 0 ? (
                <p className="text-sm text-[#94A3B8]">Chưa có job index nào.</p>
              ) : (
                jobs.slice().reverse().slice(0, 6).map((job) => (
                  <div key={job.id} className="p-3 rounded-xl bg-bg-surface bg-[#0F1115]">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-[#F8FAFC]">{job.jobType}</p>
                      <span className="badge text-[10px] bg-[#2DD4BF]/15 text-[#2DD4BF]">{job.status}</span>
                    </div>
                    <p className="text-xs text-[#94A3B8] mt-1">
                      {job.processedItems}/{job.totalItems} items
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="col-span-8 space-y-4">
          {selectedEntityId == null ? (
            <div className="bg-[#0F1115] rounded-2xl border border-[#1E232B] p-6 flex items-center justify-center h-64 text-center">
              <div>
                <Database size={40} className="mx-auto text-[#94A3B8] mb-3 opacity-40" />
                <p className="text-sm text-[#94A3B8]">Chọn một entity để xem timeline và dependency</p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#0F1115] rounded-2xl border border-[#1E232B] p-6">
                  <label className="label">State at chapter</label>
                  <input
                    type="number"
                    min={1}
                    max={Math.max(1, maxChapter)}
                    className="input-base"
                    value={chapterIndex}
                    onChange={(event) => setChapterIndex(Number(event.target.value))}
                  />
                </div>
                <div className="bg-[#0F1115] rounded-2xl border border-[#1E232B] p-6">
                  <label className="label">Task continuity</label>
                  <p className="text-2xl font-display text-[#F8FAFC]">{tasks.filter((task) => task.entityId === selectedEntityId).length}</p>
                </div>
              </div>

              <div className="bg-[#0F1115] rounded-2xl border border-[#1E232B] p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-[#F8FAFC] text-sm">Snapshot</h3>
                  {isLoading && <Loader2 size={16} className="animate-spin text-[#2DD4BF]" />}
                </div>
                {!snapshot ? (
                  <p className="text-sm text-[#94A3B8]">Chưa có snapshot tại chương này.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(snapshot.attributes).map(([key, value]) => (
                      <div key={key} className="p-3 rounded-xl bg-[#0F1115] bg-bg-surface">
                        <p className="text-xs text-[#94A3B8] uppercase tracking-wider">{key}</p>
                        <p className="text-sm text-[#F8FAFC] mt-1">{value || '(trống)'}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-[#0F1115] rounded-2xl border border-[#1E232B] p-6">
                <h3 className="font-semibold text-[#F8FAFC] text-sm mb-3">Timeline history</h3>
                <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                  {timeline.length === 0 ? (
                    <p className="text-sm text-[#94A3B8]">Chưa có mốc timeline nào.</p>
                  ) : (
                    timeline.map((item) => (
                      <div key={`${item.entityId}-${item.chapterIndex}`} className="p-3 rounded-xl bg-[#0F1115] bg-bg-surface">
                        <p className="text-sm font-medium text-[#F8FAFC]">Ch.{item.chapterIndex}</p>
                        <p className="text-xs text-[#E2E8F0] mt-1">
                          {Object.entries(item.attributes)
                            .slice(0, 4)
                            .map(([key, value]) => `${key}: ${value}`)
                            .join(' · ')}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#0F1115] rounded-2xl border border-[#1E232B] p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldAlert size={14} className="text-[#F59E0B]" />
                    <h3 className="font-semibold text-[#F8FAFC] text-sm">Where used?</h3>
                  </div>
                  <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                    {dependencies.length === 0 ? (
                      <p className="text-sm text-[#94A3B8]">Chưa có dependency nào được index.</p>
                    ) : (
                      dependencies.map((dependency) => (
                        <div key={dependency.id} className="p-3 rounded-xl bg-bg-surface bg-[#0F1115]">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-[#F8FAFC]">
                              Ch.{dependency.chapterIndex} · {dependency.attributeKey}
                            </p>
                            <span className="badge text-[10px] bg-[#F59E0B]/15 text-[#F59E0B]">
                              {dependency.importance}
                            </span>
                          </div>
                          <p className="text-sm text-[#E2E8F0] mt-1">{dependency.context}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="bg-[#0F1115] rounded-2xl border border-[#1E232B] p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldAlert size={14} className="text-[#2DD4BF]" />
                    <h3 className="font-semibold text-[#F8FAFC] text-sm">Propagation tasks</h3>
                  </div>
                  <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                    {tasks.filter((task) => task.entityId === selectedEntityId).length === 0 ? (
                      <p className="text-sm text-[#94A3B8]">Chưa có task continuity nào cho entity này.</p>
                    ) : (
                      tasks
                        .filter((task) => task.entityId === selectedEntityId)
                        .map((task) => (
                          <div key={task.id} className="p-3 rounded-xl bg-bg-surface bg-[#0F1115]">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium text-[#F8FAFC]">Ch.{task.chapterIndex}</p>
                              <span
                                className={`badge text-[10px] ${
                                  task.severity === 'breaking'
                                    ? 'bg-status-error/15 text-status-error'
                                    : task.severity === 'warning'
                                    ? 'bg-[#F59E0B]/15 text-[#F59E0B]'
                                    : 'bg-[#2DD4BF]/15 text-[#2DD4BF]'
                                }`}
                              >
                                {task.severity}
                              </span>
                            </div>
                            <p className="text-sm text-[#E2E8F0] mt-1">{task.recommendedAction}</p>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MemoryPage;
