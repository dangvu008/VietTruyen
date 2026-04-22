import { getImpactScan, getSurgerySpec, storeSurgerySpec } from '../../db/narrative_db';
import { getProjectSnapshot, useProjectStore } from '../../store/use_project_store';
import type { CanonFreezeResult, RemovalDirective } from '../../types/surgery';
import type { Character, Project } from '../../types/story';

function inheritRoleNote(character: Character, directive: RemovalDirective): Character {
  const addition = directive.notes?.trim()
    ? `Kế thừa vai trò từ ${directive.targetLabel}. Ghi chú: ${directive.notes.trim()}`
    : `Kế thừa vai trò từ ${directive.targetLabel}.`;

  const nextTraits = [character.traits, addition].filter(Boolean).join(' ');
  return {
    ...character,
    traits: nextTraits.trim(),
  };
}

function applyDirective(project: Project, directive: RemovalDirective): Project {
  if (directive.targetType === 'character' && directive.targetId) {
    const target = project.characters.find((character) => character.id === directive.targetId);
    if (!target) return project;

    let characters = project.characters.filter((character) => character.id !== directive.targetId);
    if (directive.replacement?.replacementEntityId) {
      characters = characters.map((character) =>
        character.id === directive.replacement?.replacementEntityId
          ? inheritRoleNote(character, directive)
          : character
      );
    }

    const foreshadowings = project.foreshadowings.map((foreshadowing) => {
      if (foreshadowing.relatedEntityId !== directive.targetId) return foreshadowing;
      if (directive.replacement?.replacementEntityId) {
        return {
          ...foreshadowing,
          relatedEntityId: directive.replacement.replacementEntityId,
          description: `${foreshadowing.description} [Canon v${project.canonVersion + 1}: thay vai ${directive.targetLabel}]`,
        };
      }
      return {
        ...foreshadowing,
        isResolved: true,
        description: `${foreshadowing.description} [Đóng thread do loại bỏ ${directive.targetLabel}]`,
      };
    });

    return {
      ...project,
      characters,
      foreshadowings,
    };
  }

  if (directive.targetType === 'foreshadowing' && directive.targetId) {
    return {
      ...project,
      foreshadowings: project.foreshadowings.filter((item) => item.id !== directive.targetId),
    };
  }

  const note = directive.notes?.trim()
    ? `[Canon surgery] ${directive.targetLabel}: ${directive.notes.trim()}`
    : `[Canon surgery] ${directive.targetLabel}: áp policy ${directive.policy}`;

  return {
    ...project,
    notes: [project.notes, note].filter(Boolean).join('\n'),
  };
}

export async function freezeCanon(projectId: string, specId: string): Promise<CanonFreezeResult> {
  const [project, spec] = await Promise.all([
    getProjectSnapshot(projectId),
    getSurgerySpec(specId),
  ]);

  if (!project) {
    throw new Error('Không tìm thấy dự án để freeze canon.');
  }

  if (!spec) {
    throw new Error('Không tìm thấy Surgery Spec để freeze canon.');
  }

  const scanId = spec.scanId || project.lastImpactScanId;
  if (!scanId) {
    throw new Error('Cần chạy impact scan trước khi freeze canon.');
  }

  const scan = await getImpactScan(scanId);
  if (!scan) {
    throw new Error('Không tìm thấy kết quả impact scan.');
  }

  if (scan.blockedDirectiveIds.length > 0) {
    throw new Error('Impact scan đang blocked; cần đổi policy trước khi freeze canon.');
  }

  const nextProject = spec.directives.reduce((draft, directive) => applyDirective(draft, directive), project);
  const nextCanonVersion = (project.canonVersion || 1) + 1;
  const notes = [
    `[Canon v${nextCanonVersion}] Freeze từ spec "${spec.title}"`,
    ...spec.directives.map((directive) => `- ${directive.targetLabel}: ${directive.policy}`),
  ];

  useProjectStore.getState().updateProject(projectId, {
    characters: nextProject.characters,
    foreshadowings: nextProject.foreshadowings,
    notes: [nextProject.notes, ...notes].filter(Boolean).join('\n'),
    canonVersion: nextCanonVersion,
    activeSurgerySpecId: spec.id,
    lastImpactScanId: scan.id,
  });

  await storeSurgerySpec({
    ...spec,
    status: 'canon_frozen',
    canonVersionApplied: nextCanonVersion,
    frozenProjectSnapshot: {
      characters: nextProject.characters,
      foreshadowings: nextProject.foreshadowings,
      notes: nextProject.notes,
    },
    updatedAt: new Date().toISOString(),
  });

  return {
    projectId,
    specId,
    canonVersion: nextCanonVersion,
    notes,
  };
}
