/** Public preview lineage, never Strategy Version / approval / provider authority. */
import type { ClientSession, ClientTurn } from './client-experience-store'
import { decodeInlineInput, type InlineBacktestInput } from './client-inline-backtest'
import { commonAmounts, commonPeriods, commonBacktestInput, commonPreviewProgress, readCommonBacktest, type CommonBacktestPreview } from './client-common-backtest-preview'
import { sourceTerminalPrices } from './client-terminal-source-fixture'
import { commonSelectionVisible, responseStrategyForTurn } from './client-response-strategy'

// A display-only dataset identity. Not a cryptographic service receipt.
let hash=2166136261
for(const ch of JSON.stringify(sourceTerminalPrices))hash=Math.imul(hash^ch.charCodeAt(0),16777619)
export const COMMON_PREVIEW_REVISION=`daily-preview-hold25-cost002-v1:${hash>>>0}`
/** Immutable display context carried into a new conversation, not an executable request. */
export type CommonResultContext={
  owner:string|null
  sourceSessionId:string
  sourceTurnId:string
  title:string
  input:InlineBacktestInput
  period:CommonBacktestPreview['period']
  amount:CommonBacktestPreview['amount']
  dataRevision:string
}
export function readCommonResultContext(value:unknown):CommonResultContext|undefined{
  if(!value||typeof value!=='object')return
  const x=value as CommonResultContext,input=decodeInlineInput(x.input)
  if(x.owner!==null&&(typeof x.owner!=='string'||!x.owner.trim()))return
  if(!input||x.dataRevision!==COMMON_PREVIEW_REVISION||!commonPeriods.includes(x.period)||!commonAmounts.includes(x.amount)
    ||![x.sourceSessionId,x.sourceTurnId,x.title].every(v=>typeof v==='string'&&v.trim()&&v.length<=1000))return
  return {owner:x.owner,sourceSessionId:x.sourceSessionId,sourceTurnId:x.sourceTurnId,title:x.title,
    input,period:x.period,amount:x.amount,dataRevision:x.dataRevision}
}
export function commonResultContext(session:ClientSession,owner:string|null):CommonResultContext{
  const source=commonBacktestInput(session)
  if(!source||!commonSelectionVisible(session,owner)||commonPreviewProgress(source.state,Date.now())<1)throw new Error('Completed preview required')
  const proposal=responseStrategyForTurn(session.turns.find(turn=>turn.id===source.state.turnId))
  return {owner,sourceSessionId:session.id,sourceTurnId:source.state.turnId,title:proposal?.name||session.title||source.input.pair,
    input:structuredClone(source.input),period:source.state.period,amount:source.state.amount,dataRevision:COMMON_PREVIEW_REVISION}
}
export type CommonRevision={
  owner:string|null
  base:CommonBacktestPreview
  before:InlineBacktestInput
  proposal:InlineBacktestInput
  dataRevision:string
  kind:'proposal'|'revert'
}
const parameters=['sl','tp','rsiTh','trendFilter'] as const
export function samePreviewInput(a:InlineBacktestInput,b:InlineBacktestInput){return JSON.stringify(a)===JSON.stringify(b)}
export function onePreviewChange(before:InlineBacktestInput,after:InlineBacktestInput){
  return before.pair===after.pair&&before.timeframe===after.timeframe
    &&before.parameters.startI===after.parameters.startI&&before.parameters.endI===after.parameters.endI
    &&parameters.filter(k=>before.parameters[k]!==after.parameters[k]).length===1
}
export function readCommonRevision(value:unknown,prior:ClientTurn[]):CommonRevision|undefined{
  if(!value||typeof value!=='object')return
  const x=value as CommonRevision
  if(x.owner!==null&&(typeof x.owner!=='string'||!x.owner.trim()))return
  if(!['proposal','revert'].includes(x.kind)||x.dataRevision!==COMMON_PREVIEW_REVISION)return
  const base=readCommonBacktest(x.base,prior),before=decodeInlineInput(x.before),proposal=decodeInlineInput(x.proposal)
  const original=base&&decodeInlineInput(prior.find(t=>t.id===base.turnId)?.inlineRequest)
  const originalTurn=base&&prior.find(t=>t.id===base.turnId)
  if(originalTurn?.responseSequence&&originalTurn.responseSequence.owner!==x.owner)return
  if(!base||commonPreviewProgress(base,Date.now())<1||!before||!proposal||!original
    ||!samePreviewInput(before,original)||!onePreviewChange(before,proposal))return
  return {owner:x.owner,base,before,proposal,dataRevision:x.dataRevision,kind:x.kind}
}
/** Quarantine bad local metadata without losing other messages or drafts. */
export function restoreCommonRevisions(turns:ClientTurn[]){
  let invalid=false
  const restored:ClientTurn[]=[],consumed=new Set<string>()
  for(const raw of turns){
    let turn={...raw}
    if(raw.commonRevision!==undefined||raw.commonRevisionInvalid!==undefined){
      const revision=raw.commonRevisionInvalid===undefined?readCommonRevision(raw.commonRevision,restored):undefined
      if(!revision||!Number.isSafeInteger(raw.startedAt)||raw.startedAt<0||raw.startedAt>8.64e15||raw.inlineRequest||raw.sourceIntake||raw.responseSequence||raw.marketResponse){
        invalid=true;turn={...turn,commonRevision:undefined,commonRevisionInvalid:true}
      }else turn={...turn,commonRevision:revision}
    }
    if(raw.commonRevisionOf!==undefined){
      const parent=restored.find(t=>t.id===raw.commonRevisionOf),input=decodeInlineInput(raw.inlineRequest)
      if(raw.commonRevisionInvalid!==undefined||!parent?.commonRevision||parent.status!=='done'||consumed.has(parent.id)||!input
        ||raw.status!=='done'||raw.backtestFlow!=='common'||!samePreviewInput(parent.commonRevision.proposal,input)){
        invalid=true;turn={...turn,commonRevisionOf:undefined,commonRevisionInvalid:true,inlineRequest:undefined,backtestFlow:undefined,commonBacktestOpened:undefined}
      }else consumed.add(parent.id)
    }
    restored.push(turn)
  }
  return {turns:restored,invalid}
}
export function completedCommonRevisionSource(session:ClientSession,expected:CommonBacktestPreview){
  const current=commonBacktestInput(session)
  if(!current||JSON.stringify(current.state)!==JSON.stringify(expected)||commonPreviewProgress(current.state,Date.now())<1)return
  return current
}
/** Explicitly labelled deterministic UI example; no model call or improved-score search. */
export function exampleCommonProposal(before:InlineBacktestInput):InlineBacktestInput{
  const take=before.parameters.tp
  const tp=take===null||take>=100?8:Math.min(100,Math.round((take*1.25+1)*100)/100)
  return decodeInlineInput({...before,parameters:{...before.parameters,tp}})!
}
export function commonRevisionComparison(session:ClientSession){
  const current=commonBacktestInput(session)
  const turn=current&&session.turns.find(t=>t.id===current.state.turnId)
  const parent=turn?.commonRevisionOf&&session.turns.find(t=>t.id===turn.commonRevisionOf)
  if(!current||!parent||!parent.commonRevision)return
  const revision=readCommonRevision(parent.commonRevision,session.turns.slice(0,session.turns.indexOf(parent)))
  if(!revision||!samePreviewInput(revision.proposal,decodeInlineInput(turn?.inlineRequest)!))return
  const before=commonBacktestInput({...session,commonBacktest:revision.base})
  if(!before)return
  return {revision,before,current,same:before.state.period===current.state.period&&before.state.amount===current.state.amount
    &&before.input.parameters.startI===current.input.parameters.startI&&before.input.parameters.endI===current.input.parameters.endI}
}
