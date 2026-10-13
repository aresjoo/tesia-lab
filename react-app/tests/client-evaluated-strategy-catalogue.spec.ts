import { expect, test } from '@playwright/test'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { parseEvaluatedCatalogue, evaluatedListPerformance, localCatalogueEnabled, canonicalCatalogueJson, matchesEvaluatedCataloguePin } from '../src/client-evaluated-strategy-catalogue'
import { evaluatedStrategyIdentity } from '../src/client-evaluated-strategy-identity'
import { evaluatedDetailText, evaluatedPeriodLabel } from '../src/client-evaluated-detail-copy'

// Hand-calculated accounting example: 100 → 98 → 105, +5%; costs already included.
const sha = 'a'.repeat(64)
function document() {
  const item = { id: 'eval-example', policyVersionId: sha, kind: 'agent', name: 'Codex example', description: 'Stored decisions', symbol: 'BTCUSDT', market: 'crypto', exchange: 'binance', marketType: 'usd_m_perpetual', author: { type: 'model', name: 'Codex', requestedModel: 'gpt-example', identityBasis: 'requested_cli_configured' }, sourceAgentId: 'account-example', policy: { mode: 'fixed' }, evaluation: { basis: 'stored_ai_policy_replay', status: 'evaluated', returnPct: '5', maxDrawdownPct: '2', winRatePct: '100' as string | null, tradeCount: 1, fillCount: 2, failedDecisionCount: 0 }, equity: [{ at: '2026-09-01T00:00:00Z', value: '100' }, { at: '2026-09-02T00:00:00Z', value: '98' }, { at: '2026-09-30T23:59:00Z', value: '105' }], judgments: [{ id: 'decision-1', at: '2026-09-02T00:00:00Z', sourceAction: 'open_long', effectiveAction: 'open_long', status: 'executed', rationale: 'Original rationale', gate: null as { allowed: boolean; reason: string } | null }], trades: [{ id: 'trade-1', openedAt: '2026-09-02T00:15:00Z', closedAt: '2026-09-03T00:00:00Z', side: 'LONG', exitReason: 'take_profit', netPnl: '5', returnPct: '5' }], operation: { status: 'historical_evaluation', actualExecutionReady: false, copyReady: false, issuedStrategyVersionId: null }, provenance: { monthlySha256: sha, receiptSha256: sha, inputHash: sha, engineSha256: sha, sourceAccountSha256: sha, policyDefinitionSha256: sha, sourcePolicySha256: sha, originalExecutionStatus: 'verification_failed' } }
  bind(item)
  return { schemaVersion: 'arena-strategy-catalogue-0.1', revision: '', generatedAt: '2026-10-10T00:00:00Z', month: '2026-09', period: { startAt: '2026-09-01T00:00:00Z', endExclusive: '2026-10-01T00:00:00Z' }, source: { monthlySha256: sha, receiptSha256: sha, inputHash: sha, manifestRawSha256: sha, engineSha256: sha }, rights: { scope: 'local_only', publicRedistributionAllowed: false }, counts: { agent: 1, rule: 0, mix: 0 }, items: [item] }
}
function hash(value: unknown) { return createHash('sha256').update(canonicalCatalogueJson(value) + '\n').digest('hex') }
function bind(item: ReturnType<typeof document>['items'][number]) { item.provenance.policyDefinitionSha256 = hash(item.policy); item.policyVersionId = hash({ id: item.id, definitionSha256: item.provenance.policyDefinitionSha256, sourcePolicySha256: item.provenance.sourcePolicySha256, sourceAgentId: item.sourceAgentId, mode: item.policy.mode || null, model: item.author.requestedModel, identityBasis: item.author.identityBasis }) }
function seal<T extends ReturnType<typeof document>>(value: T) { const body: Record<string, unknown> = { ...value }; delete body.revision; value.revision = hash(body); return value }

