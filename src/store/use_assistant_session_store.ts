import { create } from 'zustand';
import type { AssistantHandoffRoute, AssistantRoutePayloadMap } from '../lib/assistant/assistant_intents';

export interface AssistantSessionState {
  currentGoal: string | null;
  clarifiedBrief: string | null;
  pendingRoute: AssistantHandoffRoute | null;
  draftPayload: any | null;
  hasAvailableHandoff: boolean;

  setHandoff: <K extends keyof AssistantRoutePayloadMap>(
    route: K,
    payload: any,
    brief?: string
  ) => void;
  consumeHandoff: <K extends keyof AssistantRoutePayloadMap>(
    route: K,
  ) => { payload: any; brief: string | null } | null;
  clearHandoff: () => void;
}

export const useAssistantSessionStore = create<AssistantSessionState>((set, get) => ({
  currentGoal: null,
  clarifiedBrief: null,
  pendingRoute: null,
  draftPayload: null,
  hasAvailableHandoff: false,

  setHandoff: (route, payload, brief) => {
    set({
      pendingRoute: route as AssistantHandoffRoute,
      draftPayload: payload,
      clarifiedBrief: brief || null,
      hasAvailableHandoff: true,
    });
  },

  consumeHandoff: (route) => {
    const { pendingRoute, draftPayload, clarifiedBrief } = get();
    if (pendingRoute === route && draftPayload) {
      set({
        pendingRoute: null,
        draftPayload: null,
        clarifiedBrief: null,
        hasAvailableHandoff: false,
      });
      return { payload: draftPayload, brief: clarifiedBrief };
    }
    return null;
  },

  clearHandoff: () => {
    set({
      currentGoal: null,
      clarifiedBrief: null,
      pendingRoute: null,
      draftPayload: null,
      hasAvailableHandoff: false,
    });
  },
}));
