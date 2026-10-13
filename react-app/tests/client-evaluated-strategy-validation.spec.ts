import { test, expect } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { canonicalCatalogueJson, evaluatedContextLabel, evaluatedListPerformance, evaluatedText, matchesEvaluatedCataloguePin, parseEvaluatedCatalogue } from '../src/client-evaluated-strategy-catalogue'

const artifact = new URL('../../../side-projects/teth-arena/evidence/strategy-discovery/catalogue/catalogue.json', import.meta.url)
const digest = (value: unknown) => createHash('sha256').update(canonicalCatalogueJson(value) + '\n').digest('hex')
const actualEnabled = process.env.VITE_LOCAL_STRATEGY_CATALOGUE === 'true' && existsSync(artifact)
function syntheticDocument() {
  const sha = 'a'.repeat(64)
  const document = { schemaVersion: 'arena-strategy-catalogue-0.1', revision: '', generatedAt: '2026-10-10T00:00:00Z', month: '2026-09', period: { startAt: '2026-09-01T00:00:00Z', endExclusive: '2026-10-01T00:00:00Z' }, source: { monthlySha256: sha, receiptSha256: sha, inputHash: sha, manifestRawSha256: sha, engineSha256: sha }, rights: { scope: 'local_only', publicRedistributionAllowed: false }, counts: { agent: 1, rule: 1, mix: 1 }, items: ['agent', 'rule', 'mix'].map(kind => ({
    id: `eval-${kind}-synthetic`, policyVersionId: '', kind, name: 'Synthetic strategy', description: 'Synthetic stored decisions', symbol: 'BTCUSDT', market: 'crypto', exchange: 'binance', marketType: 'usd_m_perpetual', author: { type: kind === 'rule' ? 'deterministic' : kind === 'mix' ? 'hybrid' : 'model', name: kind === 'rule' ? 'Fixed technical rules' : 'Codex', requestedModel: kind === 'rule' ? null : 'synthetic-model', identityBasis: kind === 'rule' ? null : 'requested_cli_configured' }, sourceAgentId: kind === 'rule' ? null : 'synthetic-account', policy: { mode: 'synthetic' }, provenance: { monthlySha256: sha, receiptSha256: sha, inputHash: sha, engineSha256: sha, sourceAccountSha256: sha, policyDefinitionSha256: '', sourcePolicySha256: sha, originalExecutionStatus: 'verification_failed' }, operation: { status: 'historical_evaluation', actualExecutionReady: false, copyReady: false, issuedStrategyVersionId: null }, evaluation: { basis: kind === 'agent' ? 'stored_ai_policy_replay' : kind === 'mix' ? 'stored_ai_signal_with_rule_gate' : 'deterministic_rule_replay', status: 'evaluated', returnPct: '5', maxDrawdownPct: '2', winRatePct: '100', tradeCount: 1, fillCount: 2, failedDecisionCount: 0 }, equity: Array.from({ length: 31 }, (_, index) => ({ at: new Date(Date.UTC(2026, 8, index + 1)).toISOString().replace('.000Z', 'Z'), value: index === 0 ? '10000' : index === 1 ? '9800' : '10500' })), judgments: Array.from({ length: 29 }, (_, index) => ({ id: `synthetic-${kind}-${index}`, at: new Date(Date.UTC(2026, 8, index + 2)).toISOString().replace('.000Z', 'Z'), sourceAction: index === 0 ? 'open_long' : 'hold', effectiveAction: index === 0 ? 'open_long' : 'hold', status: index === 0 ? 'executed' : 'held', rationale: 'Synthetic rationale', gate: null })), trades: [{ id: `synthetic-trade-${kind}`, openedAt: '2026-09-02T00:15:00Z', closedAt: '2026-09-03T00:00:00Z', side: 'LONG', exitReason: 'take_profit', netPnl: '500', returnPct: '5' }],
  })) }
  for (const row of document.items) {
    row.provenance.policyDefinitionSha256 = digest(row.policy)
    row.policyVersionId = digest({ id: row.id, definitionSha256: row.provenance.policyDefinitionSha256, sourcePolicySha256: sha, sourceAgentId: row.sourceAgentId, mode: row.policy.mode, model: row.author.requestedModel, identityBasis: row.author.identityBasis })
  }
  const body: Record<string, unknown> = { ...document }; delete body.revision; document.revision = digest(body)
  return document
}
const original = actualEnabled ? JSON.parse(readFileSync(artifact, 'utf8')) : syntheticDocument()
type Document = typeof original
const seal = (document: Document) => { const body = { ...document }; delete body.revision; document.revision = digest(body); return document }
const bind = (row: Document['items'][number]) => {
  row.provenance.policyDefinitionSha256 = digest(row.policy)
  row.policyVersionId = digest({ id: row.id, definitionSha256: row.provenance.policyDefinitionSha256, sourcePolicySha256: row.provenance.sourcePolicySha256 ?? null, sourceAgentId: row.sourceAgentId, mode: row.policy.mode || row.policy.sourceMode || null, model: row.author.requestedModel, identityBasis: row.author.identityBasis })
}

