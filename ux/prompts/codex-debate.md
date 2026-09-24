# CODEX 토론 라운드 — 역할: PRINCIPAL PRODUCT ENGINEER + STATE-MACHINE ARCHITECT

작업 디렉터리: C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1
읽을 것: ux/proposals/CLAUDE_PROPOSAL.md, ux/proposals/AGY_PROPOSAL.md, ux/proposals/CODEX_PROPOSAL.md(당신 것), ux/proposals/CLAUDE_REBUTTAL_TO_AGY.md, ux/current/CODEX_PHASE1_FINDINGS.md.
코드 수정 금지. 산출물은 ux/proposals/CODEX_REBUTTAL.md 하나. 한국어. 컴플라이언스·보안 관점 배제.

당신의 임무는 제품 책임자(Claude)와 UX 디렉터(AGY)의 제안 중 **구현·상태 논리가 틀리거나 위험한 것**을 근거(행 번호, 재현 시나리오)로 지적하는 것입니다. 합의 목표 없음. 다만 "구현이 어렵다"는 이유만으로 제품 결정을 막지 마세요. 어려우면 어떻게 가능한지 대안을 내세요.

## 산출물 구성
1. Claude 제안의 상태 논리·라우팅·데이터 모델 오류 8개 이상: [결정] [무엇이 깨지나(11케이스 중 어느 것, 어느 화면, 재현)] [수정안].
2. AGY 제안의 구현 불가·모순·회귀 위험 8개 이상: 같은 형식.
3. 두 제안이 서로 충돌하는 지점 목록과 각각에 대한 당신의 판정(어느 쪽이 맞는지, 또는 제3안).
4. 단일 파생 상태 엔진 최종안: Claude/AGY 제안을 반영해 입력·출력·11행 표를 갱신. 특히 usageBand/tradeBand 임계값을 데모에서 어떻게 정할지(고정 상수 + QA 프리셋)와 "unclassified" 처리.
5. 전략 유형(agent/rule/hybrid/follow) 태깅을 기존 데이터(퍼널 cur, t.strat, 데모 d1~d6, tfRankSeeds, cp)에 어떻게 소급 적용할지 매핑 표.
6. 판단 로그 두 형식(에이전트/규칙)을 기존 로그 엔진(event.k=watch/scan/entry/risk/exit)에서 어떻게 생성할지. 에이전트형은 데모 데이터로 어떻게 그럴듯하게(가짜 사고 사슬 없이 입력·결정·행동·다음 확인) 만들지.
7. 구현 순서(P0→P1) 제안: 각 단계의 수정 범위(함수명·행 범위), 회귀 위험, 검증 방법. 단일 파일 17.7k줄에서 충돌 없이 진행하는 순서.
8. 당신이 끝까지 양보 못 하는 것 3개.
파일을 쓴 뒤 마지막에 경로와 핵심 판정 5줄을 출력하세요.
