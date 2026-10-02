import { expect, test } from '@playwright/test'
import { proposalRequestExcerpt, strategyProposalCopy, strategyProposalText } from '../src/client-strategy-proposal-copy'

test('요청 발췌는 원본60단위 한도와 온전한 grapheme 경계를 동시에 유지한다', () => {
  const segmenter = new Intl.Segmenter('und', { granularity: 'grapheme' })
  for (const glyph of ['😀', '👨‍👩‍👧‍👦', 'e\u0301', '🇰🇷', '👍🏽', '한', '한', 'A']) {
    for (let padding = 45; padding <= 61; padding++) {
      const request = 'a'.repeat(padding) + glyph + ' 뒤에 이어지는 요청'
      const result = proposalRequestExcerpt(request)
      if (request.length <= 60) { expect(result).toBe(request); continue }
      expect(result.endsWith('…')).toBe(true)
      const prefix = result.slice(0, -1)
      expect(prefix.length).toBeLessThanOrEqual(60)
      expect(request.startsWith(prefix)).toBe(true)
      const boundaries = [...segmenter.segment(request)].map(part => part.index + part.segment.length)
      expect(boundaries).toContain(prefix.length)
      expect(boundaries.filter(end => end <= 60).at(-1)).toBe(prefix.length)
    }
  }
  for (const text of ['', 'a'.repeat(60), '😀'.repeat(30), 'e\u0301'.repeat(30)]) expect(proposalRequestExcerpt(text)).toBe(text)
})

test('상속된 값은 요청 원문이나 상태 치환에 사용하지 않는다', () => {
  const inherited = Object.create({ request: 'inherited', status: 'inherited' })
  expect(strategyProposalText('ko', 'original', inherited)).toContain('{request}')
  expect(strategyProposalText('ko', 'stopNotice', inherited)).toContain('{status}')
  expect(strategyProposalText('ko', 'original', Object.assign(Object.create(null), { request: 'own' }))).toContain('"own"')
})

test('첫 grapheme이 표시 예산을 넘어도 예산을 늘리거나 문자를 쪼개지 않는다', () => {
  const request = 'e' + '\u0301'.repeat(80) + ' 이어지는 원문'
  expect(proposalRequestExcerpt(request)).toBe('…')
  expect(request).toBe('e' + '\u0301'.repeat(80) + ' 이어지는 원문')
})

test('원본 변경안25개 문구의7언어·치환자·점수80을 보존한다', () => {
  expect(Object.keys(strategyProposalCopy)).toHaveLength(25)
  for (const row of Object.values(strategyProposalCopy)) {
    expect(row).toHaveLength(7)
    for (const text of row) {
      expect(text.trim().length).toBeGreaterThan(0)
      expect(text.match(/\{\w+\}/g) ?? []).toEqual(row[0].match(/\{\w+\}/g) ?? [])
    }
  }
  for (const locale of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    expect(strategyProposalText(locale, 'belowTitle')).toContain('80')
    expect(strategyProposalText(locale, 'stopNotice').split('{status}')).toHaveLength(2)
    expect(strategyProposalText(locale, 'original', { request: '<script>{version}</script>$&' })).toContain('<script>{version}</script>$&')
  }
  expect(strategyProposalText('ko', 'original', { request: '손절 -3%로 바꿔줘' })).toBe('요청 원문: "손절 -3%로 바꿔줘". 위 표의 항목만 반영돼요. 원문의 다른 표현은 해석되지 않았어요.')
  expect(strategyProposalText('ko', 'stopNotice', { status: '중지' })).toBe('적용 시 이 전략은 중지돼요. 자동 재개는 없으며, 확인 후 직접 재개해야 해요.')
})
