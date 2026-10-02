import { expect, test, type Page } from '@playwright/test'
import { readSharedLocation, sharedHash, catalogueCopyLocation } from '../src/client-shared-navigation'
import { catalogueCopyStorageKey } from '../src/client-catalogue-copy-store'
import { accountTerminalText } from '../src/client-account-terminal-copy'
import type { ClientLanguage } from '../src/client-preferences'
import words from '../src/client-catalogue-copy-management-copy.json' with { type: 'json' }

const owner = 'catalogue-ui@example.test', id = 'current-copy', key = catalogueCopyStorageKey(owner)
test.setTimeout(60_000)
async function seed(page: Page, strategyId = 'd1', full = false) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(owner => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '검수자', email: owner })), owner)
  await page.goto('/')
  await page.evaluate(async ({ owner, id, strategyId, full }) => {
    const { createCatalogueCopyAccountController } = await import('/src/client-catalogue-copy-account.ts')
    const controller = createCatalogueCopyAccountController(owner)
    const started = await controller.start({ id, strategyId, at: Date.UTC(2026, 8, 1), settings: { amount: 500, loss: -20, existing: 'copy', cap: 95 } })
    if (!started.ok) throw Error(started.error)
    if (full) {
      const { validateCatalogueCopyAccount, catalogueCopyStorageKey } = await import('/src/client-catalogue-copy-store.ts')
      const { value } = await controller.inspect(id, new AbortController().signal)
      const state = structuredClone(controller.getSnapshot().state!), record = state.copies[0].record
      record.startI = value.result.eq[0].i; record.ledger[0].i = record.startI
      validateCatalogueCopyAccount(state, owner)
      sessionStorage.setItem(catalogueCopyStorageKey(owner), JSON.stringify(state))
    }
    controller.dispose()
  }, { owner, id, strategyId, full })
}
async function detail(page: Page) {
  await page.goto('/' + sharedHash(catalogueCopyLocation(id)))
  const root = page.locator('.catalogue-copy-management')
  await expect(root.getByRole('button', { name: '예산 조정', exact: true })).toBeEnabled()
  return root
}

