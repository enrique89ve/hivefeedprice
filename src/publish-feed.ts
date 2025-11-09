#!/usr/bin/env tsx

/**
 * One-Shot Feed Price Publisher
 *
 * This script publishes the Hive feed price exactly once and then exits.
 * It's designed for manual execution or scheduled tasks (like cron jobs).
 *
 * Purpose:
 * Unlike the main daemon service (src/index.ts) which runs continuously in a loop,
 * this script performs a single publish operation and terminates.
 *
 * Use Cases:
 *
 * 1. Manual Publishing - Publish feed immediately without waiting for the daemon cycle
 *    Command: tsx --env-file=.env src/publish-feed.ts
 *
 * 2. Testing/Debugging - Verify feed publishing works before running the continuous service
 *    Command: pnpm build && node --env-file=.env dist/publish-feed.js
 *
 * 3. Cron Jobs - Schedule periodic publishing via system cron instead of daemon
 *    Example: star-slash-10 star star star star cd /path/to/project && tsx --env-file=.env src/publish-feed.ts
 *    (Replace star-slash-10 with asterisk-slash-10 and star with asterisk)
 *
 * 4. Emergency Publishing - Quickly publish updated feed after config changes
 *
 * Environment Variables Required:
 * - HIVE_WITNESS_ACCOUNT: Witness account name
 * - HIVE_SIGNING_PRIVATE_KEY: Private key for signing (WIF format)
 * - HIVE_RPC_NODES: (optional) Comma-separated RPC nodes with automatic failover
 *
 * Exit Codes:
 * - 0: Success - Feed published successfully
 * - 1: Error - Publishing failed (check error output)
 *
 * Failover Support:
 * This script automatically uses the failover system implemented in FeedPublisher,
 * which will retry with backup RPC nodes if the primary fails.
 */

import { createFeedPublisher } from "@/services/feed-publisher";

async function main() {
	try {
		const publisher = createFeedPublisher();
		await publisher.initialize();
		await publisher.publishFeedPrice();
	} catch (error) {
		console.error("❌ ERROR:", error);
		process.exit(1);
	}
}

main();