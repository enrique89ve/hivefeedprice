import { PriceProvider } from '@/types/price-provider';
import { roundToThreeDecimals } from '@/utils/math';

interface MEXCPriceResponse {
	symbol: string;
	price: string;
}

export class MEXCPriceProvider extends PriceProvider {
	readonly exchangeName = 'MEXC';
	readonly baseUrl = 'https://api.mexc.com';

	async getHivePrice(): Promise<number> {
		return await this.fetchWithRetry(() => this.fetchPrice('HIVEUSDT'));
	}

	private async fetchPrice(symbol: string): Promise<number> {
		const url = `${this.baseUrl}/api/v3/ticker/price?symbol=${symbol}`;
		
		const data = await this.makeRequest<MEXCPriceResponse>(url);
		const price = parseFloat(data.price);
		
		return roundToThreeDecimals(price);
	}
}