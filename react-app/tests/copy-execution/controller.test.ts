import test from 'node:test'
import assert from 'node:assert/strict'
import {CopyControllerError} from '../../src/copy-execution/controller.js'
import {source,scope,settings,copy,version,issued,wire,harness,deferred,sample} from './fixture.js'
import type * as Wire from '../../src/copy-execution/fixtures/api-v0.18/types.js'
const intent='intent_fixture_0000001'
const code=(expected:string)=>(error:unknown)=>error instanceof Error&&'code' in error&&error.code===expected

test('f1/eval selection without server-issued binding is unavailable and never requests SDK/create',async()=>{
 const h=harness(undefined,{readIssuedBinding:undefined})
 for(const sourceId of ['f1','eval-real-policy']){
  await assert.rejects(h.controller.selectSource({...source,sourceId}),code('SOURCE_BINDING_UNAVAILABLE'))
  await assert.rejects(h.controller.create(settings,intent),code('SOURCE_BINDING_UNAVAILABLE'))
 }
 assert.equal(h.calls.length,0);assert.equal(h.controller.getSnapshot().selectedVersion,null)
})
test('source binding must preserve source, strategy, policy hash and environment',async()=>{
 for(const change of [{sourceId:'f2'},{sourceSha:'b'.repeat(64)},{environment:'production' as const},{strategyId:'other_strategy_00000001'},{policyHash:'b'.repeat(64)}]){
  const h=harness(undefined,{readIssuedBinding:async()=>({...issued(),...change})})
  await assert.rejects(h.controller.selectSource(source),code('SOURCE_BINDING_MISMATCH'))
  assert.equal(h.controller.getSnapshot().selectedVersion,null)
 }
})
test('exact SDK policy hash verification rejects tampered approved policy',async()=>{
 const bad=version();bad.data.policy.rules.push('invented')
 const h=harness(async()=>wire(bad))
 await assert.rejects(h.controller.selectSource(source),code('INVALID_RESPONSE'))
})
test('revoked issued version cannot enable create',async()=>{
 const revoked=version();revoked.data.status='revoked';const h=harness(async()=>wire(revoked))
 await assert.rejects(h.controller.selectSource(source),code('STRATEGY_NOT_APPROVED'))
 assert.equal(h.controller.getSnapshot().selectedVersion,null)
})
test('unconnected DTO stays frozen with absent money and actual verification false',async()=>{
 const h=harness();await h.controller.selectSource(source);const got=await h.controller.create(settings,intent)
 assert.equal(got.execution.actualExecutionVerified,false);assert.equal(got.execution.accounting.totalPnlUsdt,null)
 assert.equal(got.execution.accounting.realizedPnlUsdt,null);assert.equal(got.state,'CREATED');assert.equal(Object.isFrozen(got.execution.accounting),true)
 assert.equal(h.controller.getSnapshot().selectedCopy,got)
 const request=h.calls.find(item=>item.method==='POST')!;assert.equal(request.credentials,'include');assert.equal(request.redirect,'manual');assert.equal(request.cache,'no-store')
 assert.deepEqual(JSON.parse(request.body!),{apiContractVersion:'0.18.0',connectionId:scope.connectionId,environment:'demo',versionId:version().data.versionId,...settings})
})
test('same intent succeeds once and changed settings cannot reuse its key',async()=>{
 const h=harness();await h.controller.selectSource(source);const one=await h.controller.create(settings,intent)
 assert.equal(await h.controller.create(settings,intent),one)
 await assert.rejects(h.controller.create({...settings,allocationUsdt:'500'},intent),code('IDEMPOTENCY_CONFLICT'))
 assert.equal(h.calls.filter(item=>item.method==='POST').length,1)
})
test('lost create response requires explicit same-intent retry with exact SDK bytes/key and no auto retry',async()=>{
 let posts=0;const h=harness(async input=>{
  if(input.method==='GET')return wire(version())
  if(++posts===1)throw new Error('private transport detail')
  return wire(copy(),201)
 })
 await h.controller.selectSource(source);await assert.rejects(h.controller.create(settings,intent),code('TRANSPORT_FAILED'))
 assert.equal(posts,1);assert.equal(h.controller.getSnapshot().phase,'reconciliation');assert.equal(h.controller.getSnapshot().selectedCopy,null)
 await h.controller.create(settings,intent)
 const requests=h.calls.filter(item=>item.method==='POST');assert.equal(requests[0].body,requests[1].body);assert.equal(requests[0].headers['Idempotency-Key'],requests[1].headers['Idempotency-Key'])
})
test('uncertain create blocks a new intent/key until original request is resolved',async()=>{
 const h=harness(async input=>{if(input.method==='GET')return wire(version());throw Error('lost')})
 await h.controller.selectSource(source);await assert.rejects(h.controller.create(settings,intent))
 await assert.rejects(h.controller.create(settings,'intent_fixture_0000002'),code('ORDER_RECONCILIATION_REQUIRED'))
 assert.equal(h.calls.filter(item=>item.method==='POST').length,1)
})
test('aborted mutation never accepts a late commit into selected presentation',async()=>{
 const wait=deferred<ReturnType<typeof wire>>();const h=harness(async input=>input.method==='POST'?wait.promise:wire(version()))
 await h.controller.selectSource(source);const abort=new AbortController();const request=h.controller.create(settings,intent,abort.signal)
 await new Promise(r=>setImmediate(r));abort.abort();wait.resolve(wire(copy(),201));await assert.rejects(request,code('ABORTED'))
 assert.equal(h.controller.getSnapshot().selectedCopy,null)
 assert.equal(h.controller.getSnapshot().phase,'reconciliation')
})
test('owner/session/environment replacement discards old response and cannot unlock another pending owner mutation',async()=>{
 for(const change of [{owner:'owner-two'},{sessionId:'session-two'},{environment:'production' as const}]){
  const wait=deferred<ReturnType<typeof wire>>();const h=harness(async()=>wait.promise);const request=h.controller.selectSource(source)
  await new Promise(r=>setImmediate(r));h.setScope({...scope,...change});wait.resolve(wire(version()));await assert.rejects(request,code('ABORTED'))
  assert.equal(h.controller.getSnapshot().selectedVersion,null);assert.equal(h.controller.getSnapshot().selectedCopy,null)
 }
})
test('scope drift between CSRF await and dispatch prevents mutation and clears old facts',async()=>{
 const token=deferred<string>();const h=harness(undefined,{csrf:()=>token.promise});await h.controller.selectSource(source)
 const request=h.controller.create(settings,intent);await new Promise(r=>setImmediate(r));h.drift({...scope,sessionId:'new-session'});token.resolve('csrf_fixture_0000000001')
 await assert.rejects(request,code('SCOPE_CHANGED'));assert.equal(h.calls.filter(item=>item.method==='POST').length,0);assert.equal(h.controller.getSnapshot().selectedVersion,null)
})
test('selecting another source while a pending create cancels late response and releases busy state',async()=>{
 const wait=deferred<ReturnType<typeof wire>>();const h=harness(async input=>input.method==='POST'?wait.promise:wire(version()))
 await h.controller.selectSource(source);const request=h.controller.create(settings,intent);await new Promise(r=>setImmediate(r))
 await h.controller.selectSource(source);wait.resolve(wire(copy(),201));await assert.rejects(request,code('ABORTED'))
 assert.equal(h.controller.getSnapshot().mutationBusy,false);assert.equal(h.controller.getSnapshot().selectedCopy,null)
})
test('revision conflicts and unavailable capability never send mutation',async()=>{
 for(const rev of [1,0]){
  const h=harness();await h.controller.readCopy(copy().data.subscriptionId)
  await assert.rejects(h.controller.action('start',copy().data.subscriptionId,rev,intent),code(rev?'REVISION_CONFLICT':'RUNTIME_UNAVAILABLE'))
  assert.equal(h.calls.filter(item=>item.method==='POST').length,0)
 }
})
test('latest revision and expected immutable binding reach start/update/pause/stop/close SDK',async()=>{
 for(const operation of ['start','update','pause','stop','close'] as const){
  const current=copy();current.data.execution.origin='synthetic';for(const capability of Object.values(current.data.execution.availability)){capability.available=true;capability.reason=null}
  const next=structuredClone(current);next.data.revision=1;next.data.state=operation==='start'||operation==='update'?'ACTIVE':operation==='pause'?'PAUSED':'STOPPED';if(operation==='close')next.data.closeStatus='PENDING'
  const h=harness(async input=>input.path.includes('copy-strategy-versions')?wire(version()):wire(input.method==='GET'?current:next))
  if(operation==='update')await h.controller.update(current.data.subscriptionId,0,settings,intent)
  else await h.controller.action(operation,current.data.subscriptionId,0,intent)
  assert.equal(h.controller.getSnapshot().selectedCopy!.revision,1)
  const request=h.calls.find(item=>item.method!=='GET')!;assert.equal(JSON.parse(request.body!).expectedRevision,0)
 }
})
test('current-position start remains unavailable and never silently becomes next_signal',async()=>{
 const value=sample<Wire.CopyResponse>('current-position-pending')
 const h=harness(async()=>wire(value));await assert.rejects(h.controller.action('start',value.data.subscriptionId,0,intent),code('CURRENT_POSITION_UNAVAILABLE'))
 assert.equal(h.calls.filter(item=>item.method==='POST').length,0)
})
test('wrong account/connection/env response cannot become selected copy',async()=>{
 for(const change of [{connectionId:'connection_foreign_00001'},{environment:'production' as const}]){
  const value=copy();Object.assign(value.data,change);const h=harness(async()=>wire(value))
  await assert.rejects(h.controller.readCopy(value.data.subscriptionId),code('COPY_BINDING_MISMATCH'))
  assert.equal(h.controller.getSnapshot().selectedCopy,null)
 }
})
test('lower-revision late response never overwrites a newer copy',async()=>{
 const wait=deferred<ReturnType<typeof wire>>();let reads=0
 const high=copy();high.data.revision=3
 const h=harness(async()=>++reads===1?wait.promise:wire(high));const old=h.controller.readCopy(high.data.subscriptionId);await new Promise(r=>setImmediate(r));await h.controller.readCopy(high.data.subscriptionId)
 wait.resolve(wire(copy()));await assert.rejects(old,code('STALE_RESPONSE'));assert.equal(h.controller.getSnapshot().selectedCopy!.revision,3)
})
for(const status of [401,404,503])test(`actual ${status} remains an SDK failure with no empty-list/mock success`,async()=>{
 const h=harness(async()=>wire({apiContractVersion:'0.18.0',error:{code:status===401?'AUTHENTICATION_REQUIRED':status===404?'NOT_FOUND':'EXECUTION_UNAVAILABLE',message:status===401?'AUTHENTICATION_REQUIRED':status===404?'NOT_FOUND':'EXECUTION_UNAVAILABLE'}},status))
 await assert.rejects(h.controller.loadLists(),code(status===401?'AUTHENTICATION_REQUIRED':status===404?'NOT_FOUND':'EXECUTION_UNAVAILABLE'));assert.equal(h.controller.getSnapshot().phase,'error');assert.equal(h.controller.getSnapshot().selectedCopy,null)
})
test('pagination preserves exact cursor/limit and commits only complete validated union',async()=>{
 const first=sample<Wire.VersionListResponse>('version-list'),second=structuredClone(first),copies=sample<Wire.CopyListResponse>('copy-list');second.data[0].versionId='version_second_00000001';first.nextCursor='cursor_fixture_00000001';second.nextCursor=null
 const h=harness(async input=>wire(input.path.includes('strategy-copies')?copies:input.path.includes('cursor=')?second:first))
 await h.controller.loadLists();assert.equal(h.controller.getSnapshot().versions.length,2);assert.equal(h.controller.getSnapshot().copies.length,1)
 assert.ok(h.calls[1].path.includes('limit=20&cursor=cursor_fixture_00000001'))
})
test('cursor expiry after first page fails without committing partial rows or restarting a snapshot',async()=>{
 const first=sample<Wire.VersionListResponse>('version-list');first.nextCursor='cursor_fixture_00000001'
 const h=harness(async input=>input.path.includes('cursor=')?wire({apiContractVersion:'0.18.0',error:{code:'BAD_REQUEST',message:'BAD_REQUEST'}},400):wire(first))
 await assert.rejects(h.controller.loadLists(),code('BAD_REQUEST'));assert.equal(h.controller.getSnapshot().versions.length,0);assert.equal(h.calls.length,2)
})
test('duplicate IDs/looping cursor reject pagination instead of truncating into success',async()=>{
 const first=sample<Wire.VersionListResponse>('version-list');first.nextCursor='cursor_fixture_00000001'
 const h=harness(async()=>wire(first));await assert.rejects(h.controller.loadLists());assert.equal(h.controller.getSnapshot().versions.length,0)
})
test('dispose aborts in-flight reads and retires all supplied facts',async()=>{
 const wait=deferred<ReturnType<typeof wire>>();const h=harness(async()=>wait.promise);const request=h.controller.selectSource(source);await new Promise(r=>setImmediate(r));h.controller.dispose();wait.resolve(wire(version()))
 await assert.rejects(request,code('ABORTED'));assert.equal(h.controller.getSnapshot().selectedVersion,null);await assert.rejects(h.controller.readCopy(copy().data.subscriptionId))
})
test('revoked version still permits server-authorized risk-reducing update without local approval gate',async()=>{
 const current=copy();current.data.execution.origin='synthetic';current.data.execution.availability.update={available:true,reason:null}
 const reduced=structuredClone(current);reduced.data.revision=1;reduced.data.allocationUsdt='500';reduced.data.maxLossUsdt='10';reduced.data.maxPositionFraction='0.25'
 const revoked=version();revoked.data.status='revoked'
 const h=harness(async input=>input.path.includes('copy-strategy-versions')?wire(revoked):wire(input.method==='GET'?current:reduced))
 await h.controller.update(current.data.subscriptionId,0,{allocationUsdt:'500',maxLossUsdt:'10',maxPositionFraction:'0.25'},intent)
 assert.equal(h.controller.getSnapshot().selectedCopy!.allocationUsdt,'500')
 assert.equal(h.calls.filter(item=>item.path.includes('copy-strategy-versions')).length,0)
})
test('lost create keeps its unknown intent while known subscriptions still permit emergency pause/stop/close/update',async()=>{
 for(const operation of ['pause','stop','close','update'] as const){
  const current=copy();current.data.execution.origin='synthetic';for(const cap of Object.values(current.data.execution.availability)){cap.available=true;cap.reason=null}
  const next=structuredClone(current);next.data.revision=1;next.data.state=operation==='pause'?'PAUSED':operation==='update'?'CREATED':'STOPPED';if(operation==='close')next.data.closeStatus='PENDING'
  const h=harness(async input=>{
   if(input.path.includes('copy-strategy-versions'))return wire(version())
   if(input.path==='/api/v1/strategy-copies' && input.method==='POST')throw Error('lost create')
   return wire(input.method==='GET'?current:next)
  })
  await h.controller.selectSource(source);await assert.rejects(h.controller.create(settings,intent))
  if(operation==='update')await h.controller.update(current.data.subscriptionId,0,settings,'emergency_intent_00001')
  else await h.controller.action(operation,current.data.subscriptionId,0,'emergency_intent_00001')
  await assert.rejects(h.controller.create(settings,'intent_fixture_0000002'),code('ORDER_RECONCILIATION_REQUIRED'))
  assert.equal(h.controller.getSnapshot().phase,'reconciliation')
 }
})
test('CE-CAP-01 33rd stop reaches server after 32 settled update intents',async()=>{
 const current=copy();current.data.execution.origin='synthetic';for(const cap of Object.values(current.data.execution.availability)){cap.available=true;cap.reason=null}
 const h=harness(async input=>{if(input.method==='GET')return wire(current);current.data.revision++;if(input.path.endsWith('/stop'))current.data.state='STOPPING';return wire(current)})
 for(let i=0;i<32;i++)await h.controller.update(current.data.subscriptionId,i,settings,`settled_intent_${String(i).padStart(4,'0')}`)
 await h.controller.action('stop',current.data.subscriptionId,32,'emergency_stop_000033')
 assert.equal(h.calls.filter(input=>input.path.endsWith('/stop')&&input.method==='POST').length,1)
 assert.equal(h.controller.getSnapshot().selectedCopy!.state,'STOPPING')
})
test('CE-CAP-02 32 unknown intents preserve all emergency controls and the first unknown key/body',async()=>{
 for(const operation of ['pause','stop','close','update']as const){
  const current=copy();current.data.execution.origin='synthetic';for(const cap of Object.values(current.data.execution.availability)){cap.available=true;cap.reason=null}
  const h=harness(async input=>{if(input.method==='GET')return wire(current);if(input.method==='PATCH'&&!input.headers['Idempotency-Key'].startsWith('emergency_full'))throw Error('lost response');const next=structuredClone(current);next.data.state=operation==='update'?'CREATED':operation==='stop'?'STOPPING':'PAUSED';next.data.revision=1;if(operation==='close')next.data.closeStatus='PENDING';return wire(next)})
  for(let i=0;i<32;i++)await assert.rejects(h.controller.update(current.data.subscriptionId,0,settings,`unknown_intent_${String(i).padStart(4,'0')}`))
  if(operation==='update')await h.controller.update(current.data.subscriptionId,0,settings,'emergency_full_update_0033')
  else await h.controller.action(operation,current.data.subscriptionId,0,`emergency_full_${operation}_0033`)
  assert.equal(h.calls.filter(input=>input.method!=='GET'&&input.headers['Idempotency-Key'].startsWith('emergency_full')).length,1)
  assert.equal(h.controller.getSnapshot().phase,'reconciliation')
  await assert.rejects(h.controller.action('start',current.data.subscriptionId,0,'new_start_intent_0001'),code('ORDER_RECONCILIATION_REQUIRED'))
  const patched=h.calls.filter(input=>input.method==='PATCH')[0];await assert.rejects(h.controller.update(current.data.subscriptionId,0,settings,'unknown_intent_0000'))
  const retried=h.calls.filter(input=>input.method==='PATCH').at(-1)!;assert.equal(retried.body,patched.body);assert.equal(retried.headers['Idempotency-Key'],patched.headers['Idempotency-Key'])
 }
})
test('CE-CAP-03 evicted settled pause replays exact same caller idempotency key and bytes',async()=>{
 const current=copy();current.data.execution.origin='synthetic';current.data.execution.availability.pause={available:true,reason:null}
 const stored=new Map<string,{body:string;response:Wire.CopyResponse}>()
 const h=harness(async input=>{if(input.method==='GET')return wire(current);const key=input.headers['Idempotency-Key'];const saved=stored.get(key);if(saved){assert.equal(input.body,saved.body);return wire(saved.response)}current.data.revision++;current.data.state='PAUSED';stored.set(key,{body:input.body!,response:structuredClone(current)});return wire(current)})
 for(let i=0;i<33;i++)await h.controller.action('pause',current.data.subscriptionId,i,`settled_pause_${String(i).padStart(4,'0')}`)
 await assert.rejects(h.controller.action('pause',current.data.subscriptionId,0,'settled_pause_0000'),code('STALE_RESPONSE'))
 const first=h.calls.filter(input=>input.method==='POST')[0],last=h.calls.filter(input=>input.method==='POST').at(-1)!
 assert.equal(first.body,last.body);assert.equal(first.headers['Idempotency-Key'],last.headers['Idempotency-Key']);assert.equal(last.headers['Idempotency-Key'],'settled_pause_0000')
})
test('CE-REV-01 stale displayed revision still permits server-owned pause/stop',async()=>{
 for(const action of ['pause','stop']as const){const current=copy();current.data.revision=5;current.data.execution.origin='synthetic';current.data.execution.availability[action]={available:true,reason:null}
  const next=structuredClone(current);next.data.revision=6;next.data.state=action==='pause'?'PAUSED':'STOPPING'
  const h=harness(async input=>wire(input.method==='GET'?current:next))
  await h.controller.action(action,current.data.subscriptionId,4,'stale_control_intent_00001')
  assert.equal(h.calls.filter(input=>input.method==='POST').length,1);assert.equal(JSON.parse(h.calls.find(input=>input.method==='POST')!.body!).expectedRevision,4)
 }
})
test('CE-SOURCE-40 original Git SHA40 is consumed exactly while malformed fingerprints remain unavailable',async()=>{
 const original={sourceId:'f1',sourceSha:'412fd6042e0b3935773831f43163a7da68191162'}
 const h=harness(undefined,{readIssuedBinding:async()=>({...issued(),...original})});await h.controller.selectSource(original)
 assert.equal(h.controller.getSnapshot().selectedVersion!.versionId,issued().versionId)
 for(const sourceSha of ['a'.repeat(39),'a'.repeat(41),'a'.repeat(63),'a'.repeat(65),'A'.repeat(40)])await assert.rejects(h.controller.selectSource({...original,sourceSha}),code('SOURCE_BINDING_UNAVAILABLE'))
})

