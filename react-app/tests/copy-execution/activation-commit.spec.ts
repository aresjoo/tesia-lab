import {test,expect,type Page} from '@playwright/test'
import cases from './wire-cases.json' with {type:'json'}
import words from '../../src/client-catalogue-copy-management-copy.json' with {type:'json'}
import type {CopyResponse,VersionResponse} from '../../src/copy-execution/fixtures/api-v0.18/types'
const sample=<T,>(name:string)=>structuredClone(cases.cases.find(value=>value.name===name)!.value)as T
test.setTimeout(35_000)

/** Actual backend commit-renderer shape; execution observation is a separate GET fixture. */
async function activationFixture(page:Page,projection:'unavailable'|'verified'){
 const version=sample<VersionResponse>('version'),current=sample<CopyResponse>('copy-unconnected')
 const calls:{method:string;path:string;body?:string}[]=[],responses:{path:string;value:CopyResponse}[]=[]
 const commit=()=>{
  const value=structuredClone(current),execution=sample<CopyResponse>('copy-unconnected').data.execution
  execution.origin='unconnected';execution.actualExecutionVerified=false;execution.verificationEvidenceSha256=null
  for(const [operation,capability]of Object.entries(execution.availability)){
   capability.available=operation==='pause'||operation==='stop';capability.reason=capability.available?null:'ACCOUNT_FACTS_UNAVAILABLE'
  }
  execution.positions={status:'unavailable',reason:'ACCOUNT_FACTS_UNAVAILABLE',items:[]}
  execution.orders={status:'unavailable',reason:'ACCOUNT_FACTS_UNAVAILABLE',items:[],hasMore:false,nextCursor:null}
  value.data.execution=execution;return value
 }
 const observed=()=>{
  const value=structuredClone(current);value.data.execution.origin='exchange';value.data.execution.actualExecutionVerified=true;value.data.execution.verificationEvidenceSha256='a'.repeat(64)
  for(const capability of Object.values(value.data.execution.availability)){capability.available=true;capability.reason=null}
  value.data.execution.positions={status:'ok',reason:null,items:[]};value.data.execution.orders={status:'ok',reason:null,items:[],hasMore:false,nextCursor:null}
  return value
 }
 await page.route('**/api/v1/**',async route=>{
  const request=route.request(),path=new URL(request.url()).pathname,method=request.method(),body=request.postData()??undefined
  calls.push({method,path,body});let value:unknown,status=200
  if(path==='/api/v1/exchange-connections/')value={apiContractVersion:'0.12.0',data:{connections:[{connectedAt:'2026-10-11T00:00:00Z',connectionId:'connection_fixture_00001',exchangeId:'bitget',maskedAccountLabel:'fixture ***',permissions:{futuresTrade:true,spotTrade:false,read:true,withdrawal:false},permissionsVerified:true,status:'connected'}]}}
  else if(path==='/api/v1/copy-strategy-versions')value=sample('version-list')
  else if(path.startsWith('/api/v1/copy-strategy-versions/'))value=version
  else if(path==='/api/v1/strategy-copies'&&method==='GET')value={apiContractVersion:'0.18.0',data:[],nextCursor:null}
  else if(path==='/api/v1/strategy-copies'&&method==='POST'){
   status=201;const input=JSON.parse(body!);Object.assign(current.data,{allocationUsdt:input.allocationUsdt,maxLossUsdt:input.maxLossUsdt,maxPositionFraction:input.maxPositionFraction,startMode:input.startMode,state:'CREATED',revision:0});value=commit()
  }else if(method==='GET'){
   if(current.data.state!=='CREATED'&&projection==='unavailable'){status=503;value={apiContractVersion:'0.18.0',error:{code:'EXECUTION_UNAVAILABLE',message:'EXECUTION_UNAVAILABLE'}}}
   else value=observed()
  }else{
   current.data.revision++;current.data.state=path.endsWith('/start')?'ACTIVE':path.endsWith('/stop')?'STOPPING':'PAUSED';value=commit();responses.push({path,value:structuredClone(value as CopyResponse)})
  }
  await route.fulfill({status,json:value,headers:{'cache-control':'no-store'}})
 })
 await page.goto('/');await page.evaluate(async value=>{const path='/tests/copy-execution/runtime-harness.tsx';Reflect.set(window,'activationWorkflow',(await import(path)).mountActualWorkflow(value))},version.data)
 await page.locator('.shared-detail-actions .wbtn').click();const sheet=page.getByRole('dialog',{name:'전략 복사',exact:true});await expect(sheet).toBeVisible()
 await sheet.getByLabel('복사 예산',{exact:true}).fill('500');await sheet.getByRole('button',{name:'전략 복사 시작',exact:true}).click()
 return{sheet,calls,responses,management:page.locator('.catalogue-copy-management')}
}
test('CE-ACTIVATION-01 ACTIVE unconnected commit completes original setup while missing projection keeps money unavailable and pause/stop usable',async({page})=>{
 const fixture=await activationFixture(page,'unavailable');await expect(fixture.sheet).toHaveCount(0);await expect(fixture.management).toBeVisible()
 const start=fixture.responses.find(value=>value.path.endsWith('/start'))!.value
 expect(start.data).toMatchObject({state:'ACTIVE',revision:1,execution:{origin:'unconnected',actualExecutionVerified:false}})
 await expect(fixture.management.getByRole('alert')).toBeVisible()
 await expect(fixture.management.locator('[data-metric=current]')).toHaveText('—');await expect(fixture.management.locator('[data-metric=net]')).toHaveText('—');await expect(fixture.management.locator('.cpp-meta')).toHaveText('—')
 await expect(fixture.management.locator('.cq-positions').getByRole('status')).toBeVisible()
 for(const [mode,operation]of [['manual','pause'],['wait','stop']]as const){
  const before=fixture.calls.length;await fixture.management.getByRole('button',{name:words.stop[0],exact:true}).click();await page.locator(`.catalogue-copy-stop input[value=${mode}]`).check()
  await page.locator('dialog.ss3-dialog').getByRole('button',{name:'확인',exact:true}).click();await expect(page.locator('dialog.ss3-dialog')).toHaveCount(0)
  expect(fixture.calls.slice(before).map(value=>[value.method,value.path])).toEqual([['POST',`/api/v1/strategy-copies/subscription_fixture_00001/${operation}`]])
 }
 expect(fixture.responses.at(-1)!.value.data.state).toBe('STOPPING');await expect(fixture.management.locator('.cpp-meta')).not.toHaveText(words.stopped[0])
 await expect(fixture.management.locator('[data-metric=net]')).toHaveText('—')
})
test('CE-ACTIVATION-02 unconnected ACTIVE commit and later verified exchange projection remain separate authorities',async({page})=>{
 const fixture=await activationFixture(page,'verified');await expect(fixture.sheet).toHaveCount(0);await expect(fixture.management).toBeVisible()
 expect(fixture.responses.find(value=>value.path.endsWith('/start'))!.value.data.execution).toMatchObject({origin:'unconnected',actualExecutionVerified:false})
 expect(fixture.calls.filter(value=>value.method==='POST').map(value=>value.path)).toEqual(['/api/v1/strategy-copies','/api/v1/strategy-copies/subscription_fixture_00001/start'])
 await expect(fixture.management.locator('.cpp-meta')).toHaveText(words.active[0]);await expect(fixture.management.locator('[data-metric=net]')).toHaveText('—')
 expect(fixture.calls.filter(value=>value.method==='GET'&&value.path==='/api/v1/strategy-copies/subscription_fixture_00001')).toHaveLength(2)
})
