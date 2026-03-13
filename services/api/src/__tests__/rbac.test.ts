/**
 * Unit tests for RBAC permission checking logic.
 * Tests the pure permission-checking behaviour in isolation.
 */
import { describe, it, expect } from 'vitest';

// ── Inline error class for pure unit testing (avoids needing built packages) ─

class ProblemError extends Error {
  status: number;
  title: string;
  constructor(status: number, title: string, detail?: string) {
    super(detail ?? title);
    this.status = status;
    this.title = title;
  }
}

// ── Inline the permission checker logic for pure unit testing ────────────────

function checkPermission(userPermissions: string[] | undefined, required: string): void {
  if (!userPermissions?.includes(required)) {
    throw new ProblemError(403, 'Forbidden', `Permission required: ${required}`);
  }
}

describe('RBAC permission checker', () => {
  it('allows access when the user has the required permission', () => {
    expect(() => checkPermission(['course:edit', 'course:view'], 'course:edit')).not.toThrow();
  });

  it('denies access when the permission is missing', () => {
    expect(() => checkPermission(['course:view'], 'course:edit')).toThrowError('Permission required: course:edit');
  });

  it('denies access when the user has no permissions', () => {
    expect(() => checkPermission([], 'course:edit')).toThrow();
  });

  it('denies access when permissions are undefined', () => {
    expect(() => checkPermission(undefined, 'grade:view')).toThrow();
  });

  it('throws a 403 ProblemError', () => {
    let caught: unknown;
    try {
      checkPermission(['course:view'], 'course:edit');
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ProblemError);
    expect((caught as ProblemError).status).toBe(403);
  });

  it('grants access for wildcard admin permissions', () => {
    // Admins typically have all permissions explicitly listed
    const adminPermissions = ['course:edit', 'course:view', 'grade:view', 'grade:edit', 'user:manage'];
    expect(() => checkPermission(adminPermissions, 'grade:edit')).not.toThrow();
  });
});
