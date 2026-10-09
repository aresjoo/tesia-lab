# ares PDF 패리티 감사 인계

이 문서는 한국어 PDF 470쪽의 감사 결과를 현재 구현에 연결하는 인계서다. 제품 계획이나 운영 상태의 새 정본이 아니며, `Bugfix_report.md`와 Program 문서는 ROOT가 갱신한다.

## 판정 경계

- PDF는 2026-10-07에 원본 `https://aresjoo.github.io/tesia-lab/`과 당시 배포 `https://teth.ai/`를 캡처한 과거 스냅샷이다. 배포측 source는 `13a958b38ccd2a9346417ad7739aaa58c9a25c4b`다.
- 현재 비교 기준은 최신 고정 원본 `aresjoo/tesia-lab@9fbff821df62cad11d026022fc7628c7fcebc431`, React 기준 `web-consultation-ui-restoration@ba2c8c8fa59a866ee8b32de076b1c84a2a8c3154`, 그리고 그 base에서 분기한 현재 `web-pdf-source-parity` 작업본이다. PDF의 옛 배포 화면과 현재 작업본을 같은 시점의 화면으로 취급하지 않는다.
- `http://127.0.0.1:4176`은 현재 작업본의 로컬 개발 미리보기다. 운영 `teth.ai` 배포나 실제 고객 서비스 증거가 아니다.
- TSV의 `owner_scope`는 PDF 감사 당시의 분류와 작업 배정 메타데이터다. 현재 writer, 병합 상태, 운영 소유권 또는 실제 서비스 완료 주장으로 사용하지 않는다.
- `observed-*`는 PDF 픽셀에서 본 과거 차이, `unreproduced-*`는 비교 조건 미충족이다. `unreproduced`는 누락도 PASS도 아니다. 당시 감사의 “확정 source 누락 0”도 실제 기능 누락 0, producer 완료 또는 전체 패리티 PASS를 뜻하지 않는다.
- 현재 작업본에서 확인된 거래소 renderer, 연구 pulse, Latin-first 글꼴 교정은 국소 UI 후보 증거다. 470쪽 전체 재캡처나 운영 반영 증거가 아니다.

## 입력과 분모

- 한국어 웹 PDF 222쪽(1440px) + 모바일 PDF 248쪽(390px) = 470쪽이다. 페이지 상태는 `비교 가능` 180, `QA 상태 미재현` 196, `로그인 필요` 94다. 즉 290쪽은 동일 비교 조건을 확보하지 못했다.
- 한국어 case-key는 Q01-Q62, A01-A15, P01-P04, X01-X05의 86개다. 캡처 상태는 `same` 15, `different-account` 38, `unavailable` 33이다.

| case 판정 | 수 |
|---|---:|
| `unreproduced-different-account` | 38 |
| `unreproduced-unavailable` | 33 |
| `observed-capture-other-team-review` | 6 |
| `observed-comparable-no-major-difference-seen` | 2 |
| `observed-differing-feed-unavailable` | 2 |
| `observed-differing-copy-and-layout` | 1 |
| `observed-differing-store-availability` | 1 |
| `observed-differing-help-copy-actions` | 1 |
| `observed-differing-provider-availability` | 1 |
| `mixed-web-observed-mobile-unreproduced` | 1 |
| **합계** | **86** |

역사적 `owner_scope` 합계도 `other-team-conversation-motion` 11, `other-team-exchange-strategy` 36, `this-audit` 39로 86개다. 이 합계는 case가 인계에서 사라지지 않았음을 확인할 뿐 현재 책임 배정은 아니다.

## 영역별 인계