test('CE-CAP-04 evicted intent with changed body retains the original key and server conflict',async()=>{
 const current=copy();current.data.execution.origin='synthetic';current.data.execution.availability.pause={available:true,reason:null}
 const stored=new Map<string,string>();const h=harness(async input=>{if(input.method==='GET')return wire(current);const key=input.headers['Idempotency-Key'];if(stored.has(key)&&stored.get(key)!==input.body)return wire({apiContractVersion:'0.18.0',error:{code:'IDEMPOTENCY_CONFLICT',message:'IDEMPOTENCY_CONFLICT'}},409);stored.set(key,input.body!);current.data.revision++;current.data.state='PAUSED';return wire(current)})
 for(let i=0;i<33;i++)await h.controller.action('pause',current.data.subscriptionId,i,`settled_pause_${String(i).padStart(4,'0')}`)
 await assert.rejects(h.controller.action('pause',current.data.subscriptionId,99,'settled_pause_0000'),code('IDEMPOTENCY_CONFLICT'))
 assert.equal(h.calls.at(-1)!.headers['Idempotency-Key'],'settled_pause_0000');assert.equal(JSON.parse(h.calls.at(-1)!.body!).expectedRevision,99)
})

const projectionUnavailable=()=>wire({apiContractVersion:'0.18.0',error:{code:'EXECUTION_UNAVAILABLE',message:'EXECUTION_UNAVAILABLE'}},503)
test('CE-READ-01 verified known copy pause/stop remains independent of unavailable projection GET',async()=>{
 for(const action of ['pause','stop']as const){
  const current=copy(),next=structuredClone(current);next.data.revision=1;next.data.state=action==='pause'?'PAUSED':'STOPPING'
  let unavailable=false
  const h=harness(async input=>input.method==='GET'?(unavailable?projectionUnavailable():wire(current)):wire(next))
  await h.controller.readCopy(current.data.subscriptionId);unavailable=true
  await assert.rejects(h.controller.readCopy(current.data.subscriptionId),code('EXECUTION_UNAVAILABLE'))
  const before=h.calls.length
  await h.controller.action(action,current.data.subscriptionId,0,`known_emergency_${action}_0001`)
  assert.equal(h.calls.length,before+1);assert.equal(h.calls.at(-1)!.method,'POST')
  assert.equal(h.calls.at(-1)!.path,`/api/v1/strategy-copies/${current.data.subscriptionId}/${action}`)
  assert.equal(h.controller.getSnapshot().selectedCopy!.state,next.data.state)
 }
})
test('CE-READ-02 unknown IDs still require successful projection read before pause/stop',async()=>{
 for(const action of ['pause','stop']as const){const h=harness(async()=>projectionUnavailable())
  await assert.rejects(h.controller.action(action,copy().data.subscriptionId,0,`unknown_emergency_${action}_0001`),code('EXECUTION_UNAVAILABLE'))
  assert.deepEqual(h.calls.map(input=>input.method),['GET'])
 }
})
test('CE-READ-03 cached emergency binding never survives owner/session/connection/environment/auth scope replacement',async()=>{
 for(const change of [{owner:'owner-two'},{sessionId:'session-two'},{connectionId:'connection_foreign_00001'},{environment:'production' as const},null]){
  let unavailable=false;const h=harness(async()=>unavailable?projectionUnavailable():wire(copy()))
  await h.controller.readCopy(copy().data.subscriptionId);unavailable=true
  h.setScope(change===null?null:{...scope,...change})
  await assert.rejects(h.controller.action('stop',copy().data.subscriptionId,0,'scope_emergency_stop_0001'),code(change===null?'AUTHENTICATION_REQUIRED':'EXECUTION_UNAVAILABLE'))
  assert.equal(h.calls.filter(input=>input.method==='POST').length,0)
 }
 for(const change of [{owner:'owner-two'},{connectionId:'connection_foreign_00001'},{environment:'production' as const}]){
  const h=harness();await h.controller.readCopy(copy().data.subscriptionId);h.drift({...scope,...change})
  await assert.rejects(h.controller.action('pause',copy().data.subscriptionId,0,'drift_emergency_pause_0001'),code('SCOPE_CHANGED'))
  assert.equal(h.calls.length,1)
 }
})
test('CE-READ-04 known close/start/update still require fresh projection GET',async()=>{
 for(const operation of ['close','start','update']as const){let unavailable=false;const h=harness(async()=>unavailable?projectionUnavailable():wire(copy()))
  await h.controller.readCopy(copy().data.subscriptionId);unavailable=true
  const request=operation==='update'?h.controller.update(copy().data.subscriptionId,0,settings,'read_required_update_0001'):h.controller.action(operation,copy().data.subscriptionId,0,`read_required_${operation}_0001`)
  await assert.rejects(request,code('EXECUTION_UNAVAILABLE'));assert.deepEqual(h.calls.map(input=>input.method),['GET','GET'])
 }
})
test('CE-READ-05 cached emergency keeps CSRF/session/abort and response binding checks',async()=>{
 const token=deferred<string>(),h=harness(undefined,{csrf:()=>token.promise});await h.controller.readCopy(copy().data.subscriptionId)
 const request=h.controller.action('stop',copy().data.subscriptionId,0,'csrf_drift_emergency_0001');await new Promise(r=>setImmediate(r))
 h.drift({...scope,sessionId:'session-two'});token.resolve('csrf_fixture_0000000001');await assert.rejects(request,code('SCOPE_CHANGED'))
 assert.equal(h.calls.filter(input=>input.method==='POST').length,0)
 const aborted=harness(),signal=new AbortController();await aborted.controller.readCopy(copy().data.subscriptionId);signal.abort()
 await assert.rejects(aborted.controller.action('pause',copy().data.subscriptionId,0,'aborted_emergency_00001',signal.signal),code('ABORTED'))
 assert.equal(aborted.calls.filter(input=>input.method==='POST').length,0)
 const unauthorized=harness(undefined,{csrf:async()=>{throw new CopyControllerError('AUTHENTICATION_REQUIRED')}});await unauthorized.controller.readCopy(copy().data.subscriptionId)
 await assert.rejects(unauthorized.controller.action('stop',copy().data.subscriptionId,0,'csrf_denied_emergency_001'),code('AUTHENTICATION_REQUIRED'))
 assert.equal(unauthorized.calls.filter(input=>input.method==='POST').length,0)
 const wrong=copy();wrong.data.connectionId='connection_foreign_00001';wrong.data.state='STOPPING';wrong.data.revision=1
 const binding=harness(async input=>wire(input.method==='GET'?copy():wrong));await binding.controller.readCopy(copy().data.subscriptionId)
 await assert.rejects(binding.controller.action('stop',copy().data.subscriptionId,0,'binding_emergency_00001'))
 assert.equal(binding.controller.getSnapshot().selectedCopy!.revision,0)
 assert.equal(binding.calls.filter(input=>input.method==='POST').length,1)
})
