# TETH 프로젝트 작업 지침

이 파일은 이 저장소의 에이전트용 기준 문서다. 작업을 시작할 때 실제 코드와 함께 읽고, 구조·동작·실행 방법이 바뀌면 같은 변경 안에서 이 문서도 갱신한다.

## migration 브랜치의 추가 작업 경계

이 브랜치는 클라이언트 원본과 React 이식본을 함께 검토하는 전달 브랜치다. 먼저 [MIGRATION.md](MIGRATION.md)를 읽는다. 아래의 바닐라 구조·실행·검증 설명은 루트 원본 앱에 적용되며, React 앱은 `react-app/`의 별도 package.json과 AGENTS.md를 따른다. 원본 main을 교체하거나 운영 배포한 상태가 아니다.

| 추가 경로 | 역할 |
| --- | --- |
| `README.md`, `MIGRATION.md` | 전달 진입점과 원본 대비 구조/동작 대응·잔여·누적 갱신 절차 |
| `react-app/` | 실제 로컬 React 통합 작업본의 추적 코드·자산·테스트 스냅샷. Node 22, npm ci, Vite 개발/빌드·lint·Playwright 사용 |
| `react-app/src/exchange-connect/` | 명시 비공개 서비스 공급용 거래소 연결 controller·transport·hook. 실제 키는 서버가 보관하며 원 회귀 후보와 별도 인수 |
| `migration-manifest.json` | 출처 SHA, 캡처 시각, 미커밋 파일, 전체 파일 해시 |
| `migration-verification.json` | 해당 전달본에서 실행한 검사와 미검증 범위 |
| `tools/sync-migration.mjs` | 출처를 수정하지 않는 명시적 동기화·해시 확인. 자동 push/배포 없음 |

원본 `index.html`·`site-config.js`와 루트 정적 페이지는 이번 전달에서 변경하지 않는다. React의 원본 계승이 완벽하다는 가정으로 검토하지 말고, MIGRATION.md의 미완료 목록을 먼저 확인한다. React 파일을 직접 수정한 뒤 다시 동기화할 때는 먼저 출처 담당과 변경을 합의한다. 다른 팀 작업을 덮어쓰지 않는다. `.mailbox`는 이 원격 clone에 제공되지 않아 클라이언트 세션의 메시지 수신 여부를 확인할 수 없으며, 전달 문서가 상대의 실제 확인을 증명하지 않는다.

## 작업 원칙

1. 현재 코드와 실제 브라우저 동작을 최우선 사실로 삼는다. 문서가 코드와 다르면 코드를 확인한 뒤 문서를 즉시 바로잡는다.
2. 기능 변경과 문서 변경을 분리하지 않는다. 사용자 흐름, 파일 역할, 설정, 외부 의존성, 실행 또는 검증 방법이 바뀌면 관련 문서를 같은 작업에서 수정한다.
3. 저장소에는 현재 상태를 설명하는 문서만 둔다. 더 이상 유효하지 않은 문서, 중복 문서, 폐기된 설계안과 예전 사용법은 새 이름으로 보관하지 말고 참조 링크를 정리한 뒤 삭제한다. 과거 내용은 Git 이력으로 확인한다.
4. 미래 기능이나 화면의 홍보 문구를 이미 구현된 기능처럼 문서화하지 않는다. 확인할 수 없는 내용은 추측하지 말고 `미구현`, `데모`, `확인 필요`로 표시한다.
5. 사용자 변경분을 보존한다. 작업 전후에 `git status --short`와 diff를 확인하고, 요청 범위 밖의 변경은 되돌리거나 덮어쓰지 않는다.
6. 셸 명령은 전역 지침인 `C:\Users\hyun1\.codex\RTK.md`에 따라 `rtk`를 앞에 붙여 실행한다.
7. 이 저장소는 claude, codex, agy 세 대화형 세션이 함께 작업한다. 작업 범위가 겹치거나 다른 세션의 결과에 의견이 있으면 추측하지 말고 아래 우체통으로 주고받는다.

## 에이전트 간 협업 (우체통)

세 세션은 서로의 대화를 볼 수 없고 알림도 받지 못한다. `.mailbox/`는 그 사이를 잇는 유일한 통로다. 메시지는 YAML 머리말이 붙은 Markdown 파일이므로 스크립트 없이 직접 읽어도 된다.

