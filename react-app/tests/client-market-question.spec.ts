import { expect, test, type Page } from '@playwright/test'
import type { MarketQuestionPresentation } from '../src/client-market-question-presentation'
import { marketQuestionText } from '../src/client-market-question-copy'

const presentation: MarketQuestionPresentation = {
  binding: { scopeId: 'owner-a/conversation-a', messageId: 'answer-a', observationId: 'question-a' },
  steps: [
    { id: 'assets', title: '어떤 자산이 궁금한가요?', multi: true, options: [{ id: 'btc', label: '비트코인', description: '공급된 설명' }, { id: 'eth', label: '이더리움' }] },
    { id: 'period', title: '어느 기간을 볼까요?', options: [{ id: 'week', label: '최근 일주일' }, { id: 'month', label: '최근 한 달' }] },
    { id: 'topic', title: '어떤 내용이 궁금한가요?', options: [{ id: 'price', label: '가격 흐름' }, { id: 'news', label: '주요 뉴스' }] },
  ],
}
async function mount(page: Page, initial = presentation, mode = 'accept') {
  await page.route('**/question-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#0f1012"></body></html>' }))
  await page.goto('/question-test.html')
  await page.evaluate(async ({ initial, mode }) => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    for (const path of ['/node_modules/@fontsource-variable/noto-sans-kr/index.css', '/src/client-reference.css', '/src/client-conversation.css', '/src/client-main-experience.css']) await import(/* @vite-ignore */ path)
    const rp = '/@id/react', dp = '/@id/react-dom/client', cp = '/src/components/ClientResponseSequence.tsx', pp = '/src/client-preferences.ts'
    const react = await import(/* @vite-ignore */ rp), dom = await import(/* @vite-ignore */ dp), { ClientResponseSequence } = await import(/* @vite-ignore */ cp), { setClientPreference } = await import(/* @vite-ignore */ pp)
    document.body.innerHTML = '<main class="client-source-app client-lab-conversation" style="max-width:700px;padding:16px;box-sizing:border-box;margin:auto;height:auto;display:block;font-family:Noto Sans KR Variable,sans-serif"><div id="question-test"></div><textarea aria-label="대화 입력">미전송 원문</textarea></main>'
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('question-test')!), h = react.createElement ?? react.default.createElement
    const calls: unknown[] = [], signals: AbortSignal[] = []
    let resolve: (result: boolean) => void = () => {}, currentMode = mode, current = initial, busy = false
    const actions = () => ({ busy, submit: currentMode === 'missing' ? undefined : async (answer: unknown, signal: AbortSignal) => {
      calls.push(answer); signals.push(signal)
      if (currentMode === 'throw') throw new Error('TEST_ONLY')
      if (currentMode === 'pending') return new Promise<boolean>(done => { resolve = done })
      return currentMode === 'accept'
    }, write: () => { if (currentMode === 'throw-write') throw new Error('WRITE_TEST_ONLY'); document.querySelector<HTMLTextAreaElement>('textarea')!.focus(); return true } })
    const render = () => root.render(h(react.StrictMode ?? react.default.StrictMode, null, h(ClientResponseSequence, { source: 'service', blocks: [{ id: 'question', kind: 'market-question', presentation: current }], questionActions: actions() })))
    Object.assign(window, { questionCalls: calls, questionSignals: signals, questionResolve: (result: boolean) => resolve(result), questionRender: (value: typeof initial) => { current = value; render() }, questionMode: (value: string) => { currentMode = value; render() }, questionBusy: (value: boolean) => { busy = value; render() }, questionLanguage: (value: string) => setClientPreference('language', value), questionUnmount: () => root.unmount() })
    setClientPreference('language', 'ko'); render()
  }, { initial, mode })
  await expect(page.locator('.g-askcard')).toBeVisible()
}
const go = (page: Page) => page.locator('.g-askcard .go').click()
async function finish(page: Page) {
  await page.getByRole('button', { name: '비트코인', exact: false }).click()
  await go(page); await page.getByRole('button', { name: '최근 한 달', exact: true }).click()
  await page.getByRole('button', { name: '주요 뉴스', exact: true }).click()
}
const callCount = (page: Page) => page.evaluate(() => (Reflect.get(window, 'questionCalls') as unknown[]).length)

test('f5070e0 forced colors keep selected options visible without moving rows',async({page})=>{
  await page.emulateMedia({forcedColors:'active',reducedMotion:'reduce'})
  await mount(page)
  await page.evaluate(()=>document.fonts.ready)
  const option=page.getByRole('button',{name:'비트코인',exact:false})
  const before=await option.boundingBox()
  await option.click()
  await page.getByRole('button',{name:'다음 질문',exact:true}).first().focus()
  await expect(option).toHaveCSS('outline-style','solid')
  await expect(option).toHaveCSS('outline-width','2px')
  expect(await option.boundingBox()).toEqual(before)
})

