# CODEX PHASE 2 — 제품 상태·전략·인터랙션 독립 제안

- 작성: 2026-09-24 / Principal Product Engineer · State-machine Architect · Interaction Engineer.
- **설계 제안이며 미구현이다.** 이 작업의 산출물은 이 문서 하나다. 코드·설정·기존 현황 문서를 변경하지 않는다.
- 사용자가 제공한 제품 맥락을 기준으로 한다. 컴플라이언스·법률·리스크 고지·보안 감사는 다루지 않는다. 아래 `riskRule`은 주문 실행 규칙이라는 데이터 필드다.
- 실제 `index.html` SHA-256을 다시 확인했다: `38014c3867de7a9d8fb65567dff999c8081e39128476b0c03525d17f459c558d`. Phase 1과 동일하다. 코드 근거의 `index:L…`는 이 버전의 행 번호다.
- 근거 약어: **IA** = [CURRENT_IA](../current/CURRENT_IA.md), **SM** = [CURRENT_STATE_MATRIX](../current/CURRENT_STATE_MATRIX.md), **FM** = [CURRENT_FLOW_MAP](../current/CURRENT_FLOW_MAP.md), **F** = [CODEX_PHASE1_FINDINGS](../current/CODEX_PHASE1_FINDINGS.md), **T** = [terminals](../research/terminals.md), **R** = [robinhood-nof1](../research/robinhood-nof1.md), **C** = [copy-trading](../research/copy-trading.md). 문서 약어 뒤 L은 해당 문서 행이다.
- 리서치 3건은 제공된 벤치마크 자료로 사용했다. 외부 서비스의 현재 기능을 재검증했다는 의미는 아니다. 다른 Phase 2 제안은 읽지 않고 독립적으로 작성했다.

## 1. 파생 상태 엔진 설계

### 1.1 결정: 상업 분류, 실행 자격, 화면 모드를 분리한다

| 질문 | 결정 | 근거 |
| --- | --- | --- |
| 상태 정본은 무엇인가? | 계정·연결·구독·사용·거래의 **사실 스냅샷**. CTA·밴드·문구는 저장하지 않고 파생한다. | F:L12–20, SM:L128–143 |
| 11개 상태가 전체 상태 머신인가? | 아니다. 11개는 상업 시나리오 분류다. API 연결, 전략 보유, 결제 실패, 복원 중은 직교 축이다. | F:L63–67 |
| “연동”은 무엇인가? | 11개 분류에서 `exchangeLinked`는 **과금 귀속용 UID 검증**이다. `executionConnected`는 대상 계정의 실행 API 상태다. | 사용자 제품 맥락; FM:L163–174 |
| 모델명이 전략 유형인가? | 아니다. 유형은 판단 주체와 실행 방식으로 결정한다. 기반 모델은 개별 AI 작업의 도구 메타데이터다. | 사용자 제품 맥락; IA:L27–28의 현행 혼합 |
| 백엔드로 옮길 수 있나? | 동일 입력·정책·시각에 같은 결과를 내는 순수 selector와 command reducer를 정의한다. 모의 어댑터를 서버 어댑터로 교체한다. | F:L79, L103–111 |

**단일 진실 원천은 거대한 boolean 객체가 아니다.** 각 사실을 한 곳에서 기록하고, 하나의 파생 결과를 PLAN·터미널·거래소·체크아웃이 함께 소비하는 계약이다.

### 1.2 최소 입력과 정본 경계

| 정본 입력 | 최소 필드·값 | 파생값 / 저장 금지 항목 |
| --- | --- | --- |
| `snapshot` | `schemaVersion, revision, hydration: loading/ready/error, ownerId` | 복원 중을 guest로 간주하지 않는다. |
| `identity` | `user: null 또는 {id}` | `loggedIn = user != null` |
| `accounts[]` | `id, exchangeId, uidLink:{status, uidRef, verifiedAt}, execution:{status, connectionId, verifiedAt, revision}` | 상태 enum은 `unlinked/verifying/verified/error`, API는 `disconnected/connecting/connected/error`. 대상 accountId로 U/E 계산. |
| `subscription` | `planId, status:none/pending/active/past_due/canceled, periodStart, periodEnd, collectionStatus:ready/failed/none, revision` | `planActive`는 활성 상태와 유효기간으로 계산. 카드 등록만으로 활성 아님. |
| `meter` | `periodId, complete, successfulAiUnits, liveNotionalUSDT, asOf, sourceRevision` | `usageBand`, `tradeBand`. 완전하지 않은 집계는 `unknown`. |
| `billingFacts` | `periodId, currency, freeCreditMinor, commissionCreditMinor, adjustmentsMinor, reservationsMinor, settlementStatus, graceUntil` | `billingCoverage`, `dueMinor`, `billingLine`. 카드·UID 플래그로 잔액을 추정하지 않는다. |
| `portfolio` | 정규화 Strategy 참조, position 참조, workspace/version 참조 | 사용자 전략수·실행수·미완료 작업·선택 대상 준비 상태 |
| `context` | `route, targetAccountId, targetStrategyId/workspaceId, action, requestedCostMinor, resumeIntent, scope:owned/demo` | 동일 계정도 대상 전략·액션에 따라 CTA와 실행 자격이 달라진다. |
| `policy`, `now` | 버전 있는 가격·포함량·임계·지원 기능; 주입된 UTC 시각 | `Date.now()`, DOM, 저장소, 네트워크를 derive 내부에서 읽지 않는다. |

- `usageEvents={requestId, task, status, units, at, ownerId}`는 무료·유료·커미션 상쇄와 무관하게 기록한다. 성공량은 성공 이벤트로 계산하고 실패·취소는 별도 관측한다. 청구 대상량은 별도 정책이다.
- `fillEvents={fillId, accountId, strategyId, env, at, notional, currency, normalizedNotionalUSDT, conversionRef}`로 거래량을 보존한다. 거래 크레딧 적립액을 거래량으로 역산하지 않는다.
- 월 집계는 `[periodStart, periodEnd)`이고 기간·통화·계정·이벤트 ID가 일치해야 한다. UID 해제 뒤에도 이미 확정된 해당 월 크레딧은 과거 사실로 남는다.
- 원장 합계와 화면 로그는 수명이 다르다. 화면에서 2,000건을 잘라도 잔액은 유지된다. 서버 집계 또는 `openingBalance + 이후 이벤트` 체크포인트를 사용한다(F:L14).
- `meter`/`billingFacts`는 동일 revision의 정본 집계다. 전체 이벤트와 집계를 각각 수정 가능한 두 원천으로 만들지 않는다. 이벤트가 있으면 재생으로 집계를 생성하고 서버가 있으면 버전 있는 집계를 수신한다.

### 1.3 분류·청구·자격의 독립 계약

| 산출물 | 계약 |
| --- | --- |
| `stateId` | `1…11 또는 null`; `classificationStatus=ready/reconciling/unclassified`, `reasonCodes[]`, `policyVersion` 포함 |
| `entitlement` | 액션마다 `{allowed, reasonCode, remedyAction, evaluatedRevision}`. browse/templateClone/templateBacktest/aiTask/startPaper/startLive/resumeLive/pause/stop/followStart/publish를 구분 |
| `primaryCTA`, `secondaryCTA` | `{action,labelKey,params,target,resumeIntent,enabled,reasonCode}` 또는 null. 문자열 onclick 없음 |
| `billingLine` | `{messageKey,periodId,currency,planFee,overage,commissionCredit,freeCredit,due,status,asOf}`. 어느 화면이나 같은 수치와 시점 |
| `activationMessage` | `{messageKey,missingSteps[],completedSteps[],target}`. UID 완료와 API 완료를 따로 설명 |
| `interruptLevel` | `none/inline/banner/action-block`. 실패한 액션의 복구 UI만 block; 열람 자체를 결제 모달로 막지 않는다. |
| `terminalMode` | `guest/inactive/active`, 별도 `readiness=loading/ready/error`, `preview=boolean`. 결제 상태로 활성 화면을 랜딩으로 되돌리지 않는다. |

**분류 규칙**

- 로그인 전은 ①. 복원 중은 `stateId=null, reconciling`이며 로그인 판단을 유보한다.
- 비플랜·UID 미연동은 ②, 비플랜·UID 연동은 거래 0/저/고에 따라 ③/④/⑤.
- 플랜·UID 미연동은 AI 고/저에 따라 ⑥/⑦, 플랜·UID 연동은 AI와 거래 고/저의 교차로 ⑧–⑪.
- ②의 “로그인만”은 기준 fixture 이름이다. API만 연결한 경우 같은 상업 분류에 `variant=execution_only`를 붙인다. ⑥/⑦의 미연동도 UID 기준이며 API 연결 여부를 별도로 표시한다.
- **플랜+UID+거래0은 11개 정의 밖**이므로 `unclassified, reason=plan_linked_zero_trade`. 거래0을 저거래로 몰래 치환하지 않는다. CTA·청구·실행 자격은 그대로 계산한다.
- 구간 판정에 필요한 집계가 unknown이면 분류도 유보한다. 사용량 구분이 필요 없는 ③은 AI 집계가 불완전해도 상업 ID는 ③일 수 있지만 청구 표시는 “집계 확인 중”이다.

**청구와 사용 가능 판정**

