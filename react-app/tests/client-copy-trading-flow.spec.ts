import { expect, test, type Page } from '@playwright/test'
import { copyTraderLocation, readSharedLocation, sharedHash, sourceSharedStrategies } from '../src/client-shared-strategies'
import { projectCopyTraderProfile } from '../src/client-copy-trader-profile'
import { copyPreviewStorageKey } from '../src/client-copy-preview-store'
import { copyHistoryText } from '../src/client-copy-history-copy'
import { copySummaryText } from '../src/client-copy-trading-copy'
import { copySetupSourceText, copySetupText } from '../src/client-copy-setup-copy'
import type { ClientLanguage } from '../src/client-preferences'

const seed = sourceSharedStrategies()[0], owner = 'copy-flow@example.test', storageKey = copyPreviewStorageKey(owner)
const profileHash = sharedHash(copyTraderLocation(seed.nick)), setupHash = sharedHash({ view: 'copy-setup', nick: seed.nick, period: 'all' })
async function open(page: Page, hash = '#/share', signedIn = true) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  if (signedIn) await page.addInitScript(owner => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '카피 검수자', email: owner })), owner)
  await page.goto(`/${hash}`)
  await expect(page.locator('.client-strategy-sharing')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
}
async function start(page: Page) {
  await open(page, setupHash)
  await page.getByRole('textbox', { name: '카피 금액', exact: true }).fill('200')
  await page.getByRole('button', { name: '카피 시작', exact: true }).click()
  await expect(page.getByRole('region', { name: '카피 대시보드' })).toBeVisible()
}
const stored = (page: Page) => page.evaluate(key => JSON.parse(sessionStorage.getItem(key) ?? 'null'), storageKey)