test('원본 다단계 단일·복수 선택을 모아 확정된 전송 뒤에만 요약한다', async ({ page }) => {
  await mount(page, presentation, 'pending')
  await page.getByRole('button', { name: '이더리움', exact: true }).click()
  await finish(page)
  await expect(page.locator('.g-askcard')).toHaveAttribute('aria-busy', 'true')
  await expect(page.locator('.g-usum')).toHaveCount(0)
  await expect(page.locator('.go')).toBeDisabled()
  expect(await callCount(page)).toBe(1)
  expect(await page.evaluate(() => Reflect.get(window, 'questionCalls')[0])).toEqual({ binding: presentation.binding, mode: 'selection', rows: [
    { stepId: 'assets', title: '어떤 자산이 궁금한가요', optionIds: ['btc', 'eth'], labels: ['비트코인', '이더리움'] },
    { stepId: 'period', title: '어느 기간을 볼까요', optionIds: ['month'], labels: ['최근 한 달'] },
    { stepId: 'topic', title: '어떤 내용이 궁금한가요', optionIds: ['news'], labels: ['주요 뉴스'] },
  ], text: '어떤 자산이 궁금한가요: 비트코인, 이더리움 / 어느 기간을 볼까요: 최근 한 달 / 어떤 내용이 궁금한가요: 주요 뉴스 기준으로 진행해줘' })
  await page.evaluate(() => Reflect.get(window, 'questionResolve')(true))
  await expect(page.locator('.g-usum .rw')).toHaveCount(3)
  await expect(page.locator('.g-askcard')).toHaveCount(0)
  await expect(page.getByLabel('대화 입력')).toHaveValue('미전송 원문')
})

test('패널 직접 답변·7언어 변경과 단계 왕복은 대화 초안을 보존한다', async ({ page }) => {
  await mount(page)
  await page.getByRole('button', { name: '직접 답변 작성', exact: true }).click()
  const free=page.locator('.op.free input')
  await expect(free).toBeFocused();await free.fill('매주 10만원만')
  for(const language of ['ko','en','ja','zh-CN','zh-TW','es','fr'] as const){
    await page.evaluate(language=>Reflect.get(window,'questionLanguage')(language),language)
    await expect(free).toHaveValue('매주 10만원만')
    await expect(page.getByLabel('대화 입력')).toHaveValue('미전송 원문')
  }
  await page.evaluate(()=>Reflect.get(window,'questionLanguage')('ko'))
  await page.getByRole('button',{name:'확인',exact:true}).click()
  await expect(page.locator('.pg')).toContainText('3개 중 2')
  await page.getByRole('button',{name:'이전 질문',exact:true}).click()
  await expect(free).toHaveValue('매주 10만원만')
  expect(await callCount(page)).toBe(0)
})

test('빈 직접답변과 1,000자 초과 합성답변은 초안을 보존하며 제출하지 않는다',async({page})=>{
  await mount(page)
  await page.getByRole('button',{name:'직접 답변 작성',exact:true}).click()
  await page.getByRole('button',{name:'확인',exact:true}).click()
  await expect(page.locator('.ask-notice')).toContainText('답을 적어')
  await page.locator('.op.free input').fill('가'.repeat(1000))
  await page.getByRole('button',{name:'확인',exact:true}).click()
  await page.getByRole('button',{name:'최근 한 달',exact:true}).click()
  await page.getByRole('button',{name:'주요 뉴스',exact:true}).click()
  await expect(page.locator('.ask-notice')).toContainText('1,000자')
  expect(await callCount(page)).toBe(0)
})

