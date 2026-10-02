/** KRW-denominated client preview money only. Not a service FX/quote adapter. */
import { clientCurrencies, formatReferenceMoney, type ClientLanguage } from './client-preferences'

export function sourceMoney(won: number, currency: string, language: ClientLanguage, signed = false) {
  const rate = clientCurrencies.find(item => item.c === 'KRW')!.r
  const label = formatReferenceMoney(Math.abs(won) / rate, currency, language)
  return `${won < 0 ? '−' : signed ? '+' : ''}${label}`
}
