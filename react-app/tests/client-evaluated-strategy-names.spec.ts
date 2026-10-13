import { test, expect } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { evaluatedStrategyEntryFamily, evaluatedStrategyIdentity, evaluatedStrategyNamingBasis } from '../src/client-evaluated-strategy-identity'
import { canonicalCatalogueJson, parseEvaluatedCatalogue } from '../src/client-evaluated-strategy-catalogue'

const artifactRoot = new URL('../../../side-projects/teth-arena/', import.meta.url)
const catalogueArtifact = process.env.TETH_EVALUATED_ARTIFACT ? resolve(process.env.TETH_EVALUATED_ARTIFACT) : fileURLToPath(new URL('evidence/strategy-discovery/catalogue/catalogue.json', artifactRoot))
const monthlyArtifact = new URL('evidence/september-daily/competition-continuation/monthly.json', artifactRoot)
async function actualCatalogue() {
  test.skip(!existsSync(catalogueArtifact), 'Actual evaluation artifact absent; source-bound naming remains unverified.')
  return parseEvaluatedCatalogue(JSON.parse(readFileSync(catalogueArtifact, 'utf8')))
}

test('source-bound AI and mixed titles are unique without altering the 32 evaluation records', async () => {
  const catalogue = await actualCatalogue(), before = JSON.stringify(catalogue)
  for (const locale of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']) {
    const names = catalogue.items.map(item => evaluatedStrategyIdentity(item, locale).name)
    expect(new Set(names).size, locale).toBe(32)
    for (const name of names) expect(name).not.toMatch(/공격형|기본형|상황형|절제형|Codex|Claude|Gemini|DeepSeek|Kimi|Qwen/i)
  }
  expect(JSON.stringify(catalogue)).toBe(before)
})

test('names follow actual entry classifications and require enough entries for a specific family', () => {
  expect(evaluatedStrategyEntryFamily({ trend_following: 6, breakout: 3, momentum: 1 }, { open_long: 7, open_short: 3 })).toEqual({ family: 'trendBreakout', direction: 'both' })
  expect(evaluatedStrategyEntryFamily({ trend_following: 2, breakout: 1, momentum: 1 }, { open_long: 3, open_short: 1 })).toEqual({ family: 'trend', direction: 'both' })
  expect(evaluatedStrategyEntryFamily({ range: 1 }, { open_long: 1 })).toEqual({ family: 'daily', direction: 'long' })
  expect(evaluatedStrategyEntryFamily({ trend_following: 3 }, { open_long: 3 })).toEqual({ family: 'trend', direction: 'long' })
  expect(evaluatedStrategyEntryFamily({ trend_following: 1, reversal: 1, mean_reversion: 1 }, { open_long: 3 })).toEqual({ family: 'rebound', direction: 'long' })
})

test('all 22 stored profiles match source-bound naming evidence without changing financial records', async () => {
  test.skip(!existsSync(monthlyArtifact), 'Actual monthly artifact absent; all-account classification remains unverified.')
  const sourceBytes = readFileSync(monthlyArtifact)
  const source = JSON.parse(sourceBytes.toString('utf8'))
  const monthlySha256 = createHash('sha256').update(sourceBytes).digest('hex')
  const catalogue = await actualCatalogue()
  const before = JSON.stringify(catalogue)
  let entries = 0
  for (const item of catalogue.items.filter(item => item.kind === 'agent')) {
    const account = source.modes.flatMap((mode: { document: { agents: { id: string; decisions: { action: string; status: string; strategy: string }[] }[] } }) => mode.document.agents).find((account: { id: string }) => account.id === item.sourceAgentId)
    expect(account, item.id).toBeTruthy()
    const counts: Record<string, number> = {}, directions: Record<string, number> = {}
    for (const decision of account.decisions) {
      if (!['open_long', 'open_short'].includes(decision.action) || decision.status !== 'executed') continue
      counts[decision.strategy] = (counts[decision.strategy] ?? 0) + 1
      directions[decision.action] = (directions[decision.action] ?? 0) + 1
      entries++
    }
    const expected = evaluatedStrategyEntryFamily(counts, directions), bound = evaluatedStrategyNamingBasis(item)
    expect(bound, item.id).toBeTruthy()
    expect(item.provenance.monthlySha256, item.id).toBe(monthlySha256)
    const accountSha256 = createHash('sha256').update(canonicalCatalogueJson(account) + '\n').digest('hex')
    expect(bound!.accountSha256, item.id).toBe(accountSha256)
    expect(item.provenance.sourceAccountSha256, item.id).toBe(accountSha256)
    expect({ family: bound!.family, direction: bound!.direction }, item.id).toEqual(expected)
    const title = evaluatedStrategyIdentity(item, 'ko').name
    expect(title).not.toMatch(/공격형|기본형|상황형|절제형|Codex|Claude|Gemini|DeepSeek|Kimi|Qwen/)
    if (!directions.open_short) expect(title).not.toContain('롱숏')
    if (Object.values(counts).reduce((sum, value) => sum + value, 0) < 3) expect(bound!.family).toBe('daily')
  }
  expect(entries).toBe(143)
  expect(JSON.stringify(catalogue)).toBe(before)
})


