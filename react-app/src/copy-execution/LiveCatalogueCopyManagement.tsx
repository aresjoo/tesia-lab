import {useEffect,useId,useRef,useState,useSyncExternalStore,type ComponentType,type ReactNode} from 'react'
import {ArrowLeft} from 'lucide-react'
import {useClientPreferences} from '../client-preferences'
import {copySummaryText,copyActionText} from '../client-copy-trading-copy'
import {copyHistoryText} from '../client-copy-history-copy'
import {catalogueCopyLocation} from '../client-shared-navigation'
import {catalogueTitle,findCatalogueStrategy} from '../client-catalogue'
import words from '../client-catalogue-copy-management-copy.json'
import setupWords from '../client-catalogue-copy-setup-copy.json'
import common from '../client-catalogue-ui-copy.json'
import listWords from '../client-strategy-list-copy.json'
import settingsCopy from '../client-settings-copy.json'
import type {SharedLocation} from '../client-shared-strategies'
import type {CatalogueCopyExecutionPort} from './catalogue-port'
import {formatUsdt,adjustAllocation} from './money'
const languages=['ko','en','ja','zh-CN','zh-TW','es','fr']as const
type Dialog=ComponentType<{title:string;children:ReactNode;onClose:()=>void;trigger?:HTMLElement;focusKey?:string}>
export type LiveManagementProps={live:CatalogueCopyExecutionPort;id:string;tab?:string;navigate:(location:SharedLocation,replace?:boolean)=>void;Dialog:Dialog;onBack:()=>void;backLabel?:string;signedIn:boolean;onLogin:()=>void;onHelp?:(trigger:HTMLElement)=>void}
export function LiveCatalogueCopyManagement({live,id,tab,Dialog,navigate,onBack,backLabel,signedIn,onLogin,onHelp}:LiveManagementProps){
 const {language}=useClientPreferences(),state=useSyncExternalStore(live.controller.subscribe,live.controller.getSnapshot,live.controller.getSnapshot)
 const t=(key:keyof typeof words)=>words[key][languages.indexOf(language)],money=(value:string|null|undefined)=>formatUsdt(language,value)
 const title=useRef<HTMLHeadingElement>(null),tabs=useRef<HTMLDivElement>(null),tabsId=useId(),budget=tab==='bal'
 const [action,setAction]=useState<{kind:'adjust'|'stop'|'flat'|'settings';trigger?:HTMLElement}|null>(null)
 const [mode,setMode]=useState<'now'|'wait'|'manual'>('now'),[direction,setDirection]=useState<'add'|'out'>('add'),[amount,setAmount]=useState(''),[failed,setFailed]=useState(false)
 const pending=useRef<AbortController|null>(null),intent=useRef<string|null>(null),inputId=useId()
 const [confirmLoss,setConfirmLoss]=useState(false)
 const sw=setupWords[language]
 const copy=state.selectedCopy?.subscriptionId===id?state.selectedCopy:null
 const sourceId=live.sourceForCopy(id),strategy=sourceId?findCatalogueStrategy(sourceId):undefined
 useEffect(()=>{title.current?.focus({preventScroll:true});const abort=new AbortController();void live.controller.readCopy(id,abort.signal).catch(()=>undefined);return()=>{abort.abort();pending.current?.abort()}},[live.controller,id])
 const open=(kind:'adjust'|'stop'|'flat'|'settings')=>{setFailed(false);setConfirmLoss(false);setAmount('');intent.current=crypto.randomUUID();setAction({kind,trigger:document.activeElement instanceof HTMLElement?document.activeElement:undefined})}
 const close=()=>{pending.current?.abort();pending.current=null;setAction(null)}
 const selectTab=(value:boolean)=>navigate(catalogueCopyLocation(id,value?'bal':'hist'),true)
 if(!signedIn)return<div className="cpp-empty"><b>{copySummaryText(language,'로그인 후 카피를 관리할 수 있어요')}</b><button className="wbtn" onClick={onLogin}>{copySummaryText(language,'로그인')}</button></div>
 const e=copy?.execution,confirmed=e?.accounting.accountingComplete===true,actual=e?.origin==='exchange'&&e.actualExecutionVerified
 const status=actual&&copy?.state==='ACTIVE'?t('active'):copy?.state==='STOPPING'||copy?.closeStatus==='PENDING'?t('winding'):copy?.state==='STOPPED'&&copy.closeStatus==='COMPLETE'?t('stopped'):'—'
 const net=actual&&confirmed?e!.accounting.totalPnlUsdt:null,realized=actual&&confirmed?e!.accounting.realizedPnlUsdt:null
 const started=copy?new Date(copy.joinedAt).toLocaleDateString(language,{year:'numeric',month:'long',day:'numeric'}):''
 const canFlatten=copy?.state==='PAUSED'||copy?.state==='STOPPING'
 const capability=(name:'update'|'pause'|'stop'|'close')=>Boolean(copy&&copy.execution.availability[name].available)
 const positions=actual&&e?.positions.status==='ok'?e.positions.items:null
 const operation=action?.kind==='flat'||mode==='now'?'close':mode==='wait'?'stop':'pause'
 const canConfirm=action?.kind==='adjust'?capability('update')&&Boolean(adjustAllocation(copy?.allocationUsdt??'',amount,direction==='out')):capability(operation)&&(action?.kind!=='flat'||canFlatten)
 const confirm=async()=>{
  if(!copy||!canConfirm||pending.current||!intent.current)return
  if(action?.kind==='adjust'&&confirmed&&Number(net)<0&&!confirmLoss){setConfirmLoss(true);return}
  const request=new AbortController();pending.current=request;setFailed(false)
  try{
   if(action?.kind==='adjust'){
    const allocationUsdt=adjustAllocation(copy.allocationUsdt,amount,direction==='out')!
    await live.controller.update(id,copy.revision,{allocationUsdt,maxLossUsdt:copy.maxLossUsdt,maxPositionFraction:copy.maxPositionFraction},intent.current,request.signal)
   }else await live.controller.action(operation,id,copy.revision,intent.current,request.signal)
   if(!request.signal.aborted){close();if(action?.kind==='adjust')selectTab(true)}
  }catch{if(!request.signal.aborted)setFailed(true)}finally{if(pending.current===request)pending.current=null}
 }
 return<section className="cpp cpx cq-page catalogue-copy-management" aria-label={t('title')} data-copy-id={id} data-copy-origin={e?.origin??'unconnected'}>
  <button className="ss3-back cq-back" onClick={onBack}><ArrowLeft size={16} aria-hidden="true"/>{backLabel??t('back')}</button>
  <header className="cq-hd"><h2 className="cpp-nick" ref={title} tabIndex={-1}>{strategy?catalogueTitle(strategy.name):t('title')}</h2><p>{copy?copy.state==='STOPPED'&&copy.closeStatus==='COMPLETE'?t('ended').replace('{date}',started):copy.state==='STOPPING'?t('waitingExit'):copy.state==='PAUSED'?t('manualExit'):actual?t('started').replace('{date}',started):'':''} {strategy&&<button className="cq-link" onClick={()=>navigate({nick:strategy.id,period:'all'})}>{t('sourceLink')}</button>}</p></header>
  <section className="cq-hero" aria-label={t('current')}><small>{t('current')} <span className="cpp-meta">{status}</span></small><div className="big num" data-metric="current" tabIndex={0} role="region" aria-label={t('current')}>—</div>
   <div className="cq-pl"><span>{t('net')} <b className="num" data-metric="net">{money(net)}</b></span><span>{t('myReturn')} <b className="num">—</b></span></div><p className="cq-cmp">{t('compare')} <b className="num">—</b></p></section>
  {copy&&copy.state!=='STOPPED'&&<div className="cq-acts"><button className="cq-cta" disabled={!capability('update')||state.mutationBusy} onClick={()=>open('adjust')}>{t('budget')}</button><button className="cq-link" onClick={()=>open('settings')}>{copySummaryText(language,'설정')}</button><button className="cq-link" disabled={!capability('pause')&&!capability('stop')&&!capability('close')||state.mutationBusy} onClick={()=>open('stop')}>{t('stop')}</button></div>}
  <details className="cq-amt"><summary>{t('amountDetails')}</summary><div className="cq-list">{[[t('available'),null],[copySummaryText(language,'미실현 손익'),null],[copySummaryText(language,'실현 손익'),realized],[copySummaryText(language,'수익 분배 지급'),null],[t('deposited'),null]].map(([label,value])=><div className="cq-row" key={label}><div className="a"><b>{label}</b></div><div className="z"><b className="num"><span data-metric={label}>{money(value)}</span></b></div></div>)}</div></details>
  {state.phase==='error'?<p role="alert" className="copy-storage-error">{common[language].failed} <button className="obtn" onClick={()=>void live.controller.readCopy(id).catch(()=>undefined)}>{common[language].retry}</button></p>:!copy&&<p role="status" aria-busy={state.phase==='loading'}>{common[language].loading}</p>}
  <section className="cq-sec cq-positions" aria-label={t('positions')}><div className="cq-sh"><h3>{t('positions')}{positions&&positions.length>0&&<span> {positions.length}</span>}</h3>{positions&&positions.length>0&&<button className="cq-gray" disabled={!canFlatten||!capability('close')||state.mutationBusy} onClick={()=>open('flat')}>{copySummaryText(language,'포지션 전체 정리')}</button>}</div>
   {positions===null||positions===undefined?<p role="status">{listWords[language].unavailable}</p>:!positions.length?<div className="cq-list"><div className="cq-row cq-none"><div className="a"><b>{t('positionEmpty')}</b></div></div></div>:<div className="cq-list">{positions.map(position=><div className="cq-row" key={position.symbol+':'+position.side}><div className="a"><b>{position.symbol} {position.side}</b><span>{position.quantity}</span></div><div className="z"><b className="num">{money(position.unrealizedPnlUsdt)}</b></div></div>)}</div>}</section>
  <section className="cq-sec"><div className="cq-tabs" role="tablist" aria-label={copyHistoryText(language,'tabs')} ref={tabs} onKeyDown={event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)||event.altKey||event.ctrlKey||event.metaKey)return;event.preventDefault();const next=event.key==='Home'?false:event.key==='End'?true:!budget;tabs.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next?1:0]?.focus({preventScroll:true});selectTab(next)}}>
   {([false,true]as const).map(isBudget=><button role="tab" key={String(isBudget)} id={tabsId+(isBudget?'-budget':'-trades')} aria-controls={tabsId+'-panel'} aria-selected={budget===isBudget} tabIndex={budget===isBudget?0:-1} className={budget===isBudget?'on':''} onClick={()=>selectTab(isBudget)}>{t(isBudget?'budgetHistory':'trades')}</button>)}</div>
   <div role="tabpanel" tabIndex={0} id={tabsId+'-panel'} aria-labelledby={tabsId+(budget?'-budget':'-trades')}><p role="status">{listWords[language].unavailable}</p></div></section>
  {onHelp&&<p className="cq-help"><button type="button" className="cq-link" onClick={event=>onHelp(event.currentTarget)}>{settingsCopy.help[language]}</button></p>}
  <p className="cpp-foot cq-basis">{t('unit').replace('美元(USD)','USDT').replace(/\bUSD\b/g,'USDT')}</p>
  {action&&copy&&<Dialog title={action.kind==='settings'?t('copySettings'):action.kind==='flat'?copySummaryText(language,'포지션 전체 정리'):t(action.kind==='adjust'?'budget':'stop')} trigger={action.trigger} onClose={close} focusKey={action.kind}>
   {action.kind==='settings'?<><p>{t('settingHint')}</p><dl className="catalogue-copy-settings">{[[t('copyMethod'),'—'],[t('startDate'),started],[t('assets'),state.selectedVersion?.versionId===copy.versionId?state.selectedVersion.policy.symbols.join(', '):'—'],[sw.budget,money(copy.allocationUsdt)],[sw.loss,`${-(Number(copy.maxLossUsdt)/Number(copy.allocationUsdt))*100}%`],[sw.timing,copy.startMode==='current_position'?sw.current:sw.next],[sw.cap,`${Number(copy.maxPositionFraction)*100}%`]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></>
    :action.kind==='adjust'?<><div className="cpa-tgl" role="group" aria-label={copyActionText(language,'잔고 조정 방식')}>{(['add','out']as const).map(value=><button type="button" aria-pressed={direction===value} className={direction===value?'on':''} key={value} disabled={state.mutationBusy} onClick={()=>{setDirection(value);setConfirmLoss(false);setFailed(false)}}>{t(value==='add'?'added':'withdrawn')}</button>)}</div><label htmlFor={inputId}>{copyActionText(language,'조정 금액')}</label><div className="cps-in"><input id={inputId} inputMode="decimal" value={amount} autoComplete="off" disabled={state.mutationBusy} aria-invalid={Boolean(amount&&!canConfirm)} onChange={event=>{setAmount(event.target.value);setConfirmLoss(false);setFailed(false)}}/><span className="un">USDT</span><button type="button" className="mx" disabled>{sw.max}</button></div><p>{copySummaryText(language,'가용')} —</p>{confirmLoss&&<p role="alert">{copyActionText(language,'잠깐, 손실 구간이에요')}</p>}</>
    :action.kind==='stop'?<><p>{t('stopHint')}</p><div className="catalogue-copy-stop">{(['now','wait','manual']as const).map(value=><label key={value}><input type="radio" name={inputId} value={value} checked={mode===value} disabled={state.mutationBusy||!capability(value==='now'?'close':value==='wait'?'stop':'pause')} onChange={()=>setMode(value)}/><span>{t(value)}</span></label>)}</div></>
    :<p>{copyActionText(language,'열려 있는 카피 포지션을 현재가로 정리해요.')} {copy.state==='STOPPING'?t('endFlat'):copySummaryText(language,'포지션이 없는 동안에도 카피는 유지돼요.')}</p>}
   {failed&&<p role="alert">{sw.failed}</p>}
   <div className="ss3-dacts"><button type="button" className="obtn" onClick={close}>{action.kind==='settings'?sw.close:copyActionText(language,'취소')}</button>{action.kind==='settings'?<button type="button" className="wbtn" disabled={!capability('update')||state.mutationBusy} onClick={()=>open('adjust')}>{t('budget')}</button>:<button type="button" className="wbtn" disabled={!canConfirm||state.mutationBusy} aria-busy={state.mutationBusy} onClick={()=>void confirm()}>{copyActionText(language,'확인')}</button>}</div>
  </Dialog>}
 </section>
}