async function language(page: Page, value: ClientLanguage) {
  await page.evaluate(async value => { const path = '/src/client-preferences.ts'; const { setClientPreference } = await import(/* @vite-ignore */ path); setClientPreference('language', value); setClientPreference('currency', 'KRW') }, value)
}
const locales: ClientLanguage[] = ['en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr', 'ko']
for (const width of [320, 1440]) test(`카피 시작설정 7언어 ${width}px: 입력·페어 초안·고급설정·원장 보존`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 })
  await open(page, setupHash)
  const input = page.locator('.cps-in input'), setup = page.locator('.cpp'), before = await stored(page)
  await input.fill('200.50')
  await page.locator('.cps-adv summary').click()
  await input.focus()
  const inputNode = await input.elementHandle(), advanced = await page.locator('.cps-adv').elementHandle()
  for (const lang of locales) {
    await language(page, lang)
    await expect(input).toHaveAccessibleName(copySetupText(lang, '카피 금액'))
    await expect(input).toHaveValue('200.50'); await expect(input).toBeFocused()
    await expect(page.locator('.cps-adv')).toHaveAttribute('open', '')
    await expect(page.locator('.cps-adv .cps-row')).toHaveCount(5)
    await expect(page.locator('.cps-cta')).toHaveText(copySetupText(lang, '카피 시작'))
    await expect(page.locator('.cps-side .bio')).toHaveText(copySetupSourceText(lang, projectCopyTraderProfile(seed, 180).meta.bio))
    expect(await inputNode!.evaluate(node => node.isConnected)).toBe(true)
    expect(await advanced!.evaluate(node => node.isConnected)).toBe(true)
    expect(await stored(page)).toEqual(before)
    if (lang !== 'ko') expect(await setup.evaluate(node => { const clone = node.cloneNode(true) as HTMLElement; clone.querySelectorAll('.nk').forEach(n => n.remove()); return clone.textContent })).not.toMatch(/[가-힣]|₩|\{\w+\}/)
    await noOverflow(page)
    if (lang === 'fr') {
      const lines = await page.locator('.cps-modes button').first().evaluate(button => {
        const node = button.firstChild!, index = node.textContent!.indexOf('proportionnelle'), range = document.createRange()
        range.setStart(node, index); range.setEnd(node, index + 'proportionnelle'.length)
        return range.getClientRects().length
      })
      expect(lines).toBe(1)
      await page.screenshot({ path: `/tmp/teth-copy-setup-fr-${width}.png`, fullPage: true })
    }
  }
  await page.getByRole('button', { name: '변경', exact: true }).click()
  const dialog = page.getByRole('dialog'), first = dialog.getByRole('checkbox').first(), last = dialog.getByRole('checkbox').last()
  await last.check()
  const checkboxNode = await last.elementHandle()
  for (const lang of locales) {
    await language(page, lang)
    await expect(dialog).toHaveAccessibleName(copySetupText(lang, '따라갈 페어 선택'))
    await expect(first).toBeChecked(); await expect(last).toBeChecked()
    expect(await checkboxNode!.evaluate(node => node.isConnected)).toBe(true)
    expect(await stored(page)).toEqual(before)
    await expect(dialog.getByRole('button', { name: copySetupText(lang, '적용'), exact: true })).toBeEnabled()
    const alignment = await dialog.locator('.cps-pair-options label').first().evaluate(label => {
      const input = label.querySelector('input')!.getBoundingClientRect(), name = label.querySelector('span')!.getBoundingClientRect(), badge = label.querySelector('small')!.getBoundingClientRect()
      return { name: Math.abs(input.top + input.height / 2 - name.top - name.height / 2), badge: Math.abs(input.top + input.height / 2 - badge.top - badge.height / 2) }
    })
    expect(alignment.name).toBeLessThan(2); expect(alignment.badge).toBeLessThan(2)
    if (lang !== 'ko') expect(await dialog.textContent()).not.toMatch(/[가-힣]|\{\w+\}/)
    await noOverflow(page)
    if (lang === 'fr') await page.screenshot({ path: `/tmp/teth-copy-pairs-fr-${width}.png`, fullPage: true })
  }
  await dialog.getByRole('button', { name: '취소', exact: true }).click()
  await page.getByRole('button', { name: '변경', exact: true }).click()
  await expect(last).not.toBeChecked()
  await first.uncheck()
  for (const lang of locales) {
    await language(page, lang)
    await expect(dialog.getByRole('status')).toHaveText(copySetupText(lang, '최소 1개 페어는 선택해야 해요'))
    await expect(dialog.getByRole('button', { name: copySetupText(lang, '적용'), exact: true })).toBeDisabled()
  }
  await first.check(); await last.check()
  await dialog.getByRole('button', { name: '적용', exact: true }).click()
  await expect(page.locator('.cps-form > .cps-row')).toContainText('외 1개')
  await page.getByRole('button', { name: '고정 마진', exact: true }).click()
  for (const lang of locales) {
    await language(page, lang)
    await expect(page.locator('.cps-form .cpp-empty')).toContainText(copySetupText(lang, '고정 마진 모드는 준비 중이에요'))
    await expect(page.locator('.cps-cta')).toHaveCount(0)
    expect(await stored(page)).toEqual(before)
    await noOverflow(page)
  }
  await page.getByRole('button', { name: '비율 따라가기로 설정하기', exact: true }).click()
  await expect(input).toHaveValue('200.50')
  await page.getByRole('button', { name: '카피 시작', exact: true }).click()
  const after = await stored(page)
  expect(after.copies[0]).toMatchObject({ amount: 200.5, mode: 'ratio', pairs: ['BTC/USDT', 'SOL/USDT'] })
  expect(after.spot).toBe(799.5)
})