test('actual September producer binds all 32 unique strategies with the Arena canonical LF', async () => {
  const artifact = new URL('../../../side-projects/teth-arena/evidence/strategy-discovery/catalogue/catalogue.json', import.meta.url)
  test.skip(!existsSync(artifact), 'Local actual evaluation artifact not supplied; actual producer binding remains unverified.')
  const input: unknown = JSON.parse(readFileSync(artifact, 'utf8'))
  const parsed = await parseEvaluatedCatalogue(input)
  expect(parsed.revision).toBe('0e56f400822aa76b01dffc7ee4a92c65d0b0d8ac306f9df9eac88ed8ee70eeba')
  expect(parsed.rejected).toBe(0)
  expect(matchesEvaluatedCataloguePin(parsed, '0e56f400822aa76b01dffc7ee4a92c65d0b0d8ac306f9df9eac88ed8ee70eeba')).toBe(true)
  expect(matchesEvaluatedCataloguePin(parsed, 'b'.repeat(64))).toBe(false)
  expect(matchesEvaluatedCataloguePin({ ...parsed, rejected: 1 }, parsed.revision)).toBe(false)
  expect(matchesEvaluatedCataloguePin({ ...parsed, items: parsed.items.slice(1) }, parsed.revision)).toBe(false)
  expect(matchesEvaluatedCataloguePin({ ...parsed, items: parsed.items.map((item, index) => index ? item : { ...item, equity: item.equity.slice(1) }) }, parsed.revision)).toBe(false)
  expect(parsed.items).toHaveLength(32)
  expect(new Set(parsed.items.map(item => item.id)).size).toBe(32)
  for (const [kind, total] of [['agent', 22], ['rule', 6], ['mix', 4]] as const) expect(parsed.items.filter(item => item.kind === kind)).toHaveLength(total)
  expect(new Set(parsed.items.filter(item => item.kind === 'agent').map(item => item.author.name))).toEqual(new Set(['Codex', 'Claude', 'Gemini', 'DeepSeek', 'Kimi', 'Qwen']))
  expect(parsed.items.some(item => item.author.name === 'Grok')).toBe(false)
  expect(parsed.items.filter(item => item.kind === 'agent' && evaluatedListPerformance(item).percent < 0)).toHaveLength(16)
})

test('explicit DEV opt-in is required; default preview/service/production remain gated', () => {
  expect(localCatalogueEnabled(true, 'localhost', false)).toBe(false)
  expect(localCatalogueEnabled(true, 'localhost', false, false)).toBe(false)
  for (const host of ['localhost', '127.0.0.1', '[::1]']) expect(localCatalogueEnabled(true, host, false, true)).toBe(true)
  expect(localCatalogueEnabled(false, 'localhost', false, true)).toBe(false)
  expect(localCatalogueEnabled(true, 'teth.ai', false, true)).toBe(false)
  expect(localCatalogueEnabled(true, 'localhost', true, true)).toBe(false)
})
test('real observation times and accounting return are preserved without daily padding', async () => {
  const parsed = await parseEvaluatedCatalogue(seal(document()))
  expect(parsed.rejected).toBe(0)
  const result = evaluatedListPerformance(parsed.items[0])
  expect(result.percent).toBe(5)
  expect(result.values).toEqual([1, .98, 1.05])
  expect(result.end - result.start).toBe(29 * 86400000 + 86340000)
})
test('tampered revision, counts, types, missing provenance and execution authority fail closed', async () => {
  const tampered = seal(document()); tampered.items[0].evaluation.returnPct = '6'
  await expect(parseEvaluatedCatalogue(tampered)).rejects.toThrow()
  const wrongCounts = document(); wrongCounts.counts.agent = 2
  await expect(parseEvaluatedCatalogue(seal(wrongCounts))).rejects.toThrow()
  const version = document(); version.schemaVersion = 'preview'
  await expect(parseEvaluatedCatalogue(seal(version))).rejects.toThrow()
  for (const mutate of [
    (row: ReturnType<typeof document>['items'][number]) => { row.operation.copyReady = true },
    (row: ReturnType<typeof document>['items'][number]) => { row.evaluation.returnPct = 'NaN' },
    (row: ReturnType<typeof document>['items'][number]) => { row.evaluation.tradeCount = -1 },
    (row: ReturnType<typeof document>['items'][number]) => { Object.assign(row.evaluation, { tradeCount: true }) },
    (row: ReturnType<typeof document>['items'][number]) => { row.evaluation.winRatePct = '50' },
    (row: ReturnType<typeof document>['items'][number]) => { row.evaluation.failedDecisionCount = 1 },
    (row: ReturnType<typeof document>['items'][number]) => { row.evaluation.maxDrawdownPct = '-1' },
    (row: ReturnType<typeof document>['items'][number]) => { row.judgments[0].sourceAction = 'long' },
    (row: ReturnType<typeof document>['items'][number]) => { row.author.name = 'Grok' },
    (row: ReturnType<typeof document>['items'][number]) => { row.policy.mode = 'edited-after-evaluation' },
    (row: ReturnType<typeof document>['items'][number]) => { row.policyVersionId = 'b'.repeat(64) },
    (row: ReturnType<typeof document>['items'][number]) => { row.provenance.engineSha256 = 'b'.repeat(64) },
    (row: ReturnType<typeof document>['items'][number]) => { row.judgments[0].rationale = 'Bearer example_token_value' },
    (row: ReturnType<typeof document>['items'][number]) => { row.equity[1].at = '2026-10-02T00:00:00Z' },
    (row: ReturnType<typeof document>['items'][number]) => { row.equity[1].value = '0' },
    (row: ReturnType<typeof document>['items'][number]) => { row.equity.reverse() },
    (row: ReturnType<typeof document>['items'][number]) => { row.provenance.sourceAccountSha256 = '' },
  ]) { const value = document(); mutate(value.items[0]); const parsed = await parseEvaluatedCatalogue(seal(value)); expect(parsed.items).toHaveLength(0); expect(parsed.rejected).toBe(1) }
})

