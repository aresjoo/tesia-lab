import { useEffect, useEffectEvent, useId, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { BROKER_CATEGORIES, BROKER_FILTERS, BROKER_INFO, brokerReviews, filterBrokers, type BrokerFilter, type BrokerReview, type ClientBroker } from '../client-broker-fixtures'
import { getSitePage } from '../site-navigation'
import { clientResearchScrollport } from '../client-research-scrollport'
import { ClientUpgradeSheet } from './ClientUpgradeSheet'
import '../client-brokers.css'
import { filterBrokerPresentation, safeBrokerLink, safeBrokerLogo, type BrokerConnectionState, type BrokerServicePresentation } from '../client-broker-presentation'
import { useBrokerText } from '../client-broker-copy'
import { brokerViewBound, brokerViewDataset, initialBrokerView, type BrokerReviewView, type BrokerViewState } from '../client-broker-view'

const STAR='M8 .8l2 4.6 5 .5-3.8 3.3 1.1 4.9L8 11.5 3.7 14l1.1-4.9L1 5.9l5-.5z'
const SOURCE_NOTE='클라이언트 디자인 미리보기 · 평점은 원본 공개 평점 스냅샷이며 후기·연결 계정 수는 예시입니다.'
const SOURCE_PROMO='TETH 초대코드로 가입하면 유동성 수수료 지원으로 TETH 이용료가 무료에요. 가입 즉시 자동 연결됩니다.'
export type { BrokerConnectionState } from '../client-broker-presentation'
export type BrokerServices={
  /** No account/catalog producer: retain source navigation, never fixture statistics or capabilities. */
  serviceBoundary?: boolean
  presentation?: BrokerServicePresentation
  /** Local pending state, never connection or submission confirmation. */
  actionPending?: boolean
  /** State comes from the authenticated service adapter, never local UI flags. */
  connectionState?:(brokerId:string)=>BrokerConnectionState
  onConnect?:(brokerId:string,state:BrokerConnectionState)=>void
  onSubscribe?:()=>void
  /** Presentation cancellation scope only; never connection or payment authority. */
  presentationScope?:string
  onOpenAccount?:(brokerId:string)=>void
  onLogin?:()=>void
  authenticated?:boolean
  /** Must resolve only after the server has accepted an ownership-verified review. */
  submitReview?:(brokerId:string,review:{rating:number;text:string})=>Promise<void>
}
type Props=BrokerServices&{onTitleChange:(title:string)=>void;listRequest?:number;viewState?:BrokerViewState|null;onViewStateChange?:(view:BrokerViewState)=>void}
type BrokerNotice={title:string;body:string;account?:{brokerId:string;label:string};values?:Readonly<Record<string,string|number>>}
type BrokerPlanOffer={scope:string|undefined;href:string;trigger:HTMLElement|undefined}
function Check(){return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg>}
function Stars({rating,id}:{rating:number;id?:string}){const t=useBrokerText();return <span id={id} className="bk2-stars" role="img" aria-label={t('별점 {rating}',{rating})}>{[1,2,3,4,5].map(n=><svg key={n} className={n<=Math.round(rating)?'on':''} viewBox="0 0 16 15" aria-hidden="true"><path d={STAR}/></svg>)}</span>}
function Logo({broker:b,stack=false,logo}:{broker:ClientBroker;stack?:boolean;logo?:string}){const t=useBrokerText();const src=safeBrokerLogo(logo)??(/^[a-z0-9-]+$/.test(b.id)?`/client-broker-assets/app-${b.id}.png`:undefined);return stack?<div className="bk2-stack" aria-hidden="true">{[1,2,3].map(n=><img key={n} src={src} alt="" width="172" height="172" loading="lazy"/>)}</div>:<img className="ico" src={src} alt={t('{name} 로고',{name:b.name})} width="92" height="92"/>}
type SortProps={label:string;value:string;options:readonly(readonly[string,string])[];onChange:(value:string)=>void;compact?:boolean}
// Source 621cbed T1: one selection path, inline desktop menu and <=760 sheet.
// Native dialog adds inertness; source transition and visible wording stay intact.
function Select({label,value,options,onChange,compact=false}:SortProps){
  const t=useBrokerText()
  options=options.map(([key,text])=>[key,t(text)] as const)
  const [mode,setMode]=useState<'desktop'|'sheet'|null>(null)
  const trigger=useRef<HTMLButtonElement>(null),wrap=useRef<HTMLSpanElement>(null),id=useId()
  const current=options.find(([key])=>key===value)?.[1]??options[0][1]
  const open=()=>setMode(matchMedia('(max-width:760px)').matches?'sheet':'desktop')
  return <span className="tfbk-dropwrap" ref={wrap}>
    <button ref={trigger} className={'tfbk-drop'+(compact?' sq-sm':'')} type="button" aria-label={`${label}: ${current}`} aria-haspopup="listbox" aria-expanded={Boolean(mode)} aria-controls={mode?id:undefined}
      onClick={()=>mode?setMode(null):open()} onKeyDown={event=>{
        if(event.defaultPrevented||event.nativeEvent.isComposing||event.keyCode===229||event.ctrlKey||event.metaKey)return
        if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();open()}
      }}>{current} <span className="car" aria-hidden="true">▾</span></button>
    {mode&&<SortOptions label={label} value={value} options={options} onChange={onChange} title={current} id={id} mode={mode} compact={compact} trigger={trigger} wrap={wrap} onClose={()=>setMode(null)}/>}
  </span>
}

