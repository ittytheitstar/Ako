export class ProblemError extends Error {
  public readonly type: string;
  public readonly title: string;
  public readonly status: number;
  public readonly detail?: string;

  constructor(status: number, title: string, detail?: string) {
    super(detail ?? title);
    this.type = `https://ako.invalid/errors/${title.toLowerCase().replace(/\s+/g, '-')}`;
    this.title = title;
    this.status = status;
    this.detail = detail;
  }

  toJSON() {
    return {
      type: this.type,
      title: this.title,
      status: this.status,
      detail: this.detail,
    };
  }
}

export const NotFound = (detail?: string) => new ProblemError(404, 'Not Found', detail);
export const Unauthorized = (detail?: string) => new ProblemError(401, 'Unauthorized', detail);
export const Forbidden = (detail?: string) => new ProblemError(403, 'Forbidden', detail);
export const BadRequest = (detail?: string) => new ProblemError(400, 'Bad Request', detail);
export const Conflict = (detail?: string) => new ProblemError(409, 'Conflict', detail);
export const InternalError = (detail?: string) => new ProblemError(500, 'Internal Server Error', detail);
