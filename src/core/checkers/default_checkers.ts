import { checkerRegistry } from './checker_registry';
import { buildHighPointCheckerPrompt, parseHighPointReport } from './high_point_checker';
import { buildOocCheckerPrompt, parseOocReport } from './ooc_checker';
import { buildPacingCheckerPrompt, parsePacingReport } from './pacing_checker';
import { buildReaderPullCheckerPrompt, parseReaderPullReport } from './reader_pull_checker';
import { buildConsistencyCheckerPrompt, parseConsistencyReport } from './consistency_checker';
import { buildContinuityCheckerPrompt, parseContinuityReport } from './continuity_checker';
import { buildGoldenThreeCheckerPrompt, parseGoldenThreeReport } from './golden_three_checker';

export function initDefaultCheckers() {
  if (checkerRegistry.getCheckers().length > 0) return;

  checkerRegistry.register({
    name: 'high_point',
    buildPrompt: (ctx) => buildHighPointCheckerPrompt(ctx.chapterText, ctx.chapterNumber, ctx.genreProfile),
    parseReport: parseHighPointReport,
  });

  checkerRegistry.register({
    name: 'ooc',
    buildPrompt: (ctx) => buildOocCheckerPrompt(ctx.chapterText, ctx.chapterNumber, ctx.characters),
    parseReport: parseOocReport,
  });

  checkerRegistry.register({
    name: 'pacing',
    buildPrompt: (ctx) => buildPacingCheckerPrompt(ctx.chapterText, ctx.chapterNumber, ctx.strandTracker),
    parseReport: parsePacingReport,
  });

  checkerRegistry.register({
    name: 'reader_pull',
    buildPrompt: (ctx) => buildReaderPullCheckerPrompt(ctx.chapterText, ctx.chapterNumber, ctx.genreProfile),
    parseReport: parseReaderPullReport,
  });

  checkerRegistry.register({
    name: 'consistency',
    buildPrompt: (ctx) => buildConsistencyCheckerPrompt(ctx.chapterText, ctx.chapterNumber, ctx.systemStateContext),
    parseReport: parseConsistencyReport,
  });

  checkerRegistry.register({
    name: 'continuity',
    buildPrompt: (ctx) => buildContinuityCheckerPrompt(ctx.chapterText, ctx.chapterNumber, ctx.previousSummary, ctx.activeThreads),
    parseReport: parseContinuityReport,
  });

  checkerRegistry.register({
    name: 'golden_three',
    buildPrompt: (ctx) => buildGoldenThreeCheckerPrompt(ctx.chapterText, ctx.chapterNumber, ctx.genreProfile),
    parseReport: parseGoldenThreeReport,
  });
}
