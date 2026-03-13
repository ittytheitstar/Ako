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
  };
  return map[modname] ?? 'page';
}

export function mapRole(moodleRole: string): string {
  if (['editingteacher', 'teacher'].includes(moodleRole)) return 'teacher';
  if (['ta', 'non-editing-teacher'].includes(moodleRole)) return 'ta';
  return 'student';
}
