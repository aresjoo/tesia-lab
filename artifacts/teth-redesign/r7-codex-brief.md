# ROUND 7 (Codex, Astra): 독립 비평 뒤 교차 검증까지

**순서**: 1부를 다 쓴 뒤에야 `r7-claude.md` 를 연다.

## 이번 구현
Round 6 의 P1 N1(세대 기록 없는 저장)과 P2 R2(완료 문장), Q1(시트 포커스), Q2(390 조작 줄)를 반영했다고 Claude 가 주장한다.

## 스크린샷 (artifacts/teth-redesign)
`r7-main-top.png`, `r7-main.png`, `r7-main-full.png`, `r7-main-1280.png`, `r7-main-390.png`, `r7-main-390-top.png`, `r7-controls-390.png`, `r7-detail-1.png`, `r7-detail-1-full.png`, `r7-detail-1-events.png`, `r7-detail-2.png`, `r7-detail-2-full.png`, `r7-detail-3.png`, `r7-detail-3-full.png`, `r7-detail-390.png`, `r7-rotate-chart-390.png`, `r7-follow-missing-only.png`, `r7-follow-sheet.png`. 비교용 `baseline-*.png`, `r6-*.png`.
직접 렌더해 확인하라(서버 8843, Chrome 9333).

## 1부: 독립 비평
1. Round 6 결함 재검증: N1(세대 기록 없는 저장을 바뀐 기준일에서 처음 로드. 같은 길이, 한 봉 추가, flatI, 반복 이행, 새로고침, 세대 기록 있는 저장의 회귀), R2(skip 과 copy 에서 시트 요약, 저장값, 완료 문장), Q1(Tab, Shift+Tab, 고급을 연 상태, 연결 전 상태, Escape, 포커스 복귀, 닫은 뒤 뒤 화면 조작), Q2(390, 360, 430 폭에서 조작부 위치와 검색 동작). 각각 PASS / FAIL 과 재현.
2. 최종 수용 기준 A~N 재판정.
3. 새 결함 탐색: 이번 수정이 만든 회귀(따라가기 시작과 중복 시작, 시트를 연 채 다른 대화 상자, 목록 검색과 정렬과 판단 방식 전환, 768 전후 폭, 1280, 1440).
4. 구체 비판(있는 만큼. 형식과 등급 동일).
5. **P0, P1 개수를 명시. 0 이면 0 이라고 쓴다.**

## 2부: 교차 검증
`r7-claude.md` 의 판정과 새로 본 것 3건에 ACCEPT / REJECT / MODIFY / TEST.

## 3부: 남은 수정(있다면 우선순위 순)

## 제약
index.html 과 다른 파일 수정 금지(산출 파일 하나만). em dash, 가운뎃점 금지. 새 고지나 라벨 금지. 사용자 확정 제약(KPI 넷, 버튼 문구, 4열 x 5행, 10페이지 반복, 30일은 수익률만, 리그 배너 유지) 재론 금지. 산출 `artifacts/teth-redesign/r7-codex.md`, 160줄 이내.
