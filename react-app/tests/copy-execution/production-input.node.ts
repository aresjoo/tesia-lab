import test,{after} from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {copyFileSync,existsSync,mkdirSync,mkdtempSync,readFileSync,rmSync,symlinkSync,writeFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {dirname,join,relative,resolve} from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {tmpdir} from 'node:os'
import type {CopyExecutionDeployment} from '../../src/copy-execution/use-copy-execution'
import type {CopySnapshot,CopySummary} from '../../src/copy-execution/fixtures/api-v0.18/types.js'

const project=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),temp=mkdtempSync(join(tmpdir(),'teth-copy-production-input-'))
const localNodeModules=join(project,'node_modules'),fallbackNodeModules=process.env.TETH_TEST_NODE_MODULES
const dependencyRoot=existsSync(localNodeModules)?localNodeModules:fallbackNodeModules&&existsSync(fallbackNodeModules)?resolve(fallbackNodeModules):null
if(!dependencyRoot)throw Error('TEST_NODE_MODULES_UNAVAILABLE')
const dependencyRequire=createRequire(join(dependencyRoot,'package.json')),ts=dependencyRequire('typescript') as typeof import('typescript')
writeFileSync(join(temp,'package.json'),'{"type":"module"}')
symlinkSync(dependencyRoot,join(temp,'node_modules'),'dir')
const hookStub=join(temp,'src/copy-execution/react-hook-stub.js')
mkdirSync(dirname(hookStub),{recursive:true})
writeFileSync(hookStub,`let active=null
const same=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((value,index)=>Object.is(value,b[index]))
const slot=()=>{if(!active)throw Error('HOOK_OUTSIDE_RENDER');return active.cursor++}
export const useRef=initial=>{const index=slot();return active.hooks[index]??=( {current:initial} )}
export const useState=initial=>{const owner=active,index=slot();if(!owner.hooks[index])owner.hooks[index]={value:typeof initial==='function'?initial():initial};return[owner.hooks[index].value,next=>{const value=typeof next==='function'?next(owner.hooks[index].value):next;if(!Object.is(value,owner.hooks[index].value)){owner.hooks[index].value=value;owner.schedule()}}]}
const effect=(create,deps,layout)=>{const owner=active,index=slot(),previous=owner.hooks[index];if(!previous||deps===undefined||!same(previous.deps,deps))(layout?owner.layouts:owner.effects).push({index,create,deps})}
export const useEffect=(create,deps)=>effect(create,deps,false)
export const useLayoutEffect=(create,deps)=>effect(create,deps,true)
export function __mount(render){const owner={hooks:[],cursor:0,layouts:[],effects:[],value:undefined,scheduled:false,schedule(){if(!owner.scheduled){owner.scheduled=true;queueMicrotask(run)}}};const apply=queue=>{for(const item of queue){owner.hooks[item.index]?.cleanup?.();const cleanup=item.create();owner.hooks[item.index]={deps:item.deps,cleanup:typeof cleanup==='function'?cleanup:undefined}}};function run(){owner.scheduled=false;owner.cursor=0;owner.layouts=[];owner.effects=[];active=owner;owner.value=render();active=null;apply(owner.layouts);apply(owner.effects)}run();return{value:()=>owner.value,async flush(predicate){for(let index=0;index<100;index++){await new Promise(resolve=>setImmediate(resolve));if(predicate())return}throw Error('HOOK_FLUSH_TIMEOUT')},unmount(){for(const value of owner.hooks)value?.cleanup?.()}}}
`)
const emitted=new Set<string>()
function emit(sourceFile:string):void{
 sourceFile=resolve(sourceFile);if(emitted.has(sourceFile))return;emitted.add(sourceFile)
 const extension=sourceFile.endsWith('.json')?'.json':'.ts',destination=join(temp,relative(project,sourceFile).replace(/\.tsx?$/,'.js'))
 mkdirSync(dirname(destination),{recursive:true})
 if(extension==='.json'){copyFileSync(sourceFile,destination);return}
 let source=readFileSync(sourceFile,'utf8')
 if(sourceFile.endsWith('/src/copy-execution/use-copy-execution.ts'))source=source.replace("from 'react'","from './react-hook-stub.js'").replace('import.meta.env.DEV','false')
 const specs=[...source.matchAll(/(?:from\s+|import\s*(?:\(\s*)?)["'](\.[^"']+)["']/g)].map(match=>match[1]!)
 for(const spec of new Set(specs)){
  let dependency=resolve(dirname(sourceFile),spec.endsWith('.js')?spec.slice(0,-3)+'.ts':spec)
  if(!existsSync(dependency))dependency=existsSync(dependency+'.ts')?dependency+'.ts':existsSync(dependency+'.tsx')?dependency+'.tsx':dependency
  if(existsSync(dependency)){emit(dependency);const outputSpec=spec.endsWith('.js')||spec.endsWith('.json')?spec:spec+'.js';source=source.replaceAll(`'${spec}'`,`'${outputSpec}'`).replaceAll(`"${spec}"`,`"${outputSpec}"`)}
 }
 const output=ts.transpileModule(source,{fileName:sourceFile,compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText
 writeFileSync(destination,output)
}
emit(join(project,'src/copy-execution/use-copy-execution.ts'))
const production=await import(pathToFileURL(join(temp,'src/copy-execution/use-copy-execution.js')).href)
const {api18CandidateFixture}=await import(pathToFileURL(join(temp,'src/copy-execution/candidate-fixture.js')).href)
const {TesiaBitgetCopyV18Client}=await import(pathToFileURL(join(temp,'src/copy-execution/fixtures/api-v0.18/client.js')).href)
const {bitgetAiPolicyHash}=await import(pathToFileURL(join(temp,'src/copy-execution/fixtures/api-v0.18/validator.js')).href)
const {TesiaExchangeConnectionsV12Client}=await import(pathToFileURL(join(temp,'src/internal-poc/contracts/generated/api-v0.12/client.js')).href)
const hookScheduler=await import(pathToFileURL(hookStub).href)
after(()=>rmSync(temp,{recursive:true,force:true}))

const version=JSON.parse(readFileSync(join(project,'tests/copy-execution/wire-cases.json'),'utf8')).cases.find((row:{name:string})=>row.name==='version').value
const binding={sourceSha:'412fd6042e0b3935773831f43163a7da68191162',sourceId:'f1',strategyId:version.data.strategyId,versionId:version.data.versionId,policyHash:version.data.policyHash,environment:'demo'}
const artifact=(patch:Record<string,unknown>={})=>JSON.stringify({schema:1,environment:'demo',bindings:[binding],...patch})
const pinned=(raw:string)=>createHash('sha256').update(raw).digest('hex')
const response=(url:string,raw:string,status=200)=>{const value=new Response(raw,{status,headers:{'content-type':'application/json'}});Object.defineProperty(value,'url',{value:url});return value}

test('고정 artifact는 기본 off·raw pin·닫힌 shape를 모두 통과해야 하며 DEV producer와 섞이지 않는다',async()=>{
 let calls=0;const origin='https://service.example.test',url=origin+'/assets/copy-execution-deployment.json',raw=artifact()
 const fetcher=(async(input:RequestInfo|URL,init?:RequestInit)=>{calls++;assert.equal(String(input),url);assert.deepEqual({method:init?.method,credentials:init?.credentials,cache:init?.cache,redirect:init?.redirect},{method:'GET',credentials:'same-origin',cache:'no-store',redirect:'error'});return response(url,raw)}) as typeof fetch
 assert.equal(await production.loadCopyExecutionDeployment('',{origin:()=>origin,fetch:fetcher}),undefined);assert.equal(calls,0)
 const service=await production.loadCopyExecutionDeployment(pinned(raw),{origin:()=>origin,fetch:fetcher})
 assert.equal(service.mode,'service');assert.equal(service.deployment.bindings[0].sourceId,'f1');assert.equal('fixture'in service,false);assert.equal('readIssuedBinding'in service,false)
 assert.equal(production.resolveCopyExecutionMode(service,false,{dev:false,hostname:'service.example.test'}),'off')
 assert.equal(production.resolveCopyExecutionMode(service,true,{dev:false,hostname:'service.example.test'}),'service')
 const developer={fixture:api18CandidateFixture,connectionId:'connection_fixture_00001',environment:'demo',readIssuedBinding:async()=>null}
 assert.equal(production.resolveCopyExecutionMode(developer,true,{dev:false,hostname:'service.example.test'}),'off')
 assert.equal(production.resolveCopyExecutionMode(developer,true,{dev:true,hostname:'localhost'}),'development')
 for(const invalid of [JSON.stringify({schema:1,environment:'demo',bindings:[binding,binding]}),JSON.stringify({schema:1,environment:'demo',bindings:[{...binding,extra:true}]}),artifact({environment:'production'}),raw.replace('{"schema":1','{"schema":1,"schema":1')]){
  const result=await production.loadCopyExecutionDeployment(pinned(invalid),{origin:()=>origin,fetch:(async()=>response(url,invalid)) as typeof fetch});assert.equal(result,undefined)
 }
 assert.equal(await production.loadCopyExecutionDeployment('A'.repeat(64),{origin:()=>origin,fetch:fetcher}),undefined);assert.equal(calls,1)
})

test('발행 binding과 실제 API18 승인 뒤 정책 시장의 exact-one 계좌만 결속하고 drift와 긴급 제어를 분리한다',async()=>{
 const deployment=production.parseCopyExecutionDeployment(artifact())
 const issued=production.issuedProductionBinding(deployment,{sourceSha:binding.sourceSha,sourceId:'f1'});assert.deepEqual(issued,binding)
 assert.equal(production.issuedProductionBinding(deployment,{sourceSha:binding.sourceSha,sourceId:'f2'}),null)
 const copyClient=new TesiaBitgetCopyV18Client({request:async()=>({status:200,headers:[['content-type','application/json'],['cache-control','no-store']],body:JSON.stringify(version)})})
 const approved=await production.readProductionIssuedVersion(copyClient,issued);assert.equal(approved.policy.market,'USDT-FUTURES')
 const account=(id:string,mask='***01')=>({connectedAt:'2026-10-12T00:00:00Z',connectionId:id,exchangeId:'bitget',maskedAccountLabel:mask,permissions:{futuresTrade:true,read:true,spotTrade:false,withdrawal:false},permissionsVerified:true,status:'connected'})
 const body={apiContractVersion:'0.12.0',data:{connections:[account('connection_fixture_00001')]}}
 const api12=new TesiaExchangeConnectionsV12Client({request:async()=>({status:200,headers:[['content-type','application/json'],['cache-control','no-store']],body:JSON.stringify(body)})})
 const connections=(await api12.connections()).data.connections,proof=production.captureProductionConnectionProof('owner-one','session-one','USDT-FUTURES',connections)
 assert.equal(proof.connectionId,'connection_fixture_00001');assert.equal(production.verifyProductionConnectionProof(proof,'owner-one','session-one',connections),true)
 assert.equal(production.captureProductionConnectionProof('owner-one','session-one','SPOT',connections),null)
 assert.equal(production.verifyProductionConnectionProof(proof,'owner-two','session-one',connections),false)
 assert.equal(production.verifyProductionConnectionProof(proof,'owner-one','session-two',connections),false)
 assert.equal(production.verifyProductionConnectionProof(proof,'owner-one','session-one',[account('connection_fixture_00001','***changed')]),false)
 const multiple=[...connections,account('connection_fixture_00002')]
 assert.equal(production.verifyProductionConnectionProof(proof,'owner-one','session-one',multiple),false)
 assert.equal(production.verifyProductionConnectionProof(proof,'owner-one','session-one',multiple,true),true)
})

test('reload existing copy restores exact server scope and pause stop without setup budget or global account uniqueness',{timeout:20_000},async()=>{
 const cases=JSON.parse(readFileSync(join(project,'tests/copy-execution/wire-cases.json'),'utf8')).cases
 const sample=(name:string)=>structuredClone(cases.find((row:{name:string})=>row.name===name).value)
 const versionResponse=sample('version'),versionList=sample('version-list'),copyList=sample('copy-list'),copyResponse=sample('copy-unconnected')
 versionList.data[0].status='revoked'
 const original='connection_fixture_00001',extra='connection_fixture_00002',origin='https://service.example.test',sessionId='session_fixture_000001'
 const connection=(connectionId:string)=>({connectedAt:'2026-10-12T00:00:00Z',connectionId,exchangeId:'bitget',maskedAccountLabel:connectionId===original?'***01':'***02',permissions:{futuresTrade:true,read:true,spotTrade:true,withdrawal:false},permissionsVerified:true,status:'connected'})
 const connections={apiContractVersion:'0.12.0',data:{connections:[connection(original),connection(extra)]}}
 let budgetCalls=0,connectionCalls=0,versionGets=0,copyGets=0,permissionsRevoked=false
 const json=(url:string,value:unknown,status=200)=>{const response=new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});Object.defineProperty(response,'url',{value:url});return response}
 const fetcher=(async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=new URL(String(input));if(url.pathname==='/api/v1/exchange-connections/'){connectionCalls++;const current=structuredClone(connections);if(permissionsRevoked){current.data.connections[0].status='disconnected';current.data.connections[0].permissions.futuresTrade=false;current.data.connections[0].permissions.spotTrade=false}return json(url.href,current)}
  if(url.pathname.endsWith('/account')){budgetCalls++;throw Error('BUDGET_MUST_NOT_RUN')}
  if(url.pathname==='/api/v1/copy-strategy-versions'&&url.search)return json(url.href,versionList)
  if(url.pathname===`/api/v1/copy-strategy-versions/${versionResponse.data.versionId}`){versionGets++;return json(url.href,versionResponse)}
  if(url.pathname==='/api/v1/strategy-copies'&&url.search)return json(url.href,copyList)
  if(url.pathname===`/api/v1/strategy-copies/${copyResponse.data.subscriptionId}`&&init?.method==='GET'){copyGets++;return json(url.href,copyResponse)}
  if(url.pathname.endsWith('/pause')){const paused=structuredClone(copyResponse);paused.data.revision=1;paused.data.state='PAUSED';return json(url.href,paused)}
  if(url.pathname.endsWith('/stop')){const stopped=structuredClone(copyResponse);stopped.data.revision=2;stopped.data.state='STOPPING';return json(url.href,stopped)}
  throw Error(`UNEXPECTED_FETCH:${init?.method}:${url.pathname}${url.search}`)
 }) as typeof fetch
 const previousWindow=Reflect.get(globalThis,'window'),previousFetch=globalThis.fetch
 Reflect.set(globalThis,'window',{location:{origin,hostname:'service.example.test'},fetch:fetcher,setTimeout,clearTimeout});Reflect.set(globalThis,'fetch',fetcher)
 const sessionPort={current:async()=>({body:{data:{sessionId,state:'AUTHENTICATED'}}}),csrf:async()=>({body:{data:{csrfToken:'csrf_fixture_0000000001'}}})}
 const deployment=production.parseCopyExecutionDeployment(JSON.stringify({schema:1,environment:'demo',bindings:[]}))
 const serviceInput={mode:'service',deployment},currentSession=()=>({sessionId,sessionState:'AUTHENTICATED'})
 const mounted=hookScheduler.__mount(()=>production.useCandidateCopyExecution(serviceInput,true,sessionPort,currentSession,sessionId))
 try{
  await mounted.flush(()=>mounted.value()?.controller.getSnapshot().copies.length===1)
  const port=mounted.value();assert.ok(port);assert.equal(port.controller.getSnapshot().copies[0].connectionId,original)
  assert.equal(copyGets,1);permissionsRevoked=true
  const paused=await port.controller.action('pause',copyResponse.data.subscriptionId,0,'restore_pause_intent_0001');assert.equal(paused.state,'PAUSED')
  const stopped=await port.controller.action('stop',copyResponse.data.subscriptionId,1,'restore_stop_intent_00001');assert.equal(stopped.state,'STOPPING')
  assert.deepEqual({budgetCalls,connectionCalls,versionGets,copyGets},{budgetCalls:0,connectionCalls:0,versionGets:0,copyGets:1})
 }finally{mounted.unmount();Reflect.set(globalThis,'fetch',previousFetch);if(previousWindow===undefined)Reflect.deleteProperty(globalThis,'window');else Reflect.set(globalThis,'window',previousWindow)}
})