test('producer exponent Decimals remain finite and zero completed trades have no invented win rate', async () => {
  const value = document(), row = value.items[0]
  row.evaluation.returnPct = '5e0'; row.evaluation.maxDrawdownPct = '2E0'; row.evaluation.tradeCount = 0; row.evaluation.winRatePct = null; row.trades = []
  const parsed = await parseEvaluatedCatalogue(seal(value))
  expect(parsed.rejected).toBe(0); expect(parsed.items[0].evaluation.winRatePct).toBeNull()
})
test('one malformed row cannot erase a separate intact strategy; zero and losses are shown honestly', async () => {
  const value = document(); const loss = structuredClone(value.items[0]); loss.id = 'eval-loss'; loss.equity.at(-1)!.value = '97'; loss.evaluation.returnPct = '-3'; loss.evaluation.maxDrawdownPct = '3';
  const zero = structuredClone(value.items[0]); zero.id = 'eval-zero'; zero.equity.at(-1)!.value = '100'; zero.evaluation.returnPct = '0';
  const bad = structuredClone(value.items[0]); bad.id = 'eval-bad'; bad.evaluation.returnPct = 'Infinity'
  for (const row of [loss, zero, bad]) bind(row)
  value.items.push(loss, zero, bad); value.counts.agent = 4
  const parsed = await parseEvaluatedCatalogue(seal(value))
  expect(parsed.items.map(item => evaluatedListPerformance(item).percent)).toEqual([5, -3, 0]); expect(parsed.rejected).toBe(1)
  const duplicate = document(); duplicate.items.push(structuredClone(duplicate.items[0])); duplicate.counts.agent = 2
  await expect(parseEvaluatedCatalogue(seal(duplicate))).rejects.toThrow()
})

