import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { CLIENT_RESEARCH_FIXTURE as fixture, researchPercent as pct } from '../src/client-research-fixtures'
import { evaluateSourceTerminal } from '../src/client-terminal-source-fixture'
import { MOCK_RESEARCH_ENTRIES } from '../src/mock-research-preview'

test('오프라인 캡처는 바뀐 원본 기간·가격 길이를 조용히 수용하지 않는다', () => {
  // Run the real capture guards with isolated git/file transports, no repository writes.
  const script = readFileSync('scripts/capture-client-research.mjs', 'utf8').replace(/^import .*$/gm, '')
  const declaration = 'var DEV_END=909, HOLD_START=910, FULL_END=1334;'
  const run = (html: string) => vm.runInNewContext(script, {
    process: { argv: ['node', 'capture', '/fixture', 'a'.repeat(40)] },
    execFileSync: () => html, vm,
    readFileSync: () => { throw new Error('Unexpected target read') },
    console: { log: () => { throw new Error('Unexpected emitted patch') } },
  }, { timeout: 1500 })
  for (const source of ['', declaration.replace('909', '908'), declaration + declaration]) {
    expect(() => run(source)).toThrow('Research data boundaries changed')
  }
  const wrongLength = `function mulberry32(a) {} const PRICE = Array(1334).fill(1); /* ═══════════ backtest flow */ ${declaration} function cloneParams(p,extra) {} /* ── Research Plan ── */`
  expect(() => run(wrongLength)).toThrow('Research data length or partition changed')
})

test('보고서·단계 로그는 같은 원본 엔진의 수치와 판정을 사용한다', () => {
  const report = fixture.report, result = fixture.versions[1]
  expect(report.bestYearPnl).toBe(result.byYear[report.bestYear].pnl * 100)
  expect(report.worstYearPnl).toBe(result.byYear[report.worstYear].pnl * 100)
  expect(report.verdict.grade).toEqual(['가상 검증 권장', 'v-good'])
  expect(report.opinions.map(row => [row.who, row.v])).toEqual([
    ['Strategy Architect', 'Pass'], ['Quant Validator', 'Pass'], ['Risk Reviewer', 'Caution'], ['Market Context', 'Pass'],
  ])
  expect(report.sanity).toHaveLength(8)
  expect(report.sanity.every(check => check.p)).toBe(true)
  expect(report.backtestCount).toBe(11)
  expect(report.cliff).toBe(false)
  for (const row of report.sensitivity) {
    const captured = evaluateSourceTerminal({ sl: -3, tp: 8, rsiTh: row.th, trendFilter: true, startI: 61, endI: 909 }, 1).r
    expect(row.ret).toBe(captured.ret)
    if (row.th === 40) {
      for (const key of ['mdd', 'n', 'winRate', 'pf'] as const) expect(result[key]).toBe(captured[key])
      for (const key of ['bestYear', 'bestYearPnl', 'worstYear', 'worstYearPnl'] as const) expect(report[key]).toBe(captured[key])
    }
  }
  expect(MOCK_RESEARCH_ENTRIES.find(row => row.id === 'stability')!.summary).toBe('파라미터 안정성 검사, +13%, +13%, +8% → 안정 구간')
  expect(MOCK_RESEARCH_ENTRIES.find(row => row.id === 'market')!.summary).toContain('연구 2023.01 ~ 2025.06, 봉인 구간 유지')
})

async function seed(page: Page, active = 'report') {
  await page.addInitScript(active => {
    if (sessionStorage.getItem('report-body-seeded')) return
    sessionStorage.setItem('report-body-seeded', '1')
    localStorage.setItem('tethLanguage', 'ko')
    const id = 'report-body'
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: id, homeDraft: '', sessions: [{ id, title: '사용자의 제목', renamed: true, idea: '사용자 질문', draft: '', pair: 'BTC/USDT', mode: 'dip', phase: 'plan', timeframe: '일봉', risk: '-3%', takeProfit: '+8%', workspace: 'research', researchStatus: '검토 필요', turns: [], updatedAt: 1 }] }))
    sessionStorage.setItem(`teth-research-preview:restored:${id}`, JSON.stringify({ seconds: 95, status: 'completed', view: 'activity', questions: [] }))
    sessionStorage.setItem(`teth-client-research-documents:${id}`, JSON.stringify({ active, tabs: ['plan', 'report'], rowDrafts: { 'plan:Research 데이터': 'Research 원문 유지', 'plan:Holdout 데이터': '봉인 원문 유지' }, edits: { 'Research 데이터': '고객 지정 기간 2020–2022' }, drafts: { report: 'Paper와 Holdout 원문 질문' }, replies: [{ doc: 'report', question: 'What-if 원문 질문', answer: 'Research Integrity 원문 답변' }] }))
  }, active)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
}