| 원본 영역 / case / PDF 쪽 | 현재 React renderer | 현재 작업본에서 확인한 UI 범위 | 실제 producer·비교 잔여 | PDF 판정 |
|---|---|---|---|---|
| 홈·채팅·예약·사용량, Q01-Q11(11), web 1-31 / mobile 1-44 | `ClientMainExperience`, `ClientConversation`, `ClientConditionalOrderCard`, `ClientUsageBanner` | 공통 shell·portal 글꼴 교정 외 대화/예약 상태 전체는 이 작업의 복원 판정 대상이 아님 | 실제 모델 대화, 예약 조건, 사용량·entitlement producer의 같은 계정 연속 흐름 미완료 | Q01만 과거 캡처 관측, Q02-Q11은 `unavailable` |
| 전략 복사, Q12-Q22(11), web 32-73 / mobile 45-81 | `ClientStrategySharing`, `ClientSharedStrategyDetail`, `ClientCopyTrading` | renderer 존재. 이번 작업본의 거래소 표시 교정이 실제 복사 권한을 만들지는 않음 | 실제 catalogue/account 연결, follow/copy 권한, 포지션·자금 이동 producer 미연결 | Q12/Q15/Q16 관측, Q13-Q14는 계정 차이, Q17-Q22는 `unavailable` |
| 백테스트, Q23-Q27(5), web 74-83 / mobile 82-93 | `ClientCatalogueBacktest`, `ClientCommonBacktest`, `ClientBacktestWorkspace` | 기존 화면·fixture와 별도 sealed 730일 증거는 존재 | 현재 고객의 원본 전 과정 입력→실행→좋음/나쁨 결과→수정 흐름은 미인증. 전체 원본 매칭도 미인증 | Q23만 관측, Q24-Q27 `unavailable` |
| AI 트레이딩, Q28-Q39(12), web 84-114 / mobile 94-125 | `ClientTradingIntro`, `ClientUserStrategy`, `ClientCopyDashboard`, 조건부 주문 표시층 | renderer 존재, 이번 PDF 교정으로 주문 권한·실계정 상태를 추가하지 않음 | 실제 연결 계정, 전략 상태, 포지션, 미체결 주문, 체결·청산 producer 미연결 | Q28만 관측, Q29-Q39 `unavailable` |
| 거래소 연결·플랜, Q40-Q47(8), web 115-131 / mobile 126-141 | `ClientConnectionPlan`, `NativeConnectionOnboarding`, `exchange-connect/controller.ts` | source 순서/로고, 선택→권한 안내→승인·대기, 명시 verification의 Q45 2단계와 API12 확인 목록의 Q47 터미널/추가 연결/해제 동선을 복원. 900px 배치·cyan 계열 유지, 미지원 거래소 비활성 | Q42/Q43 초대 URL·UID, Q45 실제 중간검증 producer, Q46 billing, Q47 실제 초대/구독 분류, 실제 OAuth/API-key·permission/account/provider 오류 연결은 잔여 | PDF 8개는 `different-account`; 현재 renderer·합성 API 시험을 동일 계정 전수 재현/PASS로 세지 않음 |
| 설정, Q48-Q60(13), web 132-154 / mobile 142-160 | `ClientSettingsPage`와 Billing/Usage/Security/Notifications 하위 컴포넌트 | 동일 화면을 여는 UI fixture/recipe 존재. Q54는 billing+usage 두 표시 계약의 합성일 뿐 동일 계정 fixture가 아님 | 실제 identity, billing, usage ledger, 알림, 2FA·device producer 미연결 | 13개 모두 `different-account` |
| 연구 기록, Q61-Q62(2), web 155-158 / mobile 161-164 | `ClientResearchHub`, `ClientResearchHistory`, `ClientResearchWorkspace` | 연구 헤더·Critic의 1.8초 pulse와 행의 원본 0.3초 fadeUp, 검정 배경·구분선·hover/focus 시각값 복원 | 빈 기록/기록 있음 UI fixture와 실제 계정 library·연구 이벤트 producer는 별개. 연구 전체 원본 매칭 미인증 | 2개 모두 `unavailable` |
| 계정 프리셋, A01-A15(15), web 159-188 / mobile 165-186 | 설정·플랜·계정 표시 renderer 조합 | 상태별 renderer/fixture가 있어도 금융·권한 상태를 합성 성공으로 보지 않음 | guest/login/연결/거래량/card/subscription/2FA를 한 실제 계정에서 공급하는 producer 없음 | 15개 모두 `different-account` |
| 정보·다운로드·정책, P01-P04(4), web 189-209 / mobile 187-217 | `ClientAboutPage`, `ClientDownloadStore`, `ClientPolicyPage` | 현재 기본 About 카피는 9fb와 다시 일치하고 About/Help에 원본 Latin-first stack을 계승. 정책은 큰 차이 미관측이나 자동 PASS 아님 | 실제 App Store/Google Play URL 미공급. 법률 승인·실출시 여부는 renderer와 별개 | P01/P02 차이 관측, P03/P04 큰 차이 미관측 |
| 인사이트·도움말·인증·언어, X01-X05(5), web 210-222 / mobile 218-248 | `ClientInsights`, `ClientHelp`, `ClientAuthDialog`, `ClientLocalePanel` | 승인된 Help FAQ/정책 링크는 보존, Help/auth portal 글꼴 교정 | 기사 feed, 상담 operation, 실제 Apple/Google/email 인증 provider 미완료. 인증 전체 원본 매칭 미인증 | X01-X04 차이 관측, X05는 web 관측/mobile 미재현 |
| **합계** |  |  |  | **86 case** |