test('DEV shares evaluate independently; historical detail and direct preview URL survive reload', async ({ page }, info) => {
  test.skip(process.env.VITE_LOCAL_STRATEGY_CATALOGUE !== 'true', 'Requires explicit evaluated catalogue opt-in.')
  const fixture = seal(document())
  await page.route('**/__local/strategy-catalogue.json', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(fixture) }))
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await page.goto('/#/share')
  const cards = page.locator('.strategy-list-card')
  await expect(cards).toHaveCount(1)
  await expect(page.locator('.client-strategy-sharing > .ss3-boundary')).toHaveCount(0)
  if (info.project.name === 'mobile') {
    const nav = await page.locator('.client-auth-nav').boundingBox(), filters = await page.locator('.strategy-filters').boundingBox()
    expect(nav!.height).toBeGreaterThanOrEqual(44)
    expect(filters!.y).toBeGreaterThanOrEqual(nav!.y + nav!.height)
  }
  await expect(cards.locator('.skf-ret')).toContainText('9월 수익률')
  await expect(cards).toContainText('+5.0%')
  await expect(cards).not.toContainText('Binance에서 실행')
  await cards.getByRole('link').click()
  await expect(page.locator('.ss3-dtitle')).toHaveText('대표 코인 매일 방향 고르기')
  await expect(page.locator('.ss3-dsub')).toContainText('9월 기록 · BTCUSDT')
  await expect(page.locator('.catalogue-judgments h3')).toHaveText('9월 판단 기록')
  await expect(page.locator('[data-evaluated-metric="ret"] small')).toHaveText('9월 전체 수익률')
  await expect(page.locator('.client-strategy-sharing > .ss3-boundary')).toHaveCount(0)
  if (info.project.name === 'mobile') {
    const nav = await page.locator('.client-auth-nav').boundingBox(), crumb = await page.locator('.tfbk-bc').boundingBox()
    expect(crumb!.y).toBeGreaterThanOrEqual(nav!.y + nav!.height)
  }
  await expect(page.locator('[data-evaluated-metric="ret"] b')).toHaveText('+5.0%')
  await expect(page.locator('[data-evaluated-judgment]')).toContainText('Original rationale')
  await expect(page.locator('[data-evaluated-trade]')).toContainText('5')
  await expect(page.getByRole('button', { name: '전략 복사하기', exact: true })).toBeDisabled()
  await page.reload()
  await expect(page.locator('.ss3-dtitle')).toHaveText('대표 코인 매일 방향 고르기')
  await page.getByRole('tab', { name: '전략 정보', exact: true }).click()
  await expect(page.locator('[data-policy-version]')).toHaveAttribute('data-policy-version', fixture.items[0].policyVersionId)
  await expect(page.locator('.shared-detail-info')).not.toContainText(sha)
  await expect(page.locator('.shared-detail-info')).toContainText('판단 기준저장된 9월 AI 판단')
  await page.goto('/#/share/s/f1')
  await expect(page.locator('.catalogue-source-header')).toBeVisible()
  await expect(page.locator('.client-strategy-sharing > .ss3-boundary')).toHaveCount(1)
  await expect(page.locator('.client-strategy-sharing')).not.toHaveClass(/is-evaluated/)
  await expect(page.locator('.ss3-dtitle')).not.toHaveText('대표 코인 매일 방향 고르기')
  expect(errors).toEqual([])
})

test('missing local catalogue shows read failure and retry, without preview success fallback', async ({ page }) => {
  test.skip(process.env.VITE_LOCAL_STRATEGY_CATALOGUE !== 'true', 'Requires explicit evaluated catalogue opt-in.')
  let unavailable = true
  await page.route('**/__local/strategy-catalogue.json', route => route.fulfill(unavailable ? { status: 503, contentType: 'application/json', body: '{"error":"private path omitted"}' } : { contentType: 'application/json', body: JSON.stringify(seal(document())) }))
  await page.goto('/#/share')
  await expect(page.locator('.strategy-list-card')).toHaveCount(0)
  await expect(page.getByText('9월 평가 자료를 읽지 못했어요.', { exact: false })).toBeVisible()
  unavailable = false
  await page.getByRole('button', { name: '다시 시도', exact: true }).click()
  await expect(page.locator('.strategy-list-card')).toHaveCount(1)
})

test('a failed refresh preserves the last valid detail and keeps failure plus retry visible', async ({ page }, info) => {
  test.skip(process.env.VITE_LOCAL_STRATEGY_CATALOGUE !== 'true', 'Requires explicit evaluated catalogue opt-in.')
  const partial = document(), bad = structuredClone(partial.items[0]); bad.id = 'eval-agent-bad'; bad.operation.copyReady = true; bind(bad)
  partial.items.push(bad); partial.counts.agent = 2
  let stage = 'partial'
  await page.route('**/__local/strategy-catalogue.json', route => route.fulfill(stage === 'error' ? { status: 503, contentType: 'application/json', body: '{}' } : { contentType: 'application/json', body: JSON.stringify(stage === 'partial' ? seal(partial) : seal(document())) }))
  await page.goto('/#/share')
  await expect(page.locator('.strategy-list-card')).toHaveCount(1)
  stage = 'error'
  await page.getByRole('button', { name: '다시 시도', exact: true }).click()
  await expect(page.getByText('9월 평가 자료를 읽지 못했어요.', { exact: false })).toBeVisible()
  await page.locator('.strategy-list-card').getByRole('link').click()
  await expect(page.locator('.ss3-dtitle')).toHaveText('대표 코인 매일 방향 고르기')
  await expect(page.getByText('9월 평가 자료를 읽지 못했어요.', { exact: false })).toBeVisible()
  stage = 'ready'
  if (info.project.name === 'mobile') {
    const nav = await page.locator('.client-auth-nav').boundingBox(), retry = await page.getByRole('button', { name: '다시 시도', exact: true }).boundingBox()
    expect(nav!.height).toBeGreaterThanOrEqual(44)
    expect(retry!.y).toBeGreaterThanOrEqual(nav!.y + nav!.height)
  }
  await page.getByRole('button', { name: '다시 시도', exact: true }).click()
  await expect(page.getByText('9월 평가 자료를 읽지 못했어요.', { exact: false })).toHaveCount(0)
  await expect(page.locator('.ss3-dtitle')).toHaveText('대표 코인 매일 방향 고르기')
})

