# 확인 검수 5 (Codex, Astra): 독립 비평 뒤 교차 검증까지

**순서**: 1부를 다 쓴 뒤에야 `r13-claude.md` 를 연다.

## 이번 구현
확인 검수 4 의 P1 F01(중단의 원본 청산 대기와 직접 관리가 즉시 정산)과 P2 F02(즐겨찾기 표시)를 반영했고, 직접 탐색과 혼합 전략의 따라가기 상세 포지션 탭 오류를 고쳤다고 Claude 가 주장한다.

## 스크린샷 (artifacts/teth-redesign)
`final-main-top.png`, `final-main.png`, `final-main-full.png`, `final-main-1280.png`, `final-main-390.png`, `final-detail-1.png`, `final-detail-2.png`, `final-detail-3.png`, `final-detail-390.png`, `final-follow-sheet.png`, `r13-stop-wait-list.png`, `r13-stop-manual-detail.png`. 비교용 `baseline-*.png`.
직접 렌더해 확인하라(서버 8843, Chrome 9333).

## 1부: 독립 비평
1. 확인 검수 4 결함 재검증: F01(열린 포지션이 있는 전략과 없는 전략 각각에서 세 선택, 새로고침, 포지션 정리, 반환 한 번, 재시작, 합계 표시, 예산 조정과 설정 버튼의 상태, 전체 중단 같은 다른 경로), F02(ID, 옛 이름, 현재 이름, 두 버튼 번갈아, 새로고침). 따라가기 상세의 다섯 탭을 세 판단 방식 모두에서 열어 오류와 숫자 일치 확인. 각각 PASS / FAIL 과 재현.
2. 앞선 라운드에서 닫힌 Q5, Q4, Q3, Q1, N1, R2, Q2 의 회귀.
3. 최종 수용 기준 A~N 재판정.
4. 구체 비판(있는 만큼. 형식과 등급 동일).
5. **P0, P1 개수를 명시. 0 이면 0 이라고 쓴다.**

## 2부: 교차 검증
`r13-claude.md` 의 판정에 ACCEPT / REJECT / MODIFY / TEST.

## 3부: 남은 수정(있다면 우선순위 순)

## 제약
index.html 과 다른 파일 수정 금지(산출 파일 하나만). em dash, 가운뎃점 금지. 새 고지나 라벨 금지. 사용자 확정 제약(KPI 넷, 버튼 문구, 4열 x 5행, 10페이지 반복, 30일은 수익률만, 리그 배너 유지) 재론 금지. 산출 `artifacts/teth-redesign/r13-codex.md`, 160줄 이내.
