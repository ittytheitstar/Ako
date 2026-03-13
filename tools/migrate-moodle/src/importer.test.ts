import { describe, it, expect } from 'vitest';
import { emptyResult } from '../src/types';
import { mapRole, mapModuleType } from '../src/importer-helpers';

describe('emptyResult', () => {
  it('should return zeroed counters', () => {
    const r = emptyResult();
    expect(r.courses).toBe(0);
    expect(r.sections).toBe(0);
    expect(r.modules).toBe(0);
    expect(r.warnings).toEqual([]);
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
});
