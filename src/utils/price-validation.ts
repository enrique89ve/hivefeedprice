import {
	PriceValidationError,
	PRICE_ERROR_CODES,
} from "@/types/errors";

export function validatePriceData(
	data: unknown,
	symbol: string,
	exchangeName: string
): number {
	if (data === null || data === undefined) {
		throw new PriceValidationError(
			`Missing price data for ${symbol}`,
			PRICE_ERROR_CODES.MISSING_PRICE_FIELD,
			{ exchangeName, operation: "price_validation" }
		);
	}

	const price = typeof data === "string" ? parseFloat(data) : Number(data);

	if (isNaN(price) || !isFinite(price)) {
		throw new PriceValidationError(
			`Invalid price value: ${data}`,
			PRICE_ERROR_CODES.INVALID_PRICE_DATA,
			{
				exchangeName,
				operation: "price_validation",
				invalidData: data,
			}
		);
	}

	if (price <= 0 || price > 10000) {
		throw new PriceValidationError(
			`Price out of valid range: $${price}`,
			PRICE_ERROR_CODES.PRICE_OUT_OF_RANGE,
			{
				exchangeName,
				operation: "price_validation",
				invalidData: price,
			}
		);
	}

	return price;
}

export function isValidPrice(price: unknown): price is number {
	return typeof price === "number" && price > 0 && !isNaN(price);
}