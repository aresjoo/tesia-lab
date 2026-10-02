import { createHash } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { INSIGHT_TAG_LABELS, insightTagLabel, insightSourceCopy } from '../src/client-insight-source-copy'

test('9fbff821 sk-ins 원본 38개 태그 표시를 정확히 계승하고 키는 보존한다', () => {
  // Independently extracted from 9fbff821 tools/sk-ins.js, not from the React map.
  const pairs = Object.entries(INSIGHT_TAG_LABELS).map(([key, values]) => [key, values[0]])
    .sort(([a], [b]) => a.localeCompare(b, 'en'))
  expect(pairs).toHaveLength(38)
  expect(createHash('sha256').update(JSON.stringify(pairs)).digest('hex')).toBe('fb7e511cae245130c3e333ad0b213604afed47799b0be655e4bc00c7aca584a0')
  for (const [key, values] of Object.entries(INSIGHT_TAG_LABELS)) {
    expect(values).toHaveLength(7)
    expect(values.every(value => value.trim().length > 0)).toBe(true)
    expect(insightTagLabel('ko', key.toUpperCase())).toBe(values[0])
  }
  for (const tag of ['__proto__', 'constructor', 'toString', 'publisher-special-tag', ' bitcoin ', '']) {
    expect(insightTagLabel('ko', tag)).toBe(tag)
  }
  expect(insightSourceCopy('ko', 'topics')).toBe('주제별로 보기')
  expect(insightSourceCopy('ko', 'popular')).toBe('많이 읽는 글')
  expect((['negative', 'neutral', 'positive'] as const).map(key => insightSourceCopy('ko', key))).toEqual(['도움 안 됨', '조금 도움', '도움 됨'])
})
