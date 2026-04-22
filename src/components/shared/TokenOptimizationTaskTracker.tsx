import React from 'react';
import {
  CheckCircle2,
  CircleDot,
  Layers3,
  ListTodo,
  RotateCcw,
  TimerReset,
  X,
} from 'lucide-react';
import { useTokenStore } from '../../store/use_token_store';
import {
  TOKEN_OPTIMIZATION_PHASES,
  TOKEN_OPTIMIZATION_TASKS,
} from '../../lib/ai/token_optimization_tasks';
import type {
  TokenOptimizationPhase,
  TokenOptimizationPhaseMeta,
  TokenOptimizationTask,
  TokenOptimizationTaskStatus,
} from '../../types/token_tracker';

function getStatusLabel(status: TokenOptimizationTaskStatus): string {
  switch (status) {
    case 'done':
      return 'Đã xử lý';
    case 'dismissed':
      return 'Đã ẩn';
    default:
      return 'Đang mở';
  }
}

function getPhaseStyle(phase: TokenOptimizationPhase): {
  badge: string;
  card: string;
  heading: string;
} {
  switch (phase) {
    case 'P0':
      return {
        badge: 'border-[#ef4444]/25 bg-[#ef4444]/8 text-[#fda4af]',
        card: 'border-[#ef4444]/16 bg-[#ef4444]/[0.03]',
        heading: 'text-[#fda4af]',
      };
    case 'P1':
      return {
        badge: 'border-[#f59e0b]/25 bg-[#f59e0b]/8 text-[#f2c08d]',
        card: 'border-[#f59e0b]/16 bg-[#f59e0b]/[0.03]',
        heading: 'text-[#f2c08d]',
      };
    default:
      return {
        badge: 'border-[#8cb4ff]/25 bg-[#8cb4ff]/8 text-[#bdd0ff]',
        card: 'border-[#8cb4ff]/16 bg-[#8cb4ff]/[0.03]',
        heading: 'text-[#bdd0ff]',
      };
  }
}