- 월 청구액 = `max(0, 플랜료 + 초과 종량 − 거래 커미션 크레딧 − 무료 크레딧)`.
- 금액은 정수 최소 통화 단위다. 표시 통화 선택으로 원장의 통화를 바꾸지 않는다. 초과 종량은 플랜 포함량을 제외한 청구 가능 사용량으로 산출한다.
- `billingCoverage={status:covered/postpaid/grace/blocked/unknown, reason, availableForRequestMinor, dueMinor, graceUntil}`를 파생한다. covered는 잔여 크레딧으로 현재 요청 비용을 충당, postpaid는 활성 플랜·정상 수금으로 충당하는 경우다.
- **청구액 0과 무제한 이용은 다르다.** 무료 잔여도 0이고 플랜도 없으면 현재 청구액 0이어도 다음 유료 AI 요청은 blocked다. `requestedCostMinor`와 예약 비용까지 평가한다.
- 고거래는 청구액 0의 동의어가 아니다. 사용량이 더 높으면 ⑧도 청구된다. 낮은 거래라도 무료 크레딧이 크면 ⑨는 0원이 될 수 있다.
- 범용 AI 요청은 coverage 검사, 규칙 실행·수동 관리·따라가기 실행은 AI 과금과 분리한다. 따라가기에 AI 분석을 추가 요청할 때만 AI 자격을 검사한다. UID는 과금 귀속 조건이며 실행의 필수 API를 대신하지 않는다.
- live 시작/재개는 로그인 + **대상 계정** API + 유효한 전략 버전·예산 + 해당 실행 방식의 자격을 검사한다. paper는 API 불필요. pause/stop과 기존 기록 열람은 AI 잔여량과 독립이다.
- 규칙 백테스트의 기존 80점 게이트는 이행 단계에 유지하되 agent/follow에 RSI 백테스트 점수를 만들어 적용하지 않는다. `validationByKind`가 rule/hybrid의 규칙부와 agent 설정 검증, follow 원본 가용성 검사를 분리한다.

### 1.4 11행 출력 기준표

아래는 §9의 고정 QA 입력에 대한 기대다. **전략을 선택해 검증한 workspace는 있으나 내 실행 인스턴스는 아직 0개**, 대상은 Bitget·AI 판단형이다. 정책·금액은 QA 전용 예시이며 출시 가격 결정이 아니다. `E0=공개 열람`, `E1=열람·편집·AI·paper 가능/live는 API 필요`, `E2=E1+대상 live 시작 가능`. 검증된 draft는 터미널 활성 전략수에 포함하지 않는다.

| ID | 상업 상태 / U·E·P / AI·거래 | entitlement | primaryCTA / secondaryCTA | billingLine: 월 예상 청구 | activationMessage | interruptLevel / terminalMode |
| --- | --- | --- | --- | --- | --- | --- |
| ① | 비로그인 / 0·0·0 / —·— | E0 | 로그인하고 시작 / 데모 둘러보기 | 로그인 후 사용량 확인 | 로그인하면 선택한 전략을 이어서 설정 | none / guest |
| ② | 로그인만 / 0·0·0 / 저·0 | E1 | Bitget 연결하고 시작 / 전략 수정 | $0 · 무료 크레딧 $10 보유 | UID와 실행 연결을 이어서 설정 | none / inactive |
| ③ | 연동·거래0 / 1·1·0 / 저·0 | E2 | 이 전략 시작 / 설정 검토 | $0 · 거래 크레딧 $0 | 연결 완료 · 예산 $500로 시작 가능 | none / inactive |
| ④ | 연동·저거래 / 1·1·0 / 저·저 | E2 | 이 전략 시작 / 사용·크레딧 보기 | $0 · 거래 $10 + 무료 $10 | 연결 완료 · 시작 대기 | none / inactive |
| ⑤ | 연동·고거래 / 1·1·0 / 저·고 | E2 | 이 전략 시작 / 사용·크레딧 보기 | $0 · 거래 $250 + 무료 $10 | 연결 완료 · 시작 대기 | none / inactive |
| ⑥ | 플랜·고사용·미연동 / 0·0·1 / 고·0 | E1 | 실행 API 연결 / UID 연동 | $189 · $49+$150−$0−$10 | 플랜 활성 · 실행 API 미연결 | none / inactive |
| ⑦ | 플랜·저사용·미연동 / 0·0·1 / 저·0 | E1 | 실행 API 연결 / UID 연동 | $39 · $49+$0−$0−$10 | 플랜 활성 · 실행 API 미연결 | none / inactive |
| ⑧ | 플랜·연동·고사용·고거래 / 1·1·1 / 고·고 | E2 | 이 전략 시작 / 사용·크레딧 보기 | $0 · $49+$150−$250−$10 | 연결 완료 · 시작 대기 | none / inactive |
| ⑨ | 플랜·연동·고사용·저거래 / 1·1·1 / 고·저 | E2 | 이 전략 시작 / 사용·크레딧 보기 | $179 · $49+$150−$10−$10 | 연결 완료 · 시작 대기 | none / inactive |
| ⑩ | 플랜·연동·저사용·고거래 / 1·1·1 / 저·고 | E2 | 이 전략 시작 / 사용·크레딧 보기 | $0 · $49+$0−$250−$10 | 연결 완료 · 시작 대기 | none / inactive |
| ⑪ | 플랜·연동·저사용·저거래 / 1·1·1 / 저·저 | E2 | 이 전략 시작 / 사용·크레딧 보기 | $29 · $49+$0−$10−$10 | 연결 완료 · 시작 대기 | none / inactive |

CTA 선택 우선순위는 `요청 액션의 실제 막힘 → 이어갈 미완료 activation → 선택한 준비 전략 → 새 전략 선택`이다. 상업 ID만 보고 무조건 업그레이드를 노출하지 않는다. coverage blocked는 해당 AI 액션에 action-block, 현재 터미널에는 복구 banner를 만들고 mode는 유지한다.

### 1.5 순수 함수 시그니처와 코드 스케치

`deriveProductState(snapshot, context, policy, now) → ProductState`; 모든 보조 함수도 순수하다. 아래 22줄은 계약 스케치이며 실행 가능한 구현·테스트 결과가 아니다.

```js
function classify(f) {
  if (!f.ready) return {stateId:null, status:'reconciling'};
  if (!f.loggedIn) return {stateId:1, status:'ready'};
  let id = null;
  if (!f.planActive) {
    id = !f.exchangeLinked ? 2 : ({zero:3, low:4, high:5}[f.tradeBand] ?? null);
  } else if (!f.exchangeLinked) {
    id = ({high:6, low:7}[f.usageBand] ?? null);
  } else {
    id = ({'high/high':8,'high/low':9,'low/high':10,'low/low':11}
      [f.usageBand+'/'+f.tradeBand] ?? null);
  }
  return {stateId:id, status:id === null ? 'unclassified' : 'ready'};
}
function deriveProductState(snapshot, context, policy, now) {
  const facts = selectFacts(snapshot, context, policy, now);
  const billing = deriveBilling(snapshot, context, policy, now);
  const entitlement = deriveEntitlements(facts, billing, context, policy);
  return {...classify(facts), facts, entitlement, billingCoverage:billing.coverage,
    billingLine:billing.line, ...derivePresentation(facts, billing, entitlement, context),
    policyVersion:policy.version, evaluatedRevision:snapshot.revision};
}
```

derive는 초기화·지급·결제 재시도·토스트·저장을 수행하지 않는다. `command → adapter effect → event → reducer → snapshot → derive → render` 순서를 사용한다. 비동기 결과에는 `operationId, expectedRevision, ownerId`를 붙이고 대상 변경 뒤 도착한 결과는 해당 작업에만 귀속시킨다. 서버 command도 같은 자격을 최신 revision에서 재검사하고 결과를 반환한다.

### 1.6 기존 변수 매핑·폐기·마이그레이션

| 현행 | 신규 매핑 | 유지·폐기 결정 / 근거 |
| --- | --- | --- |
| `S.user`, STORE | identity, versioned snapshot | 유지·어댑터화. 부팅 복원 완료를 명시. SM:L13, L29 |
| `uidLinked/uid/ob.uid` | accounts.uidLink / activation input draft | 검증 사실과 입력 초안 분리. boolean 직접 쓰기 제거. index:L9861–9864, L13329 |
| `api/conn/ob.st` | accounts.execution / activation.step | API verified 결과만 연결 정본. `conn` 폐기. `ob.st`는 UI 진행 enum으로만 이관. F:L19–20 |
| `payDone/plan/pay/bill.cardOn` | subscription / activation.payment / paymentMethod | OR 병합 금지. 카드 등록≠구독. 결제 이력 없는 legacyPaid는 reconciliation 대상으로 보존. F:L16, L21 |
| `creditBal/freeUsed/creditGrants/creditSeen/creditReqs` | usage·credit events, migration receipt | 과거 두 원장을 단순 합산하지 않는다. 단위·중복 확인 후 개시 잔액으로 이관, 구형 소비기 폐기. F:L12–17 |
| `tradeActiveUntil/bcMonthVol` | 프로모 기록 / liveNotional 집계 | 거래 밴드 입력에서 제거. 과거 금액 복원 불가 시 unknown. F:L18, SM:L239–246 |
| `bill.mode/graceAt` | billing facts의 실패·유예 시각에서 coverage 파생 | `watch` 저장·직접 분기 폐기. “AI 이용 중단”과 정상 판단의 “관망”을 분리. SM:L165 |
| `t.intake/cur/stage/pendingP/workDone` | workspace[id].version, validation, input | 새 workspace는 이전 pendingP를 참조하지 않는다. F:L22 |
| `t.strat/termClones/cp.copies`, `sx.live/livePaused` | Strategy store / strategyId 참조 | 모든 제어를 동일 command로 이전. 화면 미러 boolean 폐기. F:L15, L29 |
| `TF_*_RESUME`, `pendingNew/pendingRun` | `Intent{id,action,targetId,returnRoute,draftId,status}` | 하나의 복귀 큐, 완료 시 1회 consume. F:L99 |
| `TF_INTRO_PEEK`, 전역 렌더 플래그 | 명시 preview route / router lifecycle | account identity로 화면 우회하던 임시 상태 폐기. FM:L138–157 |

