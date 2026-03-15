import { describe, it, expect } from 'vitest';
import { emptyResult } from '../src/types';
import { mapRole, mapModuleType, mapQuestionType } from '../src/importer-helpers';

describe('emptyResult', () => {
  it('should return zeroed counters', () => {
    const r = emptyResult();
    expect(r.courses).toBe(0);
    expect(r.sections).toBe(0);
    expect(r.modules).toBe(0);
    expect(r.warnings).toEqual([]);
  });
  it('should include Phase 9 and Phase 11 counters', () => {
    const r = emptyResult();
    expect(r.questionCategories).toBe(0);
    expect(r.questions).toBe(0);
    expect(r.gradeCategories).toBe(0);
    expect(r.gradeItems).toBe(0);
    expect(r.lessons).toBe(0);
    expect(r.choices).toBe(0);
    expect(r.glossaries).toBe(0);
    expect(r.wikis).toBe(0);
  });
});

describe('mapRole', () => {
  it('maps editingteacher to teacher', () => {
    expect(mapRole('editingteacher')).toBe('teacher');
  });
  it('maps teacher to teacher', () => {
    expect(mapRole('teacher')).toBe('teacher');
  });
  it('maps student to student', () => {
    expect(mapRole('student')).toBe('student');
  });
  it('maps unknown roles to student', () => {
    expect(mapRole('guest')).toBe('student');
  });
});

describe('mapModuleType', () => {
  it('maps forum to forum', () => {
    expect(mapModuleType('forum')).toBe('forum');
  });
  it('maps assign to assignment', () => {
    expect(mapModuleType('assign')).toBe('assignment');
  });
  it('maps unknown to page', () => {
    expect(mapModuleType('label')).toBe('page');
  });
  it('maps Phase 11 activity types', () => {
    expect(mapModuleType('lesson')).toBe('page');
    expect(mapModuleType('choice')).toBe('page');
    expect(mapModuleType('glossary')).toBe('page');
    expect(mapModuleType('wiki')).toBe('page');
    expect(mapModuleType('workshop')).toBe('assignment');
  });
});

describe('mapQuestionType', () => {
  it('maps multichoice to multiple_choice', () => {
    expect(mapQuestionType('multichoice')).toBe('multiple_choice');
  });
  it('maps truefalse to true_false', () => {
    expect(mapQuestionType('truefalse')).toBe('true_false');
  });
  it('maps essay to essay', () => {
    expect(mapQuestionType('essay')).toBe('essay');
  });
  it('maps shortanswer to short_answer', () => {
    expect(mapQuestionType('shortanswer')).toBe('short_answer');
  });
  it('maps unknown types to essay', () => {
    expect(mapQuestionType('unknown_type')).toBe('essay');
  });
});
