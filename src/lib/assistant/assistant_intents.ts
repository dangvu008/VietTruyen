export type AssistantIntent =
  | 'clarify_idea'
  | 'open_writer'
  | 'draft_brief'
  | 'update_bible'
  | 'update_characters'
  | 'update_world'
  | 'create_outline'
  | 'review_latest_chapter';

export const ASSISTANT_HANDOFF_ROUTES = [
  'writer',
  'bible',
  'characters',
  'outline',
] as const;

export type AssistantHandoffRoute = (typeof ASSISTANT_HANDOFF_ROUTES)[number];

export function isAssistantHandoffRoute(value: unknown): value is AssistantHandoffRoute {
  return typeof value === 'string' && ASSISTANT_HANDOFF_ROUTES.includes(value as AssistantHandoffRoute);
}

export interface AssistantRoutePayloadMap {
  writer: {
    chapterTitle?: string;
    chapterGoal?: string;
    chapterBrief?: string;
  };
  bible: {
    logline?: string;
    mainPlot?: string;
    endgame?: string;
    genre?: string;
    tone?: string;
    worldSetting?: string;
    characterSetup?: string;
  };
  characters: {
    name?: string;
    role?: string;
    arc?: string;
    currentStage?: string;
    description?: string;
    traits?: string | string[];
  };
  outline: {
    title?: string;
    summary?: string;
    focus?: string;
    beats?: Array<{
      title: string;
      summary: string;
      focus?: string;
    }>;
  };
}
