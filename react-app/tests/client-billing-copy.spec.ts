import { expect, test } from '@playwright/test'
import { BILLING_COPY, billingText, type BillingCopyKey } from '../src/client-billing-copy'
import type { ClientLanguage } from '../src/client-preferences'

const languages: readonly ClientLanguage[] = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']

const original = {
  'bill.watch.t': { ko: '크레딧이 소진되어 잠시 관망 모드로 전환했어요', en: 'Credits ran out, switching to standby' },
  'bill.watch.b': { ko: '실행 중인 손절과 목표가 관리는 그대로 유지돼요. 충전이나 연동 즉시 다시 시작할 수 있어요.', en: 'Your stop-loss and take-profit rules stay active. Recharge or link to resume instantly.' },
  'bill.recover.t': { ko: 'AI 기능이 다시 켜졌어요', en: 'AI features are back on' },
  'bill.recover.b': { ko: '크레딧이 충전되어 모든 기능을 다시 사용할 수 있어요.', en: 'Credits recharged, everything is available again.' },
  'bill.uid.novol.t': { ko: '최근 거래가 없어 크레딧 충전이 멈췄어요', en: 'No recent trades, so credit top-ups paused' },
  'bill.uid.novol.b': { ko: '전략 점검이 필요할 수 있어요. 새 연구로 지금 시장에 맞는 전략을 찾아보세요.', en: 'Your strategy may need a check. Try a new research run for the current market.' },
  'bill.uid.small.t': { ko: '거래 규모보다 AI 사용량이 많아요', en: 'AI usage is outpacing your trading volume' },
  'bill.uid.small.b': { ko: '현재 거래량으로는 충전이 사용량을 따라가지 못해요. 거래 규모를 늘리거나 카드 등록을 고려해보세요.', en: 'Top-ups from your volume cannot keep up. Consider trading more or adding a card.' },
  'bill.uid.heavy.t': { ko: 'AI 사용량이 많은 편이에요', en: 'You are a heavy AI user' },
  'bill.uid.heavy.b': { ko: '카드를 등록하면 90% 할인으로 시작할 수 있어요. 거래량 충전분은 카드 요금에서 계속 차감돼요.', en: 'Add a card to start with a 90% discount. Volume top-ups keep reducing your card bill.' },
  'bill.free.out.t': { ko: '웰컴 크레딧을 모두 사용했어요', en: 'Welcome credits are used up' },
  'bill.free.out.b': { ko: '거래소 UID 연동은 0원으로 계속 쓸 수 있어요. 카드 등록으로도 이어갈 수 있어요.', en: 'Link an exchange UID to continue for free, or add a card.' },
  'bill.card.out.t': { ko: '이번 달 크레딧을 모두 사용했어요', en: "This month's credits are used up" },
  'bill.card.out.b': { ko: 'UID 연동으로 거래량 충전을 더할 수 있어요. 다음 결제일에는 자동으로 다시 채워져요.', en: 'Link a UID to add volume top-ups. Credits refill automatically next billing day.' },
  'bill.carduid.out.t': { ko: '이번 달 크레딧을 모두 사용했어요', en: "This month's credits are used up" },
  'bill.carduid.out.b': { ko: '다음 결제일에 자동으로 다시 채워져요. 그동안 쌓이는 거래량 충전분은 다음 결제에서 할인으로 이어져요.', en: 'Credits refill automatically next billing day. Volume top-ups keep cutting your next bill.' },
  'bill.dunning.t': { ko: '결제가 완료되지 않아 잠시 관망 모드로 전환했어요', en: 'Payment failed, switching to standby' },
  'bill.dunning.b': { ko: '결제 수단을 확인해주세요. 실행 중인 손절과 목표가 관리는 그대로 유지되고, 결제 즉시 다시 시작돼요.', en: 'Please check your payment method. Stop-loss and take-profit rules stay active, and everything resumes right after payment.' },
  'bill.card.cross.t': { ko: '거래소 연동으로 요금을 아껴보세요', en: 'Save on your bill by linking an exchange' },
  'bill.card.cross.b': { ko: 'UID를 연동하면 거래량만큼 크레딧이 충전되고 다음 결제에서 그만큼 할인돼요. AI 이용 크레딧 $100 혜택도 받을 수 있어요.', en: 'Link a UID to earn credits from your volume and cut your next bill. Includes $100 in AI credits.' },
} as const

const rootKeys = [
  'standby',
  'standbyValue',
  'standbyDescription',
  'blocked',
  'storageError',
  'unavailable',
  'clockSkew',
  'retry',
  'billingTag',
] as const satisfies readonly BillingCopyKey[]

const expectedKeys = [...Object.keys(original), ...rootKeys].sort()

test('원본 bill 한국어·영어 20개를 그대로 보존한다', () => {
  for (const [key, values] of Object.entries(original) as [keyof typeof original, (typeof original)[keyof typeof original]][]) {
    expect(billingText('ko', key)).toBe(values.ko)
    expect(billingText('en', key)).toBe(values.en)
  }
})

test('명시적 29개 키를 7언어에서 빠짐없이 제공한다', () => {
  expect(expectedKeys).toHaveLength(29)
  expect(Object.keys(BILLING_COPY).sort()).toEqual([...languages].sort())
  for (const language of languages) {
    expect(Object.keys(BILLING_COPY[language]).sort()).toEqual(expectedKeys)
    for (const key of expectedKeys as BillingCopyKey[]) {
      expect(billingText(language, key).trim()).not.toBe('')
    }
  }
})

test('이용 상태 확인 실패 안내는 저장 오류와 구분하고 요청 미전송·기존 내용 보존을 알린다', () => {
  expect(billingText('ko', 'unavailable')).toBe('이용 상태를 확인하지 못해 요청을 보내지 않았어요. 기기의 날짜·시간과 저장 상태를 확인한 뒤 다시 시도해주세요. 기존 내용은 그대로 유지됩니다.')
  for (const language of languages) expect(billingText(language, 'unavailable')).not.toBe(billingText(language, 'storageError'))
})

test('기기시간역행안내는저장시각이후재요청과입력·기록보존을명시한다', () => {
  expect(billingText('ko', 'clockSkew')).toBe('기기 시간이 저장된 기록보다 이전입니다. 날짜·시간을 확인하고, 저장된 기록 시각 이후에 다시 요청해주세요. 입력 내용과 기록은 그대로 보존됩니다.')
  for (const language of languages) {
    expect(billingText(language, 'clockSkew')).not.toBe(billingText(language, 'unavailable'))
    expect(billingText(language, 'clockSkew')).not.toBe(billingText(language, 'storageError'))
  }
})

test('점·아포스트로피·통화 기호가 있는 명시적 키와 원문을 안전하게 조회한다', () => {
  expect(billingText('en', 'bill.card.out.t')).toBe("This month's credits are used up")
  expect(billingText('en', 'bill.card.cross.b')).toContain('$100')
  expect(billingText('ko', 'bill.card.cross.b')).toContain('$100')
})
