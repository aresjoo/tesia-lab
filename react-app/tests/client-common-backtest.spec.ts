import { expect, test, type Page } from '@playwright/test'
import { COMMON_REPLAY_MS, commonBacktestInput, commonPreviewProgress, commonPreviewResult, readCommonBacktest } from '../src/client-common-backtest-preview'
import { commonBacktestText } from '../src/client-common-backtest-copy'
import type { ClientLanguage } from '../src/client-preferences'
import type { ClientSession } from '../src/client-experience-store'
import { commonDecisionRows, commonHoldingGroups, selectCommonDecisions } from '../src/client-common-decisions'
import { commonMonths, commonYears } from '../src/client-common-months'
import { evaluateSourceTerminal, sourceTerminalPrices, sourceTerminalRsi } from '../src/client-terminal-source-fixture'
import { installCommonResponseFixture, publishCommonResponseFixture } from './fixtures/client-common-response-fixture'

const browserErrors = new WeakMap<Page, string[]>()
test.beforeEach(({ page }) => {
  const errors: string[] = []
  browserErrors.set(page, errors)
  page.on('pageerror', error => errors.push(error.message))
})
test.afterEach(({ page }) => { expect(browserErrors.get(page)).toEqual([]) })

async function readyRoute(page: Page) {
  // React's lazy boundary schedules a commit after the dynamic module resolves.
  // A frozen clock must keep advancing across that asynchronous resolution.
  await expect.poll(async () => { await page.clock.runFor(200); return page.getByTestId('common-backtest').count() }).toBe(1)
}

async function open(page: Page, language: ClientLanguage = 'ko') {
  await installCommonResponseFixture(page, 'common@example.test')
  await page.clock.install({ time: new Date('2026-09-30T12:00:00Z') })
  await page.addInitScript(language => {
    localStorage.setItem('tethLang', language)
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '백테스트 검수', email: 'common@example.test' }))
  }, language)
  await page.goto('/')
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000))
  await page.locator('#strategy-idea').fill('BTC 반등 일봉 손절 3%, 익절 8%')
  await page.locator('#strategy-idea').press('Enter')
  await page.clock.fastForward(20_000)
  await publishCommonResponseFixture(page)
  await expect(page.getByRole('button', { name: commonBacktestText(language, 'open'), exact: true })).toBeVisible()
}

