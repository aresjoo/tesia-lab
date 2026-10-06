import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test'
import type { ClientSession } from '../src/client-experience-store'

// Independent Golden: original 9fbff821 index.html:20795, final gSend override.
// Supplied display observations only: never a provider, server request or login.
const noticeText = '이전 답변을 마무리하는 중입니다, 끝나면 바로 보내주십시오'
const owner = 'busy-feedback@example.test', key = 'teth-client-experience'
const firstQuestion = '비트코인 시장 흐름을 알려줘', pendingDraft = '다음에 물어볼 원문 질문 0123456789'
const fixturePath = '/original-busy-send-test.html'
type Audit = { attempts: { kind: string; method: string }[]; errors: string[] }
const audits = new WeakMap<BrowserContext, Audit>()
test.use({ serviceWorkers: 'block' })

test.beforeEach(async ({ context, page, baseURL }) => {
  if (!baseURL) throw new Error('로컬 Main origin이 필요합니다.')
  const origin = new URL(baseURL).origin, audit: Audit = { attempts: [], errors: [] }
  audits.set(context, audit)
  const observe = (page: Page) => page.on('pageerror', error => audit.errors.push(error.name))
  observe(page); context.on('page', observe)
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url())
    const kind = url.origin !== origin ? 'external' : /^\/api(?:\/|$)/i.test(url.pathname) ? 'api' : request.method() !== 'GET' ? 'mutation' : null
    if (kind) { audit.attempts.push({ kind, method: request.method() }); return route.abort('blockedbyclient') }
    if (url.pathname === fixturePath && !url.search) return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><div id="fixture"></div><script type="module">import RefreshRuntime from "/@react-refresh"; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>(type)=>type; window.__vite_plugin_react_preamble_installed__=true;</script></body></html>' })
    return route.continue()
  })
  await context.routeWebSocket('**', socket => {
    const url = new URL(socket.url()), local = new URL(origin)
    if (url.host !== local.host || /^\/api(?:\/|$)/i.test(url.pathname)) audit.attempts.push({ kind: 'websocket', method: 'WS' })
    socket.close()
  })
  await context.addInitScript(({ origin, owner }) => {
    if (location.origin !== origin) return
    localStorage.setItem('tethLang', 'ko'); localStorage.setItem('tethCurrency', 'USD')
    sessionStorage.setItem('teth-app-banner-dismissed', '1')
    // Existing host's explicit preview owner. No conversation/research/result seed.
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '응답 진행 검수', email: owner }))
  }, { origin, owner })
})
test.afterEach(async ({ context }, info) => {
  const audit = audits.get(context)
  await info.attach('busy-feedback-network-guard', { body: Buffer.from(JSON.stringify(audit)), contentType: 'application/json' })
  expect(audit).toEqual({ attempts: [], errors: [] })
})