test('actual September financial records survive strict presentation validation', async () => {
  test.skip(!actualEnabled, 'Actual private September acceptance requires explicit opt-in and its artifact.')
  const parsed = await parseEvaluatedCatalogue(original)
  expect(parsed.rejected).toBe(0)
  expect(matchesEvaluatedCataloguePin(parsed, original.revision)).toBe(true)
  expect(parsed.items).toEqual(original.items)
  for (const row of parsed.items) expect(evaluatedListPerformance(row).values.every(value => Number.isFinite(value) && value > 0)).toBe(true)
  expect(digest(original)).toBe('3b25f7ce1bc24766adf0eef823fa0e3774381d9c8a1d2bed4dddf218ad931362')
})

const mutations: [string, (document: Document) => void][] = [
  ['MDD below the observed daily lower bound', document => { document.items[0].evaluation.maxDrawdownPct = '0' }],
  ['failed action retained as executed action', document => { const row = document.items[0]; row.judgments[0].status = 'failed'; row.judgments[0].sourceAction = 'open_long'; row.judgments[0].effectiveAction = 'open_long'; row.evaluation.failedDecisionCount = row.judgments.filter((value: { status: string }) => value.status === 'failed').length }],
  ['agent judgment carrying a rule gate', document => { document.items[0].judgments[0].gate = { allowed: false, reason: 'Synthetic gate' } }],
  ['agent source and applied action differ', document => { document.items[0].judgments[0].sourceAction = 'open_short'; document.items[0].judgments[0].effectiveAction = 'hold' }],
  ['judgment chronology reversed', document => { document.items[0].judgments.reverse() }],
  ['judgment duplicate timestamp', document => { document.items[0].judgments[1].at = document.items[0].judgments[0].at }],
  ['missing AI source policy binding', document => { delete document.items[0].provenance.sourcePolicySha256; bind(document.items[0]) }],
  ['structured password publication', document => { document.items[0].policy.password = 'SYNTHETIC_NOT_A_SECRET'; bind(document.items[0]) }],
  ['structured raw price publication', document => { document.items[0].policy.entry_price = 'SYNTHETIC_NO_PRICE'; bind(document.items[0]) }],
  ['password assignment in rationale', document => { document.items[0].judgments[0].rationale = 'password=SYNTHETIC_NOT_A_SECRET' }],
  ['unrecognized private path in rationale', document => { document.items[0].judgments[0].rationale = 'Synthetic file /tmp/SYNTHETIC_NOT_PRIVATE' }],
  ['impossible September calendar day', document => { document.items[0].equity.at(-1).at = '2026-09-31T00:00:00Z' }],
  ['normalized equity exceeds Number range', document => { const row = document.items[0]; row.equity.forEach((point: { value: string }) => { point.value = '1e-200' }); row.equity[1].value = '1e200'; row.evaluation.returnPct = '0'; row.evaluation.maxDrawdownPct = '100' }],
  ['normalized equity underflows to zero', document => { const row = document.items[0]; row.equity.forEach((point: { value: string }) => { point.value = '1e200' }); row.equity[1].value = '1e-200'; row.evaluation.returnPct = '0'; row.evaluation.maxDrawdownPct = '100' }],
  ['24-hour timestamp normalized to the next day', document => { document.items[0].judgments.at(-1).at = '2026-09-29T24:00:00Z' }],
  ['failed judgment carrying a gate', document => { const row = document.items[0]; row.judgments[0] = { ...row.judgments[0], status: 'failed', sourceAction: null, effectiveAction: null, gate: { allowed: false, reason: 'Synthetic gate' } }; row.evaluation.failedDecisionCount = row.judgments.filter((value: { status: string }) => value.status === 'failed').length }],
  ['executed judgment holding without an execution', document => { document.items[0].judgments[0] = { ...document.items[0].judgments[0], status: 'executed', sourceAction: 'hold', effectiveAction: 'hold', gate: null } }],
  ['held judgment showing an entry action', document => { document.items[0].judgments[0] = { ...document.items[0].judgments[0], status: 'held', sourceAction: 'open_long', effectiveAction: 'open_long', gate: null } }],
  ['rejected hold cannot represent a rejected entry or close', document => { document.items[0].judgments[0] = { ...document.items[0].judgments[0], status: 'rejected', sourceAction: 'hold', effectiveAction: 'hold', gate: null } }],
  ['synthetic credential prefix remains private', document => { document.items[0].judgments[0].rationale = 'sk-SYNTHETIC_NOT_A_REAL_CREDENTIAL' }],
]
for (const [name, mutate] of mutations) {
  test(`rejects ${name} and preserves independent rows`, async () => {
    const document = structuredClone(original)
    mutate(document)
    const parsed = await parseEvaluatedCatalogue(seal(document))
    expect(parsed.rejected).toBe(1)
    expect(parsed.items).toEqual(original.items.slice(1))
    expect(matchesEvaluatedCataloguePin(parsed, original.revision)).toBe(false)
  })
}

