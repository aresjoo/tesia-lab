# 클라이언트 원본 → React 이식 변경 안내

## 1. 이 브랜치가 전달하는 것

클라이언트 에이전트가 원본의 디자인·문구·동작을 기준으로 React 구현을 판단할 수 있게 **원본과 현재 코드, 차이 및 잔여를 함께 전달**한다. 프론트를 새로 디자인하자는 제안이 아니다. 원본 동작과 다르면 계약상 필요한 차이인지, 미이식·회귀인지 먼저 구분한다.

| 기준 | 이번 전달 |
| --- | --- |
| 대상 저장소·브랜치 | `aresjoo/tesia-lab`의 `migration` — 원격 `main`에서 분기 |
| 클라이언트 원본 | `9fbff821df62cad11d026022fc7628c7fcebc431` — 최초 전달 시 원격 main과 같음 |
| React 출처 | `beak1011/tesia-web` 거래소 연결 통합 후보 `75a5f5bbb820ad27f66304927ff4c70954fea318`의 추적 파일 전체. 병합 main `62b5e69`를 포함한 Web draft PR54 |
| 정확한 스냅샷 | [migration-manifest.json](migration-manifest.json)의 `sourceCommit`, `capturedAt`, `sourceDirtyFiles`, `snapshotDigest` |
| 현재 제품 상태 | 원본 React 이식 병합본 + 미병합 거래소 연결 후보를 함께 전달. 코드 공개/검토와 main 인수·실제 공급자·운영 승격은 별개. 연결 기능은 기본 비활성화 |
| 코드 외 로컬 자료 | `node_modules`, 캐시, 빌드 결과, 실행 로그, DB, credential, 다른 작업본, 적용 전 비공개 QA 후보는 포함하지 않음 |

`sourceDirtyFiles`가 비어 있으면 캡처 당시 추적 파일은 출처 커밋과 같다. 값이 있으면 해당 파일의 미커밋 변경까지 포함한 스냅샷이며, 그 변경의 완료·검수 통과를 의미하지 않는다. 진행 중인 다른 작업본을 임의로 섞지 않는다.

### 이번 누적 반영 — 이전 전달과 무엇이 달라졌는가

이전 전달 `5a51901`(병합 main `62b5e69`)에서 거래소 연결 후보 `75a5f5b`로 갱신했다. **추가 19개 파일 변경(신규 13개 포함), 총 2,135개 파일**이며 출처의 미커밋 변경은 없다. 앞서 전달한 원본 이식·후속 86개 파일 변경도 모두 유지한다. 패키지·lockfile·기존 클라이언트 HTML·루트 배포 workflow는 변경하지 않았다. 자동 상시 동기화가 아니라 이번 요청에 따른 명시적 후속 전달이다.

사용자가 현재까지의 프론트 변경을 한 브랜치에서 볼 수 있도록 요청했으므로 **미병합이라는 이유만으로 구현 코드를 빼지 않는다.** 후보 코드를 포함하되 출처 SHA, 검증 범위, feature flag, 미완료 계약·운영 항목을 구분해 전달한다. 독립 QA 실험·credential·DB와 다른 저장소 서버 구현 자체는 프론트 스냅샷에 혼합하지 않는다.

