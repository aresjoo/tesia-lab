import { expect, test, type Page } from '@playwright/test'

// Independent frozen UI expectations. Deliberately do not import dictionaries,
// text functions, plural rules, money formatters or translation fallback logic.
// Original 9fbff821 stGeneral (23487–23493) and inbox (14617–14643) have Korean
// bodies only; other translations below attest current UI, not original parity.
const locales = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const
const settings = [
  ['일반', '언어', '화면과 알림에 쓰는 언어입니다', '금액 표시', '모든 금액은 미국 달러로 표시합니다. 자산 수량은 BTC, ETH, USDT처럼 자산 단위 그대로입니다', '계정', '알림', '결제', '보안', '요청을 완료하지 못했습니다. 다시 시도해주세요.', '다시 시도'],
  ['General', 'Language', 'Language used for the screen and notifications.', 'Amount Display', 'All amounts are displayed in US dollars. Asset quantities remain in their respective units, such as BTC, ETH, and USDT.', 'Account', 'Notifications', 'Billing', 'Security', 'Could not complete the request. Please try again.', 'Retry'],
  ['一般', '言語', '画面と通知で使用する言語です。', '金額表示', 'すべての金額は米ドルで表示されます。資産数量はBTC、ETH、USDTなどの資産単位のまま表示されます。', 'アカウント', '通知', '支払い', 'セキュリティ', '処理を完了できませんでした。再試行してください。', '再試行'],
  ['通用', '语言', '用于界面与通知的语言。', '金额显示', '所有金额均以美元显示。资产数量保留其原有资产单位，如 BTC、ETH、USDT。', '账户', '通知', '支付', '安全', '未能完成请求，请重试。', '重试'],
  ['一般', '語言', '用於介面與通知的語言。', '金額顯示', '所有金額均以美元顯示。資產數量保留其原有資產單位，如 BTC、ETH、USDT。', '帳戶', '通知', '付款', '安全性', '無法完成要求，請重試。', '重試'],
  ['General', 'Idioma', 'Idioma utilizado en la pantalla y las notificaciones.', 'Visualización de importes', 'Todos los importes se muestran en dólares estadounidenses. Las cantidades de activos se mantienen en su unidad correspondiente, como BTC, ETH o USDT.', 'Cuenta', 'Notificaciones', 'Facturación', 'Seguridad', 'No se pudo completar. Inténtalo de nuevo.', 'Reintentar'],
  ['Général', 'Langue', "Langue utilisée pour l'écran et les notifications.", 'Affichage des montants', "Tous les montants sont affichés en dollars américains. Les quantités d'actifs restent dans leur unité d'origine, comme BTC, ETH ou USDT.", 'Compte', 'Notifications', 'Facturation', 'Sécurité', 'Impossible de terminer. Réessayez.', 'Réessayer'],
] as const
// noCategory, one, multiple, noAlerts, description, unavailable. Count text is
// literal as well: a broken plural branch cannot generate its own expectation.
const alerts = [
  ['이 분류의 알림이 없습니다', '다른 필터에서 1건을 확인할 수 있습니다.', '다른 필터에서 2건을 확인할 수 있습니다.', '아직 알림이 없습니다', '전략이 실행되면 체결, 복기, 정산 소식이 여기로 옵니다.', '계정 상태를 확인할 수 없어요'],
  ['No alerts in this category', 'You can check 1 alert in other filters.', 'You can check 2 alerts in other filters.', 'No alerts yet', 'When strategies run, updates on fills, reviews, and settlements will arrive here.', 'We can’t check your account status'],
  ['このカテゴリの通知はありません', '他のフィルターで1件を確認できます。', '他のフィルターで2件を確認できます。', '通知はまだありません', '戦略が実行されると、約定、振り返り、精算の通知がここに届きます。', 'アカウントの状態を確認できません'],
  ['该分类下暂无通知', '可以在其他筛选器中查看 1 条通知。', '可以在其他筛选器中查看 2 条通知。', '暂无通知', '策略运行时，成交、复盘与结算通知将发送至此处。', '无法确认账户状态'],
  ['該分類下暫無通知', '可以在其他篩選器中查看 1 則通知。', '可以在其他篩選器中查看 2 則通知。', '暫無通知', '策略執行時，成交、複盤與結算通知將發送至此處。', '無法確認帳戶狀態'],
  ['No hay alertas en esta categoría', 'Puedes consultar 1 alerta en otros filtros.', 'Puedes consultar 2 alertas en otros filtros.', 'Aún no hay alertas', 'Cuando se ejecuten las estrategias, aquí recibirás las novedades de ejecuciones, revisiones y liquidaciones.', 'No se puede comprobar el estado de la cuenta'],
  ['Aucune alerte dans cette catégorie', "Vous pouvez consulter 1 alerte dans d'autres filtres.", "Vous pouvez consulter 2 alertes dans d'autres filtres.", "Pas encore d'alertes", "Lorsque les stratégies sont exécutées, les notifications d'exécutions, de revues et de règlements arriveront ici.", 'Impossible de vérifier l’état du compte'],
] as const
const ledgerStates = [
  ['아직 공급된 계정 데이터가 없습니다.', '해당 기록이 없습니다.'],
  ['Account data has not been supplied yet.', 'There are no matching records.'],
  ['口座データはまだ提供されていません。', '該当する記録はありません。'],
  ['尚未提供账户数据。', '没有相应记录。'],
  ['尚未提供帳戶資料。', '沒有相應紀錄。'],
  ['Aún no se han proporcionado datos de la cuenta.', 'No hay registros correspondientes.'],
  ['Les données du compte n’ont pas encore été fournies.', 'Aucun enregistrement correspondant.'],
] as const

