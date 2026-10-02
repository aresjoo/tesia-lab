import { expect, test, type Page } from '@playwright/test'
import type { ClientSession } from '../src/client-experience-store'
import type { InlineBacktestRecord } from '../src/client-inline-backtest'
import { evaluateDelegation } from '../src/client-delegation-engine'
import { sourceTerminalPrices } from '../src/client-terminal-source-fixture'
import { sourceRuleExitPrice } from '../src/client-terminal-source-ledger'
import { revealSourceNavigation } from './fixtures/source-offline-research-entry'

// 621cbed archived transcripts remain readable. Local follow-up requests use
// source 9fb offline inline results; observed provider common flows have separate tests.
const key = 'teth-client-experience'
const owner = 'inline-backtest@example.test'
const composer = (page: Page) => page.locator('.g-composer textarea')
const result = (page: Page, ordinal: number) => page.locator(`.client-inline-backtest .gbt[data-bt="${ordinal}"]`)
const report = (page: Page, ordinal: number) => page.locator(`.client-inline-backtest .gbt[data-rpt="${ordinal}"]`)
const read = (page: Page): Promise<ClientSession> => page.evaluate(key => {
  const value = JSON.parse(sessionStorage.getItem(key)!)
  return value.sessions.find((session: { id: string }) => session.id === value.currentId)
}, key)

async function open(page: Page) {
  const requests: string[] = []
  page.on('request', request => {
    if (!['GET', 'HEAD'].includes(request.method()) || new URL(request.url()).pathname.startsWith('/api/')) requests.push(request.url())
  })
  await page.route('**/api/**', route => route.abort('failed'))
  await page.clock.install({ time: new Date('2026-09-16T12:00:00Z') })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(owner => {
    localStorage.setItem('tethLang', 'ko')
    if (!sessionStorage.getItem('teth-client-profile-preview')) sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '인라인 검증', email: owner }))
    const fixture = sessionStorage.getItem('test:pre-migration-transcript')
    if (fixture) { sessionStorage.setItem('teth-client-experience', fixture); sessionStorage.removeItem('test:pre-migration-transcript') }
  }, owner)
  await page.goto('/')
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000))
  return requests
}
async function start(page: Page, idea: string) {
  await page.locator('#strategy-idea').fill(idea)
  await page.getByRole('button', { name: '대화 시작', exact: true }).click()
  await restorePreMigrationRequest(page)
}
// Produce an explicitly archived pending transcript without a production flag.
// Removing the new discriminator models records saved by the previous version.
async function restorePreMigrationRequest(page: Page) {
  await page.clock.fastForward(300)
  await page.evaluate(key => {
    const state = JSON.parse(sessionStorage.getItem(key)!)
    const session = state.sessions.find((item: { id: string }) => item.id === state.currentId)
    delete session.turns.at(-1).backtestFlow
    // Apply on the next document, after the current host's pagehide flush.
    sessionStorage.setItem('test:pre-migration-transcript', JSON.stringify(state))
  }, key)
  await page.reload()
  await page.clock.runFor(400)
}
async function settle(page: Page) {
  await page.clock.fastForward(15_000)
  // The stream terminal transition and queued source computation are separate
  // tick branches. Advancing twice also covers completion after route restore.
  await page.clock.fastForward(2_000)
  await expect.poll(async () => (await read(page)).turns.at(-1)?.status).toBe('done')
}
async function ask(page: Page, text: string, archived = false) {
  await composer(page).fill(text)
  await composer(page).press('Enter')
  if (archived) await restorePreMigrationRequest(page)
  await settle(page)
}
async function finishNarrationOnly(page: Page) {
  const turn = (await read(page)).turns.at(-1)!
  const now = await page.evaluate(() => Date.now())
  await page.clock.fastForward(Math.max(1, turn.startedAt + 1800 + turn.fullAnswer.length * 26 - now + 1))
  await expect.poll(async () => (await read(page)).turns.at(-1)?.status).toBe('done')
  expect((await read(page)).inlineResults ?? []).toEqual([])
  await expect(page.getByRole('button', { name: '응답 중지', exact: true })).toBeVisible()
}
async function expectMetrics(page: Page, record: InlineBacktestRecord) {
  const { result: expected, score } = evaluateDelegation(record.parameters, 5_000_000)
  const panel = result(page, record.ordinal)
  await expect(panel).toBeVisible()
  await expect(panel.locator('.sc > b')).toHaveText(String(score))
  await expect(panel.locator('.kp dd')).toHaveText([
    `${expected.ret >= 0 ? '+' : ''}${expected.ret.toFixed(1)}%`, `${expected.mdd.toFixed(1)}%`,
    `${expected.winRate.toFixed(1)}%`, `${expected.n}회`,
  ])
  await expect(report(page, record.ordinal)).toHaveCount(score >= 80 ? 1 : 0)
  return { expected, score }
}
async function sidebar(page: Page) {
  if ((page.viewportSize()?.width ?? 0) <= 860) await revealSourceNavigation(page)
  await page.locator((page.viewportSize()?.width ?? 0) <= 860 ? '.client-hamburger' : '.client-rail-logo-row button').click()
}

