# CODEX PHASE 1 FINDINGS

- 분석 기준: 2026-09-24 작업 트리, `index.html` 17,729줄, SHA-256 `38014c3867de7a9d8fb65567dff999c8081e39128476b0c03525d17f459c558d`.
- 범위: 제품 상태 구조·화면 흐름만. 제품 코드 수정 없음. 산출물은 이 파일과 [상태 매트릭스](CURRENT_STATE_MATRIX.md), [흐름 맵](CURRENT_FLOW_MAP.md) 3개다.
- 근거의 L번호는 별도 명시 없으면 index.html이다. **정적 확인**은 실행문/호출부를 추적했다는 뜻이며 브라우저에서 재현 완료했다는 뜻이 아니다. **격리 실행**은 원본 함수·설정을 Node VM으로 읽고 DOM·저장 함수만 no-op으로 바꿔 메모리에서 실행한 결과다.
- P0=사용 가능/실행 여부를 서로 반대로 표현하거나 상태 원장을 훼손하는 핵심 문제, P1=주요 퍼널·시나리오·객체 간 불일치, P2=복귀·관측·QA 정확도 문제. 심각도는 데모 제품 구조 기준이며 보안·법률 평가가 아니다.

## 1. 문제 목록 — 27건

| ID·우선순위 | 문제 | 코드 근거 | 재현 시나리오·확인 수준 | 왜 문제인가 / 수정 방향 |
| --- | --- | --- | --- | --- |
| F01 **P0** | 구형 자격과 새 과금 게이트가 서로 다른 결과 | tfEnt L12871–12881; cardOn L12742; tfAiGate L12901–12908 | 새 로그인→카드 월충전→freeUsed=10: **bcBalance=3100, bcTier=CARD인데 free-out·gate=false**. 격리 실행 | 충전 성공과 AI 이용 가능이 연결되지 않음. entitlement와 coverage를 하나의 파생 결과로 제공해야 함 |
| F02 **P0** | 관망에서 UID 연결을 완료해도 복구 불가 | UID 지급 L13329–13332; promo L12655–12659; 회복 조건 L12668 | 새원장 잔액0, grace 25h 경과→watch→UID 연동: **creditBal=1000, bcBalance=0, watch 유지**. 격리 실행 | 화면은 연동·크레딧 지급 완료를 알리지만 동일한 신규 AI가 막힘. 지급 이벤트와 회복 조건의 원장 통일 필요 |
| F03 **P0** | 합계 원장 2,000개 절단이 잔액을 바꿈 | bcBalance L12850–12851; bcAppend L12854–12858; seen 유지 | welcome100 뒤 zero debit 2,000건→**잔액0, welcomeSeen=true, 재지급=false**. 격리 실행 | 목록 표시 캡이 회계 상태 정본을 절단함. 보존 원장 또는 opening balance checkpoint가 필요 |
| F04 **P0** | 연구 Live의 중지·종료와 터미널 실행 상태가 분리 | gToTerminal L8144–8150; gLivePause/Stop L8177–8190; tfBotCtl L13457–13475 | 연구 paper 실행→연구 세션 다시 열기→종료: sx.live=false만 변경, sessionId가 같은 t.strat 봇은 live 유지. 정적 확인 | “종료 완료”가 동일 전략의 다른 관리 화면에는 적용되지 않음. 연구 버튼도 canonical strategy command를 호출해야 함 |
| F05 **P1** | checkout 구독과 카드 월충전이 서로 연결되지 않음 | 승인 L9805; bcTier L12846; QA card L15861–15865 | 결제 성공은 payDone=true만. paid AI 200회: **bcTier=FREE, monthSpend=0, 잔액100**. 격리 실행 | 구독·카드 등급·월 청구·멤버십 설명이 다른 사용자 분류를 만듦. planActive의 정본 필요 |
| F06 **P1** | AI 高低 관측이 credit 자격에만 편향 | tfAiSpend L12884–12894→tfCreditSpend L12919–12931; taiMarket L16336 | free 1회는 freeUsed만 증가하고 새원장100 유지; paid 200회는 debit0. 격리 실행 | free/paid/trade 호출량을 bcMonthSpend로 비교할 수 없음. 사용 telemetry와 과금 debit을 분리해야 함 |
| F07 **P1** | 거래량 高低가 구현돼 있지 않음 | bcMonthVol L12700–12703; bcBranch L12712–12716; cap L12635–12643 | UID 사용자를 거래 적립100과2000으로 준비하고 같은 AI소비를 주면 v>0 이후 거래 高低 분기가 없음. 정적 확인 | uid.heavy는 AI 소비≥1500이고 거래 高가 아님. 명목거래량·기간·임계를 추가해야 함 |
| F08 **P1** | API 연결됨 표시와 실행 허용이 불일치 | API 성공 L9916–9917; QA L15847; tfBkConnSt L15444; canRun L13452 | api={ex:binance}, conn 미정의→**CONNECTED지만 canRun=false**. 격리 실행 | 연결 완료/연결 필요가 화면마다 다름. executionConnected를 계정·사업자 단위로 파생해야 함 |
| F09 **P1** | 전역 conn이 모든 거래소 봇을 허용 | tfNFCanRun L13450–13455; VM ex L10019; 계좌 탭 L10780 | Binance 연결+conn=true에서 OKX 봇 재개: canRun은 대상 거래소를 받지 않음. 정적 확인 | 다중 거래소 터미널인데 연결 정본은 api 한 개. 명시적 exchange별 연결 map 또는 단일 연결 제약 필요 |
| F10 **P1** | 유료 계정도 새 전략을 만들면 온보딩 plan이 초기화 | tfStart L9299; tfEnt L12874; tfCnStep L9681 | payDone=true 상태에서 새 위임→plan=null/ob=idle→검증 통과→connect 1단계. 정적 확인 | 계정 구독과 작업 방법 선택이 한 필드에 섞임. 결제 사실과 workspace 실행 경로를 분리 |
| F11 **P1** | 새 작업이 이전 pendingP를 사용 가능 | tfStart L9299–9300; tfVerifyGo L9392; tfWorkView L9456; tfWorkRun L9460 | A 검증으로 pendingP=A 저장→새 tfStart에서 B intake→검증. start/verifyGo는 pendingP를 비우지 않아 `pendingP\|\|tfParams()`가 A 선택. 정적 확인 | 화면 B 조건과 실제 계산 A가 갈라짐. 작업 생성 시 파라미터와 generation을 원자적으로 교체 |
| F12 **P1** | 계정 연동·구독이 현재 전략 검증에 종속 | tfNFUpgrade L13319–13321; tfBkGoLink L15459 | 로그인·미검증 사용자가 PLAN 구독→대화로 이동. UID 연동 뒤 거래소 연결→“검증을 통과한 전략…” 토스트에서 정지. 정적 확인 | 계정 상태 전환이 업무 객체 존재를 요구. 계정 설정 경로를 별도로 제공하고 resume intent로 작업 복귀 |
| F13 **P1** | 새 원장 거래충전에 paper 체결도 포함 | tfNFOnStart L13664/L13683; tfRebateCommit L13036–13038; 거래활성 제외 L13685 | UID 연결 후 done에서 가상 시작: rebates→volume 충전은 실행되고 tradeActiveUntil은 안 바뀜. 정적 확인 | 동일 거래의 과금 기여와 활동 자격 인정 기준이 다름. fill의 env/source를 집계 정책에 명시 |
| F14 **P1** | “나중에 시작” 경로는 시작 시 체결 후속 상태를 생성하지 않음 | ready 저장 L13693–13699; start L13462–13467 vs 직접 시작 L9971–9972 | 동일 검증을 바로 시작하면 fills/reviews/rebates/활동 갱신; later→대기 봇 시작은 status/env/알림만 변경. 정적 확인 | 실행 시점에 따라 보고서·정산·상업 상태가 달라짐. 단일 start command와 후속 이벤트 필요 |
| F15 **P1** | ready 봇은 거래소·예산 스냅샷이 누락 | 직접 생성 L9967–9969 vs later L13698; VM 폴백 L10019–10025 | A를 later 저장→B에서 다른 자산/예산/API 변경→A 표시가 전역 폴백을 읽음. 정적 확인 | 과거 전략 정보가 현재 workspace에 따라 바뀜. 생성 경로 공통 스키마 필요 |
| F16 **P1** | 시작 중복 판정이 설정이 아니라 자산 접두사·10분·src | tfStartStrategy L9965–9973 | 같은 자산/원본을 10분 내 다른 p·예산으로 검증하고 시작: some()이 true면 새 봇 생성과 훅을 건너뛰고 “시작됐어요” 표시 L9978. 정적 확인 | 별개의 전략을 이전 전략으로 잘못 합칠 수 있음. workspace/version 기반 idempotency key 필요 |
| F17 **P1** | 과금 watch 적용 범위가 전략 생성 경로마다 다름 | cpStart gate L11856; gNew L7270; ss3 copy L12240–12334; clone L10728–10734; 시작 L9958–9973 | watch에서 새 cp는 막히지만 기존 공유 상세의 ss3 설정복제·검증 및 터미널 clone은 gate 없이 진행. 정적 확인 | “신규 전략 차단” 의미를 제품 액션별로 통일할 수 없음. 템플릿 무료 허용이 의도라면 entitlement 항목을 분리해서 명시 |
| F18 **P1** | 카피 계좌·터미널 복제본이 사용자 전략 집계에 합류 안 함 | cp push L11873; clone push L10731; intro L14610; 인사이트 L14234–14243; 공유 L12444 | active cp 1개만 존재→**tfIntroNeed=true** 격리 실행. clone만 있으면 터미널은 있으나 공유·맞춤 인사이트의 strat에는 없음. 나머지는 정적 확인 | “내 전략 존재/실행 중”이라는 공통 제품 상태가 화면마다 다름. source를 보존하는 공통 조회 모델 필요 |
| F19 **P1** | QA 전부 초기화가 전체 상태를 초기화하지 않음 | tfDevReset L15919–15929; bill L12605; cp L11374; term L10003 | 카드·watch·cp·clone·shared 생성 후 reset: bill/cp/termClones/termDemo/follows/shared 및 G.sessions는 삭제 목록에 없음. 정적 확인 | ① 게스트→② 신규 로그인 테스트가 이전 과금/전략에 오염. preset은 기존 토글 조합이 아니라 독립 fixture 교체여야 함 |
| F20 **P1** | 관망 PLAN이 구독 문구·복구 CTA를 일관되게 바꾸지 않음 | paid st L13157–13158; watch override L13173–13174; CTA L13190–13191 | payDone=true+watch→hero “관망”, 아래 gl/gr는 “구독 중/무제한”, pri/sec=null 유지. 정적 확인 | 제한 상태에서 복구 동작이 없고 상충하는 설명. billingMessage·CTA 전체를 동일 파생 상태로 반환해야 함 |
| F21 **P1** | 연구 paper는 미연결 시작 가능하지만 재개는 연결 필수 | gGoLive/gToTerminal L8131–8161; user 재개 L10112→L13461 | API 없는 연구 결과 paper 시작→터미널 중지→재개: conn=false로 실패. 정적 확인 | 같은 실행 환경의 첫 시작·재개 조건이 다름. paper/live별 command gate 분리 필요 |
| F22 **P2** | 봇 상세 거래소가 봇 스냅샷 대신 현재 API | tfBotView L13376 vs terminal L10019 | Binance 봇 생성 후 현재 api를 OKX로 변경→터미널은 x.ex, 봇 상세는 t.api.ex 표시. 정적 확인 | 같은 엔티티의 두 관리 화면이 다른 연결을 표시. bot/account 관계를 사용 |
| F23 **P2** | QA 검증 통과 fixture에 전문가 지표 누락 | QA cur L15857; tfProText L9577–9578; 정상 cur L9475 | QA strat ON→report→전문가 보기: cur에 sharpe/pf/cagr가 없어 toFixed 호출 근거 부족. 정적 확인; 브라우저 예외는 미확인 | QA 프리셋이 정상 생성물 스키마를 재현하지 않음. 실 엔진 결과로 fixture 생성 필요 |
| F24 **P2** | QA “현재 화면 즉시 재렌더”가 일부 mode만 처리 | 패널 설명 L15913; refresh L15888–15897 | tfintro/nfbot/tfreport/tfcps 등에서 상태 토글: 해당 mode 재렌더 분기가 없음. 정적 확인 | 토글 값과 화면이 어긋나 시나리오 판정 오판 가능. 공통 현재 route/view 재평가 필요 |
| F25 **P2** | 해시 없는 주요 화면의 위치 복원 불가 | 허브 hash 제거 L11146; gContent L6792; restore L16820–16825 | 거래소 상세/공유 follow 허브에서 새로고침: 이 화면의 route가 저장되지 않고 lastSid 또는 홈 흐름에 의존. 정적 확인 | 화면 상태를 URL·새로고침·뒤로가기로 같은 방식으로 재현할 수 없음. route와 view state 계약 필요 |
| F26 **P2** | 후기/공유의 관심 게스트 동작은 저장 성공과 다름 | watch toggle L12168–12174; STORE.save L8358 | guest가 관심 추가→성공 토스트→새로고침: guest save는 반환. 정적 확인 | 로그인 전 임시 상태인지 저장 상태인지 구분이 없음. guest draft 표시 또는 인증 후 이관 정책 필요 |
| F27 **P2** | 한 제품에 3개 플랜 가격·월주기 모델 | `teth-copy.js` L22/L67/L77; `site-config.js` L19–47; checkout L9737; bcQuote L12763 | 소개 Direct/퍼널은 월599,000원, 새 카드 엔진은 $49·3000 credit·30일 주기. 정적 확인 | 가격 사실 검증 문제가 아니라 **plan 식별자/혜택/청구 주기의 매핑이 없음**. 어떤 플랜을 뜻하는지 상태 엔진에 명시해야 함 |

