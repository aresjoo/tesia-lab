import { expect, test } from '@playwright/test'
import { evaluateMockUsageAdmission, type MockUsageAdmissionInput } from '../src/client-usage-admission'
import { billingPreviewMonthSpend, createBillingPreviewState, type BillingPreviewTier } from '../src/client-billing-preview-state'
import { deriveUsagePreview } from '../src/client-usage-presentation'

const owner = 'usage-admission@example.test'
const now = Date.UTC(2026, 9, 2, 3)
function input(tier: BillingPreviewTier = 'CARD_UID', balance = 0, used = 200, extra = 0): MockUsageAdmissionInput {
  const state = { ...createBillingPreviewState(owner), mode: 'watch' as const,
    cardOn: tier === 'CARD' || tier === 'CARD_UID', uidLinked: tier === 'UID' || tier === 'CARD_UID',
    ledger: [{ id: 'grant', at: now, type: 'grant' as const, reason: 'welcome', amt: used + balance, ref: null },
      { id: 'debit', at: now, type: 'debit' as const, reason: 'ai', amt: -used, ref: null }] }
  return { owner, ledger: 'watch', state, storageError: false, supplementalCreditUsd: extra,
    presentation: deriveUsagePreview({ scope: owner, month: '2026-10', tier, usedUsd: used, balanceUsd: balance + extra, resetAt: now + 30 * 864e5 }) }
}

test('quota percentage never erases an unavailable ledger or clock rejection, including guests', () => {
  for (const guest of [false, true]) for (const ledger of ['unavailable', 'clock-skew'] as const) {
    const value = input('CARD_UID', 0, 20, 50)
    expect(evaluateMockUsageAdmission({ ...value, owner: guest ? null : owner, ledger })).toBe(ledger)
  }
})

test('legacy watch stays closed for dunning, old-window FREE exhaustion and missing explicit credit', () => {
  const dunning = input('CARD_UID', 0, 20, 50)
  dunning.state!.cardFails = 3
  expect(dunning.presentation!.pct).toBeLessThan(80)
  expect(evaluateMockUsageAdmission(dunning)).toBe('watch')
  const outsideWindow = input('FREE', 0, 0)
  outsideWindow.state!.ledger = [
    { id: 'old-grant', at: now - 60 * 864e5, type: 'grant', reason: 'welcome', amt: 100, ref: null },
    { id: 'old-debit', at: now - 60 * 864e5, type: 'debit', reason: 'ai', amt: -100, ref: null },
  ]
  expect(billingPreviewMonthSpend(outsideWindow.state!, now) === 0).toBe(true)
  expect(outsideWindow.presentation!.pct).toBe(0)
  expect(evaluateMockUsageAdmission(outsideWindow)).toBe('watch')
  for (const tier of ['FREE', 'UID', 'CARD', 'CARD_UID'] as const) {
    expect(evaluateMockUsageAdmission(input(tier, 0, 0))).toBe('watch')
    if (tier !== 'CARD_UID') expect(evaluateMockUsageAdmission(input(tier, 0, 0, 50))).toBe('watch')
  }
  expect(evaluateMockUsageAdmission(input('CARD_UID', 1, 20, 50))).toBe('watch')
})

test('only current explicit CARD_UID supplemental Mock credit recovers exhausted credit below 100%', () => {
  const value = input('CARD_UID', 0, 200, 50), before = JSON.stringify(value)
  expect(value.presentation!.pct).toBe(80)
  expect(evaluateMockUsageAdmission(value)).toBe('allowed')
  expect(evaluateMockUsageAdmission({ ...value, presentation: { ...value.presentation!, pct: 100 } })).toBe('watch')
  expect(evaluateMockUsageAdmission({ ...value, supplementalCreditUsd: 0 })).toBe('watch')
  expect(evaluateMockUsageAdmission({ ...value, state: { ...value.state!, mode: 'active' } })).toBe('watch')
  expect(JSON.stringify(value)).toBe(before)
})

test('storage errors, missing/mismatched owners and service projections cannot grant Mock admission', () => {
  const value = input('CARD_UID', 0, 200, 50)
  expect(evaluateMockUsageAdmission({ ...value, storageError: true })).toBe('unavailable')
  expect(evaluateMockUsageAdmission({ ...value, state: null })).toBe('unavailable')
  expect(evaluateMockUsageAdmission({ ...value, presentation: null })).toBe('unavailable')
  expect(evaluateMockUsageAdmission({ ...value, state: { ...value.state!, owner: 'other-owner' } })).toBe('unavailable')
  expect(evaluateMockUsageAdmission({ ...value, presentation: { ...value.presentation!, scope: 'other-owner' } })).toBe('unavailable')
  expect(evaluateMockUsageAdmission({ ...value, presentation: { ...value.presentation!, source: 'service' } })).toBe('unavailable')
  expect(evaluateMockUsageAdmission({ ...value, presentation: { ...value.presentation!, pct: Number.NaN } })).toBe('unavailable')
  expect(evaluateMockUsageAdmission({ ...value, supplementalCreditUsd: Number.NaN })).toBe('unavailable')
})

test('allowed ledger still respects quota100; guest has no borrowed quota or credit authority', () => {
  const full = input()
  expect(evaluateMockUsageAdmission({ ...full, ledger: 'allowed' })).toBe('watch')
  const normal = input('CARD_UID', 0, 20)
  expect(evaluateMockUsageAdmission({ ...normal, ledger: 'allowed' })).toBe('allowed')
  expect(evaluateMockUsageAdmission({ ...full, owner: null, state: null, presentation: null, ledger: 'allowed' })).toBe('allowed')
  expect(evaluateMockUsageAdmission({ ...full, owner: null, state: null, presentation: null })).toBe('watch')
  expect(evaluateMockUsageAdmission({ ...full, owner: null, ledger: 'allowed', storageError: true })).toBe('unavailable')
})