test('실제 Worker의 원본 청산 관측은 복원된 대기 원장을 종료기록으로 연결하고 재방문에도 회수를 반복하지 않는다', async ({ page }, info) => {
  await seed(page)
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await page.evaluate(async ({owner,id,key}) => {
    const { createCatalogueCopyAccountController } = await import('/src/client-catalogue-copy-account.ts')
    const { validateCatalogueCopyAccount } = await import('/src/client-catalogue-copy-store.ts')
    const c = createCatalogueCopyAccountController(owner)
    const { value } = await c.inspect(id, new AbortController().signal)
    const state = structuredClone(c.getSnapshot().state!), entry = state.copies[0]
    const trade = value.result.trades.find(t => t.exit !== undefined && t.exit !== null && t.exit < value.result.params.endI)!
    entry.record.startI = trade.entry; entry.record.ledger[0].i = trade.entry; entry.record.stopI = trade.entry
    entry.stopMode = 'wait'
    validateCatalogueCopyAccount(state, owner)
    c.dispose(); sessionStorage.setItem(key, JSON.stringify(state))
  }, {owner,id,key})
  await page.goto('/' + sharedHash(catalogueCopyLocation(id)))
  await page.reload()
  await expect.poll(() => page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!).copies[0].record.status, key)).toBe('closed')
  const root = page.locator('.catalogue-copy-management')
  await expect(root).toContainText('복사를 중단해 포지션이 없습니다.')
  await expect(root.locator('.cpp-meta')).toContainText('중단됨')
  await expect(root.getByRole('alert')).toHaveCount(0)
  const before = await page.evaluate(key => sessionStorage.getItem(key), key)
  expect(JSON.parse(before!).copies[0].record.ledger).toHaveLength(2)
  await page.screenshot({ path: info.outputPath('waiting-settled.png') })
  await page.reload()
  await expect(root).toContainText('복사를 중단해 포지션이 없습니다.')
  expect(await page.evaluate(key => sessionStorage.getItem(key), key)).toBe(before)
  expect(errors).toEqual([])
})
test('카탈로그와 legacy는 같은 ID라도 독립된 주소를 쓴다', () => {
  for (const copyTab of ['pos', 'hist', 'share', 'bal', 'tx'] as const) {
    const route = catalogueCopyLocation('a/b %한', copyTab)
    expect(readSharedLocation(sharedHash(route))).toEqual(route)
    const legacy = { ...route, copyModel: undefined }
    expect(sharedHash(legacy)).not.toBe(sharedHash(route))
    expect(readSharedLocation(sharedHash(legacy))?.copyModel).toBeUndefined()
  }
})
for (const width of [320, 1440]) test(`${width}px Main 터미널→상시 포지션·2탭→예산 조정→중단→종료기록`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 }); await seed(page)
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message))
  await page.goto('/#/trade')
  const judgment = page.getByRole('tab', { name: accountTerminalText('ko', 'judgment'), exact: true })
  if (await judgment.isVisible()) await judgment.click()
  const list = page.locator('.client-terminal-copies')
  await expect(list.locator('.cctj-positions')).toBeVisible()
  await expect(list.locator('.cctj-positions')).not.toContainText('USDT')
  await list.getByRole('button', { name: '복사 관리', exact: true }).click()
  const root = page.locator('.catalogue-copy-management')
  await expect(root.getByRole('button', { name: '예산 조정', exact: true })).toBeEnabled()
  await page.evaluate(() => document.fonts.ready)
  await expect(root.locator('.strategy-glyph')).toHaveCount(0)
  await expect(root.locator('.cq-positions')).toBeVisible()
  for (const selector of ['h2', '.num', '.cq-hd p']) {
    await expect(root.locator(selector).first()).toHaveCSS('font-family', /sans-serif/)
  }
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('DOM.enable'); await cdp.send('CSS.enable')
  const document = await cdp.send('DOM.getDocument')
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: document.root.nodeId, selector: '.catalogue-copy-management .num' })
  const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId })
  expect(fonts.map(font => font.familyName).join(',')).not.toMatch(/Times|Serif|Batang|Myeongjo/)
  await cdp.detach()
  await info.attach('fonts', { body: JSON.stringify(await root.evaluate(node => [...node.querySelectorAll('h2,.num,time')].map(el => ({ text: el.textContent, font: getComputedStyle(el).fontFamily, size: getComputedStyle(el).fontSize })))), contentType: 'application/json' })
  await page.screenshot({ path: info.outputPath('copy-detail.png') })
  const before = await page.evaluate(key => sessionStorage.getItem(key), key)
  await expect(root.getByRole('tablist').getByRole('tab')).toHaveCount(2)
  for (const label of ['예산 내역', '거래 기록']) {
    await root.getByRole('tab', { name: label, exact: true }).click()
    await expect(root.getByRole('tab', { name: label, exact: true })).toHaveAttribute('aria-selected', 'true')
    await expect(root.locator('.cq-positions')).toBeVisible()
  }
  expect(await page.evaluate(key => sessionStorage.getItem(key), key)).toBe(before)
  await root.getByRole('button', { name: '예산 조정', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '예산 조정', exact: true })
  await dialog.getByLabel('조정 금액').fill('100')
  await dialog.getByRole('button', { name: '확인', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(root.getByRole('tab', { name: '예산 내역', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(root.locator('.cq-budget .cq-row')).toHaveCount(2)
  await expect(root.locator('.cq-budget .cq-row').first()).toContainText('100.00')
  await page.screenshot({ path: info.outputPath('copy-transfers.png') })
  await root.getByRole('button', { name: '복사 중단', exact: true }).click()
  await page.getByRole('dialog', { name: '복사 중단', exact: true }).getByRole('button', { name: '확인', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(root.locator('.cpp-meta')).toContainText('중단됨')
  await expect(root.getByRole('button', { name: '예산 조정', exact: true })).toHaveCount(0)
  const closed = JSON.parse((await page.evaluate(key => sessionStorage.getItem(key), key))!)
  expect(closed.copies[0].record.ledger).toHaveLength(3)
  expect(closed.copies[0].settlement).toBeTruthy()
  await root.locator('.ss3-back').click()
  if (await judgment.isVisible()) await judgment.click()
  await expect(list.locator('.cctj')).toHaveCount(0)
  await list.getByRole('button', { name: '종료 기록', exact: false }).click()
  await expect(page.locator('.catalogue-copy-history')).toContainText('중단됨')
  await page.locator('.catalogue-copy-history .nm').click()
  await page.reload()
  await expect(page.locator('.catalogue-copy-management .cpp-meta')).toContainText('중단됨')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(errors).toEqual([])
})

test('저장 오류가 생겨도 열린 입력은 남고 재확인은 작업을 다시 실행하지 않는다', async ({ page }) => {
  await seed(page); const root = await detail(page)
  await root.getByRole('button', { name: '예산 조정', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '예산 조정', exact: true })
  await dialog.getByLabel('조정 금액').fill('123')
  const raw = await page.evaluate(async ({ key, owner }) => {
    const raw = sessionStorage.getItem(key)
    sessionStorage.setItem(key, '{}')
    const { retryCatalogueCopyAccount } = await import('/src/client-catalogue-copy-store.ts')
    retryCatalogueCopyAccount(owner)
    return raw!
  }, { key, owner })
  await expect(dialog.getByLabel('조정 금액')).toHaveValue('123')
  await expect(dialog.getByRole('button', { name: '확인', exact: true })).toBeDisabled()
  await expect(root.locator('[data-metric]')).toHaveText(['—','—','—','—','—','—','—'])
  await dialog.getByRole('button', { name: '다시 시도', exact: true }).click()
  await expect(dialog.getByLabel('조정 금액')).toHaveValue('123')
  await page.evaluate(({ key, raw }) => sessionStorage.setItem(key, raw), { key, raw })
  await dialog.getByRole('button', { name: '다시 시도', exact: true }).click()
  await expect(dialog.getByRole('button', { name: '확인', exact: true })).toBeEnabled()
  expect(await dialog.evaluate(node => node.contains(document.activeElement))).toBe(true)
  expect(await page.evaluate(key => sessionStorage.getItem(key), key)).toBe(raw)
  await dialog.getByRole('button', { name: '취소', exact: true }).click()
  await expect(root.getByRole('button', { name: '예산 조정', exact: true })).toBeFocused()
})

test('다른 열린 화면에서 복사를 종료하면 설정창의 예산 조정도 막힌다', async ({ page }) => {
  await seed(page); const root = await detail(page)
  await root.getByRole('button', { name: '설정', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '복사 설정', exact: true })
  await page.evaluate(async ({ owner, id }) => {
    const { createCatalogueCopyAccountController } = await import('/src/client-catalogue-copy-account.ts')
    const controller = createCatalogueCopyAccountController(owner)
    const result = await controller.stop(id, 'now', Date.now())
    controller.dispose()
    if (!result.ok) throw Error(result.error)
  }, { owner, id })
  await expect(root.locator('.cpp-meta')).toContainText('중단됨')
  await expect(dialog.getByRole('button', { name: '예산 조정', exact: true })).toBeDisabled()
})

test('설정→예산 조정→취소는 원장을 바꾸지 않고 원래 설정 버튼으로 돌아간다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 900 }); await seed(page); const root = await detail(page)
  const before = await page.evaluate(key => sessionStorage.getItem(key), key)
  const settingsButton = root.getByRole('button', { name: '설정', exact: true })
  await settingsButton.click()
  const settings = page.getByRole('dialog', { name: '복사 설정', exact: true })
  await expect(settings.locator('.catalogue-copy-settings dd')).toHaveText(['원본 비율', '2026. 9. 1.', 'BTC, ETH, SOL, XRP, DOGE, ADA, AVAX, BNB', '$500.00', '-20%', '현재 포지션부터', '95%'])
  await settings.getByRole('button', { name: '예산 조정', exact: true }).click()
  const adjust = page.getByRole('dialog', { name: '예산 조정', exact: true })
  await expect(adjust).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(1)
  await adjust.getByLabel('조정 금액').fill('2000')
  await expect(adjust.getByRole('button', { name: '확인', exact: true })).toBeDisabled()
  await expect(adjust.getByRole('alert')).toContainText('스팟 잔고보다 커요')
  await page.screenshot({ path: info.outputPath('copy-settings-adjust.png') })
  await page.keyboard.press('Escape')
  await expect(adjust).toBeHidden()
  await expect(settingsButton).toBeFocused()
  expect(await page.evaluate(key => sessionStorage.getItem(key), key)).toBe(before)
})

for (const mode of ['wait', 'manual'] as const) test(`${mode}는 즉시 정산과 구분되고 직접 정리는 한 번만 회수된다`, async ({ page }) => {
  await seed(page); const root = await detail(page)
  await root.getByRole('button', { name: '복사 중단', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '복사 중단', exact: true })
  await dialog.getByLabel(words[mode][0], { exact: true }).check()
  await dialog.getByRole('button', { name: '확인', exact: true }).click()
  await expect(dialog).toBeHidden()
  const state = JSON.parse((await page.evaluate(key => sessionStorage.getItem(key), key))!)
  expect(state.copies[0].stopMode).toBe(mode)
  expect(state.copies[0].record.status).toBe('active')
  await expect(root.locator('.cpp-meta')).toContainText('종료 대기')
  await root.locator('.cq-acts').getByRole('button', { name: '포지션 정리 후 복사 종료', exact: true }).click()
  // Wait for reconciliation/inspection readiness through two animation frames;
  // enabled hit testing alone does not cover a concurrent busy transition.
  await page.waitForFunction(() => {
    const button = document.querySelector<HTMLButtonElement>('dialog[open] .wbtn')
    const scope = window as unknown as { __copyConfirmReady?: { node: HTMLButtonElement; frames: number } }
    if (!button || button.disabled || button.getAttribute('aria-busy') !== 'false'
      || document.querySelector('.catalogue-copy-management [role=status][aria-busy=true]')) {
      scope.__copyConfirmReady = undefined; return false
    }
    if (scope.__copyConfirmReady?.node !== button) scope.__copyConfirmReady = { node: button, frames: 0 }
    return ++scope.__copyConfirmReady.frames >= 2
  }, undefined, { polling: 'raf' })
  await page.getByRole('dialog').getByRole('button', { name: '확인', exact: true }).click()
  await expect(root.locator('.cpp-meta')).toContainText('중단됨')
  const after = await page.evaluate(key => sessionStorage.getItem(key), key)
  await page.reload(); await expect(page.locator('.catalogue-copy-management .cpp-meta')).toContainText('중단됨')
  expect(await page.evaluate(key => sessionStorage.getItem(key), key)).toBe(after)
})

test('320px 7언어와 확대 글자에서 금액 단위와 탭·입력 가독성 유지', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 900 }); await seed(page); const root = await detail(page)
  const languages: ClientLanguage[] = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']
  for (let index = 0; index < languages.length; index++) {
    await page.evaluate(async language => { const { setClientPreference } = await import('/src/client-preferences.ts'); setClientPreference('language', language) }, languages[index])
    await expect(root.getByRole('button', { name: words.budget[index], exact: true })).toBeVisible()
    await expect(root.locator('.cpp-foot')).toContainText('USD')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await root.getByRole('button', { name: words.budget[6], exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.evaluate(node => {
    const sizes = [...node.querySelectorAll<HTMLElement>('h2,p,label,button,span,input')].map(el => [el, Number.parseFloat(getComputedStyle(el).fontSize) * 2] as const)
    for (const [el, size] of sizes) el.style.fontSize = `${size}px`
  })
  await dialog.getByRole('textbox').scrollIntoViewIfNeeded()
  await expect(dialog.getByRole('textbox')).toBeVisible()
  expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('copy-french-dialog.png') })
})

test('다른 계정 및 결측 ID는 기록을 노출하거나 새 원장을 쓰지 않는다', async ({ page }) => {
  await page.goto('/' + sharedHash(catalogueCopyLocation(id)))
  await expect(page.locator('.client-strategy-sharing')).toContainText('로그인 후 카피를 관리할 수 있어요')
  expect(await page.evaluate(key => sessionStorage.getItem(key), key)).toBeNull()
  await seed(page); await page.goto('/' + sharedHash(catalogueCopyLocation('missing')))
  await expect(page.locator('.catalogue-copy-management')).toContainText('카피를 찾을 수 없어요')
})

test('금액 접힘·상시 포지션·두 탭 키보드·도움말 복귀는 원장과 스크롤을 보존한다', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await seed(page, 'd1', true); const root = await detail(page)
  const before = await page.evaluate(key => sessionStorage.getItem(key), key)
  await expect(root.locator('.cq-amt')).not.toHaveAttribute('open')
  await root.locator('.cq-amt > summary').click()
  await expect(root.locator('.cq-amt .cq-list')).toContainText('회수 가능 금액')
  const positions = root.locator('.cq-positions'); await positions.evaluate(node => { node.setAttribute('data-kept', 'yes') })
  const trades = root.getByRole('tab', { name: '거래 기록', exact: true })
  await trades.scrollIntoViewIfNeeded(); await trades.focus()
  const scroll = await root.evaluate(node => { let p = node.parentElement; while (p && p.scrollHeight <= p.clientHeight) p = p.parentElement; if (!p) throw Error('scroll container missing'); p.setAttribute('data-cpx-scroll-test', ''); return p.scrollTop })
  await page.keyboard.press('ArrowRight')
  await expect(root.getByRole('tab', { name: '예산 내역', exact: true })).toBeFocused()
  await expect(root.getByRole('tabpanel')).toContainText('예산 추가')
  await expect(positions).toHaveAttribute('data-kept', 'yes')
  expect(await page.locator('[data-cpx-scroll-test]').evaluate((node, before) => Math.abs(node.scrollTop - Math.min(before, node.scrollHeight - node.clientHeight)), scroll)).toBeLessThanOrEqual(1)
  await page.keyboard.press('Home'); await expect(trades).toBeFocused()
  await expect(trades).toHaveAttribute('aria-selected', 'true')
  const rows = root.locator('.cq-trades details')
  expect(await rows.count()).toBeGreaterThan(0)
  await rows.first().locator('summary').click()
  await expect(rows.first().locator('.cq-more')).toContainText('원본 종료가')
  await page.screenshot({ path: info.outputPath('cpx-trades.png') })
  const help = root.getByRole('button', { name: '상담원에게 묻기', exact: true })
  await help.click(); await expect(page.locator('.client-modal-help [role="dialog"]')).toBeVisible()
  await page.keyboard.press('Escape'); await expect(help).toBeFocused()
  expect(await page.evaluate(key => sessionStorage.getItem(key), key)).toBe(before)
})

for (const width of [320, 760, 1440]) test(width + 'px 프랑스어 두 배 글자의 상세·거래 행·금액', async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1000 }); await seed(page, 'd1', true); const root = await detail(page)
  await page.evaluate(async () => { const { setClientPreference } = await import('/src/client-preferences.ts'); setClientPreference('language', 'fr') })
  await root.locator('.cq-amt > summary').click()
  await root.evaluate(node => {
    const items = [...node.querySelectorAll<HTMLElement>('h2,h3,p,button,summary,small,b,span,.big')].map(el => [el, Number.parseFloat(getComputedStyle(el).fontSize) * 2] as const)
    for (const [el, size] of items) el.style.fontSize = size + 'px'
  })
  await expect(root.getByRole('button', { name: words.budget[6], exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('cpx-french-top.png') })
  await root.getByRole('tablist').scrollIntoViewIfNeeded()
  for (const tab of await root.getByRole('tab').all()) {
    expect(await tab.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
  }
  const trade = root.locator('.cq-trades details').first()
  await trade.locator('summary').click(); await trade.scrollIntoViewIfNeeded()
  expect(await trade.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
  expect(await root.locator('.big').evaluate(el => getComputedStyle(el).whiteSpace)).toBe('nowrap')
  await page.screenshot({ path: info.outputPath('cpx-french-trades.png') })
})