test('records without trend remain adaptive before long-only rebound classification', () => {
  expect(evaluatedStrategyEntryFamily({ range: 3 }, { open_long: 2, open_short: 1 })).toEqual({ family: 'adaptive', direction: 'both' })
  expect(evaluatedStrategyEntryFamily({ range: 3 }, { open_long: 3 })).toEqual({ family: 'adaptive', direction: 'long' })
  expect(evaluatedStrategyEntryFamily({ reversal: 3 }, { open_long: 3 })).toEqual({ family: 'adaptive', direction: 'long' })
  expect(evaluatedStrategyEntryFamily({ breakout: 2 }, { open_long: 2 })).toEqual({ family: 'daily', direction: 'long' })
})

test('companion families require two entries and rebound leaders with both directions remain adaptive', () => {
  const directions = { open_long: 3, open_short: 2 }
  expect(evaluatedStrategyEntryFamily({ trend_following: 3, breakout: 1 }, directions).family).toBe('trend')
  expect(evaluatedStrategyEntryFamily({ trend_following: 3, momentum: 1 }, directions).family).toBe('trend')
  expect(evaluatedStrategyEntryFamily({ trend_following: 3, mean_reversion: 1 }, directions).family).toBe('trend')
  expect(evaluatedStrategyEntryFamily({ trend_following: 3, breakout: 1, momentum: 1 }, directions).family).toBe('trend')
  expect(evaluatedStrategyEntryFamily({ trend_following: 3, breakout: 2 }, directions).family).toBe('trendBreakout')
  expect(evaluatedStrategyEntryFamily({ trend_following: 3, momentum: 2 }, directions).family).toBe('trendMomentum')
  expect(evaluatedStrategyEntryFamily({ trend_following: 3, breakout: 2, momentum: 2 }, directions).family).toBe('adaptive')
  expect(evaluatedStrategyEntryFamily({ trend_following: 2, mean_reversion: 2, reversal: 1, breakout: 1 }, directions).family).toBe('adaptive')
})

test('small long-only accounts use neutral daily descriptions in all seven locales', async () => {
  const catalogue = await actualCatalogue()
  const dailyItems = catalogue.items.filter(item => item.kind === 'agent' && evaluatedStrategyNamingBasis(item)?.family === 'daily')
  expect(dailyItems.map(item => item.sourceAgentId).sort()).toEqual(['gemini-market_context', 'qwen-market_context', 'qwen-standard'])
  for (const item of dailyItems) {
    expect(evaluatedStrategyNamingBasis(item)?.direction).toBe('long')
    const neutral = { ...item, provenance: { ...item.provenance, monthlySha256: '0'.repeat(64) } }
    for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']) {
      const identity = evaluatedStrategyIdentity(item, language)
      expect(identity.name).not.toBe(evaluatedStrategyIdentity(neutral, language).name)
      expect(identity.description, `${item.sourceAgentId}/${language}`).toBe(evaluatedStrategyIdentity(neutral, language).description)
    }
  }
})


