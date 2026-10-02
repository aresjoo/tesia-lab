import { expect, test, type Page } from '@playwright/test'
import { strategyActionsCopy, strategyActionsText } from '../src/client-strategy-actions-copy'

async function mount(page: Page, options: { nested?: boolean; readonly?: boolean; status?: string; history?: 'empty' | 'missing'; cloneCopy?: boolean } = {}) {
  await page.route('**/strategy-actions-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;font-family:sans-serif"><div id="fixture"></div></body></html>' }))
  await page.goto('/strategy-actions-test.html')
  await page.evaluate(async settings => {
    for (const path of ['/node_modules/@fontsource-variable/noto-sans-kr/wght.css', '/node_modules/@fontsource-variable/noto-sans-sc/wght.css', '/node_modules/@fontsource-variable/geist/wght.css', '/src/client-reference.css']) await import(/* @vite-ignore */ path)
    document.body.style.fontFamily = '"Noto Sans KR Variable", "Noto Sans SC Variable", "Geist Variable", sans-serif'
    const refreshPath = '/@react-refresh'
    const runtime = (await import(/* @vite-ignore */ refreshPath)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const cp = '/src/components/ClientStrategyActions.tsx', dp = '/@id/react-dom/client'
    const source = await (await fetch(cp)).text()
    const rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing Vite React instance')
    const rm = await import(/* @vite-ignore */ rp), dm = await import(/* @vite-ignore */ dp), { ClientStrategyActions } = await import(/* @vite-ignore */ cp)
    const react = rm.default ?? rm, h = react.createElement
    const state = { calls: [] as unknown[][], closes: 0, behavior: 'success', settle: (failed: boolean) => { void failed } }
    const perform = async (...args: unknown[]) => {
      state.calls.push(args)
      if (state.behavior === 'failure') throw new Error('PRIVATE_DIAGNOSTIC_SHOULD_NOT_RENDER')
      if (state.behavior === 'pending') await new Promise<void>((resolve, reject) => { state.settle = failed => failed ? reject(new Error('PRIVATE_DIAGNOSTIC_SHOULD_NOT_RENDER')) : resolve() })
    }
    const fixture = document.getElementById('fixture')!
    if (settings.nested) {
      const parent = document.createElement('dialog')
      parent.id = 'parent-dialog'; parent.setAttribute('aria-label', '부모 터미널')
      Object.assign(parent.style, { width: '100%', height: '100dvh', maxWidth: 'none', maxHeight: 'none', margin: '0', padding: '0', border: '0' })
      document.body.append(parent); parent.append(fixture); parent.showModal(); document.body.style.overflow = 'hidden'
    }
    function Host() {
      const [anchor, setAnchor] = react.useState(null)
      const [strategy, setStrategy] = react.useState({ id: 'strategy-a', name: '원본 전략', status: settings.status ?? 'off', symbol: 'BTC/USDT', market: '현물', version: 'v3', exchange: { id: 'a', name: '거래소 A', color: '#333' }, capitalLabel: '미공급' })
      Object.assign(window, { actionState: state, setActionStrategy: (value: object) => setStrategy((old: object) => ({ ...old, ...value })) })
      return h(react.Fragment, null, h('button', { id: 'action-trigger', onClick: (event: { currentTarget: HTMLElement }) => setAnchor(event.currentTarget) }, '전략 메뉴 열기'), h('button', { id: 'outside' }, '외부 버튼'),
        anchor && h(ClientStrategyActions, { strategy, trigger: anchor, onClose: () => { state.closes++; setAnchor(null) },
          exchanges: [{ id: 'a', name: '거래소 A' }, { id: 'b', name: '거래소 B' }, { id: 'c', name: '<script>거래소 C</script>' }],
          versionHistory: settings.history === 'missing' ? undefined : settings.history === 'empty' ? [] : [{ from: 'v1', to: 'v2', timeLabel: '어제', by: '사용자', diff: '첫 수정' }, { from: 'v2', to: 'v3', timeLabel: '오늘', by: '운영자', diff: '<script>설정 변경</script>' }],
          cloneDescription: settings.cloneCopy ? '설정 그대로 다른 거래소에 실행 전 상태로 복제해요. (시뮬레이션)' : undefined,
          cloneExchangeNote: settings.cloneCopy ? '복제 후 검증 상태 유지' : undefined,
          callbacks: settings.readonly ? undefined : { onDetail: (id: string) => state.calls.push(['detail', id]), onRename: (id: string, name: string) => perform('rename', id, name), onClone: (id: string, exchange?: string) => perform('clone', id, exchange), onStatus: (id: string, status: string) => perform('status', id, status), onDelete: (id: string) => perform('delete', id) },
        }))
    }
    const root = (dm.createRoot ?? dm.default.createRoot)(fixture)
    Object.assign(window, { unmountActions: () => root.unmount() })
    root.render(h(Host))
  }, options)
  await page.getByRole('button', { name: '전략 메뉴 열기' }).click()
  await expect(page.getByRole('menu')).toBeVisible()
  await page.evaluate(async () => { await document.fonts.ready })
}
async function calls(page: Page) { return page.evaluate(() => Reflect.get(window, 'actionState').calls) }
async function behavior(page: Page, value: string) { await page.evaluate(next => { Reflect.get(window, 'actionState').behavior = next }, value) }
async function settle(page: Page, failed = false) { await page.evaluate(value => Reflect.get(window, 'actionState').settle(value), failed) }

