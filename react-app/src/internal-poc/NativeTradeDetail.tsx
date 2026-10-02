import { ClientTradeLifecycle } from '../components/ClientTradeLifecycle'
import { useClientPreferences } from '../client-preferences'
import { nativeResultText, type NativeResultTextKey } from './native-result-copy'
import type { NativeTrades } from './native-service-api'

/** Already validated v0.6 row, not an order/decision event producer. The parent
 * owns page/owner lifetime. Preserve decimal strings, signed funding and raw
 * exit reason; never infer time, direction, return rate or a decision rationale.
 * P&L reporting currency is USDT, not the UI preference. The row does not
 * separately provide price quote-unit metadata, so don't infer price units.
 */
export function NativeTradeDetail({ trade, trigger, onClose }: {
  trade: NativeTrades['trades'][number]
  trigger: HTMLElement
  onClose: () => void
}) {
  const { language } = useClientPreferences()
  const r = (key: NativeResultTextKey) => nativeResultText(language, key)
  return <ClientTradeLifecycle title={r('tradeDetailTitle')} regionLabel={r('tradeDetailRegion')} trigger={trigger} onClose={onClose} steps={[
    { title: r('tradeEntryPrice'), value: trade.entryPrice,
      description: `${r('tradeQuantity')}: ${trade.quantity}\n${r('tradeFillReference')}: ${trade.entryFillRef}` },
    { title: r('tradeExitPrice'), value: trade.exitPrice,
      description: `${r('tradeExitReason')}: ${trade.exitReason}\n${r('tradeFillReference')}: ${trade.exitFillRef}` },
    { title: r('tradeNetPnl'), value: `${trade.netPnl} USDT`,
      description: `${r('tradeGrossPnl')}: ${trade.grossPnl} USDT\n${r('tradeFees')}: ${trade.fees} USDT\n${r('tradeFunding')}: ${trade.funding} USDT\n\n${r('slippageIncluded')}` },
  ]} />
}
