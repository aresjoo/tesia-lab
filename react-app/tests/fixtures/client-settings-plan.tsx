import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ClientSettingsPage } from '../../src/components/ClientSettingsPage'
import { NativeSettingsPlan } from '../../src/internal-poc/NativeSettingsPlan'
import { ClientServiceExperience } from '../../src/internal-poc/ClientServiceExperience'
import type { AccountPlanPresentation } from '../../src/client-account-presentation'
import type { NativeAccountPresentation } from '../../src/internal-poc/native-account-presentation'
import { useSiteLocation } from '../../src/site-navigation'
import { readClientSettingsLocation } from '../../src/client-settings-navigation'
import '../../src/styles.css'
import '../../src/client-reference.css'
const calls: unknown[] = []
export function App() {
  const [owner, setOwner] = useState('owner-a')
  const [preferences, setPreferences] = useState<AccountPlanPresentation['preferences'] | undefined>(undefined)
  const [gaugePercent, setGaugePercent] = useState(30)
  useSiteLocation()
  const data: NativeAccountPresentation = {
    scope: owner, identity: 'dataset-a', sourceLabel: 'SUPPLIED TEST', strategies: null, accounts: null,
    ledger: { pos: null, open: null, orders: null, fills: null, closed: null, assets: null },
    documents: [{ id:'review_settings', kind:'review', title:'공급된 상세 기록', sourceLabel:'SUPPLIED DETAIL', fields:[], sections:[] }],
    plan: { title:'Supplied account', sourceLabel:'SUPPLIED TEST', sections:{plan:[],alerts:[],rebates:[]}, presentation: {
      title: 'Supplied plan', sourceLabel:'SUPPLIED TEST', rebates:null,
      status: {hero:{title:'검증 계정',label:'잔액',value:'100 USDT',badge:'제공된 상태',tone:'gain',description:'공급된 잔액 설명'},badgeTone:'pro',gauge:{percent:gaugePercent,left:'제공된 사용량',right:'30%',style:'warn'},details:[{id:'raw',label:'원문 금액',value:'₩139,000',tone:'loss',icon:'card'}, {id:'detail',label:'연결된 상세',value:'상세 기록 보기',description:'제공된 기록으로만 이동',route:'#/review/review_settings',icon:'doc'}, {id:'absent',label:'미공급 상세',value:'연결 없음',route:'#/review/absent'}, {id:'unsafe',label:'외부 주소',value:'이동 불가',route:'https://example.invalid'}], actions:[{id:'refresh',label:'공급된 요청',tone:'pri'},{id:'trade',label:'거래 보기',route:'#/trade'}],footer:'공급된 결제 안내'},
      preferences:preferences === undefined ? [{id:'supplied',title:'공급된 수신 설정',badge:'그룹 표시',footer:'제공된 채널 정책은 계정별로 다릅니다.',rows:[{id:'changeable',label:'공급된 편집 채널',description:'원본 공급 설명을 생략하지 않습니다.',icon:'mail',badge:'선택 가능',checked:false,switchTone:'green'},{id:'fixed',label:'고정 채널',checked:true,disabled:true,badge:'필수',switchTone:'green'},{id:'unknown',label:'확인되지 않은 채널',checked:null,badge:'미확인'}]}] : preferences,
    } },
    actions: {
      onPlanAction: async id => { calls.push(id) },
      onPreference: async (id, checked) => { calls.push([id,checked]); await new Promise<void>((resolve, reject) => Object.assign(window,{settingsPlanResolve:resolve, settingsPlanReject:reject})) },
    },
  }
  Object.assign(window, {settingsPlanCalls:calls, settingsPlanOwner:setOwner, settingsPlanPreferences:setPreferences, settingsPlanGauge:setGaugePercent})
  const tab = readClientSettingsLocation() ?? 'notify'
  if (new URLSearchParams(location.search).get('host') === 'service') return <ClientServiceExperience nativeAccounts accountScope={owner} accountPresentation={data} state={{
    phase:'ready', sessionState:'AUTHENTICATED', messages:[], input:'', busy:false, inputDisabled:false, source:'service', recovery:null, quickReplies:[], workflow:null, outcome:null, issue:null, onInput:()=>{}, onSend:async()=>{}, onReset:async()=>{},
  }} />
  return <div className="client-source-app" style={{height:'100vh'}}>
    <ClientSettingsPage key={owner} tab={tab} onBack={()=>{}} onNewStrategy={()=>calls.push('new')} onCopyStrategy={()=>calls.push('copy')} onBrokers={()=>{}} onHelp={()=>{}} details={{
      billing:<NativeSettingsPlan key={owner+':billing'} data={data} tab="billing" onNavigate={destination=>calls.push(destination)} onTrading={()=>calls.push('trade')} />,
      notify:<NativeSettingsPlan key={owner+':notify'} data={data} tab="notify" onNavigate={destination=>calls.push(destination)} />,
    }} />
  </div>
}
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