test('원본 보고서 문구·만약에·차트 복귀와 저장한 원문이 함께 유지된다', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await seed(page)
  await expect(page.locator('.rw-verdict')).toHaveText(fixture.report.verdict.line + fixture.report.verdict.grade[0])
  await expect(page.locator('.g-vstat .k')).toHaveText(['연구 수익', '봉인 구간 수익', '최대 낙폭', '수익 팩터'])
  await expect(page.locator('.rw-evidence')).toContainText(`2023년 ${pct(fixture.report.bestYearPnl)}`)
  await expect(page.locator('.rw-workspace')).toContainText('위험 심사는 낙폭과 손실 지속 기간 측면에서 보류')
  await expect(page.getByRole('heading', { name: '검증 무결성', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: '만약에', exact: true })).toBeVisible()
  await expect(page.locator('.rw-workspace')).toContainText('백테스트 11회, 무결성 검사 8/8, 수정 1회, 봉인 구간 유지')
  for (const [index, label] of ['수수료 2배', '진입 1캔들 지연', '손절 -2%'].entries()) {
    await page.getByRole('button', { name: label, exact: true }).click()
    const result = fixture.whatif[index]
    await expect(page.locator('.rw-workspace')).toContainText(`만약에 · ${label}, 수익 ${pct(Number(result[1]))}, 낙폭 ${Number(result[2]).toFixed(1)}%, ${result[3]}회 (정식 연구 아님)`)
    await expect(page.getByLabel('검증 결과에 질문')).toHaveValue('Paper와 Holdout 원문 질문')
  }
  await page.reload()
  await expect(page.getByLabel('검증 결과에 질문')).toHaveValue('Paper와 Holdout 원문 질문')
  await expect(page.locator('.rw-workspace')).toContainText('Research Integrity 원문 답변')
  await expect(page.locator('.rw-workspace')).toContainText('백테스트 11회')
  await page.getByRole('button', { name: '차트로 자세히 보기', exact: true }).click()
  await expect(page.locator('.ra-analysis')).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('heading', { name: '검증 무결성', exact: true })).toBeVisible()
  await expect(page.getByLabel('검증 결과에 질문')).toHaveValue('Paper와 Holdout 원문 질문')
  expect(errors).toEqual([])
})

test('계획의 새 표시 라벨은 과거 저장 키·기간·초안을 덮어쓰지 않는다', async ({ page }) => {
  await seed(page, 'plan')
  await page.getByRole('button', { name: '연구 데이터 수정 요청', exact: true }).click()
  await expect(page.getByLabel('연구 데이터 코멘트')).toHaveValue('Research 원문 유지')
  await expect(page.locator('.g-row').filter({ hasText: '연구 데이터' })).toContainText('고객 지정 기간 2020–2022')
  await page.getByRole('button', { name: '봉인 구간 수정 요청', exact: true }).click()
  await expect(page.getByLabel('봉인 구간 코멘트')).toHaveValue('봉인 원문 유지')
  await expect(page.locator('.g-row').filter({ hasText: '봉인 구간' })).toContainText('2025.07 ~ 2026.08, 연구에 쓰지 않은 최근 데이터')
  await page.evaluate(async () => { const path = '/src/client-preferences.ts'; (await import(path)).setClientPreference('language', 'en') })
  await expect(page.getByLabel('Research 데이터 코멘트')).toHaveValue('Research 원문 유지')
  await page.reload()
  await page.getByRole('button', { name: 'Research 데이터 수정 요청', exact: true }).click()
  await expect(page.getByLabel('Research 데이터 코멘트')).toHaveValue('Research 원문 유지')
  const saved = await page.evaluate(() => JSON.parse(sessionStorage.getItem('teth-client-research-documents:report-body')!))
  expect(saved.rowDrafts).toEqual({ 'plan:Research 데이터': 'Research 원문 유지', 'plan:Holdout 데이터': '봉인 원문 유지' })
  expect(saved.edits).toEqual({ 'Research 데이터': '고객 지정 기간 2020–2022' })
  await page.evaluate(async () => { const path = '/src/client-preferences.ts'; (await import(path)).setClientPreference('language', 'ko') })
  await page.getByLabel('연구 데이터 코멘트').fill('다른 기간도 확인해주세요')
  await page.getByLabel('연구 데이터 코멘트').press('Enter')
  await expect(page.locator('.rw-user-message').last()).toHaveText('연구 데이터: 다른 기간도 확인해주세요')
  await page.reload()
  const submitted = await page.evaluate(() => JSON.parse(sessionStorage.getItem('teth-client-research-documents:report-body')!))
  expect(submitted.rowDrafts).toEqual({ 'plan:Research 데이터': '', 'plan:Holdout 데이터': '봉인 원문 유지' })
  expect(submitted.edits).toEqual(saved.edits)
  await expect(page.locator('.rw-user-message').last()).toHaveText('연구 데이터: 다른 기간도 확인해주세요')
})

test('보고서·긴 봉인 구간 문구는 좁은 화면에서도 페이지를 밀어내지 않는다', async ({ page }) => {
  await seed(page)
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(page.locator('.rw-verdict .g-tag')).toBeVisible()
    await expect(page.locator('.rw-workspace .meta')).toContainText('데모: 표준 샘플 데이터로 검증 과정을 시연 중')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px report`).toBe(true)
    await page.getByRole('tab', { name: '연구 계획', exact: true }).click()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px plan`).toBe(true)
    await page.getByRole('tab', { name: '검증 결과', exact: true }).click()
  }
})
