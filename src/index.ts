import { createFeedPublisher, getFeedInterval } from "@/services/feed-publisher";

class HiveFeedPriceBot {
	private publisher: ReturnType<typeof createFeedPublisher>;
	private intervalId: NodeJS.Timeout | null = null;
	private isRunning = false;
	private isShuttingDown = false;

	constructor() {
		this.publisher = createFeedPublisher();
		this.setupShutdownHandlers();
	}

	async start(): Promise<void> {
		if (this.isRunning) {
			console.log("\x1b[33m[WARN]\x1b[0m Bot is already running");
			return;
		}

		try {
			console.log("\x1b[36m[INFO]\x1b[0m Starting Hive Feed Price Bot...");
			
			await this.publisher.initialize();

			const intervalMs = getFeedInterval();

			await this.publishFeed();

			this.intervalId = setInterval(async () => {
				if (!this.isShuttingDown) {
					await this.publishFeed();
				}
			}, intervalMs);

			this.isRunning = true;
			console.log("\x1b[32m[SUCCESS]\x1b[0m Bot started - Publishing feeds automatically");
			console.log("\x1b[36m[INFO]\x1b[0m Next feed in " + Math.round(intervalMs / 60000) + " minutes");

		} catch (error) {
			console.error("\x1b[31m[ERROR]\x1b[0m Failed to start bot:", error);
			throw error;
		}
	}

	private async publishFeed(): Promise<void> {
		if (this.isShuttingDown) return;

		try {
			console.log("\n\x1b[36m[FEED]\x1b[0m Publishing price...");
			const txId = await this.publisher.publishFeedPrice();
			console.log("\x1b[32m[SUCCESS]\x1b[0m Feed published: " + txId);
			
			const interval = getFeedInterval();
			const nextTime = new Date(Date.now() + interval);
			console.log("\x1b[36m[INFO]\x1b[0m Next feed at: " + nextTime.toLocaleString());

		} catch (error) {
			console.error("\x1b[31m[ERROR]\x1b[0m Failed to publish feed:", error);
			console.log("\x1b[33m[RETRY]\x1b[0m Will retry on next interval");
		}
	}

	async stop(): Promise<void> {
		if (!this.isRunning) return;

		console.log("\n\x1b[36m[INFO]\x1b[0m Stopping Hive Feed Price Bot...");
		this.isShuttingDown = true;

		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}

		this.isRunning = false;
		console.log("\x1b[32m[SUCCESS]\x1b[0m Bot stopped gracefully");
	}

	// Graceful shutdown handlers
	private setupShutdownHandlers(): void {
		const shutdownHandler = async (signal: string) => {
			console.log("\n\x1b[33m[SIGNAL]\x1b[0m Received " + signal + " signal");
			await this.stop();
			process.exit(0);
		};

		process.on('SIGINT', () => shutdownHandler('SIGINT'));
		process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
		
		process.on('uncaughtException', (error) => {
			console.error('\x1b[31m[FATAL]\x1b[0m Uncaught Exception:', error);
			this.stop().then(() => process.exit(1));
		});

		process.on('unhandledRejection', (reason) => {
			console.error('\x1b[31m[FATAL]\x1b[0m Unhandled Rejection:', reason);
			this.stop().then(() => process.exit(1));
		});
	}
}

// Función principal
async function main(): Promise<void> {
	const bot = new HiveFeedPriceBot();

	try {
		await bot.start();
		
		await new Promise<never>(() => {});
		
	} catch (error) {
		console.error("\x1b[31m[FATAL]\x1b[0m Fatal error:", error);
		process.exit(1);
	}
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch((error) => {
		console.error("\x1b[31m[FATAL]\x1b[0m Failed to start application:", error);
		process.exit(1);
	});
}

export { HiveFeedPriceBot };