// Presentation-only engine cases; these are not an actual evaluation ledger.
test('engine exit, flat and flip gate, rejection labels never expose enum codes', async ({ page }) => {
  test.skip(process.env.VITE_LOCAL_STRATEGY_CATALOGUE !== 'true', 'Requires explicit evaluated catalogue opt-in.')
  const value = document(), row = value.items[0]
  row.equity.at(-1)!.at = '2026-10-01T00:00:00Z'; row.equity.at(-1)!.value = '130'
  row.evaluation.returnPct = '30'; row.evaluation.tradeCount = 7; row.evaluation.fillCount = 14; row.evaluation.winRatePct = '85.71428571'
  row.trades = ['decision_close', 'decision_flip', 'stop_loss', 'take_profit', 'liquidation', 'liquidation_funding'].map((exitReason, index) => ({ ...row.trades[0], id: `exit-${index}`, exitReason }))
  row.trades.push({ ...row.trades[0], id: 'exit-zero', exitReason: 'unknown_engine_reason', netPnl: '0', returnPct: '0' })
  row.kind = 'mix'; row.author.type = 'hybrid'; row.evaluation.basis = 'stored_ai_signal_with_rule_gate'; value.counts = { agent: 0, rule: 0, mix: 1 }
  row.judgments = [
    { ...row.judgments[0], id: 'flat-block', status: 'held', effectiveAction: 'hold', gate: { allowed: false, reason: 'Confirmed EMA20/50 direction blocks flat entry' } },
    { ...row.judgments[0], id: 'flip-pass', at: '2026-09-03T00:00:00Z', gate: { allowed: true, reason: 'Confirmed EMA20/50 direction permits flip entry' } },
    { ...row.judgments[0], id: 'same-side-rejection', at: '2026-09-04T00:00:00Z', status: 'rejected' },
  ] as typeof row.judgments
  bind(row)
  await page.route('**/__local/strategy-catalogue.json', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(seal(value)) }))
  await page.goto('/#/share/s/eval-example')
  await expect(page.locator('[data-evaluated-judgment="flat-block"]')).toContainText('신규 진입 차단')
  await expect(page.locator('[data-evaluated-judgment="flip-pass"]')).toContainText('방향 전환 허용')
  await expect(page.locator('[data-evaluated-judgment="same-side-rejection"] h4')).toContainText('거절')
  await page.locator('.catalogue-orders h3 button').click()
  for (const label of ['판단 청산', '방향 전환 청산', '손절', '익절', '강제 청산', '펀딩에 따른 강제 청산']) await expect(page.locator('.catalogue-orders-full [data-evaluated-trade] td:nth-child(2) small').filter({ hasText: label }).first()).toBeVisible()
  await page.getByRole('button', { name: '개요로 돌아가기', exact: true }).first().click()
  await expect(page.locator('.catalogue-overview-svg text').filter({ hasText: /^10\.01$/ })).toHaveCount(1)
  await page.locator('.catalogue-orders h3 button').click()
  await expect(page.locator('.catalogue-orders-full [data-evaluated-trade="exit-zero"] td:last-child small')).not.toHaveClass(/catalogue-gain|catalogue-loss/)
  await expect(page.locator('.catalogue-orders-full [data-evaluated-trade="exit-zero"] td:nth-child(2) small')).toHaveText('—')
  for (const selector of ['.catalogue-orders-full', '.catalogue-judgments']) await expect(page.locator(selector)).not.toContainText(/decision_close|decision_flip|stop_loss|take_profit|liquidation|unknown_engine_reason|Confirmed EMA|flat entry|flip entry/)
})

