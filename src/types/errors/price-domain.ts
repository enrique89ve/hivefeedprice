import { BaseAppError, ErrorContext, ERROR_SEVERITY } from "./base";

/**
 * Price Domain Error Codes
 */
export const PRICE_ERROR_CODES = {
  // Network-related errors
  NETWORK_TIMEOUT: "PRICE_NETWORK_TIMEOUT",
  NETWORK_CONNECTION_FAILED: "PRICE_NETWORK_CONNECTION_FAILED",
  NETWORK_UNREACHABLE: "PRICE_NETWORK_UNREACHABLE",

  // API-related errors
  API_RATE_LIMITED: "PRICE_API_RATE_LIMITED",
  API_UNAUTHORIZED: "PRICE_API_UNAUTHORIZED",
  API_NOT_FOUND: "PRICE_API_NOT_FOUND",
  API_SERVER_ERROR: "PRICE_API_SERVER_ERROR",
  API_INVALID_RESPONSE: "PRICE_API_INVALID_RESPONSE",

  // Data validation errors
  INVALID_PRICE_DATA: "PRICE_INVALID_PRICE_DATA",
  PRICE_OUT_OF_RANGE: "PRICE_OUT_OF_RANGE",
  MISSING_PRICE_FIELD: "PRICE_MISSING_PRICE_FIELD",

} as const;

export type PriceErrorCode =
  (typeof PRICE_ERROR_CODES)[keyof typeof PRICE_ERROR_CODES];

/**
 * Base class for all price domain errors
 */
abstract class PriceDomainError extends BaseAppError {
  readonly domain = "PRICE_FETCHING";
  readonly code: PriceErrorCode;
  readonly context: ErrorContext;

  constructor(
    message: string,
    code: PriceErrorCode,
    context: Partial<ErrorContext> = {},
    cause?: Error
  ) {
    super(message, cause);
    this.code = code;
    this.context = {
      operation: "price_operation",
      severity: ERROR_SEVERITY.MEDIUM,
      ...context,
    };
  }
}

/**
 * Network-related price fetching errors
 */
export class PriceNetworkError extends PriceDomainError {
  constructor(
    message: string,
    code: Extract<
      PriceErrorCode,
      | "PRICE_NETWORK_TIMEOUT"
      | "PRICE_NETWORK_CONNECTION_FAILED"
      | "PRICE_NETWORK_UNREACHABLE"
    >,
    context: Partial<ErrorContext> & { exchangeName: string },
    cause?: Error
  ) {
    super(
      message,
      code,
      {
        ...context,
        severity: ERROR_SEVERITY.HIGH,
      },
      cause
    );
  }

  isRetryable(): boolean {
    return this.code !== PRICE_ERROR_CODES.NETWORK_UNREACHABLE;
  }

  getRetryDelay(): number {
    const baseDelay = 1000;
    const multipliers: Record<
      Extract<
        PriceErrorCode,
        | "PRICE_NETWORK_TIMEOUT"
        | "PRICE_NETWORK_CONNECTION_FAILED"
        | "PRICE_NETWORK_UNREACHABLE"
      >,
      number
    > = {
      [PRICE_ERROR_CODES.NETWORK_TIMEOUT]: 2,
      [PRICE_ERROR_CODES.NETWORK_CONNECTION_FAILED]: 3,
      [PRICE_ERROR_CODES.NETWORK_UNREACHABLE]: 0,
    };
    const key = this.code as Extract<
      PriceErrorCode,
      | "PRICE_NETWORK_TIMEOUT"
      | "PRICE_NETWORK_CONNECTION_FAILED"
      | "PRICE_NETWORK_UNREACHABLE"
    >;
    return baseDelay * (multipliers[key] ?? 1);
  }
}

/**
 * API-related price fetching errors
 */
export class PriceAPIError extends PriceDomainError {
  readonly httpStatus?: number;
  readonly retryAfter?: number;

  constructor(
    message: string,
    code: Extract<
      PriceErrorCode,
      | "PRICE_API_RATE_LIMITED"
      | "PRICE_API_UNAUTHORIZED"
      | "PRICE_API_NOT_FOUND"
      | "PRICE_API_SERVER_ERROR"
      | "PRICE_API_INVALID_RESPONSE"
    >,
    context: Partial<ErrorContext> & {
      exchangeName: string;
      httpStatus?: number;
      retryAfter?: number;
    },
    cause?: Error
  ) {
    super(
      message,
      code,
      {
        ...context,
        severity:
          code === PRICE_ERROR_CODES.API_RATE_LIMITED
            ? ERROR_SEVERITY.MEDIUM
            : ERROR_SEVERITY.HIGH,
      },
      cause
    );
    if (context.httpStatus !== undefined) {
      this.httpStatus = context.httpStatus;
    }
    if (context.retryAfter !== undefined) {
      this.retryAfter = context.retryAfter;
    }
  }

  isRetryable(): boolean {
    const retryableCodes: ReadonlyArray<
      Extract<
        PriceErrorCode,
        "PRICE_API_RATE_LIMITED" | "PRICE_API_SERVER_ERROR"
      >
    > = [
      PRICE_ERROR_CODES.API_RATE_LIMITED,
      PRICE_ERROR_CODES.API_SERVER_ERROR,
    ];
    return (retryableCodes as readonly string[]).includes(this.code);
  }

  getRetryDelay(): number {
    if (this.code === PRICE_ERROR_CODES.API_RATE_LIMITED && this.retryAfter) {
      return this.retryAfter * 1000;
    }

    const delays: Record<
      Extract<
        PriceErrorCode,
        "PRICE_API_RATE_LIMITED" | "PRICE_API_SERVER_ERROR"
      >,
      number
    > = {
      [PRICE_ERROR_CODES.API_RATE_LIMITED]: 5000,
      [PRICE_ERROR_CODES.API_SERVER_ERROR]: 3000,
    };
    const key = this.code as Extract<
      PriceErrorCode,
      "PRICE_API_RATE_LIMITED" | "PRICE_API_SERVER_ERROR"
    >;
    return delays[key] ?? 0;
  }
}

/**
 * Data validation errors
 */
export class PriceValidationError extends PriceDomainError {
  readonly invalidData?: unknown;

  constructor(
    message: string,
    code: Extract<
      PriceErrorCode,
      | "PRICE_INVALID_PRICE_DATA"
      | "PRICE_OUT_OF_RANGE"
      | "PRICE_MISSING_PRICE_FIELD"
    >,
    context: Partial<ErrorContext> & {
      exchangeName: string;
      invalidData?: unknown;
    },
    cause?: Error
  ) {
    super(
      message,
      code,
      {
        ...context,
        severity: ERROR_SEVERITY.MEDIUM,
      },
      cause
    );
    this.invalidData = context.invalidData;
  }

  isRetryable(): boolean {
    return this.code === PRICE_ERROR_CODES.INVALID_PRICE_DATA;
  }

  getRetryDelay(): number {
    return this.isRetryable() ? 2000 : 0;
  }
}



/**
 * Type guard functions
 */
export const isPriceDomainError = (
  error: unknown
): error is PriceDomainError => {
  return error instanceof BaseAppError && error.domain === "PRICE_FETCHING";
};

