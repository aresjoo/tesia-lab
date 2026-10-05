import { expect, test, type Page } from '@playwright/test'
import { accountPlanText } from '../src/client-account-plan-copy'
import { accountActivityText } from '../src/client-account-activity-copy'

async function mount(page: Page, view = 'Alerts') {
  await page.route('**/account-activity-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><div class="tesia-shell conversation-surface" style="min-height:100vh;display:block"><div id="fixture"></div></div></body></html>' }))
  await page.goto('/account-activity-test.html')
  await page.evaluate(async view => {
    const refreshPath = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refreshPath)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const cp = '/src/components/ClientAccountActivity.tsx', dp = '/@id/react-dom/client', sp = '/src/client-account-event-state.ts'
    const source = await (await fetch(cp)).text(), rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing Vite React instance')
    const rm = await import(/* @vite-ignore */ rp), dm = await import(/* @vite-ignore */ dp), components = await import(/* @vite-ignore */ cp), stateModule = await import(/* @vite-ignore */ sp)
    // Use this component's actual HMR dependency URL, not a second store instance.
    const preferencePath = source.match(/from "([^"]*\/client-preferences\.ts[^"]*)"/)?.[1]
    if (!preferencePath) throw new Error('Missing Vite preferences instance')
    const preferences = await import(/* @vite-ignore */ preferencePath)
    const moneyPath = '/src/client-preview-money.ts', moneyModule = await import(/* @vite-ignore */ moneyPath)
    Object.assign(window, { setAccountPreference: preferences.setClientPreference })
    for (const path of ['/node_modules/@fontsource-variable/geist/index.css', '/node_modules/@fontsource-variable/noto-sans-kr/index.css', '/node_modules/@fontsource-variable/noto-sans-sc/index.css', '/src/client-reference.css']) await import(/* @vite-ignore */ path)
    const react = rm.default ?? rm, h = react.createElement, now = Date.UTC(2026, 8, 15, 12)
    const reviews = Array.from({ length: 12 }, (_, i) => ({ id: 'r' + i, fid: 'fill-' + i, botId: 'd1', asset: i === 0 ? '<img src=x onerror=alert(1)>' : 'BTC', kind: i === 0 ? 'time' : i === 1 ? 'tp' : 'sl', kindL: i === 0 ? '시간 청산' : i === 1 ? '익절' : '손절', pnl: -.02, at: now - i * 60000, budget: 1000000, causes: [['진입 근거', '원문 진입 <b>보존</b>'], ['청산 근거', '시간 조건 원문'], ['다음 제안', '원문 제안']], sim: true }))
    const data = stateModule.createSourceAccountEventState({
      notifs: ['pos', 'bot', 'review', 'rebate', 'credit', 'report'].map((type, i) => ({ id: 'n' + i, key: 'key' + i, type, title: type + (i === 0 ? ' +2.3%' : ''), body: i === 0 ? '<img src=x onerror=alert(1)>' : '원문 본문 ' + i, link: i === 0 ? '#/review/r0' : null, at: now - i * 3600000, read: i === 5 })),
      reviews, rebates: Array.from({ length: 35 }, (_, i) => ({ fid: 'fill-' + i, botId: 'd1', amt: i + 1, at: now - i * 60000, sim: true })),
      periodics: [{ id: 'p1', kind: 'W', label: '주간', from: now - 86400000, until: now + 1, n: 12, wins: 3, pnl: -.04, rebate: 600, sim: true, at: now }],
    })
    const ui = { view, state: data, tab: 'plan', signedIn: true, id: view === 'Periodic' ? 'p1' : 'r0', missing: false, callbacks: true, actions: false, preferenceMoney: false, strategyIds: ['d1'], calls: [] as unknown[][] }
    const root = (dm.createRoot ?? dm.default.createRoot)(document.getElementById('fixture'))
    const View = () => {
      const selected = preferences.useClientPreferences()
      return h(components['ClientAccount' + ui.view], {
      state: ui.missing ? null : ui.state, now, signedIn: ui.signedIn, tab: ui.tab, id: ui.id, strategyNames: { d1: '원본 전략' }, strategyIds: ui.strategyIds,
      money: (value: number, signed = false) => ui.preferenceMoney ? moneyModule.sourceMoney(value, selected.currency, selected.language, signed) : (value < 0 ? '−' : signed ? '+' : '') + '₩' + Math.abs(value).toLocaleString('ko-KR'),
      onNavigate: (route: string) => ui.calls.push(['navigate', route]),
      onUpgrade: ui.actions ? () => ui.calls.push(['upgrade']) : undefined,
      onLinkUid: ui.actions ? () => ui.calls.push(['linkUid']) : undefined,
      onRead: ui.callbacks ? (id: string) => { ui.calls.push(['read', id]); ui.state = stateModule.readSourceNotification(ui.state, id); render() } : undefined,
      onReadAll: ui.callbacks ? () => { ui.calls.push(['readAll']); ui.state = stateModule.readAllSourceNotifications(ui.state); render() } : undefined,
      onPreference: ui.callbacks ? (key: string, value: boolean) => { ui.calls.push(['preference', key, value]); ui.state = stateModule.setSourceNotificationPreference(ui.state, key, value); render() } : undefined,
      })
    }
    const render = () => root.render(h(View))
    Object.assign(window, { accountUI: ui, unmountAccount: () => root.unmount(), patchAccount: (patch: object, statePatch?: object) => { Object.assign(ui, patch); if (statePatch) ui.state = stateModule.createSourceAccountEventState({ ...ui.state, ...statePatch }); render() } })
    render()
  }, view)
  await expect(page.locator('.client-account-activity')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
}
async function patch(page: Page, next: object, state?: object) { await page.evaluate(([next, state]) => Reflect.get(window, 'patchAccount')(next, state), [next, state]) }
async function calls(page: Page) { return page.evaluate(() => Reflect.get(window, 'accountUI').calls) }

test('PLAN 언어 설정은 헤더뿐 아니라 본문과 예외 안내에도 적용된다', async ({ page }) => {
  await mount(page, 'Plan')
  await page.evaluate(() => Reflect.get(window, 'setAccountPreference')('language', 'fr'))
  await expect(page.locator('.nfx-grid2')).toHaveAttribute('lang', 'fr')
  expect(await page.locator('.nfx-grid2').innerText()).not.toMatch(/[가-힣]/)
  await patch(page, { signedIn: false })
  await expect(page.locator('.nfx-empty')).toHaveAttribute('lang', 'fr')
  expect(await page.locator('.nfx-empty').innerText()).not.toMatch(/[가-힣]/)
  await patch(page, { signedIn: true }, { creditBal: -1 })
  expect(await page.locator('.nfx-empty').innerText()).not.toMatch(/[가-힣]/)
  await page.evaluate(() => {
    const ui = Reflect.get(window, 'accountUI')
    Reflect.get(window, 'patchAccount')({ state: { ...ui.state, sourceSha: 'untrusted-source' } })
  })
  await expect(page.locator('.nfx-edesc')).toHaveText(accountPlanText('fr', 'invalidSource'))
  for (const tab of ['rebates', 'alerts']) {
    await patch(page, { tab })
    await expect(page.locator('.nfx-grid2')).toHaveAttribute('lang', 'fr')
    expect(await page.locator('.nfx-grid2').innerText()).not.toMatch(/[가-힣]/)
  }
  await patch(page, { missing: true })
  await expect(page.locator('.nfx-empty')).toHaveAttribute('lang', 'fr')
  await expect(page.locator('.nfx-etit')).toHaveText(accountPlanText('fr', 'unavailable'))
})