test('actual rule and mixed details retain evidence while showing Korean context and neutral zero', async ({ page }) => {
  test.skip(process.env.VITE_LOCAL_STRATEGY_CATALOGUE !== 'true', 'Requires explicit evaluated catalogue opt-in.')
  const artifact = new URL('../../../side-projects/teth-arena/evidence/strategy-discovery/catalogue/catalogue.json', import.meta.url)
  test.skip(!existsSync(artifact), 'Actual producer artifact absent; actual UI is unverified.')
  const body = readFileSync(artifact, 'utf8')
  await page.route('**/__local/strategy-catalogue.json', route => route.fulfill({ contentType: 'application/json', body }))
  await page.goto('/#/share/s/eval-rule-mean20-reversion')
  await expect(page.locator('.ss3-dsub')).toContainText('고정 기술 규칙')
  await expect(page.locator('.ss3-dsub')).toContainText('9월 기록 · BTCUSDT')
  await expect(page.locator('.catalogue-judgments h3')).toHaveText('규칙 기록')
  await expect(page.locator('.ss3-ddescription')).toContainText('15분봉 기준 · 하루 1회')
  await expect(page.locator('[data-evaluated-metric="ret"] b')).not.toHaveClass(/catalogue-gain|catalogue-loss/)
  await expect(page.locator('.catalogue-overview-chart')).toContainText('변화')
  await expect(page.locator('[data-evaluated-judgment] p').first()).toContainText('1% 이상')
  await expect(page.locator('[data-evaluated-judgment] p').first()).not.toContainText('mean20 short')
  await page.getByRole('tab', { name: '전략 정보', exact: true }).click()
  await expect(page.locator('.shared-detail-info')).toContainText('작성 방식')
  await expect(page.locator('.shared-detail-info')).not.toContainText('Fixed technical rules')
  await expect(page.locator('.shared-detail-info')).toContainText('판단 기준확정 15분봉 · 하루 1회')
  await page.goto('/#/share/s/eval-mix-gemini-ema-gate')
  await expect(page.locator('.ss3-dsub')).toContainText('9월 기록 · BTCUSDT')
  await expect(page.locator('.catalogue-judgments h3')).toHaveText('AI 판단·추세 조건 기록')
  await expect(page.locator('.ss3-ddescription')).toHaveText('저장된 9월 AI 진입 신호가 EMA20·50 방향과 맞을 때 진입합니다. 명시적 청산은 그대로 따릅니다.')
  await expect(page.locator('.catalogue-judgments')).toContainText('진입 차단 4회')
  await expect(page.locator('.catalogue-performance')).toContainText('월말 보유 포지션 평가손익 포함')
  await page.getByRole('tab', { name: '전략 정보', exact: true }).click()
  await expect(page.locator('.shared-detail-info')).toContainText('요청 모델')
  await expect(page.locator('.shared-detail-info')).toContainText('운용 정책')
  await expect(page.locator('.shared-detail-info')).toContainText('판단 기준저장된 9월 AI 판단 · EMA20·50 조건')
})

test('strategy names describe recorded trading while financial identity remains unchanged', async () => {
  const artifact = new URL('../../../side-projects/teth-arena/evidence/strategy-discovery/catalogue/catalogue.json', import.meta.url)
  test.skip(!existsSync(artifact), 'Actual producer artifact absent; naming binding remains unverified.')
  const catalogue = await parseEvaluatedCatalogue(JSON.parse(readFileSync(artifact, 'utf8')))
  const before = canonicalCatalogueJson(catalogue)
  for (const item of catalogue.items) for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']) {
    const identity = evaluatedStrategyIdentity(item, language)
    expect(identity.name).not.toMatch(/Codex|Claude|Gemini|DeepSeek|Qwen|Kimi|공격형|기본형|상황형|절제형|aggressive|standard|disciplined|market.context/i)
    expect(identity.name).not.toMatch(/코인 둘|코인 셋|기술주|네 시장|OKX|Bitget/)
    expect(identity.name.length).toBeGreaterThan(4)
    for (const days of [7, 30, 0]) expect(evaluatedPeriodLabel(language as Parameters<typeof evaluatedPeriodLabel>[0], days)).toMatch(/9월|9月|September|septiembre|septembre/i)
    expect(evaluatedDetailText(language as Parameters<typeof evaluatedDetailText>[0], 'mixDescription')).toMatch(/September|9月|9월|septiembre|septembre/i)
  }
  expect(canonicalCatalogueJson(catalogue)).toBe(before)
})