function SortOptions({label,value,options,onChange,title,id,mode,compact,trigger,wrap,onClose}:SortProps&{
  title:string;id:string;mode:'desktop'|'sheet';trigger:RefObject<HTMLButtonElement|null>;wrap:RefObject<HTMLSpanElement|null>;onClose:()=>void
}){
  const t=useBrokerText()
  const panel=useRef<HTMLDivElement>(null),dialog=useRef<HTMLDialogElement>(null)
  const closing=useRef(false),restoreFocus=useRef(true),outside=useRef(false),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined)
  const [visible,setVisible]=useState(false)
  const close=(restore=true,immediate=false)=>{
    if(closing.current&&!immediate)return
    closing.current=true;restoreFocus.current=restore
    if(timer.current)clearTimeout(timer.current)
    if(mode==='sheet'&&!immediate&&!matchMedia('(prefers-reduced-motion: reduce)').matches){setVisible(false);timer.current=setTimeout(onClose,180)}
    else onClose()
  }
  const closeForNavigation=useEffectEvent(()=>close(false,true))
  const closeForResize=useEffectEvent(()=>close(true,true))
  const closeForOutside=useEffectEvent(()=>close(false,true))
  useLayoutEffect(()=>{
    const origin=window.location.href,button=trigger.current,modal=dialog.current
    const styles=mode==='sheet'?[document.body.style,clientResearchScrollport()?.style].filter((style):style is CSSStyleDeclaration=>Boolean(style)):[]
    const locks=styles.map(style=>({style,value:style.getPropertyValue('overflow-y'),priority:style.getPropertyPriority('overflow-y')}))
    if(modal)modal.showModal()
    locks.forEach(({style})=>style.setProperty('overflow-y','hidden'))
    panel.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus({preventScroll:true})
    // Reveal the entire inline menu, not just its selected first option, inside
    // the research scrollport. The modal sheet owns its own scroll position.
    if(mode==='desktop')panel.current?.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'})
    const frame=requestAnimationFrame(()=>setVisible(true))
    const navigation=()=>{if(window.location.href!==origin)closeForNavigation()}
    const query=matchMedia('(max-width:760px)')
    const resized=()=>{if(query.matches!==(mode==='sheet'))closeForResize()}
    const clicked=(event:PointerEvent)=>{if(mode==='desktop'&&!wrap.current?.contains(event.target as Node))closeForOutside()}
    query.addEventListener('change',resized)
    document.addEventListener('pointerdown',clicked)
    window.addEventListener('popstate',navigation);window.addEventListener('hashchange',navigation);window.addEventListener('teth:navigate',navigation)
    return()=>{
      cancelAnimationFrame(frame);if(timer.current)clearTimeout(timer.current)
      query.removeEventListener('change',resized);document.removeEventListener('pointerdown',clicked)
      window.removeEventListener('popstate',navigation);window.removeEventListener('hashchange',navigation);window.removeEventListener('teth:navigate',navigation)
      modal?.close()
      locks.forEach(({style,value,priority})=>{
        if(style.getPropertyValue('overflow-y')==='hidden'&&style.getPropertyPriority('overflow-y')===''){
          if(value)style.setProperty('overflow-y',value,priority);else style.removeProperty('overflow-y')
        }
      })
      if(restoreFocus.current&&button?.isConnected&&window.location.href===origin&&!getSitePage()&&!button.closest('[hidden],[inert]'))button.focus({preventScroll:true})
    }
  },[mode,trigger,wrap])
  const keyDown=(event:ReactKeyboardEvent<HTMLElement>)=>{
    if(event.defaultPrevented)return
    if(event.nativeEvent.isComposing||event.keyCode===229){if(event.key==='Escape'){event.preventDefault();event.stopPropagation()}return}
    if(event.altKey||event.ctrlKey||event.metaKey)return
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();return}
    if(event.key==='Tab'){
      if(mode==='desktop'){close(false,true);return}
      const items=Array.from(dialog.current?.querySelectorAll<HTMLButtonElement>('button')??[])
      const first=items[0],last=items.at(-1)
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
      return
    }
    if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key)||!(event.target as HTMLElement).matches('[role=option]'))return
    event.preventDefault()
    const items=Array.from(panel.current?.querySelectorAll<HTMLButtonElement>('[role=option]')??[]),index=items.indexOf(document.activeElement as HTMLButtonElement)
    const next=event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowDown'?1:-1)+items.length)%items.length
    items[next]?.focus()
  }
  const choices=<div ref={panel} id={id} role="listbox" aria-label={label} className={mode==='desktop'?'tfbk-menu'+(compact?' rt':''):'tfbk-sheet-options'} onKeyDown={mode==='desktop'?keyDown:undefined}>
    {options.map(([key,text])=><button key={key} type="button" role="option" aria-selected={value===key} className={(mode==='desktop'?'mi':'it')+(value===key?' on':'')} onClick={()=>{if(closing.current)return;onChange(key);close()}}>{text}{mode==='sheet'&&value===key&&<span className="ck" aria-hidden="true">✓</span>}</button>)}
  </div>
  if(mode==='desktop')return choices
  return createPortal(<dialog ref={dialog} className={'tfbk-sort-sheet'+(visible?' on':'')} aria-label={label} onKeyDown={keyDown} onCancel={event=>{event.preventDefault();event.stopPropagation();close()}}
    onPointerDown={event=>{outside.current=(event.target as HTMLElement).classList.contains('sc')}}
    onClick={event=>{const dismiss=outside.current&&(event.target as HTMLElement).classList.contains('sc');outside.current=false;if(dismiss)close()}}>
    <div className="sc" aria-hidden="true"/><div className="sh"><div className="hd"><b>{title}</b><button type="button" className="x" aria-label={t("닫기")} onClick={()=>close()}><X size={18}/></button></div>{choices}</div>
  </dialog>,document.body)
}
// Native top-layer dialog provides background inertness and keyboard trapping.
function BrokerDialog({ title, children, onClose, onNavigate }: { title: string; children: ReactNode; onClose: () => void; onNavigate?: () => void }) {
  const t=useBrokerText()
  const ref = useRef<HTMLDialogElement>(null)
  const dismiss = useRef<HTMLButtonElement>(null)
  const outside = useRef(false)
  const id = useId()
  const openedAt = useRef(window.location.href)
  const closeOnNavigation = useEffectEvent(() => { if (window.location.href !== openedAt.current) (onNavigate ?? onClose)() })
  useLayoutEffect(() => {
    // A notice can replace its own focused action. Keep the same dialog and
    // original opener so closing still returns to the detail's trigger.
    if (ref.current?.open && !ref.current.contains(document.activeElement)) dismiss.current?.focus({ preventScroll: true })
  }, [title])
  useEffect(() => {
    const el = ref.current!, trigger = document.activeElement as HTMLElement | null
    const origin = openedAt.current
    const scrollStyle = clientResearchScrollport()?.style
    const overflow = scrollStyle?.getPropertyValue('overflow-y') ?? ''
    const overflowPriority = scrollStyle?.getPropertyPriority('overflow-y') ?? ''
    el.showModal()
    scrollStyle?.setProperty('overflow-y', 'hidden')
    window.addEventListener('popstate', closeOnNavigation)
    window.addEventListener('hashchange', closeOnNavigation)
    window.addEventListener('teth:navigate', closeOnNavigation)
    return () => {
      window.removeEventListener('popstate', closeOnNavigation)
      window.removeEventListener('hashchange', closeOnNavigation)
      window.removeEventListener('teth:navigate', closeOnNavigation)
      el.close()
      // Restore only our own lock, including its original CSS priority. A newer
      // surface's explicit lock must not be released by this dialog's cleanup.
      if (scrollStyle?.getPropertyValue('overflow-y') === 'hidden' && scrollStyle.getPropertyPriority('overflow-y') === '') {
        if (overflow) scrollStyle.setProperty('overflow-y', overflow, overflowPriority)
        else scrollStyle.removeProperty('overflow-y')
      }
      if (trigger?.isConnected && window.location.href === origin && !getSitePage() && !trigger.closest('[hidden],[inert]')) trigger.focus({ preventScroll: true })
    }
  }, [])
  const isOutside = (x: number, y: number) => {
    const r = ref.current!.getBoundingClientRect()
    return x < r.left || x > r.right || y < r.top || y > r.bottom
  }
  return createPortal(<dialog ref={ref} className="tfbk-dialog" aria-labelledby={id} onCancel={e => { e.preventDefault(); e.stopPropagation(); onClose() }}
    onKeyDown={e => {
      // Native cancel has no composition metadata; stop only the composing key.
      if (e.key === 'Escape' && (e.nativeEvent.isComposing || e.keyCode === 229)) { e.preventDefault(); e.stopPropagation(); return }
      if (e.key !== 'Tab') return
      const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]')).filter(el => el.getClientRects().length > 0)
      const first = items[0], last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
    }}
    onPointerDown={e => { outside.current = e.target === e.currentTarget && isOutside(e.clientX, e.clientY) }}
    onClick={e => { const dismiss = outside.current && isOutside(e.clientX, e.clientY); outside.current = false; if (dismiss) onClose() }}>
    <header><h2 id={id}>{title}</h2><button ref={dismiss} type="button" aria-label={t("닫기")} onClick={onClose}><X size={20} /></button></header>
    <div className="tfbk-dialog-body">{children}</div>
  </dialog>, document.body)
}


