import { expect, test, type Page } from '@playwright/test'
import { copyPreviewStorageKey, saveCopyPreviewState, subscribeCopyPreview, type CopyPreviewStoreError } from '../src/client-copy-preview-store'
import { calculateCopyPreview, copyPreviewPairs, createCopyPreviewState, startCopyPreview } from '../src/client-copy-preview-state'
import { sourceSharedStrategies } from '../src/client-shared-strategies'
import copy from '../src/client-terminal-copies-copy.json' with { type: 'json' }
import { shellText } from '../src/client-shell-copy'
import { accountTerminalText } from '../src/client-account-terminal-copy'
import type { ClientLanguage } from '../src/client-preferences'
import { delegationRecommendedParameters, evaluateDelegation } from '../src/client-delegation-engine'

test.setTimeout(45_000)
const owner = 'terminal-copy@example.test', source = sourceSharedStrategies()[0]
const started = startCopyPreview(createCopyPreviewState(owner), { owner, id: 'copied-one', amount: 200, pairs: [copyPreviewPairs(source)[0]], mode: 'ratio', at: 1000 }, source)
if (!started.ok) throw Error(started.message)
const state = started.state
declare global { interface Window { copySync: ReturnType<typeof import('./fixtures/copy-account-sync-harness')['mountCopyAccountSync']> } }
async function panel(page: Page, lang: ClientLanguage = 'ko') {
  await expect(page.locator('.client-account-terminal')).toBeVisible()
  const tab = page.locator('.ctt-main-tabs').getByRole('tab', { name: accountTerminalText(lang, 'judgment'), exact: true })
  if (await tab.isVisible()) await tab.click()
  await expect(page.locator('.client-terminal-copies')).toBeVisible()
}
async function open(page: Page, raw = JSON.stringify(state), mixed = false) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ owner, raw, key }) => {
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '검수자', email: owner }))
    sessionStorage.setItem(key, raw)
  }, { owner, raw, key: copyPreviewStorageKey(owner) })
  await page.goto('/#/trade')
  if (!mixed) await panel(page)
}

async function seedOwnStrategies(page: Page) {
  const parameters = delegationRecommendedParameters(), verified = evaluateDelegation(parameters, 10000000)
  const entries = [2000, 1000].map(createdAt => ({ sessionId: `registered-${createdAt}`, record: {
    id: String(createdAt), createdAt, name: `내 연구 ${createdAt}`, status: 'ready', environment: 'paper', parameters,
    score: verified.score, ret: verified.result.ret, mdd: verified.result.mdd, n: verified.result.n, winRate: verified.result.winRate,
    asset: '이더리움', exchangeId: 'okx', exchangeName: 'OKX', chartSymbol: 'BINANCE:ETHUSDT', capital: 10000000, version: 'v1.0',
  } }))
  await page.addInitScript(({ owner, entries }) => {
    const key = `teth-client-user-strategies:${encodeURIComponent(owner)}`
    if (!sessionStorage.getItem(key)) sessionStorage.setItem(key, JSON.stringify(entries))
  }, { owner, entries })
}

async function strategyPanel(page: Page, language: ClientLanguage = 'ko') {
  const tab = page.locator('.ctt-main-tabs').getByRole('tab', { name: accountTerminalText(language, 'judgment'), exact: true })
  if (await tab.isVisible()) await tab.click()
  if (await page.locator('.ctt-selector-button').getAttribute('aria-expanded') !== 'true') await page.locator('.ctt-selector-button').click()
}

