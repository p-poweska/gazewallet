// Waluty wspierane przez mempool.space /api/v1/prices.
export const CURRENCIES = ['USD', 'EUR', 'GBP', 'CHF', 'CAD', 'AUD', 'JPY'] as const
export type Currency = (typeof CURRENCIES)[number]

const KEY = 'gazewallet:currency:v1'

export function loadCurrency(): Currency {
  const v = localStorage.getItem(KEY)
  return CURRENCIES.includes(v as Currency) ? (v as Currency) : 'USD'
}

export function saveCurrency(c: Currency): void {
  localStorage.setItem(KEY, c)
}
