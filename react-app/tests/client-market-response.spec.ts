import { expect, test, type Page } from '@playwright/test'
import type { ClientResponseBlock } from '../src/components/ClientResponseSequence'
import { marketResponseText } from '../src/client-market-response-copy'

const binding = { scopeId:'owner-a/conversation-a', messageId:'answer-a', observationId:'observation-a' }
const source = { id:'article-a', title:'확인한 원문 <script>not-executable</script>', url:'https://example.com/article', description:'공급된 기사 설명' }
const blocks: ClientResponseBlock[] = [
  {id:'price',kind:'market-price',presentation:{binding,asset:'BTC / USD',priceLabel:'61,234.567 USD',changeLabel:'−1.23%',changeBasis:'24H',tone:'down',sourceLabel:'SUPPLIED SOURCE',observedAtLabel:'2026-09-19 10:31 UTC',intervalLabel:'1시간봉'}},
  {id:'work',kind:'work',activity:{label:'확인한 작업',status:'done',steps:[{id:'search',title:'원문 확인',status:'done',detail:'공급된 관측 기록',sources:[source]}]}},
  {id:'text',kind:'text',text:'동일한 대화의 응답입니다. [GAUGE {"up":99}]',status:'done'},
  {id:'events',kind:'market-timeline',presentation:{binding,observedDaily:true,events:[{id:'event-a',dateLabel:'09.18',title:'공급된 사건 제목',mappedTradingDateLabel:'09.19',priceLabel:'61,234.567',changeLabel:'−1.23%',tone:'down',sourceLabel:'공급된 출처',sourceUrl:source.url}]}},
  {id:'evidence',kind:'market-evidence',presentation:{binding,searches:2,results:5,pagesRead:3,sources:[source]}},
  {id:'direction',kind:'market-direction',presentation:{binding,asset:'BTC / USD',symbol:'BTC',up:63,down:37,sourceLabel:'SUPPLIED OBSERVATION',observedAtLabel:'2026-09-19 10:31 UTC',hasMarketObservation:true,restored:true}},
]
async function mount(page: Page, initial = blocks) {
  await page.route('**/market-response-test.html', route => route.fulfill({ contentType:'text/html', body:'<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#0f1012"></body></html>' }))
  await page.goto('/market-response-test.html')
  await page.evaluate(async initial => {
    const refresh='/@react-refresh',runtime=(await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window,{$RefreshReg$:()=>{},$RefreshSig$:()=>(type:unknown)=>type,__vite_plugin_react_preamble_installed__:true})
    for(const path of ['/node_modules/@fontsource-variable/noto-sans-kr/index.css','/src/client-reference.css','/src/client-conversation.css','/src/client-main-experience.css']) await import(/* @vite-ignore */ path)
    const rp='/@id/react',dp='/@id/react-dom/client',cp='/src/components/ClientResponseSequence.tsx',pp='/src/client-preferences.ts'
    const react=await import(/* @vite-ignore */ rp),dom=await import(/* @vite-ignore */ dp),{ClientResponseSequence}=await import(/* @vite-ignore */ cp),{setClientPreference}=await import(/* @vite-ignore */ pp)
    document.body.innerHTML='<main id="market-test" class="client-source-app client-lab-conversation" style="max-width:680px;padding:16px;box-sizing:border-box;margin:auto;height:auto;display:block;font-family:Noto Sans KR Variable,sans-serif"></main>'
    const root=(dom.createRoot??dom.default.createRoot)(document.getElementById('market-test')!)
    const h=react.createElement??react.default.createElement
    const render=(items:unknown)=>root.render(h(ClientResponseSequence,{source:'service',blocks:items}))
    Object.assign(window,{marketRender:render,marketLanguage:(language:string)=>setClientPreference('language',language),marketUnmount:()=>root.unmount()})
    setClientPreference('language','ko');render(initial)
  },initial)
  await expect(page.locator('.g-pxcard')).toBeVisible()
}
async function render(page: Page, value: ClientResponseBlock[]) { await page.evaluate(value=>Reflect.get(window,'marketRender')(value),value) }

test('원본 시장 카드·사건·근거·게이지는 같은 대화 순서와 공급 문자열을 유지한다',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await mount(page)
  expect(await page.locator('#market-test > *').evaluateAll(nodes=>nodes.map(node=>node.className))).toEqual(['g-pxcard client-market-response','g-act2  fin','g-amsg','g-evtl client-market-response','g-srcstrip client-market-response','g-gauge client-market-response'])
  await expect(page.locator('.pv')).toHaveText('61,234.567 USD')
  await expect(page.locator('.tl-map')).toHaveText('09.19 거래일 반영')
  await expect(page.locator('.tl-px')).toHaveText('61,234.567 −1.23%')
  await expect(page.locator('.g-gauge .lg .u')).toHaveAttribute('aria-label','상승 63%')
  await expect(page.locator('.g-gauge .t')).toContainText('검증된 확률 아님')
  await expect(page.locator('.g-amsg')).toContainText('[GAUGE {"up":99}]')
  await expect(page.locator('.g-srcstrip')).toContainText('웹 검색 2회, 결과 5개, 원문 3개')
})

