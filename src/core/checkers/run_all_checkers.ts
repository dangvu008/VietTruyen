/**
 * File: run_all_checkers.ts
 * Purpose: Orchestrator to run all checker agents in parallel
 * Layer: Core/Domain
 * Domain: Checkers -> [Orchestration]
 */

import type { CombinedReviewReport, CheckerReport, CheckerContext } from './checker_types';
import { checkerRegistry } from './checker_registry';
import { initDefaultCheckers } from './default_checkers';

// CheckerContext moved to checker_types.ts

/**
 * Runs all registered checkers in parallel.
 * @param context The narrative contextual data needed by all checkers
 * @param callAi An async function provided by the caller (e.g., a React hook) to communicate with the LLM
 */
export async function runAllCheckers(
  context: CheckerContext,
  callAi: (prompt: { system: string; user: string }) => Promise<string>
): Promise<CombinedReviewReport> {
  const { chapterId, chapterNumber } = context;

  // Ensure default checkers are registered
  initDefaultCheckers();

  const checkers = checkerRegistry.getCheckers();

  // Execute AI calls in parallel
  const results = await Promise.allSettled(
    checkers.map(checker => 
      callAi(checker.buildPrompt(context)).then(checker.parseReport)
    )
  );

  const reports: CheckerReport[] = [];
  
  // Extract successful reports and handle failures gracefully
  results.forEach((res, index) => {
    const agentName = checkers[index].name;
    if (res.status === 'fulfilled') {
      reports.push(res.value);
    } else {
      console.warn(`[runAllCheckers] Agent ${agentName} failed:`, res.reason);
      // Construct a fallback failed report
      reports.push({
        agent: agentName,
        chapter: chapterNumber,
        overall_score: 0,
        pass: false,
        issues: [{
          id: `sys-err-${agentName}`,
          severity: 'critical',
          description: `Lỗi hệ thống khi gọi AI checker ${agentName}: ${String(res.reason)}`,
          suggestion: 'Vui lòng thử lại sau.'
        }],
        metrics: {},
        summary: `Checker bị lỗi trong quá trình phân tích.`
      });
    }
  });

  // Calculate combined metrics
  const combined_score = reports.reduce((sum, r) => sum + r.overall_score, 0) / reports.length;
  // It only passes if ALL checkers pass
  const pass = reports.every(r => r.pass);
  
  // Extract all high/critical priority fixes across all reports
  const priority_fixes = reports.flatMap(r => 
    r.issues.filter(issue => issue.severity === 'high' || issue.severity === 'critical')
  );

  const suggestedRevisionTasks = priority_fixes
    .slice(0, 5)
    .map((issue, index) => `${index + 1}. ${issue.description} -> ${issue.suggestion}`);
  const guidedRevisionPrompt = suggestedRevisionTasks.length > 0
    ? [
        `Vá continuity và mạch cảm xúc cho chương ${chapterNumber}.`,
        'Ưu tiên xử lý theo thứ tự sau:',
        ...suggestedRevisionTasks,
        'Giữ nguyên cốt lõi nhịp truyện, chỉ sửa các điểm mâu thuẫn hoặc hụt nhịp đã nêu.',
      ].join('\n')
    : `Chương ${chapterNumber} đạt review. Chỉ cần chỉnh nhẹ câu chữ nếu muốn tăng độ mượt.`;

  return {
    chapterId,
    chapterNumber,
    reports,
    combined_score,
    pass,
    priority_fixes,
    suggestedRevisionTasks,
    guidedRevisionPrompt,
    reviewedAt: new Date().toISOString(),
  };
}