```
.mailbox/inbox/<받는이>/<id>.md     아직 처리하지 않은 메시지
.mailbox/archive/<받는이>/<id>.md   처리를 마친 메시지
```

참여자 이름은 `claude`, `codex`, `agy` 셋뿐이다. 자기 자신에게는 보내지 않는다.

### 명령

저장소 루트에서 실행한다. `<나>`에는 자신의 이름을 넣는다.

```
.\.mailbox\mail.cmd check <나>
.\.mailbox\mail.cmd read  <나> [<id>]
.\.mailbox\mail.cmd send  <나> <상대|all> "<제목>" "<본문>" [-Type <종류>] [-ReplyTo <id>]
.\.mailbox\mail.cmd done  <나> <id>
.\.mailbox\mail.cmd log   [건수]
```

본문이 길면 파일에 쓴 뒤 `"@경로"` 형태로 넘긴다. 예: `.\.mailbox\mail.cmd send codex claude "백테스트 지표 검토" "@review.md" -Type review`

### 매 턴 지켜야 할 순서

1. 턴을 시작하면 먼저 `check <나>`를 실행한다. 알림이 없으므로 이 확인을 건너뛰면 상대의 요청은 영원히 읽히지 않는다.
2. `question`, `claim`, `handoff`는 그 턴 안에서 처리한다. 질문에는 `-Type answer -ReplyTo <원본 id>`로 답장한 뒤 `done` 처리한다.
3. 처리하지 않은 메시지를 `done`으로 치우지 않는다. 아직 답할 수 없으면 그 이유를 답장으로 보내고 인박스에 남겨 둔다.
4. 작업을 마치면 결과와 미검증 항목을 관련된 상대에게 보낸다.

### 반드시 보내야 하는 경우

- `index.html`을 편집하기 전. 447KB 단일 파일이라 두 세션이 동시에 고치면 충돌이 확실하다. `-Type claim`으로 `all`에 건드릴 영역을 알리고, 끝나면 `-Type release`를 보낸다.
- `site-config.js`의 공용 값(요금제, 스토어 URL, Zendesk 키)을 바꿀 때.
- 다른 세션의 결과에서 문제를 발견했을 때. `-Type review`로 근거와 함께 보낸다.
- 구조, 외부 의존성, 다국어 키 체계처럼 되돌리기 어려운 결정을 하기 전. `-Type proposal`로 먼저 의견을 구한다.
- 검증하지 못한 항목을 남긴 채 작업을 넘길 때. `-Type handoff`로 무엇을 확인하지 못했는지 적는다.

### 메시지 종류

`note` 공유 · `question` 질문 · `answer` 답변 · `proposal` 제안 · `review` 지적 · `claim` 편집 영역 선점 · `release` 선점 해제 · `handoff` 인계

### 작성 규칙

- 근거를 담는다. 파일과 줄 번호, 실행한 명령과 출력, 재현 절차를 적는다. "좋아 보인다", "문제 없어 보인다" 같은 인상만 적은 메시지는 보내지 않는다.
- 반대할 때는 대안을 함께 제시한다.
- 받은 `claim`을 무시하고 같은 영역을 고치지 않는다. 먼저 손대야 하면 `question`으로 협의한다.
- 상대의 주장을 검증 없이 사실로 받아들이지 않는다. 코드와 실제 동작이 언제나 우선이다.
- 메시지는 저장소에 커밋하지 않는다. 결론은 코드와 이 문서에 남기고, 우체통은 그 과정을 위한 임시 통로로만 쓴다.

### 한계와 주의

- 알림이 없다. 보낸 메시지는 상대가 다음 턴을 시작할 때 읽는다. 즉시 답이 필요하면 사용자에게 직접 알린다.
- `claim`은 잠금이 아니라 합의 장치다. 강제되지 않으므로 편집 전 `check`로 상대의 선점을 반드시 확인한다.
- `.mailbox/mail.ps1`을 수정할 때는 UTF-8 BOM을 유지한다. Windows PowerShell 5.1은 BOM이 없는 스크립트를 ANSI로 읽어 한글이 깨지고 구문 오류가 난다.

## 현재 프로젝트 개요

TETH는 AI 트레이딩 에이전트의 제품 경험을 보여 주는 정적 웹 프로토타입이다. 사용자가 자연어로 전략 아이디어를 입력하고, 전략을 구조화하며, 브라우저에서 생성한 데모 데이터로 리서치와 백테스트 결과를 확인하고, 거래소 연결 및 라이브 운용 화면까지 체험하는 흐름을 제공한다.

