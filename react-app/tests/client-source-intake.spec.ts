import { expect, test, type Page } from '@playwright/test'
import type { ClientSession } from '../src/client-experience-store'
import copy from '../src/client-source-intake-copy.json' with { type: 'json' }
import { commonBacktestText } from '../src/client-common-backtest-copy'

const key = 'teth-client-experience', owner = 'intake@example.test'
const original: ClientSession = {
  id: 'intake-session', title: '이어지는 전략 대화', renamed: true, idea: '원래 투자 질문', draft: '전송 전 작성하던 문장',
  pair: 'BTC/USDT', mode: 'dip', timeframe: '1시간봉', risk: '−3%', takeProfit: '+8%', phase: 'plan',
  researchStatus: '초안', workspace: 'conversation', tradingReady: false, updatedAt: 1700000002000,
  turns: [{ id: 'original-turn', question: '원래 질문', answer: '공급된 답변', fullAnswer: '공급된 답변', status: 'done', phase: 'plan',
    startedAt: 1700000000000, finishedAt: 1700000002000, suggestions: [],
    followupActions: [{ id: 'delegate-intake', type: 'delegate_trade', label: '이 전략을 같이 만들어줘' }] }],
}
const read = (page: Page): Promise<ClientSession> => page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!).sessions[0], key)
async function open(page: Page, language = 'ko') {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ key, original, owner, language }) => {
    if (sessionStorage.getItem('intake-seeded')) return
    sessionStorage.setItem('intake-seeded', 'true'); localStorage.setItem('tethLang', language)
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '검수 사용자', email: owner }))
    // Migration compatibility: restore an already saved legacy questionnaire.
    // New run actions no longer create this fixed five-question form.
    const historical: ClientSession = { ...original, turns: [
      { ...original.turns[0], followupsConsumed: true },
      { id: 'historical-intake', question: '이 전략을 같이 만들어줘', answer: '', fullAnswer: '', suggestions: [], phase: 'plan',
        status: 'done', startedAt: 1700000002001, finishedAt: 1700000002001, sourceIntake: { answers: [] } },
    ] }
    sessionStorage.setItem(key, JSON.stringify({ currentId: original.id, sessions: [historical], homeDraft: '홈 초안', sharedFollows: [] }))
  }, { key, original, owner, language })
  await page.goto('/')
  await expect(page.locator('.g-composer textarea')).toHaveValue(original.draft)
  await expect(page.getByTestId('source-intake')).toHaveAttribute('data-answer-count', '0')
}
async function pick(page: Page, index: number) {
  await page.getByTestId('source-intake').last().locator('.intake-options button').nth(index).click()
}

for (const language of ['ko', 'fr'] as const) for (const zoom of [1, 2]) test(`${language} zoom ${zoom}: every question and stock summary focus remains visible`, async ({ page }, info) => {
  await page.setViewportSize({ width: 640, height: 720 })
  await open(page, language)
  await page.evaluate(zoom => { document.documentElement.style.zoom = String(zoom) }, zoom)
  const intake = page.getByTestId('source-intake')
  for (const index of [3, 2, 3, 2, 3]) {
    const button = intake.locator('.intake-options button').nth(index)
    await button.focus(); await button.press('Enter')
    await expect(intake.locator('h3')).toBeFocused()
    await expect(intake.locator('h3')).toBeInViewport({ ratio: 1 })
    // Zoom sizing arrives through ResizeObserver, after the focus commit.
    await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))))
    await expect(intake.locator('h3')).toBeInViewport({ ratio: 1 })
    expect(await page.evaluate(()=>window.scrollY)).toBe(0)
    const heading = await intake.locator('h3').boundingBox()
    const composer = await page.locator('.g-composer').boundingBox()
    expect(heading!.y + heading!.height).toBeLessThanOrEqual(composer!.y)
    expect(composer!.y+composer!.height).toBeLessThanOrEqual(720)
  }
  expect(await intake.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
  for (const row of await intake.locator('.intake-done li').all()) {
    if (zoom === 2) expect(await row.locator('strong').evaluate(el => getComputedStyle(el).gridColumnStart)).toBe('2')
  }
  await page.screenshot({ path: info.outputPath('intake-stock-zoom.png') })
})

