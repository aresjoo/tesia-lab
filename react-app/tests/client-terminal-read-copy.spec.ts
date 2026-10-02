import { expect, test } from '@playwright/test'
import { terminalBarsText, terminalReadCopy, terminalReadText } from '../src/client-terminal-read-copy'
import { sharedNumber, sharedPercent } from '../src/client-shared-number-format'
import type { ClientLanguage } from '../src/client-preferences'

const korean = {
  agentName: 'TETH 에이전트',
  promptSection: '사용자 프롬프트',
  rationaleSection: '생각의 사슬',
  decisionSection: '거래 결정',
  watchDetails: '봉별 판단 {count}건 보기',
  scanEvent: '시장 분석',
  "exitPrice": "청산가",
  "targetPrice": "목표가",
  "versionHistory": "버전 기록 보기 ({version})",
  "versionsTitle": "버전 기록: {name}",
  "currentVersion": "현재 버전",
  "noVersions": "아직 수정 이력이 없어요. Agent 패널에서 자연어로 전략을 수정하면 버전이 생성돼요.",
  "versionsUnavailable": "버전 기록이 제공되지 않았습니다.",
  "user": "사용자",
  "close": "닫기",
  "tradeDetails": "{date} 거래 추적",
  "barsOne": "{value}봉",
  "capital": "운용 자금",
  "navSimulation": "전략 NAV · 시뮬레이션",
  "totalPnl": "Total P&L",
  "realized": "실현 / 미실현",
  "feeCaption": "수수료 (왕복 0.2%, 손익에 반영됨)",
  "estimated": "{value} 추정",
  "navCurve": "NAV 곡선",
  "emptyCurve": "곡선 데이터가 없어요",
  "simulationRange": "검증 구간, 시뮬레이션",
  "navDescription": "합성 NAV 곡선, {value}",
  "winRate": "승률",
  "drawdown": "최대 낙폭",
  "profitFactor": "손익비",
  "sharpe": "샤프",
  "averageHolding": "평균 보유",
  "marketExposure": "시장 노출",
  "tradeCount": "거래 수",
  "maxGainLoss": "최대 익/손",
  "bars": "{value}봉",
  "trades": "{value}회",
  "count": "{count}건",
  "currentPosition": "현재 포지션",
  "simulationEnd": "검증 구간 종료 시점 · 시뮬레이션",
  "entryPrice": "진입가",
  "currentPrice": "현재가",
  "quantity": "수량",
  "stopPrice": "손절가",
  "holding": "보유",
  "noPosition": "현재 포지션이 없습니다.",
  "seekingEntry": "진입 신호를 탐색하는 중이에요.",
  "notRunning": "전략이 실행 중이 아니에요.",
  "recentTrades": "최근 거래",
  "recentTradesLabel": "{name} 최근 거래 내역",
  "exitDate": "청산일",
  "type": "구분",
  "pnl": "손익",
  "takeProfit": "익절",
  "stopLoss": "손절",
  "period": "기간",
  "noFills": "이 구간 체결이 없어요",
  "completed": "완료된 거래",
  "completedRange": "{total}건 중 최근 {recent}, 시뮬레이션",
  "entry": "진입",
  "exit": "청산",
  "fee": "수수료",
  "whyEntered": "WHY ENTERED",
  "whyExited": "WHY EXITED",
  "fullDecision": "전체 판단 기록 →",
  "noCompleted": "완료된 거래가 없어요",
  "noCompletedHint": "검증 구간에서 완결된 거래가 생기면 여기에 정리돼요.",
  "eventEntry": "진입",
  "eventTp": "익절 청산",
  "eventSl": "손절 청산",
  "eventTime": "기간 청산",
  "eventWatch": "관망",
  "eventRisk": "보유 점검",
  "userPrompt": "USER PROMPT",
  "savedSettings": "이 주기에 적용된 저장 전략 설정",
  "rawSettings": "Raw 설정 보기",
  "rationale": "판단 근거",
  "decisions": "TRADING DECISIONS",
  "justification": "JUSTIFICATION",
  "invalidation": "INVALIDATION",
  "collapse": "세부 정보 접기 ▴",
  "expand": "세부 정보 ▾",
  "feed": "Agent 판단 기록",
  "operations": "운영 기록",
  "error": "오류",
  "reconnect": "다시 연결",
  "decisionHistory": "판단 기록",
  "historyFilter": "판단 기록 필터",
  "all": "전체",
  "fillsOnly": "체결만",
  "unavailable": "Agent 판단 기록을 확인하지 못했습니다.",
  "empty": "아직 Agent 판단 기록이 없습니다.",
  "emptyFills": "체결 판단 기록이 없습니다.",
  "firstEvaluation": "전략이 첫 번째 평가를 완료하면 여기에 표시됩니다.",
  "historyList": "판단 기록 목록",
  "moreHistory": "이전 판단 더 보기 ({count})"
} as const
const languages: ClientLanguage[] = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']
test('기존 안내와 원본 복원90항목·7언어·치환자 계약을 고정한다', () => {
  expect(Object.keys(terminalReadCopy).sort()).toEqual(Object.keys(korean).sort())
  for (const key of Object.keys(korean) as (keyof typeof korean)[]) {
    expect(terminalReadText('ko', key)).toBe(korean[key])
    expect(terminalReadCopy[key]).toHaveLength(7)
    const placeholders = (text: string) => [...text.matchAll(/\{([a-zA-Z]+)\}/g)].map(match => match[1]).sort()
    for (const language of languages) {
      const value = terminalReadText(language, key)
      expect(value.trim()).not.toBe('')
      expect(placeholders(value)).toEqual(placeholders(korean[key]))
    }
  }
})