현재 구현은 바닐라 HTML, CSS, JavaScript로만 구성된 클라이언트 측 데모다. 별도의 백엔드, 데이터베이스, 실제 AI 모델 호출, 실거래 API, 사용자 계정 서버, 빌드 파이프라인은 이 저장소에 없다. 백테스트·인증·거래소 연결·라이브 거래·에이전트 협업 화면은 브라우저 안에서 시뮬레이션된다. 정책 페이지에 적힌 보안 또는 데이터 처리 설명도 이 저장소에서 구현 여부를 증명하는 것은 아니다.

주요 사용자 경험은 다음과 같다.

- 대화형 전략 생성과 조건 보완
- 결정론적 데모 시세를 이용한 백테스트, 차트, 성과 지표
- 전략 설계·퀀트·리스크·검증 역할을 표현한 리서치 진행 화면과 보고서
- 홀드아웃, 민감도, 스트레스 등 검증 결과의 데모 표현
- 거래소 연결, 실행 확인, 일시 정지와 종료를 포함한 모의 라이브 운용
- 로그인·회원가입·프로필·설정·피드백의 클라이언트 데모
- 한국어, 영어, 일본어, 중국어 간체·번체, 스페인어, 프랑스어 UI
- 통화 표시, 소개, 요금제, 앱 다운로드, 정책·안전 정보, 고객지원 위젯

## 파일과 책임

