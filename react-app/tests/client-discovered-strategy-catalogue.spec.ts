import { test, expect } from '@playwright/test'
import { catalogueHash, parseDiscoveredCatalogue, discoveredPresentation, discoveredDisplayNames } from '../src/client-discovered-strategy-catalogue'
import { parseEvaluatedCatalogue } from '../src/client-evaluated-strategy-catalogue'
import { evaluatedStrategyIdentity } from '../src/client-evaluated-strategy-identity'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { readDiscoveredCatalogue } from '../src/use-discovered-strategy-catalogue'
import { mergeDiscoveredCatalogue } from '../src/use-evaluated-strategy-catalogue'
import { matchesStrategyClassification } from '../src/client-strategy-classification'
import { evaluatedJudgmentHeading, evaluatedDetailText } from '../src/client-evaluated-detail-copy'
import type { ClientLanguage } from '../src/client-preferences'

const discoveredArtifact = new URL('../../../side-projects/teth-arena/.cache/strategy-discovery-bitget/catalogue-provenance-corrected.json', import.meta.url)
const originalArtifact = new URL('../../../side-projects/teth-arena/evidence/strategy-discovery/catalogue/catalogue.json', import.meta.url)

/** Closed synthetic read fixture, never a model-generation or execution receipt. */
async function fixture(negative = false) {
  const start = Date.parse('2026-09-01T00:00:00Z'), source = { inputHash: 'a'.repeat(64), engineSha256: 'b'.repeat(64), candidatesSha256: 'c'.repeat(64), generationManifestSha256: 'd'.repeat(64), evaluatorSha256: 'e'.repeat(64) }
  const policy = { family: 'ema_trend', params: { fast: negative ? 3 : 2, slow: negative ? 5 : 4 }, allocationBps: 2500, stopLossBps: 150, takeProfitBps: 300, maxHoldHours: 2, cooldownHours: 0, leverage: 1, decisionIntervalHours: 1, indicatorCalculation: { ema: 'first_confirmed_close_seed_recursive_2_over_p_plus_1', rsi: 'last_p_close_deltas_gain_loss_sums_flat50_no_loss100', range: 'prior_lookback_high_low_excluding_signal_bar', momentum: 'close_over_prior_lookback_close_bps' } }
  const digest = await catalogueHash(policy)
  const proof = { provider: 'codex', requestedModel: 'gpt-6.1-codex', actualModel: null, identityBasis: 'requested_cli_configured', promptSha256: 'f'.repeat(64), responseSha256: 'f'.repeat(64), receiptSha256: 'f'.repeat(64), status: 'completed', candidateIds: ['synthetic-policy'] }
  const trades = negative ? Array.from({ length: 20 }, (_, i) => ({ id: `synthetic-trade-${i}`, side: 'LONG', openedAt: new Date(start + (24 + i * 2) * 3600000).toISOString(), closedAt: new Date(start + (25 + i * 2) * 3600000).toISOString(), netPnl: '-2', exitReason: 'decision_close' })) : []
  const item = { id: `generated-${digest.slice(0, 24)}`, name: negative ? '1시간 EMA 3·5 추세' : '1시간 EMA 2·4 추세', kind: 'agent', symbol: 'BTCUSDT', exchange: 'binance', author: { type: 'model', name: proof.provider, requestedModel: proof.requestedModel, identityBasis: proof.identityBasis }, policyVersionId: `policy_${digest}`, policy: { ...policy, rationale: '합성 확정 봉 정책 검증' }, provenance: { policySha256: digest, ...source, candidateIds: ['synthetic-policy'], generationProofs: [proof] }, evaluation: { basis: 'ai_generated_rule_replay', status: 'evaluated', returnPct: negative ? '-0.4' : '0', maxDrawdownPct: negative ? '0.4' : '0', winRatePct: negative ? '0' : null, tradeCount: trades.length, fillCount: 2 * trades.length, decisionCount: 696, failedDecisionCount: 0, eligible: negative, feesUsd: negative ? '1' : '0', fundingUsd: '0' }, equity: Array.from({ length: 31 }, (_, i) => ({ at: new Date(start + i * 86400000).toISOString(), value: negative && i > 2 ? '9960' : '10000' })), trades, judgments: Array.from({ length: 696 }, (_, i) => ({ id: `synthetic-decision-${i}`, at: new Date(start + 86400000 + i * 3600000).toISOString(), sourceAction: 'hold', effectiveAction: 'hold', status: 'held', rationale: '합성 규칙 관측', gate: null })), operation: { status: 'historical_evaluation', actualExecutionReady: false, copyReady: false, issuedStrategyVersionId: null } }
  const body = { schemaVersion: 'arena-strategy-discovery-0.1', generatedAt: '2026-10-12T00:00:00Z', month: '2026-09', period: { startAt: '2026-09-01T00:00:00Z', endExclusive: '2026-10-01T00:00:00Z' }, source, counts: { received: 1, unique: 1, duplicates: 0, evaluated: 1, eligible: negative ? 1 : 0, failed: 0 }, items: [item], failures: [] }
  return { ...body, revision: await catalogueHash(body) }
}
async function reseal(value: Awaited<ReturnType<typeof fixture>>) {
  const body = Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'revision'))
  value.revision = await catalogueHash(body)
}
test('separate contract preserves zero and eligible negative results, hourly judgments and absent trade returns', async () => {
  const zero = await parseDiscoveredCatalogue(await fixture()), loss = await parseDiscoveredCatalogue(await fixture(true))
  expect(zero.items[0].evaluation.tradeCount).toBe(0)
  expect(zero.items[0].evaluation.eligible).toBe(false)
  expect(loss.items[0].evaluation.returnPct).toBe('-0.4')
  expect(loss.items[0].evaluation.eligible).toBe(true)
  const before = JSON.stringify(loss), view = discoveredPresentation(loss.items[0], 'f'.repeat(64))
  expect(view.kind).toBe('rule')
  expect(view.author).toEqual(loss.items[0].author)
  expect(view.trades.every(t => t.returnPct === null)).toBe(true)
  expect(view.judgments).toHaveLength(696)
  expect(view.operation.copyReady).toBe(false)
  expect(JSON.stringify(loss)).toBe(before)
  await expect(parseEvaluatedCatalogue(loss)).rejects.toThrow()
})
test('hash, policy, generation, selection and hourly evidence drift fail closed despite a rehashed body', async () => {
  const original = await fixture(true)
  const mutants: ((v: typeof original) => void)[] = [
    v => { v.items[0].policy.decisionIntervalHours = 2 },
    v => { v.items[0].provenance.inputHash = '0'.repeat(64) },
    v => { v.items[0].provenance.generationProofs[0].candidateIds = ['unrelated-policy'] },
    v => { v.items[0].evaluation.eligible = false },
    v => { v.items[0].judgments[1].at = v.items[0].judgments[0].at },
    v => { v.items[0].operation.actualExecutionReady = true },
    v => { v.counts.failed = 1 },
    v => { Object.assign(v.items[0].policy, { hiddenRule: true }) },
    v => { v.items[0].trades[0].netPnl = 'NaN' },
  ]
  for (const mutate of mutants) {
    const value = structuredClone(original); mutate(value); await reseal(value)
    await expect(parseDiscoveredCatalogue(value)).rejects.toThrow()
  }
  original.revision = '0'.repeat(64)
  await expect(parseDiscoveredCatalogue(original)).rejects.toThrow()
})

