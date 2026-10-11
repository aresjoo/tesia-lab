import test,{after} from 'node:test'
import assert from 'node:assert/strict'
import {copyFileSync,existsSync,mkdirSync,mkdtempSync,readFileSync,rmSync,symlinkSync,writeFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {dirname,join,relative,resolve} from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {tmpdir} from 'node:os'

const project=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),temp=mkdtempSync(join(tmpdir(),'teth-copy-production-budget-')),emitted=new Set<string>()
const localNodeModules=join(project,'node_modules'),fallbackNodeModules=process.env.TETH_TEST_NODE_MODULES
const dependencyRoot=existsSync(localNodeModules)?localNodeModules:fallbackNodeModules&&existsSync(fallbackNodeModules)?resolve(fallbackNodeModules):null
if(!dependencyRoot)throw Error('TEST_NODE_MODULES_UNAVAILABLE')
const dependencyRequire=createRequire(join(dependencyRoot,'package.json')),ts=dependencyRequire('typescript') as typeof import('typescript')
writeFileSync(join(temp,'package.json'),'{"type":"module"}')
symlinkSync(dependencyRoot,join(temp,'node_modules'),'dir')
function emit(sourceFile:string):void{
 sourceFile=resolve(sourceFile);if(emitted.has(sourceFile))return;emitted.add(sourceFile)
 const destination=join(temp,relative(project,sourceFile).replace(/\.tsx?$/,'.js'));mkdirSync(dirname(destination),{recursive:true})
 if(sourceFile.endsWith('.json')){copyFileSync(sourceFile,destination);return}
 let source=readFileSync(sourceFile,'utf8')
 const specs=[...source.matchAll(/(?:from\s+|import\s*(?:\(\s*)?)["'](\.[^"']+)["']/g)].map(match=>match[1]!)
 for(const spec of new Set(specs)){let dependency=resolve(dirname(sourceFile),spec.endsWith('.js')?spec.slice(0,-3)+'.ts':spec);if(!existsSync(dependency))dependency=existsSync(dependency+'.ts')?dependency+'.ts':existsSync(dependency+'.tsx')?dependency+'.tsx':dependency;if(existsSync(dependency)){emit(dependency);const outputSpec=spec.endsWith('.js')||spec.endsWith('.json')?spec:spec+'.js';source=source.replaceAll(`'${spec}'`,`'${outputSpec}'`).replaceAll(`"${spec}"`,`"${outputSpec}"`)}}
 writeFileSync(destination,ts.transpileModule(source,{fileName:sourceFile,compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText)
}
emit(join(project,'src/copy-execution/use-copy-execution.ts'))
const production=await import(pathToFileURL(join(temp,'src/copy-execution/use-copy-execution.js')).href)
const {TesiaBitgetAccountV17Client}=await import(pathToFileURL(join(temp,'src/internal-poc/contracts/generated/api-v0.17/client.js')).href)
after(()=>rmSync(temp,{recursive:true,force:true}))

const section=(status:'ok'|'unavailable'|'not_applicable',items:unknown[]=[])=>({status,reason:status==='unavailable'?'PROVIDER_UNAVAILABLE':null,items})
const balance=(coin:string,available:string|null)=>({coin,equity:null,balance:null,available,frozen:null,locked:null,unrealizedPnl:null})
const snapshot=(observedAt:string)=>({apiContractVersion:'0.17.0',data:{connectionId:'connection_fixture_00001',exchangeId:'bitget',accountMode:'classic',observedAt,products:[
 {product:'spot',balances:section('ok',[balance('USDT','123.4500')]),positions:section('not_applicable')},
 {product:'USDT-FUTURES',balances:section('ok',[balance('USDT','987.654321')]),positions:section('ok')},
 {product:'USDC-FUTURES',balances:section('unavailable'),positions:section('unavailable')},
 {product:'COIN-FUTURES',balances:section('unavailable'),positions:section('unavailable')},
]}})

test('API17 classic exact product의 fresh USDT available만 원문 decimal·server observed expiry로 예산화한다',async()=>{
 const now=Date.parse('2026-10-12T00:00:10Z'),wire=snapshot('2026-10-12T00:00:02Z')
 const client=new TesiaBitgetAccountV17Client({request:async()=>({status:200,headers:[['content-type','application/json'],['cache-control','no-store']],body:JSON.stringify(wire)})})
 const account=(await client.account('connection_fixture_00001')).data
 const spot=production.productionBudgetFromAccount(account,'SPOT',now,'local:7'),futures=production.productionBudgetFromAccount(account,'USDT-FUTURES',now,'local:8')
 assert.deepEqual(spot,{availableUsdt:'123.4500',revision:'local:7',expiresAtMs:Date.parse('2026-10-12T00:00:12Z')})
 assert.equal(futures.availableUsdt,'987.654321');assert.equal(futures.expiresAtMs,Date.parse('2026-10-12T00:00:12Z'))
 assert.equal(production.productionBudgetFromAccount(account,'SPOT',Date.parse('2026-10-12T00:00:12.001Z'),'local:9'),null)
 assert.equal(production.productionBudgetFromAccount(account,'SPOT',Date.parse('2026-10-12T00:00:01.999Z'),'local:9'),null)
 assert.equal(production.productionBudgetFromAccount({...account,accountMode:'uta'},'SPOT',now,'local:9'),null)
 const duplicate=structuredClone(account);duplicate.products.find((row:{product:string})=>row.product==='spot').balances.items.push(balance('USDT','1'))
 assert.equal(production.productionBudgetFromAccount(duplicate,'SPOT',now,'local:9'),null)
 const generic=structuredClone(account);generic.products.find((row:{product:string})=>row.product==='spot').balances.items[0].available=null;generic.products.find((row:{product:string})=>row.product==='spot').balances.items[0].balance='999999'
 assert.equal(production.productionBudgetFromAccount(generic,'SPOT',now,'local:9'),null)
})
