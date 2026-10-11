import {test,expect,type Page} from '@playwright/test'
async function mount(page:Page,mode:string){await page.goto('/');await page.evaluate(async value=>{const path='/tests/copy-execution/ui-harness.tsx';Reflect.set(window,'copyUi',(await import(path)).mountCopyUi(value))},mode)}
test.setTimeout(30_000)
test('CE-UI-01 unissued original catalogue selection remains unavailable',async({page})=>{
 await mount(page,'unbound');await expect(page.locator('[data-public-catalogue]')).toBeVisible()
 await page.locator('.shared-detail-actions .wbtn').click();await expect(page.getByRole('dialog',{name:'전략 복사',exact:true})).toHaveCount(0)
 expect(await page.evaluate(()=>Reflect.get(window,'copyUi').calls())).toEqual([])
 await page.locator('.tfbk-bc button').first().click();await expect(page.locator('.strategy-list-link').first()).toBeVisible()
 await expect(page.locator('.strategy-list-grid')).toBeVisible()
})
test('CE-UI-02 original setup confirmed USDT, owner change aborts late success',async({page})=>{
 await mount(page,'setup');await page.locator('.shared-detail-actions .wbtn').click()
 const sheet=page.getByRole('dialog',{name:'전략 복사',exact:true});await expect(sheet).toBeVisible()
 await expect(sheet.locator('.ccs-hint').first()).toContainText('1,000.75 USDT')
 await sheet.getByLabel('복사 예산',{exact:true}).fill('500');await sheet.getByRole('button',{name:'전략 복사 시작',exact:true}).click()
 await page.evaluate(()=>Reflect.get(window,'copyUi').patch('owner-two'))
 await expect(sheet).toHaveCount(0);expect(await page.evaluate(()=>Reflect.get(window,'copyUi').confirmations())).toEqual([{aborted:true}])
 await page.evaluate(()=>Reflect.get(window,'copyUi').settle());await expect(page.locator('.catalogue-copy-management')).toHaveCount(0)
})
test('CE-UI-03 actual unavailable projection preserves original management fields and emergency controls',async({page})=>{
 await mount(page,'management');const management=page.locator('.catalogue-copy-management');await expect(management).toBeVisible()
 await expect(management.locator('[data-metric=current]')).toHaveText('—');await expect(management.locator('[data-metric=net]')).toHaveText('—')
 await expect(management.locator('.cpp-meta')).toHaveText('—');await expect(management.locator('.cq-tabs [role=tab]')).toHaveCount(2)
 await management.getByRole('button',{name:'설정',exact:true}).click();await expect(page.locator('.catalogue-copy-settings')).toContainText('1,000.00 USDT');await expect(page.locator('.catalogue-copy-settings')).toContainText('-2.5%')
 await page.getByRole('dialog').getByRole('button',{name:'닫기',exact:true}).last().click()
 await management.getByRole('button',{name:'복사 중단',exact:true}).click();await expect(page.locator('.catalogue-copy-stop input[type=radio]')).toHaveCount(3)
 await expect(page.locator('.catalogue-copy-stop input[value=manual]')).toBeEnabled()
})
test('CE-UI-04 unconnected 404 keeps error and never creates preview or success',async({page})=>{
 await mount(page,'404');await expect(page.locator('.catalogue-copy-management [role=alert]')).toBeVisible()
 await expect(page.locator('.catalogue-copy-management [data-metric=current]')).toHaveText('—')
 await expect(page.locator('.catalogue-copy-management .cq-acts')).toHaveCount(0)
 expect(await page.evaluate(()=>Reflect.get(window,'copyUi').calls().every((value:{method:string})=>value.method==='GET'))).toBe(true)
})
test('CE-UI-06 ACTIVE flatten cannot use close that pauses new entries',async({page})=>{
 await mount(page,'active-flat');const button=page.locator('.cq-positions').getByRole('button',{name:'포지션 전체 정리',exact:true})
 await expect(button).toBeVisible();await expect(button).toBeDisabled()
 expect(await page.evaluate(()=>Reflect.get(window,'copyUi').calls().every((value:{method:string})=>value.method==='GET'))).toBe(true)
})
for(const [enabled,environment,expected]of [[false,'demo','off'],[true,null,'unavailable'],[true,'demo','error:NOT_FOUND']]as const)test(`CE-UI-05 runtime default=${enabled} environment=${environment} never infers account facts`,async({page})=>{
 const paths:string[]=[]
 await page.route('**/api/v1/exchange-connections/',async route=>{paths.push(new URL(route.request().url()).pathname);await route.fulfill({json:{apiContractVersion:'0.12.0',data:{connections:[{connectedAt:'2026-10-11T00:00:00Z',connectionId:'connection_fixture_00001',exchangeId:'bitget',maskedAccountLabel:'fixture ***',permissions:{futuresTrade:true,spotTrade:false,read:true,withdrawal:false},permissionsVerified:true,status:'connected'}]}},headers:{'cache-control':'no-store'}})})
 await page.route('**/api/v1/copy-strategy-versions*',async route=>{paths.push(new URL(route.request().url()).pathname);await route.fulfill({status:404,json:{apiContractVersion:'0.18.0',error:{code:'NOT_FOUND',message:'NOT_FOUND'}},headers:{'cache-control':'no-store'}})})
 await page.goto('/');await page.evaluate(async values=>{const path='/tests/copy-execution/runtime-harness.tsx';Reflect.set(window,'runtimeUi',(await import(path)).mountRuntime(values.enabled,values.environment))},{enabled,environment})
 await expect(page.locator('[data-runtime-state]')).toContainText(expected)
 if(!enabled||environment===null)expect(paths).toEqual([])
 else expect(paths).toEqual(['/api/v1/exchange-connections/','/api/v1/copy-strategy-versions'])
})

for(const mode of ['synthetic-finance','exchange-unverified'])test(`CE-UI-07 ${mode} never displays positions or confirmed PnL as actual money`,async({page})=>{
 await mount(page,mode);const management=page.locator('.catalogue-copy-management');await expect(management.locator('.cq-acts')).toBeVisible()
 await expect(management.locator('[data-metric=net]')).toHaveText('—');await expect(management.locator('.cq-positions .cq-row')).toHaveCount(0)
 await management.locator('.cq-amt summary').click();await expect(management.locator('[data-metric="실현 손익"]')).toHaveText('—')
 await management.getByRole('button',{name:'복사 중단',exact:true}).click();await expect(page.locator('.catalogue-copy-stop input[value=manual]')).toBeEnabled()
})
test('CE-UI-08 changing copy target discards the original pending action dialog and intent',async({page})=>{
 await mount(page,'management');await page.locator('.cq-acts').getByRole('button',{name:'복사 중단',exact:true}).click()
 await expect(page.locator('dialog.ss3-dialog')).toBeVisible()
 await page.evaluate(()=>Reflect.get(window,'copyUi').routeCopy('subscription_other_00002'))
 await expect(page.locator('.catalogue-copy-management')).toHaveAttribute('data-copy-id','subscription_other_00002')
 await expect(page.locator('dialog.ss3-dialog')).toHaveCount(0)
 expect(await page.evaluate(()=>Reflect.get(window,'copyUi').calls().filter((value:{method:string})=>value.method!=='GET'))).toEqual([])
})
