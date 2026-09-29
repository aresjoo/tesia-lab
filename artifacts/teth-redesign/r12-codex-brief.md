# 확인 검수 4 (Codex, Astra): 독립 비평 뒤 교차 검증까지

**순서**: 1부를 다 쓴 뒤에야 `r12-claude.md` 를 연다. 이전 라운드의 자기 보고서(`r11-codex.md` 등)에 기대지 말고 처음 보는 제품처럼 다시 검증한다.

## 이번 구현
확인 검수 3 뒤로 제품 코드는 바뀌지 않았다고 Claude 가 주장한다. 이번 검수의 목적은 같은 빌드를 다른 경로로 다시 공격해 남은 P0, P1 이 있는지 확인하는 것이다.

## 스크린샷 (artifacts/teth-redesign)
`final-main-top.png`, `final-main.png`, `final-main-full.png`, `final-main-1280.png`, `final-main-390.png`, `final-detail-1.png`, `final-detail-1-full.png`, `final-detail-2.png`, `final-detail-2-full.png`, `final-detail-3.png`, `final-detail-3-full.png`, `final-detail-390.png`, `final-follow-sheet.png`. 비교용 `baseline-*.png`.
직접 렌더해 확인하라(서버 8843, Chrome 9333).

## 1부: 독립 비평
1. 지금까지 덜 본 경로를 고른다: 20종 가운데 앞선 라운드에서 열지 않은 전략의 상세(각 판단 방식에서 2개 이상), 음수와 0 수익률 전략, 활동과 거래 탭의 숫자 일치, 즐겨찾기, 공유 링크로 직접 진입, 옛 이름으로 진입, 페이지 2 이후, 정렬과 시장 필터 조합, 따라가는 중 탭, 중단과 재시작, 새로고침 뒤 상태. 각각 PASS / FAIL 과 재현.
2. 최종 수용 기준 A~N 재판정.
3. baseline 과 final PNG 를 실제로 비교해 개편 목표(서로 다른 판단 방식을 가진 시스템을 비교하고 고르는 제품)에 닿았는지.
4. 구체 비판(있는 만큼. 형식과 등급 동일).
5. **P0, P1 개수를 명시. 0 이면 0 이라고 쓴다.**

## 2부: 교차 검증
`r12-claude.md` 의 판정에 ACCEPT / REJECT / MODIFY / TEST.

## 3부: 남은 수정(있다면 우선순위 순)

## 제약
index.html 과 다른 파일 수정 금지(산출 파일 하나만). em dash, 가운뎃점 금지. 새 고지나 라벨 금지. 사용자 확정 제약(KPI 넷, 버튼 문구, 4열 x 5행, 10페이지 반복, 30일은 수익률만, 리그 배너 유지) 재론 금지. 산출 `artifacts/teth-redesign/r12-codex.md`, 160줄 이내.