### 관찰과 추측의 경계

- 위 재현의 변수 주입은 데모 fixture 구성 방법이다. 사용자 실제 브라우저에 적용하지 않았다.
- `tfNFRoute` 외에 직접 view 호출이 가능하다는 사실을 보안 취약점으로 평가하지 않았다. 여기서는 화면과 상태 전이 일관성만 다뤘다.
- “watch인데 손절·목표가 관리는 유지” 문구는 PLAN에 있지만(L13174), 실제 거래 스케줄러의 동작은 이 분석으로 확인하지 않았다. 정적 시뮬레이션 화면의 실행 플래그만 확인했다.
- 모의 데이터인 점 자체는 결함으로 세지 않았다. 동일한 데모 상태를 서로 다른 기준으로 해석하는 지점을 문제로 기록했다.

## 2. 단일 파생 상태 엔진 도입 가능성

**도입 가능하다.** 기존 바닐라 JavaScript에 부작용 없는 파생 함수와 입력 어댑터를 추가하는 구조로 수용할 수 있다. 다만 현 변수만 묶어서는 11개 상업 상태를 정확히 도출할 수 없다. 사용량·거래량 관측 모델과 plan/connection 정본을 먼저 정의해야 한다. 아래는 **제안이며 미구현**이다.

### 2.1 입력 매핑

