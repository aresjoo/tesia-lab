import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from 'react'
import { useClientPreferences } from '../client-preferences'
import copy from '../client-trading-intro-copy.json'
import '../client-trading-intro.css'

const assets='/client-trading-intro'
// Source 917eeed retains only this decorative clip for 20 seconds across a
// quick remount. No storage, account data, timer or background player is kept.
let floorMemory: { time: number; done: boolean; at: number } | null = null
const models=[
  ['뉴스 확인',[['gemini','Gemini','구글 검색으로 최신 정보를 확인합니다'],['grok','Grok','X에서 지금 여론을 확인합니다'],['perplexity','Perplexity','뉴스와 공시의 출처를 찾습니다']]],
  ['시장 분석',[['deepseek','DeepSeek','시장을 분석합니다'],['qwen','Qwen','여러 종목을 한 번에 비교합니다'],['kimi','Kimi','긴 보고서와 자료를 읽습니다']]],
  ['판단 정리',[['chatgpt','ChatGPT','상황을 정리해 판단합니다'],['claude','Claude','판단한 이유를 문장으로 씁니다'],['mistral','Le Chat (Mistral)','보조 판단을 냅니다']]],
] as const
const steps=[['대화로 정하기','무엇을, 얼마로, 언제 멈출지 말로 정합니다.'],['과거 시장에서 확인','지난 시장에서 돌려 보고 결과와 기준을 확인합니다.'],['거래소 연결','거래소 계정을 연결하면 정한 예산으로 거래를 시작합니다.']]
const safety:[string,string,ReactNode][]=[
  ['연결 권한','잔고 조회와 주문만 승인합니다.',<><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>],
  ['전략 예산','전략마다 쓸 금액을 따로 정합니다.',<><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5V12l6 4"/></>],
  ['손실 한도','정한 손실에 닿으면 새 주문을 멈춥니다.',<><path d="M4 6h16M4 18h16M8 12h8"/></>],
  ['거래 중지','언제든 전략을 끄고 포지션을 정리합니다.',<><circle cx="12" cy="12" r="8.5"/><rect x="9" y="9" width="6" height="6" rx="1"/></>],
]

/** Original one-shot halo; no polling watchdog, no offscreen or hidden playback.
 * This is decorative media, never the lifetime of a research/backend task. */
function TileFloor(){
  const floor=useRef<HTMLDivElement>(null)
  useEffect(()=>{
    const host=floor.current
    if(!host)return
    const motion=matchMedia('(prefers-reduced-motion:reduce)')
    const age = floorMemory ? Date.now() - floorMemory.at : Infinity
    const memory = age >= 0 && age < 20_000 ? floorMemory : null
    let video:HTMLVideoElement|null=null,visible=false,done=memory?.done??false,disposed=false
    let resumePending = Boolean(memory && memory.time > 0 && !memory.done)
    const sync=()=>{
      if(disposed)return
      const play=visible&&!document.hidden&&!motion.matches&&!done
      if(play&&!video){
        video=document.createElement('video'); video.muted=true; video.defaultMuted=true; video.playsInline=true; video.preload='metadata'; video.tabIndex=-1
        video.setAttribute('aria-hidden','true'); video.setAttribute('disablepictureinpicture',''); video.poster=`${assets}/hero-tiles-end.jpg`
        const v=video
        v.onloadedmetadata=()=>{
          if(disposed||!resumePending||!memory)return
          try {
            if(Number.isFinite(v.duration)&&memory.time>=v.duration)done=true
            else { v.currentTime=memory.time;return }
          } catch { done=true }
          resumePending=false;sync()
        }
        v.onseeked=()=>{if(disposed||!resumePending)return;resumePending=false;sync()}
        v.onplaying=()=>{if(disposed||resumePending||done||!visible||document.hidden||motion.matches){v.pause();return}host.classList.add('playing');v.classList.add('on')}
        v.ontimeupdate=()=>{
          const showing=!done&&visible&&!document.hidden&&!motion.matches&&!v.paused&&v.currentTime<(Number.isFinite(v.duration)?v.duration:6.67)-.6
          v.classList.toggle('on',showing);host.classList.toggle('playing',showing)
        }
        v.onpause=()=>host.classList.remove('playing')
        v.onended=()=>{done=true;v.classList.remove('on');host.classList.remove('playing')}
        v.onerror=()=>{done=true;v.classList.remove('on');host.classList.remove('playing')}
        v.src=`${assets}/halo.mp4`;host.append(v)
      }
      if(video){if(play&&!resumePending)void video.play().catch(()=>{});else{video.pause();video.classList.remove('on');host.classList.remove('playing')}}
    }
    const observer=new IntersectionObserver(entries=>{visible=entries.at(-1)?.isIntersecting??false;sync()})
    observer.observe(host);document.addEventListener('visibilitychange',sync);motion.addEventListener('change',sync)
    return()=>{
      disposed=true;observer.disconnect();document.removeEventListener('visibilitychange',sync);motion.removeEventListener('change',sync)
      if(video){
        floorMemory={time:resumePending&&memory?memory.time:video.currentTime,done,at:Date.now()}
        video.pause();video.onplaying=video.onpause=video.ontimeupdate=video.onended=video.onerror=video.onloadedmetadata=video.onseeked=null
        video.removeAttribute('src');video.load();video.remove()
      }else if(memory)floorMemory={...memory,at:Date.now()}
      host.classList.remove('playing')
    }
  },[])
  return <div ref={floor} className="txh-floor" aria-hidden="true"><img src={`${assets}/hero-tiles-end.jpg`} width="1440" height="480" alt="" decoding="async"/></div>
}

function ExampleCard({name,exchange,avatar,stats,children}:{name:string;exchange:string;avatar:ReactNode;stats:[string,string,string?][];children:ReactNode}){
  return <article className="txh-card">
    <header className="txh-by"><span className="txh-av">{avatar}<img className="txh-ex" src={`/client-broker-assets/app-${exchange.toLowerCase()}.png`} width="20" height="20" alt=""/></span><span className="txh-who"><span className="txh-name">{name}</span><span className="txh-xch">{exchange}</span></span></header>
    <dl className="txh-stats">{stats.map(([label,value,tone])=><div className="txh-stat" key={label}><dt>{label}</dt><dd className={tone}>{value}</dd></div>)}</dl><p className="txh-body">{children}</p>
  </article>
}

/** Client-authored Korean editorial content, not a provider/entitlement claim.
 * Used by the explicitly marked public design preview. Never emits an order. */
export default function ClientTradingIntro({onStart}:{onStart:()=>void}){
  const {language}=useClientPreferences()
  const title=useRef<HTMLHeadingElement>(null)
  const id=useId()
  useLayoutEffect(()=>{const current=document.activeElement;if(current instanceof HTMLElement&&current.closest('.client-source-overlays,[data-sidebar-action]'))return;title.current?.focus({preventScroll:true})},[])
  const cta=<button type="button" className="txh-cta" lang={language} onClick={onStart}>{copy.start[language]}</button>
  const note=<div className="txh-more-row"><span className="txh-note">영원히 무료, 카드 등록 필요없음</span></div>
  return <><div className="txh-route-heading" lang="ko"><span>AI 트레이딩</span></div><div className="txh tx-guest" lang="ko">
    <section className="txh-hero" aria-labelledby={`${id}-title`}><div className="txh-copy"><p className="txh-eyebrow">AI 트레이딩</p><h1 ref={title} id={`${id}-title`} tabIndex={-1}>AI가 스스로<br className="txh-m"/> 판단해 거래합니다</h1><p className="txh-sub">거래소 계정을 한 번 승인으로 연결하면 전략이 그 계정에서 직접 주문합니다.</p>{cta}{note}</div><TileFloor/></section>
    <div className="txh-wrap">
      <section className="txh-sec first" aria-labelledby={`${id}-ai`}><h2 id={`${id}-ai`}>TETH가 쓰는 AI</h2><p className="txh-lead">뉴스 확인, 시장 분석, 판단 정리마다 맞는 AI를 씁니다.</p><div className="txh-ai-cols">{models.map(([label,rows])=><div className="txh-ai-col" key={label}><h3>{label}</h3><ul>{rows.map(([key,name,role])=><li key={key}><img src={`${assets}/ai/${key}.png`} width="40" height="40" alt="" loading="lazy" decoding="async"/><b>{name}</b><span>{role}</span></li>)}</ul></div>)}</div></section>
      <section className="txh-sec" aria-labelledby={`${id}-now`}><h2 id={`${id}-now`}>지금 TETH가 하는 일</h2><p className="txh-lead">거래할 때도, 기다릴 때도 이유를 적어 둡니다.</p><p className="txh-example-note" lang={language}>{copy.example[language]}</p><div className="txh-now">
        <ExampleCard name="워렌 버핏 AI 버전 13" exchange="Binance" avatar={<img className="txh-face" src={`${assets}/buffett.jpg`} alt="" width="56" height="56" loading="lazy"/>} stats={[["현재 잔고","$12,480"],["수익률","+8.2%","up"],["손익","+$946","up"]]}>AI 관련 기업의 강세를 예상해 기존 롱 포지션을 유지합니다. 주말 유동성과 거시 경제 일정을 고려해 새 거래와 헤지는 더하지 않습니다. NVDA 지지선과 MSFT 상승 추세를 보다가, 추세가 꺾이면 조정합니다.</ExampleCard>
        <ExampleCard name="RSI 반등 규칙 버전 2" exchange="Bitget" avatar={<svg className="txh-face" viewBox="0 0 56 56" width="56" height="56" aria-hidden="true"><circle cx="28" cy="28" r="28" fill="#1d2024"/><path d="M11 31A17 17 0 0 1 45 31" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="3.2"/><path d="M11 31A17 17 0 0 1 18.01 17.25" fill="none" stroke="#7c9cff" strokeWidth="3.2"/><path d="M28 31L19.72 20.98" stroke="#e3e3e3" strokeWidth="2" strokeLinecap="round"/><circle cx="28" cy="31" r="2.4" fill="#e3e3e3"/><text x="28" y="44" textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#e3e3e3">28</text></svg>} stats={[["현재 잔고","$1,000"],["수익률","+3.1%","up"],["손익","+$31","up"]]}>비트코인이 내려 RSI가 28입니다. 반등할 수 있지만, 규칙상 30을 다시 넘을 때만 삽니다. 그래서 지금은 기다립니다. 산 뒤 5% 내리면 팔고, 12% 오르면 절반을 정리합니다.</ExampleCard>
      </div></section>
      <section className="txh-sec" aria-labelledby={`${id}-how`}><h2 id={`${id}-how`}>시작 방법</h2><p className="txh-lead">대화로 전략을 정하고, 과거 시장에서 확인한 뒤 거래를 시작합니다.</p><div className="txh-steps">{steps.map(([heading,body])=><div className="txh-step" key={heading}><b>{heading}</b><p>{body}</p></div>)}</div></section>
      <section className="txh-sec" aria-labelledby={`${id}-safe`}><div className="txh-safe"><div><h2 id={`${id}-safe`}>실행 설정</h2><p className="txh-lead">전략마다 예산과 멈추는 조건을 정합니다.</p>{cta}{note}</div><ul>{safety.map(([heading,body,icon])=><li key={heading}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icon}</svg><b>{heading}</b><span>{body}</span></li>)}</ul></div></section>
    </div>
  </div></>
}