| 경로 | 현재 역할 |
| --- | --- |
| `index.html` | 핵심 앱. 스타일, 화면 마크업, 상태, 시뮬레이션, 차트, 인증, 리서치, 라이브 운용, 다국어·통화 UI가 한 파일에 들어 있는 모놀리식 데모다. |
| `artifacts/teth-redesign/` | 전략 목록과 상세 개편(2026-09-29)의 기록. 라운드별 Claude, Codex 비평(`r0` ~ `r8`), 기준과 최종 스크린샷, `tools/` 에 `index.html` 의 `MK_CAT`, `RD_CORE`, `RD_CSS` 블록을 만드는 소스와 적용 스크립트가 있다. 세 판단 방식(직접 탐색, 조건 실행, 혼합)은 하나의 원장 엔진으로 계산한다. |
| `ux/spec/` | 병합된 제품 UX의 정본. `UX_DECISION_LOG.md`의 R1 갱신과 `ux/review/CLAUDE_ADJUDICATION.md` 판정을 이전 화면 예시보다 우선한다. |
| `ux/review/CODEX_FIX_REPORT.md` | 병합 수정 라운드의 재현, 수용·기각 판정, 변경 함수, 검증 결과와 남은 목업 한계. |
| `ux/review/USAGE_3WAY_CODEX.md` | 이용 현황 수치 비노출, 청구 이유, 체험 게이트, 창작자 보상과 상업 상태별 문구에 대한 CODEX 제품 판정 제안. 구현 완료 명세가 아니다. |
| `ux/review/CODEX_VERIFY.mjs` | 외부 CDP 드라이버를 사용하는 제품 회귀 검증. 11 프리셋과 활성화·따라가기·터미널 여정을 검사하며 localhost:8781의 목업 저장 상태를 교체한다. |
| `ux/shots/codex-fix/` | 위 검증의 1440px·390px 스크린샷과 `matrix.json`, `journeys.json`, `extra.json` 증거. |
| `ux-audit/hero/mock-codex.html`, `NOTE-codex.md`, `mock-codex-*.png`, `frame3-codex.png` | 실제 제품이 먼저 보이는 Codex 히어로 경쟁 시안, 구현 노트, 1440px·390px 렌더와 영상 3초 참고 프레임. 한국어 전용 독립 데모로, 포트 8793에서 확인하며 제품 본문과 인증 흐름은 변경하지 않는다. |
| `ux-audit/hero/CRIT-codex.md` | claude와 light 히어로 시안의 데스크톱 및 모바일 PNG를 직접 확인한 Codex 평가. 8개 항목 점수, 근거, 단일 채택 추천과 필수 수정 조건을 기록하며 구현 완료 명세는 아니다. |
| `ux-audit/research/AI_MODELS_TRADING.md`, `ux-audit/research/CODEX_VERIFY_MODELS.md` | 거래 판단과 Pine Script 작성 모델의 Claude 조사 초안 및 Codex 항목별 검증. 공식 출처 대조, 미확정 수치, 호출 비용과 조합 수정안을 기록한다. 실제 모델 성능 실험이나 제품 구현 완료 명세가 아니다. |
| `site-config.js` | 자주 바뀌는 공용 설정의 단일 진실 공급원. 앱 진입 경로, iOS·Android 스토어 URL, Zendesk 키, 요금제 데이터를 관리한다. |
| `ux-audit/card/mock-codex.html`, `ux-audit/card/NOTE-codex.md`, `ux-audit/card/mock-codex-d1440.png`, `ux-audit/card/mock-codex-m390.png` | 판단 카드 경쟁의 Codex 트레이더 프로필 시안, 6줄 구현 노트와 1440×900·390×844 렌더. 포트 8803의 한국어 전용 독립 HTML이며 본문 앱에는 적용하지 않았다. |
| `ux-audit/card/CRIT-codex.md` | claude와 quote 판단 카드의 데스크톱 및 모바일 PNG를 직접 확인한 Codex 평가. 6개 항목 점수, 단일 채택 추천과 필수 수정 조건을 기록하며 제품 코드에는 적용하지 않았다. |
| `ux-audit/ai/mock-codex.html`, `ux-audit/ai/NOTE-codex.md`, `ux-audit/ai/mock-codex-d1440.png`, `ux-audit/ai/mock-codex-m390.png` | “TETH가 쓰는 AI” 경쟁의 Codex 상황별 묶음 시안과 8줄 노트, 1440×900·390×844 CDP 렌더. 뉴스 확인·시장 살피기·판단 정리로 9개 AI를 한 번씩 배치한다. 포트 8813의 한국어 독립 HTML이며 Google Fonts와 `assets/ai/` 아이콘을 사용한다. 실제 AI 연동이나 본문 적용은 없으며 외부 AGY 검토는 인증·접근 오류로 미완료다. |
| `ux-audit/ai/CRIT-codex.md` | claude와 grid AI 섹션의 데스크톱 및 모바일 PNG를 직접 확인한 Codex 평가. 6개 항목 점수, 단일 채택 추천과 필수 수정 조건을 기록하며 제품 코드에는 적용하지 않았다. |
| `ux-audit/card2/mock-codex.html`, `ux-audit/card2/NOTE-codex.md`, `ux-audit/card2/mock-codex-d1440.png`, `ux-audit/card2/mock-codex-m390.png`, `ux-audit/card2/mock-codex-tip.png` | 장부형 2카드 Codex 경쟁 시안과 8줄 노트, 1440×900 기본·용어 설명 렌더 및 390×844 뷰포트에서 확인한 390×1052 전체 모바일 렌더. 포트 8823의 한국어 독립 HTML로 Google Fonts와 기존 아바타·거래소 자산을 사용한다. 용어 호버·탭·키보드·ARIA 연결을 CDP로 검증했으며 AGY 외부 검토는 인증·접근 오류로 미완료다. 본문 앱에는 적용하지 않았다. |
| `ux-audit/card2/CRIT-codex.md` | claude와 stat의 기본, 모바일, 용어 설명 PNG 6장을 직접 확인한 Codex 평가. 6개 항목 점수와 단일 채택 추천을 담고 닫힘 처리는 HTML로 확인했다. 제품 코드에는 적용하지 않았다. |
| `policies/crs.html`, `policies/teth-crs.pdf` | TETH AI Customer Relationship Summary(영어). HTML 이 원본이고 PDF 는 헤드리스 Chrome Page.printToPDF 로 생성한다(2페이지, table 레이아웃). 푸터 상단 바의 고객 관계 요약 링크가 이 PDF 를 연다. 요금(Direct, Partner), 파트너 거래소 제휴 유인, AI 모델 비용 유인, AI 에이전트 한계를 Form CRS 구조로 적었다. |
| `ux-audit/footer2/` | 푸터 상단 바 시안 경쟁 기록. BRIEF, icons.js(SNS 글리프), mock-rail, mock-band, mock-codex 와 PNG, NOTE, CRIT-lead, CRIT-codex, DECISION(rail 채택), final-*.png 실제 반영 스크린샷. |
| `site-footer.js` | 사이트 푸터의 단일 출처. `TETH_FOOTER.html({spa:true})`는 SPA용(onclick 액션), `mount(el,{base:'../'})`는 about, policies, download 독립 페이지용이며 CSS는 `#teth-footer-css`로 주입한다. 상단 바(고객 관계 요약 PDF 링크, 팔로우하세요 + X, Instagram, YouTube, Telegram 단색 글리프, 링크는 site-config.js 의 social, 아래 hairline), 링크 4칼럼(제품, 회사, 도움, 약관), 오른쪽 형식체 문단, Powered by Bitget, SVG 거대 워드마크로 구성된다. 글자는 전부 흰색 500(제목 700) 16px 로 통일. 배경은 검정이 기본이고 메인 홈(채팅 랜딩)만 .gft-lime 라임(gftPlace 가 모드별 토글). 상단 바 치수는 ux-audit/footer2/MEASURE-rh.md 의 로빈후드 실측값. 모바일(컨테이너 600px 이하)은 로빈후드 모바일 순서: 요약 링크, 구분선(.gft-rule), 메뉴 한 칼럼씩 세로, 팔로우하세요, 문단, Powered by, 워드마크. index.html의 `gftPlace()`가 PC 푸터 페이지에서 body.gft-doc 문서 스크롤로 전환해 사이드바 아래 전체 폭에 배치한다. |
| `index.html` 의 `MK_CAT`, `MK_PX_CFG`, `mkPx`, `assets/avatars/t01~t20.svg`, `ux-audit/strat20/` | 전략 찾기 목록의 20종 카탈로그(시드 데이터). 이름, 한줄소개, 거래소, 규칙값은 `MK_CAT` 에서만 관리하고 성과는 적어 넣지 않는다(자산별 가격 `mkPx` 에 엔진을 돌린 결과). 200칸은 20종을 정렬한 뒤 10페이지로 반복. `runBacktest` 는 `params.px` 로 자산 가격을 고른다. 결정 기록과 재생성 도구는 `ux-audit/strat20/DECISION.md`, `tools/`. |
| `help-widget.js` | 모든 페이지에서 재사용하는 다국어 고객지원 플로팅 버튼. Zendesk 키가 없으면 준비 안내를 표시한다. |
| `ux-audit/footer/mock-codex.html`, `ux-audit/footer/NOTE-codex.md`, `ux-audit/footer/mock-codex-lime-d1440.png`, `ux-audit/footer/mock-codex-dark-d1440.png`, `ux-audit/footer/mock-codex-lime-m390.png`, `ux-audit/footer/mock-codex-dark-m390.png` | Codex 푸터 경쟁 시안, 8줄 노트와 라임 및 다크 4장 렌더. 포트 8833의 한국어 독립 HTML로 `?bg=lime` 또는 `?bg=dark`를 사용한다. 외부 폰트 및 라이브러리 없이 SVG textLength로 워드마크 폭을 맞추며 데스크톱 1440×900, 모바일 390×987 전체 렌더를 확인했다. 본문 앱에는 적용하지 않았다. 실제 페이지 링크 4개 외 메뉴는 안내 데모이며 제공된 운영 문구의 사실 검증과 AGY 외부 검토는 미완료다. |
| `ux-audit/footer/CRIT-codex.md` | claude와 bleed 푸터의 PNG 8장을 직접 확인한 Codex 평가. 7개 항목 점수, 배경 판정, 단일 채택 추천과 필수 수정 2개를 기록한다. 구현 현실성은 HTML 소스 검토이며 사이드바 폭 변화의 브라우저 검증과 제품 적용은 하지 않았다. |
| `theme.js` | 다크 테마만 강제하고 `tethTheme` 값을 저장한다. 현재 테마 선택 기능은 없다. |
| `about/index.html` | 제품 소개, 기능 설명, 요금제, 신뢰·위험 안내, FAQ, 최종 CTA를 제공한다. 요금제는 `site-config.js`에서 렌더링한다. |
| `download/index.html` | 앱 소개 캐러셀, 스토어 선택 링크와 QR 코드를 제공한다. QR 이미지는 외부 QR 생성 서비스에서 가져온다. |
| `policies/index.html` | 해시 라우팅으로 개요, 개인정보처리방침, 서비스 약관, 기술·안전 설명, FAQ를 보여 준다. 법률·정책 문구 변경 시 시행일과 실제 서비스 상태를 별도로 검증해야 한다. |
| `assets/` | 로고, 소형 로고, 파비콘 PNG 원본을 보관한다. |
| `.nojekyll` | GitHub Pages에서 Jekyll 처리를 비활성화한다. |
| `.mailbox/mail.ps1` | claude·codex·agy 세션 간 우체통 구현. UTF-8 BOM으로 저장해야 한다. |
| `.mailbox/mail.cmd` | 위 스크립트의 실행 래퍼. PowerShell 실행 정책에 막히지 않도록 `-ExecutionPolicy Bypass`로 호출한다. |
| `.mailbox/inbox/`, `.mailbox/archive/` | 주고받은 메시지 파일. Git에서 제외되며 제품 소스가 아니다. |
| `.gitignore` | 로컬 전용 `.claude/` 설정과 우체통 메시지를 제외한다. |
| `.claude/launch.json` | Git에서 제외된 로컬 실행 설정이다. `http-server`를 8788 포트에서 실행한다. 제품 소스나 공유 문서로 간주하지 않는다. |