test('intraminute MDD is retained above the observed daily lower bound', async () => {
  const document = structuredClone(original)
  document.items[0].evaluation.maxDrawdownPct = '100'
  const parsed = await parseEvaluatedCatalogue(seal(document))
  expect(parsed.rejected).toBe(0)
  expect(parsed.items[0].evaluation.maxDrawdownPct).toBe('100')
})

test('a different catalogue month cannot retain the September UI contract', async () => {
  const document = structuredClone(original)
  document.month = '2026-10'
  await expect(parseEvaluatedCatalogue(seal(document))).rejects.toThrow('Invalid local evaluation catalogue')
})

test('mixed rule gate cannot turn a blocked source entry into an executed entry', async () => {
  const document = structuredClone(original)
  const row = document.items.find((value: { kind: string }) => value.kind === 'mix')
  row.judgments[0].sourceAction = 'open_long'
  row.judgments[0].effectiveAction = 'open_long'
  row.judgments[0].gate = { allowed: false, reason: 'Synthetic blocked entry' }
  const parsed = await parseEvaluatedCatalogue(seal(document))
  expect(parsed.rejected).toBe(1)
  expect(parsed.items.map(item => item.id)).not.toContain(row.id)
})

test('publication rejects the complete producer structured field denylist', async () => {
  const prohibited = ['price', 'rawprice', 'entryprice', 'exitprice', 'markprice', 'quantity', 'funding', 'fundingrate', 'candles', 'contractbars', 'markbars', 'fundingevents', 'open', 'high', 'low', 'close', 'volume', 'rawreceipt', 'rawprompt', 'prompttext', 'prompt', 'promptpath', 'apikey', 'credentials', 'news', 'token', 'secret', 'cookie', 'password', 'authorization', 'privatepath']
  for (const field of prohibited) {
    const document = structuredClone(original)
    document.items[0].policy[field] = 'SYNTHETIC_NOT_PRIVATE'
    bind(document.items[0])
    const parsed = await parseEvaluatedCatalogue(seal(document))
    expect(parsed.rejected, field).toBe(1)
  }
})

