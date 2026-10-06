# 클라이언트 원본 → React 이식 변경 안내

## 1. 이 브랜치가 전달하는 것

클라이언트 에이전트가 원본의 디자인·문구·동작을 기준으로 React 구현을 판단할 수 있게 **원본과 현재 코드, 차이 및 잔여를 함께 전달**한다. 프론트를 새로 디자인하자는 제안이 아니다. 원본 동작과 다르면 계약상 필요한 차이인지, 미이식·회귀인지 먼저 구분한다.

| 기준 | 이번 전달 |
| --- | --- |
| 대상 저장소·브랜치 | `aresjoo/tesia-lab`의 `migration` — 원격 `main`에서 분기 |
| 클라이언트 원본 | `9fbff821df62cad11d026022fc7628c7fcebc431` — 최초 전달 시 원격 main과 같음 |
| React 출처 | `agent/web/shared-menu-ime-parity@e44867b6bfdd76f1aed4753951461236ea31767e` 전체. 부모4af 위 공유 메뉴 KO원문2개·Main 연구IME229 guard만 변경. 구간검증·타입/lint/3build actual0, 새whole/운영0 |
| 정확한 스냅샷 | [migration-manifest.json](migration-manifest.json)의 `sourceCommit`, `capturedAt`, `sourceDirtyFiles`, `snapshotDigest` |
| 현재 제품 상태 | 원본 이식·미병합 거래소 연결 후보 위에 UI·탐색·접근성·인증 가용성 교정 추가. 코드 전달, 클라이언트 main 병합, 정적 화면 배포와 실제 서비스 승인은 별개. 거래소 연결은 기본 비활성화 |
| 코드 외 로컬 자료 | `node_modules`, 캐시, 빌드 결과, 실행 로그, DB, credential, 다른 작업본, 적용 전 비공개 QA 후보는 포함하지 않음 |

`sourceDirtyFiles`가 비어 있으면 캡처 당시 추적 파일은 출처 커밋과 같다. 값이 있으면 해당 파일의 미커밋 변경까지 포함한 스냅샷이며, 그 변경의 완료·검수 통과를 의미하지 않는다. 진행 중인 다른 작업본을 임의로 섞지 않는다.

### 최신 전달 — 공유 메뉴와 연구 입력

전체2240파일/26314982bytes/snapshot `026c1ca08906fb226edbd02ad7279104c40b26d138b52c2800fc5f3f08a5bf35`다. source dirty/deleted/이전경로삭제0·sync/verify actual0이며 원본 root/main은 보존한다. 메뉴 `고객센터`·`앱 다운로드`만 원문으로 맞추고 다른6언어의 기존 번역·콜백/계정조건은 유지했다. 연구문서 입력의 원IME229 조건 누락도 복원했다. 두 제품파일의 역치환은 부모4af와 byte-exact이며 인증 controller/API/SDK/flags 변경0이다.

메뉴 첫 회차 desktop14PASS/mobile 준비오류14FAIL은 보존했다. 신규시험의 초기drawer/초점 준비만 바로잡아 mobile14키만14PASS/28.54초로 확인했으며 새 단일28PASS가 아니다. 연구 첫 신규8+인접20은26PASS/2신규조합하니스FAIL이었다. char event 준비를 교정한 신규8만8PASS/8.82초이고 인접20은 기존 회차 PASS를 유지한다. 관련lint·한 번의 타입검사·공개/내부/service3build actual0, 새whole/model/실provider/운영0이다. Native 메뉴는 controlled 실제셸 표시이며 실인증 증거가 아니다.

Native 완료보고서의 단일 SDK reader→Portal→Document→report slot은 이미 연결돼 있으므로 중복adapter를 만들지 않았다. Hypothesis/Critic/연구팀의 실제 producer 미공급과 원문복원/완료보고서를 구분한다. 원FAIL·이전current19객체·역사와 별도staticc090/푸터 사실확인/정적승격HOLD를 유지한다. 정확한 이번부분 근거는 `candidate.currentSharedMenuResearchIme`와 `react-app/Bugfix_report.md`다.

### 이전 전달 — Native 이메일 폼 원문

전체2238파일/26289697bytes/snapshot `31aa395f5a48ca8dda4b354da9e7e4db5d9ac50da85e7ae82b39585788350d8c`다. source dirty/deleted/이전경로삭제0, sync/verify actual0다. 인증 동작을 바꾸지 않고 원본 `계속`·`이메일 다시 보내기` 7언어 및 중국어/스페인어 이메일 라벨23literal만 맞췄다. 기존4spec의14 selector 이름만 보정하고 부모공급 재전송 안내·기존 단언은 보존했다. 원문전용4PASS/2.82초, locale16PASS/9.16초, 기존consumer100PASS/42.53초·관련lint/service build actual0다. 최초 환경 변수명 불일치는 로그를 남기고 실제소비 이름으로 Vite 패키징만 교정했다. 새whole/실provider/운영0이다.

운영Google-only에서는 이메일 경로가 비활성화이므로 공개에23문구가이미나타났다는 뜻은 아니다. 인증3선택지·초안/서버오류·배송상태·계약·flags는 유지했다. `code.sent/resent`는 Main 동적 참조가 있으므로 미사용 삭제근거가 아니며 Native는 별도 서버상태를 사용한다. 별도 정적copy7dd 후보의 footer사실확인/가시Mock 카피권위HOLD는 그대로다. 이전current18 객체와 운영이력은 바꾸지 않았고 최신부분근거는 `candidate.currentNativeActionCopy`다.

### 이전 전달 — 이름변경과 다운로드

