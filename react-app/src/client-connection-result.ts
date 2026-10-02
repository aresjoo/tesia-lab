/** History-only display context. Not a Strategy Version or execution grant. */
import type {ClientSession} from './client-experience-store'
import {commonBacktestInput,commonPreviewProgress} from './client-common-backtest-preview'
import {readCommonResultContext,samePreviewInput,type CommonResultContext} from './client-common-revision'

export function readConnectionResult(value:unknown,owner:string|null,sessions:ClientSession[]):CommonResultContext|null{
  const context=readCommonResultContext(value)
  if(!context||context.owner!==owner)return null
  const source=sessions.find(s=>s.id===context.sourceSessionId)
  if(!source||source.sharedCopy&&source.sharedCopy.owner!==owner)return null
  const current=commonBacktestInput(source)
  if(!current||commonPreviewProgress(current.state,Date.now())<1||current.state.turnId!==context.sourceTurnId
    ||current.state.period!==context.period||current.state.amount!==context.amount||!samePreviewInput(current.input,context.input))return null
  return context
}
