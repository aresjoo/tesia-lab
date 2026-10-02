import { expect, test, type Page } from '@playwright/test'
import { billingPreviewStorageKey, createBillingPreviewStore } from '../src/client-billing-preview-store'
import { createBillingPreviewState } from '../src/client-billing-preview-state'
import { clientUsagePreviewStorageKey } from '../src/use-client-usage-preview'
import type { ClientSession } from '../src/client-experience-store'

const owner = 'usage-integration@example.test', now = Date.UTC(2026, 9, 2, 3)
const billingKey = billingPreviewStorageKey(owner), usageKey = clientUsagePreviewStorageKey(owner)
const experienceKey = 'teth-client-experience'
const existing: ClientSession = {
  id: 'usage-existing', title: '보존된 검증 대화', renamed: true, idea: '기존 투자 질문', draft: '',
  pair: 'BTC/USDT', mode: 'dip', timeframe: '1시간봉', risk: '−3%', takeProfit: '+8%', phase: 'plan',
  researchStatus: '초안', workspace: 'conversation', tradingReady: false, updatedAt: now - 1000,
  turns: [{ id: 'usage-existing-turn', question: '보존된 기존 질문', answer: '이미 공급된 기존 결과를 계속 읽을 수 있어요.',
    fullAnswer: '이미 공급된 기존 결과를 계속 읽을 수 있어요.', status: 'done', phase: 'plan',
    startedAt: now - 2000, finishedAt: now - 1000, suggestions: [] }],
}
function billingFixture(mode: 'active' | 'watch' = 'watch') {
  const state = { ...createBillingPreviewState(owner), cardOn: true, uidLinked: true, mode,
    cycleAt: now + 30 * 864e5, seen: { welcome: now - 3000, 'promo-carduid': now - 3000 },
    ledger: [
      { id: 'seed-grant', at: now, type: 'grant' as const, reason: 'welcome', amt: 200, ref: null },
      { id: 'seed-debit', at: now, type: 'debit' as const, reason: 'ai', amt: -200, ref: 'seed-request' },
    ] }
  const raw = JSON.stringify({ v: 1, owner, state, notifications: [] })
  const parsed = createBillingPreviewStore(owner, { getItem: () => raw, setItem: () => {} }).getSnapshot()
  if (parsed.error) throw new Error(`Invalid integration seed: ${parsed.error}`)
  return raw
}
async function open(page: Page, options: { guest?: boolean; usageRaw?: string; billingMode?: 'active' | 'watch' } = {}) {
  await page.clock.install({ time: new Date(now) })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ owner, billingKey, usageKey, raw, usageRaw, existing, experienceKey, guest }) => {
    if (sessionStorage.getItem('usage-integration-seeded')) return
    sessionStorage.setItem('usage-integration-seeded', '1'); localStorage.setItem('tethLang', 'ko')
    if (!guest) sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '사용량 검수', email: owner }))
    sessionStorage.setItem(billingKey, raw)
    if (usageRaw !== undefined) sessionStorage.setItem(usageKey, usageRaw)
    sessionStorage.setItem(experienceKey, JSON.stringify({ currentId: existing.id, sessions: [existing], homeDraft: '', sharedFollows: [] }))
  }, { owner, billingKey, usageKey, raw: billingFixture(options.billingMode), usageRaw: options.usageRaw, existing, experienceKey, guest: options.guest })
  await page.goto('/')
  await expect(page.locator('.g-composer textarea')).toBeVisible()
  await expect(page.locator('.g-scroll')).toContainText(existing.turns[0].fullAnswer)
}
async function route(page: Page, hash: string) {
  await page.evaluate(hash => { history.pushState(null, '', hash); window.dispatchEvent(new Event('teth:navigate')) }, hash)
}
const experience = (page: Page) => page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!), experienceKey)
const billing = (page: Page) => page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!), billingKey)
const input = (page: Page) => page.locator('.g-composer textarea')
async function topup50(page: Page) {
  await route(page, '#/settings/usage')
  await expect(page.getByRole('heading', { name: '사용량', exact: true })).toBeVisible()
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
  await page.locator('.client-settings-usage .stg-b').click()
  await page.getByRole('dialog').getByRole('button', { name: '$50', exact: true }).click()
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '80')
  await expect(page.locator('.client-settings-usage .v.num')).toHaveText('$50')
  await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).click()
}