| 단계 | 변경 순서 | 완료 판정 |
| --- | --- | --- |
| M1 | 현행 스냅샷·11개 fixture·충돌 사례를 고정 | 동일 입력 해시로 재현, 사용자 저장소와 QA 저장소 분리 |
| M2 | read adapter와 v2 schema 추가; unknown/충돌 표시 | 데이터 누락을 active로 추정하는 경로 0개 |
| M3 | 사용·체결 계측, 통화·기간·중복 ID 정규화 | 무료/유료 모두 usage 증가; paper가 live 거래 크레딧을 만들지 않음 |
| M4 | shadow derive로 기존 판정과 비교 | 11개와 확장 상태의 차이 원인을 QA에 기록 |
| M5 | PLAN·연결·3개 trade 뷰를 새 selector로 전환 | 화면별 CTA·청구·연결 상태 일치 |
| M6 | 전략 adapter와 공통 명령, activation·라우터 도입 | 즉시 시작/later→start, 연구/터미널 제어 결과 동일 |
| M7 | 이관 receipt와 원본 스냅샷 참조를 남긴 후 legacy 쓰기 차단 | 새 정본의 단일 writer 확인, 버전 재복원 시 중복 지급 0 |
| M8 | 모든 소비 지점 전환 후 구형 변수·시트·경로 제거 | 회귀 통과 뒤 제거. 그 전에는 adapter 단위 기능 플래그로 되돌릴 수 있어야 함 |

가격 정본은 향후 `site-config.js`의 버전 있는 plan catalog로 모으고 소개·체크아웃·과금이 읽게 한다. 현재 `teth-copy.js:L22,L61–80`, `site-config.js:L19–47`, `index:L12763–12773`의 서로 다른 가격 체계를 이 문서에서 실제 변경하지는 않는다.

## 2. 전략 객체 정규화

### 2.1 하나의 Strategy 계약, 서로 다른 실행 payload

**네 경로는 같은 Strategy 조회 모델로 합칠 수 있다.** 공개 원본, 편집 draft, 실행 인스턴스까지 같은 mutable 객체 하나로 합치지는 않는다. 같은 스키마를 사용하되 `source.role`과 관계 ID로 구별한다.

| 필드 | 스키마·의미 |
| --- | --- |
| `id`, `version`, `ownerId` | 영속 ID. 생성 시 할당하고 UI 인덱스·닉네임·현재 시각만으로 식별하지 않는다. |
| `kind` | `agent/rule/hybrid/follow`. AI가 생성한 RSI 전략도 실행이 규칙이면 rule. hybrid는 AI 결정과 명시 규칙이 함께 실행될 때만 사용. |
| `title`, `subtitle` | “BTC 시장 맥락 판단” / “TETH가 15분마다 진입·추가·축소·청산·대기 결정” 등 동작 설명. 모델명은 제목의 정체성 아님. |
| `asset` | `{base,quote,symbol,market,venueInstrumentId}`. 다중 페어는 params.universe에 배열. 이름에서 KRW 페어를 추정하지 않는다. |
| `params` | kind별 tagged payload: agent의 mandate/cadence/constraints, rule의 rules/evaluationTiming, hybrid의 agent+rules+precedence, follow의 subscriptionId/leaderStrategyId/sourceVersion/sizing/syncPolicy |
| `source` | `{origin:funnel/research/terminalClone/shared/copy/demo, role:draft/template/instance, sourceStrategyId, sourceVersion, publicationId, legacyRef}` |
| `status` | `draft/validating/ready/starting/running/paused/stopping/stopped/error/archived`. 원인·이전 상태는 statusReason 필드. |
| `budget` | `{amount,currency,accountId,allocationId}`. 누락은 null과 incomplete 표시; 현재 intake 예산으로 채우지 않는다. |
| `perf` | `{live:null 또는 PerformanceSeries, backtest:null 또는 PerformanceSeries}`. 각각 period/currency/feesIncluded/method/asOf/version/env를 포함. |
| `log[]` | 공통 Event 참조 또는 로드된 페이지. 전체 원장은 별도 event store, `logCursor/logTotal`로 후속 조회. |
| 보조 참조 | `execution:{env,accountId,connectionId,appliedVersion}`, `validation:{status,version,resultRef}`, `createdAt/updatedAt`, `revision` |

사용자 메뉴는 **AI 판단형 / 규칙형 / 따라가기** 3개다. hybrid는 AI 판단형의 고급 설정 안에서 표현하고 네 번째 마케팅 카테고리로 늘리지 않는다. `engineRun.tools[]`에 provider/model/version/task를 기록하며 전략 kind로 쓰지 않는다.

### 2.2 네 어댑터

| 경로 | adapter 입력 → 출력 | 반드시 보완할 항목 / 코드 근거 |
| --- | --- | --- |
| 퍼널·연구 | `fromWorkspace(t.intake,t.cur,sx)` → draft/ready Strategy | workspace/version과 검증 결과 고정. 시작과 later가 같은 snapshot builder 사용. index:L7721–7738,L8144–8150,L9967–9969,L13698 |
| 터미널 user:/demo:/clone: | `fromTerminalLegacy(record, legacyKey)` → instance 또는 demo template | `legacyIdMap`으로 기존 URL 연결. live→running, off→paused(종료 근거 없으면 stopped로 추정 금지), err→error. 자산·예산 누락은 검토 필요. index:L10013–10043,L10102–10121 |
| 공유 ss3 | `fromPublication(seed/sharedSnap)` → public template + immutable publication version | 닉네임은 creator 프로필 필드. 내 설정 복사 시 새 id·sourceVersion·새 draft를 만들고 원본과 실행 동기화를 끊는다. index:L12318–12334,L12555–12560 |
| 카피 cp | `fromCopy(cp.copies[])` → kind=follow instance + CopySubscription·자금원장 참조 | nick→leaderStrategyId 매핑. cp ledger 보존; params에 RSI p를 억지 생성하지 않는다. active→running, closed→stopped. 과거 원본 버전 불명은 unknown. index:L11384–11412,L11868–11873 |

- `perf.backtest`를 live PnL로 복사하지 않는다. 현재 terminal 계산이 `runBacktest` 기반인 부분은 backtest 또는 simulation series로 이관한다(index:L10054–10086).
- ss3 “설정 가져오기”는 clone command, marketplace “따라가기”는 follow command. 라벨·완료 화면·관리 단위를 분리한다(IA:L52–57, FM:L123–125).
- 조회는 `selectOwnedStrategies()` 한 곳에서 funnel/research/clone/follow를 집계한다. demo와 public template는 제외한다. cp만 1개인 사용자도 활성 터미널로 간다.
- `pauseStrategy/resumeStrategy/stopStrategy/startStrategy/applyVersion`는 kind별 executor를 호출한다. 연구 화면도 같은 strategyId에 command를 보낸다.
- 파라미터 수정은 `draftVersion → validatedVersion → apply command → appliedVersion` 전이. 적용 응답 전에는 실행 버전 배지를 바꾸지 않는다(T:L73).
- ID 중복 방지는 `workspaceId + version + startOperationId`. 같은 자산·10분·같은 src를 같은 전략으로 취급하지 않는다(F:L27).

## 3. 판단 로그 데이터 모델

### 3.1 공통 envelope와 유형별 payload

| 공통 필드 | 의미 |
| --- | --- |
| `eventId, strategyId, strategyVersion, runId, sequence` | 중복 제거·정렬·버전 귀속. 같은 timestamp여도 sequence로 순서 결정 |
| `type` | `agent_decision/rule_evaluation/follow_sync/order_update/operation/billing_pause` |
| `occurredAt, receivedAt, env, source` | 발생과 도착 분리. source는 mock/backtest/engine/exchange 등 |
| `correlationId, parentEventId, dataRevision` | 판단→주문→체결 연결. 주문 승인과 체결을 같은 이벤트로 취급하지 않음 |
| `summaryKey, summaryParams` | 공통 UI 문구는 7개 언어 키. 근거 원문은 별도 contentLanguage 저장 |

| AI 판단 이벤트 `agent_decision` | 타입·예시 |
| --- | --- |
| `checked` | `{at,marketSnapshotId,accountSnapshotId,signals:[{name,value,unit,asOf}]}`. 실제 점검한 범위 |
| `decision` | `enter/add/reduce/exit/hold` |
| `reason` | `{summary,evidenceRefs[],invalidationConditions[]}`. 사용자용 근거 요약·관련 데이터 |
| `action` | `{status:none/proposed/submitted/filled/partial/rejected,orderIds[],side,quantity,unit}`. hold면 status=none |
| `nextCheck` | `{scheduledAt,trigger:timer/market_event/manual,condition}` 또는 null. 상태 종료 후 카운트다운 금지 |
| `confidence?` | `{value,scale,method,calibrationVersion}`. 없으면 숨김. 결과 확률로 해석하지 않는다. 기본 상단 노출 없음 |
| `tools?` | `{provider,model,task,latencyMs}` 배열. 진단 펼침에만 표시 |

| 규칙 이벤트 `rule_evaluation` | 타입·예시 |
| --- | --- |
| `rules[]` | `{ruleId,label,operator,leftValue,rightValue,unit,matched}` |
| `result` | `matched/not_matched/skipped/error` |
| `trigger` | `{type:bar_close/tick/schedule,at,barId,timeframe}` |
| `order` | null 또는 `{orderId,side,quantity,status}`. 규칙 참이어도 주문 실패 가능 |
| `riskRule` | null 또는 `{ruleId,type:stop_loss/take_profit/budget_limit,threshold,observed,outcome}` |
| `nextEvaluationAt` | 다음 봉/점검 예정; AI의 confidence·자연어 사고 필드를 요구하지 않음 |

| renderer 분기 | 기본 카드 → 펼침 |
| --- | --- |
| agent | “무엇을 확인 / 결정 / 왜 / 실제 행동 / 다음 점검” → 근거 데이터·구조화 결정 |
| rule | “어느 조건이 성립 / 불성립 / 발생 주문” → rules 평가표·발동 수치 |
| hybrid | 부모 평가 그룹 아래 AI 판단과 규칙 이벤트를 독립 표시; 어떤 규칙이 최종 액션을 제한했는지 연결 |
| follow | 원본 결정 수신 → 내 비율로 환산 → 내 주문 결과. 원본 수익과 내 수익·체결을 구분 |
| operation/billing_pause | 설정 변경·일시정지·AI 이용 중단. 정상 hold 카드와 다른 이벤트 유형 |