async function language(page: Page, value: string) {
  await page.evaluate(async value => {
    const path = '/src/client-preferences.ts'
    const { setClientPreference } = await import(/* @vite-ignore */ path)
    setClientPreference('language', value)
  }, value)
}

test('언어 변경은 열린 메뉴와 이름 오류에 적용되고 초안은 유지된다', async ({ page }) => {
  await mount(page)
  await language(page, 'en')
  await expect(page.getByRole('menuitem', { name: 'Rename', exact: true })).toBeVisible()
  await page.getByRole('menuitem', { name: 'Rename', exact: true }).click()
  await page.getByRole('textbox').fill('   ')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('Please enter a name')
  await language(page, 'ko')
  await expect(page.getByRole('alert')).toHaveText('이름을 입력해주세요')
  await expect(page.getByRole('textbox')).toHaveValue('   ')
  expect(await calls(page)).toEqual([])
})

test('7언어 전환에도 메뉴 순서·초점과 이름 초안·커서·실패 후 재시도를 보존한다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 })
  await mount(page, { nested: true })
  await page.getByRole('menuitem', { name: '이름 변경' }).focus()
  await page.getByRole('menu').evaluate(el => Reflect.set(window, 'originalMenu', el))
  for (const locale of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    const t = (key: keyof typeof strategyActionsCopy) => strategyActionsText(locale, key)
    await language(page, locale)
    await expect(page.getByRole('menuitem')).toHaveText(['detail', 'rename', 'clone', 'cloneExchange', 'resume', 'versions', 'delete'].map(key => t(key as keyof typeof strategyActionsCopy)))
    await expect(page.getByRole('menuitem', { name: t('rename'), exact: true })).toBeFocused()
    expect(await page.getByRole('menu').evaluate(el => el === Reflect.get(window, 'originalMenu'))).toBe(true)
    await expect.poll(async () => { const box = await page.getByRole('menu').boundingBox(); return box!.x >= 9 && box!.x + box!.width <= 311 }).toBe(true)
  }
  await page.getByRole('menuitem', { name: 'Renommer', exact: true }).click()
  const input = page.getByRole('textbox')
  await input.fill('초안 <b>BTC</b>')
  await input.evaluate(el => { (el as HTMLInputElement).setSelectionRange(2, 5); Reflect.set(window, 'originalInput', el) })
  for (const locale of ['en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr', 'ko'] as const) {
    await language(page, locale)
    await expect(input).toHaveAccessibleName(strategyActionsText(locale, 'name'))
    await expect(input).toBeFocused()
    expect(await input.evaluate(el => [el === Reflect.get(window, 'originalInput'), (el as HTMLInputElement).selectionStart, (el as HTMLInputElement).selectionEnd])).toEqual([true, 2, 5])
  }
  await behavior(page, 'pending')
  await page.getByRole('button', { name: '저장', exact: true }).click()
  await language(page, 'fr')
  await expect(page.getByRole('button', { name: 'Annuler' })).toBeDisabled()
  await page.locator('.csa-dialog form').dispatchEvent('submit')
  await page.keyboard.press('Escape')
  expect(await calls(page)).toEqual([['rename', 'strategy-a', '초안 <b>BTC</b>']])
  await settle(page, true)
  await expect(page.getByRole('alert')).toHaveText(strategyActionsText('fr', 'failed'))
  await language(page, 'en')
  await expect(page.getByRole('alert')).toHaveText(strategyActionsText('en', 'failed'))
  await expect(input).toHaveValue('초안 <b>BTC</b>')
  await expect(page.locator('body')).not.toContainText('PRIVATE_DIAGNOSTIC')
  await behavior(page, 'success')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.locator('.csa-dialog')).toHaveCount(0)
  await expect(page.locator('#action-trigger')).toBeFocused()
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden')
  expect(await calls(page)).toHaveLength(2)
})

