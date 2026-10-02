import { expect, test } from '@playwright/test'
import { accountPlanCopy, accountPlanText } from '../src/client-account-plan-copy'
import { createSourceAccountEventState, projectSourceEntitlement } from '../src/client-account-event-state'

const korean = {
  "freeLow": "얼마 남지 않음",
  "freeValue": "무료",
  "trialInUse": "체험 중",
  "freeStatus": "이용 상태: 무료 체험",
  "uidAlwaysFree": "UID 연동 시 상시 무료",
  "spentValue": "소진",
  "trialExhausted": "무료 체험 소진",
  "continueLinkOrSubscribe": "연동 또는 구독으로 계속",
  "rebateTotal": "누적 적립",
  "simulation": "시뮬레이션",
  "rebateLabel": "현재까지 누적된 거래 수수료 적립",
  "rebateAmount": "수수료 적립 금액",
  "rebateDescription": "체결 건별로 적립되며, 적립금은 이용료 차감에 사용될 예정이에요. 시뮬레이션 체결 기준이며 실제 정산이 아니에요.",
  "rebateCount": "적립 건수",
  "recordCount": "{count}건",
  "recordCountOne": "{count}건",
  "rebateRate": "적립률",
  "rebateRateValue": "수수료(0.2%)의 10%",
  "goTrading": "AI 트레이딩으로 이동",
  "rebateHistory": "적립 내역",
  "recentRecords": "최근 {count}건 표시",
  "recentRecordOne": "최근 {count}건 표시",
  "noHistory": "내역 없음",
  "fill": "체결 {id}",
  "fillConfirmed": "{date}, 체결 확정",
  "rebateEmpty": "아직 적립된 내역이 없어요",
  "rebateEmptyDescription": "전략 거래가 체결되면 파트너 거래 수수료의 10%가 이곳에 자동으로 적립돼요.",
  "goTradingEmpty": "AI 트레이딩으로 이동하기",
  "reviewExpired": "연결된 복기가 보관 기간을 지나 정리됐어요",
  "positionPreference": "포지션 진입/청산",
  "positionDescription": "전략의 체결이 확정될 때",
  "lossPreference": "손실 단계 경고",
  "lossDescription": "평가 손실이 단계에 진입할 때",
  "reviewPreference": "거래복기 리포트",
  "reviewDescription": "체결 복기가 생성될 때",
  "rebatePreference": "수수료 적립",
  "rebatePreferenceDescription": "적립이 확정될 때",
  "watchPreference": "관심 종목 소식",
  "watchDescription": "데모에서는 실행 이벤트만 수신해요",
  "inboxPreference": "앱 내 수신함",
  "inboxDescription": "기본 채널이라 항상 동작해요",
  "kakaoPreference": "카카오톡",
  "channelDescription": "데모에서는 설정만 저장돼요",
  "telegramPreference": "텔레그램",
  "emailPreference": "이메일 리포트",
  "channels": "수신 채널",
  "notificationKinds": "어떤 알림을 받을까요",
  "channelCount": "4개 채널",
  "kindCount": "5개 항목",
  "defaultChannel": "기본",
  "preferenceFooter": "체험 모드에서는 외부 채널 발송이 일어나지 않아요. 설정은 저장돼요.",
  "planUnavailable": "플랜 상태를 확인할 수 없어요",
  "invalidSource": "원본 체험 상태 또는 기준 시간을 확인할 수 없어요.",
  "invalidValues": "플랜 표시를 위한 체험 수치가 유효하지 않아요.",
  "basic": "기본 분석",
  "guestDescription": "로그인 후 PLAN 및 크레딧을 확인할 수 있어요.",
  "membership": "PRO 멤버십",
  "unlimited": "무제한",
  "memberActive": "멤버십: 구독 중",
  "unlimitedUse": "무제한 이용",
  "paidDescription": "구독 중이라 PRO 분석이 무제한이에요.",
  "tradeBadge": "PRO 활성 (무제한)",
  "tradeActive": "이용 상태: 무제한 활성",
  "expires": "만료일 {date}",
  "tradeDescription": "파트너 거래소 거래가 활성 상태라 PRO 분석이 무제한이에요. (거래 인정 기간 {days}일)",
  "inUse": "이용 중",
  "normal": "이용 상태: 정상",
  "volumeRecharge": "거래량 연동 자동 충전",
  "creditDescription": "UID 연동으로 PRO 분석을 사용 중이에요. 거래량에 따라 자동으로 충전돼요.",
  "freeTrial": "무료 체험",
  "freeDescription": "로그인 무료 체험으로 고급 분석을 사용 중이에요. UID 를 연동하면 AI 이용 크레딧 $100 혜택을 받아요.",
  "upgradeRequired": "업그레이드 필요",
  "exhaustedDescription": "무료 분석 사용량을 모두 썼어요. UID 연동(무료) 또는 구독으로 계속 사용할 수 있어요.",
  "level": "현재 AI 수준",
  "usageStatus": "이용 상태",
  "linkFree": "무료로 UID 연동하기 (Fast API)",
  "upgrade": "구독으로 업그레이드",
  "previewFooter": "체험 모드에서는 응답 모델이 동일하며 크레딧 차감만 재현돼요. 크레딧 정책 v{version}.",
  "details": "상태 및 연동 상세",
  "uidLink": "UID 연동",
  "partnerAccount": "거래소 파트너 연동 계정",
  "linkedFree": "연동됨 (무료)",
  "unlinked": "미연동",
  "partnerActivity": "파트너 거래 활성",
  "activityDescription": "체결 1회 시 {days}일 무제한 적용",
  "activeUntil": "{date} 까지 활성",
  "none": "없음",
  "subscription": "구독 멤버십",
  "monthlyPlan": "월간 PRO 정기 결제 플랜",
  "subscribed": "구독 중",
  "responseCost": "고급 응답 비용",
  "responseUsage": "PRO 심층 분석 사용량 기반",
  "noDebit": "차감 없음",
  "usageDebit": "이용량 기반 차감",
  "description": "AI 수준, 수수료 적립, 알림 수신을 관리해요",
  "navigation": "PLAN 화면",
  "plan": "플랜",
  "rebates": "정산",
  "alerts": "알림 설정",
  "unavailable": "계정 상태를 확인할 수 없어요"
} as const
const locales = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const