test('actual immutable 36 candidates preserve 25 eligible results and all 68 source-bound titles are distinct', async () => {
  const path = new URL('../../../side-projects/teth-arena/.cache/strategy-discovery-bitget/catalogue-provenance-corrected.json', import.meta.url)
  const bytes = readFileSync(path), before = createHash('sha256').update(bytes).digest('hex')
  const document = await parseDiscoveredCatalogue(JSON.parse(bytes.toString('utf8')))
  expect(document.counts).toEqual({ received: 36, unique: 36, duplicates: 0, evaluated: 36, eligible: 25, failed: 0 })
  expect(document.items.filter(i => i.evaluation.eligible && Number(i.evaluation.returnPct) < 0)).toHaveLength(21)
  expect(document.items.reduce((count, i) => count + i.evaluation.tradeCount, 0)).toBe(1821)
  const original = await parseEvaluatedCatalogue(JSON.parse(readFileSync(new URL('../../../side-projects/teth-arena/evidence/strategy-discovery/catalogue/catalogue.json', import.meta.url), 'utf8')))
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']) {
    const names = [...original.items.map(i => evaluatedStrategyIdentity(i, language).name), ...discoveredDisplayNames(document.items, language).values()]
    expect(new Set(names).size, language).toBe(68)
    for (const name of names) expect(name).not.toMatch(/공격형|기본형|상황형|절제형|Codex|Claude|Gemini|DeepSeek|Kimi|Qwen/i)
  }
  const reads: string[] = [], request = async (url: string | URL | Request, init?: RequestInit) => { reads.push(String(url)); expect(init?.method).toBe('GET'); expect(init?.credentials).toBe('omit'); return new Response(bytes, { headers: { 'content-type': 'application/json' } }) }
  const loaded = await readDiscoveredCatalogue(document.revision, request as typeof fetch, new AbortController().signal)
  expect(loaded.sourceSha).toBe(before)
  expect(reads).toEqual(['/__teth/discovered-strategies.json'])
  await expect(readDiscoveredCatalogue('0'.repeat(64), request as typeof fetch, new AbortController().signal)).rejects.toThrow()
  expect(createHash('sha256').update(readFileSync(path)).digest('hex')).toBe(before)
})

