# UX_STATE_MATRIX — 파생 상태 엔진 계약 (구현 정본)

구현 함수: `tfDerive()` (index.html, 순수 함수. 저장·알림·토스트·초기화 금지). 모든 화면(이용 현황, 미활성 뷰, 활성화 시트, 거래소 연결, 터미널 배너, QA)은 이 결과만 읽는다.

## 입력 (기존 변수 → 어댑터)
| 입력 | 값 | 어댑터(현행 변수) |
|---|---|---|
| ready | bool | `window.TF_STATE_READY && TF_BOOTED` |
| loggedIn | bool | `!!S.user` |
| exchangeLinked (UID) | bool | `!!t.uidLinked` |
| executionConnected (API) | bool | `!!(t.api && t.api.ex)` (conn 미러는 폐기 대상, 시작 가드에서만 별도) |
| exchangeId | 'bitget'…|null | `t.api ? t.api.ex : (t.ob && t.ob.ex) || null` |
| planActive | bool | `bcInit().cardOn || t.payDone` (둘 다 카드 결제 사실로 취급, QA 프리셋은 둘 다 set) |
| usageUnits | number | `bcMonthSpend()` + `(t.freeUsed||0) * AI_CALL_COST` (무료 소비도 사용량으로 관측) |
| usageBand | 'low'|'high' | `usageUnits >= TFC.derive.USAGE_HIGH(1500) ? 'high' : 'low'` |
| tradeCredit | number | `bcMonthVol()` (당월 거래량 충전 누계, 명목 거래량의 대리값) |
| tradeBand | 'zero'|'low'|'high' | `0 → zero; < TFC.derive.TRADE_HIGH(1500) → low; else high` |
| freeLeft | number | `freeQuota - freeUsed` |
| balance | number | `bcBalance()` |
| billMode | active|grace|watch | `bcInit().mode` |
| ownedStrategies | number | `t.strat.length + t.termClones.length + cp.copies.filter(active).length` |
| verifiedDraft | bool | `!!(t.cur && t.score >= TFC.score.pass)` |

## 파생 출력
```
{
  stateId: 1..11 | null,           // null = unclassified (예: 플랜+연동+거래0)
  stateKey: 'guest'|'signed'|'linked-zero'|'linked-low'|'linked-high'|'plan-high-unlinked'|'plan-low-unlinked'|'plan-high-high'|'plan-high-low'|'plan-low-high'|'plan-low-low'|'plan-linked-zero',
  entitlement: { browse, chat, backtest, paper, live, follow },   // 각 true/false + reason
  coverage: 'free'|'covered'|'partial'|'postpaid'|'blocked',
  bill: { plan, offset, due, offsetPct, line },  // KRW 정수, line = "플랜 ₩49,000 - 상쇄 ₩31,000 = 청구 ₩18,000" 또는 "이번 달 청구 ₩0"
  primaryCTA: {label, action} | null,
  secondaryCTA: {label, action} | null,
  activation: { uid:'none'|'done', api:'none'|'done', card:'none'|'done', message },
  statusLine: string,        // 이용 현황 상태 문장 1개
  reduceHint: string|null,   // 줄이는 방법 1개
  interrupt: 'none'|'inline'|'banner'|'block',
  terminalMode: 'guest'|'inactive'|'active'
}
```

## 분류 규칙
```
!ready → null (판단 유보, UI는 스켈레톤)
!loggedIn → 1
!planActive:
  !uid → 2
  uid: trade zero→3, low→4, high→5
planActive:
  !uid: usage high→6, low→7
  uid: trade zero→null('plan-linked-zero'), (high,high)→8,(high,low)→9,(low,high)→10,(low,low)→11
```

## 청구 계산 (데모 정책, TFC.derive)
- PLAN_KRW = 49,000. 초과 종량 = max(0, usageUnits - INCLUDED(1000)) × UNIT_KRW(10). 커미션 크레딧 = tradeCredit × KRW_PER_CREDIT(10). 무료 크레딧 = 로그인 월 WELCOME 100 × 10.
- due = max(0, (planActive ? PLAN_KRW : 0) + overage - commission - free). offsetPct = min(100, round(commission / (plan + overage) × 100)).
- 비플랜(2~5)은 plan=0이므로 due는 초과 종량에서 상쇄 후 잔액. coverage: free(2, freeLeft>0) / covered(due=0) / partial(due>0 & commission>0) / postpaid(due>0 & !commission & planActive) / blocked(freeLeft=0 & !planActive & balance<=0, 또는 billMode=watch).

