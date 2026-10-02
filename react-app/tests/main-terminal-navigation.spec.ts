import { revealSourceNavigation } from './fixtures/source-offline-research-entry'
import { expect, test, type Page } from '@playwright/test'
import { evaluateDelegation } from '../src/client-delegation-engine'

const owner = 'terminal@example.test'
const parameters = { sl: -5, tp: 12, rsiTh: 44, trendFilter: true, startI: 61, endI: 1334 }
const calculation = evaluateDelegation(parameters, 5000000)
const registrationKey = `teth-client-user-strategies:${encodeURIComponent(owner)}`
const records = ['BTC', 'ETH'].map((asset, index) => ({ sessionId: `terminal-fixture-${index}`, record: {
  id: String(1000 + index), createdAt: 1000 + index, name: `${asset} 등록 전략`, parameters,
  score: calculation.score, ret: calculation.result.ret, mdd: calculation.result.mdd, n: calculation.result.n, winRate: calculation.result.winRate,
  status: 'off', environment: 'paper', asset, exchangeId: 'okx', exchangeName: 'OKX', capital: 5000000, version: 'v3.7',
} }))

test.beforeEach(({ page }) => { page.setDefaultTimeout(15_000) })

async function sidebar(page: Page) {
  await revealSourceNavigation(page)
  await page.locator((page.viewportSize()?.width ?? 0) <= 860 ? '.client-hamburger' : '.client-rail-logo-row button').click()
}
async function navigate(page: Page, name: string) {
  await sidebar(page)
  if (name === '인사이트') {
    await page.locator('.client-sidebar [data-sidebar-action="profile-settings"], .client-sidebar [data-sidebar-action="settings"]').filter({ visible: true }).first().click()
    await page.locator('.ca-settings [data-menu-action="insight"]').click()
  } else {
    const label = name === '내 트레이딩' ? 'AI 트레이딩' : name
    await page.locator('.client-sidebar').getByRole('button', { name: label, exact: true }).click()
  }
}
async function signedIn(page: Page, registered = true) {
  await page.addInitScript(({ owner, registrationKey, records, registered }) => {
    if (sessionStorage.getItem('terminal-navigation-seeded')) return
    sessionStorage.setItem('terminal-navigation-seeded', 'true')
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '터미널 검수', email: owner }))
    if (registered) sessionStorage.setItem(registrationKey, JSON.stringify(records))
  }, { owner, registrationKey, records, registered })
}
async function panel(page: Page, name: string) {
  const tabs = page.getByRole('tablist', { name: '터미널 영역', exact: true })
  if (await tabs.isVisible()) await tabs.getByRole('tab', { name: name === 'Agent' || name === '전략' ? '판단' : name, exact: true }).click()
  const selector = page.locator('.ctt-selector-button')
  if ((await selector.getAttribute('aria-expanded') === 'true') !== (name === '전략')) await selector.click()
}
async function askTerminal(page: Page, question: string) {
  await panel(page, 'Agent')
  await page.getByRole('textbox', { name: '전략 Agent에게 질문' }).fill(question)
  await page.getByRole('button', { name: 'Agent에게 보내기', exact: true }).click()
}
async function healthy(page: Page) {
  await expect(page.locator('#root')).not.toHaveAttribute('inert')
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest('[hidden],[inert]')))).toBe(false)
}

