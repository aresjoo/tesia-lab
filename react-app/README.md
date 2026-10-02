# TETH Web

## 현재 원본 기반 마이그레이션 상태

이 문서의 코드 대조 기준은 후속 통합 `b134630836aae2566da2741bd978900c6e0004c8`다. 현재 전체 인수·검수·main 병합 판정은 PM 정본이 단독으로 소유한다. 이전 동결 `e325b2b`와 원 closure 작업본은 실패·복구 근거로 보존한다. 원본 UI는 `aresjoo/tesia-lab@9fbff821df62cad11d026022fc7628c7fcebc431`로 고정한다. 카탈로그 31개 설정·저장시장자료의 immutable 원산지 `412fd604`는 유지하며, 최신 고정 UI 원본과 같은 설정·자료인지 별도 Golden으로 대조했다. 원 WIP 1,302파일·DB·원 730일 결과·실패 artifact는 보존한다. spot/futures 원함수 15+9개 최상위 선언은 고정 `9fbff821`의 exact 원문 대조 대상이며 설정 31개는 두 source pin에서 동일함을 확인했다.

| 인수 항목 | 현재 상태 |
|---|---|
| 최초 동결 검수 | `1971e2d956657fcdab7af633b9aceae475e1871d`의 personal(1) `claude-opus-5` C0/H0 조건부 GO. 아래 후속 closure 변경을 포함하지 않음 |
| 후속 구현 | 원본 offline 연구 진입·점수 미달 차단/합격 보고서→연구, 카탈로그 복사 설정·비회원 의도 복귀, 전용 직접검증 페이지·기간/금액 재실행 및 관련 회귀 교정 |
| e325 전체 회귀·검수 | Node22 전체 13,102개: 12,486 PASS / 587 FAIL / 17 SKIP / 12 미실행, exit 1. 당시 personal(1) `claude-opus-5` C0/H3/M2/L6 NO-GO. 실패·원 SHA 보존 |
| dc85100 전체 진단 이력 | 21.9분 뒤 중단: 5,208 PASS / 2 FAIL / 2 SKIP / 13 중단 / 7,917 미실행, exit 130. 전체 성공이 아님. 당시 Opus5.5 C0/H0/M2/L3 코드 조건부 GO는 전체/main GO가 아님 |
| 전체 인수 Gate | 원본 동선·새 동결 전체 회귀·독립 검수 결속 후 ROOT가 판정. 현재 상태는 [활성 PM Ledger](https://github.com/beak1011/tesia-program/blob/main/WORK_LEDGER.md)와 [PM 정본](https://github.com/beak1011/tesia-program/blob/main/PM/README.md)만 따르며 이전 조건부 GO·별도 범위 PASS를 승계/합산하지 않음 |
| 실제 공급·운영 | 공개 기본값 Mock. 외부 공급자·실주문/과금/사용량 producer·공개 서비스 Gate 미완료, 운영 변경 0 |

고정9fb의 회원 사이드바는 새 전략 아래 `연구 기록 → AI 트레이딩 → 전략 복사 → 거래소 연결` 4개이고 비회원은 `AI 트레이딩 → 전략 복사` 2개다. 인사이트는 사이드바에서 제거하고 기존 설정 메뉴 진입을 유지한다. `5b608826`의 sidebar 전용 7언어 라벨은 본문 제목·archive 소비자 라벨과 분리한다. 새 전략의 guest disabled·원 초안/기록·typed service 미공급 경계는 그대로다.

공개 진입은 `client-entry.ts` → `client-bootstrap.tsx` → `SiteRouter/ClientMainExperience`다. 구 퍼널·구 Mock journey 전용 10파일/5,826줄을 제거했고 과거 query/hash도 현재 앱을 연다. 공유 스타일·현행 공개/native 모듈은 유지한다. 추가로 실제 진입/native/시험 incoming 0인 `ClientResearchPreviewTools.tsx` 21줄을 ROOT 검토와 PM Decision Log 승인 후 제거했다. 이 파일도 Git `1971e2d`에서 복구할 수 있다. 삭제 전 baseline, Git blob, private 복구 사본과 dashboard WIP patch를 확인했다. [제거·복구 근거](Bugfix_report.md#migration-source-first-delivery)를 따른다.

현재 Mock 소비 범위는 다음과 같다.

- 예약: BTC/ETH 한 번 예약의 명시 가격·상대변화·방향·수량·롱숏·TTL을 제한된 결정론적 문법으로 처리한다. TTL을 먼저 묻고 owner-bound 완료 Mock 응답만 draft/wait/cancel에 들어간다. 미지원 조건·service/foreign/stopped 응답을 주문 권한으로 승격하지 않는다.
- 사용량·연결: Mock 사용량/잔액 표시와 owner/source-bound 연결후 10상태를 소비한다. 연결 callback 완료만으로 연결·결제 성공을 만들지 않으며 cancel/owner 교체는 늦은 관측을 폐기한다. 원본 `AC_CFG280`과 기존 Mock49의 가격 차이는 미해결이고 실제 요금 계약은 변경하지 않았다.
- 연구·수정: 실제 공급이 없는 첫 질문은 원본 offline inline 분기로 들어간다. 원점수·추천 TP8을 보존하고 fresh 점수 미달 연구계획을 차단한다. 명시 합격 조건의 보고서에서 연구로 진입한다. owner-bound 실제 responseSource/strategyProposal의 공통 경로는 별도로 유지한다. 수정방향 질문→한 조건 제안의 고유 본문은 한국어 우선이고 공통 버튼은 7locale이다.
- 카탈로그·카피: 31cfg에 결속된 설정과 비회원 가입/취소/동일 owner 복귀를 제공한다. ‘직접 검증하기’는 `#/share/bt/:id` 전용 페이지에서 원본 90/365/730/전체기간·500/1000/3000/10000 USD를 저장가격의 기존 spot/futures 계산기로 재실행한다. 공개 카탈로그 설정은 변경하지 않는다. 실제 ready 거래소 관측이 없는 host의 실행 CTA는 연결플랜 요청까지만 제공한다.

소개·도움말의 원본 24시간 고객지원 문구와 CTA는 retained Mock 미리보기다. 원본 `about/index.html:363`의 상담 CTA는 홈복귀 anchor다. React CTA의 로컬 도움말은 기존 Mock UI 기능으로 유지한 차이이며 실제 상담원 연결·지원 수준·문의 전송을 제공했다는 뜻이 아니다. 공개 의견 보내기의 `submission="preview"` 완료 화면도 로컬 시연이다. 서비스 전달은 별도 scope-bound `onSubmit`이 제공되고 수락된 경우에만 표시할 수 있으며 현재 공개 host에는 공급되지 않는다.

내부 native의 대화/명시 승인 v0.3·작업 v0.7·이력 v0.8·결과 v0.6·차트 v0.5·인증/recorded Paper 소비는 구현된 범위다. 실제 공급자·역할별 연구 근거·계좌/시장/카피·예약/과금 producer의 연결과 운영 승격은 별도 잔여다. LLM 출력·UI tag는 주문 권한을 갖지 않으며 원 730일 seal을 새 job에 재결속하지 않는다.

| 문서 | 현재 역할 |
|---|---|
| [DESIGN.md](DESIGN.md) | 고정 원본·[12그룹 상태](DESIGN.md#오늘의-화면별-재사용과-잔여)·유효 UI 규격·표시/서비스 경계·Decision Log |
| [Bugfix_report.md](Bugfix_report.md#migration-source-closure) | 현재 closeout, 실패→수정→검증·Git/private 복구 근거. 과거 검수는 당시 범위로 유지 |
| [루트 PM 진입](../../PM/README.md) · [원격 PM 정본](https://github.com/beak1011/tesia-program/blob/main/PM/README.md) | 제품/API/보안/운영 Gate·현재 인수 및 단독 writer. 실행 증거는 활성 Ledger를 따름 |

### 검증과 인수 경계

e325 이후 제품 변경은 공통 `mine` 결과에서 홈 복귀 시 hash 해제, 비회원의 축소·확장 메뉴 새 전략 비활성, native 설정 종료 후 `#/native-client` 유지, 선택 전략 윤곽·프랑스어 거래소 필터명·결과 높이/모바일 그리기 도구 순서·오류 안내 폭의 7파일이다. source ASK 질문 카드의 실제 조작으로 소비 시험을 교정했고 관측 활동 fixture는 명시 공급 화면만 검증한다. offline 질문에 작업 시각·서비스 권위를 합성하지 않는다.

같은 제품 변경을 포함하는 `63966d0`의 native 결과 관련 6spec 단일 실행은 Node22에서 **396 PASS / 0 FAIL / 0 SKIP, 4.1분, exit 0**였다. 기존 footer 1080px 경계·캔버스·소유자/API 결속·재생 수명 검증을 유지했다. 이 수치는 당시 범위의 이력이며 후속 전체 인수 상태는 활성 PM Ledger를 따른다. 하니스 314개 등 별도 실행·반복 수를 합산하지 않는다. 상세 로그 SHA와 이전 실패는 [현재 closeout](Bugfix_report.md#migration-source-closure)을 따른다.

후속 범위별 실제 실행은 offline/owner·provider 경계 54 PASS, 연구 관련 90 PASS, 실제 Main 18 PASS, 카탈로그 직접검증 신규 26 + 기존 주문표 14 = 40 PASS다. 카탈로그는 원본 31cfg×4기간의 124 Golden 비교와 실제 worker의 기간별 계산을 검증했다. host 8 PASS 및 실제 Main 카피 설정 14 PASS는 별도 ROOT 실행이다. 같은 시험의 반복·서로 다른 실행 시점의 통과 수를 전체 회귀 합계나 완료율로 합산하지 않는다. 최초 실패·중단·하니스 교정 로그와 hash는 아래 실패 기록과 PM Ledger에 보존한다.

렌더 존재·파일 수·시험 수를 12그룹 전수 상태/모션/반응형 패리티나 완료 퍼센트로 환산하지 않는다. 과거 구 퍼널 합격 수도 새 원본 이식 증거에 합산하지 않는다. 이전 날짜별 계획·브랜치 설명은 현재 본문에서 제거하고 필요한 실패·복구 이력은 Bugfix 보고서에 유지한다. 이 정리 전 본문은 Git `1971e2d:README.md`에서 복구할 수 있다.

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