현재 `tfTmFeed`는 규칙 이벤트 사이에 scan을 삽입하고 같은 “TETH 에이전트” 카드로 렌더한다(index:L10347–10355,L10389–10397). 기존 기록은 `source=backtest,type=rule_evaluation`로 보존하며 과거 AI 결정을 새로 꾸며 만들지 않는다. R:L67–69의 요약·데이터·결정 구조는 채택하되 “생각의 사슬” 대신 **판단 근거**를 제공한다.

### 3.2 연속 관망 접기 규칙

1. 시간순 원본에서 **동일 strategyId·runId·version·env**의 연속 agent hold가 3회 이상이면 한 그룹으로 접는다. 규칙 불성립은 별도 “조건 미충족 N회” 그룹이다.
2. `reason`의 의미 코드, 포지션 상태, 평가 주기가 같고 중간에 주문·오류·버전 변경·운영 중단·새 신호가 없어야 묶는다. 문구 문자열 동일 여부만으로 판정하지 않는다.
3. 점검 간격이 예정 주기의 2배를 넘으면 끊는다. “계속 보고 있음”을 결측 구간에 확장하지 않는다.
4. 카드에는 시작/끝 시각·실제 횟수·경과시간·마지막 근거·다음 점검을 표시한다. 최신 1건은 그룹 머리에서 읽을 수 있다.
5. 그룹화 후 페이지를 자른다. 기존 `slice(feedN) → 그룹화`는 페이지 끝에서 연속성을 잃는다(index:L10360,L10375–10378). 서버 페이지 경계에는 groupId·total·continuation을 제공한다.
6. 펼침은 20건씩 지연 로드하고 다음 페이지를 요청한다. 검색 결과는 “일치 N건 / 전체 M건”을 표시하며 원본 이벤트를 삭제하지 않는다.
7. 사용자가 과거를 읽는 동안 새 로그는 “새 판단 N개”로 모은다. 자동 스크롤은 바닥에 있을 때만 유지한다.

## 4. 터미널 인터랙션 모델

### 4.1 패널 상태 의존성과 명령 경계

UI 정본은 `TerminalViewState={selectedStrategyId,accountScope,chartSymbol,timeframe,rightTab,bottomTab,filters,expandedEventIds,scrollAnchors}`. 필터와 선택을 바꾸는 일은 전략 실행 상태를 바꾸지 않는다.

| 영역 | 읽는 정본·필수 표시 | 동작·상태 의존성 |
| --- | --- | --- |
| 상단 컨텍스트 바 | 선택 전략의 제목·유형·실행 버전·예산·계정·현재 상태·다음 점검 | 전체 계정 summary와 선택 전략 summary 구분. 연결 단절은 해당 계정에 표시. 정지/재개는 공통 command. 모델 로고 대신 TETH와 전략 유형 |
| 좌 전략 레일 | selectOwnedStrategies + 정렬/상태/유형/계정 필터 | `선택됨`은 id로 저장. 필터로 숨겨지면 명시 안내 후 첫 결과 선택, 숨은 전략에 명령하지 않음. 새 전략은 새 workspace 생성 |
| 중앙 차트 | 선택 전략의 asset·period·env, 주문·체결 이벤트 | 기본 선택 자산 추종. 사용자가 차트만 다른 자산으로 탐색하면 “전략과 다른 차트” 컨텍스트를 표시. 관찰 신호와 체결 마커 분리 |
| 우 에이전트 패널 | kind별 최신 상태·판단 로그·설정 변경 draft | agent는 판단, rule은 규칙 평가, follow는 동기화 현황. AI 질문 실패가 규칙 실행 제어를 차단하지 않음. pending command 동안 해당 버튼만 진행 상태 |
| 하단 탭 | 포지션/미체결/주문/체결/종료 포지션/자산 + 판단 기록 전체 | “현재 전략 / 현재 계정 / 내 전체” 범위를 명시. 실제 연결 없는 계정은 연결 카드, paper 계좌는 paper 자료를 계속 표시. 선택 계정과 무관한 전역 api 체크 폐기 |

- 우 패널은 지금 상태와 최근 판단, 하단 “판단 기록”은 검색·기간·종류 필터를 갖춘 전체 기록이다. 같은 event store를 읽되 동일 피드를 두 군데 동시에 장문 렌더하지 않는다.
- `selectedStrategyId`가 바뀌면 chart/right/bottom을 같은 revision으로 갱신한다. 이전 전략의 느린 차트·AI 응답은 generation과 targetId가 다르면 화면에 적용하지 않는다.
- 연결 단절·AI 비용 부족에도 차트와 기존 포지션·기록은 유지한다. 재개·수정이 막힌 이유를 해당 제어 옆에 표시한다.
- 사용자 선택으로부터 별도 `ALL` 계정 scope를 허용하되 PnL 통화가 다르면 통화별 소계 또는 명시 환율 스냅샷으로 합산한다.
- 근거: 현재 패널 구조 IA:L28, 전역 API 하단 잠금 FM:L60,L132, 계정 요약·차트 마커·활동 로그 벤치마크 T:L60–65.

### 4.2 데모 6개 결정: 별도 체험 공간에 격리, 프리셋으로 재사용

| 선택지 | 결정·이유 |
| --- | --- |
| 실제 터미널에 기본 삽입 | 제거. 내 전략수·성과·연결·알림 집계를 오염시키는 현재 합성 경로 폐지(index:L10028–10036). |
| 데모 데이터 자체 삭제 | 하지 않는다. d1–d6의 실행/정지/대기/오류 상태는 체험·QA 사례로 유용하다(index:L9986–9999). |
| 데모 체험 | `#/trade?preview=1`, `scope=demo`, 독립 저장소. 상단 “데모 체험”과 “내 화면으로” 표시. 원래 사용자 상태 유지 |
| 내 전략으로 가져오기 | 명시 “설정 가져오기” → 새 draft id → 사용자 예산·Bitget 계정 설정 → 유형별 검증. 데모 live/성과/연결은 상속하지 않음 |

6개는 현재 p 구조상 규칙 예제다. 제목만 AI 판단형으로 바꾸지 않는다. agent/follow 체험은 별도 유형에 맞는 이벤트 fixture가 생긴 뒤 추가한다.

### 4.3 반응형·모바일 순서

| viewport 폭 | 배치·동작 |
| --- | --- |
| ≥1280px | 상단 컨텍스트 / 좌 220px 레일 / 중앙 minmax(0,1fr) 차트 / 우 360px 패널 / 하단 범위·탭. 리사이즈 가능, 최소 폭 유지 |
| 768–1279px | 좌 레일은 선택 드로어, 차트+우 320px 패널. 960px 미만은 차트/판단 탭으로 한 패널씩 표시. 하단 표는 영역 내부 스크롤 |
| <768px | ① 전략 선택·상태·필수 제어 ② 최신 판단 요약·다음 점검 ③ 중앙 차트 ④ 포지션·계정 요약 및 하단 탭 ⑤ 전체 판단 피드·질문 입력. 요약은 우 패널의 작은 동일 selector |

- 390px에서 sticky 상단과 하단 제어가 내용을 덮지 않도록 safe-area·측정 높이만큼 여백. 키보드가 뜨면 차트 높이를 줄이고 입력과 전송을 화면 안에 둔다.
- 전략 선택은 모바일 드로어, 뒤로가기 한 번에 닫힌다. 필터·탭 전환은 포커스를 보존하고 닫기 뒤 원래 버튼에 복귀한다.
- 작은 화면에서 전체 페이지 가로 스크롤은 0. 긴 표만 내부 스크롤/행 상세 sheet를 사용한다. reduced-motion에서는 상태 변화만 표시한다.

### 4.4 판단 로그 1,260개 성능

- 1,260개는 검증용 부하 규모다. 현행 기본 DOM이 1,260개라는 뜻은 아니다. 현재 feedN=14, 더 보기마다 +20이다(index:L10001,L10401).
- 현재 scan 삽입은 평가마다 기존 이벤트를 다시 탐색하고 전체 sort/reverse를 한다(index:L10346–10360). 생성 단계의 timestamp index와 증분 삽입으로 바꾼다.
- log index와 그룹 결과를 `strategyId/version/eventRevision/filter` 기준 캐시. 판단 접기 클릭 때문에 백테스트·차트·레일을 재생성하지 않는다.
- 초기 30그룹, 추가 30그룹; 화면에 카드 최대 80개 유지. 오래된 카드는 높이 placeholder와 scroll anchor로 교체한다. 펼친 그룹도 20건 페이지이며 포커스된 행은 제거하지 않는다.
- 차트는 선택 자산이 바뀔 때만 인스턴스 교체하고 탭 전환은 resize/data update. 보이지 않는 데모 전략 6개를 먼저 계산하지 않는다.
- **향후 합격 목표**: 고정 fixture·로컬 자산·CDP CPU 4배 조건에서 1,260건 최초 피드 표시 200ms 이하, 카드 펼침 100ms 이하, 50ms 초과 main-thread task 반복 없음. 아직 측정한 수치가 아니다. 초과하면 계측 trace로 그룹화/DOM/차트 비용을 분리한다.

## 5. AI 트레이딩 3상태 라우팅

### 5.1 같은 `#/trade`, 서로 다른 화면 계약