| 제안 입력 | 현재 매핑 후보 | 한계 / 필요한 변경 |
| --- | --- | --- |
| `loggedIn` | `!!S.user` | 명확. 복원 중은 guest와 별도로 ready=false를 전달해야 함 L16819 |
| `uidLinked` | `!!t.uidLinked` | 현재 boolean 유지 가능하나 partnerAccount에 exchange·uid·verifiedAt 저장 필요. Fast API는 uid 없이 true L13329 |
| `executionConnected` | `t.api`의 성공 결과 + 대상 exchange | `t.conn`과 ob 완료는 믿을 수 있는 동등값이 아님. 연결 map의 verified 상태를 정본으로 하고 conn은 이행 중 미러만 허용 |
| `planActive` | 구형 `payDone`, 새 `bill.cardOn`을 어댑터에서 별도 읽기 | 즉시 OR로 합치면 미청구 카드 등록을 결제완료로 오인. `legacyPaid`, `cardRegistered`, `cyclePaid`, `paymentFailed`를 먼저 분리하고 충돌 상태를 반환 |
| `usageBand` | `freeUsed`, bill의 ai debit, sx.ai.hist는 보조 | 기존 히스토리는 완전한 호출 원장이 아니며 paid/trade 누락. 새 `usageEvents{requestId,at,kind,status,units}` 또는 기간집계 필요. 정책 임계 확정 전 unknown |
| `tradeBand` | fillLog/rebates + bill.volume는 이행 참고값 | fillLog에는 명목금액·env·계정의 완전한 스냅샷이 없음 L13671; volume는 이미 rate/cap 적용. `executionEvents{fillId,at,exchange,account,env,notional,unit}` 필요 |
| `billingCoverage` | bcBalance, mode, graceAt, cardOn, cycleAt, cardFails, quote | balance/모드 둘 다 필요. `{status:covered/grace/watch/unknown,reason,expiresAt}` 같은 구조 제안. 과거 creditBal 합산 이전은 단위·중복 정책 확정 뒤 수행 |

