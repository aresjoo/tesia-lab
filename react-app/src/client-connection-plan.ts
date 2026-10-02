/** Local navigation only. No payment, exchange connection or execution authority. */
export const planExchanges = [
  ['bitget','Bitget'],['binance','Binance'],['okx','OKX'],['bybit','Bybit'],
  ['mexc','MEXC'],['woox','WOO X'],['gate','Gate'],
] as const
export type PlanExchange = typeof planExchanges[number][0]
export type ConnectionPlanLocation = { step:'plan'|'checkout'|'free'|'account'|'authorize'; exchange:PlanExchange }
export function readConnectionPlanLocation(hash=location.hash):ConnectionPlanLocation|null {
  const match=/^#\/connect\/(plan|checkout|free|account|authorize)(?:\?exchange=([a-z]+))?$/.exec(hash)
  if(!match)return null
  const exchange=match[2]??'bitget'
  if(!planExchanges.some(([id])=>id===exchange))return null
  return {step:match[1] as ConnectionPlanLocation['step'],exchange:exchange as PlanExchange}
}
export function connectionPlanHash(view:ConnectionPlanLocation){return `#/connect/${view.step}?exchange=${view.exchange}`}
