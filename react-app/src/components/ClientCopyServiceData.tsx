import { useId, useState, type ReactNode } from 'react'
import { useClientPreferences } from '../client-preferences'
import { copyHistoryText } from '../client-copy-history-copy'
import { copyProfileText } from '../client-copy-profile-copy'
import { copySummaryText } from '../client-copy-trading-copy'
import { sharedPerformanceCopy } from '../client-shared-performance-copy'
import { sharingUnavailable } from '../client-sharing-presentation'
import type { CopyDataSet, CopyServiceAccount, CopyServiceCalendar, CopyServicePosition, CopyServiceProfileData, CopyServiceTransfer } from '../client-copy-service-data'
import '../client-shared-performance.css'

function useDisplay(asset: string) {
  const { language } = useClientPreferences()
  const n = (value: number | null | undefined, digits = 2) => value == null || !Number.isFinite(value) ? '—' : value.toLocaleString(language, { maximumFractionDigits: digits })
  return { language, n, money: (value: number | null | undefined) => value == null || !Number.isFinite(value) ? '—' : `${n(value, 8)} ${asset}`,
    pct: (value: number | null | undefined) => value == null || !Number.isFinite(value) ? '—' : `${value >= 0 ? '+' : ''}${n(value)}%`,
    date: (value: number | null) => value == null || !Number.isFinite(new Date(value).getTime()) ? '—' : new Date(value).toLocaleString(language, { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) }
}
type TableRow = { id: string; cells: ReactNode[] }
function DataTable({ title, headers, data, rows, emptyTitle }: { title: string; headers: string[]; data?: Pick<CopyDataSet<unknown>, 'state' | 'message'>; rows: TableRow[]; emptyTitle?: string }) {
  const { language } = useClientPreferences()
  const ready = data?.state === 'ready'
  const empty = ({ko:'표시할 내역이 없어요',en:'No records to display.',ja:'表示する記録はありません。','zh-CN':'暂无可显示的记录。','zh-TW':'暫無可顯示的紀錄。',es:'No hay registros para mostrar.',fr:'Aucun enregistrement à afficher.'})[language]
  return <div className="cpx-tblw" role="region" aria-label={title} tabIndex={0} aria-busy={data?.state === 'loading'}>
    <table className="cpx-tbl"><caption className="sr-only">{title}</caption><thead><tr>{headers.map((header, i) => <th scope="col" key={i}>{header}</th>)}</tr></thead>
      <tbody>{ready && rows.length ? rows.map(row => <tr key={row.id}>{row.cells.map((cell, i) => <td className="num" key={i}>{cell === '—' ? <span aria-label={sharingUnavailable(language)}>—</span> : cell}</td>)}</tr>) : <tr><td colSpan={headers.length}><span role={data?.state === 'error' ? 'alert' : 'status'}>{data?.message || (ready ? emptyTitle ?? empty : sharingUnavailable(language))}</span></td></tr>}</tbody></table>
  </div>
}

export function ClientServicePositions({ data, asset, onFlat }: { data?: CopyDataSet<CopyServicePosition>; asset: string; onFlat?: () => void }) {
  const { language, n, money, pct } = useDisplay(asset)
  const headers = [copyHistoryText(language, 'pair'), copyHistoryText(language, 'direction'), ...(['규모', '평균 진입가', '현재가', '청산 위험', '손절 / 목표', '미실현 손익'] as const).map(key => copySummaryText(language, key))]
  return <><DataTable title={copySummaryText(language, '카피 포지션')} emptyTitle={copyProfileText(language,'지금은 표시할 오픈 포지션이 없어요')} headers={headers} data={data} rows={(data?.rows ?? []).map(row => ({ id: row.id, cells: [row.pair, row.direction, money(row.size), n(row.entryPrice, 8), n(row.currentPrice, 8), row.liquidationRisk ?? '—', row.stopTarget ?? '—', <span className={row.unrealized != null && row.unrealized < 0 ? 'd' : 'u'}>{money(row.unrealized)} ({pct(row.returnPercent)})</span>] }))} />
    {onFlat && <div className="cpd-acts"><button type="button" className="ss3-dbtn" disabled={data?.state !== 'ready' || !data.rows.length} onClick={onFlat}>{copySummaryText(language, '포지션 전체 정리')}</button></div>}</>
}

function Transfers({ data, asset }: { data?: CopyDataSet<CopyServiceTransfer>; asset: string }) {
  const { language, n, date } = useDisplay(asset), h = (key: Parameters<typeof copyHistoryText>[1]) => copyHistoryText(language, key)
  return <DataTable title={h('bal')} emptyTitle={copyProfileText(language,'아직 자금 이동 내역이 없어요')} headers={(['at', 'type', 'amount', 'asset', 'direction'] as const).map(h)} data={data} rows={(data?.rows ?? []).map(row => ({id: row.id, cells: [date(row.at), h(row.kind), row.amount == null ? '—' : `${n(row.amount,8)} ${row.asset}`, row.asset, row.direction]}))} />
}

function Calendar({ data, asset }: { data?: CopyServiceCalendar; asset: string }) {
  const [selected, setSelected] = useState<string | null>(null)
  const { language, money, pct, n } = useDisplay(asset), id = useId()
  const months = data?.state === 'ready' ? data.months.filter(item => /^\d{4}-(0[1-9]|1[0-2])$/.test(item.month)).sort((a,b) => a.month.localeCompare(b.month)) : []
  const index = Math.max(0, selected ? months.findIndex(item => item.month === selected) : months.length - 1), month = months[index]
  const date = month ? new Date(`${month.month}-01T00:00:00Z`) : null
  const length = date ? new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate() : 0
  const s = (key: Parameters<typeof sharedPerformanceCopy>[1]) => sharedPerformanceCopy(language, key)
  return <section className="client-shared-performance ss3-cal" aria-label={copyProfileText(language, '손익 캘린더')} aria-busy={data?.state === 'loading'}>
    <div className="ss3-ch shared-calendar-heading"><h3>{copyProfileText(language, '손익 캘린더')}</h3><div>
      <button type="button" className="cal-nav" aria-label={s('이전 월')} aria-disabled={!month || index === 0} disabled={!month || index === 0} onClick={() => setSelected(months[index - 1].month)}>‹</button>
      <span id={id}>{date ? date.toLocaleDateString(language, { timeZone: 'UTC', year: 'numeric', month: 'long' }) : '—'}</span>
      <button type="button" className="cal-nav" aria-label={s('다음 월')} aria-disabled={!month || index === months.length - 1} disabled={!month || index === months.length - 1} onClick={() => setSelected(months[index + 1].month)}>›</button>
    </div></div>
    <div className="cal-hd" aria-hidden="true">{Array.from({length:7},(_,day)=><span key={day}>{new Date(Date.UTC(2023,0,1+day)).toLocaleDateString(language,{timeZone:'UTC',weekday:'short'})}</span>)}</div>
    <div className="cal-g" role="group" aria-labelledby={id}>
      {Array.from({length:date?.getUTCDay() ?? 0},(_,i)=><span className="cal-c" key={`blank-${i}`} aria-hidden="true"/>)}
      {Array.from({length},(_,i)=>{const key=`${month.month}-${String(i+1).padStart(2,'0')}`, day=month.days.find(item=>item.date===key); const detail=`${key} · ${money(day?.pnl)} · ${pct(day?.returnPercent)} · ${n(day?.trades,0)}`; return <button type="button" style={{border:0,textAlign:'left',minHeight:44}} disabled={!day} className={`cal-c ${day?.pnl == null ? 'off' : day.pnl > 0 ? 'u' : day.pnl < 0 ? 'd' : 'z'}`} key={key} aria-label={detail} title={detail} onClick={event=>event.currentTarget.focus()}><small>{i+1}</small>{day?.returnPercent != null && <i>{pct(day.returnPercent)}</i>}<span className="cal-tooltip" aria-hidden="true">{money(day?.pnl)}</span></button>})}
    </div>{!month && <p role={data?.state === 'error' ? 'alert' : 'status'}>{data?.message || (data?.state === 'ready' ? copyHistoryText(language,'emptyTitle') : sharingUnavailable(language))}</p>}
  </section>
}

/** Original profile tabs, with supplied rows instead of opaque content slots. */
export function ClientServiceProfilePanel({ tab, data, onOpenStrategy }: { tab: 'pos' | 'cal' | 'bal' | 'cop'; data?: CopyServiceProfileData | null; onOpenStrategy?: () => void }) {
  const { language, n, money, pct, date } = useDisplay(data?.asset ?? '')
  if (tab === 'pos') return <ClientServicePositions data={data?.positions} asset={data?.asset ?? ''} />
  if (tab === 'cal') return <><Calendar data={data?.calendar} asset={data?.asset ?? ''} />{onOpenStrategy && <div className="cpp-empty-action"><button type="button" className="obtn" onClick={onOpenStrategy}>{copyProfileText(language,'전략 상세에서 캘린더 보기')}</button></div>}</>
  if (tab === 'bal') return <Transfers data={data?.transfers} asset={data?.asset ?? ''} />
  const rank = ({ko:'순위',en:'Rank',ja:'順位','zh-CN':'排名','zh-TW':'排名',es:'Puesto',fr:'Rang'})[language]
  return <DataTable title={copyProfileText(language,'카피하는 사람들')} headers={[rank,copyProfileText(language,'카피하는 사람'),copySummaryText(language,'누적 투자'),copyHistoryText(language,'pnl'),copyHistoryText(language,'return'),copyHistoryText(language,'at')]} data={data?.copiers} rows={(data?.copiers?.rows ?? []).map(row=>({id:row.id,cells:[n(row.rank,0),row.nick,money(row.investment),money(row.pnl),pct(row.returnPercent),date(row.startedAt)]}))}/>
}

export function ClientServiceCopyHistory({ tab, account }: { tab: 'hist' | 'share' | 'bal' | 'tx'; account?: CopyServiceAccount }) {
  const { language, n, money, pct, date } = useDisplay(account?.asset ?? '')
  const h = (key: Parameters<typeof copyHistoryText>[1],values?:Record<string,string|number>) => copyHistoryText(language,key,values)
  if (tab === 'bal') return <>{account?.transferWarning && <div className="cpp-ai warn">{account.transferWarning}</div>}<div className="cpx-sumline">{h('transfersSummary',{count:account?.transfers?.state==='ready'?n(account.transfers.rows.length,0):'—'})}</div><Transfers data={account?.transfers} asset={account?.asset ?? ''}/></>
  if (tab === 'hist') return <><div className="cpx-sumline">{h('summary',{count:n(account?.historySummary?.count,0),wins:n(account?.historySummary?.wins,0),sum:money(account?.historySummary?.pnl)})}</div><DataTable title={h('hist')} headers={(['pair','direction','entryPrice','exitPrice','pnl','return','reason','exitTime'] as const).map(key=>h(key))} data={account?.trades} rows={(account?.trades?.rows ?? []).map(row=>({id:row.id,cells:[row.pair,row.direction,n(row.entryPrice,8),n(row.exitPrice,8),money(row.pnl),pct(row.returnPercent),row.reason,date(row.exitedAt)]}))}/></>
  if (tab === 'share') return <><div className="cpp-ai">{h('shareSummary',{profit:money(account?.metrics?.realized),share:n(account?.sharePercent)})}</div><DataTable title={h('share')} headers={(['period','realized','settled','pending','ratio','shareAmount'] as const).map(key=>h(key))} data={account?.shares} rows={(account?.shares?.rows ?? []).map(row=>({id:row.id,cells:[`${date(row.from)} ~ ${row.to == null ? h('present') : date(row.to)}`,money(row.realized),money(row.settled),money(row.pending),row.ratioPercent == null ? '—' : `${n(row.ratioPercent)}%`,money(row.amount)]}))}/></>
  return <><div className="cpx-sumline">{h('transactionsSummary',{fills:h('fillsCount',{count:n(account?.transactionSummary?.fills,0)}),fee:money(account?.transactionSummary?.fee),funding:money(account?.transactionSummary?.funding)})}</div><div className="cpp-ai">{h('fundingHint')}</div><details className="cpx-raw" open><summary>{h('expand',{count:account?.transactions?.state==='ready'?n(account.transactions.rows.length,0):'—'})}</summary><DataTable title={h('raw')} headers={(['at','category','pair','quantity','fee','balanceChange'] as const).map(key=>h(key))} data={account?.transactions} rows={(account?.transactions?.rows ?? []).map(row=>({id:row.id,cells:[date(row.at),row.category,row.pair,row.quantity ?? '—',money(row.fee),money(row.balanceChange)]}))}/></details></>
}
