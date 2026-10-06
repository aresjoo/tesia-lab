import { test, expect } from '@playwright/test'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { CLIENT_PUBLIC_ASSETS } from '../src/client-public-assets'

test('원본 artwork KO8: 숫자·4행·캡처비율·plot ROI 비변조·실API0 관측',async({baseURL},info)=>{
  test.setTimeout(120_000)
  const output=process.env.TETH_ARTWORK_OUTPUT ? path.join(process.env.TETH_ARTWORK_OUTPUT,info.project.name+'-artwork-capture') : info.outputPath('artwork-capture')
  const result=await promisify(execFile)(process.execPath,['scripts/capture-client-artwork.mjs',baseURL!,output,'ko'],{cwd:process.cwd(),maxBuffer:100000})
  expect(JSON.parse(result.stdout).status).toBe('PASS')
  const receipt=JSON.parse(await readFile(path.join(output,'receipt.json'),'utf8'))
  expect(receipt.captures).toHaveLength(8)
  expect(receipt.originalsUnchanged).toBe(true)
  expect(receipt.blocked).toEqual([]);expect(receipt.errors).toEqual([])
  expect(receipt.apiRequests).toBe(0);expect(receipt.accountMutations).toBe(0)
  expect(receipt.originalPixelParity).toBe(false)
  for(const image of receipt.captures){
    expect(image.geometry.documentOverflow).toBe(false)
    expect(image.metrics.return).toBeCloseTo(2085.612206381291,8)
    expect(image.metrics.trades).toBe(13)
  }
  expect(receipt.captures.find((image:{id:string})=>image.id==='about-live').frozenPlot.differentBytes).toBe(0)
  const mobile=receipt.captures.find((image:{id:string})=>image.id==='dl-report')
  expect(mobile.geometry.keyMetrics).toHaveLength(5)
  expect(mobile.geometry.keyMetrics.every((metric:{visible:boolean;fontSize:number})=>metric.visible&&metric.fontSize>=13)).toBe(true)
})

test('공개 이미지 7언어 in-place 전환: 원KO·치수·노드·다운로드 선택 유지',async({page},info)=>{
  test.setTimeout(120_000)
  await page.emulateMedia({reducedMotion:'reduce'})
  const errors:string[]=[],blocked:string[]=[]
  page.on('pageerror',error=>errors.push(error.message))
  await page.route('**/*',route=>{
    const request=route.request(),url=new URL(request.url())
    if(url.origin!==new URL(info.project.use.baseURL!).origin||request.method()!=='GET'||/^\/(api|auth)\//.test(url.pathname)){blocked.push(url.pathname);return route.abort()}
    return route.continue()
  })
  for(const route of ['/about/','/download/']){
    await page.goto(route)
    const images=page.locator(route==='/about/'?'.ab img[src*="/client-shots/"]':'.phone-preview .scr img')
    await expect(images).toHaveCount(route==='/about/'?5:3)
    const before=await images.evaluateAll(nodes=>nodes.map(node=>({src:node.getAttribute('src')!,width:node.getAttribute('width'),height:node.getAttribute('height')})))
    const nodes=await images.elementHandles()
    if(route==='/download/')await page.getByRole('tab').nth(1).click()
    for(const language of ['en','ja','zh-CN','zh-TW','es','fr','ko'] as const){
      await page.evaluate(async language=>{const {setClientPreference}=await import('/src/client-preferences.ts');setClientPreference('language',language)},language)
      await expect(page.locator('html')).toHaveAttribute('lang',language)
      for(let i=0;i<before.length;i++){
        const image=images.nth(i),item=before[i]
        await expect(image).toHaveAttribute('src',language==='ko'?item.src:'/client-shots/localized/'+language+'/'+item.src.split('/').at(-1))
        await expect(image).toHaveAttribute('width',item.width!)
        await expect(image).toHaveAttribute('height',item.height!)
        expect(await image.evaluate((node,original)=>node===original,nodes[i])).toBe(true)
        if(route==='/about/')await image.scrollIntoViewIfNeeded()
        else if(i!==1)continue
        await expect.poll(()=>image.evaluate(node=>(node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
      }
      if(route==='/download/')await expect(page.locator('.slide.on')).toHaveAttribute('data-screen','report')
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
    }
  }
  expect(errors).toEqual([]);expect(blocked).toEqual([])
})

test('locale 자산48 명시allowlist·hash·lossless·원8불변 provenance',async()=>{
  const provenance=JSON.parse(await readFile('tests/fixtures/client-artwork-provenance.json','utf8'))
  const hash=(value:Buffer)=>createHash('sha256').update(value).digest('hex')
  expect(provenance.captures).toHaveLength(48)
  expect(new Set(provenance.captures.map((c:{url:string})=>c.url)).size).toBe(48)
  for(const capture of provenance.captures){
    expect(CLIENT_PUBLIC_ASSETS).toContain(capture.url)
    const file=await readFile(path.join('public',capture.url))
    expect(hash(file)).toBe(capture.sha256)
    expect(capture.encoding.differentBytes).toBe(0)
    expect(capture.sourceVisibleContent.every((item:{visible:boolean})=>item.visible)).toBe(true)
    if(capture.id==='dl-live'){
      const last=capture.sourceVisibleContent.at(-1)
      expect(last.text).toContain('09/22 08:00:42')
      expect(last.text).toContain('ADA')
    }
    if(capture.id==='dl-report'){
      expect(capture.keyMetrics).toHaveLength(5)
      expect(capture.keyMetrics.every((metric:{visible:boolean;fontSize:number})=>metric.visible&&metric.fontSize>=13)).toBe(true)
      expect(capture.keyMetrics.map((metric:{text:string})=>metric.text).join(' ')).toContain('20,856')
      expect(capture.keyMetrics.map((metric:{text:string})=>metric.text).join(' ')).toContain('1,395')
    }
    if(capture.id==='about-live')expect(capture.frozenPlot.differentBytes).toBe(0)
  }
  for(const [file,sha] of Object.entries(provenance.original))expect(hash(await readFile(path.join('public/client-shots',file)))).toBe(sha)
})