test('대화 요약은 원 조건을 보여 주고 진입 후 이어서 보기로 접히며 복원된다', async ({ page }, info) => {
  await open(page)
  const card = page.getByTestId('common-strategy-summary')
  await expect(card.getByRole('heading', { name: '전략 계약서' })).toBeVisible()
  await expect(card).toContainText('BTC/USDT')
  await expect(card).toContainText('+8%')
  await expect(card).toContainText('-3%')
  await page.locator('.g-composer textarea').fill('작성 중인 초안')
  await card.getByRole('button', { name: '과거로 돌려 보기' }).click(); await readyRoute(page)
  await page.getByRole('button', { name: '최근 3개월', exact: true }).click()
  await page.getByRole('button', { name: '대화로 돌아가기' }).click()
  await expect(card.getByRole('button', { name: '이어서 보기' })).toBeVisible()
  await expect(card.getByRole('heading', { name: '전략 계약서' })).toHaveCount(0)
  await expect(page.locator('.g-composer textarea')).toHaveValue('작성 중인 초안')
  await page.reload()
  await card.getByRole('button', { name: '이어서 보기' }).click(); await readyRoute(page)
  await expect(page.getByRole('button', { name: '최근 3개월', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: '대화로 돌아가기' }).click()
  await page.screenshot({ path: info.outputPath('summary-resume.png') })
})

test('요약에서 다시 답해도 기존 초안과 턴 조건은 보존하고 새 카드에만 수정한다', async ({ page }) => {
  await open(page)
  const cards = page.getByTestId('common-strategy-summary'), composer = page.locator('.g-composer textarea')
  const old = await cards.first().locator('dl').textContent()
  await composer.fill('쓰고 있던 문장')
  await composer.evaluate(node => Reflect.set(window, 'summaryComposer', node))
  await cards.first().getByRole('button', { name: '다시 답하기' }).click()
  await expect(composer).toBeFocused(); await expect(composer).toHaveValue('쓰고 있던 문장')
  expect(await composer.evaluate(node => node === Reflect.get(window, 'summaryComposer'))).toBe(true)
  await page.clock.fastForward(20_000)
  await composer.fill('손절 -5%로'); await composer.press('Enter'); await page.clock.fastForward(20_000)
  await publishCommonResponseFixture(page, -5)
  await expect(cards).toHaveCount(2)
  await expect(cards.first().locator('dl')).toHaveText(old!)
  await expect(cards.last()).toContainText('-5%')
  await expect(cards.first().getByRole('button', { name: '다시 답하기' })).toHaveCount(0)
  for (const card of [cards.first(), cards.last()]) {
    await card.getByRole('button', { name: '과거로 돌려 보기' }).click(); await readyRoute(page)
    await page.getByRole('button', { name: '대화로 돌아가기' }).click()
  }
  await expect(page.getByRole('button', { name: '이어서 보기', exact: true })).toHaveCount(2)
  await page.reload()
  await expect(page.getByRole('button', { name: '이어서 보기', exact: true })).toHaveCount(2)
  await cards.first().getByRole('button', { name: '이어서 보기' }).click(); await readyRoute(page)
  await expect(page.locator('.cbt-rail')).toContainText('-3%')
})

for (const failure of ['throw', 'drop'] as const) test(`요약 진입 ${failure} 저장 실패는 방문 표시나 경로를 바꾸지 않는다`, async ({ page }) => {
  await open(page)
  await page.evaluate(failure => {
    const original = Storage.prototype.setItem
    Reflect.set(window, 'summarySet', original)
    Storage.prototype.setItem = function (key, value) {
      if (key === 'teth-client-experience') { if (failure === 'throw') throw new Error('test storage'); return }
      original.call(this, key, value)
    }
  }, failure)
  const card = page.getByTestId('common-strategy-summary')
  await card.getByRole('button', { name: '과거로 돌려 보기' }).click()
  await expect(card.getByRole('heading', { name: '전략 계약서' })).toBeVisible()
  expect(await page.evaluate(() => location.hash)).not.toContain('/share/bt/mine')
  const state = await page.evaluate(() => JSON.parse(sessionStorage.getItem('teth-client-experience')!))
  expect(state.sessions.find((session: ClientSession) => session.id === state.currentId).turns.at(-1).commonBacktestOpened).toBeUndefined()
  await page.evaluate(() => { Storage.prototype.setItem = Reflect.get(window, 'summarySet') })
  await card.getByRole('button', { name: '과거로 돌려 보기' }).click(); await readyRoute(page)
})

test('손상된 방문 표시는 격리하고 조건과 원문을 보존한다', async ({ page }) => {
  await open(page)
  const result = await page.evaluate(async () => {
    const key = 'teth-client-experience'
    const original = sessionStorage.getItem(key)!
    const path = '/src/client-experience-store.ts'
    const { createClientExperienceStore } = await import(/* @vite-ignore */ path)
    const rows = []
    for (const flag of [false, 'true', 1, true]) {
      const saved = JSON.parse(original), turn = saved.sessions.find((s: ClientSession) => s.id === saved.currentId).turns.at(-1)
      turn.commonBacktestOpened = flag
      if (flag === true) {
        // This decoder case remains a historical local stopped turn. A valid
        // supplied done sequence deliberately restores its own done status.
        turn.status = 'stopped'
        delete turn.responseSequence
        delete turn.strategyObservedAt
      }
      sessionStorage.setItem(key, JSON.stringify(saved))
      const store = createClientExperienceStore(), snapshot = store.getSnapshot()
      const recovered = snapshot.sessions.find((s: ClientSession) => s.id === snapshot.currentId)!.turns.at(-1)!
      rows.push({ warning: snapshot.recoveryWarning, flag: recovered.commonBacktestOpened, same: recovered.question === turn.question && JSON.stringify(recovered.inlineRequest) === JSON.stringify(turn.inlineRequest) })
    }
    sessionStorage.setItem(key, original)
    return rows
  })
  for (const row of result) expect(row).toEqual({ warning: true, flag: undefined, same: true })
})
test('새 대화는 자동 점수 카드 대신 공통 백테스트 준비로 이어진다', async ({ page }) => {
  await open(page)
  await expect(page.locator('.client-inline-backtest')).toHaveCount(0)
  await page.getByRole('button', { name: '과거로 돌려 보기', exact: true }).click()
  await readyRoute(page)
  await expect(page).toHaveURL(/#\/share\/bt\/mine$/)
  const root = page.getByTestId('common-backtest')
  await expect(root).toHaveAttribute('data-phase', 'ready')
  await expect(root.getByRole('heading', { name: '돌려 볼 조건' })).toBeVisible()
  await root.getByRole('button', { name: '최근 3개월', exact: true }).click()
  await root.getByRole('button', { name: '최근 3개월', exact: true }).focus()
  await root.getByRole('button', { name: '$3,000', exact: true }).click()
  await expect(root.getByRole('button', { name: '최근 3개월' })).toHaveAttribute('aria-pressed', 'true')
  await root.getByRole('button', { name: '과거를 다시 돌려 보기' }).click()
  await expect(root).toHaveAttribute('data-phase', 'run')
  await page.clock.fastForward(15_000)
  await expect(root).toHaveAttribute('data-phase', 'run')
  await page.reload()
  await readyRoute(page)
  await expect(root).toHaveAttribute('data-phase', 'run')
  await page.clock.fastForward(COMMON_REPLAY_MS)
  await expect(root).toHaveAttribute('data-phase', 'result')
  await expect(root.getByRole('heading', { name: '거래 내역' })).toBeVisible()
  await expect(root.getByText('80점', { exact: false })).toHaveCount(0)
  await root.getByRole('button', { name: '조건을 바꿔 다시 돌리기' }).click()
  await expect(root).toHaveAttribute('data-phase', 'ready')
  await expect(root.getByRole('button', { name: '$3,000', exact: true })).toHaveAttribute('aria-pressed', 'true')
})

test('설정은 원 대화 조건에 묶이고 기간·금액·Skip은 일관된 계산을 사용한다', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: '과거로 돌려 보기', exact: true }).click(); await readyRoute(page)
  const original = await page.evaluate(() => {
    const state = JSON.parse(sessionStorage.getItem('teth-client-experience')!)
    return state.sessions.find((session: ClientSession) => session.id === state.currentId) as ClientSession
  })
  const source = original.turns.at(-1)!.inlineRequest!
  for (const period of [90, 365, 730, 0] as const) {
    const scoped = { ...original, commonBacktest: { ...original.commonBacktest!, period, amount: 1000 as const } }
    const input = commonBacktestInput(scoped)!
    const result = commonPreviewResult(input)
    expect(result.points).toHaveLength(period || source.parameters.endI - source.parameters.startI + 1)
    expect(input.input.parameters.sl).toBe(source.parameters.sl)
    const scaled = commonPreviewResult(commonBacktestInput({ ...scoped, commonBacktest: { ...scoped.commonBacktest, amount: 3000 } })!)
    expect(scaled.evaluation.r.ret).toBe(result.evaluation.r.ret)
    expect(scaled.evaluation.nav).toBeCloseTo(result.evaluation.nav * 3, 6)
    expect(scaled.evaluation.r.trades).toEqual(result.evaluation.r.trades)
    const months = commonMonths(result.points, result.evaluation.cap)
    expect(months.reduce((value, month) => value * (1 + month.returnPct / 100), result.evaluation.cap)).toBeCloseTo(result.evaluation.nav, 8)
    const scaledMonths = commonMonths(scaled.points, scaled.evaluation.cap)
    for (const [i, month] of months.entries()) expect(scaledMonths[i].returnPct).toBeCloseTo(month.returnPct, 8)
  }
  for (const bad of [{ amount: 999 }, { period: 7 }, { turnId: 'another-turn' }, { skipped: true }, { startedAt: Infinity }, { startedAt: 1 }]) {
    expect(readCommonBacktest({ ...original.commonBacktest, ...bad }, original.turns)).toBeUndefined()
  }
  const start = Date.now()
  const run = { ...original.commonBacktest!, startedAt: start }
  expect(commonPreviewProgress(run, start + 30_000)).toBe(.5)
  expect(commonPreviewProgress(run, start - 1000)).toBe(0)
  expect(commonPreviewProgress(run, start + 120_000)).toBe(1)
  expect(commonPreviewProgress({ ...run, skipped: true }, start)).toBe(1)
})

test('저장 실패는 원 조건과 초점을 보존하고 재생을 시작하지 않는다', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: '과거로 돌려 보기', exact: true }).click(); await readyRoute(page)
  const root = page.getByTestId('common-backtest')
  await page.evaluate(() => {
    const set = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) { if (key === 'teth-client-experience') throw new Error('fixture unavailable'); set.call(this, key, value) }
  })
  const period = root.getByRole('button', { name: '최근 3개월', exact: true })
  await period.focus(); await page.keyboard.press('Enter')
  await expect(period).toBeFocused()
  await expect(period).toHaveAttribute('aria-pressed', 'false')
  await expect(root.getByRole('alert')).toContainText('기존 선택은 유지됩니다')
  await root.getByRole('button', { name: '과거를 다시 돌려 보기' }).click()
  await expect(root).toHaveAttribute('data-phase', 'ready')
})

test('화면을 떠나도 재생 시각은 보존되며 돌아오면 완료 지점이다', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: '과거로 돌려 보기', exact: true }).click(); await readyRoute(page)
  await page.getByRole('button', { name: '과거를 다시 돌려 보기' }).click()
  await page.getByTestId('common-backtest-shell').locator('.cbt-head').getByRole('button', { name: '대화로 돌아가기' }).click()
  await page.clock.fastForward(75_000)
  await page.getByRole('button', { name: '이어서 보기', exact: true }).click(); await readyRoute(page)
  await expect(page.getByTestId('common-backtest')).toHaveAttribute('data-phase', 'result')
})

