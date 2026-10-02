import { expect, test, type Page } from '@playwright/test'
import { sourceSharedStrategies } from '../src/client-shared-strategies'
import { createCopyPreviewState, startCopyPreview, copyPreviewPairs } from '../src/client-copy-preview-state'
import { copyPreviewStorageKey } from '../src/client-copy-preview-store'
import { catalogueCopyStorageKey } from '../src/client-catalogue-copy-store'
import { sharingCopy } from '../src/client-sharing-copy'
import { sourceSharingNames } from './fixtures/source-sharing-page-helper'
import { catalogueStrategies } from '../src/client-catalogue'
import { copySummaryText } from '../src/client-copy-trading-copy'

const owner = 'library-layout@example.test'
const watchKey = `teth-sharing-watch:account:${encodeURIComponent(owner)}`
const source = sourceSharedStrategies()[0]

async function openLibrary(page: Page, watches: string[] = [], copy = false) {
  const started = copy ? startCopyPreview(createCopyPreviewState(owner), { owner, id: 'library-copy', amount: 200, pairs: [copyPreviewPairs(source)[0]], mode: 'ratio', at: 1000 }, source) : null
  if (started && !started.ok) throw Error(started.message)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ owner, watchKey, watches, copyKey, raw }) => {
    if (sessionStorage.getItem('library-layout-fixture')) return
    sessionStorage.setItem('library-layout-fixture', '1')
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '관심 관리 검수', email: owner }))
    localStorage.setItem('tethLang', 'ko')
    sessionStorage.setItem(watchKey, JSON.stringify(watches))
    if (raw) sessionStorage.setItem(copyKey, raw)
  }, { owner, watchKey, watches, copyKey: copyPreviewStorageKey(owner), raw: started?.ok ? JSON.stringify(started.state) : '' })
  await page.goto('/#/share/library')
  await expect(page.locator('#research-title')).toHaveText('따라가는 중')
  await expect(page.locator('.client-strategy-sharing')).toBeVisible()
}

