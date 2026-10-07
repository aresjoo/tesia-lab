# 투자 상담 활성화 준비 — 누적 버그 보고서

이 후보의 기준은 Lab `8646b6525631d5e1f71e38a8e2e515f23571b5b5`/prompt registry1.24.0이다. 제품·권위·활성화 정본은 Program §16과 WORK_LEDGER다. 기존 공개 QA 실패는 `qa/README.md`와 원문 `qa/investment-usability.json`에 보존한다. 본 보고서의 국소 교정을 모델 품질·React 실제 연결·운영 성공으로 승계하지 않는다.

## 동일 조건 비교 — 개선점 관측, 모델 품질 NO_GO 유지

[원문과 독립 검수](qa/prompt-comparison.json)는 원9fb와 retry/번역 교정 후보417767c의 7사례·2arm·18실제 응답이다. personal(1) Opus5.5/high/tools0·동일 JSON 이력 scaffold·고정 시각·각 arm 실제 assistant 이력으로 비교했으며 actual0/18완료/실제모델명 전부일치·제품6SHA 불변이다. 독립 Opus5.5는 버전명을 숨긴 X/Y 검수에서 개선본6선호/1동률이었지만 1회 소규모 공개 비교이므로 전체 우월성·성공률·실SDK/API 가용성·서비스GO 근거가 아니다.

개선본도 P01 정확2문장 요청에3문장, P05의 자기정책 '짧게2~4'에5문장과 외부검증 이력을 비용설정으로 판단하는 혼동, P06 장문·내부 엔진명 노출이 남았다. P05 자기정책 점검을 뒤늦게 공통 A/B 기준에 추가하지 않는다. 처음 Opus의 P05 PASS+minor를 보존하고 실제 소비 코드를 추가한 독립 후속에서 길이FAIL/의미WARN으로 재판정했다. ROOT는 의미 혼동도 미해결로 남기며 기존4FAIL을 새18응답으로 지우지 않는다.

원본 TITLE은 실제 stripTags 정의20523/20525에서 본문에서 제거되고 세션 제목으로 소비된다. ORDER는 tfOrderCard25108→draft 저장, 별도 odPlace의 연결확인으로 이어진다. 태그 출력만으로 실제 주문권한/등록을 증명하거나 원본 UI 삭제를 승인하지 않는다. 원문을 유지한 안전한 초안/승인 producer는 별도 계약으로 연결해야 한다. 최초 blind review와 후속 consumer amendment를 덮어쓰지 않고 함께 보존했다.

AGY default에 gemini-3.8-flash-high를 지정한 좁은 일관성 검토는 성공했다. 전체18응답 형식 목록은5분 timeout/빈응답/검증exit1이었고, 같은 profile/model의 P01·P05·P07 좁힌 후속은 actual0으로3문장/5문장/영어→일본어→영어를 확인했다. 모델명을 attestation하지 않는 CLI 응답이므로 requested model만 기록한다. 하향대체0·고객API/운영/주문/새whole0이다. 첫 QA 포장 출력한도와 문서 patch context 준비오류는 제품·모델실패가 아니며 원자료를 보존했다. runtime/prompt/UI 변경0이고 MODEL_QUALITY_NO_GO / SERVICE_NO_GO다.

## 1. 동일 턴 provider 오류 뒤 자동 재dispatch

- 원인: Worker의 `blocks`는 tool block만 추적한다. 텍스트 출력·token관측·완료 tool 이후 맵이 비어도 output0이 아니다. fast400/403/429와 standard403 재시도는 실패 시도를 modelCalls에서 차감해 부분 답변 뒤 대체 답변/완료와 비용 추적 불일치를 만들 수 있었다. SDK 자체 retry도 명시 차단되지 않았다.
- 수정: Worker의 자동 오류 재송신·fast→standard 전환·차감/대기 전역상태를 제거하고 Node/Worker SDK `maxRetries:0`을 명시했다. 정상 pause_turn/tool_result continuation 및 실제 최대6dispatch는 유지한다.
- 새 시험: 전용 SDK fixture로 SDK constructor, fast400/403/429×pre-output/posttext/posttoolstop, standard403×동일3상태, 정상 continuation과6회/7회차단을 검사한다. partial text/tool은 보존하지만 error 뒤 done/대체text/재dispatch는 금지한다. 새spec은 기존 npm test의 SDK preload에서도 자기 격리 loader를 사용한다. 외부 네트워크는 금지한다.
- 원RED: 신규 최초12개에서10FAIL/2PASS/actual1. 최초GREEN12PASS/actual0와 기존route35PASS/actual0는 subagent tool 원자료이며 별도 디스크 raw를 캡처하기 전 실행이다. 후속 standard4033PASS의 raw는 `/tmp/teth-anthropic-retry-guard.a2tZrz/standard-403-green.txt`다. 모인 최종 후보의 디스크 raw/입력 결속은 아래 최종 검증을 따른다.
- 잔여: 실패 호출의 usage/금액은 불명일 수 있다. 이 수정만으로 과금 확정·일일 금액 상한·durable idempotency·Worker disconnect abort를 보장하지 않는다.

## 2. 번역 대상 문안을 응답 선호로 오인

