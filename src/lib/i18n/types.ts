/**
 * File: types.ts
 * Purpose: Type definitions for i18n system
 * Layer: Core Library
 * Domain: i18n → [locale, translations]
 */

export type Locale = 'vi' | 'zh' | 'en';

export interface TranslationMap {
  /** Global / shared strings */
  common: {
    loading: string;
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    add: string;
    close: string;
    confirm: string;
    search: string;
    filter: string;
    all: string;
    none: string;
    yes: string;
    no: string;
    back: string;
    next: string;
    previous: string;
    create: string;
    update: string;
    export: string;
    import: string;
    copy: string;
    reset: string;
    submit: string;
    preview: string;
    settings: string;
    autoSave: string;
    guestMode: string;
    signOut: string;
  };

  /** Sidebar navigation */
  sidebar: {
    brand: string;
    tagline: string;
    currentProject: string;
    sections: {
      start: string;
      idea: string;
      foundation: string;
      draft: string;
      editing: string;
      advanced: string;
    };
    tabs: {
      studio: string;
      projects: string;
      brainstorm: string;
      adaptation: string;
      chuaCanon: string;
      bible: string;
      characters: string;
      world: string;
      outline: string;
      genreLibrary: string;
      writer: string;
      review: string;
      chapters: string;
      memory: string;
      foreshadowing: string;
      export: string;
      community: string;
      dashboard: string;
      aiSettings: string;
      editingTools: string;
    };
  };

  /** App header / top bar */
  app: {
    aiFirst: string;
    aiReady: string;
    missingApiKey: string;
    milestonesUnit: string;
    aiAssistant: string;
    assistantPromptPlaceholder: string;
    createFirstProject: string;
    studioDescription: string;
    nextStepPrefix: string;
  };

  /** Login page */
  login: {
    title: string;
    subtitle: string;
    loginWithGoogle: string;
    loginWithGithub: string;
    guestMode: string;
    guestWarning: string;
    or: string;
  };

  /** Studio page */
  studio: {
    heroTitle: string;
    heroDescription: string;
    openAiAssistant: string;
    goToWriter: string;
    nextStep: string;
    currentAi: string;
    projectProgress: string;
    chaptersUnit: string;
    progressFill: string;
    workflowTitle: string;
    workflowSubtitle: string;
    milestonesLocked: string;
    currentStatus: string;
    quickSuggestion: string;
    goToStep: string;
    projectMemory: string;
    quickOverview: string;
    latestChapter: string;
    noChaptersYet: string;
    noChaptersHint: string;
    openChapterList: string;
    whenNeeded: string;
    advancedTools: string;
    assistantChatAction: string;
    assistantChatActionDesc: string;
    assistantRouteAction: string;
    assistantRouteActionDesc: string;
    steps: {
      enableAi: string;
      enableAiDesc: string;
      aiReady: string;
      openAiSettings: string;
      canUseNow: string;
      missingApiKey: string;
      lockIdea: string;
      lockIdeaDesc: string;
      reopenIdea: string;
      brainstormNow: string;
      hasDirection: string;
      needStartPoint: string;
      buildFoundation: string;
      buildFoundationDesc: string;
      foundationReady: string;
      addProtagonist: string;
      addWorld: string;
      addOutline: string;
      coreParts: string;
      writeChapters: string;
      writeChaptersDesc: string;
      continueChapter: string;
      writeFirstChapter: string;
      chaptersExist: string;
      noDraft: string;
      reviewAndShip: string;
      reviewAndShipDesc: string;
      reviewLatestChapter: string;
      exportNow: string;
      reviewedChapters: string;
      reviewPending: string;
    };
    status: {
      ready: string;
      continue: string;
      needMore: string;
    };
    tools: {
      adaptationTitle: string;
      adaptationDesc: string;
      surgeryTitle: string;
      surgeryDesc: string;
      exportTitle: string;
      exportDesc: string;
    };
    metrics: {
      logline: string;
      characters: string;
      world: string;
      outline: string;
      chapters: string;
      hasIt: string;
      notYet: string;
      profiles: string;
      infoCluster: string;
      beats: string;
      drafts: string;
    };
    idea: string;
    ideaHas: string;
    ideaNo: string;
    foundation: string;
    draft: string;
    draftHas: string;
    draftNo: string;
    notReady: string;
    aiCanBrainstorm: string;
    addApiKeyHint: string;
  };

  /** Language switcher */
  language: {
    vi: string;
    zh: string;
    en: string;
    switchLanguage: string;
  };

  /** Projects page */
  projects: {
    title: string;
    newProject: string;
    duplicate: string;
    deleteConfirm: string;
    projectName: string;
    created: string;
    chapters: string;
    characters: string;
  };

  /** Bible page */
  bible: {
    title: string;
    logline: string;
    mainPlot: string;
    endgame: string;
    targetChapters: string;
    targetWords: string;
    genre: string;
    tone: string;
  };

  /** Characters page */
  characters: {
    title: string;
    addCharacter: string;
    name: string;
    role: string;
    description: string;
    traits: string;
    arc: string;
  };

  /** World page */
  world: {
    title: string;
    geography: string;
    magicSystem: string;
    rules: string;
    techLevel: string;
    factions: string;
  };

  /** Outline page */
  outline: {
    title: string;
    addBeat: string;
    beatTitle: string;
    beatDescription: string;
    moveBeat: string;
  };

  /** Writer page */
  writer: {
    title: string;
    generateChapter: string;
    wordCount: string;
    prompt: string;
  };

  /** Review page */
  review: {
    title: string;
    runReview: string;
    score: string;
    issues: string;
  };

  /** Chapters page */
  chaptersPage: {
    title: string;
    chapterNumber: string;
    status: string;
    wordCount: string;
  };

  /** Memory page */
  memory: {
    title: string;
    entities: string;
    facts: string;
  };

  /** Brainstorm page */
  brainstorm: {
    title: string;
    ideaInput: string;
    generate: string;
  };

  /** Foreshadowing page */
  foreshadowing: {
    title: string;
    addForeshadowing: string;
    planted: string;
    resolved: string;
    pending: string;
  };

  /** Export page */
  exportPage: {
    title: string;
    exportDocx: string;
    copyClipboard: string;
  };

  /** Community page */
  community: {
    title: string;
  };

  /** AI Settings page */
  aiSettings: {
    title: string;
    apiKey: string;
    selectModel: string;
    provider: string;
  };

  /** Genre Library */
  genreLibrary: {
    title: string;
  };

  /** Adaptation page */
  adaptation: {
    title: string;
  };

  /** Chữa Canon (merged surgery system) */
  chuaCanon: {
    title: string;
    tabPlan: string;
    tabScan: string;
    tabQueue: string;
    subtitle: string;
  };
  aiAssistantPanel: {
    statusEmpty: string;
    statusAiDraft: string;
    statusGenerating: string;
    statusIncomplete: string;
    statusEditing: string;
    statusWritten: string;
    statusComplete: string;
    statusPublished: string;
    actionContinue: string;
    actionExpand: string;
    actionRewrite: string;
    actionSummarizeChapter: string;
    actionSummarizeStory: string;
    tacticNovelPolish: string;
    tacticRewrite: string;
    tacticPromptConfirm: string;
    tacticPromptSubText: string;
    actionPromptPrefix: string;
    buttonApplyStory: string;
    buttonApply: string;
    buttonViewChanges: string;
    buttonCopy: string;
    tacticTasks: string;
    tacticTasksSub: string;
  };
}