test('시작설정 검증·미리보기 충전은7언어로 표시하고 명시 확인 전 원장을 바꾸지 않는다', async ({ page }) => {
  await open(page, setupHash)
  const input = page.locator('.cps-in input'), before = await stored(page)
  for (const lang of locales) {
    await language(page, lang)
    for (const invalid of ['49', '1e2', '50abc', '-100']) {
      await input.fill(invalid)
      await expect(page.locator('.cps-err')).toHaveText(copySetupText(lang, '최소 50 USDT부터 시작할 수 있어요'))
      await expect(page.locator('.cps-cta')).toBeDisabled()
    }
    await input.fill('1001')
    await expect(page.locator('.cps-err')).toHaveText(copySetupText(lang, '스팟 잔고보다 커요. 충전(+)하거나 금액을 줄여주세요'))
    await expect(page.locator('.cps-cta')).toBeDisabled()
    expect(await stored(page)).toEqual(before)
  }
  await page.getByRole('button', { name: '스팟 충전', exact: true }).click()
  const dialog = page.getByRole('dialog'), node = await dialog.elementHandle()
  for (const lang of locales) {
    await language(page, lang)
    await expect(dialog).toHaveAccessibleName(copySetupText(lang, '스팟 충전'))
    await expect(dialog).toContainText(copySetupText(lang, '체험용 스팟 잔고를 충전해요.'))
    await expect(dialog.getByRole('button', { name: copySetupText(lang, '+1,000 USDT 충전'), exact: true })).toBeEnabled()
    expect(await node!.evaluate(element => element.isConnected)).toBe(true)
    expect(await stored(page)).toEqual(before)
  }
  await dialog.getByRole('button', { name: '취소', exact: true }).click()
  expect(await stored(page)).toEqual(before)
  await page.getByRole('button', { name: '스팟 충전', exact: true }).click()
  await language(page, 'fr')
  await dialog.getByRole('button', { name: copySetupText('fr', '+1,000 USDT 충전'), exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect((await stored(page)).spot).toBe(2000)
  await expect(input).toHaveValue('1001')
  await expect(page.locator('.cps-cta')).toBeEnabled()
})

for (const width of [320, 390, 1440]) test(`카피 요약·포지션 7언어 ${width}px: 원장·DOM·손익색·USDT·한국어 원문 보존`, async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width, height: 1000 })
  await start(page)
  const before = await stored(page), address = page.url(), card = page.locator('.cpd-card').first()
  const element = await card.elementHandle(), colors = await card.locator('.cpd-kv b').evaluateAll(nodes => nodes.map(node => node.className))
  for (const lang of locales) {
    await language(page, lang)
    const dashboard = page.getByRole('region', { name: copySummaryText(lang, '카피 대시보드'), exact: true })
    await expect(dashboard.getByRole('heading', { name: copySummaryText(lang, '실시간 카피'), exact: true })).toBeVisible()
    await expect(dashboard.locator('.cpd-sum .cpp-kpi')).toHaveCount(6)
    await expect(card.getByRole('button', { name: copySummaryText(lang, '잔고 조정'), exact: true })).toBeEnabled()
    await expect(dashboard.getByRole('group', { name: copySummaryText(lang, '카피 표시') }).getByRole('button', { name: copySummaryText(lang, '카피 중'), exact: true })).toHaveAttribute('aria-pressed', 'true')
    expect(await card.locator('.cpd-kv b').evaluateAll(nodes => nodes.map(node => node.className))).toEqual(colors)
    expect(await element!.evaluate(node => node.isConnected)).toBe(true)
    if (lang !== 'ko') expect(await dashboard.evaluate(node => { const clone = node.cloneNode(true) as HTMLElement; clone.querySelectorAll('.nm').forEach(n => n.remove()); return clone.textContent })).not.toMatch(/[가-힣]|₩|\{\w+\}/)
    expect(page.url()).toBe(address); expect(await stored(page)).toEqual(before)
    await noOverflow(page)
    if (lang === 'fr') {
      await card.scrollIntoViewIfNeeded()
      await page.screenshot({ path: `/tmp/teth-copy-summary-fr-${width}.png`, fullPage: true })
    }
  }
  await card.getByRole('button', { name: '상세', exact: true }).click()
  await expect(page.locator('.cpx .cpp-empty')).toBeVisible()
  const empty = await page.locator('.cpx .cpp-empty').elementHandle()
  const detailAddress = page.url()
  for (const lang of locales) {
    await language(page, lang)
    await expect(page.locator('.cpx .cpp-empty')).toContainText(copySummaryText(lang, '포지션이 없는 동안에도 카피는 유지돼요.'))
    await expect(page.locator('.cpx table')).toHaveCount(0)
    expect(await empty!.evaluate(node => node.isConnected)).toBe(true)
    if (lang !== 'ko') expect(await page.locator('.cpx').evaluate(node => { const clone = node.cloneNode(true) as HTMLElement; clone.querySelectorAll('.cpp-nick, .cpp-ava').forEach(n => n.remove()); return clone.textContent })).not.toMatch(/[가-힣]|₩|\{\w+\}/)
    expect(await stored(page)).toEqual(before); expect(page.url()).toBe(detailAddress)
    await noOverflow(page)
    if (lang === 'fr') await page.screenshot({ path: `/tmp/teth-copy-positions-fr-${width}.png`, fullPage: true })
  }
  expect(errors).toEqual([])
})

