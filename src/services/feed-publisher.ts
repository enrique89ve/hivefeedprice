import {
  createWaxFoundation,
  type IHiveChainInterface,
  type IWaxBaseInterface,
  WitnessSetPropertiesOperation,
  type IWitnessSetPropertiesData,
  type TInternalAsset,
} from "@hiveio/wax";
import createBeekeeper, {
  type IBeekeeperUnlockedWallet,
  type IBeekeeperWallet,
} from "@hiveio/beekeeper";
import { priceAggregator } from "@/services/price-aggregator";
import { loadConfig } from "@/config/config";
import { HiveChainWithFailover } from "@/utils/hive-chain-failover";

const BEEKEEPER = {
  WALLET_NAME: "feed-publisher" as const,
  WALLET_PASSWORD: process.env.BEEKEEPER_WALLET_PASSWORD || "auto-pass",
} as const;

interface HiveConfig {
  readonly witnessAccount: string;
  readonly privateKey: string;
  readonly rpcNodes?: readonly string[];
  readonly chainId?: string;
}

export class FeedPublisher {
  private readonly config: HiveConfig;
  private hiveChainFailover: HiveChainWithFailover | null = null;
  private hive: IHiveChainInterface | null = null;
  private wax: IWaxBaseInterface | null = null;
  private wallet: IBeekeeperUnlockedWallet | null = null;
  private publicKey: string | null = null;

  constructor(config: HiveConfig) {
    if (!config.witnessAccount) {
      throw new Error("witnessAccount is required");
    }

    this.config = config;
  }

  async initialize(): Promise<void> {
    try {
      this.wax = await createWaxFoundation();

      // Initialize failover chain with configured RPC nodes
      const rpcNodes = this.config.rpcNodes && this.config.rpcNodes.length > 0
        ? [...this.config.rpcNodes]
        : ["https://api.hive.blog", "https://api.deathwing.me", "https://api.openhive.network"];

      this.hiveChainFailover = new HiveChainWithFailover({
        nodes: rpcNodes,
        timeout: 3000,
        maxRetries: rpcNodes.length * 2,
      });

      await this.hiveChainFailover.initialize();
      this.hive = this.hiveChainFailover.getChain();

      const bk = await createBeekeeper();
      const session = bk.createSession(
        `${BEEKEEPER.WALLET_NAME}-${Date.now()}`
      );

      let walletExists = false;
      let walletValid = false;

      try {
        const lockedWallet: IBeekeeperWallet = await session.openWallet(
          BEEKEEPER.WALLET_NAME
        );
        const unlockedWallet = await lockedWallet.unlock(
          BEEKEEPER.WALLET_PASSWORD
        );

        const publicKeys = await unlockedWallet.getPublicKeys();
        if (!publicKeys || publicKeys.length === 0) {
          throw new Error("No public keys found in wallet");
        }

        walletExists = true;
        this.wallet = unlockedWallet;
        this.publicKey = publicKeys[0];
        walletValid = true;
      } catch (openErr) {
        // Wallet doesn't exist or failed to open
        walletExists = false;
      }

      // Create wallet if it doesn't exist
      if (!walletExists) {
        if (!this.config.privateKey) {
          throw new Error(
            "HIVE_SIGNING_PRIVATE_KEY is required for wallet creation"
          );
        }

        const { wallet } = await session.createWallet(
          BEEKEEPER.WALLET_NAME,
          BEEKEEPER.WALLET_PASSWORD,
          false
        );
        this.publicKey = await wallet.importKey(this.config.privateKey);
        this.wallet = wallet;

        console.log("\x1b[32m[SUCCESS]\x1b[0m Wallet created with signing key");
      } else if (walletValid) {
        console.log("\x1b[32m[SUCCESS]\x1b[0m Using existing wallet");
      }
    } catch (error) {
      throw new Error(`Failed to initialize: ${error}`);
    }
  }

  async publishFeedPrice(): Promise<string> {
    if (!this.hive || !this.wax) {
      throw new Error(
        "FeedPublisher not initialized. Call initialize() first."
      );
    }

    try {
      const averagePrice = await priceAggregator.getAggregatedHivePrice();
      this.validatePrice(averagePrice);

      const hbdAsset = this.wax.hbdCoins(averagePrice);
      const hiveAsset = this.wax.hiveCoins(1);

      const transactionId = await this.broadcastFeedPublish(
        hbdAsset,
        hiveAsset
      );

      return transactionId;
    } catch (error) {
      throw error;
    }
  }

  private validatePrice(priceUSD: number): void {
    if (typeof priceUSD !== "number" || priceUSD <= 0 || isNaN(priceUSD)) {
      throw new Error(
        `Invalid price for exchange rate conversion: ${priceUSD}`
      );
    }
  }
  private async broadcastFeedPublish(
    baseAsset: TInternalAsset,
    quoteAsset: TInternalAsset
  ): Promise<string> {
    if (!this.hiveChainFailover) {
      throw new Error(
        "Hive connection not initialized. Call initialize() first."
      );
    }
    if (!this.wallet || !this.publicKey) {
      throw new Error("Wallet not initialized or public key missing");
    }

    // Use failover to execute the broadcast operation
    return await this.hiveChainFailover.executeWithFailover(
      async (chain) => {
        const witnessSetPropsData: IWitnessSetPropertiesData = {
          owner: this.config.witnessAccount,
          witnessSigningKey: this.publicKey!,
          hbdExchangeRate: {
            base: baseAsset,
            quote: quoteAsset,
          },
        };

        const witnessOperation = new WitnessSetPropertiesOperation(
          witnessSetPropsData
        );

        const tx = await chain.createTransaction();
        tx.pushOperation(witnessOperation);

        const transactionId = tx.id;
        tx.sign(this.wallet!, this.publicKey!);

        await chain.broadcast(tx);
        return transactionId;
      },
      "feed_publish"
    );
  }
}

export function createFeedPublisher(): FeedPublisher {
  const config = loadConfig();

  return new FeedPublisher(config.hive);
}

export function getFeedInterval(): number {
  const config = loadConfig();
  return config.priceFeed.updateInterval;
}

let _feedPublisher: FeedPublisher | null = null;

export function getFeedPublisher(): FeedPublisher {
  if (!_feedPublisher) {
    _feedPublisher = createFeedPublisher();
  }
  return _feedPublisher;
}