for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) for (const width of [320, 1440]) {
  test(`${language} ${width}px 준비·결과·거래 필터와 긴 문구가 화면 안에 들어온다`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 980 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const requests: string[] = [], errors: string[] = []
    page.on('request', request => { if (request.url().includes('/api/') || !['GET', 'HEAD'].includes(request.method())) requests.push(request.url()) })
    page.on('pageerror', error => errors.push(error.message))
    await open(page, language)
    const t = (key: Parameters<typeof commonBacktestText>[1]) => commonBacktestText(language, key)
    const summary = page.getByTestId('common-strategy-summary')
    await expect(summary.getByRole('heading', { name: t('summaryTitle') })).toBeVisible()
    expect(await summary.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
    if (['ko', 'fr'].includes(language)) await summary.screenshot({ path: info.outputPath(`summary-${language}-${width}.png`) })
    await page.getByRole('button', { name: t('open'), exact: true }).click(); await readyRoute(page)
    const root = page.getByTestId('common-backtest')
    const period = root.getByRole('button', { name: t('p365'), exact: true })
    await period.focus(); await page.keyboard.press('Enter'); await expect(period).toBeFocused()
    await expect(period).toHaveAttribute('aria-pressed', 'true')
    if (width === 320) await expect(root.locator('.cbt-chart')).toBeHidden()
    if (['ko', 'fr'].includes(language)) {
      await page.getByTestId('common-backtest-shell').locator('h1').scrollIntoViewIfNeeded()
      await page.screenshot({ path: info.outputPath(`ready-${language}-${width}.png`) })
    }
    await root.getByRole('button', { name: t('run'), exact: true }).click()
    await expect(root).toHaveAttribute('data-phase', 'result')
    if (width <= 768) await expect(page.locator('.cbt-head h1')).toBeFocused()
    else await expect(root.getByRole('button', { name: t('rerun'), exact: true })).toBeFocused()
    await page.clock.runFor(200) // hidden ready chart needs its first visible ResizeObserver/RAF paint
    await expect(root.locator('.cbt-chart canvas').first()).toBeVisible()
    await expect.poll(async () => {
      await page.clock.runFor(150)
      return root.locator('.cbt-chart canvas').evaluateAll(canvases => canvases.reduce((sum, node) => {
        const canvas = node as HTMLCanvasElement
        const pixels = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height).data
        if (!pixels) return sum
        // Source d94 replaces the green curve with a neutral line. Sample
        // inside the plot, excluding axis labels and the attribution logo.
        for (let y = 20; y < canvas.height * .78; y++) for (let x = 20; x < canvas.width * .8; x++) {
          const i = (y * canvas.width + x) * 4
          if (pixels[i] > 180 && Math.abs(pixels[i] - pixels[i + 1]) < 5 && Math.abs(pixels[i] - pixels[i + 2]) < 5 && pixels[i + 3] > 100) sum++
        }
        return sum
      }, 0))
    }).toBeGreaterThan(50)
    const allCount = await root.locator('.cbt-trades>li').count()
    await root.getByRole('group', { name: t('trades') }).getByRole('button', { name: new RegExp('^' + t('win')) }).click()
    expect(await root.locator('.cbt-trades>li').count()).toBeLessThanOrEqual(allCount)
    const ledger = root.getByTestId('common-decisions')
    await ledger.getByRole('group', { name: t('kinds') }).getByRole('button', { name: new RegExp('^' + t('buy')) }).click()
    if (width === 320 && ['ko', 'fr'].includes(language)) await root.evaluate(element => {
      const nodes = [...element.querySelectorAll<HTMLElement>('button,small,dt,dd,summary,summary span,summary b,.cbt-cap b,.cbt-cap i,.cbt-result>p,.cbt-sort select,.cbt-decision-counts b,.cbt-decision-row>button>b,.cbt-decision-row>button>span,.cbt-decision-row time')]
      const sizes = nodes.map(node => getComputedStyle(node).fontSize)
      nodes.forEach((node, index) => { node.style.fontSize = `${parseFloat(sizes[index]) * 2}px` })
    })
    await ledger.locator('.cbt-decision-row>button').first().click()
    expect(await ledger.locator('.cbt-decision-counts b').evaluateAll(nodes => nodes.every(node => {
      const style = getComputedStyle(node)
      return node.getBoundingClientRect().height <= parseFloat(style.lineHeight) + 1
    }))).toBe(true)
    expect(await root.evaluate(element => [...element.querySelectorAll('.cbt-grid,.cbt-main,.cbt-rail,.cbt-trades summary,.cbt-cap,.cbt-decisions,.cbt-decision-counts button,.cbt-decision-row>button,.cbt-decision-detail:not([hidden]),.cbt-sort')].every(node => {
      const rect = node.getBoundingClientRect()
      return rect.left >= -1 && rect.right <= innerWidth + 1 && node.scrollWidth <= node.clientWidth + 1
    }))).toBe(true)
    await page.getByTestId('common-backtest-shell').locator('h1').scrollIntoViewIfNeeded()
    await page.clock.runFor(100)
    await page.screenshot({ path: info.outputPath(`common-${language}-${width}.png`) })
    await ledger.getByRole('heading', { name: t('decisions'), exact: true }).evaluate(node => node.scrollIntoView({ block: 'start' }))
    await page.screenshot({ path: info.outputPath(`decisions-${language}-${width}.png`) })
    expect(requests).toEqual([]); expect(errors).toEqual([])
  })
}
test('Skip은 재생만 건너뛰고 원 조건·숫자를 유지하며 대화로 돌아온다', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: '과거로 돌려 보기', exact: true }).click()
  await readyRoute(page)
  const root = page.getByTestId('common-backtest')
  await root.getByRole('button', { name: '과거를 다시 돌려 보기' }).click()
  await root.getByRole('button', { name: '바로 결과 보기' }).click()
  await expect(root).toHaveAttribute('data-phase', 'result')
  const metrics = await root.getByTestId('common-result').textContent()
  await page.reload()
  await readyRoute(page)
  await expect(root.getByTestId('common-result')).toHaveText(metrics!)
  if (page.viewportSize()!.width <= 768) {
    await page.getByTestId('common-backtest-shell').locator('.cbt-head').getByRole('button', { name: '설정으로 돌아가기' }).click()
    await expect(root).toHaveAttribute('data-phase', 'ready')
  }
  await page.getByTestId('common-backtest-shell').locator('.cbt-head').getByRole('button', { name: '대화로 돌아가기' }).click()
  await expect(page.locator('.g-composer textarea')).toBeVisible()
  await expect(page.getByRole('button', { name: '이어서 보기', exact: true })).toBeVisible()
})