const read = (page: Page): Promise<ClientSession> => page.evaluate(key => {
  const snapshot = JSON.parse(sessionStorage.getItem(key)!)
  return snapshot.sessions.find((item: { id: string }) => item.id === snapshot.currentId)
}, key)
const subscriptions = (page: Page): Promise<number> => page.evaluate(() => Reflect.get(window, 'busyHost').subscriptions.length)
async function deliver(page: Page, session: ClientSession, revision: number, done: boolean) {
  const turn = session.turns.at(-1)!
  return page.evaluate(({ owner, sessionId, turnId, revision, done }) => Reflect.get(window, 'busyHost').deliver({
    sessionId, turnId, expectedRevision: revision - 1,
    sequence: { version: 1, owner, sessionId, turnId, revision, status: done ? 'done' : 'running',
      blocks: [{ id: 'observed-answer', kind: 'text', text: done ? '명시 관측의 응답 진행 중입니다. 명시 관측의 응답 완료입니다.' : '명시 관측의 응답 진행 중입니다.', status: done ? 'done' : 'streaming' }] },
  }), { owner, sessionId: session.id, turnId: turn.id, revision, done })
}
async function mount(page: Page, width: number) {
  await page.setViewportSize({ width, height: width === 320 ? 480 : width === 390 ? 844 : 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(fixturePath)
  await page.evaluate(async owner => {
    const path = '/tests/fixtures/ordered-response-host.tsx', { mount } = await import(/* @vite-ignore */ path)
    Reflect.set(window, 'busyHost', mount(owner))
  }, owner)
  await expect(page.locator('.client-gallery-home')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  await page.clock.install()
  const pauseOrigin = await page.evaluate(() => Date.now())
  await page.clock.setFixedTime(pauseOrigin)
  await page.clock.pauseAt(pauseOrigin + 1000)
  await page.clock.setSystemTime(pauseOrigin + 1000)
  expect(await page.evaluate(() => Date.now())).toBe(pauseOrigin + 1000)
  await page.locator('#strategy-idea').fill(firstQuestion)
  await page.getByRole('button', { name: '대화 시작', exact: true }).click()
  const input = page.locator('.g-composer textarea')
  await expect(input).toBeVisible(); await expect(input).toBeEnabled()
  const session = await read(page)
  expect(session.turns).toHaveLength(1); expect(session.turns[0].question).toBe(firstQuestion)
  expect(await deliver(page, session, 1, false)).toBe(true)
  await expect(page.getByRole('button', { name: '응답 중지', exact: true })).toBeEnabled()
  await input.fill(pendingDraft); await input.focus()
  await input.evaluate(node => (node as HTMLTextAreaElement).setSelectionRange(3, 11))
  await page.clock.runFor(300)
  return { input, session: await read(page), count: await subscriptions(page), originalInput: await input.elementHandle() }
}
async function preserved(page: Page, input: Locator, session: ClientSession, count: number, originalInput: Awaited<ReturnType<Locator['elementHandle']>>) {
  await expect(input).toHaveValue(pendingDraft); await expect(input).toBeFocused()
  expect(await input.evaluate((node, original) => node === original, originalInput)).toBe(true)
  expect(await input.evaluate(node => [(node as HTMLTextAreaElement).selectionStart, (node as HTMLTextAreaElement).selectionEnd])).toEqual([3, 11])
  expect((await read(page)).turns).toEqual(session.turns)
  expect(await subscriptions(page)).toBe(count)
}
async function visibleNotice(page: Page, width: number) {
  const toast = page.locator('.ca-code-toast').filter({ hasText: noticeText })
  await expect(toast).toHaveCount(1); await expect(toast).toHaveText(noticeText)
  await expect(toast).toHaveClass(/\bshow\b/); await expect(toast).toHaveAttribute('role', 'status')
  await expect(toast).toHaveAttribute('aria-live', 'polite')
  await toast.evaluate(async element => { await Promise.all(element.getAnimations().map(animation => animation.finished)) })
  const box = await toast.evaluate(element => {
    const r = element.getBoundingClientRect(), css = getComputedStyle(element)
    return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height,
      viewportHeight: innerHeight, position: css.position, outsideRoot: element.closest('#fixture') === null,
      inert: !!element.closest('[inert]'), overflow: document.documentElement.scrollWidth > innerWidth }
  })
  expect(box.position).toBe('fixed'); expect(box.outsideRoot).toBe(true); expect(box.inert).toBe(false)
  expect(box.width).toBeGreaterThan(0); expect(box.height).toBeGreaterThan(0)
  expect(box.x).toBeGreaterThanOrEqual(0); expect(box.y).toBeGreaterThanOrEqual(0)
  expect(box.right).toBeLessThanOrEqual(width); expect(box.bottom).toBeLessThanOrEqual(box.viewportHeight)
  expect(Math.abs(box.x + box.width / 2 - width / 2)).toBeLessThan(1)
  expect(Math.abs(box.viewportHeight - box.bottom - 26)).toBeLessThan(1); expect(box.overflow).toBe(false)
  return toast
}

for (const width of [320, 390, 1440]) test(`원본 Main ${width}px: 진행 중 Enter 안내·초안 보존과 완료 뒤 단일 전송`, async ({ page }, info) => {
  const { input, session, count, originalInput } = await mount(page, width)
  await input.press('Enter')
  const toast = await visibleNotice(page, width)
  await preserved(page, input, session, count, originalInput)
  await page.screenshot({ path: info.outputPath(`busy-notice-${width}.png`) })
  await page.clock.runFor(1000); await input.press('Enter')
  await preserved(page, input, session, count, originalInput)
  await page.clock.runFor(1199); await expect(toast).toHaveClass(/\bshow\b/)
  await page.clock.runFor(1); await expect(toast).not.toHaveClass(/\bshow\b/)
  await page.clock.runFor(240); await expect(toast).not.toHaveClass(/\bshow\b/)
  expect(await deliver(page, session, 2, true)).toBe(true)
  await expect(page.getByRole('button', { name: '메시지 보내기', exact: true })).toBeEnabled()
  await expect(input).toHaveValue(pendingDraft)
  const completed = await read(page)
  expect(completed.turns).toHaveLength(1); expect(completed.turns[0].responseSequence?.status).toBe('done')
  await input.press('Enter')
  const next = await read(page)
  expect(next.turns).toHaveLength(2); expect(next.turns[0]).toEqual(completed.turns[0])
  expect(next.turns[0].responseSequence?.status).toBe('done')
  expect(next.turns[1].question).toBe(pendingDraft); await expect(input).toHaveValue('')
  expect(await subscriptions(page)).toBe(count)
  await page.getByRole('button', { name: '응답 중지', exact: true }).click()
  expect((await read(page)).turns[1].status).toBe('stopped')
})

test('원본 Main 키보드 경계: 반복·IME·Shift Enter는 안내/전송을 만들지 않고 명시 중단은 늦은 완료를 거절한다', async ({ page }) => {
  const { input, session, count, originalInput } = await mount(page, 320)
  const toast = page.locator('.ca-code-toast').filter({ hasText: noticeText })
  for (const event of [{ repeat: true }, { isComposing: true }]) {
    await input.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true, ...event })
    await expect(toast).toHaveCount(0); await preserved(page, input, session, count, originalInput)
  }
  await input.press('Shift+Enter')
  await expect(input).toHaveValue(pendingDraft.slice(0, 3) + '\n' + pendingDraft.slice(11))
  await expect(toast).toHaveCount(0); expect((await read(page)).turns).toEqual(session.turns)
  await input.fill(pendingDraft); await input.focus()
  await input.evaluate(node => (node as HTMLTextAreaElement).setSelectionRange(3, 11))
  await input.press('Enter'); await visibleNotice(page, 320)
  await preserved(page, input, session, count, originalInput)
  await page.getByRole('button', { name: '응답 중지', exact: true }).click()
  expect((await read(page)).turns[0].responseSequence?.status).toBe('stopped')
  expect(await deliver(page, session, 2, true)).toBe(false)
  await expect(input).toHaveValue(pendingDraft); expect((await read(page)).turns).toHaveLength(1)
  await expect(page.getByRole('button', { name: '메시지 보내기', exact: true })).toBeEnabled()
  await input.press('Enter')
  expect((await read(page)).turns).toHaveLength(2); expect((await read(page)).turns[1].question).toBe(pendingDraft)
  expect(await subscriptions(page)).toBe(count)
  await page.getByRole('button', { name: '응답 중지', exact: true }).click()
})