test('게스트 내 트레이딩은 소개와 명시 시작을 거치고 홈 초안을 전송하지 않는다', async ({ page }) => {
  const requests: string[] = []
  page.on('request', request => requests.push(request.url()))
  await page.goto('/')
  await page.locator('#strategy-idea').fill('자동 전송하면 안 되는 홈 초안')
  // The shared calculation engine now also serves delegation validation.
  // The terminal UI and chart library must still remain lazy before entry.
  expect(requests.some(url => /ClientSourceTerminalWorkspace|lightweight-charts/.test(url))).toBe(false)
  await navigate(page, '내 트레이딩')
  await expect(page).toHaveURL(/#\/trade$/)
  await expect(page.locator('.txh')).toBeVisible()
  await expect(page.locator('.ca-auth')).toHaveCount(0)
  await expect(page.locator('.client-account-terminal')).toHaveCount(0)
  expect(requests.some(url => /ClientSourceTerminalWorkspace|lightweight-charts/.test(url))).toBe(false)
  await page.locator('.txh-hero .txh-cta').click()
  await expect(page.getByTestId('connection-plan')).toBeVisible()
  await page.getByTestId('connection-plan').getByRole('button', { name: '무료로 시작하기', exact: true }).click()
  await expect(page.locator('.ca-auth')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.ca-auth')).toHaveCount(0)
  await page.goBack()
  await expect(page.locator('.txh')).toBeVisible()
  await expect(page.locator('.g-urow')).toHaveCount(0)
  expect(requests.some(url => /ClientSourceTerminalWorkspace/.test(url))).toBe(false)
  await sidebar(page)
  await expect(page.locator('.client-sidebar [aria-current]')).toHaveCount(1)
  await expect(page.locator('.client-sidebar').getByRole('button', { name: 'AI 트레이딩', exact: true })).toHaveAttribute('aria-current', 'page')
  await page.keyboard.press('Escape')
  await page.goBack()
  await expect(page.locator('#strategy-idea')).toHaveValue('자동 전송하면 안 되는 홈 초안')
  await expect(page.locator('.client-main-terminal')).toHaveCount(0)
  await healthy(page)
})

test('등록 전략의 원본 비교·질문을 복원하되 승인 없는 적용은 활성화하지 않는다', async ({ page }, info) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await signedIn(page)
  await page.goto('/#/trade')
  for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 640 }, { width: 320, height: 480 }]) {
    await page.setViewportSize(viewport)
    for (const expanded of [false, true]) {
      if (expanded) await page.getByRole('button', { name: '터미널 전체화면', exact: true }).click()
      await panel(page, 'Agent')
      const before = await page.evaluate(key => sessionStorage.getItem(key), registrationKey)
      await askTerminal(page, '손절 -3%로 바꿔줘')
      await expect(page.locator('.client-strategy-proposal .ap')).toBeDisabled()
      const input = page.getByRole('textbox', { name: '전략 Agent에게 질문' })
      await expect(input, `${viewport.width}×${viewport.height}, expanded=${expanded}`).toBeInViewport({ ratio: .95 })
      await page.screenshot({ path: `/tmp/teth-main-proposal-layout/${info.project.name}-${viewport.width}-${expanded ? 'expanded' : 'inline'}.png` })
      const cancel = page.locator('.client-strategy-proposal').getByRole('button', { name: '취소', exact: true })
      await cancel.click()
      await expect(input).toBeFocused()
      expect(await page.evaluate(key => sessionStorage.getItem(key), registrationKey)).toBe(before)
      if (expanded) await page.getByRole('button', { name: '터미널 닫기', exact: true }).click()
    }
  }
  expect(errors).toEqual([])
})

test('실제 메인 거래 추적은 전체화면 안에서 닫히고 다른 경로에는 남지 않는다', async ({ page }, info) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await signedIn(page)
  await page.goto('/#/trade')
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 800 })
    await page.getByRole('button', { name: '터미널 전체화면', exact: true }).click()
    await panel(page, 'Agent')
    await page.getByRole('tablist', { name: '전략 분석' }).getByRole('tab', { name: '완료된 거래', exact: true }).click()
    const trigger = page.getByRole('button', { name: '전체 판단 기록 →', exact: true }).first()
    await trigger.click()
    const detail = page.getByRole('dialog', { name: /LONG 거래 추적/ })
    await expect(detail.getByRole('listitem')).toHaveCount(7)
    await expect.poll(() => detail.evaluate(element => {
      const rect = element.getBoundingClientRect()
      return rect.bottom <= innerHeight + 1 && rect.top >= -1
    }), { message: `${width}px 거래 추적창은 화면 안에 있어야 합니다` }).toBe(true)
    const finalStep = detail.getByRole('listitem').last()
    await finalStep.scrollIntoViewIfNeeded()
    await expect(finalStep).toBeInViewport({ ratio: .95 })
    await detail.getByRole('button', { name: '닫기', exact: true }).scrollIntoViewIfNeeded()
    await page.screenshot({ path: `/tmp/teth-main-ledger-layout/${info.project.name}-${width}-lifecycle.png` })
    expect(await detail.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
    await page.keyboard.press('Escape')
    await expect(detail).toHaveCount(0)
    await expect(page.locator('.ctt-modal[open]')).toHaveCount(1)
    await expect(trigger).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(page.locator('.ctt-modal[open]')).toHaveCount(0)
    await healthy(page)
  }
  await panel(page, 'Agent')
  await page.getByRole('button', { name: '전체 판단 기록 →', exact: true }).first().click()
  await page.evaluate(() => { window.location.hash = '/research' })
  await expect(page.getByRole('dialog', { name: /LONG 거래 추적/ })).toHaveCount(0)
  await expect(page.locator('.client-main-terminal')).toBeHidden()
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('')
  await healthy(page)
  expect(errors).toEqual([])
})