입력 7개는 상업 상태 분류에는 적합하지만 모든 화면 CTA를 결정하기에는 부족하다. 기존 `tfNFUpgrade`·`tfIntroNeed`·`tfBkConnSt`는 추가로 현재 작업/전략수/사업자/복귀 목적을 읽는다(L13319/L14610/L15440). 다음 컨텍스트를 별도로 넘기는 것을 제안한다.

- `context={route,action,targetExchange,strategySource,executionEnv,hasVerifiedDraft,strategyCount,resumeIntent,now,stateReady}`.
- boolean executionConnected만으로 거래소 여러 개를 표현하지 말고, **대상 거래소에 대한 파생 boolean**으로 사용할 것.
- 11개 시나리오는 제품 전체 상태공간을 완전히 덮지 않는다. 예: 플랜+연동+거래0, UID 없이 API만 연결, watch, 복원 중, 결제 실패, 사용량 미확인. 억지로 ①–⑪ 중 하나로 분류하지 말고 `unclassified/reconciling`과 이유를 지원할 것.

### 2.2 출력 계약

| 출력 | 제안 계약 | 기존 소비 지점 |
| --- | --- | --- |
| `commercialStateId` | 01–11 또는 unclassified; 사용한 입력·규칙 버전·unknown 사유 포함 | QA, PLAN, 유도 시트, 거래소 연결, 인트로 진입 관측 |
| `primaryCTA`, `secondaryCTA` | 문자열 onclick 대신 `{action,labelKey,target,resumeIntent,enabled,reason}` | tfPlanView L13157–13191; tfUpSheet L13255; tfBkConnect L15448; tfIntroView L14891 |
| `entitlement` | `{chat,templateBacktest,customBacktest,createCopy,createStrategy,startPaper,startLive,resumeLive,publish}` 각각 allow/reason | tfAiGate, cpStart, tfSS3CopyGo, gStartRun, tfStartStrategy, tfBotCtl, tfTmSetStatus |
| `billingMessage` | canonical messageKey+params+status; 표시 수치 정책과 별도 | PLAN hero/게이지/상세/CTA 및 bcRoute 알림 전체. 현재처럼 hero만 override하지 않기 |
| `activationMessage` | 미로그인/UID미연동/API미연결/검증필요/실행대기/진행중을 대상에 맞게 표현 | 거래소 카탈로그, terminal empty state, done, ready banner |

