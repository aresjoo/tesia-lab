# TETH Web

## 이 브랜치의 전달 범위

`aresjoo/tesia-lab`의 `feat/teth-react-ui-integration`은 사용자 승인으로 공개하는
React 프론트 전체 작업 스냅샷이다. 원본 `main@acccc7f802ac34333d666431b994717a0507e6c3`에서
분기했으며, Web 작업 브랜치 `feat/web/ui-service-integration@5c79fa7ea00cbad953ddfe03d43c8ce719db03f9`의
커밋 내용과 2026-09-09 전달 시점의 미커밋 변경을 함께 포함한다. 비공개 저장소의 과거 Git 이력은 이식하지 않는다.

- 포함: React UI·자산·전문 차트·내부 서비스 연결 소비 코드·생성 SDK·테스트·디자인 문서·버그 보고서.
- 제외: 실제 credential·환경 설정·DB·의존성 설치 폴더·빌드/테스트 산출물·백엔드 구현.
- 기존 정적 사이트와 서버 파일은 이 브랜치에서 React 프로젝트로 교체하며 원본 `main`과 Git 이력에서 복구할 수 있다.
- 기본 브랜치 병합, GitHub Pages 설정 변경, 운영 배포는 수행하지 않는다. 실행 환경은 Node.js 22.12 이상을 사용한다.
- 실행: `npm ci` → `npm run dev -- --host 127.0.0.1`. 빌드: `npm run build`.
- 내부 연결 코드를 포함하는 것과 실제 서버·인증·730일 데이터가 연결되어 실행되는 것은 별개다.
  전문 차트 준비 화면은 개발 서버의 `/?chart-workspace-preview=1`에서 확인한다.
- 전달 사본 검증: `npm ci`, lint, build, `git diff --check` 통과. 데스크톱/모바일 차트·대화·연구·공개/내부 빌드 경계 74개 테스트 통과(47.2초).
  원본 225개 파일의 바이트 일치를 확인했고 README에 전달 안내를 추가했다. 대상 저장소의 `CLAUDE.md`도 보존한다.
- Gitleaks 검사 11개 탐지는 검증용 SHA-256 4개, operation 비교 식 1개, 테스트 idempotency 값 6개로 확인했다. 실제 비밀정보는 발견되지 않았다.

아래 내용과 `Bugfix_report.md`는 원본 작업 기록이다. 기록에 등장하는 로컬 경로·포트·비공개 이슈는
이 공개 저장소에서 제공하는 서버나 접근 권한을 의미하지 않는다. 계약/백엔드의 후속 릴리스는 자동 반영되지 않는다.

## UI·UX 디자인 통합 브랜치

현재 로컬 작업은 `feat/web/ui-service-integration`이며 최신 Web main
`c156d10746f35a757c4280b8063b82acacf2dd0a` 위에 원본 UI 작업을 선택 이식한다.
디자인 출처는 `aresjoo/tesia-lab@acccc7f802ac34333d666431b994717a0507e6c3`,
기존 작업본은 `agent/web/teth-mock-ui-promotion-20260827@53badf6`의 미커밋 변경이다.
기존 작업본·미커밋 코드는 보존한다. 사용자 승인으로 구 UI 4174 서버만 정상 종료했다.
공개 UI preview4176은 유지한다. 내부 백엔드8789는 최근 확인 시 listener가 없어 담당 Backend의 상태 확인이 필요하다. 이번 FE 작업에서 해당 서버를 중지·재시작하지 않았으며 테스트 서버는 실행 후 자동 종료한다.

- 1단계: 디자인 진입/대화/설정/연구/정보 페이지 보존과 최신 기술 코드의 공존 검증.
- 기본 진입: `src/client-entry.ts` → `client-bootstrap.tsx` → `SiteRouter/ClientMainExperience`.
  최신 `main.tsx`, 전문 `SignalCanvas.tsx`, `backtest-data.ts`, `reporting/`, generated 계약은 보존한다.
  2단계에서는 `internal-poc/`의 기존 controller에 원본 UI presentation을 추가하고 오류 복구를 교정한다.
- 기존 퍼널은 DEV `?legacy-fixture=1`, 기존 계약 Mock journey는 `/#/mock-strategy-flow` 직접 진입으로 회귀한다.
  후자는 제품 대화에서 이동하는 링크가 아니며 실제 결과 화면 연결도 아니다.