## 11행 (사용자에게 보이는 것)
| # | key | 상태 문장(statusLine) | 1차 CTA | 2차 CTA | 청구 라인 | interrupt | 미활성 뷰 헤드 |
|---|---|---|---|---|---|---|---|
| 1 | guest | (없음) | 무료로 시작 → authOpen('signup') | 터미널 미리 보기 | (없음) | none | (게스트 뷰) |
| 2 | signed | "무료 체험 N회 남았어요. 연결이나 결제 없이 만들고 검증할 수 있어요" | 대표 전략 모의로 켜보기 / (초안 있으면) 이 전략 실행하기 | 직접 만들기 | "이번 달 청구 ₩0 · 무료 체험" | freeLeft=0이면 inline | 아직 돌아가는 전략이 없어요 |
| 3 | linked-zero | "거래소가 연결됐어요. 첫 거래부터 이용료 상쇄가 시작돼요" | 이 전략 실행하기 / 대표 전략 모의로 켜보기 | 공개 전략 골라보기 | "이번 달 청구 ₩0" | none | 연결 완료, 첫 전략을 실행해 보세요 |
| 4 | linked-low | "이용료 ₩X 중 ₩Y가 거래 혜택으로 상쇄됐어요. 부족분은 카드로 청구돼요" | (실행 관련) | 카드 등록 | 공식 라인 | inline | |
| 5 | linked-high | "이번 달 이용료가 거래 혜택으로 충당됐어요" | (실행 관련) | 없음 | "이번 달 청구 ₩0 · 거래 혜택 상쇄" | none | |
| 6 | plan-high-unlinked | "AI를 많이 쓰고 있어요. 거래소를 연결하면 최대 ₩X 줄어요" | 거래소 연결 | 이용 현황 보기 | "플랜 ₩49,000 + 추가 ₩Z = 청구 ₩W" | inline | |
| 7 | plan-low-unlinked | "플랜 정상 이용 중이에요" | (실행 관련) | 거래소 연결(텍스트 링크) | "플랜 ₩49,000 = 청구 ₩49,000" | none | |
| 8 | plan-high-high | "거래 혜택이 플랜과 추가 사용료를 상쇄하고 있어요" | (실행 관련) | 없음 | 공식 라인 | none | |
| 9 | plan-high-low | "AI 사용이 많아 추가 사용료가 있어요. 거래 혜택으로 일부 상쇄됐어요" | (실행 관련) | 이용 현황 보기 | 공식 라인 | inline(청구 전) | |
| 10 | plan-low-high | "TETH가 이번 달 플랜 비용을 대신 냈어요" | (실행 관련) | 없음 | "플랜 ₩49,000 - 상쇄 ₩49,000 = 청구 ₩0" | 축하 1회(토스트) | |
| 11 | plan-low-low | "플랜에서 거래 혜택을 뺀 금액만 청구돼요" | (실행 관련) | 없음 | 공식 라인 | none | |
| null | plan-linked-zero | "준비 완료. 첫 거래부터 이용료 상쇄가 시작돼요" | 이 전략 실행하기 | | "플랜 ₩49,000 = 청구 ₩49,000" | none | |

"(실행 관련)" = ownedStrategies>0 → "터미널 열기", verifiedDraft → "이 전략 실행하기", 아니면 "대표 전략 모의로 켜보기".
금지 어휘: 무제한, VIP, PRO, Fast API, 크레딧, 소진(→ "다 썼어요"), 업그레이드, 거래를 늘리세요 류.

## 자격(entitlement)
| 액션 | 허용 조건 |
|---|---|
| browse | 항상 |
| chat / backtest | loggedIn && billMode!='watch' && (freeLeft>0 || planActive || balance>0) |
| paper | loggedIn (API 불필요) |
| live | loggedIn && executionConnected && verifiedDraft(또는 준비된 전략) |
| follow(시작) | loggedIn && executionConnected (paper 따라가기는 API 불필요) |

## 터미널 모드
guest: !loggedIn. active: ownedStrategies>0 (전부 정지여도 active). inactive: 그 외. `preview` 컨텍스트(`TF_PREVIEW=true`)는 mode와 무관하게 데모 6개 터미널.
