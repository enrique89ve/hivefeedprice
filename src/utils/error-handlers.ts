import {
  BaseAppError,
  PriceNetworkError,
  PriceAPIError,
  PRICE_ERROR_CODES,
} from "@/types/errors";
import { sleep } from "@/utils/async";

export class DomainAwareErrorHandler {
  static createTypedError(
    error: unknown,
    context: {
      domain: "price";
      operation: string;
      exchangeName?: string;
    }
  ): BaseAppError {
    const message = error instanceof Error ? error.message : String(error);
    const cause = error instanceof Error ? error : undefined;
    return this.createPriceError(message, cause, context);
  }

  private static createPriceError(
    message: string,
    cause: Error | undefined,
    context: { operation: string; exchangeName?: string }
  ): BaseAppError {
    const exchangeName = context.exchangeName || "Unknown";

    if (message.includes("timeout") || message.includes("ETIMEDOUT")) {
      return new PriceNetworkError(
        `Network timeout for ${exchangeName}`,
        PRICE_ERROR_CODES.NETWORK_TIMEOUT,
        { operation: context.operation, exchangeName },
        cause
      );
    }

    if (
      message.includes("ECONNREFUSED") ||
      (message.includes("connection") && message.includes("failed"))
    ) {
      return new PriceNetworkError(
        `Connection failed to ${exchangeName}`,
        PRICE_ERROR_CODES.NETWORK_CONNECTION_FAILED,
        { operation: context.operation, exchangeName },
        cause
      );
    }

    if (message.includes("rate limit") || message.includes("429")) {
      const retryAfter = this.extractRetryAfter(message);
      return new PriceAPIError(
        `Rate limit exceeded for ${exchangeName}`,
        PRICE_ERROR_CODES.API_RATE_LIMITED,
        {
          operation: context.operation,
          exchangeName,
          httpStatus: 429,
          ...(retryAfter !== undefined ? { retryAfter } : {}),
        },
        cause
      );
    }

    const httpStatus = this.extractHttpStatus(message);
    if (httpStatus) {
      if (httpStatus >= 500) {
        return new PriceAPIError(
          `Server error from ${exchangeName}: ${message}`,
          PRICE_ERROR_CODES.API_SERVER_ERROR,
          {
            operation: context.operation,
            exchangeName,
            httpStatus,
          },
          cause
        );
      }

      if (httpStatus === 404) {
        return new PriceAPIError(
          `Resource not found on ${exchangeName}`,
          PRICE_ERROR_CODES.API_NOT_FOUND,
          {
            operation: context.operation,
            exchangeName,
            httpStatus,
          },
          cause
        );
      }

      if (httpStatus === 401 || httpStatus === 403) {
        return new PriceAPIError(
          `Unauthorized access to ${exchangeName}`,
          PRICE_ERROR_CODES.API_UNAUTHORIZED,
          {
            operation: context.operation,
            exchangeName,
            httpStatus,
          },
          cause
        );
      }
    }

    return new PriceAPIError(
      `Invalid response from ${exchangeName}: ${message}`,
      PRICE_ERROR_CODES.API_INVALID_RESPONSE,
      {
        operation: context.operation,
        exchangeName,
      },
      cause
    );
  }

  private static extractRetryAfter(message: string): number | undefined {
    const match = message.match(/retry.after[:\s]+(\d+)/i);
    return match ? parseInt(match[1], 10) : undefined;
  }

  private static extractHttpStatus(message: string): number | undefined {
    const match = message.match(
      /HTTP\s+(\d{3})|status[:\s]+(\d{3})|(\d{3})\s+error/i
    );
    if (match) {
      return parseInt(match[1] || match[2] || match[3], 10);
    }
    return undefined;
  }

  static async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: {
      domain: "price";
      operation: string;
      maxRetries?: number;
      exchangeName?: string;
    }
  ): Promise<T> {
    const maxRetries = context.maxRetries || 3;
    let lastError: BaseAppError | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        const typedError = this.createTypedError(error, context);
        lastError = typedError;

        if (!typedError.isRetryable() || attempt === maxRetries) {
          break;
        }

        const delay = typedError.getRetryDelay();
        if (delay > 0) {
          await sleep(delay);
        }
      }
    }

    throw lastError || new Error("Operation failed without proper error");
  }

}