test('판단 기록은 전체 날짜·종류·정렬·추가 조회와 계산 근거를 보존한다', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: '과거로 돌려 보기', exact: true }).click(); await readyRoute(page)
  await page.getByRole('button', { name: '과거를 다시 돌려 보기' }).click()
  await page.getByRole('button', { name: '바로 결과 보기' }).click()
  const ledger = page.getByTestId('common-decisions')
  await expect(ledger.getByRole('combobox', { name: '정렬' })).toBeVisible()
  await expect(ledger.locator('.cbt-decision-row')).toHaveCount(12)
  await ledger.getByRole('button', { name: /이전 판단 더 보기/ }).focus()
  await page.keyboard.press('Enter')
  await page.clock.runFor(50)
  await expect(ledger.locator('.cbt-decision-row')).toHaveCount(36)
  await expect(ledger.locator('.cbt-decision-row>button').nth(12)).toBeFocused()
  await ledger.getByRole('combobox', { name: '정렬' }).selectOption('old')
  await expect(ledger.locator('.cbt-decision-row')).toHaveCount(12)
  const dates = await ledger.locator('.cbt-decision-row>button time').allTextContents()
  expect(dates).toEqual([...dates].sort())
  await ledger.getByRole('group', { name: '판단 종류' }).getByRole('button', { name: /^매수 / }).click()
  await expect(ledger.locator('.cbt-decision-row:not([data-kind="buy"])')).toHaveCount(0)
  const row = ledger.locator('.cbt-decision-row>button').first()
  await row.focus(); await page.keyboard.press('Enter')
  await expect(row).toHaveAttribute('aria-expanded', 'true')
  await expect(ledger.getByRole('heading', { name: '그날 확인한 값' })).toBeVisible()
  await expect(ledger.locator('.cbt-decision-detail:not([hidden])')).toContainText('RSI')
  await page.keyboard.press('Enter')
  await expect(row).toHaveAttribute('aria-expanded', 'false')
  await expect(row).toBeFocused()
  await ledger.getByRole('combobox', { name: '정렬' }).selectOption('big')
  const outcomes = await ledger.locator('.cbt-decision-row').evaluateAll(rows => rows.map(row => Number(row.getAttribute('data-outcome'))))
  expect(outcomes).toEqual([...outcomes].sort((a, b) => Math.abs(b) - Math.abs(a)))
  await ledger.getByRole('button', { name: /이전 판단 더 보기/ }).click()
  const allViewed = ledger.getByRole('button', { name: /모든 판단을 확인했습니다/ })
  await expect(allViewed).toHaveAttribute('aria-disabled', 'true')
  const count = await ledger.locator('.cbt-decision-row').count()
  await allViewed.focus(); await page.keyboard.press('Enter')
  await expect(ledger.locator('.cbt-decision-row')).toHaveCount(count)
  await page.setViewportSize({ width: 390, height: 844 })
  const result = page.getByTestId('common-result')
  expect(await result.evaluate((node) => Boolean(node.compareDocumentPosition(document.querySelector('[data-testid="common-decisions"]')!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true)
  expect(await result.evaluate(node => node.getBoundingClientRect().bottom)).toBeLessThan(await ledger.evaluate(node => node.getBoundingClientRect().top))
})

test('전체 판단은 원 사건과 일치하며 당일 관측과 완료 후 손익을 분리한다', () => {
  const evaluation = evaluateSourceTerminal({ sl: -3, tp: 8, rsiTh: 44, trendFilter: false, startI: 605, endI: 1334 }, 1000)
  const original = JSON.stringify(evaluation)
  const rows = commonDecisionRows(evaluation)
  expect(rows).toHaveLength(730)
  for (const row of rows) {
    expect(row.event).toBe(evaluation.L.evs[row.event.i - 605])
    expect(row.price).toBe(sourceTerminalPrices[row.event.i])
    expect(row.rsi).toBe(sourceTerminalRsi(row.event.i - 1))
    if (row.outcome) {
      expect(['buy', 'sell']).toContain(row.kind)
      expect([row.outcome.entry, row.outcome.exit]).toContain(row.event.i)
      expect(row.outcome.exit).toBeGreaterThanOrEqual(row.event.i)
    } else expect(['watch', 'holdingDecision', 'buy']).toContain(row.kind)
  }
  expect(selectCommonDecisions(rows, 'buy', 'new')).toHaveLength(evaluation.L.cnt.entry)
  expect(selectCommonDecisions(rows, 'sell', 'old')).toHaveLength(evaluation.trades.length)
  expect(selectCommonDecisions(rows, 'watch', 'new')).toHaveLength(evaluation.L.cnt.watch)
  expect(selectCommonDecisions(rows, 'holdingDecision', 'new')).toHaveLength(evaluation.L.cnt.risk)
  const byImpact = selectCommonDecisions(rows, 'allRecords', 'big')
  const impact = byImpact.map(row => row.outcome ? Math.abs(row.outcome.pnl) : -1)
  expect(impact).toEqual([...impact].sort((a, b) => b - a))
  expect(rows[0].event.i).toBe(605)
  expect(JSON.stringify(evaluation)).toBe(original)
  const empty = evaluateSourceTerminal({ sl: -3, tp: null, rsiTh: 0, trendFilter: true, startI: 100, endI: 120 }, 500)
  expect(selectCommonDecisions(commonDecisionRows(empty), 'buy', 'new')).toEqual([])
})

test('모바일 준비는 조건을 먼저 보여 주며 화면 크기 변경에도 차트와 선택을 유지한다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await open(page)
  await page.getByRole('button', { name: '과거로 돌려 보기', exact: true }).click(); await readyRoute(page)
  const root = page.getByTestId('common-backtest')
  const start = root.getByRole('button', { name: '과거를 다시 돌려 보기', exact: true })
  const chart = root.locator('.cbt-chart')
  await expect(chart).toBeHidden()
  expect(await start.evaluate(node => Boolean(node.compareDocumentPosition(document.querySelector('.cbt-chart')!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true)
  await root.getByRole('button', { name: '최근 3개월', exact: true }).click()
  await chart.evaluate(node => { (window as unknown as { chartNode: Element }).chartNode = node })
  await page.setViewportSize({ width: 1440, height: 980 }); await page.clock.runFor(200)
  await expect(root.getByRole('button', { name: '최근 3개월', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(root.getByRole('button', { name: '최근 3개월', exact: true })).toBeFocused()
  expect(await chart.evaluate(node => node === (window as unknown as { chartNode: Element }).chartNode)).toBe(true)
  expect(await chart.evaluate(node => node.getBoundingClientRect().right)).toBeLessThan(await start.evaluate(node => node.getBoundingClientRect().left))
  await page.setViewportSize({ width: 390, height: 844 }); await page.clock.runFor(200)
  await expect(chart).toBeHidden()
  for (const width of [768, 769, 860, 900, 901, 1100]) {
    await page.setViewportSize({ width, height: 980 }); await page.clock.runFor(200)
    await expect(root.getByRole('button', { name: '최근 3개월', exact: true })).toBeFocused()
    expect(await chart.evaluate(node => node === (window as unknown as { chartNode: Element }).chartNode)).toBe(true)
    if (width <= 768) await expect(chart).toBeHidden()
    else if (width <= 900) expect(await start.evaluate(node => node.getBoundingClientRect().bottom)).toBeLessThan(await chart.evaluate(node => node.getBoundingClientRect().top))
    else expect(await chart.evaluate(node => node.getBoundingClientRect().right)).toBeLessThan(await start.evaluate(node => node.getBoundingClientRect().left))
  }
})

for (const width of [320, 768, 769, 1440]) test(`${width}px 설정·재생·결과·뒤로가기는 원본 모바일 경계와 차트 인스턴스를 보존한다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 })
  await open(page)
  await page.getByRole('button', { name: '과거로 돌려 보기', exact: true }).click(); await readyRoute(page)
  const shell = page.getByTestId('common-backtest-shell'), root = page.getByTestId('common-backtest')
  const chart = root.locator('.cbt-chart'), header = shell.locator('.cbt-head')
  await root.getByRole('button', { name: '최근 3개월', exact: true }).click()
  await root.getByRole('button', { name: '$3,000', exact: true }).click()
  await expect.poll(async () => { await page.clock.runFor(100); return chart.locator('canvas').count() }).toBeGreaterThan(0)
  await chart.locator('canvas').first().evaluate(node => Reflect.set(window, 'mobileBacktestCanvas', node))
  if (width <= 768) await expect(chart).toBeHidden()
  else await expect(chart).toBeVisible()
  await root.getByRole('button', { name: '과거를 다시 돌려 보기', exact: true }).click()
  await page.clock.runFor(300)
  await expect(root).toHaveAttribute('data-phase', 'run')
  await expect(chart.locator('canvas').first()).toBeVisible()
  if (width <= 768) {
    await expect(header.locator('h1')).toBeFocused()
    expect(await shell.evaluate(node => node.scrollTop)).toBe(0)
  }
  if (width <= 900) expect(await chart.evaluate(node => node.getBoundingClientRect().bottom)).toBeLessThan(await root.locator('.cbt-rail').evaluate(node => node.getBoundingClientRect().top))
  const count = Number(await chart.getAttribute('data-point-count'))
  await page.clock.fastForward(20_000)
  expect(Number(await chart.getAttribute('data-point-count'))).toBeGreaterThan(count)
  await root.getByRole('button', { name: '바로 결과 보기' }).click(); await page.clock.runFor(200)
  await expect(root).toHaveAttribute('data-phase', 'result')
  expect(await chart.locator('canvas').first().evaluate(node => node === Reflect.get(window, 'mobileBacktestCanvas'))).toBe(true)
  if (width <= 768) await expect(root.locator('.cbt-fold')).toBeHidden()
  await shell.evaluate(node => { node.scrollTop = 0 })
  await page.clock.runFor(200)
  await info.attach('scroll-geometry', { contentType: 'application/json', body: JSON.stringify(await header.locator('h1').evaluate(node => {
    const rows = []
    for (let element: HTMLElement | null = node as HTMLElement; element; element = element.parentElement) {
      const rect = element.getBoundingClientRect(), style = getComputedStyle(element)
      rows.push({ tag: element.tagName, class: element.className, top: rect.top, height: rect.height, scrollTop: element.scrollTop, client: element.clientHeight, scroll: element.scrollHeight, overflow: style.overflowY, maxHeight: style.maxHeight })
    }
    return rows
  })) })
  await expect(header.locator('h1')).toBeInViewport()
  await page.screenshot({ path: info.outputPath(`mobile-flow-result-${width}.png`) })
  await header.getByRole('button').focus(); await page.keyboard.press('Enter'); await page.clock.runFor(200)
  if (width <= 768) {
    await expect(root).toHaveAttribute('data-phase', 'ready')
    await expect(chart).toBeHidden()
    await expect(header.locator('h1')).toBeFocused()
    expect(await shell.evaluate(node => node.scrollTop)).toBe(0)
    await expect(root.getByRole('button', { name: '최근 3개월', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(root.getByRole('button', { name: '$3,000', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await page.screenshot({ path: info.outputPath(`mobile-flow-ready-${width}.png`) })
    await page.reload(); await readyRoute(page)
    await expect(root).toHaveAttribute('data-phase', 'ready')
    await expect(root.getByRole('button', { name: '$3,000', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await header.getByRole('button', { name: '대화로 돌아가기' }).click()
  }
  await expect(page.locator('.g-composer textarea')).toBeVisible()
})

test('모바일 경계에서 숨는 준비 차트의 키보드 초점은 보이는 제목으로 복귀한다', async ({ page }) => {
  await page.setViewportSize({ width: 769, height: 900 })
  await open(page)
  await page.getByRole('button', { name: '과거로 돌려 보기', exact: true }).click(); await readyRoute(page)
  const plot = page.getByTestId('common-backtest').locator('.cbt-chart-plot')
  await plot.focus()
  await page.setViewportSize({ width: 768, height: 900 }); await page.clock.runFor(200)
  await expect(plot).toBeHidden()
  await expect(page.locator('.cbt-head h1')).toBeFocused()
  await expect(page.getByRole('button', { name: '대화로 돌아가기' })).toBeVisible()
})

test('모바일 결과의 설정 복귀 저장 실패는 원 결과·초점·경로를 보존한다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await open(page)
  await page.getByRole('button', { name: '과거로 돌려 보기', exact: true }).click(); await readyRoute(page)
  await page.getByRole('button', { name: '과거를 다시 돌려 보기', exact: true }).click()
  await page.getByRole('button', { name: '바로 결과 보기' }).click(); await page.clock.runFor(200)
  const root = page.getByTestId('common-backtest'), original = await root.getByTestId('common-result').textContent()
  const saved = await page.evaluate(() => sessionStorage.getItem('teth-client-experience'))
  await page.evaluate(() => {
    const set = Storage.prototype.setItem
    Reflect.set(window, 'mobileBacktestSet', set)
    Storage.prototype.setItem = function (key, value) { if (key === 'teth-client-experience') throw new Error('fixture unavailable'); set.call(this, key, value) }
  })
  const back = page.getByRole('button', { name: '설정으로 돌아가기', exact: true })
  await back.focus(); await page.keyboard.press('Enter'); await page.clock.runFor(100)
  await expect(root).toHaveAttribute('data-phase', 'result')
  await expect(back).toBeFocused()
  await expect(root.getByRole('alert')).toContainText('기존 선택은 유지됩니다')
  await expect(root.getByTestId('common-result')).toHaveText(original!)
  expect(await page.evaluate(() => sessionStorage.getItem('teth-client-experience'))).toBe(saved)
  await page.evaluate(() => { Storage.prototype.setItem = Reflect.get(window, 'mobileBacktestSet') })
  await back.click(); await page.clock.runFor(100)
  await expect(root).toHaveAttribute('data-phase', 'ready')
  await expect(root.getByRole('alert')).toHaveCount(0)
})

test('실제 브라우저 시계에서 숨김 차트의 전체 기간·양끝 좌표·설정 복귀를 확인한다', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await open(page)
  await page.getByRole('button', { name: '과거로 돌려 보기', exact: true }).click(); await readyRoute(page)
  await page.clock.resume()
  const root = page.getByTestId('common-backtest'), shell = page.getByTestId('common-backtest-shell')
  const chart = root.locator('.cbt-chart'), plot = chart.locator('.cbt-chart-plot')
  await expect(chart).toBeHidden()
  await page.getByRole('button', { name: '과거를 다시 돌려 보기', exact: true }).click()
  await page.getByRole('button', { name: '바로 결과 보기' }).click()
  await expect(shell.locator('h1')).toBeInViewport()
  await expect(chart.locator('canvas').first()).toBeVisible()
  for (const [key, edge] of [['Home', 'first'], ['End', 'last']] as const) {
    await plot.focus(); await page.keyboard.press(key); await page.keyboard.press('Enter')
    const pin = chart.locator('.cbt-chart-pin')
    await expect(pin).toBeVisible()
    await expect.poll(async () => {
      const x = Number(await pin.locator('circle').getAttribute('cx'))
      const width = await plot.evaluate(node => node.clientWidth)
      return edge === 'first' ? x >= 0 && x < width * .2 : x > width * .7 && x <= width
    }).toBe(true)
  }
  await shell.locator('h1').scrollIntoViewIfNeeded()
  await expect(shell.locator('h1')).toBeInViewport()
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  const rendered = await page.screenshot({ path: info.outputPath('actual-clock-result.png') })
  // DOM visibility alone missed a compositor regression: glyphs vanished
  // after nested scrolling while their geometry remained in the viewport.
  const headingPixels = async (rendered: Buffer) => {
    const heading = await shell.locator('h1').boundingBox()
    return page.evaluate(async ({ png, rect }) => {
    const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob(png), ch => ch.charCodeAt(0))], { type: 'image/png' }))
    const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height
    const context = canvas.getContext('2d')!, scale = bitmap.width / innerWidth
    context.drawImage(bitmap, 0, 0); bitmap.close()
    const pixels = context.getImageData(Math.floor(rect.x * scale), Math.floor(rect.y * scale), Math.ceil(rect.width * scale), Math.ceil(rect.height * scale)).data
    let count = 0
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i] > 175 && pixels[i + 1] > 175 && pixels[i + 2] > 175 && pixels[i + 3] > 200) count++
    return count
    }, { png: rendered.toString('base64'), rect: heading! })
  }
  expect(await headingPixels(rendered)).toBeGreaterThan(8)
  await page.getByRole('button', { name: '설정으로 돌아가기' }).click()
  await expect(root).toHaveAttribute('data-phase', 'ready')
  await expect(shell.locator('h1')).toBeInViewport()
  await expect(chart).toBeHidden()
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  const readyPaint = await page.screenshot({ path: info.outputPath('actual-clock-ready.png') })
  expect(await headingPixels(readyPaint)).toBeGreaterThan(8)
  await page.getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).not.toBe('clip')
})

test('판단 선택과 차트 날짜 탐색은 같은 근거를 열고 재실행 때 해제된다', async ({ page }, info) => {
  test.setTimeout(30_000)
  await open(page)
  await page.getByRole('button', { name: '과거로 돌려 보기', exact: true }).click(); await readyRoute(page)
  await page.getByRole('button', { name: '과거를 다시 돌려 보기' }).click()
  await page.getByRole('button', { name: '바로 결과 보기' }).click()
  const ledger = page.getByTestId('common-decisions'), chart = page.locator('.cbt-chart')
  const row = ledger.locator('.cbt-decision-row>button').nth(2)
  const date = await row.locator('time').textContent()
  await row.click(); await page.clock.runFor(200)
  await expect(chart).toHaveAttribute('data-selected-date', date!)
  await expect(chart.locator('.cbt-chart-pin circle')).toHaveAttribute('cx', /\d/)
  await chart.locator('canvas').first().evaluate(node => { (window as unknown as { chartCanvas: Element }).chartCanvas = node })
  await expect(row).toBeFocused()
  await chart.getByRole('group').focus()
  await page.keyboard.press('Home'); await page.keyboard.press('Enter'); await page.clock.runFor(100)
  const first = ledger.locator('.cbt-decision-row>button[aria-expanded=true]')
  await expect(first).toBeFocused()
  const selectedDate = await chart.getAttribute('data-selected-date')
  await expect(first.locator('time')).toHaveText(selectedDate!)
  await expect(chart.locator('.cbt-chart-readout time')).toHaveText(selectedDate!)
  await page.keyboard.press('Enter')
  await expect(chart).not.toHaveAttribute('data-selected-date')
  await chart.getByRole('group').scrollIntoViewIfNeeded()
  const plot = await chart.getByRole('group').boundingBox()
  await page.mouse.move(plot!.x + plot!.width * .35, plot!.y + 140)
  await page.clock.runFor(100)
  const hovered = await chart.locator('.cbt-chart-readout time').textContent()
  await page.mouse.click(plot!.x + plot!.width * .35, plot!.y + 140)
  await page.clock.runFor(100)
  await expect(ledger.locator('.cbt-decision-row>button[aria-expanded=true] time')).toHaveText(hovered!)
  await expect(chart).toHaveAttribute('data-selected-date', hovered!)
  const trade = page.locator('.cbt-trades summary').first()
  const exit = await trade.locator('time').nth(1).textContent()
  await trade.click(); await page.clock.runFor(100)
  await expect(chart).toHaveAttribute('data-selected-date', exit!)
  await expect(ledger.locator('.cbt-decision-row>button[aria-expanded=true]')).toHaveCount(0)
  await chart.scrollIntoViewIfNeeded(); await page.clock.runFor(100)
  await page.screenshot({ path: info.outputPath('chart-pin.png') })
  expect(await chart.locator('.cbt-chart-pin circle').evaluate(node => {
    const dot = node as SVGCircleElement
    return dot.cx.baseVal.value >= 0 && dot.cx.baseVal.value <= node.parentElement!.getBoundingClientRect().width && dot.cy.baseVal.value >= 0 && dot.cy.baseVal.value <= 320
  })).toBe(true)
  expect(await chart.locator('canvas').first().evaluate(node => node === (window as unknown as { chartCanvas: Element }).chartCanvas)).toBe(true)
  await page.setViewportSize({ width: 320, height: 980 }); await page.clock.runFor(200)
  expect(await chart.locator('.cbt-chart-pin circle').evaluate(node => {
    const dot = node as SVGCircleElement
    return dot.cx.baseVal.value >= 0 && dot.cx.baseVal.value <= node.parentElement!.getBoundingClientRect().width
  })).toBe(true)
  await page.getByRole('button', { name: '조건을 바꿔 다시 돌리기' }).click()
  await expect(chart).not.toHaveAttribute('data-selected-date')
})

test('차트 날짜 안내의 근거 버튼은 키보드·포인터 이동 중 사라지지 않는다', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: '과거로 돌려 보기', exact: true }).click(); await readyRoute(page)
  await page.getByRole('button', { name: '과거를 다시 돌려 보기' }).click()
  await page.getByRole('button', { name: '바로 결과 보기' }).click()
  const chart = page.locator('.cbt-chart'), plot = chart.getByRole('group')
  await plot.focus(); await page.keyboard.press('Home'); await page.clock.runFor(100)
  const button = chart.getByRole('button', { name: '판단 근거 보기' })
  await button.focus(); await page.clock.runFor(100)
  await expect(button).toBeVisible(); await expect(button).toBeFocused()
  await page.keyboard.press('Enter'); await page.clock.runFor(100)
  const openRow = page.locator('.cbt-decision-row>button[aria-expanded=true]')
  await expect(openRow).toBeFocused()
  await page.keyboard.press('Enter')
  await plot.scrollIntoViewIfNeeded()
  const rect = await plot.boundingBox()
  await page.mouse.move(rect!.x + rect!.width * .4, rect!.y + 130); await page.clock.runFor(100)
  const date = await chart.locator('.cbt-chart-readout time').textContent()
  const buttonRect = await button.boundingBox()
  await page.mouse.move(buttonRect!.x + buttonRect!.width / 2, buttonRect!.y + buttonRect!.height / 2); await page.clock.runFor(100)
  await expect(button).toBeVisible()
  await button.click(); await page.clock.runFor(100)
  await expect(openRow.locator('time')).toHaveText(date!)
})

test('월별 수익은 모바일4열과 데스크톱표에서 같은 기간·일부월·원값을 보존한다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 980 })
  await open(page)
  await page.getByRole('button', { name: '과거로 돌려 보기', exact: true }).click(); await readyRoute(page)
  await expect(page.getByRole('heading', { name: '월별 수익률' })).toHaveCount(0)
  await page.getByRole('button', { name: '과거를 다시 돌려 보기' }).click()
  await page.getByRole('button', { name: '바로 결과 보기' }).click()
  const months = page.getByRole('region', { name: '월별 수익률' })
  await expect(months).toBeVisible()
  const cards = months.locator('.cbt-month-cards')
  await expect(cards).toBeVisible()
  await expect(months.locator('.cbt-month-scroll')).toBeHidden()
  const observed = cards.locator('[data-month]:not(.empty)')
  await expect(observed).toHaveCount(25)
  await expect(cards.locator('[data-month][data-partial=true]')).toHaveCount(2)
  await expect(cards.locator('[data-year][data-partial=true]')).toHaveCount(2)
  await expect(observed.first()).toHaveAttribute('data-month', '2024-08')
  await expect(observed.last()).toHaveAttribute('data-month', '2026-08')
  const cells = await cards.locator('dl').first().locator('div').evaluateAll(nodes => nodes.map(node => ({top:node.getBoundingClientRect().top,width:node.getBoundingClientRect().width})))
  expect(cells.filter(cell=>cell.top===cells[0].top)).toHaveLength(4)
  const mobileValues = await observed.locator('dd').allTextContents()
  const mobileLabels = await cards.locator('dd').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label')))
  await expect(page.locator('.cbt-legend-base')).toHaveText(`${commonBacktestText('ko', 'amount')} US$1,000.00`)
  expect(await cards.evaluate(node=>node.scrollWidth<=node.clientWidth)).toBe(true)
  await cards.scrollIntoViewIfNeeded()
  await page.screenshot({path:info.outputPath('monthly-320.png')})
  await page.setViewportSize({width:1440,height:980}); await page.clock.runFor(200)
  const scroll = months.locator('.cbt-month-scroll')
  await expect(cards).toBeHidden(); await expect(scroll).toBeVisible()
  await expect(scroll.locator('table')).toHaveCSS('font-size', '14px')
  await expect(scroll.locator('td.up').first()).toHaveCSS('color', 'rgb(88, 184, 146)')
  await expect(scroll.locator('td.down').first()).toHaveCSS('color', 'rgb(217, 122, 114)')
  expect(await scroll.locator('td[data-month]:not(.empty)').allTextContents()).toEqual(mobileValues)
  expect(await scroll.locator('td[data-month]').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label')))).toEqual(mobileLabels)
  await scroll.focus()
  const before = await scroll.evaluate(node => node.scrollLeft)
  for (let i = 0; i < 6; i++) { await page.keyboard.press('ArrowRight'); await page.clock.runFor(100) }
  if(await scroll.evaluate(node => node.scrollWidth > node.clientWidth)) expect(await scroll.evaluate(node => node.scrollLeft)).toBeGreaterThan(before)
  await scroll.evaluate(node => { node.scrollLeft = node.scrollWidth })
  const last = await scroll.locator('td[data-year]').last().boundingBox(), box = await scroll.boundingBox()
  expect(last!.x + last!.width).toBeLessThanOrEqual(box!.x + box!.width + 1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440)
  await page.screenshot({ path: info.outputPath('monthly-1440.png') })
})

for (const width of [320, 1440]) test(`${width}px 연속 보유 묶음은 날짜별 근거·차트 선택·언어·더보기 초점을 보존한다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1000 })
  await open(page)
  await page.getByRole('button', { name: '과거로 돌려 보기', exact: true }).click(); await readyRoute(page)
  await page.getByRole('button', { name: '과거를 다시 돌려 보기' }).click()
  await page.getByRole('button', { name: '바로 결과 보기' }).click()
  const ledger = page.getByTestId('common-decisions')
  await ledger.getByRole('group', { name: '판단 종류' }).getByRole('button', { name: /^그대로 유지 / }).click()
  const toggle = ledger.locator('.cbt-hold-group>button').first()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  expect(await toggle.evaluate(button => button.getAttribute('aria-controls')!.split(' ').every(id => document.getElementById(id)?.hidden))).toBe(true)
  await toggle.focus(); await page.keyboard.press('Enter')
  const row = ledger.locator('.cbt-decision-row:visible>button').first()
  await row.click()
  await expect(row).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('.cbt-chart')).toHaveAttribute('data-selected-date', await row.locator('time').getAttribute('datetime') as string)
  const id = await toggle.getAttribute('aria-controls')
  await page.evaluate(async () => {
    const path = '/src/client-preferences.ts'
    const { setClientPreference } = await import(/* @vite-ignore */ path)
    setClientPreference('language', 'fr')
  })
  await expect(toggle).toHaveAttribute('aria-controls', id!)
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(toggle).toContainText('Position conservée')
  await toggle.click()
  expect(await toggle.evaluate(button => button.getAttribute('aria-controls')!.split(' ').every(id => document.getElementById(id)?.hidden))).toBe(true)
  await ledger.locator('.cbt-decisions-more').focus(); await page.keyboard.press('Enter'); await page.clock.runFor(50)
  await expect(ledger).toHaveAttribute('data-visible-count', '36')
  await expect(ledger.locator('.cbt-decision-row>button').nth(12)).toBeFocused()
  await expect(ledger.locator('.cbt-decision-row>button').nth(12)).toBeVisible()
  await toggle.evaluate(button => {
    const sizes = [...button.querySelectorAll<HTMLElement>('time,b,span')].map(node => [node, parseFloat(getComputedStyle(node).fontSize)] as const)
    for (const [node, size] of sizes) node.style.fontSize = `${size * 2}px`
  })
  expect(await toggle.evaluate(button => button.scrollWidth <= button.clientWidth + 1)).toBe(true)
  expect(await toggle.locator('time').evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
  await toggle.scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath(`holding-fr-${width}.png`) })
})

test('월별 요약은 전월 잔고·첫 자본·윤년·일부 기간을 보존하며 합성 곡선과 복리로 일치한다', () => {
  const index = (date: string) => (Date.parse(date + 'T00:00:00Z') - Date.UTC(2023, 0, 2)) / 86_400_000
  const points = [
    { i: index('2024-01-31'), value: 110 },
    { i: index('2024-02-01'), value: 121 },
    { i: index('2024-02-29'), value: 99 },
    { i: index('2024-03-01'), value: 108.9 },
  ].map(point => Object.freeze(point))
  const months = commonMonths(Object.freeze(points), 100)
  expect(months.map(month => [month.month, month.base, month.partial])).toEqual([
    ['2024-01', 100, true], ['2024-02', 110, false], ['2024-03', 99, true],
  ])
  for (const [offset, expected] of [10, -10, 10].entries()) expect(months[offset].returnPct).toBeCloseTo(expected, 10)
  expect(months.reduce((value, month) => value * (1 + month.returnPct / 100), 100)).toBeCloseTo(108.9, 10)
  expect(commonMonths(points.slice(1, 2), 100)[0].partial).toBe(true)
  expect(commonMonths([{ i: index('2025-02-01'), value: 100 }, { i: index('2025-02-28'), value: 100 }], 100)[0]).toMatchObject({ returnPct: 0, partial: false })
  expect(commonMonths([], 100)).toEqual([])
})

test('월별 프랑스어 수익률과 연도는 200% 글자 확대에도 서로 겹치지 않는다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 980 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await open(page, 'fr')
  await page.getByRole('button', { name: commonBacktestText('fr', 'open'), exact: true }).click(); await readyRoute(page)
  await page.getByRole('button', { name: commonBacktestText('fr', 'run'), exact: true }).click()
  const months = page.getByRole('region', { name: 'Mois par mois' })
  await months.scrollIntoViewIfNeeded()
  await months.evaluate(element => {
    const nodes = [...element.querySelectorAll<HTMLElement>('th,td,small,.cbt-month-cards,dt,dd,h4,.cbt-month-cards header>span')]
    const sizes = nodes.map(node => getComputedStyle(node).fontSize)
    nodes.forEach((node, i) => { node.style.fontSize = `${parseFloat(sizes[i]) * 2}px` })
  })
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 980 }); await page.clock.runFor(200)
    if(width<=768){
      await expect(months.locator('.cbt-month-cards')).toBeVisible()
      const columnCounts = await months.locator('.cbt-month-cards dl').evaluateAll(nodes => nodes.map(node => getComputedStyle(node).gridTemplateColumns.split(' ').length))
      expect(columnCounts).toEqual([2,2,2])
      expect(await months.locator('.cbt-month-cards :is(dt,small)').evaluateAll(nodes => nodes.every(node => getComputedStyle(node).whiteSpace === 'nowrap'))).toBe(true)
      expect(await months.locator('.cbt-month-cards :is(dt,dd,header,dl>div)').evaluateAll(nodes=>nodes.filter(node=>node.scrollWidth>node.clientWidth+1).map(node=>({tag:node.tagName,text:node.textContent,width:node.clientWidth,scroll:node.scrollWidth,font:getComputedStyle(node).fontSize})))).toEqual([])
    } else {
      await expect(months.locator('thead th')).toHaveCount(14)
      expect(await months.locator('th,td').evaluateAll(nodes => nodes.every(node => node.scrollWidth <= node.clientWidth + 1))).toBe(true)
      expect(await months.locator('tbody tr').evaluateAll(rows => rows.every(row => [...row.children].every((cell, i, cells) => !i || cells[i - 1].getBoundingClientRect().right <= cell.getBoundingClientRect().left + 1)))).toBe(true)
      await months.locator('.cbt-month-scroll').focus()
      await page.keyboard.press('End')
    }
    await page.clock.runFor(250)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await months.scrollIntoViewIfNeeded()
    await page.screenshot({ path: info.outputPath(`monthly-fr-${width}-2x.png`) })
  }
})