- 자동 검증은 별도 4175 포트에서 실행한다. `TETH_E2E_PORT`로 변경할 수 있다.
- 이후 연결 순서는 대화/세션 → 실제 연구 근거 → 결과/전문 차트다.
  해당 단계마다 계약 버전·출처·오류/재시도·세션 보존을 확인하며 Mock을 actual로 바꾸지 않는다.
- 공개 UI의 상세 차트 배치는 로컬에서 먼저 확인할 수 있다: 같은 대화에서 연구를 시작한 뒤
  완료된 `Backtest v1/v2` 또는 `Final Report` → `차트로 자세히 보기`.
  첫 결과 재생/Skip 이후 차트·거래 목록·기존 문서 대화가 이어지고 복귀 시 초안과 위치를 유지한다.
  현재는 원본 fixture의 가격 표본/거래 기록을 공유한다. 실제 OHLC·거래량·730일 결과 연결이나
  보존된 전문 작업본 전체 이식 완료가 아니다. `DESIGN.md` §9와 버그 보고서의 상세 차트 통합 절 참고.
  로컬 검수는 전체804개 중770 PASS/34 SKIP, 마지막 오류 경계 보강 후 영향56 PASS 및 build/lint PASS다.
- PM 기준은 `tesia-program@504a373d348a8163b11425a29ec3c3bf98a3861a`의
  `PM/README.md`, 정본 §16, FE issue #25다. PM 문서는 읽기 전용이며
  최초 2단계 코드 소비 commit은 `ca79e1bcbf2ebbcd80db706a4c444debe39ec361`이다.
  이후 오류 상태·편집 잠금 보강은 같은 통합 branch의 후속 commit과 `Bugfix_report.md`에 누적한다. 원격 인계는
  Web #25에서 관리한다. PM은 `5c79fa7`까지 수신했으며 이후 로컬 차트·SDK 소비 변경은 아직 별도 인계 전이다. 공용 계약/제품 결정 변경은 없다.