파생 함수는 `tfNFInit()`·`bcInit()`처럼 상태를 초기화하거나 알림을 발생시키지 않도록 한다. 초기화/마이그레이션은 읽기 전에 명시적 단계에서 끝내고, 이벤트 처리→상태 저장→derive→렌더 순서를 고정한다. 과금 모드 전환이 렌더 경로에서 우발적으로 수행되지 않도록 `bcTick` 호출 위치도 command/clock 경계로 옮기는 것이 적합하다(현 경계 L12899–12900/L17615).

### 2.3 유지·통합·폐기 대상

| 현재 변수/구조 | 제안 | 이유 |
| --- | --- | --- |
| S.user | 유지, 사용자 키 명시 | 현재 기본 인증 정본 |
| uidLinked/uid/ob.uid | 검증된 partnerAccount와 입력 draft 분리 | Fast API/수동 입력/QA 스키마 차이 제거 |
| api/conn | 연결 엔티티로 통합, conn 파생 후 폐기 | conn만으로 재개 허용/타 거래소 허용하는 현 구조 제거 |
| ob.st | **작업 단계로 유지** | 계정 자격 대신 onboarding UI progression만 표현 |
| payDone/plan/pay | plan subscription 정본, checkout draft, execution-path 선택으로 분리 | plan은 유료여부와 파트너 선택을 혼합. payDone은 이행 완료 뒤 폐기 |
| bill.cardOn | 카드 등록 사실로 유지 | planActive와 동의어로 쓰지 않기 |
| creditBal/creditGrants/creditSeen/creditReqs | 새원장으로 명시 마이그레이션 후 구형 읽기·쓰기 제거 | 이중 지급/차감 경로를 한 번에 없애지 말고 adapter 검증부터 |
| freeUsed | usage 계측과 무료 entitlement 한도로 분리 | 누적 무료 횟수만으로 전체 사용량 추정 불가 |
| tradeActiveUntil | 기존 프로모 기간 표시용 임시 유지 또는 정책 폐기 | 거래量 band와 동의어 아님; 정책상 필요한지 별도 결정 |
| bill.ledger/seen | 유지·정합성 보강 | 정본 합계를 바꾸는 FIFO 절단 제거; 표시 목록만 캡 |
| t.stage/cur/pendingP/intake | workspaceId별 draft로 이동 | singleton 교체·stale pendingP 문제 해결 |
| t.strat/termClones/cp.copies | 출처별 모델은 유지 가능, **공통 portfolio 조회 및 command 인터페이스** 제공 | clone·copy를 억지로 동일 p 모델로 변환할 필요는 없음. 전략수·실행수·개인화는 일관되게 계산 |
| sx.live/livePaused | canonical strategy 참조·파생으로 전환 | 연구/터미널 종료 불일치 제거 |
| sharedSnap/follows | 공개 스냅샷·복제 관계로 유지 | 실행 객체와 동일한 엔티티로 합치지 않기; sourceVersion/id 명시 |
| TF_NF_RESUME/TF_UP_CTX/인증 복귀 플래그 | 단일 intent 구조 | 로그인·결제·연결 후 의도한 action/target으로 재개 |

### 2.4 도입 순서 제안

1. **현 상태 fixture 고정**: 아래 11개 프리셋+충돌 케이스(F01–F04/F08/F19)를 격리 데이터로 정의. 상태 hash/expected 결과를 함께 기록한다. 현재 사용자 저장소에는 주입하지 않는다.
2. **상태 버전·복원 정규화**: S.tf에 명시 스키마 버전, 이전 데이터 변환, 계정/작업/UI 분리. ledger 캡과 부분 reset을 우선 해결한다.
3. **연결·플랜 정본 확정**: api/conn과 payDone/cardOn의 충돌을 감지하는 읽기 어댑터부터 도입. UI가 알려진 사실을 먼저 같은 이름으로 표시하도록 한다.
4. **usage/trade 계측 추가**: 모든 AI 요청의 성공/실패/취소와 종류를 요청 id로 수집. fill은 source/env/exchange/notional을 보존. 무료·유료와 무관하게 사용량을 기록하되 과금은 별도 정책으로 적용한다.
5. **shadow derive**: 기존 tfEnt/bcBranch/tfIntroNeed/tfBkConnSt 결과와 새 derive 결과를 QA에서 비교. policy 미정은 unknown으로 유지하며 임계값을 임의의 현행 사실로 문서화하지 않는다.
6. **표시부 통합**: PLAN·업그레이드 시트·거래소 CTA·terminal 빈 상태·인트로를 같은 출력으로 렌더. 문구·CTA·복구 링크를 묶어 갱신한다.
7. **상태 변경 경계 통합**: create/start/resume/pause/stop/checkout/connect가 공통 command guard를 호출하도록 연결. 연구 Live와 터미널 제어를 먼저 합친다. 스코어 검증은 계정 자격과 별도로 유지한다.
8. **전략 조회·복귀 통합**: portfolio adapter로 user/clone/copy 조회를 합치고 source를 표시. 공통 resume intent와 라우트 복원 계약 도입.
9. **구형 경로 제거**: 모든 소비 지점이 이전된 후 creditBal/payDone/conn 직접 read와 구형 시트를 제거. 보존할 classic/demo 경로도 같은 어댑터를 쓰거나 명시적으로 별도 체험 상태로 분리한다.

