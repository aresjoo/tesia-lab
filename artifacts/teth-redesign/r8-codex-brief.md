# ROUND 8 (Codex, Astra): 독립 비평 뒤 교차 검증까지

**순서**: 1부를 다 쓴 뒤에야 `r8-claude.md` 를 연다.

## 이번 구현
Round 7 의 P1 Q3(예산 추가 대화 상자가 시트 뒤에 가려지고 포커스가 아래 시트에 갇힘)과 P2 Q1(연결됨, 빈 예산, 접힌 고급에서 Tab 이탈)을 반영했고, 비교 렌더용 변형 스위치(MK_VAR)를 코드에서 걷어 냈다고 Claude 가 주장한다.

## 스크린샷 (artifacts/teth-redesign)
`r8-main-top.png`, `r8-main.png`, `r8-main-full.png`, `r8-main-1280.png`, `r8-main-390.png`, `r8-main-390-top.png`, `r8-controls-390.png`, `r8-detail-1.png`, `r8-detail-1-full.png`, `r8-detail-1-events.png`, `r8-detail-2.png`, `r8-detail-2-full.png`, `r8-detail-3.png`, `r8-detail-3-full.png`, `r8-detail-390.png`, `r8-rotate-chart-390.png`, `r8-follow-missing-only.png`, `r8-follow-sheet.png`, `r8-topup-over-sheet.png`, `r8-topup-over-sheet-390.png`. 비교용 `baseline-*.png`, `r7-*.png`.
직접 렌더해 확인하라(서버 8843, Chrome 9333).

## 1부: 독립 비평
1. Round 7 결함 재검증: Q3(1,000 USDT 전액 배정 뒤 다른 전략에서 예산 추가. 마우스, 키보드, 취소, Escape, 두 번 누르기, 390), Q1(연결 전, 연결됨 빈 예산, 연결됨 유효 예산 x 고급 접힘, 펼침), 그리고 Round 6 에서 닫힌 N1, R2, Q2 의 회귀. 변형 스위치 제거가 화면을 바꾸지 않았는지 r7 과 r8 PNG 비교. 각각 PASS / FAIL 과 재현.
2. 최종 수용 기준 A~N 재판정.
3. 새 결함 탐색: 이번 수정이 만든 회귀(따라가기 시작과 중복 시작, 시트를 연 채 다른 대화 상자, 목록 검색과 정렬과 판단 방식 전환, 768 전후 폭, 1280, 1440).
4. 구체 비판(있는 만큼. 형식과 등급 동일).
5. **P0, P1 개수를 명시. 0 이면 0 이라고 쓴다.**

## 2부: 교차 검증
`r8-claude.md` 의 판정과 남은 것 3건에 ACCEPT / REJECT / MODIFY / TEST.

## 3부: 남은 수정(있다면 우선순위 순)

## 제약
index.html 과 다른 파일 수정 금지(산출 파일 하나만). em dash, 가운뎃점 금지. 새 고지나 라벨 금지. 사용자 확정 제약(KPI 넷, 버튼 문구, 4열 x 5행, 10페이지 반복, 30일은 수익률만, 리그 배너 유지) 재론 금지. 산출 `artifacts/teth-redesign/r8-codex.md`, 160줄 이내.