별도 랭킹, 일정, 연구 공유, 상담 제출·응답 전체 흐름, 한국어 밖 6개 언어, case-key에 없는 모달·로딩·오류는 이 86개 전용 case에 없다. 이는 `unseen-in-target-pdfs`이며 누락 확정이나 PASS가 아니다.

## 교차 계약 차이

### 실제 한글 webfont 공급과 서비스 host

원본 Google Noto Sans KR와 React Variable import의 family mismatch는 실제 CDP로 확인하고 원본 이름 그대로 로컬 공급했다. 동일한 CSS family 문자열만의 이전 검증은 실제 한글 패리티 증거가 아니며 기존 '원본 KR face 금지' oracle은 폐기했다. pinned124 subset의 family/URL mapping과 한글 custom glyph/별도 Bitcoin fallback을 검증했고 카피·배치·font stack은 변경하지 않았다. weight400~700 이산원본과 Variable범위 차이 등 국소 Low는 Bugfix에 남긴다.

4176은 public Vite QA host이며 NativeServiceApp/실제 서버의 증거가 아니다. 후속 실제 `_StaticBundle` alias+servicebundle의 합성 authenticated GET 검증에서 NativeServiceApp/NativeTradingWorkspace 마운트는 확인했지만, 직접 auth-complete hash의 reload 경로와 CSP 스타일/font 차단은 별도 연결 결함 후보로 조사·교정한다. 이를 UI 누락이나 실제 로그인·provider 성공으로 처리하지 않는다.

### 거래소 확인·완료 상태의 확정 잔여

현재 generic pending은 서버 OAuth transaction의 pending/processing을 보여주는 일반 대기 상태다.
후속 Q45 2단계 renderer는 명시 verification 입력에만 복원했고 API12는 그 중간 사실을 아직 공급하지 않는다.
Q47 행·터미널·추가연결·해제는 실제 API12 connected 목록/callback에 연결했다. API12에 없는 초대/구독 표기는 합성하지 않는다.
이는 fixture의 provider명 차이와 구분해야 할 복원 대상이다. 원본 renderer/문구/배치를
먼저 계승하고, masked account·단계별 검증·초대 eligibility·terminal navigation의
필요한 서버 계약을 붙여야 한다. generic pending을 검증 성공으로 간주하거나 서버 제약을
이유로 원본 화면을 영구 축소하지 않는다. 별도 fixture 캡처의 공용 shell 부재는 실제 서비스
통합 화면을 확인하기 전까지 제품 누락이나 PASS로 단정하지 않는다.

### source 7과 API v0.12 provider 6