test('종료 카피 7언어는 정산·빈 포지션·필터·돌아가기 상태를 보존한다', async ({ page }) => {
  await start(page)
  await page.locator('.cpd-card').first().getByRole('button', { name: '카피 종료', exact: true }).click()
  await page.getByRole('button', { name: '종료하고 정산', exact: true }).click()
  const closed = await stored(page)
  expect(closed.copies[0].status).toBe('closed')
  for (const lang of locales) {
    await language(page, lang)
    await expect(page.getByText(copySummaryText(lang, '진행 중인 카피가 없어요'), { exact: true })).toBeVisible()
    await page.getByRole('button', { name: copySummaryText(lang, '종료 기록 보기'), exact: true }).click()
    await expect(page.locator('.cpd-card .tag.off')).toHaveText(copySummaryText(lang, '종료됨'))
    await expect(page.locator('.cpd-card')).toContainText(copySummaryText(lang, '순손익 (정산 확정)'))
    await page.getByRole('button', { name: copySummaryText(lang, '기록 보기'), exact: true }).click()
    await expect(page.locator('.cpp-empty')).toContainText(copySummaryText(lang, '종료된 카피예요. 기록 탭에서 이력을 볼 수 있어요.'))
    await expect(page.locator('.cpp-empty')).not.toContainText(copySummaryText(lang, '트레이더가 진입하면 자동으로 함께 진입하고, 여기에 실시간으로 표시돼요.'))
    await expect(page.locator('.cpd-sum')).toContainText(copySummaryText(lang, '정산 시점 미실현'))
    expect(await stored(page)).toEqual(closed)
    await page.locator('.cpx .ss3-back').click()
  }
})

