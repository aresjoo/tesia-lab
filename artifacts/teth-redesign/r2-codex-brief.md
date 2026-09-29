# ROUND 2 (Codex, Astra): 신뢰 라운드. 독립 비평 뒤 교차 검증까지 한 번에

Claude 가 Round 1 교차 검증 결과를 제품에 구현하고 다시 렌더했다. **순서를 지켜라**: 1부를 다 쓴 뒤에야 `r2-claude.md` 를 연다.

## 구현 요약 (검증 대상)
- 세 유형이 같은 원장 계산기를 쓴다: `mkAgentRun`, `mkHybridRun`, `mkRuleRun`(종목이 고정된 같은 계산기). 원장 방어(중복 청산, 비정상 가격), 사건에 units, cost, fee, tid.
- 직접 탐색 상태의 순위는 기준일 종가로 다시 계산. 혼합과 조건 실행의 상태는 마지막 평가 객체 `cond(P,endI)`.
- 캐시 키 `mkSig`(ID, 행동 값 전체, 가격 설정, 마지막 봉, 비용). 같은 이름의 옛 함수 정의는 지웠다(정의 하나). 조회는 ID, 현재 이름, 옛 이름 별칭(`MK_ALIAS`) 모두 허용.
- 이름 확정, 설명 교정, 배너 제목, 조건 대기의 실제 원인, KPI 묶음 간격 16px, 미니 차트 선만, 상세 순서(지금, 하는 일, 움직이는 방식, 최근 판단, 성과), 조건 위치 표시(선 위의 점과 기준선, 값 병기), 누적 수익은 차트 아래, 모바일 상세 버튼 120x44, 따라가기 시트 유형 표기.
- 위치: `index.html` 의 `/*RD_CORE_BEGIN*/`, `/*MK_CAT_BEGIN*/`, `/*RD_CSS_BEGIN*/`.

## 스크린샷 (artifacts/teth-redesign)
`r2-main-top.png`, `r2-main.png`, `r2-main-full.png`, `r2-main-1280.png`, `r2-main-390.png`, `r2-detail-1.png`(직접 탐색), `r2-detail-1-full.png`, `r2-detail-2.png`(조건 실행), `r2-detail-2-full.png`, `r2-detail-3.png`(혼합), `r2-detail-3-full.png`, `r2-detail-390.png`.
재대결: `r2-id-B1.png`, `r2-id-B2.png`(20장 전체), `r2-glyphs-B1.png`, `r2-glyphs-B2.png`(이름을 가린 28px 과 56px 기호, 유형별 줄), `r2-cta-P1.png`(자세히 채움, 80x36 동일 폭), `r2-cta-P3.png`(둘 다 외곽선), `r2-ev1-detail.png`, `r2-ev4-detail.png`(최근 판단 1건 대 4건).
직접 다시 띄워도 된다(서버 8843, Chrome 9333, `MK_VAR={id:'B1'|'B2',cta:'P1'|'P3',ev:1|4}`).

## 1부: 독립 비평 (r2-claude.md 를 열기 전)
1. 재대결 세 건을 네가 정한 3문장 기준으로 판정하고 승자 확정.
2. 이번 라운드 초점 질문 각각 PASS / FAIL 과 근거: 가짜 트레이더 느낌, AI 문구의 상투성, 가짜 페르소나, 사기 분위기, 수익률 판매 분위기, 거래소의 위계, 전략 정체성, 쉬운 말의 행동 설명.
3. 구체 비판 최소 8개(`요소 → 문제 → 사용자 해석 → 제안`, P0/P1/P2).
4. 구현 검증: Round 1 에서 네가 재현한 결함(캐시 충돌 2건, 이름 조회 실패, 순위 시점 불일치, 중복 청산, 혼합 상태 지표, 따라가기 시트 유형, 모바일 버튼)을 다시 실행해 고쳐졌는지 확인. 새 결함도 찾는다(특히 옛 정의 제거로 깨진 호출, 다른 화면의 회귀, 저장된 상태).
5. P0, P1 개수를 명시.

## 2부: 교차 검증 (1부 뒤에 r2-claude.md 를 읽는다)
`r2-claude.md` 의 판정 3건과 비판 11개에 ACCEPT / REJECT / MODIFY / TEST. 네 1부와 충돌하는 지점은 어느 쪽 근거가 더 강한지 스크린샷으로 판단. 둘 다 증명 못 하면 "둘 다 렌더"로 표시.

## 3부: Round 3(AI 가독성) 전에 고칠 것 우선순위 10개 이내

## 제약
index.html 수정 금지. em dash, 가운뎃점 금지. 새 고지나 라벨 금지. 사용자 확정 제약(KPI 넷, 버튼 문구, 4열 x 5행, 10페이지 반복, 30일은 수익률만) 재론 금지. 산출 `artifacts/teth-redesign/r2-codex.md`, 220줄 이내.
