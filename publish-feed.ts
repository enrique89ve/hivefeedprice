#!/usr/bin/env tsx

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