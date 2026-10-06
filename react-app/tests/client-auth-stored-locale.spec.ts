import { expect, test, type Page } from '@playwright/test'
import clientCopy from '../src/client-reference-copy.json' with { type: 'json' }
import staticCopy from '../src/client-static-ui-copy.json' with { type: 'json' }
import { TEST_ORIGIN } from './test-origin'

const languages=['ko','en','ja','zh-CN','zh-TW','es','fr'] as const
test.use({trace:'off',video:'off'})
test.setTimeout(120_000)
async function locale(page:Page, language:string){
  await page.evaluate(async language=>{const p='/src/client-preferences.ts';(await import(p)).setClientPreference('language',language)},language)
}
async function fixture(page:Page){
  const requests:string[]=[]
  await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin!==TEST_ORIGIN||url.pathname.startsWith('/api/')||route.request().method()!=='GET'){requests.push(route.request().method()+' '+url.pathname);return route.abort('blockedbyclient')}return route.continue()})
  await page.emulateMedia({reducedMotion:'reduce'})
  await page.clock.install()
  await page.goto('/tests/fixtures/client-account-ui.html')
  await expect(page.getByRole('button',{name:'signup',exact:true})).toBeVisible()
  await page.clock.pauseAt(await page.evaluate(()=>Date.now()+100))
  return requests
}
async function open(page:Page, mode:'login'|'signup'){
  await page.getByRole('button',{name:mode,exact:true}).click()
  await expect(page.locator('.ca-auth')).toBeVisible()
}
async function expectStored(page:Page,key:'email.err'|'req.head'|'code.err'|'pw.err'|'code.sent'|'code.resent',toast=false){
  const before=await page.locator('.ca-auth input').evaluateAll(nodes=>nodes.map(node=>(node as HTMLInputElement).value))
  for(const language of languages){
    await locale(page,language)
    await expect(page.locator(toast?'.ca-code-toast.show':'.au-err')).toHaveText(clientCopy.I18N[key][language])
    expect(await page.locator('.ca-auth input').evaluateAll(nodes=>nodes.map(node=>(node as HTMLInputElement).value))).toEqual(before)
    await expect(page.locator('output')).toHaveText('')
  }
}

test('auth stored errors from every origin locale update in place across seven languages',async({page})=>{
  const requests=await fixture(page)
  for(const origin of languages){
    await locale(page,origin);await open(page,'signup')
    await page.locator('.ca-auth input[type=email]').fill('invalid')
    await page.locator('.ca-auth button[type=submit]').click()
    await expectStored(page,'email.err')
    await locale(page,origin)
    await page.locator('.ca-auth input[type=email]').fill('preview@example.invalid')
    await page.locator('.ca-auth button[type=submit]').click()
    await page.locator('.ca-auth button[type=submit]').click()
    await expectStored(page,'req.head')
    await locale(page,origin)
    await page.locator('.ca-auth input[type=password]').fill('preview-password-42!')
    await page.locator('.ca-auth button[type=submit]').click()
    await page.locator('.ca-auth input[inputmode=numeric]').fill('12')
    await page.locator('.ca-auth button[type=submit]').click()
    await expectStored(page,'code.err')
    await page.keyboard.press('Escape')
    await locale(page,origin);await open(page,'login')
    await page.locator('.ca-auth input[type=email]').fill('preview@example.invalid')
    await page.locator('.ca-auth button[type=submit]').click()
    await page.locator('.ca-auth .au-btn.ghost').click()
    await page.locator('.ca-auth button[type=submit]').click()
    await expectStored(page,'pw.err')
    await page.keyboard.press('Escape')
  }
  expect(requests).toEqual([])
  expect(await page.evaluate(()=>({...sessionStorage}))).toEqual({})
})

test('auth code sent and resent toasts keep their timers and inputs while changing seven languages',async({page})=>{
  const requests=await fixture(page)
  for(const origin of languages){
    await locale(page,origin);await open(page,'login')
    await page.locator('.ca-auth input[type=email]').fill('preview@example.invalid')
    await page.locator('.ca-auth button[type=submit]').click()
    await page.locator('.ca-auth input[inputmode=numeric]').fill('12')
    await expectStored(page,'code.sent',true)
    await expect(page.locator('.ca-auth .au-textbtn')).toBeDisabled()
    await page.clock.runFor(30_000)
    await expect(page.locator('.ca-auth .au-textbtn')).toBeEnabled()
    await locale(page,origin)
    await page.locator('.ca-auth .au-textbtn').click()
    await expectStored(page,'code.resent',true)
    await expect(page.locator('.ca-auth .au-textbtn')).toBeDisabled()
    await page.keyboard.press('Escape')
  }
  expect(requests).toEqual([])
})

test('auth provider preview toasts translate without completing signup or contacting providers',async({page})=>{
  const requests=await fixture(page)
  for(const provider of ['Google','Apple'] as const){
    await open(page,'signup')
    await page.locator('.au-btns button').nth(provider==='Google'?0:1).click()
    for(const [index,language] of languages.entries()){
      await locale(page,language)
      await expect(page.locator('.ca-code-toast.show')).toHaveText(staticCopy[provider==='Google'?'Google 인증 완료':'Apple 인증 완료'][index])
      await expect(page.locator('output')).toHaveText('')
    }
    await page.keyboard.press('Escape')
  }
  expect(requests).toEqual([])
})