## 3. QA “11개 시나리오 프리셋 1클릭” 초안

**이 절은 미구현 설계다.** 현재 QA 토글을 실제 변경하거나 실행하지 않았다. 기존 코드에는 usageBand/tradeBand/commercialStateId가 없다. 새 필드를 제안하는 부분과 기존 변수를 조작하는 fixture를 구분한다.

### 3.1 독립 fixture의 공통 초기화

- 기존 `tfDevReset()`을 호출하고 토글을 누적하는 방식은 사용하지 않는다. bill/cp/clones/shared가 남기 때문이다(F19).
- 새 객체로 `S.tf`를 구성하고 G.sessions/G.cur·모든 후보/복귀 intent·타이머·TF_INTRO_PEEK를 초기화한다. 이 동작은 **향후 QA 전용 sandbox 상태**에서만 수행하도록 설계한다.
- 고정 `now`와 기준 계정 `{name:'QA 사용자',email:'phase1-qa@teth.ai'}`를 사용한다. ①만 user=null. welcome/card/debit의 at은 동일한 현재 사이클 안에 둔다.
- 공통 초기값: `intake={}`, `qi=0`, `tries=[]`, `cur=null`, `score=0`, `pendingP=null`, `workDone=false`, `stage='intake'`, `plan=null`, `cycle='month'`, `pay=null`, `payDone=false`, `api=null`, `conn=false`, `uid=null`, `uidLinked=false`, `ob={st:'idle',ex:null,uid:'',err:null}`.
- 구형 자격 초기값: `freeUsed=0`, `creditBal=0`, `creditGrants={}`, `creditSeen={}`, `creditReqs=[]`, `tradeActiveUntil=0`, `upFor=null`.
- 독립 목록 초기값: strat/fills/fillLog/follows/watch/notifs/rebates/reviews/periodics/termClones/termDel=`[]`; termDemo/termLog/notifKeys/reviewKeys=`{}`; shared=false, sharedSnap=null, sharedName=null, followers=0,reward=0; cp={v:1,spot:1000,copies:[]}; ss={tab:'find',sort:'ret',asset:'all'}; bkRev={} 및 필터 기본값.
- 새 과금 초기값: bill={v:1,ledger:[],seen:{},coupons:[],events:[],mode:'active',graceAt:null,cardOn:false,cycleAt:null,cardFails:0,simPayFail:false}.
- ledger는 원래 bcAppend 형식 `{id,at,type,reason,amt,ref}`과 이에 대응하는 seen을 구성한다(L12854–12858). 신규 fixture 객체 생성이므로 기존 사용자 원장을 소급 수정하는 방식이 아니다.
- 인증·전략수 효과를 상업 상태 효과와 섞지 않도록 **기본 프리셋은 strat/termClones/cp.copies 모두 비운다**. ②–⑪에서 `#/trade`가 인트로로 가는 것이 현 코드의 정확한 기대다. 터미널 비교가 필요하면 “공통 검증 전략 첨부” 보조 옵션을 별도로 사용한다.

### 3.2 약어·기준값

