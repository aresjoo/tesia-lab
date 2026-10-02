import { expect, test, type Page } from '@playwright/test'

/** Supplied UI ports only, not proof of a backend multi-step producer. */
async function mount(page: Page, research = false, connected = true, single = false) {
  await page.route('**/native-market-question-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><div id="fixture" style="height:100dvh"></div></body></html>' }))
  await page.goto('/native-market-question-test.html')
  await page.evaluate(async ({ research, connected, single }) => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const cp = '/src/internal-poc/ClientServiceExperience.tsx', dp = '/@id/react-dom/client', pp = '/src/client-preferences.ts'
    const source = await (await fetch(cp)).text(), rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing Vite React instance')
    const rm = await import(/* @vite-ignore */ rp), react = rm.default ?? rm, dom = await import(/* @vite-ignore */ dp)
    const { ClientServiceExperience } = await import(/* @vite-ignore */ cp), { setClientPreference } = await import(/* @vite-ignore */ pp)
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture'))
    let input = '입력하던 초안', accountScope = 'owner-a', busy = false, accept = false, portScope = 'owner-a'
    const audit = { voidSends: 0, answers: [] as unknown[] }
    const binding = { scopeId: 'owner-a/conversation-a', messageId: 'question-message', observationId: 'observed-question' }
    const question = { id: 'question', kind: 'market-question', presentation: { binding, steps: [{ id: 'assets', title: '공급된 시장 확인 질문', multi: true, options: [{ id: 'btc', label: '비트코인' }] }] } }
    const message = { id: 'question-message', role: 'assistant', text: '공급된 응답',
      observation: { id: 'work-observation', label: ['확인한 작업'], status: 'done', steps: [], reply: ['관측된 답변 원문'] },
      responseBlocks: [{ id: 'ignored', kind: 'text', text: '관측을 덮어쓰면 안 되는 본문', status: 'done' }, question],
      ...(research ? { researchThread: { scopeId: 'research-a', documentId: 'plan' } } : {}),
    }
    const render = () => root.render(react.createElement(ClientServiceExperience, {
      nativeAccounts: true, accountScope,
      clarification: single ? { prompt: '서버가 공급한 단일 확인 질문', identity: 'single-question-identity' } : undefined,
      marketQuestionActions: connected ? { scope: portScope, submit: async (answer: unknown) => { audit.answers.push(answer); return accept } } : undefined,
      ...(research ? { researchPresentation: { scope: accountScope, data: { scopeId: 'research-a', status: 'done' } } } : {}),
      state: { phase: 'ready', sessionState: 'AUTHENTICATED', messages: [{ id: 'user-message', role: 'user', text: '시장에 대해 알고 싶어요', ...(research ? { researchThread: { scopeId: 'research-a', documentId: 'plan' } } : {}) }, message], input, busy, inputDisabled: false, source: 'service', recovery: null, quickReplies: single ? ['반등 조건 확인', '추세 조건 확인'] : [], workflow: null, outcome: null, issue: null,
        onInput: (value: string) => { input = value; render() }, onSend: async () => { audit.voidSends++ }, onReset: () => false, onRecover: undefined, onLogout: undefined,
      },
    }))
    Object.assign(window, { questionHostAudit: audit, questionHostAccept: () => { accept = true }, questionHostBusy: (value: boolean) => { busy = value; render() }, questionHostOwner: (value: string) => { accountScope = value; render() }, questionHostPort: (value: string) => { portScope = value; render() }, questionHostLanguage: (language: string) => setClientPreference('language', language), questionHostReplace: () => { question.presentation = { ...question.presentation, binding: { ...binding, observationId: 'new-question' }, steps: [{ ...question.presentation.steps[0], title: '새로 공급된 질문' }] }; render() } })
    Reflect.set(window, 'questionHostDetailed', () => {
      question.presentation = { ...question.presentation, steps: [{ id: 'assets', title: '어느 조건을 바꿔 볼까요?', multi: true,
        options: Array.from({ length: 6 }, (_, i) => ({ id: `choice-${i}`, label: `조건 ${i + 1}`, description: '기존 결과를 기준으로 확인할 설명입니다. 변경 전후를 비교하며 손실과 거래 빈도를 함께 살펴봅니다.' })) }] }
      render()
    })
    setClientPreference('language', 'ko'); render()
  }, { research, connected, single })
  if (research) await page.locator('[data-native-open-research]').click()
  await expect(page.locator('.g-askcard:visible')).toBeVisible()
  await expect.poll(() => page.locator('.g-askcard:visible').evaluate(el => getComputedStyle(el).opacity)).toBe('1')
}

