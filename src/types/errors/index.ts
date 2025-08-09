export {
  BaseAppError,
  ERROR_SEVERITY,
  type ErrorSeverity,
  type ErrorContext,
} from "./base";

export {
  PriceNetworkError,
  PriceAPIError,
  PriceValidationError,

  PRICE_ERROR_CODES,
  type PriceErrorCode,

  isPriceDomainError,
} from "./price-domain";

import { BaseAppError as _BaseAppError } from "./base";

export const isAppError = (error: unknown): error is _BaseAppError => {
  return error instanceof _BaseAppError;
};

export const getErrorDomain = (error: unknown): string | null => {
  if (isAppError(error)) {
    return error.domain;
  }
  return null;
};

export const isRetryableError = (error: unknown): boolean => {
  if (isAppError(error)) {
    return error.isRetryable();
  }
  return false;
};

export const getRetryDelay = (error: unknown): number => {
  if (isAppError(error)) {
    return error.getRetryDelay();
  }
  return 0;
};