test('명시 열린 포지션 fixture: 7언어·3화면에서 원값·헤더·동일 표·접근성 보존', async ({ page }) => {
  await page.route('**/copy-open-position-fixture.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body class="client-strategy-sharing" style="margin:0;background:#101216;color:#e3e3e3;font-family:system-ui"><main id="fixture" style="padding:12px"></main></body></html>' }))
  await page.goto('/copy-open-position-fixture.html')
  await page.evaluate(async () => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    for (const stylesheet of ['/src/styles.css', '/src/client-strategy-sharing.css']) await import(/* @vite-ignore */ stylesheet)
    const cp = '/src/components/ClientCopyTrading.tsx', dp = '/@id/react-dom/client', sp = '/src/client-shared-strategies.ts', ap = '/src/client-copy-preview-state.ts'
    const transformed = await (await fetch(cp)).text(), rp = transformed.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing React instance')
    const rm = await import(/* @vite-ignore */ rp), react = rm.default ?? rm, dom = await import(/* @vite-ignore */ dp), component = await import(/* @vite-ignore */ cp)
    const shared = await import(/* @vite-ignore */ sp), state = await import(/* @vite-ignore */ ap)
    const source = shared.sourceSharedStrategies()[0]; source.nick = 'position-fixture'
    source.result.eq = Array.from({ length: 40 }, (_, i) => ({ i, v: i === 39 ? 1.2 : 1 }))
    source.result.trades = []
    source.parameters.sl = 2.5; source.parameters.tp = null
    const copy = { id: 'cp-open', nick: source.nick, mode: 'ratio', amount: 200, pairs: ['BTC/USDT'], simStartI: 0, at: Date.UTC(2026, 8, 1), status: 'active', adv: { marginMode: 'follow', lev: 'follow', slip: 'sys', maxMarginPct: 95, maxPosX: 5 }, ledger: [{ at: Date.UTC(2026, 8, 1), type: 'add', amt: 200 }] }
    if (!state.calculateCopyPreview(copy, source)?.posOpen) throw new Error('Fixture must have an open position')
    const noop = () => {}, props = { location: { view: 'copy-detail', copyId: copy.id, copyTab: 'pos', period: 'all' }, account: { state: { copies: [copy] }, blocked: false }, sources: [source], navigate: noop, Dialog: () => null, onStartGate: () => true, onFollow: noop, watching: () => false, onWatch: noop, onAsk: noop, signedIn: true, onLogin: noop }
    ;(dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture')).render(react.createElement(component.ClientCopyTrading, props))
  })
  const table = page.locator('.cpx table')
  await expect(table.locator('tbody tr')).toHaveCount(1)
  const element = await table.elementHandle()
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const lang of locales) {
      await language(page, lang)
      await expect(page.getByRole('table', { name: copySummaryText(lang, '카피 포지션'), exact: true })).toBeVisible()
      await expect(table.locator('th')).toHaveCount(8)
      await expect(table.locator('tbody td').nth(2)).toHaveText('80 USDT')
      await expect(table.locator('tbody td').nth(1)).toHaveText(copyHistoryText(lang, 'long'))
      await expect(table.locator('tbody td').nth(6)).toHaveText(`${(2.5).toLocaleString(lang)}% / ${copyHistoryText(lang, 'timeExit')}`)
      await expect(table.locator('tbody td').last()).toHaveText(`${(40).toLocaleString(lang, { minimumFractionDigits: 2 })} USDT (+${(50).toLocaleString(lang, { minimumFractionDigits: 1 })}%)`)
      await expect(page.locator('.cpx-tblw')).toHaveAttribute('tabindex', '0')
      expect(await element!.evaluate(node => node.isConnected)).toBe(true)
      if (lang !== 'ko') expect(await page.locator('.cpx').innerText()).not.toMatch(/[가-힣]|₩|\{\w+\}/)
      await noOverflow(page)
      if (lang === 'fr') await page.screenshot({ path: `/tmp/teth-copy-open-fr-${width}.png`, fullPage: true })
    }
  }
})

