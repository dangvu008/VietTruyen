import type { HybridMemoryResult } from '../../types/memory_embedding';

export interface LegacyHybridMemorySections {
  hardCanon: string[];
  graphContext: string[];
  semanticContext: string[];
  provenanceContext: string[];
  warnings: string[];
}

function packBodies(pack: HybridMemoryResult['canonPack']): string[] {
  return pack.map((item) => item.body).filter(Boolean);
}

function packLinesWithTitle(pack: HybridMemoryResult['graphPack']): string[] {
  return pack.flatMap((item, index) => {
    const lines: string[] = [];
    if (item.title.trim()) {
      lines.push(`${index + 1}. ${item.title.trim()}`);
    }
    if (item.body.trim()) {
      lines.push(item.body.trim());
    }
    return lines;
  });
}

export function getLegacyHybridMemorySections(result: HybridMemoryResult): LegacyHybridMemorySections {
  return {
    hardCanon: [
      ...packBodies(result.canonPack),
      ...packBodies(result.statePack),
      ...packBodies(result.hookPack),
      ...packBodies(result.riskPack),
    ],
    graphContext: packLinesWithTitle(result.graphPack),
    semanticContext: packBodies(result.semanticPack),
    provenanceContext: packBodies(result.provenancePack),
    warnings: result.warnings,
  };
}