for (const width of [320, 1440]) test(`${width}px 관심 항목이 있는 관리 화면은 빈 안내 대신 목록부터 보인다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 740 })
  await openLibrary(page, [source.nick])
  const card = page.locator('.strategy-list-card').first()
  await expect(card).toBeVisible()
  await expect(page.locator('.client-shared-follow-list .ss3-empty')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '관심 전략', level: 2, exact: true })).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  const box = await card.boundingBox()
  expect(box!.y).toBeLessThan(300)
  expect(box!.y + box!.height).toBeLessThan(740)
  const find = page.getByRole('button', { name: '전략 찾기', exact: true })
  await find.focus(); await page.keyboard.press('Tab'); await expect(card.getByRole('link')).toBeFocused()
  await page.screenshot({ path: info.outputPath(`library-watch-${width}.png`) })
  expect(await page.evaluate(key => sessionStorage.getItem(key), watchKey)).toBe(JSON.stringify([source.nick]))
})

test('카피 기록만 있어도 따라가는 전략이 없다는 중복 안내와 빈 소제목을 만들지 않는다', async ({ page }) => {
  await openLibrary(page, [], true)
  await expect(page.locator('.cpd-card')).toHaveCount(1)
  await expect(page.locator('.client-shared-follow-list .ss3-empty')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '복제 검증', exact: true })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '관심 전략', exact: true })).toHaveCount(0)
})

for (const watches of [[], ['unknown-saved-id']]) test(`표시할 기록이 없는 ${watches.length ? '미확인 관심' : '빈'} 계정은 시작 안내와 원문을 보존한다`, async ({ page }) => {
  await openLibrary(page, watches)
  await expect(page.locator('.client-shared-follow-list .ss3-empty')).toBeVisible()
  await expect(page.getByRole('heading', { name: '관심 전략', exact: true })).toHaveCount(0)
  expect(await page.evaluate(key => sessionStorage.getItem(key), watchKey)).toBe(JSON.stringify(watches))
  await page.getByRole('button', { name: '전략 찾기로 가기', exact: true }).click()
  await expect(page).toHaveURL(/#\/share$/)
  // Fixed source index.html:21499–21512 renders ten slots per real page.
  expect(await sourceSharingNames(page)).toEqual(expect.arrayContaining(catalogueStrategies.map(row => row.name)))
  expect(await sourceSharingNames(page)).toHaveLength(31)
})

test('마지막 관심 해제 후 복귀하면 원본 시작 안내와 초점을 복원한다', async ({ page }) => {
  await openLibrary(page, [source.nick])
  await page.locator('.strategy-list-link').click()
  await page.getByRole('button', { name: '관심 전략 해제', exact: true }).click()
  await expect(page.getByRole('button', { name: '관심 전략', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await page.goBack()
  await expect(page.locator('#research-title')).toBeFocused()
  await expect(page.locator('.client-shared-follow-list .ss3-empty')).toBeVisible()
  await expect(page.locator('.client-library-watches')).toHaveCount(0)
  expect(await page.evaluate(key => sessionStorage.getItem(key), watchKey)).toBe('[]')
  await page.reload()
  await expect(page.locator('.client-shared-follow-list .ss3-empty')).toBeVisible()
})

test('관심 목록 7언어·2배 글자에서도 같은 링크·초점·원문을 보존한다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await openLibrary(page, [source.nick])
  const card = page.locator('.strategy-list-link')
  await card.focus()
  await page.evaluate(() => {
    Reflect.set(window, 'libraryLink', document.activeElement)
    const root = document.querySelector('.client-strategy-sharing')!
    for (const element of root.querySelectorAll<HTMLElement>('*')) {
      element.style.fontSize = `${parseFloat(getComputedStyle(element).fontSize) * 2}px`
    }
  })
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await page.evaluate(async language => {
      const path = '/src/client-preferences.ts'
      const { setClientPreference } = await import(/* @vite-ignore */ path)
      setClientPreference('language', language)
    }, language)
    await expect(page.getByRole('heading', { name: sharingCopy(language, '관심 전략'), level: 2 })).toBeVisible()
    await expect(card).toBeFocused()
    expect(await page.evaluate(() => document.activeElement === Reflect.get(window, 'libraryLink'))).toBe(true)
    expect(await page.evaluate(key => sessionStorage.getItem(key), watchKey)).toBe(JSON.stringify([source.nick]))
    const widths = await page.locator('.client-strategy-sharing, .client-library-watches, .strategy-list-card').evaluateAll(elements => elements.map(e => ({ scroll: e.scrollWidth, width: e.clientWidth })))
    for (const size of widths) expect(size.scroll).toBeLessThanOrEqual(size.width + 1)
  }
  await page.screenshot({ path: info.outputPath('library-2x-fr.png') })
})

for (const model of ['legacy', 'catalogue'] as const) for (const watched of [false, true]) test(`${model} 저장 오류는 ${watched ? '관심 카드와 함께' : '빈 안내 대신'} 복구 동작과 원문을 보존한다`, async ({ page }) => {
  const key = model === 'legacy' ? copyPreviewStorageKey(owner) : catalogueCopyStorageKey(owner)
  await page.addInitScript(key => { sessionStorage.setItem(key, '{invalid-retained-by-test') }, key)
  await openLibrary(page, watched ? [source.nick] : [])
  const recovery = page.locator(model === 'legacy' ? '.copy-storage-error' : '.catalogue-copy-history [role="alert"]')
  await expect(recovery).toBeVisible()
  await expect(recovery.getByRole('button').first()).toBeEnabled()
  await recovery.getByRole('button').first().click()
  await expect(recovery).toBeVisible()
  await expect(page.locator('.client-shared-follow-list .ss3-empty')).toHaveCount(0)
  await expect(page.locator('.strategy-list-card')).toHaveCount(watched ? 1 : 0)
  expect(await page.evaluate(key => sessionStorage.getItem(key), key)).toBe('{invalid-retained-by-test')
})

test('새 카탈로그 카피 기록이 생기면 빈 안내를 해제하며 원장과 관리 주소를 유지한다', async ({ page }) => {
  await openLibrary(page)
  await expect(page.locator('.client-shared-follow-list .ss3-empty')).toBeVisible()
  await page.evaluate(async ({ owner, strategyId }) => {
    const path = '/src/client-catalogue-copy-account.ts'
    const { createCatalogueCopyAccountController } = await import(/* @vite-ignore */ path)
    const controller = createCatalogueCopyAccountController(owner)
    try {
      const started = await controller.start({ id: 'library-catalogue-copy', strategyId, at: Date.UTC(2026, 8, 1), settings: { amount: 500, loss: -20, existing: 'copy', cap: 95 } })
      if (!started.ok) throw Error(started.error)
    } finally { controller.dispose() }
  }, { owner, strategyId: catalogueStrategies[0].id })
  await expect(page.locator('.catalogue-copy-history li')).toHaveCount(1)
  await expect(page.locator('.catalogue-copy-history').getByRole('heading', { level: 2 })).toHaveCSS('font-size', '20px')
  await expect(page.locator('.client-shared-follow-list .ss3-empty')).toHaveCount(0)
  const key = catalogueCopyStorageKey(owner)
  const before = await page.evaluate(key => sessionStorage.getItem(key), key)
  await page.locator('.catalogue-copy-history li button').click()
  await expect(page.locator('.catalogue-copy-management')).toBeVisible()
  await page.goBack()
  await expect(page.locator('.catalogue-copy-history li')).toHaveCount(1)
  expect(await page.evaluate(key => sessionStorage.getItem(key), key)).toBe(before)
})

for (const width of [360, 760, 1440]) test(`${width}px 카피와 관심 목록은 제목·카드가 겹치지 않고 관리 동작을 유지한다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 })
  await openLibrary(page, [source.nick], true)
  const account = page.locator('.cpd'), watch = page.locator('.client-library-watches')
  await expect(account).toBeVisible(); await expect(watch).toBeVisible()
  const heading = account.getByRole('heading', { name: '실시간 카피', level: 2 })
  await expect(heading).toBeVisible()
  for (const title of [heading, watch.getByRole('heading', { level: 2 })]) {
    await expect(title).toHaveCSS('font-size', '20px')
    await expect(title).toHaveCSS('font-weight', '400')
  }
  await expect(page.locator('.client-shared-follow-list .ss3-empty')).toHaveCount(0)
  const a = await account.boundingBox(), b = await watch.boundingBox()
  expect(a!.y + a!.height).toBeLessThanOrEqual(b!.y)
  expect(await page.locator('.client-strategy-sharing').evaluate(e => e.scrollWidth <= e.clientWidth + 1)).toBe(true)
  const raw = await page.evaluate(key => sessionStorage.getItem(key), copyPreviewStorageKey(owner))
  await account.getByRole('button', { name: '상세', exact: true }).click()
  await expect(page.locator('.cpx')).toBeVisible()
  await page.goBack()
  await expect(watch).toBeVisible()
  expect(await page.evaluate(key => sessionStorage.getItem(key), copyPreviewStorageKey(owner))).toBe(raw)
  await page.screenshot({ path: info.outputPath(`library-mixed-${width}.png`), fullPage: true })
  await watch.scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath(`library-mixed-end-${width}.png`) })
})

