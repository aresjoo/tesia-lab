import test from 'node:test'
import assert from 'node:assert/strict'
import {createCopyTransport} from '../../src/copy-execution/transport.js'
const input={method:'GET',path:'/api/v1/strategy-copies',headers:{Accept:'application/json'},credentials:'include',redirect:'manual',cache:'no-store'} as const

test('copy transport rejects another service path before network',async()=>{
 let calls=0
 const port=createCopyTransport({origin:()=> 'https://teth.test',fetch:async()=>{calls++;return new Response('{}',{headers:{'Content-Type':'application/json'}})}})
 await assert.rejects(port.request({...input,path:'/api/v1/exchange-connections'}))
 assert.equal(calls,0)
})
function response(body='{}',url='https://teth.test/api/v1/strategy-copies',headers:Record<string,string>={'Content-Type':'application/json','Cache-Control':'no-store'}){
 const value=new Response(body,{headers});Object.defineProperty(value,'url',{value:url});return value
}
test('transport forwards exact SDK method, bytes, flags and AbortSignal without private authorization headers',async()=>{
 let captured:RequestInit|undefined
 const port=createCopyTransport({origin:()=> 'https://teth.test',fetch:async(_,init)=>{captured=init;return response()}})
 const raw='{"apiContractVersion":"0.18.0","allocationUsdt":"500.00"}'
 const request={...input,method:'POST' as const,body:raw,headers:{Accept:'application/json','Content-Type':'application/json','X-CSRF-Token':'csrf_fixture_0000000001','Idempotency-Key':'idempotency_fixture_0001'}}
 await port.request(request);assert.equal(captured!.body,raw);assert.equal(captured!.credentials,'include');assert.equal(captured!.redirect,'manual');assert.equal(captured!.cache,'no-store');assert.ok(captured!.signal instanceof AbortSignal)
})
test('exact SDK list cursor query is permitted, details/actions query and duplicate parameters are rejected before network',async()=>{
 let calls=0;const port=createCopyTransport({origin:()=> 'https://teth.test',fetch:async(url)=>{calls++;return response('{}',String(url))}})
 await port.request({...input,path:input.path+'?limit=20&cursor=cursor_fixture_00000001'})
 for(const path of [input.path+'?limit=20&limit=20',input.path+'?unknown=1',input.path+'?limit=101',input.path+'?cursor=bad',input.path+'/copy_fixture_0000001?limit=20'])await assert.rejects(port.request({...input,path}))
 assert.equal(calls,1)
})
test('invalid method, authorization, altered credentials and cross-origin targets do not reach fetch',async()=>{
 let calls=0;const port=createCopyTransport({origin:()=> 'https://teth.test',fetch:async()=>{calls++;return response()}})
 for(const patch of [{method:'DELETE',body:'{}'},{path:'https://other.test/api/v1/strategy-copies'},{headers:{Authorization:'private-value'}},{credentials:'omit'},{redirect:'follow'},{cache:'default'}])await assert.rejects(port.request({...input,...patch} as typeof input))
 assert.equal(calls,0)
})
test('response origin drift/redirect and non-JSON response remain failures',async()=>{
 for(const [body,url,headers]of [['{}','https://other.test/api/v1/strategy-copies',{'Content-Type':'application/json'}],['{}','https://teth.test/api/v1/strategy-copies',{'Content-Type':'text/html'}]]as const){
  const port=createCopyTransport({origin:()=> 'https://teth.test',fetch:async()=>response(body,url,headers)});await assert.rejects(port.request(input))
 }
 let origin='https://teth.test';const port=createCopyTransport({origin:()=>origin,fetch:async()=>{origin='https://other.test';return response()}});await assert.rejects(port.request(input))
})
test('stream response is bounded by UTF-8 bytes and rejects corrupt UTF-8',async()=>{
 const large=createCopyTransport({origin:()=> 'https://teth.test',fetch:async()=>response('한'.repeat(90_000))});await assert.rejects(large.request(input),error=>error instanceof Error&&error.message==='RESPONSE_TOO_LARGE')
 const bad=new Response(new Uint8Array([0xff]),{headers:{'Content-Type':'application/json'}});Object.defineProperty(bad,'url',{value:'https://teth.test/api/v1/strategy-copies'})
 const corrupt=createCopyTransport({origin:()=> 'https://teth.test',fetch:async()=>bad});await assert.rejects(corrupt.request(input))
})
test('already cancelled transport never calls fetch, late cancelled result remains failure',async()=>{
 let calls=0;const abort=new AbortController();abort.abort()
 const port=createCopyTransport({origin:()=> 'https://teth.test',fetch:async()=>{calls++;return response()}});await assert.rejects(port.request({...input,signal:abort.signal}));assert.equal(calls,0)
 const pending=new AbortController();const late=createCopyTransport({origin:()=> 'https://teth.test',fetch:async()=>{pending.abort();return response()}});await assert.rejects(late.request({...input,signal:pending.signal}))
})
test('timeout reaches fetch cancellation and is capped at 10 seconds',async()=>{
 const port=createCopyTransport({origin:()=> 'https://teth.test',timeoutMs:5,fetch:async(_,init)=>new Promise((_,reject)=>init!.signal!.addEventListener('abort',()=>reject(Error('cancelled'))))})
 await assert.rejects(port.request(input));assert.throws(()=>createCopyTransport({origin:()=> 'https://teth.test',timeoutMs:10001,fetch}))
})
