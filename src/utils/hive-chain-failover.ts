/**
 * Simple failover implementation for Hive RPC nodes
 * Provides automatic retry logic and node switching on recoverable errors
 */

import type { IHiveChainInterface } from "@hiveio/wax";
import { createHiveChain } from "@hiveio/wax";
import { isRecoverableChainError } from "@/types/chain-errors";

export interface HiveChainFailoverConfig {
	/** List of RPC node URLs to use (in priority order) */
	nodes: string[];
	/** Timeout per request in milliseconds (default: 2000) */
	timeout?: number;
	/** Maximum retry attempts per operation (default: nodes.length * 2) */
	maxRetries?: number;
	/** Base delay for exponential backoff in ms (default: 500) */
	baseRetryDelay?: number;
	/** Maximum delay for exponential backoff in ms (default: 5000) */
	maxRetryDelay?: number;
}

/**
 * Wrapper around IHiveChainInterface that provides failover capabilities
 */
export class HiveChainWithFailover {
	private chain: IHiveChainInterface | null = null;
	private readonly nodes: string[];
	private currentNodeIndex = 0;
	private readonly timeout: number;
	private readonly maxRetries: number;
	private readonly baseRetryDelay: number;
	private readonly maxRetryDelay: number;

	constructor(config: HiveChainFailoverConfig) {
		if (!config.nodes || config.nodes.length === 0) {
			throw new Error("At least one RPC node must be provided");
		}

		this.nodes = config.nodes;
		this.timeout = config.timeout ?? 2000;
		this.maxRetries = config.maxRetries ?? this.nodes.length * 2;
		this.baseRetryDelay = config.baseRetryDelay ?? 500;
		this.maxRetryDelay = config.maxRetryDelay ?? 5000;
	}

	/**
	 * Initialize the chain interface (must be called before use)
	 */
	async initialize(): Promise<void> {
		this.chain = await createHiveChain({
			apiEndpoint: this.nodes[this.currentNodeIndex],
			apiTimeout: this.timeout,
		});
		console.log(`[HiveChain] Initialized with node: ${this.nodes[this.currentNodeIndex]}`);
	}

	/**
	 * Get the underlying chain interface (for direct access if needed)
	 */
	getChain(): IHiveChainInterface {
		if (!this.chain) {
			throw new Error("Chain not initialized. Call initialize() first.");
		}
		return this.chain;
	}

	/**
	 * Execute an operation with automatic failover on recoverable errors
	 */
	async executeWithFailover<T>(
		operation: (chain: IHiveChainInterface) => Promise<T>,
		operationName = "operation"
	): Promise<T> {
		if (!this.chain) {
			throw new Error("Chain not initialized. Call initialize() first.");
		}

		let lastError: unknown;
		let attempt = 0;

		while (attempt < this.maxRetries) {
			const currentNode = this.nodes[this.currentNodeIndex];

			try {
				const result = await operation(this.chain);
				console.log(`[HiveChain] ${operationName} succeeded on ${currentNode}`);
				return result;
			} catch (error) {
				lastError = error;

				const errorType = error?.constructor?.name ?? "UnknownError";
				console.warn(
					`[HiveChain] ${operationName} failed on ${currentNode} (attempt ${attempt + 1}/${this.maxRetries}): ${errorType}`
				);

				// Check if error is recoverable
				if (!isRecoverableChainError(error)) {
					console.error(
						`[HiveChain] Non-recoverable error, not retrying: ${error instanceof Error ? error.message : String(error)}`
					);
					throw error;
				}

				attempt++;

				// If we have more retries, switch node and retry
				if (attempt < this.maxRetries) {
					await this.switchToNextNode();

					// Exponential backoff with jitter
					const delay = Math.min(
						this.baseRetryDelay * Math.pow(2, attempt) + Math.random() * 100,
						this.maxRetryDelay
					);
					console.log(`[HiveChain] Waiting ${Math.round(delay)}ms before retry...`);
					await this.sleep(delay);
				}
			}
		}

		// All retries exhausted
		console.error(`[HiveChain] All ${this.maxRetries} retry attempts exhausted for ${operationName}`);
		throw lastError;
	}

	/**
	 * Switch to the next available node
	 */
	private async switchToNextNode(): Promise<void> {
		const previousNode = this.nodes[this.currentNodeIndex];
		this.currentNodeIndex = (this.currentNodeIndex + 1) % this.nodes.length;
		const newNode = this.nodes[this.currentNodeIndex];

		if (!this.chain) {
			throw new Error("Chain not initialized");
		}

		this.chain.endpointUrl = newNode;
		console.log(`[HiveChain] Switched from ${previousNode} to ${newNode}`);
	}

	/**
	 * Helper to sleep for specified milliseconds
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}
