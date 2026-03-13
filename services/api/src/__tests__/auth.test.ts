/**
 * Unit tests for auth helper utilities.
 * These tests cover the pure functions used in auth logic without requiring
 * a real database or Redis connection.
 */
import { describe, it, expect } from 'vitest';
import { createHash, randomUUID } from 'crypto';

// ── PKCE helpers (duplicated from auth.ts for testing) ──────────────────────

function generateCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

function generateState(): string {
  return randomUUID();
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('PKCE code_challenge generation', () => {
  it('produces a base64url-encoded SHA-256 hash', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const challenge = generateCodeChallenge(verifier);
    // Should only contain URL-safe base64 characters (no +, /, =)
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('produces a deterministic result for the same input', () => {
    const verifier = 'test-verifier-abc123';
    expect(generateCodeChallenge(verifier)).toBe(generateCodeChallenge(verifier));
  });

  it('produces different results for different verifiers', () => {
    expect(generateCodeChallenge('abc')).not.toBe(generateCodeChallenge('xyz'));
  });
});

describe('OIDC state generation', () => {
  it('produces a non-empty UUID-shaped state value', () => {
    const state = generateState();
    expect(state).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('produces unique values', () => {
    const states = new Set(Array.from({ length: 10 }, generateState));
    expect(states.size).toBe(10);
  });
});

describe('Role and permission extraction', () => {
  // Simulate the logic used in auth.ts token generation
  function extractRolesAndPermissions(
    rows: Array<{ role_name: string; permission_name: string | null }>
  ) {
    const roles = [...new Set(rows.map(r => r.role_name))];
    const permissions = [
      ...new Set(rows.filter(r => r.permission_name).map(r => r.permission_name as string)),
    ];
    return { roles, permissions };
  }

  it('deduplicates roles', () => {
    const rows = [
      { role_name: 'admin', permission_name: 'course:edit' },
      { role_name: 'admin', permission_name: 'course:view' },
    ];
    const { roles } = extractRolesAndPermissions(rows);
    expect(roles).toEqual(['admin']);
  });

  it('collects unique permissions', () => {
    const rows = [
      { role_name: 'admin', permission_name: 'course:edit' },
      { role_name: 'teacher', permission_name: 'course:view' },
      { role_name: 'admin', permission_name: 'course:edit' },
    ];
    const { permissions } = extractRolesAndPermissions(rows);
    expect(permissions).toEqual(['course:edit', 'course:view']);
  });

  it('filters out null permission_names', () => {
    const rows = [
      { role_name: 'student', permission_name: null },
    ];
    const { permissions } = extractRolesAndPermissions(rows);
    expect(permissions).toEqual([]);
  });
});
