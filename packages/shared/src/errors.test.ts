import { describe, it, expect } from 'vitest';
import { ProblemError, NotFound, Unauthorized, Forbidden, BadRequest, Conflict, InternalError } from './errors';

describe('ProblemError', () => {
  it('constructs with status, title, and optional detail', () => {
    const err = new ProblemError(404, 'Not Found', 'Resource missing');
    expect(err.status).toBe(404);
    expect(err.title).toBe('Not Found');
    expect(err.detail).toBe('Resource missing');
    expect(err.message).toBe('Resource missing');
  });

  it('uses title as message when no detail provided', () => {
    const err = new ProblemError(500, 'Internal Server Error');
    expect(err.message).toBe('Internal Server Error');
    expect(err.detail).toBeUndefined();
  });

  it('generates a type URL from title', () => {
    const err = new ProblemError(400, 'Bad Request');
    expect(err.type).toBe('https://ako.invalid/errors/bad-request');
  });

  it('serialises to RFC 7807 JSON', () => {
    const err = new ProblemError(422, 'Unprocessable Entity', 'Validation failed');
    const json = err.toJSON();
    expect(json).toEqual({
      type: 'https://ako.invalid/errors/unprocessable-entity',
      title: 'Unprocessable Entity',
      status: 422,
      detail: 'Validation failed',
    });
  });

  it('omits detail from JSON when not provided', () => {
    const err = new ProblemError(404, 'Not Found');
    const json = err.toJSON();
    expect(json.detail).toBeUndefined();
  });

  it('is an instance of Error', () => {
    const err = new ProblemError(500, 'Internal Server Error');
    expect(err).toBeInstanceOf(Error);
  });
});

describe('Error factory functions', () => {
  it('NotFound returns 404', () => {
    const err = NotFound('Course missing');
    expect(err.status).toBe(404);
    expect(err.title).toBe('Not Found');
    expect(err.detail).toBe('Course missing');
  });

  it('Unauthorized returns 401', () => {
    const err = Unauthorized();
    expect(err.status).toBe(401);
    expect(err.title).toBe('Unauthorized');
  });

  it('Forbidden returns 403', () => {
    const err = Forbidden('Access denied');
    expect(err.status).toBe(403);
  });

  it('BadRequest returns 400', () => {
    const err = BadRequest('Missing field');
    expect(err.status).toBe(400);
  });

  it('Conflict returns 409', () => {
    const err = Conflict('Duplicate entry');
    expect(err.status).toBe(409);
  });

  it('InternalError returns 500', () => {
    const err = InternalError();
    expect(err.status).toBe(500);
  });
});