| 약어 | fixture에 set할 값 |
| --- | --- |
| `U` (UID 연결) | uidLinked=true; uid='38291042'; creditBal=1000; creditGrants.uid=now. 지급 이력 표시용이며 신규 bill 잔액으로 자동 합산하지 않음 |
| `E` (실행 연결) | api={ex:'binance',last4:'QA01'}; conn=true; ob={st:'completed',ex:'binance',uid:'38291042',err:null} |
| `P` (호환 플랜 활성) | payDone=true; plan='paid'; pay={step:'done',cycle:'month'}; bill.cardOn=true; bill.cycleAt=now+30일; cardFails=0. **현재 상호 독립인 두 경로를 테스트 목적상 둘 다 맞춘 값** |
| `W` | welcome grant +100, seen.welcome 존재. 현재 TFC.billing.WELCOME_CREDIT=100 (`teth-copy.js` L65) |
| `C` | card charge +3000, seen['card:fixture-cycle'] 존재. 현재 설정 L67 |
| `R` | CARD_UID promo grant +100, seen['promo-carduid'] 존재. 현재 설정 L80 |
| `V0 / VL / VH` | reason=volume 합 0 / 100 / 2000. **거래 高低 정책이 아니라 검증용 임의 구간**. VH는 현 UID_CREDIT_CAP 안에 둠 |
| `A0 / AL / AH` | reason=ai, type=debit 합 0 / -100 / -1600. AH는 기존 uid.heavy의1500 기준을 넘기도록 선택했을 뿐, 새 제품 usageBand 임계 확정 아님 |
| `D0 / D+` | tradeActiveUntil=0 / now+30일. D+는 fixture에 live 체결 이력도 넣을 때만 사용 |
| 새 엔진용 사실 | 제안 `commercialFacts={usage:{periodStart,periodEnd,aiUnits},trade:{periodStart,periodEnd,liveNotional,unit:'USDT'}}`. **현 코드에 없음**. QA 정책 초안: usage 저=10회/고=160회, trade 저=250,000/고=5,000,000 USDT; 값은 시나리오 분리용이며 운영 임계가 아님 |

현 코드의 bcVolumeCharge는 notional에 rate를 곱하므로 위 VL/VH를 Binance spot rate0.0004로 맞추려면 각각 250,000/5,000,000의 입력이 된다(`teth-copy.js` L72). 실제 tfRebateCommit 호출 인자는 KRW 예산인데 단위 변환이 없어(L13038) 기존 UI 체결과 USDT fixture를 동일한 운영 사실로 간주하면 안 된다. 이 단위 정규화도 새 tradeFacts 설계에 포함해야 한다.

### 3.3 프리셋 조합

| #·프리셋 | loggedIn / U / E / P | 추가 기존 상태 | 새 ledger 구성·최종 잔액 | 새 엔진용 usage/trade 사실 | 현재 코드 기대·한계 |
| --- | --- | --- | --- | --- | --- |
| ① 비로그인 | 0/0/0/0 | user=null; 모든 목록·grant 비움 | 빈 원장, 0; mode=active 기본 | unknown/unknown | tfEnt guest; bcTier는 FREE지만 인증 상태 의미 없음; trade는 guest 인트로 |
| ② 로그인만·무료 | 1/0/0/0 | freeUsed=0; creditBal=0 | W=100, active | 0회/거래0 | tfEnt free, bcTier FREE, gate 통과 |
| ③ 연동·거래0 | 1/1/1/0 | plan=partner; D0; fillLog/rebates 비움 | W+V0+A0=100, active | 0회/거래0 | tfEnt credit, bcTier UID, bcBranch uid.novol |
| ④ 연동·저거래 | 1/1/1/0 | plan=partner; D+; live 체결 fixture | W+VL+A0=200, active | 0회/저거래 | tfEnt trade; bcBranch uid.small. 거래 高低는 현 코드가 판정한 것이 아님 |
| ⑤ 연동·고거래 | 1/1/1/0 | plan=partner; D+; live 체결 fixture | W+VH+A0=2100, active | 0회/고거래 | tfEnt trade; **여전히 uid.small**, ④와 분기 같음 |
| ⑥ 플랜·고사용·미연동 | 1/0/0/1 | api/uid/conn 없음; D0; freeUsed=0 | W+C+AH=1500, active | 고사용/거래0 | tfEnt paid, bcTier CARD, bcBranch card.out. paid 실제 호출로 AH가 생기지는 않으므로 **주입된 이력** |
| ⑦ 플랜·저사용·미연동 | 1/0/0/1 | ⑥과 동일 | W+C+AL=3000, active | 저사용/거래0 | 현재 분기는 ⑥과 동일; 신규 usageFacts로만 구분 |
| ⑧ 플랜·연동·고사용·고거래 | 1/1/1/1 | D+; live 체결 fixture | W+C+R+VH+AH=3600, active | 고사용/고거래 | tfEnt paid; bcTier CARD_UID; bcBranch carduid.out |
| ⑨ 플랜·연동·고사용·저거래 | 1/1/1/1 | D+; live 체결 fixture | W+C+R+VL+AH=1700, active | 고사용/저거래 | 같은 carduid.out; 현 화면은 ⑧과 구분 안 함 |
| ⑩ 플랜·연동·저사용·고거래 | 1/1/1/1 | D+; live 체결 fixture | W+C+R+VH+AL=5100, active | 저사용/고거래 | 같은 carduid.out; 현 호출계측으로 저사용 증명 불가 |
| ⑪ 플랜·연동·저사용·저거래 | 1/1/1/1 | D+; live 체결 fixture | W+C+R+VL+AL=3200, active | 저사용/저거래 | 같은 carduid.out |