test('320px 7언어 삭제 보호 문구와 버튼은 잘리지 않고 중지만 요청한다', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 720 })
  await mount(page, { status: 'live' })
  await page.getByRole('menuitem', { name: '삭제', exact: true }).click()
  for (const locale of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await language(page, locale)
    await expect(page.locator('.csa-dialog h2')).toHaveText(strategyActionsText(locale, 'cantDelete'))
    await expect(page.locator('.ntc')).toContainText(strategyActionsText(locale, 'runningMessage', { status: strategyActionsText(locale, 'running') }))
    await expect(page.locator('.ntc')).toContainText(strategyActionsText(locale, 'stopFirst'))
    for (const button of await page.locator('.acts3 button').all()) {
      expect(await button.evaluate(el => { const range = document.createRange(); range.selectNodeContents(el); const box = el.getBoundingClientRect(); return [...range.getClientRects()].every(r => r.top >= box.top && r.bottom <= box.bottom && r.left >= box.left && r.right <= box.right) })).toBe(true)
    }
    expect(await page.locator('.din').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
  }
  await page.screenshot({ path: testInfo.outputPath('actions-fr-320.png') })
  expect(await calls(page)).toEqual([])
  await page.getByRole('button', { name: strategyActionsText('fr', 'stop'), exact: true }).click()
  expect(await calls(page)).toEqual([['status', 'strategy-a', 'off']])
})

test('7언어 복제 확인은 공급 원문·거래소 ID와 실패 후 선택을 보존한다', async ({ page }) => {
  await mount(page, { cloneCopy: true })
  await page.getByRole('menuitem', { name: '다른 거래소에 복제' }).click()
  for (const locale of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await language(page, locale)
    await expect(page.locator('.csa-dialog h2')).toHaveText(strategyActionsText(locale, 'cloneExchange'))
    await expect(page.locator('.ntc')).toHaveText('"원본 전략" 설정 그대로 다른 거래소에 실행 전 상태로 복제해요. (시뮬레이션)')
    await expect(page.locator('.rs')).toHaveText(['복제 후 검증 상태 유지', '복제 후 검증 상태 유지'])
    await expect(page.locator('.rn')).toHaveText(['거래소 B', '<script>거래소 C</script>'])
  }
  await behavior(page, 'pending')
  await page.locator('.ss3-radio').first().click()
  await language(page, 'en')
  await expect(page.locator('.ss3-radio').first()).toBeDisabled()
  await settle(page, true)
  await expect(page.getByRole('alert')).toHaveText(strategyActionsText('en', 'failed'))
  await language(page, 'ja')
  await expect(page.getByRole('alert')).toHaveText(strategyActionsText('ja', 'failed'))
  await behavior(page, 'success')
  await page.locator('.ss3-radio').last().click()
  expect(await calls(page)).toEqual([['clone', 'strategy-a', 'b'], ['clone', 'strategy-a', 'c']])
  await expect(page.locator('.csa-dialog')).toHaveCount(0)
})

test('700px 터치 화면에서도 메뉴와 닫기 버튼은 44px 조작 영역을 제공한다', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 700, height: 900 }, hasTouch: true })
  try {
    const page = await context.newPage()
    await mount(page)
    expect(await page.evaluate(() => matchMedia('(pointer:coarse)').matches)).toBe(true)
    for (const item of await page.getByRole('menuitem').all()) expect((await item.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    await page.getByRole('menuitem', { name: '이름 변경', exact: true }).click()
    const close = await page.locator('.csa-dialog .dx').boundingBox()
    expect(close!.height).toBeGreaterThanOrEqual(44)
    expect(close!.width).toBeGreaterThanOrEqual(44)
  } finally { await context.close() }
})

