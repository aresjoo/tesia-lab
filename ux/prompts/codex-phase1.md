# CODEX PHASE 1 — 현행 구현 상태·라우트 맵 (읽기 전용 분석, 코드 수정 금지)

역할: 당신은 TETH AI(암호화폐 AI 트레이딩 데모 웹앱)의 PRINCIPAL PRODUCT ENGINEER + STATE-MACHINE ARCHITECT 입니다.
이 단계는 분석만 합니다. index.html 등 제품 코드를 절대 수정하지 마세요. 산출물은 아래 지정 경로의 새 md 파일 3개만 씁니다.

대상 저장소(현재 작업 디렉터리): C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1
핵심 파일: index.html (단일 파일 SPA, 약 17,700줄, 1.5MB). 보조: teth-copy.js, help-widget.js, site-config.js.
이 앱은 목업/데모입니다. 컴플라이언스, 법률, 투자 위험 고지 관점은 완전히 무시하세요. 보안 감사도 이 단계의 범위가 아닙니다. 오직 제품 상태 구조와 화면 흐름만 봅니다.

## 알려진 진입점 (검증하고 보완할 것)
- 해시 라우터: `tfRoute()` (약 15735행), `tfNFRoute(h)` (약 15040행). 라우트: #/trade, #/trade/bot/<id>, #/plan(/rebates|/alerts), #/review/<id>, #/periodic/<id>, #/insight..., #/share/s|t|copy|c/<x>, #/strategy/(work|report|connect|done)
- 함수 호출형 화면(해시 없음): gHome(), tfShareHub(tab), tfBrokersView(), tfBrokerView(id,tab), tfIntroView(), tfDashView(), authOpen(mode), gSetMenu(), tfDevPanelTgl()
- G.mode 값: home, conv, tfintro, tfdash, tfss3, tfss3d, tfcpp, tfcps, tfcpx, tfbrokers, tfbroker, nfplan, nfins, tfwork, tfreport, tfconnect, tfdone 등
- 상태: 전역 S (S.user, S.tf=tfS()), t=tfS() 안의 uidLinked, uid, api, payDone, plan, freeUsed, creditBal, creditGrants, tradeActiveUntil, strat[], stage, score, conn, ob; 과금 원장 bcInit()/bcBalance()/bcAppend() (mode: active|grace|watch, cardOn)
- QA 패널: TF_DEV_ROWS, tfDevTgl(k), tfDevSt(k), tfDevReset() (약 15800행)
- 자격/등급 판정: 약 12880행 근처 (tier high/low, why free/free-out 등) — 함수명을 찾아 기록

## 산출물 1: ux/current/CURRENT_STATE_MATRIX.md
1. 사용자 상태를 결정하는 모든 변수의 목록 (이름, 저장 위치, 타입, 기본값, 어디서 set 되는지, 어디서 read 되는지 대표 행 번호).
2. 파생 판정 함수 목록(예: 자격 tier, 게이트 통과 여부, 인트로 vs 터미널 분기 tfIntroNeed, 과금 모드)과 그 입력/출력.
3. **모순되거나 중복되는 불리언** 표: 예) t.api vs t.conn vs t.ob.st, t.payDone vs t.plan, uidLinked vs uidGrant vs api.uid 등. 각각 "같은 뜻인가? 어긋날 수 있는 조합은? 어긋나면 어떤 화면이 깨지나?"를 코드 근거로.
4. 게이트(로그인/연동/결제/크레딧) 검사가 일어나는 모든 지점 목록: 함수명, 행, 검사 조건, 실패 시 동작(모달/토스트/리다이렉트).
5. 아래 11개 상업 상태를 현재 변수로 표현하려 할 때 각 상태가 (a) 표현 가능 (b) 부분 가능 (c) 불가능 인지 판정하고 근거를 쓰세요.
   ①비로그인 ②로그인만(무료 크레딧) ③API/UID 연동+거래 0 ④연동+저거래 ⑤연동+고거래 ⑥플랜+AI 고사용+미연동 ⑦플랜+저사용+미연동 ⑧플랜+연동+고사용+고거래 ⑨플랜+연동+고사용+저거래 ⑩플랜+연동+저사용+고거래 ⑪플랜+연동+저사용+저거래
   특히 "거래량 高低"와 "AI 사용량 高低"가 현재 어떤 변수로도 표현되는지 확인하세요(tradeActiveUntil, creditBal, freeUsed 등).

## 산출물 2: ux/current/CURRENT_FLOW_MAP.md
각 화면(G.mode 또는 라우트)마다 표 한 줄: 화면 | 진입 방법(라우트/함수/버튼) | 필요한 상태(게스트 허용? 로그인? 연동?) | 화면이 읽는 상태 변수 | 주요 CTA와 onclick이 실제로 하는 일 | 다음 화면 | 막다른 길(dead end)이나 되돌아갈 수 없는 경우 | 중복 흐름.
특히 아래를 실제 코드로 확인해 기록:
- 전략 만들기 퍼널(#/strategy/*)과 AI 트레이딩 터미널(tfDashView, TF_TM)과 카피트레이딩(cp*)과 전략 공유(ss3)가 만든 "전략" 객체가 어떻게 다른지(각각의 데이터 구조, 서로 합쳐지는지).
- 터미널의 데모 전략(demo:d1~d6)과 사용자 전략(user:*)이 어떻게 섞이는지.
- 인트로(tfIntroView)와 터미널(tfDashView) 분기 조건 tfIntroNeed의 정확한 로직.
- 거래소 연결에 관여하는 개념들: UID 연동, Fast API, API 키, 파트너 시작, 기존 계정 연결, 간편 연결 — 각각 어떤 변수를 set 하고 어떤 화면이 어떤 라벨을 쓰는지 표로.
- 결제/플랜 개념들: 구독(payDone/plan), 카드 등록(bcCardOn), 크레딧(creditBal), 무료 분석(freeUsed), 관망(watch) — 각 변수와 화면 라벨.

## 산출물 3: ux/current/CODEX_PHASE1_FINDINGS.md
- 상태 아키텍처 관점의 P0/P1/P2 문제 목록(각: 근거 행, 재현 시나리오, 왜 문제인지). 최소 15건.
- "단일 파생 상태 엔진"(입력: loggedIn, uidLinked, executionConnected, planActive, usageBand, tradeBand, billingCoverage → 파생: commercialStateId, primaryCTA, secondaryCTA, entitlement, billingMessage, activationMessage)을 이 코드베이스에 도입할 때의 실현 가능성 평가: 어떤 기존 변수를 입력으로 매핑할지, 어떤 변수를 폐기/통합할지, 어떤 화면이 이 엔진을 읽어야 하는지, 마이그레이션 순서 제안.
- QA 패널을 "11개 시나리오 프리셋 1클릭"으로 바꿀 때 각 프리셋이 set 해야 하는 변수 조합 초안.

형식: 한국어, 표와 불릿 위주, 근거 행 번호 필수. 추측 금지 — 코드에서 확인한 것만 쓰고, 확인 못 한 것은 "미확인"으로 표시. 파일 3개를 쓴 뒤 마지막에 각 파일 경로와 핵심 발견 5줄 요약을 출력하세요.