test('월별 원값으로 연간 복리를 계산하고 빠진 달·일부 연도를 구분한다', () => {
  const months = [
    { month: '2024-01', first: '2024-01-01', last: '2024-01-31', base: 100, closing: 110.049, returnPct: 10.049, partial: false },
    { month: '2024-03', first: '2024-03-01', last: '2024-03-31', base: 110.049, closing: 99.04310399, returnPct: -10.001, partial: false },
  ]
  const original = JSON.stringify(months), years = commonYears(months)
  expect(years).toHaveLength(1)
  expect(years[0].returnPct).toBeCloseTo((1.10049 * .89999 - 1) * 100, 10)
  expect(years[0].returnPct).not.toBeCloseTo(0, 2)
  expect(years[0].partial).toBe(true)
  expect(years[0].months.map(month => month.month)).toEqual(['2024-01', '2024-03'])
  expect(JSON.stringify(months)).toBe(original)
  expect(commonYears([])).toEqual([])
  const complete = Array.from({ length: 12 }, (_, i) => ({ ...months[0], month: `2025-${String(i + 1).padStart(2, '0')}`, returnPct: 0 }))
  expect(commonYears(complete)[0]).toMatchObject({ returnPct: 0, partial: false })
})

test('보유 묶음은 인접 날짜만 포함하고 원 사건·필터·정렬을 변경하지 않는다', () => {
  const evaluation = evaluateSourceTerminal({ sl: -3, tp: 8, rsiTh: 44, trendFilter: false, startI: 605, endI: 1334 }, 1000)
  const rows = commonDecisionRows(evaluation), original = JSON.stringify(rows)
  for (const sort of ['new', 'old', 'big'] as const) {
    const selected = selectCommonDecisions(rows, 'allRecords', sort), groups = commonHoldingGroups(selected)
    expect(groups.length).toBeGreaterThan(0)
    for (const group of groups) {
      expect(group.every(row => row.kind === 'holdingDecision')).toBe(true)
      expect(group.every((row, i) => i === 0 || Math.abs(row.event.i - group[i - 1].event.i) === 1)).toBe(true)
      expect(group.map(row => selected.indexOf(row))).toEqual(Array.from({ length: group.length }, (_, i) => selected.indexOf(group[0]) + i))
    }
  }
  expect(JSON.stringify(rows)).toBe(original)
})