test('actual detail restores source controls, calendar, judgments and full-trade navigation', async ({ page }, info) => {
  test.skip(process.env.VITE_LOCAL_STRATEGY_CATALOGUE !== 'true', 'Requires explicit evaluated catalogue opt-in.')
  const artifact = new URL('../../../side-projects/teth-arena/evidence/strategy-discovery/catalogue/catalogue.json', import.meta.url)
  test.skip(!existsSync(artifact), 'Actual producer artifact absent; original detail flow remains unverified.')
  const body = readFileSync(artifact, 'utf8'), catalogue = await parseEvaluatedCatalogue(JSON.parse(body))
  const item = catalogue.items.find(row => row.id === 'eval-agent-gemini-aggressive')!
  await page.route('**/__local/strategy-catalogue.json', route => route.fulfill({ contentType: 'application/json', body }))
  await page.goto('/#/share/s/eval-agent-gemini-aggressive/all')
  await expect(page.locator('.ss3-dtitle')).toHaveText(evaluatedStrategyIdentity(item, 'ko').name)
  await expect(page.locator('.shared-detail-tools .shared-detail-share')).toBeEnabled()
  await expect(page.locator('.shared-detail-watch')).toBeEnabled()
  await expect(page.getByRole('button', { name: '전략 복사하기', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: '직접 검증하기', exact: true })).toBeDisabled()
  await expect(page.locator('[data-evaluated-metric="mdd"] b')).toContainText('-')
  await expect(page.locator('[data-evaluated-metric="win"] b')).toHaveText('—')
  await expect(page.locator('.catalogue-overview-chart')).toHaveAttribute('data-point-count', '31')
  await expect(page.locator('[data-evaluated-metric="ret"] small')).toHaveText('9월 전체 수익률')
  const select = page.getByLabel('기간 선택', { exact: true })
  await expect(select.locator('option[value="7"]')).toHaveText('9월 마지막 7일')
  await expect(select.locator('option[value="30"]')).toHaveText('9월 전체')
  await expect(select.locator('option[value="0"]')).toHaveText('9월 전체 기록')
  await expect(select.locator('option[value="90"]')).toBeDisabled()
  await expect(select.locator('option[value="365"]')).toBeDisabled()
  await select.selectOption('7')
  await expect(page.locator('[data-evaluated-metric="ret"] small')).toHaveText('9월 마지막 7일 수익률')
  await expect(page.locator('.catalogue-overview-chart')).toHaveAttribute('data-point-count', '8')
  await expect(page.locator('[data-evaluated-metric="mdd"] b')).toHaveText('—')
  const first = Number(item.equity.at(-8)!.value), last = Number(item.equity.at(-1)!.value)
  await expect(page.locator('[data-evaluated-metric="ret"] b')).toHaveText(`${(last / first - 1) * 100 >= 0 ? '+' : ''}${((last / first - 1) * 100).toFixed(1)}%`)
  await select.selectOption('30')
  await page.getByRole('button', { name: '수익금', exact: true }).click()
  await expect(page.locator('.catalogue-overview-chart')).toHaveAttribute('data-chart-mode', 'pnl')
  await expect(page.locator('.catalogue-chart-hint')).toContainText('10,000 USDT')
  await page.getByRole('button', { name: '잔고', exact: true }).click()
  await expect(page.locator('.catalogue-overview-chart')).toHaveAttribute('data-chart-mode', 'bal')
  await page.locator('.catalogue-overview-svg').focus()
  await page.keyboard.press('End')
  await expect(page.locator('.catalogue-value-tip')).toContainText('10,908.55 USDT')
  await page.getByRole('button', { name: '월별', exact: true }).click()
  await expect(page.locator('.catalogue-overview-chart')).toHaveAttribute('data-point-count', '2')
  await page.getByRole('button', { name: '일별', exact: true }).click()
  await page.getByRole('button', { name: '수익률', exact: true }).click()
  await select.selectOption('0')
  await expect(page.locator('[data-evaluated-metric="ret"] small')).toHaveText('9월 전체 기록 수익률')
  await expect(page.locator('.catalogue-overview-chart')).toHaveAttribute('data-point-count', '31')
  await expect(page.locator('.cal-g [data-evaluated-calendar-day]')).toHaveCount(30)
  const daily = await page.locator('[data-daily-return]').evaluateAll(nodes => nodes.map(node => Number(node.getAttribute('data-daily-return'))))
  expect((daily.reduce((value, percent) => value * (1 + percent / 100), 1) - 1) * 100).toBeCloseTo(Number(item.evaluation.returnPct), 7)
  await expect(page.locator('[data-evaluated-judgment]')).toHaveCount(3)
  await page.getByRole('button', { name: '이전 기록 26건 보기', exact: true }).click()
  await expect(page.locator('[data-evaluated-judgment]')).toHaveCount(29)
  for (const judgment of item.judgments) await expect(page.locator(`[data-evaluated-judgment="${judgment.id}"]`)).toHaveAttribute('data-source-rationale', judgment.rationale ?? '')
  await page.locator('.catalogue-judgments-more').click()
  await expect(page.locator('[data-evaluated-judgment]')).toHaveCount(3)
  await page.locator('.catalogue-orders h3 button').click()
  await expect(page).toHaveURL(/\/all\/trades$/)
  await expect(page.locator('.catalogue-orders-full')).toBeVisible()
  await expect(page.locator('.catalogue-orders-full [data-evaluated-trade]')).toHaveCount(item.trades.length)
  await expect(page.locator('.catalogue-performance')).toBeHidden()
  await page.getByRole('button', { name: '개요로 돌아가기', exact: true }).first().click()
  await expect(page.locator('.catalogue-performance')).toBeVisible()
  await expect(select).toHaveValue('0')
  await page.getByRole('button', { name: '더 보기', exact: true }).click()
  await expect(page.getByRole('menuitem', { name: 'TETH에게 분석시키기', exact: true })).toBeDisabled()
  await expect(page.getByRole('menuitem', { name: '링크 복사', exact: true })).toBeEnabled()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toHaveCount(0)
  if (info.project.name === 'mobile') expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('evaluated detail copies its actual URL and keeps guest favorites behind the original signup flow', async ({ page, context }) => {
  test.skip(process.env.VITE_LOCAL_STRATEGY_CATALOGUE !== 'true', 'Requires explicit evaluated catalogue opt-in.')
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.route('**/__local/strategy-catalogue.json', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(seal(document())) }))
  await page.goto('/#/share/s/eval-example/all')
  await page.locator('.shared-detail-share').click()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(page.url())
  await expect(page.getByRole('status').filter({ hasText: '전략 링크를 복사했습니다' })).toBeVisible()
  await page.locator('.shared-detail-watch').click()
  await expect(page.locator('.ca-auth')).toContainText('로그인 또는 회원가입')
  expect(await page.evaluate(() => sessionStorage.getItem('teth-sharing-watch:guest'))).toBeNull()
  await page.locator('.ca-auth').getByRole('button', { name: '닫기', exact: true }).click()
  await expect(page.locator('.ca-auth')).toHaveCount(0)
  await expect(page.locator('.shared-detail-watch')).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('.shared-detail-watch')).toBeFocused()
})

