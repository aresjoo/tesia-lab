import { expect, test } from '@playwright/test'

const locales = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const
test.beforeEach(async ({ page }, info) => {
  await page.setViewportSize({ width: info.project.name === 'mobile' ? 320 : 1440, height: 900 })
  await page.route('**/*', route => {
    const req = route.request(), url = new URL(req.url())
    return url.hostname === '127.0.0.1' && !url.pathname.startsWith('/api/') && ['GET', 'HEAD'].includes(req.method()) ? route.continue() : route.abort('blockedbyclient')
  })
  await page.route('**/ledger-locale.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body style="margin:0"><div id="fixture"></div></body></html>' }))
  await page.goto('/ledger-locale.html')
  await page.evaluate(async () => {
    const refresh = '/@react-refresh', runtime = (await import(refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
  })
})

test('terminal locale: fixed dictionary retains seven sentence templates and unknown customer placeholders verbatim', async ({ page }) => {
  const rows = await page.evaluate(async langs => {
    const p = '/src/client-terminal-ledger-locale-copy.ts', { terminalLedgerCopy, terminalLedgerText } = await import(p)
    return { rows: Object.values(terminalLedgerCopy) as string[][], unknown: langs.map(lang => terminalLedgerText(lang, '供給 원문 {count}', { count: 42 })) }
  }, locales)
  for (const row of rows.rows) {
    expect(row).toHaveLength(7)
    const tokens = (value: string) => [...value.matchAll(/\{\w+\}/g)].map(match => match[0]).sort()
    for (const text of row.slice(1)) { expect(text.trim()).not.toBe(''); expect(text).not.toMatch(/[가-힣]/); expect(tokens(text)).toEqual(tokens(row[0])) }
  }
  expect(rows.unknown).toEqual(locales.map(() => '供給 원문 {count}'))
})

