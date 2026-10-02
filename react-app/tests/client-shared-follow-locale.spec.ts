import { expect, test, type Page } from '@playwright/test'
import { sourceSharedStrategies } from '../src/client-shared-strategies'
import { sharedFollowCopy, CLIENT_SHARED_FOLLOW_COPY } from '../src/client-shared-follow-copy'
import { sharedCopyCopy } from '../src/client-shared-copy-copy'
import { delegationRecommendedParameters, delegationParameters, evaluateDelegation } from '../src/client-delegation-engine'
import type { ClientLanguage } from '../src/client-preferences'
import { sharingCopy } from '../src/client-sharing-copy'

const owner = 'follow-locale@example.test'
const seed = sourceSharedStrategies()[0]
const languages: ClientLanguage[] = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']
const confirmedAt = Date.UTC(2026, 8, 14, 23, 30)
const botKey = `teth-client-user-strategies:${encodeURIComponent(owner)}`
const passParameters = delegationRecommendedParameters()
const lowParameters = delegationParameters({})
const validation = evaluateDelegation(passParameters, 5_000_000)
const states = [
  ['missing', '검증 확인 필요', 'Validation confirmation required'], ['archived', '보관됨', 'Archived'],
  ['live', '실행 중', 'Running'], ['off', '실행 꺼짐', 'Execution off'], ['ready', '실행 준비', 'Ready to run'],
  ['intake', '조건 입력 중', 'Entering conditions'], ['validating', '검증 중', 'Validating'],
  ['low', '조정 중', 'Adjusting'], ['report', '리포트 확인', 'View report'],
  ['connect', '연결 단계', 'Connection step'], ['passed', '검증 통과', 'Validation passed'],
] as const
type Mode = typeof states[number][0]
const previous = { id: 'follow-locale-original', title: '기존 사용자 제목 <보존>', renamed: true, idea: '기존 질문', draft: '보존할 미전송 초안', pair: 'BTC/USDT', mode: 'dip', phase: 'plan', timeframe: '일봉', risk: '−3%', takeProfit: '+8%', workspace: 'conversation', researchStatus: '초안', tradingReady: false, turns: [], updatedAt: 1 }

async function language(page: Page, value: string) {
  await page.evaluate(async value => {
    const path = '/src/client-preferences.ts'
    const { setClientPreference } = await import(/* @vite-ignore */ path)
    setClientPreference('language', value)
  }, value)
  await expect(page.locator('html')).toHaveAttribute('lang', value)
}

// Exercise the existing local-preview store and actual Main, not a backend fixture.
async function following(page: Page, mode: Mode = 'validating') {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route('**/follow-locale-setup.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><body>Local preview setup</body>' }))
  await page.goto('/follow-locale-setup.html')
  const record = await page.evaluate(async ({ owner, seed, previous, mode, confirmedAt, botKey, passParameters, lowParameters, validation }) => {
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: previous.id, homeDraft: '보존할 홈 초안', sessions: [previous], sharedFollows: [] }))
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '따라가기 검수자', email: owner }))
    localStorage.setItem('tethLang', 'ko')
    const path = '/src/client-experience-store.ts'
    const { createClientExperienceStore } = await import(/* @vite-ignore */ path)
    const store = createClientExperienceStore()
    store.copySharedStrategy(owner, { nick: seed.nick, budgetIndex: 1, sl: seed.parameters.sl, tp: seed.parameters.tp })
    const saved = structuredClone(store.getSnapshot()), record = saved.sharedFollows[0]
    record.confirmedAt = confirmedAt
    if (mode === 'archived') record.active = false
    const key = `teth:client-delegation:${record.sessionId}`, ui = JSON.parse(sessionStorage.getItem(key)!)
    Object.assign(ui, { parameters: passParameters, pendingParameters: passParameters, workStartedAt: Date.now() + 120_000 })
    if (mode === 'intake') { ui.page = 'intake'; delete ui.answers.stop }
    if (['report', 'connect', 'passed', 'low'].includes(mode)) {
      ui.workStep = 5; ui.page = mode === 'report' || mode === 'connect' ? mode : 'backtest'
      if (mode === 'low') ui.parameters = ui.pendingParameters = lowParameters
    }
    sessionStorage.setItem(key, JSON.stringify(ui))
    if (mode === 'missing') sessionStorage.removeItem(key)
    if (['live', 'off', 'ready'].includes(mode)) {
      sessionStorage.setItem(botKey, JSON.stringify([{ sessionId: record.sessionId, record: {
        id: '1900', name: '기존 등록 전략', createdAt: 1900, parameters: passParameters,
        score: validation.score, ret: validation.result.ret, mdd: validation.result.mdd,
        n: validation.result.n, winRate: validation.result.winRate, environment: 'paper', status: mode,
        asset: seed.asset, capital: 5_000_000, exchangeId: 'binance', exchangeName: 'Binance', version: 'v1.0',
      } }]))
    }
    sessionStorage.setItem('teth-client-experience', JSON.stringify(saved))
    return record
  }, { owner, seed, previous, mode, confirmedAt, botKey, passParameters, lowParameters, validation })
  await page.goto('/#/share')
  await page.evaluate(() => { location.hash = '#/share/library' }); await expect(page.locator('#research-title')).toHaveText('따라가는 중')
  await expect(page.locator('.client-shared-follow-list')).toBeVisible()
  return page.locator(`[data-follow-id="${record.id}"]`)
}