for (const research of [false, true]) test(`${research ? '연구' : '일반'} 서버 단일 질문은 하나의 dock만 소유하고 닫기는 요청하지 않는다`, async ({ page }) => {
  await mount(page, research, true, true)
  await expect(page.locator('.client-question-dock .g-askcard')).toHaveCount(1)
  await expect(page.locator('.gclw h3')).toHaveText('서버가 공급한 단일 확인 질문')
  await expect(page.locator('.gclw .skipb,.gclw .pg')).toHaveCount(0)
  const composer = page.locator('.g-composer textarea'), node = await composer.elementHandle()
  await expect(composer).toBeHidden()
  await page.locator('.gclw .direct-trigger').click()
  const input = page.locator('.gclw .free input')
  await expect(input).toHaveValue('입력하던 초안')
  await input.fill('직접 편집한 질문')
  await page.evaluate(() => Reflect.get(window, 'questionHostLanguage')('fr'))
  await expect(input).toHaveValue('직접 편집한 질문')
  await page.locator('.gclw .x').click()
  await expect(composer).toBeVisible()
  await expect(composer).toBeFocused()
  await expect(composer).toHaveValue('직접 편집한 질문')
  expect(await node!.evaluate(el => el === document.querySelector('.g-composer textarea'))).toBe(true)
  expect(await page.evaluate(() => Reflect.get(window, 'questionHostAudit'))).toEqual({ voidSends: 0, answers: [] })
})

for(const research of [false,true])test(`f5070e0 ${research?'연구':'대화'} 질문 시트가 입력창을 대체하고 닫으면 같은 초안으로 복귀한다`,async({page},info)=>{
  await mount(page,research)
  const composer=page.locator('.g-composer textarea'),card=page.locator('.g-askcard:visible')
  await expect(composer).toBeHidden()
  await expect(composer).toHaveValue('입력하던 초안')
  await page.evaluate(()=>Reflect.set(window,'originalComposer',document.querySelector('.g-composer textarea')))
  await card.getByRole('button',{name:'직접 답변 작성',exact:true}).click()
  await card.getByRole('textbox').fill('사용자의 말 그대로')
  await page.screenshot({path:info.outputPath('source-question-sheet.png')})
  await card.getByRole('button',{name:'질문 카드 닫기',exact:true}).click()
  await expect(composer).toBeVisible()
  await expect(composer).toHaveValue('입력하던 초안')
  expect(await page.evaluate(()=>Reflect.get(window,'originalComposer')===document.querySelector('.g-composer textarea'))).toBe(true)
  expect(await page.evaluate(()=>Reflect.get(window,'questionHostAudit').answers.length)).toBe(0)
})

test('f5070e0 수락 요약은 원본 어두운 말풍선이며 수락 뒤 입력창을 복원한다',async({page})=>{
  await mount(page)
  await page.evaluate(()=>Reflect.get(window,'questionHostAccept')())
  await page.getByRole('button',{name:'비트코인',exact:true}).click()
  await page.locator('.g-askcard .go').click()
  const summary=page.locator('.g-usum')
  await expect(summary).toBeVisible()
  await expect(summary).toHaveCSS('border-radius','18px')
  await expect(summary.locator('.rw b')).toHaveCSS('color','rgb(205, 205, 205)')
  await expect(summary.locator('.rw span')).toHaveCSS('font-size','15px')
  expect(await summary.evaluate(el=>getComputedStyle(el).backgroundColor)).toBe(await page.locator('.g-umsg').first().evaluate(el=>getComputedStyle(el).backgroundColor))
  await expect(page.locator('.g-composer textarea')).toBeVisible()
})

