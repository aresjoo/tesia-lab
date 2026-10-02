import {expect,test,type Page} from '@playwright/test'
import sourceGolden from './fixtures/client-catalogue-detail-header-golden.json' with {type:'json'}
import {catalogueSourceSha,catalogueStrategies} from '../src/client-catalogue'
import {loadCatalogueMarketData} from '../src/client-catalogue-market-data'
import {runCatalogueFuturesPreview} from '../src/client-catalogue-futures-engine'
import {runCatalogueSpotPreview} from '../src/client-catalogue-spot-engine'
import {readCatalogueDetailHeader,catalogueVerificationRequest} from '../src/client-catalogue-detail-header-presentation'
import {catalogueHeaderText} from '../src/client-catalogue-detail-header-copy'
import type {CataloguePreviewResult} from '../src/client-catalogue-preview'
const path='/tests/fixtures/client-catalogue-detail-source-actions.html'
const fixture=(page:Page,method:string,value?:unknown)=>page.evaluate(({method,value})=>Reflect.get(window,'catalogueSourceFixture')[method](value),{method,value})
async function envelope(id:string){const data=await loadCatalogueMarketData(),strategy=catalogueStrategies.find(s=>s.id===id)!;return {source:'client-snapshot-preview',sourceSha:catalogueSourceSha,strategy,period:'all',calculation:'full-run',contextPeriod:'selected',calendar:{start:data.spot.start,asof:data.spot.asof},dataVersion:{spot:data.spot.v,futures:data.future.v},result:strategy.fut?runCatalogueFuturesPreview(strategy,data):runCatalogueSpotPreview(strategy,data)} as CataloguePreviewResult}
test('source browser golden: all 31 cfg/p flags, minimum amounts and inception dates agree',async()=>{
 expect(sourceGolden).toHaveLength(31)
 for(const golden of sourceGolden){const value=await envelope(golden.id),read=readCatalogueDetailHeader(value)!;expect(read.minimum,golden.id).toBe(golden.minimum);expect(read.hasConfiguration).toBe(golden.hasCfg);expect(read.hasImportableSettings).toBe(golden.hasP);const date=read.since!;expect(`${date.getFullYear()}.${String(date.getMonth()+1).padStart(2,'0')}.${String(date.getDate()).padStart(2,'0')}`,golden.id).toBe(golden.since)}
})
test('verification handoff preserves frozen canonical cfg and data generation, and rejects unknown or altered configurations',async()=>{
 const value=await envelope('f1'),original=structuredClone(value),text=catalogueVerificationRequest(value)!
 expect(text).toContain(JSON.stringify(value.strategy));expect(text).toContain(value.sourceSha);expect(text).toContain(value.dataVersion.futures);expect(text).toContain('Mock');expect(value).toEqual(original)
 for(const bad of [{...value,sourceSha:'old'},{...value,strategy:{...value.strategy,id:'unknown'}},{...value,strategy:{...value.strategy,lev:999}}]){expect(catalogueVerificationRequest(bad as CataloguePreviewResult)).toBeNull()}
})
test('source header includes verification and exact metadata; more menu controls analysis, favorite and link; no p means no settings import',async({page})=>{
 await page.goto(path);await expect(page.locator('[data-catalogue-source-minimum]')).toContainText('500');await expect(page.locator('[data-catalogue-source-since]')).toContainText('2023');await expect(page.locator('.catalogue-source-venue')).toContainText('Binance');await expect(page.getByRole('button',{name:'직접 검증하기, 백테스트',exact:true})).toBeEnabled()
 await expect(page.getByRole('button',{name:'설정 가져오기',exact:true})).toHaveCount(0)
 const more=page.getByRole('button',{name:'더 보기',exact:true});await more.click();await expect(page.getByRole('menu')).toBeVisible();await expect(page.getByRole('menuitem').first()).toBeFocused()
 await page.keyboard.press('End');await expect(page.getByRole('menuitem',{name:'링크 복사',exact:true})).toBeFocused();await page.keyboard.press('Escape');await expect(more).toBeFocused();expect(await fixture(page,'calls')).toEqual([])
 for(const [name,kind]of [['TETH에게 분석시키기','analyze'],['즐겨찾기','watch'],['링크 복사','link']]){await more.click();await page.getByRole('menuitem',{name,exact:true}).click();await expect(more).toBeFocused();expect((await fixture(page,'calls')).at(-1).kind).toBe(kind)}
 await expect(page.locator('.shared-detail-watch')).toHaveAttribute('aria-pressed','true')
})
test('missing verification port disables with a reason, failure is redacted, and duplicate clicks submit once',async({page})=>{
 await page.goto(path);await expect(page.locator('.catalogue-source-header')).toBeVisible();await fixture(page,'setAvailable',false)
 const verify=page.getByRole('button',{name:'직접 검증하기, 백테스트',exact:true});await expect(verify).toBeDisabled();await expect(verify).toHaveAttribute('title',/아직/)
 await fixture(page,'setAvailable',true);await verify.evaluate(node=>{(node as HTMLButtonElement).click();(node as HTMLButtonElement).click()});await expect(verify).toBeDisabled();expect((await fixture(page,'calls')).filter((c:{kind:string})=>c.kind==='verify')).toHaveLength(1)
 await fixture(page,'reject');await expect(page.getByRole('alert')).toBeVisible();await expect(page.locator('body')).not.toContainText('PRIVATE_CATALOGUE_ERROR');await expect(verify).toBeEnabled()
 await verify.click();await fixture(page,'resolve',1);await expect(verify).toBeEnabled();await expect(page.locator('body')).not.toContainText('검증 완료')
})
for(const boundary of ['owner','callback','value','unmount'] as const)test(`${boundary} aborts verification handoff; late completion cannot write into a new header`,async({page})=>{
 await page.goto(path);await page.getByRole('button',{name:'직접 검증하기, 백테스트',exact:true}).click()
 if(boundary==='owner')await fixture(page,'setOwner','owner-b');else if(boundary==='callback')await fixture(page,'replaceCallback');else if(boundary==='value')await fixture(page,'setValue',await envelope('f2'));else await fixture(page,'setMounted',false)
 expect((await fixture(page,'calls'))[0].aborted).toBe(true);await fixture(page,'reject');await expect(page.getByRole('alert')).toHaveCount(0)
})
test('optional catalogue header leaves the legacy detail shell unchanged',async({page})=>{await page.goto(path);await expect(page.locator('.catalogue-source-header')).toBeVisible();await fixture(page,'setLegacy',true);await expect(page.locator('.catalogue-source-header')).toHaveCount(0);await expect(page.getByRole('button',{name:'따라하기',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'TETH에게 분석시키기',exact:true})).toBeVisible()})
for(const language of ['ko','en','ja','zh-CN','zh-TW','es','fr'] as const)test(`${language} source header and menu remain usable at 320px with doubled text`,async({page})=>{
 await page.setViewportSize({width:320,height:900});await page.addInitScript(language=>localStorage.setItem('tethLang',language),language);await page.goto(path);await expect(page.locator('.catalogue-source-header')).toBeVisible()
 await page.locator('.catalogue-source-header').evaluate(node=>{const els=[...node.querySelectorAll<HTMLElement>('h2,p,button,.catalogue-source-meta>span')];const sizes=els.map(el=>parseFloat(getComputedStyle(el).fontSize));els.forEach((el,i)=>{el.style.fontSize=`${sizes[i]*2}px`})})
 for(const el of await page.locator('.catalogue-source-header button,.catalogue-source-meta>span').all())expect(await el.evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true)
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
 const more=page.getByRole('button',{name:catalogueHeaderText(language,'more'),exact:true});await more.click();await expect(page.getByRole('menuitem').first()).toBeFocused();await page.keyboard.press('Escape');await expect(more).toBeFocused()
})