test('공개 Main: 100%에서 기존 결과와 초안을 보존하고 Mock 충전50 후 80%로 새 요청을 회복한다', async ({ page }) => {
  const writes: string[] = []
  page.on('request', request => { if (request.method() !== 'GET') writes.push(`${request.method()} ${new URL(request.url()).pathname}`) })
  await open(page)
  await expect(page.locator('#g-usebar .use-bar')).toHaveClass(/full/)
  await expect(page.locator('#g-usebar .use-x')).toHaveCount(0)
  const draft = '충전 후 이어 보낼 원래 초안'
  await input(page).fill(draft); await page.locator('.g-send').click()
  await expect(input(page)).toHaveValue(draft)
  expect((await experience(page)).sessions[0].turns).toHaveLength(1)
  const originalLedger = (await billing(page)).state.ledger
  await topup50(page)
  expect((await billing(page)).state.ledger).toEqual(originalLedger)
  expect((await billing(page)).state.mode).toBe('watch')
  await route(page, '#/')
  await expect(input(page)).toHaveValue(draft)
  await expect(page.locator('#g-usebar')).toContainText('80%')
  await expect(page.locator('.g-scroll')).toContainText(existing.turns[0].fullAnswer)
  await page.locator('.g-send').click()
  await expect.poll(async () => (await experience(page)).sessions[0].turns.length).toBe(2)
  await expect(page.locator('.g-umsg').last()).toHaveText(draft)
  expect((await billing(page)).state.ledger).toEqual(originalLedger)
  expect(writes).toEqual([])
})

test('공개 Main: 80% 닫기는 해당 월에 보존되고 새로고침에도 기존 결과 조회를 막지 않는다', async ({ page }) => {
  await open(page); await topup50(page); await route(page, '#/')
  await expect(page.locator('#g-usebar')).toContainText('80%')
  await page.locator('#g-usebar .use-x').click()
  await expect(page.locator('#g-usebar')).toHaveCount(0)
  await page.reload()
  await expect(page.locator('.g-scroll')).toContainText(existing.turns[0].fullAnswer)
  await expect(page.locator('#g-usebar')).toHaveCount(0)
  await route(page, '#/settings/usage')
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '80')
  expect((await billing(page)).state.ledger).toHaveLength(2)
})

test('공개 Main: 게스트는 타인 100% 배너와 충전 기능을 노출하지 않는다', async ({ page }) => {
  await open(page, { guest: true })
  await expect(page.locator('#g-usebar')).toHaveCount(0)
  await route(page, '#/settings/usage')
  // Signed-out settings route requests authentication before exposing account data.
  await expect(page.locator('.client-settings-usage')).toHaveCount(0)
  await expect(page.locator('.client-settings-usage .stg-b')).toHaveCount(0)
  expect((await billing(page)).state.mode).toBe('watch')
})

test('공개 Main: 손상 usage 원문을 보존하고 새 요청 차단과 명시 재시도 복구를 연결한다', async ({ page }) => {
  const broken = '{usage-corrupt:preserve'
  await open(page, { usageRaw: broken })
  await input(page).fill('저장 확인 후 다시 보낼 질문'); await page.locator('.g-send').click()
  await expect(input(page)).toHaveValue('저장 확인 후 다시 보낼 질문')
  expect((await experience(page)).sessions[0].turns).toHaveLength(1)
  expect(await page.evaluate(key => sessionStorage.getItem(key), usageKey)).toBe(broken)
  await page.evaluate(({ key, owner }) => sessionStorage.setItem(key, JSON.stringify({ v: 1, owner, revision: 1, creditUsd: 50, autoTopup: false, dismissedMonth: null })), { key: usageKey, owner })
  await page.getByRole('button', { name: '저장 상태 다시 확인', exact: true }).click()
  await expect(page.locator('#g-usebar')).toContainText('80%')
  await page.locator('.g-send').click()
  await expect.poll(async () => (await experience(page)).sessions[0].turns.length).toBe(2)
})