function ReviewCard({review:r,onOpen,tags=false}:{review:BrokerReview;onOpen:()=>void;tags?:boolean}){
  const t=useBrokerText()
  const id=useId()
  return <button type="button" className="bk2-rvc" onClick={onOpen} aria-label={t('{author} 리뷰 보기',{author:r.author})} aria-describedby={`${id}-rating ${id}-text ${id}-by`} aria-haspopup="dialog">
    <Stars id={`${id}-rating`} rating={r.rating}/><p id={`${id}-text`}>{r.text}</p><span id={`${id}-by`} className="by">{r.author}, {r.date}</span>
    {tags&&<span className="tags">{r.categories.map(c=><em key={c}>{BROKER_CATEGORIES.some(key=>key===c)?t(c):c}</em>)}</span>}
  </button>
}

function ReviewPagination({current,max,onSelect}:{current:number;max:number;onSelect:(page:number)=>void}){
  const t=useBrokerText()
  const [compact,setCompact]=useState(()=>typeof window!=='undefined'&&window.matchMedia('(max-width: 760px)').matches)
  useEffect(()=>{
    const media=window.matchMedia('(max-width: 760px)'),sync=()=>setCompact(media.matches)
    sync();media.addEventListener('change',sync)
    return()=>media.removeEventListener('change',sync)
  },[])
  if(max<=1)return null
  // Source tfBk2PgHtml: keep first/last, with one adjacent page on mobile
  // and two on desktop. This is a supplied-array view, not API pagination.
  const span=compact?1:2,from=Math.max(1,current-span),to=Math.min(max,current+span)
  const pages:(number|'before'|'after')[]=[]
  if(from>1){pages.push(1);if(from>2)pages.push('before')}
  for(let page=from;page<=to;page++)pages.push(page)
  if(to<max){if(to<max-1)pages.push('after');pages.push(max)}
  return <nav className="bk2-pg" aria-label={t('리뷰 페이지')}>
    <button type="button" className="nv" aria-label={t('이전 페이지')} disabled={current<=1} onClick={()=>onSelect(current-1)}>←</button>
    {pages.map(page=>typeof page==='number'?<button key={page} type="button" className={'n'+(current===page?' on':'')} aria-current={current===page?'page':undefined} onClick={()=>onSelect(page)}>{page}</button>:<span key={page} className="el">...</span>)}
    <button type="button" className="nv" aria-label={t('다음 페이지')} disabled={current>=max} onClick={()=>onSelect(current+1)}>→</button>
  </nav>
}

function ReviewWriter({broker,submit,onClose}:{broker:ClientBroker;submit?:BrokerServices['submitReview'];onClose:()=>void}){
  const t=useBrokerText()
  const [rating,setRating]=useState(0),[text,setText]=useState(''),[confirm,setConfirm]=useState(false),[pending,setPending]=useState(false),[error,setError]=useState('')
  const lock=useRef(false),alive=useRef(true),ta=useRef<HTMLTextAreaElement>(null),group=useRef<HTMLDivElement>(null),id=useId()
  useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[])
  const close=()=>{if(pending){onClose();return}if(confirm){setConfirm(false);return}if(rating>0||text.trim())setConfirm(true);else onClose()}
  const n=text.trim().length
  const save=async()=>{if(lock.current||!rating||n<8||n>600)return;if(!submit){setError('리뷰 등록 서비스가 아직 연결되지 않았습니다. 작성 내용은 전송되지 않았어요.');return}lock.current=true;setPending(true);setError('');try{await submit(broker.id,{rating,text:text.trim()})}catch{if(alive.current)setError('리뷰를 등록하지 못했습니다. 작성 내용은 유지됩니다. 잠시 후 다시 시도해주세요.')}finally{lock.current=false;if(alive.current)setPending(false)}}
  const keep=()=>{setConfirm(false);requestAnimationFrame(()=>ta.current?.focus())}
  return <BrokerDialog title={t('{name}에 대해 다른 사람들과 의견 나누기',{name:broker.name})} onClose={close} onNavigate={onClose}>
    <div className="bk2-wm" aria-busy={pending}>
      <p className="desc">{t("개방적이고 투명한 커뮤니티를 위해 실제 계정 소유자의 리뷰만 남길 수 있어요. 솔직한 경험이 다른 사용자에게 큰 도움이 됩니다.")}</p>
      <div className="stars" role="radiogroup" aria-label={t("별점 선택")} ref={group} onKeyDown={e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key)||pending)return;e.preventDefault();const next=e.key==='Home'?1:e.key==='End'?5:Math.min(5,Math.max(1,rating+(['ArrowRight','ArrowUp'].includes(e.key)?1:-1)));setRating(next);group.current?.querySelector<HTMLButtonElement>(`[data-rating="${next}"]`)?.focus()}}>
        {[1,2,3,4,5].map(n=><button type="button" key={n} data-rating={n} role="radio" aria-label={t('{rating}점',{rating:n})} aria-checked={rating===n} tabIndex={(rating||1)===n?0:-1} className={n<=rating?'on':''} disabled={pending} onClick={()=>setRating(n)}><svg viewBox="0 0 16 15" aria-hidden="true"><path d={STAR}/></svg></button>)}
      </div>
      <label className="tfbk-sr" htmlFor={id}>{t("리뷰 내용")}</label>
      <textarea id={id} ref={ta} value={text} maxLength={600} disabled={pending} aria-describedby={id+'-count'} placeholder={t(!rating?'먼저 별점을 선택해주세요':rating<=2?'어떤 점이 불편했나요? 어떤 문제가 있었는지 알려주시면 개선에 도움이 돼요.':rating===3?'어떤 점이 괜찮았고, 어떤 부분이 아쉬웠나요?':'어떤 점이 특히 좋았나요? 다른 사용자에게 추천하고 싶은 기능이 있다면 함께 알려주세요.')} onChange={e=>{setText(e.target.value);setError('')}}/>
      <small className="bk2-count" id={id+'-count'}>{n} {t("/ 600 · 최소 8자")}</small>
      {pending&&<p role="status">{t('창을 닫아도 등록 요청은 계속 진행됩니다.')}</p>}
      {error&&<p role="alert" className="bk2-error">{t(error)}</p>}
      <div className="bk2-actions"><button className="obtn" type="button" onClick={close} disabled={pending}>{t("취소")}</button><button className="wbtn" type="button" disabled={!rating||n<8||pending} onClick={()=>void save()}>{t(pending?'등록 중…':!rating?'별점을 선택해주세요':n>0&&n<8?'조금 더 알려주세요':'리뷰 남기기')}</button></div>
    </div>
    {confirm&&<BrokerDialog title={t("작성 중인 리뷰를 지울까요?")} onClose={keep} onNavigate={onClose}><p>{t("지금 닫으면 별점과 내용이 저장되지 않아요.")}</p><div className="bk2-actions"><button type="button" className="obtn" onClick={keep}>{t("계속 작성")}</button><button type="button" className="wbtn" onClick={onClose}>{t("삭제")}</button></div></BrokerDialog>}
  </BrokerDialog>
}