test('short-only entries preserve direction and use neutral families', () => {
  expect(evaluatedStrategyEntryFamily({ trend_following: 3 }, { open_short: 3 })).toEqual({ family: 'adaptive', direction: 'short' })
  expect(evaluatedStrategyEntryFamily({ trend_following: 2 }, { open_short: 2 })).toEqual({ family: 'daily', direction: 'short' })
  expect(evaluatedStrategyEntryFamily({ trend_following: 3, breakout: 2 }, { open_short: 5 })).toEqual({ family: 'adaptive', direction: 'short' })
  expect(evaluatedStrategyEntryFamily({ reversal: 3 }, { open_short: 3 })).toEqual({ family: 'adaptive', direction: 'short' })
})

test('six source-bound rule descriptions use all seven locales without changing thresholds or records', async () => {
  const catalogue = await actualCatalogue(), before = JSON.stringify(catalogue)
  const rules = catalogue.items.filter(item => item.kind === 'rule')
  expect(rules).toHaveLength(6)
  const english = {
    'ema12-26': 'Enter long when EMA12 is above EMA26 and short when it is below. Close on the opposing trend, then re-enter on a later decision.',
    'ema20-50': 'Enter long when EMA20 is above EMA50 and short when it is below. Close on the opposing trend, then re-enter on a later decision.',
    'rsi14-reversal': 'Enter long when RSI14 is at or below 30 and short when it is at or above 70. Close longs at or above 50 and shorts at or below 50.',
    'prior20-breakout': 'Enter long when the confirmed close exceeds the highs of the prior 20 bars and short when it falls below their lows. Close on a breakout of the opposite boundary; exclude the signal bar from the range.',
    'ema-rsi-combination': 'Enter long when EMA20>EMA50 and RSI14>50; enter short when EMA20<EMA50 and RSI14<50. Close longs when EMA20≤EMA50 or RSI14≤50; close shorts when EMA20≥EMA50 or RSI14≥50.',
    'mean20-reversion': 'Enter long when the close is at least 1% below the 20-bar average and short when it is at least 1% above. Close longs at or above the average and shorts at or below it.',
  }
  for (const item of rules) {
    expect(evaluatedStrategyIdentity(item, 'ko').description).toBe(item.description)
    expect(evaluatedStrategyIdentity(item, 'en').description).toBe(english[item.policy.id as keyof typeof english])
    const descriptions = new Set<string>()
    for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']) {
      const description = evaluatedStrategyIdentity(item, language).description
      descriptions.add(description)
      if (language !== 'ko') expect(description).not.toMatch(/[가-힣]/)
      expect(description.match(/\d+/g)?.sort(), `${item.policy.id}/${language}`).toEqual(item.description.match(/\d+/g)?.sort())
    }
    expect(descriptions.size).toBe(7)
  }
  expect(JSON.stringify(catalogue)).toBe(before)
})

test('rule localization falls back to raw text when policy or source binding changes', async () => {
  const catalogue = await actualCatalogue()
  for (const item of catalogue.items.filter(item => item.kind === 'rule')) {
    const changed = [
      { ...item, policy: { ...item.policy, id: 'unrecognized-rule' } },
      { ...item, policy: { ...item.policy, entry: 'Changed entry threshold' } },
      { ...item, policy: { ...item.policy, timing: 'Every hour' } },
      { ...item, policy: { ...item.policy, stop: '200bps' } },
      { ...item, policyVersionId: '0'.repeat(64) },
      ...Object.keys(item.provenance).filter(key => key.endsWith('Sha256') || key === 'inputHash').map(key => ({ ...item, provenance: { ...item.provenance, [key]: '0'.repeat(64) } })),
      { ...item, description: 'Changed source description' },
      { ...item, id: 'eval-rule-other' },
    ]
    for (const unbound of changed) {
      for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']) expect(evaluatedStrategyIdentity(unbound, language).description, `${item.policy.id}/${language}`).toBe(unbound.description)
    }
  }
})
