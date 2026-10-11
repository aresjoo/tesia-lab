import {test,expect,type Page} from '@playwright/test'
import cases from './wire-cases.json' with {type:'json'}
import words from '../../src/client-catalogue-copy-management-copy.json' with {type:'json'}
import type {CopyResponse,VersionResponse} from '../../src/copy-execution/fixtures/api-v0.18/types'
const sample=<T,>(name:string)=>structuredClone(cases.cases.find(value=>value.name===name)!.value)as T
test.setTimeout(35_000)
async function actualFixture(page:Page,mode:'normal'|'lost-create'|'delayed-create'='normal'){
 const version=sample<VersionResponse>('version'),calls:{method:string;path:string;body?:string;key?:string}[]=[]
 const current=sample<CopyResponse>('copy-unconnected')
 let creates=0,copyReadsUnavailable=false,release=()=>{}
 current.data.execution.origin='exchange';current.data.execution.actualExecutionVerified=true;current.data.execution.verificationEvidenceSha256='a'.repeat(64)
 current.data.execution.orders={status:'ok',reason:null,items:[],hasMore:false,nextCursor:null};current.data.execution.positions={status:'ok',reason:null,items:[]}
 for(const capability of Object.values(current.data.execution.availability)){capability.available=true;capability.reason=null}
 await page.route('**/api/v1/**',async route=>{
  const request=route.request(),url=new URL(request.url()),method=request.method(),body=request.postData()??undefined
  calls.push({method,path:url.pathname,body,key:request.headers()['idempotency-key']})
  let value:unknown,status=200
  if(url.pathname==='/api/v1/exchange-connections/')value={apiContractVersion:'0.12.0',data:{connections:[{connectedAt:'2026-10-11T00:00:00Z',connectionId:'connection_fixture_00001',exchangeId:'bitget',maskedAccountLabel:'fixture ***',permissions:{futuresTrade:true,spotTrade:false,read:true,withdrawal:false},permissionsVerified:true,status:'connected'}]}}
  else if(url.pathname==='/api/v1/copy-strategy-versions')value=sample('version-list')
  else if(url.pathname.startsWith('/api/v1/copy-strategy-versions/'))value=version
  else if(url.pathname==='/api/v1/strategy-copies'&&method==='GET')value={apiContractVersion:'0.18.0',data:[],nextCursor:null}
  else if(url.pathname==='/api/v1/strategy-copies'&&method==='POST'){
   creates++;status=201;const input=JSON.parse(body!);Object.assign(current.data,{allocationUsdt:input.allocationUsdt,maxLossUsdt:input.maxLossUsdt,maxPositionFraction:input.maxPositionFraction,startMode:input.startMode,state:'CREATED',revision:0})
   if(mode==='lost-create'&&creates===1){await route.abort('failed');return}
   if(mode==='delayed-create')await new Promise<void>(resolve=>{release=resolve})
   value=current
  }else if(method==='GET'){
   if(copyReadsUnavailable){status=503;value={apiContractVersion:'0.18.0',error:{code:'EXECUTION_UNAVAILABLE',message:'EXECUTION_UNAVAILABLE'}}}
   else value=current
  }
  else{
   const input=JSON.parse(body!);current.data.revision++
   if(method==='PATCH')Object.assign(current.data,{allocationUsdt:input.allocationUsdt,maxLossUsdt:input.maxLossUsdt,maxPositionFraction:input.maxPositionFraction})
   else if(url.pathname.endsWith('/start'))current.data.state='ACTIVE'
   else if(url.pathname.endsWith('/pause'))current.data.state='PAUSED'
   else if(url.pathname.endsWith('/stop'))current.data.state='STOPPING'
   else if(url.pathname.endsWith('/close')){current.data.state='PAUSED';current.data.closeStatus='PENDING'}
   value=current
  }
  await route.fulfill({status,json:value,headers:{'cache-control':'no-store'}}).catch(()=>undefined)
 })
 await page.goto('/');await page.evaluate(async value=>{const path='/tests/copy-execution/runtime-harness.tsx';Reflect.set(window,'actualWorkflow',(await import(path)).mountActualWorkflow(value))},version.data)
 await page.locator('.shared-detail-actions .wbtn').click();const sheet=page.getByRole('dialog',{name:'전략 복사',exact:true});await expect(sheet).toBeVisible()
 return{sheet,calls,release:()=>release(),failCopyReads:()=>{copyReadsUnavailable=true},budgetReads:()=>page.evaluate(()=>Reflect.get(window,'actualWorkflow').budgetReads())}
}
test('CE-WHOLE-01 original source SHA40 → 11-second settings dwell → fresh budget → SDK create/start → known management update/pause',async({page})=>{
 const fixture=await actualFixture(page);await fixture.sheet.getByLabel('복사 예산',{exact:true}).fill('500')
 await page.clock.install();await page.clock.runFor(11_000);await fixture.sheet.getByRole('button',{name:'전략 복사 시작',exact:true}).click()
 const management=page.locator('.catalogue-copy-management');await expect(management).toBeVisible();await expect(management.locator('.cpp-meta')).toHaveText(words.active[0]);await expect(management.locator('[data-metric=net]')).toHaveText('—')
 expect(await fixture.budgetReads()).toBe(2);expect(fixture.calls.filter(value=>value.method==='POST').map(value=>value.path)).toEqual(['/api/v1/strategy-copies','/api/v1/strategy-copies/subscription_fixture_00001/start'])
 const create=JSON.parse(fixture.calls.find(value=>value.method==='POST')!.body!);expect(create).toMatchObject({allocationUsdt:'500',maxLossUsdt:'100',maxPositionFraction:'0.95',startMode:'next_signal',versionId:'version_fixture_000001'})
 await management.getByRole('button',{name:words.budget[0],exact:true}).click();const dialog=page.locator('dialog.ss3-dialog')
 await dialog.getByRole('button',{name:words.withdrawn[0],exact:true}).click();await dialog.getByLabel('조정 금액',{exact:true}).fill('100');await dialog.getByRole('button',{name:'확인',exact:true}).click()
 await expect(dialog).toHaveCount(0);expect(JSON.parse(fixture.calls.find(value=>value.method==='PATCH')!.body!)).toMatchObject({allocationUsdt:'400',expectedRevision:1})
 await management.getByRole('button',{name:words.stop[0],exact:true}).click();await page.locator('.catalogue-copy-stop input[value=manual]').check();await page.locator('dialog.ss3-dialog').getByRole('button',{name:'확인',exact:true}).click()
 await expect(page.locator('dialog.ss3-dialog')).toHaveCount(0);expect(fixture.calls.filter(value=>value.path.endsWith('/pause')&&value.method==='POST')).toHaveLength(1)
 await expect(management.locator('.cpp-meta')).not.toHaveText(words.stopped[0])
})
test('CE-WHOLE-02 lost create response retries identical intent/key/body without new budget or automatic create',async({page})=>{
 const fixture=await actualFixture(page,'lost-create');await fixture.sheet.getByLabel('복사 예산',{exact:true}).fill('500');const button=fixture.sheet.getByRole('button',{name:'전략 복사 시작',exact:true})
 await button.click();await expect(fixture.sheet.getByRole('alert').filter({hasText:'설정을 확인하지 못했습니다'})).toBeVisible()
 expect(await fixture.budgetReads()).toBe(2);expect(fixture.calls.filter(value=>value.path==='/api/v1/strategy-copies'&&value.method==='POST')).toHaveLength(1)
 await page.clock.install();await page.clock.runFor(11_000);await button.click();await expect(page.locator('.catalogue-copy-management')).toBeVisible()
 const creates=fixture.calls.filter(value=>value.path==='/api/v1/strategy-copies'&&value.method==='POST');expect(creates).toHaveLength(2);expect(creates[1].body).toBe(creates[0].body);expect(creates[1].key).toBe(creates[0].key);expect(await fixture.budgetReads()).toBe(2)
})
test('CE-WHOLE-03 fresh insufficient budget holds the same inputs then permits an explicit fresh recheck',async({page})=>{
 const fixture=await actualFixture(page);await fixture.sheet.getByLabel('복사 예산',{exact:true}).fill('500');await page.evaluate(()=>Reflect.get(window,'actualWorkflow').budget('400'))
 const button=fixture.sheet.getByRole('button',{name:'전략 복사 시작',exact:true});await button.click();await expect(fixture.sheet.getByRole('alert').filter({hasText:'설정을 확인하지 못했습니다'})).toBeVisible()
 await expect(fixture.sheet.getByLabel('복사 예산',{exact:true})).toHaveValue('500');expect(fixture.calls.filter(value=>value.method!=='GET')).toHaveLength(0)
 await page.evaluate(()=>Reflect.get(window,'actualWorkflow').budget('1000.75'));await button.click();await expect(page.locator('.catalogue-copy-management')).toBeVisible();expect(await fixture.budgetReads()).toBe(3)
})
test('CE-WHOLE-04 actor switch aborts pending actual SDK create and discards late response without start',async({page})=>{
 const fixture=await actualFixture(page,'delayed-create');await fixture.sheet.getByLabel('복사 예산',{exact:true}).fill('500');await fixture.sheet.getByRole('button',{name:'전략 복사 시작',exact:true}).click()
 await expect.poll(()=>fixture.calls.filter(value=>value.path==='/api/v1/strategy-copies'&&value.method==='POST').length).toBe(1)
 await page.evaluate(()=>Reflect.get(window,'actualWorkflow').owner('session_other_fixture_00002'));await expect(fixture.sheet).toHaveCount(0);fixture.release()
 await expect(page.locator('.catalogue-copy-management')).toHaveCount(0);expect(fixture.calls.filter(value=>value.path.endsWith('/start'))).toHaveLength(0)
})
test('CE-WHOLE-05 known actual hook management stops when projection GET is unavailable',async({page})=>{
 const fixture=await actualFixture(page);await fixture.sheet.getByLabel('복사 예산',{exact:true}).fill('500')
 await fixture.sheet.getByRole('button',{name:'전략 복사 시작',exact:true}).click();const management=page.locator('.catalogue-copy-management');await expect(management).toBeVisible()
 fixture.failCopyReads();const before=fixture.calls.length
 await management.getByRole('button',{name:words.stop[0],exact:true}).click();await page.locator('.catalogue-copy-stop input[value=wait]').check()
 await page.locator('dialog.ss3-dialog').getByRole('button',{name:'확인',exact:true}).click()
 await expect(page.locator('dialog.ss3-dialog')).toHaveCount(0)
 expect(fixture.calls.slice(before).map(value=>[value.method,value.path])).toEqual([['POST','/api/v1/strategy-copies/subscription_fixture_00001/stop']])
 expect(JSON.parse(fixture.calls.at(-1)!.body!)).toMatchObject({apiContractVersion:'0.18.0',expectedRevision:1})
 await expect(management.locator('.cpp-meta')).not.toHaveText(words.stopped[0])
})