const FEATURE_GROUPS:[string,[string,string,string][]][]=[
 ['주문 유형',[['marketOrder','시장가 주문','현재 가격으로 즉시 사고파는 주문이에요.'],['limitOrder','지정가 주문','정한 가격에 도달할 때만 체결되는 주문이에요.'],['stopOrder','스톱 주문','가격이 기준선에 닿으면 실행되는 주문이에요.'],['stopLimitOrder','스톱 리밋 주문','기준선 도달 시 지정가 주문으로 걸리는 방식이에요.'],['trailingStop','트레일링 스탑','가격을 일정 거리로 따라가는 동적 손절이에요.']]],
 ['주문 기능',[['oco','OCO 주문','두 주문 중 하나가 체결되면 나머지가 취소돼요.'],['postOnly','포스트 온리','메이커로만 체결되게 제한하는 옵션이에요.'],['reduceOnly','리듀스 온리','포지션을 줄이는 방향으로만 체결돼요.']]],
 ['기타',[['demoAccount','데모 계정','실제 자금 없이 연습할 수 있는 환경이에요.'],['publicApi','공개 API','외부 프로그램으로 조회와 주문이 가능해요.'],['level2','호가 데이터','매수와 매도 호가 잔량을 볼 수 있어요.']]]
]
function BrokerDetail({broker:b,services,onBack,onNotice,reviewView,onReviewViewChange}:{broker:ClientBroker;services:BrokerServices;onBack:()=>void;onNotice:(title:string,body:string,account?:BrokerNotice['account'],values?:BrokerNotice['values'])=>void;reviewView:BrokerReviewView;onReviewViewChange:(view:BrokerReviewView)=>void}){
  const t=useBrokerText(),copy=t
  const [tab,setTab]=useState<'overview'|'reviews'>('overview'),[faq,setFaq]=useState<number[]>([]),[review,setReview]=useState<BrokerReview|null>(null),[writing,setWriting]=useState(false),[edges,setEdges]=useState({left:false,right:false})
  const {category,sort,page}=reviewView
  const setPage=(page:number)=>onReviewViewChange({...reviewView,page})
  const [planOffer,setPlanOffer]=useState<BrokerPlanOffer|null>(null)
  const [reviewStatus,setReviewStatus]=useState<'idle'|'pending'|'accepted'|'failed'>('idle')
  const reviewLock=useRef(false)
  const currentReviewView=useRef({reviewView,onReviewViewChange})
  useLayoutEffect(()=>{currentReviewView.current={reviewView,onReviewViewChange}},[reviewView,onReviewViewChange])
  const planAlive=useRef(false),consumedOffer=useRef<BrokerPlanOffer|null>(null)
  const heading=useRef<HTMLHeadingElement>(null),tabs=useRef<HTMLDivElement>(null),carousel=useRef<HTMLDivElement>(null),reviewHeading=useRef<HTMLHeadingElement>(null),id=useId()
  const supplied=services.serviceBoundary?services.presentation?.catalog?.find(item=>item.broker.id===b.id):undefined
  const unavailable=Boolean(services.serviceBoundary&&!supplied)
  const info=services.serviceBoundary?supplied?.info??{founded:'—'}:BROKER_INFO[b.id]??{founded:'-'}
  const reviewsUnavailable=Boolean(services.serviceBoundary&&supplied?.reviews==null)
  const ownReview=services.serviceBoundary?supplied?.ownReview:undefined
  const rv=(services.serviceBoundary?supplied?.reviews??[]:brokerReviews(b)).filter(review=>!ownReview||review.id!==ownReview.id)
  const state=services.serviceBoundary?supplied?.connectionState??null:services.connectionState?.(b.id)??(b.conn?services.authenticated?'NEEDS_PLAN':'GUEST':'SOON'),connected=state==='CONNECTED'
  const docsUrl=safeBrokerLink(info.docsUrl),communityUrl=safeBrokerLink(info.communityUrl),siteUrl=safeBrokerLink(b.site.startsWith('https://')?b.site:'https://'+b.site)
  const latestPlan=useRef({services,state,planOffer,brokerId:b.id})
  useLayoutEffect(()=>{latestPlan.current={services,state,planOffer,brokerId:b.id}},[services,state,planOffer,b.id])
  useLayoutEffect(()=>{planAlive.current=true;return()=>{planAlive.current=false}},[])
  const offerCurrent=planOffer!==null&&planOffer.scope===services.presentationScope&&Boolean(services.authenticated)&&state==='NEEDS_PLAN'&&!services.onConnect
  // Only the offer is discarded on an account/session or adapter change. Keep
  // the source detail's current tab, filters and scroll exactly where they were.
  if(planOffer&&!offerCurrent)setPlanOffer(null)
  const reviewOrder=new Map(rv.map((review,index)=>[review.id,index]))
  const reviewDates=new Map(supplied?.reviews?.map(review=>[review.id,Date.parse(review.publishedAt??'')])??[])
  const allReviewDatesValid=rv.every(review=>Number.isFinite(reviewDates.get(review.id)))
  const recent=(a:BrokerReview,c:BrokerReview)=>{
    if(!services.serviceBoundary)return a.id-c.id
    const aa=reviewDates.get(a.id),cc=reviewDates.get(c.id)
    return allReviewDatesValid?cc!-aa!:(reviewOrder.get(a.id)??0)-(reviewOrder.get(c.id)??0)
  }
  const list=rv.filter(r=>category==='전체'||r.categories.includes(category)).sort((a,c)=>sort==='recent'?recent(a,c):c.rating-a.rating||recent(a,c)),max=Math.max(1,Math.ceil(list.length/9)),cur=Math.max(1,Math.min(page,max)),shown=list.slice((cur-1)*9,cur*9),counts=[5,4,3,2,1].map(n=>rv.filter(r=>r.rating===n).length+(ownReview?.rating===n?1:0))
  // The source stores its clamped page, so shrinking and restoring the same
  // supplied collection cannot resurrect a page that no longer existed.
  useEffect(()=>{if(tab==='reviews'&&!unavailable&&!reviewsUnavailable&&page!==cur)onReviewViewChange({...reviewView,page:cur})},[tab,unavailable,reviewsUnavailable,page,cur,reviewView,onReviewViewChange])
  const selectTab=(next:'overview'|'reviews',focus=false)=>{setTab(next);if(focus)tabs.current?.querySelector<HTMLButtonElement>(`[data-tab="${next}"]`)?.focus({preventScroll:true})}
  useEffect(()=>{clientResearchScrollport()?.scrollTo({top:0});heading.current?.focus({preventScroll:true})},[])
  useEffect(()=>{const el=carousel.current;if(!el)return;const sync=()=>setEdges({left:el.scrollLeft>4,right:el.scrollLeft<el.scrollWidth-el.clientWidth-4});const wheel=(e:WheelEvent)=>{if(e.ctrlKey||Math.abs(e.deltaY)<=Math.abs(e.deltaX))return;const max=el.scrollWidth-el.clientWidth;if((e.deltaY>0&&el.scrollLeft<max-1)||(e.deltaY<0&&el.scrollLeft>1)){el.scrollLeft+=e.deltaY;e.preventDefault()}};sync();const resize=new ResizeObserver(sync);resize.observe(el);el.addEventListener('scroll',sync,{passive:true});el.addEventListener('wheel',wheel,{passive:false});return()=>{resize.disconnect();el.removeEventListener('scroll',sync);el.removeEventListener('wheel',wheel)}},[tab])
  const connect=()=>{if(services.actionPending)return;if(state===null){onNotice('TETH로 연결','계정 연결 서비스가 아직 준비되지 않았습니다. 연결이나 결제는 실행되지 않았어요.');return}if(state==='SOON')return;if(services.onConnect)services.onConnect(b.id,state);else if(state==='GUEST'&&services.onLogin)services.onLogin();else if(state==='NEEDS_PLAN'&&services.authenticated&&!services.serviceBoundary)setPlanOffer({scope:services.presentationScope,href:window.location.href,trigger:document.activeElement instanceof HTMLElement?document.activeElement:undefined});else onNotice('TETH로 연결','계정 연결 서비스가 아직 준비되지 않았습니다. 연결이나 결제는 실행되지 않았어요.')}
  const subscribe=(offer:BrokerPlanOffer)=>{
    const current=latestPlan.current
    if(!planAlive.current||consumedOffer.current===offer||current.planOffer!==offer||current.brokerId!==b.id
      ||current.services.presentationScope!==offer.scope||!current.services.authenticated||current.state!=='NEEDS_PLAN'
      ||current.services.onConnect||window.location.href!==offer.href||getSitePage())return
    consumedOffer.current=offer
    current.services.onSubscribe?.()
  }
  const account=()=>!unavailable&&services.onOpenAccount?services.onOpenAccount(b.id):onNotice('계정 개설','계정 개설 경로를 확인하고 있습니다. 새 계정이나 연결은 생성되지 않았어요.')
  const write=()=>{if(reviewLock.current)return;if(!services.authenticated){if(services.onLogin)services.onLogin();else onNotice('로그인이 필요합니다','리뷰를 남기려면 로그인해주세요.');return}setReviewStatus('idle');setWriting(true)}
  // The request belongs to this detail, not the dismissible writer. Closing
  // that window never claims cancellation and cannot unlock a second submit.
  const submitReview:NonNullable<BrokerServices['submitReview']>=async(brokerId,payload)=>{
    if(reviewLock.current||!planAlive.current||!services.submitReview)throw new Error('REVIEW_UNAVAILABLE')
    reviewLock.current=true;setReviewStatus('pending')
    try{
      await services.submitReview(brokerId,payload)
      if(planAlive.current){
        const current=currentReviewView.current
        current.onReviewViewChange({...current.reviewView,page:1})
        setReviewStatus('accepted');setWriting(false)
      }
    }catch(error){if(planAlive.current)setReviewStatus('failed');throw error}
    finally{reviewLock.current=false}
  }
  const closeWriter=()=>{
    setWriting(false)
    if(reviewLock.current)requestAnimationFrame(()=>{
      const heading=reviewHeading.current
      if(planAlive.current&&document.activeElement===document.body&&heading?.isConnected&&!heading.closest('[hidden],[inert]')&&heading.getClientRects().length)heading.focus({preventScroll:true})
    })
  }
  const color=['#0a0a0a','#0a0a0c'].includes(b.col)?'#5b8af7':b.col
  const about=unavailable?'':info.about??b.about??''
  const connectionNote=t(services.serviceBoundary?(unavailable?'거래소 연결 상태와 거래 조건은 아직 제공되지 않았습니다.':''):b.conn?'TETH 연결은 조회와 거래 권한만 사용하고 출금 권한은 요구하지 않아요.':'TETH 연결은 준비 중이며, 연결이 열리면 조회와 거래 권한만 사용하고 출금 권한은 요구하지 않아요.')
  const leverage=b.lev2?.fut?'1:'+b.lev2.fut.replace(/[^0-9]/g,''):b.lev2?t('현물 1:1'):b.lev||'—'
  const fees=[['최대 레버리지',leverage],['입금 수수료',b.fees?.dep||'—'],['출금 수수료',b.fees?.wd||'—'],['휴면 수수료',b.fees?.ina||'—'],
    ...(b.fees?.mk?[['현물 Maker / Taker',b.fees.mk+' / '+(b.fees.tk||'—')]]:[]),
    ...(b.fees?.fmk||b.fees?.ftk?[['선물 Maker / Taker',(b.fees.fmk||'—')+' / '+(b.fees.ftk||'—')]]:b.lev2?.fut?[['선물 Maker / Taker','—']]:[])]
  const questions:[string,string][]=supplied?(info.faq??[]).map(({q,a})=>[q,a]):unavailable?[
    ['TETH와 어떻게 연결하나요?','거래소 연결 서비스가 아직 제공되지 않았습니다. 이 화면에서는 계정 연결이나 주문을 실행하지 않습니다.'],
    ['출금 권한이 필요한가요?','출금 권한은 요구하지 않습니다. API 키 등 인증 정보를 이 화면에 입력하지 마세요.'],
  ]:[
    ['TETH와 어떻게 연결하나요?',b.conn?t('전략 검증을 통과한 뒤 연결 화면에서 {name} API 키를 등록하면 돼요. 약 5분이면 끝납니다.',{name:b.name}):'아직 준비 중이에요. 지원이 열리면 이 페이지와 알림으로 가장 먼저 알려드릴게요.'],
    ['어떤 권한이 필요한가요?','조회와 거래 권한만 사용해요. API 생성 시 출금 권한은 켜지 마세요.'],
    ['출금 권한이 필요한가요?','아니요. TETH는 자산을 옮길 수 없고, 출금 권한은 어떤 경우에도 요구하지 않아요.'],
    ['기존 계정도 연결할 수 있나요?',b.conn?'네. 이미 쓰던 계정 그대로 API 키만 만들어 연결할 수 있어요.':'지원이 열리면 기존 계정 그대로 API 키로 연결할 수 있도록 준비하고 있어요.'],
    ['계정 개설 혜택은 무엇인가요?',b.conn&&b.promo?'파트너 링크로 가입하면 TETH 이용료가 영원히 ₩0이에요. 가입 즉시 자동 연결됩니다.':'현재 준비 중이에요. 지원이 열리면 이 페이지에 먼저 표시됩니다.'],
    ['연결을 해제하면 어떻게 되나요?','실행 중인 전략이 멈추고, TETH는 더 이상 계정에 접근할 수 없어요. 자산은 그대로 남습니다.'],
    ...(info.faq??[]).map(({q,a}):[string,string]=>[q,a])
  ]
  return <div className="bk2-page bk2-det">
    <div className="bk2-glow" style={{background:`radial-gradient(ellipse 62% 90% at 50% -30%,${color}26 0%,rgba(15,16,18,0) 100%)`}} aria-hidden="true"/>
    <nav className="bk2-bc" aria-label={t("거래소 경로")}><button type="button" onClick={onBack}>{t("지원 거래소")}</button> / <span>{b.name}</span></nav>
    <div className="bk2-head"><Logo broker={b} logo={supplied?.logoUrl}/><div className="hi"><div className="nmrow"><h2 className="nm" ref={heading} tabIndex={-1}>{b.name}</h2><span className="bk2-bdg tag">{['거래소','증권사','브로커'].includes(b.tag)?t(b.tag):b.tag}</span>{connected?<span className="bk2-bdg ok"><Check/> {t("연결됨")}</span>:(state===null||!b.conn)&&<span className="bk2-bdg soon">{t(state===null?'상태 미확인':'지원 예정')}</span>}</div>{b.rating!=null&&<div className="rrow"><button className="bk2-rc" aria-label={t("평점 분포 보기")} title={b.ratingSrc||t('앱스토어 공개 평점 기준')} type="button" onClick={()=>selectTab('reviews',true)}>★ {b.rating.toFixed(1)}</button></div>}<div className="bk2-st"><span><small>{t("평가")}</small><b>{reviewsUnavailable?'—':rv.length+(ownReview?1:0)}</b></span><span><small>{t("연결 계정")}</small><b>{b.traders}</b></span></div></div><div className="ha">{connected?<><span className="bk2-conn"><Check/> {t("TETH에 연결됨")}</span><button className="obtn" type="button" disabled={services.actionPending} onClick={connect}>{t("연결 관리")}</button></>:(unavailable||b.conn)&&<><button className="wbtn" type="button" disabled={services.actionPending} onClick={connect}>{t("TETH로 연결")}</button><button className="obtn" type="button" disabled={services.actionPending} onClick={account}>{t("계정 개설 ↗")}</button></>}</div></div>
    <div ref={tabs} className="bk2-tabs" role="tablist" aria-label={t("거래소 상세")} onKeyDown={e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();selectTab(e.key==='Home'?'overview':e.key==='End'?'reviews':tab==='overview'?'reviews':'overview',true)}}>{(['overview','reviews'] as const).map(t=><button key={t} type="button" id={id+'-'+t} data-tab={t} role="tab" aria-selected={tab===t} tabIndex={tab===t?0:-1} aria-controls={id+'-panel'} className={'tb'+(tab===t?' on':'')} onClick={()=>selectTab(t)}>{t==='overview'?copy('개요'):copy('리뷰')}</button>)}</div>
    <div id={id+'-panel'} role="tabpanel" aria-labelledby={id+'-'+tab}>
    {tab==='overview'?<>
      <h3 className="bk2-sh">{t("거래 가능 자산")}</h3><div className="bk2-assets">{unavailable?<span>—</span>:b.assetsList.map(a=><span key={a}>{a}</span>)}</div>
      {b.conn&&b.promo&&<div className="bk2-promo" style={{background:`linear-gradient(100deg,${color}2e 0%,${color}14 34%,rgba(20,22,28,.9) 72%,rgba(15,16,18,.6) 100%)`}}><div className="tx"><small>{t("프로모션")}</small><b>{b.promo}</b><p>{services.serviceBoundary?supplied?.promotionBody:t(SOURCE_PROMO)}</p></div><div className="ac"><button className="wbtn" type="button" onClick={()=>onNotice('{name} 파트너 혜택','혜택 조건은 승인된 서비스 정책과 거래소 안내를 확인한 뒤 적용됩니다. 현재 화면만으로 무료 자격이나 계정 연결이 생성되지 않습니다.',{brokerId:b.id,label:'{name} 계정 개설 ↗'},{name:b.name})}>{t("혜택 자세히")}</button></div></div>}
      <h3 className="bk2-sh">{t("리뷰")} <span className="sp"/><button className="obtn sm" type="button" onClick={()=>selectTab('reviews',true)}>{t("전체 보기")}</button></h3>
      {reviewsUnavailable?<p className="bk2-empty">{t("리뷰 데이터가 아직 제공되지 않았습니다.")}</p>:!rv.length?<p className="bk2-empty">{t("아직 리뷰가 없어요.")}</p>:<div className="bk2-rvwrap"><button className="bk2-arw l" type="button" disabled={!edges.left} aria-label={t("이전 리뷰")} onClick={()=>carousel.current?.scrollBy({left:-316,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})}>‹</button><div ref={carousel} className="bk2-rvrow">{rv.slice(0,8).map(r=><ReviewCard key={r.id} review={r} onOpen={()=>setReview(r)}/>)}</div><button className="bk2-arw r" type="button" disabled={!edges.right} aria-label={t("다음 리뷰")} onClick={()=>carousel.current?.scrollBy({left:316,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})}>›</button></div>}
      <h3 className="bk2-sh">{t("거래 조건, 수수료")}</h3><div className="bk2-fees">{fees.map(([k,v])=><div key={k}><small>{t(k)}</small><b>{v}</b></div>)}</div>
      <p className="bk2-asof">{unavailable?t('수수료와 레버리지 데이터가 아직 제공되지 않았습니다.'):services.serviceBoundary?<>{b.feeNote} {supplied?.feeAsOfLabel}</>:<>{b.feeNote&&b.feeNote+' '}{t('수수료와 레버리지는 기본 등급(VIP0) 공식 문서 기준, {date} 기준 스냅샷이에요.',{date:b.asof||'2026.09'})}</>}</p>
      <h3 className="bk2-sh">{t('{name}에 대하여',{name:b.name})}</h3><div className="bk2-about"><div className="mg"><div><small>{t("설립")}</small><b>{info.founded||'-'}</b></div><div><small>{t("본사")}</small><b>{info.hq??'-'}</b></div><div><small>{t("문서")}</small>{docsUrl?<a href={docsUrl} target="_blank" rel="noopener noreferrer">{t("공식 문서 ↗")}</a>:<b>-</b>}</div><div><small>{t("웹사이트")}</small><>{siteUrl?<a href={siteUrl} target="_blank" rel="noopener noreferrer">{b.site} ↗</a>:<b>—</b>}</></div><div><small>{t("커뮤니티")}</small>{info.community&&communityUrl?<a href={communityUrl} target="_blank" rel="noopener noreferrer">{info.community} ↗</a>:<b>{info.community||'-'}</b>}</div></div><p>{[about,!about.includes('출금 권한')&&connectionNote,!services.serviceBoundary&&b.conn&&t('연결 후에도 설정에서 언제든 끊을 수 있습니다.')].filter(Boolean).join(' ')}</p></div>
      <h3 className="bk2-sh">{t("도구 및 기능")}</h3><div className="bk2-feat">{FEATURE_GROUPS.map(([title,rows])=><div key={title}><div className="gh">{t(title)}</div>{rows.filter(([key])=>services.serviceBoundary||typeof info.caps?.[key]==='boolean').map(([key,title,desc])=><div className="fr" key={key}><span><b>{t(title)}</b><small>{t(desc)}</small></span><i className={info.caps?.[key]===true?'ok':'no'} aria-label={typeof info.caps?.[key]!=='boolean'?t('정보 미제공'):info.caps[key]?(services.serviceBoundary?t('사업자 지원 정보'):t('원본 사업자 지원 정보')):t('지원하지 않음')}>{typeof info.caps?.[key]!=='boolean'?'—':info.caps[key]?'✓':'-'}</i></div>)}</div>)}<div className="gh">{t("TETH 연결 권한")}</div>{[['잔고, 시세 조회','전략 계산과 리스크 확인에 사용해요.'],['주문 실행','전략 조건이 맞을 때 매수와 매도를 실행해요.'],['출금','TETH는 자산을 옮길 수 없어요. 요구하지 않습니다.']].map(([k,v],i)=><div className="fr" key={k}><span><b>{t(k)}</b><small>{t(v)}</small></span><i className={services.serviceBoundary||i===2?'no':'ok'}>{services.serviceBoundary?'—':i===2?'-':'✓'}</i></div>)}</div>
      <h3 className="bk2-sh">{t("자주 묻는 질문")}</h3><div className="bk2-faq">{questions.slice(0,8).map(([q,a],i)=><div key={q} className={'fq'+(faq.includes(i)?' on':'')}><button type="button" className="q" aria-expanded={faq.includes(i)} aria-controls={id+'-faq-'+i} onClick={()=>setFaq(current=>current.includes(i)?current.filter(n=>n!==i):[...current,i])}>{supplied?q:t(q)}<i aria-hidden="true">+</i></button><div className="a" id={id+'-faq-'+i}>{supplied?a:t(a)}</div></div>)}</div>
    </>:<>
      <h3 className="bk2-sh">{t("평점 분포")}</h3><div className="bk2-dist">{counts.map((n,i)=><div className="dr" key={i} role="img" aria-label={reviewsUnavailable?t('{rating}점 정보 미제공',{rating:5-i}):t('{rating}점 {count}개 리뷰',{rating:5-i,count:n})}><span className="sl">{5-i}★</span><span className="bar"><i style={{width:`${n/Math.max(...counts,1)*100}%`}}/></span><span className="n">{reviewsUnavailable?'—':n}</span></div>)}</div>
      <div className="bk2-sh bk2-review-heading"><h3 ref={reviewHeading} tabIndex={-1}>{t("리뷰")}</h3><span className="sp"/><Select compact label={t("리뷰 정렬")} value={sort} options={[[ 'rating','별점 높은 순' ],[ 'recent','최신순' ]]} onChange={v=>onReviewViewChange({...reviewView,sort:v==='recent'?'recent':'rating',page:1})}/><button type="button" className="wbtn sm" disabled={services.actionPending||reviewStatus==='pending'||(services.serviceBoundary&&!services.submitReview)} aria-busy={reviewStatus==='pending'} onClick={write}>{t("리뷰 남기기")}</button></div>
      {reviewStatus==='accepted'&&<p role="status">{t('리뷰를 등록했습니다')}</p>}
      {reviewStatus==='pending'&&!writing&&<p role="status">{t('등록 중…')} {t('창을 닫아도 등록 요청은 계속 진행됩니다.')}</p>}
      {reviewStatus==='failed'&&!writing&&<p role="alert" className="bk2-error">{t('요청을 확인하지 못했습니다')}</p>}
      <div className="bk2-cats" role="group" aria-label={t("리뷰 카테고리")}>{BROKER_CATEGORIES.map(c=><button className={'cc'+(category===c?' on':'')} key={c} type="button" aria-pressed={category===c} onClick={()=>onReviewViewChange({...reviewView,category:c,page:1})}>{t(c)}</button>)}</div>
      <span className="tfbk-sr" role="status">{reviewsUnavailable?t('리뷰 데이터 미제공'):t('{category} 리뷰 {count}개 · {page} / {total} 페이지',{category:t(category),count:list.length,page:cur,total:max})}</span>
      <div className="bk2-rvgrid">{ownReview&&cur===1&&<div className="bk2-rvc bk2-mine"><Stars rating={ownReview.rating}/><p>{ownReview.text}</p><span className="by">{t('나')}, {ownReview.date}</span></div>}{shown.map(r=><ReviewCard key={r.id} review={r} tags onOpen={()=>setReview(r)}/>)}{!shown.length&&!(ownReview&&cur===1)&&<p className="bk2-empty">{reviewsUnavailable?t('리뷰 데이터가 아직 제공되지 않았습니다.'):t('이 카테고리의 리뷰가 아직 없어요.')}</p>}</div>
      <ReviewPagination current={cur} max={max} onSelect={next=>{setPage(next);reviewHeading.current?.focus({preventScroll:true});reviewHeading.current?.scrollIntoView({block:'start'})}}/>
    </>}
    </div><p className="bk2-note">{t("수수료와 조건은 각 사업자 공지 기준으로 달라질 수 있습니다.")}<br/>{services.serviceBoundary?(services.presentation?.catalog==null?t('원본 사업자 목록입니다. 실제 지원·연결 상태와 평점·후기·수수료는 아직 제공되지 않았습니다.'):t('제공된 사업자 정보입니다. 연결 상태는 확인된 응답으로만 갱신됩니다.')):t(SOURCE_NOTE)}</p>
    {review&&<BrokerDialog title={t("리뷰")} onClose={()=>setReview(null)}><Stars rating={review.rating}/><p className="bk2-full-review">{review.text}</p><p>{review.author}, {review.date}</p></BrokerDialog>}
    {writing&&<ReviewWriter broker={b} submit={services.submitReview?submitReview:undefined} onClose={closeWriter}/>}
    {offerCurrent&&planOffer&&<ClientUpgradeSheet context="bk" name={b.name} trigger={planOffer.trigger} onClose={()=>setPlanOffer(null)} onLater={()=>setPlanOffer(null)} onSubscribe={services.onSubscribe?()=>subscribe(planOffer):undefined}/>}
  </div>
}

