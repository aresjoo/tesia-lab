import { ApiV18Error, TesiaBitgetCopyV18Client, type BitgetCopyTransport, type CopyBinding } from './fixtures/api-v0.18/client.js'
import type * as Wire from './fixtures/api-v0.18/types.js'
import { api18CandidateFixture } from './candidate-fixture.js'
import type { CopyScope, CopyPresentation, SourceSelection, IssuedSourceBinding } from './presentation.js'

type Snapshot = Wire.DeepReadonly<Wire.CopySnapshot>
type Settings = Pick<Wire.CreateCopyRequest, 'allocationUsdt' | 'maxLossUsdt' | 'maxPositionFraction' | 'startMode'>
type Action = 'update' | 'start' | 'pause' | 'stop' | 'close'
type Context = { epoch: number; scope: CopyScope; signal: AbortSignal }
type Intent = { fingerprint: string; key: string; binding: CopyBinding; result?: Snapshot; uncertain: boolean }
export class CopyControllerError extends Error { constructor(readonly code: string) { super(code) } }
export type CopyControllerPorts = {
  fixture: typeof api18CandidateFixture
  transport: BitgetCopyTransport
  currentScope: () => CopyScope | null
  csrf: (scope: CopyScope, signal: AbortSignal) => Promise<string>
  readIssuedBinding?: (scope: CopyScope, source: SourceSelection, signal: AbortSignal) => Promise<IssuedSourceBinding | null>
  /** Legacy test injection is ignored: caller intent IDs are stable server replay keys. */
  randomKey?: () => string
}
const scopeKey = (value: CopyScope | null) => value ? JSON.stringify([value.owner, value.sessionId, value.connectionId, value.environment]) : null
const copyBinding = (copy: Snapshot): CopyBinding => ({connectionId: copy.connectionId, versionId: copy.versionId, policyHash: copy.policyHash, environment: copy.environment, startMode: copy.startMode})
const fail: (code: string) => never = (code) => { throw new CopyControllerError(code) }
const errorCode = (error: unknown) => error instanceof ApiV18Error || error instanceof CopyControllerError ? error.code : 'EXECUTION_UNAVAILABLE'
const initial = (): CopyPresentation => Object.freeze({phase:'unavailable', reason:'SOURCE_BINDING_UNAVAILABLE', mutationBusy:false,
  versions:Object.freeze([]), copies:Object.freeze([]), selectedVersion:null, selectedCopy:null})