test.setTimeout(45_000)
test.use({ actionTimeout: 8_000 })

async function readable(page: Page, selector: string) {
  const result = await page.locator(selector).evaluateAll(nodes => nodes.filter(node => {
    const box = node.getBoundingClientRect()
    return box.width > 0 && box.height > 0 && !node.closest('[inert],[hidden]')
  }).map(node => {
    const element = node as HTMLElement
    return { text: element.textContent, overflow: element.scrollWidth > element.clientWidth + 1, left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right }
  }))
  expect(result.length).toBeGreaterThan(0)
  for (const item of result) {
    expect(item.overflow, item.text ?? '').toBe(false)
    expect(item.left, item.text ?? '').toBeGreaterThanOrEqual(-1)
    expect(item.right, item.text ?? '').toBeLessThanOrEqual(await page.evaluate(() => innerWidth + 1))
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
}

async function openTab(page: Page, tab: string) {
  if (await page.locator('.stg-mback').isVisible()) await page.locator('.stg-mback').click()
  await page.locator(`[data-settings-tab="${tab}"]`).click()
}

for (const [index, language] of locales.entries()) {
  const expected = settings[index], notification = alerts[index]
  test(`${language}: visible settings use independent literal labels through switching, persistence and route visits`, async ({ page }, info) => {
    const errors: string[] = [], writes: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) writes.push(request.method()) })
    await page.setViewportSize({ width: 320, height: 568 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.addInitScript(() => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '독립 설정 계정', email: 'independent@example.test' })))
    await page.goto('/#/settings/general')
    const main = page.locator('.stg-main'), select = main.getByRole('combobox')
    await select.selectOption(language)
    await expect(main.getByRole('heading', { level: 1 })).toHaveText(expected[0])
    await expect(select).toHaveAccessibleName(expected[1])
    await expect(main.locator('.stg-r .k b')).toHaveText([expected[1], expected[3]])
    await expect(main.locator('.stg-r .k > span')).toHaveText([expected[2], expected[4]])
    await expect(main.locator('.num')).toHaveText('USD')
    await expect(select).toHaveValue(language)
    expect(await page.evaluate(() => localStorage.getItem('tethLang'))).toBe(language)
    await expect(page.locator('html')).toHaveAttribute('lang', language)
    await readable(page, '.stg-main h1,.stg-r .k,.stg-r .v,.stg-sel')
    for (const [tab, title] of [['account', expected[5]], ['notify', expected[6]], ['billing', expected[7]], ['security', expected[8]]] as const) {
      await openTab(page, tab)
      await expect(main.getByRole('heading', { level: 1 })).toHaveText(title)
      await expect(main.getByRole('heading', { level: 1 })).toBeVisible()
      await readable(page, '.stg-main h1,.stg-sec h2,.stg-r .k,.stg-empty')
      await expect(page.locator('.client-account-bell')).toBeHidden()
      await expect(page.locator('.nf-pop,[data-notification-popover]')).toHaveCount(0)
    }
    await openTab(page, 'general'); await page.reload()
    await expect(select).toHaveValue(language)
    await expect(main.getByRole('heading', { level: 1 })).toHaveText(expected[0])
    await page.screenshot({ path: info.outputPath(`settings-${language}.png`), fullPage: true })
    expect(errors).toEqual([]); expect(writes).toEqual([])
  })

  test(`${language}: failed language storage still changes visible labels and retry only persists the selected language`, async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '독립 설정 계정', email: 'independent@example.test' })))
    await page.goto('/#/settings/general')
    await page.evaluate(() => {
      localStorage.setItem('tethLang', 'ko')
      localStorage.setItem('tethCurrency', 'HISTORICAL_UNCHANGED')
      const original = Storage.prototype.setItem
      Object.assign(window, { restoreLocaleStorage: () => { Storage.prototype.setItem = original } })
      Storage.prototype.setItem = function (key, value) { if (key === 'tethLang') throw new DOMException('TEST_ONLY_STORAGE_DENIED', 'QuotaExceededError'); return original.call(this, key, value) }
    })
    const main = page.locator('.stg-main'), select = main.getByRole('combobox')
    await select.selectOption(language)
    await expect(main.getByRole('heading', { level: 1 })).toHaveText(expected[0])
    await expect(select).toHaveValue(language)
    await expect(main.getByRole('status')).toContainText(expected[9])
    const retry = main.getByRole('button', { name: expected[10], exact: true })
    await expect(retry).toBeVisible()
    expect(await page.evaluate(() => localStorage.getItem('tethLang'))).toBe('ko')
    await page.evaluate(() => Reflect.get(window, 'restoreLocaleStorage')())
    await retry.click(); await expect(main.getByRole('status')).toHaveCount(0)
    expect(await page.evaluate(() => [localStorage.getItem('tethLang'), localStorage.getItem('tethCurrency')])).toEqual([language, 'HISTORICAL_UNCHANGED'])
    await expect(main.locator('.num')).toHaveText('USD')
  })

  test(`${language}: inbox null, confirmed zero, one and multiple preserve source rows and independently expected empty messages`, async ({ page }, info) => {
    await page.setViewportSize({ width: 320, height: 568 })
    await page.route('**/locale-independent-inbox.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0"><div id="fixture"></div></body></html>' }))
    await page.goto('/locale-independent-inbox.html')
    await page.evaluate(async language => {
      const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refresh)).default
      runtime.injectIntoGlobalHook(window)
      Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
      const path = '/src/internal-poc/NativeTradingWorkspace.tsx'
      const source = await (await fetch(path)).text(), reactPath = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
      if (!reactPath) throw new Error('Missing Vite React instance')
      const rm = await import(/* @vite-ignore */ reactPath), React = rm.default ?? rm
      const domPath = '/@id/react-dom/client', DOM = await import(/* @vite-ignore */ domPath)
      const { NativeTradingWorkspace } = await import(/* @vite-ignore */ path)
      const preference = '/src/client-preferences.ts'
      ;(await import(/* @vite-ignore */ preference)).setClientPreference('language', language)
      function Host() {
        const [notifications, setRows] = React.useState(null)
        Object.assign(window, { independentInboxRows: setRows })
        const presentation = { scope: 'independent-owner', identity: 'independent-rows', sourceLabel: 'SUPPLIED INDEPENDENT TEST', accounts: null, strategies: null, notifications, ledger: { pos: null, open: null, orders: null, fills: null, closed: null, assets: null } }
        return React.createElement(NativeTradingWorkspace, { accountScope: presentation.scope, presentation, alertsRequest: 1, onReturn: () => {}, onNew: () => {} })
      }
      ;(DOM.createRoot ?? DOM.default.createRoot)(document.getElementById('fixture')).render(React.createElement(Host))
    }, language)
    const inbox = page.locator('[data-native-account-alerts]'), filters = inbox.getByRole('group').getByRole('button')
    await expect(inbox).toBeVisible()
    const empty = inbox.locator('.nfx-empty')
    await filters.nth(3).click(); await filters.nth(3).focus()
    for (const count of [null, 0, 1, 2]) {
      await page.evaluate(count => Reflect.get(window, 'independentInboxRows')(count === null ? null : Array.from({ length: count }, (_, index) => ({ id: `supplied-${index}`, type: 'pos', title: `ORIGINAL BODY ${index} 0 USDT`, timeLabel: 'ORIGINAL TIME', read: false }))), count)
      await expect(empty).toHaveRole('status')
      await expect.soft(empty.locator('.nfx-etit')).toHaveText(count === null ? notification[5] : count === 0 ? notification[3] : notification[0], { timeout: 1_000 })
      if (count === null) await expect(empty.locator('.nfx-edesc')).toHaveCount(0)
      else await expect.soft(empty.locator('.nfx-edesc')).toHaveText(count === 0 ? notification[4] : count === 1 ? notification[1] : notification[2], { timeout: 1_000 })
      await expect(filters.nth(3)).toBeFocused()
      await expect(filters.nth(3)).toHaveAttribute('aria-pressed', 'true')
      await readable(page, '[data-native-account-alerts] .nfx-etit,[data-native-account-alerts] .nfx-edesc')
      if (count) {
        await filters.nth(0).click()
        await expect(inbox.locator('.nf-item')).toHaveCount(count)
        await expect(inbox).toContainText('ORIGINAL BODY 0 0 USDT')
        await expect(inbox).toContainText('ORIGINAL TIME')
        for (const row of await inbox.locator('.nf-item').all()) await expect(row).not.toHaveClass(/read/)
        await filters.nth(3).click(); await filters.nth(3).focus()
      }
    }
    await page.screenshot({ path: info.outputPath(`inbox-${language}.png`), fullPage: true })
    // Supplied ledger text must remain verbatim. Null is not an invented zero
    // balance; an actual zero USDT quantity must not be converted to USD/FX.
    await page.evaluate(async () => {
      const path = '/src/internal-poc/NativeAccountPanels.tsx'
      const source = await (await fetch(path)).text(), reactPath = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
      if (!reactPath) throw new Error('Missing Vite React instance')
      const rm = await import(/* @vite-ignore */ reactPath), React = rm.default ?? rm
      const domPath = '/@id/react-dom/client', DOM = await import(/* @vite-ignore */ domPath)
      const { NativeAccountLedger } = await import(/* @vite-ignore */ path)
      const node = document.createElement('div'); node.id = 'independent-ledger-root'; document.body.append(node)
      function Host() {
        const [rows, setRows] = React.useState(null)
        Object.assign(window, { independentLedgerRows: setRows })
        return React.createElement(NativeAccountLedger, { tab: 'assets', rows, sourceLabel: 'SUPPLIED LEDGER TEST', onSelect: () => {}, onAccount: () => {}, canAccount: () => false })
      }
      ;(DOM.createRoot ?? DOM.default.createRoot)(node).render(React.createElement(Host))
    })
    const ledger = page.locator('#independent-ledger-root [data-native-ledger="assets"]')
    await expect(ledger.getByRole('status')).toHaveText(ledgerStates[index][0])
    await expect(ledger.locator('.tft-asx')).toHaveCount(0)
    await expect(ledger).not.toContainText(/\$|0 USDT|0 BTC|1 ETH/)
    await page.evaluate(() => Reflect.get(window, 'independentLedgerRows')([]))
    await expect(ledger.locator('.tft-empty')).toHaveText(ledgerStates[index][1])
    await expect(ledger.getByRole('status')).toHaveCount(0)
    await page.evaluate(() => Reflect.get(window, 'independentLedgerRows')([{ id: 'actual-zero', accountId: 'actual-account', cells: { exchange: 'ORIGINAL VENUE', equity: '0 USDT', available: '0 BTC', used: '1 ETH' } }]))
    await expect(ledger.locator('.ag2 > span > b')).toHaveText(['0 USDT', '0 BTC', '1 ETH', '—'])
    await expect(ledger).not.toContainText(/\$|KRW|EUR/)
    await page.screenshot({ path: info.outputPath(`ledger-${language}.png`), fullPage: true })
  })
}