test('게스트 소개·플랜·명시 가입의 취소와 뒤로·앞으로 이동은 inert를 복구한다', async ({ page }) => {
  await page.goto('/#/trade')
  await expect(page.locator('.txh')).toBeVisible()
  await page.locator('.txh-hero .txh-cta').click()
  const choice = page.getByTestId('connection-plan').getByRole('button', { name: '무료로 시작하기', exact: true })
  await choice.click()
  await expect(page.locator('.ca-auth')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page).toHaveURL(/#\/connect\/plan/)
  await expect(page.locator('.ca-auth')).toHaveCount(0)
  await healthy(page)
  await page.goBack()
  await expect(page.locator('.txh')).toBeVisible()
  await expect(page.locator('.ca-auth')).toHaveCount(0)
  await page.goForward()
  await expect(choice).toBeVisible()
  await expect(page.locator('.ca-auth')).toHaveCount(0)
  await expect(page.locator('.client-account-terminal')).toHaveCount(0)
  await healthy(page)
})

test('터미널 선택·필터·Agent 초안은 홈과 연구 기록 및 인사이트 왕복에도 동일 DOM에 남는다', async ({ page }) => {
  await signedIn(page)
  await page.goto('/#/trade')
  await expect(page.locator('.client-account-terminal')).toBeVisible()
  await panel(page, '전략')
  const selected = page.locator('.tft-select').nth(1)
  await selected.click()
  const selectedId = await page.locator('.client-account-terminal').getAttribute('data-selected-strategy')
  await panel(page, '전략')
  await page.getByRole('searchbox', { name: '전략 검색' }).fill(' ETH ')
  await panel(page, 'Agent')
  await page.getByRole('textbox', { name: '전략 Agent에게 질문' }).fill('아직 보내지 않은 terminal 초안')
  await page.locator('.client-account-terminal').evaluate(element => element.setAttribute('data-mount-proof', 'retained'))
  await navigate(page, '연구 기록')
  await expect(page.locator('.client-main-terminal')).toBeHidden()
  await expect(page.getByRole('textbox', { name: '전략 Agent에게 질문' })).toHaveCount(0)
  await healthy(page)
  await navigate(page, '내 트레이딩')
  await expect(page.locator('.client-account-terminal')).toHaveAttribute('data-mount-proof', 'retained')
  await expect(page.locator('.client-account-terminal')).toHaveAttribute('data-selected-strategy', selectedId!)
  await panel(page, 'Agent')
  await expect(page.getByRole('textbox', { name: '전략 Agent에게 질문' })).toHaveValue('아직 보내지 않은 terminal 초안')
  await panel(page, '전략')
  await expect(page.getByRole('searchbox', { name: '전략 검색' })).toHaveValue(' ETH ')
  await navigate(page, '인사이트')
  await expect(page).toHaveURL(/#\/insight$/)
  await expect(page.locator('.nfz-open')).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL(/#\/trade$/)
  await expect(page.locator('.client-account-terminal')).toBeVisible()
  await page.goForward()
  await expect(page.locator('.nfz-open')).toBeVisible()
  await navigate(page, '내 트레이딩')
  await sidebar(page)
  await page.locator('.client-new-strategy').click()
  await expect(page.locator('#strategy-idea')).toBeVisible()
  await navigate(page, '내 트레이딩')
  await expect(page.locator('.client-account-terminal')).toHaveAttribute('data-mount-proof', 'retained')
  await healthy(page)
})

test('기존 대화와 트레이딩은 단일 active를 유지하고 Agent 분석은 대화로 연결된다', async ({ page }) => {
  await signedIn(page)
  await page.goto('/')
  await page.locator('#strategy-idea').fill('보존할 대화')
  await page.getByRole('button', { name: '대화 시작', exact: true }).click()
  await expect(page.locator('.g-composer textarea')).toBeVisible()
  await page.locator('.g-composer textarea').fill('기존 대화 초안')
  await navigate(page, '내 트레이딩')
  await expect(page.locator('.client-account-terminal')).toBeVisible()
  await sidebar(page)
  await expect(page.locator('.client-sidebar [aria-current]')).toHaveCount(1)
  await expect(page.locator('.client-session[aria-current]')).toHaveCount(0)
  await page.locator('.client-session').first().click()
  await expect(page).not.toHaveURL(/#\/trade$/)
  await expect(page.locator('.g-composer textarea')).toHaveValue('기존 대화 초안')
  await expect(page.locator('.client-main-terminal')).toBeHidden()
  await expect(page.getByRole('textbox', { name: '전략 Agent에게 질문' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '응답 중지', exact: true })).toHaveCount(0, { timeout: 20_000 })
  await navigate(page, '내 트레이딩')
  await expect(page.locator('.client-account-terminal')).toHaveAttribute('data-selected-strategy', 'user:1001')
  await panel(page, '전략')
  await page.locator('.tft-select').filter({ hasText: records[0].record.name }).click()
  await expect(page.locator('.client-account-terminal')).toHaveAttribute('data-selected-strategy', 'user:1000')
  await panel(page, 'Agent')
  await askTerminal(page, '손절 기준 설명')
  await page.getByRole('button', { name: '채팅에서 깊게 분석 →', exact: true }).click()
  await expect(page).not.toHaveURL(/#\/trade$/)
  await expect(page.locator('.g-urow').last()).toHaveText(`${records[0].record.name} 전략(BTC/KRW, 검증 수익 ${calculation.result.ret.toFixed(1)}%, MDD ${calculation.result.mdd.toFixed(1)}%)에 대해 더 깊게 분석해줘`)
  await expect(page.locator('.g-urow').last()).not.toContainText('BTC 돌파 추종')
  await healthy(page)
})

for (const failure of ['watch', 'storage'] as const) test(`터미널 깊게 분석 ${failure} 거절은 원인별 안내와 기존 화면·원장을 보존한다`, async ({ page }) => {
  await signedIn(page)
  await page.goto('/#/trade')
  await expect(page.locator('.client-account-terminal')).toBeVisible()
  await panel(page, 'Agent')
  await askTerminal(page, '손절 기준 설명')
  await expect(page.getByRole('button', { name: '채팅에서 깊게 분석 →', exact: true })).toBeVisible()
  const before = await page.evaluate(async failure => {
    if (failure === 'watch') {
      const path = '/src/client-billing-preview-store.ts'
      const { createBillingPreviewStore } = await import(/* @vite-ignore */ path)
      createBillingPreviewStore('terminal@example.test').dispatch({ kind: 'qa-watch' }, Date.now(), 'terminal-entry-watch')
      window.dispatchEvent(new Event('pageshow'))
    } else {
      const original = Storage.prototype.setItem
      Storage.prototype.setItem = function (key, value) {
        if (key === 'teth-client-experience') throw new Error('PRIVATE_STORAGE_DIAGNOSTIC')
        return original.call(this, key, value)
      }
    }
    return sessionStorage.getItem('teth-client-experience')
  }, failure)
  await page.getByRole('button', { name: '채팅에서 깊게 분석 →', exact: true }).click()
  await expect(page.locator('.client-global-notice').filter({ hasText: failure === 'watch' ? '크레딧이 소진되어 AI 기능이 잠시 멈춰 있어요' : '새 대화를 저장하지 못했어요. 작성한 내용은 유지됩니다. 다시 시도해주세요.' })).toBeVisible()
  await expect(page).toHaveURL(/#\/trade$/)
  expect(await page.evaluate(() => sessionStorage.getItem('teth-client-experience'))).toBe(before)
  await expect(page.locator('.client-account-terminal')).toBeVisible()
  await expect(page.locator('body')).not.toContainText('PRIVATE_STORAGE_DIAGNOSTIC')
})

test('터미널 메뉴와 전체화면은 해시 이탈 시 닫히고 숨겨진 화면으로 포커스를 보내지 않는다', async ({ page }) => {
  await signedIn(page)
  await page.goto('/#/trade')
  await expect(page.locator('.client-account-terminal')).toBeVisible()
  await page.locator('.skip-link').focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/#\/trade$/)
  await expect(page.locator('#tesia-main')).toBeFocused()
  await panel(page, '전략')
  await page.locator('.tft-card .mn').first().click()
  await expect(page.locator('.csa-menu')).toBeVisible()
  await page.evaluate(() => { location.hash = '#/insight' })
  await expect(page.locator('.csa-menu')).toHaveCount(0)
  await expect(page.locator('.nfz-open')).toBeVisible()
  await page.goBack()
  await page.getByRole('button', { name: '터미널 전체화면', exact: true }).click()
  await expect(page.locator('.ctt-modal')).toBeVisible()
  await page.evaluate(() => { location.hash = '#/insight' })
  await expect(page.locator('.ctt-modal')).not.toBeVisible()
  await expect(page.locator('.client-main-terminal')).toHaveAttribute('inert')
  await healthy(page)
})

test('모바일 햄버거와 종목은 320·390·768px에서 같은 헤더 안에 겹치지 않는다', async ({ page }) => {
  await signedIn(page, false)
  // Empty signed-in accounts now enter the source onboarding, not a sample
  // terminal. Supply one explicit preview copy before asserting this header.
  await page.goto('/')
  await page.evaluate(async () => {
    const { createCatalogueCopyAccountController } = await import('/src/client-catalogue-copy-account.ts')
    const { catalogueCopyMinimum } = await import('/src/client-catalogue-copy-setup.ts')
    const { findCatalogueStrategy } = await import('/src/client-catalogue.ts')
    const controller = createCatalogueCopyAccountController('terminal@example.test')
    try {
      const result = await controller.start({ id: 'd1', strategyId: 'd1', at: Date.UTC(2026, 8, 1), settings: { amount: catalogueCopyMinimum(findCatalogueStrategy('d1')!), loss: -20, existing: 'copy', cap: 95 } })
      if (!result.ok) throw Error(result.error)
    } finally { controller.dispose() }
  })
  await page.goto('/#/trade')
  await expect(page.locator('.client-account-terminal')).toBeVisible()
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 900 })
    const hamburger = await page.locator('.client-hamburger').boundingBox()
    const heading = await page.locator('.ctm-symbol').boundingBox()
    expect(hamburger).not.toBeNull()
    expect(heading).not.toBeNull()
    expect(heading!.x).toBeGreaterThanOrEqual(hamburger!.x + hamburger!.width + 4)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await sidebar(page)
    await expect(page.locator('.client-sidebar').getByRole('button', { name: 'AI 트레이딩', exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
  }
})

test('로그아웃은 터미널을 해제하고 다음 계정에 이전 선택·필터·초안을 넘기지 않는다', async ({ page }) => {
  await signedIn(page)
  await page.goto('/#/trade')
  await expect(page.locator('.client-account-terminal')).toBeVisible()
  await panel(page, '전략')
  await page.locator('.tft-select').nth(1).click()
  await panel(page, '전략')
  await page.getByRole('searchbox', { name: '전략 검색' }).fill(' ETH ')
  await panel(page, 'Agent')
  await page.getByRole('textbox', { name: '전략 Agent에게 질문' }).fill('이전 계정의 비공개 초안')
  await page.locator('.client-account-terminal').evaluate(element => element.setAttribute('data-mount-proof', 'old-account'))
  await sidebar(page)
  await page.locator('.client-sidebar [data-sidebar-action="profile-settings"]').click()
  await page.locator('.ca-settings').getByRole('button', { name: '로그아웃', exact: true }).click()
  await expect(page.locator('.client-main-terminal')).toHaveCount(0)
  await expect(page.locator('#strategy-idea')).toBeVisible()
  await navigate(page, '내 트레이딩')
  await expect(page.locator('.txh')).toBeVisible()
  await page.locator('.txh-hero .txh-cta').click()
  await page.getByTestId('connection-plan').getByRole('button', { name: '무료로 시작하기', exact: true }).click()
  await page.getByRole('button', { name: /Google/ }).click()
  await page.getByLabel('연령', { exact: true }).fill('28')
  await page.getByRole('button', { name: '시장에 입장하기', exact: true }).click()
  await navigate(page, '내 트레이딩')
  await expect(page.locator('.txh')).toBeVisible()
  await expect(page.locator('.client-main-terminal')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('이전 계정의 비공개 초안')
  // Restore the original fixture account in a fresh document; UI drafts and
  // filters are not persisted, while that owner's registered records are.
  await page.evaluate(({ owner }) => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '터미널 검수', email: owner })), { owner })
  await page.reload()
  await expect(page.locator('.client-account-terminal')).toBeVisible()
  await expect(page.locator('.client-account-terminal')).not.toHaveAttribute('data-mount-proof')
  await expect(page.locator('.client-account-terminal')).toHaveAttribute('data-selected-strategy', 'user:1001')
  await panel(page, '전략')
  await expect(page.getByRole('searchbox', { name: '전략 검색' })).toHaveValue('')
  await panel(page, 'Agent')
  await expect(page.getByRole('textbox', { name: '전략 Agent에게 질문' })).toHaveValue('')
  await healthy(page)
})
