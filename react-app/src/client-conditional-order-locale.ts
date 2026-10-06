import { conditionalOrderDistance, conditionalOrderLine, conditionalOrderUsd, type ConditionalOrderPreviewSpec, type ConditionalOrderTtl } from './client-conditional-order-preview'
import type { ClientLanguage } from './client-preferences'
import dictionary from './client-conditional-order-locale-copy.json' with { type: 'json' }

const column = { ko: 0, en: 1, ja: 2, 'zh-CN': 3, 'zh-TW': 4, es: 5, fr: 6 } as const
const longTtl = { gtc: '취소하기 전까지 유지', '7d': '7일 동안 유지', '1d': '하루 동안 유지' } as const
const shortTtl = { gtc: '취소 전까지', '7d': '7일', '1d': '하루' } as const
const actions = {
  buy: ['{when} {exchange}에서 {quantity} 한 번 매수합니다', '{when} {exchange}에서 {quantity} {leverage}배로 한 번 매수합니다'],
  sell: ['{when} {exchange}에서 {quantity} 한 번 매도합니다', '{when} {exchange}에서 {quantity} {leverage}배로 한 번 매도합니다'],
  long: ['{when} {exchange}에서 {quantity} 한 번 롱으로 진입합니다', '{when} {exchange}에서 {quantity} {leverage}배로 한 번 롱으로 진입합니다'],
  short: ['{when} {exchange}에서 {quantity} 한 번 숏으로 진입합니다', '{when} {exchange}에서 {quantity} {leverage}배로 한 번 숏으로 진입합니다'],
} as const
function text(language: ClientLanguage, key: keyof typeof dictionary, values: Readonly<Record<string, string | number>> = {}) {
  return dictionary[key][column[language]].replace(/\{(\w+)\}/g, (match, key: string) => values[key] === undefined ? match : String(values[key]))
}

/** Only fixed UI grammar is localized. IDs, symbols, quantities, inequalities,
 * lifecycle/expiry and callbacks still come from the original controlled order. */
export function localizedConditionalOrderLine(order: ConditionalOrderPreviewSpec, language: ClientLanguage): string {
  if (language === 'ko') return conditionalOrderLine(order)
  const up = order.trigger !== null && order.last !== null ? order.trigger >= order.last
    : order.triggerPct !== null ? order.triggerPct >= 0 : order.side === 'sell' || order.side === 'short'
  const when = order.trigger !== null ? text(language, up ? '{symbol}가 {price} 이상이 되면' : '{symbol}가 {price} 이하가 되면', { symbol: order.symbol, price: conditionalOrderUsd(order.trigger) })
    : text(language, '{symbol}가 지금보다 {percent}% 움직이면', { symbol: order.symbol, percent: `${order.triggerPct! > 0 ? '+' : ''}${order.triggerPct}` })
  const quantity = order.qty === 'num' ? text(language, '{quantity} {symbol}를', { quantity: order.qtyNum!, symbol: order.symbol })
    : order.qty === 'half' ? text(language, '주문 시점 보유 {symbol}의 절반을', { symbol: order.symbol })
      : order.side === 'buy' || order.side === 'long' ? text(language, '정한 금액만큼') : text(language, '주문 시점 보유 {symbol} 전부를', { symbol: order.symbol })
  return text(language, actions[order.side][order.lev ? 1 : 0], { when, quantity, exchange: order.exchange ?? text(language, '연결한 거래소'), leverage: order.lev ?? 1 })
}
export function localizedConditionalOrderDistance(order: ConditionalOrderPreviewSpec, language: ClientLanguage): string {
  if (language === 'ko') return conditionalOrderDistance(order)
  if (order.trigger === null || order.last === null) return ''
  const distance = (order.trigger / order.last - 1) * 100
  return Number.isFinite(distance) ? text(language, '지금 {price}, 목표까지 {percent}%', { price: conditionalOrderUsd(order.last), percent: `${distance >= 0 ? '+' : ''}${distance.toFixed(1)}` }) : ''
}
export function localizedConditionalOrderTtl(ttl: ConditionalOrderTtl, language: ClientLanguage, short = false): string {
  return text(language, (short ? shortTtl : longTtl)[ttl])
}
