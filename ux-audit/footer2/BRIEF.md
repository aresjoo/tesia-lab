# TETH 푸터 2차: 상단 바(고객 관계 요약 + 팔로우) 시안 경쟁 브리프

레퍼런스: robinhood.com 푸터 맨 윗줄. 왼쪽에 밑줄 링크 "고객 관계 요약", 오른쪽에 "팔로우하세요" 텍스트와 단색 SNS 글리프(X, Instagram, LinkedIn, TikTok, YouTube)가 한 줄, 그 아래 얇은 구분선(hairline)이 콘텐츠 폭 전체. 그 밑에 링크 4칼럼 + 오른쪽 문단. 사용자 지시: "로고 똑같이 해줘. 로빈후드랑 똑같이. 구분선도."

## 바탕 (이미 배포된 현행 푸터, 수정 금지)
`site-footer.js` 가 라임(#c8f43c) 푸터 전체(4칼럼, 오른쪽 문단, Powered by Bitget, 거대 TETH 워드마크)를 그린다. 목업은 이걸 그대로 불러서 마운트한 뒤, 상단 바만 얹는다:
```html
<script src="../../site-config.js?v=2"></script>
<script src="../../site-footer.js?v=1"></script>
<script src="icons.js"></script>
<div id="site-footer"></div>
<script>TETH_FOOTER.mount(document.getElementById('site-footer'),{base:'../../'});</script>
```
그 다음 목업 자체 JS 로 `.gft-in` 맨 앞에 상단 바를 삽입하고, 목업 자체 `<style>` 로 스타일링. 문단은 목업 JS 로 아래 문구로 교체(형식체, "~요" 금지):
- p1: "TETH는 고객이 말로 정한 전략을 AI 에이전트가 판단하고 실행하는 AI 트레이딩 서비스입니다. 고객이 각 거래에 직접 개입하지 않아도 AI 에이전트가 주식, 옵션, 암호화폐 거래를 실행할 수 있으며, 모든 거래는 고객이 연결한 Bitget 계정 안에서 이루어집니다."
- p2 (굵게): "Bitget이 선정한 최고의 AI입니다."
- p3 (dim): "TETH는 조회와 주문 권한만 사용하며 출금 권한은 요청하지 않습니다. 거래 한도는 고객이 직접 설정하고, 언제든지 전략을 중지하거나 연결을 해제할 수 있습니다. 판단 근거는 거래마다 기록으로 남깁니다."
- p4 (dim): "© 2026 TETH AI. 모든 권리 보유."

## 상단 바 요구
1. 왼쪽: 링크 "고객 관계 요약" (href `../../policies/teth-crs.pdf`, target _blank). 로빈후드처럼 밑줄. 두 번째 링크 없음.
2. 오른쪽: "팔로우하세요" 텍스트 + 단색 글리프 4개 순서대로 X, Instagram, YouTube, Telegram. 글리프는 `icons.js` 의 `TETH_SNS_ICONS` (viewBox 0 0 24 24, fill currentColor) 사용. 링크는 `TETH_CONFIG.social` 의 x, instagram, youtube, telegram, target _blank, aria-label 로 이름. 글자색과 같은 #0c0d0f, 크기 18~22px, 터치 영역 44px.
3. 바 아래 구분선 1px, 색은 라임 위에서 보이는 어두운 hairline(예: rgba(12,13,15,.35)). 콘텐츠 폭(`.gft-in` 패딩 안쪽) 전체.
4. 바와 그 아래 4칼럼 사이 간격은 로빈후드 비율 참고(바 높이 약 56~64px, 구분선 아래 40~56px).
5. 390 모바일: 한 줄이 안 되면 링크 위, 팔로우 줄 아래로 쌓기. 글리프 간격 유지, 잘림 금지.
6. 시안마다 배치 아이디어 1개 차별화(예: 바를 라임 안 최상단 / 바를 다크와 라임 경계 위 얇은 밴드로 / 팔로우 줄을 워드마크 위로 옮기고 상단엔 링크만 등). 단 요구 1~5 는 지킨다.

## 산출
- `ux-audit/footer2/mock-<이름>.html` 독립 HTML(외부 폰트 링크 금지, 위 스크립트만). 페이지 위쪽에 맥락용 다크 콘텐츠 한 덩어리(높이 300px, "내 돈은 어떻게 지키나요" 제목 흐리게), 좌측 64px 접힌 사이드바 흉내는 두지 않는다(현행은 푸터가 사이드바 아래 전체 폭).
- 스크린샷: `mock-<이름>-d1440.png`(1440x900, 푸터 전체 보이게 full page), `mock-<이름>-m390.png`(390, mobile), `mock-<이름>-bar.png`(1440 에서 상단 바 영역만 clip, 글리프 4개가 진짜 로고처럼 보이는지 확인용).
- 노트 `ux-audit/footer2/NOTE-<이름>.md` 8줄 이내: 콘셉트, 바 배치, 글리프 확인 결과(어느 글리프가 이상하면 명시), 390 대응, 위험 1개.
- 드라이버 `C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/pw/cdp.mjs` (newPage, closePage, goto, evala, viewport, shot(c,path,{full,clip}), sleep(ms)), 헤드리스 Chrome 127.0.0.1:9333, 정적 서버 각자 포트 `node "C:/Users/hyun1/AppData/Local/Temp/claude/C--Users-hyun1-OneDrive------/3eeecebb-9375-4ed0-850b-52929f00da99/scratchpad/srv/serve.mjs" "<저장소 절대경로>" <포트>` : rail 8841, band 8842, codex 8843. 저장소 절대경로 `C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1`.
- em dash, 가운뎃점 금지. index.html, site-footer.js, site-config.js 수정 금지. 스크린샷 없이 보고 금지. 컴플라이언스 문구 추가 금지.
