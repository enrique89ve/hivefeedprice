import {
  createHiveChain,
  createWaxFoundation,
  type IHiveChainInterface,
  type IWaxBaseInterface,
  type IWaxOptionsChain,
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

      const chainOptions = this.config.rpcNodes?.length
        ? ({ apiEndpoint: this.config.rpcNodes[0]! } as IWaxOptionsChain)
        : ({} as IWaxOptionsChain);

      this.hive = await createHiveChain(chainOptions);

      const bk = await createBeekeeper();
      const session = bk.createSession(`${BEEKEEPER.WALLET_NAME}-${Date.now()}`);

      try {
        const lockedWallet: IBeekeeperWallet = await session.openWallet(
          BEEKEEPER.WALLET_NAME
        );
        const unlockedWallet = await lockedWallet.unlock(
          BEEKEEPER.WALLET_PASSWORD
        );
        this.wallet = unlockedWallet;

        const publicKeys = await unlockedWallet.getPublicKeys();
        if (!publicKeys || publicKeys.length === 0) {
          throw new Error("No public keys found in wallet");
        }
        this.publicKey = publicKeys[0];
      } catch (openErr) {
        if (!this.config.privateKey) {
          throw new Error("HIVE_PRIVATE_KEY is required for wallet creation");
        }

        const { wallet } = await session.createWallet(
          BEEKEEPER.WALLET_NAME,
          BEEKEEPER.WALLET_PASSWORD,
          false
        );
        this.publicKey = await wallet.importKey(this.config.privateKey);
        this.wallet = wallet;
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
    if (!this.hive) {
      throw new Error(
        "Hive connection not initialized. Call initialize() first."
      );
    }
    if (!this.wallet || !this.publicKey) {
      throw new Error("Wallet not initialized or public key missing");
    }

    const witnessSetPropsData: IWitnessSetPropertiesData = {
      owner: this.config.witnessAccount,
      witnessSigningKey: this.publicKey,
      hbdExchangeRate: {
        base: baseAsset,
        quote: quoteAsset,
      },
    };

    const witnessOperation = new WitnessSetPropertiesOperation(
      witnessSetPropsData
    );

    const tx = await this.hive.createTransaction();
    tx.pushOperation(witnessOperation);

    const transactionId = tx.id;
    tx.sign(this.wallet, this.publicKey);

    await this.hive.broadcast(tx);
    return transactionId;
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