for (const mode of ['reject', 'throw', 'missing']) test(`${mode}: 실패·미연결은 선택을 지우거나 요약을 만들지 않는다`, async ({ page }) => {
  await mount(page, presentation, mode); await finish(page)
  await expect(page.locator('.ask-notice')).toContainText(mode === 'missing' ? '현재 대화' : '전달하지 못했습니다')
  await expect(page.getByRole('button', { name: '주요 뉴스', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.g-usum')).toHaveCount(0)
  await page.evaluate(() => Reflect.get(window, 'questionMode')('accept')); await go(page)
  await expect(page.locator('.g-usum')).toBeVisible()
})

test('미선택·busy 안내 후 복구와 AI 판단의 명시 전송을 구별한다', async ({ page }) => {
  await mount(page); await go(page)
  await expect(page.locator('.ask-notice')).toContainText('선택지를 하나')
  expect(await callCount(page)).toBe(0)
  await page.evaluate(() => Reflect.get(window, 'questionBusy')(true))
  await page.getByRole('button', { name: 'AI가 알아서 판단', exact: true }).click()
  await expect(page.locator('.ask-notice')).toContainText('이전 답변')
  expect(await callCount(page)).toBe(0)
  await page.evaluate(() => Reflect.get(window, 'questionBusy')(false))
  await page.getByRole('button', { name: 'AI가 알아서 판단', exact: true }).click()
  await expect(page.locator('.g-askcard')).toHaveCount(0)
  expect(await page.evaluate(() => Reflect.get(window, 'questionCalls')[0])).toEqual({ binding: presentation.binding, mode: 'delegate', rows: [], text: '세부 조건은 알아서 합리적으로 판단해서 바로 진행해줘' })
})

test('닫기는 아무 답변도 보내지 않고 언어·같은 메시지 재렌더 뒤에도 닫힌다', async ({ page }) => {
  await mount(page)
  await page.getByRole('button', { name: '질문 카드 닫기' }).click()
  await page.evaluate(value => { Reflect.get(window, 'questionRender')(value); Reflect.get(window, 'questionLanguage')('en') }, presentation)
  await expect(page.locator('.g-askcard,.g-usum')).toHaveCount(0)
  expect(await callCount(page)).toBe(0)
})

for (const change of ['owner', 'message', 'observation', 'close', 'unmount']) test(`${change}: 지연된 전송 응답은 새로운 질문을 닫지 않는다`, async ({ page }) => {
  await mount(page, presentation, 'pending'); await finish(page)
  if (change === 'close') await page.getByRole('button', { name: '질문 카드 닫기' }).click()
  else if (change === 'unmount') await page.evaluate(() => Reflect.get(window, 'questionUnmount')())
  else {
    const next = structuredClone(presentation)
    if (change === 'owner') next.binding.scopeId = 'owner-b/conversation-b'
    if (change === 'message') next.binding.messageId = 'answer-b'
    if (change === 'observation') next.binding.observationId = 'question-b'
    await page.evaluate(value => Reflect.get(window, 'questionRender')(value), next)
    await expect(page.locator('.g-askcard .t')).toHaveText(presentation.steps[0].title)
  }
  expect(await page.evaluate(() => Reflect.get(window, 'questionSignals')[0].aborted)).toBe(true)
  await page.evaluate(() => Reflect.get(window, 'questionResolve')(true))
  await expect(page.locator('.g-usum')).toHaveCount(0)
  if (!['close', 'unmount'].includes(change)) await expect(page.getByRole('button', { name: '비트코인', exact: false })).toHaveAttribute('aria-pressed', 'false')
})

test('320px 긴 원문·7언어의 옵션/버튼은 겹치거나 가로로 넘치지 않는다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 800 })
  const long = structuredClone(presentation)
  long.steps[0].title = '장문 질문 '.repeat(25)
  long.steps[0].options[0].description = '<script>literal</script> ' + 'LONG_UNBROKEN'.repeat(20)
  await mount(page, long)
  for (const language of ['ko','en','ja','zh-CN','zh-TW','es','fr'] as const) {
    await page.evaluate(language => Reflect.get(window, 'questionLanguage')(language), language)
    await expect(page.locator('.skipb')).toHaveText(marketQuestionText(language, 'delegate'))
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const overlap = await page.locator('.g-askcard').evaluate(card => {
      const boxes = Array.from(card.querySelectorAll('button')).filter(button => !button.disabled).map(button => {
        const r=button.getBoundingClientRect(),box={left:r.left,right:r.right,top:r.top,bottom:r.bottom}
        for(let parent=button.parentElement;parent&&parent!==card;parent=parent.parentElement){
          const style=getComputedStyle(parent),p=parent.getBoundingClientRect()
          if (/(auto|scroll|hidden|clip)/.test(style.overflowY)){box.top=Math.max(box.top,p.top);box.bottom=Math.min(box.bottom,p.bottom)}
          if (/(auto|scroll|hidden|clip)/.test(style.overflowX)){box.left=Math.max(box.left,p.left);box.right=Math.min(box.right,p.right)}
        }
        return box
      }).filter(box=>box.right>box.left&&box.bottom>box.top)
      return boxes.some((a, i) => boxes.slice(i + 1).some(b => Math.min(a.right, b.right) > Math.max(a.left, b.left) && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top)))
    })
    expect(overlap).toBe(false)
  }
  await expect(page.locator('#question-test script')).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('question-fr-320.png'), fullPage: true })
})

test('원본 4질문·6옵션과 단일선택 자동다음 및 키보드를 계승한다',async({page})=>{
  const many={...presentation,steps:Array.from({length:5},(_,i)=>({id:`s${i}`,title:`질문 ${i}`,options:Array.from({length:10},(_,j)=>({id:`o${j}`,label:`선택 ${j}`}))}))}
  await mount(page,many)
  await expect(page.locator('.op')).toHaveCount(7)
  await expect(page.locator('.pg')).toContainText('4개 중 1')
  await page.getByRole('button',{name:'선택 0',exact:true}).focus();await page.keyboard.press('Space')
  await expect(page.locator('.pg')).toContainText('4개 중 2')
  await expect(page.locator('.t')).toBeFocused()
  await page.getByRole('button',{name:'이전 질문',exact:true}).click()
  await expect(page.getByRole('button',{name:'선택 0',exact:true})).toHaveAttribute('aria-pressed','true')
})
