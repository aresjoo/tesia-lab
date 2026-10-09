# TETH — React 마이그레이션 전달 브랜치

이 `migration` 브랜치는 클라이언트 원본과 React 이식본을 함께 검토하기 위한 전달본입니다. **전체 서비스 완성·실거래 운영 승인본은 아닙니다.**

## 최신 migration 전달

현재 React 작업본은 Web `7c0188e696abddb532e7724af573ac8436d855f6`의 2,407파일 전체 snapshot입니다.
원본 root·Node/Worker는 유지하고, [PDF 470쪽/86case 차이와 미완료 목록](react-app/reports/ares-pdf-parity.md),
[변경·검증 내역](react-app/Bugfix_report.md), [다른 에이전트를 위한 통합 설명](MIGRATION.md)을 함께 제공합니다.
원본 Q45/Q47 완료 동선·설정 SVG·한글4weight를 복원하고, 해제·언어 변경 경합과 서비스 font/CSP를 국소 검증했습니다.
전체 화면 일치·실제 AI/주문·운영 배포 완료가 아닙니다. 과거 추가 작업 예약은 AGENTS에서 제거해 활성 정본과 최신 전달만 가리킵니다.

## 이전 전달 기록

아래 수치와 운영 기록은 각 이전 전달 당시의 이력입니다.