const wireCases=JSON.parse(readFileSync(join(project,'tests/copy-execution/wire-cases.json'),'utf8')).cases
const wire=(name:string)=>structuredClone(wireCases.find((row:{name:string})=>row.name===name).value)
const jsonResponse=(url:string,value:unknown,status=200)=>{const result=new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});Object.defineProperty(result,'url',{value:url});return result}
const connected=(connectionId:string,eligible=true)=>({connectedAt:'2026-10-12T00:00:00Z',connectionId,exchangeId:'bitget',maskedAccountLabel:`***${connectionId.slice(-2)}`,permissions:{futuresTrade:eligible,read:true,spotTrade:eligible,withdrawal:false},permissionsVerified:true,status:eligible?'connected':'disconnected'})
const accountSnapshot=(connectionId:string)=>{
 const section=(status:string,items:unknown[]=[])=>({status,reason:status==='unavailable'?'PROVIDER_UNAVAILABLE':null,items}),balance={coin:'USDT',equity:null,balance:null,available:'1000.0000',frozen:null,locked:null,unrealizedPnl:null}
 return{apiContractVersion:'0.17.0',data:{connectionId,exchangeId:'bitget',accountMode:'classic',observedAt:new Date(Date.now()-1000).toISOString(),products:[
  {product:'spot',balances:section('ok',[balance]),positions:section('not_applicable')},{product:'USDT-FUTURES',balances:section('ok',[balance]),positions:section('ok')},
  {product:'USDC-FUTURES',balances:section('unavailable'),positions:section('unavailable')},{product:'COIN-FUTURES',balances:section('unavailable'),positions:section('unavailable')},
 ]}}
}
const copyVariant=(summary:CopySummary,snapshot:CopySnapshot,patch:{subscriptionId:string;connectionId:string;versionId?:string;policyHash?:string;state?:string;revision?:number})=>{
 const list=structuredClone(summary),detail=structuredClone(snapshot)
 for(const value of [list,detail])Object.assign(value,{subscriptionId:patch.subscriptionId,connectionId:patch.connectionId,...(patch.versionId?{versionId:patch.versionId}:{}),...(patch.policyHash?{policyHash:patch.policyHash}:{}),...(patch.state?{state:patch.state}:{}),...(patch.revision===undefined?{}:{revision:patch.revision})})
 return{list,detail}
}
const mountProduction=(deployment:CopyExecutionDeployment,fetcher:typeof fetch)=>{
 const origin='https://service.example.test',sessionId='session_fixture_000001',previousWindow=Reflect.get(globalThis,'window'),previousFetch=globalThis.fetch
 Reflect.set(globalThis,'window',{location:{origin,hostname:'service.example.test'},fetch:fetcher,setTimeout,clearTimeout});Reflect.set(globalThis,'fetch',fetcher)
 const sessionPort={current:async()=>({body:{data:{sessionId,state:'AUTHENTICATED'}}}),csrf:async()=>({body:{data:{csrfToken:'csrf_fixture_0000000001'}}})},serviceInput={mode:'service',deployment},currentSession=()=>({sessionId,sessionState:'AUTHENTICATED'})
 const mounted=hookScheduler.__mount(()=>production.useCandidateCopyExecution(serviceInput,true,sessionPort,currentSession,sessionId))
 return{mounted,restore(){mounted.unmount();Reflect.set(globalThis,'fetch',previousFetch);if(previousWindow===undefined)Reflect.deleteProperty(globalThis,'window');else Reflect.set(globalThis,'window',previousWindow)}}
}