function useBrokerDelivery(input:BrokerServices,onFailure:()=>void):BrokerServices{
  const [actionPending,setActionPending]=useState(false)
  const actionLock=useRef(false),alive=useRef(false)
  useLayoutEffect(()=>{alive.current=true;return()=>{alive.current=false}},[])
  const invoke=async(action:(()=>void|Promise<void>)|undefined)=>{
    if(actionLock.current||!action||!alive.current)return
    actionLock.current=true;setActionPending(true)
    try{await action()}catch{if(alive.current)onFailure()}
    finally{actionLock.current=false;if(alive.current)setActionPending(false)}
  }
  const actions=input.serviceBoundary&&input.presentation?.catalog!=null?input.presentation.actions:undefined
  return input.serviceBoundary?{...input,actionPending,
    onConnect:actions?.onConnect?(id,state)=>{void invoke(()=>actions.onConnect!(id,state))}:undefined,
    onOpenAccount:actions?.onOpenAccount?id=>{void invoke(()=>actions.onOpenAccount!(id))}:undefined,
    onSubscribe:actions?.onSubscribe?()=>{void invoke(actions.onSubscribe)}:undefined,
    submitReview:actions?.submitReview,
  }:input
}

export function ClientBrokers(props:Props){
  return <ClientBrokerSurface key={props.serviceBoundary?JSON.stringify([props.presentationScope??props.presentation?.scope,brokerViewDataset(props.presentation)]):'source-preview'} {...props}/>
}
function ClientBrokerSurface({onTitleChange,listRequest=0,viewState,onViewStateChange,...inputServices}:Props){
  const t=useBrokerText()
  const owner=inputServices.serviceBoundary?inputServices.presentationScope??inputServices.presentation?.scope??null:null
  const dataset=brokerViewDataset(inputServices.serviceBoundary?inputServices.presentation:undefined)
  const [localView,setLocalView]=useState(()=>initialBrokerView(owner,dataset))
  const view=brokerViewBound(viewState,owner,dataset)?viewState:localView
  const viewAlive=useRef(false)
  useLayoutEffect(()=>{viewAlive.current=true;return()=>{viewAlive.current=false}},[])
  const changeView=(next:BrokerViewState)=>{
    if(!viewAlive.current||!brokerViewBound(next,owner,dataset))return
    setLocalView(next);onViewStateChange?.(next)
  }
  const filter=view.listFilter,sort=view.listSort
  const setFilter=(listFilter:BrokerFilter)=>changeView({...view,listFilter})
  const setSort=(value:string)=>changeView({...view,listSort:value==='rating'||value==='reviews'||value==='users'?value:'order'})
  const [broker,setBroker]=useState<ClientBroker|null>(null),[notice,setNotice]=useState<BrokerNotice|null>(null)
  const services=useBrokerDelivery(inputServices,()=>setNotice({title:'요청을 확인하지 못했습니다',body:'요청을 완료하지 못했습니다. 연결이나 결제가 완료된 것으로 처리하지 않았습니다. 다시 시도해주세요.'}))
  const [handledListRequest,setHandledListRequest]=useState(listRequest)
  const previous=useRef<{id:string;top:number}|null>(null)
  // Explicit sidebar entry means listing, unlike detail Back which restores the
  // previous card and scroll. Keep the source listing's chosen filter and sort.
  if(handledListRequest!==listRequest){setHandledListRequest(listRequest);setBroker(null);setNotice(null)}
  const catalog=services.presentation?.catalog
  const list=services.serviceBoundary&&catalog!=null?filterBrokerPresentation(catalog,filter,sort).map(item=>item.broker)
    :filterBrokers(filter,services.serviceBoundary?'order':sort).map(b=>services.serviceBoundary?{...b,rating:null,traders:'—',rvN:undefined,promo:undefined,fees:undefined,lev:undefined,lev2:undefined}:b)
  const selectedBroker=broker&&services.serviceBoundary&&catalog!=null?catalog.find(item=>item.broker.id===broker.id)?.broker??null:broker
  useEffect(()=>{previous.current=null},[listRequest])
  useEffect(()=>{onTitleChange(selectedBroker?.name??'지원 거래소')},[selectedBroker,onTitleChange])
  useEffect(()=>{if(broker||!previous.current)return;const p=previous.current;clientResearchScrollport()?.scrollTo({top:p.top});document.getElementById('broker-'+p.id)?.focus({preventScroll:true});previous.current=null},[broker])
  const open=(b:ClientBroker)=>{previous.current={id:b.id,top:clientResearchScrollport()?.scrollTop??0};setBroker(b)}
  const showNotice=(title:string,body:string,account?:BrokerNotice['account'],values?:BrokerNotice['values'])=>setNotice({title,body,account,values})
  const openNoticeAccount=()=>{
    // Bind the displayed action to this detail; consume the current service callback,
    // never an old callback retained in a prior broker's notice.
    if(!notice?.account||notice.account.brokerId!==broker?.id)return
    if(services.onOpenAccount)services.onOpenAccount(notice.account.brokerId)
    else showNotice('계정 개설','계정 개설 경로를 확인하고 있습니다. 새 계정이나 연결은 생성되지 않았어요.')
  }
  return <>{selectedBroker?<BrokerDetail key={selectedBroker.id} broker={selectedBroker} services={services} onBack={()=>setBroker(null)} onNotice={showNotice} reviewView={view.review} onReviewViewChange={review=>changeView({...view,review})}/>:<div className="bk2-page">
    <div className="bk2-hero"><h2>{t("연결하면, 실행됩니다")}</h2><div className="bk2-pts">{['5분이면 준비 끝','연결하고, TETH에게 거래를 맡기세요','출금 권한 필요 없음, 언제든 연결 해제'].map(text=><span key={text}><Check/>{t(text)}</span>)}</div></div>
    <div className="bk2-bar"><Select key={listRequest} label={t("거래소 정렬")} value={sort} options={services.serviceBoundary&&catalog==null?[[ 'order','기본 순서' ]]:[[ 'order','기본 순서' ],[ 'rating','최고 평점' ],[ 'reviews','최다 리뷰' ],[ 'users','최다 사용자' ]]} onChange={setSort}/><span className="dv" aria-hidden="true"/>{BROKER_FILTERS.map(([v,text])=><button key={v} type="button" className={'fp'+(filter===v?' on':'')} aria-pressed={filter===v} onClick={()=>setFilter(v)}>{t(text)}</button>)}</div>
    {list.map(b=><article className="bk2-card" key={b.id} aria-label={b.name}><div className="lft"><div className="nmrow"><button id={'broker-'+b.id} className="nm" type="button" onClick={()=>open(b)}>{b.name}</button><span className={'bk2-bdg '+((!services.serviceBoundary||catalog!=null)&&b.conn?'ok':'soon')}>{services.serviceBoundary?(catalog?.find(item=>item.broker.id===b.id)?.connectionState==='CONNECTED'?t('연결됨'):catalog==null?t('상태 미확인'):b.conn?t('연결 지원'):t('지원 예정')):services.connectionState?.(b.id)==='CONNECTED'?t('연결됨'):b.conn?t('연결 지원'):t('지원 예정')}</span></div><div className="as">{services.serviceBoundary&&catalog==null?t(b.tag):b.assetsList.join(', ')}</div><div className="bk2-meta">{b.rating!=null&&<span className="rt" title={b.ratingSrc||t('앱스토어 공개 평점 기준')}><b>{b.rating.toFixed(1)}</b><Stars rating={b.rating}/><small className="rtsrc">{services.serviceBoundary?b.ratingSrc:'App Store'}</small></span>}<span className="m"><b>{services.serviceBoundary?b.rvN??'—':b.rvN??0}</b>{t("리뷰")}</span>{(services.serviceBoundary||b.conn)&&<span className="m"><b>{b.traders}</b>{t("연결 계정")}</span>}</div>{b.conn&&b.promo&&<div className="pr"><small>{t("프로모션")}</small><b>{b.promo}</b></div>}<div className="bt">{(services.serviceBoundary||b.conn)&&<button className="wbtn" type="button" disabled={services.actionPending} onClick={()=>services.onOpenAccount?services.onOpenAccount(b.id):showNotice('계정 개설','계정 개설 경로를 확인하고 있습니다. 새 계정이나 연결은 생성되지 않았어요.')}>{t("계정 개설 ↗")}</button>}<button className="obtn" aria-label={t('{name} 자세히',{name:b.name})} type="button" onClick={()=>open(b)}>{t("자세히 보기")}</button></div></div><Logo broker={b} stack logo={catalog?.find(item=>item.broker.id===b.id)?.logoUrl}/></article>)}
    {!list.length&&<p className="bk2-empty">{services.serviceBoundary&&catalog?.length===0?t('등록된 사업자가 없습니다.'):filter==='broker'?t('브로커는 준비 중이에요. 준비되는 대로 이곳에 먼저 표시됩니다.'):t('조건에 맞는 사업자가 없어요.')}</p>}
    <p className="bk2-note">{t("수수료는 각 사업자 공지 기준으로 달라질 수 있습니다.")}<br/>{services.serviceBoundary?(services.presentation?.catalog==null?t('원본 사업자 목록입니다. 실제 지원·연결 상태와 평점·후기·수수료는 아직 제공되지 않았습니다.'):t('제공된 사업자 정보입니다. 연결 상태는 확인된 응답으로만 갱신됩니다.')):t(SOURCE_NOTE)}</p>
  </div>}{notice&&<BrokerDialog title={t(notice.title,notice.values)} onClose={()=>setNotice(null)}><p>{t(notice.body,notice.values)}</p>{notice.account&&notice.account.brokerId===broker?.id&&<button className="wbtn bk2-promo-account" type="button" disabled={services.actionPending} onClick={openNoticeAccount}>{t(notice.account.label,notice.values)}</button>}</BrokerDialog>}</>
}