// Original 9fb index.html:20945 also rejects keyCode 229 when isComposing is
// false. Synthetic browser events prove this handler boundary, not OS IME use.
test('IME229 busy 390px: 합성 Enter는 안내·전송 없이 초안·선택·DOM을 보존한다', async ({ page }, info) => {
  const { input, session, count, originalInput } = await mount(page, 390)
  const toast = page.locator('.ca-code-toast').filter({ hasText: noticeText })
  await input.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 229, isComposing: false, bubbles: true, cancelable: true })
  await expect(toast).toHaveCount(0)
  await preserved(page, input, session, count, originalInput)
  expect(await deliver(page, session, 2, true)).toBe(true)
  await expect(page.getByRole('button', { name: '메시지 보내기', exact: true })).toBeEnabled()
  const completed = await read(page)
  await preserved(page, input, completed, count, originalInput)
  await expect(input).toHaveAttribute('spellcheck', 'false')
  await expect(input).toHaveAttribute('autocomplete', 'off')
  await input.press('Enter')
  const next = await read(page)
  expect(next.turns).toHaveLength(2); expect(next.turns[0]).toEqual(completed.turns[0])
  expect(next.turns[1].question).toBe(pendingDraft); await expect(input).toHaveValue('')
  expect(await subscriptions(page)).toBe(count)
  await page.getByRole('button', { name: '응답 중지', exact: true }).click()
  info.annotations.push({ type: 'scope', description: '합성 keyCode229/isComposing=false handler 반례; 실제 OS keyboard·IME 실증 아님' })
})

test('IME229 ready 1440px: 합성 Enter는 전송 없이 보존하고 다음 일반 Enter는 한 번 전송한다', async ({ page }, info) => {
  const { input, session, count, originalInput } = await mount(page, 1440)
  expect(await deliver(page, session, 2, true)).toBe(true)
  await expect(page.getByRole('button', { name: '메시지 보내기', exact: true })).toBeEnabled()
  const completed = await read(page)
  const toast = page.locator('.ca-code-toast').filter({ hasText: noticeText })
  await preserved(page, input, completed, count, originalInput)
  await input.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 229, isComposing: false, bubbles: true, cancelable: true })
  await expect(toast).toHaveCount(0)
  await preserved(page, input, completed, count, originalInput)
  await expect(input).toHaveAttribute('spellcheck', 'false')
  await expect(input).toHaveAttribute('autocomplete', 'off')
  await input.press('Enter')
  const next = await read(page)
  expect(next.turns).toHaveLength(2); expect(next.turns[0]).toEqual(completed.turns[0])
  expect(next.turns[1].question).toBe(pendingDraft); await expect(input).toHaveValue('')
  expect(await subscriptions(page)).toBe(count)
  await page.getByRole('button', { name: '응답 중지', exact: true }).click()
  info.annotations.push({ type: 'scope', description: '합성 keyCode229/isComposing=false handler 반례; 실제 OS keyboard·IME 실증 아님' })
})
