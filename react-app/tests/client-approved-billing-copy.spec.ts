import { expect, test } from '@playwright/test'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type GoldenFixture from './fixtures/approved-client-billing-copy.json'
import { BILLING_COPY, billingText, type BillingCopyKey } from '../src/client-billing-copy'
import { withBillingPreviewNotifications } from '../src/client-billing-notifications'
import { createSourceAccountEventState, type SourceAccountNotification } from '../src/client-account-event-state'
import type { BillingPreviewStoredNotification } from '../src/client-billing-preview-store'
import type { ClientLanguage } from '../src/client-preferences'

const golden = JSON.parse(readFileSync(new URL('./fixtures/approved-client-billing-copy.json', import.meta.url), 'utf8')) as typeof GoldenFixture

// 원9fb 마지막 I18N의 ko/en literal을 독립 기대값으로 사용한다.
// Node 카피/선언된 preview projection 검사이며 page·시계·store·engine·API·실제 과금/권한을 실행하지 않는다.
const bases = ['bill.watch', 'bill.recover', 'bill.uid.novol', 'bill.uid.small', 'bill.uid.heavy',
  'bill.free.out', 'bill.card.out', 'bill.carduid.out', 'bill.dunning', 'bill.card.cross'] as const

function original(key: string, language: 'ko' | 'en') {
  const row = golden.rows.find(value => value.key === key)
  if (!row) throw new Error('독립 골든에 없는 과금 문구 키: ' + key)
  return row[language]
}

function stableSHA(values: Record<string, string>) {
  const sorted = Object.fromEntries(Object.keys(values).sort().map(key => [key, values[key]]))
  return createHash('sha256').update(JSON.stringify(sorted)).digest('hex')
}

function records(): BillingPreviewStoredNotification[] {
  // 의도적으로 섞인 timestamp는 순수 정렬 fixture다. 실제 발생/결제 상태를 합성하지 않는다.
  const times = [200, 500, 300, 100, 500, 250, 450, 150, 350, 400]
  return bases.map((base, index) => ({
    id: 'fixture-billing-' + index, at: times[index], read: index % 2 === 0,
    intent: { key: base + ':fixture', titleKey: base + '.t', bodyKey: base + '.b',
      link: base === 'bill.recover' ? null : '#/plan', data: null },
  }))
}

function existing(): SourceAccountNotification[] {
  return [
    { id: 'fixture-existing-1', at: 500, read: true, key: 'fixture-1',
      type: 'report', link: null, title: 'fixture title 1', body: 'fixture body 1' },
    { id: 'fixture-existing-2', at: 275, read: false, key: 'fixture-2',
      type: 'review', link: '#/plan', title: 'fixture title 2', body: 'fixture body 2' },
  ]
}

test('독립 과금 골든은 원9fb ko/en 20개 literal과 정확한 출처를 고정한다', () => {
  expect(golden.provenance.originalCommit).toBe('9fbff821df62cad11d026022fc7628c7fcebc431')
  expect(golden.provenance.path).toBe('index.html')
  expect(golden.provenance.sha256).toBe('f2475453a03b2646361546ac32002b00e4ce26ee014abf79d3be6262b318e321')
  expect(golden.rows).toHaveLength(20)
  expect(golden.rows.map(row => row.key)).toEqual(bases.flatMap(base => [base + '.t', base + '.b']))
  expect(new Set(golden.rows.map(row => row.key)).size).toBe(20)
  expect(golden.rows.map(row => row.originalLine)).toEqual(Array.from({ length: 20 }, (_, i) => 26464 + i))
})

for (const row of golden.rows) {
  test(`승인 과금 원문 ${row.key}의 한국어·영어 literal을 정확히 보존한다`, () => {
    expect(billingText('ko', row.key as BillingCopyKey)).toBe(row.ko)
    expect(billingText('en', row.key as BillingCopyKey)).toBe(row.en)
  })
}

