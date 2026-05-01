import type { SceneMindState, SceneEmotionStage } from '../../types/ghostwriter';
import type { Project, Character } from '../../types/story';
import type { SceneTypeResult, SceneType } from './scene_type_classifier';
import type { MemoryRouteResult } from './scene_memory_router';

function pickPovCharacter(project: Project, targetChapterIndex: number, route: MemoryRouteResult): Character | undefined {
  const beat = project.outline?.[targetChapterIndex];
  const focusText = `${beat?.focus || ''} ${beat?.summary || ''}`.toLowerCase();
  const focusMatch = (project.characters || []).find((character) =>
    [character.name, ...(character.aliases || [])]
      .map((value) => value.toLowerCase())
      .some((name) => name && focusText.includes(name))
  );

  if (focusMatch) return focusMatch;
  if (route.deepLoadEntityIds.length > 0) {
    return (project.characters || []).find((character) => character.id === route.deepLoadEntityIds[0]);
  }
  return project.characters?.[0];
}

function getOtherActors(project: Project, povCharacterId: string, route: MemoryRouteResult): Character[] {
  return route.deepLoadEntityIds
    .filter((entityId) => entityId !== povCharacterId)
    .map((entityId) => (project.characters || []).find((character) => character.id === entityId))
    .filter((character): character is Character => Boolean(character));
}

function buildBodyState(sceneType: SceneType): string {
  switch (sceneType) {
    case 'combat':
      return 'Hơi thở bị xé vụn, vai căng cứng, các ngón tay luôn chực siết lại.';
    case 'emotion':
      return 'Nhịp thở chùng xuống rồi hụt đi, cổ họng nghẹn nhẹ, ánh mắt khó giữ yên.';
    case 'intrigue':
      return 'Vai vẫn thả lỏng nhưng tay không rời điểm tựa, từng nhịp thở đều mang ý dò xét.';
    case 'exploration':
      return 'Bước chân chậm lại theo từng biến động nhỏ, tai lắng nghe kỹ hơn mắt nhìn.';
    case 'cultivation':
      return 'Khí tức dồn ép bên trong, mạch đập nặng dần như chạm sát ngưỡng bùng nổ.';
    case 'dialogue':
      return 'Giọng có thể giữ bình, nhưng nhịp thở và cái nhìn vẫn tố ra độ đề phòng.';
    case 'transition':
    default:
      return 'Nhịp thở giữ đều bề ngoài, nhưng thân thể vẫn mang dư âm của cảnh trước.';
  }
}

function buildEmotionCurve(sceneType: SceneType, secondary?: SceneType): SceneEmotionStage[] {
  const base: Record<SceneType, SceneEmotionStage[]> = {
    combat: ['guarded', 'tense', 'surprised'],
    emotion: ['guarded', 'tense', 'ashamed', 'relieved'],
    intrigue: ['guarded', 'tense', 'surprised'],
    exploration: ['guarded', 'surprised', 'resolved'],
    cultivation: ['guarded', 'tense', 'resolved'],
    dialogue: ['guarded', 'tense', 'relieved'],
    transition: ['guarded', 'resolved'],
  };

  const merged = [...base[sceneType]];
  if (secondary) {
    for (const stage of base[secondary]) {
      if (!merged.includes(stage)) merged.push(stage);
    }
  }
  return merged;
}

export function buildSceneMindState(
  project: Project,
  targetChapterIndex: number,
  sceneType: SceneTypeResult,
  route: MemoryRouteResult
): SceneMindState {
  const beat = project.outline?.[targetChapterIndex];
  const pov = pickPovCharacter(project, targetChapterIndex, route);
  const povName = pov?.name || 'Nhân vật POV';
  const otherActors = getOtherActors(project, pov?.id || '', route);
  const primaryOtherName = otherActors[0]?.name;

  const want = beat?.summary
    ? `${povName} muốn ${beat.summary.charAt(0).toLowerCase()}${beat.summary.slice(1)}`
    : `${povName} muốn giữ thế chủ động trong cảnh này.`;

  const fear = primaryOtherName
    ? `${povName} sợ lộ điểm yếu hoặc ý định thật để ${primaryOtherName} kịp nhìn ra.`
    : `${povName} sợ lộ điểm yếu trước khi kịp nắm thế chủ động.`;

  const relationshipTension = otherActors.length > 0
    ? otherActors.map((character) => `${character.name} ép cảnh bằng hiện diện, buộc ${povName} phải giấu phản ứng thật.`)
    : [`Không khí xung quanh buộc ${povName} phải giữ kín phản ứng thật cho tới phút cuối.`];

  return {
    povCharacterId: pov?.id || 'pov-unknown',
    want,
    fear,
    misbelief: sceneType.primary === 'emotion'
      ? `${povName} tin rằng bộc lộ thật lòng lúc này sẽ khiến mình yếu thế hơn.`
      : undefined,
    bodyState: buildBodyState(sceneType.primary),
    relationshipTension,
    suppressedThought: primaryOtherName
      ? `${povName} không muốn ${primaryOtherName} biết mình đã chuẩn bị đến bước nào.`
      : `${povName} không muốn đối phương biết mình đang dao động ở đâu.`,
    emotionCurve: buildEmotionCurve(sceneType.primary, sceneType.secondary ?? undefined),
  };
}

export function renderSceneMindSection(state: SceneMindState, project: Project): string {
  const povName = (project.characters || []).find((character) => character.id === state.povCharacterId)?.name || 'POV';
  const lines = [
    '## BẢN ĐỒ TÂM LÝ CẢNH',
    `- POV: ${povName}`,
    `- Muốn: ${state.want}`,
    `- Sợ: ${state.fear}`,
    state.misbelief ? `- Ngộ nhận: ${state.misbelief}` : '',
    `- Cơ thể: ${state.bodyState}`,
    `- Ý nghĩ bị nén: ${state.suppressedThought || 'Giữ lại thay vì nói thẳng.'}`,
    `- Đường cảm xúc: ${state.emotionCurve.join(' -> ')}`,
    ...state.relationshipTension.map((item) => `- Căng kéo quan hệ: ${item}`),
  ].filter(Boolean);

  return lines.join('\n');
}