| 파생 mode | 조건 | 독립 뷰·정보구조 | 전환 |
| --- | --- | --- | --- |
| guest | hydration ready + user 없음 | `TradeGuestView`: 3가지 전략 방식, 실제 행동 예시, 공개 전략 탐색, 데모 체험, 로그인 CTA. 개인 잔액·설정 체크리스트 없음 | 로그인 성공 → 사실 재평가 |
| inactive | 로그인 + 내 운용 인스턴스/미정리 포지션/운용 이력 없음 | `TradeActivationView`: 선택한 전략 draft, Bitget 연결 진행, 예산, 사용·청구 요약, 이어하기. 긴 마케팅 섹션·데모 6개 없음 | 인스턴스 생성 → active; 로그아웃 → guest |
| active | 로그인 + owned instance(ready 포함), 미정리 포지션 또는 운용 이력 존재 | `TradeTerminalView`: 레일·차트·판단·포지션·관리. 모두 정지여도 터미널 유지 | 마지막 기록까지 사용자가 보관 처리하고 포지션 0일 때만 inactive |

- active는 “현재 주문 중”이 아니라 **운용 공간이 존재함**을 뜻한다. 거래0, 일시정지, 결제 실패, API 오류를 inactive로 보내지 않는다.
- 계정 연결·플랜만 있고 전략0이면 activation 뷰에 “연결 완료, 전략 선택”을 표시한다. cp instance만 있어도 active다.
- hydration loading/error는 세 제품 위의 공통 부팅 shell이다. loading에서 guest 랜딩을 잠깐 노출하거나 missing strategy로 URL을 지우지 않는다.
- 데모 미리보기는 mode를 영속 변경하지 않는 별도 route context다. `preview=1` 제거 시 계정의 정규 mode로 돌아온다.
- 현행은 guest와 로그인 전략0 모두 tfIntroView, PEEK·알림 플래그로 터미널 우회가 가능하다(index:L14608–14614,L15049–15053; FM:L149–157). 이를 세 뷰로 대체한다.

### 5.2 URL·history·복원 계약

| 상황 | 처리 |
| --- | --- |
| 터미널 전략 선택 | `#/trade?strategy=<id>&tab=decisions&scope=current`; 선택·탭은 replace, 다른 제품 화면 이동은 push |
| activation 열기 | `#/activate/<operationId>?return=<routeKey>`를 push. 뒤로가기·닫기 시 draft와 완료된 단계는 남고 원래 route로 복귀 |
| 인증 필요 딥링크 | 목적 URL 유지 + auth overlay. 로그인 후 pending Intent의 대상이 여전히 유효한지 재평가 |
| 새로고침 | route parse → snapshot hydration → schema migration → derive → render. 고정 900ms 타이머를 준비 완료 신호로 사용하지 않음 |
| 뒤로/앞으로 | popstate/hashchange를 한 router에서 처리. view 함수가 URL을 지우거나 자체 replaceState하지 않음 |
| 존재하지 않는 id | 복원 완료 뒤 “전략을 찾을 수 없음” + 내 전략 목록 링크. 아무 전략에 자동 실행 command를 보내지 않음 |
| 구형 bot·share 주소 | legacyIdMap에서 정규 id로 1회 replace. map에 없으면 복구 화면. 닉네임 변경에도 publicationId 유지 |
| 외부 직접 진입의 닫기 | history.state에 same-app origin이 있으면 back, 없으면 명시 returnRoute로 replace |
| 다중 탭 갱신 | snapshot revision 상승을 수신하면 현재 route에서 derive. 진행 중 command가 오래된 revision이면 재조회·검토 요청 |

URL에는 화면 선택만 저장한다. 예산·결제 진행·연결 성공 여부를 query에서 정본으로 읽지 않는다. 초안은 owner별 draftId로 복원한다. 기존 해시 제거·lastSid 우선 복귀의 문제는 F:L36, FM:L14–17,L198에 근거한다.

## 6. 활성화(연결·결제) 체크아웃 상태 머신

### 6.1 사용자에게는 한 흐름, 내부에는 독립 단계

표면상 **① 계정 준비 → ② 이용 방식·예산 확인 → ③ 시작**으로 묶는다. ① 내부에 `UID 연동: 요금 상쇄용`과 `실행 연결: 주문 실행용` 두 행을 두고 각각 상태를 표시한다. UID 없이 API만 연결하는 경로도 허용한다. 둘의 성공을 같은 이벤트로 만들지 않는다.

`Activation={id,ownerId,targetAccountId,intent,step,status,uidTask,apiTask,paymentTask,budgetDraft,reviewRevision,attempts,completionEventId}`. `step`은 진행 위치이고 완료 사실은 account/subscription 정본에서 다시 읽는다.

| 현재 상태 | 이벤트·가드 | 다음 상태·효과 | 실패·복귀 |
| --- | --- | --- | --- |
| idle | OPEN(intent) | editing/account; 기존 완료 항목 불러오기 | 검증 전략 없어도 계정 연결·플랜 관리 가능 |
| editing/account | UID_SUBMIT | uidTask=verifying; operationId 발급 | 실패→uidTask=error, 입력 보존·재시도 |
| uid verifying | UID_VERIFIED(같은 계정·attempt) | accounts.uidLink=verified; API 단계 제안 | 늦은 다른 계정 응답은 현재 draft에 적용 안 함 |
| editing/account | API_SUBMIT | apiTask=connecting | UID 미완료여도 API 작업 가능 |
| api connecting | API_CONNECTED | execution=connected; 다음 필요 단계 | 실패→apiTask=error; UID 완료·플랜 유지 |
| editing/billing | PLAN_SELECTED/CONTINUE_WITH_CREDITS | 예상 청구·남은 필요 단계 갱신 | 잔여 크레딧으로 가능하면 결제 생략 |
| editing/billing | PAYMENT_SUBMIT(quoteRevision 일치) | paymentTask=processing | 응답 불명→reconciling; 즉시 새 결제 금지 |
| payment processing | PAYMENT_CONFIRMED | subscription active; step=budget/review | 실패→paymentTask=error; API/UID 성공 취소 안 함 |
| editing/budget | BUDGET_CONFIRMED | budget allocation draft 저장; review | 부족/단위 오류는 필드 오류, 다른 단계 유지 |
| review | CONFIRM_START(최신 자격·버전·예산 만족) | submitting; 공통 start/followStart command | 오래된 견적/버전이면 review 갱신, 재확인 |
| submitting | START_ACCEPTED(instanceId) | starting; 인스턴스 ready/starting 생성 | 응답 불명→operation 조회, 같은 idempotency key로 재시도 |
| starting | STRATEGY_RUNNING | completed; 보상 이벤트 1회 | 실행 실패→error+ready 인스턴스, 수정·재개 가능 |
| 임의 editing/error | CLOSE/BACK | suspended, 현재 route 복귀 | 완료된 연결·결제는 유지. draft만 재개 |
| suspended/reconciling | RESUME/STATUS_RESOLVED | 정본에 맞는 첫 미완료 단계 | 클라이언트 마지막 화면만 믿고 다시 청구하지 않음 |

- “UID 건너뛰기”는 skipped 상태이며 verified가 아니다. “플랜 없이 계속”도 payment success를 만들지 않는다.
- API 성공·결제 실패 → “실행 연결 완료, 이용 방식 확인 필요”. 결제 성공·API 실패 → “플랜 활성, 실행 연결 재시도”. UID만 성공 → “요금 연동 완료, 실행 연결 필요”.
- 결제·API가 실패해도 규칙 paper나 기존 기록을 열 수 있다. 실패 때문에 원래 전략 draft를 새로 만들지 않는다.
- 계정 관리 intent는 전략이 없어도 완료할 수 있다. start intent의 검증·예산 조건은 review에서만 검사한다(F:L23).
- 취소는 새 요청을 멈추고 작업 화면을 닫는 의미다. 이미 승인된 결제를 취소됨으로 덮어쓰지 않으며 늦게 확인된 성공은 해당 operation에 기록한다.
- 효과 실행은 adapter 담당, reducer는 이벤트 적용만 담당. 이벤트 ID 중복·역순 수신·리로드를 견디는 구조로 한다.

### 6.2 성공 순간의 보상 화면

| 완료 종류 | 트리거 | 표시·후속 |
| --- | --- | --- |
| 계정 연결 완료 | 해당 activation의 필요한 connection tasks가 완료된 이벤트 | 작은 완료 카드: UID·API 각각 결과, 다음 CTA. “전략 운용 시작”이라고 표시하지 않음 |
| 플랜 활성화 | PAYMENT_CONFIRMED + subscription revision 확인 | 플랜·예상 청구 갱신, 원래 흐름 계속 |
| 첫 전략 활성화 | **STRATEGY_RUNNING** 이벤트와 instanceId 확인 | 제목·예산·실행 방식·첫 점검 예정·터미널 열기. 첫 체결을 기다릴 필요 없음 |
| 다음 점검 도착 | 최초 agent/rule/follow 이벤트 | 터미널 최신 활동에 표시. 결제 완료 보상과 혼합하지 않음 |

`completionEventId`를 저장해 새로고침·뒤로가기·중복 webhook에 축하 화면이 반복되지 않게 한다. 모션을 줄인 사용자는 정적 완료 상태를 본다. 현재 API 완료 뒤에도 conn이 없는 문제와 즉시/later 시작 후속 이벤트 차이를 함께 해결한다(index:L9916–9928,L9953–9978,L13462–13467).

## 7. 따라가기 마켓플레이스 데이터·상태

### 7.1 목록·상세·크리에이터 분리

| 엔티티/뷰 | 상태·계약 |
| --- | --- |
| `Publication` | `id,creatorId,strategyId,sourceVersion,underlyingKind,title,description,assets,exchangeCapabilities,availability,metricsByPeriod,updatedAt` |
| `MarketQuery` | `query,kind:all/agent/rule/hybrid,asset,venue,period:7d/30d/90d,sort:followersPnl/return/mdd/runtime,dir,cursor` |
| 목록 URL | `#/market?period=30d&sort=followersPnl&dir=desc&kind=all`. 검색 입력 250ms debounce, 제출/필터는 query와 cursor 원자 갱신 |
| 기본 정렬 | 30일 팔로워 순손익 내림차순, 동률 publicationId 오름차순, 값 없음은 마지막. 지표·기간·집계 시점 표기. 추천 점수는 산식·자료가 정의된 후 별도 도입 |
| 카드 | 전략 title + creator 이름 분리. 유형·30일 수익·MDD·팔로워 순손익·운용일·가용 슬롯, 짧은 성과곡선. 데이터 없는 값은 0으로 채우지 않음 |
| 상세 route | `#/market/<publicationId>?tab=overview&period=30d`. 탭=개요/성과/판단·규칙/포지션/거래 이력. 내 follow instance가 있으면 “내 운용 보기” 별도 블록 |
| 목록 복귀 | URL query와 목록 scroll anchor 복원. 상세에서 기간 바꿔도 뒤로가면 원래 목록 query 보존 |
| creator 전용 | `#/creator`, `#/creator/publications/<id>`: 게시 버전·설명·노출·팔로워·수익분배 관리. investor의 목록/따라가는 중과 별도 뷰 |

