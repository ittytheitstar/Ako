/**
 * Unit tests for the Ako API configuration validator.
 * Tests that the config schema rejects invalid environments and applies defaults.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';

// ── Re-define the schema here to keep tests self-contained ──────────────────
// (We don't import config.ts directly because it calls process.exit on failure)

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string(),
  NATS_URL: z.string(),
  PORT: z.coerce.number().default(8080),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRY: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRY_SECONDS: z.coerce.number().default(604800),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  OIDC_ISSUER_URL: z.string().url().optional(),
  OIDC_CLIENT_ID: z.string().optional(),
  OIDC_CLIENT_SECRET: z.string().optional(),
  OIDC_REDIRECT_URI: z.string().url().optional(),
  OIDC_SCOPES: z.string().default('openid profile email'),
  APP_URL: z.string().default('http://localhost:3000'),
});

const VALID_ENV = {
  DATABASE_URL: 'postgresql://ako:ako@localhost:5432/ako',
  REDIS_URL: 'redis://localhost:6379',
  NATS_URL: 'nats://localhost:4222',
  JWT_SECRET: 'a-very-long-secret-key-for-testing-purposes',
  NODE_ENV: 'test',
};

describe('API config schema', () => {
  it('accepts a valid environment', () => {
    const result = envSchema.safeParse(VALID_ENV);
    expect(result.success).toBe(true);
  });

  it('applies default PORT of 8080', () => {
    const result = envSchema.safeParse(VALID_ENV);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.PORT).toBe(8080);
  });

  it('applies default JWT_EXPIRY of 15m', () => {
    const result = envSchema.safeParse(VALID_ENV);
    if (result.success) expect(result.data.JWT_EXPIRY).toBe('15m');
  });

  it('applies default OIDC_SCOPES', () => {
    const result = envSchema.safeParse(VALID_ENV);
    if (result.success) expect(result.data.OIDC_SCOPES).toBe('openid profile email');
  });

  it('rejects missing DATABASE_URL', () => {
    const { DATABASE_URL: _omit, ...rest } = VALID_ENV;
    const result = envSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects JWT_SECRET shorter than 32 characters', () => {
    const result = envSchema.safeParse({ ...VALID_ENV, JWT_SECRET: 'short' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid NODE_ENV value', () => {
    const result = envSchema.safeParse({ ...VALID_ENV, NODE_ENV: 'staging' });
    expect(result.success).toBe(false);
  });

  it('accepts optional OIDC config when all fields are provided', () => {
    const result = envSchema.safeParse({
      ...VALID_ENV,
      OIDC_ISSUER_URL: 'https://idp.example.com',
      OIDC_CLIENT_ID: 'ako-client',
      OIDC_CLIENT_SECRET: 'secret',
      OIDC_REDIRECT_URI: 'https://app.example.com/api/v1/auth/oidc/callback',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid OIDC_ISSUER_URL', () => {
    const result = envSchema.safeParse({
      ...VALID_ENV,
      OIDC_ISSUER_URL: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });

  it('coerces PORT from string to number', () => {
    const result = envSchema.safeParse({ ...VALID_ENV, PORT: '3000' });
    if (result.success) expect(result.data.PORT).toBe(3000);
  });
});
