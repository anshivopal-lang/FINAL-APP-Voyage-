export interface CurrencyOption {
  code: string;
  name: string;
  symbol: string;
}

export const CURRENCIES: CurrencyOption[] = [
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'THB', name: 'Thai Baht', symbol: '฿' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$' },
  { code: 'MXN', name: 'Mexican Peso', symbol: 'MX$' },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr' },
];

const CURRENCY_BY_CODE = new Map(
  CURRENCIES.map((currency) => [currency.code, currency]),
);

export function currencyName(code: string): string {
  return CURRENCY_BY_CODE.get(code)?.name ?? code;
}

export function formatMoney(amount: number, code: string): string {
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    const symbol = CURRENCY_BY_CODE.get(code)?.symbol ?? '';
    return `${symbol}${amount.toLocaleString('en-GB')}`;
  }
}

/**
 * Indicative rates against GBP, used only to show a combined total when a
 * holiday tracks several currencies. Not a live FX feed.
 */
const INDICATIVE_RATES_PER_GBP: Record<string, number> = {
  GBP: 1,
  EUR: 1.17,
  USD: 1.27,
  CHF: 1.12,
  JPY: 191,
  AUD: 1.93,
  CAD: 1.73,
  SGD: 1.71,
  AED: 4.66,
  INR: 106,
  THB: 45.6,
  ZAR: 23.4,
  NZD: 2.09,
  MXN: 21.7,
  NOK: 13.6,
};

/** Converts `amount` from `from` into `to` using the indicative table. */
export function convert(amount: number, from: string, to: string): number {
  const fromRate = INDICATIVE_RATES_PER_GBP[from];
  const toRate = INDICATIVE_RATES_PER_GBP[to];
  if (!fromRate || !toRate) return amount;
  return (amount / fromRate) * toRate;
}

export const COUNTRIES: string[] = [
  'Australia',
  'Austria',
  'Canada',
  'Croatia',
  'France',
  'Germany',
  'Greece',
  'Iceland',
  'India',
  'Ireland',
  'Italy',
  'Japan',
  'Mexico',
  'Morocco',
  'Netherlands',
  'New Zealand',
  'Norway',
  'Portugal',
  'Singapore',
  'South Africa',
  'Spain',
  'Switzerland',
  'Thailand',
  'United Arab Emirates',
  'United Kingdom',
  'United States',
  'Vietnam',
];

/** Sensible default currency when a country is picked in the editor. */
export const COUNTRY_CURRENCY: Record<string, string> = {
  Australia: 'AUD',
  Austria: 'EUR',
  Canada: 'CAD',
  Croatia: 'EUR',
  France: 'EUR',
  Germany: 'EUR',
  Greece: 'EUR',
  Iceland: 'EUR',
  India: 'INR',
  Ireland: 'EUR',
  Italy: 'EUR',
  Japan: 'JPY',
  Mexico: 'MXN',
  Netherlands: 'EUR',
  'New Zealand': 'NZD',
  Norway: 'NOK',
  Portugal: 'EUR',
  Singapore: 'SGD',
  'South Africa': 'ZAR',
  Spain: 'EUR',
  Switzerland: 'CHF',
  Thailand: 'THB',
  'United Arab Emirates': 'AED',
  'United Kingdom': 'GBP',
  'United States': 'USD',
  Vietnam: 'USD',
};