for(const width of [320,768,1200])test(`${width}px: 최신 압축 질문 여섯 행의 설명과 직접 입력은 접근 가능하다`,async({page},info)=>{
  await page.setViewportSize({width,height:width===320?480:900})
  await mount(page)
  await page.evaluate(()=>Reflect.get(window,'questionHostDetailed')())
  if(width===1200)await page.locator('.client-lab-conversation').evaluate(el=>(el as HTMLElement).style.zoom='2')
  const card=page.locator('.g-askcard')
  await expect(card.locator('.op b')).toHaveCount(7)
  await expect.poll(()=>card.locator('button.op').evaluateAll(nodes=>nodes.every(el=>{
    const box=el.getBoundingClientRect()
    return Array.from(el.children).every(child=>{const r=child.getBoundingClientRect();return r.top>=box.top-1&&r.bottom<=box.bottom+1})
  }))).toBe(true)
  for(const option of await card.locator('button.op').all()){
    await option.scrollIntoViewIfNeeded()
    await expect(option).toBeInViewport()
    expect(await option.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)
  }
  await card.getByRole('button',{name:'직접 답변 작성',exact:true}).click()
  const input=card.getByRole('textbox')
  await expect(input).toBeFocused()
  // Focus must actually expose the input, not merely move DOM focus off screen.
  await expect.poll(()=>input.evaluate(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return hit===el})).toBe(true)
  await input.fill('손실을 줄이는 방향으로 확인해주세요')
  await card.getByRole('button',{name:'확인',exact:true}).click()
  await expect(card.locator('.ask-notice')).toContainText('전달하지 못했습니다')
  for(const control of [card.getByRole('button',{name:'질문 카드 닫기',exact:true}),card.locator('.ask-notice')])
    await expect.poll(()=>control.evaluate(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return !!hit&&el.contains(hit)})).toBe(true)
  await expect(page.locator('.g-composer textarea')).toHaveValue('입력하던 초안')
  await page.screenshot({path:info.outputPath('compact-question-detailed.png')})
})

