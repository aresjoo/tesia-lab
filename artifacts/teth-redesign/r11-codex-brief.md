# 확인 검수 3 (Codex, Astra): 독립 비평 뒤 교차 검증까지

**순서**: 1부를 다 쓴 뒤에야 `r11-claude.md` 를 연다.

## 이번 구현
확인 검수 2 의 P1 Q5 와 P2 Q6 을 반영했다고 Claude 가 주장한다. 시간으로 막는 처리를 모두 걷어 내고, 따라가기 시트 안에서는 확인 창 없이 추가 링크가 그 자리에서 1,000 USDT 를 더한다.

## 스크린샷 (artifacts/teth-redesign)
`final-main-top.png`, `final-main.png`, `final-main-full.png`, `final-main-1280.png`, `final-main-390.png`, `final-detail-1.png`, `final-detail-1-full.png`, `final-detail-2.png`, `final-detail-2-full.png`, `final-detail-3.png`, `final-detail-3-full.png`, `final-detail-390.png`, `final-follow-sheet.png`, `r11-topup-inline-390.png`. 비교용 `baseline-*.png`, `r10-*.png`.
직접 렌더해 확인하라(서버 8843, Chrome 9333).

## 1부: 독립 비평
1. 확인 검수 2 결함 재검증: Q5(390x844 에서 추가 링크 좌표 두 번 0 ~ 1200ms, 세 번 300+300, 450+450, 600+300ms, 마우스와 터치, 1440, 키보드. 보충 1회, 계정 수, 초안 유지, 이후 따로 시작), Q6(추가 직후 바로 시작, 닫기, Escape 가 막히지 않는지). Q4, Q3, Q1, N1, R2, Q2 회귀. 각각 PASS / FAIL 과 재현.
2. 최종 수용 기준 A~N 재판정.
3. 새 결함 탐색: 이번 수정이 만든 회귀(따라가기 시작과 중복 시작, 시트를 연 채 다른 대화 상자, 목록 검색과 정렬과 판단 방식 전환, 768 전후 폭, 1280, 1440).
4. 구체 비판(있는 만큼. 형식과 등급 동일).
5. **P0, P1 개수를 명시. 0 이면 0 이라고 쓴다.**

## 2부: 교차 검증
`r11-claude.md` 의 판정과 남은 것 3건에 ACCEPT / REJECT / MODIFY / TEST.

## 3부: 남은 수정(있다면 우선순위 순)

## 제약
index.html 과 다른 파일 수정 금지(산출 파일 하나만). em dash, 가운뎃점 금지. 새 고지나 라벨 금지. 사용자 확정 제약(KPI 넷, 버튼 문구, 4열 x 5행, 10페이지 반복, 30일은 수익률만, 리그 배너 유지) 재론 금지. 산출 `artifacts/teth-redesign/r11-codex.md`, 160줄 이내.
