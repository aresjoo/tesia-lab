import { expect, test } from '@playwright/test'
import { strategyActionsCopy, strategyActionsText } from '../src/client-strategy-actions-copy'

test('전략 메뉴 치환도 상속된 이름과 상태를 읽지 않는다', () => {
  expect(strategyActionsText('ko', 'menuLabel', Object.create({ name: 'inherited' }))).toBe('{name} 전략 메뉴')
  expect(strategyActionsText('ko', 'runningMessage', Object.create({ status: 'inherited' }))).toBe('이 전략은 현재 {status}입니다.')
})

test('전략 동작 30개 문구의 7언어와 치환 토큰은 원본과 동일하다', () => {
  expect(Object.keys(strategyActionsCopy)).toHaveLength(30)
  for (const values of Object.values(strategyActionsCopy)) {
    expect(values).toHaveLength(7)
    const tokens = values[0].match(/\{\w+\}/g) ?? []
    for (const value of values) {
      expect(value.trim().length).toBeGreaterThan(0)
      expect(value.match(/\{\w+\}/g) ?? []).toEqual(tokens)
    }
  }
  for (const locale of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    expect(strategyActionsText(locale, 'tooLong')).toContain('30')
    expect(strategyActionsText(locale, 'deleteQuestion', { name: '<script>{status}</script>$&' })).toContain('<script>{status}</script>$&')
    expect(strategyActionsText(locale, 'runningMessage').split('{status}')).toHaveLength(2)
  }
  expect(['detail', 'rename', 'clone', 'cloneExchange', 'pause', 'versions', 'delete'].map(key => strategyActionsText('ko', key as keyof typeof strategyActionsCopy))).toEqual(['전략 상세', '이름 변경', '복제', '다른 거래소에 복제', '일시 중지', '버전 기록', '삭제'])
})