| 누적 변경 | 코드와 검토 위치 | 전달 의미 |
| --- | --- | --- |
| 원본 명칭 정렬 | `src/client-*-copy.ts`, 연구·전략·공유·터미널 컴포넌트, `tests/client-trading-label-source-parity.spec.ts` | 본문·버튼의 AI 트레이딩 표기를 7언어로 정렬. DEV 보관 화면과 공급자가 준 원문은 임의 변경하지 않음 |
| Main 시장 공급 연결 | `ClientMainExperience.tsx`, `ClientSourceTerminalWorkspace.tsx`, `tests/client-main-terminal-market-source.spec.ts` | 선택적 `terminalMarketSource`를 소유자 scope와 함께 기존 터미널에 전달. 종목 검색·차트/정보/데이터를 소비하며 기본 공급자나 실제 가격을 새로 만들어내지 않음 |
| 저장 거부·불확실성 안내 | `ClientStoredMarketResponse.tsx`, `ClientMarketChartCard.tsx`, `src/client-market-chart-*.ts` | 저장 오류 사유와 재시도 불가 상태 표시. 기존 store·요청 권한을 완화하지 않음 |
| 도움말·설정·검색 복귀 | `ClientLoadBoundary.tsx`, `ClientServiceExperience.tsx`, `ClientMarketPicker.tsx` | 늦은 도움말 완료가 초점을 빼앗지 않게 하고 설정 이동 시 이전 표면을 정리. 검색 첫 Escape로 닫기·IME 예외 유지 |
| 테스트 준비·운송 안정화 | `tests/fixtures/compiled-module-response.ts`, 차트·문서·레이아웃 관련 tests | compiled module HTTP/status/MIME 확인, 실제 CSS·폰트·화면 준비 후 기존 assertion 실행. 성공 수를 늘리기 위한 skip/retry 추가가 아님 |
| 인수 기록·보안 CI | `README.md`, `DESIGN.md`, `Bugfix_report.md`, `.gitleaksignore` | 단일 전수 결과와 제한을 기록. 공개 해시·합성 시험값의 정확한 fingerprint만 보정한 Web55 포함 |

