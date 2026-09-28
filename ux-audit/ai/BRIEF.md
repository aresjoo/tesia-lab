# "TETH가 쓰는 AI" 섹션 시안 경쟁 브리프

위치: AI 트레이딩 랜딩(index.html `tfIntroView`)에서 히어로(영상 바닥) 바로 아래, "지금 TETH가 하는 일" 섹션 바로 위에 새 섹션을 넣는다. 페이지 맥락: ux-audit/hero/final-d1440.png, ux-audit/card/final-d1440.png. 다크 배경(#0f1012 계열), 제목은 히어로와 같은 세리프 스택("Noto Serif KR","Nanum Myeongjo",Batang,serif), 본문은 system-ui/Pretendard 계열, 라임 금지(이 섹션에 1차 행동 없음), 콘텐츠 폭은 페이지와 같은 최대 1140px(사이드바 제외 영역), 카드 열은 최대 680~900px 범위에서 자유.

## 메시지
TETH는 하나의 AI가 아니라, 시장 상황과 전략에 맞는 AI를 골라 쓴다. 섹션 제목은 아래 3안 중 하나를 고르고 노트에 이유를 쓴다(수정 금지, 선택만).
1. "상황에 맞는 AI를 골라 써요"
2. "AI 하나에 맡기지 않아요"
3. "시장이 바뀌면 쓰는 AI도 바뀌어요"
리드 문장(선택, 최대 1줄): "뉴스를 읽을 때, 숫자를 셀 때, 이유를 쓸 때 잘하는 AI가 달라요." 를 쓰거나 생략.

## AI 9개와 역할 한 줄 (아이콘: assets/ai/<key>.png, 앱스토어 아이콘 512px, 둥근 사각으로 표시)
| key | 표시 이름 | 역할 한 줄 (그대로 사용) |
|---|---|---|
| chatgpt | ChatGPT | 복잡한 상황을 정리해 판단해요 |
| claude | Claude | 왜 그렇게 했는지 차분한 문장으로 써요 |
| gemini | Gemini | 구글 검색으로 최신 정보를 확인해요 |
| grok | Grok | X의 실시간 여론을 읽어요 |
| deepseek | DeepSeek | 시장을 쉬지 않고 훑어요 |
| qwen | Qwen | 여러 종목을 한꺼번에 비교해요 |
| perplexity | Perplexity | 뉴스와 공시의 출처를 찾아요 |
| kimi | Kimi | 긴 보고서와 자료를 읽어요 |
| mistral | Le Chat (Mistral) | 내부 서버에서 돌리는 예비 판단이에요 |
아이콘이 없으면(assets/ai/SOURCES.json 의 ok:false) 그 항목은 빼고 노트에 적는다. 회사명·사용자 수·순위·수익률·"최고"류 표현 금지. 각 AI가 TETH의 파트너라는 인상(제휴 표기, "공식")도 금지. 아이콘 아래나 옆에 작은 글씨로 "각 로고는 해당 회사의 상표예요" 한 줄을 넣을지 여부는 시안 재량(노트에 이유).

## 반드시 지킬 것
- 산출 `ux-audit/ai/mock-<이름>.html` 독립 HTML(인라인 CSS, 외부 라이브러리 없음, 이미지 경로 `../../assets/ai/...`). 페이지는 히어로 바닥 느낌의 어두운 상단 여백 + 이 섹션 + 아래에 "지금 TETH가 하는 일" 제목만 흐리게(맥락용).
- 1440과 390 모두 설계. 390에서 9개가 세로로 길게 늘어지지 않게(가로 스크롤 행, 2열 그리드, 접힘 등 자유, 단 문서 가로 스크롤은 금지).
- 모션은 없거나 1종(예: 가로 행의 느린 자동 흐름)까지. 장식 글로우 금지.
- 스크린샷 2장: `mock-<이름>-d1440.png`(1440x900 뷰포트, 섹션 전체가 보이게 높이 맞춤), `mock-<이름>-m390.png`(390x844 mobile). 드라이버 `C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/pw/cdp.mjs`(newPage, closePage, goto, evala, viewport, shot, sleep, 사용 전 읽기), 헤드리스 Chrome 127.0.0.1:9333, 정적 서버 각자 포트(`node "C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/srv/serve.mjs" "<저장소 절대경로>" <포트>` 백그라운드): claude 8811, grid 8812, codex 8813.
- 노트 `ux-audit/ai/NOTE-<이름>.md` 8줄 이내: 콘셉트 한 문장, 고른 제목과 이유, 아이콘·역할 배치 원리, 390 대응, 상표 문구 여부, 위험 1개.
- index.html 수정 금지. 스크린샷 없이 보고 금지.