- 파일 범위와 검증 결과는 [Bugfix_report.md](Bugfix_report.md#integration-baseline)에 갱신한다.
  내부 세션/대화 연결과 공개 배포·전체 서비스 완료는 구분한다.
- 1단계 최종 검증: build/lint PASS, 전체 736개 중 710 PASS/26 SKIP/실패0.
  로컬 미리보기는 `http://127.0.0.1:4176/`. 사용자 화면 검수 및 운영 승격은 별도다.
- 2단계 최종 검증: UI/계약760개 중726 PASS/34 SKIP/실패0와 별도 실제 HTTP8 PASS.
  34 SKIP은 프로젝트 전용26+단독 실행한 실제8개다. 실제 단독3회24 PASS도 별도 기록한다.
  변경123경로와 Bugfix_report를 이 UI 통합 브랜치에서 함께 관리하며 main 병합/운영 배포는 하지 않는다.

### 원본 UI의 내부 서비스 연결

전문 차트 후속: `ClientProfessionalPriceChart`는 현재 디자인 토큰을 쓰는 **독립 준비물**이며 제품에 아직 연결되지 않았다. 검증 원천 reader는 존재하지만 발행된 실제 OHLC/LOD·체결 시각 API가 없어 PM/Contracts/Backend에 [계약·writer 예약을 요청](https://github.com/beak1011/tesia-web/issues/25#issuecomment-5596039535)했다. auth sessionId가 아닌 owner-scoped 대화→승인 전략→job 연결과 동일 source/result 결속이 필요하다. 공개 tfw-chart 교체·실제730일 결과·운영 승격 완료가 아니다. 현행 화면/카피는 그대로 보존한다.

준비 렌더러와 작업 공간의 로컬 검증은 `npx playwright test tests/price-chart.spec.ts tests/client-backtest-workspace.spec.ts tests/client-backtest-hardening.spec.ts tests/research-resize.spec.ts tests/client-research-analysis.spec.ts --workers=4`로 실행한다. 합성 입력은 `src/dev/chart-workspace-fixture.ts` 한 곳을 테스트/DEV 미리보기에서만 공유하며 제품 bundle에 포함하지 않는다. 캔들/거래량/EMA·초 단위 체결·60초 local replay/Skip·오류/모바일/5000봉10000체결 경계의 [검증 증거와 한계](Bugfix_report.md#professional-renderer-preparation)를 기록했다. PM 확인 기준은 `e75bd73846c305478202fe5510701569a8ce1c03`이다. Ledger에 차트 API v0.5 exact27 source 후보의 writer가 예약됐으나 미발행이고 Backend producer/실제 FE handoff는 없다. 미발행 SDK를 복사하거나 기존 pin을 변경하지 않았다.

로컬 작업 공간 미리보기: `npm run dev -- --host 127.0.0.1 --port 4175 --strictPort` 실행 후 `http://127.0.0.1:4175/?chart-workspace-preview=1`. 미리보기 상단에 합성 입력/API 미연결을 표시한다. 전체 창 재생 → Skip/완료 → 같은 차트·체결 기록·대화 배치를 확인할 수 있다. 질문은 로컬 React 상태에만 표시하며 AI/서버에 전송하지 않는다. 닫기/재열기의 초안 보존도 확인한다. production build에서는 이 진입점과 합성 fixture가 제거된다. 기존4176/8789 서버와 dist는 변경하지 않는다.

작업 공간은 체결 원장을50행 페이지로 제한하고 처음/이전/다음/마지막 탐색을 제공한다. 실제 대화 DOM 변경을 따라가되 이전 기록을 읽는 중에는 위치를 유지하고 새 메시지 버튼을 표시한다. `onAsk`는 실제 소유자의 `Promise<void>`를 받을 수 있다. 대기 중 중복 전송을 막고 실패하면 초안을 유지한다. 소유자는 성공 확인 후 정확한 전송 초안만 지우고, 화면 밖 작업·상태·서버 idempotency·권한을 관리해야 한다. 이 로컬 UI guard는 서버 중복 방지나 실제 AI 연결의 대체물이 아니다.

PM 후속 [인계5598068038](https://github.com/beak1011/tesia-web/issues/25#issuecomment-5598068038): API v0.5 source 후보는 구현·시험됐으나 aggregate/SDK0.16rc1 빌드·설치 검수 중이며 소비 pin이 아니다. exact 패키지 hash와 producer 경계 수신 전 기존 SDK/Backend pin을 유지한다. 현재 로그인 경로의 백테스트는 STRUCTURAL_SMOKE 합성 입력이며 사용자별 actual 과거 데이터 producer는 별도 구현 필요.8789 부재만으로 GCP 서비스 장애를 판정하지 않고 상시 FE 검수용 runtime의 정확 profile/실행 경계를 담당자와 먼저 맞춘다. 사용자 추가 설정 요청은 없다.

2026-09-09 후속: Contracts #28 `c37e5f822f87de725740111f9bee8bab8d72dba8`의
API v0.1 SDK `0.8.0-rc.2`를 exact manifest SHA
`391e9a907baa5d483c403b9d66d1bbb7ee6f021c7202c41c352ffa5aba56ac5a`로 소비한다.
미완성 초안은 서버 소유권 GET 후 새로고침 복구하고, 신규 세션은 이전 저장 상태를 초기화한다.
GET은 원래 AI 답변 복원·READY 판정·실행 승인을 대신하지 않는다.
별도 빌드의 `TETH_CLIENT_SERVICE_ASSETS`를 사용하는 시험은 테스트 브라우저에서만
새 정적 자산을 읽고 실제8789 API를 그대로 호출한다. 실행 중인 서버의 dist/DB/pin을
바꾸는 배포 시험이 아니다. 내부 빌드는 반드시 임시 `--outDir`를 지정해 live dist를 보존한다.
검증과 남은 연결 범위는 [버그 보고서](Bugfix_report.md#sdk-draft-recovery)를 따른다.

승인된 #104 release 후보 시험(명시 경로 필요,8790은 시험 후 종료):

```bash
TETH_OWNER_LOCAL_SERVICE_URL=http://127.0.0.1:8790 npm run build:internal-poc -- --outDir /tmp/teth-replay-web-candidate
TETH_REVIEWED_SERVICE_RELEASE=/path/to/approved/release TETH_CANDIDATE_WEB_DIST=/tmp/teth-replay-web-candidate node tests/internal-poc/run-service-candidate.mjs
```

기존 서버가 사용하는 디렉터리는 outDir로 지정하지 않는다. release의 고정 wheel/설치 payload가
다르면 실행을 거절한다. 독립 SQLite 시험이며 live PG 업그레이드가 아니다.
[replay·결과 복구 증거](Bugfix_report.md#replay-result-recovery)를 별도 관리한다.

2026-09-09 원격 재확인: Web main `c156d10` 대비 통합 branch의 behind0,
미포함 Web 원격 branch0/열린 PR0이며 클라이언트 원본 HEAD도 `acccc7f`로 동일하다.
이는 GitHub에 공유된 Web 변경 기준이다. 미공유 로컬 실험과 사용자 제외 후보를 전부 병합했다는 뜻이 아니다.
Backend #105/Infra #61 main을 확인했으며 유지 실행기는 Backend #99/AI #28이다.
승인된 #104 설치물은 별도 SQLite8790에서 실제 replay 연결 시험을 통과하고 정상 종료했다.
완료 결과 조회 오류는 초안·job을 유지하면서 수동 재조회하며 무결성 실패에서는 수치를 표시하지 않는다.
이는 live PG 업그레이드나 실제730일 결과 연결이 아니다.
최종 연결에는 Google v0.2 조립·실행 v0.1/v0.3 계약 결합, 외부 모델,
실제 730일 source-bound projection과 Web 소비, 운영 안정성 검증이 남아 있다.

`/internal-poc.html#/client`는 기존 v0.1 generated SDK/controller를 원본
ClientConversation·ClientResearchActivity·로고·언어 패널로 표시하는 내부 전용 진입이다.
공개 `/#/client`에서는 활성화되지 않는다. 기존 내부 화면도 기본 진입으로 유지한다.

```bash
TETH_OWNER_LOCAL_SERVICE_URL=http://127.0.0.1:8789 npm run build:internal-poc -- --outDir /tmp/teth-reviewed-web-candidate
```

이 값은 명시적인 loopback origin attestation이며 fetch 목적지가 아니다. 기본값은 비활성이다.
Vite dev에 자동 주입하지 않는다. 빌드 후 승인된 owner-local service launcher가 같은 origin에서
HTML과 API를 제공해야 한다. 상세 실행/설치 pin은 Infra의 `runbooks/OWNER_LOCAL_SERVICE_STACK.md`를 따른다.
`dist-internal-poc`은 실행 중에 덮어쓰지 않는다. launcher가 HTML/자산 및 입력 해시를 결속하므로
변경된 빌드는 정상 종료 후 별도 새 owner root에서 검증한다. 이전 root의 marker를 수정하지 않는다.

- 실제 소비 조합: Backend #99 / AI #28 `research-summary-offline`, 실제 PG/API/worker.
- 익명 대화·조건 확인·Validator·승인 차단·확정 로그아웃을 연결한다.
- 현재 compiler는 offline이다. 실제 외부 AI/Google 로그인/새 요약 wire/730일 결과/전문 차트 연결 완료가 아니다.
- 응답 유실은 같은 요청 identity로 명시 재시도한다. #99 HTTP의 stale If-Match 412에서는
  새 키로 다시 보내지 않고 SDK GET으로 최신 초안만 확인한다. 원래 응답/반영 여부는 복원했다고 표시하지 않는다.
- GET은 candidateState를 주지 않으므로 새 명시적 대화 응답 전까지 검증 후보로 승격하지 않는다.
  미완성 초안 GET은 rc2 SDK 검증을 통과한 서버 응답만 복구하고 새 READY 권위를 만들지 않는다.
- 앱 화면 이탈은 서버 작업 취소가 아니다. 요청 중 정지 버튼을 제공하지 않으며 요청 대기는 120초 상한이다.
- 새로고침 후 서비스 대화 기록/세션 자동 이관, 내부 정보·다운로드·전체 설정 메뉴는 아직 미완료다.
  공개 원본 UI의 해당 화면은 보존하며 이 내부 화면에서 Mock 로그인·연구 기록을 actual로 표시하지 않는다.
- 로컬 복구 정보 저장 실패는 서버 대화 실패가 아니다. 현재 응답은 표시하고 재진입 한계를 안내한다.
  승인 단계는 같은 재시도 키를 저장하지 못하면 다음 서버 변경 전에 중지하며 명시 재개만 허용한다.
- 단일 개발 서버의6 worker 동시 접속에서 세션 초기화/응답 지연이 재현됐다. 단독 기능 검증은
  다중 사용자/운영 안정성 합격이 아니다. 원인과 보강은 PM/Backend/Infra 확인이 필요하다.

실제 HTTP 시험은 별도 준비된 서버에만 opt-in한다(쿠키/CSRF trace·video 비활성):

```bash
TETH_CLIENT_SERVICE_URL=http://127.0.0.1:8789/internal-poc.html#/client npx playwright test tests/internal-poc/client-service.spec.ts --grep '승인된 owner-local' --workers=1
```

TETH AI의 React/Vite 웹 애플리케이션이다. 현재 `https://tesiaai.r-e.kr`에 보이는 Mock 프로토타입이며, 실제 backend·OAuth·백테스트·Binance Demo에는 연결되어 있지 않다.

## 현재 운영 상태

- 상태: `PUBLIC_MOCK_UI_ONLY`
- 명시적 사용자 승인과 lint/build/E2E·공개 smoke·롤백 증거를 갖춘 정적 UI·카피 릴리스만 승격한다.
- 현재 운영 release는 `/srv/tesiaai/releases/20260827T142812Z`, 롤백 대상은 `/srv/tesiaai/releases/20260825T132539Z`다.
- Gate -1B 통과 전 실제 API, OAuth, 거래소 key, Binance Demo endpoint를 공개 build에 넣지 않는다.

## 로컬 검증

```bash
npm ci
npm run lint
npm run build
npm run test:reporting
npm run test:e2e
```

API 연동은 `tesia-contracts`에서 생성된 정확한 버전의 client를 사용하며, 아래 named browser bootstrap POST transport만 PO가 승인한 좁은 예외다.

## 브라우저 세션 연결 consumer — 명시 opt-in

`/internal-poc.html`은 `<meta name="tesia-owner-local-service-url">`가 현재 페이지와 정확히 같은 `http://127.0.0.1[:port]/`일 때만 `ensureBrowserSession` capability를 만든다. 이 값은 fetch base URL이 아니며 모든 API transport는 여전히 `window.location.origin`의 `/api/v1/`만 사용한다. `localhost`, IPv6, credential·path·query·hash가 든 URL, 다른 origin, meta 없음·빈값은 bootstrap에 대해 fail-closed다. 기본 정적 HTML은 이 meta를 활성화하지 않는다. 기본 내부 entry는 기존 authenticated local-autoauth 소비를 위한 me/csrf 조회를 유지하며, fixture와 공개 Mock·reporting 화면의 실제 session/me/csrf/logout network는0이다.

명시 owner-local 모드에서는 같은 adapter instance로 bounded browser bootstrap을 먼저 완료한 뒤 `me`/`csrf`를 읽는다. `ANONYMOUS`는 전략 대화와 계약 검증까지만 사용할 수 있고 authenticated 사용자로 표시하지 않는다. 승인·백테스트·Paper 실행은 계정 확인이 필요한 상태로 닫힌다. 저장된 탭 snapshot은 session/owner 권위가 아니므로 bootstraped service session에서 복원하지 않는다. 401 또는 bootstrap 실패의 새 factory는 사용자가 `세션 다시 확인`을 누를 때만 만들며, stale 비동기 결과는 session generation으로 버린다.

로그아웃은 generated SDK의 current session strong ETag와 memory-only CSRF·idempotency key를 사용한다. 서버가 `REVOKED` SessionEnvelope를 반환한 경우에만 화면의 draft/workflow/job/result를 clear한다. 실패(401/403/409/412/428/network/timeout/형식 오류)는 로그아웃 성공이나 cookie 삭제로 표시하지 않는다. HttpOnly cookie/CSRF 값은 JS storage·DOM·로그에 기록하지 않고, cookie 삭제 지시도 화면에서 읽거나 검증했다고 주장하지 않는다.

이번 UI 통합 브랜치에서는 승인된 Backend #99/AI #28 wheel과 실제 PG/API/worker가 같은 loopback origin에서 제공하는 원본 UI로 익명 conversation→validation→account-required 승인 차단→성공 logout을 데스크톱/모바일에서 검증했다. 승인 차단은 백테스트 실행 성공이 아니다. 응답 유실 뒤 HTTP412/부분 초안 GET 계약 불일치도 실제 HTTP 시험으로 확인했으며 자세한 한계와 증거는 Bugfix_report의 2단계를 따른다. 외부 로그인·실제 공급자·730일 결과 연결 및 실제 서비스의 모든 logout failure 경로는 완료로 주장하지 않는다.

Contracts [browser bootstrap 정책](https://github.com/beak1011/tesia-contracts/blob/ba11ef0a3b7d01a6c01706f9b80e8b748d0fb829/docs/browser-session-bootstrap-consumption.md)의 BRS-01~10을 소비한다. 기존 generated snapshot과 서버용 create의 Set-Cookie 검사는 바꾸지 않는다. named consumer의 고정 same-origin POST만 PO 예외로 raw fetch를 사용하고, 먼저 SDK GET으로 기존 세션을 확인한다. 정확한401에서만 body 없는 POST fetch1회 후 별도 SDK GET200을 전체 검증하여 data/strong ETag/revision/24h를 대조한다. `BOOTSTRAP_CONFIRMED`도 cookie 속성 검증이 아니며 `cookieAttributesVerifiedInBrowser=false`다.

전체15초·각 fetch의 header/body 합산5초·JSON65,536-byte 상한을 최초/확인 GET에도 적용한다. 동시 호출만 공유하고 이후 호출은 실제 GET으로 재확인한다. factory당 앱의 POST fetch 호출은1회이며 실패·유실 후 앱 자동 재시도는0회다. 새 factory는 향후 명시적 사용자 재시도에만 연결해야 하며 render/reload 반복 생성으로 재시도하지 않는다. 고정 `BROWSER_SESSION_UNCONFIRMED` 오류는 연결 미확인이며 서버 생성 실패·rollback·기존 세션 복구를 뜻하지 않는다. cookie/CSRF·응답은 storage나 로그에 기록하지 않는다.

앱 호출1회는 wire exactly-once 보장이 아니다. Chromium151 실제 HTTP 시험에서 header 전 연결 종료 시 앱 fetch1회에 서버 POST2회가 관측됐다. 브라우저 내부 재전송은 앱 latch가 통제하지 못하며 같은 key도 producer가 새 세션을 발급하므로 미인계 anonymous row가 추가될 수 있다. 기존 TTL로 만료하며 key 기반 bearer 복구·새 endpoint·자동 재시도로 감추지 않는다. 시험은 앱 호출 수와 wire 관측 수를 분리하고, 도착한 POST/GET의 exact 결속만 성공으로 반환한다.

소비 회귀는 `npx playwright test tests/internal-poc/browser-session-bootstrap.spec.ts`로 실행한다. 새 모의 HTTP 서버와 실제 Chromium cookie jar를 사용하고 trace/video/screenshot을 끈다. 이는 실제 Backend 배포·전체 UI 연결 증거와 구분한다.

## Owner-local Paper recorded UI fallback

`/internal-poc-fixture.html`은 전략 대화·승인·합성 백테스트 다음에 기록된 owner-local Paper 상태 형식을 보는 내부 UI fallback을 제공한다. 현재 recorded 전략은 실제 compiler-compatible RSI14 의미 해시 `39cbfd…e46`에만 결속한다. 이 경로는 `sessionStorage`에 화면의 cursor만 보존하며 서버 checkpoint나 실행 권위가 아니다. 가짜 timer로 상태를 진행하지 않고 사용자가 출처 미결속 UI 기록을 명시적으로 연다.

- 모든 상태에 `SYNTHETIC_RECORDED_MARKET_FIXTURE · UNVERIFIED · PRIVATE_ONLY`와 `실제 Paper 엔진 실행·합성 기록 시장 데이터`를 표시한다.
- 현재 UI 전략과 기록 전략의 StrategyVersion·semantic hash가 다르면 snapshot을 열지 않고 `PAPER_RECORDED_FIXTURE_STRATEGY_MISMATCH`로 닫는다.
- source-bound recorded artifact verifier가 없으므로 fallback은 terminal 결과로 승격하지 않으며 ledger·건수·hash를 표시하지 않는다.
- `exitRulesEvaluated=false`와 미평가 stop loss·take profit rule ID를 시작·진행·오류 상태에서도 항상 표시한다.
- 실제 API, network, OAuth, Secret, exchange, Demo, 주문, 공개 build·배포를 연결하지 않는다.

`/internal-poc.html`의 owner-local adapter는 별도 private API `owner-local-paper-api/0.1`와 server-owned fixture `paper_fixture_compiler_rsi14_btcusdt_15m_01`만 same-origin으로 소비한다. 이 fixture는 semantic `39cbfd…e46`, packaged asset SHA-256 `06e627…9bfd`에 고정된다. POST에는 현재 승인 흐름이 반환한 StrategyVersion과 semantic hash, 고정 fixture ID만 전달하며 호환되지 않으면 서버의 `PAPER_FIXTURE_STRATEGY_MISMATCH`를 그대로 표시한다. 요청 전 StrategyVersion·semantic·fixture·request digest와 idempotency key를 pending 상태로 저장하고, 응답 유실 뒤 exact 요청에만 같은 key를 재사용한다. 성공하거나 사용자가 명시적으로 상태를 초기화하기 전에는 pending 요청을 폐기하지 않는다. 브라우저 pointer는 session ID를 찾는 힌트일 뿐이며, 복원할 때 서버 status와 result의 session·StrategyVersion·semantic·fixture·fixture file SHA·resource revision·report/replay/ledger hash를 다시 결속한다. ledger·replay preimage·report의 canonical SHA-256도 재계산을 통과해야 terminal 값을 표시한다. 이는 Web focused mock만으로 실제 대화·승인·Paper 전체 통합을 증명한다는 뜻이 아니며, 실제 cross-repo loopback E2E 증거는 별도로 필요하다. 공용 schema와 generated client는 수정하지 않는다.

## Backtest reporting v0.6 recorded fixture

`/reporting-demo.html`은 Gate 2 결과 화면의 UI·검증 경계를 점검하는 recorded Mock이다. `FULL_760D` replay 결과가 아니며 화면의 모든 수치는 `시연 전용 · MOCK FIXTURE`로 표시한다.

- IS `[2024-08-27T00:15:00Z, 2026-04-03T00:15:00Z)`와 OOS `[2026-04-03T00:15:00Z, 2026-08-27T00:15:00Z)`를 독립 결과로 유지한다.
- OOS−IS는 비교 가능한 rate/average 지표(`return`, `winRate`, `maximumDrawdown`)에만 exact Decimal 문자열 view-only 비교값으로 표시하며 합산 Result, 합산 metrics, 합산 hash를 만들지 않는다.
- 순수익률과 MDD는 584일/146일의 서로 다른 관측 기간, 승률은 적은 거래 표본 수의 영향을 받으므로 화면에 방향 참고용 비교라고 명시하고, 개선·악화를 색상과 텍스트로 함께 표시한다.
- IS 584일과 OOS 146일은 기간 길이가 다르므로 `tradeCount`와 비용 절대 총합(`totalFeeCost`, `totalAdverseSlippageCost`, `totalFundingCashflow`)의 OOS−IS delta를 산출·표시하지 않는다.
- 비용은 result가 제공한 IS/OOS Decimal 문자열 원본을 그대로 사용하며 거래 목록에서 재합산하지 않는다.
- `maximumDrawdown`은 0 이상 loss magnitude 원본을 부호 반전 없이 표시한다. MDD OOS−IS가 양수면 악화, 음수면 개선이다.
- 현재 MMR은 검증되지 않았으므로 `currentMmrVerified=false`, `liquidationCheckStatus=UNAVAILABLE`, `unavailableReason=CURRENT_MMR_NOT_VERIFIED`만 표시한다.
- 실제 API, OAuth, credential, 거래소 endpoint와 공개 배포를 연결하지 않는다.

`tesia-contracts` v0.6가 병합되기 전까지 `src/reporting`의 타입은 web 전용 recorded fixture 경계다. `TODO(contract-pin)` 지점은 immutable generated package와 semantic verifier의 정확한 pin이 준비된 뒤에만 연결하며, verifier가 없으면 actual artifact를 fail-closed 한다.