test('차트 키보드 안내는 포인터 이동으로 재발화하지 않고 외부 초점에서 해제된다', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: '과거로 돌려 보기', exact: true }).click(); await readyRoute(page)
  await page.getByRole('button', { name: '과거를 다시 돌려 보기' }).click()
  await page.getByRole('button', { name: '바로 결과 보기' }).click()
  const plot = page.locator('.cbt-chart-plot'), status = page.locator('.cbt-chart [role=status]')
  await plot.focus(); await page.keyboard.press('Home'); await page.clock.runFor(100)
  const announcement = await status.textContent()
  expect(announcement).toContain('2024-08')
  const bounds = await plot.boundingBox()
  await page.mouse.move(bounds!.x + bounds!.width * .5, bounds!.y + 100); await page.clock.runFor(100)
  await expect(status).toHaveText(announcement!)
  await page.keyboard.press('End'); await page.clock.runFor(100)
  await expect(status).toContainText('2026-08')
  await page.getByRole('button', { name: '조건을 바꿔 다시 돌리기' }).focus()
  await expect(status).toBeEmpty()
})

test('요약 카드와 방문 행은 프랑스어 200%에서도 초점·버튼·본문이 겹치지 않는다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 980 })
  await open(page, 'fr')
  const card = page.getByTestId('common-strategy-summary')
  const enlarge = async () => card.evaluate(root => {
    const nodes = [...root.querySelectorAll<HTMLElement>('h3,dt,dd,p,button,section>span')]
    const sizes = nodes.map(node => getComputedStyle(node).fontSize)
    nodes.forEach((node, i) => { node.style.fontSize = `${parseFloat(sizes[i]) * 2}px` })
  })
  await enlarge()
  expect(await card.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
  const terms = await card.locator('dl').boundingBox(), edit = await card.locator('.summary-edit').boundingBox(), note = await card.locator('p').boundingBox()
  expect(edit!.y).toBeGreaterThanOrEqual(terms!.y + terms!.height)
  expect(note!.y).toBeGreaterThanOrEqual(edit!.y + edit!.height)
  await card.getByRole('button', { name: commonBacktestText('fr', 'revise') }).focus()
  await page.screenshot({ path: info.outputPath('summary-fr-320-2x-bottom.png') })
  const openButton = card.getByRole('button', { name: commonBacktestText('fr', 'open') })
  await openButton.focus()
  await expect(openButton).toBeInViewport({ ratio: 1 })
  await page.screenshot({ path: info.outputPath('summary-fr-320-2x-action.png') })
  await card.getByRole('button', { name: commonBacktestText('fr', 'open') }).click(); await readyRoute(page)
  await page.getByRole('button', { name: commonBacktestText('fr', 'back') }).click()
  await enlarge()
  await card.getByRole('button', { name: commonBacktestText('fr', 'resume') }).focus()
  expect(await card.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
  expect(await card.locator('button').evaluate(node => node.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44)
  const label = await card.locator(':scope > span').boundingBox(), resume = await card.locator('button').boundingBox()
  expect(Math.abs(resume!.x - label!.x)).toBeLessThanOrEqual(1)
  expect(resume!.y).toBeGreaterThanOrEqual(label!.y + label!.height)
  await card.screenshot({ path: info.outputPath('summary-resume-fr-320-2x.png') })
})
