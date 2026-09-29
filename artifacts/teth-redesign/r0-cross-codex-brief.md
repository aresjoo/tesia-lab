# ROUND 0 교차 검증 (Codex, Astra)

읽을 파일(이 폴더): `r0-claude.md`(Claude 독립 감사), `r0-cross-claude.md`(Claude 가 네 비판에 내린 판정과 쟁점 5개), 네 것은 `r0-codex.md`.
참고 구현 초안: `C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/rd/agent-core.js` (읽기만).

## 할 일
1. `r0-claude.md` 의 비판 15개 각각에 ACCEPT / REJECT / MODIFY / TEST 와 근거 한 줄. REJECT 는 스크린샷, 사용자 행동, 정보 위계, 구현 제약 중 하나 이상의 근거.
2. `r0-cross-claude.md` 에서 약한 수용, 근거 없는 거절, 타협으로 흐려진 해법을 찾아 공격. 특히 12(10페이지 반복 유지), 3열 거절, 05(버튼), 08(기간 표기).
   - 단, 사용자가 직접 지시한 제약은 바꿀 수 없다: 카드 KPI 넷(30일 수익률, 최대 낙폭, 승률, 거래 수), 버튼 문구 "따라가기"와 "자세히", 4열 x 5행 20장, 10페이지 반복, 새 고지나 라벨 금지. 이 제약 안에서 최선의 해법을 제시하라.
3. 쟁점 1~5 각각에 입장. 특히 쟁점 1: `agent-core.js` 의 계산기가 "판단 기록과 성과가 같은 계산에서 나온다"는 조건을 만족하는지 코드를 읽고 판정. 결함(미래 정보 참조, 비용 누락, 비중과 자산 곡선 불일치, 사건과 체결 불일치)을 줄 단위로 지적.
4. Round 1 에서 렌더로 비교할 후보를 확정: 이름 3안 각 8장, 식별 표현(사람형 A, 데이터 도식 B1, 로고 파생 기호 B2), 카드 주 버튼 2안. 각 후보의 합격 기준을 스크린샷으로 판정 가능한 문장으로.
5. 이름 후보를 직접 제안: 세 유형(직접 탐색, 조건 실행, 혼합)이 섞인 20개 기준으로 A, B, C 각 8개. 금지: 사람 이름과 직업, 밈, "Strategy 001" 식, Atlas, Scout, Pulse, Vector, Nova, Sentinel 류의 흔한 AI 이름, 수익 약속.

## 제약
index.html 수정 금지. em dash, 가운뎃점 금지. 산출 `artifacts/teth-redesign/r0-cross-codex.md`, 180줄 이내.