const TokenOptimizationTaskTracker: React.FC = () => {
  const taskStatusById = useTokenStore((state) => state.taskStatusById);
  const setTaskStatus = useTokenStore((state) => state.setTaskStatus);
  const resetTaskStatuses = useTokenStore((state) => state.resetTaskStatuses);

  const visibleTasks = TOKEN_OPTIMIZATION_TASKS.filter((task) => taskStatusById[task.id] !== 'dismissed');
  const openTasks = visibleTasks.filter((task) => taskStatusById[task.id] !== 'done');
  const doneTasks = visibleTasks.filter((task) => taskStatusById[task.id] === 'done');
  const p0OpenTasks = openTasks.filter((task) => task.phase === 'P0');
  const phaseGroups = TOKEN_OPTIMIZATION_PHASES.map((phase) => ({
    ...phase,
    tasks: visibleTasks.filter((task) => task.phase === phase.id),
  })).filter((group) => group.tasks.length > 0);

  return (
    <section
      className="rounded-[28px] border p-5 md:p-6"
      style={{
        background: 'linear-gradient(180deg, rgba(29,27,24,0.96) 0%, rgba(22,20,18,0.96) 100%)',
        borderColor: 'rgba(80,69,59,0.35)',
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#2dd4bf]/20 bg-[#2dd4bf]/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8ce9d8]">
            <TimerReset size={12} />
            Token Optimization
          </div>
          <h3 className="mt-3 font-display text-xl font-semibold text-[#f7ede5]">
            Task Tracker
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-[#9c8e82]">
            Roadmap tối ưu token đã chốt theo ba lớp ưu tiên P0, P1, P2.
          </p>
        </div>

        <button
          onClick={() => resetTaskStatuses()}
          className="inline-flex items-center gap-2 rounded-full border border-[rgba(80,69,59,0.45)] px-3 py-2 text-xs font-semibold text-[#d4c4b7] transition-colors hover:border-[#f2c08d]/30 hover:text-[#f2c08d]"
        >
          <RotateCcw size={14} />
          Reset tracker
        </button>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <SummaryCard
          icon={<CircleDot size={14} />}
          label="P0 còn lại"
          value={String(p0OpenTasks.length)}
          hint={p0OpenTasks.length > 0 ? 'ROI cao nhất, nên xử lý trước' : 'không còn block P0'}
          tint="red"
        />
        <SummaryCard
          icon={<CheckCircle2 size={14} />}
          label="Đã hoàn tất"
          value={String(doneTasks.length)}
          hint={`${doneTasks.length}/${TOKEN_OPTIMIZATION_TASKS.length} task đã được check off`}
          tint="teal"
        />
        <SummaryCard
          icon={<Layers3 size={14} />}
          label="Tổng hạng mục"
          value={String(TOKEN_OPTIMIZATION_TASKS.length)}
          hint="5 P0 • 4 P1 • 3 P2"
          tint="blue"
        />
      </div>

      <div className="mt-6 space-y-6">
        {phaseGroups.map((group) => (
          <PhaseSection
            key={group.id}
            phase={group}
            taskStatusById={taskStatusById}
            onDone={(taskId, currentStatus) =>
              setTaskStatus(taskId, currentStatus === 'done' ? 'open' : 'done')
            }
            onDismiss={(taskId) => setTaskStatus(taskId, 'dismissed')}
          />
        ))}

        {visibleTasks.length === 0 && (
          <div className="rounded-2xl border border-[#2dd4bf]/20 bg-[#2dd4bf]/6 px-4 py-5 text-sm text-[#b6efe4]">
            Tất cả task hiện đang bị ẩn. Dùng Reset tracker để khôi phục roadmap.
          </div>
        )}
      </div>
    </section>
  );
};

const SummaryCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  tint: 'red' | 'teal' | 'blue';
}> = ({ icon, label, value, hint, tint }) => {
  const palette = {
    red: {
      ring: 'border-[#ef4444]/20 bg-[#ef4444]/6 text-[#fda4af]',
      value: 'text-[#fff1f3]',
    },
    teal: {
      ring: 'border-[#2dd4bf]/20 bg-[#2dd4bf]/6 text-[#8ce9d8]',
      value: 'text-[#e5fffb]',
    },
    blue: {
      ring: 'border-[#8cb4ff]/20 bg-[#8cb4ff]/6 text-[#bdd0ff]',
      value: 'text-[#eef3ff]',
    },
  }[tint];

  return (
    <div className={`rounded-2xl border px-4 py-4 ${palette.ring}`}>
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em]">
        {icon}
        {label}
      </div>
      <div className={`mt-3 font-display text-3xl font-semibold ${palette.value}`}>{value}</div>
      <p className="mt-1 text-xs text-[#9c8e82]">{hint}</p>
    </div>
  );
};

const PhaseSection: React.FC<{
  phase: TokenOptimizationPhaseMeta & { tasks: TokenOptimizationTask[] };
  taskStatusById: Record<string, TokenOptimizationTaskStatus>;
  onDone: (taskId: string, currentStatus: TokenOptimizationTaskStatus) => void;
  onDismiss: (taskId: string) => void;
}> = ({ phase, taskStatusById, onDone, onDismiss }) => {
  const style = getPhaseStyle(phase.id);

  return (
    <div className={`rounded-[24px] border p-4 md:p-5 ${style.card}`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${style.badge}`}>
            <ListTodo size={12} />
            {phase.id}
          </div>
          <h4 className={`mt-3 font-display text-lg font-semibold ${style.heading}`}>
            {phase.title}
          </h4>
          <p className="mt-1 text-sm text-[#9c8e82]">{phase.subtitle}</p>
        </div>
        <p className="text-xs text-[#b8aaa0]">
          {phase.tasks.filter((task) => taskStatusById[task.id] === 'done').length}/{phase.tasks.length} hoàn tất
        </p>
      </div>

      <div className="mt-4 space-y-3">
        {phase.tasks.map((task) => {
          const status = taskStatusById[task.id] || 'open';
          return (
            <TaskCard
              key={task.id}
              task={task}
              status={status}
              onDone={() => onDone(task.id, status)}
              onDismiss={() => onDismiss(task.id)}
            />
          );
        })}
      </div>
    </div>
  );
};

const TaskCard: React.FC<{
  task: TokenOptimizationTask;
  status: TokenOptimizationTaskStatus;
  onDone: () => void;
  onDismiss: () => void;
}> = ({ task, status, onDone, onDismiss }) => {
  const isDone = status === 'done';
  const style = getPhaseStyle(task.phase);

  return (
    <article
      className={`rounded-2xl border p-4 transition-colors ${
        isDone ? 'border-[#2dd4bf]/20 bg-[#2dd4bf]/6' : 'border-[rgba(80,69,59,0.35)] bg-[#151310]'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-[240px] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex whitespace-nowrap items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${style.badge}`}>
              {task.id}
            </span>
            <span className="inline-flex whitespace-nowrap items-center gap-1 rounded-full border border-[rgba(80,69,59,0.45)] bg-[#1c1814] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#c8b9ad]">
              {getStatusLabel(status)}
            </span>
          </div>

          <h4 className="mt-3 font-display text-lg font-semibold text-[#f7ede5]">
            {task.title}
          </h4>

          {task.checklist.length > 0 ? (
            <div className="mt-4 rounded-xl border border-[rgba(80,69,59,0.3)] bg-[#1a1714] px-3 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8ce9d8]">
                Checklist
              </p>
              <div className="mt-2 space-y-2">
                {task.checklist.map((item) => (
                  <div key={item} className="flex items-start gap-2 text-sm text-[#e8ddd2]">
                    <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#8ce9d8]" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            task.note && (
              <div className="mt-4 rounded-xl border border-[rgba(80,69,59,0.3)] bg-[#1a1714] px-3 py-3">
                <p className="text-sm text-[#d4c4b7]">{task.note}</p>
              </div>
            )
          )}

          {task.fileTargets && task.fileTargets.length > 0 && (
            <div className="mt-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8cb4ff]">
                File targets
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {task.fileTargets.map((fileTarget) => (
                  <span
                    key={fileTarget}
                    className="rounded-full border border-[#8cb4ff]/20 bg-[#8cb4ff]/8 px-2.5 py-1 font-mono text-[11px] text-[#bdd0ff]"
                  >
                    {fileTarget}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 pt-2 md:pt-0">
          <button
            onClick={onDone}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition-colors ${
              isDone
                ? 'border border-[#2dd4bf]/25 bg-[#2dd4bf]/10 text-[#8ce9d8] hover:bg-[#2dd4bf]/16'
                : 'border border-[#f2c08d]/25 bg-[#f2c08d]/8 text-[#f2c08d] hover:bg-[#f2c08d]/14'
            }`}
          >
            <CheckCircle2 size={14} />
            {isDone ? 'Mở lại' : 'Đánh dấu xong'}
          </button>

          <button
            onClick={onDismiss}
            className="inline-flex items-center gap-2 rounded-full border border-[rgba(80,69,59,0.45)] px-3 py-2 text-xs font-semibold text-[#bbaea3] transition-colors hover:border-[#ef4444]/25 hover:text-[#fda4af]"
          >
            <X size={14} />
            Ẩn
          </button>
        </div>
      </div>
    </article>
  );
};

export default TokenOptimizationTaskTracker;