test('generated rules merge into chart31 while original AI22 and hybrid4 keep exact records and source bindings', async () => {
  const bytes = readFileSync(discoveredArtifact), originalBytes = readFileSync(originalArtifact)
  const discovery = await parseDiscoveredCatalogue(JSON.parse(bytes.toString('utf8')))
  const original = await parseEvaluatedCatalogue(JSON.parse(originalBytes.toString('utf8')))
  const originalRecords = original.items.map(item => JSON.stringify(item)), generatedBefore = JSON.stringify(discovery)
  const sourceSha = createHash('sha256').update(bytes).digest('hex')
  const combined = mergeDiscoveredCatalogue(original, discovery, sourceSha)!
  expect(combined.counts).toEqual({ agent: 22, rule: 31, mix: 4 })
  expect(combined.items).toHaveLength(57)
  for (const [kind, total] of [['agent', 22], ['rule', 31], ['mix', 4]] as const) {
    expect(combined.items.filter(item => matchesStrategyClassification(item, kind, 'crypto'))).toHaveLength(total)
  }
  expect(combined.items.slice(0, 32).map(item => JSON.stringify(item))).toEqual(originalRecords)
  const generated = combined.items.filter(item => item.discovery)
  expect(generated).toHaveLength(25)
  expect(generated.filter(item => Number(item.evaluation.returnPct) < 0)).toHaveLength(21)
  for (const item of generated) {
    const source = discovery.items.find(raw => raw.id === item.id)!
    expect(item.kind).toBe('rule'); expect(item.author).toEqual(source.author)
    expect(item.policy).toEqual(source.policy); expect(item.provenance).toEqual(source.provenance)
    expect(item.evaluation).toEqual(source.evaluation); expect(item.equity).toEqual(source.equity)
    expect(item.judgments).toEqual(source.judgments)
    expect(combined.sourceBindings?.[item.id]).toEqual({ sourceSha, sourceId: item.id, schema: 'arena-strategy-discovery-0.1' })
    for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as ClientLanguage[]) {
      expect(evaluatedJudgmentHeading(language, item.kind)).toBe(evaluatedDetailText(language, 'rule'))
    }
  }
  expect(JSON.stringify(discovery)).toBe(generatedBefore)
  expect(readFileSync(originalArtifact)).toEqual(originalBytes)
  expect(readFileSync(discoveredArtifact)).toEqual(bytes)
})

test('source duplicate remains an error instead of relabelling or dropping the original strategy', async () => {
  const discovery = await parseDiscoveredCatalogue(JSON.parse(readFileSync(discoveredArtifact, 'utf8')))
  const original = await parseEvaluatedCatalogue(JSON.parse(readFileSync(originalArtifact, 'utf8')))
  const before = JSON.stringify(original)
  const repeated = { ...discovery, items: [{ ...discovery.items.find(item => item.evaluation.eligible)!, id: original.items[0].id }] }
  expect(mergeDiscoveredCatalogue(original, repeated, 'f'.repeat(64))).toBeNull()
  expect(JSON.stringify(original)).toBe(before)
})