test('terminal locale: default bell aria follows seven locales while supplied aria and callback stay exact', async ({ page }) => {
  await page.evaluate(async () => {
    const cp = '/src/components/ClientAccountBell.tsx', source = await (await fetch('/src/client-preferences.ts')).text(), rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing Vite React instance')
    const rm = await import(rp), react = rm.default ?? rm, dp = '/@id/react-dom/client', dom = await import(dp), { ClientAccountBell } = await import(cp)
    Object.assign(window, { bellCalls: 0 })
    const h = react.createElement
    ;(dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture')).render(h('div', null, h(ClientAccountBell, { unread: 3, onOpen: () => Reflect.set(window, 'bellCalls', Reflect.get(window, 'bellCalls') + 1) }), h(ClientAccountBell, { unread: 9, ariaLabel: '供給 aria 原文', onOpen: () => {} })))
  })
  const names = ['알림, 3개 안읽음', 'Notifications, 3 unread', '通知、未読3件', '通知，3条未读', '通知，3則未讀', 'Notificaciones, 3 sin leer', 'Notifications, 3 non lues']
  const button = page.locator('.client-account-bell').first(), original = await button.elementHandle()
  for (const [i, language] of locales.entries()) {
    await page.evaluate(async lang => { const p = '/src/client-preferences.ts'; (await import(p)).setClientPreference('language', lang) }, language)
    await expect(button).toHaveAccessibleName(names[i])
    await expect(page.locator('.client-account-bell').last()).toHaveAccessibleName('供給 aria 原文')
    expect(await button.evaluate((node, saved) => node === saved, original)).toBe(true)
  }
  await button.click()
  expect(await page.evaluate(() => Reflect.get(window, 'bellCalls'))).toBe(1)
})

test('terminal locale: singular counts and neutral table aria retain seven independent literal expectations', async ({ page }) => {
  const rows = await page.evaluate(async langs => {
    const p = '/src/client-terminal-ledger-locale-copy.ts', { terminalLedgerText: t } = await import(p)
    return langs.map(lang => [t(lang, '알림, {count}개 안읽음', { count: 1 }), t(lang, '전략 {count}개', { count: 1 }), t(lang, '{count}봉', { count: 1 }), t(lang, '{label} 표', { label: t(lang, '주문 내역') })])
  }, locales)
  expect(rows).toEqual([
    ['알림, 1개 안읽음', '전략 1개', '1봉', '주문 내역 표'],
    ['Notifications, 1 unread', '1 strategy', '1 bar', 'Order history table'],
    ['通知、未読1件', '戦略1件', '1本の足', '注文履歴の表'],
    ['通知，1条未读', '1个策略', '1根K线', '订单历史表格'],
    ['通知，1則未讀', '1個策略', '1根K線', '訂單紀錄表格'],
    ['Notificaciones, 1 sin leer', '1 estrategia', '1 vela', 'Historial de órdenes — tabla'],
    ['Notifications, 1 non lue', '1 stratégie', '1 bougie', 'Historique des ordres — tableau'],
  ])
})

test('terminal locale: source preview ledger labels aria empty panes and actions preserve supplied values in seven locales', async ({ page }) => {
  await page.evaluate(async () => {
    const pp = '/src/client-preferences.ts', source = await (await fetch(pp)).text(), rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing Vite React instance')
    const rm = await import(rp), react = rm.default ?? rm, dp = '/@id/react-dom/client', dom = await import(dp)
    const lp = '/src/components/ClientTerminalLedger.tsx', fp = '/src/client-terminal-source-fixture.ts'
    const { sourceTerminalBottomTabs } = await import(lp), { sourceTerminalSeeds, evaluateSourceTerminal } = await import(fp), { useClientPreferences } = await import(pp)
    const seed = { ...sourceTerminalSeeds[0], name: '고객 이름 原文', status: 'live' }, result = evaluateSourceTerminal(seed.parameters, seed.capital)
    result.pos = { entryI: 61, entryP: 100, curP: 102, stopP: 95, tpP: 110, qty: 2, chg: .02, krw: 4, bars: 5 }
    const models = [{ seed, result }], calls: unknown[][] = []
    Object.assign(window, { ledgerModels: models, ledgerBefore: JSON.stringify(models), ledgerCalls: calls })
    const h = react.createElement
    function Fixture() {
      const { language } = useClientPreferences(), [active, setActive] = react.useState('pos'), [empty, setEmpty] = react.useState(false)
      Object.assign(window, { ledgerEmpty: () => setEmpty(true) })
      const tabs = sourceTerminalBottomTabs({ models: empty ? [] : models, selectedId: seed.id, scope: 'current', language, money: (n: number) => `VALUE:${n}`, onSelect: (id: string) => calls.push(['select', id]), onPause: (id: string) => calls.push(['pause', id]), onTrade: (id: string, index: number) => calls.push(['trade', id, index]) })
      return h('div', null, h('div', { className: 'fixture-tabs', style: { display: 'flex', flexWrap: 'wrap' } }, tabs.map((tab: { id: string; label: string }) => h('button', { key: tab.id, 'data-tab': tab.id, onClick: () => setActive(tab.id) }, tab.label))), h('div', { id: 'pane' }, tabs.find((tab: { id: string }) => tab.id === active)?.content))
    }
    ;(dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture')).render(h(Fixture))
  })
  const position = ['포지션', 'Positions', 'ポジション', '持仓', '持倉', 'Posiciones', 'Positions']
  const stop = ['고객 이름 原文 중지', 'Stop 고객 이름 原文', '고객 이름 原文を停止', '停止고객 이름 原文', '停止고객 이름 原文', 'Detener 고객 이름 原文', 'Arrêter 고객 이름 原文']
  for (const [i, language] of locales.entries()) {
    await page.evaluate(async lang => { const p = '/src/client-preferences.ts'; (await import(p)).setClientPreference('language', lang) }, language)
    await page.locator('[data-tab=pos]').click()
    await expect(page.locator('[data-tab=pos]')).toHaveText(position[i])
    await expect(page.locator('.tbtn')).toHaveAccessibleName(stop[i])
    await expect(page.locator('tbody tr')).toHaveCount(1)
    await expect(page.locator('tbody')).toContainText('VALUE:100')
    await expect(page.locator('.stlk').first()).toHaveText('고객 이름 原文')
    if (language !== 'ko') { await expect(page.locator('thead')).not.toContainText(/[가-힣]/); await expect(page.locator('.tft-tnote')).not.toContainText(/[가-힣]/) }
    await page.locator('[data-tab=orders]').click()
    await expect(page.locator('tbody tr').first()).toContainText('VALUE:')
    if (language !== 'ko') await expect(page.locator('.okst').first()).not.toContainText(/[가-힣]/)
    await page.locator('[data-tab=assets]').click()
    if (language !== 'ko') { await expect(page.locator('.tft-tnote')).not.toContainText(/[가-힣]/); await expect(page.locator('.af2')).not.toContainText(/[가-힣]/) }
  }
  await page.locator('[data-tab=pos]').click()
  await page.locator('.tbtn').click()
  expect(await page.evaluate(() => Reflect.get(window, 'ledgerCalls'))).toEqual([['pause', 'd1']])
  expect(await page.evaluate(() => JSON.stringify(Reflect.get(window, 'ledgerModels')) === Reflect.get(window, 'ledgerBefore'))).toBe(true)
  await page.evaluate(() => Reflect.get(window, 'ledgerEmpty')())
  for (const language of locales) {
    await page.evaluate(async lang => { const p = '/src/client-preferences.ts'; (await import(p)).setClientPreference('language', lang) }, language)
    for (const id of ['pos', 'open', 'orders', 'fills', 'closed', 'assets']) {
      await page.locator(`[data-tab=${id}]`).click()
      await expect(page.locator('.tft-empty')).toBeVisible()
      if (language !== 'ko') await expect(page.locator('.tft-empty')).not.toContainText(/[가-힣]/)
    }
  }
})
