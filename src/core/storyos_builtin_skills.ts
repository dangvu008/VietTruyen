import type { SkillBody, SkillManifest } from './storyos_skill_registry';

const sourceRepo = 'dangvu008/VietTruyenAI';

const makeSkill = (
  manifest: Omit<SkillManifest, 'status'>,
  body: Omit<SkillBody, 'manifest'>,
): SkillBody => ({
  manifest: { ...manifest, status: 'active' },
  ...body,
});

/**
 * First StoryOS-native extraction set distilled from VietTruyenAI concepts.
 * These are intentionally rewritten as storage/model-neutral contracts rather than copied
 * Claude Code workflows. Notion can later provide newer versions using the same schema.
 */
export const storyOsBuiltinSkills: SkillBody[] = [
  makeSkill(
    {
      skillId: 'prose.opening-hook',
      version: '1.0.0',
      domain: 'prose',
      purpose: 'Strengthen the first beat of a chapter using tension, curiosity, or character voice without changing canon.',
      triggers: ['hook', 'mở đầu', 'mở chương', 'opening', 'tension', 'curiosity'],
      dependencies: [],
      authorityRequirements: ['chapter objective', 'current scene', 'POV character'],
      tokenBudget: 520,
      source: { repository: sourceRepo, path: 'webnovel-writer/skills/hook-optimizer/SKILL.md', sha: '1d5391c298ef4d1ed757c716d8a7dca9c17c0ea9' },
    },
    {
      hardRules: [
        'Do not invent a new canon fact, character, location, or event merely to make the opening stronger.',
        'The opening must remain causally compatible with the chapter objective and direct seam.',
      ],
      guidance: [
        'Prefer an immediate pressure, unresolved information gap, or distinctive POV reaction over generic setup.',
        'Expose enough context for orientation while preserving one meaningful unanswered question.',
        'When rewriting an existing opening, preserve downstream facts that the rest of the scene depends on.',
      ],
      antiPatterns: ['Long exposition before the first active beat.', 'Artificial mystery created by withholding facts the POV would naturally perceive.'],
      outputContract: 'Produce prose only; no scorecard, analysis, alternatives, or meta commentary unless explicitly requested.',
    },
  ),
  makeSkill(
    {
      skillId: 'prose.cliffhanger',
      version: '1.0.0',
      domain: 'prose',
      purpose: 'End a chapter on unresolved action, revelation, emotional choice, or moral pressure that naturally bridges forward.',
      triggers: ['cliffhanger', 'kết chương', 'ending', 'câu móc', 'chương kế'],
      dependencies: [],
      authorityRequirements: ['chapter objective', 'next beat', 'open loops'],
      tokenBudget: 520,
      source: { repository: sourceRepo, path: 'webnovel-writer/skills/cliffhanger-generator/SKILL.md', sha: '2c456a7fc79fc846c271171411da4d801ad56f03' },
    },
    {
      hardRules: [
        'Do not create a false cliffhanger by introducing unsupported danger, secrets, or characters.',
        'Do not resolve the central pressure and then append an unrelated teaser.',
      ],
      guidance: [
        'Prefer unresolved consequence over arbitrary interruption.',
        'A revelation should reinterpret established material rather than contradict authority state.',
        'An emotional ending should force a value-laden decision or irreversible relational pressure grounded in prior setup.',
      ],
      antiPatterns: ['Random last-line threat.', 'Melodrama without setup.', 'Explaining the cliffhanger after landing it.'],
      outputContract: 'Produce the chapter ending as prose, preserving continuity and the planned bridge into the next beat.',
    },
  ),
  makeSkill(
    {
      skillId: 'review.character',
      version: '1.0.0',
      domain: 'review',
      purpose: 'Check whether character behavior, motivation, state, voice, and presence remain consistent with authority context.',
      triggers: ['character', 'nhân vật', 'ooc', 'motivation', 'động cơ'],
      dependencies: [],
      authorityRequirements: ['relevant characters', 'character state', 'scene objective'],
      tokenBudget: 560,
      source: { repository: sourceRepo, path: 'webnovel-writer/agents/reviewer.md', sha: 'f94438f79243befca9e8f64b31d3944dcd54a725' },
    },
    {
      hardRules: ['Report only checkable inconsistencies; do not rewrite prose or invent missing character facts.'],
      guidance: ['Check motivation continuity, behavior vs traits/current stage, dialogue voice, and whether new arrivals have a plausible scene entry.'],
      antiPatterns: ['Calling a subjective taste issue a canon violation.', 'Recommending a different plot merely because it seems more dramatic.'],
      outputContract: 'Return structured findings with severity, evidence, and a minimal fix hint.',
    },
  ),
  makeSkill(
    {
      skillId: 'review.knowledge-boundary',
      version: '1.0.0',
      domain: 'review',
      purpose: 'Detect information used by a character or narrator before that information is legitimately available in story knowledge.',
      triggers: ['knowledge', 'biết', 'thông tin', 'pov', 'narrator', 'lộ tên'],
      dependencies: ['review.character'],
      authorityRequirements: ['POV knowledge', 'revealed facts', 'recent chapter capsules'],
      tokenBudget: 520,
      source: { repository: sourceRepo, path: 'webnovel-writer/agents/reviewer.md', sha: 'f94438f79243befca9e8f64b31d3944dcd54a725' },
    },
    {
      hardRules: ['A setting database fact is not automatically known by the POV character or reader.', 'Do not infer disclosure unless authority or prose provides evidence.'],
      guidance: ['Check names, identities, secrets, locations, intentions, and causal knowledge against what has actually been perceived or revealed.'],
      antiPatterns: ['Treating author knowledge as character knowledge.', 'Flagging ordinary inference when the prose provides sufficient observable evidence.'],
      outputContract: 'Return only knowledge-boundary findings with exact evidence and the missing disclosure/observation needed.',
    },
  ),
  makeSkill(
    {
      skillId: 'review.timeline',
      version: '1.0.0',
      domain: 'review',
      purpose: 'Check temporal continuity, deadlines, travel/scene transitions, and impossible simultaneous presence.',
      triggers: ['timeline', 'thời gian', 'deadline', 'đếm ngược', 'ngày', 'đêm', 'travel'],
      dependencies: [],
      authorityRequirements: ['time anchor', 'recent events', 'character locations'],
      tokenBudget: 500,
      source: { repository: sourceRepo, path: 'webnovel-writer/agents/reviewer.md', sha: 'f94438f79243befca9e8f64b31d3944dcd54a725' },
    },
    {
      hardRules: ['Do not fabricate timestamps to make a contradiction disappear.', 'Only block when the contradiction is supported by authority/prose evidence.'],
      guidance: ['Check sequence, elapsed time, countdowns, overnight transitions, travel plausibility, and concurrent character locations.'],
      antiPatterns: ['Over-policing vague time when no hard anchor exists.'],
      outputContract: 'Return temporal findings with before/after evidence and severity.',
    },
  ),
  makeSkill(
    {
      skillId: 'planning.chapter-beats',
      version: '1.0.0',
      domain: 'planning',
      purpose: 'Turn a chapter objective into a small causal beat sequence with pressure, change, and a forward bridge.',
      triggers: ['beat', 'chapter plan', 'chương', 'outline', 'dàn ý chương', 'node'],
      dependencies: [],
      authorityRequirements: ['chapter objective', 'volume/arc objective', 'current state'],
      tokenBudget: 650,
      source: { repository: sourceRepo, path: 'webnovel-writer/skills/webnovel-plan/references/outlining/chapter-planning.md', sha: '70b4fd0e0a572048ca4cf78ea075d61f8ba8cf22' },
    },
    {
      hardRules: ['Do not rewrite established canon or silently change the parent arc objective.', 'Every planned beat must be causally connected to the chapter objective.'],
      guidance: ['Prefer 3-7 beats: entry pressure, escalation/choice, consequence, and exit bridge.', 'Ensure at least one meaningful state, relationship, cost, or knowledge change.'],
      antiPatterns: ['A list of disconnected cool moments.', 'Repeating setup without a chapter-level change.'],
      outputContract: 'Return a concise ordered beat plan with goal, pressure, consequence, and exit state.',
    },
  ),
  makeSkill(
    {
      skillId: 'planning.foreshadowing',
      version: '1.0.0',
      domain: 'planning',
      purpose: 'Plant, maintain, or pay off open narrative promises without exposing future canon prematurely.',
      triggers: ['foreshadow', 'phục bút', 'gợi trước', 'open loop', 'payoff', 'móc'],
      dependencies: ['planning.chapter-beats'],
      authorityRequirements: ['open loops', 'resolved loops', 'future constraints'],
      tokenBudget: 560,
      source: { repository: sourceRepo, path: 'webnovel-writer/skills/webnovel-query/references/advanced/foreshadowing.md', sha: '31a62f5739cd299afaad81a9736cc803c68dc817' },
    },
    {
      hardRules: ['Never reopen a loop already marked resolved unless authority explicitly reactivates it.', 'A plant must not reveal the hidden answer it is meant to foreshadow.'],
      guidance: ['Prefer a small observable anomaly, promise, object, behavior, or consequence that has present-scene value as well as future value.', 'Prioritize overdue or high-urgency loops before adding new ones.'],
      antiPatterns: ['Cryptic detail with no present meaning.', 'Planting many new mysteries while old promises remain unpaid.'],
      outputContract: 'Return proposed plant/payoff beats tied to existing loop IDs when available.',
    },
  ),
  makeSkill(
    {
      skillId: 'memory.author-feedback',
      version: '1.0.0',
      domain: 'memory',
      purpose: 'Convert explicit author feedback into reusable actionable writing preferences with bounded scope.',
      triggers: ['lần sau', 'đừng viết', 'tôi thích', 'ưu tiên', 'feedback', 'ghi nhớ'],
      dependencies: [],
      authorityRequirements: [],
      tokenBudget: 420,
      source: { repository: sourceRepo, path: 'webnovel-writer/skills/webnovel-learn/SKILL.md', sha: 'db9c35fb3656d1b32759044bba6af0a7a3a17389' },
    },
    {
      hardRules: ['Do not convert operational commands into writing preferences.', 'Do not promote a story-specific preference to global scope without evidence.'],
      guidance: ['Classify feedback as global, genre, project, arc, or chapter scope.', 'Store an actionable lesson rather than a transcript dump.', 'Deduplicate exact or semantically equivalent lessons before adding a new one.'],
      antiPatterns: ['Saving entire chat logs.', 'Treating temporary instructions as permanent author taste.'],
      outputContract: 'Return a compact memory proposal: scope, category, lesson, importance, and source context.',
    },
  ),
];

export const storyOsBuiltinManifests: SkillManifest[] = storyOsBuiltinSkills.map((skill) => skill.manifest);
export const storyOsBuiltinBodies: Record<string, SkillBody> = Object.fromEntries(
  storyOsBuiltinSkills.map((skill) => [skill.manifest.skillId, skill]),
);
