export type ErrorCode =
  | "UNSUPPORTED_FORMAT"
  | "INSUFFICIENT_DOCUMENTS"
  | "FILE_TOO_LARGE"
  | "SESSION_NOT_FOUND"
  | "JOB_NOT_FOUND"
  | "LLM_JSON_PARSE_FAIL"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly extractionId: string | null;
  readonly retryAfterMs: number | null;

  constructor(
    statusCode: number,
    code: ErrorCode,
    message: string,
    options?: {
      extractionId?: string;
      retryAfterMs?: number;
    },
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.extractionId = options?.extractionId ?? null;
    this.retryAfterMs = options?.retryAfterMs ?? null;
  }
}
