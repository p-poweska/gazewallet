// Currencies supported by CoinGecko (curated subset).
export const CURRENCIES = [
  'USD',
  'EUR',
  'PLN',
  'GBP',
  'CHF',
  'CAD',
  'AUD',
  'JPY',
  'CNY',
  'CZK',
  'SEK',
  'NOK',
  'DKK',
  'BRL',
  'INR',
] as const
export type Currency = (typeof CURRENCIES)[number]

const KEY = 'gazewallet:currency:v1'

export function loadCurrency(): Currency {
  const v = localStorage.getItem(KEY)
  return CURRENCIES.includes(v as Currency) ? (v as Currency) : 'USD'
}

export function saveCurrency(c: Currency): void {
  localStorage.setItem(KEY, c)
}