test('이전 버전에서 저장된 입력은 원 조건 ETH/-2 결과를 복원하고 합성 엔진 지표를 유지한다', async ({ page }) => {
  const requests = await open(page)
  const idea = 'ETH 반등 1시간봉 손절 2%, 익절 8%'
  await start(page, idea); await settle(page)
  const session = await read(page), records = session.inlineResults!
  expect(records).toHaveLength(1)
  expect(records[0]).toMatchObject({ ordinal: 1, turnId: session.turns[0].id, pair: 'ETH/USDT', timeframe: '1시간봉',
    parameters: { sl: -2, tp: 8, rsiTh: 44, trendFilter: false, startI: 61, endI: sourceTerminalPrices.length - 1 } })
  await expectMetrics(page, records[0])
  await expect(composer(page)).toBeVisible()
  await expect(page.locator('.rw-workspace, .tfw')).toHaveCount(0)
  await expect(page.locator('.client-next-actions')).toHaveCount(0)
  await expect(result(page, 1).locator('.inline-provenance')).toBeVisible()
  await expect(page.locator('.g-umsg')).toHaveText(idea)
  await result(page, 1).locator('summary').click()
  await expect(result(page, 1)).toContainText('ETH/USDT · 요청 간격 1시간봉')
  await expect(result(page, 1)).toContainText('손절 -2%, 익절 +8%')
  await expect(result(page, 1)).toContainText('요청 간격과 관계없이 같은 일봉으로 계산합니다.')
  expect(session.workspace).toBe('conversation')
  await page.clock.fastForward(60_000)
  expect((await read(page)).inlineResults).toEqual(records)
  expect(requests).toEqual([])
})

test('추천의 같은 틱 연속 클릭은 새 차수 하나만 만들고 기존 익절·ETH·미전송 초안을 보존한다', async ({ page }) => {
  const requests = await open(page)
  await start(page, 'ETH 반등 1시간봉 손절 2%, 익절 8%'); await settle(page)
  const initial = await read(page), first = initial.inlineResults![0]
  expect(evaluateDelegation(first.parameters, 5_000_000).score).toBeLessThan(80)
  await composer(page).fill('추천을 보고 결정할 미전송 초안')
  await page.clock.fastForward(500)
  await page.getByRole('button', { name: '추천 설정으로 다시 검증', exact: true }).evaluate(node => {
    (node as HTMLButtonElement).click(); (node as HTMLButtonElement).click()
  })
  expect((await read(page)).turns).toHaveLength(initial.turns.length + 1)
  await settle(page)
  const next = await read(page)
  expect(next.inlineResults).toHaveLength(2)
  expect(next.inlineResults![0]).toEqual(first)
  expect(next.turns.at(-1)).toMatchObject({ inlineRequest: { pair: 'ETH/USDT', timeframe: '1시간봉', parameters: { sl: -5, tp: 8, trendFilter: true } } })
  await expectMetrics(page, first)
  expect(next.turns.at(-1)?.backtestFlow).toBeUndefined()
  await expect(page.getByRole('button', { name: '과거로 돌려 보기', exact: true })).toHaveCount(0)
  await expectMetrics(page, next.inlineResults![1])
  await expect(composer(page)).toHaveValue('추천을 보고 결정할 미전송 초안')
  await expect(page.locator('.gbt[data-bt]')).toHaveCount(2)
  expect(requests).toEqual([])
})

test('익절 없는 결과의 추천만 +12로 채우고 이전 결과의 없음 스냅샷은 바꾸지 않는다', async ({ page }) => {
  const requests = await open(page)
  await start(page, 'BTC 반등 1시간봉 손절 3%')
  await settle(page)
  await page.getByRole('button', { name: '익절 없이 진행', exact: true }).click()
  await restorePreMigrationRequest(page)
  await settle(page)
  const first = (await read(page)).inlineResults![0]
  expect(first.parameters.tp).toBeNull()
  await page.getByRole('button', { name: '추천 설정으로 다시 검증', exact: true }).click()
  await settle(page)
  const next = await read(page)
  expect(next.inlineResults).toHaveLength(2)
  expect(next.inlineResults![0]).toEqual(first)
  expect(next.turns.at(-1)).toMatchObject({ inlineRequest: { parameters: { sl: -5, tp: 12, trendFilter: true } } })
  expect(next.turns.at(-1)?.backtestFlow).toBeUndefined()
  await expect(page.getByRole('button', { name: '과거로 돌려 보기', exact: true })).toHaveCount(0)
  await expectMetrics(page, next.inlineResults![1])
  expect(requests).toEqual([])
})

