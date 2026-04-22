/**
 * File: debt_tracker.ts
 * Purpose: Track creative debt and reader-pull overrides
 * Layer: Policy / Memory
 */

// Draft structures for Debt Tracker

export interface OverrideContract {
  id: string;
  rationaleType: 'setup_payoff' | 'pacing_intentional' | 'worldbuilding_heavy';
  paybackPlan: string;
  dueChapter: number;
  initialDebt: number;
  currentDebtBalance: number;
  resolved: boolean;
}

export interface DebtState {
  contracts: OverrideContract[];
}

export function accrueInterest(currentChapter: number, state: DebtState): DebtState {
  const updatedContracts = state.contracts.map(contract => {
    if (contract.resolved) return contract;
    
    // Nếu quá hạn thì bắt đầu tính lãi (interest rate: 10% per chapter overdue)
    if (currentChapter > contract.dueChapter) {
      const overdueChapters = currentChapter - contract.dueChapter;
      const interestMultiplier = 1 + (0.1 * overdueChapters); // Simple linear interest for now
      return {
        ...contract,
        currentDebtBalance: contract.initialDebt * interestMultiplier
      };
    }
    return contract;
  });

  return { contracts: updatedContracts };
}

export function resolveDebt(contractId: string, state: DebtState): DebtState {
  return {
    contracts: state.contracts.map(c => c.id === contractId ? { ...c, resolved: true, currentDebtBalance: 0 } : c)
  };
}
