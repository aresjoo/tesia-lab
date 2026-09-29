# ROUND 4 (Codex, Astra): 시각 제품 품질. 독립 비평 뒤 교차 검증까지

**순서**: 1부를 다 쓴 뒤에야 `r4-claude.md` 를 연다(Round 3 판정표와 Claude 시각 비평이 있다).

## 이번 구현
Round 3 의 N1~N10, 교차 #3, #6 을 반영했다고 Claude 가 주장한다. 확정: 식별 B1, 버튼 P1, 최근 판단 4건. 추가: 카드 호버, 버튼 호버, 포커스 표시, 표 상태 칸 폭, 숫자 고정폭.

## 스크린샷 (artifacts/teth-redesign)
`r4-main-top.png`, `r4-main.png`, `r4-main-full.png`, `r4-main-1280.png`, `r4-main-390.png`, `r4-detail-1.png`, `r4-detail-1-full.png`, `r4-detail-2.png`, `r4-detail-2-full.png`, `r4-detail-3.png`, `r4-detail-3-full.png`, `r4-detail-390.png`, `r4-glyphs.png`, `r4-now-a.png`, `r4-now-b.png`(카드 상태 줄 현재안 대 숫자 포함안), `r4-hover-card.png`. 비교용 `r3-*.png`, `baseline-*.png`.
직접 렌더해 호버, 포커스, 키보드 이동, 스크롤, 1280, 390 을 확인하라(서버 8843, Chrome 9333).

## 1부: 독립 비평
1. 시각 항목별 판정과 구체 지적: 타이포, 간격, 대비(실제 색 값으로 대비비 계산), 격자, 리듬, 도식 체계, 차트, 밀도, 어두운 면의 질, 테두리 처리, 호버, 선택 상태, 스크롤, 반응형, 빈 여백, 시각 위계.
2. "AI 가 만든 SaaS 템플릿 냄새"가 나는 요소를 찾아라: 임의의 유리 효과, 네온, 그라데이션 덩어리, 의미 없는 상태 점, 색만 바꾼 같은 아이콘 등.
3. 라임(브랜드), 수익 초록, 상태 색이 서로 경쟁하는지 판정.
4. 구체 비판 최소 8개(형식과 등급 동일).
5. Round 3 결함 재검증(N1~N10, 교차 #3, #6): PASS / FAIL 과 재현.
6. P0, P1 개수.

## 2부: 교차 검증
`r4-claude.md` 의 판정(MODIFY 2건, 렌더로 결정 2건)과 시각 비판 9개에 ACCEPT / REJECT / MODIFY / TEST.

## 3부: Round 5(레드팀) 전에 고칠 것 10개 이내

## 제약
index.html 수정 금지(다른 파일도 수정하지 말 것. 산출 파일 하나만). em dash, 가운뎃점 금지. 새 고지나 라벨 금지. 사용자 확정 제약 재론 금지. 산출 `artifacts/teth-redesign/r4-codex.md`, 200줄 이내.