- 계정은 creator와 follower를 겸할 수 있다. mode boolean을 계정 자격으로 저장하지 않고 route로 뷰를 선택한다(C:L133).
- “설정 가져오기”는 독립 draft, “따라가기”는 원본 실행 동기화다. 상세의 주 CTA는 따라가기이며 가져오기는 별도 보조 액션이다(IA:L57).
- API 응답에는 cursor와 snapshotRevision을 함께 넣어 실시간 성과 갱신이 정렬 페이지 사이 중복·누락을 만들지 않게 한다.
- Publication이 중지·가득 참·삭제되면 탐색 자료는 읽되 새 followStart는 현재 availability를 재검사한다. 기존 follower는 자신의 instance와 원본 단절 상태를 볼 수 있다.
- 벤치마크 근거: 기간·팔로워 실적·운용일 C:L106–119, 기존 포지션·중단·creator 분리 C:L128–133. 외부 플랫폼의 최소금액이나 분배율을 TETH 확정 정책으로 복사하지 않는다.

### 7.2 따라가기 설정 3단계

`FollowDraft={id,publicationId,sourceVersion,step,budget,sizing,existingPositions,pairs,advanced,accountId,quoteRevision,status}`.

| 단계 | 입력·화면 | 전이·가드 |
| --- | --- | --- |
| 1. 예산 | 총 예산·통화, 내 계정 가용액. 기본 sizing=proportional | NEXT: 유효 예산·해당 원본 최소금액. 미로그인은 intent 보존 후 로그인 |
| 2. 따라갈 방식 | 비례 기본, 지원 시 고정 금액; 기존 포지션 `skip/copy_all/better_price_only`; 페어 선택·고급 설정 접기 | NEXT: source capability 확인. 미지원 모드는 선택 불가 이유 표시. 설정 변경 시 quote 무효화 |
| 3. 확인·시작 | 내 예산·비율 예시·첫 동작·수익분배·예상 비용·계정 연결 요약 | CONFIRM: 최신 원본·계정·자금 재검사 → submitting → running/failed |

- `existingPositions=skip`을 기본값으로 제안한다. 확인에는 “현재 포지션은 복제하지 않고 다음 진입부터”를 표시한다. 실제 선택값에 따라 첫 동작 문구가 바뀐다.
- 중간에 activation이 필요하면 동일 FollowDraft를 참조하고 복귀 후 3단계 요약을 재검사한다. UID/API/결제 때문에 카피 금액을 잃지 않는다.
- 더블 클릭·새로고침은 같은 followOperationId를 사용한다. 원본 ID+계정의 중복 운용은 먼저 기존 인스턴스를 열도록 제안하고 명시적 추가 인스턴스 생성은 별도 지원 여부로 관리한다.
- 원본 버전 변경은 기존 follower의 동의된 syncPolicy로 처리한다. 복제 template는 자동 갱신하지 않는다. 원본 명령 sequence와 내 주문 id를 연결해 누락·실패를 표시한다.

### 7.3 일시정지·중단과 포지션 처리

| 액션·선택 | 상태 전이 | 완료 조건 |
| --- | --- | --- |
| 일시정지 | running→paused; 신규 진입 복제 중단 | 기존 포지션의 축소·청산 동기화는 유지; UI에 범위 표시 |
| 중단 + 지금 정리 | running/paused→stopping; 신규 진입 차단·내 포지션 청산 명령 | 체결 확인 후 stopped. 부분 체결·실패는 stopping 유지·재시도 |
| 중단 + 원본 청산 대기 | running/paused→stopping, mode=drain | 추가/신규는 받지 않고 기존 포지션 축소·청산만 수신. 전부 닫히면 stopped |
| 중단 + 직접 관리 | 실행 어댑터가 지원할 때만 선택; 명시 확인 후 포지션 관리 주체 이관 | 이관 확인 뒤 stopped. 포지션은 계정 영역에 남고 자동으로 닫혔다고 표시하지 않음 |

빈 포지션이면 종료를 즉시 확정할 수 있다. “중단” 버튼 하나로 선택 없이 모두 청산하지 않는다. 실제 Bitget 어댑터의 지원 여부는 capability로 제한한다. 벤치마크도 신 시스템에서 수동 옵션이 다름을 기록한다(C:L49–56). 현행 cpClose/ledger를 정규 Strategy의 command 결과와 연결한다(FM:L72,L96).

## 8. 거래소 연결 페이지 상태

기본 주소는 `#/connections`, Bitget을 첫 추천 카드로 고정한다. 추천 여부와 사용자의 연결 여부는 별도다. 현재 Bitget rank=5·Binance rank=1이며 큰 목록은 21개다(`teth-copy.js:L25–36`, IA:L36).

| Bitget 카드 상태 | 파생 조건 | 표시·CTA |
| --- | --- | --- |
| 미연결 | UID unlinked + API disconnected | UID 연동/실행 연결 두 체크 행, “Bitget 연결” → activation |
| 연결 중 | 어느 task든 verifying/connecting | 진행 중인 항목·이미 완료된 항목 표시, “계속하기” 또는 기다림. 카드 전체 재시작 금지 |
| 부분 완료 | UID verified 또는 API connected 중 하나 | “요금 연동 완료 / 실행 연결 필요” 또는 반대. 필요한 단계만 CTA |
| 연결됨 | 대상 계정의 UID verified + API connected | 각각 확인 시점 표시, “계정 관리 / 터미널 열기”. 플랜 활성은 별도 요금 정보 |
| 오류 | 현재 task가 error 또는 기존 연결의 연결 상태 error | 실패 항목·완료 사실 보존, “실패 단계 재시도”. 다른 task의 성공을 지우지 않음 |

- 부분 완료는 4개 시각 상태 중 미연결/연결 중 카드의 상세 variant로 구현해도 되지만 데이터에서는 명시 상태다. 단일 connected boolean로 합치지 않는다.
- `ConnectionCatalogEntry={id,name,priority,availability:supported/coming_soon,capabilities:{uid,execution,markets,followModes},connectAction}`만 목록에 필요하다.
- 기타 지원 거래소는 이름·지원 방식·내 상태·연결 CTA의 작은 행으로 축소한다. 준비 중은 접힌 목록에서 이름·준비 중만 표시하며 작동하지 않는 연결 버튼은 없앤다.
- 평점·가상 후기·대형 프로모션·연결 계정수는 활성화 판단에 필요하지 않으므로 기본 목록에서 제거한다. 상세는 필요한 연결 안내·지원 기능만 남긴다.
- 계정 연결은 검증 전략 유무와 무관하게 완료 가능. 연결 뒤 원래 전략·market draft·PLAN으로 복귀한다. 관련 현행 막힘: index:L15440–15465, F:L23.
- 한 거래소에 여러 계정을 붙일 수 있는 schema를 사용하되 최초 UI는 Bitget 기본 계정 1개를 선택한다. 연결 검사에는 반드시 accountId를 전달한다.

## 9. QA 패널 재설계

### 9.1 프리셋은 독립 스냅샷 전체 교체

- 기존 토글 9개·부분 reset을 조합하지 않는다(index:L15801–15929, F:L30,L35). `applyPreset(id)`는 QA namespace의 snapshot을 새 객체로 교체한다.
- 실행 중 timer/request는 fixtureGeneration을 올려 무효화하고 selection·intent·candidate·checkout·캐시를 비운다. 늦은 응답이 새 프리셋을 덮지 못한다.
- **상업 프리셋 11개**와 **전략/실패 overlay**를 별도 행으로 제공한다. 모든 11개는 기본적으로 사용자 실행 전략0; 액티브 화면은 별도 “공통 전략 첨부” 버튼으로 재현한다.
- 사용자 데이터는 읽거나 덮어쓰지 않고 `teth.qa.v2:<runId>` 메모리/저장소만 사용한다. 실제 어댑터 대신 결정론적 mock adapter를 선택한다.

### 9.2 정확한 fixture 공통값·정책