for (const research of [false, true]) test(`${research ? '연구 문서' : '일반 대화'}: 관측 본문과 질문을 함께 표시하고 기존 컴포저를 보존한다`, async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await mount(page, research)
  const card = page.locator('.g-askcard:visible'), composer = page.locator('.g-composer textarea')
  await expect(page.getByText('관측된 답변 원문', { exact: true })).toBeVisible()
  await expect(page.getByText('관측을 덮어쓰면 안 되는 본문', { exact: true })).toHaveCount(0)
  await page.screenshot({ path: info.outputPath(`question-${research ? 'research' : 'conversation'}-card.png`), fullPage: true })
  await card.getByRole('button', { name: '비트코인', exact: true }).click()
  await expect(page.locator('.g-composer-wrap .client-question-dock .g-askcard:visible')).toBeVisible()
  await card.getByRole('button', { name: '직접 답변 작성', exact: true }).click()
  await card.getByRole('textbox').fill('직접 작성한 답변')
  await expect(composer).toHaveValue('입력하던 초안')
  await card.getByRole('button', { name: '비트코인', exact: true }).click()
  await card.locator('.go').click()
  await expect(card.locator('.ask-notice')).toContainText('전달하지 못했습니다')
  await expect(card.getByRole('button', { name: '비트코인', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.evaluate(() => Reflect.get(window, 'questionHostAccept')())
  await card.locator('.go').click()
  await expect(page.locator('.g-usum:visible')).toContainText('비트코인')
  await expect(composer).toHaveValue('입력하던 초안')
  expect(await page.evaluate(() => Reflect.get(window, 'questionHostAudit').voidSends)).toBe(0)
  expect(await page.evaluate(() => Reflect.get(window, 'questionHostAudit').answers.length)).toBe(2)
  expect(errors).toEqual([])
  await page.screenshot({ path: info.outputPath(`question-${research ? 'research' : 'conversation'}.png`), fullPage: true })
})

test('320px 실제 대화 셸에서 7언어 전환은 선택·입력·카드 DOM을 유지한다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 760 }); await mount(page)
  await page.getByRole('button', { name: '비트코인', exact: true }).click()
  await page.evaluate(() => Reflect.set(window, 'originalQuestionCard', document.querySelector('.g-askcard')))
  for (const language of ['ko','en','ja','zh-CN','zh-TW','es','fr']) {
    await page.evaluate(language => Reflect.get(window, 'questionHostLanguage')(language), language)
    await expect(page.getByRole('button', { name: '비트코인', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('.g-composer textarea')).toHaveValue('입력하던 초안')
    expect(await page.evaluate(() => Reflect.get(window, 'originalQuestionCard') === document.querySelector('.g-askcard'))).toBe(true)
    const box = await page.locator('.g-askcard').boundingBox()
    expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(320)
    expect(await page.locator('.g-askcard').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
  }
  await page.screenshot({ path: info.outputPath('question-native-fr-320.png'), fullPage: true })
})

test('기존 void 전송을 카드 수락으로 간주하지 않으며 별도 포트가 없으면 선택을 유지한다', async ({ page }) => {
  await mount(page, false, false)
  await page.getByRole('button', { name: '비트코인', exact: true }).click()
  await page.locator('.g-askcard .go').click()
  await expect(page.locator('.ask-notice')).toContainText('현재 대화')
  await expect(page.locator('.g-usum')).toHaveCount(0)
  expect(await page.evaluate(() => Reflect.get(window, 'questionHostAudit'))).toEqual({ voidSends: 0, answers: [] })
})

test('busy·다른 owner의 수락 포트는 응답을 전달하지 않는다', async ({ page }) => {
  await mount(page)
  await page.getByRole('button', { name: '비트코인', exact: true }).click()
  await page.evaluate(() => Reflect.get(window, 'questionHostBusy')(true))
  await page.locator('.g-askcard .go').click()
  await expect(page.locator('.ask-notice')).toContainText('이전 답변')
  await page.evaluate(() => { Reflect.get(window, 'questionHostBusy')(false); Reflect.get(window, 'questionHostPort')('owner-b') })
  await page.locator('.g-askcard .go').click()
  await expect(page.locator('.ask-notice')).toContainText('현재 대화')
  expect(await page.evaluate(() => Reflect.get(window, 'questionHostAudit').answers.length)).toBe(0)
})

for (const research of [false, true]) test(`${research ? '연구' : '일반'}: 같은 메시지의 질문 교체는 이전 직접입력 안내를 남기지 않는다`, async ({ page }) => {
  await mount(page, research)
  const card = page.locator('.g-askcard:visible'), composer = page.locator('.g-composer textarea')
  await card.getByRole('button', { name: '직접 답변 작성', exact: true }).click()
  await card.getByRole('textbox').fill('이전 질문의 직접 초안')
  await page.evaluate(() => Reflect.get(window, 'questionHostReplace')())
  await expect(card.locator('.t')).toHaveText('새로 공급된 질문')
  await expect(card.getByRole('textbox')).toHaveCount(0)
  await expect(composer).toHaveValue('입력하던 초안')
  await card.getByRole('button', { name: '직접 답변 작성', exact: true }).click()
  await expect(card.getByRole('textbox')).toHaveValue('')
  await expect(card.getByRole('textbox')).toBeFocused()

})

for(const width of [320,1200])test(`${width}px: 낮은 화면과 확대에서도 패널/기존 입력 조작을 사용할 수 있다`,async({page},info)=>{
  await page.setViewportSize({width,height:width===320?480:900})
  await mount(page)
  if(width===1200)await page.locator('.client-lab-conversation').evaluate(el=>(el as HTMLElement).style.zoom='2')
  const card=page.locator('.g-askcard'),composer=page.locator('.g-composer textarea')
  await card.getByRole('button',{name:'직접 답변 작성',exact:true}).click()
  await card.getByRole('textbox').fill('패널의 독립된 답변')
  await expect(composer).toHaveValue('입력하던 초안')
  await expect(composer).toBeHidden()
  await card.getByRole('button',{name:'확인',exact:true}).click()
  await expect(card.locator('.ask-notice')).toContainText('전달하지 못했습니다')
  await card.getByRole('button',{name:'질문 카드 닫기',exact:true}).click()
  await expect(card).toHaveCount(0)
  await expect(composer).toHaveValue('입력하던 초안')
  await page.screenshot({path:info.outputPath('question-short-or-zoom.png')})
})
