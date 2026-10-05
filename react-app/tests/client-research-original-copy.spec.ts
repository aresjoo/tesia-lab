import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { MOCK_RESEARCH_ENTRIES, previewCritic } from '../src/mock-research-preview'
import { criticParagraphs } from '../src/research-view-model'

// 독립 원문: aresjoo/tesia-lab 9fbff821df62cad11d026022fc7628c7fcebc431
// index.html SHA256 f2475453a03b2646361546ac32002b00e4ce26ee014abf79d3be6262b318e321
// 원11741 / 11917–11918 / 11802. 기대값을 제품 코드에서 생성하지 않는다.
test('원9fb 연구 finding·Critic·Verdict 원문을 정확히 보존한다', () => {
  expect(MOCK_RESEARCH_ENTRIES.find(row => row.id === 'critic')?.finding?.plain).toBe(
    '시장이 거의 움직이지 않을 때도 거래해 손실의 71%가 그 구간에서 발생했습니다.',
  )
  const review = previewCritic(53)!
  expect(criticParagraphs(review).critic).toBe(
    '저변동성 구간에 손실 71% 집중 (v1 기준), 필터로 수정됨. 상위 3개 거래가 수익의 72%, 소수 거래 의존.',
  )
  expect(review.verdict).toBe('수익성 확인. 일관성은 Holdout, Forward에서 계속 확인 필요.')
})

test('원9fb 완료 요약은 기존 fixture 회수와 완료 상태를 보존한다', () => {
  const source = readFileSync(new URL('../src/components/ClientResearchWorkspace.tsx', import.meta.url), 'utf8')
  expect(source).toContain('검증 7단계 완료, 전략 수정 1회, 백테스트 {FIXTURE.report.backtestCount}회, Holdout 통과')
  expect(source).toContain("replay.status === 'completed' && <div className=\"rw-complete\">")
  expect(source).toContain("['검증', `${pct(FIXTURE.versions[1].ret)}, 낙폭 ${FIXTURE.versions[1].mdd.toFixed(1)}%, Holdout 통과`]")
})

test('원문 복원은 미수정 필터·건수 비율·공급 Verdict를 바꾸지 않는다', () => {
  expect(previewCritic(37.4)).toBeUndefined()
  const initial = previewCritic(37.5)!
  expect(initial.initialLowVolLossShare).toBeCloseTo(10 / 14 * 100, 10)
  expect(initial.lowVolFilterApplied).toBe(false)
  expect(criticParagraphs(initial).critic).not.toContain('필터로 수정됨')
  expect(previewCritic(53)!.lowVolFilterApplied).toBe(true)
  expect(criticParagraphs({ ...initial, verdict: '공급된 고유 판정' }).verdict).toBe('공급된 고유 판정')
})

test('원9fb 대화 안내는 직접 수정 두 경로와 선택지의 원문을 보존한다', () => {
  const source = readFileSync(new URL('../src/client-experience-store.ts', import.meta.url), 'utf8')
  const edit = '바꾸고 싶은 조건을 적어주십시오. 예를 들어 "손절 -5%로", "익절 없이", "추세 진입으로"처럼요. 적용 후 다시 검증하겠습니다.'
  expect(source.split(edit)).toHaveLength(3)
  expect(source).toContain('아래에서 골라주십시오. 원하는 답이 없으면 비슷하게 적어주셔도 됩니다.')
})

test('원9fb 가설 검증 기준과 백테스트 출처 문구를 보존한다', () => {
  const source = readFileSync(new URL('../src/components/ClientResearchWorkspace.tsx', import.meta.url), 'utf8')
  expect(source).toContain('이 패턴이 Research 구간과 Holdout 구간 모두에서 확인되어야 가설이 유지됩니다. 결과는 Backtest, Holdout artifact에서 확인하십시오.')
  expect(source).toContain('Research 2023.01 ~ 2025.06, 비용 반영, MOCK')
})
