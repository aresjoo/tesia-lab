# 전략 카드 미니 차트(스파크라인) 시안 브리프

문제: 현재 카드의 자산 곡선은 꺾은선이 계단처럼 꺾여 조잡해 보인다(사용자: "꺽이고 막 그래서"). 레퍼런스 `ref-45.png`~`ref-48.png`(League of Traders, Binance 카드 차트): 부드러운 곡선, 시작값 기준선 점선, 기준선 위는 초록 아래는 빨강, 선 아래 옅은 면 채움, 둥근 선 끝.

케이스 3개를 반드시 모두 렌더: 손해 / 수익 / 손해와 수익이 함께(기준선을 넘나듦). 데이터는 `data.js` 의 `SPARK_CASES`(각 60포인트, 시작값 1) 그대로.

크기: 실제 카드 크기 104x42px 과 3배 확대(312x126) 둘 다. 카드 맥락(다크 #151619 카드, 왼쪽에 "수익률" 라벨과 26px 수익률 숫자, 오른쪽에 차트)으로 보여 준다. 색: 초록 #2fb98a 계열, 빨강 #f0566a 계열(조정 가능). 배경 #0f1012.

산출: `ux-audit/spark/mock-<이름>.html`(인라인 CSS/JS, 외부 라이브러리 금지, `data.js` 로드), 스크린샷 `mock-<이름>.png`(1200 폭 full page, 세 케이스와 두 크기가 한 장에), 노트 `NOTE-<이름>.md` 6줄 이내(곡선 방식, 기준선, 색 전환 방식, 면 채움, 104px 에서의 가독성, 위험 1개). SVG 로 그린다. em dash, 가운뎃점 금지. index.html 수정 금지.

드라이버 `C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/pw/cdp.mjs`, 헤드리스 Chrome 127.0.0.1:9333, 정적 서버는 `node "C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/srv/serve.mjs" "C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1" <포트>` (codex 8873).