| 변수 | 모든 프리셋에 적용할 정확한 값 |
| --- | --- |
| 시각·기간 | `now='2026-09-24T00:00:00Z'`, `periodStart='2026-09-01T00:00:00Z'`, `periodEnd='2026-10-01T00:00:00Z'`, periodId=`2026-09-qa` |
| 스냅샷 | schemaVersion=2, revision=1, hydration=ready, policyVersion=`qa-v2-1` |
| 사용자 | L=0이면 user=null, ownerId=null. L=1이면 user.id=ownerId=`qa-user` |
| 계정 | L=1이면 id=`qa-bitget`, exchangeId=`bitget` 1개, 아니면 [] |
| U=1 | uidLink={status:verified,uidRef:qa-uid,verifiedAt:now}; U=0이면 {status:unlinked,uidRef:null,verifiedAt:null} |
| E=1 | execution={status:connected,connectionId:qa-exec,verifiedAt:now,revision:1}; E=0이면 {status:disconnected,connectionId:null,verifiedAt:null,revision:1} |
| P=1 | subscription={planId:qa-pro,status:active,periodStart,periodEnd,collectionStatus:ready,revision:1} |
| P=0 | subscription={planId:null,status:none,periodStart,periodEnd,collectionStatus:none,revision:1} |
| meter | complete=true, periodId, asOf=now, sourceRevision=1. successfulAiUnits/liveNotionalUSDT는 아래 11행 값 |
| billingFacts | currency=USD, adjustmentsMinor=0, reservationsMinor=0, settlementStatus=current, graceUntil=null, periodId. 무료·거래 크레딧은 아래 값 |
| portfolio/UI | strategies=[], positions=[], publications=[], events=[]; selection=null, intents=[], activation=null, candidates={}, caches={}; route=`#/trade`, scope=owned |
| 공통 draft | L=1에만 workspace `qa-w1` version1, kind=agent, BTC/USDT, budget={amount:500,currency:USDT,accountId:qa-bitget}, validation={status:passed,version:1}; content는 결정론적 agent fixture |
| context | targetAccountId=`qa-bitget`(guest는 null), workspaceId=`qa-w1`(guest는 null), action=`startLive`, requestedCostMinor=10 |
| 가격·포함량 | qa-pro 플랜료=4900 cents, 포함 AI=100 units; 비플랜료=0, 포함량=0. 초과량 unit당 10 cents |
| 고/저 기준 | usage high≥1000 units, low=0…999. trade zero=0, low>0 & <1,000,000 USDT, high≥1,000,000 USDT |
| 크레딧 | 로그인 fixture의 해당 월 무료 크레딧=1000 cents. 거래 크레딧은 아래 확정 집계 값. guest는 모두0 |

위 숫자는 엔진 비교를 위한 **QA 정책**이다. 현행 운영 가격·무료 지급액·Bitget 커미션율이라고 주장하지 않는다. 이 fixture는 서버 집계 응답을 직접 제공하므로 이벤트 목록이 비어 있어도 집계 값을 다시 0으로 계산하지 않는다. 이벤트 재생 테스트는 별도 fixture로 수행한다.

### 9.3 프리셋 11개가 set하는 값

U·E·P·L은 위의 정확한 객체 확장 약어다. 각 행은 공통 fixture에서 새로 생성하며 이전 행을 patch하지 않는다.

| preset | L | U | E | P | successfulAiUnits | liveNotionalUSDT | freeCreditMinor | commissionCreditMinor |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 01 guest | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 02 signed-in | 1 | 0 | 0 | 0 | 0 | 0 | 1000 | 0 |
| 03 linked-zero | 1 | 1 | 1 | 0 | 0 | 0 | 1000 | 0 |
| 04 linked-low | 1 | 1 | 1 | 0 | 0 | 200000 | 1000 | 1000 |
| 05 linked-high | 1 | 1 | 1 | 0 | 0 | 5000000 | 1000 | 25000 |
| 06 plan-high-unlinked | 1 | 0 | 0 | 1 | 1600 | 0 | 1000 | 0 |
| 07 plan-low-unlinked | 1 | 0 | 0 | 1 | 10 | 0 | 1000 | 0 |
| 08 plan-high-high | 1 | 1 | 1 | 1 | 1600 | 5000000 | 1000 | 25000 |
| 09 plan-high-low | 1 | 1 | 1 | 1 | 1600 | 200000 | 1000 | 1000 |
| 10 plan-low-high | 1 | 1 | 1 | 1 | 10 | 5000000 | 1000 | 25000 |
| 11 plan-low-low | 1 | 1 | 1 | 1 | 10 | 200000 | 1000 | 1000 |

### 9.4 기대값 표

coverage는 **다음 요청 10 cents** 기준이고 청구액은 현재까지의 월 합계다. guest는 미표시·자격 없음. live 허용은 공통 agent draft의 준비 상태를 포함한다. CTA·activationMessage·interrupt 기대는 §1.4와 같다.

| preset → stateId | usageBand / tradeBand | dueMinor | coverage | aiTask / startPaper / startLive | trade view |
| --- | --- | --- | --- | --- | --- |
| 01 → 1 | — / — | null | unknown | no / no / no | guest |
| 02 → 2 | low / zero | 0 | covered | yes / yes / no | inactive |
| 03 → 3 | low / zero | 0 | covered | yes / yes / yes | inactive |
| 04 → 4 | low / low | 0 | covered | yes / yes / yes | inactive |
| 05 → 5 | low / high | 0 | covered | yes / yes / yes | inactive |
| 06 → 6 | high / zero | 18900 | postpaid | yes / yes / no | inactive |
| 07 → 7 | low / zero | 3900 | postpaid | yes / yes / no | inactive |
| 08 → 8 | high / high | 0 | covered | yes / yes / yes | inactive |
| 09 → 9 | high / low | 17900 | postpaid | yes / yes / yes | inactive |
| 10 → 10 | low / high | 0 | covered | yes / yes / yes | inactive |
| 11 → 11 | low / low | 2900 | postpaid | yes / yes / yes | inactive |

**추가 1클릭 overlay**

- `owned-rule-ready`: 새 id의 ready rule instance 첨부 → active terminal; 검증 결과는 기존 엔진으로 계산한 완전한 result fixture를 사용한다.
- `owned-follow-running-only`: follow 1개, 다른 strategy0 → active; 예전 cp-only 인트로 회귀 검사.
- `uid-only/api-only`, `plan-linked-zero`, `usage-unknown`, `hydration-loading/error`, `payment-failed`, `credit-exhausted`, `API-disconnected-after-start`, `all-paused`, `hold-1260`, `out-of-order-response`.
- `credits-exhausted`는 plan none, credit=overage로 맞추어 due=0이지만 next request가 blocked인 경우를 별도 검증한다.
- `high-trade-not-free`는 08의 사용량을 4000으로 변경해 청구액>0 확인. `low-trade-zero-bill`은 09의 무료 크레딧을 총비용 이상으로 설정해 청구액0 확인.

### 9.5 PASS/FAIL 저장·진척판

`QaResult={runId,caseId,presetId,fixtureHash,policyVersion,sourceHash,viewport,startedAt,finishedAt,expected,actual,status,assertions,evidenceRefs}`. 상태는 `NOT_RUN/RUNNING/PASS/FAIL/BLOCKED`; 버튼 클릭이나 토스트를 PASS로 저장하지 않고 assertion 전체가 참일 때만 PASS. 새 코드/정책/fixture 해시가 오면 이전 PASS는 과거 실행으로 표시한다. JSON export/import와 스크린샷·CDP trace 경로를 연결한다.

| 진척판 10항목 | 완료 판단 |
| --- | --- |
| 1. 상태 분류 | 11개 ID + 미분류·복원 중 경계 통과 |
| 2. 청구·coverage | 공식·구간 경계·0원/소진 구분 통과 |
| 3. UID/API | 네 조합 + 계정별 연결 검사 통과 |
| 4. 플랜·체크아웃 | 실패·재시도·부분 완료·중복 응답 통과 |
| 5. 전략 정규화 | funnel/user/demo/ss3/cp adapter 무손실·kind 보존 |
| 6. 실행 명령 | 시작/나중에 시작/정지/재개/버전 적용 일치 |
| 7. 3개 trade 뷰 | mode 전환·딥링크·새로고침·뒤로가기 통과 |
| 8. 따라가기 | 탐색·3단계·중단 3방식·creator 분리 통과 |
| 9. 터미널·로그 | 반응형·키보드·그룹화·1,260건 부하 통과 |
| 10. 공통 회귀 | 언어·통화·보고서·고객지원·콘솔·기존 페이지 통과 |

각 항목은 연결된 case의 `PASS 수/전체 수`로 자동 계산한다. 필수 case 중 BLOCKED가 있으면 완료로 칠하지 않는다.

### 9.6 프로덕션 노출 차단

- QA 패널·fixture·window 테스트 bridge는 향후 별도 dev 전용 모듈로 분리하고 **배포 파일 allowlist에서 제외**한다. 실제 계정 버튼 옆에 숨겨진 QA DOM을 남기지 않는다.
- 현재 정적 저장소에 빌드가 없으므로 배포 단계의 제외 규칙이 준비되기 전에는 localhost 전용 loader + 명시 dev flag를 함께 사용한다. query나 localStorage 값 하나만으로 활성화하지 않는다.
- 배포 검증은 production HTTP origin에서 QA 모듈 404, QA 버튼·test bridge 부재, `?qa=1`에도 미노출을 확인한다. 이는 제품 노출 제어이며 보안 감사 항목은 아니다.

## 10. 회귀 안전과 검증 계획

### 10.1 유지할 동작과 변경 경계

| 유지 | 파손 위험·대응 |
| --- | --- |
| 자연어 입력→검증→보고서→실행 흐름 | workspace 전환에서 이전 pendingP/cur 혼입 가능. id/version별 결과 귀속 검사 |
| 결정론적 rule 백테스트와 지표 | adapter가 sharpe/pf/cagr를 누락하거나 fee를 이중 차감할 수 있음. 전체 result schema 비교 |
| 쉬운/전문가 보고서, 복기·기간 보고서 | 기존 at 기반 URL을 새 strategyId로 매핑. 삭제 후에도 report snapshot 유지 |
| 자연어 전략 수정·재검증·버전 표시 | 검증된 버전과 실행 appliedVersion 차이 표시. 늦은 후보를 다른 전략에 적용하지 않음 |
| paper 실행·일시정지·재개 | 시작·재개 모두 API 불필요한 동일 gate. 연구/터미널이 같은 상태 읽기 |
| 알림·설정·인사이트·세션 기록 | 경로 이전 중 intent 중복 소비·lastSid 덮어쓰기 방지 |
| 다크 테마·7개 언어·통화·키보드·모바일 | messageKey 전환 시 새 키 누락, 통화 표시가 원장값 변경하지 않는지 검사 |
| `/about/`, `/download/`, `/policies/` 및 고객지원 | 공용 가격 catalog·상대경로 이행 때 링크·렌더 회귀 검사. 정책 문구 변경은 범위 밖 |

### 10.2 CDP 자동화 방식

