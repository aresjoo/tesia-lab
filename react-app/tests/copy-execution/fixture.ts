import {readFileSync} from 'node:fs'
import type * as Wire from '../../src/copy-execution/fixtures/api-v0.18/types.js'
import type {BitgetCopyTransport} from '../../src/copy-execution/fixtures/api-v0.18/client.js'
import {createCandidateCopyController, type CopyControllerPorts} from '../../src/copy-execution/controller.js'
import {api18CandidateFixture} from '../../src/copy-execution/candidate-fixture.js'
import type {CopyScope,IssuedSourceBinding} from '../../src/copy-execution/presentation.js'
const cases=JSON.parse(readFileSync('tests/copy-execution/wire-cases.json','utf8')).cases as {name:string;value:unknown;valid:boolean;schemaName:string}[]
export {cases}
export function sample<T>(name:string):T{return structuredClone(cases.find(item=>item.name===name)!.value) as T}
export const source={sourceId:'f1',sourceSha:'a'.repeat(64)}
export const scope:CopyScope={owner:'owner-one',sessionId:'session-one',connectionId:'connection_fixture_00001',environment:'demo'}
export const settings={allocationUsdt:'1000',maxLossUsdt:'25',maxPositionFraction:'0.5',startMode:'next_signal' as const}
export const copy=()=>sample<Wire.CopyResponse>('copy-unconnected')
export const version=()=>sample<Wire.VersionResponse>('version')
export const issued=():IssuedSourceBinding=>({...source,strategyId:version().data.strategyId,versionId:version().data.versionId,policyHash:version().data.policyHash,environment:'demo'})
export const wire=(value:unknown,status=200)=>({status,headers:[['content-type','application/json'],['cache-control','no-store']] as const,body:JSON.stringify(value)})
export function deferred<T>(){let resolve!:(value:T)=>void;let reject!:(error:unknown)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no});return{promise,resolve,reject}}
export function harness(handler?:(input:Parameters<BitgetCopyTransport['request']>[0])=>Promise<Awaited<ReturnType<BitgetCopyTransport['request']>>>,overrides:Partial<CopyControllerPorts>={}){
 let current:CopyScope|null=scope
 const calls:Parameters<BitgetCopyTransport['request']>[0][]=[]
 const transport:BitgetCopyTransport={request:async input=>{calls.push(input);if(handler)return handler(input)
  if(input.path.includes('copy-strategy-versions'))return wire(version())
  return wire(copy(),input.method==='POST'&&input.path==='/api/v1/strategy-copies'?201:200)
 }}
 const controller=createCandidateCopyController({fixture:api18CandidateFixture,transport,currentScope:()=>current,csrf:async()=> 'csrf_fixture_0000000001',readIssuedBinding:async()=>issued(),randomKey:()=> 'idempotency_fixture_0001',...overrides})
 controller.bind(scope)
 return {controller,calls,setScope(value:CopyScope|null){current=value;controller.bind(value)},drift(value:CopyScope|null){current=value}}
}
