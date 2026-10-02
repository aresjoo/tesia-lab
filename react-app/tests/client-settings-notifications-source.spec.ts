import {expect,test,type Page} from '@playwright/test'
import {clientNotificationTopics,readClientNotificationPreferences,type ClientNotificationGroups} from '../src/client-settings-notifications-presentation'
import settings from '../src/client-settings-copy.json' with {type:'json'}
import {notificationMandatoryText} from '../src/client-settings-notifications-copy'
const path='/tests/fixtures/client-settings-notifications-source.html'
const control=(page:Page,topic:string,channel:string)=>page.locator(`[data-notification-topic=${topic}] [data-notification-channel=${channel}]`)
const fixture=(page:Page,method:string,value?:unknown)=>page.evaluate(({method,value})=>Reflect.get(window,'notificationSourceFixture')[method](value),{method,value})
test('explicit markers preserve six independent channel observations and isolate unmarked supplied groups',()=>{
 const rows=clientNotificationTopics.flatMap(topic=>(['push','email'] as const).map(channel=>({id:`opaque:${topic}:${channel}`,label:'Not parsed',checked:channel==='push',sourceNotification:{topic,channel}})))
 const groups:ClientNotificationGroups=[{id:'source',title:'Source',rows:[...rows,{id:'fill/email',label:'Looks like source but is legacy',checked:true}]}]
 const original=structuredClone(groups),read=readClientNotificationPreferences(groups)
 expect(read.topics).toHaveLength(6);expect(read.invalid).toBe(false);expect(read.observed).toBe(true)
 for(const topic of read.topics){expect(topic.push?.checked).toBe(true);expect(topic.email?.checked).toBe(false)}
 expect(read.legacyGroups[0].rows).toEqual([groups![0].rows.at(-1)])
 expect(groups).toEqual(original)
})
for(const corruption of ['duplicate-channel','duplicate-id','unknown-topic','unknown-channel','extra-marker-field','bad-id','bad-checked'] as const)test(`${corruption}: marked observations fail closed without legacy action fallback`,()=>{
 const row={id:'supplied',label:'Source',checked:true,sourceNotification:{topic:'fill',channel:'push'}}
 const bad:unknown=corruption==='duplicate-channel'?{...row,id:'other'}:corruption==='duplicate-id'?{...row,sourceNotification:{topic:'risk',channel:'email'}}:corruption==='unknown-topic'?{...row,id:'other',sourceNotification:{topic:'secret',channel:'push'}}:corruption==='unknown-channel'?{...row,id:'other',sourceNotification:{topic:'fill',channel:'sms'}}:corruption==='extra-marker-field'?{...row,id:'other',sourceNotification:{topic:'fill',channel:'email',secret:'ignored'}}:corruption==='bad-id'?{...row,id:' bad '}: {...row,id:'other',checked:'yes'}
 const read=readClientNotificationPreferences([{id:'source',title:'Source',rows:[row,bad]}] as ClientNotificationGroups)
 expect(read.invalid).toBe(true);expect(read.legacyGroups).toEqual([])
 for(const topic of read.topics){expect(topic.push).toBeNull();expect(topic.email).toBeNull()}
})
test('unknown channels display dash, observed false stays false, mandatory bill email is locked only on source marker',async({page})=>{
 await page.goto(path)
 await expect(page.locator('[data-notification-topic]')).toHaveCount(6);await expect(page.locator('[data-notification-channel]')).toHaveCount(12)
 await expect(control(page,'fill','push')).toHaveAttribute('aria-pressed','true');await expect(control(page,'fill','email')).toHaveAttribute('aria-pressed','false')
 await expect(control(page,'risk','push')).toContainText('—');await expect(control(page,'risk','push')).not.toHaveAttribute('aria-pressed');await expect(control(page,'risk','push')).toBeDisabled()
 await expect(control(page,'bill','email')).toBeDisabled();await expect(control(page,'bill','email')).toHaveAttribute('aria-pressed','false');await expect(control(page,'bill','email')).toHaveAttribute('title',notificationMandatoryText('ko'))
 await expect(page.locator('[data-legacy-groups]')).toHaveText('Keep this supplied legacy fact')
 await fixture(page,'setAvailable',false);await expect(control(page,'fill','push')).toBeDisabled();await expect(control(page,'fill','push')).toHaveAttribute('title',settings.actionUnavailable.ko)
 expect(await fixture(page,'calls')).toEqual([])
})
test('explicit row ID and requested inverse submit once; acceptance never changes observed state and failure is redacted',async({page})=>{
 await page.goto(path);const button=control(page,'fill','push')
 await button.evaluate(node=>{(node as HTMLButtonElement).click();(node as HTMLButtonElement).click()})
 expect(await fixture(page,'calls')).toEqual([{id:'arbitrary/remote/push',checked:false,generation:0,aborted:false}]);await expect(button).toBeDisabled();await expect(button).toHaveAttribute('aria-pressed','true')
 await fixture(page,'resolve');await expect(page.getByRole('status')).toBeVisible();await expect(button).toHaveAttribute('aria-pressed','true')
 await button.click();await fixture(page,'reject',1);await expect(page.getByRole('alert')).toBeVisible();await expect(page.locator('body')).not.toContainText('PRIVATE_NOTIFY_FAILURE');await expect(button).toBeEnabled()
})
for(const boundary of ['owner','dataset','callback','removed-id','unmount'] as const)test(`${boundary} aborts a pending observation request and ignores late response`,async({page})=>{
 await page.goto(path);await control(page,'fill','email').click()
 if(boundary==='owner')await fixture(page,'setOwner','other-owner')
 else if(boundary==='dataset')await fixture(page,'setDataset','other-dataset')
 else if(boundary==='callback')await fixture(page,'replaceCallback')
 else if(boundary==='removed-id')await fixture(page,'setGroups',[])
 else await fixture(page,'setMounted',false)
 expect(await fixture(page,'calls')).toEqual([{id:'arbitrary/remote/email',checked:true,generation:0,aborted:true}]);await fixture(page,'resolve');await expect(page.getByRole('status')).toHaveCount(0)
})
for(const language of ['ko','en','ja','zh-CN','zh-TW','es','fr'] as const)test(`${language} source six-topic two-channel buttons stay readable at 320px and 200%`,async({page})=>{
 await page.setViewportSize({width:320,height:900});await page.addInitScript(language=>localStorage.setItem('tethLang',language),language);await page.goto(path)
 await expect(control(page,'fill','push')).toHaveText(settings.push[language]);await expect(control(page,'fill','email')).toHaveText(settings.email[language])
 await page.locator('.client-settings-notifications').evaluate(node=>{const els=[...node.querySelectorAll<HTMLElement>('b,span,button')];const sizes=els.map(el=>parseFloat(getComputedStyle(el).fontSize));els.forEach((el,i)=>{el.style.fontSize=`${sizes[i]*2}px`})})
 for(const node of await page.locator('[data-notification-topic] button').all())expect(await node.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
 await control(page,'fill','push').focus();await expect(control(page,'fill','push')).toBeFocused()
})