/** Explicit service consumer seam. This does not exercise payment/API authority. */
async function mountService(page: Page, mode: 'mock' | 'mismatch' | 'unavailable' | 'service', question = false) {
  await page.route('**/usage-service-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="usage-service-root"></div></body></html>' }))
  await page.goto('/usage-service-test.html')
  await page.evaluate(async ({ mode, question }) => {
    const refreshPath = '/@react-refresh', refresh = (await import(/* @vite-ignore */ refreshPath)).default
    refresh.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const componentPath = '/src/internal-poc/ClientServiceExperience.tsx'
    const componentSource = await fetch(componentPath).then(response => response.text())
    const reactPath = componentSource.match(/from "([^"\n]*\/react\.js[^"\n]*)"/)?.[1]
    if (!reactPath) throw new Error('Vite React dependency unavailable')
    const reactModule = await import(/* @vite-ignore */ reactPath), React = reactModule.default ?? reactModule
    const runtimeHelperPath = '/tests/fixtures/client-react-runtime.ts'
    const { testClientReactRuntimePaths } = await import(/* @vite-ignore */ runtimeHelperPath)
    const runtimePaths = await testClientReactRuntimePaths()
    const rootPath = runtimePaths.rootPath, dom = await import(/* @vite-ignore */ rootPath)
    const { ClientServiceExperience } = await import(/* @vite-ignore */ componentPath)
    const rootSource = await fetch(rootPath).then(response => response.text())
    const domImport = rootSource.match(/from\s+"([^"\n]*react-dom\.js[^"\n]*)"/)?.[1]
    if (!domImport) throw new Error('Vite React DOM dependency unavailable')
    const domPath = new URL(domImport, new URL(rootPath, location.origin)).href
    const Flush = (await import(/* @vite-ignore */ domPath)).default
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('usage-service-root'))
    const audit = { sends: 0, topups: 0, auto: 0, next: 0, questions: 0 }
    let accountScope = 'service-owner', value = ''
    const presentation = { source: mode === 'mock' ? 'mock' : mode === 'unavailable' ? 'unavailable' : 'service',
      scope: mode === 'mismatch' ? 'another-owner' : 'service-owner', month: '2026-10', tier: 'CARD_UID',
      pct: 100, creditUsd: 0, resetAt: Date.UTC(2026, 10, 1), autoTopup: false }
    const questionMessages = [{ id: 'usage-user', role: 'user', text: '보존된 서비스 질문' }, { id: 'usage-answer', role: 'assistant', text: '보존된 서비스 결과', responseBlocks: [{ id: 'usage-question', kind: 'market-question', presentation: { binding: { scopeId: 'service-owner/conversation', messageId: 'usage-answer', observationId: 'usage-observation' }, steps: [{ id: 'assets', title: '공급된 시장 확인 질문', multi: true, options: [{ id: 'btc', label: '비트코인' }] }] } }] }]
    const render = () => root.render(React.createElement(ClientServiceExperience, { accountScope, nativeAccounts: true,
      marketQuestionActions: question ? { scope: 'service-owner', submit: async () => { audit.questions++; return false } } : undefined,
      usagePresentation: { presentation, onTopup: async () => { audit.topups++ }, onAutoTopup: async () => { audit.auto++ }, onNext: () => { audit.next++ } },
      state: { phase: 'ready', sessionState: 'AUTHENTICATED', messages: question ? questionMessages : [], input: value, busy: false, inputDisabled: false,
        source: 'service', recovery: null, quickReplies: [], workflow: null, outcome: null, issue: null,
        onInput: (input: string) => { value = input; render() }, onSend: async () => { audit.sends++ },
        onReset: () => false, onRecover: undefined, onLogout: undefined },
    }))
    Object.assign(window, { usageServiceAudit: audit,
      usageServiceOwner: (owner: string) => Flush.flushSync(() => { accountScope = owner; render() }),
      usageServicePercent: (pct: number) => Flush.flushSync(() => { presentation.pct = pct; render() }) })
    localStorage.setItem('tethLang', 'ko'); render()
  }, { mode, question })
  await expect(page.locator(question ? '.g-askcard:visible' : '#strategy-idea')).toBeVisible()
}
for (const mode of ['mock', 'mismatch', 'unavailable'] as const) test(`service consumer: ${mode} 공급은 조회 안내만 제공하고 요청과 충전을 활성화하지 않는다`, async ({ page }) => {
  await mountService(page, mode)
  await page.locator('#strategy-idea').fill('권한 확인이 필요한 서비스 질문')
  await page.getByRole('button', { name: '대화 시작', exact: true }).click()
  expect(await page.evaluate(() => Reflect.get(window, 'usageServiceAudit').sends)).toBe(0)
  await route(page, '#/settings/usage')
  await expect(page.locator('.client-settings-usage')).toHaveAttribute('data-usage-source', 'unavailable')
  await expect(page.locator('.client-settings-usage .stg-b')).toHaveCount(0)
  expect(await page.evaluate(() => Reflect.get(window, 'usageServiceAudit'))).toEqual({ sends: 0, topups: 0, auto: 0, next: 0, questions: 0 })
})

