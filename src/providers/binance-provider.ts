import { PriceProvider } from "@/types/price-provider";
import { roundToThreeDecimals } from "@/utils/math";

interface BinancePriceResponse {
  symbol: string;
  price: string;
}

export class BinancePriceProvider extends PriceProvider {
  readonly exchangeName = "Binance";
  readonly baseUrl = "https://data-api.binance.vision";

  async getHivePrice(): Promise<number> {
    const results = await Promise.allSettled([
      this.fetchWithRetry(() => this.fetchPrice("HIVEUSDT")),
      this.fetchWithRetry(() => this.fetchPrice("HIVEUSDC")),
    ]);

    const successfulPrices: number[] = [];

    results.forEach((result) => {
      if (result.status === "fulfilled") {
        successfulPrices.push(result.value);
      }
    });

    if (successfulPrices.length === 0) {
      throw new Error(
        `Failed to fetch any HIVE prices from ${this.exchangeName}`
      );
    }

    if (successfulPrices.length === 1) {
      return roundToThreeDecimals(successfulPrices[0]);
    }

    const average =
      successfulPrices.reduce((sum, price) => sum + price, 0) /
      successfulPrices.length;
    return roundToThreeDecimals(average);
  }

  private async fetchPrice(symbol: string): Promise<number> {
    const url = `${this.baseUrl}/api/v3/ticker/price?symbol=${symbol}`;
    const data = await this.makeRequest<BinancePriceResponse>(url);
    return parseFloat(data.price);
  }
}
