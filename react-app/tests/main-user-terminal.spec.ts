import { expect, test, type Page } from '@playwright/test'
import { evaluateSourceTerminal } from '../src/client-terminal-source-fixture'
import { projectUserTerminal } from '../src/client-user-terminal'
import { delegationRecommendedParameters, evaluateDelegation } from '../src/client-delegation-engine'
import { accountTerminalText } from '../src/client-account-terminal-copy'
import { shellText } from '../src/client-shell-copy'

const parameters = delegationRecommendedParameters()
const verified = evaluateDelegation(parameters, 10000000)

const record = { id: '1000', createdAt: 1000, name: '내 이더리움 연구', status: 'ready' as const, environment: 'paper' as const,
  parameters, score: verified.score, ret: verified.result.ret, mdd: verified.result.mdd, n: verified.result.n, winRate: verified.result.winRate,
  asset: '이더리움', exchangeId: 'okx', exchangeName: 'OKX', chartSymbol: 'BINANCE:ETHUSDT', capital: 10000000, version: 'v1.0' }

async function seed(page: Page, patch: object = {}) {
  await page.addInitScript(value => {
    if (!sessionStorage.getItem('teth-client-profile-preview')) sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '터미널 검수', email: 'terminal@example.test' }))
    if (!sessionStorage.getItem('teth-client-user-strategies:terminal%40example.test')) sessionStorage.setItem('teth-client-user-strategies:terminal%40example.test', JSON.stringify([{ sessionId: 'registered', record: value }]))
    localStorage.setItem('tethCurrency', 'KRW')
  }, { ...record, ...patch })
  await page.goto('/#/trade')
  await expect(page.locator('.client-account-terminal')).toHaveAttribute('data-selected-strategy', 'user:1000')
}
async function panel(page: Page, name: '전략' | '차트' | 'Agent') {
  // The app sidebar changes available width independently of the viewport.
  // Wait for ResizeObserver before choosing the visible navigation variant.
  await expect.poll(() => page.locator('.ctt-terminal').evaluate(node =>
    (node.getAttribute('data-mobile') === 'true') === (node.getBoundingClientRect().width <= 960),
  )).toBe(true)
  const tabs = page.getByRole('tablist', { name: '터미널 영역', exact: true })
  if (await tabs.isVisible()) await tabs.getByRole('tab', { name: name === 'Agent' || name === '전략' ? '판단' : name, exact: true }).click()
  if (name === '전략' && await page.locator('.ctt-selector-button').getAttribute('aria-expanded') !== 'true') await page.locator('.ctt-selector-button').click()
  if (name !== '전략' && await page.locator('.ctt-selector-button').getAttribute('aria-expanded') === 'true') await page.locator('.ctt-selector-button').click()
}

test('메인 거래 화면의7언어 연결은 같은 사용자 전략·검색·기록·경로를 보존한다', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await seed(page)
  await expect(page.locator('.cat-management-trigger')).toHaveCount(1)
  await panel(page, '전략')
  const search = page.locator('.tft-rf input'), root = page.locator('.client-account-terminal')
  await search.fill('내 이더리움')
  await search.press('ArrowLeft')
  const original = await root.elementHandle(), input = await search.elementHandle()
  const cursor = await search.evaluate(node => (node as HTMLInputElement).selectionStart)
  const stored = await page.evaluate(() => sessionStorage.getItem('teth-client-user-strategies:terminal%40example.test'))
  for (const language of ['en', 'ja', 'zh-CN', 'zh-TW', 'es', 'ko', 'fr'] as const) {
    await page.evaluate(async language => {
      const path = '/src/client-preferences.ts'
      const { setClientPreference } = await import(/* @vite-ignore */ path)
      setClientPreference('language', language)
    }, language)
    await expect(page).toHaveURL(/#\/trade$/)
    await expect(page.locator('.cat-heading h1')).toHaveText(shellText(language, 'trading'))
    await expect(page.locator('.tft-rh b')).toHaveText(accountTerminalText(language, 'strategies'))
    await expect(search).toHaveAccessibleName(accountTerminalText(language, 'search'))
    await expect(search).toHaveValue('내 이더리움')
    await expect(search).toBeFocused()
    await expect(root).toHaveAttribute('data-selected-strategy', 'user:1000')
    await expect(page.locator('.tft-card')).toHaveCount(1)
    await expect(page.locator('.tft-card .nm')).toHaveText('내 이더리움 연구')
    expect(await search.evaluate(node => (node as HTMLInputElement).selectionStart)).toBe(cursor)
    expect(await search.evaluate((node, previous) => node === previous, input)).toBe(true)
    expect(await root.evaluate((node, previous) => node === previous, original)).toBe(true)
    expect(await page.evaluate(() => sessionStorage.getItem('teth-client-user-strategies:terminal%40example.test'))).toBe(stored)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  }
  expect(errors).toEqual([])
  await original?.dispose(); await input?.dispose()
})

