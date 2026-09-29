# ROUND 6 (Codex, Astra): 독립 비평 뒤 교차 검증까지

**순서**: 1부를 다 쓴 뒤에야 `r6-claude.md` 를 연다.

## 이번 구현
Round 5 의 P1 4건(V1, N1, N2, R1)과 P2(V6, V9, R2, A, E)를 반영했다고 Claude 가 주장한다.

## 스크린샷 (artifacts/teth-redesign)
`r6-main-top.png`, `r6-main.png`, `r6-main-full.png`, `r6-main-1280.png`, `r6-main-390.png`, `r6-main-390-top.png`, `r6-detail-1.png`, `r6-detail-1-full.png`, `r6-detail-1-events.png`, `r6-detail-2.png`, `r6-detail-2-full.png`, `r6-detail-3.png`, `r6-detail-3-full.png`, `r6-detail-390.png`, `r6-rotate-chart-390.png`(844x390 에서 열고 390x844 로 돌린 뒤), `r6-follow-missing-only.png`, `r6-follow-sheet.png`, `r6-glyphs.png`. 비교용 `baseline-*.png`.
직접 렌더해 확인하라(서버 8843, Chrome 9333).

## 1부: 독립 비평
1. Round 5 결함 재검증: V1(양방향 회전, 중간 폭), N1(같은 길이 기준일 변경에서 저장된 시작 봉의 날짜 보존, 한 봉 추가), N2(누락 계정만, 혼합), R1(세 갈래 9월 14일과 다른 매수 사건 3건 이상을 당시 가격으로 재생해 문장과 대조), V6, V9, R2, A, E. 각각 PASS / FAIL 과 재현.
2. 최종 수용 기준 A~N 재판정.
3. 새 결함 탐색: 이번 수정이 만든 회귀(따라가기 시작, 저장과 새로고침, 다른 화면, 키보드, 1280, 390).
4. 구체 비판(있는 만큼. 형식과 등급 동일).
5. **P0, P1 개수를 명시. 0 이면 0 이라고 쓴다.**

## 2부: 교차 검증
`r6-claude.md` 의 판정과 남은 P2 4건에 ACCEPT / REJECT / MODIFY / TEST.

## 3부: 남은 수정(있다면 우선순위 순)

## 제약
index.html 과 다른 파일 수정 금지(산출 파일 하나만). em dash, 가운뎃점 금지. 새 고지나 라벨 금지. 사용자 확정 제약(KPI 넷, 버튼 문구, 4열 x 5행, 10페이지 반복, 30일은 수익률만, 리그 배너 유지) 재론 금지. 산출 `artifacts/teth-redesign/r6-codex.md`, 160줄 이내.