test('공급하지 않은 동작은 비활성이고 읽기 전용 버전 기록만 열 수 있다', async ({ page }) => {
  await mount(page, { readonly: true, history: 'missing' })
  await expect(page.getByRole('menuitem', { name: '버전 기록' })).toBeFocused()
  for (const name of ['전략 상세', '이름 변경', '복제', '다른 거래소에 복제', '다시 시작', '삭제']) await expect(page.getByRole('menuitem', { name, exact: true })).toBeDisabled()
  await page.getByRole('menuitem', { name: '버전 기록' }).click()
  await expect(page.getByRole('dialog', { name: '버전 기록: 원본 전략' })).toContainText('버전 기록이 제공되지 않았습니다.')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: '전략 메뉴 열기' })).toBeFocused()
  expect(await calls(page)).toEqual([])
})

test('메뉴 키보드 이동과 Escape·Tab 종료는 원래 버튼으로 돌아온다', async ({ page }) => {
  await mount(page)
  await expect(page.getByRole('menuitem', { name: '전략 상세' })).toBeFocused()
  await page.keyboard.press('End')
  await expect(page.getByRole('menuitem', { name: '삭제', exact: true })).toBeFocused()
  await page.keyboard.press('Home')
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('menuitem', { name: '이름 변경' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '전략 메뉴 열기' })).toBeFocused()
  await page.getByRole('button', { name: '전략 메뉴 열기' }).click()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('menu')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '전략 메뉴 열기' })).toBeFocused()
})