test('approved minimum descriptor is deployment-bound and fresh required balance fences setup create and start',{timeout:20_000},async()=>{
 const minimumDescriptor={policyVersionId:'b'.repeat(64),descriptorPolicyHash:'c'.repeat(64)}
 const bound={...binding,minimumDescriptor},encodeBinding=(row:unknown)=>JSON.stringify({schema:1,environment:'demo',bindings:[row]})
 assert.deepEqual(production.parseCopyExecutionDeployment(artifact()).bindings[0],binding)
 assert.deepEqual(production.parseCopyExecutionDeployment(encodeBinding(bound)).bindings[0],bound)
 for(const descriptor of [null,{}, {...minimumDescriptor,extra:true},{...minimumDescriptor,policyVersionId:binding.versionId},{...minimumDescriptor,descriptorPolicyHash:'C'.repeat(64)}])
  assert.equal(production.parseCopyExecutionDeployment(encodeBinding({...binding,minimumDescriptor:descriptor})),null)
 type Scenario='success'|'absent'|'absent-override'|'override'|'override-id'|'hash'|'expired'|'confirm-expired'|'start-expired'|'setup-balance'|'confirm-balance'|'start-balance'|'loss'|'floor'
 for(const scenario of ['success','absent','absent-override','override','override-id','hash','expired','confirm-expired','start-expired','setup-balance','confirm-balance','start-balance','loss','floor'] as Scenario[]){
  const deployment=production.parseCopyExecutionDeployment(encodeBinding(scenario.startsWith('absent')?binding:bound))
  const detail=wire('copy-unconnected'),connectionId=detail.data.connectionId,subscriptionId=detail.data.subscriptionId
  let current:CopySnapshot|null=null,accounts=0,quotes=0;const posts:string[]=[]
  const fetcher=(async(input:RequestInfo|URL,init?:RequestInit)=>{
   const url=new URL(String(input),'https://service.example.test'),body=typeof init?.body==='string'?JSON.parse(init.body):undefined
   if(url.pathname==='/__teth/execution-minimum'){
    quotes++;assert.equal(init?.credentials,'omit');assert.equal(init?.method,'GET');assert.equal(url.search,'')
    const expired=scenario==='expired'||scenario==='confirm-expired'&&quotes>=2||scenario==='start-expired'&&quotes>=3
    const now=Date.now();return jsonResponse(url.href,{schemaVersion:'bitget-copy-minimum-0.1',venue:'bitget',symbol:'BTCUSDT',asOf:new Date(now-10).toISOString(),expiresAt:new Date(now+(expired?-1:2990)).toISOString(),snapshotRuleSha256:'d'.repeat(64),quoteSha256:'e'.repeat(64),estimates:{[minimumDescriptor.policyVersionId]:{descriptorPolicyHash:scenario==='hash'?'f'.repeat(64):minimumDescriptor.descriptorPolicyHash,status:'estimated',minimumAllocationUsdt:'100',requiredAvailableUsdt:'900',requiredMaxLossUsdt:'20',riskRequiredAvailableUsdt:'800'}}})
   }
   if(url.pathname==='/api/v1/strategy-copies'&&url.search)return jsonResponse(url.href,{apiContractVersion:'0.18.0',data:[],nextCursor:null})
   if(url.pathname==='/api/v1/copy-strategy-versions')return jsonResponse(url.href,wire('version-list'))
   if(url.pathname===`/api/v1/copy-strategy-versions/${binding.versionId}`)return jsonResponse(url.href,version)
   if(url.pathname==='/api/v1/exchange-connections/')return jsonResponse(url.href,{apiContractVersion:'0.12.0',data:{connections:[connected(connectionId)]}})
   if(url.pathname===`/api/v1/exchange-connections/${connectionId}/account`){
    accounts++;const value=accountSnapshot(connectionId),insufficient=scenario==='setup-balance'||scenario==='confirm-balance'&&accounts>=2||scenario==='start-balance'&&accounts>=3
    for(const product of value.data.products)for(const balance of product.balances.items as Array<{available:string}>)balance.available=insufficient?'800':'1000'
    return jsonResponse(url.href,value)
   }
   if(url.pathname===`/api/v1/strategy-copies/${subscriptionId}`&&init?.method==='GET'&&current)return jsonResponse(url.href,{apiContractVersion:'0.18.0',data:current})
   if(init?.method==='POST')posts.push(url.pathname)
   if(url.pathname==='/api/v1/strategy-copies'&&init?.method==='POST'){
    const value=structuredClone(detail);Object.assign(value.data,{versionId:binding.versionId,policyHash:binding.policyHash,allocationUsdt:body.allocationUsdt,maxLossUsdt:body.maxLossUsdt,maxPositionFraction:body.maxPositionFraction,startMode:body.startMode});value.data.execution.origin='synthetic';value.data.execution.availability.start={available:true,reason:null};current=value.data;return jsonResponse(url.href,value,201)
   }
   if(url.pathname===`/api/v1/strategy-copies/${subscriptionId}/start`&&current){current={...current,state:'ACTIVE',revision:1};return jsonResponse(url.href,{apiContractVersion:'0.18.0',data:current})}
   throw Error(`UNEXPECTED_FETCH:${init?.method}:${url.pathname}${url.search}`)
  }) as typeof fetch
  const mounted=mountProduction(deployment,fetcher)
  try{
   await mounted.mounted.flush(()=>Boolean(mounted.mounted.value()))
   const port=mounted.mounted.value(),signal=new AbortController().signal
   const supplied=scenario==='override'||scenario==='override-id'||scenario==='absent-override'?{sourceSha:binding.sourceSha,sourceId:'f1',minimumDescriptor:{...minimumDescriptor,...(scenario==='override'?{descriptorPolicyHash:'f'.repeat(64)}:scenario==='override-id'?{policyVersionId:'f'.repeat(64)}:{})}}:undefined
   const setup=await port.prepareSetup('f1',signal,supplied)
   if(['absent','absent-override','override','override-id','hash','expired','setup-balance'].includes(scenario)){assert.equal(setup,null,scenario);assert.deepEqual(posts,[],scenario);continue}
   assert.ok(setup,scenario);assert.equal(setup.minimumUsdt,'100')
   const settings={amount:scenario==='floor'?50:200,loss:scenario==='loss'?-5:-20,existing:'skip',cap:50}
   if(scenario==='success')await setup.onConfirm(settings,signal)
   else await assert.rejects(setup.onConfirm(settings,signal),/ACCOUNT_FACTS_UNAVAILABLE/,scenario)
   assert.deepEqual(posts,scenario==='success'?['/api/v1/strategy-copies',`/api/v1/strategy-copies/${subscriptionId}/start`]:scenario==='start-balance'||scenario==='start-expired'?['/api/v1/strategy-copies']:[],scenario)
   if(scenario==='success'){assert.equal(accounts,3);assert.equal(quotes,3)}
  }finally{mounted.restore()}
 }
})