test('본인 전략만 보유해도 관심·공유 설정에 접근하고 새로고침 복귀는 선택 전략을 보존한다', async ({ page }) => {
  await seedOwnStrategies(page)
  await open(page, JSON.stringify(createCopyPreviewState(owner)), true)
  await expect(page.locator('.client-account-terminal')).toBeVisible()
  await strategyPanel(page)
  await page.locator('[data-strategy-id="user:1000"] .tft-select').click()
  await strategyPanel(page)
  await page.getByRole('button', { name: copy.ko.copies, exact: true }).click()
  await page.locator('.ctcp-saved').getByRole('button', { name: '내 전략', exact: true }).click()
  await expect(page).toHaveURL(/#\/share\/publishing$/)
  await page.reload()
  await expect(page.locator('#research-title')).toHaveText('내 전략')
  await page.locator('.hub-header').getByRole('button', { name: shellText('ko', 'trading'), exact: true }).click()
  const root = page.locator('.client-account-terminal')
  await expect(root).toHaveAttribute('data-selected-strategy', 'user:1000')
  await expect(root).toHaveAttribute('data-management', 'true')
  await expect(page.locator('.client-terminal-copies h2')).toBeFocused()
  await expect(page.locator('.ctcp-saved').getByRole('button', { name: '관심 전략', exact: true })).toBeVisible()
})

for (const width of [320, 1440]) test(`${width}px 본인·복사 동시 관리와 상세 왕복·새로고침은 선택을 보존한다`, async ({ page }, info) => {
  await page.addInitScript(() => {
    const events: { target: string; stack?: string }[] = [], focus = HTMLElement.prototype.focus
    Reflect.set(window, 'terminalFocusEvents', events)
    HTMLElement.prototype.focus = function(options) {
      events.push({ target: `${this.tagName}.${this.className}#${this.id}`, stack: new Error().stack })
      focus.call(this, options)
    }
  })
  await page.setViewportSize({ width, height: 900 }); await seedOwnStrategies(page); await open(page, JSON.stringify(state), true)
  const root = page.locator('.client-account-terminal'), errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await expect(root).toHaveAttribute('data-selected-strategy', 'user:2000')
  await strategyPanel(page)
  await page.locator('[data-strategy-id="user:1000"] .tft-select').click()
  await expect(root).toHaveAttribute('data-selected-strategy', 'user:1000')
  const original = await root.elementHandle()
  await strategyPanel(page)
  await page.getByRole('button', { name: copy.ko.copies, exact: true }).click()
  await expect(page.locator('.client-terminal-copies h2')).toBeFocused()
  expect(await page.locator('.cat-management-trigger').evaluate(node => getComputedStyle(node).fontSize)).toBe('13px')
  await expect(root).toHaveAttribute('data-management', 'true')
  await expect(page.locator('.cat-brain')).toBeHidden()
  await expect(page.locator('.cat-context')).toContainText('내 연구 1000')
  await page.screenshot({ path: info.outputPath('mixed-management.png') })
  await page.getByRole('button', { name: /^관리:/ }).click()
  await expect(page.locator('.cpx')).toBeVisible()
  await page.locator('.cpx .ss3-back').click()
  await expect(root).toHaveAttribute('data-management', 'true')
  await expect(root).toHaveAttribute('data-selected-strategy', 'user:1000')
  expect(await root.evaluate((node, before) => node === before, original)).toBe(true)
  await expect(page.locator('.client-terminal-copies h2')).toBeFocused()
  await page.getByRole('button', { name: /^관리:/ }).click()
  await page.getByRole('group', { name: '카피 상세 정보' }).getByRole('button', { name: '거래 내역', exact: true }).click()
  await page.reload()
  await expect(page.locator('.cpx')).toBeVisible()
  await page.locator('.cpx .ss3-back').click()
  await expect(root).toHaveAttribute('data-selected-strategy', 'user:1000')
  await expect(root).toHaveAttribute('data-management', 'true')
  await expect(page.locator('.client-terminal-copies h2')).toBeFocused().catch(async error => {
    await info.attach('reload-focus', { body: JSON.stringify(await page.evaluate(() => ({ events: Reflect.get(window, 'terminalFocusEvents'), active: document.activeElement?.outerHTML }))), contentType: 'application/json' })
    throw error
  })
  await page.getByRole('button', { name: copy.ko.back, exact: true }).click()
  await expect(page.locator('.cat-tabs [aria-selected="true"]')).toBeFocused()
  await expect(page.locator('.cat-brain')).toBeVisible()
  await strategyPanel(page)
  await page.getByRole('button', { name: copy.ko.copies, exact: true }).click()
  await strategyPanel(page)
  await page.locator('[data-strategy-id="user:2000"] .tft-select').click()
  await expect(root).toHaveAttribute('data-management', 'false')
  await strategyPanel(page)
  await page.getByRole('button', { name: copy.ko.copies, exact: true }).click()
  await page.getByRole('button', { name: /^관리:/ }).click()
  await page.getByRole('button', { name: '카피 종료', exact: true }).click()
  await page.getByRole('button', { name: '종료하고 정산', exact: true }).click()
  await expect(root).toHaveAttribute('data-management', 'true')
  await expect(root).toHaveAttribute('data-selected-strategy', 'user:2000')
  await expect(page.locator('.client-terminal-copies h2')).toHaveText(copy.ko.empty)
  await expect(page.getByRole('button', { name: copy.ko.history, exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  expect(errors).toEqual([])
})

test('상세에서 새로고침 뒤 사라진 본인 전략은 복귀 의도로 부활시키지 않는다', async ({ page }) => {
  await seedOwnStrategies(page); await open(page, JSON.stringify(state), true)
  await expect(page.locator('.client-account-terminal')).toHaveAttribute('data-selected-strategy', 'user:2000')
  await strategyPanel(page)
  await page.getByRole('button', { name: copy.ko.copies, exact: true }).click()
  await page.getByRole('button', { name: /^관리:/ }).click()
  await expect(page.locator('.cpx')).toBeVisible()
  await page.evaluate(owner => {
    const key = `teth-client-user-strategies:${encodeURIComponent(owner)}`
    sessionStorage.setItem(key, JSON.stringify(JSON.parse(sessionStorage.getItem(key)!).filter((item: { record: { id: string } }) => item.record.id !== '2000')))
  }, owner)
  await page.reload(); await expect(page.locator('.cpx')).toBeVisible()
  await page.locator('.cpx .ss3-back').click()
  await expect(page.locator('.client-account-terminal')).toHaveAttribute('data-selected-strategy', 'user:1000')
  await expect(page.locator('[data-strategy-id="user:2000"]')).toHaveCount(0)
})

test('동시 관리7언어·확대 글자·손상 복사 원장에서도 본인 전략은 보존한다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 }); await seedOwnStrategies(page); await open(page, '{broken', true)
  await expect(page.locator('.client-account-terminal')).toHaveAttribute('data-selected-strategy', 'user:2000')
  for (const language of Object.keys(copy) as ClientLanguage[]) {
    await page.evaluate(async language => { const path = '/src/client-preferences.ts'; (await import(path)).setClientPreference('language', language) }, language)
    await strategyPanel(page, language)
    await page.getByRole('button', { name: copy[language].copies, exact: true }).click()
    await expect(page.locator('.client-terminal-copies [role="alert"]')).toBeVisible()
    await expect(page.locator('.client-terminal-copies li')).toHaveCount(0)
    await expect(page.locator('.client-account-terminal')).toHaveAttribute('data-selected-strategy', 'user:2000')
    await page.getByRole('button', { name: copy[language].back, exact: true }).click()
    await expect(page.locator('.cat-tabs [aria-selected="true"]')).toBeFocused()
  }
  await page.addStyleTag({ content: '.cat-management-back,.cat-management-trigger {font-size:26px!important}' })
  await strategyPanel(page, 'fr')
  await page.getByRole('button', { name: copy.fr.copies, exact: true }).click()
  for (const selector of ['.cat-management-back', '.cat-management']) {
    const bounds = await page.locator(selector).evaluate(node => ({ scroll: node.scrollWidth, width: node.clientWidth, right: node.getBoundingClientRect().right }))
    expect(bounds.scroll).toBeLessThanOrEqual(bounds.width + 1); expect(bounds.right).toBeLessThanOrEqual(320)
  }
  expect(await page.evaluate(key => sessionStorage.getItem(key), copyPreviewStorageKey(owner))).toBe('{broken')
})

test('저장 통지는 같은 port/owner에만 발행하고 읽기·구독은 쓰지 않는다', () => {
  let raw: string | null = null, writes = 0, failure = ''
  const port = { getItem: () => { if (failure === 'read') throw Error(); return raw }, setItem: (_key: string, value: string) => { writes++; raw = value; if (failure === 'write') throw Error() } }
  const events: (CopyPreviewStoreError | null)[] = [], foreign: unknown[] = []
  const stop = subscribeCopyPreview(owner, error => events.push(error), port)
  const stopBad = subscribeCopyPreview(owner, () => { throw Error('subscriber') }, port)
  const stopOther = subscribeCopyPreview('other', error => foreign.push(error), port)
  expect(writes).toBe(0)
  expect(saveCopyPreviewState(state, port).ok).toBe(true)
  expect(events).toEqual([null]); expect(foreign).toEqual([])
  failure = 'write'; expect(saveCopyPreviewState(state, port)).toEqual({ ok: false, error: 'write-failed' })
  failure = 'read'; expect(saveCopyPreviewState(state, port)).toEqual({ ok: false, error: 'readback-failed' })
  expect(events).toEqual([null, 'write-failed', 'readback-failed'])
  stop(); stopBad(); stopOther(); failure = ''
  saveCopyPreviewState(state, port); expect(events).toHaveLength(3)
  for (const dict of Object.values(copy)) {
    expect(Object.keys(dict)).toEqual(Object.keys(copy.ko))
    expect(dict.active.match(/\{\w+\}/g)).toEqual(['{count}'])
  }
})

test('마운트된 두 reader 동기화·다른 계정 격리·저장 불확실성은 명시 재확인', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(async () => { const path = '/tests/fixtures/copy-account-sync-harness.tsx'; window.copySync = (await import(path)).mountCopyAccountSync() })
  const first = page.locator('#first'), second = page.locator('#second'), foreign = page.locator('#foreign')
  await expect(second.locator('output')).toContainText('1000')
  await first.getByText('add', { exact: true }).click()
  await expect(second.locator('output')).toContainText('2000'); await expect(foreign.locator('output')).toContainText('1000')
  await page.evaluate(() => {
    const set = Storage.prototype.setItem
    Storage.prototype.setItem = function(key, value) { set.call(this, key, value); if (key.includes('teth-copy-preview:account:a')) throw Error('after-write') }
    Reflect.set(window, 'restoreCopySetter', () => { Storage.prototype.setItem = set })
  })
  await first.getByText('add', { exact: true }).click()
  for (const reader of [first, second]) await expect(reader.locator('output')).toContainText('"spot":null,"blocked":true')
  await page.evaluate(() => Reflect.get(window, 'restoreCopySetter')())
  await first.getByText('retry', { exact: true }).click(); await first.getByText('add', { exact: true }).click()
  await expect(first.locator('output')).toContainText('4000'); await expect(second.locator('output')).toContainText('"blocked":true')
  await second.getByText('retry', { exact: true }).click(); await expect(second.locator('output')).toContainText('4000')
  await page.evaluate(() => window.copySync.owner('b')); await expect(second.locator('output')).toContainText('"owner":"b"')
  await first.getByText('add', { exact: true }).click(); await expect(second.locator('output')).toContainText('1000')
  await page.evaluate(() => window.copySync.second(false)); await foreign.getByText('add', { exact: true }).click()
  await page.evaluate(() => window.copySync.second(true)); await expect(second.locator('output')).toContainText('2000')
})

test('처음 저장소 접근이 막혀도 명시 복구 뒤 mounted reader 구독을 다시 연결한다', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(async () => { const path = '/tests/fixtures/copy-account-sync-harness.tsx'; window.copySync = (await import(path)).mountCopyAccountSync(true) })
  await expect(page.locator('#second output')).toContainText('"blocked":true')
  await page.evaluate(() => window.copySync.restoreStorage())
  await page.locator('#first').getByText('retry', { exact: true }).click()
  await page.locator('#second').getByText('retry', { exact: true }).click()
  await expect(page.locator('#second output')).toContainText('"blocked":false')
  await page.locator('#first').getByText('add', { exact: true }).click()
  await expect(page.locator('#second output')).toContainText('2000')
})

for (const width of [320, 1440]) test(`${width}px 실제 앱 복사만 보유→터미널→관리5탭→새로고침→터미널 복귀·종료`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 }); await open(page)
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  const list = page.locator('.client-terminal-copies')
  await expect(page.locator('[data-strategy-id^="demo:"]')).toHaveCount(0)
  await expect(list.locator('h2')).toHaveText(copy.ko.active.replace('{count}', '1'))
  const values = calculateCopyPreview(state.copies[0], source)!
  await expect(list.locator('dd').first()).toHaveText(`${values.inv.toLocaleString('ko', { minimumFractionDigits: 2 })} USDT`)
  await page.screenshot({ path: info.outputPath('terminal-copies.png') })
  await list.getByRole('button', { name: /^관리:/ }).click()
  await expect(page.locator('.cpx')).toBeVisible()
  await page.getByRole('group', { name: '카피 상세 정보' }).getByRole('button', { name: '거래 내역', exact: true }).click()
  await page.reload(); await expect(page.locator('.cpx')).toBeVisible()
  await page.locator('.cpx .ss3-back').click(); await expect(page).toHaveURL(/#\/trade$/); await panel(page)
  await list.getByRole('button', { name: /^관리:/ }).click()
  await page.getByRole('button', { name: '카피 종료', exact: true }).click()
  await page.getByRole('button', { name: '종료하고 정산', exact: true }).click()
  await expect(page).toHaveURL(/#\/trade$/); await panel(page)
  await expect(list.locator('h2')).toHaveText(copy.ko.empty)
  await expect(list.getByRole('button', { name: copy.ko.history, exact: true })).toBeVisible()
  expect(await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!).copies[0].status, copyPreviewStorageKey(owner))).toBe('closed')
  await list.getByRole('button', { name: copy.ko.history, exact: true }).click()
  await expect(page).toHaveURL(/#\/share\/library$/)
  await expect(page.locator('#research-title')).toHaveText('따라가는 중')
  await expect(page.locator('.ss3-tabs')).toHaveCount(0)
  await page.getByRole('button', { name: '종료 포함', exact: true }).click(); await expect(page.locator('.cpd-card')).toContainText('정산 확정')
  expect(errors).toEqual([])
})