test('실제 Main 영어 목록은 한국어 고정 요약을 남기지 않는다', async ({ page }) => {
  await following(page)
  await language(page, 'en')
  await expect(page.locator('.client-shared-follow-list dt').first()).toHaveText('Cloned strategies')
})

test('실제 Main 영어 보관 대화상자는 한국어 고정 제목을 남기지 않는다', async ({ page }) => {
  const card = await following(page)
  await card.getByRole('button', { name: '중지', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await language(page, 'en')
  await expect(dialog).toHaveAccessibleName('Stop following')
})

async function stored(page: Page) {
  return page.evaluate(() => Object.fromEntries(Object.keys(sessionStorage).sort().map(key => [key, sessionStorage.getItem(key)])))
}

const summaries = ['복제한 전략', 'Cloned strategies', '複製した戦略', '已复制的策略', '已複製的策略', 'Estrategias clonadas', 'Stratégies clonées']
for (const [index, locale] of languages.entries()) test(`${locale} 실제 목록과 Hero·보관 본문은 원래 설정·소유자·KRW 예산을 보존한다`, async ({ page }) => {
  const card = await following(page, 'ready')
  const before = await stored(page), href = page.url()
  const action = card.getByRole('button', { name: '설정 변경', exact: true })
  await action.focus()
  const focused = await action.elementHandle(), curve = await card.locator('svg').elementHandle()
  expect(curve).not.toBeNull()
  await language(page, locale)
  await page.evaluate(async () => { const path = '/src/client-preferences.ts'; (await import(/* @vite-ignore */ path)).setClientPreference('currency', 'USD') })
  expect(await focused!.evaluate(element => document.activeElement === element)).toBe(true)
  expect(await curve!.evaluate(element => element.isConnected)).toBe(true)
  const f = (key: keyof typeof CLIENT_SHARED_FOLLOW_COPY.ko) => sharedFollowCopy(locale, key)
  await expect(page.locator('.client-shared-follow-list dt').first()).toHaveText(summaries[index])
  await expect(page.getByRole('group', { name: f('전략 공유 영역'), exact: true })).toHaveCount(0)
  await expect(page.locator('.hub-header h1')).toHaveText(sharingCopy(locale, '따라가는 중'))
  await expect(page.locator('.client-strategy-sharing>.tfbk-hero,.client-sharing-counter')).toHaveCount(0)
  await expect(card.locator('.ss3-st')).toHaveText(f('실행 준비'))
  await expect(card.locator('.nm')).toHaveText(seed.nick)
  await expect(card.locator('.ss3-follow-setting').nth(2)).toHaveText(sharedFollowCopy(locale, '예산 {budget}', { budget: sharedCopyCopy(locale, '500만원') }))
  await expect(card.locator('time')).toHaveAttribute('datetime', '2026-09-14')
  await expect(card.locator('time')).toHaveText(locale === 'ko' ? '2026-09-14' : new Intl.DateTimeFormat(locale, { calendar: 'gregory', timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(confirmedAt))
  await card.getByRole('button', { name: f('중지'), exact: true }).click()
  const dialog = page.getByRole('dialog', { name: f('따라가기 중지'), exact: true })
  await expect(dialog).toContainText(sharedFollowCopy(locale, '{nick} 전략 따라가기를 중지할까요?', { nick: seed.nick }))
  await expect(dialog).toContainText(f('항목은 보관 처리되고, 이미 실행 중인 전략은 내 트레이딩에서 계속 관리할 수 있어요.'))
  await expect(dialog.getByRole('button', { name: f('중지하고 보관'), exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  expect(page.url()).toBe(href)
  expect(await stored(page)).toEqual(before)
})

for (const [mode, ko, en] of states) test(`실제 Main ${mode} 원상태는 영어 표시만 바뀌며 ${en}을 새 권한으로 저장하지 않는다`, async ({ page }) => {
  if (mode === 'low') expect(evaluateDelegation(lowParameters, 5_000_000).score).toBeLessThan(80)
  const card = await following(page, mode)
  await expect(card.locator('.ss3-st')).toHaveText(ko)
  const before = await stored(page)
  await language(page, 'en')
  await expect(card.locator('.ss3-st')).toHaveText(en)
  await expect(card).toHaveAccessibleName(`${seed.nick} · ${en}`)
  for (const locale of languages) {
    await language(page, locale)
    await expect(card.locator('.ss3-st')).toHaveText(sharedFollowCopy(locale, ko))
  }
  expect(await stored(page)).toEqual(before)
})

test('실행 중 보관·삭제 공지는 언어에 반응하지만 등록 실행·원대화·초안을 변경하지 않는다', async ({ page }) => {
  const card = await following(page, 'live')
  const before = await stored(page), experience = JSON.parse(before['teth-client-experience']!)
  await card.getByRole('button', { name: '따라가기 중지', exact: true }).click()
  const dialog = page.getByRole('dialog')
  const confirm = dialog.getByRole('button', { name: '중지하고 보관', exact: true })
  await confirm.focus()
  const focused = await confirm.elementHandle(), cardNode = await card.elementHandle(), curve = await card.locator('svg').elementHandle()
  expect(curve).not.toBeNull()
  for (const locale of languages) {
    await language(page, locale)
    expect(await focused!.evaluate(element => document.activeElement === element)).toBe(true)
    expect(await cardNode!.evaluate(element => element.isConnected)).toBe(true)
    expect(await curve!.evaluate(element => element.isConnected)).toBe(true)
    expect(await stored(page)).toEqual(before)
  }
  await dialog.getByRole('button', { name: sharedFollowCopy('fr', '중지하고 보관'), exact: true }).click()
  for (const locale of languages) {
    await language(page, locale)
    await expect(page.locator('.ss3-notice')).toHaveText(sharedFollowCopy(locale, '보관했어요'))
    await expect(card.locator('.ss3-st')).toHaveText(sharedFollowCopy(locale, '보관됨'))
  }
  let after = await stored(page)
  expect(after[botKey]).toBe(before[botKey])
  expect(JSON.parse(after['teth-client-experience']!).sessions).toEqual(experience.sessions)
  expect(JSON.parse(after['teth-client-experience']!).homeDraft).toBe(experience.homeDraft)
  await card.getByRole('button', { name: sharedFollowCopy('fr', '목록에서 삭제'), exact: true }).click()
  const removal = '목록에서 삭제했어요. 대화와 검증 결과, 실행 중인 전략은 유지됩니다.'
  for (const locale of languages) {
    await language(page, locale)
    await expect(page.locator('.ss3-notice')).toHaveText(sharedFollowCopy(locale, removal))
    await expect(page.locator('.client-shared-follow-list')).toContainText(sharedFollowCopy(locale, '아직 따라가는 전략이 없어요'))
    await expect(page.getByRole('button', { name: sharedFollowCopy(locale, '전략 찾기로 가기'), exact: true })).toBeVisible()
  }
  after = await stored(page)
  expect(after[botKey]).toBe(before[botKey])
  expect(JSON.parse(after['teth-client-experience']!).sessions).toEqual(experience.sessions)
  expect(JSON.parse(after['teth-client-experience']!).sharedFollows).toEqual([])
})

for (const width of [320, 1440]) test(`${width}px 프랑스어 상태·예산·날짜·동작과 보관 모달은 겹치지 않는다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: width === 320 ? 640 : 1000 })
  const card = await following(page, 'missing')
  await language(page, 'fr')
  await page.evaluate(() => document.fonts.ready)
  await card.scrollIntoViewIfNeeded()
  const geometry = await card.evaluate(element => {
    const row = element.getBoundingClientRect(), name = element.querySelector('.nm')!.getBoundingClientRect(), badge = element.querySelector('.ss3-st')!.getBoundingClientRect()
    const nodes = [...element.querySelectorAll('.ss3-follow-setting,.ss3-follow-date,.bt>button')]
    const boxes = nodes.map(node => node.getBoundingClientRect())
    const outside = boxes.some(box => box.left < row.left - 1 || box.right > row.right + 1)
    const overlaps = boxes.some((a, index) => boxes.slice(index + 1).some(b => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1))
    const badgeNameOverlap = Math.min(name.right, badge.right) - Math.max(name.left, badge.left) > 1 && Math.min(name.bottom, badge.bottom) - Math.max(name.top, badge.top) > 1
    return { outside, overlaps, badgeNameOverlap, overflow: document.documentElement.scrollWidth > innerWidth + 1 }
  })
  expect(geometry).toEqual({ outside: false, overlaps: false, badgeNameOverlap: false, overflow: false })
  await page.screenshot({ path: info.outputPath(`follow-fr-${width}-list.png`) })
  await card.locator('.nmrow').scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath(`follow-fr-${width}-list-top.png`) })
  const stop = card.getByRole('button', { name: sharedFollowCopy('fr', '중지'), exact: true })
  await stop.scrollIntoViewIfNeeded()
  expect(await stop.evaluate(element => { const r = element.getBoundingClientRect(); return element.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)) })).toBe(true)
  await stop.click()
  const dialog = page.getByRole('dialog'), confirm = dialog.getByRole('button', { name: sharedFollowCopy('fr', '중지하고 보관'), exact: true })
  await confirm.scrollIntoViewIfNeeded()
  const button = await confirm.boundingBox()
  expect(button!.height).toBeGreaterThanOrEqual(44)
  expect(button!.x).toBeGreaterThanOrEqual(0)
  expect(button!.x + button!.width).toBeLessThanOrEqual(width + 1)
  expect(await confirm.evaluate(element => { const r = element.getBoundingClientRect(); return element.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)) })).toBe(true)
  await page.screenshot({ path: info.outputPath(`follow-fr-${width}-archive.png`) })
  await page.keyboard.press('Escape')
  await expect(stop).toBeFocused()
})

// Presentation-only caller seam: err/unknown are producer possibilities but
// current Main's registration decoder does not accept them as stored executions.
async function isolated(page: Page) {
  await page.route('**/follow-locale-caller.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main id="fixture"></main></body></html>' }))
  await page.goto('/follow-locale-caller.html')
  await page.evaluate(async ({ seed, owner, confirmedAt }) => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    for (const path of ['/src/client-reference.css', '/src/client-strategy-sharing.css']) await import(/* @vite-ignore */ path)
    const cp = '/src/components/ClientStrategySharing.tsx', dp = '/@id/react-dom/client'
    const code = await (await fetch(cp)).text(), rp = code.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing Vite React instance')
    const rm = await import(/* @vite-ignore */ rp), react = rm.default ?? rm, dom = await import(/* @vite-ignore */ dp), component = await import(/* @vite-ignore */ cp)
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture'))
    const labels = ['실행 오류', '실행 상태 확인 필요', '복제한 전략', 'upstream <tag> 확인 필요']
    const followRows = labels.map((label, index) => ({ record: { id: `caller-${index}`, sessionId: `caller-session-${index}`, owner, nick: seed.nick, asset: seed.asset, parameters: { ...seed.parameters, tp: null }, budgetIndex: 3, confirmedAt, active: true }, status: { label, active: true, running: false } }))
    Object.assign(window, { callerError: '외부 <tag> & 원문 오류', callerCalls: 0 })
    const fail = () => { Reflect.set(window, 'callerCalls', Reflect.get(window, 'callerCalls') + 1); throw new Error(Reflect.get(window, 'callerError')) }
    root.render(react.createElement(component.ClientStrategySharing, { location: { period: 'all' }, onNavigate: () => {}, onAsk: () => {}, onReturn: () => {}, signedIn: true, onLogin: () => {}, owner, followRows, onArchiveFollow: fail, onResumeFollow: fail }))
  }, { seed, owner, confirmedAt })
  await language(page, 'ko')
  await page.getByRole('button', { name: /^따라가는 중(?: \d+)?$/ }).click()
  await expect(page.locator('.client-shared-follow-list article')).toHaveCount(4)
}

test('별도 caller의 오류·미지 상태와 외부 오류 원문은 사전 키와 같아도 임의 번역하지 않는다', async ({ page }) => {
  await isolated(page)
  const before = await stored(page)
  for (const locale of languages) {
    await language(page, locale)
    await expect(page.locator('.ss3-st')).toHaveText([sharedFollowCopy(locale, '실행 오류'), sharedFollowCopy(locale, '실행 상태 확인 필요'), '복제한 전략', 'upstream <tag> 확인 필요'])
    await expect(page.locator('article').first()).toContainText(sharedFollowCopy(locale, '익절 미설정'))
  }
  const card = page.locator('[data-follow-id="caller-0"]')
  for (const raw of ['외부 <tag> & 원문 오류', '보관하지 못했어요. 다시 시도해주세요.']) {
    await page.evaluate(raw => Reflect.set(window, 'callerError', raw), raw)
    await card.getByRole('button', { name: sharedFollowCopy('fr', '중지'), exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: sharedFollowCopy('fr', '중지하고 보관'), exact: true }).click()
    for (const locale of languages) {
      await language(page, locale)
      await expect(page.getByRole('alert')).toHaveText(raw)
      await expect(page.getByRole('dialog')).toBeVisible()
    }
    await page.keyboard.press('Escape')
    await card.getByRole('button', { name: sharedFollowCopy('fr', '이어서 진행'), exact: true }).click()
    for (const locale of languages) {
      await language(page, locale)
      await expect(page.locator('.ss3-notice')).toHaveText(raw)
    }
  }
  expect(await page.evaluate(() => Reflect.get(window, 'callerCalls'))).toBe(4)
  expect(await stored(page)).toEqual(before)
})

test('기기 시간대가 달라도 UTC 시작일과 저장 원금·원래 날짜는 같다', async ({ browser, baseURL }) => {
  for (const timezoneId of ['Asia/Seoul', 'America/Los_Angeles']) {
    const context = await browser.newContext({ baseURL, timezoneId })
    try {
      const page = await context.newPage(), card = await following(page, 'ready'), before = await stored(page)
      for (const locale of ['ko', 'en', 'fr'] as const) {
        await language(page, locale)
        await expect(card.locator('time')).toHaveAttribute('datetime', '2026-09-14')
        await expect(card.locator('time')).toHaveText(locale === 'ko' ? '2026-09-14' : new Intl.DateTimeFormat(locale, { calendar: 'gregory', timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(confirmedAt))
      }
      expect(await stored(page)).toEqual(before)
    } finally { await context.close() }
  }
})
