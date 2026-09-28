# TETH 사이트 푸터 시안 경쟁 브리프

레퍼런스: robinhood.com/sg/en 맨 아래(ux-audit/footer/ref-robinhood-1.webp, ref-robinhood-2.webp). 상단에 링크 칼럼 + 오른쪽 문단, 맨 아래 브랜드명이 화면 폭을 꽉 채우는 거대 워드마크. 베끼지 말고 TETH 톤(히어로 세리프 헤드라인, 다크 페이지, 라임 #c8f43c 브랜드색)으로.

## 적용 범위
끝이 있는 스크롤 페이지 전부(AI 트레이딩 랜딩, 전략 따라하기, 거래소 연결, 이용 현황 등). 채팅 화면과 터미널처럼 입력창이 바닥에 붙는 화면은 제외. 푸터는 고정이 아니라 콘텐츠 맨 끝에 있어서, 끝까지 스크롤해야 보인다. 콘텐츠 영역은 좌측 사이드바(데스크톱 약 64~300px)를 뺀 폭.

## 구성 (내용은 그대로, 배치는 시안 재량)
1. 링크 4칼럼
   - 제품: AI 트레이딩 / 전략 따라하기 / 새 전략 만들기 / 거래소 연결
   - 회사: TETH 정보 / 인사이트 / 앱 다운로드
   - 도움: 24시간 상담 / 이용 현황
   - 약관: 서비스 약관 / 개인정보처리방침
2. 오른쪽 문단(그대로):
   - "TETH는 말로 만든 전략을 AI가 판단하고 거래하는 서비스예요. 거래는 연결한 거래소 계정 안에서만 이뤄지고, TETH는 출금 권한을 받지 않아요."
   - "TETH는 Bitget의 1등 파트너예요."
   - "가상자산 거래는 원금 손실이 생길 수 있어요. 과거 결과가 앞으로의 수익을 보장하지 않아요."
   - "© 2026 TETH AI. 모든 권리 보유."
3. 워드마크 영역: 작은 한 줄 "Powered by" + Bitget 앱 로고(`assets/logos/bitget-512.png`, 둥근 사각, 글자 높이 1.2~1.6배) + "Bitget", 그 아래 거대 "TETH"가 콘텐츠 폭을 꽉 채움(글자 폭 기준 fit, 좌우 여백 거의 없이). 워드마크 서체는 굵은 산세리프 또는 히어로와 같은 세리프 중 택1, 노트에 이유.

## 배경 두 안 (각 시안이 둘 다 렌더)
- lime: 푸터 전체 배경 #c8f43c, 글자 #0c0d0f. 페이지 끝에서 다크에서 라임으로 강하게 전환.
- dark: 페이지와 같은 다크(#0f1012 근처), 글자 흰색, 거대 TETH만 흰색(또는 아주 옅은 그라데이션 금지, 단색).
HTML 하나에 `?bg=lime` / `?bg=dark` 쿼리로 전환.

## 반드시 지킬 것
- 산출 `ux-audit/footer/mock-<이름>.html` 독립 HTML(인라인 CSS, 외부 라이브러리·외부 폰트 링크 없음, 이미지 경로 `../../assets/...`). 페이지 위쪽에 맥락용으로 다크 콘텐츠 한 덩어리(예: "내 돈은 어떻게 지키나요" 제목 흐리게)를 두고 그 아래 푸터. 좌측에 64px 접힌 사이드바 흉내를 넣어 실제 폭과 같게.
- 390 모바일: 링크 칼럼은 2열 그리드, 문단은 아래로, 거대 TETH는 폭을 꽉 채움.
- 스크린샷 4장: `mock-<이름>-lime-d1440.png`, `mock-<이름>-dark-d1440.png`(1440x900, 푸터 전체가 보이게 페이지 높이 맞춤), `mock-<이름>-lime-m390.png`, `mock-<이름>-dark-m390.png`(390, mobile). 드라이버 `C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/pw/cdp.mjs`(newPage, closePage, goto, evala, viewport, shot, sleep, 사용 전 읽기), 헤드리스 Chrome 127.0.0.1:9333, 정적 서버 각자 포트(`node "C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/srv/serve.mjs" "<저장소 절대경로>" <포트>`): claude 8831, bleed 8832, codex 8833.
- 노트 `ux-audit/footer/NOTE-<이름>.md` 8줄 이내: 콘셉트, 워드마크 서체와 fit 방법, Powered by 줄 배치, 라임 대 다크 중 본인 추천과 이유, 390 대응, 위험 1개.
- em dash·가운뎃점 금지. index.html 수정 금지. 스크린샷 없이 보고 금지.