test('OPUS P1-1 restored source enters known management before revoked setup gates',{timeout:20_000},async()=>{
 const list=wire('copy-list'),detail=wire('copy-unconnected'),revoked=wire('version');revoked.data.status='revoked'
 const connectionId=detail.data.connectionId,subscriptionId=detail.data.subscriptionId
 let api12=0,api17=0,versions=0
 const fetcher=(async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=new URL(String(input))
  if(url.pathname==='/api/v1/strategy-copies'&&url.search)return jsonResponse(url.href,list)
  if(url.pathname===`/api/v1/strategy-copies/${subscriptionId}`&&init?.method==='GET')return jsonResponse(url.href,detail)
  if(url.pathname.endsWith('/pause')){const value=structuredClone(detail);value.data.state='PAUSED';value.data.revision=1;return jsonResponse(url.href,value)}
  if(url.pathname==='/api/v1/exchange-connections/'){api12++;return jsonResponse(url.href,{apiContractVersion:'0.12.0',data:{connections:[connected(connectionId),connected('connection_fixture_00002')]}})}
  if(url.pathname.endsWith('/account')){api17++;throw Error('BUDGET_MUST_NOT_RUN')}
  if(url.pathname.startsWith('/api/v1/copy-strategy-versions/')){versions++;return jsonResponse(url.href,revoked)}
  throw Error(`UNEXPECTED_FETCH:${init?.method}:${url.pathname}${url.search}`)
 }) as typeof fetch
 const deployment=production.parseCopyExecutionDeployment(artifact()),mounted=mountProduction(deployment,fetcher)
 try{
  await mounted.mounted.flush(()=>mounted.mounted.value()?.controller.getSnapshot().copies.length===1)
  const port=mounted.mounted.value();assert.ok(port)
  const setup=await port.prepareSetup('f1',new AbortController().signal)
  assert.equal(setup,null);assert.equal(port.copyForSource('f1'),subscriptionId);assert.equal(port.sourceForCopy(subscriptionId),'f1')
  const paused=await port.controller.action('pause',subscriptionId,0,'opus_p1_restore_pause_01');assert.equal(paused.connectionId,connectionId)
  assert.deepEqual({api12,api17,versions},{api12:0,api17:0,versions:0})
 }finally{mounted.restore()}
})