test('직접 수정은 초안을 유지하며 명명 수치·정확한 진입 수정만 새 결과를 추가한다', async ({ page }) => {
  const requests = await open(page)
  await start(page, 'ETH 반등 1시간봉 손절 2%, 익절 8%'); await settle(page)
  const first = (await read(page)).inlineResults![0]
  await composer(page).fill('손절 4.5%, 익절 9%')
  await page.getByRole('button', { name: '조건을 직접 수정할게요', exact: true }).click()
  await expect(composer(page)).toBeFocused()
  await expect(composer(page)).toHaveValue('손절 4.5%, 익절 9%')
  await settle(page)
  expect((await read(page)).inlineResults).toEqual([first])
  await composer(page).press('Enter'); await settle(page)
  expect((await read(page)).turns.at(-1)).toMatchObject({ inlineRequest: { pair: 'ETH/USDT', parameters: { sl: -4.5, tp: 9, trendFilter: false } } })
  await ask(page, '추세 진입으로')
  const stable = (await read(page)).inlineResults!
  expect(stable).toHaveLength(3)
  expect((await read(page)).turns.at(-1)).toMatchObject({ inlineRequest: { parameters: { sl: -4.5, tp: 9, trendFilter: true } } })
  expect(stable[0]).toEqual(first)
  expect(stable[1].parameters).toMatchObject({ sl: -4.5, tp: 9, trendFilter: false })
  expect(stable[2].parameters).toMatchObject({ sl: -4.5, tp: 9, trendFilter: true })
  expect((await read(page)).turns.at(-1)?.backtestFlow).toBeUndefined()
  await expectMetrics(page, stable[1])
  await expectMetrics(page, stable[2])
  for (const text of ['오늘 날씨가 좋아요', '추세가 왜 중요한가요?', '손절 4.5%, 익절 9%']) {
    await ask(page, text)
    expect((await read(page)).inlineResults).toEqual(stable)
  }
  await expect(page.locator('.gbt[data-bt]')).toHaveCount(3)
  expect(requests).toEqual([])
})

test('내레이션 완료 뒤 1100ms 대기에도 중복 전송을 막고 reload는 정확히 한 결과만 완성한다', async ({ page }) => {
  const requests = await open(page)
  await start(page, 'BTC 추세 1시간봉 손절 5%, 익절 12%')
  await finishNarrationOnly(page)
  const pending = await read(page)
  await composer(page).fill('대기 중 보존할 미전송 문장')
  await composer(page).press('Enter')
  expect((await read(page)).turns).toHaveLength(pending.turns.length)
  await expect(composer(page)).toHaveValue('대기 중 보존할 미전송 문장')
  await page.clock.fastForward(300)
  await page.reload()
  await page.clock.fastForward(2_000)
  await page.clock.fastForward(100)
  await expect(page.locator('.gbt[data-bt]')).toHaveCount(1)
  await expect(composer(page)).toHaveValue('대기 중 보존할 미전송 문장')
  expect((await read(page)).turns).toHaveLength(pending.turns.length)
  const completed = (await read(page)).inlineResults
  await page.reload(); await settle(page)
  expect((await read(page)).inlineResults).toEqual(completed)
  expect(requests).toEqual([])
})

for (const phase of ['running', 'queued'] as const) test(`${phase} 중지는 새로고침·시간 경과로 인라인 결과를 되살리지 않는다`, async ({ page }) => {
  const requests = await open(page)
  await start(page, 'BTC 추세 1시간봉 손절 5%, 익절 12%')
  if (phase === 'queued') await finishNarrationOnly(page)
  await page.getByRole('button', { name: '응답 중지', exact: true }).click()
  const stopped = await read(page)
  if (phase === 'queued') expect(stopped.turns.at(-1)?.inlineStopped).toBe(true)
  else expect(stopped.turns.at(-1)?.status).toBe('stopped')
  await page.reload(); await page.clock.fastForward(60_000); await page.clock.fastForward(100)
  await expect(page.locator('.gbt[data-bt], .gbt[data-rpt]')).toHaveCount(0)
  expect((await read(page)).inlineResults ?? []).toEqual([])
  expect(requests).toEqual([])
})