test('추가 다섯 언어와 공통 아홉 문구는 별도 base9d 보존 범위를 유지한다', () => {
  expect(golden.preservation.baseCommit).toBe('9d919d87be23744fe13484d23d3e88d246e452ad')
  expect(golden.preservation.baseFileSHA).toBe('a8a0296caf92e190b46265651840e0231b5157299e50271115a16a7e45173871')
  expect(golden.preservation.extraLanguages).toEqual(['ja', 'zh-CN', 'zh-TW', 'es', 'fr'])
  expect(golden.preservation.rootKeys).toEqual(['standby', 'standbyValue', 'standbyDescription',
    'blocked', 'storageError', 'unavailable', 'clockSkew', 'retry', 'billingTag'])
  for (const language of golden.preservation.extraLanguages as (keyof typeof golden.preservation.extraLanguageSHA)[]) {
    expect(stableSHA(BILLING_COPY[language])).toBe(golden.preservation.extraLanguageSHA[language])
  }
  for (const language of Object.keys(golden.preservation.rootSHA) as ClientLanguage[]) {
    const values = Object.fromEntries(golden.preservation.rootKeys.map(key => [
      key, BILLING_COPY[language][key as BillingCopyKey],
    ]))
    expect(stableSHA(values)).toBe(golden.preservation.rootSHA[language])
  }
})

for (const language of ['ko', 'en'] as const) {
  test(`과금 preview projection ${language}은 원문·ID·읽음·링크·정렬과 기존 계정 상태를 보존한다`, () => {
    const input = records()
    const prior = existing()
    const account = createSourceAccountEventState({ notifs: prior })
    const inputBefore = JSON.stringify(input)
    const accountBefore = JSON.stringify(account)
    const expected: SourceAccountNotification[] = input.map(record => ({
      id: record.id, at: record.at, read: record.read, key: record.intent.key, type: 'bill',
      link: record.intent.link, title: original(record.intent.titleKey, language),
      body: original(record.intent.bodyKey, language),
    }))
    const result = withBillingPreviewNotifications(account, input, language)
    expect(result.notifs).toEqual([...expected, ...prior].sort((a, b) => b.at - a.at))
    expect(result.notifs.filter(row => row.type === 'bill')).toHaveLength(10)
    expect(result.notifs.some(row => row.type === 'bill' && row.read)).toBe(true)
    expect(result.notifs.some(row => row.type === 'bill' && !row.read)).toBe(true)
    expect(result.notifs.find(row => row.key === 'bill.recover:fixture')?.link).toBeNull()
    expect(result.notifs.filter(row => row.type === 'bill' && row.link === '#/plan')).toHaveLength(9)
    expect(JSON.stringify(input)).toBe(inputBefore)
    expect(JSON.stringify(account)).toBe(accountBefore)
    expect(result).not.toBe(account)
    for (const key of Object.keys(account) as (keyof typeof account)[]) {
      if (key !== 'notifs') expect(result[key]).toBe(account[key])
    }
  })
}

test('과금 projection은 미등록·상속 키를 제외하고 유효한 원문 알림만 남긴다', () => {
  const valid = records()[0]
  const invalid: BillingPreviewStoredNotification[] = [
    { ...valid, id: 'fixture-missing-title', intent: { ...valid.intent, titleKey: 'bill.missing.t' } },
    { ...valid, id: 'fixture-missing-body', intent: { ...valid.intent, bodyKey: 'bill.missing.b' } },
    { ...valid, id: 'fixture-inherited-title', intent: { ...valid.intent, titleKey: 'constructor' } },
    { ...valid, id: 'fixture-inherited-body', intent: { ...valid.intent, bodyKey: 'toString' } },
  ]
  const account = createSourceAccountEventState()
  const result = withBillingPreviewNotifications(account, [...invalid, valid], 'ko')
  expect(result.notifs).toEqual([{
    id: valid.id, at: valid.at, read: valid.read, key: valid.intent.key, type: 'bill',
    link: valid.intent.link, title: original('bill.watch.t', 'ko'), body: original('bill.watch.b', 'ko'),
  }])
  expect(account.notifs).toEqual([])
})

test('과금 projection의 같은 timestamp 순서와 빈 입력의 기존 알림은 안정적으로 유지된다', () => {
  const input = records().slice(0, 2).map(record => ({ ...record, at: 500 }))
  const prior = existing().map(row => ({ ...row, at: 500 }))
  const account = createSourceAccountEventState({ notifs: prior })
  expect(withBillingPreviewNotifications(account, input, 'en').notifs.map(row => row.id))
    .toEqual([input[0].id, input[1].id, prior[0].id, prior[1].id])
  expect(withBillingPreviewNotifications(account, [], 'en').notifs).toEqual(account.notifs)
})