모든 로그인 fixture는 현재 warning threshold(총유입20%)보다 잔액이 높게 구성했다. 따라서 11개 상업 분류 검증에 grace/watch 축이 우연히 섞이지 않는다. 카드 결제의 초기 프로모 시점은 ⑧–⑪ 모두 같도록 고정한다.

### 3.4 공통 화면 fixture와 추가 경계값

- **검증 전략 첨부(보조 옵션)**: p={sl:-5,tp:12,rsiTh:44,trendFilter:true,startI:61,endI:PRICE.length-1}를 runBacktest에 넣고 tfScore가80 이상인지 확인한다. 실제 결과 전체에서 cur의 sharpe/pf/cagr/tradeVol까지 채운다(L9475). 미달이면 “검증 통과”로 강제 표시하지 않고 fixture 생성 실패로 처리한다.
- t.intake를 같은 비트코인·500만원·전체기간으로 채우고 workDone=true, stage=verified, pendingP=null, upFor=결과지문을 설정한다. t.strat에는 동일 결과의 **status=ready** 봇과 asset/ex/tv/cap 스냅샷을 넣는다. 표시 비교용이며 생성 자체로 fills·rebates를 실행하지 않는다. ②/⑥/⑦에서는 계정 미연결을 유지한다.
- 상업 프리셋 11개와 별도로 **연결/검증/과금 경계 fixture**가 필요하다: api만 true, conn만 true, uidLinked만 true, payDone만 true, cardOn만 true, creditBal>0+bill0, watch+구독, grace 경계24h, dunning3회, freeUsed9/10, score79/80, cp만 존재, clone만 존재, 복원 중.
- 프리셋 적용 후 반드시 `deriveCommercialState()` 결과와 원시 입력을 함께 표시하고 PLAN/인트로/거래소/터미널/복제/채팅의 CTA 및 gate를 비교한다. 새 엔진이 도입되기 전에는 **“현행 결과”와 “제안 시나리오 이름”**을 서로 다른 칸에 표시해야 한다.
- 현재 QA refresh는 6개 mode만 처리한다(L15890–15896). 새 패널은 활성 route 또는 명시 view descriptor를 재평가해 전체 화면을 일관되게 갱신하도록 설계한다.

## 4. 검증 범위와 미확인 사항

| 항목 | 결과 |
| --- | --- |
| 작업 전 상태 | git status: 기존 AGENTS.md, cx-audit/, font-tokens.css, typography-specimen.html, ux/가 untracked. 사용자 파일 보존 |
| 우체통 | 시작 시 codex inbox 비어 있음. 제품 편집 claim 없음 |
| 코드·설정 읽기 | index.html, teth-copy.js, site-config.js, help-widget.js의 상태/라우트/게이트 및 주요 CTA 추적 |
| 격리 실행 | 카드3100+free-out, UID1000+watch, paid200회 debit0, free1회 ledger100, api와conn 불일치, cp-only 인트로, ledger2000 절단 확인 |
| 파일 보존 확인 | index.html·teth-copy.js·help-widget.js·site-config.js의 작업 전후 SHA-256 동일. `git diff --stat` 출력 없음 |
| 산출물 검증 | `git diff --check` 통과. 신규 문서는 별도 검사로 표 열 수·코드펜스·행 끝 공백 오류 0건 확인. 지정 3개 파일이 신규 untracked로 표시됨 |
| 브라우저 상호작용 | **미확인**. 실제 렌더·모달 겹침·뒤로가기·새로고침 네트워크 시퀀스를 자동화하지 않음 |
| 외부 서비스 | **미확인**. proxy/state 서버, 실제 AI 응답, 거래소·결제 외부 연결을 호출하지 않음 |
| 제품 수정 | 없음. 3개 신규 Markdown 외 제품·설정·지침 파일 수정하지 않음 |
| 제안의 상태 | 파생 엔진, commercialFacts, 프리셋 모두 문서 초안. 구현·배포·QA 패널 변경 없음 |

### 핵심 발견 5개

1. 자격은 `tfEnt`, 과금은 `bc*`로 나뉘어 충전·구독·UID 완료와 AI 이용 가능 여부가 어긋난다.
2. AI 사용량 高低와 거래량 高低를 현재 변수만으로 일관되게 분류할 수 없다.
3. 연결 상태가 api/conn/ob/uidLinked에 분산돼 화면별 “연결됨”과 실행 조건이 다르다.
4. 연구·위임·터미널 clone·카피 계좌의 객체와 실행 상태가 완전히 통합되지 않았다.
5. QA reset은 새 원장·카피·clone 등을 남기므로 11개 프리셋은 독립 fixture와 공통 파생 엔진이 필요하다.
