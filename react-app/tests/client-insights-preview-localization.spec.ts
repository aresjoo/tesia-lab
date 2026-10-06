import { expect, test, type Page } from '@playwright/test'
import { CLIENT_INSIGHTS } from '../src/client-insight-fixtures'
import { TEST_ORIGIN } from './test-origin'

test.use({ trace: 'off', video: 'off' })
test.setTimeout(120_000)
const languages = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const
async function changeLanguage(page: Page, language: string) {
  await page.evaluate(async language => { const p='/src/client-preferences.ts'; (await import(p)).setClientPreference('language',language) }, language)
}
async function mount(page: Page, supplied = false) {
  const requests: string[] = []
  await page.route('**/*', route => {
    const url = new URL(route.request().url())
    if (url.origin !== TEST_ORIGIN || url.pathname.startsWith('/api/')) { requests.push(route.request().method()+' '+url.pathname); return route.abort('blockedbyclient') }
    if (url.pathname === '/insight-localization-test.html') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#000"></body></html>' })
    return route.continue()
  })
  await page.goto('/insight-localization-test.html')
  await page.evaluate(async supplied => {
    const refresh='/@react-refresh'; const runtime=(await import(refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window,{$RefreshReg$:()=>{},$RefreshSig$:()=> (type:unknown)=>type,__vite_plugin_react_preamble_installed__:true})
    await Promise.all(['/node_modules/@fontsource-variable/noto-sans-kr/index.css','/node_modules/@fontsource-variable/geist/index.css'].map(path=>import(path)))
    const rp='/@id/react',dp='/@id/react-dom/client',cp='/src/components/ClientInsights.tsx',fp='/src/client-insight-fixtures.ts'
    const react=await import(rp),dom=await import(dp),{ClientInsights}=await import(cp),{CLIENT_INSIGHTS}=await import(fp)
    const host=document.createElement('div');document.body.append(host)
    const root=(dom.createRoot??dom.default.createRoot)(host)
    let location: {slug?:string} = {}
    const asks:string[]=[],votes:unknown[]=[]
    const data=supplied?{identity:'REAL_CALLER_FIXTURE',heading:'실제 공급 제목',subheading:'실제 공급 설명',periodLabel:'실제 공급 기간',articles:CLIENT_INSIGHTS.map((p:object)=>({...p,authorName:'실제 작성자',publishedAt:'2026-09-13T12:00:00Z'}))}:undefined
    const render=()=>root.render((react.createElement??react.default.createElement)(ClientInsights,{source:supplied?'service':'source-preview',data,signedIn:true,controlledLocation:location,onNavigate:(next:typeof location)=>{location=next;render()},onAsk:(text:string)=>{asks.push(text)},onFeedback:async(slug:string,value:number)=>{votes.push([slug,value])}}))
    Object.assign(window,{insightLocaleNavigate:(slug?:string)=>{location={slug};render()},insightLocaleAsks:asks,insightLocaleVotes:votes})
    render()
  }, supplied)
  await expect(page.locator('.client-insights')).toBeVisible()
  await page.evaluate(()=>document.fonts.ready)
  return requests
}

test('all 15 editorial articles translate across seven retained locales without changing routes or feedback', async ({ page }) => {
  const requests=await mount(page)
  for(const language of ['en',...languages.filter(l=>l!=='en')]){
    await changeLanguage(page,language)
    for(const original of CLIENT_INSIGHTS){
      await page.evaluate(slug=>Reflect.get(window,'insightLocaleNavigate')(slug),original.slug)
      const title=page.locator('.nfz-a h1')
      await expect(title).toBeVisible()
      if(language==='ko') await expect(title).toHaveText(original.title)
      else await expect(page.locator('.nfz-a')).not.toContainText(/[가-힣]/)
      for(const label of await page.locator('.nfz-social [aria-label]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('aria-label')))){
        if(language!=='ko') expect(label).not.toMatch(/[가-힣]/)
      }
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
  }
  expect(requests).toEqual([])
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
})

test('caller-supplied service articles remain unchanged in every locale', async ({ page }) => {
  const requests=await mount(page,true),original=CLIENT_INSIGHTS[0]
  await page.evaluate(slug=>Reflect.get(window,'insightLocaleNavigate')(slug),original.slug)
  const before=await page.locator('.nfz-body').innerText()
  for(const language of languages){
    await changeLanguage(page,language)
    await expect(page.locator('.nfz-a h1')).toHaveText(original.title)
    await expect(page.locator('.nfz-a .deck')).toHaveText(original.sub)
    expect(await page.locator('.nfz-body').innerText()).toBe(before)
    await expect(page.locator('.nfz-meta')).toContainText('실제 작성자')
  }
  expect(requests).toEqual([])
})

test('tag results use a complete localized count sentence and keep the original Korean copy', async ({ page }) => {
  const requests = await mount(page), original = CLIENT_INSIGHTS[0], tag = original.tags[0]
  const count = CLIENT_INSIGHTS.filter(article => article.tags.includes(tag)).length
  const expected = [String(count) + '개의 인사이트', String(count) + (count === 1 ? ' insight' : ' insights'), String(count) + '件のインサイト', String(count) + '条洞察', String(count) + '則洞察', String(count) + (count === 1 ? ' insight' : ' insights'), String(count) + (count === 1 ? ' insight' : ' insights')]
  for (const [index, language] of languages.entries()) {
    await changeLanguage(page, language)
    await page.evaluate(slug => Reflect.get(window, 'insightLocaleNavigate')(slug), original.slug)
    await page.locator('.nfz-tags button').first().click()
    await expect(page.locator('.nfz-sh .s').first()).toContainText(expected[index])
  }
  expect(requests).toEqual([])
})

test('preview adapter preserves Korean bytes, metadata, bold spans and every SVG attribute', async ({ page }) => {
  await mount(page)
  const result=await page.evaluate(async()=>{
    const ap='/src/client-insights-preview-locale-copy.ts',fp='/src/client-insight-fixtures.ts',jp='/src/client-insights-preview-locale-copy.json'
    const {localizeInsightPreview,localizeInsightFigure,insightUiNotice}=await import(ap)
    const {CLIENT_INSIGHTS,INSIGHT_FIGURES}=await import(fp),{default:copy}=await import(jp)
    const source={identity:'CLIENT_EDITORIAL_FIXTURE',heading:'고정 제목',subheading:'고정 설명',articles:CLIENT_INSIGHTS.map((a:object)=>({...a,authorName:'Sarah Bennett',publishedAt:'2026-09-13T12:00:00Z'}))}
    const original=JSON.stringify(source)
    const strip=(a:Record<string,unknown>)=>({meta:Object.fromEntries(Object.entries(a).filter(([key])=>!['title','sub','cat','body','assets'].includes(key))),assets:(a.assets as string[][]).map(asset=>[asset[0],...asset.slice(2)])})
    const stripSvg=(s:string)=>s.replace(/(<text\b[^>]*>)[^<]*(<\/text>)/g,'$1$2')
    const result=['ko','en','ja','zh-CN','zh-TW','es','fr'].map(language=>{
      const data=localizeInsightPreview(source,language)
      return {language,sameKo:language!=='ko'||data===source,identity:data.identity,
        metadata:JSON.stringify(data.articles.map(strip))===JSON.stringify(source.articles.map(strip)),
        unknownUnchanged:insightUiNotice(language,{literal:CLIENT_INSIGHTS[0].title})===CLIENT_INSIGHTS[0].title,
        bold:data.articles.every((a:{body:unknown},i:number)=>(JSON.stringify(a.body).match(/\*\*/g)??[]).length===(JSON.stringify(CLIENT_INSIGHTS[i].body).match(/\*\*/g)??[]).length),
        figures:Object.values(INSIGHT_FIGURES).map(svg=>{
          const localized=localizeInsightFigure(svg,language)
          const measure=document.createElement('div');measure.style.cssText='position:fixed;left:0;top:0;width:800px;visibility:hidden;pointer-events:none'
          measure.innerHTML=localized;document.body.append(measure)
          const overflow=[...measure.querySelectorAll<SVGGraphicsElement>('svg text')].map(node=>{const b=node.getBBox();return {text:node.textContent,left:b.x,right:b.x+b.width}}).filter(b=>b.left<0||b.right>800)
          measure.remove()
          return {exactGeometry:stripSvg(localized)===stripSvg(svg),noKo:language==='ko'||!/[가-힣]/.test(localized),koExact:language!=='ko'||localized===svg,overflow}})}
    })
    return {result,sourceUnchanged:JSON.stringify(source)===original,keys:Object.keys(copy).length,
      complete:Object.values(copy).every(row=>['en','ja','zh-CN','zh-TW','es','fr'].every(l=>typeof row[l]==='string'&&row[l].length&&!/[가-힣]/.test(row[l])))}
  })
  expect(result.keys).toBe(204);expect(result.complete).toBe(true);expect(result.sourceUnchanged).toBe(true)
  for(const row of result.result){expect(row.sameKo).toBe(true);expect(row.identity).toBe('CLIENT_EDITORIAL_FIXTURE');expect(row.metadata).toBe(true);expect(row.unknownUnchanged).toBe(true);expect(row.bold).toBe(true);for(const figure of row.figures)expect(figure,row.language).toEqual({exactGeometry:true,noKo:true,koExact:true,overflow:[]})}
})

test('asset question keeps canonical request and user text verbatim; changing language never sends', async ({ page }) => {
  const requests=await mount(page)
  await page.evaluate(slug=>Reflect.get(window,'insightLocaleNavigate')(slug),CLIENT_INSIGHTS[0].slug)
  await changeLanguage(page,'fr')
  await page.locator('.nfz-ast').first().click()
  const input=page.locator('.nfz-dialog textarea')
  const own='사용자 원문 {title} $& — keep this'
  await input.fill(own)
  await changeLanguage(page,'ja')
  await expect(input).toHaveValue(own)
  expect(await page.evaluate(()=>Reflect.get(window,'insightLocaleAsks'))).toEqual([])
  await page.locator('.nfz-dialog button[type="submit"]').click()
  await expect(page.locator('.nfz-dialog')).toHaveCount(0)
  const asks=await page.evaluate(()=>Reflect.get(window,'insightLocaleAsks'))
  expect(asks).toHaveLength(1);expect(asks[0]).toContain(own)
  const source = CLIENT_INSIGHTS[0], asset = source.assets[0]
  expect(asks[0]).toBe(`${asset[1]}(${asset[0]})의 현재 시장 상태를 분석해줘. 최근 가격 흐름, 주요 뉴스, 변동성, 핵심 기술적 구간과, 방금 읽은 인사이트 "${source.title}" 내용과의 관련성을 함께 설명해줘. 추가로 궁금한 점: ${own}`)
  expect(requests).toEqual([])
})