test('evaluated favorites use existing preview account storage and survive library and reload', async ({ page }) => {
  test.skip(process.env.VITE_LOCAL_STRATEGY_CATALOGUE !== 'true', 'Requires explicit evaluated catalogue opt-in.')
  await page.addInitScript(() => {
    if (sessionStorage.getItem('evaluated-watch-fixture')) return
    sessionStorage.setItem('evaluated-watch-fixture', 'ready')
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '전략 확인', email: 'evaluated-watch@example.test' }))
  })
  await page.route('**/__local/strategy-catalogue.json', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(seal(document())) }))
  await page.goto('/#/share/s/eval-example/all')
  await page.locator('.shared-detail-watch').click()
  await expect(page.locator('.shared-detail-watch')).toHaveAttribute('aria-pressed', 'true')
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('teth-sharing-watch:account:evaluated-watch%40example.test')!))).toEqual(['eval-example'])
  await page.goto('/#/share/library')
  await expect(page.locator('.client-library-watches')).toBeVisible()
  await expect(page.locator('.client-library-watches .strategy-list-card')).toContainText('대표 코인 매일 방향 고르기')
  await page.locator('.client-library-watches .strategy-list-card').getByRole('link').click()
  await expect(page.locator('.shared-detail-watch')).toHaveAttribute('aria-pressed', 'true')
  await page.reload()
  await expect(page.locator('.shared-detail-watch')).toHaveAttribute('aria-pressed', 'true')
  await page.locator('.shared-detail-watch').click()
  await expect(page.locator('.shared-detail-watch')).toHaveAttribute('aria-pressed', 'false')
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('teth-sharing-watch:account:evaluated-watch%40example.test')!))).toEqual([])
})
