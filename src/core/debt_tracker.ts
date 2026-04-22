/**
 * File: debt_tracker.ts
 * Purpose: Override Contract + debt system for reader pull violations
 * Layer: Core
 * Domain: Data Agent
 */

export interface OverrideContract {
  id: string;
  projectId: string;
  rationaleType: string;
  paybackPlan: string;
  dueChapter: number;
  debtBalance: number;
  createdAt: string;
}

export interface DebtSystem {
  contracts: OverrideContract[];
  accrueInterest: (currentChapter: number) => void;
  createContract: (contract: Omit<OverrideContract, 'id' | 'createdAt'>) => OverrideContract;
  getOverdue: (currentChapter: number) => OverrideContract[];
}

export const createDebtTracker = (initialContracts: OverrideContract[] = []): DebtSystem => {
  const contracts = [...initialContracts];

  const accrueInterest = (currentChapter: number) => {
    contracts.forEach(contract => {
      if (contract.dueChapter < currentChapter && contract.debtBalance > 0) {
        // Accrue interest: 10% per chapter late
        contract.debtBalance = Math.ceil(contract.debtBalance * 1.1);
      }
    });
  };

  const createContract = (contractData: Omit<OverrideContract, 'id' | 'createdAt'>) => {
    const contract: OverrideContract = {
      ...contractData,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString()
    };
    contracts.push(contract);
    return contract;
  };

  const getOverdue = (currentChapter: number) => {
    return contracts.filter(c => c.dueChapter < currentChapter && c.debtBalance > 0);
  };

  return { contracts, accrueInterest, createContract, getOverdue };
};