test('봉 단위는 표시 수량 1과 복수·소수 및 현지 소수점을 구분한다', () => {
  for (const [language, one, many] of [['en', 'bar', 'bars'], ['es', 'vela', 'velas'], ['fr', 'bougie', 'bougies']] as const) {
    const decimal = language === 'en' ? '.' : ','
    expect(terminalBarsText(language, 1)).toBe(`1 ${one}`)
    expect(terminalBarsText(language, 1, 1)).toBe(`1${decimal}0 ${one}`)
    expect(terminalBarsText(language, 1.01, 1)).toBe(`1${decimal}0 ${one}`)
    expect(terminalBarsText(language, 1.1, 1)).toBe(`1${decimal}1 ${many}`)
    expect(terminalBarsText(language, 0)).toBe(`0 ${many}`)
    expect(terminalBarsText(language, 2)).toBe(`2 ${many}`)
  }
  expect(terminalBarsText('ko', 1, 1)).toBe('1.0봉')
  expect(terminalBarsText('ja', 1)).toBe('1本')
  expect(terminalBarsText('zh-CN', 1)).toBe('1根K线')
  expect(terminalBarsText('zh-TW', 1)).toBe('1根K線')
})
test('전략명과 숫자 치환은 달러·HTML·빈값을 해석하거나 재작성하지 않는다', () => {
  const raw = '$& $1 <img src=x> ₩1,000,000 {count}'
  for (const language of languages) {
    expect(terminalReadText(language, 'recentTradesLabel', { name: raw })).toContain(raw)
    expect(terminalReadText(language, 'estimated', { value: raw })).toContain(raw)
    expect(terminalReadText(language, 'bars', { value: '' })).not.toContain('{value}')
    expect(terminalReadText(language, 'count')).toContain('{count}')
    expect(terminalReadText(language, 'count', Object.create({ count: 'prototype' }))).toContain('{count}')
  }
})
test('네 자리 수량·손익률은 원본 반올림·부호를 유지하며 소수 구분자만 바꾼다', () => {
  for (const language of languages) {
    for (const value of [0, -0, 0.00001, -0.00001, 0.12505, 12.34565, -12.34565, 1000000.12345]) {
      const separator = language === 'es' || language === 'fr' ? ',' : '.'
      expect(sharedNumber(value, language, 4)).toBe(value.toFixed(4).replace('.', separator))
      expect(sharedPercent(value, language)).toBe(`${value >= 0 ? '+' : ''}${value.toFixed(1).replace('.', separator)}%`)
    }
  }
  expect(sharedNumber(NaN, 'ko', 4)).toBe('—')
  expect(sharedNumber(Infinity, 'fr', 4)).toBe('—')
})