for (const width of [320, 1440]) test(`PLAN ${width}px: 7언어·모든 상태는 원값·DOM·초점·콜백을 보존한다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1000 }); await mount(page, 'Plan')
  const states = [
    { data: { creditBal: 918273, uidLinked: true, payDone: false, tradeActiveUntil: null, freeUsed: 0 }, badge: null, gauge: '100%' },
    { data: { creditBal: 0, uidLinked: false, payDone: false, tradeActiveUntil: null, freeUsed: 0 }, badge: 'freeTrial', gauge: '100%' },
    { data: { creditBal: 0, uidLinked: false, payDone: false, tradeActiveUntil: null, freeUsed: 8 }, badge: 'freeTrial', gauge: '100%' },
    { data: { creditBal: 0, uidLinked: false, payDone: false, tradeActiveUntil: null, freeUsed: 9 }, badge: 'freeTrial', gauge: '100%' },
    { data: { creditBal: 0, uidLinked: false, payDone: false, tradeActiveUntil: null, freeUsed: 10 }, badge: 'upgradeRequired', gauge: '100%' },
    { data: { creditBal: 0, uidLinked: false, payDone: true, tradeActiveUntil: null, freeUsed: 10 }, badge: 'membership', gauge: '100%' },
    { data: { creditBal: 918273, uidLinked: true, payDone: false, tradeActiveUntil: Date.UTC(2026, 8, 16), freeUsed: 10 }, badge: 'tradeBadge', gauge: '100%' },
  ] as const
  await patch(page, { actions: true })
  const hero = page.locator('.nfx-card-hero'), tab = page.locator('.nfx-tab').first()
  for (const state of states) {
    await patch(page, {}, state.data)
    const before = await page.evaluate(() => JSON.stringify(Reflect.get(window, 'accountUI').state))
    const node = await hero.elementHandle()
    await tab.focus()
    for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
      await page.evaluate(value => Reflect.get(window, 'setAccountPreference')('language', value), language)
      await expect(page.locator('.nfx-grid2')).toHaveAttribute('lang', language)
      await expect(hero.locator('.nfx-badge')).toHaveText(state.badge ? accountPlanText(language, state.badge) : 'PRO')
      await expect(hero.locator('.nfx-gfill')).toHaveAttribute('style', `width: ${state.gauge};`)
      if (await hero.locator('.nfx-hero-sub').count() && ['en', 'es', 'fr'].includes(language)) await expect(hero.locator('.nfx-hero-sub')).toHaveCSS('letter-spacing', 'normal')
      await expect(page.locator('.nfx-sectit')).toHaveText(accountPlanText(language, 'details'))
      if (state.badge === 'freeTrial' || state.badge === 'upgradeRequired') {
        const exhausted = state.badge === 'upgradeRequired'
        const low = state.data.freeUsed >= 8
        await expect(hero.locator('.nfx-hero')).toHaveText(exhausted ? accountPlanText(language, 'spentValue') : low ? accountPlanText(language, 'freeLow') : `${accountPlanText(language, 'freeValue')} ${accountPlanText(language, 'trialInUse')}`)
        await expect(hero.locator('.nfx-glabels span')).toHaveText([accountPlanText(language, exhausted ? 'trialExhausted' : 'freeStatus'), accountPlanText(language, exhausted ? 'continueLinkOrSubscribe' : 'uidAlwaysFree')])
        expect((await hero.locator('.nfx-hero,.nfx-hero-label,.nfx-glabels').allTextContents()).join(' ')).not.toMatch(/\d/)
      }
      expect(await hero.evaluate((element, previous) => element === previous, node)).toBe(true)
      await expect(tab).toBeFocused()
      expect(await page.evaluate(() => JSON.stringify(Reflect.get(window, 'accountUI').state))).toBe(before)
      if (language !== 'ko') expect(await page.locator('.nfx-grid2').innerText()).not.toMatch(/[가-힣]/)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      const cost = page.locator('.nfx-text-value')
      expect(await cost.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
      if (state.badge === 'tradeBadge') {
        const date = await page.evaluate(locale => new Date(Date.UTC(2026, 8, 16)).toLocaleDateString(locale), language)
        await expect(hero).toContainText(accountPlanText(language, 'expires', { date }))
      }
    }
  }
  expect(await calls(page)).toEqual([])
  await patch(page, {}, states[0].data)
  const cta = page.getByRole('button', { name: accountPlanText('fr', 'upgrade'), exact: true })
  await cta.focus()
  for (const currency of ['USD', 'KRW', 'BTC']) {
    await page.evaluate(value => Reflect.get(window, 'setAccountPreference')('currency', value), currency)
    await expect(cta).toBeFocused()
    await expect(hero.locator('.nfx-hero')).toHaveText(`PRO ${accountPlanText('fr', 'inUse')}`)
  }
  await page.keyboard.press('Enter')
  expect(await calls(page)).toEqual([['upgrade']])
  await page.screenshot({ path: info.outputPath(`plan-credit-fr-${width}.png`), fullPage: true })
})

for (const width of [320, 1440]) test(`PLAN 하위 탭 ${width}px: 언어 변경은 원장·스위치·동선을 유지한다`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 })
  await mount(page, 'Plan'); await patch(page, { tab: 'alerts' })
  const state = await page.evaluate(() => JSON.stringify(Reflect.get(window, 'accountUI').state))
  const email = page.getByRole('switch').last(), node = await email.elementHandle()
  await email.focus()
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await page.evaluate(value => Reflect.get(window, 'setAccountPreference')('language', value), language)
    await expect(page.locator('.nfx-grid2')).toHaveAttribute('lang', language)
    await expect(email).toHaveAccessibleName(accountPlanText(language, 'emailPreference'))
    await expect(email).toBeFocused()
    expect(await email.evaluate((element, previous) => element === previous, node)).toBe(true)
    await expect(page.getByRole('switch')).toHaveCount(9)
    const names = ['positionPreference', 'lossPreference', 'reviewPreference', 'rebatePreference', 'watchPreference', 'inboxPreference', 'kakaoPreference', 'telegramPreference', 'emailPreference'] as const
    for (const [index, key] of names.entries()) await expect(page.getByRole('switch').nth(index)).toHaveAccessibleName(accountPlanText(language, key))
    await expect(page.locator('.nfx-sectit')).toHaveText([accountPlanText(language, 'notificationKinds'), accountPlanText(language, 'channels')])
    await expect(page.locator('.nfx-sechead .nfx-badge')).toHaveText([accountPlanText(language, 'kindCount'), accountPlanText(language, 'channelCount')])
    await expect(page.locator('.nfx-row .nfx-badge')).toHaveText(accountPlanText(language, 'defaultChannel'))
    await expect(page.locator('.nfx-foot span')).toHaveText(accountPlanText(language, 'preferenceFooter'))
    await expect(page.getByRole('switch').nth(5)).toBeChecked()
    await expect(page.getByRole('switch').nth(5)).toBeDisabled()
    await expect(page.locator('.nfx-foot')).toHaveCSS('margin-top', '14px')
    expect(await page.evaluate(() => JSON.stringify(Reflect.get(window, 'accountUI').state))).toBe(state)
    if (language !== 'ko') expect(await page.locator('.nfx-grid2').innerText()).not.toMatch(/[가-힣]/)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  expect(await calls(page)).toEqual([])
  await page.keyboard.press('Space')
  await expect(email).toBeChecked()
  expect(await calls(page)).toEqual([['preference', 'chM', true]])
  await patch(page, { callbacks: false })
  for (const sw of await page.getByRole('switch').all()) await expect(sw).toBeDisabled()
  await patch(page, { tab: 'rebates', calls: [] })
  const first = page.locator('.nfx-row').first(), firstNode = await first.elementHandle()
  await first.focus()
  const rebateState = await page.evaluate(() => JSON.stringify(Reflect.get(window, 'accountUI').state))
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await page.evaluate(value => Reflect.get(window, 'setAccountPreference')('language', value), language)
    await expect(page.locator('.nfx-grid2')).toHaveAttribute('lang', language)
    await expect(page.locator('.nfx-row')).toHaveCount(30)
    await expect(first.locator('.nfx-rlb')).toHaveText(accountPlanText(language, 'fill', { id: '0' }))
    await expect(first).toBeFocused()
    expect(await first.evaluate((element, previous) => element === previous, firstNode)).toBe(true)
    await expect(page.locator('.account-sr')).toHaveText('₩630')
    await expect(page.getByRole('region', { name: accountPlanText(language, 'rebateAmount') })).toHaveAttribute('lang', language)
    const date = await page.evaluate(locale => new Date(Date.UTC(2026, 8, 15, 12)).toLocaleDateString(locale), language)
    await expect(first.locator('.nfx-rds')).toHaveText(accountPlanText(language, 'fillConfirmed', { date }))
    await expect(page.locator('.nfx-mval').first()).toHaveText(accountPlanText(language, 'recordCount', { count: '35' }))
    await expect(page.locator('.nfx-mval').nth(1)).toHaveText(accountPlanText(language, 'rebateRateValue'))
    await expect(page.locator('.nfx-mval').nth(1)).toHaveCSS('word-break', 'keep-all')
    expect(await page.evaluate(() => JSON.stringify(Reflect.get(window, 'accountUI').state))).toBe(rebateState)
    if (language !== 'ko') expect(await page.locator('.nfx-grid2').innerText()).not.toMatch(/[가-힣]/)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    for (const value of await page.locator('.nfx-mval').all()) expect(await value.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
  }
  await page.keyboard.press('Enter')
  expect(await calls(page)).toEqual([['navigate', '#/review/r0']])
  await patch(page, { strategyIds: [], calls: [] })
  await page.locator('.nfx-row').last().click()
  await expect(page.getByRole('status')).toHaveText(accountPlanText('fr', 'reviewExpired'))
  await page.evaluate(() => Reflect.get(window, 'setAccountPreference')('language', 'en'))
  await expect(page.getByRole('status')).toHaveText(accountPlanText('en', 'reviewExpired'))
  expect(await calls(page)).toEqual([])
  await patch(page, {}, { rebates: [{ fid: 'literal-<b>X</b>', botId: 'd1', amt: 7, at: 0, sim: true }] })
  await expect(page.getByRole('status')).toBeEmpty()
  await expect(page.locator('.nfx-rlb')).toHaveText('Fill <b>X</b>')
  await expect(page.locator('.nfx-rlb b')).toHaveCount(0)
  await expect(page.locator('.nfx-mval').first()).toHaveText(accountPlanText('en', 'recordCountOne', { count: '1' }))
  await expect(page.locator('.nfx-sechead .nfx-badge')).toHaveText(accountPlanText('en', 'recentRecordOne', { count: '1' }))
  await patch(page, {}, { rebates: [] })
  await expect(page.getByRole('status')).toBeEmpty()
  await expect(page.locator('.nfx-etit')).toHaveText(accountPlanText('en', 'rebateEmpty'))
  const emptyAction = page.locator('.nfx-empty').getByRole('button', { name: accountPlanText('en', 'goTradingEmpty'), exact: true })
  await expect(emptyAction).toHaveCSS('margin-top', '6px')
  await emptyAction.click()
  expect(await calls(page)).toEqual([['navigate', '#/trade']])
})

test('정산 연결 안내는 클릭한 체결에 귀속되고 복구·다른 정상 이동에 남지 않는다', async ({ page }) => {
  await mount(page, 'Plan'); await patch(page, { tab: 'rebates', strategyIds: [] })
  const status = page.getByRole('status'), node = await status.elementHandle()
  await expect(status).toBeEmpty()
  await page.locator('.nfx-row').last().click()
  await expect(status).toContainText('연결된 복기가')
  const announcement = await status.locator('span').elementHandle()
  await page.locator('.nfx-row').nth(-2).click()
  expect(await status.locator('span').evaluate((el, previous) => el === previous, announcement)).toBe(false)
  expect(await status.evaluate((el, previous) => el === previous, node)).toBe(true)
  await patch(page, { strategyIds: ['d1'] })
  await expect(status).toBeEmpty()
  await patch(page, { strategyIds: [] })
  await page.locator('.nfx-row').first().click()
  await expect(status).toBeEmpty()
  expect(await calls(page)).toEqual([['navigate', '#/review/r0']])
  await page.locator('.nfx-row').last().click()
  await page.evaluate(() => {
    const state = Reflect.get(window, 'accountUI').state
    Reflect.get(window, 'patchAccount')({}, { reviews: [...state.reviews, { ...state.reviews[0], fid: 'fill-29', id: 'restored' }] })
  })
  await expect(status).toBeEmpty()
  await page.locator('.nfx-row').last().click()
  expect((await calls(page)).at(-1)).toEqual(['navigate', '#/review/restored'])
})

test('정산의 표시 통화는 전달 formatter를 따르며 원장과 같은 행·초점을 유지한다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await mount(page, 'Plan'); await patch(page, { tab: 'rebates', preferenceMoney: true })
  const first = page.locator('.nfx-row').first(), node = await first.elementHandle()
  await first.focus()
  const state = await page.evaluate(() => JSON.stringify(Reflect.get(window, 'accountUI').state))
  for (const language of ['ko', 'en', 'fr'] as const) for (const currency of ['KRW', 'USD', 'BTC']) {
    await page.evaluate(([language, currency]) => {
      Reflect.get(window, 'setAccountPreference')('language', language)
      Reflect.get(window, 'setAccountPreference')('currency', currency)
    }, [language, currency])
    // Historical KRW preview inputs retain their basis; display is now USD only.
    const total = '$0.45'
    const row = '+$0'
    const localized = (value: string) => language === 'fr' ? value.replace('.', ',') : value
    await expect(page.locator('.account-sr')).toHaveText(localized(total))
    await expect(page.locator('.account-count [aria-hidden="true"]')).toHaveText(localized(total))
    await expect(first.locator('.nfx-rval')).toHaveText(localized(row))
    await expect(first).toBeFocused()
    expect(await first.evaluate((element, previous) => element === previous, node)).toBe(true)
    expect(await page.evaluate(() => JSON.stringify(Reflect.get(window, 'accountUI').state))).toBe(state)
  }
  expect(await calls(page)).toEqual([])
})

test('최신 무료 체험은 횟수·잔여비율 대신 원본 정성 상태만 표시한다', async ({ page }) => {
  await mount(page, 'Plan')
  const hero = page.locator('.nfx-card-hero')
  for (const [freeUsed, value, gauge] of [[0, '무료 체험 중', 'inf'], [7, '무료 체험 중', 'inf'], [8, '얼마 남지 않음', 'warn'], [9, '얼마 남지 않음', 'warn'], [10, '소진', 'empty'], [12, '소진', 'empty']] as const) {
    await patch(page, {}, { freeUsed, uidLinked: false, creditBal: 0 })
    const state = await page.evaluate(() => JSON.stringify(Reflect.get(window, 'accountUI').state))
    await expect(hero.locator('.nfx-hero')).toHaveText(value)
    await expect(hero.locator('.nfx-hero-label')).toHaveText('이용 상태')
    await expect(hero.locator('.nfx-gfill')).toHaveClass(`nfx-gfill ${gauge}`)
    await expect(hero.locator('.nfx-gfill')).toHaveAttribute('style', 'width: 100%;')
    const trackWidth = await hero.locator('.nfx-gtrack').evaluate(el => el.getBoundingClientRect().width)
    await expect.poll(() => hero.locator('.nfx-gfill').evaluate(el => el.getBoundingClientRect().width)).toBe(gauge === 'empty' ? 0 : trackWidth)
    expect((await hero.locator('.nfx-hero,.nfx-hero-label,.nfx-glabels').allTextContents()).join(' ')).not.toMatch(/\d/)
    await expect(hero.locator('[title], [role="progressbar"], .account-count, .nfx-gpin')).toHaveCount(0)
    expect(await page.evaluate(() => JSON.stringify(Reflect.get(window, 'accountUI').state))).toBe(state)
  }
})

test('PLAN CTA는 좁은 Latin 화면에서도 단어와 SVG를 보존한다', async ({ page }) => {
  await mount(page, 'Plan')
  await patch(page, { actions: true }, { freeUsed: 8, uidLinked: false, creditBal: 0 })
  const cta = page.locator('.nfx-cta'), buttons = cta.locator('button')
  const state = await page.evaluate(() => JSON.stringify(Reflect.get(window, 'accountUI').state))
  for (const width of [320, 390, 640, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const language of ['en', 'es', 'fr', 'ko'] as const) {
      await buttons.first().focus()
      await page.evaluate(value => Reflect.get(window, 'setAccountPreference')('language', value), language)
      await expect(buttons.first()).toBeFocused()
      const layout = await cta.evaluate(el => {
        const buttons = [...el.querySelectorAll('button')]
        const brokenWords: string[] = []
        for (const button of buttons) {
          const walker = document.createTreeWalker(button, NodeFilter.SHOW_TEXT)
          while (walker.nextNode()) {
            const node = walker.currentNode
            for (const word of (node.textContent ?? '').matchAll(/[\p{L}\p{M}]+/gu)) {
              const range = document.createRange()
              range.setStart(node, word.index); range.setEnd(node, word.index + word[0].length)
              if (new Set([...range.getClientRects()].map(rect => Math.round(rect.top))).size > 1) brokenWords.push(word[0])
            }
          }
        }
        return { brokenWords, tops: buttons.map(button => button.getBoundingClientRect().top), iconWidth: el.querySelector('svg')!.getBoundingClientRect().width, overflow: document.documentElement.scrollWidth > innerWidth }
      })
      expect(layout.brokenWords).toEqual([])
      expect(layout.iconWidth).toBe(15)
      expect(layout.overflow).toBe(false)
      if (language === 'ko' || width === 1440) expect(layout.tops[0]).toBe(layout.tops[1])
      expect(await page.evaluate(() => JSON.stringify(Reflect.get(window, 'accountUI').state))).toBe(state)
    }
  }
  expect(await calls(page)).toEqual([])
})

test('복기와 보고서 본문은 선택 언어를 따르고 공급 원문은 유지한다', async ({ page }) => {
  await mount(page, 'Review')
  await page.evaluate(() => Reflect.get(window, 'setAccountPreference')('language', 'en'))
  await expect(page.locator('.nfx-sectit')).toHaveText('TETH Causal Analysis')
  await expect(page.locator('.nfxr-sbody')).toHaveText(['원문 진입 <b>보존</b>', '시간 조건 원문', '원문 제안'])
  await patch(page, { view: 'Periodic', id: 'p1' })
  await expect(page.locator('.nfx-hero-label')).toHaveText('Total Period PnL')
})

for (const width of [320, 1440]) test(`계정 활동 ${width}px: 5화면·7언어·같은 원문/DOM/초점/동선`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1000 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await mount(page)
  for (const view of ['Alerts', 'Reports', 'RebateSummary', 'Review', 'Periodic']) {
    await patch(page, { view, id: view === 'Periodic' ? 'p1' : 'r0' })
    const frame = page.locator('.client-account-activity'), node = await frame.elementHandle()
    const control = view === 'RebateSummary' ? page.locator('.ag2') : frame.locator('button').first()
    await control.focus()
    const controlNode = await control.elementHandle()
    const state = await page.evaluate(() => JSON.stringify(Reflect.get(window, 'accountUI').state))
    const ring = view === 'Periodic' ? await page.locator('.nfxr-ring').elementHandle() : null
    for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
      await page.evaluate(value => Reflect.get(window, 'setAccountPreference')('language', value), language)
      await expect(frame).toHaveAttribute('lang', language)
      expect(await frame.evaluate((element, prior) => element === prior, node)).toBe(true)
      await expect(control).toBeFocused()
      expect(await control.evaluate((element, prior) => element === prior, controlNode)).toBe(true)
      if (view === 'Alerts') {
        await expect(page.getByRole('group', { name: accountActivityText(language, 'categories') })).toBeVisible()
        await expect(page.locator('.tg')).toHaveText((['position', 'strategy', 'review', 'rebates', 'credits', 'reports'] as const).map(key => accountActivityText(language, key)))
        await expect(page.getByRole('button', { name: accountActivityText(language, 'readAll'), exact: true })).toBeVisible()
        await expect(page.getByRole('button', { name: accountActivityText(language, 'preferences'), exact: true })).toBeVisible()
        await expect(page.locator('.bd2').first()).toHaveText('<img src=x onerror=alert(1)>')
        await expect(page.locator('.mv').first()).toHaveText('+2.3%')
        await expect(page.locator('.tm').first()).toHaveText(accountActivityText(language, 'justNow'))
        const ago = await page.evaluate(locale => new Intl.RelativeTimeFormat(locale, { numeric: 'always' }).format(-1, 'hour'), language)
        await expect(page.locator('.tm').nth(1)).toHaveText(ago)
      } else if (view === 'Review') {
        await expect(page.locator('.nfx-sectit')).toHaveText(accountActivityText(language, 'causality'))
        await expect(page.locator('.nfx-ctitle')).toContainText(accountActivityText(language, 'reviewTitle', { asset: '<img src=x onerror=alert(1)>', kind: accountActivityText(language, 'timedExit') }))
        await expect(page.locator('.nfx-hero-desc')).toHaveText(accountActivityText(language, 'timeDescription'))
        await expect(page.locator('.nfxr-sbody')).toHaveText(['원문 진입 <b>보존</b>', '시간 조건 원문', '원문 제안'])
        await expect(page.locator('.nfxr-stit')).toHaveText((['entryReason', 'exitReason', 'nextSuggestion'] as const).map(key => accountActivityText(language, key)))
        await expect(page.locator('.nfxr-chiprow')).toContainText('원본 전략')
      } else if (view === 'Reports') {
        await expect(page.locator('.nfx-rlb')).toHaveText(accountActivityText(language, 'performanceReport', { period: accountActivityText(language, 'weekly') }))
        const range = await page.evaluate(locale => [Date.UTC(2026, 8, 14, 12), Date.UTC(2026, 8, 15, 12)].map(at => new Date(at).toLocaleDateString(locale)).join(' ~ '), language)
        const winRate = await page.evaluate(locale => new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(.25), language)
        await expect(page.locator('.nfx-rds')).toHaveText(accountActivityText(language, 'reportSummary', { range, count: '12', winRate }))
      } else if (view === 'Periodic') {
        await expect(page.locator('.nfx-hero-label')).toHaveText(accountActivityText(language, 'periodPnl'))
        expect(await page.locator('.nfxr-ring').evaluate((element, prior) => element === prior, ring)).toBe(true)
        const rate = await page.evaluate(locale => new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(.25), language)
        await expect(page.locator('.nfxr-ring .val')).toHaveText(rate)
        await expect(page.locator('.nfxr-stats .nfx-mval').nth(1)).toHaveText(rate)
      } else await expect(page.getByRole('region', { name: accountPlanText(language, 'rebateAmount') })).toBeVisible()
      if (view === 'Review' || view === 'Periodic' || view === 'Reports') {
        const percent = await page.evaluate(([locale, value]) => new Intl.NumberFormat(locale, { style: 'percent', signDisplay: 'always', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Number(value)), [language, view === 'Review' ? -.02 : -.04])
        await expect(page.locator(view === 'Reports' ? '.nfx-rval' : '.nfx-hero')).toHaveText(percent)
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      if (['en', 'es', 'fr'].includes(language)) {
        const brokenWords = await frame.locator('.nfx-btn,.nfxu-later,.nfxh-fchip').evaluateAll(elements => {
          const broken: string[] = []
          for (const el of elements) {
            const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
            while (walker.nextNode()) for (const word of (walker.currentNode.textContent ?? '').matchAll(/[\p{L}\p{M}]+/gu)) {
              const range = document.createRange(); range.setStart(walker.currentNode, word.index); range.setEnd(walker.currentNode, word.index + word[0].length)
              if (new Set([...range.getClientRects()].map(rect => Math.round(rect.top))).size > 1) broken.push(word[0])
            }
          }
          return broken
        })
        expect(brokenWords).toEqual([])
      }
      expect(await page.evaluate(() => JSON.stringify(Reflect.get(window, 'accountUI').state))).toBe(state)
      await expect(frame.locator('img')).toHaveCount(0)
    }
    await page.screenshot({ path: info.outputPath(`activity-${view}-fr-${width}.png`), fullPage: true })
  }
  expect(await calls(page)).toEqual([])
})

test('계정 활동의 사용자 명칭·근거·prototype 이름은 변환하거나 실행하지 않는다', async ({ page }) => {
  await mount(page, 'Review')
  const original = await page.evaluate(() => Reflect.get(window, 'accountUI').state)
  const review = { ...original.reviews[0], asset: '$& <img src=x>', kindL: '내 청산 라벨', botId: 'toString', causes: [['toString', '사용자 설명'], ['__proto__', '<b>원문</b>'], ['고유 제목', '직접 작성한 판단']] }
  await patch(page, {}, { reviews: [review], periodics: [{ ...original.periodics[0], label: '고유 주기 $& {period}' }] })
  const state = await page.evaluate(() => JSON.stringify(Reflect.get(window, 'accountUI').state))
  for (const language of ['ko', 'en', 'fr'] as const) {
    await page.evaluate(value => Reflect.get(window, 'setAccountPreference')('language', value), language)
    await expect(page.locator('.nfxr-stit')).toHaveText(['toString', '__proto__', '고유 제목'])
    await expect(page.locator('.nfxr-stag')).toHaveText(['01 STEP', '02 STEP', '03 STEP'])
    await expect(page.locator('.nfxr-sbody')).toHaveText(['사용자 설명', '<b>원문</b>', '직접 작성한 판단'])
    await expect(page.locator('.nfx-ctitle')).toContainText('$& <img src=x> 내 청산 라벨')
    await expect(page.locator('.nfx-chead button')).toContainText('고유 주기 $& {period}')
    await expect(page.locator('.client-account-activity img')).toHaveCount(0)
    expect(await page.evaluate(() => JSON.stringify(Reflect.get(window, 'accountUI').state))).toBe(state)
  }
})

test('계정 활동의 금액만 선택 통화를 따르고 원문·손익률·원장을 보존한다', async ({ page }) => {
  await mount(page, 'Periodic')
  await patch(page, { preferenceMoney: true })
  const original = await page.evaluate(() => Reflect.get(window, 'accountUI').state)
  await patch(page, {}, { periodics: [{ ...original.periodics[0], rebate: 630 }], rebates: [{ ...original.rebates[0], amt: 630 }] })
  const state = await page.evaluate(() => JSON.stringify(Reflect.get(window, 'accountUI').state))
  for (const view of ['Periodic', 'Review', 'RebateSummary']) {
    await patch(page, { view, id: view === 'Periodic' ? 'p1' : 'r0' })
    for (const language of ['ko', 'en', 'fr'] as const) for (const currency of ['KRW', 'USD', 'BTC']) {
      await page.evaluate(([language, currency]) => { Reflect.get(window, 'setAccountPreference')('language', language); Reflect.get(window, 'setAccountPreference')('currency', currency) }, [language, currency])
      const expected = '$0.45'
      const localized = language === 'fr' ? expected.replace('.', ',') : expected
      await expect(page.locator(view === 'Periodic' ? '.nfxr-stats .gain' : view === 'Review' ? '.nfxr-chip .gain' : '.ag2 .up')).toHaveText((view === 'RebateSummary' ? '' : '+') + localized)
      expect(await page.evaluate(() => JSON.stringify(Reflect.get(window, 'accountUI').state))).toBe(state)
    }
  }
  expect(await calls(page)).toEqual([])
})

test('지역화 수익률도 원본 toFixed 반올림과 영의 부호를 보존한다', async ({ page }) => {
  await mount(page, 'Review')
  const original = await page.evaluate(() => Reflect.get(window, 'accountUI').state)
  for (const [pnl, en, fr] of [[.0115, '+1.1%', '+1,1 %'], [-.0115, '-1.1%', '-1,1 %'], [-0, '+0.0%', '+0,0 %'], [-.00001, '-0.0%', '-0,0 %']] as const) {
    await patch(page, {}, { reviews: [{ ...original.reviews[0], pnl }] })
    for (const language of ['ko', 'en', 'fr'] as const) {
      await page.evaluate(value => Reflect.get(window, 'setAccountPreference')('language', value), language)
      await expect(page.locator('.nfx-hero')).toHaveText(language === 'fr' ? fr : en)
    }
  }
})

test('언어를 바꿔도 선택한 알림 필터와 읽음·딥링크 동작은 그대로다', async ({ page }) => {
  await mount(page)
  await page.locator('.nfxh-fchip').nth(1).click()
  const selected = page.locator('.nfxh-fchip').nth(1), node = await selected.elementHandle()
  const original = await page.evaluate(() => JSON.stringify(Reflect.get(window, 'accountUI').state))
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await page.evaluate(value => Reflect.get(window, 'setAccountPreference')('language', value), language)
    await expect(selected).toHaveAttribute('aria-pressed', 'true')
    await expect(selected).toBeFocused()
    expect(await selected.evaluate((el, prior) => el === prior, node)).toBe(true)
    await expect(page.locator('.nf-item')).toHaveCount(2)
    expect(await page.evaluate(() => JSON.stringify(Reflect.get(window, 'accountUI').state))).toBe(original)
  }
  expect(await calls(page)).toEqual([])
  await page.locator('.nf-item').first().click()
  expect(await calls(page)).toEqual([['read', 'n0'], ['navigate', '#/review/r0']])
  await expect(page.locator('.nf-item').first().locator('.account-sr')).toHaveText(accountActivityText('fr', 'read'))
  await page.getByRole('button', { name: accountActivityText('fr', 'readAll'), exact: true }).click()
  await expect(page.locator('.nfx-sectit .nfx-badge')).toHaveCount(0)
})

test('빈 계정 활동·0/1/2회·없는 문서도 지역화하며 공급 상태를 만들지 않는다', async ({ page }) => {
  await mount(page, 'Periodic')
  const original = await page.evaluate(() => Reflect.get(window, 'accountUI').state)
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await page.evaluate(value => Reflect.get(window, 'setAccountPreference')('language', value), language)
    for (const n of [0, 1, 2]) {
      await patch(page, { view: 'Periodic', id: 'p1' }, { periodics: [{ ...original.periodics[0], n, wins: n ? 1 : 0 }], reviews: [] })
      const one = new Intl.PluralRules(language).select(n) === 'one'
      await expect(page.locator('.nfxr-stats .nfx-mval').first()).toHaveText(accountActivityText(language, one ? 'fillOne' : 'fillCount', { count: n.toLocaleString(language) }))
      await expect(page.locator('.nfx-etit')).toHaveText(accountActivityText(language, 'noReviews'))
    }
    for (const [view, key] of [['Alerts', 'noAlerts'], ['Reports', 'noReports'], ['Review', 'reviewMissing'], ['Periodic', 'reportMissing']] as const) {
      await patch(page, { view, id: 'missing' }, { periodics: [], reviews: [], notifs: [] })
      await expect(page.locator('.nfx-etit')).toHaveText(accountActivityText(language, key))
    }
    for (const view of ['Alerts', 'Reports', 'Review', 'Periodic', 'RebateSummary']) {
      await patch(page, { view, missing: true })
      await expect(page.locator('.nfx-etit')).toHaveText(accountPlanText(language, 'unavailable'))
      await patch(page, { missing: false })
    }
  }
  await patch(page, { view: 'Alerts' }, { notifs: [{ ...original.notifs[0], type: 'toString', title: '공급된 새 알림' }] })
  await expect(page.locator('.tg')).toHaveText('toString')
  expect(await calls(page)).toEqual([])
})

test('복기·기간 보고서는 원본 인라인 간격과 보조 버튼 크기를 계승한다', async ({ page }) => {
  await mount(page, 'Review')
  const action = page.locator('.nfxr-hero .nfx-chead button')
  await expect(action).toHaveCSS('font-size', '12.5px')
  await expect(action).toHaveCSS('padding', '7px 13px')
  await expect(page.locator('.nfx-hero-desc')).toHaveCSS('margin-top', '6px')
  const color = await page.locator('.nfx-bc').evaluate(el => getComputedStyle(el).getPropertyValue('--gt2').trim())
  await expect(page.locator('.nfx-bc > span').last()).toHaveCSS('color', color.startsWith('#') ? await page.evaluate(value => { const el = document.createElement('span'); el.style.color = value; document.body.append(el); const c = getComputedStyle(el).color; el.remove(); return c }, color) : color)
  await patch(page, { view: 'Periodic', id: 'p1' })
  const boxes = page.locator('.nfxr-stats .nfx-mbox')
  await expect(boxes.nth(0)).toHaveCSS('min-width', '120px')
  await expect(boxes.nth(1)).toHaveCSS('min-width', '120px')
  await expect(boxes.nth(2)).toHaveCSS('min-width', '140px')
  await patch(page, { view: 'Alerts' })
  await expect(page.locator('.account-alert-actions .nfx-btn')).toHaveCSS('font-size', '12px')
  await expect(page.locator('.account-alert-actions .nfx-btn')).toHaveCSS('padding', '6px 12px')
  await expect(page.locator('.account-alert-actions .nfxu-later')).toHaveCSS('font-size', '12.5px')
  await expect(page.locator('.account-alert-actions .nfxu-later')).toHaveCSS('text-decoration-line', 'underline')
})

test('모든 활동 행은 언어별 포맷터를 공유하며 재진입 때 다시 만들지 않는다', async ({ page }) => {
  await mount(page)
  await page.evaluate(() => {
    Reflect.set(window, 'formatCount', 0)
    const Original = Intl.NumberFormat
    Intl.NumberFormat = new Proxy(Original, { construct(target, args, newTarget) { Reflect.set(window, 'formatCount', Reflect.get(window, 'formatCount') + 1); return Reflect.construct(target, args, newTarget) } })
  })
  for (const [language, expected] of [['en', 2], ['fr', 4], ['en', 4], ['fr', 4]] as const) {
    await page.evaluate(value => Reflect.get(window, 'setAccountPreference')('language', value), language)
    for (const view of ['Alerts', 'Reports', 'Review', 'Periodic']) {
      await patch(page, { view, id: view === 'Periodic' ? 'p1' : 'r0' })
      await expect(page.locator('.client-account-activity')).toHaveAttribute('lang', language)
      expect(await page.evaluate(() => Reflect.get(window, 'formatCount'))).toBe(expected)
    }
  }
})

test('복기 표준 청산 종류 세 가지는 7언어로 연결하고 사용자 설명을 보존한다', async ({ page }) => {
  await mount(page, 'Review')
  const original = await page.evaluate(() => Reflect.get(window, 'accountUI').state)
  for (const [kind, kindL, label, description] of [['sl', '손절', 'stopLoss', 'stopDescription'], ['tp', '익절', 'takeProfit', 'profitDescription'], ['time', '시간 청산', 'timedExit', 'timeDescription']] as const) {
    await patch(page, {}, { reviews: [{ ...original.reviews[0], kind, kindL }] })
    for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
      await page.evaluate(value => Reflect.get(window, 'setAccountPreference')('language', value), language)
      await expect(page.locator('.nfxr-chip b').first()).toHaveText(accountActivityText(language, label))
      await expect(page.locator('.nfx-hero-desc')).toHaveText(accountActivityText(language, description))
      await expect(page.locator('.nfxr-sbody')).toHaveText(['원문 진입 <b>보존</b>', '시간 조건 원문', '원문 제안'])
    }
  }
})

test('알림 5필터·pos+bot·전체 읽음과 원래 딥링크를 보존한다', async ({ page }) => {
  await mount(page)
  await expect(page.getByRole('group', { name: '알림 분류' }).getByRole('button')).toHaveText(['전체6', '포지션2', '전략1', '거래복기1', '정산1'])
  await page.getByRole('button', { name: '포지션 2', exact: true }).click()
  await expect(page.locator('.nf-item')).toHaveCount(2)
  await page.locator('.nf-item').first().focus(); await page.keyboard.press('Enter')
  expect(await calls(page)).toEqual([['read', 'n0'], ['navigate', '#/review/r0']])
  await expect(page.locator('.nf-item').first()).toHaveClass(/read/)
  await page.getByRole('button', { name: '모두 읽음' }).click()
  await page.getByRole('button', { name: '전체 6', exact: true }).click()
  await expect(page.locator('.nf-item.read')).toHaveCount(6)
  await expect(page.locator('.nfx-sectit')).not.toContainText('안읽음')
  await page.getByRole('button', { name: '수신 설정' }).click()
  expect((await calls(page)).at(-1)).toEqual(['navigate', '#/plan/alerts'])
})
test('알림 원문은 텍스트이며 상대시간과 실패 없는 빈 분류를 표시한다', async ({ page }) => {
  await mount(page)
  await expect(page.locator('.bd2').first()).toHaveText('<img src=x onerror=alert(1)>')
  await expect(page.locator('.client-account-activity img')).toHaveCount(0)
  await expect(page.locator('.tm').first()).toHaveText('방금 전')
  await expect(page.locator('.tm').nth(1)).toHaveText('1시간 전')
  await patch(page, {}, { notifs: [{ id: 'only', type: 'credit', title: '크레딧', body: '', read: false, at: 0, link: null, key: 'only' }] })
  await page.getByRole('button', { name: '포지션', exact: true }).click()
  await expect(page.getByText('이 분류의 알림이 없습니다')).toBeVisible()
  await patch(page, {}, { notifs: [] })
  await expect(page.getByText('아직 알림이 없습니다')).toBeVisible()
})
test('공급 없는 계정 상태와 액션은 권한·읽음 성공을 만들지 않는다', async ({ page }) => {
  await mount(page)
  await patch(page, { callbacks: false })
  await expect(page.getByRole('button', { name: '모두 읽음' })).toBeDisabled()
  await expect(page.locator('.nf-item').first()).toBeDisabled()
  await patch(page, { view: 'Plan', missing: true })
  await expect(page.getByText('계정 상태를 확인할 수 없어요')).toBeVisible()
  await expect(page.getByText('무료 체험', { exact: true })).toHaveCount(0)
  await patch(page, { missing: false, signedIn: false })
  await expect(page.getByText('기본 분석', { exact: true })).toBeVisible()
})
test('PLAN 상태·미연결 CTA·만료시간·고급 비용은 공급된 투영에 따른다', async ({ page }) => {
  await mount(page, 'Plan')
  await expect(page.getByText('무료 체험', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '무료로 UID 연동하기 (Fast API)' })).toBeDisabled()
  await expect(page.getByRole('button', { name: '구독으로 업그레이드' })).toBeDisabled()
  await patch(page, {}, { uidLinked: true, creditBal: 200 })
  await expect(page.locator('.nfx-card-hero .nfx-badge')).toHaveText('PRO')
  await patch(page, {}, { creditBal: 1000 })
  await expect(page.locator('.nfx-card-hero .nfx-hero')).toHaveText('PRO 이용 중')
  await patch(page, {}, { tradeActiveUntil: Date.UTC(2026, 8, 16) })
  await expect(page.getByText('PRO 활성 (무제한)', { exact: true })).toBeVisible()
  await patch(page, {}, { payDone: true })
  await expect(page.getByText('PRO 멤버십', { exact: true })).toBeVisible()
  await expect(page.getByText('차감 없음', { exact: true })).toBeVisible()
  await patch(page, {}, { payDone: false, tradeActiveUntil: null, creditBal: 0, freeUsed: 10 })
  await expect(page.getByText('업그레이드 필요', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '알림 설정', exact: true }).click()
  expect((await calls(page)).at(-1)).toEqual(['navigate', '#/plan/alerts'])
})
test('알림설정 9개는 이름·키보드·chW 항상 true를 보존한다', async ({ page }) => {
  await mount(page, 'Plan'); await patch(page, { tab: 'alerts' })
  await expect(page.getByRole('switch')).toHaveCount(9)
  const channel = page.getByRole('switch', { name: '앱 내 수신함' })
  await expect(channel).toBeChecked(); await expect(channel).toBeDisabled()
  const email = page.getByRole('switch', { name: '이메일 리포트' })
  await email.focus(); await page.keyboard.press('Space')
  await expect(email).toBeChecked()
  expect(await calls(page)).toEqual([['preference', 'chM', true]])
  await patch(page, { callbacks: false })
  for (const sw of await page.getByRole('switch').all()) await expect(sw).toBeDisabled()
})
test('정산은 전체 누적·최근30건이며 공급된 복기 링크를 우선한다', async ({ page }) => {
  await mount(page, 'Plan'); await patch(page, { tab: 'rebates' })
  await expect(page.locator('.nfx-row')).toHaveCount(30)
  await expect(page.getByText('35건', { exact: true })).toBeVisible()
  await expect(page.locator('.nfx-hero .account-count [aria-hidden="true"]')).toHaveText('₩630')
  await page.locator('.nfx-row').first().focus(); await page.keyboard.press('Enter')
  expect(await calls(page)).toEqual([['navigate', '#/review/r0']])
  await page.locator('.nfx-row').last().click()
  expect((await calls(page)).at(-1)).toEqual(['navigate', '#/trade/bot/d1'])
  await patch(page, { strategyIds: undefined, calls: [] })
  await page.locator('.nfx-row').last().click()
  await expect(page.getByRole('status')).toHaveText('연결된 복기가 보관 기간을 지나 정리됐어요')
  expect(await calls(page)).toEqual([])
  await patch(page, { view: 'RebateSummary' })
  await expect(page.locator('.ag2')).toContainText('₩630')
  await page.getByRole('button', { name: '전체 내역 보기' }).click()
  expect((await calls(page)).at(-1)).toEqual(['navigate', '#/plan/rebates'])
})
test('복기는 supplied causes·종료 kind·동일fid 적립만 표시한다', async ({ page }) => {
  await mount(page, 'Review')
  await expect(page.getByText('시간 조건으로 청산된 거래예요.')).toBeVisible()
  await expect(page.getByText('손절 규칙이 손실을 제한한 거래입니다.')).toHaveCount(0)
  await expect(page.locator('.nfxr-sbody')).toHaveText(['원문 진입 <b>보존</b>', '시간 조건 원문', '원문 제안'])
  await expect(page.locator('.nfxr-stag')).toHaveText(['01 ENTRY', '02 EXIT', '03 SUGGESTION'])
  await expect(page.locator('.nfxr-chiprow')).toContainText('+₩1')
  await expect(page.locator('.client-account-activity img')).toHaveCount(0)
  await patch(page, { id: 'r1' }, { rebates: [] })
  await expect(page.getByText('익절 규칙으로 청산된 거래예요.')).toBeVisible()
  await expect(page.locator('.nfxr-chiprow')).not.toContainText('수수료 적립')
  await patch(page, { id: 'r2' })
  await expect(page.getByText('손절 규칙이 손실을 제한한 거래입니다.')).toBeVisible()
  await patch(page, { id: 'missing' })
  await expect(page.getByText('복기 리포트를 찾을 수 없습니다')).toBeVisible()
})
test('기간보고서는 원본요약·반개구간 공급순서10복기·미보관 빈상태를 보존한다', async ({ page }) => {
  await mount(page, 'Reports')
  await expect(page.locator('.nfx-row')).toContainText('체결 12회, 승률 25%')
  await page.locator('.nfx-row').click()
  expect(await calls(page)).toEqual([['navigate', '#/periodic/p1']])
  await patch(page, { view: 'Periodic', id: 'p1' })
  await expect(page.locator('.nfx-row')).toHaveCount(10)
  await expect(page.locator('.nfx-hero')).toHaveText('-4.0%')
  await page.locator('.nfx-row').first().click()
  expect((await calls(page)).at(-1)).toEqual(['navigate', '#/review/r0'])
  await patch(page, {}, { reviews: [] })
  await expect(page.getByText('현재 조회 가능한 복기가 없습니다')).toBeVisible()
  await expect(page.locator('.nfx-hero')).toHaveText('-4.0%')
  await patch(page, { id: 'missing' })
  await expect(page.getByText('보고서를 찾을 수 없습니다')).toBeVisible()
})
test('320px 실제 폰트·44px coarse·긴 통화금액은 페이지 넘침 없이 보존한다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 900 }); await mount(page, 'Plan')
  for (const tab of ['plan', 'alerts', 'rebates']) {
    await patch(page, { tab })
    await expect(page.locator('.nfx-tab[aria-current="page"]')).toHaveText({ plan: '플랜', alerts: '알림 설정', rebates: '정산' }[tab]!)
    await page.evaluate(() => document.fonts.ready)
    await page.evaluate(() => Promise.all(document.getAnimations().filter(animation => Number.isFinite(animation.effect?.getComputedTiming().iterations)).map(animation => animation.finished)))
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    if (info.project.name.includes('mobile')) {
      for (const control of await page.locator('.client-account-activity button:visible,.client-account-activity .nfx-sw:visible').all()) expect((await control.boundingBox())!.height, await control.evaluate(el => JSON.stringify({ element: el.outerHTML, coarse: matchMedia('(pointer:coarse)').matches, min: getComputedStyle(el).minHeight, viewport: innerWidth }))).toBeGreaterThanOrEqual(44)
    }
  }
  // Chromium's full-page mobile screenshot can reset pointer emulation; capture only after all coarse checks.
  await page.screenshot({ path: info.outputPath('account-rebates-320.png'), fullPage: true })
  const family = await page.locator('.client-account-activity').evaluate(el => getComputedStyle(el).fontFamily)
  expect(family).toContain('Noto Sans KR Variable')
  await patch(page, { view: 'RebateSummary' }, { rebates: [{ fid: 'large', botId: '', amt: 1e100, at: 0, sim: true }] })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const region = page.getByRole('region', { name: '수수료 적립 금액' })
  await region.focus(); await page.keyboard.press('ArrowRight')
  await expect.poll(() => region.evaluate(el => el.scrollLeft)).toBeGreaterThan(0)
})

for (const tab of ['plan', 'alerts'] as const) test('원본 토큰과 안정된 ' + tab + ' 시각 캡처', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 900 }); await mount(page, 'Plan')
  await patch(page, { tab })
  await expect(page.locator('.nfx-tab[aria-current="page"]')).toHaveText(tab === 'plan' ? '플랜' : '알림 설정')
  await expect(page.locator('.nfx-card').first()).toHaveCSS('background-color', 'rgb(23, 24, 27)')
  if (tab === 'alerts') await expect(page.locator('.nfx-slider').first()).toHaveCSS('background-color', 'rgb(61, 110, 240)')
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(() => Promise.all(document.getAnimations().filter(animation => Number.isFinite(animation.effect?.getComputedTiming().iterations)).map(animation => animation.finished)))
  await page.screenshot({ path: info.outputPath('account-' + tab + '-320.png'), fullPage: true })
})

async function motionHarness(page: Page) {
  await page.evaluate(() => {
    const frames = new Map<number, FrameRequestCallback>(), timers = new Map<number, () => void>()
    let next = 100000, hidden = false, cancelled = 0
    const timeout = window.setTimeout.bind(window), clear = window.clearTimeout.bind(window)
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
    Object.assign(window, {
      requestAnimationFrame: (callback: FrameRequestCallback) => { const id = next++; frames.set(id, callback); return id },
      cancelAnimationFrame: (id: number) => { if (frames.delete(id)) cancelled++ },
      setTimeout: (callback: () => void, delay?: number, ...args: unknown[]) => { if (delay !== 60) return timeout(callback, delay, ...args); const id = next++; timers.set(id, callback); return id },
      clearTimeout: (id: number) => { timers.delete(id); clear(id) },
      accountMotion: {
        frame: (elapsed: number) => { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(performance.now() + elapsed)) },
        timers: () => { const pending = [...timers.values()]; timers.clear(); pending.forEach(callback => callback()) },
        hide: (value: boolean) => { hidden = value; document.dispatchEvent(new Event('visibilitychange')) },
        stats: () => ({ frames: frames.size, timers: timers.size, cancelled }),
      },
    })
  })
}
async function animate(page: Page, elapsed: number) { await page.evaluate(elapsed => Reflect.get(window, 'accountMotion').frame(elapsed), elapsed) }
async function motionStats(page: Page) { return page.evaluate(() => Reflect.get(window, 'accountMotion').stats()) }

test('최신 원본 PLAN은 크레딧 숫자·경고선·카운트업 대신 PRO 이용 상태만 표시한다', async ({ page }) => {
  await mount(page, 'Plan'); await motionHarness(page)
  const hero = page.locator('.nfx-card-hero')
  for (const balance of [10, 200, 1000, 918273]) {
    await patch(page, {}, { uidLinked: true, creditBal: balance })
    await expect(hero.locator('.nfx-hero')).toHaveText('PRO 이용 중')
    await expect(hero.locator('.nfx-hero-label')).toHaveText('이용 상태')
    await expect(hero.locator('.nfx-glabels')).toHaveText('이용 상태: 정상거래량 연동 자동 충전')
    await expect(hero.locator('.nfx-gfill')).toHaveClass('nfx-gfill inf')
    await expect(hero.locator('.nfx-gpin,.account-count')).toHaveCount(0)
    expect((await hero.locator('.nfx-hero,.nfx-glabels').allTextContents()).join(' ')).not.toMatch(/\d/)
    await expect(hero).not.toContainText('소진 임박')
    await expect(page.locator('.nfx-row').last()).toContainText('이용량 기반 차감')
    expect((await motionStats(page)).frames).toBe(0)
  }
  await patch(page, {}, { creditBal: 0, uidLinked: false, freeUsed: 8 })
  await expect(hero.locator('.nfx-hero')).toHaveText('얼마 남지 않음')
  await expect(hero.locator('.nfx-hero-label')).toHaveText('이용 상태')
  await expect(hero.locator('.nfx-hero-desc')).toContainText('AI 이용 크레딧 $100 혜택')
  await expect(hero.locator('.nfx-gfill')).toHaveAttribute('style', 'width: 100%;')
  await patch(page, { missing: true })
  await expect(page.getByText('계정 상태를 확인할 수 없어요')).toBeVisible()
  await expect(page.locator('.nfx-card-hero')).toHaveCount(0)
})

test('320px PLAN은 거래량과 차감 단어를 쪼개지 않고 최신 문구를 표시한다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 }); await mount(page, 'Plan')
  await patch(page, {}, { uidLinked: true, creditBal: 200 })
  for (const [selector, word] of [['.nfx-hero-desc', '거래량'], ['.nfx-foot span', '차감']]) {
    const height = await page.locator(selector).evaluate((el, word) => {
      const node = el.firstChild!
      const index = node.textContent!.indexOf(word)
      if (index < 0) throw new Error('Expected source word')
      const first = document.createRange(), last = document.createRange()
      first.setStart(node, index); first.setEnd(node, index + 1)
      last.setStart(node, index + word.length - 1); last.setEnd(node, index + word.length)
      return Math.abs(first.getBoundingClientRect().top - last.getBoundingClientRect().top)
    }, word)
    expect(height).toBeLessThan(1)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('PLAN 한국어 본문과 정산 스크롤 영역을 명시하고 UID 해제 시 거래 활성 배지를 내린다', async ({ page }) => {
  await mount(page, 'Plan')
  await page.evaluate(() => { document.documentElement.lang = 'en' })
  await expect(page.locator('.nfx-grid2')).toHaveAttribute('lang', 'ko')
  await patch(page, {}, { tradeActiveUntil: Date.UTC(2026, 8, 16), uidLinked: false })
  await expect(page.locator('.nfx-row').nth(1).locator('.nfx-badge')).toHaveText('없음')
  await expect(page.locator('.nfx-card-hero .nfx-badge')).toHaveText('무료 체험')
  await patch(page, {}, { uidLinked: true })
  await expect(page.locator('.nfx-row').nth(1).locator('.nfx-badge')).toContainText('까지 활성')
  await patch(page, { signedIn: false })
  await expect(page.locator('.nfx-empty')).toHaveAttribute('lang', 'ko')
  await patch(page, { signedIn: true, tab: 'rebates' }, { rebates: [{ fid: 'large', botId: '', amt: 1e100, at: 0, sim: true }] })
  await page.setViewportSize({ width: 320, height: 900 })
  const amount = page.getByRole('region', { name: '수수료 적립 금액' })
  await expect(amount).toHaveAttribute('lang', 'ko')
  await amount.focus(); await page.keyboard.press('ArrowRight')
  await expect(amount).toBeFocused()
  await expect.poll(() => amount.evaluate(el => el.scrollLeft)).toBeGreaterThan(0)
})

test('650ms count-up은 중간값을 aria에서 숨기고 공급 최종값·교체·unmount를 보존한다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' }); await mount(page, 'Plan'); await motionHarness(page)
  await patch(page, { tab: 'rebates' }, { rebates: [{ fid: 'amount', botId: '', amt: 1000, at: 0, sim: true }] })
  const visual = page.locator('.account-count [aria-hidden="true"]'), accessible = page.locator('.account-count .account-sr')
  await expect(visual).toHaveText('₩0'); await expect(accessible).toHaveText('₩1,000')
  await animate(page, 100)
  const intermediate = Number((await visual.textContent())!.replaceAll(',', '').replace('₩', ''))
  expect(intermediate).toBeGreaterThan(0); expect(intermediate).toBeLessThan(1000)
  // This fixture creates a new money callback on every render, like a caller's unrelated minute tick.
  await patch(page, {}, { freeUsed: 1 })
  await page.waitForTimeout(30)
  expect(Number((await visual.textContent())!.replaceAll(',', '').replace('₩', ''))).toBe(intermediate)
  expect((await motionStats(page)).cancelled).toBe(0)
  await patch(page, {}, { rebates: [{ fid: 'amount', botId: '', amt: 500, at: 0, sim: true }] })
  await expect(accessible).toHaveText('₩500'); await expect(visual).toHaveText('₩0')
  expect((await motionStats(page)).cancelled).toBeGreaterThan(0)
  await animate(page, 700); await expect(visual).toHaveText('₩500')
  await patch(page, {}, { freeUsed: 2 })
  await page.waitForTimeout(30)
  await expect(visual).toHaveText('₩500'); expect((await motionStats(page)).frames).toBe(0)
  await patch(page, { tab: 'rebates' }, { rebates: [{ fid: 'fraction', botId: '', amt: 630.25, at: 0, sim: true }] })
  await expect(accessible).toHaveText('₩630.25')
  await expect(visual).toHaveText('₩630.25'); expect((await motionStats(page)).frames).toBe(0)
  await animate(page, 700); await expect(visual).toHaveText('₩630.25')
  await patch(page, {}, { rebates: [{ fid: 'negative', botId: '', amt: -.25, at: 0, sim: true }] })
  await expect(visual).toHaveText('−₩0.25'); expect((await motionStats(page)).frames).toBe(0)
  await patch(page, {}, { rebates: [{ fid: 'next', botId: '', amt: 10000, at: 0, sim: true }] })
  await expect(accessible).toHaveText('₩10,000')
  await animate(page, 100)
  const rebateIntermediate = await visual.textContent(), cancelledBefore = (await motionStats(page)).cancelled
  await patch(page, {}, { freeUsed: 3 })
  await page.waitForTimeout(30)
  await expect(visual).toHaveText(rebateIntermediate!)
  expect((await motionStats(page)).cancelled).toBe(cancelledBefore)
  await animate(page, 700); await expect(visual).toHaveText('₩10,000')
  await patch(page, {}, { freeUsed: 4 })
  await page.waitForTimeout(30)
  await expect(visual).toHaveText('₩10,000'); expect((await motionStats(page)).frames).toBe(0)
  await patch(page, {}, { rebates: [{ fid: 'unmount', botId: '', amt: 10001, at: 0, sim: true }] })
  await expect(accessible).toHaveText('₩10,001')
  await page.evaluate(() => Reflect.get(window, 'unmountAccount')())
  expect((await motionStats(page)).frames).toBe(0)
  await animate(page, 700)
  await expect(page.locator('.client-account-activity')).toHaveCount(0)
})

test('count-up은 hidden/restored와 reduced-motion 전환에서 즉시 최종값을 유지한다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' }); await mount(page, 'Plan'); await motionHarness(page)
  await patch(page, { tab: 'rebates' }, { rebates: [{ fid: 'amount', botId: '', amt: 1000, at: 0, sim: true }] })
  const visual = page.locator('.account-count [aria-hidden="true"]')
  await expect(visual).toHaveText('₩0')
  await page.evaluate(() => Reflect.get(window, 'accountMotion').hide(true))
  await expect(visual).toHaveText('₩1,000'); expect((await motionStats(page)).frames).toBe(0)
  await patch(page, {}, { rebates: [{ fid: 'amount', botId: '', amt: 777, at: 0, sim: true }] })
  await expect(visual).toHaveText('₩777')
  await page.evaluate(() => Reflect.get(window, 'accountMotion').hide(false))
  await animate(page, 700); await expect(visual).toHaveText('₩777')
  await patch(page, {}, { rebates: [{ fid: 'amount', botId: '', amt: 888, at: 0, sim: true }] })
  await expect(visual).toHaveText('₩0')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(visual).toHaveText('₩888'); expect((await motionStats(page)).frames).toBe(0)
  await patch(page, {}, { rebates: [{ fid: 'amount', botId: '', amt: 999, at: 0, sim: true }] })
  await expect(visual).toHaveText('₩999'); expect((await motionStats(page)).frames).toBe(0)
})

test('보고서 링은 60ms 뒤 시작하며 교체·hidden·reduced·unmount 타이머를 정리한다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' }); await mount(page, 'Plan'); await motionHarness(page)
  await patch(page, { view: 'Periodic', id: 'p1' })
  const ring = page.locator('.nfxr-ring .fg')
  await expect(ring).toHaveAttribute('style', /stroke-dashoffset: 163.4/)
  expect((await motionStats(page)).timers).toBe(1)
  await page.evaluate(() => Reflect.get(window, 'accountMotion').timers())
  await expect(ring).toHaveAttribute('style', /stroke-dashoffset: 122.55/)
  const next = { id: 'p2', kind: 'W', label: '다음 주간', from: 0, until: 1, n: 2, wins: 1, pnl: .01, rebate: 0, sim: true, at: 0 }
  await patch(page, { id: 'p2' }, { periodics: [next] })
  await expect(ring).toHaveAttribute('style', /stroke-dashoffset: 163.4/)
  await page.evaluate(() => Reflect.get(window, 'accountMotion').hide(true))
  await expect(ring).toHaveAttribute('style', /stroke-dashoffset: 81.7/)
  expect((await motionStats(page)).timers).toBe(0)
  await page.evaluate(() => Reflect.get(window, 'accountMotion').hide(false))
  await page.evaluate(() => Reflect.get(window, 'accountMotion').timers())
  await expect(ring).toHaveAttribute('style', /stroke-dashoffset: 81.7/)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await patch(page, { id: 'p3' }, { periodics: [{ ...next, id: 'p3', wins: 2 }] })
  await expect(ring).toHaveAttribute('style', /stroke-dashoffset: 0/)
  expect((await motionStats(page)).timers).toBe(0)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await patch(page, { id: 'p4' }, { periodics: [{ ...next, id: 'p4' }] })
  await expect(ring).toHaveAttribute('style', /stroke-dashoffset: 163.4/)
  await page.evaluate(() => Reflect.get(window, 'unmountAccount')())
  expect((await motionStats(page)).timers).toBe(0)
})