test('PLAN100문구의 원본 한국어·7언어·동일 슬롯을 보존한다', () => {
  expect(Object.keys(accountPlanCopy).sort()).toEqual(Object.keys(korean).sort())
  for (const key of Object.keys(korean) as (keyof typeof korean)[]) {
    expect(accountPlanText('ko', key)).toBe(korean[key])
    expect(accountPlanCopy[key]).toHaveLength(locales.length)
    const slots = (value: string) => [...value.matchAll(/\{(\w+)\}/g)].map(item => item[1]).sort()
    for (const locale of locales) {
      const text = accountPlanText(locale, key)
      expect(text.trim().length).toBeGreaterThan(0)
      expect(slots(text)).toEqual(slots(korean[key]))
      if (locale !== 'ko') expect(text).not.toMatch(/[가-힣]/)
    }
  }
})

test('치환은 리터럴·자체 속성만 사용하고 지정하지 않은 슬롯은 보존한다', () => {
  const value = '$& $1 <img src=x> {date}'
  for (const locale of locales) {
    expect(accountPlanText(locale, 'expires', { date: value })).toBe(accountPlanText(locale, 'expires').replace('{date}', () => value))
    expect(accountPlanText(locale, 'expires', Object.create({ date: 'inherited' }))).toBe(accountPlanText(locale, 'expires'))
    expect(accountPlanText(locale, 'freeDescription')).toContain('$100')
    for (const key of ['freeLow', 'freeValue', 'trialInUse', 'freeStatus', 'uidAlwaysFree', 'spentValue', 'trialExhausted', 'continueLinkOrSubscribe'] as const) expect(accountPlanText(locale, key)).not.toMatch(/\d/)
  }
  for (const [locale, single, multiple, recentOne, recentMany] of [
    ['en', '1 record', '2 records', 'Showing 1 recent record', 'Showing 2 recent records'],
    ['es', '1 registro', '2 registros', 'Mostrando 1 registro reciente', 'Mostrando 2 registros recientes'],
    ['fr', '1 enregistrement', '2 enregistrements', 'Affichage de 1 enregistrement récent', 'Affichage de 2 enregistrements récents'],
  ] as const) {
    expect(accountPlanText(locale, 'recordCountOne', { count: '1' })).toBe(single)
    expect(accountPlanText(locale, 'recordCount', { count: '2' })).toBe(multiple)
    expect(accountPlanText(locale, 'recentRecordOne', { count: '1' })).toBe(recentOne)
    expect(accountPlanText(locale, 'recentRecords', { count: '2' })).toBe(recentMany)
  }
})

test('로컬 투영 진단만 정확한 지역화 키와 대응한다', () => {
  expect(projectSourceEntitlement(createSourceAccountEventState(), true, NaN)).toEqual({ kind: 'unsupported', reason: accountPlanText('ko', 'invalidSource') })
  expect(projectSourceEntitlement(createSourceAccountEventState({ creditBal: -1 }), true, 0)).toEqual({ kind: 'unsupported', reason: accountPlanText('ko', 'invalidValues') })
})
