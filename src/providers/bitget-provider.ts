import { PriceProvider } from '@/types/price-provider';
import { roundToThreeDecimals } from '@/utils/math';

interface BitgetSymbolData {
	symbol: string;
	baseCoin: string;
	quoteCoin: string;
	minTradeAmount: string;
	maxTradeAmount: string;
	takerFeeRate: string;
	makerFeeRate: string;
	pricePrecision: string;
	quantityPrecision: string;
	quotePrecision: string;
	status: string;
	minTradeUSDT: string;
	buyLimitPriceRatio: string;
	sellLimitPriceRatio: string;
	areaSymbol: string;
	offTime: string;
}

interface BitgetSymbolsResponse {
	code: string;
	msg: string;
	requestTime: number;
	data: BitgetSymbolData[];
}

export class BitgetPriceProvider extends PriceProvider {
	readonly exchangeName = 'Bitget';
	readonly baseUrl = 'https://api.bitget.com';

	async getHivePrice(): Promise<number> {
		const url = `${this.baseUrl}/api/v2/spot/public/symbols?symbol=HIVEUSDT`;
		const data = await this.makeRequest<BitgetSymbolsResponse>(url);

		if (data.code !== '00000') {
			throw new Error(`Bitget API error: ${data.msg}`);
		}

		const hiveSymbol = data.data.find(symbol => symbol.symbol === 'HIVEUSDT');
		
		if (!hiveSymbol) {
			throw new Error('HIVEUSDT symbol not found in Bitget response');
		}

		if (hiveSymbol.status !== 'online') {
			throw new Error(`HIVEUSDT trading is not online, status: ${hiveSymbol.status}`);
		}

		const tickerUrl = `${this.baseUrl}/api/v2/spot/market/tickers?symbol=HIVEUSDT`;
		const tickerData = await this.makeRequest<any>(tickerUrl);

		if (tickerData.code !== '00000') {
			throw new Error(`Bitget ticker API error: ${tickerData.msg}`);
		}

		const ticker = tickerData.data.find((t: any) => t.symbol === 'HIVEUSDT');
		
		if (!ticker) {
			throw new Error('HIVEUSDT ticker not found');
		}

		const price = parseFloat(ticker.lastPr || ticker.close);
		
		if (isNaN(price) || price <= 0) {
			throw new Error(`Invalid price received: ${price}`);
		}

		return roundToThreeDecimals(price);
	}
}