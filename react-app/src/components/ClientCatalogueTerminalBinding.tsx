import { useState, type ReactNode } from 'react'
import { catalogueTitle } from '../client-catalogue'
import { useCatalogueMarketChart } from '../use-catalogue-market-chart'
import { catalogueMarketCopy } from '../client-catalogue-market-copy'
import { useClientPreferences } from '../client-preferences'
import { useCatalogueCopyInspection, type CatalogueCopyView } from '../use-catalogue-copy-account'
import type { ClientEmptyTerminalMarket } from './ClientAccountTerminal'
import { ClientCatalogueMarketChart } from './ClientCatalogueMarketChart'
import { ClientCatalogueTerminalJudgmentView } from './ClientCatalogueTerminalJudgment'
import common from '../client-catalogue-ui-copy.json'

/** A copied strategy remains a copy, not an owned/live strategy entry. The same
 * selection and inspection feed both judgment and the empty-account chart slot.
 * Caller keys this boundary by owner, retiring all pending state on sign-out. */
export function ClientCatalogueTerminalBinding({ account, chartEnabled, onManage, onFind, children }: {
  account: CatalogueCopyView; onManage: (id: string) => void; onFind: () => void
  chartEnabled: boolean
  children: (slots: { judgment: ReactNode; emptyMarket?: ClientEmptyTerminalMarket }) => ReactNode
}) {
  const { language } = useClientPreferences(), t = catalogueMarketCopy(language), words = common[language]
  const copies = account.error ? [] : account.state?.copies.filter(c => c.record.status === 'active') ?? []
  const [selection, setSelection] = useState<string | null>(null)
  const selected = copies.find(c => c.record.id === selection) ?? copies[0], id = selected?.record.id ?? null
  if (selection !== id) setSelection(id)
  const inspection = useCatalogueCopyInspection(account, id ?? '')
  const value = inspection.data?.value
  const prices = useCatalogueMarketChart(value, account.store.market, chartEnabled), data = prices.data
  const failed = inspection.state === 'error' || prices.state === 'error'
  const pending = <div className="cat-empty" role="status" aria-busy={!failed && (inspection.state === 'loading' || prices.state === 'loading')}><p>{value && prices.state === 'unavailable' ? t.missing : words[failed ? 'failed' : 'loading']}</p>{failed && <button type="button" onClick={inspection.state === 'error' ? inspection.retry : prices.retry}>{words.retry}</button>}</div>
  const emptyMarket: ClientEmptyTerminalMarket | undefined = selected ? {
    symbol: data?.symbol,
    // Close-only data also contains stock/index/commodity proxies. Do not call
    // every source-engine "spot" input a tradable cash-market instrument.
    market: data ? data.market === 'futures' ? t.future : `1D · ${t.close}` : undefined,
    context: value ? `${catalogueTitle(value.strategy.name)} · ${t.snapshot} · ${value.calendar.asof}` : words[inspection.state === 'error' ? 'failed' : 'loading'],
    chart: data ? <ClientCatalogueMarketChart key={`${account.owner}:${id}`} data={data} /> : pending,
  } : undefined
  return children({ emptyMarket, judgment: <ClientCatalogueTerminalJudgmentView account={account} selectedId={id ?? ''} onSelect={setSelection} inspection={inspection} onManage={onManage} onFind={onFind} /> })
}
