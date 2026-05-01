import type { CheckerReport, CheckerContext } from './checker_types';

export interface IChecker {
  name: string;
  buildPrompt(context: CheckerContext): { system: string; user: string };
  parseReport(aiResponse: string): CheckerReport;
}

class CheckerRegistry {
  private checkers: IChecker[] = [];

  register(checker: IChecker) {
    this.checkers.push(checker);
  }

  getCheckers(): IChecker[] {
    return this.checkers;
  }
}

export const checkerRegistry = new CheckerRegistry();
