import { expect, test } from '@playwright/test'
import { accountTerminalCopy, accountTerminalText } from '../src/client-account-terminal-copy'

const languages = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const
const korean = {
  judgment: '판단',
  validation: '검증',
  agent: 'Agent', dashboard: '대시보드', completed: '완료된 거래', live: '실행 중', off: '중지', ready: '실행 전', err: '오류',
  expandTerminal: '터미널 전체화면', fullscreen: '전체화면', strategies: '전략', chart: '차트',
  strategyCount: '전략 {count}개', selectStrategy: '전략 선택',
  invalidIds: '전략 식별자가 중복되거나 비어 있어 표시할 수 없습니다.', unavailable: '전략 정보를 확인하지 못했습니다.',
  selectContext: '선택한 전략을 표시합니다.', analysis: '전략 분석', selectAnalysis: '전략을 선택하면 분석 내용을 확인할 수 있어요.',
  scope: '데이터 범위', current: '현재 전략', all: '전체 전략', newStrategy: '새 전략', search: '전략 검색',
  statusFilter: '상태 필터', allStatuses: '전체 상태', exchangeFilter: '거래소 필터', allExchanges: '전체 거래소',
  empty: '아직 실행 중인 전략이 없습니다.', emptyHint: '채팅에서 만든 전략을 검증한 뒤 실행할 수 있습니다.', create: '새 전략 만들기',
  noMatch: '조건에 맞는 전략이 없어요', noMatchHint: '검색어나 필터를 바꿔 보십시오.', list: '전략 목록',
  exchangeValue: '거래소 {value}', statusValue: '상태 {value}', symbolValue: '심볼 {value}', marketValue: '시장 {value}',
  versionValue: '버전 {value}', capitalValue: '운용 자금 {value}', sharedCapital: '위임 예산 공용', pnlValue: '손익 {value}', pnlPercentValue: '손익률 {value}',
  selectName: '{name} 선택', menuName: '{name} 전략 메뉴', reconnect: '다시 연결',
} as const

test('계정 문구의 e08 원본 한국어·7언어·치환자는 일치하고 빈 번역이 없다', () => {
  expect(Object.keys(accountTerminalCopy).sort()).toEqual(Object.keys(korean).sort())
  const placeholders = (text: string) => [...text.matchAll(/\{([a-zA-Z]+)\}/g)].map(match => match[1]).sort()
  for (const key of Object.keys(korean) as (keyof typeof korean)[]) {
    expect(accountTerminalCopy[key]).toHaveLength(7)
    expect(accountTerminalText('ko', key)).toBe(korean[key])
    for (const language of languages) {
      const text = accountTerminalText(language, key)
      expect(text.trim()).not.toBe('')
      expect(placeholders(text)).toEqual(placeholders(korean[key]))
      if (language !== 'ko') expect(text).not.toMatch(/[가-힣]/)
    }
  }
})

test('전략명과 금융 원문을 문자열 치환하고 통화환산·HTML·이중 치환하지 않는다', () => {
  const raw = '<img onerror=x> $& $1 {value} {name} 000123.45000001 USDT 🇰🇷'
  for (const language of languages) {
    for (const key of ['selectName', 'menuName'] as const) expect(accountTerminalText(language, key, { name: raw })).toContain(raw)
    for (const key of ['exchangeValue', 'statusValue', 'symbolValue', 'marketValue', 'versionValue', 'capitalValue', 'pnlValue', 'pnlPercentValue'] as const)
      expect(accountTerminalText(language, key, { value: raw })).toContain(raw)
    expect(accountTerminalText(language, 'selectName')).toContain('{name}')
    expect(accountTerminalText(language, 'capitalValue', { value: '' })).not.toContain('{value}')
    expect(accountTerminalText(language, 'agent')).toBe('Agent')
  }
})