test('invalid calendar day in document timestamp rejects the whole catalogue', async () => {
  const document = structuredClone(original)
  document.generatedAt = '2026-02-30T00:00:00Z'
  await expect(parseEvaluatedCatalogue(seal(document))).rejects.toThrow('Invalid local evaluation catalogue')
})

test('ordinary risk-adjusted and task compound text is not a credential', async () => {
  for (const rationale of ['risk-adjusted-trend-following', 'task-specific-position-sizing']) {
    const document = structuredClone(original)
    document.items[0].judgments[0].rationale = rationale
    const parsed = await parseEvaluatedCatalogue(seal(document))
    expect(parsed.rejected).toBe(0)
    expect(parsed.items[0].judgments[0].rationale).toBe(rationale)
  }
})

test('mix without a gate preserves the source action and isolates a wrong row', async () => {
  const document = structuredClone(original)
  const row = document.items.find((item: { kind: string }) => item.kind === 'mix')
  row.judgments[0] = { ...row.judgments[0], sourceAction: 'open_long', effectiveAction: 'open_short', status: 'executed', gate: null }
  const parsed = await parseEvaluatedCatalogue(seal(document))
  expect(parsed.rejected).toBe(1)
  expect(parsed.items).toEqual(original.items.filter((item: { id: string }) => item.id !== row.id))
})

test('mix blocked entry has held status and preserves independent rows', async () => {
  const document = structuredClone(original)
  const row = document.items.find((item: { kind: string }) => item.kind === 'mix')
  row.judgments[0] = { ...row.judgments[0], sourceAction: 'open_long', effectiveAction: 'hold', status: 'executed', gate: { allowed: false, reason: 'Synthetic blocked entry' } }
  const parsed = await parseEvaluatedCatalogue(seal(document))
  expect(parsed.rejected).toBe(1)
  expect(parsed.items).toEqual(original.items.filter((item: { id: string }) => item.id !== row.id))
})

test('unknown kind violates document accounting and rejects the document', async () => {
  const document = structuredClone(original)
  document.items[0].kind = 'unknown'
  await expect(parseEvaluatedCatalogue(seal(document))).rejects.toThrow('Invalid local evaluation catalogue')
})

test('rejected open and close attempts retain source actions', async () => {
  for (const action of ['open_long', 'open_short', 'close']) {
    const document = structuredClone(original)
    document.items[0].judgments[0] = { ...document.items[0].judgments[0], sourceAction: action, effectiveAction: action, status: 'rejected', gate: null }
    const parsed = await parseEvaluatedCatalogue(seal(document))
    expect(parsed.rejected).toBe(0)
    expect(parsed.items[0].judgments[0].effectiveAction).toBe(action)
  }
})

test('entry condition labels do not expose gate implementation vocabulary', () => {
  expect(evaluatedText('ja', 'gate')).toBe('エントリー条件')
  expect(evaluatedText('zh-CN', 'gate')).toBe('入场条件')
  expect(evaluatedText('zh-TW', 'gate')).toBe('進場條件')
})

test('one blocked entry has singular labels in English, Spanish and French', () => {
  expect(evaluatedContextLabel('en', 'blocked', 1)).toBe('1 entry blocked')
  expect(evaluatedContextLabel('es', 'blocked', 1)).toBe('1 entrada bloqueada')
  expect(evaluatedContextLabel('fr', 'blocked', 1)).toBe('1 entrée bloquée')
})