- 재현: `그 표현을 영어로 번역만 해줘: 답변을 두 문장으로 작성해 주세요.`에서 번역 대상의 `두 문장`을 sentenceCount2 선호로 잘못 추출했다.
- 원인: transform action 문법이 `번역만 해줘`를 인식하지 못해 colon 이후 제공 문안의 masking이 실행되지 않았다.
- 수정: action 두 경로에 bounded `번역(?:만\s*)?(?:해|하)`만 추가했다. target 명령을 제외하고 prefix 목표 언어·정확한 원문span·quote동치·turn-local 만료·기존 지속 언어 복구를 유지한다. 본문 절단이나 만능 자연어 parser 확장은 없다.
- RED5FAIL/actual1 `/tmp/teth-translation-preference-red.log`; GREEN5PASS/actual0 `/tmp/teth-translation-preference-green.log`; 기존415PASS/0FAIL/0SKIP/actual0 `/tmp/teth-investment-response-preferences-415.log`. Node24.14.0이다. helper SHA `632531086c0e3283c504e93d0cef167033022181458c1039de803c28c3412f81`, 새spec SHA `3915f8ee7edcbb0eee8ce604607fea9a81dbaa856f6f925bc303839491f9e34d`.
- 잔여: 실제 모델의 번역 외 대안 추가·정확 문장수 실패4건을 이 helper 시험으로 해결 판정하지 않는다. 원92/추가24응답을 새 후보의 API 평가로 재사용하지 않는다.

## 최종 검증·전달 상태

두 disjoint 패치를 이 branch에 인수했다. ROOT 단일 관련 배치는 route35·preferences420·guard15 세 그룹 actual0/470PASS/0FAIL/0SKIP/0cancelled, Node24.14.0·46입력 exact다. Node24 spec reporter를 TAP으로 읽은 최초 parser exit1은 raw/receipt를 보존하고 create-only `.cache/frontend-parity-audit/anthropic-activation-affected-tests-confirmed.receipt.json`으로 정정했다. 실제 시험은 모두exit0이며 재실행/원raw수정0이다.

새 personal(1) Opus5.5는 `SCOPED_FIX_REVIEW_GO` C0/H0/M0로 두 제품 수정의 범위를 검수했다. 이는 모델 품질·배포·서비스 GO가 아니다. 지적한 시험용 key 기록 위험은 fixture 영수증에 maxRetries만 저장하고 server/.env 존재 시 자식 실행 전 fail-closed하는 것으로 보완했다. 후속 해당15PASS/actual0·입력2 exact는 `anthropic-private-fixture-followup.receipt.json`에 결속한다. 이 변경은 첫 Opus 입력과 달라 후속 독립 검수를 별도로 수행한다.

추가 직접 영향7spec450개는449PASS/1FAIL/actual1이었다. 실패는 기존92응답의 frozen runtime SHA를 현 변경 코드에 그대로 요구한 provenance 경계이며 모델 응답 실패가 아니다. 단일RED1FAIL은 `/tmp/teth-recorded-runtime-provenance-red.log`에 보존했다. 기존 `recorded-investment-turns.json`·원QA·55runs/92turn 기대를 유지하면서 신규 `tests/recorded-investment-candidate-provenance.json`에 immutable base8646의 정확3-runtime bytes/baseSHA와 currentSHA를 분리했다. recorded spec의 runtime/sourceBrowser/Opus delivery/structural 루프를 모두 유지하고 양쪽을 검증한다. sidecar의 base64 canonical/hash·Gitbaseexact와 currentSHA는 ROOT도 재검산했다. helper의 과거 postEval afterSHA는 그대로다.

해당57PASS/actual0·0FAIL/0SKIP/0cancelled·7입력 exact 및 과거 JSON byte 불변은 `anthropic-candidate-provenance.receipt.json`에 결속했다. 기존92 모델 응답을 재생성하거나 새 고객 API 품질 합격으로 승격하지 않는다. 위449와 새57을 전수PASS로 합산하지 않는다. 일반diff-check2는 원CRLF에 대한 설정 차이로 보존하고 `cr-at-eol` 검사0/전체 파일 포맷팅0다.

정확한 후속·독립 검수·Git 상태는 Program Ledger가 소유한다. 기존 route/format fixture·registry·React·공용 schema/API·credential·운영13a/edge7e·주문 권위는 불변이다. 전체960/15k 재실행0, 고객 provider 활성화/배포/main병합0이다. 과거 평가와 현 후보를 묶는 assertion 수정은 아래 정본 경계에 따라 인수하며 새 고객 API 평가로 승격하지 않는다.

최종 후속 actual personal(1) Opus5.5도 `SCOPED_FIX_REVIEW_GO` C0/H0/M0였다(`anthropic-activation-review-followup.receipt.json`). fixture2·recorded spec/sidecar2 입력exact와 runtime3불변을 결속했다. 최종은 개발 proxy의 한정 코드 GO이며 운영·전체CI·모델품질·서비스 GO가 아니다. 모델 Low의 시험 영수증 args/runtime/time 입력 보강, sidecar 항목의 실제 소비 강제 assertion, error usage의 비용 정책은 후속으로 남긴다. 449/1의 broad 관련 원자료는 tool 기록, single RED/57GREEN은 private raw다. 전체450/450 단일통과·새42브라우저·새92모델응답으로 합산하지 않는다. 문서의 후속 결과 갱신은 제품/시험을 바꾸지 않는다.

## 별도 실서비스 잔여

인증/CSRF·owner/CAS가 있는 기존 호스트에 Anthropic 상담 adapter를 연결해야 한다. 계정별 영속 transcript/events·동일turn SSE resume·이탈/취소 분리·중복 유료 호출 방지·원자적 금액/토큰 예약/제한·실SDK/API 의미 평가·실로그인/Safari/3,000명 부하가 미완료다. 연구 역할/Critic/재검증 진행은 실제 producer 사건으로 공급해야 하며 임의 사고 흐름·검증 성공을 생성하지 않는다. 자유 LLM 답변은 주문 권한을 얻지 않는다.
