import { useMemo, useState } from 'react'
import type { ClientSession, ClientTurn } from '../client-experience-store'
import { commonBacktestInput, commonPreviewResult } from '../client-common-backtest-preview'
import { commonRevisionComparison, readCommonRevision, type CommonResultContext } from '../client-common-revision'
import { revisionRule, revisionText } from '../client-common-revision-copy'
import { commonBacktestText } from '../client-common-backtest-copy'
import { useClientPreferences } from '../client-preferences'
import '../client-common-revision.css'

export function ClientCommonResultCard({context}:{context:CommonResultContext}){
  const {language}=useClientPreferences(),r=(key:Parameters<typeof revisionText>[1])=>revisionText(language,key)
  const c=(key:Parameters<typeof commonBacktestText>[1])=>commonBacktestText(language,key)
  const result=useMemo(()=>commonPreviewResult({input:context.input,state:{turnId:context.sourceTurnId,period:context.period,amount:context.amount}}),[context])
  const pct=(value:number)=>new Intl.NumberFormat(language,{maximumFractionDigits:1,signDisplay:'exceptZero'}).format(value)+'%'
  return <div className="rv-card" data-testid="common-result-context"><b>{context.title}</b><span>{context.input.pair} · {c(`p${context.period}`)} · {context.amount.toLocaleString(language)} USD</span><div className="rv-kv">
    {[[r('return'),pct((result.evaluation.nav/context.amount-1)*100)],[c('benchmark'),pct((result.points.at(-1)!.benchmark/context.amount-1)*100)],[c('mdd'),pct(result.evaluation.r.mdd)],[r('count'),result.evaluation.trades.length.toLocaleString(language)]].map(([key,value])=><div key={key}><small>{key}</small><i>{value}</i></div>)}
  </div></div>
}

export function ClientCommonRevisionProposal({turn,active,onApply,onOther}:{turn:ClientTurn;active:boolean;onApply:()=>void;onOther:()=>void}){
  const {language}=useClientPreferences(),r=(key:Parameters<typeof revisionText>[1])=>revisionText(language,key)
  const [error,setError]=useState(false),revision=turn.commonRevision!
  const key=(['sl','tp','rsiTh','trendFilter'] as const).find(key=>revision.before.parameters[key]!==revision.proposal.parameters[key])
  const before=revision.before.parameters.tp,after=revision.proposal.parameters.tp
  const number=new Intl.NumberFormat(language,{maximumFractionDigits:2})
  const text=key==='tp'
    ?r(after===null?'removed':before===null?'added':'changed').replace('{before}',before===null?'':number.format(before)).replace('{after}',after===null?'':number.format(after))
    :key==='sl'?`${commonBacktestText(language,'stop')}: ${number.format(Math.abs(revision.before.parameters.sl))}% → ${number.format(Math.abs(revision.proposal.parameters.sl))}%`
    :key==='rsiTh'?`RSI: ${number.format(revision.before.parameters.rsiTh)} → ${number.format(revision.proposal.parameters.rsiTh)}`
    :`${revisionRule(revision.before,language)} → ${revisionRule(revision.proposal,language)}`
  return <section className="client-common-revision" data-testid="common-revision">
    {turn.status==='done'&&revision.kind==='proposal'&&<div className="rv-prop">
      <h3>{r('proposal')}</h3><p className="rv-ch">{text}</p>
      <details className="rv-det"><summary>{r('rules')}</summary><div className="rv-rules"><div><small>{r('before')}</small><p>{revisionRule(revision.before,language)}</p></div><div><small>{r('after')}</small><p>{revisionRule(revision.proposal,language)}</p></div></div></details>
      <p className="rv-why">{r('preview')}</p>
      <button className="rv-primary" type="button" disabled={!active} onClick={()=>{try{onApply();setError(false)}catch{setError(true)}}}>{r('apply')}</button>
      <button className="rv-secondary" type="button" disabled={!active} onClick={onOther}>{r('other')}</button>
      {error&&<p role="alert" className="rv-note">{r('fail')}</p>}
    </div>}
  </section>
}