test('사용자 전략은 자체 snapshot으로 투영되고 설정/금액 누락은 기본 예시로 채우지 않는다', () => {
  const projected = projectUserTerminal(record)!
  expect(projected.id).toBe('user:1000')
  expect(projected.model!.seed).toMatchObject({ asset: '이더리움', capital: 10000000, exchangeId: 'okx', symbol: '이더리움/KRW', parameters: record.parameters })
  expect(projected.model!.result).toEqual(evaluateSourceTerminal(record.parameters, record.capital))
  for (const patch of [{ parameters: null }, { capital: undefined }, { asset: undefined }, { parameters: { ...record.parameters, endI: 999999 } }]) expect(projectUserTerminal({ ...record, ...patch })?.model).toBeNull()
  expect(projectUserTerminal({ ...record, capital: 0 })!.model!.result.nav).toBe(0)
  expect(projectUserTerminal({ ...record, capital: -1 })).toBeNull()
})

test('등록 전략만 표시되고 터미널 제어가 같은 계정 상세·복구에 반영된다', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message))
  await seed(page)
  await panel(page, '전략')
  const row = page.locator('[data-strategy-id="user:1000"]')
  await expect(page.locator('[data-strategy-id^="demo:"]')).toHaveCount(0)
  await expect(page.locator('.tft-list > li').first()).toHaveAttribute('data-strategy-id', 'user:1000')
  await expect(row).toContainText('$7,194.24')
  await expect(row).toContainText('이더리움/KRW')
  await panel(page, '차트')
  await expect(page.locator('.cat-evaluation')).toHaveCount(0)
  await page.locator('.cst-context-actions').getByRole('button', { name: '지금 시작', exact: true }).click()
  await expect(page.locator('.cat-context .cat-status')).toHaveText('실행 중')
  await expect(page.locator('.cat-evaluation')).toHaveCount(0)
  await page.locator('.cst-context-actions').getByRole('button', { name: '중지', exact: true }).click()
  await expect(page.locator('.cat-context .cat-status')).toHaveText('중지')
  await page.reload()
  await expect(page.locator('.client-account-terminal')).toHaveAttribute('data-selected-strategy', 'user:1000')
  await panel(page, 'Agent')
  await page.getByRole('button', { name: '전략 상세', exact: true }).click()
  await expect(page).toHaveURL(/#\/trade\/bot\/1000$/)
  await expect(page.locator('.nfxb-st')).toHaveText('중지됨')
  expect(errors).toEqual([])
})