test('OPUS P1-2 creating Y preserves X and routes both known bindings',{timeout:20_000},async()=>{
 const versionY=wire('version');versionY.data.versionId='version_fixture_000002';versionY.data.strategyId='strategy_fixture_00002';versionY.data.policy.spec='합성 계약의 두 번째 승인 정책';versionY.data.policyHash=bitgetAiPolicyHash(versionY.data.policy)
 const baseList=wire('copy-list'),baseDetail=wire('copy-unconnected'),xId=baseDetail.data.subscriptionId,xConnection=baseDetail.data.connectionId,yId='subscription_fixture_00002',yConnection='connection_fixture_00002'
 const bindingY={sourceSha:binding.sourceSha,sourceId:'f2',strategyId:versionY.data.strategyId,versionId:versionY.data.versionId,policyHash:versionY.data.policyHash,environment:'demo',minimumDescriptor:{policyVersionId:'b'.repeat(64),descriptorPolicyHash:'c'.repeat(64)}}
 const deployment=production.parseCopyExecutionDeployment(JSON.stringify({schema:1,environment:'demo',bindings:[binding,bindingY]})),posts:Array<{path:string;body:Record<string,unknown>}>=[]
 let api17=0,yCurrent:CopySnapshot|null=null
 const fetcher=(async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=new URL(String(input),'https://service.example.test'),body=typeof init?.body==='string'?JSON.parse(init.body):undefined
  if(url.pathname==='/__teth/execution-minimum'){
   const now=Date.now();return jsonResponse(url.href,{schemaVersion:'bitget-copy-minimum-0.1',venue:'bitget',symbol:'BTCUSDT',asOf:new Date(now-10).toISOString(),expiresAt:new Date(now+2990).toISOString(),snapshotRuleSha256:'d'.repeat(64),quoteSha256:'e'.repeat(64),estimates:{[bindingY.minimumDescriptor.policyVersionId]:{descriptorPolicyHash:bindingY.minimumDescriptor.descriptorPolicyHash,status:'estimated',minimumAllocationUsdt:'100',requiredAvailableUsdt:'900',requiredMaxLossUsdt:'20',riskRequiredAvailableUsdt:'800'}}})
  }
  if(url.pathname==='/api/v1/strategy-copies'&&url.search)return jsonResponse(url.href,baseList)
  if(url.pathname===`/api/v1/strategy-copies/${xId}`&&init?.method==='GET')return jsonResponse(url.href,baseDetail)
  if(url.pathname===`/api/v1/strategy-copies/${yId}`&&init?.method==='GET'&&yCurrent)return jsonResponse(url.href,{apiContractVersion:'0.18.0',data:yCurrent})
  if(url.pathname==='/api/v1/exchange-connections/')return jsonResponse(url.href,{apiContractVersion:'0.12.0',data:{connections:[connected(xConnection,false),connected(yConnection)]}})
  if(url.pathname===`/api/v1/exchange-connections/${yConnection}/account`){api17++;return jsonResponse(url.href,accountSnapshot(yConnection))}
  if(url.pathname===`/api/v1/copy-strategy-versions/${versionY.data.versionId}`)return jsonResponse(url.href,versionY)
  if(init?.method==='POST')posts.push({path:url.pathname,body})
  if(url.pathname==='/api/v1/strategy-copies'&&init?.method==='POST'){
   const value=structuredClone(baseDetail);Object.assign(value.data,{subscriptionId:yId,connectionId:yConnection,versionId:versionY.data.versionId,policyHash:versionY.data.policyHash,allocationUsdt:body.allocationUsdt,maxLossUsdt:body.maxLossUsdt,maxPositionFraction:body.maxPositionFraction,startMode:body.startMode});value.data.execution.origin='synthetic';value.data.execution.availability.start={available:true,reason:null};yCurrent=structuredClone(value.data);return jsonResponse(url.href,value,201)
  }
  if(url.pathname===`/api/v1/strategy-copies/${yId}/start`){const value=structuredClone(baseDetail);Object.assign(value.data,{subscriptionId:yId,connectionId:yConnection,versionId:versionY.data.versionId,policyHash:versionY.data.policyHash,state:'ACTIVE',revision:1,allocationUsdt:'200',maxLossUsdt:'40',maxPositionFraction:'0.5'});yCurrent=structuredClone(value.data);return jsonResponse(url.href,value)}
  if(url.pathname===`/api/v1/strategy-copies/${xId}/pause`){const value=structuredClone(baseDetail);Object.assign(value.data,{state:'PAUSED',revision:1});return jsonResponse(url.href,value)}
  if(url.pathname===`/api/v1/strategy-copies/${yId}/stop`){const value=structuredClone(baseDetail);Object.assign(value.data,{subscriptionId:yId,connectionId:yConnection,versionId:versionY.data.versionId,policyHash:versionY.data.policyHash,state:'STOPPING',revision:2,allocationUsdt:'200',maxLossUsdt:'40',maxPositionFraction:'0.5'});return jsonResponse(url.href,value)}
  throw Error(`UNEXPECTED_FETCH:${init?.method}:${url.pathname}${url.search}`)
 }) as typeof fetch
 const mounted=mountProduction(deployment,fetcher)
 try{
  await mounted.mounted.flush(()=>mounted.mounted.value()?.controller.getSnapshot().copies.length===1)
  const port=mounted.mounted.value();assert.ok(port)
  const setup=await port.prepareSetup('f2',new AbortController().signal);assert.ok(setup)
  await setup.onConfirm({amount:200,loss:-20,existing:'skip',cap:50},new AbortController().signal)
  assert.equal(port.copyForSource('f1'),xId);assert.equal(port.copyForSource('f2'),yId)
  const paused=await port.controller.action('pause',xId,0,'opus_p1_x_pause_0001'),stopped=await port.controller.action('stop',yId,1,'opus_p1_y_stop_00001')
  assert.equal(paused.connectionId,xConnection);assert.equal(stopped.connectionId,yConnection);assert.equal(api17,3)
  assert.deepEqual(posts.map(value=>value.path),['/api/v1/strategy-copies',`/api/v1/strategy-copies/${yId}/start`,`/api/v1/strategy-copies/${xId}/pause`,`/api/v1/strategy-copies/${yId}/stop`])
 }finally{mounted.restore()}
})