test('actual catalogue tabs and details show generated rule signals while keeping original AI and rule text', async ({ page }) => {
  test.skip(process.env.VITE_LOCAL_STRATEGY_CATALOGUE !== 'true' || process.env.VITE_LOCAL_STRATEGY_DISCOVERY !== 'true', 'Explicit local catalogue and discovery opt-in required.')
  const bytes = readFileSync(discoveredArtifact), originalBytes = readFileSync(originalArtifact)
  const discovery = await parseDiscoveredCatalogue(JSON.parse(bytes.toString('utf8')))
  const original = await parseEvaluatedCatalogue(JSON.parse(originalBytes.toString('utf8')))
  const selected = discovery.items.filter(item => item.evaluation.eligible).sort((a, b) => Number(b.evaluation.returnPct) - Number(a.evaluation.returnPct) || b.evaluation.tradeCount - a.evaluation.tradeCount || a.id.localeCompare(b.id, 'en'))
  const reads: string[] = [], errors: string[] = []
  page.on('pageerror', error => errors.push(String(error)))
  for (const [url, body] of [['**/__local/strategy-catalogue.json', originalBytes], ['**/__teth/discovered-strategies.json', bytes]] as const) {
    await page.route(url, route => { reads.push(route.request().url()); expect(route.request().method()).toBe('GET'); return route.fulfill({ contentType: 'application/json', body }) })
  }
  await page.route('**/__teth/execution-minimum*', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"status":"failed","reason":"FIXTURE_UNAVAILABLE"}' }))
  await page.addInitScript(() => { if (!localStorage.getItem('tethLang')) localStorage.setItem('tethLang', 'ko') })
  await page.goto('/#/share')
  const cards = page.locator('.strategy-list-grid .strategy-list-card a')
  await expect(cards.first()).toHaveAttribute('href', new RegExp(selected[0].id))
  const filter = page.locator('.strategy-kind-group')
  for (const [kind, title, count] of [['all', '전체', 57], ['agent', 'AI 판단', 22], ['rule', '차트 규칙', 31], ['mix', '혼합 전략', 4]] as const) {
    await filter.getByRole('button', { name: title, exact: true }).click()
    const ids: string[] = []
    for (let number = 1; number <= Math.ceil(count / 10); number++) {
      if (number > 1) await page.getByRole('button', { name: `${number}페이지`, exact: true }).click()
      await expect(cards).toHaveCount(Math.min(10, count - (number - 1) * 10))
      ids.push(...await cards.evaluateAll(nodes => nodes.map(node => node.getAttribute('href')!)))
    }
    expect(new Set(ids).size).toBe(count)
    if (kind === 'all') for (const [index, item] of selected.entries()) expect(ids[index]).toContain(item.id)
    if (kind === 'agent') expect(ids.every(id => !id.includes('generated-'))).toBe(true)
    if (kind === 'rule') expect(ids.filter(id => id.includes('generated-'))).toHaveLength(25)
  }
  const generated = selected.find(item => item.judgments.slice(-3).some(judgment => judgment.sourceAction === 'close')) ?? selected[0]
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as ClientLanguage[]) {
    await page.evaluate(async value => {
      const path = '/src/client-preferences.ts'
      const { setClientPreference } = await import(/* @vite-ignore */ path)
      setClientPreference('language', value)
    }, language)
    await page.goto(`/#/share/s/${generated.id}/all`)
    const detail = page.locator('[data-evaluated-strategy]')
    await expect(detail).toHaveAttribute('data-policy-version', generated.policyVersionId)
    await expect(detail.locator('.catalogue-judgments h3')).toHaveText(evaluatedJudgmentHeading(language, 'rule'))
    const newest = [...generated.judgments].reverse().slice(0, 3)
    for (const judgment of newest) {
      const row = detail.locator(`[data-evaluated-judgment="${judgment.id}"]`)
      await expect(row).toHaveAttribute('data-source-rationale', judgment.rationale!)
      await expect(row).toContainText(judgment.rationale!.replace(/ · 모델 생성 규칙을 결정론적으로 평가$/, ''))
      await expect(row).not.toContainText('모델 생성 규칙을 결정론적으로 평가')
    }
    await expect(detail.locator('.shared-detail-title .ss3-dsub')).toContainText(evaluatedStrategyIdentity(discoveredPresentation(generated, 'f'.repeat(64)), language).byline)
  }
  await page.evaluate(async () => {
    const path = '/src/client-preferences.ts'
    const { setClientPreference } = await import(/* @vite-ignore */ path)
    setClientPreference('language', 'ko')
  })
  for (const kind of ['agent', 'rule'] as const) {
    const item = original.items.find(row => row.kind === kind)!
    await page.goto(`/#/share/s/${item.id}/all`)
    const detail = page.locator('[data-evaluated-strategy]')
    await expect(detail.locator('.catalogue-judgments h3')).toHaveText(evaluatedJudgmentHeading('ko', kind))
    if (kind === 'agent') await expect(detail.locator('[data-evaluated-judgment]').first()).toContainText([...item.judgments].reverse()[0].rationale!)
    else await expect(detail.locator('[data-evaluated-judgment]').first()).toContainText(evaluatedStrategyIdentity(item, 'ko').description)
  }
  expect(reads.some(url => url.endsWith('/__local/strategy-catalogue.json'))).toBe(true)
  expect(reads.some(url => url.endsWith('/__teth/discovered-strategies.json'))).toBe(true)
  expect(errors).toEqual([])
  expect(readFileSync(originalArtifact)).toEqual(originalBytes); expect(readFileSync(discoveredArtifact)).toEqual(bytes)
})