test('손상 원장은 빈 계좌처럼 보이지 않고 원문 보존·키보드 복구', async ({ page }) => {
  await open(page, '{broken')
  await expect(page.locator('.client-terminal-copies [role="alert"]')).toBeVisible()
  await expect(page.locator('.client-terminal-copies li')).toHaveCount(0)
  expect(await page.evaluate(key => sessionStorage.getItem(key), copyPreviewStorageKey(owner))).toBe('{broken')
  await page.evaluate(({ key, state }) => sessionStorage.setItem(key, JSON.stringify(state)), { key: copyPreviewStorageKey(owner), state })
  await page.getByRole('button', { name: copy.ko.retry, exact: true }).click()
  await expect(page.locator('.client-terminal-copies h2')).toBeFocused()
  await expect(page.locator('.client-terminal-copies li')).toHaveCount(1)
})

test('7언어·2배 글자·긴 이름·원본 없음은 계정금액을 합성하지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 })
  const unknown = { ...state, copies: [{ ...state.copies[0], nick: '연결되지않은전략'.repeat(12) }] }
  await open(page, JSON.stringify(unknown))
  for (const lang of Object.keys(copy) as ClientLanguage[]) {
    await page.evaluate(async language => { const path = '/src/client-preferences.ts'; (await import(path)).setClientPreference('language', language) }, lang)
    await panel(page, lang)
    const list = page.locator('.client-terminal-copies')
    await expect(list).toContainText(copy[lang].missing)
    await expect(list.locator('dd')).toHaveCount(0)
    await expect(page.locator('.cat-heading h1')).toHaveText(shellText(lang, 'trading'))
    const widths = await list.evaluate(node => ({ scroll: node.scrollWidth, width: node.clientWidth }))
    expect(widths.scroll).toBeLessThanOrEqual(widths.width + 1)
  }
  await page.addStyleTag({ content: '.client-terminal-copies {font-size:200%} .client-terminal-copies *{font-size:inherit!important}' })
  const widths = await page.locator('.client-terminal-copies').evaluate(node => ({ scroll: node.scrollWidth, width: node.clientWidth }))
  expect(widths.scroll).toBeLessThanOrEqual(widths.width + 1)
})