test('OPUS P1-3 owner multi connection history restores and delegates without cross scope',{timeout:20_000},async()=>{
 const baseList=wire('copy-list').data[0],baseDetail=wire('copy-unconnected').data
 const x=copyVariant(baseList,baseDetail,{subscriptionId:'subscription_fixture_00001',connectionId:'connection_fixture_00001',state:'STOPPED',revision:3})
 const y=copyVariant(baseList,baseDetail,{subscriptionId:'subscription_fixture_00002',connectionId:'connection_fixture_00002',state:'ACTIVE',revision:5})
 const list={apiContractVersion:'0.18.0',data:[x.list,y.list],nextCursor:null},details=new Map([[x.detail.subscriptionId,x.detail],[y.detail.subscriptionId,y.detail]])
 let api12=0,api17=0,versions=0;const posts:Array<{path:string;connectionId:string}>=[]
 const fetcher=(async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=new URL(String(input))
  if(url.pathname==='/api/v1/strategy-copies'&&url.search)return jsonResponse(url.href,list)
  const id=/^\/api\/v1\/strategy-copies\/([^/]+)$/.exec(url.pathname)?.[1]
  if(id&&init?.method==='GET'){const detail=details.get(id);if(detail)return jsonResponse(url.href,{apiContractVersion:'0.18.0',data:detail})}
  if(url.pathname.endsWith('/pause')){const value=structuredClone(x.detail);value.state='PAUSED';value.revision=4;posts.push({path:url.pathname,connectionId:value.connectionId});return jsonResponse(url.href,{apiContractVersion:'0.18.0',data:value})}
  if(url.pathname.endsWith('/stop')){const value=structuredClone(y.detail);value.state='STOPPING';value.revision=6;posts.push({path:url.pathname,connectionId:value.connectionId});return jsonResponse(url.href,{apiContractVersion:'0.18.0',data:value})}
  if(url.pathname==='/api/v1/exchange-connections/'){api12++;throw Error('API12_MUST_NOT_RUN')}
  if(url.pathname.endsWith('/account')){api17++;throw Error('API17_MUST_NOT_RUN')}
  if(url.pathname.startsWith('/api/v1/copy-strategy-versions')){versions++;throw Error('VERSION_MUST_NOT_RUN')}
  throw Error(`UNEXPECTED_FETCH:${init?.method}:${url.pathname}${url.search}`)
 }) as typeof fetch
 const deployment=production.parseCopyExecutionDeployment(JSON.stringify({schema:1,environment:'demo',bindings:[]})),mounted=mountProduction(deployment,fetcher)
 try{
  await mounted.mounted.flush(()=>mounted.mounted.value()?.controller.getSnapshot().copies.length===2)
  const port=mounted.mounted.value();assert.ok(port)
  const readX=await port.controller.readCopy(x.detail.subscriptionId),readY=await port.controller.readCopy(y.detail.subscriptionId)
  assert.equal(readX.connectionId,x.detail.connectionId);assert.equal(readY.connectionId,y.detail.connectionId)
  const paused=await port.controller.action('pause',x.detail.subscriptionId,3,'opus_p1_multi_pause_1'),stopped=await port.controller.action('stop',y.detail.subscriptionId,5,'opus_p1_multi_stop_01')
  assert.equal(paused.connectionId,x.detail.connectionId);assert.equal(stopped.connectionId,y.detail.connectionId)
  assert.deepEqual(posts,[{path:`/api/v1/strategy-copies/${x.detail.subscriptionId}/pause`,connectionId:x.detail.connectionId},{path:`/api/v1/strategy-copies/${y.detail.subscriptionId}/stop`,connectionId:y.detail.connectionId}])
  assert.deepEqual({api12,api17,versions},{api12:0,api17:0,versions:0})
 }finally{mounted.restore()}
})

