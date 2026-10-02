import { expect, test } from '@playwright/test'
import { accountActivityCopy, accountActivityText } from '../src/client-account-activity-copy'

const korean = {
  "alerts": "알림",
  "all": "전체",
  "position": "포지션",
  "strategy": "전략",
  "review": "거래복기",
  "rebates": "정산",
  "credits": "크레딧",
  "reports": "보고서",
  "unread": "{count}개 안읽음",
  "unreadOne": "{count}개 안읽음",
  "readAll": "모두 읽음",
  "preferences": "수신 설정",
  "categories": "알림 분류",
  "read": "읽음",
  "notRead": "안읽음",
  "noCategory": "이 분류의 알림이 없어요",
  "noAlerts": "아직 알림이 없어요",
  "otherAlerts": "다른 필터에서 {count}건을 확인할 수 있어요.",
  "otherAlertOne": "다른 필터에서 {count}건을 확인할 수 있어요.",
  "alertsEmptyDescription": "전략이 실행되면 체결, 복기, 정산 소식이 여기로 와요.",
  "justNow": "방금 전",
  "noReports": "아직 보고서가 없어요",
  "reportsEmptyDescription": "전략이 실행된 뒤 첫 주가 지나면 주간 성과 보고서가 도착해요. (시뮬레이션)",
  "performanceReport": "{period} 성과 보고서",
  "report": "{period} 보고서",
  "reportSummary": "{range}, 체결 {count}회, 승률 {winRate}",
  "reportSummaryOne": "{range}, 체결 {count}회, 승률 {winRate}",
  "weekly": "주간",
  "monthly": "월간",
  "rebateScope": "계정 전체 범위, UID 파트너 적립 (시뮬레이션)",
  "feeRebate": "수수료 적립",
  "allHistory": "전체 내역 보기",
  "location": "현재 위치",
  "myTrading": "내 트레이딩",
  "reviewMissing": "복기 리포트를 찾을 수 없어요",
  "reportMissing": "보고서를 찾을 수 없어요",
  "stopDescription": "손절 규칙이 손실을 제한한 거래예요.",
  "profitDescription": "익절 규칙으로 청산된 거래예요.",
  "timeDescription": "시간 조건으로 청산된 거래예요.",
  "reviewTitle": "{asset} {kind} 복기",
  "toReport": "{period} 보고서로",
  "realizedLoss": "실현 손익, 손실 제한",
  "realizedRule": "실현 손익, 규칙 작동",
  "category": "구분",
  "causality": "TETH 의 인과 분석",
  "engineSignals": "규칙 엔진 신호 기준",
  "strategyDetail": "이 전략 상세로",
  "stopLoss": "손절",
  "takeProfit": "익절",
  "timedExit": "시간 청산",
  "entryReason": "진입 근거",
  "exitReason": "청산 근거",
  "lossCause": "손실 원인",
  "ruleAssessment": "규칙 평가",
  "nextSuggestion": "다음 제안",
  "periodPnl": "기간 합산 손익",
  "fills": "체결",
  "fillCount": "{count}회",
  "fillOne": "{count}회",
  "winRate": "승률",
  "periodReviews": "기간 체결 복기",
  "none": "없음",
  "noReviews": "현재 조회 가능한 복기가 없어요",
  "reviewsExpired": "이 기간의 복기 리포트가 보관 기간을 지나 정리됐어요. 요약 수치는 위에 그대로 남아 있어요.",
  "allRebates": "정산 내역 보기 (전체)"
} as const
const languages = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const

test('계정 활동 UI 문구는 한국어 원본·7언어·동일 슬롯을 보존한다', () => {
  expect(Object.keys(accountActivityCopy).sort()).toEqual(Object.keys(korean).sort())
  for (const key of Object.keys(korean) as (keyof typeof korean)[]) {
    expect(accountActivityText('ko', key)).toBe(korean[key])
    expect(accountActivityCopy[key]).toHaveLength(7)
    const slots = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map(item => item[1]).sort()
    for (const language of languages) {
      const text = accountActivityText(language, key)
      expect(text.trim()).not.toBe('')
      expect(slots(text)).toEqual(slots(korean[key]))
      if (language !== 'ko') expect(text).not.toMatch(/[가-힣]/)
    }
  }
})

test('원문 슬롯은 리터럴로 한번만 치환하며 상속 속성을 읽지 않는다', () => {
  for (const language of languages) {
    const raw = '$& $1 <img src=x> {period}'
    expect(accountActivityText(language, 'report', { period: raw })).toBe(accountActivityText(language, 'report').replace('{period}', () => raw))
    expect(accountActivityText(language, 'report', Object.create({ period: 'inherited' }))).toBe(accountActivityText(language, 'report'))
  }
  expect(accountActivityText('en', 'fillOne', { count: '1' })).toBe('1 fill')
  expect(accountActivityText('en', 'fillCount', { count: '2' })).toBe('2 fills')
  expect(accountActivityText('fr', 'fillOne', { count: '1' })).toBe('1 exécution')
  expect(accountActivityText('fr', 'fillCount', { count: '2' })).toBe('2 exécutions')
  expect(accountActivityText('es', 'fillOne', { count: '1' })).toBe('1 ejecución')
  expect(accountActivityText('es', 'fillCount', { count: '2' })).toBe('2 ejecuciones')
})