test('reading earlier answers is not undone by reflow while a question title retains focus', async ({ page }) => {
  await page.setViewportSize({ width:320,height:720 }); await open(page,'fr')
  for(const index of [0,1,1,1]) await pick(page,index)
  const scroll=page.locator('.g-scroll'), heading=page.getByTestId('source-intake').locator('h3')
  await expect(heading).toBeFocused()
  await scroll.hover(); await page.mouse.wheel(0,-2000)
  await expect.poll(()=>scroll.evaluate(el=>el.scrollTop)).toBe(0)
  await page.setViewportSize({width:340,height:720})
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))))
  expect(await scroll.evaluate(el=>el.scrollTop)).toBe(0)
  await expect(heading).toBeFocused()
})

for(const language of ['ko','fr'] as const) test(`${language}: next choices and final summary action are visible without extra scrolling`, async ({page},info)=>{
  await page.setViewportSize({width:320,height:844}); await open(page,language)
  for(const index of [0,1,1,1,1]) {
    await pick(page,index)
    const choices=page.getByTestId('source-intake').locator('.intake-options button')
    const next=(await choices.count()) ? choices.last() : page.locator('.summary-open')
    await expect(next).toBeInViewport({ratio:1})
    const box=await next.boundingBox(), composer=await page.locator('.g-composer').boundingBox()
    expect(box!.y+box!.height).toBeLessThanOrEqual(composer!.y)
    expect(await next.evaluate(el=>{const r=el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))})).toBe(true)
  }
  await page.screenshot({path:info.outputPath('intake-complete-visible.png')})
})

test('a slow chart module can be closed back into its conversation without losing the draft', async ({ page }) => {
  let release: (() => void) | undefined
  await page.route('**/src/components/ClientCommonBacktest.tsx', async route => {
    await new Promise<void>(resolve => { release = resolve }); await route.continue()
  })
  await open(page)
  for (const index of [0,1,1,1,1]) await pick(page,index)
  await page.getByTestId('common-strategy-summary').getByRole('button', { name: commonBacktestText('ko', 'open') }).click()
  await expect.poll(() => Boolean(release)).toBe(true)
  await page.getByRole('button', { name: commonBacktestText('ko','back'), exact: true }).click()
  await expect(page.locator('.g-composer textarea')).toHaveValue(original.draft)
  expect((await read(page)).turns).toHaveLength(2)
  release!()
  await expect(page.getByTestId('source-intake')).toHaveAttribute('data-answer-count','5')
})

for (const failure of ['drop','corrupt','readback']) test(`${failure}: an unverified choice never advances and uncertain writes cannot be retried`, async ({ page }) => {
  await open(page)
  const before = await read(page)
  await page.evaluate(({ key, failure }) => {
    const get = Storage.prototype.getItem, set = Storage.prototype.setItem
    let attempted = false
    Reflect.set(window,'intakeRestoreStorage',() => { Storage.prototype.getItem=get; Storage.prototype.setItem=set })
    Storage.prototype.setItem=function(name,value) {
      if(this!==sessionStorage || name!==key) return set.call(this,name,value)
      // Fault the selected answer, not an unrelated viewport/autosave that
      // happens before the click. Otherwise "corrupt" can look like a drop
      // because both the pre-write and read-back bytes were already damaged.
      if(!JSON.parse(value).sessions?.[0]?.turns?.[1]?.sourceIntake?.answers?.length) return set.call(this,name,value)
      attempted=true
      if(failure==='drop') return
      return set.call(this,name,failure==='corrupt' ? '{"corrupt":true}' : value)
    }
    Storage.prototype.getItem=function(name) {
      if(this===sessionStorage && name===key && attempted && failure==='readback') throw Error('fixture storage unavailable')
      return get.call(this,name)
    }
  }, {key,failure})
  await pick(page,0)
  const intake=page.getByTestId('source-intake')
  await expect(intake).toHaveAttribute('data-answer-count','0')
  await expect(intake.getByRole('status')).toHaveText(copy.failed.ko)
  await expect(page.locator('.g-composer textarea')).toHaveValue(original.draft)
  await page.evaluate(() => Reflect.get(window,'intakeRestoreStorage')())
  if(failure==='drop') {
    expect(await read(page)).toEqual(before)
    await pick(page,0)
    await expect(intake).toHaveAttribute('data-answer-count','1')
  } else {
    for(const button of await intake.getByRole('button').all()) await expect(button).toBeDisabled()
  }
})

