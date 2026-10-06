/* eslint-disable react-refresh/only-export-components -- This source pane factory deliberately exports ReactNode data, not a refresh boundary. */
import type { ReactNode } from 'react'
import { CLIENT_BROKERS } from '../client-broker-fixtures'
import { sourceTerminalPrices } from '../client-terminal-source-fixture'
import { sourceDay, sourcePercent, sourceTone } from '../client-terminal-source-view'
import { sourceTradeExitPrice, sourceTerminalOrderRows, sourceTerminalAssets, type SourceTerminalModel } from '../client-terminal-source-ledger'
import '../client-terminal-ledger.css'
import { ClientTerminalVenueIcon } from './ClientTerminalVenueIcon'
import type { ClientLanguage } from '../client-preferences'
import { terminalLedgerText } from '../client-terminal-ledger-locale-copy'

export type SourceTerminalBottomTabsProps = {
  models: readonly SourceTerminalModel[]
  selectedId: string | null
  scope: 'current' | 'all'
  language?: ClientLanguage
  money: (value: number, signed?: boolean) => string
  onSelect: (id: string) => void
  onPause: (id: string) => void
  pauseDisabled?: (id: string) => boolean
  onTrade: (id: string, entryIndex: number, trigger: HTMLElement) => void
}
type Header = string | readonly [string, 'r']
const labels = { pos: '포지션', open: '미체결 주문', orders: '주문 내역', fills: '체결 내역', closed: '종료 포지션', assets: '자산' }

function brokerFor(id: string) {
  return CLIENT_BROKERS.find(broker => broker.id === id) ?? { name: id && id !== 'unlinked' ? id : '미연결 (위임 대기)', col: '#3a4254', fg: '#dbdbdb' }
}
function Exchange({ id, compact = true, language }: { id: string; compact?: boolean; language: ClientLanguage }) {
  const broker = brokerFor(id)
  return <><span aria-hidden="true" className={`exb${compact ? ' sm' : ''}`} style={{ background: broker.col, color: broker.fg }}><ClientTerminalVenueIcon id={id} size={compact ? 15 : 17} fallback={broker.name.slice(0, 2).toUpperCase()} /></span>{compact && <> {id === 'unlinked' || !id ? terminalLedgerText(language, broker.name) : broker.name}</>}</>
}
function Frame({ scope, label, headers, rows, empty, language }: { scope: 'current' | 'all'; label: string; headers: readonly Header[]; rows: ReactNode[]; empty: readonly [string, string]; language: ClientLanguage }) {
  const t = (value: string, values?: Record<string, string | number>) => terminalLedgerText(language, value, values)
  return <div className="client-terminal-ledger">
    <p className="tft-tnote">{t('검증 시뮬레이션 파생 기록이에요, {scope} 범위', { scope: t(scope === 'all' ? '전체 전략' : '현재 전략') })}</p>
    {rows.length ? <div className="tft-tblw" role="region" aria-label={t('{label} 표', { label: t(label) })} tabIndex={0}><table className="tft-tbl" aria-label={t(label)}>
      <thead><tr>{headers.map((header, index) => {
        const text = typeof header === 'string' ? header : header[0]
        return <th key={index} scope="col" className={typeof header === 'string' ? undefined : 'r'}>{text === '전략 제어' || text === '규칙' ? <span className="ledger-sr-only">{t(text)}</span> : t(text)}</th>
      })}</tr></thead>
      <tbody>{rows}</tbody>
    </table></div> : <div className="tft-empty"><b>{t(empty[0])}</b><span>{t(empty[1])}</span></div>}
  </div>
}

