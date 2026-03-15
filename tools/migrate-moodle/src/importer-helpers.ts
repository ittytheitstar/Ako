/**
 * Pure helper functions extracted from the importer for testability.
 */

export function mapModuleType(modname: string): string {
  const map: Record<string, string> = {
    page: 'page',
    resource: 'file',
    forum: 'forum',
    assign: 'assignment',
    quiz: 'quiz',
    lti: 'lti',
    scorm: 'scorm',
    // Phase 11 activity types
    lesson: 'page',
    choice: 'page',
    glossary: 'page',
    wiki: 'page',
    workshop: 'assignment',
    // Other common Moodle modules
    label: 'page',
    url: 'page',
    book: 'page',
    folder: 'file',
    h5pactivity: 'page',
    imscp: 'page',
    feedback: 'assignment',
    survey: 'assignment',
    chat: 'forum',
  };
  return map[modname] ?? 'page';
}

export function mapRole(moodleRole: string): string {
  if (['editingteacher', 'teacher'].includes(moodleRole)) return 'teacher';
  if (['ta', 'non-editing-teacher'].includes(moodleRole)) return 'ta';
  return 'student';
}

/** Map a Moodle question type to an Ako question type. */
export function mapQuestionType(moodleType: string): string {
  const map: Record<string, string> = {
    multichoice: 'multiple_choice',
    truefalse: 'true_false',
    shortanswer: 'short_answer',
    essay: 'essay',
    numerical: 'numerical',
    match: 'matching',
    multianswer: 'multiple_choice',
    calculated: 'numerical',
    description: 'essay',
  };
  return map[moodleType] ?? 'essay';
}
