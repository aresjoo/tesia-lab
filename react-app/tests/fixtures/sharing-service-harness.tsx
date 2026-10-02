/* eslint-disable react-refresh/only-export-components -- isolated Playwright mount harness, not a product refresh boundary */
import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { NativeStrategies } from '../../src/internal-poc/NativeStrategies'
import { unavailableSharingPresentation, type SharingServicePresentation } from '../../src/client-sharing-presentation'
import type { SharedStrategy } from '../../src/client-shared-strategies'
import type { CreatorPublication } from '../../src/client-strategy-creator-store'
import type { CopyDataSet, CopyServiceAccount, CopyServicePosition, CopyServiceTransfer } from '../../src/client-copy-service-data'

const parameters = { sl: -4, tp: 10, rsiTh: 31, trendFilter: false, startI: 0, endI: 3 }
const result: SharedStrategy['result'] = { params: parameters, eq: [{i:0,v:1},{i:1,v:1.03},{i:2,v:1.02},{i:3,v:1.123}],
  trades: [{entry:0,exit:1,pnl:.03,kind:'tp',lowVol:false},{entry:2,exit:3,pnl:.09,kind:'time',lowVol:false}],
  ret:12.3,mdd:-1,winRate:100,n:2,pf:4,byYear:{'2031':{prod:1.123,pnl:.123,n:2,w:2}},worstYear:'2031',bestYear:'2031',worstYearPnl:12.3,bestYearPnl:12.3,
  mddStartI:1,mddEndI:2,underwaterDays:1,cagr:12,sharpe:1,sortino:1,calmar:1,exposure:50,tradeVol:1,avgHold:1,lossCount:0,lowVolLosses:0,lowVolLossShare:0,costImpact:.2 }