test('mount 직후 readCopy는 restore settlement 뒤 exact known copy를 선택하고 pause한다',{timeout:20_000},async()=>{
 const list=wire('copy-list'),detail=wire('copy-unconnected'),subscriptionId=detail.data.subscriptionId
 let releaseList!:()=>void,listReleased=false,pauses=0
 const listGate=new Promise<void>(resolve=>{releaseList=()=>{listReleased=true;resolve()}})
 const fetcher=(async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=new URL(String(input))
  if(url.pathname==='/api/v1/strategy-copies'&&url.search){await listGate;return jsonResponse(url.href,list)}
  if(url.pathname===`/api/v1/strategy-copies/${subscriptionId}`&&init?.method==='GET')return jsonResponse(url.href,detail)
  if(url.pathname===`/api/v1/strategy-copies/${subscriptionId}/pause`&&init?.method==='POST'){pauses++;const value=structuredClone(detail);value.data.state='PAUSED';value.data.revision=1;return jsonResponse(url.href,value)}
  throw Error(`UNEXPECTED_FETCH:${init?.method}:${url.pathname}${url.search}`)
 }) as typeof fetch
 const deployment=production.parseCopyExecutionDeployment(JSON.stringify({schema:1,environment:'demo',bindings:[]})),mounted=mountProduction(deployment,fetcher)
 try{
  await new Promise(resolve=>setImmediate(resolve))
  const port=mounted.mounted.value();assert.ok(port);assert.equal(listReleased,false)
  let readSettled=false
  const pending=port.controller.readCopy(subscriptionId).then(value=>{readSettled=true;return value})
  await Promise.resolve();assert.equal(readSettled,false)
  releaseList()
  const selected=await pending;assert.equal(selected.subscriptionId,subscriptionId);assert.equal(port.controller.getSnapshot().selectedCopy?.subscriptionId,subscriptionId)
  const paused=await port.controller.action('pause',subscriptionId,selected.revision,'restore_settlement_pause_01');assert.equal(paused.state,'PAUSED');assert.equal(pauses,1)
 }finally{releaseList();mounted.restore()}
})