새 파일이나 디렉터리를 추가하거나 역할을 바꾸면 위 표를 즉시 수정한다. 삭제된 경로는 표에서도 제거한다.

## 런타임과 외부 의존성

- 패키지 매니저, 번들러, 프레임워크, 설치 단계가 없다.
- HTML 파일을 `file://`로 직접 열지 말고 저장소 루트에서 HTTP 서버로 제공한다.
- 로컬 실행: `rtk npx -y http-server -p 8788 -c-1 .`
- 기본 확인 주소: `http://localhost:8788/`
- Google Fonts를 네트워크에서 불러온다.
- 다운로드 QR 코드는 `api.qrserver.com`에 스토어 URL을 전달해 생성한다.
- `site-config.js`에 `zendeskKey`가 설정된 경우에만 Zendesk 스니펫을 동적으로 불러온다.
- 언어와 통화 등 일부 UI 선택은 `localStorage`에 저장한다. 영구 서버 상태로 문서화하지 않는다.

외부 URL, 스토어 ID, 가격, 지원 이메일, 정책 시행일은 변경되기 쉬운 운영 값이다. 관련 작업에서는 코드 전체를 검색해 중복 값과 오래된 문구가 없는지 확인한다. 비밀 값이나 실제 거래소 키를 저장소에 넣지 않는다.