const source: SharedStrategy = { nick:'공급된 작성자',title:'공급된 전략',asset:'비트코인',score:88,followers:17,parameters,result,description:'서버 공급 검증 결과' }
const record = {id:'123',name:'나의 검증 전략',createdAt:123,status:'ready' as const,environment:'paper' as const,parameters:null,asset:'비트코인',score:88,ret:12.3,mdd:-1,n:2,winRate:100}
type Pending = { resolve:()=>void; reject:(reason:Error)=>void }
const pending = new Map<string,Pending>()
const actions:string[]=[]
function wait(kind:string) { actions.push(kind); return new Promise<void>((resolve,reject)=>pending.set(kind,{resolve,reject})) }
const at=Date.UTC(2031,0,2,9,15)
const dataset=<T,>(rows:T[]):CopyDataSet<T>=>({state:'ready',rows})
const positions=dataset<CopyServicePosition>([{id:'position-actual',pair:'ETH/USDC',direction:'Short',size:241.55,entryPrice:3400.012345,currentPrice:3350.22,liquidationRisk:'공급된 낮음',stopTarget:'3550 / 3200',unrealized:49.79,returnPercent:2.13}])
const transfers=dataset<CopyServiceTransfer>([{id:'transfer-actual',at,kind:'deposit',amount:350.25,asset:'USDC',direction:'Spot → Copy'}])
function Harness({ ready, badLink = false, classified = false }: { ready:boolean; badLink?:boolean; classified?:boolean }) {
  const [owner,setOwner]=useState('service-owner')
  const [startedAt,setStartedAt]=useState<number|null>(at)
  useEffect(()=>{const change=(event:Event)=>setStartedAt((event as CustomEvent<number|null>).detail);window.addEventListener('sharing-test-started-at',change);return()=>window.removeEventListener('sharing-test-started-at',change)},[])
  useEffect(()=>{const change=()=>setOwner('replacement-owner');window.addEventListener('sharing-test-owner',change);return()=>window.removeEventListener('sharing-test-owner',change)},[])
  const [watched,setWatched]=useState<string[]>([]),[publication,setPublication]=useState<CreatorPublication|null>(null),[visible,setVisible]=useState(false)
  const [closed,setClosed]=useState(false),[archived,setArchived]=useState(false),[removed,setRemoved]=useState(false),[flattened,setFlattened]=useState(false),[missing,setMissing]=useState(false)
  useEffect(()=>{const change=()=>setMissing(true);window.addEventListener('sharing-test-missing',change);return()=>window.removeEventListener('sharing-test-missing',change)},[])
  const account:CopyServiceAccount={id:'actual-account',nick:source.nick,status:closed?'closed':'active',startedAt,asset:'USDC',pairs:['ETH/USDC'],sharePercent:7,
    metrics:{est:1150.25,avail:700.21,net:87.23,unreal:49.79,realized:40.25,share:2.81},invested:1063.02,recovered:closed?1150.25:null,returnPercent:-31.2,
    positions:missing?undefined:flattened?dataset([]):positions,transfers:missing?undefined:transfers,
    trades:missing?undefined:dataset([{id:'closed-trade',pair:'ETH/USDC',direction:'Short',entryPrice:3450.12,exitPrice:3400.32,pnl:40.25,returnPercent:1.44,reason:'공급된 목표 체결',exitedAt:at}]),
    shares:missing?undefined:dataset([{id:'share-actual',from:at,to:at+86400000,realized:40.25,settled:2.81,pending:0,ratioPercent:7,amount:2.81}]),
    transactions:missing?undefined:dataset([{id:'transaction-actual',at,category:'Funding',pair:'ETH/USDC',quantity:'0.124 ETH',fee:0.032,balanceChange:-0.321}]),
    actions:{availableDeposit:777,availableWithdrawal:700.21,depositNeedsConfirmation:true,closeSettlement:{net:88.11,share:3.02,recovered:1151.13},flattenSettlement:{net:86.42,share:2.93,recovered:1149.44},
      onAdjust:async()=>{await wait('adjust')},onClose:async()=>{await wait('close');setClosed(true)},onFlatten:async()=>{await wait('flatten');setFlattened(true)}}}
  const presentation:SharingServicePresentation=ready?{
    shareUrl: badLink ? () => { throw new Error('PRIVATE_ADAPTER_PAYLOAD_NOT_FOR_DISPLAY') } : undefined,
    state:'ready',strategies:classified ? [
      { ...source, nick: 'AI 주식', kind: 'agent', market: 'stock', venue: { name: 'Binance', logo: 'binance' }, glyph: { kind: 'agent', shape: 'circle', universeSize: 8, selectedCount: 3 } },
      { ...source, nick: '규칙 가상자산', kind: 'rule', market: 'crypto' },
      { ...source, nick: '혼합 여러 시장', kind: 'mix', market: 'multi' },
      { ...source, nick: '분류 미제공' },
    ] : [source],watched,indexToDate:i=>new Date(Date.UTC(2031,0,1+i)),entryPrice:()=>321,exitPrice:()=>345,
    periodResult:(_,period)=>period==='all'?result:period==='1y'?{...result,ret:7.1}:null,
    onWatch:async(nick,on)=>{await wait('watch');setWatched(on?[nick]:[])},onAnalyze:async()=>{await wait('analyze')},
    onValidateCopy:async()=>{await wait('validate-copy');return {score:91,result:{...result,ret:5.6}}},onCopy:async(_,id)=>{if(id)actions.push(`confirm-id:${id}`);await wait('validate-confirm')},
    profile:(_,period)=>({period,meta:{nick:source.nick,days:365,share:.07,copiers:17,cap:200,aum:13000,total:20000,lastTradeMin:15,bio:'공급된 소개'},
      performance:{roi:period,pnl:321,copiersPnl:43,winRate:80,mdd:2,wins:8,losses:2,n:10,eq:result.eq},trustNote:{w:0,t:'공급된 검토 내용'},mddNote:{w:0,t:'공급된 리스크 내용'},weeklyBars:{available:true,bars:[{value:321,heightPx:50,positive:true}]},allocation:[{label:'BTC/USDT',percent:100,color:'#8fb2ff',dashArray:'251 0',dashOffset:'0'}]}),
    profileData:()=>({asset:'USDC',positions:missing?undefined:positions,transfers:missing?undefined:transfers,
      calendar:missing?undefined:{state:'ready',months:[{month:'2030-12',days:[{date:'2030-12-15',pnl:-15.33,returnPercent:-1.32,trades:3}]},{month:'2031-01',days:[{date:'2031-01-02',pnl:49.79,returnPercent:2.13,trades:2}]}]},
      copiers:missing?undefined:dataset([{id:'copier-actual',nick:'공급된 카피어',rank:2,investment:513.25,pnl:23.71,returnPercent:4.62,startedAt:at}])}),
    setup:{asset:'USDC',availableBalance:777,minimumAmount:50,pairs:['BTC/USDT','ETH/USDT'],sharePercent:7,onStart:async()=>{await wait('copy')}},
    creator:{candidates:[{record,eligible:true}],publication,visible,nick:'작성자 본인',onPublish:async request=>{await wait('publish');setPublication({...record,sourceId:record.id,description:request.description,publishedAt:'2031-01-04'});setVisible(true)},onVisibility:async next=>{await wait('visibility');setVisible(next)}},
    copyAccounts:{asset:'USDC',activeCount:closed?0:1,metrics:account.metrics,accounts:dataset([account])},
    follows:{state:'ready',rows:removed?[]:[{id:'follow-actual',nick:source.nick,status:{label:archived?'보관됨':'실행 준비',active:!archived,running:false},stopPercent:-4,targetPercent:12,budget:'350.25 USDC',startedAt:at}],onResume:async()=>{await wait('resume')},onEdit:async id=>{await wait('edit');return{id,budgetIndex:2,sl:-4,tp:12}},onArchive:async()=>{await wait('archive');setArchived(true)},onRemove:async()=>{await wait('remove');setRemoved(true)}},
  }:unavailableSharingPresentation
  return <NativeStrategies onReturn={()=>actions.push('return')} shouldFocus={()=>true} onTabChange={()=>actions.push('tab')} owner={owner} presentation={presentation} executionContent={<p>현재 대화 실행 기록</p>} />
}
export function mountSharing(ready:boolean, badLink = false, classified = false) {
  document.getElementById('root')?.remove()
  const root=document.createElement('main');root.id='sharing-test-root';document.body.append(root)
  createRoot(root).render(<Harness ready={ready} badLink={badLink} classified={classified}/>)
  return { actions, settle(kind:string,success=true){const value=pending.get(kind);pending.delete(kind);if(success)value?.resolve();else value?.reject(new Error('PRIVATE_ADAPTER_PAYLOAD_NOT_FOR_DISPLAY'))} }
}
