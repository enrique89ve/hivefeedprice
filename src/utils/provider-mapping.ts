import { PriceProvider, ExchangePrice } from "@/types/price-provider";
import { isValidPrice } from "@/utils/price-validation";

export async function mapProvidersToExchangePrices(
	providers: PriceProvider[]
): Promise<ExchangePrice[]> {
	const results = await Promise.allSettled(
		providers.map(async (provider): Promise<ExchangePrice> => {
			try {
				if (!provider || !provider.exchangeName) {
					throw new Error("Invalid provider configuration");
				}

				const price = await provider.getHivePrice();

				if (!isValidPrice(price)) {
					throw new Error(`Invalid price received: ${price}`);
				}

				return {
					exchange: provider.exchangeName,
					price,
					success: true,
				};
			} catch (error) {
				return {
					exchange: provider.exchangeName || "Unknown",
					price: 0,
					success: false,
					error: error instanceof Error ? error.message : "Unknown error",
				};
			}
		})
	);

	return results.map((result) =>
		result.status === "fulfilled"
			? result.value
			: {
					exchange: "Unknown",
					price: 0,
					success: false,
					error: "Promise rejected",
			  }
	);
}

export async function mapProvidersToDetailedPrices(
	providers: PriceProvider[]
): Promise<ExchangePrice[]> {
	const results = await Promise.allSettled(
		providers.map(async (provider): Promise<ExchangePrice> => {
			try {
				const price = await provider.getHivePrice();
				return {
					exchange: provider.exchangeName,
					price,
					success: true,
				};
			} catch (error) {
				return {
					exchange: provider.exchangeName,
					price: 0,
					success: false,
					error: error instanceof Error ? error.message : "Unknown error",
				};
			}
		})
	);

	return results.map((result) =>
		result.status === "fulfilled"
			? result.value
			: {
					exchange: "Unknown",
					price: 0,
					success: false,
					error: "Promise rejected",
			  }
	);
}