출처 원본 이식은 [Web52](https://github.com/beak1011/tesia-web/pull/52)로 병합됐고 [Web55](https://github.com/beak1011/tesia-web/pull/55)는 CI fingerprint만 보정했다. 출처 팀의 `b463a728` 단일 전수는 **13,183 PASS / 0 FAIL / 기존 17 SKIP (총 13,200)**이며 최종 문서 후보 `1e994c7`와 Web52 병합 tree가 동일하다. Web55는 제품·시험 입력을 바꾸지 않았다. 이는 출처 인수 근거이며 **이번 전달 작업에서 13,200개를 재실행했다는 뜻은 아니다.** 이번 복사본에서 직접 실행한 결과는 검증 JSON을 따른다. 모든 62 preset·실제 공급자 성공 인증으로 확대하지 않는다.

### 이번에 코드까지 포함한 거래소 연결 후보

[Web draft PR54](https://github.com/beak1011/tesia-web/pull/54), head `75a5f5bbb820ad27f66304927ff4c70954fea318`의 **신규 거래소 연결 코드를 `react-app/`에 포함했다.** 앞선 커밋의 문서만 전달한 상태를 바로잡았다. 이 후보는 `tesia-web/main`에는 아직 미병합이다. TETH 로그인→거래소 로그인·최초 동의→서버 연결 확인 흐름이며 브라우저 API 키 입력·저장은 없다.

| 추가·변경 위치 (`react-app/` 기준) | 역할·검토 포인트 |
| --- | --- |
| `src/exchange-connect/controller.ts` | 서버가 확인한 연결 상태·로그인 이동·취소/만료/실패·소유자 전환 처리. 거래소 원격 키 정리 안내와 로컬 연결 해제를 구분 |
| `src/exchange-connect/transport.ts` | 같은 origin의 명시 endpoint만 소비하는 transport. 응답 크기/시간·redirect 제한 |
| `src/exchange-connect/use-exchange-connection.ts` | React 수명과 계정별 controller 연결 |
| `src/exchange-connect/copy.ts` | 7언어 연결 상태·오류·복구 안내 |
| `src/internal-poc/NativeServiceApp.tsx`, `service-main.tsx` | 기존 서비스 화면에 연결 후보 공급. 기본 비활성화 유지 |
| `src/internal-poc/contracts/generated/api-v0.12/` 6개 파일 | 생성 client/types/validator/index와 operation/generation manifest. 미발행 후보 SDK이며 기존 정식 소비 pin을 대체하지 않음 |
| `exchange-connect-fixture.html`, `src/exchange-connect/fixture-main.tsx`, `tests/exchange-connect.spec.ts` | 로컬 시험 진입점·34개 desktop/mobile/controller 검증. 제품 build에는 fixture HTML을 포함하지 않음 |
| `README.md`, `DESIGN.md`, `Bugfix_report.md`, `.gitleaksignore` | 인수 경계·시험 근거·정확한 공개값 fingerprint 추가 |

관련 [클라이언트 PR4](https://github.com/aresjoo/tesia-lab/pull/4), [Backend158](https://github.com/beak1011/tesia-backend/pull/158), [Contracts40](https://github.com/beak1011/tesia-contracts/pull/40)의 계약을 소비한다. 프론트 소스·생성 SDK·시험은 이 브랜치에서 볼 수 있고 **서버 구현과 규범 계약은 해당 저장소가 정본**이다. 관련 PR 병합·정식 API0.12 패키지 발행 및 소비 pin 갱신·거래소 앱 등록·실계정 인증·TLS/운영 검증은 남아 있다. 등록 앱이 없는 provider는 사용 불가로 닫힌다. 연결 해제는 `local_only`이며 원격 키 폐기를 보장하지 않는다. 주문 권한도 생성하지 않는다.

출처의 178 PASS는 별도 fixture 범위이며 실계정/TLS/provider 성공이 아니다. 현재 전달에서 직접 실행한 결과는 검증 JSON을 따른다. **service build의 `VITE_TETH_EXCHANGE_CONNECT=true`만 명시 opt-in이며 기본 false**다. 코드가 전달됐다는 이유로 운영 flag를 켜지 않는다.

### 저장소 읽는 순서

1. 이 문서의 **동작별 대응표와 미완료 사항**을 읽는다.
2. 루트 원본 `index.html`·공통 JS와 `react-app/src/`의 대응 구현을 비교한다. 원본의 같은 함수가 여러 번 선언되거나 후반 wrapper에서 바뀌면 **최종 유효 구현**을 기준으로 한다.
3. `react-app/tests/`에서 같은 사용자 동선을 확인한다. 컴포넌트 단독 fixture 성공과 실제 Main 진입 성공을 구별한다.
4. [React README](react-app/README.md), [DESIGN](react-app/DESIGN.md), [Bugfix_report](react-app/Bugfix_report.md)의 근거를 본다. 긴 과거 기록은 그 당시 범위이며 현재 전체 합격으로 승계하지 않는다.
5. 전체 파일 포함 여부는 manifest와 `node tools/sync-migration.mjs --verify`로 확인한다.

원본 폴더는 비교할 현행 클라이언트 기준이지 폐기 파일의 별도 백업이 아니다. 기존 HTML을 React 파일로 덮어쓰지 않아 원본 변경과 이식 변경을 따로 검토할 수 있다. React 쪽에도 기존 README·DESIGN·Bugfix 기록을 byte 그대로 전달하므로 일부 문서의 작업공간 상대 링크는 이 저장소에서 열리지 않을 수 있다. 제품·계약 정본은 [tesia-program](https://github.com/beak1011/tesia-program), [tesia-contracts](https://github.com/beak1011/tesia-contracts)이며 접근 권한이 필요할 수 있다. 이 문서는 새 제품·API 정본이 아니라 전달 범위 안내다.

### 투자 AI 프롬프트 품질 후보

별도 migration draft [Lab PR5](https://github.com/aresjoo/tesia-lab/pull/5)는 서버 registry1.16.0·출력 gate·shared 표시 schema와 root source의 투자 상담을 교정한다. React2135 snapshot·source75a5f5b는 재동기화하지 않는다. 따라서 source/서버 개선이 React의 local Mock producer나 AI compiler에 적용되었다고 보고하지 않는다.

조건·선호·분모·시각·Mock 출처를 보존하고 exact 선택만 로컬 설정을 바꾼다. 자유 텍스트 수정/질문은 상담이며 자동 실행하지 않는다. 폐쇄형 BTC/ETH 초기/명시 새 scope만 서버가 Mock 설정 화면으로 연결한다. rich 전략·승인·예약·OrderIntent의 typed 계약 연결은 미완료다. 검증 방법·공개 실제 CLI 기록/의미 실패·두 viewport Mock 브라우저·자동 회귀는 `server/README.md`와 Program §16/Ledger를 따른다. 실제 앱 provider/전체서비스 E2E/배포 성공으로 승계하지 않는다. SERVICE_NO_GO이며 main server 병합은 자동 Worker 배포를 유발하므로 금지한다.

## 2. 가장 큰 구조 변경

| 원본 main | React 이식본 | 바뀐 이유·주의점 |
| --- | --- | --- |
| 큰 `index.html` 안의 HTML/CSS/전역 함수·상태 | `react-app/index.html`은 bootstrap, `src/components/`·`src/client-*.ts`·CSS로 분리 | React lifecycle/state로 이식. 파일 분리가 화면 변경을 허용하는 것은 아님 |
| 전역 함수와 inline onclick | React handler, 상태 전이, effect 정리 | 세션/계정 교체·늦은 응답·unmount를 구분. 표시만 바꾸고 거래 권한을 만들지 않음 |
| HTML 문자열·전역 UI 갱신 | JSX와 표시 모델/locale 사전 | 원문·SVG·배치 계승. 고정 원본 인수와 모든 화면/상태의 무결함 보장은 다름 |
| 정적 HTTP 서버 | React 19 / TypeScript / Vite, lockfile 기반 설치·빌드 | 의존성의 정확한 버전은 `react-app/package-lock.json` |
| 원본 안의 가격/전략 계산 코드 | 별도 저장자료·카탈로그·spot/futures 계산기·Worker | 원본 계산과 표시를 분리. 이 브라우저 계산을 서버 실거래 백테스트라고 부르지 않음 |
| 원본의 화면용 계정·연결 성공 | 공개 Mock와 내부 SDK consumer 분리 | 서버가 확인하지 않은 연결·결제·로그인 성공을 실서비스 성공으로 만들지 않음 |
| 원본 정적 정보 페이지 | React 내부 페이지 라우팅 | 정보 페이지 왕복 중 이미 열린 대화 초안을 유지 |
| 수동 화면 확인 중심 | 타입 검사·lint·공개/내부 빌드·Playwright | 테스트 파일이 있다는 것과 해당 전달 SHA 전체가 통과했다는 것은 다름 |

공개 실행 경로는 `src/client-entry.ts` → `src/client-bootstrap.tsx` → `SiteRouter` / `ClientMainExperience`다. 과거 query/hash도 원본 기반 셸로 들어간다. 별도 DEV 검증 화면은 production 앱과 구분한다.

## 3. 화면·기능별 원본 대응표

아래 경로는 `react-app/` 기준이다. 이는 구현 위치 안내이며 **행 전체의 원본 동등성 합격 선언이 아니다.**

| 원본에서 찾을 기능 | React에서 볼 파일 | 계승·변경 및 확인할 점 |
| --- | --- | --- |
| 홈, 헤더, 입력창, 사이드바, 푸터 | `src/components/ClientMainExperience.tsx`, `ClientChrome.tsx`, `ClientComposer.tsx`, `src/client-reference.css` | 단일 원본 셸·guest/member 분기. 회원 메뉴 연구 기록/AI 트레이딩/전략 복사/거래소 연결, 비회원 2메뉴와 새 전략 제한. 원본 SVG/문구/모바일 메뉴 동작 대조 |
| 첫 질문, 시장 대화, 전략 조건 질문 | `ClientConversation.tsx`, `ClientSourceIntake.tsx`, `src/client-experience-store.ts` | 대화 맥락과 입력 보존, 스트리밍/사고 상태 소비. 실제 응답 공급 여부에 따라 원본 offline와 서비스 경로를 구분 |
| 연구 시작·진행·문서·Critic·연구 기록 | `ClientResearchWorkspace.tsx`, `ClientResearchDocument.tsx`, `ClientResearchHistory.tsx`, `src/client-research-lifecycle.ts` | 원본 연구 표현과 문서 왕복을 이식. 설명용 단계 재생은 실제 모델 호출 증거가 아님. offline 점수 미달은 연구 진입을 합격으로 꾸미지 않음 |
| 입력한 전략의 inline/common 검증 | `ClientInlineBacktest.tsx`, `ClientCommonBacktest.tsx`, `ClientCommonBacktestChart.tsx` | 원본 첫 질문→조건 보완→검증→연구 분기를 유지하는 경로. 아래 catalogue 직접검증과 혼동하지 않음 |
| 전략 목록, 필터, 카드, 상세, 직접 검증 | `ClientStrategySharing.tsx`, `ClientStrategyListCard.tsx`, `ClientStrategyFilters.tsx`, `ClientCatalogueBacktest.tsx`, `src/client-catalogue*.ts` | 31개 설정/저장가격을 소비. `#/share/bt/:id`에서 90/365/730/전체기간과 500/1000/3000/10000 USD 재실행. 원본 완전 판단 목록/마커 연결은 아래 잔여 참고 |
| 카피 설정·추가·포지션·청산 목록 | `ClientCatalogueCopyManagement.tsx`, `ClientTerminalCopies.tsx`, `ClientTerminalLedger.tsx` | 동일 카탈로그 설정/원장 소비, 비회원 가입·취소·동일 owner 복귀. 실제 거래소 카피 실행은 별도 공급 필요 |
| AI 트레이딩 터미널, 우측 대화·조건 수정 | `ClientSourceTerminalWorkspace.tsx`, `ClientAccountTerminal.tsx`, `ClientTradingTerminal.tsx`, `ClientStrategyProposal.tsx` | 원본 터미널 구성을 React로 조립. 전략 변경 제안과 검증/실행 권한을 분리. 본문·버튼의 AI 트레이딩 명칭 후속 정렬과 선택적 Main 시장 공급 연결 반영 |
| 전문 차트, 캔들, 지표·그리기·기간 | `ClientProfessionalPriceChart.tsx`, `ClientPriceDrawingTools.tsx`, `ClientMarketPicker.tsx`, `ClientTerminalMarket.tsx` | Lightweight Charts 5.2.1 기반 전문 차트가 별도로 존재. catalogue 차트와 동일 컴포넌트가 아님. 공급되지 않은 분봉/실시간 데이터를 임의 생성해 실제라고 표시하지 않음 |
| 시장 질문 결과·저장 차트 | `ClientMarketResponse.tsx`, `ClientStoredMarketResponse.tsx`, `ClientMarketChartCard.tsx`, `src/client-market-chart-*.ts` | 저장 상태/자료 출처/거부·실패 경계. 전역 storage 거부·commit 불확실성 표시와 disabled 교정을 이번에 반영 |
| 거래소 목록·연결플랜·연결 완료·만료/KYC | `ClientMyExchanges.tsx`, `ClientConnectionPlan.tsx`, `ClientTerminalConnectionEmpty.tsx`, `ClientTradingIntro.tsx`, `src/exchange-connect/` | 기존 UI와 신규 서비스 연결 controller/SDK 후보까지 포함. UI 상태와 실제 계정 관측을 분리하며 callback만으로 연결·과금·주문 성공을 합성하지 않음 |
| 설정, 언어·통화, 계정·보안·이메일·알림·결제 | `ClientSettingsPage.tsx`, `ClientSettingsSecurity.tsx`, `ClientSettingsBilling.tsx`, `ClientSettingsNotifications.tsx`, `src/client-*-copy.ts` | 7언어 표시와 상태 소비. 최신 원본의 일반 설정 USD 고정과 다른 화면 통화 표시를 구분. 서버 action이 없는 항목을 실제 변경 성공으로 처리하지 않음 |
| 사용량·잔액·연결후 상태 | `ClientSettingsUsage.tsx`, `ClientUsageBanner.tsx`, `src/client-usage-presentation.ts` | Mock 표시와 owner/source-bound 관측. 원본 가격과 기존 Mock 가격 차이는 미해결이며 실제 요금 계약 확정 아님 |
| 대화에서 예약된 검증/조건부 주문 표시 | `ClientConditionalOrderCard.tsx`, `src/client-conditional-order-preview.ts` | 제한된 문법의 공개 Mock producer. service/foreign/stopped 응답을 예약 주문 권한으로 승격하지 않음 |
| 소개, 앱 다운로드, 정책, 인사이트, 도움말 | `ClientPublicPages.tsx`, `ClientInsights.tsx`, `SiteRouter.tsx`, `src/site-navigation.ts`, `public/client-shots/` | 앱 내부 페이지로 연결. 지원·피드백 preview는 실제 상담/전송 성공과 구분. 앱 이미지·로고·폰트는 자산 목록에서 확인 |
| 실제 서비스 대화/승인/백테스트·이력·Paper | `src/internal-poc/`, `src/internal-poc/contracts/generated/` | 별도 서버 계약 consumer. 공급자·인증·권한·실주문을 UI로 추측하지 않음. 서버·credential·DB 자체는 이번 프론트 전달에 없음 |

원본의 공통 `site-config.js`, `site-footer.js`, `help-widget.js`, `theme.js`, `teth-copy.js`와 각 HTML 본문을 React의 관련 public-page·footer·help·locale 모듈과 함께 비교한다. 원본의 디자인 실험 `ux-audit/` 전체를 앱 기능으로 활성화한 것은 아니다. 원본 자산은 루트에, 실제 React가 사용하는 자산은 `react-app/public/`에 있다.

## 4. 그대로 유지해야 할 것 / 의도적인 차이

### 원본의 사용자 경험을 유지하는 항목

- 클라이언트가 결정한 로고·브랜드, 다크 테마, 문구, SVG와 메뉴 구조를 우선한다. 과거 TESIA/금색 디자인으로 회귀시키지 않는다.
- 첫 질문에서 다른 제품으로 이동하는 인상을 만들지 않고 같은 대화 흐름을 유지한다.
- 연구 문서, 판단 근거, 진행 표현, 결과/수정 동선은 단순 알림 박스로 축약하지 않는다.
- 사이드바의 회원/비회원 메뉴, 로그인 제한, 설정 진입, 초안/세션 복귀, 모바일 스크롤과 포커스 동작을 함께 대조한다.
- 언어 변경은 메뉴뿐 아니라 제목/버튼/본문/상태 메시지까지 확인한다. 통화 변환은 표시와 원장 기준값을 분리한다.

### React·실서비스 경계 때문에 달라지는 항목

- 원본의 전역 상태를 owner/session/run에 결속한 상태로 분리한다. 계정 교체 후 이전 응답을 현재 사용자에게 적용하지 않는다.
- 실제 공급이 없는 연결·계좌·결제·시장·연구 내용은 명시적인 미공급/preview 경계로 처리한다. 이는 임의로 원본 디자인을 바꾸라는 지시가 아니다.
- LLM 출력/UI 태그는 주문 권한이 아니다. 승인된 전략·서버 검증·위험 통제 경로가 필요하다.
- 브라우저 localStorage는 UI 복원용이지 인증·서버 주문 원장이 아니다. API key·OAuth secret·cookie·token을 저장소나 브라우저 저장소에 넣지 않는다.
- 원본 다운로드 QR의 외부 생성 방식과 달리 React에는 로컬 QR 생성 의존성이 있다. 실제 스토어 주소·운영 제공 여부는 별도 확인 대상이다.
- 원본의 `server/`는 그대로 비교 대상으로 남아 있지만 React 내부 consumer와 자동으로 호환·연결됐다는 뜻이 아니다. React가 새 endpoint를 추측해서 호출하지 않는다.

## 5. 실제 연결 상태 — 서로 섞으면 안 되는 네 가지

| 구분 | 의미 | 현재 전달에서 판단할 범위 |
| --- | --- | --- |
| 공개 Mock UI | 브라우저 preview·결정론적 시뮬레이션 | 기본 앱. 실제 로그인/거래/유료 결제 전체 제공이 아님 |
| 저장 자료 기반 catalogue 재계산 | 원본 spot/futures 계산기 + Worker | 임의로 적은 성과 대신 원본 저장자료 계산. 데이터 출처 pin은 UI 원본 SHA와 다를 수 있으며 원본 Golden 대조 대상 |
| 내부 서비스 consumer | generated SDK로 승인·작업·결과·이력·차트 소비 | 별도 backend/권한/설정이 있어야 연결. 프론트 파일 존재만으로 실제 공급자 성공을 주장하지 않음 |
| 원 730일 결과 / 외부 실제 공급자 | 별도 봉인 결과·provider·계정·운영 환경 | 이번 저장소에 DB/비밀값/새 백테스트 결과를 넣지 않음. 원 결과를 다른 job/owner에 재사용하지 않음 |

`npm run build`, `build:internal-poc`, `build:service`는 서로 다른 패키징이다. 내부 빌드 성공은 실서버·실모델·실거래 성공이 아니다. `VITE_E2E_FAST`와 fixture는 테스트 편의용이며 제품 진행 시간이나 실제 연구 완료 근거로 쓰지 않는다.

## 6. 이번 전달에서 반드시 알아야 할 미완료 사항

1. **Catalogue 백테스트의 완전한 판단 목록과 차트 연결은 미완료다.** 현재 `ClientCatalogueBacktest.tsx`는 제한된 `judgments`를 날짜로 찾아 표시한다. 같은 날 여러 종목/체결을 구분하는 event identity, 원본 daily group·정렬·필터·더 보기·상세 근거/mini-chart 복원 후보는 비공개 QA에서 검증했지만 이 스냅샷 제품에는 아직 반영되지 않았다.
2. **마커의 실제 클릭 겹침 문제가 남아 있다.** 키보드 선택/상태 처리 테스트 성공만으로 mouse/touch 문제가 해결됐다고 판정하지 않는다. 같은 날의 여러 매수/매도·숏 체결을 보존하면서 원본 목록에서 전체 근거에 접근해야 한다.
3. **전문 차트와 catalogue 결과 차트는 다른 경로다.** 전문 Lightweight Charts 코드가 있어도 모든 백테스트 경로가 그 차트/실데이터를 사용하는 것은 아니다.
4. **원본 이식 인수와 무결함/전 상태 인증은 다르다.** 출처의 단일 전체 회귀·Web52 인수는 완료됐지만 모든 62 preset 또는 모든 화면·반응형·SVG·모션 조합의 인증은 아니다. 최종 원본과 어긋난 동선은 계속 확인해야 한다.
5. **실제 모델·시장·거래소/카피·예약·과금/사용량 producer 및 운영 Gate가 남아 있다.** 프론트에서 확정할 수 없는 계약은 PM/backend와 합의한다.
6. **신규 거래소 연결 draft는 코드 포함, 정식 서비스 승격은 미완료다.** 위 PR54 head까지 전달했으며 그 이후 변경이나 실제 공급자 성공을 포함했다고 주장하지 않는다.

1·2번은 이전 전달의 개별 QA 잔여이며 해당 `ClientCatalogueBacktest.tsx`는 이전 출처와 byte 동일함을 이번에 확인했다. 이 잔여가 전체 인수 시험에 의해 해소됐다고 추정하지 않는다. 비공개 후보는 제품 수정처럼 보이지 않도록 `react-app/src`에 섞어 넣지 않았다. 구현 담당이 인수할 때 변경·검증·상태 설명을 같은 후속 커밋으로 갱신한다.

## 7. 실행·검증

Node 22.23.2를 검증 기준으로 권장한다. 저장소 루트 원본 HTML 서버와 React 개발 서버는 다른 앱이므로 포트를 나눠 실행한다.

```bash
cd react-app
npm ci
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
# 별도 터미널에서
npm run lint
npm run build
npm run build:internal-poc
npm run build:service
# 테스트 서버가 다른 팀 서버와 충돌하지 않게 포트를 지정
TETH_E2E_PORT=4196 npx playwright test --workers=2
```

Chromium이 없으면 `npx playwright install chromium`이 필요하다. 실제 backend 연결은 기존 승인된 설정·계약을 따른다. 이번 전달을 위해 자동 로그인·API key 입력·운영 배포를 실행하지 않는다.

이번 전달 자체의 검증 결과는 [migration-verification.json](migration-verification.json)에 기록한다. 원본/출처/전달 해시 검증과 lint·build·대표 브라우저 검증을 구분한다. 출처의 전체 회귀·Web52 병합 인수는 완료됐으며, 이 브랜치는 **병합본과 신규 거래소 연결 후보를 함께 보여 주는 클라이언트 검토용 전달**이다. 기본 원본 이식의 전수 성공을 추가 연결 기능에 자동 승계하지 않는다. 클라이언트 main 병합 또는 운영 배포 승인을 의미하지 않는다.

## 8. 다음 에이전트의 검토·수정 방법

- 원본 동선으로 시작한다: 첫 질문 → 조건 보완 → 검증/연구 → 문서/결과 → 거래소 연결/터미널. 각 단계의 back·cancel·reload·계정 변경까지 확인한다.
- 1440px 데스크톱과 약 390px 모바일에서 문단/줄바꿈/그리드/입력 높이/모달/메뉴/고객지원 위치를 확인한다. 화면을 못 본 항목은 정적 코드 검토와 구분한다.
- 결함은 **재현 경로, 기대하는 원본 함수/화면, 실제 React 파일, 영향, 수정안, 실행한 검증** 순서로 기록한다. 원본 자체 Mock 한계와 새 이식 누락을 구분한다.
- `react-app/`를 직접 수정하면 다음 자동 복사가 덮어쓰지 않도록 동기화 도구가 중단한다. 그 변경을 출처 통합팀에 돌려주고 인수·재동기화한다. 원본 main에 React 코드를 자동 병합하지 않는다.
- `react-app/AGENTS.md`는 React 소비 코드의 계약·보안 지침, 루트 `AGENTS.md`는 원본 비교와 저장소 협업 지침이다. 코드/문서에 충돌이 있으면 추측으로 계약을 바꾸지 않는다.

## 9. 누적 업데이트 절차

이 브랜치가 지속 전달 창구다. 날짜별 복제 브랜치·`final/latest` 문서를 늘리지 않는다. 코드를 바꾼 커밋에는 이 설명서의 영향/잔여와 검증 JSON도 갱신한다.

1. `git fetch origin main migration` 후 로컬 `migration`을 원격과 fast-forward 정렬한다. 최초 브랜치 생성 전에는 `main`만 fetch한다.
2. PM의 현재 통합 작업본과 writer를 확인한다. 현재 프론트 통합 후보까지 전달하되 미병합 후보라는 이유로 코드를 누락하지 말고 상태를 구분한다. 원본 고정 SHA를 임의로 새 main과 혼합하거나 관련 없는 독립 실험을 합치지는 않는다.
3. 출처가 순간적으로 변경 중이면 캡처를 다시 수행한다. 다음 도구는 추적 파일 전체를 byte 그대로 복사하고 모든 파일의 SHA-256을 기록한다. 비추적 코드가 있거나 전달본에 별도 수정이 있으면 중단한다.

   ```bash
   node tools/sync-migration.mjs /absolute/path/to/current/tesia-web-worktree
   node tools/sync-migration.mjs --verify
   ```

4. 변경 목록을 보고 의존성/공용 계약/화면 영향과 미완료 목록을 갱신한다. 비밀 탐지·관련 검증을 수행한다. 고객의 새 main 커밋이 있으면 별도 차이로 먼저 검토한다.
5. `git add react-app migration-manifest.json migration-verification.json MIGRATION.md README.md AGENTS.md tools/sync-migration.mjs` 후 `git diff --cached --check`와 범위를 확인한다.
6. 의미 있는 작업 묶음으로 `git commit`하고 `git push origin migration`한다. force push/main 병합/운영 배포는 하지 않는다.

동기화 도구는 **자동 커밋·푸시·배포·상시 감시를 하지 않는다.** 이후 작업 묶음마다 변경을 검토해 이 브랜치에 누적 반영한다. 실패한 검사나 미반영 구현을 다음 전달에서 조용히 지우지 않는다.

투자 프롬프트 후보는 브라우저의 지침 생성 함수를 제거하고 데이터 context/잘린 이력 표시를 사용한다. 기존 source main과 React2,135 snapshot은 보존한다. main server 변경 병합은 자동 운영 배포를 유발하므로 서비스 NO-GO 동안 금지하며 후보는 migration 대상 draft로 전달한다.

최신 migration d53a806의 거래소 연결 후보와 React2,135개 bytes를 보존한 위에서 투자AI 변경만 추가했다. rvHidden/rvNew의 숨은 모델태그 지시와 rvDraft의 미확인 성과·미선택 조건은 제거했고 TLINE 모델사건태그는 검증된 서버사건 계약 전까지 차단한다.