test('출처 상세 키보드 펼침과 작업별 링크, 악성 주소·HTML 차단',async({page})=>{
  await mount(page)
  const summary=page.locator('.g-srcstrip summary');await summary.focus();await page.keyboard.press('Enter')
  const link=page.locator('.g-srcstrip a');await expect(link).toBeVisible();await page.keyboard.press('Tab');await expect(link).toBeFocused()
  await expect(link).toHaveAttribute('target','_blank');await expect(link).toHaveAttribute('rel','noopener noreferrer')
  await expect(page.locator('#market-test script')).toHaveCount(0)
  await page.locator('.g-act2 .hd').click();await page.locator('.g-act2 .arh').click();await expect(page.locator('.g-act2 a')).toBeVisible()
  const next=structuredClone(blocks);const evidence=next.find(b=>b.kind==='market-evidence')!;if(evidence.kind==='market-evidence')evidence.presentation.sources=[{...source,url:'javascript:alert(1)'},{...source,id:'credentials',url:'https://user:pass@example.com'}]
  await render(page,next);await expect(page.locator('.g-srcstrip a')).toHaveCount(0)
  await expect(page.locator('.g-srcstrip .srow')).toHaveCount(2)
})

test('7언어·320px 장문은 공급값을 바꾸거나 가로로 넘치지 않는다',async({page},info)=>{
  await page.setViewportSize({width:320,height:800});await mount(page)
  const next=structuredClone(blocks);const events=next.find(b=>b.kind==='market-timeline')!;if(events.kind==='market-timeline')events.presentation.events=[{...events.presentation.events[0],title:'아주 긴 사건 설명과 공급된 맥락을 그대로 읽을 수 있어야 합니다 '.repeat(8)}]
  await render(page,next)
  for(const language of ['ko','en','ja','zh-CN','zh-TW','es','fr'] as const){
    await page.evaluate(language=>Reflect.get(window,'marketLanguage')(language),language)
    await expect(page.locator('.tl-hd')).toContainText(marketResponseText(language,'timeline'))
    await expect(page.locator('.g-gauge .t')).toContainText(marketResponseText(language,'estimate'))
    await expect(page.locator('.pv')).toHaveText('61,234.567 USD')
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  }
  await page.screenshot({path:info.outputPath('market-fr-320.png'),fullPage:true})
})

test('누락·불일치·중복 자료는 확률·일봉·검색 근거를 만들어 채우지 않는다',async({page})=>{
  await mount(page)
  for(const invalid of [NaN,-1,101]){
    const next=structuredClone(blocks);const gauge=next.find(b=>b.kind==='market-direction')!;if(gauge.kind==='market-direction')gauge.presentation.up=invalid
    await render(page,next);await expect(page.locator('.g-gauge')).toHaveCount(0)
  }
  const next=structuredClone(blocks)
  for(const block of next){if(block.kind==='market-direction')block.presentation.hasMarketObservation=false;if(block.kind==='market-timeline')block.presentation.observedDaily=false;if(block.kind==='market-evidence')block.presentation.searches=-1}
  await render(page,next);await expect(page.locator('.g-gauge,.g-srcstrip,.tl-px,.tl-note')).toHaveCount(0)
  const duplicate=structuredClone(blocks);const events=duplicate.find(b=>b.kind==='market-timeline')!;if(events.kind==='market-timeline')events.presentation.events=[events.presentation.events[0],events.presentation.events[0]]
  await render(page,duplicate);await expect(page.locator('.g-evtl')).toHaveCount(0)
})

test('600ms 게이지는 공급값으로 보간하고 복원·감소설정은 최종값으로 고정한다',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});const now=new Date('2026-09-19T10:00:00Z');await page.clock.install({time:now});await page.clock.pauseAt(now)
  await mount(page)
  const next=structuredClone(blocks);const gauge=next.find(b=>b.kind==='market-direction')!;if(gauge.kind==='market-direction')gauge.presentation.restored=false
  await render(page,next);await expect(page.locator('.g-gauge .bar .u')).toHaveAttribute('style','transform: scaleX(0.5);')
  await page.clock.runFor(300)
  const intermediate=await page.locator('.g-gauge .bar .u').evaluate(el=>Number((el as HTMLElement).style.transform.slice(7,-1)))
  expect(intermediate).toBeGreaterThan(.5);expect(intermediate).toBeLessThan(.63)
  await page.clock.runFor(350);await expect(page.locator('.g-gauge .lg .u em')).toHaveText('63%')
  await render(page,blocks);await expect(page.locator('.g-gauge .bar .u')).toHaveAttribute('style','transform: scaleX(0.63);')
  await page.emulateMedia({reducedMotion:'reduce'});await render(page,next);await expect(page.locator('.g-gauge .lg .u em')).toHaveText('63%')
})

test('원본 사건 카드의 네 건 상한과 공급 순서를 유지한다',async({page})=>{
  await mount(page)
  const next=structuredClone(blocks),timeline=next.find(block=>block.kind==='market-timeline')!
  if(timeline.kind==='market-timeline')timeline.presentation.events=Array.from({length:6},(_,index)=>({...timeline.presentation.events[0],id:`event-${index}`,title:`공급 사건 ${index+1}`}))
  await render(page,next)
  await expect(page.locator('.g-evtl .tl-title')).toHaveText(['공급 사건 1','공급 사건 2','공급 사건 3','공급 사건 4'])
  await expect(page.locator('.g-evtl')).not.toContainText('공급 사건 5')
})

test('owner 관측 교체는 열린 출처·이전 애니메이션을 재사용하지 않는다',async({page})=>{
  await mount(page);await page.locator('.g-srcstrip summary').click();await expect(page.locator('.g-srcstrip details')).toHaveAttribute('open','')
  const next=structuredClone(blocks)
  for(const block of next)if('presentation' in block)block.presentation.binding={...binding,scopeId:'owner-b/conversation-b',observationId:'observation-b'}
  await render(page,next);await expect(page.locator('.g-srcstrip details')).not.toHaveAttribute('open','')
  await render(page,[]);await expect(page.locator('#market-test')).toBeEmpty()
})