test('이름 변경은 30자 제한·공백 검증·trim을 유지하며 메뉴→대화상자 전이에서 종료하지 않는다', async ({ page }) => {
  await mount(page)
  await page.getByRole('menuitem', { name: '이름 변경' }).click()
  expect(await page.evaluate(() => Reflect.get(window, 'actionState').closes)).toBe(0)
  const input = page.getByRole('textbox', { name: '전략 이름' })
  await expect(input).toBeFocused()
  await expect(input).toHaveAttribute('maxlength', '30')
  await input.fill('   ')
  await page.getByRole('button', { name: '저장', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('이름을 입력해주세요')
  expect(await calls(page)).toEqual([])
  await input.fill('  새 전략  ')
  await page.getByRole('button', { name: '저장', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(await calls(page)).toEqual([['rename', 'strategy-a', '새 전략']])
  await expect(page.getByRole('button', { name: '전략 메뉴 열기' })).toBeFocused()
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('')
})

test('요청 중 중복 제출·닫기를 막고 실패하면 입력·대화상자를 유지해 재시도한다', async ({ page }) => {
  await mount(page)
  await behavior(page, 'pending')
  await page.getByRole('menuitem', { name: '이름 변경' }).click()
  await page.getByRole('textbox', { name: '전략 이름' }).fill('미저장 조건')
  await page.getByRole('button', { name: '저장', exact: true }).click()
  await page.locator('.csa-dialog form').dispatchEvent('submit')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('button', { name: '취소' })).toBeDisabled()
  expect(await calls(page)).toHaveLength(1)
  await settle(page, true)
  await expect(page.getByRole('alert')).toHaveText('요청을 완료하지 못했습니다. 다시 시도해주세요.')
  await expect(page.getByRole('textbox', { name: '전략 이름' })).toHaveValue('미저장 조건')
  await expect(page.locator('body')).not.toContainText('PRIVATE_DIAGNOSTIC')
  await behavior(page, 'success')
  await page.getByRole('button', { name: '저장', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(await calls(page)).toHaveLength(2)
})

test('취소·조합 Escape는 이름 변경을 전송하지 않는다', async ({ page }) => {
  await mount(page)
  await page.getByRole('menuitem', { name: '이름 변경' }).click()
  const input = page.getByRole('textbox', { name: '전략 이름' })
  await input.fill('아직 작성 중')
  await input.dispatchEvent('keydown', { key: 'Escape', isComposing: true, keyCode: 229, bubbles: true })
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: '취소' }).click()
  expect(await calls(page)).toEqual([])
  await expect(page.getByRole('button', { name: '전략 메뉴 열기' })).toBeFocused()
})

test('다른 거래소 복제는 현재 거래소를 제외하고 취소·실패·재시도를 구분한다', async ({ page }) => {
  await mount(page, { cloneCopy: true })
  await page.getByRole('menuitem', { name: '다른 거래소에 복제' }).click()
  await expect(page.getByRole('dialog')).toContainText('설정 그대로 다른 거래소에 실행 전 상태로 복제해요. (시뮬레이션)')
  await expect(page.getByRole('button', { name: '거래소 A', exact: true })).toHaveCount(0)
  await expect(page.locator('.csa-dialog script')).toHaveCount(0)
  await page.getByRole('button', { name: '취소' }).click()
  expect(await calls(page)).toEqual([])
  await page.getByRole('button', { name: '전략 메뉴 열기' }).click()
  await page.getByRole('menuitem', { name: '다른 거래소에 복제' }).click()
  await behavior(page, 'failure')
  await page.getByRole('button', { name: '거래소 B 복제 후 검증 상태 유지' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('alert')).toBeVisible()
  await behavior(page, 'success')
  await page.getByRole('button', { name: '거래소 B 복제 후 검증 상태 유지' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(await calls(page)).toEqual([['clone', 'strategy-a', 'b'], ['clone', 'strategy-a', 'b']])
})

test('복제와 상태 변경은 콜백 완료만 기다리고 자체 전략 변경·성공 문구를 만들지 않는다', async ({ page }) => {
  await mount(page)
  await behavior(page, 'pending')
  await page.getByRole('menuitem', { name: '복제', exact: true }).click()
  await expect(page.getByRole('menu')).toHaveAttribute('aria-busy', 'true')
  await expect(page.getByRole('menuitem', { name: '복제', exact: true })).toBeDisabled()
  expect(await calls(page)).toEqual([['clone', 'strategy-a', undefined]])
  await settle(page)
  await expect(page.getByRole('menu')).toHaveCount(0)
  await behavior(page, 'success')
  await page.getByRole('button', { name: '전략 메뉴 열기' }).click()
  await page.getByRole('menuitem', { name: '다시 시작' }).click()
  await expect(page.getByRole('menu')).toHaveCount(0)
  expect(await calls(page)).toEqual([['clone', 'strategy-a', undefined], ['status', 'strategy-a', 'live']])
  await page.getByRole('button', { name: '전략 메뉴 열기' }).click()
  await expect(page.getByRole('menuitem', { name: '다시 시작' })).toBeVisible()
  await expect(page.locator('body')).not.toContainText('전략을 복제했어요')
})

test('실행 중 삭제는 중지만 요청하며 갱신된 상태에서 다시 확정해야 삭제한다', async ({ page }) => {
  await mount(page, { status: 'live' })
  await page.getByRole('menuitem', { name: '삭제', exact: true }).click()
  await expect(page.getByRole('dialog', { name: '삭제할 수 없어요' })).toBeVisible()
  await page.getByRole('button', { name: '전략 중지', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(await calls(page)).toEqual([['status', 'strategy-a', 'off']])
  await page.getByRole('button', { name: '전략 메뉴 열기' }).click()
  await page.getByRole('menuitem', { name: '삭제', exact: true }).click()
  await expect(page.getByRole('dialog', { name: '삭제할 수 없어요' })).toBeVisible()
  await page.getByRole('button', { name: '취소' }).click()
  await page.evaluate(() => Reflect.get(window, 'setActionStrategy')({ status: 'off' }))
  await page.getByRole('button', { name: '전략 메뉴 열기' }).click()
  await page.getByRole('menuitem', { name: '삭제', exact: true }).click()
  await expect(page.getByRole('dialog', { name: '전략 삭제' })).toBeVisible()
  expect(await calls(page)).toHaveLength(1)
  await page.getByRole('button', { name: '삭제', exact: true }).click()
  expect(await calls(page)).toEqual([['status', 'strategy-a', 'off'], ['delete', 'strategy-a']])
})

test('삭제 확인 중 실행 상태가 바뀌면 삭제 대신 중지 단계로 돌아간다', async ({ page }) => {
  await mount(page)
  await page.getByRole('menuitem', { name: '삭제', exact: true }).click()
  await page.evaluate(() => Reflect.get(window, 'setActionStrategy')({ status: 'live' }))
  await page.getByRole('button', { name: '삭제', exact: true }).click()
  await expect(page.getByRole('dialog', { name: '삭제할 수 없어요' })).toBeVisible()
  expect(await calls(page)).toEqual([])
})

test('삭제 실패는 확인 대화상자를 유지하고 원문 이름·버전 이력은 텍스트로 렌더한다', async ({ page }) => {
  await mount(page)
  await behavior(page, 'failure')
  await page.getByRole('menuitem', { name: '삭제', exact: true }).click()
  await page.getByRole('button', { name: '삭제', exact: true }).click()
  await expect(page.getByRole('dialog', { name: '전략 삭제' })).toBeVisible()
  await expect(page.getByRole('alert')).toBeVisible()
  await page.getByRole('button', { name: '취소' }).click()
  await page.getByRole('button', { name: '전략 메뉴 열기' }).click()
  await page.getByRole('menuitem', { name: '버전 기록' }).click()
  await expect(page.locator('.sumr').nth(1)).toContainText('v2 → v3')
  await expect(page.locator('.sumr').nth(1)).toContainText('<script>설정 변경</script>')
  await expect(page.locator('.csa-dialog script')).toHaveCount(0)
})

test('native 전체화면 내부 메뉴와 모달은 top layer에서 초점을 받고 부모 잠금을 보존한다', async ({ page }) => {
  await mount(page, { nested: true })
  await expect(page.getByRole('menuitem', { name: '전략 상세' })).toBeFocused()
  expect(await page.locator('.csa-menu').evaluate(el => el.matches(':popover-open') && el.closest('#parent-dialog') !== null)).toBe(true)
  await page.getByRole('menuitem', { name: '이름 변경' }).click()
  await expect(page.getByRole('textbox', { name: '전략 이름' })).toBeFocused()
  expect(await page.evaluate(() => document.querySelectorAll('dialog:modal').length)).toBe(2)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: '전략 메뉴 열기' })).toBeFocused()
  expect(await page.evaluate(() => document.querySelectorAll('dialog:modal').length)).toBe(1)
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden')
})

test('작은 viewport·앵커 스크롤에서 메뉴를 화면 안에 유지하고 내부 스크롤을 허용한다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 240 })
  await mount(page)
  const menu = page.getByRole('menu')
  let box = await menu.boundingBox()
  expect(box!.x).toBeGreaterThanOrEqual(9)
  expect(box!.y).toBeGreaterThanOrEqual(9)
  expect(box!.x + box!.width).toBeLessThanOrEqual(311)
  expect(box!.y + box!.height).toBeLessThanOrEqual(231)
  expect(await menu.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true)
  await page.keyboard.press('End')
  await expect(page.getByRole('menuitem', { name: '삭제', exact: true })).toBeFocused()
  await page.setViewportSize({ width: 390, height: 400 })
  await page.evaluate(() => { document.body.style.height = '1500px'; window.scrollTo(0, 100) })
  box = await menu.boundingBox()
  expect(box!.y).toBeGreaterThanOrEqual(9)
  expect(box!.y + box!.height).toBeLessThanOrEqual(391)
  await expect(menu).toBeVisible()
})

test('외부 클릭은 대상 초점을 보존하고 pending unmount 후 응답이 늦어도 다시 닫지 않는다', async ({ page }) => {
  await mount(page)
  await page.getByRole('button', { name: '외부 버튼' }).click()
  await expect(page.getByRole('menu')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '외부 버튼' })).toBeFocused()
  await page.getByRole('button', { name: '전략 메뉴 열기' }).click()
  await behavior(page, 'pending')
  await page.getByRole('menuitem', { name: '이름 변경' }).click()
  await page.getByRole('button', { name: '저장', exact: true }).click()
  await page.evaluate(() => Reflect.get(window, 'unmountActions')())
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('')
  await settle(page)
  expect(await page.evaluate(() => Reflect.get(window, 'actionState').closes)).toBe(1)
  await expect(page.locator('dialog:modal')).toHaveCount(0)
})

test('열린 동작의 전략 ID가 교체되면 다른 전략에 이전 입력을 적용하지 않는다', async ({ page }) => {
  await mount(page)
  await page.getByRole('menuitem', { name: '이름 변경' }).click()
  await page.getByRole('textbox', { name: '전략 이름' }).fill('첫 전략 입력')
  await page.evaluate(() => Reflect.get(window, 'setActionStrategy')({ id: 'strategy-b' }))
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(await calls(page)).toEqual([])
})

test('부모 모달이 먼저 잠금을 해제하고 닫혀도 자식이 이전 잠금을 다시 만들지 않는다', async ({ page }) => {
  await mount(page, { nested: true })
  await page.getByRole('menuitem', { name: '이름 변경' }).click()
  await expect(page.getByRole('textbox', { name: '전략 이름' })).toBeFocused()
  await page.locator('#parent-dialog').evaluate(parent => { document.body.style.overflow = ''; (parent as HTMLDialogElement).close() })
  await expect(page.locator('.csa-dialog')).toHaveCount(0)
  await expect(page.locator('dialog:modal')).toHaveCount(0)
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('')
  expect(await calls(page)).toEqual([])
})