for (const withCopy of [false, true]) test(`재검증 제목은 카피 기록 ${withCopy ? '유무에 중복되지 않고' : '없이도'} 실제 목록을 설명한다`, async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 900 })
  await openLibrary(page, [source.nick], withCopy)
  // The mounted Main owns its store and flushes it on pagehide. Prepare the
  // independent saved fixture only after leaving that owner, not beside it.
  await page.route('**/library-setup.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><body>Fixture setup</body>' }))
  await page.goto('/library-setup.html')
  await page.evaluate(async ({ owner, source }) => {
    const path = '/src/client-experience-store.ts'
    const { createClientExperienceStore } = await import(/* @vite-ignore */ path)
    const store = createClientExperienceStore()
    store.copySharedStrategy(owner, { nick: source.nick, budgetIndex: 1, sl: source.parameters.sl, tp: source.parameters.tp })
    const record = store.getSnapshot().sharedFollows[0]
    const key = `teth:client-delegation:${record.sessionId}`
    const ui = JSON.parse(sessionStorage.getItem(key)!)
    ui.workStartedAt = Date.now() + 120_000
    sessionStorage.setItem(key, JSON.stringify(ui))
  }, { owner, source })
  await page.goto('/#/share/library')
  const follow = page.locator('.client-shared-follow-list')
  await expect(follow.locator('[data-follow-id]')).toHaveCount(1)
  const original = await page.evaluate(() => sessionStorage.getItem('teth-client-experience'))
  const heading = page.getByRole('heading', { name: '복제 검증', level: 2, exact: true })
  await expect(heading).toHaveCount(1)
  await expect(follow).toHaveAccessibleName('복제 검증')
  await expect(heading).toHaveCSS('font-size', '20px')
  await expect(page.locator('.cpd-heading').filter({ hasText: '복제 검증' })).toHaveCount(0)
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await page.evaluate(async language => {
      const path = '/src/client-preferences.ts'
      const { setClientPreference } = await import(/* @vite-ignore */ path)
      setClientPreference('language', language)
    }, language)
    await expect(follow).toHaveAccessibleName(copySummaryText(language, '복제 검증'))
    await expect(follow.getByRole('heading', { level: 2 })).toHaveText(copySummaryText(language, '복제 검증'))
    expect(await follow.evaluate(e => e.scrollWidth <= e.clientWidth + 1)).toBe(true)
  }
  expect(await page.evaluate(() => sessionStorage.getItem('teth-client-experience'))).toBe(original)
  await follow.locator('.client-library-heading').scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath(`follow-heading-${withCopy}.png`) })
})