test('service consumer: 명시 service 100%는 요청을 막고 80%는 허용하며 owner 교체는 기존 충전 UI를 은퇴시킨다', async ({ page }) => {
  await mountService(page, 'service')
  await page.locator('#strategy-idea').fill('서버 관측값으로 허용할 질문')
  await page.getByRole('button', { name: '대화 시작', exact: true }).click()
  expect(await page.evaluate(() => Reflect.get(window, 'usageServiceAudit').sends)).toBe(0)
  await page.evaluate(() => Reflect.get(window, 'usageServicePercent')(80))
  await page.getByRole('button', { name: '대화 시작', exact: true }).click()
  expect(await page.evaluate(() => Reflect.get(window, 'usageServiceAudit').sends)).toBe(1)
  await route(page, '#/settings/usage')
  await page.locator('.client-settings-usage .stg-b').click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.evaluate(() => Reflect.get(window, 'usageServiceOwner')('new-service-owner'))
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('.client-settings-usage')).toHaveAttribute('data-usage-source', 'unavailable')
  expect(await page.evaluate(() => Reflect.get(window, 'usageServiceAudit').topups)).toBe(0)
})


test('service consumer: 시장 확인 답변도 100%에서 공급 callback을 호출하지 않고 80%에서 회복한다', async ({ page }) => {
  await mountService(page, 'service', true)
  await page.getByRole('button', { name: '비트코인', exact: true }).click()
  await page.locator('.g-askcard .go').click()
  expect(await page.evaluate(() => Reflect.get(window, 'usageServiceAudit').questions)).toBe(0)
  await page.evaluate(() => Reflect.get(window, 'usageServicePercent')(80))
  await page.locator('.g-askcard .go').click()
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'usageServiceAudit').questions)).toBe(1)
})


async function finishMockEmailLogin(page: Page) {
  const login = page.getByRole('button', { name: '사이드바 로그인', exact: true })
  if (!await login.isVisible()) await page.locator((page.viewportSize()?.width ?? 0) <= 860 ? '.client-hamburger' : '.client-rail-logo-row button').click()
  await login.click()
  await page.getByRole('textbox', { name: '이메일 주소', exact: true }).fill(owner)
  await page.getByRole('button', { name: '계속', exact: true }).click()
  await page.getByRole('textbox', { name: '코드', exact: true }).fill('123456')
  await page.getByRole('button', { name: '계속', exact: true }).click()
  await expect(page.locator('.ca-auth')).toHaveCount(0)
}

for (const condition of ['quota100', 'corrupt-usage'] as const) test(`공개 Main 로그인 경유: ${condition}는 legacy allowed에서도 자동 pending 요청을 막고 초안을 보존한다`, async ({ page }) => {
  const usageRaw = condition === 'corrupt-usage' ? '{usage-login-corrupt:preserve' : undefined
  await open(page, { guest: true, billingMode: 'active', usageRaw })
  const draft = '로그인 후에도 차단 중에는 보존할 원래 질문'
  await input(page).fill(draft)
  const before = (await experience(page)).sessions[0].turns
  await finishMockEmailLogin(page)
  await page.clock.fastForward(1000)
  await expect(input(page)).toHaveValue(draft)
  expect((await experience(page)).sessions[0].turns).toEqual(before)
  expect((await billing(page)).state.ledger).toHaveLength(2)
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('teth-client-profile-preview')!).email)).toBe(owner)
  if (usageRaw) expect(await page.evaluate(key => sessionStorage.getItem(key), usageKey)).toBe(usageRaw)
  else await expect(page.locator('#g-usebar .use-bar')).toHaveClass(/full/)
})
