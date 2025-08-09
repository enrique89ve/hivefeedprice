import { PriceProvider } from "@/types/price-provider";
import { roundToThreeDecimals } from "@/utils/math";

interface ProbitTickerItem {
  readonly last: string;
  readonly low: string;
  readonly high: string;
  readonly change: string;
  readonly base_volume: string;
  readonly quote_volume: string;
  readonly market_id: string;
  readonly time: string;
}

interface ProbitTickerResponse {
  readonly data: readonly ProbitTickerItem[];
}

const enum ProbitMarketIds {
  HIVE_USDT = "HIVE-USDT",
  HIVE_USDC = "HIVE-USDC",
}

export class ProbitPriceProvider extends PriceProvider {
  readonly exchangeName = "Probit";
  readonly baseUrl = "https://api.probit.com/api/exchange/v1";

  async getHivePrice(): Promise<number> {
    // Nota: /ticker con market_ids inválidos retorna 400. Para evitarlo,
    // pedimos todos los tickers y filtramos localmente los que nos interesan.
    const url = `${this.baseUrl}/ticker`;
    const response = await this.fetchWithRetry(() =>
      this.makeRequest<ProbitTickerResponse>(url)
    );

    const targetMarkets: readonly string[] = [ProbitMarketIds.HIVE_USDT];

    const prices: number[] = [];
    for (const item of response.data) {
      if (!targetMarkets.includes(item.market_id)) continue;
      try {
        const price = this.validatePriceData(item.last, item.market_id);
        prices.push(price);
      } catch {
        // Si un par falla validación, lo omitimos y continuamos
      }
    }

    if (prices.length === 0) {
      throw new Error(
        `Failed to fetch any HIVE prices from ${this.exchangeName}`
      );
    }

    if (prices.length === 1) {
      return roundToThreeDecimals(prices[0]);
    }

    const average = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    return roundToThreeDecimals(average);
  }
}