/** Candidate SDK consumer only. No provider activation, storage, local ledger, or inferred issuance. */
export function createCandidateCopyController(ports: CopyControllerPorts) {
  if (ports.fixture !== api18CandidateFixture) fail('CANDIDATE_FIXTURE_REQUIRED')
  const client = new TesiaBitgetCopyV18Client(ports.transport)
  let scope: CopyScope | null = null, epoch = 0, disposed = false, sourceBinding: IssuedSourceBinding | null = null
  let state = initial(), busy = false
  let activeMutation: symbol | null = null
  const listeners = new Set<() => void>(), requests = new Set<AbortController>(), intents = new Map<string, Intent>()
  const revisions = new Map<string, Snapshot>()
  const emit = (patch: Partial<CopyPresentation>) => {
    state = Object.freeze({...state, ...patch})
    for (const listener of listeners) try { listener() } catch { /* UI cannot change server outcomes. */ }
  }
  const bind = (next: CopyScope | null) => {
    if (disposed) return
    if (next && (!next.owner.trim() || !next.sessionId.trim() || !/^[A-Za-z0-9_-]{16,128}$/.test(next.connectionId)
      || !['production','demo'].includes(next.environment))) fail('INVALID_SCOPE')
    if (scopeKey(next) === scopeKey(scope)) return
    epoch++; for (const request of requests) request.abort(); requests.clear()
    scope = next ? Object.freeze({...next}) : null; sourceBinding = null; intents.clear(); revisions.clear(); busy = false; activeMutation = null
    state = initial(); emit({phase:scope ? 'idle' : 'unavailable',reason:scope ? null : 'AUTHENTICATION_REQUIRED'})
  }
  const check = (context: Context) => {
    if (disposed || epoch !== context.epoch || context.signal.aborted) fail('ABORTED')
    if (scopeKey(ports.currentScope()) !== scopeKey(context.scope)) {
      bind(null); fail('SCOPE_CHANGED')
    }
  }
  const run = async <T>(operation: (context: Context) => Promise<T>, signal?: AbortSignal): Promise<T> => {
    if (disposed || !scope) return fail('AUTHENTICATION_REQUIRED')
    const request = new AbortController(), captured = {epoch,scope,signal:request.signal}
    const cancel = () => request.abort(); signal?.addEventListener('abort',cancel,{once:true}); if(signal?.aborted)cancel()
    requests.add(request)
    try { check(captured); const result = await operation(captured); check(captured); return result }
    catch(error) {
      if (!disposed && captured.epoch === epoch && !request.signal.aborted) emit({phase:errorCode(error)==='TRANSPORT_FAILED' ? 'reconciliation' : 'error',reason:errorCode(error)})
      throw error
    } finally { requests.delete(request); signal?.removeEventListener('abort',cancel) }
  }
  const validateCopy = (value: Snapshot, context: Context) => {
    check(context)
    if (value.connectionId !== context.scope.connectionId || value.environment !== context.scope.environment) fail('COPY_BINDING_MISMATCH')
    const old = revisions.get(value.subscriptionId)
    if (old && (value.revision < old.revision || Object.entries(copyBinding(old)).some(([key,val])=>value[key as keyof Snapshot] !== val))) fail('STALE_RESPONSE')
    revisions.set(value.subscriptionId,value)
    return value
  }
  const commitCopy = (value: Snapshot, context: Context) => { validateCopy(value,context);emit({phase:'ready',reason:null,selectedCopy:value});return value }
  const approved = async (versionId: string, policyHash: string, context: Context) => {
    const response = await client.getVersion(versionId,{signal:context.signal}); check(context)
    if (response.data.status !== 'approved') fail('STRATEGY_NOT_APPROVED')
    if (response.data.policyHash !== policyHash || response.data.policy.environment !== context.scope.environment) fail('SOURCE_BINDING_MISMATCH')
    return response.data
  }
  const selectSource = (selection: SourceSelection, signal?: AbortSignal) => {
    epoch++; for(const request of requests)request.abort(); requests.clear();sourceBinding=null
    emit({phase:'loading',reason:null,selectedVersion:null})
    return run(async context=>{
      if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(selection.sourceSha) || !selection.sourceId.trim()) fail('SOURCE_BINDING_UNAVAILABLE')
      const binding = await ports.readIssuedBinding?.(context.scope,Object.freeze({...selection}),context.signal);check(context)
      if (!binding) fail('SOURCE_BINDING_UNAVAILABLE')
      if (binding.sourceSha !== selection.sourceSha || binding.sourceId !== selection.sourceId || binding.environment !== context.scope.environment) fail('SOURCE_BINDING_MISMATCH')
      const value=await approved(binding.versionId,binding.policyHash,context)
      if(value.strategyId!==binding.strategyId)fail('SOURCE_BINDING_MISMATCH')
      sourceBinding=Object.freeze({...binding});emit({phase:'ready',reason:null,selectedVersion:value});return value
    },signal)
  }
  const loadLists = (signal?: AbortSignal) => run(async context=>{
    emit({phase:'loading',reason:null})
    const versions: Wire.DeepReadonly<Wire.VersionSummary>[]=[],copies: Wire.DeepReadonly<Wire.CopySummary>[]=[]
    for(const kind of ['versions','copies'] as const){
      let cursor:string|undefined
      const seen=new Set<string>(),ids=new Set<string>()
      for(let page=0;;page++){
        if(page>=50)fail('PAGINATION_BOUND_EXCEEDED')
        const response=kind==='versions'?await client.listVersions({limit:20,...(cursor===undefined?{}:{cursor}),signal:context.signal}):await client.listCopies({limit:20,...(cursor===undefined?{}:{cursor}),signal:context.signal});check(context)
        for(const item of response.data){
          if(item.environment!==context.scope.environment)fail('LIST_BINDING_MISMATCH')
          const id='versionId' in item && !('subscriptionId' in item)?item.versionId:(item as Wire.CopySummary).subscriptionId
          if(ids.has(id))fail('PAGINATION_BINDING_MISMATCH');ids.add(id)
          if(kind==='versions')versions.push(item as Wire.DeepReadonly<Wire.VersionSummary>)
          else copies.push(item as Wire.DeepReadonly<Wire.CopySummary>)
        }
        if(versions.length+copies.length>1000)fail('PAGINATION_BOUND_EXCEEDED')
        if(response.nextCursor===null)break
        if(!response.data.length||seen.has(response.nextCursor))fail('PAGINATION_BINDING_MISMATCH')
        seen.add(response.nextCursor);cursor=response.nextCursor
      }
    }
    check(context);emit({phase:'ready',reason:null,versions:Object.freeze(versions),copies:Object.freeze(copies)})
  },signal)
  const readCopy=(id:string,signal?:AbortSignal)=>run(async context=>commitCopy((await client.getCopy(id,{signal:context.signal})).data,context),signal)
  const intentFor=(id:string,fingerprint:string,binding:CopyBinding,operation:'create'|Action):Intent=>{
    if(!/^[A-Za-z0-9_-]{16,128}$/.test(id))return fail('INVALID_INTENT')
    const existing=intents.get(id)
    if(existing){if(existing.fingerprint!==fingerprint)fail('IDEMPOTENCY_CONFLICT');return existing}
    // Settled caches never block emergency controls; uncertain outcomes remain retained.
    for(const [key,intent]of intents){if(intents.size<32)break;if(!intent.uncertain)intents.delete(key)}
    if(intents.size>=32&&['create','start'].includes(operation))return fail('ORDER_RECONCILIATION_REQUIRED')
    // Stable caller intent IDs preserve the server key after cache eviction.
    const key=id
    const intent={fingerprint,key,binding:Object.freeze({...binding}),uncertain:false};intents.set(id,intent);return intent
  }
  const mutate=async(operation:'create'|Action,id:string|undefined,input:Wire.CreateCopyRequest|Wire.UpdateCopyRequest|Wire.StartCopyRequest|Wire.StopCopyRequest,intentId:string,signal?:AbortSignal):Promise<Snapshot>=>{
    if(busy)return fail('MUTATION_BUSY')
    // Lost creates cannot authorize another create/start; known-subscription emergency
    // controls and update classification remain server-owned. Preserve unknown intents.
    if(['create','start'].includes(operation) && [...intents.entries()].some(([key,intent])=>key!==intentId&&intent.uncertain))return fail('ORDER_RECONCILIATION_REQUIRED')
    const ticket=Symbol();activeMutation=ticket;busy=true;emit({mutationBusy:true})
    try{return await run(async context=>{
      const fingerprint=JSON.stringify([scopeKey(context.scope),operation,id??null,input])
      let intent=intents.get(intentId)
      if(intent && intent.fingerprint!==fingerprint)fail('IDEMPOTENCY_CONFLICT')
      if(intent?.result){check(context);return intent.result}
      let binding:CopyBinding
      if(operation==='create'){
        const request=input as Wire.CreateCopyRequest
        if(!sourceBinding || sourceBinding.versionId!==request.versionId || sourceBinding.environment!==request.environment || request.connectionId!==context.scope.connectionId)fail('SOURCE_BINDING_UNAVAILABLE')
        const version=await approved(sourceBinding.versionId,sourceBinding.policyHash,context)
        if(version.strategyId!==sourceBinding.strategyId)fail('SOURCE_BINDING_MISMATCH')
        binding={connectionId:request.connectionId,versionId:request.versionId,policyHash:sourceBinding.policyHash,environment:request.environment,startMode:request.startMode}
      }else{
        if(intent){binding=intent.binding}
        else{
          // Same-scope validated facts identify a known copy even when its projection
          // expires. The server owns durable pause/stop permission and current state.
          const known=['pause','stop'].includes(operation)?revisions.get(id!):undefined
          const current=validateCopy(known??(await client.getCopy(id!,{signal:context.signal})).data,context)
          if(!['pause','stop'].includes(operation)&&current.revision!==(input as Wire.StartCopyRequest).expectedRevision)fail('REVISION_CONFLICT')
          if(operation==='start' && current.startMode==='current_position' && !current.currentPositionAvailable)fail('CURRENT_POSITION_UNAVAILABLE')
          if(!known){
            const capability=current.execution.availability[operation]
            if(!capability.available)fail(capability.reason??'EXECUTION_UNAVAILABLE')
          }
          binding=copyBinding(current)
        }
        // Update risk classification belongs to the server; revoked policies may still reduce risk.
        if(operation==='start')await approved(binding.versionId,binding.policyHash,context)
      }
      check(context)
      intent=intent??intentFor(intentId,fingerprint,binding,operation)
      const csrfToken=await ports.csrf(context.scope,context.signal);check(context)
      const options={csrfToken,idempotencyKey:intent.key,signal:context.signal,expectedBinding:intent.binding}
      let response: Wire.DeepReadonly<Wire.CopyResponse>
      try{
        intent.uncertain=true
        if(operation==='create')response=await client.createCopy(input as Wire.CreateCopyRequest,options)
        else if(operation==='update')response=await client.updateCopy(id!,input as Wire.UpdateCopyRequest,options)
        else if(operation==='start')response=await client.startCopy(id!,input as Wire.StartCopyRequest,options)
        else if(operation==='pause')response=await client.pauseCopy(id!,input as Wire.PauseCopyRequest,options)
        else if(operation==='stop')response=await client.stopCopy(id!,input as Wire.StopCopyRequest,options)
        else response=await client.closeCopy(id!,input as Wire.CloseCopyRequest,options)
        check(context);commitCopy(response.data,context);intent.result=response.data;intent.uncertain=false;return response.data
      }catch(error){
        // A transport failure/cancellation cannot establish whether the server committed.
        if(error instanceof ApiV18Error && ['TRANSPORT_FAILED','ABORTED','INVALID_RESPONSE'].includes(error.code)||error instanceof CopyControllerError && ['ABORTED','SCOPE_CHANGED'].includes(error.code))intent.uncertain=true
        if(error instanceof ApiV18Error && !['TRANSPORT_FAILED','ABORTED','INVALID_RESPONSE'].includes(error.code))intent.uncertain=false
        if(intent.uncertain && context.epoch===epoch)emit({phase:'reconciliation',reason:'ORDER_RECONCILIATION_REQUIRED'})
        throw error
      }
    },signal)}finally{if(activeMutation===ticket){activeMutation=null;busy=false;emit({mutationBusy:false,...([...intents.values()].some(intent=>intent.uncertain)?{phase:'reconciliation' as const,reason:'ORDER_RECONCILIATION_REQUIRED'}:{})})}}
  }
  return {
    bind,getSnapshot:()=>state,subscribe(listener:()=>void){listeners.add(listener);return()=>listeners.delete(listener)},
    selectSource,loadLists,readCopy,
    create(settings:Settings,intentId:string,signal?:AbortSignal){
      if(!scope||!sourceBinding)return Promise.reject(new CopyControllerError('SOURCE_BINDING_UNAVAILABLE'))
      const input:Wire.CreateCopyRequest={apiContractVersion:'0.18.0',connectionId:scope.connectionId,environment:scope.environment,versionId:sourceBinding.versionId,
        allocationUsdt:settings.allocationUsdt,maxLossUsdt:settings.maxLossUsdt,maxPositionFraction:settings.maxPositionFraction,startMode:settings.startMode}
      return mutate('create',undefined,input,intentId,signal)
    },
    update(id:string,expectedRevision:number,settings:Omit<Settings,'startMode'>,intentId:string,signal?:AbortSignal){
      return mutate('update',id,{apiContractVersion:'0.18.0',expectedRevision,allocationUsdt:settings.allocationUsdt,maxLossUsdt:settings.maxLossUsdt,maxPositionFraction:settings.maxPositionFraction},intentId,signal)
    },
    action(operation:Exclude<Action,'update'>,id:string,expectedRevision:number,intentId:string,signal?:AbortSignal){return mutate(operation,id,{apiContractVersion:'0.18.0',expectedRevision},intentId,signal)},
    dispose(){if(disposed)return;epoch++;for(const request of requests)request.abort();requests.clear();intents.clear();revisions.clear();scope=null;sourceBinding=null;busy=false;state=initial();disposed=true;listeners.clear()},
  }
}