export function ClientCommonRevisionComparison({session,onRevert}:{session:ClientSession;onRevert?:()=>void}){
  const {language}=useClientPreferences(),r=(key:Parameters<typeof revisionText>[1])=>revisionText(language,key)
  const c=(key:Parameters<typeof commonBacktestText>[1])=>commonBacktestText(language,key)
  const comparison=useMemo(()=>commonRevisionComparison(session),[session])
  const results=useMemo(()=>comparison&&[commonPreviewResult(comparison.before),commonPreviewResult(comparison.current)],[comparison])
  const history=useMemo(()=>session.turns.filter(turn=>turn.commonRevisionOf).slice(-5).reverse().flatMap(turn=>{
    const parent=session.turns.find(t=>t.id===turn.commonRevisionOf)
    const revision=parent&&readCommonRevision(parent.commonRevision,session.turns.slice(0,session.turns.indexOf(parent)))
    const input=revision&&commonBacktestInput({...session,commonBacktest:revision.base})
    return parent&&revision&&input?[{id:parent.id,at:parent.startedAt,revision,input,result:commonPreviewResult(input)}]:[]
  }),[session])
  const [error,setError]=useState(false)
  if(!comparison||!results)return null
  const pct=(value:number)=>new Intl.NumberFormat(language,{maximumFractionDigits:1,signDisplay:'exceptZero'}).format(value)+'%'
  const values=results.map((result,i)=>[(result.evaluation.nav/(i?comparison.current:comparison.before).state.amount-1)*100,result.evaluation.r.mdd,result.evaluation.trades.length])
  const magnitude=(value:number)=>new Intl.NumberFormat(language,{maximumFractionDigits:1}).format(Math.abs(value))+'%'
  const summary=language==='ko'
    ?`수정 후 수익률은 ${pct(values[0][0])}에서 ${pct(values[1][0])}로 ${values[1][0]>values[0][0]?'높아졌습니다':values[1][0]<values[0][0]?'낮아졌습니다':'같습니다'}. 가장 크게 내려간 폭은 ${magnitude(values[0][1])}에서 ${magnitude(values[1][1])}로 ${Math.abs(values[1][1])<Math.abs(values[0][1])?'줄었습니다':Math.abs(values[1][1])>Math.abs(values[0][1])?'커졌습니다':'같습니다'}.`
    :r('summary').replace('{beforeReturn}',pct(values[0][0])).replace('{afterReturn}',pct(values[1][0]))
      .replace('{beforeDrawdown}',magnitude(values[0][1])).replace('{afterDrawdown}',magnitude(values[1][1]))
  return <section className="cbt-box rv-cmp" data-testid="common-revision-comparison">
    <small>{r('compare')}</small>{comparison.same&&<p className="rv-sum">{summary}</p>}
    <p className={`rv-same${comparison.same?'':' warn'}`}>{r(comparison.same?'same':'different')}</p>
    {comparison.same&&<table className="rv-compare-table"><thead><tr><th scope="col" aria-label={r('compare')}/><th scope="col">{r('before')}</th><th scope="col">{r('after')}</th></tr></thead><tbody>{[r('return'),c('mdd'),r('count')].map((label,i)=><tr key={label}><th scope="row">{label}</th><td>{i===2?values[0][i].toLocaleString(language):pct(values[0][i])}</td><td>{i===2?values[1][i].toLocaleString(language):pct(values[1][i])}</td></tr>)}</tbody></table>}
    <details className="rv-det"><summary>{r('rules')}</summary><div className="rv-rules"><div><small>{r('before')}</small><p>{revisionRule(comparison.revision.before,language)}</p></div><div><small>{r('after')}</small><p>{revisionRule(comparison.revision.proposal,language)}</p></div></div></details>
    {onRevert&&<button className="rv-prev" type="button" onClick={()=>{try{onRevert();setError(false)}catch{setError(true)}}}>{r('revert')}</button>}
    <details className="rv-det"><summary>{r('history')} · {history.length.toLocaleString(language)}</summary><ol className="rv-history">{history.map(({id,at,revision,input,result})=><li key={id}>
      <time dateTime={new Date(at).toISOString()}>{new Intl.DateTimeFormat(language,{dateStyle:'medium',timeStyle:'short'}).format(at)}</time>
      <p>{c(`p${input.state.period}`)} · {input.state.amount.toLocaleString(language)} USD</p>
      <p>{r('return')} {pct((result.evaluation.nav/input.state.amount-1)*100)} · {c('mdd')} {pct(result.evaluation.r.mdd)} · {r('count')} {result.evaluation.trades.length.toLocaleString(language)}</p>
      <p>{revisionRule(revision.before,language)}</p>
    </li>)}</ol></details>
    {error&&<p role="alert" className="rv-note">{r('fail')}</p>}
  </section>
}