test('다른 세션을 만든 뒤 돌아와도 결과 차수·조건·초안이 섞이지 않는다', async ({ page }) => {
  const requests = await open(page)
  await start(page, 'ETH 반등 1시간봉 손절 2%, 익절 8%'); await settle(page)
  await composer(page).fill('첫 ETH 대화의 초안'); await page.clock.fastForward(500)
  const first = await read(page)
  await sidebar(page); await page.locator('.client-new-strategy').click()
  await start(page, 'BTC 추세 일봉 손절 5%, 익절 12%'); await settle(page)
  const second = await read(page)
  expect(second.id).not.toBe(first.id)
  expect(second.inlineResults![0]).toMatchObject({ ordinal: 1, pair: 'BTC/USDT', timeframe: '일봉' })
  await sidebar(page)
  await page.locator('.client-session').filter({ hasText: first.title }).click()
  await expect(composer(page)).toHaveValue('첫 ETH 대화의 초안')
  expect((await read(page)).inlineResults).toEqual(first.inlineResults)
  await expectMetrics(page, first.inlineResults![0])
  await page.reload()
  expect((await read(page)).id).toBe(first.id)
  await expect(page.locator('.gbt[data-bt]')).toHaveCount(1)
  expect(requests).toEqual([])
})

test('손상된 결과 한 건은 격리하며 정상 이력 두 건을 재생성하거나 삭제하지 않는다', async ({ page }) => {
  const requests = await open(page)
  await start(page, 'ETH 반등 1시간봉 손절 2%, 익절 8%'); await settle(page)
  await ask(page, '손절 5%, 익절 12%', true)
  const valid = (await read(page)).inlineResults!
  expect(valid).toHaveLength(2)
  await page.evaluate(key => {
    const saved = JSON.parse(sessionStorage.getItem(key)!)
    const session = saved.sessions.find((item: { id: string }) => item.id === saved.currentId)
    const broken = { ...session.inlineResults[0], ordinal: 77, parameters: { ...session.inlineResults[0].parameters, sl: -100 } }
    session.inlineResults.splice(1, 0, broken)
    sessionStorage.setItem('test:pre-migration-transcript', JSON.stringify(saved))
  }, key)
  await page.reload(); await settle(page)
  // Recovery initially lives in the decoded snapshot; raw damaged bytes are
  // preserved until the next explicit write, not rewritten by a read.
  await expect(page.getByRole('status').filter({ hasText: '일부 대화 기록을 복원하지 못했습니다' })).toBeVisible()
  await expect(page.locator('.gbt[data-bt]')).toHaveCount(2)
  await expect(result(page, 77)).toHaveCount(0)
  await expectMetrics(page, valid[0]); await expectMetrics(page, valid[1])
  // A fresh read uses the decoder even if recovery leaves original raw bytes
  // intact until the next explicit edit. Do not require destructive rewrites.
  await composer(page).fill('정상 이력을 보존한 후속 초안'); await page.clock.fastForward(500)
  expect((await read(page)).inlineResults).toEqual(valid)
  expect(requests).toEqual([])
})