test('free conversation does not erase the unanswered intake or lock the composer', async ({ page }) => {
  await page.clock.install()
  await open(page); await pick(page,1)
  const id = (await read(page)).turns[1].id
  const composer=page.locator('.g-composer textarea')
  await composer.fill('시장 흐름을 이해하는 방법도 알려줘'); await composer.press('Enter')
  await page.clock.fastForward(30_000)
  await expect(page.getByTestId('source-intake').locator('button').first()).toBeEnabled()
  await pick(page,2)
  const state=await read(page)
  expect(state.turns.find(turn=>turn.id===id)?.sourceIntake?.answers.map(answer=>answer.index)).toEqual([1,2])
  expect(state.turns.at(-1)?.question).toBe('시장 흐름을 이해하는 방법도 알려줘')
  await expect(composer).toBeEnabled()
})

test('five questions stay in the same conversation, persist each answer and hand selected money and period to backtest', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await open(page)
  const composer = page.locator('.g-composer textarea'), node = await composer.elementHandle()
  const intake = page.getByTestId('source-intake')
  await expect(intake.locator('h3')).toBeVisible()
  const url = page.url(), answers = [1, 2, 3, 0, 2]
  for (let i = 0; i < 5; i++) {
    await pick(page, answers[i])
    await expect(intake).toHaveAttribute('data-answer-count', String(i + 1))
    expect(page.url()).toBe(url)
    await expect(composer).toHaveValue(original.draft)
    expect(await composer.evaluate((el, old) => el === old, node)).toBe(true)
    expect((await read(page)).workspace).toBe('conversation')
    await expect(page.locator('.client-next-actions,.client-clarification,.client-delegation-workspace')).toHaveCount(0)
    if (i < 4) await expect(intake.locator('h3')).toBeFocused()
  }
  const summary = page.getByTestId('common-strategy-summary')
  await expect(summary.locator('h3')).toBeFocused()
  await expect(summary).toContainText(copy.budget3.ko)
  await expect(summary).toContainText(copy.asset1.ko)
  const state = await read(page)
  expect(state.turns[0]).toMatchObject({ ...original.turns[0], followupsConsumed: true })
  expect(state.turns[1].sourceIntake?.answers.map(a => a.index)).toEqual(answers)
  expect(state.turns[1].inlineRequest).toMatchObject({ pair: 'ETH/USDT', parameters: { sl: -8, tp: 8, rsiTh: 38, trendFilter: true } })
  expect(state.inlineResults ?? []).toEqual([])
  await page.screenshot({ path: info.outputPath('intake-summary.png') })
  await page.reload()
  await expect(summary).toContainText(copy.budget3.ko)
  await summary.getByRole('button', { name: commonBacktestText('ko', 'open'), exact: true }).click()
  await expect(page).toHaveURL(/#\/share\/bt\/mine$/)
  await expect.poll(async () => (await read(page)).commonBacktest).toMatchObject({ amount: 30000, period: 365, turnId: state.turns[1].id })
  await page.getByRole('button', { name: commonBacktestText('ko', 'back'), exact: true }).click()
  await expect(composer).toHaveValue(original.draft)
  expect(errors).toEqual([])
})