## 구현 규칙

- 명시적인 리팩터링 요청이 없다면 기존의 정적 파일 구조와 바닐라 JavaScript 방식을 유지한다.
- `index.html`의 DOM ID, 전역 상태, 전역 함수는 서로 강하게 연결되어 있다. 이름이나 화면 구조를 바꾸기 전에 정의와 모든 호출부를 검색한다.
- 공용 가격, 스토어 URL, Zendesk 설정은 페이지에 복제하지 않고 `site-config.js`에서 관리한다.
- 사용자에게 보이는 문구를 추가하거나 바꾸면 지원하는 7개 언어의 번역 키와 `document.documentElement.lang` 적용을 함께 확인한다. 고객지원 문구는 `help-widget.js`에도 별도 번역 배열이 있다.
- 다크 단일 테마가 현재 제품 규칙이다. 라이트 테마나 테마 토글을 잔존 코드만 보고 복원하지 않는다.
- 상대 경로는 페이지 깊이에 따라 달라진다. 루트는 `./`, 하위 페이지는 `../` 기준 링크와 자산 경로를 각각 검증한다.
- 새 창 링크에는 `rel="noopener noreferrer"`를 유지한다.
- 모바일 레이아웃, 키보드 포커스, ARIA 레이블, `prefers-reduced-motion` 처리를 기능 변경과 함께 보존한다.
- 금융 수치와 자동매매 결과는 데모임을 명확히 유지하고, 투자 수익을 보장하는 표현을 추가하지 않는다.
- 정책·개인정보·보안 문구는 일반 UI 카피처럼 임의 수정하지 않는다. 요청된 변경의 근거와 실제 구현을 확인하고 시행일이 있으면 함께 갱신한다.

## 문서 최신화 및 레거시 제거 절차

문서 작업은 다음 순서로 수행한다.