test('마지막 카피를 종료하면 새 h2 제목으로 초점이 돌아오며 종료 원장을 보존한다', async ({ page }) => {
  await openLibrary(page, [], true)
  const close = page.locator('.cpd-card').getByRole('button', { name: '카피 종료', exact: true })
  await close.click()
  await page.getByRole('dialog').getByRole('button', { name: '계속 카피', exact: true }).click()
  await expect(close).toBeFocused()
  await close.click()
  await page.getByRole('dialog').getByRole('button', { name: '종료하고 정산', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('.cpd-card')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '실시간 카피', level: 2 })).toBeFocused()
  const key = copyPreviewStorageKey(owner)
  const raw = await page.evaluate(key => sessionStorage.getItem(key), key)
  expect(JSON.parse(raw!).copies[0].status).toBe('closed')
  await page.getByRole('button', { name: '종료 기록 보기', exact: true }).click()
  await expect(page.locator('.cpd-card')).toHaveCount(1)
  expect(await page.evaluate(key => sessionStorage.getItem(key), key)).toBe(raw)
})

test('내부 서비스는 기존 제목 계층과 미공급 상태를 유지한다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => localStorage.setItem('tethLang', 'ko'))
  await page.goto('/')
  await page.evaluate(async () => {
    const path = '/tests/fixtures/sharing-service-harness.tsx'
    const { mountSharing } = await import(/* @vite-ignore */ path)
    mountSharing(false)
  })
  const root = page.locator('#sharing-test-root')
  await root.getByRole('button', { name: '따라가는 중', exact: true }).click()
  await expect(root.locator('.cpd-heading').getByRole('heading', { name: '실시간 카피', level: 3 })).toBeVisible()
  await expect(root.locator('.client-shared-follow-list [role="status"]')).toBeVisible()
  await expect(root.locator('.client-library-heading')).toHaveCount(0)
  await expect(root.locator('.client-shared-follow-list .ss3-empty')).toHaveCount(0)
})

for (const width of [320, 1440]) test(`${width}px 관리 화면을 스크롤해도 헤더와 고정 조작 영역을 본문이 침범하지 않는다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 740 })
  await openLibrary(page, [source.nick], true)
  const header = page.locator('.client-sharing-hub > .hub-header')
  await page.locator('.client-library-watches').scrollIntoViewIfNeeded()
  await expect(header).toHaveCSS('position', 'sticky')
  await info.attach('scroll-ancestors', { contentType: 'application/json', body: JSON.stringify(await header.evaluate(e => {
    const rows = []
    for (let node: HTMLElement | null = e as HTMLElement; node; node = node.parentElement) {
      const style = getComputedStyle(node), rect = node.getBoundingClientRect()
      rows.push({ class: node.className, overflowX: style.overflowX, overflowY: style.overflowY, position: style.position, top: rect.top, height: rect.height, client: node.clientHeight, scroll: node.scrollHeight, scrollTop: node.scrollTop })
    }
    return rows
  }), null, 2) })
  const h = await header.boundingBox()
  // Fixed source index.html:26088–26090 hides the public common utility.
  await expect(page.locator('.client-account-utility')).toHaveCount(0)
  expect(h!.y).toBeGreaterThanOrEqual(0)
  expect(h!.y).toBeLessThanOrEqual(1)
  expect(h!.height).toBeGreaterThanOrEqual(44)
  expect(await header.evaluate(e => getComputedStyle(e).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)')
  const back = header.getByRole('button', { name: 'AI 트레이딩', exact: true })
  await expect(back).toBeInViewport()
  await page.screenshot({ path: info.outputPath(`library-sticky-${width}.png`) })
  await back.click()
  await expect(page.locator('.client-account-terminal')).toBeVisible()
})
