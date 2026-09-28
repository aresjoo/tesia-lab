# "지금 TETH가 하는 일" 판단 카드 시안 경쟁 브리프

위치: AI 트레이딩 랜딩(index.html `tfIntroView`, 히어로 바로 아래 섹션 `#txh-now`). 현재 카드: ux-audit/card/current.png. 섹션 제목 "지금 TETH가 하는 일"과 리드 문장은 유지, 카드만 새로 설계한다. 카드 최대 폭 680px, 배경 다크(#0f1012 계열), 카드 면 var(--g1) 톤(#15171a 근처), 라임 사용 금지(이 섹션에는 1차 행동이 없다).

## 카드에 들어갈 것 (이것만)
1. 이미지: 워렌 버핏 얼굴 사진 `assets/buffett.jpg` (480x480, 정사각). 원형 또는 둥근 사각 아바타로.
2. 전략명: `워렌 버핏 AI_버전13` (그대로, 띄어쓰기·언더바 유지)
3. 거래소: 바이낸스 작은 원형 로고 `assets/logos/app-binance.png` (지름 18~22px, 전략명 옆 또는 아바타 모서리)
4. 본문(그대로, 한 글자도 바꾸지 말 것):
   "제 분석에 따르면 NVDA와 MSFT 같은 AI 관련 기업들의 강세가 지속될 것으로 예상되어, 주말 유동성 감소와 거시 경제 이벤트 위험에도 불구하고 기존 롱 포지션을 유지하고 있으며, 당분간 신규 거래나 헤지 포지션은 추가하지 않을 예정입니다. NVDA의 지지선과 MSFT의 상승 추세를 면밀히 모니터링하며, 추세가 무너질 경우 조정할 준비를 하고 있습니다."

## 넣지 말 것
"시뮬레이션 예시" 배지, "지금은 기다려요" 칩, 종목명 칩(비트코인), "주문 없음", "다음 확인 15분 뒤", 번호 목록. 그 밖의 메타 요소(시각, 상태 점 등)는 1개까지만 허용하되 이유를 노트에 적는다.

## 산출
- `ux-audit/card/mock-<이름>.html` 독립 HTML(인라인 CSS, 외부 라이브러리 없음, 이미지 경로는 `../../assets/...`). 페이지는 다크 배경 위에 섹션 제목 + 리드 + 카드만. 세리프 제목은 히어로와 같은 스택 "Noto Serif KR","Nanum Myeongjo",Batang,serif (index.html이 Noto Serif KR을 이미 로드함). 본문은 system-ui/Pretendard 계열 15~16px, 줄간 1.7.
- 스크린샷 2장: `mock-<이름>-d1440.png`(1440x900 뷰포트, 섹션이 다 보이게 페이지 높이 맞춤), `mock-<이름>-m390.png`(390x844 mobile). 드라이버 `C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/pw/cdp.mjs`(newPage, closePage, goto, evala, viewport, shot, sleep, 사용 전 읽기), 헤드리스 Chrome 127.0.0.1:9333, 정적 서버 각자 포트(`node "C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/srv/serve.mjs" "<저장소 절대경로>" <포트>` 백그라운드): claude 8801, quote 8802, codex 8803.
- 노트 `ux-audit/card/NOTE-<이름>.md` 6줄 이내: 콘셉트 한 문장, 아바타·이름·로고 배치 원리, 본문 타이포 선택, 390 대응, 위험 1개.
- index.html 수정 금지. 스크린샷 없이 보고 금지.