test('recommendations advance exactly once and a redo preserves the old answers, draft and original turn', async ({ page }) => {
  await open(page)
  for (let i = 0; i < 5; i++) {
    await page.getByTestId('source-intake').locator('.is-recommended').evaluate(el => { (el as HTMLButtonElement).click(); (el as HTMLButtonElement).click() })
    await expect(page.getByTestId('source-intake')).toHaveAttribute('data-answer-count', String(i + 1))
  }
  const before = await read(page)
  expect(before.turns[1].sourceIntake?.answers.map(a => [a.index, a.recommended])).toEqual([[0,true],[1,true],[1,true],[1,true],[1,true]])
  await page.getByTestId('common-strategy-summary').getByRole('button', { name: '다시 답하기', exact: true }).click()
  await expect(page.getByTestId('source-intake')).toHaveCount(2)
  await expect(page.getByTestId('source-intake').last().locator('h3')).toBeFocused()
  const after = await read(page)
  expect(after.turns.slice(0, 2)).toEqual(before.turns)
  expect(after.draft).toBe(original.draft)
  await expect(page.getByTestId('common-strategy-summary').getByRole('button', { name: '다시 답하기' })).toHaveCount(0)
  await page.reload()
  await pick(page, 1)
  await expect(page.getByTestId('source-intake').last()).toHaveAttribute('data-answer-count', '1')
})

test('damaged intake bindings are quarantined without losing other turns or the draft', async ({ page }) => {
  await open(page)
  for (const index of [0,1,1,1,1]) await pick(page,index)
  const results = await page.evaluate(async ({key,owner}) => {
    const path = '/src/client-experience-store.ts'
    const { createClientExperienceStore } = await import(/* @vite-ignore */ path)
    const bytes = sessionStorage.getItem(key)!, baseline = JSON.parse(bytes)
    const rows = []
    for (const fault of ['order','index','fraction','recommendation','missing-answer','wrong-pair','wrong-rule','stopped','response','stock-price']) {
      const saved = structuredClone(baseline), turn = saved.sessions[0].turns[1]
      if (fault === 'order') turn.sourceIntake.answers.reverse()
      if (fault === 'index') turn.sourceIntake.answers[0].index = 4
      if (fault === 'fraction') turn.sourceIntake.answers[1].index = 1.5
      if (fault === 'recommendation') { turn.sourceIntake.answers[0].index = 1; turn.sourceIntake.answers[0].recommended = true }
      if (fault === 'missing-answer') turn.sourceIntake.answers.pop()
      if (fault === 'wrong-pair') turn.inlineRequest.pair = 'ETH/USDT'
      if (fault === 'wrong-rule') turn.inlineRequest.parameters.sl = -12
      if (fault === 'stopped') turn.status = 'stopped'
      if (fault === 'response') turn.responseSequence = {}
      if (fault === 'stock-price') turn.sourceIntake.answers[0].index = 3
      sessionStorage.setItem(key, JSON.stringify(saved))
      const store = createClientExperienceStore(), snapshot = store.getSnapshot(), session = snapshot.sessions[0], recovered = session.turns[1]
      const beforeRestart = sessionStorage.getItem(key)
      const restarted = store.restartSourceIntake(session.id, owner, '다시 답하기', recovered.id, recovered.id)
      rows.push({ fault, warning: snapshot.recoveryWarning, invalid: recovered.sourceIntakeInvalid,
        intake: recovered.sourceIntake, input: recovered.inlineRequest, flow: recovered.backtestFlow,
        question: recovered.question, old: session.turns[0], draft: session.draft, restarted,
        unchanged: beforeRestart === sessionStorage.getItem(key) && snapshot === store.getSnapshot() })
    }
    sessionStorage.setItem(key, bytes)
    return { rows, baseline: baseline.sessions[0] }
  }, {key,owner})
  for (const row of results.rows) {
    expect(row, row.fault).toMatchObject({ warning: true, invalid: true, intake: undefined, input: undefined, flow: undefined,
      question: results.baseline.turns[1].question, old: results.baseline.turns[0], draft: original.draft, restarted: false, unchanged: true })
  }
})

