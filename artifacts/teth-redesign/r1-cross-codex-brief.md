# ROUND 1 교차 검증 (Codex, Astra)

읽을 것(이 폴더): `r1-claude.md`(Claude 독립 비평), `r1-cross-claude.md`(네 비평에 대한 Claude 판정). 네 것은 `r1-codex.md`.

## 할 일 (짧게)
1. `r1-claude.md` 의 비판 13개 각각 ACCEPT / REJECT / MODIFY / TEST 와 근거 한 줄.
2. `r1-cross-claude.md` 에서 약한 수용, 근거 없는 거절, 타협을 공격. 특히 식별 재대결(B1 대 B2), D4 거절(최근 판단 4건 유지), 혼합 상태 지표 시점 거절, 이름 교체 확정안(자리바꿈, 번갈이).
3. 식별 재대결의 판정 기준을 스크린샷으로 확인 가능한 문장 3개 이내로 확정. B1 을 고칠 때 같은 유형 안에서 구별을 만드는 구체 방법(어떤 값을 어떤 모양으로)을 제안.
4. Round 2(신뢰) 구현 전 반드시 고쳐야 할 것을 우선순위 순으로 10개 이내로.

## 제약
index.html 수정 금지. em dash, 가운뎃점 금지. 새 고지나 라벨 금지. 사용자 확정 제약(KPI 넷, 버튼 문구, 4열 x 5행, 10페이지 반복, 30일은 수익률만)은 재론하지 않는다. 산출 `artifacts/teth-redesign/r1-cross-codex.md`, 90줄 이내.