정적승격의 별도카피후보는 [Web static-copy-release](https://github.com/beak1011/tesia-web/tree/agent/web/static-copy-release) `c0907e0f3af7c3aef7b32323c2b4c7f573c09460`다. 운영7dd에서 제품7파일만 분리하여 인증/API/SDK/flags를그대로유지했고 최신통합0f의인증fix를삭제하지않았다. 관련160PASS/33.86초·lint/servicebuild0·compiledNative3폭3PASS/183GETexact를 확인했다. 49원문 전부가Native소비인것은아니다(공용14+연구1+KOfooter3 조건부소비). 원문footer의실거래/선정주장과 가시Mock안내 부재의카피권위HOLD를유지하고 선반영방향을사용자에게확인중이다. `react-app/` 전체스냅샷은0f 그대로이며 후보검증과권위는 `candidate.currentStaticOnlyCopyCandidate`가구분한다.

전체2237파일/26280108bytes/snapshot `33b3b9dd16ba15b426f7b33c12a5e7522a051f97fe2ca00887f7faf04d84e100`, syncverify0·dirty/deleted/이전경로삭제0다. Main SessionMenu 원문 성공안내를 저장성공시에만복원하고 Download의22px로고/Apple색/28px모바일SVG·6언어header CTA를원본과맞췄다. 기존6+신규4의10PASS 및7언어×2폭×2project28PASS·lint actual0, 원RED와준비오류보존이다. 새build/whole/운영0, 부모a8빌드는이전입력의근거다. Native/store/API변경0·인증분리/정적승격은별도검증이며최신증거는 `candidate.currentMenuDownloadParity`다.

### 이전 전달 — 푸터 원문과 선택·입력 교정

전체2,236파일/26,262,053bytes/snapshot `56f1a38f9319b1fae3160ab7525db0ec4483336fdee2edeeee733ae21b63266b`, dirty/deleted/이전경로삭제0, sync/verify actual0다. 사용자 지정 한국어 푸터3literal(저작권 unchanged), Native sidebar Promise 반환, globe 최종원문키, Conversation IME229/속성만 복원했다. 원문 구조·SVG·CSS/API/권한/flags/730일 변경0다. 다른6언어 푸터 복원은 아직 아니다.

각 대표RED1을 보존하고 관련GREEN20/4/14/12 actual0를 각각 인수했다. 모인 입력의 lint/공개·내부·service3build actual0, 작은 personal(1) Sonnet5.5 SCOPED_CODE_GO/confirmed[]·Low6/가설5다. 새whole/운영0 및 기존auth권위HOLD를 유지한다. 출처11staged secret scan actual0/findings0, 부분시험과 출력 digest 방식은 `candidate.currentSidebarFooterParity` 및 React Bugfix 보고서에 기록했다. 원문 카피는 Bitget 선정·실주문/전체서비스가용성의 증명이 아니다.

### 이전 전달 — 원본 도움말 제목 장식 복원

전체2,234파일/26,238,523bytes/snapshot `ea0ae13e751248b110890f6625429ea11e8b8001b269ace34be315103cb28b98`이며 dirty/deleted/이전경로삭제0, 제공 sync/verify actual0이다. 공유 도움말 제목에 원9fb의 빈 장식 i(aria-hidden)·8px 원형·gap7만 복원한다. 원문·SVG·색상 의미·44px 닫기·인증/API/SDK/flags/730일 변경0이다.

Main/Native×320/390/1440px의 같은12키는 RED12FAIL→GREEN12PASS/actual0/15.87초다. ROOT가 diff/시험/raw/모바일PNG를 확인했고 해당 lint 및 staged5 secret scan actual0/findings0이다. 자세한 검증은 `candidate.currentHelpDecorationParity`와 React Bugfix 보고서 최상단을 따른다. 새build/whole/모델GO/운영변경0이며 최종 배치 빌드가 남는다. 이전 빌드 해시는 historical parent로만 표시한다. 부모 인증 교정과 원FAIL/HOLD·이전검수 객체를 보존하며 작은 복원마다 전체 회귀를 다시 돌리지 않는다.

### 이전 전달 — 원문 복원 배치 종료·영향 시험 증거 결합

source `4b77b8702e2419bd174bc2133d31df8ed5ea425f`의 전체2,233파일/26,226,125bytes/snapshot `2c2a0ac952e1420340c3515b3532da00fd3873f1a3814391d3e5de1ba66c3fba`를 전달한다. 미커밋·삭제0이며 직전84e 대비 시험1·MD2만 바뀌었다. 제품 src·의존성·공개/내부/service3출력은 원84e와 byte exact다.

최종 단일549spec/15,302키 전수는 **15,284PASS/1FAIL/원17SKIP/actual1**로 종료했다. 미실행·중단·retry·flaky·시험밖오류0이며 원 copy-trading 동적 import GC 실패와 raw/receipt/log는 불변으로 보존한다. 해당 시험만 초기 확보한 실제setter bridge의 동기반복호출으로 교정한 후 동일40키 전체가40PASS/actual0(67.9초)다. 원14제목·147단언·언어7·DOM/원장·요청·손익색·USDT 조건은 유지했다. 이40을 전수PASS로 합산하거나 GC 근본인과를 폐쇄하지 않는다. 후속 전체 실행0이다.

ROOT PM의 이번 배치 한정 Decision에 따라 역사 전수와 exact 영향40을 별도 결속했다. 이는 Governance 문언의 직접 적용·일반 선례·공용 서비스 합격 기준 변경이나 전체PASS가 아니다. 개인1 실제 Opus5.5/high의 단일 최종 검수는 actual0·입력불변·모델일치이나 **STATIC_UI_RELEASE_HOLD/C0/H0/M1**이다(receipt `1811cf868a14da790e5ee931f5fe8c2ddf8139a97fcc6be54e69b3c86686e741`). M1은 복원 오동작 확정이 아니라 정적 시각·카피 예외에 OAuth 복귀/session/revision fence 변경까지 누적 포함한 권위 범위 불일치다. 인증 변경을 별도 배치로 분리하거나 별도 권위 및 실제 provider 복귀 검증이 필요하다. 이에 따라 최종 gate/archive/CAS/공개smoke/활성화0이며 운영7dd를 유지한다. 이 문제 때문에 whole나 빌드를 다시 돌리지 않았다. Main 복원을 Native producer 연결 완료로 승계하지 않으며 Google·Apple·이메일 선택지, 원root·운영9객체·DB/730일과 실제 서비스NO_GO를 유지한다.

검증 원본은 `candidate.currentRestorationBatchEvidence`의 역사 전수(raw e867abaa/receipt7b480876/log9fef2cc4)와 후속40(raw efbc0a89/receiptab8276b4)에 각각 결속한다. 그 객체의 PENDING은 최종 검수 전 캡처 상태이며 최신 판정은 `candidate.currentRestorationReleaseReview`가 명시한다. 이전 `currentCompletedBacktestReply`와 다른 `current*` 인수 객체는 당시 입력 그대로 보존한다.

### 이전 전달 — 가설 질문 답변 원문 복원

source `5510b8fe729439979e3438ecea7f0d1253678740`의 전체2,232파일/26,194,513bytes/snapshot `cd1e933b2a420f693bd2b83e841ee3036c98c217265b9d2afe49365cd22fed28`다. 미커밋·삭제0, 직전c080 대비 제품1/신규시험1/README·Bugfix2의4경로만 바뀌었다. 원9fb11884의 `Research 구간과 Holdout 구간` 및 `결과는 Backtest, Holdout artifact에서 확인하십시오.`를 Hypothesis 답변에 그대로 계승한다. 기존 본문과 같은 문구이며 전체gSend 이식을 완료했다는 의미는 아니다.

신규5제목×양project10키의 원RED6PASS/4FAIL을 보존하고 같은시험10PASS/actual0, 포함4spec82PASS/actual0, lint·공개/내부/service3buildactual0를 확인했다. 신규10을82에 중복 합산하지 않는다. 공개bundle만바뀌고내부/service는부모c080 exact다. 독립원문·리터럴역치환·raw/list 검산747d82bc, personal1 실제Sonnet5.5 COPY_CODE_GO/C0H0M0/Low8·가설5는 국소범위다. 추가Native검증행은privatepatch/spec 복구보존·제품원복하여이번전달에포함하지않았다.

사용자 지적에 따라 남은원본차이고정목록/파일별단독writer/독립구간병렬복원/각영향시험/최종복원배치필요전체1회의순서를따른다. 작은복원에whole·추가기능을계속붙이지않는다. 별도부모d11d 전수69219는15,097PASS/152FAIL/기존17SKIP/후단미실행6/actual1로끝났다. 실패8파일의제품/환경/하니스 인과는미확정이고미실행6을정상SKIP/PASS로세지않는다. 원receipt41be761d/raw8927f84f/독립bbffcf15를보존하고이번후보전체PASS로승계0이다. 최신 `candidate.currentHypothesisOriginalReply`가 정확한범위·잔여를소유한다. 원root3759·운영9객체·서버DB/730일·teth.ai7dd를보존하며정적활성화0/HOLD다. 아래는이전입력의인수이력이다.

### 이전 응답 중 전송 원문 안내 복원

source `c0805540d0ff13daf7a57be535ec0bb072e0ef7a`의 전체2,231파일/26,176,802bytes/snapshot `44315913c7af053db2b9dd99f1aa97dd0c8a23c7cfbfe0e932427dfeb9294c37`다. sourceDirtyFiles0·삭제0이며 직전d11d 대비 제품2·신규시험1·README/Bugfix2의5경로만 달라졌다.

| 변화 | 보존·실제 검증 경계 |
| --- | --- |
| 응답 중 전송 안내 | 원9fb index20795의 `이전 답변을 마무리하는 중입니다, 끝나면 바로 보내주십시오`. Main send guard와 Conversation의 선택적 caller-owned callback만 연결 |
| 작성·중단 유지 | 초안/value·선택 범위/focus/같은 input DOM·중복 전송 차단·응답 중단 유지. Native callback은 공급하지 않아 승인/서버 취소·입력 권한 변경0 |
| 신규 회귀 | 교정된 동일8키 RED8FAIL→GREEN8PASS/actual0. 320/390/1440 및 keyboard/late response/queue guard. 실제 API/provider 대신 명시 preview fixture |
| 기존 영향·빌드 | 동일2224/cc0 입력에서 기존106+신규8의 단일114PASS/actual0. lint·공개/내부/service3build actual0. 공유 Conversation으로 세 bundle은 모두 달라짐 |
| 독립 검수 | readonly 제품·8키 d92ecb5d 및114/build dd43da30. personal1 actual Sonnet5.5 BUSY_SEND_FEEDBACK_CODE_GO/C0H0M0, Low7/가설5는 남김 |

첫fixture의 prefix 교체로 생긴2PASS/6FAIL과 ROOT의 guard 잘못 배치0PASS/8FAIL은 원자료로 보존한다. 제품 검증/기존 단언을 완화하지 않고 각각 fixture 한 리터럴 및 정확한 함수 context만 교정했다. 새 카피·색상·SVG·CSS·버튼 배치·로그인 옵션·SDK/API·가격·flags·권한·provider·서버DB·730일 변경0이다. 소스5 staged secret scan8.30.1 actual0/findings0·예외추가0이며 전체 서비스 승인으로 확대하지 않는다.

당시 부모d11d/2223-b6c의 단일546spec/15,272 전수69219는 진행 중이었다. 이후 actual1 종료 수치와후단미실행은위최신절을따른다. 이114는새후보전체검수로승계하지않고 원 전수 FAIL/Low/GC 인과를면제하지않는다. Native pending 초안·7언어 literal·실AT/Safari·빈초안/queue/unmount와실provider/React producer 등은별도잔여다. 운영teth.ai7dd·원root3759/배포9객체는유지하고정적패키징/활성화0·HOLD다. `candidate.currentBusySendFeedback`는당시인수이력으로그대로보존한다.

### 이전 d11d 연구 질문 원문·시험 경계 교정

source `d11d3c178eeca77d9e0f3b61897bf0ab8a33a07d`의 전체2,230파일/26,157,052bytes/snapshot `9b34da1ae92cead7559babf18ac9239fd72f7c72a3d52edb6db4047a32354470`다. sourceDirtyFiles0·삭제0이며 이전7233 대비7경로만 달라졌다. 새 디자인이나 카피를 창작한 변경이 아니다.

| 변화 | 실제 적용·보존 경계 |
| --- | --- |
| 원 질문 답변2 | 고정9fb index20884의 미검증 안내·20891의 완료 report 일반 요약. 기존 발행 v2/holdout fixture와95초 완료 조건을 사용하며 미완료 문서·수정/왜/위험·supplied 답변은 기존대로 유지 |
| 기존 결과 유무 | Main이 선택되지 않은 기존 inline 결과도 boolean으로 전달. 기존 결과를 결과 없음으로 안내하지 않도록 제한; 실제 Native 데이터·주문 권한 변경0 |
| 하니스 두 경계 | clock 공용 API 준비+10과 조회 baseline 보강, 실제 preference setter의 기존 static bridge 동기 호출. 원시간/제목/모든 단언/SDK401·403/7언어/DOM identity·요청불변 유지 |
| 신규 회귀·CI 이식성 |21case×2project=42키. 고정 원문 기대값·독립 provenance와 상대 소스 URL; 로컬 원본 checkout 절대경로 제거. 정적2키와 브라우저40키를 구분 |

783bc 입력의16spec 단일398은398PASS/0FAIL/0SKIP/retry·flaky·시험밖오류·미실행0/actual0다. 원 전수 실패 두 키도 동일키 한 번 PASS 및 후단실행을 확인했다. 이후 정적2키만 교정한 최종2223/b6c 입력의 새42와 lint/공개·내부/service3build는 각actual0다. 제품·하니스·나머지40 browser본문의 byte불변을 역치환/전체역해시로 직접 확인했다. 실제personal1 Sonnet5.5 DOCUMENT_REPLY_CODE_GO/C0H0M0는 코드범위이며 Low5/가설7을 유지한다. 새공개80ea만 바뀌고 내부daf0/service8730은 그대로이므로 Native 공급응답 복원이나 운영 적용을 주장하지 않는다.

원7233의545spec/15,230 전수는 **15,211PASS/2FAIL/원17SKIP/actual1**로 종료했고 raw91b95e8f/receipt16462cf2를 보존한다. 이398/42로 전체 실패를 면제하지 않는다. 원 RED40=2P38F는8카피 mismatch와30HMR-only 집계 실패로 구분하며 전체38을 카피 결함으로 세지 않는다. 원본문·730일·SDK·가격·권한·로그인3·provider flags·서버DB·운영7dd 및9객체의 배포근거는 유지한다. 원footer 사업 약속/최초help2·aria1·다른 g-doc/실제 producer·실인증·새전수/정적승격은 별도 잔여다. 도움말은 원 최초24/7와 언어변경 후 준비안내 자체가 다른 순서이므로 전역치환하지 않는다. `candidate.currentDocumentReplyClosure`가 최신 후보를 소유한다.

### 이전 source7233 카피·Critic 인수 이력

현재2,229파일/26,129,096bytes/snapshot `9db4c398d99a20d690712df86a65f1ba05c27d6a37fd44eaa1501ec08b737929`다. 직전b236 대비9파일만 수정/추가했고 삭제0이다. 제품은 store의 직접수정2/선택안내1과 ResearchWorkspace의 Hypothesis1/Backtest출처1을 원9fb로 복원하며 Critic 답변을 기존 `criticParagraphs(review).critic`에 연결한다. 숫자·필터 적용시점·산식·원문 markup/색상/SVG·로그인3·SDK/flags/권한은 유지한다. 기존5시험의 단언 보강 및 준비3행을 포함하고 새3case×2=6키를 추가했다. 원188키를 유지한 관련194는 actual0/194PASS·lint3build/관련5시험타입actual0·실제personal1 Sonnet5.5 CODE_GO C0H0M0이며 Low7/가설4·원RED6를 보존한다. 검증 당시HEADb236 위bd2 미커밋 입력과 동일nonMD를7233으로 커밋했다.

이7233/2222bd2·3출력 동결의 단일545spec/15,230개는15211PASS/2FAIL/원17SKIP/actual1로 종료했다. 실행 시작 직후 관측 seal과 실제 종료 영수증을 구분한다. 부모notice actual1/1FAIL과 이전GC 인과미확정·푸터4/최초help2/aria1·다른 g-doc 질문별 응답 매핑은 남는다. 전페이지원문100%동일·새전수/실서비스/운영승격GO를 주장하지 않는다. 해당7233 인수 이력은 `candidate.currentCopyFollowup`, 최신 후속은 `candidate.currentDocumentReplyClosure`가 소유하며 아래 a242/100검증은 과거 입력 인수다. 운영teth.ai7dd와 원본root·배포증거9객체는 유지한다.

### 이전 sourceb236 문서 후속 이력

현재2,229파일/26,121,127bytes/snapshot `fc97b716c547c9d6f1eeab6051519ab89a312ddf099257ec7f0c806a79344948`다. 직전2d2 대비 Bugfix 보고서1파일만 바뀌었고 아래 코드·시험·빌드 입력a242는 그대로다. 보고서에 푸터 사업 소개/선정/권한/Powered by4차이·도움말 최초ko/en2차이와 별도 실패 조사 한계를 기록했다. 부모notice 전수15,218개는15,200PASS/1FAIL/원17SKIP/actual1로 종료했고입력/3출력은전후불변이다(raw393eb996/receiptc1b4639b). 일반 카피를 임의 창작하지 않되 사업상 사실·권한 약속의 미확정 차이를 자동 복원 완료로 표시하지 않는다. 전페이지100%원문동일/전체PASS/운영승격 주장0이다.

### 코드 source2d2 인수 이력

원9fb/index 기준을 유지하며 source2d2의2,229파일/26,117,656bytes를 전달한다. sourceDirtyFiles0·snapshot SHA `30ad2a882294a07a421b4783efa2e79278644f43370dffbb01c3001b410d04eb`다. 원본 root HTML/server/Worker/workflow/main과 이전 운영deployment8객체는 변경하지 않는다. 이전source775d 이후17파일을 추가/수정했고 삭제0이다.

| 변화 | 파일·보존 경계 |
| --- | --- |
| 기존 원문 안내 소비 복원 | AccountUI/Main·toast hook/CSS: 이메일 전송·재전송, 로그인·가입 완료, provider 선택 피드백. Main Mock만의 안내이며 Native 실제SMTP/OAuth 성공을 합성하지 않음 |
| 명시 입력 초점 복원 | 공용 AccountUI의 visible data-autofocus 우선·기존 일반입력 fallback. 연령 진입의 원 초점을 보존하고 키보드/설정/피드백 계약은 유지 |
| 연구 원문5곳 복원 | mock-research-preview/research-view-model/ResearchWorkspace: 손실의·손실·Holdout/Forward·완료 요약·실행 확인. 수치/필터false·true/fixture11회/공급판정·완료/등록조건 불변 |
| 테스트·보고서 | 기존대화시험 실제setter 동기위임, notice3spec·bridge, 원문3test 및 기존DOM6단언 추가, README/Bugfix. 원 assertion·timeout·retry·skip·실패 이력 보존 |

최종a242 연구 영향8spec100PASS/actual0와 같은입력lint/3build·strict3spec타입actual0, 실제personal1 Sonnet5.5 `RESEARCH_COPY_CODE_GO`/C0H0M0/Low5·가설6을 인수했다. 새공개c830만문구변경을포함하며내부daf0/service8730은부모notice와byte exact다. notice152PASS·Compiled1113 GET/로그인3폭 검증은 부모309 당시별도범위로만 유지하고 최신5문구전수로합산하지않는다. 시작전자동snapshot wrapper없는100시험의한계·정적단언/고정양수Holdout·범위밖 canned reply도보고서에남긴다.

부모309 단일544spec/15,218 전수는계속진행중이며mobile connection-status:141 callback pending[0]undefined FAIL1을관측했다. 원 trace/PNG를보존하고 클릭근처레이아웃변화와실콜백준비/guard원인을조사한다. 원전수FAIL이나 GC인과미확정·새실패를partialPASS/모형의견으로면제하지않는다. 최종전체·release모델·archive/권위CAS·공개smoke/원자적전환·rollback전HOLD이며teth.ai7dd변경0이다. 실제provider/Reactprompt/backend/거래소·주문활성화는별도계약/서비스승인영역이다.

이하 ‘현재’라는 표현·검증 수치는 각 이전 전달 당시의 인수 이력이다. 최신 출처·snapshot·후속 판정은 위표/manifest/verification의 `candidate.currentOriginalResearchCopy`가 소유한다.

### 부모 source775d 승인 카피 전달 이력

현재 source775d849의 **2,223파일/26,066,926bytes**, sourceDirtyFiles0·snapshot SHA `6b7248c250ffa0735e9197ca9ed23be1e5b743365ae819fc30794bc5412759a0` 전체를 전달한다. 이전 migration05f/source9d 이후14파일만 바뀌었다. 제품3파일의 공통24·연구예약1·연구검색빈1·한국어결제20, 총46literal을 원9fb 원문으로 복원했다. 기존5spec의26문구기대만 교정하며 나머지시나리오/단언/timeout/skip/retry는 유지한다. 신규원문Golden2spec/2fixture와 README/Bugfix 두 문서를 포함한다. 마지막신규시험의 가상알림key2값만 보안오탐을 없애는 짧은식별자로 변경했으며 실제secret·제품·원기대 변경0이다. root HTML/server/Worker/workflow/main·provider/SDK/flags·SVG/색상/배치/가격/권한 변경0, 기존 snapshot 삭제0이다.

최신2216/314304의 단일24spec **878PASS/0FAIL/0SKIP/retry·flaky·미실행·중단·시험밖오류0/actual0**와 lint3build·strictGolden타입검사·1113정적GET exactbytes·로그인1440/390/320 표시/취소/초안/focus/키보드/3선택지·보안검사0을 결속한다. 원문카피Golden114개는 정적Node이며 전체878을 브라우저라고 표시하지 않는다. 실제personal1 Opus5.5 APPROVED_COPY_CODE_GO는46제품/원문Golden89b 입력이며 이후가상key2값은 독립역치환+Sonnet5.5 CODE_GO와새314304/878으로 별도검증했다. 합성session/CSRF GET만 사용했고 실제 OAuth·Apple·SMTP·프롬프트 연결을 증명하지 않는다. 정확한 증거는 `candidate.currentApprovedCopyRestoration`을 따른다.

부모 source9d의539spec/15026 단일 전수는 **15009PASS/0FAIL/원17SKIP/미실행·중단·retry·flaky·시험밖오류0/actual0**로 종료했다. source4f0/public10c9 시작·끝 불변이고 기존17키 exact·재시작0이다. 이 결과는 `candidate.currentAccountLocaleClosure.freshWhole`이 소유하며 최신314304 전체합격으로 승계하거나878과 합산하지 않는다. 원RED32·원wholeGC1FAIL과 인과 미확정·Low를 보존한다. 현재 정적배포는 최종 release검수·archive/권위CAS·공개검증 전 HOLD다.

### 이전 source9d 계정 헤더 인수 이력

source9d의2,219파일/26,016,699bytes 전달에는 CSS auth 한 행 nowrap·Native desktop return utility60과 실제동기language setter의시험위임·신규locale48·문서가 포함됐다. 원7언어/요청2/canvas identity/wrongScope·원단언을보존했고68/26/390·lint3build·service1113/f2a263cf compiled표시·실제Opus5.5 ACCOUNT_LOCALE_CODE_GO는 각각 당시인수범위다. 새카피입력과합산하지않는다.

### 이전8197 게스트 문서 복원 인수 이력

아래는 당시 source8197/전체2,218/77f063 전달·검수 이력이다. French320/861 knownIssue는 위9d919d8 후속으로 교정됐으며 당시 실패·검수 범위를 삭제하거나 새 전체PASS로 승계하지 않는다.

| 이번 최소 복원 | 파일 | 보존한 내용 |
| --- | --- | --- |
| 게스트 문서 로그인·언어 표시 | `ClientMainExperience.tsx`, `ClientServiceExperience.tsx` | 기존 로그인/무료 시작과 desktop globe를 동일 guest marker로 표시. Google·Apple·이메일·원문/SVG/색상·SDK·기능 flag·거래소 본문/라우트 정책 유지 |
| 배너와 버튼의 자리 분리 | `client-conversation.css` | 배너 숨김 문서는 top8, 표시 중인 계정 배너는 기존 top72. Native broker header60 예약. 홈/global 배너/mobile globe 숨김 정책 변경0 |
| 회귀 방지 | 신규 `client-guest-broker-auth-parity`, `client-guest-broker-banner-parity`, `client-guest-account-banner-parity` 시험 | 원RED4·2·4의 동일키 GREEN과 기존390키/시험bytes 보존. assertion/timeout/retry/skip 완화0 |
| 출처·잔여 설명 | `react-app/README.md`, `react-app/Bugfix_report.md`, 전달 문서/JSON | 입력별 PASS·FAIL·미검증 구분. 구판 리뷰와 현 입력의 검수 분리 |

최종2211/b392f02에서 신규20개·주변390개는 각각 PASS/actual0이며 lint/공개·내부/service3build actual0이다. 같은 service1113/bc1def의1113파일 정적 GET exactbytes와 로그인1440/390/320 UI를 합성 session/CSRF GET에 한해 확인했다. 실제 provider·mutation0이며 실제 로그인 성공을 뜻하지 않는다. personal(1) 실제 Opus5.5와 최종 독립 대조는 신규 확정C/H/M0이다. 구판cc1 리뷰는 현재CSS의 증거가 아니다. 계정 딥링크의 원본 정책 동등성·대화 이후 view-briefing·중간폭/장문 locale·compiled account geometry 등 Low/가설은 남는다.

**정적 승격은 HOLD다.** 이전 source2ac의 단일535spec/14958 전수는14940PASS/1FAIL/기존17SKIP/미실행·retry·flaky·시험밖오류0/actual1로 종료했다. mobile 첫 영어 locale 평가에서 `Resulting promise was garbage collected`가 발생했고 뒤 요청 수·canvas identity 단언은 미실행이다. 동일2키 격리PASS는 환경이 달라 원인을 폐쇄하거나 원FAIL을 면제하지 않는다. 새20/390과 이전10/40/578도 합산하지 않는다. 실제 Google callback/ACK·Apple 등록/SMTP·React prompt producer·전체서비스GO는 별도 미완료다. teth.ai는 운영7dd를 유지하며 새 archive/권위CAS·공개검증/활성화0이다.

### 이전 source2ac 하니스 전달 이력

이전 readonly24표면의 raw SHA `97e2009730d681de78e02c387ad093117bfb0b744e824a103dcab1338bff9e76`에서 French320의 계정4종·첫 화면/대화 이후8표면은 두 행 auth 배치가 복귀 버튼을 가려 centerHitfalse였다. 기준source2ac의 동일조건12표면과 비교한 receipt SHA `a300b236e0b85945a8e3a8fece32a81cd4f973fc50c53e1608ee687087c64163`에서 같은320의8표면은 기준에서 정상 클릭되어 당시delta 회귀로 확인했다. auth 자체 hit·mobile globe 숨김·overflow/브라우저 오류/미선언 HTTP 요청은 정상이다. 861 home의 return는 기준에도 About 헤더링크가 가리는 기존 문제이며1440은 정상이었다. 현재9d919의32FAIL→same-key GREEN68과 인과 범위를 분리한다. 실제 대화는 명시된 합성 CREATE/TURN 응답을 사용했으며 actual model/provider 호출0이다.

아래 RUNNING 표시는 당시 실행 시작 기록이다. 그 전수의 실제 종료는 위14940PASS/1GC FAIL/기존17SKIP이며 검증 JSON의 `candidate.currentAuthHarnessClosure.whole`에 결속했다. 과거 실패와 서로 다른 입력의 범위 결과는 그대로 보존한다.

현재 전달은 source2acaa38의 **2,215파일/25,957,255bytes**, sourceDirtyFiles0·snapshot SHA `75ac8b51efdf1fc6f4274b4f528a4d0028bf86beb711effad69b124206fc05ff`다. 원 availability seam의env-read2기대를normal/returnOnly각2개총4개로 맞추고, 고정queryless callback 정책과충돌한query-bearing alias의ready기대를error/API0로교정했다. 원case/fixture/나머지assertion/timeout/retry/skip와 제품·SDK·UI·문구·SVG·flags는 그대로다. Google·Apple·이메일 모두보존·미등록방식임의활성화0이다.

새 availability10키와 service-entry전체40키는 각각 actual0/모두PASS이며 원alias2FAIL와그뒤26serial미실행도같은키로실행했다. 원full14934의14879PASS/12FAIL/원17SKIP/26미실행은보존하고부분PASS합산0이다. 최종2208/5cf9844 입력의lint/3buildactual0·public/internal/service모두이전빌드exact다. 작은personal(1) Sonnet5.5 HARNESS_DELTA_CODE_GO/확정C0H0M0/Low5와 독립검수C0H0M0를 인수했다. 새14958 단일전수는원config/8workers/4574·4575에서RUNNING이며실provider·Reactprompt연결·전체/운영GO가아니다. 상세는 `candidate.currentAuthHarnessClosure`가소유한다. 원source875/controller578과이전whole의기록은아래이력으로보존한다. teth.ai upload/activate/서버DB교체0·운영HOLD다.

정적 UI와 실제 서비스 승인을 구분한다. 정본 §0.4에 따라 사용자 승인·lint/build/E2E·공개 smoke·원자적 전환과 롤백을 갖춘 정적 Mock UI는 별도 승격할 수 있다. 지금의 정적 HOLD는 새14958 전수·최종 독립 인수·archive/기존 권위 CAS·공개 검증이 미완료이기 때문이며, 실 OAuth 미검증을 모든 정적 UI 릴리스의 보편 차단조건으로 추가하지 않는다. 실제 Google/Apple/SMTP·React prompt producer·전체서비스 GO는 계속 미완료다. 현재 공개350자산/4문서의 readonly 재확인은 운영7dd exact이며 새후보 배포 증거가 아니다.

### 이전 controller revision 전달 이력

현재 전달은 source875f1e8의 **2,215파일/25,952,769bytes**, sourceDirtyFiles0·snapshot SHA `e570b92b06bfabf99d976c6c8c58c336446c6a650388706560badf4b3f8b6c0e`다. 코드e737eb8 뒤 보고서 anchor53bytes 복원과 이전전체 종료1098bytes 기록만 추가했다. 제품·시험·빌드는 그대로다. 직전ef6e1d0 이후 제품은 `native-browser-auth.ts`의 recoverSession·acknowledge session GET 직후 기존 BRS revision equality guard2와 주석1뿐이다. 새 `native-browser-auth-revision.spec.ts`와 README/Bugfix를 함께 전달한다. Google·Apple·이메일 선택지·정상 순서·ACK/ready/transaction/key·SDK·원본문구/색상/SVG·provider flags는 유지하고 요청하지 않은 로그인 방식 제거/활성화·프롬프트 통합은 하지 않는다.

원 Node6키 RED4P2F→GREEN6P, protocol-valid desktop12키 RED6P6F→GREEN12P 후, 최종2208/a4966 입력의 원로그인482+복귀72+신규 양project24를 **단일578PASS/0FAIL/0SKIP/retry0/flaky0/errors0/actual0**로 확인했다. 같은 입력 lint·공개/내부/service3build actual0·personal(1) 실제Opus5.5/독립delta 신규C0H0M0·CODE_GO다. 불일치시 CSRF/offer를 막고 명시적 matching 재확인은 기존 ACK 맥락에서 가능하다. 원554 case키는 그대로이며 상세 raw/receipt/해시는 `candidate.controllerRevisionClosure`가 소유한다. 원FAIL과 모델Low6/독립Low2·미검증 범위는 남는다.

현재service1113/c2b7 compiled bundle도 별도7관측/actual0로 확인했다. 정상root Google·Apple·email 선택지를1440/390/320에 보존하고 normal/mismatch plain-return을1440/390에서 확인했다. source/public/service rows 전후 동일·외부/API mutation/브라우저오류0·전용4571종료다. 이는 합성GET UI검증이며 실제Google/Apple/SMTP 또는controllerACK/claim 성공이 아니다. 최초staged8 독립전달 검수의C/H/M0·Low링크1을 보존하고 이번doc-only후속으로 해당anchor를복원했다.

**운영 HOLD 유지:** 이전0a217의534spec/14934 단일전체는14879PASS/12FAIL/기존17SKIP/serial후속26미실행/actual1로 종료했다. source/public은동일하고retry·flaky·시험밖오류0다. env seam2기대4관측의 availability10건과 query-bearing auth alias의ready기대error2건은원인/하니스·제품분류를다음조사에서판정한다. 원raw/acceptance와copy원FAIL이력을보존하며 현재578의GO로 이전체를면제하지않는다. 실Google callback/Apple등록/SMTP·React prompt producer·모델/전체서비스GO도 미완료다. teth.ai의 운영7dd·historicalProduction/deployment8객체와 서버/DB/credential/730일은 그대로다. migration commit/push는 검수 가능한 draft 공유이지 배포가 아니다. 아래ef6e1d0 문단은 이전 전달 이력이며 그 RUNNING은당시기록이다.

### 이전 ef6e1d0 전달 이력

현재ef6e1d0의 전체2,214파일/25,937,205bytes, sourceDirtyFiles0·snapshotd4bfa71을 전달한다. 코드d9e5609에서 남은 controller 반례를 Bugfix 보고서에 추가했으며 제품·시험·빌드는 더 바꾸지 않았다. 직전0793737 이후 제품은 `NativeServiceApp.tsx`의 직접 복귀 GET 두 곳에 기존 meta/data revision 일치 검사만 추가했다. `native-oauth-return-revision.spec.ts`와 현재 README/Bugfix를 함께 전달하며 기존26예방시험·로그인패널·generated SDK·Google/Apple/email·flags·원본문구/색상/SVG는 그대로다. 신규10키의 RED6FAIL/4controlsPASS→GREEN10PASS를 실제 장착 반례로 확인했으며 가짜 인증이나 자동 claim을 추가하지 않는다.

최종nonMD2207/0a217 입력에서 양project 복귀72개·기존 로그인482개·원copy-management30개가 각각 PASS/actual0이고, 같은입력 lint·공개/내부/service3build actual0다. 실제personal(1) Opus5.5 REVISION_CONSUMER_CODE_GO/신규C0H0M0과 readonly 독립 delta를 인수했다. Low2·기존잔여 및 명시 ACK/세션 확인의 범위외 revision 가설은 남는다. 이 변경을 전체 로그인 경로의 완료로 쓰지 않는다. 홈·대화·설정·연구·AI 트레이딩 하단의 좁은1440/390 가시 관측은 새누락미확정이며 원본 조건을 잘못 가정한 하니스 FAIL과 정상 조건의 후속 관측을 분리했다. 전체UI/실provider 성공이 아니다.

**배포는 HOLD다.** 같은입력의 새 단일전체534spec/14934개가 원config/timeout/retry/skip 그대로 한 번 진행 중이다. 이전 corrected 전체의 copy-management1FAIL은 분리30PASS·동일키2PASS·passive8PASS로 재현되지 않았으나 인과미확정이며 자동면제하지 않는다. 현재teth.ai는7dd066f를 유지한다. 원본 main·프롬프트 draft8646b65·실공급자/서버/DB·provider flags 교체0이며 migration push는 배포가 아니다. 아래0793737/56bfde2의 수치는 이전 이력이다.

추가 H-SCOPE-1 private Node 실행은4controlsPASS/2FAIL/actual1이다. 실제 unchanged controller/generated SDK의 Google·Apple recoverSession이 meta2/data1을 받아 CSRF 조회 후 무검증 handoff offer를 반환했고 BRS는 거절했다. 실제 host mount/ACK/claim/실공급자 권한은 검증하지 않아 인증 우회나 서비스 실패로 확대하지 않는다. 이 소비 경로는 아직 제품 수정 전이며 currentRevisionConsumer.remainingAuthScopeProbe와 source 보고서에 원FAIL·준비실패2·same0a217 증거를 함께 남겼다.

기존service2aaba bundle를 재빌드 없이 loopback에서 실제 브라우저로 확인했다. 정상AUTH 복귀1440/390의 ready·session/CSRF와 불일치 거부2폭의 CSRF0/바인딩없음은 원7실행 중4PASS다. 정상root 옵션3은 이메일 native disabled를 ARIA속성만으로 잘못 검사해 원3하니스FAIL/actual1을 보존했고, 그 private 기대만 바꾼 별도3PASS/actual0에서 Google·Apple·email/SVG/준비중 상태를1440/390/320에 확인했다. 두 run의source/public/service hashes는같고 외부/mutation0·자체4564종료다. 서로 다른 기대의 결과를7PASS로 합산하지 않으며 실cookie/provider/전체·운영GO로 확대하지 않는다.

전체 전달은 migration `f387e6e32735ebb334b546e56613b8fb7fb07bac`로 실제commit/push했다. 독립 staged9와 문서후속 delta 검수가 snapshot/source/원실패·HOLD/역사8객체 보존을 확인했다. f387e6e와 별도 prompt8646의 readonly merge-tree도 actual0/충돌0/tree2510b1c이며 worktree/refs 변경·실제merge·React prompt producer 통합0다. 이 영수증 추가 문서는 코드 전달 뒤의 metadata이며 source ef6e1d0·snapshotd4bfa71은 바꾸지 않는다.

이전0793737의 전체2,213파일/25,921,574bytes, sourceDirtyFiles0·snapshot4e36bf5 전달을 보존한다. 당시56bfde2 이후 제품은 `NativeServiceApp.tsx`/`NativeLoginPanel.tsx`의 인증 복귀·보존 controller 교정만 바뀌었고 신규 예방시험2개 및 README/Bugfix를 포함했다. Google·Apple·이메일 UI·원문·SVG·색상·가용성 flag·SDK·공용 계약·프롬프트·서버·DB는 유지한다. 일반 방문은 그대로이며 plain `/auth/complete`의 검증401만 새 익명 세션을 만들지 않고 무권한 복구 표시를 연다. 자동 START/ACK/claim/전략 승인/주문은 없다. 미확정 journal·logout/email 우선과 동일 controller의 ACK 유실/화면 왕복 복구를 보존한다.

최종2206/59de 입력의 신규26개와 기존 로그인482개는 각각 actual0/전부PASS/skip·retry·flaky·시험밖오류0이며 같은입력 lint/공개·내부/service3build actual0다. 화면 왕복의 busy 잠금은 원동일키 RED1→GREEN1로 검증했다. personal(1) 실제 Opus5.5는 인증 소비 CODE_GO/C·H·M0, Low5·가설5 및 후속시험을 남겼다. CLI 응답의 계정 상태 prefix로 생긴 최초 parser 실패를 보존하고 모델 재호출 없이 실제 result/modelUsage/입력불변을 별도 확인했다. secret scan의 합성 journal 재전송 식별자1건은 원raw actual1을 보존하고 정확한 finding만 한정분류했다. shared ignore/rule 변경0이며 raw findings0/hostedCI PASS로 쓰지 않는다.

**배포는 HOLD다.** 이전 corrected whole531/14862는14844PASS/1FAIL/기존17SKIP/actual1, 모바일 copy-management 종료 확인 원인은 미확정이다. 이전3FAIL의 동일키PASS로 새1FAIL을 면제하지 않는다. 이번 코드의 신규 whole/모바일 project·service-built return/실Google 계정·Apple 등록/SMTP·React prompt producer 통합은 아직 미검증 또는 미완료다. migration push는 원본 main 병합이나 teth.ai 활성화를 실행하지 않는다. 현재 운영은7dd066f이며 historicalProduction*·deployment 객체는 그대로 보존한다. 정확한 범위는 `migration-verification.json`의 현재 candidate와 `react-app/Bugfix_report.md`를 따른다. 아래56bfde2와 다른 입력의 수치는 이전 이력이다.

현재 후보56bfde2의 전체2,211파일/25,862,500bytes를 exact byte/hash로 전달한다. sourceDirtyFiles0·snapshot9322333이며 node_modules·빌드·비공개 QA·DB·credential은 제외한다. 이전9579 이후에는 검사2곳과 문서3개만 바뀌었고 제품·디자인·인증 SDK·provider·권한은 추가 변경하지 않았다. 운영 출처7dd066f와 후보를 혼동하지 않는다.

| 이번 변경 | 구현 위치 | 보존하는 경계 |
| --- | --- | --- |
| 게스트 인증·언어 진입점과 헤더 공간 | `ClientMainExperience.tsx`, `ClientServiceExperience.tsx`, `client-conversation.css` | 원본 일반 대화/인사이트의 desktop·mobile 표시 정책, 로그인 후 숨김, 기존 SVG·색상·문구 유지 |
| 로그인 후 미전송 초안 | `NativeServiceApp.tsx` | 동일 익명 소유자·버전·검증된 ACK/EMAIL offer에만 memory-only 복원. 저장·자동전송·자동claim·새 권한0 |
| 모바일 메뉴 클릭 영역 | `client-research-hub.css` | 실제6px 겹침만 CSS3줄 보완. 메뉴·경로·원본 디자인 보존 |
| 회귀 관측·신규4spec | `react-app/tests/` | 기존 assertion·timeout·retry·skip을 완화하지 않음. 실제 실패와 신규 검증을 분리 |

이전 입력a40의 단일155spec은4543PASS/1FAIL/기존4SKIP·actual1, 최초 전체531spec/14862개는14842PASS/3FAIL/기존17SKIP·actual1로 종료했다. 초기 연구 gap2px의 원인·scroll 작성 주체 및 차트 mount 전 GET reset 원인은 미확정이며 원FAIL을 보존한다. 하니스2곳만 교정한 새입력357의 관련3spec/60개는60PASS/0FAIL/0SKIP·actual0다. 새 전체를 딱1회 새prefix에 시작했고 완료 전 전체GO를 선언하지 않는다. lint actual0·기존 제품 입력의 build proof·Sonnet5.5 작은 하니스 정적GO는 전체 인수·운영 승인이 아니다. 이전 전체14748의5FAIL 및 원 raw 증거도 보존한다. 이번 후보 배포는 HOLD이며 기존 운영 bundle을 유지한다. Google·Apple·이메일은 공존하고 실제 provider 성공을 합성 시험으로 대체하지 않는다.

**추가 검수와 최소 교정:** 구 `client-source-parity.spec.ts:17`의 globe DOM0 단언 desktop/mobile2FAIL을 원본의 DOM1·desktop표시·860px 이하 CSS숨김으로 교정했다. 제품을 다시 숨기지 않는다. 연구 gap2px는 별도 passive17관측에서 글꼴 완료와 시간상관만 확인했으므로 geometry 측정 전 `document.fonts.ready` 1줄을 추가했다. 두 변경을 역변환하면 원HEAD의 두 파일 전체 bytes와 일치한다. strictgap<2·clock80/80/7000·다른 assertion/timeout/retry/skip은 보존한다. 차트 GET reset 원인은 미확정이며 compiled helper 수정·retry 추가0다. 새60PASS로 구FAIL을 동일계약 성공으로 승계하거나 합산하지 않는다.

**실제 로그인 인계:** Google·Apple·이메일 선택지/SDK는 모두 유지한다. 실 Google callback/ACK는 미검증이고 Apple 등록·SMTP도 완료하지 않았다. Backend157 정적 비교의 `HANDOFF_BOUND → 공개 session 401 → 새 익명 세션 bootstrap`을 모사한 private1440/390 두case는 마지막 추가 익명 생성0 기대에서 실제1로 실패했다. 그 전의 거래별cookie·result·명시ACK·AUTH세션·CSRF 왕복은 모두 통과했다. 초기 중복Playwright loader 실패0test는 별도 보존한다. 기존7dd에도 같은 경로가 있고 실제 공개 Backend pin·초안 손실·실Google는 미검증이므로 운영 로그인 실패·보안 결함으로 단정하지 않는다. 불필요한 소유자 교체 가능성은 독립 Opus 검토 및 Backend 반환 계약 확인이 필요하다. 새 SDK/공용 계약·provider flag·자동 ACK/claim·인증 권한 변경0이다.

teth.ai는 공개 HTTPS 자산350개/문서4개를 새로 검사해 이전 운영7dd066f와 exact 일치했다. 아카이브의 raw HTML과 HTTP 응답은 서버 소유 profile meta 삽입 때문에 해시가 다르며, 승인된 정확한 삽입까지 포함해 동일함을 검증했다. 다른 팀의 배포 변경으로 오인하지 않는다. 새 후보 활성화0이며 최신 범위·증거는 검증 JSON의 `readOnlyContinuation`을 따른다.

**전달·충돌·독립 검수:** source56bfde2와 migration b2fcbd0의 실제 push·원격 일치를 확인했다. 독립 staged8 검수는2211파일/25,862,500bytes/snapshot9322333·historical8객체·당시 보호3761파일 exact를 확인했으며 전달 범위의 blocking결함0이다. prompt8646과 migration b2fcbd0의 private merge-tree actual0/충돌0/tree de6f875지만 실제 merge·React prompt producer 연결은0이다. personal(1) 실제 Opus5.5는 기존 OAuth 연속성 M1과 소비코드 후속 방향을 검토하고 AUTH_HOLD로 판정했다. 이는 구현 승인이나 운영 로그인 실패 확정이 아니다. 운영 VM readonly에서는 core3파일이Backend157과 exact이고 HTTP 조립 파일은 다르므로 전체 Backend pin 동등성·실Google 성공으로 승계하지 않는다. 새 프로바이더/API/권한·서버파일/설정·DB·credential 교체0, 운영 배포 HOLD다.

아래7dd066f의 검증·배포는 **이전 운영 출처의 이력**이며 현재 후보의 PASS/배포 증거가 아니다.

이전 source 7dd066fdbaf2e51e2f61d5b200a3dff211fbbb1d는 직전 bca5a694/563b940 이후 원본9fbff 정상 가시 검색·guest 로그인/무료 시작·Native desktop sticky0·desktop globe(prop2/CSS1)만 최소 복원했다. source 중복 header/focused return, Native 자연60px flow/header64/mobiletop60, 원본 mobile globe hidden과 기존 인증·modal·색상·SVG·API·prompt·flags·가격·package·DB는 보존한다. 원본root HTML/server/Worker/workflow/main 변경·병합0이다.

새114spec 단일 3404PASS/0FAIL/기존QA-015SKIP2·flaky/retry/시험밖오류0·actual0·동결입력불변, lint/3build·built로그인3폭·fresh독립4·personal(1) Opus5.5 STATIC_UI_CODE_GO를 결속한다. baseline523/14622의14595P10F17skip/actual1과 중간112의3351P1GC하니스FAIL2skip/actual1, globe초기20P20F·원HOLD/PNG/trace는 보존하고 합산하지 않는다. auth28·negative의도tripwireFAIL4는 Chromium HTTP guard 범위이며 실제OAuth/OS-egress 승인이 아니다. 실제 활성화/CAS·권위보존·backup·public exactbytes/로그인presentation 영수증을 확인한 정적UI 반영 상태다. 정확한 SHA·bytes·분모·서비스 경계는 migration-verification.json 단일정본을 따른다.

prompt8646 별도draft·actualmerge/Reactproducer통합0·사용성4FAIL/MODEL_QUALITY_NO_GO/SERVICE_NO_GO를 유지한다. 실제Google callback/ACK·Apple운영등록·SMTP·실연구/계정/거래소/주문/과금·실기기/부하·전체서비스GO는 미완료다. H-b 즉시focus 원인은 미확정이며 추측 교정0이다. 이전 인수/실패는 아래와 Git이력에 보존한다.

이전 전달 `498dff6`의 React 출처 `061987e` 이후, 복사 호환성·터미널에서 연결 화면 왕복·연구 제목저장 실패와 FAQ 도달을 교정한 후속 변경이다. 정확한 출처 SHA·파일 수·전체 해시는 manifest와 검증 JSON이 소유한다. 이전 연구 메뉴/삭제 캐시·푸터·거래소 아이콘·필터·문서 복귀·catalogue 전체 근거와 Google·Apple·이메일 공존·거래소 연결 코드/SDK/시험은 유지한다. 패키지·lockfile·인증 권한·프롬프트·가격·기존 클라이언트 HTML·루트 배포 workflow는 변경하지 않았다. 자동 상시 동기화가 아니라 이번 요청에 따른 명시적 후속 전달이다.

| 이번 후속 변경 | 구현·검증 위치 | 원본·계약 경계 |
| --- | --- | --- |
| 인사이트 명시 링크 복사 호환성 | `client-insight-clipboard`, `ClientInsights`, source-copy 시험 | 원본 현대 API 우선/미지원·거절 때 fallback. 임시 노드·선택·초점·스크롤·옛요청 격리, 실제 초점/선택 확인 전 복사 금지. 제품 permission/read/저장0 |
| 터미널→연결플랜→뒤로 | `ClientMainExperience`, trading-plan-return 시험 | 현재 mount/owner/token의 navigation intent만 유지. 기존 catalogue/result 우선·같은 터미널 DOM/선택/기간, 직접URL/reload/로그아웃 stale 거절. 주문/인증 권한0 |
| native 연구 제목저장 실패 | `client-restored-research.css`, `NativeConversationTitle`, native-library-presentation 시험 | 기존 native본문80px·모든 헤더 조작·persistent 입력 유지. 헤더 안으로만 순서 선택자 한정하고 짧은 가로 화면 wrap 보완. disabled=false commit 뒤 초점을 복귀하고 사용자의 더 최근 입력 초점은 보존. public signed100px와 구분 |
| reduced-motion 도움말 FAQ | `client-public-pages.css`, public-faq-return 시험 | 공개 문서 subtree 전이만 제거. 라우터·타이머·카피·SVG/사용자 의도 guard 보존. 요소 존재 대신 실제 viewport128px·Back/Forward 도달 검증 |

아래 짧은 로그인 연구 화면·복사 수명·도움말 원문은 이전061987e에서 인수한 변경이다.

| 이번 후속 변경 | 구현·검증 위치 | 원본·계약 경계 |
| --- | --- | --- |
| 로그인 연구의 짧은 높이 | `client-restored-research.css`, layout-fidelity/session-menu 시험 | 알림 공간은 첫행에 예약하고 상태·탭·메뉴는 두번째행. 320/360/361/390×360에서 제목 편집·8줄 초안과 본문100px 기준 유지 |
| 인사이트 복사 결과 | `ClientInsights`, source-copy/insights 시험 | 원본 메뉴1400ms/하단1600ms/실패2000ms·메뉴유지. 늦은 결과/재열기/역순완료가 새 UI에 간섭하지 않음 |
| 도움말 본문 | `client-reference-copy.json`, help-source-copy 시험 | 한국어 한 값만 최종 원문 복원. 다른6언어·준비중 상태·지원 연결 불변 |
| 미사용 연구 코드 | `ClientResearchDocument`, 전용 CSS | caller0인 Plan/Run 두 export와 전용 규칙만 제거. 실제 Critic/Log·공유 스타일은 유지, 이전코드 Git복구 가능 |

아래 연구 메뉴·캐시·최종 원문은 이전 adc5824에서 인수한 변경이다.

| 이번 후속 변경 | 구현·검증 위치 | 원본·계약 경계 |
| --- | --- | --- |
| 연구 문서 현재 세션 메뉴 | `ClientMainExperience`, `ClientResearchWorkspace`, session-menu 시험 | 대화와 같은 메뉴·rename/delete 콜백을 선택적 슬롯으로 유지. 실제 service에 없는 권한을 만들지 않음 |
| 삭제 문서 캐시 수명 | `client-research-cache`, Workspace 및 lifecycle 시험 | 삭제 후 unmount 저장이 문서를 되살리던 결함을 entry identity로 차단. 정상 저장·동일 ID 재생성·타 세션 보존 |
| 작은 연구 화면 | `client-restored-research.css`, layout-fidelity/menu 시험 | guest320 제목·메뉴를 두 행 배치, 짧은 높이의 진행·제목 편집에서 본문100px 이상. 상태/탭/조작부 숨김0 |
| 인사이트 최종 원문 | `ClientInsights`, source-copy/insights/native-insight-presentation 시험 | 최종 원문·빈 자산 조건 복원. 동적 공급 내용·미공급/불투명 토큰 오류 의미·API·번역을 임의 변경하지 않음 |

이전 `358c53b`에서 인수한 복원도 그대로 포함한다.

| 이전 누적 변경 | 구현·검증 위치 | 원본·계약 경계 |
| --- | --- | --- |
| 7언어 공통 푸터 본문 | `ClientSiteFooter`, `client-site-footer-copy.json`, footer-content-locale 시험 | 한국어만 보이던 소개/강조/승인 안내 3문단을 동일 의미로 제공. notice 우선순위·DOM/색상/간격 보존 |
| Desktop 헤더 스크롤 | `client-site-footer.css`, footer-header-scroll 시험 | 밝은 푸터 위에 고정 메뉴가 겹치지 않도록 원본 absolute. 모바일 fixed·로그인 버튼 DOM·키보드 재진입 유지 |
| 원본 거래소 앱 아이콘 | `ClientTerminalVenueIcon`, JudgmentStatus·StrategyRail·AccountTerminal·TerminalLedger | exact22개 로컬 자산+woo 별칭, unknown/실패 fallback·ID별 오류 분리. 거래/계정 상태 추정0 |
| 내 거래소 필터 | `ClientConnectionStatus`, 해당 CSS/시험 | 최대3개·16px·선택 라벨·활성 표시, 빈 아이콘 여백 제거. eligible/권한/요청 identity·비동기 관측 불변 |
| 시험 Promise 수명 | `client-strategy-rail.spec.ts` | CDP 반환 전 Promise 수거를 막는 test-only 참조 보존. 실제 언어 setter·기존 assertion·retry0 유지 |

아래 항목은 이전 `a6e737f`에서 인수한 누적 복원이며 이번에 처음 구현한 것으로 세지 않는다.

| 이전 누적 변경 | 구현·검증 위치 | 원본·계약 경계 |
| --- | --- | --- |
| 모바일 시장 필터 시트·긴 번역값 | `ClientSharingDropdown`, 전략 필터 CSS, market-sheet/sharing-locale 시험 | 원본 모바일 시트·native dialog 닫기·포커스/스크롤 복귀, 짧은 원본 배치 유지 |
| 문서 Back·새로고침·늦은 폰트·초점 | `SiteRouter`, `ClientPublicPages`, document/history/intent 시험 | 오래된 좌표 재사용과 늦은 장착의 사용자 초점 탈취 방지, 대화 초안 유지 |
| 전체 판단·거래 상세·mini-chart | `ClientCatalogueEvidence`, `client-catalogue-backtest-evidence-*`, 원본 oracle·evidence 시험 | 원본 D/EV·필터·정렬·12/+24·그룹·거래·지표 설명 복원. 기존 계산 결과를 표시하며 engine/외부 API 변경0 |
| 차트 마커와 성능 | `ClientCatalogueBacktest`, `client-catalogue-backtest-marker-groups` | 날짜 대신 runId/eventIndex 구분, 같은 날 모든 근거 접근, 포인터/Enter·824개 목록을 보존한 재계산 캐시 |
| 지연 로딩·경로 이동 초점 | `ClientStrategySharing`, `client-sharing-lazy-return-focus.spec.ts` | 최초 같은 화면에서 이미 선택한 조작요소를 보존하되 새 경로는 제목 초점으로 이동. 서비스의 명시 초점 정책 유지 |

원본 자체의 불일치는 최소한만 보완했다: 선물 mini가 실제로 소비하는 현물 종가를 `현물 종가(참고)`로 표시하고, 이미 계산된 `d.out`으로 배지·상세 수치를 맞추며, nullable 값의 `null일`/`—일`과 잘못된 CSS scope/rgba 구문을 교정했다. 원본의 summary jump 선택핀 유지·hold 날짜 순서는 임의 변경하지 않았다. 이전 미사용 preview 문구 모듈1개와 도달할 수 없는 CSS2줄 제거는 Git으로 복구 가능하며 이번에는 추가 삭제0이다. 정확한 거래소 ID가 없는 `NativeAccountPanels`에는 이름으로 로고를 추측해 넣지 않았다.

이번 추가 범위는 AI 트레이딩 소개·로그인 전 공개 목록·헤더/사이드바, 설정·도움말·문서 FAQ/Back/스크롤 복귀, 카탈로그 페이지·키보드 초점과 Google·Apple·이메일 선택지 공존이다. 기존 Google-only 배포에서 다른 방식을 없애던 조립을 수정해 **표시는 유지하고 가용성만 제어**한다. 현재 미등록 Apple·이메일은 ‘준비 중’이며 서버 등록이나 인증 성공을 만들어내지 않는다. 상세 재현·수정·실패 이력은 `react-app/Bugfix_report.md`의 최신 두 절을 따른다.

투자 프롬프트 [draft PR5](https://github.com/aresjoo/tesia-lab/pull/5)의 `8646b65`는 별도 검증 중인 후보로 보존하며 이번에 병합하지 않았다. 새 전달 코드 `fdb1e45`와의 private merge-tree는 actual0/충돌0이며 원본 runtime·작업 tree·refs 변경0이다. 공용 설명은 실제 통합 때 의미를 다시 대조해야 한다. **파일 충돌 없음은 프롬프트 개선이 현재 React 대화에 연결됐다는 뜻이 아니다.** 이번 작업은 루트 원본/server를 변경하지 않는다.

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

공개 원본 검토 앱의 실행 경로는 `src/client-entry.ts` → `src/client-bootstrap.tsx` → `SiteRouter` / `ClientMainExperience`다. 서비스용 정적 번들은 `src/internal-poc/service-main.tsx` → `SiteRouter(service)` → `NativeServiceApp`으로 조립한다. 과거 query/hash도 원본 기반 셸로 들어간다. 정적 번들의 배포는 backend·실제 인증 공급자·모델의 전체 동작 승인을 뜻하지 않는다. 별도 DEV 검증 화면은 배포 앱과 구분한다.

## 3. 화면·기능별 원본 대응표

아래 경로는 `react-app/` 기준이다. 이는 구현 위치 안내이며 **행 전체의 원본 동등성 합격 선언이 아니다.**

| 원본에서 찾을 기능 | React에서 볼 파일 | 계승·변경 및 확인할 점 |
| --- | --- | --- |
| 홈, 헤더, 입력창, 사이드바, 푸터 | `src/components/ClientMainExperience.tsx`, `ClientChrome.tsx`, `ClientComposer.tsx`, `src/client-reference.css` | 단일 원본 셸·guest/member 분기. 회원 메뉴 연구 기록/AI 트레이딩/전략 복사/거래소 연결, 비회원 2메뉴와 새 전략 제한. 원본 SVG/문구/모바일 메뉴 동작 대조 |
| 첫 질문, 시장 대화, 전략 조건 질문 | `ClientConversation.tsx`, `ClientSourceIntake.tsx`, `src/client-experience-store.ts` | 대화 맥락과 입력 보존, 스트리밍/사고 상태 소비. 실제 응답 공급 여부에 따라 원본 offline와 서비스 경로를 구분 |
| 연구 시작·진행·문서·Critic·연구 기록 | `ClientResearchWorkspace.tsx`, `ClientResearchDocument.tsx`, `ClientResearchHistory.tsx`, `src/client-research-lifecycle.ts` | 원본 연구 표현과 문서 왕복을 이식. 설명용 단계 재생은 실제 모델 호출 증거가 아님. offline 점수 미달은 연구 진입을 합격으로 꾸미지 않음 |
| 입력한 전략의 inline/common 검증 | `ClientInlineBacktest.tsx`, `ClientCommonBacktest.tsx`, `ClientCommonBacktestChart.tsx` | 원본 첫 질문→조건 보완→검증→연구 분기를 유지하는 경로. 아래 catalogue 직접검증과 혼동하지 않음 |
| 전략 목록, 필터, 카드, 상세, 직접 검증 | `ClientStrategySharing.tsx`, `ClientStrategyListCard.tsx`, `ClientStrategyFilters.tsx`, `ClientCatalogueBacktest.tsx`, `src/client-catalogue*.ts` | 31개 설정/저장가격을 소비. `#/share/bt/:id`에서 90/365/730/전체기간과 500/1000/3000/10000 USD 재실행. 전체 판단 목록/그룹/마커 연결 복원은 이번 후속 변경과 §6의 검증 경계 참고 |
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

1. **이전 catalogue 전체 근거·마커 잔여는 이번 제품에 반영했다.** 제한된 요약을 전체 판단 목록 대신 쓰지 않으며, 같은 날 서로 다른 사건을 고유 식별자로 연결한다. 그룹·정렬·필터·추가 목록·상세 근거·mini-chart와 실제 포인터/키보드 경로를 검증한다. 이는 고정 저장자료 기반 preview이며 실제 서버 백테스트/모델의 근거가 자동 연결됐다는 뜻은 아니다.
2. **현재 검증 범위와 남은 접근성 경계를 구분한다.** 모든 마커 근거에 목록으로 접근할 수 있고 원본 그룹을 숨기지 않는다. Chromium의 desktop/mobile 에뮬레이션과 실제 포인터 시험은 실기기 Safari·모든 보조기술 인증이 아니다.
3. **전문 차트와 catalogue 결과 차트는 다른 경로다.** 전문 Lightweight Charts 코드가 있어도 모든 백테스트 경로가 그 차트/실데이터를 사용하는 것은 아니다.
4. **원본 이식 인수와 무결함/전 상태 인증은 다르다.** 출처의 단일 전체 회귀·Web52 인수는 완료됐지만 모든 62 preset 또는 모든 화면·반응형·SVG·모션 조합의 인증은 아니다. 최종 원본과 어긋난 동선은 계속 확인해야 한다.
5. **실제 모델·시장·거래소/카피·예약·과금/사용량 producer 및 운영 Gate가 남아 있다.** 프론트에서 확정할 수 없는 계약은 PM/backend와 합의한다.
6. **신규 거래소 연결 draft는 코드 포함, 정식 서비스 승격은 미완료다.** 위 PR54 head까지 전달했으며 그 이후 변경이나 실제 공급자 성공을 포함했다고 주장하지 않는다.
7. **연구·결과 뒤 대화·계정 원장 producer를 분리해 연결해야 한다.** 원본 g-doc/Critic/7역할 UI는 존재하지만 실제 service는 관측 TURN/VALIDATE만 공급한다. `NativeServiceApp`→`NativeServiceResult`의 report/trades V6 및 chart manifest/markers/window V5·replay 경로는 이미 있으며 새 차트를 중복 구현할 이유가 없다. 결과 이후 자유대화는 approval/job 입력 잠금과 `editFromResult`를 함께 설계해야 하므로 단순 disabled 제거를 하지 않는다. 실계정 account presentation은 단일 백테스트 거래로 대체하지 않는다.
8. **원본 임시 가격·복사 브라우저 경계를 구분한다.** 원본 `teth-copy.js`의 임시49와 `AC_CFG`의280이 공존하므로 React 금액을 임의 교체하지 않았다. 원본 `execCommand` fallback은 이번 명시 인사이트 링크에만 복원했다. 모든 다른 소비·Safari·긴 실제권한 대기의 인증을 뜻하지 않으며 복사 실패 안내는 유지한다.

이전 navigation 동결 전체는13,802 PASS/1 FAIL/기존17 SKIP였고 공유 복귀 실패는 후속 반례로 교정했다. 이를 전체 PASS로 바꾸지 않는다. catalogue·공유12제품의 이전 영향62spec/1,996PASS와 이번 푸터/거래소/인증22spec은 별도다. 이번 첫664개는663PASS/1FAIL이며 언어 적용 후 CDP Promise 수거로 중단된 원실패를 보존했다. test-only 수명 보강과 빈 아이콘 교정 뒤의 최종 실행·정확한 입력/산출물 해시는 검증 JSON을 따른다. 원 실패·하니스 문제·수정 검증은 `react-app/Bugfix_report.md`에 구분한다. 전체 서비스나 모든 원본 상태의 무결함 보장이 아니다.

## 7. 실행·검증

이번 후속 검증은 Node 24.14.0에서 실행했다. 저장소 루트 원본 HTML 서버와 React 개발 서버는 다른 앱이므로 포트를 나눠 실행한다.

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

Chromium이 없으면 `npx playwright install chromium`이 필요하다. 실제 backend 연결은 기존 승인된 설정·계약을 따른다. snapshot 전달 도구는 자동 로그인·API key 입력·배포를 실행하지 않는다. 별도 승인된 teth.ai 정적 업데이트는 기존 인증 authority·credential·DB·backend·feature flag를 보존하는 업데이트 절차로 검증하고 기록한다.

이번 전달 자체의 검증 결과는 [migration-verification.json](migration-verification.json)에 기록한다. 원본/출처/전달 해시 검증과 lint·build·대표 브라우저 검증을 구분한다. 출처의 전체 회귀·Web52 병합 인수는 완료됐으며, 이 브랜치는 **병합본과 신규 거래소 연결 후보를 함께 보여 주는 클라이언트 검토용 전달**이다. 기본 원본 이식의 전수 성공을 추가 연결 기능에 자동 승계하지 않는다. 클라이언트 main 병합 또는 운영 배포 승인을 의미하지 않는다.

## 8. 다음 에이전트의 검토·수정 방법

- 원본 동선으로 시작한다: 첫 질문 → 조건 보완 → 검증/연구 → 문서/결과 → 거래소 연결/터미널. 각 단계의 back·cancel·reload·계정 변경까지 확인한다.
- 1440px 데스크톱과 약 390px 모바일에서 문단/줄바꿈/그리드/입력 높이/모달/메뉴/고객지원 위치를 확인한다. 화면을 못 본 항목은 정적 코드 검토와 구분한다.
- 결함은 **재현 경로, 기대하는 원본 함수/화면, 실제 React 파일, 영향, 수정안, 실행한 검증** 순서로 기록한다. 원본 자체 Mock 한계와 새 이식 누락을 구분한다.
- `react-app/`를 직접 수정하면 다음 자동 복사가 덮어쓰지 않도록 동기화 도구가 중단한다. 그 변경을 출처 통합팀에 돌려주고 인수·재동기화한다. 원본 main에 React 코드를 자동 병합하지 않는다.
- `react-app/AGENTS.md`는 React 소비 코드의 계약·보안 지침, 루트 `AGENTS.md`는 원본 비교와 저장소 협업 지침이다. 코드/문서에 충돌이 있으면 추측으로 계약을 바꾸지 않는다.

## 9. 누적 업데이트 절차

이 브랜치가 지속 전달 창구다. 날짜별 복제 브랜치·`final/latest` 문서를 늘리지 않는다. 코드를 바꾼 커밋에는 이 설명서의 영향/잔여와 검증 JSON도 갱신한다.

1. `git fetch origin refs/heads/main:refs/remotes/origin/main refs/heads/migration:refs/remotes/origin/migration` 후 실제 원격 SHA와 비교하고 로컬 `migration`을 fast-forward 정렬한다. 이 clone의 기본 fetch refspec은 main만 포함하므로 `git fetch origin migration`만으로 origin/migration이 갱신됐다고 추정하지 않는다. 최초 브랜치 생성 전에는 `main`만 fetch한다.
2. PM의 현재 통합 작업본과 writer를 확인한다. 현재 프론트 통합 후보까지 전달하되 미병합 후보라는 이유로 코드를 누락하지 말고 상태를 구분한다. 원본 고정 SHA를 임의로 새 main과 혼합하거나 관련 없는 독립 실험을 합치지는 않는다.
3. 출처가 순간적으로 변경 중이면 캡처를 다시 수행한다. 다음 도구는 추적 파일 전체를 byte 그대로 복사하고 모든 파일의 SHA-256을 기록한다. 비추적 코드가 있거나 전달본에 별도 수정이 있으면 중단한다.

   ```bash
   node tools/sync-migration.mjs /absolute/path/to/current/tesia-web-worktree
   # 출처에서 제거한 경로를 Git index에서도 반영한 뒤 검사
   git add -u -- react-app
   node tools/sync-migration.mjs --verify
   ```

4. 변경 목록을 보고 의존성/공용 계약/화면 영향과 미완료 목록을 갱신한다. 비밀 탐지·관련 검증을 수행한다. 고객의 새 main 커밋이 있으면 별도 차이로 먼저 검토한다.
5. `git add react-app migration-manifest.json migration-verification.json MIGRATION.md README.md AGENTS.md tools/sync-migration.mjs` 후 `git diff --cached --check`와 범위를 확인한다.
6. 의미 있는 작업 묶음으로 `git commit`하고 `git push origin migration`한다. force push/main 병합은 하지 않는다. 별도로 사용자가 승인한 정적 배포가 있으면 정확한 산출물·rollback·공개 확인을 독립 기록하고, migration push 자체를 배포 증거로 쓰지 않는다.

동기화 도구는 **자동 커밋·푸시·배포·상시 감시를 하지 않는다.** 이후 작업 묶음마다 변경을 검토해 이 브랜치에 누적 반영한다. 실패한 검사나 미반영 구현을 다음 전달에서 조용히 지우지 않는다.