test('stale question and restart events do not modify a newer intake or another conversation', async ({ page }) => {
  await open(page)
  const result = await page.evaluate(async ({key,owner}) => {
    const path = '/src/client-experience-store.ts'
    const { createClientExperienceStore } = await import(/* @vite-ignore */ path)
    const store = createClientExperienceStore(), session = store.getSnapshot().sessions[0], id = session.turns[1].id
    const started = store.restartSourceIntake(session.id,owner,'다시 답하기',id,id)
    const next = store.getSnapshot().sessions[0].turns.at(-1)!, before = sessionStorage.getItem(key)
    const rejected = [store.restartSourceIntake(session.id,owner,'다시 답하기',id,id),
      store.pickSourceIntake(session.id,id,owner,'asset',0,false),
      store.pickSourceIntake(session.id,next.id,owner,'style',1,false),
      store.pickSourceIntake('other-session',next.id,owner,'asset',0,false)]
    const unchanged = sessionStorage.getItem(key) === before
    const accepted = store.pickSourceIntake(session.id,next.id,owner,'asset',1,false)
    const after = sessionStorage.getItem(key)
    const duplicate = store.pickSourceIntake(session.id,next.id,owner,'asset',1,false)
    return { started, rejected, unchanged, accepted, duplicate, duplicateUnchanged: sessionStorage.getItem(key)===after,
      draft: store.getSnapshot().sessions[0].draft }
  }, {key,owner})
  expect(result).toEqual({ started:true, rejected:[false,false,false,false], unchanged:true, accepted:true,
    duplicate:false, duplicateUnchanged:true, draft:original.draft })
})

for (const asset of [2,3]) test(`asset ${asset} retains the original stock choice without relabeling a crypto chart`, async ({ page }) => {
  await open(page)
  for (const index of [asset,1,1,1,1]) await pick(page,index)
  const intake = page.getByTestId('source-intake')
  await expect(intake.locator('.intake-unavailable')).toContainText(copy.unavailable.ko)
  await expect(page.getByTestId('common-strategy-summary')).toHaveCount(0)
  expect((await read(page)).turns[1].inlineRequest).toBeUndefined()
  await page.reload()
  await expect(intake.locator('.intake-unavailable')).toContainText(copy[asset === 2 ? 'asset2' : 'asset3'].ko)
  await intake.getByRole('button', { name: copy.revise.ko }).click()
  await expect(page.getByTestId('source-intake')).toHaveCount(2)
})

for (const width of [320,1440]) for (const language of ['ko','en','ja','zh-CN','zh-TW','es','fr'] as const) test(`${language} ${width}px source intake has readable choices and unchanged numeric budgets`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 800 }); await open(page, language)
  for (const index of [0,1]) await pick(page,index)
  const intake = page.getByTestId('source-intake')
  await expect(intake).toContainText(copy.budget3[language])
  expect(copy.budget3[language].replace(/\D/g, '')).toBe('30000')
  for (const button of await intake.locator('button').all()) {
    expect(await button.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    expect(await button.evaluate(el => getComputedStyle(el).borderTopWidth)).toBe('1px')
    expect(await button.evaluate(el => getComputedStyle(el).fontSize)).toBe('13.5px')
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(40)
  }
  await expect(intake.locator('.is-recommended')).toHaveCSS('border-top-style', 'dashed')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.reload()
  await expect(intake).toHaveAttribute('data-answer-count','2')
  if (language === 'fr' || language === 'ko') await page.screenshot({ path: info.outputPath('intake-budget.png') })
})
