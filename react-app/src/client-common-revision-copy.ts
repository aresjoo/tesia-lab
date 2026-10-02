import rows from './client-common-revision-copy.json' with { type: 'json' }
import type { ClientLanguage } from './client-preferences'
import type { InlineBacktestInput } from './client-inline-backtest'
import { commonBacktestText } from './client-common-backtest-copy'
const languages=['ko','en','ja','zh-CN','zh-TW','es','fr']
export function revisionText(language:ClientLanguage,key:keyof typeof rows){return rows[key][languages.indexOf(language)]??rows[key][0]}
export function revisionRule(input:InlineBacktestInput,language:ClientLanguage){
  const p=input.parameters,t=(key:Parameters<typeof commonBacktestText>[1])=>commonBacktestText(language,key)
  const f=new Intl.NumberFormat(language,{maximumFractionDigits:2})
  if(language==='ko')return `사는 때: ${input.pair}의 전날 RSI가 ${f.format(p.rsiTh)} 아래이고 하루 0.5% 넘게 반등한 날${p.trendFilter?', 방향이 뚜렷할 때만':''}. 파는 때: ${p.tp!==null?`산 가격보다 ${f.format(p.tp)}% 오르거나 `:''}${f.format(Math.abs(p.sl))}% 내리면, 또는 25일이 지나면`
  return `${input.pair} · RSI(n−1) < ${f.format(p.rsiTh)} · ΔP > 0.5%${p.trendFilter?` · ${t('clearTrend')}`:''}. ${t('sellWhen')}: ${p.tp!==null?t('takeRule').replace('{take}',f.format(p.tp))+' ':''}${t('exitRule').replace('{stop}',f.format(Math.abs(p.sl)))}`
}
