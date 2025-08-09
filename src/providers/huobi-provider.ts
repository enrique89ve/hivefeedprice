import { PriceProvider } from "@/types/price-provider";
import { roundToThreeDecimals } from "@/utils/math";

interface HuobiTradeData {
  id: number;
  ts: number;
  "trade-id": number;
  amount: number;
  price: number;
  direction: "buy" | "sell";
}

interface HuobiTradeDetail {
  id: number;
  ts: number;
  data: HuobiTradeData[];
}

interface HuobiTradeResponse {
  ch: string;
  status: string;
  ts: number;
  data: HuobiTradeDetail[];
}

export class HuobiPriceProvider extends PriceProvider {
  readonly exchangeName = "Huobi";
  readonly baseUrl = "https://api.huobi.pro";

  async getHivePrice(): Promise<number> {
    const url = `${this.baseUrl}/market/history/trade?symbol=hiveusdt`;
    const data = await this.makeRequest<HuobiTradeResponse>(url);

    if (data.status !== "ok") {
      throw new Error(`Huobi API error: status ${data.status}`);
    }

    const rawPrice = this.extractLatestTradePrice(data);
    const price = this.validatePriceData(rawPrice, "HIVEUSDT");
    return roundToThreeDecimals(price);
  }

  private extractLatestTradePrice(resp: HuobiTradeResponse): number {
    const latestTrade = resp?.data?.[0]?.data?.[0];
    if (!latestTrade || typeof latestTrade.price !== "number") {
      throw new Error("No valid trade price found in Huobi response");
    }
    return latestTrade.price;
  }
}
