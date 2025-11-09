/**
 * Chain-specific error types re-exported from @hiveio/wax
 * Used for identifying recoverable vs non-recoverable errors in failover logic
 */

// Re-export Wax error types for type checking
export {
	WaxRequestTimeoutError,
	WaxNon_2XX_3XX_ResponseCodeError,
	WaxUnknownRequestError,
	WaxRequestAbortedByUser,
} from "@hiveio/wax";

/**
 * Checks if an error is recoverable and warrants trying a different node
 */
export function isRecoverableChainError(error: unknown): boolean {
	const errorName = error?.constructor?.name;

	// Recoverable errors - should trigger failover
	const recoverableErrors = [
		"WaxRequestTimeoutError", // Timeout - node may be slow/down
		"WaxNon_2XX_3XX_ResponseCodeError", // HTTP 5xx errors
		"WaxUnknownRequestError", // Network errors, CORS, etc.
	];

	return recoverableErrors.includes(errorName ?? "");
}