test('실제 상세 탭 언어 변경은 선택·주소·원장을 유지하고 기존 한국어로 복귀한다', async ({ page }) => {
  await start(page)
  await page.locator('.cpd-card').first().getByRole('button', { name: '상세', exact: true }).click()
  await page.getByRole('group', { name: '카피 상세 정보' }).getByRole('button', { name: '자금 이동', exact: true }).click()
  const address = page.url(), before = await stored(page)
  const selected = await page.locator('.cpx .cpp-tabs button[aria-pressed=true]').elementHandle()
  for (const language of ['en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr', 'ko'] as ClientLanguage[]) {
    await page.evaluate(async language => { const path = '/src/client-preferences.ts'; const { setClientPreference } = await import(/* @vite-ignore */ path); setClientPreference('language', language) }, language)
    const tabs = page.getByRole('group', { name: copyHistoryText(language, 'tabs'), exact: true })
    await expect(tabs.getByRole('button')).toHaveText((['pos', 'hist', 'share', 'bal', 'tx'] as const).map(key => copyHistoryText(language, key)))
    await expect(tabs.getByRole('button', { name: copyHistoryText(language, 'bal'), exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('table', { name: copyHistoryText(language, 'bal'), exact: true })).toBeVisible()
    expect(await selected!.evaluate(node => node.isConnected)).toBe(true)
    expect(page.url()).toBe(address); expect(await stored(page)).toEqual(before)
    await noOverflow(page)
  }
})
async function noOverflow(page: Page) {
  const widths = await page.evaluate(() => [document.documentElement, document.body, document.getElementById('research-main'), document.querySelector('.client-strategy-sharing')].filter((el): el is HTMLElement => el instanceof HTMLElement).map(el => ({ name: el.id || el.tagName, scroll: el.scrollWidth, width: el.clientWidth })))
  for (const width of widths) expect(width.scroll, width.name).toBeLessThanOrEqual(width.width + 1)
}

test('원본 프로필·설정·상세5탭 route는 인코딩 왕복하며 malformed는 허브로 복구한다', () => {
  for (const value of [copyTraderLocation('닉/테스트'), { ...copyTraderLocation(seed.nick), profileTab: 'cal' as const }, { view: 'copy-setup' as const, nick: seed.nick, period: 'all' as const }, { view: 'copy-detail' as const, copyId: 'cp/id', copyTab: 'hist' as const, period: 'all' as const }]) expect(readSharedLocation(sharedHash(value))).toEqual(value)
  for (const hash of ['#/share/t/%broken', '#/share/t/nick/evil', '#/share/copy/name/pos', '#/share/c/id/unknown']) expect(readSharedLocation(hash)).toEqual({ period: 'all' })
  expect(readSharedLocation('#/other')).toBeNull()
})

test('기존 프로필 직접주소는 원 전략 상세와 원본 지표·5탭·기간·뒤로가기를 보존한다', async ({ page }) => {
  // New catalogue cards use stable IDs; saved legacy profile URLs stay valid.
  await open(page, profileHash)
  const originalLength = await page.evaluate(() => history.length)
  await expect(page).toHaveURL(new RegExp(profileHash + '$'))
  await expect(page.locator('.hub-header h1')).toHaveText('트레이더 프로필')
  await expect(page.locator('.cpp-grid .cpp-kpi')).toHaveCount(8)
  for (const days of [7, 30, 90, 180] as const) {
    await page.getByRole('group', { name: '기간 선택' }).getByRole('button', { name: `${days}일`, exact: true }).click()
    const p = projectCopyTraderProfile(seed, days)
    await expect(page.locator('.cpp-grid .cpp-kpi').first().locator('b')).toHaveText(`${p.performance.roi >= 0 ? '+' : ''}${p.performance.roi.toFixed(2)}%`)
    await expect(page.getByRole('img', { name: '검증 구간 누적 수익 곡선', exact: true })).toHaveAttribute('data-point-count', String(p.performance.eq.length))
  }
  const tabs = page.getByRole('group', { name: '트레이더 정보' })
  for (const [name, title] of [['포지션', '지금은 표시할 오픈 포지션이 없어요'], ['자금 이동', '아직 자금 이동 내역이 없어요'], ['카피하는 사람들', '카피하는 사람들 랭킹을 준비하고 있어요'], ['손익 캘린더', '내 카피 손익 캘린더는 첫 청산 후에 채워져요']]) {
    await tabs.getByRole('button', { name, exact: true }).click()
    await expect(page.locator('.cpp-empty')).toContainText(title)
    expect(await page.evaluate(() => history.length)).toBe(originalLength)
  }
  await noOverflow(page)
  await page.reload()
  await expect(tabs.getByRole('button', { name: '손익 캘린더', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: '전략 상세에서 캘린더 보기', exact: true }).click()
  await expect(page.locator('.ss3-dtitle')).toContainText(seed.nick)
  await page.goBack()
  await expect(page.locator('.cpp-empty')).toContainText('첫 청산 후')
})

test('설정 폼은 원본 두 모드·페어·고급설정·50 USDT/잔액 검증을 지킨다', async ({ page }) => {
  await open(page, setupHash)
  const input = page.getByRole('textbox', { name: '카피 금액', exact: true }), submit = page.getByRole('button', { name: '카피 시작', exact: true })
  await expect(input).toHaveAttribute('type', 'text')
  await expect(submit).toBeDisabled()
  for (const invalid of ['49', '1e2', '50abc', '-100', '1001']) { await input.fill(invalid); await expect(submit).toBeDisabled(); await expect(page.locator('.cps-err')).toBeVisible() }
  await input.fill('200')
  await page.getByRole('button', { name: '고정 마진', exact: true }).click()
  await expect(page.locator('.cpp-empty')).toContainText('고정 마진 모드는 준비 중이에요')
  await page.getByRole('button', { name: '비율 따라가기로 설정하기', exact: true }).click()
  await expect(input).toHaveValue('200')
  await page.getByRole('button', { name: '변경', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '따라갈 페어 선택', exact: true })
  await dialog.getByRole('checkbox').first().uncheck()
  await expect(dialog.getByRole('button', { name: '적용', exact: true })).toBeDisabled()
  await dialog.getByRole('checkbox').last().check()
  await dialog.getByRole('button', { name: '적용', exact: true }).click()
  await expect(page.locator('.cps-form')).toContainText('SOL/USDT')
  await expect(input).toHaveValue('200')
  await page.locator('.cps-adv summary').click()
  await expect(page.locator('.cps-adv')).toContainText('1,000 USDT까지, 자동')
  await noOverflow(page)
})

test('시작→대시보드→입출금→상세5탭→종료기록→reload가 동일 원장과 정산을 유지한다', async ({ page }) => {
  const requests: string[] = []
  page.on('request', request => { if (/\/api\//.test(request.url()) && request.method() !== 'GET') requests.push(request.url()) })
  await start(page)
  expect((await stored(page)).spot).toBe(800)
  const card = page.locator('.cpd-card').first()
  await card.getByRole('button', { name: '잔고 조정', exact: true }).click()
  let dialog = page.getByRole('dialog', { name: `잔고 조정, ${seed.nick}`, exact: true })
  await dialog.getByRole('textbox', { name: '조정 금액', exact: true }).fill('100')
  await dialog.getByRole('button', { name: '확인', exact: true }).click()
  if (await page.getByRole('dialog', { name: '잠깐, 손실 구간이에요' }).isVisible()) await page.getByRole('button', { name: '100.00 USDT 추가할게요', exact: true }).click()
  expect((await stored(page)).spot).toBe(700)
  await card.getByRole('button', { name: '상세', exact: true }).click()
  await expect(page.locator('.hub-header h1')).toHaveText('카피 상세')
  const tabs = page.getByRole('group', { name: '카피 상세 정보' })
  for (const name of ['청산 이력', '수익 분배', '자금 이동', '거래 내역', '포지션']) { await tabs.getByRole('button', { name, exact: true }).click(); await expect(tabs.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true'); await noOverflow(page) }
  await page.getByRole('button', { name: '잔고 조정', exact: true }).click()
  dialog = page.getByRole('dialog', { name: `잔고 조정, ${seed.nick}`, exact: true })
  await dialog.getByRole('button', { name: '출금', exact: true }).click()
  await dialog.getByRole('textbox', { name: '조정 금액', exact: true }).fill('25')
  await dialog.getByRole('button', { name: '확인', exact: true }).click()
  await expect(tabs.getByRole('button', { name: '자금 이동', exact: true })).toHaveAttribute('aria-pressed', 'true')
  expect((await stored(page)).spot).toBe(725)
  await expect(page.getByRole('table', { name: '자금 이동', exact: true }).locator('tbody tr')).toHaveCount(3)
  await page.getByRole('button', { name: '카피 종료', exact: true }).click()
  await page.getByRole('button', { name: '종료하고 정산', exact: true }).click()
  await expect(page.locator('.cpx')).toHaveCount(0)
  await expect(page).toHaveURL(/#\/share\/library$/); await expect(page.locator('#research-title')).toHaveText('따라가는 중')
  await page.getByRole('button', { name: '종료 포함', exact: true }).click()
  await expect(page.locator('.cpd-card')).toContainText('정산 확정')
  await page.getByRole('button', { name: '기록 보기', exact: true }).click()
  await expect(page.locator('.cpp-meta')).toContainText('종료됨')
  const closed = await stored(page)
  expect(closed.copies[0].status).toBe('closed')
  expect(closed.copies[0].ledger).toHaveLength(4)
  const metrics = await page.locator('.cpd-sum').innerText()
  await page.reload()
  await expect(page.locator('.cpd-sum')).toHaveText(metrics, { useInnerText: true })
  expect(await stored(page)).toEqual(closed)
  await page.getByRole('button', { name: '따라가기', exact: true }).click()
  await page.getByRole('button', { name: '종료 포함', exact: true }).click()
  await expect(page.locator('.cpd-card')).toContainText('정산 확정')
  await page.getByRole('button', { name: '기록 보기', exact: true }).click()
  await expect(page.locator('.cpp-meta')).toContainText('종료됨')
  expect(requests).toEqual([])
})

test('같은 트레이더 활성카피 재진입은 중복 생성·차감하지 않는다', async ({ page }) => {
  await start(page)
  const before = await stored(page)
  await page.locator('.cpd-card .nm').click()
  await page.getByRole('button', { name: '카피하기', exact: true }).click()
  await page.getByRole('textbox', { name: '카피 금액', exact: true }).fill('200')
  await page.getByRole('button', { name: '카피 시작', exact: true }).click()
  await expect(page.getByRole('region', { name: '카피 대시보드' })).toBeVisible()
  expect(await stored(page)).toEqual(before)
})

test('guest 직접 설정·타인상세 경로는 로그인 경계이며 다른 owner에게 내 잔고가 노출되지 않는다', async ({ page, browser }) => {
  await open(page, setupHash, false)
  await expect(page.getByText('로그인 후 카피를 관리할 수 있어요', { exact: true })).toBeVisible()
  await expect(page.getByRole('textbox', { name: '카피 금액', exact: true })).toHaveCount(0)
  expect(await stored(page)).toBeNull()
  await page.goto('about:blank')
  await start(page)
  const state = await stored(page), id = state.copies[0].id
  const context = await browser.newContext({ baseURL: new URL(page.url()).origin })
  try {
    await context.addInitScript(({ state, storageKey }) => {
      sessionStorage.setItem(storageKey, JSON.stringify(state))
      sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '다른 계정', email: 'other-copy@example.test' }))
    }, { state, storageKey })
    const other = await context.newPage()
    await other.goto(`/${sharedHash({ view: 'copy-detail', copyId: id, copyTab: 'pos', period: 'all' })}`)
    await expect(other.getByText('카피를 찾을 수 없어요', { exact: true })).toBeVisible()
    await expect(other.locator('.cpd-sum')).toHaveCount(0)
    expect(await stored(other)).toEqual(state)
  } finally { await context.close() }
})

test('손상 저장소는 원문 보존·시작 차단이며 정상 확인 뒤에만 다시 진행한다', async ({ page }) => {
  await page.addInitScript(key => sessionStorage.setItem(key, '{broken'), storageKey)
  await open(page, setupHash)
  await expect(page.locator('.copy-storage-error')).toBeVisible()
  await page.getByRole('textbox', { name: '카피 금액', exact: true }).fill('200')
  await expect(page.getByRole('button', { name: '카피 시작', exact: true })).toBeDisabled()
  expect(await page.evaluate(key => sessionStorage.getItem(key), storageKey)).toBe('{broken')
  await page.evaluate(key => sessionStorage.removeItem(key), storageKey)
  await page.getByRole('button', { name: '저장 상태 다시 확인', exact: true }).click()
  await expect(page.getByRole('button', { name: '카피 시작', exact: true })).toBeEnabled()
})

for (const width of [320, 768, 1024, 1440]) test(`프로필·설정 ${width}px는 스타일·그리드·탭·텍스트가 페이지 밖으로 넘치지 않는다`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 })
  await open(page, profileHash)
  await expect(page.locator('.cpp-head')).toHaveCSS('display', 'flex')
  await expect(page.locator('.cpp-grid')).toHaveCSS('display', 'grid')
  await noOverflow(page)
  await page.screenshot({ path: `/tmp/teth-copy-profile-${width}.png`, fullPage: true })
  await page.getByRole('button', { name: '카피하기', exact: true }).click()
  await expect(page.locator('.cps-wrap')).toHaveCSS('display', 'grid')
  await noOverflow(page)
  await page.screenshot({ path: `/tmp/teth-copy-setup-${width}.png`, fullPage: true })
})
