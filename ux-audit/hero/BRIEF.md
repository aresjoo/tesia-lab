# AI 트레이딩 메인(게스트 랜딩) 시안 경쟁 브리프

대상: 좌측 사이드바 "AI 트레이딩" 을 눌렀을 때 나오는 메인 화면(현재 `tfIntroView`, 스크린샷 ux-audit/hero/current-d1440.png). 상단 히어로를 동영상 `assets/halo.mp4`(1440x480, 6.7초, 파란 유리 타일 바닥이 빛나는 루프, 첫 0.3초는 검정)로 다시 만들고, 그 아래 섹션들도 함께 설계한다. 레퍼런스 톤: ux-audit/hero/ref-robinhood.webp(검정 배경, 세리프 대형 헤드라인 가운데 정렬, 라임 알약 CTA, 그 아래 빛나는 타일 바닥). 그대로 베끼지 말고 TETH 다크 톤(검정 #0c0d0f 계열, 라임 #c8f43c 1차 CTA 1개, 흰 글자)과 기존 사이드바(300px, 새 전략 / AI 트레이딩 / 전략 따라하기)를 유지한다.

## 반드시 지킬 것
- 산출물은 독립 HTML 1개: `ux-audit/hero/mock-<이름>.html`. 외부 라이브러리 없이 인라인 CSS. 동영상은 `<video autoplay muted loop playsinline src="../../assets/halo.mp4" poster="../../assets/hero-tiles-end.jpg">`. 폰트는 저장소 `font-tokens.css` 와 같은 스택(Pretendard 계열, 없으면 system-ui). 헤드라인에 세리프를 쓰고 싶으면 `Noto Serif KR` 또는 시스템 세리프 폴백을 쓰고 이유를 적는다.
- 페이지 전체 구성: (1) 가짜 사이드바 300px(현재와 같은 3항목 + 하단 로그인) (2) 히어로: 동영상 위에 헤드라인, 서브 카피, [무료로 시작] 라임 CTA, 보조 링크. 동영상은 히어로 배경으로 폭 100%, 헤드라인은 타일이 빛나는 영역과 겹치지 않거나 의도적으로 겹치되 대비 4.5:1 확보 (3) 아래 섹션 최소 3개, 최대 5개: 예를 들어 "이런 전략을 돌려요"(AI 판단 / 규칙 / 따라가기 카드 3장), "판단마다 이유가 남아요"(판단 카드 예시 1~2장), "어떻게 시작하나요"(3단계), "내 돈은 어떻게 지키나요"(통제 4항목), 마지막 CTA. 카피는 한국어 "~해요" 톤, 사용자 수·수익률 과시·보증·규제 문구 금지, em dash와 가운뎃점 금지.
- 반응형: 1440 과 390 두 폭에서 깨지지 않게. 390 에서는 사이드바 대신 상단 바(로고 + 로그인)만.
- 모션: 동영상 자체 외에 장식 애니메이션 금지. 스크롤 등장 효과는 페이드 1종까지.
- 렌더: 헤드리스 Chrome(127.0.0.1:9333)과 드라이버 `C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/pw/cdp.mjs` (export newPage, closePage, goto, evala, viewport, shot, sleep; 사용 전 파일 읽기)로 정적 서버(각자 포트: claude 8791, agy 8792, codex 8793, `node "C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/srv/serve.mjs" "<저장소 절대경로>" <포트>` 백그라운드)에서 `http://127.0.0.1:<포트>/ux-audit/hero/mock-<이름>.html` 을 열어 동영상이 3초 재생된 시점(sleep 3200)에 전체 페이지 스크린샷 2장 `ux-audit/hero/mock-<이름>-d1440.png`(1440x900 뷰포트, 전체 높이), `mock-<이름>-m390.png`(390x844, mobile) 저장. 페이지는 닫는다.
- 설계 노트 `ux-audit/hero/NOTE-<이름>.md` 10줄 이내: 콘셉트 한 문장, 헤드라인 선택 이유, 동영상과 글자 배치 원리, 아래 섹션 순서 이유, 위험 1개.

## 금지
- 사이드바 구조 변경, 로그인 흐름 변경, index.html 수정.
- 스크린샷 없이 보고. 렌더 실패 시 원인과 함께 보고.