최신 React 전달은 [Web ec15de3](https://github.com/beak1011/tesia-web/tree/ec15de31744cdf08fe99aa2a9ba48500a7f58774)의 전체2377파일/33,835,466bytes, snapshot SHA `339bb88ba9c0aba5606fecaff7d64723a829eac60fe20f96091494167ed8d6f1`이다. 공식 sync/verify로 확인했으며 source dirty·이전경로 삭제0이다. 원본 글꼴과 모바일 설정 접근을 복원하고 발행 API13 SDK 원bytes·React streaming/응답유실 동일key 재개·서버 확인된 대화 복구·취소를 전달한다. 기존 카피/SVG/로그인 선택지·전략/chart 흐름은 보존하며 새 상담 flag는 기본 비활성이다. 합성 API의 관련25/후속4/최종2PASS와 scoped 모델 검수·최종 service build0는 별도 증거이며 실제 Backend↔React/provider 성공은 아니다. 상세는 [누적 보고서](react-app/Bugfix_report.md)를 따른다.

Bitget은 현물·선물 모두, AI는 난이도 기반 자동 라우팅·초기 크레딧만 사용/추가 결제 없음으로 결정됐다. 기존 별도 Bitget OAuth/exchange 조립은 확인했으며 새 상담 서비스에 연결이 빠진 부분과 구분한다. Backend Unicode 출력 상한 후속·API14 claim/list·라우터/크레딧 총액 제한·실계정/주문/운영 검증은 남는다. 운영 UI source13a/edge7e와 원본 root Node/Worker는 변경하지 않았다. 아래 다른 snapshot·'최신'·미결정 표기는 각 작성 당시 이력이다.

Anthropic 대화 활성화 준비 후속은 [별도 한정 코드 후보](https://github.com/aresjoo/tesia-lab/tree/agent/lab/anthropic-activation-guards)와 그 [버그 보고서](https://github.com/aresjoo/tesia-lab/blob/agent/lab/anthropic-activation-guards/server/Bugfix_report.md)를 전달한다. 사용자 모델/비용 결정 전 provider·운영AI·주문0이다. SDKretry0/오류 재dispatch 제거와 번역target 선호 오탐을 교정하고 과거92 QA의 immutable base/currentcandidate를 분리 검증했다. route35·preferences420·guard15의 관련 배치와 별도후속guard15/recorded57, private EMAIL/HANDOFF4PASS 및 새personal1Opus5.5 SCOPED_GO C0H0M0를 구분한다. 모델 사용성4FAIL/실SDK/API·durableSSE·원자금액제한·연구producer 등 서비스 잔여는 유지한다. provider 후보는 별도 branch로만 전달하며 root원본 Node/Worker에 병합하지 않는다. 현재 migration React 제품/시험 수정은 아래 FR 국소교정을 따른다. 코드 전체는 위 별도branch에서 검토할 수 있고 최신 정본은 [Program 활성화 준비](https://github.com/beak1011/tesia-program/blob/agent/program/investment-prompt-quality/PM/TESIA_AI_POC_Product_Implementation_Plan.md#anthropic-고객-대화-활성화-준비)를 따른다.

최신 전체 React snapshot은 통합 `be0eb0541631bb5db554cf1aa35da8525fcadd7d`의 2362파일/33,624,492bytes/SHA `04f0b06cb8c0ec3bdaebb7e8dc2e8084f8c63959ba06535ad9a63720e6c6a364`이며 공식 sync/verify로 확인했다. 이번 제품 수정은 프랑스어 용어 제목의 관사 조합을 `Définition : {term}`으로 교정한 1키와 신규 회귀시험이며 다른 문구·디자인·SVG·인증/API/flags는 유지했다. 관련 단일 7PASS·42팝업 관측·lint/타입/service build0이며 운영에는 아직 반영하지 않았다. 실제 운영 UI source는 `13a958b38ccd2a9346417ad7739aaa58c9a25c4b`, SVG 직접 제공 edge는 `7e9341b05aa8cc4d1cfb5d44e934bf339ffc95f675c0d8d6c3e024ac3fc0aec5`로 불변이다. 현재 SVG200은 과거504 원인 해소의 증거가 아니며 후속 UI 배포에는 새 edge pin 검수 도구가 필요하다.

동일조건 프롬프트 비교는 별도 Lab `4a81421575e94d0fbd02217c8e98d755893e5095`의 [원문·판정·제한](https://github.com/aresjoo/tesia-lab/blob/4a81421575e94d0fbd02217c8e98d755893e5095/server/qa/prompt-comparison.json)을 따른다. 원본9fb/후보417의 7사례·18실응답과 personal(1) 실제 Opus5.5 독립 검수, AGY3.8 요청의 좁은 일관성 검토를 수행했다. 개선본6선호/1동률은 제한된 CLI 결과이며 문장 수 위반·비용설정/외부검증 혼동·장문/내부명칭 잔여와 기존4FAIL을 유지한다. 전체 우월성·실SDK/API·모델품질·서비스 GO가 아니다. AGY의 전체응답 검토 timeout은 PASS로 계산하지 않았고 좁힌 후속만 실제 완료했다. 개발 구독 CLI는 고객 API 라우터가 아니며 유료 고객API·운영AI·주문 활성화0이다. 원본TITLE은 표시에서 제거돼 세션명으로 쓰이고 ORDER는 연결 gate 뒤 초안 카드로 소비되므로 raw태그만으로 실주문 또는 원본UI 삭제를 주장하지 않는다.

인증 journal 정리 실패/CSRF 회전의 private 합성 후속은 원16+신규4=단일20 PASS이며 EMAIL/HANDOFF·실OAuth·Safari·전체 원본 배치/모션·전 문장·3,000명/전체서비스 검증은 남는다. 실제 운영 AI는 gateway 없는 offline compiler이고, 원Lab Anthropic API/SSE·개발 구독 CLI는 다른 경로다. OpenAI HTTP API 준비 코드도 운영 adapter에 연결된 상태가 아니다. 현재 상세 권위는 `candidate.currentPublicSvgEdgeIsolation` 및 [누적보고서](react-app/Bugfix_report.md), 이전 인증 배포는 `candidate.currentAuthRecoveryLowThreeCandidate`를 따른다. 기존 candidate/FAIL/HOLD/730일과 원본 source는 보존하고 부분 PASS를 전수·실서비스 완료로 합산하지 않는다. 아래 다른 source·최신·미배포 표현은 당시 이력이다.

후속 최신 snapshot은 통합 `753e61a`의2356파일/33,504,255bytes/SHA `dc719ce1`이며 sync/verify0·dirty/삭제0입니다. 문장 어순/CJK강조/foreign 이미지alt의작은8src/3spec를원문/수치/인증권위변경없이추가했습니다. static후속46a62는 관련26PASS·lint/typebuild0·compiled3폭105routes/42CTA/GET813 exact까지검증했으며현재운영eeb61과구분합니다. 새release검수/승격중상태는 `candidate.currentLocalizationSentencePolish`를따릅니다. 아래3c88/2352는직전초기7언어운영전달기록입니다.

이번 전체 전달은 통합 `3c88b77e359cbdbeef5e7d257fbdcd62b160b629`의2352파일/33,468,492bytes/snapshot `c0c36d01`입니다. sync/verify actual0·원root9fb/Node·Worker·main/이전candidate/실패 이력·삭제경로0입니다. 별도 static `eeb61d82`의7언어 푸터/Powered by·공개/정책/설정/연구/차트/source예시/용어/48이미지는 **teth.ai 반영·공개 확인 완료**입니다. actual personal1 Opus5.5 정적releaseGO C0/H0/M2/Low8·352입력·배포7단계0·8d36 CAS/backup·공개7언어×3폭105routes/42CTA/GET805 exact·오류/overflow/mutationWS0 및 별도이미지HTTPS48 exact를 결속했습니다. 원KO/SVG/흐름/숫자/저장/인증/API/flags는 유지하며 통합 authFIX는 운영밖입니다. 문장어순/CJK강조/이미지alt 후속·전 문장 원어민 의미감수/실서비스는 별도 잔여입니다. 최신상태는 `candidate.currentCompleteStaticLocalization`; 아래는각직전이력입니다.

현재 전달은 통합efe7b23 전체2250파일/26515603bytes/snapshotea764ae7 sync/verify0·dirty/삭제경로0이며 별도static8d36의 메인 우측 scrollbar 숨김을 teth.ai에 반영했습니다. 실제운영source8d36과static문서8abe6b6/Program63f6408를 구분합니다. public1440/390/320 3PASS/actual0·소개/메인wheel/실키보드End/Home/정적bytes일치, personal1 actual Opus5.5 C0/H0/M0/32입력·CAS/원자교환/backup·배포7단계0입니다. 카피/SVG/geometry/overflow/auth/API/flags 불변, 통합인증FIX·실provider/서비스GO는미완료다. 정확출처/원FAIL/Low6는 `candidate.currentHomeScrollbarRestoration`와누적보고서가소유하며아래c34/1023은직전전달이력입니다.

최신 전달은 통합 `1023bceec392e7c75afd56fb1f4dad63f4c86cd6` 전체2250파일/26512904bytes/snapshot0405c24b이며 sync/verify actual0·dirty/삭제경로0입니다. 승인된 UI-only source `c34a21066ce2aed4f26e6eab4a02ff7adce8c7f9`는 **teth.ai 운영 반영·공개 확인 완료**입니다. 문서HEAD staticac4f776/Program5c91a11과 실제운영source를구분합니다. 공개3폭3PASS·7언어CTA42동선/5페이지15관측·overflow/오류/외부/mutation/WS0, personal1실제Opus5.5 정적releaseGO/34입력과CAS/원자교환/backup을결속했습니다. 운영인증3파일/SDK/API/flags는b7불변이며통합인증수정은미배포입니다. 정확한원FAIL·56raw결속한계·실서비스NO_GO·추가확정비KO푸터/Powered by 차이는 `candidate.currentUserApprovedSourceUxTest`와 [누적보고서](react-app/Bugfix_report.md)를따릅니다. 아래미배포·운영b7표현은직전이력입니다.

최신 추가 수정은 통합 source `2cb3e9d203b7bec08a1bc1de87392324cb623033`의 전체2250파일입니다. 최종 원문 버튼의 실제 행동을 oracle로 삼아 비회원 제자리 signup을 복원했고, 인증 응답 대기 중 이탈·명시 복귀 후 busy/loading/초점 잔류를 교정했습니다. 인증 최종78 PASS와 소개56 PASS는 별도 부분 검증입니다. 최초 Opus HOLD·후속 코드 GO·모델freeze밖 ROOT 후속과 원RED/하니스 오류는 [누적 보고서](react-app/Bugfix_report.md) 및 `candidate.currentRootCauseTransitionFixes`에서 구분합니다. 이전 whole/build/배포 수치를 이번 입력으로 승계하지 않습니다.

이 snapshot은 **통합 후보 코드**이며 teth.ai 운영은 source `b7a7c58` 그대로입니다. UI-only static `c34a210`과 auth guard `add4d0f`는 별도 branch로 실제push했고 static에는 인증3파일 변경이 없습니다. Native 회원 진입의 연결/구독 producer는 표시 accounts 배열로 추정하지 않습니다. 새로운 auth/provider·실주문 활성화, 원본 main/Node/Worker 병합·배포는 없습니다.

최신 React 출처와 전체 파일 해시는 [migration-manifest.json](migration-manifest.json)을 따릅니다. 통합 `agent/web/help-policy-link-parity`의 코드·시험·문서를 전달하며 통합 인증 교정과 원문 푸터를 보존합니다. 별도 승인된 정적 UI26(source `8a757a5`)은 **teth.ai에 배포하고 공개 확인까지 완료**했습니다. 현재 운영은 기존 인증·운영 푸터·API·flags를 유지합니다. 정확한 범위와 증거는 `candidate.currentStaticUiPromotion` 및 [Bugfix 보고서](react-app/Bugfix_report.md)를 따릅니다.

**현재 운영은 협의된 원본 푸터를 복원한 테스트 화면 sourceb7a7c58**입니다. `Bitget이 선정한 최고의 AI입니다.`와 한국어 소개·권한/중지 설명3값을 원문대로 반영했습니다. 다른6언어·디자인·인증/API/SDK/flags는 변경하지 않았습니다. 관련12PASS/12.9초·lint/type/servicebuild0, actual personal1 Opus5.5 GO C0/H0/M1(기존 소유 위험), 25inputs/freeze exact와 실제 원격 실행0·공개1440/390/320 단일3PASS/actual0·각GET48 exact를 확인했습니다. 정확한 배포는 `candidate.currentUserApprovedFooterTest`가 소유하며 기존5f 소개·8a·7dd·HOLD는 이전 이력입니다. 원본 ares UX를 기본으로 필요한 backend 연결을 맞추되 실제 데이터·승인·주문 의미론은 유지합니다. 실제 provider·주문·전체 연결 완료는 아닙니다.

원본에 실제 AI가 없다는 설명은 교정했습니다. 원본 `server/index.mjs`·`server/worker.mjs`의 Anthropic/SSE/tool과 브라우저 `/api/chat` 경로는 보존돼 있습니다. 현재 React Native의 v3 API와 Main fixture는 다른 소비 경로이므로 이식 연결 차이를 별도 추적하며 원문의 디자인·카피를 바꿔 숨기지 않습니다.

아래 전수·빌드·모델 수치는 부모 입력의 이력입니다. 새부분 검증을 이전 전체 PASS로 합산하지 않습니다. 기존 인증 교정을 제거해 합격 후보를 만들지 않으며 부모의 권위 범위 HOLD도 유지합니다. 푸터 카피는 Bitget 선정·실주문 가용성을 증명하지 않습니다.

최종 단일549spec/15,302키 전수는 **15,284PASS/1FAIL/원17SKIP/actual1**로 종료했다. 미실행·중단·retry·flaky·시험밖오류0이며 원 copy-trading 동적 import GC 실패와 raw/receipt/log는 불변으로 보존한다. 해당 시험만 초기 확보한 실제setter bridge의 동기반복호출으로 교정한 후 동일40키 전체가40PASS/actual0(67.9초)다. 원14제목·147단언·언어7·DOM/원장·요청·손익색·USDT 조건은 유지했다. 이40을 전수PASS로 합산하거나 GC 근본인과를 폐쇄하지 않는다. 후속 전체 실행0이다.

ROOT PM의 unchanged-product 배치 증거 적용과 정본§0.4·REPOSITORY_GOVERNANCE 경계에 따라 역사 전수와 exact 영향40을 별도 결속합니다. 전체PASS나 실제 서비스 승인이 아닙니다. 이번 UI26 정적배포는 개인1 실제 Opus5.5 GO·원자적 고정 디렉터리 교환·backup·공개3폭/4문서/350자산 확인을 마쳤습니다. 점검503/재시작을 사용하므로 무중단 배포는 아닙니다. 실제provider·Reactprompt·거래소/주문·전체서비스 GO는 여전히 별도입니다. 원root·원FAIL·WIP·DB/730일 자료는 유지합니다.

- 먼저 [MIGRATION.md](MIGRATION.md): 원본 대비 변경, 파일 대응, 실제 연결 범위, 미완료 사항, 검증·누적 갱신 방법.
- [react-app/](react-app/): 로컬 통합 작업본의 프론트 코드·자산·계약 소비 코드·테스트 전체 스냅샷.
- [migration-manifest.json](migration-manifest.json): 정확한 출처 커밋, 캡처 시각, 미커밋 변경 목록, 전체 파일 해시.
- 루트 `index.html`·`about/`·`download/`·`policies/` 등은 원본 비교 대상으로 유지합니다. React 앱은 `cd react-app && npm ci && npm run dev`로 실행합니다.

이 브랜치 push는 `main` 병합이나 자동 배포를 실행하지 않습니다. 사용자가 별도로 요청한 `teth.ai` 정적 프론트 업데이트는 [검증 기록](migration-verification.json)의 배포 상태로 구분합니다. 루트 원본·server/Worker 및 투자 프롬프트 draft `8646b65`는 이번에 병합·배포하지 않습니다. Apple·이메일 선택지는 유지하되 현재 서버에서 미연결인 방식은 ‘준비 중’으로 표시합니다.

최종2225/9b2 입력의 원문10키는6PASS/4FAIL에서10PASS로 복원됐고 이를 포함한 관련4spec82개도82PASS/actual0입니다. 같은 입력의 lint·공개/내부/service3build actual0, 원문·시험 독립 대조 및 실제 personal(1) Sonnet5.5 `COPY_CODE_GO`/C0H0M0/Low8·가설5를 확인했습니다. 추가 Native 기능은 복원 배치에서 제외·원복했습니다. 작은 수정마다 전체 회귀를 반복하지 않고 구간별 병렬 복원·관련 시험 후 최종 배치에서 필요한 전체1회를 수행합니다. 부모d11d 전수69219는 다른 입력의15,097PASS/152FAIL/기존17SKIP/후단미실행6/actual1로 종료했고 실패 원인은 미확정으로 보존합니다. 최신 기록은 `candidate.currentHypothesisOriginalReply`와 [Bugfix 보고서](react-app/Bugfix_report.md) 최상단입니다. 전체·서비스·운영GO나 전페이지 동일성을 주장하지 않습니다.

이하 시험 수치와 ‘현재’ 표현은 이전 입력의 누적 인수 이력입니다. 부모314304의46카피·878검증은 `candidate.currentApprovedCopyRestoration`에 보존하며 현재bd2 전체검증으로 승계하지 않습니다.

부모 source9d/2212/4f0의 단일539spec/15,026개는 15009PASS/0FAIL/원17SKIP/미실행·중단·retry·flaky·시험밖오류0/actual0로 종료했습니다. 이 전수를 최신 카피 입력의 전체PASS로 승계하거나878과 합산하지 않습니다. 이전68/26/390과 모든 원FAIL/Low·미확정 GC인과는 별도 이력으로 보존합니다. 정적 프론트 승격은 최종정적 release 검수·정확한 archive/권위CAS·공개smoke·원자적전환/롤백 확인 전 HOLD입니다. 실제 로그인·React 프롬프트·전체 서비스 승인은 별도이며 실 OAuth 미검증만으로 모든 정적 UI 승격을 금지하는 정책은 아닙니다.

**직전 운영 이력:** teth.ai의 이전 정적 출처는 `7dd066f`였습니다. 현재는 위 UI26(source8a757a5) 선배포 상태를 따릅니다. [검증 기록](migration-verification.json)의 통합 스냅샷과 실제 운영 출처를 구분하세요. 실제 공급자 인증 완료·프롬프트·거래소/주문 활성화·전체서비스 완료로 확대하지 않습니다.

이전8197에서 발견한 French320의 두 행 인증 배치 회귀와861의 복귀 버튼 가림은 현재 CSS 두 항목으로 교정했습니다. 원 신규48의16PASS/32FAIL을 보존하고 같은48키와 기존20키의 단일68PASS에 결속했습니다. 실제 hero 질문 한 번·선언 합성 CREATE/TURN으로 대화 뒤에도 계정 문서 진입과 강제클릭 없는 복귀를 검증했습니다. 다른 장문 번역·glyph 잘림·실Safari 및 원 계정 정책 동등성은 Low/미검증으로 남습니다.

이전 Node 반례에서는 로그인 패널 컨트롤러의 Google/Apple 세션 확인이 revision 불일치를 수용했습니다(4controlsPASS/2FAIL/actual1). 현재 스냅샷에는 해당 소비 guard 교정과 이전입력 단일578PASS가 포함되어 있습니다. 원FAIL은 이력으로 보존하며, 현재도 미수정인 경로라고 표시하지 않습니다. 이 교정이 실제 공급자 로그인 성공을 증명하지는 않습니다.
