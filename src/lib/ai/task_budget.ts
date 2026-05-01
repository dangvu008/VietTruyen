/**
 * File: task_budget.ts
 * Purpose: Hard input-token budgets for each AI task type
 * Layer: Application (AI)
 * Domain: AI -> [token budgets, cost guardrails]
 */
import type { AiTaskType } from './model_router';
import { estimateTokens } from './token_estimator';

export interface TaskTokenBudget {
  maxInputTokens: number;
}

export interface TaskBudgetCheckResult {
  taskType: AiTaskType;
  inputTokens: number;
  maxInputTokens: number;
}

export class TaskBudgetExceededError extends Error {
  readonly taskType: AiTaskType;
  readonly inputTokens: number;
  readonly maxInputTokens: number;

  constructor(check: TaskBudgetCheckResult) {
    super(
      `Task "${check.taskType}" exceeded hard input budget: ${check.inputTokens}/${check.maxInputTokens} tokens.`
    );
    this.name = 'TaskBudgetExceededError';
    this.taskType = check.taskType;
    this.inputTokens = check.inputTokens;
    this.maxInputTokens = check.maxInputTokens;
  }
}

export const TASK_TOKEN_BUDGETS: Record<AiTaskType, TaskTokenBudget> = {
  summarize: { maxInputTokens: 12_000 },
  classify: { maxInputTokens: 6_000 },
  extract_metadata: { maxInputTokens: 12_000 },
  analyze_retcon: { maxInputTokens: 16_000 },
  answer_plot: { maxInputTokens: 18_000 },
  brainstorm: { maxInputTokens: 8_000 },
  plan_chapter: { maxInputTokens: 18_000 },
  write_chapter: { maxInputTokens: 24_000 },
  polish_style: { maxInputTokens: 18_000 },
  editor: { maxInputTokens: 16_000 },
  chat: { maxInputTokens: 8_000 },
};

export function getTaskTokenBudget(taskType: AiTaskType): TaskTokenBudget {
  return TASK_TOKEN_BUDGETS[taskType];
}

export function checkTaskInputBudget(params: {
  taskType: AiTaskType;
  systemPrompt: string;
  userPrompt: string;
}): TaskBudgetCheckResult {
  const budget = getTaskTokenBudget(params.taskType);
  return {
    taskType: params.taskType,
    inputTokens: estimateTokens(`${params.systemPrompt}\n${params.userPrompt}`),
    maxInputTokens: budget.maxInputTokens,
  };
}

export function enforceTaskInputBudget(params: {
  taskType: AiTaskType;
  systemPrompt: string;
  userPrompt: string;
}): TaskBudgetCheckResult {
  const check = checkTaskInputBudget(params);
  if (check.inputTokens > check.maxInputTokens) {
    throw new TaskBudgetExceededError(check);
  }
  return check;
}
