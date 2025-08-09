export abstract class BaseAppError extends Error {
  abstract readonly code: string;
  abstract readonly domain: string;
  readonly timestamp: Date;
  readonly correlationId?: string;

  constructor(
    message: string,
    public readonly cause?: Error,
    correlationId?: string
  ) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date();
    if (correlationId !== undefined) {
      this.correlationId = correlationId;
    }

    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      domain: this.domain,
      message: this.message,
      timestamp: this.timestamp.toISOString(),
      correlationId: this.correlationId,
      cause: this.cause?.message,
      stack: this.stack,
    };
  }

  abstract isRetryable(): boolean;

  abstract getRetryDelay(): number;
}

export const ERROR_SEVERITY = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical",
} as const;

export type ErrorSeverity =
  (typeof ERROR_SEVERITY)[keyof typeof ERROR_SEVERITY];

export interface ErrorContext {
  operation: string;
  metadata?: Record<string, unknown>;
  severity: ErrorSeverity;
}