for (const width of [320, 1440]) test(`${width}px 통과 리포트는 같은 스레드에서 원 거래·규칙가를 표시하고 크게 보기 뒤 돌아온다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1000 })
  const requests = await open(page)
  await start(page, 'ETH 추세 1시간봉 손절 5%, 익절 12%'); await settle(page)
  const record = (await read(page)).inlineResults![0]
  const { expected, score } = await expectMetrics(page, record)
  expect(score).toBeGreaterThanOrEqual(80)
  const chart = report(page, 1).getByTestId('inline-report-chart')
  await expect.poll(async () => { await page.clock.runFor(150); return chart.getAttribute('data-status', { timeout: 200 }).catch(() => null) }).toBe('ready')
  await expect(chart).toHaveAttribute('aria-label', /ETH\/USDT/)
  await expect(chart).toHaveAttribute('data-point-count', String(record.parameters.endI - record.parameters.startI + 1))
  await expect(chart).toHaveAttribute('data-marker-count', String(Math.min(40, expected.trades.length) * 2))
  await expect(chart.getByTestId('inline-report-chart-canvas')).toHaveCSS('height', '230px')
  // `ready` means the series was supplied, not that the paused fixture clock
  // has allowed Lightweight Charts' requestAnimationFrame to paint it.
  await expect.poll(async () => {
    await page.clock.runFor(50)
    return chart.getByTestId('inline-report-chart-canvas').evaluate(host => {
      let line = 0, markers = 0
      for (const canvas of host.querySelectorAll('canvas')) {
        const pixels = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height).data
        if (!pixels) continue
        for (let i = 0; i < pixels.length; i += 4) {
          if (pixels[i + 3] < 100) continue
          if (pixels[i + 2] > pixels[i] + 40 && pixels[i + 2] > pixels[i + 1] + 20) line++
          if (pixels[i + 1] > pixels[i] + 35 && pixels[i + 1] > pixels[i + 2] + 20) markers++
        }
      }
      return line > 10 && markers > 10
    })
  }).toBe(true)
  const tradeList = chart.getByTestId('inline-report-chart-trades')
  await tradeList.locator(':scope > summary').click()
  const first = expected.trades.at(-1)!, trade = tradeList.locator('li').first()
  await expect(trade).toHaveAttribute('data-entry-index', String(first.entry))
  await expect(trade).toHaveAttribute('data-exit-index', String(first.exit))
  await trade.locator('summary').click()
  const number = (value: number) => new Intl.NumberFormat('ko', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
  await expect(trade.getByTestId('inline-report-entry-fill')).toHaveText(number(sourceTerminalPrices[first.entry]))
  await expect(trade.getByTestId('inline-report-exit-close')).toHaveText(number(sourceTerminalPrices[first.exit]))
  await expect(trade.getByTestId('inline-report-exit-fill')).toHaveText(number(sourceRuleExitPrice(record.parameters, first)))
  await tradeList.locator(':scope > summary').click()
  await report(page, 1).scrollIntoViewIfNeeded()
  for (const control of await page.locator('.client-inline-backtest .acts button, .gbt[data-bt] > details > summary').all()) {
    const box = await control.boundingBox()
    expect(box?.height).toBeGreaterThanOrEqual(44)
  }
  expect(await page.locator('.gbt').evaluateAll(nodes => nodes.every(node => {
    const box = node.getBoundingClientRect()
    return box.left >= -1 && box.right <= innerWidth + 1 && node.scrollWidth <= node.clientWidth + 1
  }))).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  await page.screenshot({ path: info.outputPath(`inline-report-${width}.png`), fullPage: false })
  await report(page, 1).getByRole('button', { name: '연구 계획서 크게 보기', exact: true }).click()
  await expect(page.getByRole('heading', { name: '연구 계획', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '전략 위임', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
  await expect(report(page, 1)).toBeVisible()
  expect((await read(page)).inlineResults).toEqual([record])
  expect(requests).toEqual([])
})

test('통과 결과의 실행 버튼은 같은 ETH 파라미터로 기존 체험 연결만 열고 재검증·주문을 보내지 않는다', async ({ page }) => {
  const requests = await open(page)
  await start(page, 'ETH 추세 1시간봉 손절 5%, 익절 12%'); await settle(page)
  const before = await read(page), record = before.inlineResults![0]
  await report(page, 1).getByRole('button', { name: '이 전략 실행하기', exact: true }).click()
  await expect(page.getByRole('heading', { name: '어떻게 실행할까요?', exact: true })).toBeVisible()
  await expect(page.getByText('현재는 체험 모드예요. 이 화면의 결제, 연동, 주문은 실제로 실행되지 않습니다.', { exact: true })).toBeVisible()
  const saved = await page.evaluate(id => JSON.parse(sessionStorage.getItem(`teth:client-delegation:${id}`)!), before.id)
  expect(saved).toMatchObject({ inlineResult: true, page: 'connect', questionIndex: 5, workStep: 5, parameters: record.parameters,
    answers: { asset: { index: 1 } } })
  expect(saved.pendingParameters).toBeUndefined()
  const after = await read(page)
  expect(after.turns).toEqual(before.turns)
  expect(after.inlineResults).toEqual(before.inlineResults)
  expect(requests).toEqual([])
})

test('크게 보기의 별도 연구 완료 뒤에도 구형 위임 버튼으로 다른 조건에 진입하지 않는다', async ({ page }) => {
  const requests = await open(page)
  await start(page, 'ETH 추세 1시간봉 손절 5%, 익절 12%'); await settle(page)
  const records = (await read(page)).inlineResults
  await report(page, 1).getByRole('button', { name: '연구 계획서 크게 보기', exact: true }).click()
  await page.getByRole('button', { name: '연구 시작', exact: true }).click()
  await page.clock.fastForward(96_000)
  await page.clock.fastForward(1_300)
  await expect(page.getByRole('heading', { name: '검증 무결성', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '전략 위임', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
  await expect(report(page, 1)).toBeVisible()
  expect((await read(page)).inlineResults).toEqual(records)
  expect(requests).toEqual([])
})
