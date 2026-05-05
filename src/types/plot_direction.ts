import type { SurgeryPolicy } from './surgery';

export type PlotDirectionRisk = 'low' | 'medium' | 'high';

export type PlotDirectionStance = 'preserve' | 'pivot' | 'twist' | 'experimental';

export interface PlotDirectionOption {
  id: string;
  title: string;
  stance: PlotDirectionStance;
  summary: string;
  riskLevel: PlotDirectionRisk;
  affectedRange: string;
  rewritePolicy: SurgeryPolicy | 'review';
  downstreamImpact: string[];
  tradeoffs: string[];
  whyChoose: string;
}

export interface SelectedPlotDirection extends PlotDirectionOption {
  selectedAt: string;
}

export interface PlotDirectionPreviewResult {
  decisionSummary: string;
  directions: PlotDirectionOption[];
}