- 원본/UI `planExchanges`: Bitget, Binance, OKX, Bybit, MEXC, WOO X, Gate.
- 생성 API v0.12 `ExchangeId`: Bybit, Bitget, BingX, Gate, MEXC, HTX.
- 교집합은 Bitget, Bybit, MEXC, Gate 4개다. UI에만 Binance, OKX, WOO X가 있고 API에만 BingX, HTX가 있다.
- 이 불일치는 UI 항목 삭제나 임의 alias로 덮지 않는다. 현재 renderer는 서버 catalogue에서 지원하지 않는 source 항목을 비활성으로 보여주며, 공용 계약·Backend catalogue·실제 provider 구현이 정렬되어야 한다.

### QR과 Q46

QR과 Q46 구독 결제 branch를 같은 누락으로 보는 가정은 기각한다. 다운로드 QR은 P02의 `ClientDownloadStore`가 검증된 store URL을 명시적으로 공급받았을 때만 로컬 생성한다. 현재 URL 미공급 상태는 준비 중 placeholder가 정상이며 가짜 URL을 넣지 않는다. Q46은 `ClientConnectionPlan`의 별도 checkout renderer로 코드에 존재하지만, 실제 billing producer가 없어 결제 입력과 CTA가 비활성이다. Q46 PDF 자체도 `different-account`라 branch 누락이나 동작 PASS 어느 쪽도 증명하지 않는다.

## 미검증과 실제 연결 잔여

다음 두 축은 독립적이다.

1. **화면 비교 미검증:** 동일 계정·fixture·viewport·언어·모션 조건을 만들지 못한 290쪽과 71개 `unreproduced` case, X05 mobile, PDF 밖 화면은 원본 패리티 미검증이다. renderer가 존재하거나 source 누락을 못 찾았다는 이유로 닫지 않는다.
2. **실제 서비스 미연결:** 같은 화면을 fixture로 재현해도 실제 모델, 연구/library, 백테스트 job/result, 거래소 OAuth/API-key/권한, 결제·사용량, 기사 feed, store URL, 주문·체결 producer가 연결됐다는 뜻은 아니다. 반대로 producer 부재만으로 UI 원본 누락을 단정하지도 않는다.

특히 인증, 연구, 백테스트의 처음부터 끝까지 원본과 같은 실제 흐름은 아직 인증되지 않았다. 현재 작업본의 국소 UI 시험과 과거 Web 전체 회귀를 이 세 흐름의 실서비스 완료 증거로 합산하지 않는다.

## 근거 경로

- 페이지 원장: `reports/ares-pdf-pages.tsv`
- 86 case 원장: `reports/ares-pdf-scenarios.tsv`
- 직접 시각검사 요약·contact sheet·원본 크기 주요 화면: `/home/beak1/workspaces/active/TETH/.cache/pdf-parity-inventory/`
- PDF SHA: `/home/beak1/workspaces/active/TETH/.cache/pdf-parity-inventory/sources.sha256`
- 캡처 원 metadata: `/mnt/c/Users/beak1/Downloads/TETH_화면비교/비교정보.json`, `/mnt/c/Users/beak1/Downloads/TETH_화면비교/배포기준.json`
- 원 PDF: `/mnt/c/Users/beak1/Downloads/TETH_화면비교/PDF/ko_web.pdf`, `/mnt/c/Users/beak1/Downloads/TETH_화면비교/PDF/ko_mobile.pdf`
- 공개/About/Download/Help 현재 source review: `.cache/pdf-source-parity/scoped-handoff.md`, `.cache/pdf-source-parity/current-state.json`, `.cache/pdf-source-parity/source-hashes.txt`
- 설정·연구 재현 경계: `.cache/pdf-source-parity/settings-research-reproducibility.tsv`
- 현재 source 계약: `src/client-connection-plan.ts`, `src/exchange-connect/controller.ts`, `src/internal-poc/contracts/generated/api-v0.12/types.ts`, `src/client-download-config.ts`, `src/components/ClientDownloadStore.tsx`, `src/components/ClientConnectionPlan.tsx`

초기 PDF 목록 작성은 읽기 전용이었다. 후속 renderer/실제 연결 동선의 제품·표적시험 변경과 검증은 Bugfix_report 및 Program Ledger에서 별도로 추적한다. 실제 provider·credential·주문·배포 성공으로 승계하지 않는다.
