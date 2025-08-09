import { ExchangePrice } from "@/types/price-provider";
import { roundToThreeDecimals } from "@/utils/math";

export interface WeightedExchangePrice extends ExchangePrice {
  weight: number;
  normalizedWeight?: number;
}

export class WeightedPriceCalculator {
  static calculateWeightedAverage(prices: WeightedExchangePrice[]): number {
    const successfulPrices = prices.filter((p) => p.success);

    if (successfulPrices.length === 0) {
      throw new Error("No successful prices for weighted average calculation");
    }

    const totalWeight = successfulPrices.reduce((sum, p) => sum + p.weight, 0);

    if (totalWeight === 0) {
      throw new Error("Total weight cannot be zero");
    }

    const weightedSum = successfulPrices.reduce((sum, p) => {
      const normalizedWeight = p.weight / totalWeight;
      return sum + p.price * normalizedWeight;
    }, 0);

    return roundToThreeDecimals(weightedSum);
  }
}