1. `rtk rg --files`와 `rtk git status --short`로 현재 구조와 사용자 변경분을 확인한다.
2. 구현과 문서를 함께 검색해 현재 동작, 설정, 명칭, 링크를 교차 검증한다.
3. 변경으로 영향을 받는 설명을 같은 작업 안에서 갱신한다. 최소한 이 파일의 프로젝트 개요, 파일 표, 실행 방법, 외부 의존성, 검증 절차를 확인한다.
4. 동일한 내용을 설명하는 문서가 여러 개면 하나의 현재 문서로 통합하고 나머지는 삭제한다. `old`, `legacy`, `backup`, 날짜 접미사를 붙인 문서 사본을 저장소 안에 만들지 않는다.
5. 삭제한 문서를 가리키는 링크, 목차, 스크립트, 에이전트 지침도 함께 제거하거나 새 기준 문서로 연결한다.
6. 문서의 명령, 경로, URL을 실제로 확인하고 `rtk git diff --check`로 형식 오류를 검사한다.

레거시 여부는 단순히 오래되었다는 이유가 아니라 현재 구현과 목적에 더 이상 대응하지 않는지로 판단한다. 법률상 보존해야 하는 정책 이력, 사용자가 명시적으로 보관을 요청한 기록, 아직 참조되는 마이그레이션 자료는 임의 삭제하지 않는다. 보존이 필요한 경우 현재 문서와 명확히 구분하고 보존 이유를 적는다.

새 문서를 만들기 전에 기존 문서에 통합할 수 있는지 먼저 판단한다. `README.md`가 추후 추가되면 사용자용 설치·사용 안내에 집중하고, 에이전트 작업 규칙과 구조 설명은 이 파일을 기준으로 하여 중복을 최소화한다.

## 검증 기준

공용 린터·빌드 검증은 없다. 병합 UX 회귀 검증은 정적 서버 8781과 Chrome CDP 9333을 준비한 뒤 `rtk proxy node ux/review/CODEX_VERIFY.mjs all`로 실행한다. 드라이버 경로는 `CDP_DRIVER`, 증거 저장 경로는 `CODEX_QA_OUT` 환경 변수로 바꿀 수 있다. 자세한 실행 및 범위는 `ux/review/CODEX_FIX_REPORT.md`를 따른다. 변경 범위에 맞게 다음도 확인한다.

- `rtk git diff --check`
- 로컬 HTTP 서버에서 `/`, `/about/`, `/download/`, `/policies/`가 오류 없이 열리는지 확인
- 정책 페이지의 `#overview`, `#privacy`, `#terms`, `#technologies`, `#faq` 라우팅과 목차 이동 확인
- 데스크톱과 약 390px 모바일 폭에서 레이아웃, 메뉴, 모달, 고객지원 버튼 겹침 확인
- 브라우저 콘솔의 JavaScript 오류와 깨진 자산·링크 확인
- 앱의 전략 생성 → 리서치/백테스트 → 보고서 → 연결/실행 흐름 확인
- 로그인/가입, 언어, 통화, 피드백, 프로필 및 세션 메뉴의 주요 상호작용 확인
- 소개 페이지 요금제가 `site-config.js`와 일치하는지, 다운로드 페이지의 두 스토어 링크와 QR이 같은 URL을 쓰는지 확인

네트워크 의존 서비스가 없어 확인하지 못한 항목은 성공으로 간주하지 말고 최종 보고에 미검증 사유를 적는다.

## 완료 조건

병합 UX의 현재 상태 규칙: 미활성 뷰는 `tfDerive().primaryCTA`의 활성화 액션을 우선하며 API와 카드 모두 없는 경우에만 활성화 선택 카드를 보인다. 연결 완료는 로컬 저장을 즉시 확정한다. 마켓의 기본 검증 기간은 전체다. 터미널의 시세는 USDT, 규칙 전략 예산·손익은 원화다. 따라가기 계정은 `cpCalc`의 USDT 원장을 별도 행으로 표시하고, 긴급 정지는 규칙 전략 중지와 따라가기 계정 정산을 모두 처리한다. preview의 6개 예시는 소유 전략 수에 포함하지 않는다.

작업은 코드만 동작한다고 끝난 것이 아니다. 구현, 사용자 문구, 공용 설정, 정책 문구, 링크, 이 기준 문서가 서로 일치하고, 대체된 레거시 문서와 그 참조가 제거되며, 수행한 검증과 수행하지 못한 검증이 최종 보고에 명확히 기록되어야 완료다.

여기에 더해 자신의 인박스에 처리하지 않은 메시지가 없어야 하고, 선점한 `claim`은 `release`로 해제되어 있어야 하며, 다른 세션이 이어받아야 할 미검증 항목은 `handoff`로 전달되어 있어야 한다.