test('과거 parameters 없는 기록도 목록에 남고 임의 가격/판단/손익은 생기지 않는다', async ({ page }) => {
  await seed(page, { parameters: null })
  await panel(page, '전략')
  const row = page.locator('[data-strategy-id="user:1000"]')
  await expect(row).toContainText('내 이더리움 연구')
  await expect(row.locator('.pnl')).toHaveCount(0)
  await panel(page, '차트')
  await expect(page.locator('.cp-empty')).toBeVisible()
  await expect(page.locator('.cst-close-chart')).toHaveCount(0)
  await panel(page, 'Agent')
  await expect(page.getByText('Agent 판단 기록을 확인하지 못했습니다.', { exact: true })).toBeVisible()
  await expect(page.locator('.cst-composer')).toHaveCount(0)
  await expect(page.locator('.client-strategy-proposal')).toHaveCount(0)
  await page.getByRole('tablist', { name: '전략 분석' }).getByRole('tab', { name: '대시보드', exact: true }).click()
  await expect(page.getByText('저장된 검증 결과', { exact: true })).toBeVisible()
})

test('메인 사용자 긴 이름에서도 미공급 평가 없이 상태·조작이 화면에 남는다', async ({ page }) => {
  await seed(page, { name: '사용자 장기 추세와 위험 관리 전략 '.repeat(10) })
  for (const width of [320, 960, 961, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 }); await panel(page, '차트')
    const row = page.locator('.cat-context-row')
    await expect(row.locator('.cat-evaluation')).toHaveCount(0)
    await expect(row.getByRole('button', { name: '지금 시작', exact: true })).toBeVisible()
    const g = await row.evaluate(element => {
      const status = element.querySelector('.cat-status')!.getBoundingClientRect(), button = element.querySelector('button')!.getBoundingClientRect(), box = element.getBoundingClientRect()
      return { overflow: element.scrollWidth - element.clientWidth, statusRight: status.right, buttonRight: button.right, right: box.right,
        overlap: status.left < button.right && status.right > button.left && status.top < button.bottom && status.bottom > button.top }
    })
    expect(g.overflow).toBeLessThanOrEqual(1); expect(g.statusRight).toBeLessThanOrEqual(g.right + 1); expect(g.buttonRight).toBeLessThanOrEqual(g.right + 1)
    expect(g.overlap).toBe(false)
  }
})

test('계정 전환 복구에서 사용자 목록과 선택은 다른 계정으로 새지 않는다', async ({ page }) => {
  await seed(page)
  await page.evaluate(() => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '다른 계정', email: 'other@example.test' })))
  await page.reload()
  await expect(page.locator('.txh')).toBeVisible()
  await expect(page.locator('.client-account-terminal')).toHaveCount(0)
  await expect(page.locator('[data-strategy-id="user:1000"]')).toHaveCount(0)
})

test('등록 전략 질문의 언어·통화 전환은 초안·입력 DOM·원본 기록을 보존한다', async ({ page }) => {
  await seed(page)
  await panel(page, 'Agent')
  const input = page.locator('.cst-composer input')
  await input.fill('이더리움 손절 조건을 더 살펴볼게요')
  await input.press('ArrowLeft')
  const node = await input.elementHandle()
  const cursor = await input.evaluate(element => (element as HTMLInputElement).selectionStart)
  const before = await page.evaluate(() => sessionStorage.getItem('teth-client-user-strategies:terminal%40example.test'))
  for (const [language, currency] of [['en','USD'],['ja','JPY'],['zh-CN','USDT'],['zh-TW','USDC'],['es','EUR'],['fr','BTC'],['ko','KRW']]) {
    await page.evaluate(async ({language,currency}) => {
      const path = '/src/client-preferences.ts'
      const {setClientPreference} = await import(/* @vite-ignore */ path)
      setClientPreference('language',language)
      setClientPreference('currency',currency)
    }, {language,currency})
    await expect(input).toHaveValue('이더리움 손절 조건을 더 살펴볼게요')
    await expect(input).toBeFocused()
    expect(await input.evaluate((element,previous) => element === previous,node)).toBe(true)
    expect(await input.evaluate(element => (element as HTMLInputElement).selectionStart)).toBe(cursor)
    expect(await page.evaluate(() => sessionStorage.getItem('teth-client-user-strategies:terminal%40example.test'))).toBe(before)
  }
  await node?.dispose()
})
