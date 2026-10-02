import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { planExchanges, type ConnectionPlanLocation, type PlanExchange } from '../client-connection-plan'
import { useBrokerText } from '../client-broker-copy'
import type { CommonResultContext } from '../client-common-revision'
import { commonPreviewResult } from '../client-common-backtest-preview'
import { commonBacktestText } from '../client-common-backtest-copy'
import { useClientPreferences } from '../client-preferences'
import '../client-connection-plan.css'

type IconName='bolt'|'grid'|'coin'|'card'|'lock'|'head'|'swap'|'cal'|'trophy'
const icons:Record<IconName,ReactNode>={
  bolt:<path d="M13 2L4 14h6l-1 8 9-12h-6z"/>,
  grid:<><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
  coin:<><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5h4a1.75 1.75 0 0 1 0 3.5h-3a1.75 1.75 0 0 0 0 3.5h4"/></>,
  card:<><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3 10h18"/></>,
  lock:<><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
  head:<><path d="M4.5 13a7.5 7.5 0 0 1 15 0"/><rect x="3" y="12.5" width="4" height="6.5" rx="1.5"/><rect x="17" y="12.5" width="4" height="6.5" rx="1.5"/><path d="M19 19v1a2 2 0 0 1-2 2h-3"/></>,
  swap:<path d="M7 7h11M15 4l3 3-3 3M17 17H6M9 14l-3 3 3 3"/>,
  cal:<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></>,
  trophy:<path d="M8 4h8v5a4 4 0 0 1-8 0zM6 6H4a2 2 0 0 0 2 4M18 6h2a2 2 0 0 1-2 4M12 13v4M8 21h8M10 17h4"/>,
}
function Icon({name}:{name:IconName}){return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[name]}</svg>}
function Logo({id,size=18}:{id:PlanExchange;size?:number}){
  const [failed,setFailed]=useState(false),name=planExchanges.find(([key])=>key===id)![1]
  // 9fb px.js replaces the earlier Gate monogram with the local app icon.
  return failed?<span className="cpl-logo-fallback" aria-hidden="true">{name.slice(0,2)}</span>:<img src={`/client-broker-assets/app-${id}.${id==='gate'?'jpg':'png'}`} width={size} height={size} alt="" onError={()=>setFailed(true)}/>
}
function Logos(){return <span className="cpl-logos" aria-hidden="true">{planExchanges.map(([id])=><Logo key={id} id={id} size={16}/>)}</span>}
function Benefits({paid=false,short=false}:{paid?:boolean;short?:boolean}){
  const rows:[IconName,ReactNode][]=[['bolt','전략 자동 실행']]
  if(!short)rows.push(['grid',<>연결 가능한 거래소 7곳 <Logos/></>])
  if(paid){rows.push(['swap','초대 가입 없이 계정 연결']);if(!short)rows.push(['cal','거래소 7곳 모두 연결'])}
  else rows.push(['coin','거래 수수료 환급'],['trophy','전략 대회 참가'],['card','카드 등록 없이 이용'])
  rows.push(['lock','연결 권한: 잔고 조회와 주문'],['head','24시간 고객 지원'])
  return <ul className={`cpl-items${short?' sm':''}`}>{rows.map(([icon,label])=><li key={icon}><Icon name={icon}/><span>{label}</span></li>)}</ul>
}
const unavailable='실제 결제·거래소 연결은 아직 제공되지 않습니다. 카드 정보는 입력할 수 없습니다.'
/** af7b8d1 plView/plCheckout and px. Display/navigation, never provider authority. */
export default function ClientConnectionPlan({view,resultContext,signedIn,onNavigate,onSignup,onClose,onHelp}:{
  view:ConnectionPlanLocation;signedIn:boolean;onNavigate:(next:ConnectionPlanLocation)=>void
  resultContext?:CommonResultContext|null
  onSignup:(next:ConnectionPlanLocation)=>void;onClose:()=>void;onHelp:(trigger:HTMLButtonElement)=>void
}){
  const t=useBrokerText(),heading=useRef<HTMLHeadingElement>(null),root=useRef<HTMLElement>(null)
  const {language}=useClientPreferences()
  const result=useMemo(()=>resultContext?commonPreviewResult({input:resultContext.input,state:{turnId:resultContext.sourceTurnId,period:resultContext.period,amount:resultContext.amount}}):null,[resultContext])
  const good=Boolean(result&&result.evaluation.trades.length&&result.evaluation.pnl>=0&&result.evaluation.nav>=result.points.at(-1)!.benchmark)
  const number=new Intl.NumberFormat(language,{maximumFractionDigits:1}),percent=(value:number)=>`${value>0?'+':''}${number.format(value)}%`
  const equity=result?.points.map(p=>p.value)??[],low=Math.min(...equity),high=Math.max(...equity)
  const spark=equity.map((value,i)=>`${(i/Math.max(1,equity.length-1)*280).toFixed(1)},${(69-(value-low)/(high-low||1)*66).toFixed(1)}`).join(' ')
  const step=signedIn?view.step:'plan',exchange=planExchanges.find(([id])=>id===view.exchange)!
  const isPostPlan=step==='free'||step==='account'||step==='authorize'
  const title=step==='checkout'?'플랜 구성':step==='free'?'거래소 선택':step==='account'?`${exchange[1]} 계정`:step==='authorize'?`${exchange[1]} 연결`:'거래소 연결'
  useLayoutEffect(()=>{root.current?.scrollTo({top:0,behavior:'instant'});heading.current?.focus({preventScroll:true})},[step,title])
  const pick=(next:ConnectionPlanLocation['step'])=>{const choice={...view,step:next};if(!signedIn)onSignup(choice);else onNavigate(choice)}
  const chooseExchange=<div className="cpl-exs" role="radiogroup" aria-label={t('거래소')}>{planExchanges.map(([id,name],index)=><button type="button" role="radio" key={id} className={id===view.exchange?'on':''} aria-checked={id===view.exchange} tabIndex={id===view.exchange?0:-1} onClick={()=>onNavigate({...view,exchange:id})} onKeyDown={event=>{
    let next:number
    if(event.key==='ArrowRight'||event.key==='ArrowDown')next=(index+1)%planExchanges.length
    else if(event.key==='ArrowLeft'||event.key==='ArrowUp')next=(index+planExchanges.length-1)%planExchanges.length
    else if(event.key==='Home')next=0
    else if(event.key==='End')next=planExchanges.length-1
    else return
    event.preventDefault()
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus()
    onNavigate({...view,exchange:planExchanges[next][0]})
  }}><Logo id={id} size={22}/><b>{name}</b></button>)}</div>
  return <section ref={root} className={`client-connection-plan${step!=='plan'?' is-checkout':''}`} data-testid="connection-plan" data-step={step} aria-labelledby="connection-plan-title">
    <div className={`cpl${step!=='plan'?' cpl-co':''}${isPostPlan?' cpx':''}`}>
      <header className={step==='plan'?'cpl-head':`cpl-cohead${isPostPlan?' cpx-head':''}`}>
        <button className="cpl-back" type="button" aria-label={t('뒤로')} onClick={()=>step==='plan'?onClose():onNavigate({...view,step:step==='authorize'?'account':step==='account'?'free':'plan'})}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></button>
        <h1 id="connection-plan-title" ref={heading} tabIndex={-1}>{title}</h1>
      </header>
      {step==='plan'?<div className={`cpl-grid${good?' has-bt':''}`}>
        {good&&result&&resultContext&&<article className="cpl-card cpl-bt" data-testid="connection-result-card">
          <div className="cpl-lb">실행할 전략</div><h2 className="cpl-h">{resultContext.title}</h2>
          <p className="cpl-d">{commonBacktestText(language,`p${resultContext.period}`)}, {number.format(resultContext.amount)} USD로 시작. {exchange[1]}에서 실행합니다.</p>
          <div className="cpl-price"><span className="num up">{percent((result.evaluation.nav/resultContext.amount-1)*100)}</span><small>검증 수익률</small></div>
          <svg className="cpl-spark" viewBox="0 0 280 72" preserveAspectRatio="none" aria-hidden="true"><polyline points={spark} fill="none" stroke="#2fb98a" strokeWidth="2"/></svg>
          <ul className="cpl-items"><li><Icon name="coin"/><span>그냥 들고 있었다면 <b className="num">{percent((result.points.at(-1)!.benchmark/resultContext.amount-1)*100)}</b></span></li><li><Icon name="swap"/><span>가장 크게 내려간 폭 <b className="num">{number.format(result.evaluation.r.mdd)}%</b></span></li><li><Icon name="cal"/><span>거래 <b className="num">{result.evaluation.trades.length.toLocaleString(language)}번</b></span></li></ul>
          <p className="cpl-foot">{commonBacktestText(language,'preview')}</p>
        </article>}
        <article className="cpl-card cpl-hi"><div className="cpl-top"><span className="cpl-lb">TETH 초대 계정</span></div><h2 className="cpl-h">거래하는 사람을 위해</h2>
          <p className="cpl-d">TETH 초대로 가입한 거래소 계정으로 이용합니다. 초대 계정이 없다면 거래소에 새로 가입합니다.</p>
          <div className="cpl-price"><i>$</i><span className="num cpl-grad">0</span><small>/ 월</small></div>
          <button type="button" className="cpl-cta cpl-cta-hi" onClick={()=>pick('free')}>무료로 시작하기</button>
          <div className="cpl-sub">포함된 기능</div><Benefits/>
          <p className="cpl-foot">Bitget, Binance, OKX, Bybit, MEXC는 거래 수수료의 20%, WOO X과 Gate는 50%를 환급합니다. 연결 과정에서 TETH 초대 계정 여부를 확인합니다.</p>
        </article>
        <article className="cpl-card"><div className="cpl-top"><span className="cpl-lb">TETH 구독</span></div><h2 className="cpl-h">지금 쓰는 계정 그대로</h2>
          <p className="cpl-d">TETH 초대로 가입하지 않은 거래소 계정도 연결합니다. 기존 계정을 유지하며 전략을 실행합니다.</p>
          <div className="cpl-price"><i>$</i><span className="num">280</span><small>/ 월</small></div>
          <button type="button" className="cpl-cta" onClick={()=>pick('checkout')}>구독으로 시작하기</button>
          <div className="cpl-sub">구독 혜택</div><Benefits paid/>
          <p className="cpl-foot">매월 자동 결제됩니다. 설정의 결제에서 언제든 해지할 수 있으며, 해지 후에도 남은 구독 기간 동안 이용할 수 있습니다.</p>
        </article>
      </div>:step==='checkout'?<div className="cpl-cogrid">
        <section className="cpl-left"><h2 className="cpl-t3">TETH 구독</h2><p className="cpl-d2">먼저 연결할 거래소를 고르십시오. 구독 하나로 거래소 7곳을 모두 연결할 수 있습니다.</p>{chooseExchange}
          <h2 className="cpl-t3 mt">결제 수단 선택하기</h2>
          <button className="cpl-apple" type="button" disabled aria-describedby="connection-plan-unavailable" aria-label="Apple Pay로 결제"><svg width="16" height="19" viewBox="0 0 16 19" aria-hidden="true"><path fill="currentColor" d="M13.1 10.1c0-2.4 2-3.6 2.1-3.6-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9s-1.9-.9-3.2-.8C3.2 4.7 1.7 5.6.8 7.2c-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8s1.9.8 3.2.8c1.3 0 2.1-1.2 2.9-2.4.9-1.4 1.3-2.7 1.3-2.8-.1 0-2.4-.9-2.4-4.1zM10.7 3c.6-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1 .1 2.1-.6 2.8-1.4z"/></svg><span>Pay</span></button>
          <div className="cpl-or"><span>또는</span></div>
          <fieldset className="cpl-form" disabled aria-describedby="connection-plan-unavailable"><legend className="sr-only">카드 정보</legend>
            <div className="cpl-in big"><input placeholder="카드 번호" aria-label="카드 번호" autoComplete="off"/><span className="cpl-brands" aria-hidden="true"><i className="visa">VISA</i><i className="mc"/><i className="amex">AMEX</i></span></div>
            <div className="two"><div className="cpl-in"><input placeholder="만료 날짜" aria-label="만료 날짜" autoComplete="off"/></div><div className="cpl-in"><input placeholder="보안 코드" aria-label="보안 코드" autoComplete="off"/><span className="cpl-cvc" aria-hidden="true">123</span></div></div>
            <div className="cpl-in"><input placeholder="카드에 적힌 이름" aria-label="카드에 적힌 이름" autoComplete="off"/></div>
            <label className="cpl-ck"><input type="checkbox" defaultChecked/><span>다음 결제에도 이 카드 사용</span></label>
          </fieldset>
          <p id="connection-plan-unavailable" className="cpl-unavailable" role="status">{unavailable}</p>
        </section>
        <aside className="cpl-right"><div className="cpl-sumcard"><h2>TETH 구독</h2><p>선택한 거래소 계정으로 전략을 실행합니다.</p><Benefits paid short/>
          <div className="cpl-lines"><div><span>연결할 계정: {exchange[1]}</span></div><div><span>매월 구독료</span><b className="num">$280.00</b></div><div className="tot"><span>오늘 결제 금액</span><b className="num">$280.00</b></div></div>
          <button className="cpl-cta cpl-cta-w" type="button" disabled aria-describedby="connection-plan-unavailable">$280 결제하고 시작하기</button>
        </div><p className="cpl-legal">해지할 때까지 매월 $280이 자동 결제됩니다. 설정의 결제에서 언제든 해지할 수 있으며, 해지 후에도 남은 구독 기간 동안 이용할 수 있습니다.</p></aside>
      </div>:<div className="cpx-body">
        <p className="cpx-lead">{step==='free'?'전략을 실행할 거래소를 선택합니다.':step==='account'?`이용료 없이 연결하려면 TETH 초대로 가입한 ${exchange[1]} 계정이 필요합니다.`:`${exchange[1]} 화면이 열리면 아래 두 권한을 허용합니다.`}</p>
        {step==='free'?<div className="cpl-exs cpx-exs" role="group" aria-label={t('거래소')}>{planExchanges.map(([id,name])=><button type="button" key={id} onClick={()=>onNavigate({step:'account',exchange:id})}><Logo id={id} size={30}/><b>{name}</b></button>)}</div>:step==='account'?<>
          <div className="cpx-card"><ul className="cpx-steps"><li><b>TETH 초대 링크로 가입</b><span>이메일이나 전화번호로 가입합니다.</span></li><li><b>본인 확인</b><span>전략을 시작하기 전에 {exchange[1]}에서 마칩니다.</span></li></ul></div>
          <button type="button" className="cpl-cta cpl-cta-w cpx-cta" disabled aria-describedby="connection-plan-unavailable">{exchange[1]} 가입 화면 열기<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg></button>
          <p className="cpx-links"><button type="button" className="cpl-link" onClick={()=>onNavigate({...view,step:'authorize'})}>기존 초대 계정 연결</button><button type="button" className="cpl-link" onClick={()=>onNavigate({...view,step:'checkout'})}>지금 쓰는 {exchange[1]} 계정으로 연결 (월 $280)</button></p>
          <p id="connection-plan-unavailable" className="cpl-unavailable">초대 가입 링크는 아직 제공되지 않습니다.</p>
        </>:<>
          <div className="cpx-card"><ul className="cpx-perm">{[['잔고 조회','전략에 쓸 잔고를 봅니다'],['주문','전략 조건에 맞을 때 주문을 냅니다']].map(([label,detail])=><li key={label}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.500l4.500 4.500L19 7.500"/></svg><span><b>{label}</b>{detail}</span></li>)}</ul></div>
          <button type="button" className="cpl-cta cpl-cta-w cpx-cta" disabled aria-describedby="connection-plan-unavailable"><Logo id={exchange[0]} size={20}/>{exchange[1]}에서 승인하기</button>
          <p id="connection-plan-unavailable" className="cpl-unavailable">실제 거래소 승인은 아직 제공되지 않습니다. 계정이 연결되거나 주문 권한이 부여되지 않습니다.</p>
        </>}
        <p className="cpx-help"><span>막히면 상담원이 24시간 답합니다.</span><button type="button" className="cpl-link" onClick={event=>onHelp(event.currentTarget)}>상담원에게 묻기</button></p>
      </div>}
    </div>
  </section>
}