- 헤드리스 Chrome을 로컬 HTTP 서버에 연결한다. CDP `Page.navigate`, `Runtime.evaluate`, `Input.dispatchMouseEvent/KeyEvent`, `Emulation.setDeviceMetricsOverride`, `Page.captureScreenshot`, `Runtime.exceptionThrown`, `Network.loadingFailed`를 사용한다.
- fixture clock·mock transport 지연·응답 순서를 고정한다. 미래 dev bridge는 `qa.applyPreset`, `qa.dispatchMockEvent`, `qa.inspect`만 제공하고 기대값 계산은 제품 derive를 다시 호출하지 않는 독립 fixture 표로 한다.
- 준비 완료는 snapshot hydration + `data-view` + pending command 완료로 기다린다. 고정 sleep으로 성공을 판정하지 않는다.
- `data-testid`, 접근성 이름, 화면 텍스트, 상태 snapshot, command/event 횟수를 함께 검증한다. 상태를 직접 넣는 preset 테스트 외에 실제 버튼/입력으로 끝까지 진행하는 사용자 경로도 포함한다.
- viewport: **1440×900 데스크톱 / 1024×768 태블릿 / 390×844 모바일**. DPR=1·고정 시간·동일 seed. 좁은 breakpoint 경계 767/768/959/960/1279/1280은 추가 레이아웃 검사로 처리한다.

### 10.3 자동 검증 시나리오 30개

| # | 준비·행동 | 필수 assertion |
| --- | --- | --- |
| 01 | 11개 프리셋 순회 | stateId·밴드·청구액·coverage·CTA가 §1.4/§9.4와 모두 일치 |
| 02 | guest→로그인, 같은 #/trade | guest DOM 제거·inactive DOM 생성, 개인 상태·체크리스트 표시 |
| 03 | ready instance 생성→시작→일시정지 | active 유지, running/paused만 전환, 랜딩 복귀 없음 |
| 04 | cp-only, clone-only 각각 진입 | 모두 owned 전략으로 집계·active 뷰 |
| 05 | U/E=00/10/01/11 | UID와 API 상태·CTA·live gate가 서로 독립 |
| 06 | Bitget 연결 상태에서 다른 계정 전략 실행 | 다른 accountId에 연결 성공이 전파되지 않음 |
| 07 | 플랜+UID+거래0 / meter incomplete | unclassified/reconciling 사유 정확, 임의 저거래 분류 없음 |
| 08 | usage999→1000, 거래0→1·999999→1000000 | 정의한 경계에서만 밴드 변경 |
| 09 | 월말 경계 전후 fill·usage | [start,end) 집계, 다음 달 중복/누락 없음 |
| 10 | 높은 거래+더 높은 사용 / 낮은 거래+큰 무료 크레딧 | 상업 ID와 청구0 독립, 산식 정확 |
| 11 | due=0·잔여0·비플랜에서 AI 요청 | action-block, 규칙·기존 기록 열람 계속 가능 |
| 12 | paid/free/commission 각각 AI 성공·실패·취소 | 성공 usage 관측 일관, requestId 중복 소비 없음 |
| 13 | paper fill / live fill / 중복 fill | paper는 liveNotional·commission에 미반영; live 1회만 반영 |
| 14 | 원장 2,001건 + 목록 페이지 이동 | 원장 합계 불변, 표시 절단이 잔액을 바꾸지 않음 |
| 15 | UID 완료→API 실패→리로드→재시도 | UID 유지, API만 재시도, 완료된 지급 중복 없음 |
| 16 | 결제 성공→API 실패, 반대 순서도 실행 | 부분 완료 상태 정확, 성공 단계 롤백·재결제 없음 |
| 17 | 결제 timeout→성공 지연 응답→재시도 | operation 조회·동일 idempotency key, 구독 1개·보상 1회 |
| 18 | 시작 버튼 두 번, 즉시 시작과 later→start 비교 | 인스턴스1개, 같은 후속 이벤트·예산·계정 snapshot |
| 19 | 연구 화면 pause/stop 후 터미널 확인 | 같은 Strategy.status·동일 command 결과 |
| 20 | 미연결 paper 시작→정지→재개 | API CTA 없이 정상 재개, live 전환 시에만 API 필요 |
| 21 | 전략 A 수정 중 B 선택, A 검증 늦게 도착 | B 차트·params 불변, A candidate에만 귀속 |
| 22 | activation/back/forward/새로고침·직접 딥링크 | 초안·intent·route 보존, 소비1회·누락 id 복구 화면 |
| 23 | hydration 지연 2초·오류 후 재시도 | guest 깜빡임·해시 제거 없음, 준비 후 지정 전략 선택 |
| 24 | market 정렬·기간·검색→상세→뒤로 | query·정렬·scroll 복원, null metric 후순위·안정 tie-break |
| 25 | follow 3단계→연결 우회→복귀→시작 | 예산·기존 포지션 선택 보존, 내 follow instance만 생성 |
| 26 | follow 일시정지·중단 3방식·부분 체결 | 신규 진입 제한·잔여 포지션·완료 조건이 선택과 일치 |
| 27 | demo 진입·제어·설정 가져오기·복귀 | owned 합계/연결/알림 불변, 가져온 것은 새 draft |
| 28 | 1,260 로그·연속 hold·버전 변경·새 이벤트 수신 | 그룹 정확·페이지 경계 보존·DOM 상한·scroll anchor·성능 목표 확인 |
| 29 | 3 viewport·7개 언어·통화·키보드 | 화면 가로 넘침0, 포커스 복원·모달 겹침·입력 가림 없음, 원장 불변 |
| 30 | production 노출 + 공통 경로 smoke | QA 미노출, 루트/about/download/policies 해시·링크 정상, 새 JS 예외0 |

10번의 입력값 변화는 문서의 fixture overlay로 재현하고, 01·02·03·22·24·25·27·29는 세 viewport 모두 실행한다. 28은 기본 CPU와 4배 slowdown을 따로 기록한다. 모든 case에서 console 예외·실패한 필수 자산을 수집한다. 외부 차트/CDN이 차단되면 제품 상태 검증과 외부 자산 검증을 따로 기록하고 후자를 BLOCKED로 남긴다.

**이번 작업에서 수행한 검증**: 지정 현황·리서치 7개 문서 읽기, 관련 실제 코드·설정 교차 확인, 소스 hash 일치 확인. Node로 11개 fixture 청구 산식을 독립 재계산해 기대값 일치를 확인했고, Markdown 표 열 수·후행 공백·11개 필수 절·코드 스케치 22줄을 점검했다. `git diff --check`를 실행했으며, 미추적 신규 문서는 별도 형식 검사로 보완했다. 위 30개 CDP 시나리오와 새 상태 엔진은 아직 구현·실행하지 않았다. 브라우저·실제 백엔드·결제·거래소 동작이 검증됐다고 간주하지 않는다.

## 11. 제품 책임자(Claude)·UX 디렉터(AGY)에게 반대할 가능성이 큰 5가지

아래는 실제 상대 제안을 읽고 반박한 내용이 아니다. 독립 설계에서 미리 제시하는 예상 논점이다.

| # | 예상 반대 대상 | 반대 이유·근거 | 대안·합의 기준 |
| --- | --- | --- | --- |
| 1 | Claude: “11개 상업 상태마다 고정 CTA와 활성 화면을 지정하자” | 계정의 과금 분류만으로 API·draft·cp·실행 실패를 설명할 수 없다. cp-only 인트로와 api/conn 모순이 이미 존재(F:L19,L29; index:L14610). | 11개 ID는 분류, entitlement·CTA는 action context로 파생. 11개+직교 경계를 모두 1클릭 재현하면 합의 |
| 2 | Claude: “UID와 API를 한 번에 연결됨으로 묶고 고거래는 무료라고 쓰자” | UID 성공만으로 API가 생기지 않는다(FM:L163–169). 고거래도 초과 종량이 더 크면 청구액이 남는다. 단일 체크는 부분 완료·재시도 설계를 없앤다. | 표면은 한 activation 흐름, 정본·체크 행은 두 개. 금액은 네 항목 산식으로 표시; ⑧ 유료·⑨ 0원 경계로 확인 |
| 3 | AGY: “게스트와 로그인 미활성은 같은 랜딩에서 CTA만 바꾸면 된다” | 사용자가 요구한 서로 다른 세 제품을 충족하지 못한다. 로그인 사용자의 미완료 초안·연결·예산은 마케팅 섹션과 다른 정보구조다(IA:L27, FM:L149–154). | guest는 이해·탐색, inactive는 활성화 작업, active는 운용. DOM·데이터 의존성·완료 조건을 각각 정의 |
| 4 | AGY: “터미널을 풍성하게 보이게 데모 6개·모델 경쟁·공통 AI 피드를 유지하자” | 데모 live가 내 집계에 섞이고 현재 규칙 replay에 scan을 삽입한다(index:L10028–10036,L10347–10355). 모델 정체성과 실행 방식도 혼동된다. | 데모 별도 체험, 전략 유형별 renderer, TETH 판단 주체 유지. 실제 owned 수0이면 정확한 활성화 화면 제공 |
| 5 | Claude·AGY: “카피·설정 복제·공개 전략을 객체 하나와 중단 버튼 하나로 단순화하자” | ss3는 파라미터 복제, cp는 원본 실행 동기화·독립 자금원장이다(FM:L123–125,L197). 중단 뒤 포지션이 남을 수 있다(C:L130–133). | 공통 Strategy envelope와 source 관계, kind별 executor. 가져오기/따라가기 액션 분리, 종료 시 포지션 처리 선택·완료 조건을 명시 |

**구현 착수 기준**: 동일 스냅샷이 모든 화면에서 같은 자격·청구·연결 사실을 만들고, Strategy command가 모든 출처에서 같은 생명주기를 가지며, QA가 11개 상업 상태와 부분 완료·복귀 상태를 사용자 데이터 변경 없이 재현할 수 있어야 한다.
