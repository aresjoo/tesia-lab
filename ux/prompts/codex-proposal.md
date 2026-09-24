# CODEX PHASE 2 — 독립 제안 (역할: PRINCIPAL PRODUCT ENGINEER + STATE-MACHINE ARCHITECT + INTERACTION ENGINEER)

작업 디렉터리: C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1
먼저 읽을 것: ux/current/CURRENT_IA.md, ux/current/CURRENT_STATE_MATRIX.md, ux/current/CURRENT_FLOW_MAP.md, ux/current/CODEX_PHASE1_FINDINGS.md (당신이 직전 단계에서 쓴 것), ux/research/*.md (벤치마크 3건).
코드 수정 금지. 산출물은 ux/proposals/CODEX_PROPOSAL.md 하나만 씁니다. 한국어.
이 앱은 목업입니다. 컴플라이언스, 법률, 리스크 고지 관점은 완전히 무시하세요. 보안 감사도 범위 밖입니다.

## 제품 맥락 (사실)
- TETH는 세 유형의 전략을 한 제품에서 운영해야 합니다: AI 판단형(TETH가 매 시점 시장 맥락을 보고 진입/추가/축소/청산/대기를 결정), 규칙형(RSI·이평 등 명시 규칙, AI가 생성 가능하나 실행은 규칙), 따라가기(남의 전략을 내 예산으로 복제 실행). 기반 모델(Claude/GPT/Gemini/Grok/DeepSeek)은 TETH가 작업마다 고르는 도구이지 전략의 정체성이 아닙니다.
- Bitget 우선. UID 연동(과금 판정)과 실행 API(주문 권한)는 다른 개념. 과금: 월 청구액 = max(0, 플랜료 + 초과 종량 - 거래 커미션 크레딧 - 무료 크레딧).
- 11개 상업 상태: ①비로그인 ②로그인만 ③연동+거래0 ④연동+저거래 ⑤연동+고거래 ⑥플랜+AI고사용+미연동 ⑦플랜+저사용+미연동 ⑧플랜+연동+고사용+고거래 ⑨플랜+연동+고사용+저거래 ⑩플랜+연동+저사용+고거래 ⑪플랜+연동+저사용+저거래.
- AI 트레이딩 메뉴는 세 제품(게스트 랜딩 / 로그인 미활성 / 활성 터미널)이어야 하며 같은 페이지에 CTA만 바꾼 것이면 안 됩니다.

## 당신이 계속 물어야 할 것
이 상태를 단일 진실 원천으로 표현할 수 있나? 모순되는 불리언을 만들고 있지 않나? 이 아키텍처가 11개 케이스를 견디나? QA가 모든 상태를 1클릭으로 재현할 수 있나? 실제 백엔드가 붙어도 동작하나?

## 산출물 구성 (ux/proposals/CODEX_PROPOSAL.md)
1. **파생 상태 엔진 설계**: 입력(loggedIn, exchangeLinked, executionConnected, planActive, usageBand, tradeBand, billingCoverage 등 당신이 정한 최소 집합), 파생(stateId 1~11, entitlement, primaryCTA, secondaryCTA, billingLine, activationMessage, interruptLevel, terminalMode). 순수 함수 시그니처, 표(11행), 기존 변수 매핑, 폐기할 변수, 마이그레이션 단계. 코드 스케치 허용(의사코드 또는 JS 30줄 이내).
2. **전략 객체 정규화**: 퍼널 전략, 터미널 전략(user:/demo:), 공유 전략(ss3), 카피(cp) 네 가지가 하나의 Strategy 모델(id, kind: agent|rule|hybrid|follow, title, subtitle, asset, params, source, status, budget, perf{live, backtest}, log[])로 합쳐질 수 있는지, 어떤 어댑터가 필요한지.
3. **판단 로그 데이터 모델**: AI 판단 이벤트(checked, decision, reason, action, nextCheck, confidence?)와 규칙 이벤트(rules[], result, trigger, order, riskRule)의 스키마와 렌더러 분기. 연속 관망 접기 규칙.
4. **터미널 인터랙션 모델**: 상단 컨텍스트 바·좌 레일·중앙 차트·우 에이전트 패널·하단 탭의 상태 의존성, 데모 전략 6개 처리(격리/삭제/프리셋), 모바일 스택 순서, 반응형 브레이크포인트, 성능 우려(1260개 판단 로그 렌더).
5. **AI 트레이딩 3상태 라우팅**: #/trade 하나에서 게스트/미활성/활성 세 뷰를 어떻게 분기·전환하는지, 뒤로가기·새로고침·딥링크 안전성.
6. **활성화(연결·결제) 체크아웃 상태 머신**: UID 연동과 API 연결을 하나의 사용자 흐름으로 묶되 내부적으로 분리 유지하는 방법, 실패·재시도·부분 완료 상태, 성공 순간의 보상 화면 트리거.
7. **따라가기 마켓플레이스 데이터·상태**: 리스트 정렬·필터 상태, 상세 탭, 따라가기 설정 3단계의 상태, 중단 시 포지션 처리 선택, 크리에이터 뷰 분리.
8. **거래소 연결 페이지 상태**: Bitget 추천 카드의 상태(미연결/연결 중/연결됨/오류), 기타 지원/준비 중 데이터 축소.
9. **QA 패널 재설계**: 11 시나리오 프리셋(각 프리셋이 set 하는 정확한 변수), 기대값 표, PASS/FAIL 저장, 진척판 10항목, 프로덕션 노출 차단 방법.
10. **회귀 안전과 검증 계획**: 기존 동작 중 유지할 것, 깨질 위험이 큰 지점, 헤드리스 크롬(CDP)으로 자동 검증할 시나리오 목록(최소 15개), 뷰포트 3종.
11. **당신이 제품 책임자(Claude)와 UX 디렉터(AGY)에게 반대할 것 같은 지점 5개**와 근거.

표와 불릿 위주, 행 번호 근거 포함. 파일을 쓴 뒤 마지막에 경로와 핵심 결정 5줄을 출력하세요.