/** Source-preview panes only, never exchange orders, balances or fee evidence. */
export function sourceTerminalBottomTabs({ models, selectedId, scope, language = 'ko', money, onSelect, onPause, pauseDisabled, onTrade }: SourceTerminalBottomTabsProps): { id: string; label: string; content: ReactNode; count?: number }[] {
  const t = (value: string, values?: Record<string, string | number>) => terminalLedgerText(language, value, values)
  // Source tfTmScopeList also falls back to all strategies when selection is absent.
  const list = scope === 'all' || !selectedId ? models : models.filter(model => model.seed.id === selectedId)
  const strategy = (model: SourceTerminalModel) => <button type="button" className="stlk" onClick={() => onSelect(model.seed.id)}>{model.seed.name}</button>
  const leading = (model: SourceTerminalModel) => <><td><Exchange id={model.seed.exchangeId} language={language} /></td><td>{strategy(model)}</td></>
  const pos: ReactNode[] = [], open: ReactNode[] = [], closed: ReactNode[] = []
  for (const model of list) {
    const { seed, result } = model
    const position = seed.status === 'live' ? result.pos : null
    if (position) {
      pos.push(<tr key={seed.id}>{leading(model)}<td>{seed.symbol}</td><td><span className="sd lg">LONG</span></td>
        <td className="r">{position.qty.toFixed(4)}</td><td className="r">{money(position.entryP)}</td><td className="r">{money(position.curP)}</td><td className="r">{money(position.stopP)}</td>
        <td className={`r ${sourceTone(position.krw)}`}>{money(position.krw, true)}</td><td className={`r ${sourceTone(position.chg)}`}>{sourcePercent(position.chg * 100)}</td>
        <td className="r"><button type="button" className="tbtn" disabled={pauseDisabled?.(seed.id)} aria-label={t('{name} 중지', { name: seed.name })} title={t('시뮬레이션 전략 중지, 포지션 청산이 아닙니다')} onClick={() => { if (!pauseDisabled?.(seed.id)) onPause(seed.id) }}>{t('중지')}</button></td></tr>)
      const pending = (type: string, price: number, note: string) => <tr key={`${seed.id}:${type}`}>{leading(model)}<td>{seed.symbol}</td><td><span className="sd sh">SELL</span></td><td>{t(type)}</td><td className="r">{money(price)}</td><td className="r">{position.qty.toFixed(4)}</td><td>{t('대기')}</td><td className="r"><span className="mut">{t(note)}</span></td></tr>
      open.push(pending('손절 STOP', position.stopP, '규칙 주문, 취소는 전략 중지로'))
      if (position.tpP) open.push(pending('익절 LIMIT', position.tpP, '규칙 주문'))
    }
    for (const trade of result.trades.slice(-10).reverse()) {
      const showTrade = (trigger: HTMLElement) => { onSelect(seed.id); onTrade(seed.id, trade.entry, trigger) }
      closed.push(<tr key={`${seed.id}:${trade.entry}`} className="trade-row" onClick={event => {
        const button = event.currentTarget.querySelector<HTMLButtonElement>('button')
        if (button) showTrade(button)
      }}><td><Exchange id={seed.exchangeId} language={language} /></td><td><button type="button" className="stlk" aria-label={t('{name} {date} 종료 포지션 상세', { name: seed.name, date: sourceDay(trade.entry) })} onClick={event => { event.stopPropagation(); showTrade(event.currentTarget) }}>{seed.name}</button></td>
        <td>{seed.symbol}</td><td><span className="sd lg">LONG</span></td><td className="r">{money(sourceTerminalPrices[trade.entry])}</td><td className="r">{money(sourceTradeExitPrice(model, trade))}</td>
        <td className="r">{t('{count}봉', { count: trade.exit - trade.entry })}</td><td className="r">{money(trade.capB * .002)}</td><td className={`r ${sourceTone(trade.krw)}`}>{money(trade.krw, true)} ({sourcePercent(trade.pnl * 100)})</td></tr>)
    }
  }
  const byId = new Map(list.map(model => [model.seed.id, model]))
  const orders = sourceTerminalOrderRows(list)
  const orderRows = (fills: boolean) => orders.map(order => {
    const model = byId.get(order.strategyId)!
    return <tr key={order.id}>{leading(model)}<td>{sourceDay(order.index)}</td><td>{model.seed.symbol}</td><td><span className={`sd ${order.side === 'BUY' ? 'lg' : 'sh'}`}>{order.side}</span></td>
      {!fills && <td>{t(order.type)}</td>}<td className="r">{money(order.price)}</td><td className="r">{order.quantity.toFixed(4)}</td>
      {fills ? <td className="r">{money(order.fee)}</td> : <td><span className="okst">{t('체결 완료')}</span></td>}</tr>
  })
  const assets = sourceTerminalAssets(models)
  const assetContent = <div className="client-terminal-ledger"><p className="tft-tnote">{t('계정 전체 범위, 검증 시뮬레이션 파생이에요')}</p>
    {assets.length ? <div className="tft-assets">{assets.map(asset => {
      const broker = brokerFor(asset.exchangeId), name = asset.exchangeId === 'unlinked' || !asset.exchangeId ? t(broker.name) : broker.name
      return <article className="tft-asx" key={asset.exchangeId} aria-label={t('{name} 자산', { name })}>
      <div className="ah2"><Exchange id={asset.exchangeId} compact={false} language={language} /><b>{name}</b><span className="mut">{t('전략 {count}개', { count: asset.strategyCount })}</span></div>
      <div className="ag2" role="region" aria-label={t('{name} 자산 금액', { name })} tabIndex={0}><span><small>{t('Equity')}</small><b>{money(asset.equity)}</b></span><span><small>{t('Available')}</small><b>{money(asset.available)}</b></span><span><small>{t('Used')}</small><b>{money(asset.used)}</b></span><span><small>{t('미실현')}</small><b className={sourceTone(asset.unrealized)}>{money(asset.unrealized, true)}</b></span></div>
      <div className="af2">{t(asset.shared ? '고정 체험 데이터, 시뮬레이션, 위임 예산 공용' : '고정 체험 데이터, 시뮬레이션')}</div>
    </article>})}</div> : <div className="tft-empty"><b>{t('연결된 자산이 없어요')}</b><span>{t('전략을 만들면 거래소별 자산 현황이 여기 모여요.')}</span></div>}
  </div>
  const pane = (id: Exclude<keyof typeof labels, 'assets'>, headers: readonly Header[], rows: ReactNode[], empty: readonly [string, string]) => ({ id, label: t(labels[id]), ...(id === 'pos' ? { count: rows.length } : {}), content: <Frame scope={scope} language={language} label={labels[id]} headers={headers} rows={rows} empty={empty} /> })
  return [
    pane('pos', ['거래소', '전략', '심볼', '방향', ['수량', 'r'], ['진입가', 'r'], ['현재가', 'r'], ['손절가', 'r'], ['미실현', 'r'], ['%', 'r'], ['전략 제어', 'r']], pos, ['현재 포지션이 없습니다.', '실행 중 전략이 진입하면 여기에 표시돼요.']),
    pane('open', ['거래소', '전략', '심볼', '방향', '유형', ['가격', 'r'], ['수량', 'r'], '상태', ['규칙', 'r']], open, ['미체결 주문이 없습니다.', '포지션이 열리면 규칙 기반 손절, 익절 주문이 여기 걸려요.']),
    pane('orders', ['거래소', '전략', '일자', '심볼', '방향', '유형', ['가격', 'r'], ['수량', 'r'], '상태'], orderRows(false), ['주문 내역이 없어요', '전략이 거래를 실행하면 주문 이벤트가 기록돼요.']),
    pane('fills', ['거래소', '전략', '일자', '심볼', '방향', ['체결가', 'r'], ['수량', 'r'], ['수수료', 'r']], orderRows(true), ['체결 내역이 없어요', '체결이 발생하면 여기에 표시돼요.']),
    pane('closed', ['거래소', '전략', '심볼', '방향', ['진입', 'r'], ['청산', 'r'], ['보유', 'r'], ['수수료', 'r'], ['실현 손익', 'r']], closed, ['종료된 포지션이 없어요', '완결된 거래가 생기면 Agent 판단 기록과 연결돼요.']),
    { id: 'assets', label: t(labels.assets), content: assetContent },
  ]
}
