# 투자 AI 프록시와 프롬프트 검증

이 폴더는 클라이언트 원본의 투자 상담 프록시다. React의 typedService, `tesia-ai` DraftPatch compiler, 승인된 Strategy Version 및 주문 서버를 대체하지 않는다. 이번 후보는 분석 지침과 모델 출력의 신뢰 경계를 보강하며 **실제 서비스 배포는 NO-GO**다. 풍부한 전략 제안을 정식 계약으로 연결하는 통합이 남아 있다.

## 책임과 동작

| 파일 | 역할 |
|---|---|
| `investment-prompts.mjs` | 서버 소유 한국어 상담/설정 안내/과거 판단/성과 해석 정책, registry `teth-investment-prompts-1.4.0`, 각 정책의 exact SHA-256, 요청 검증 |
| `investment-output-gate.mjs` | SDK text delta 경계의 제어 태그 검증, 정상 평문/출처 링크 보존, 오류 뒤 완료 신호 금지, 내부 사고 전달 차단 |
| `investment-intent-admission.mjs` | 현재 사용자와 이력을 확인한 폐쇄형 초기 단순 BTC/ETH 전략 요청만 기존 Mock 설정 화면으로 연결. 숫자·주문·승인 권한 없음 |
| `index.mjs`, `worker.mjs` | Node loopback와 Worker의 동일 정책 소비, plain의 도구 없는 설명, lite의 도구 없는 상담, end_turn 완료 확인 |
| `tests/investment-dialogue-cases.json` | 공개 합성 개발 사례24개. 금융 단위/시점/한계/정정/정보부족/주문 의도/프롬프트 인젝션 점검. hidden holdout 아님 |
| `tests/*.test.mjs`, `tests/fixtures/` | 단위·전체 분할 위치·실제 route의 합성 SDK 응답 검증. 외부 fetch 거절, 실제 credential/provider 호출 없음 |

금융·투자·경제 상담은 넓게 제공한다. 일반 교육과 자산 비교를 BTC/15m offline compiler 문법에 제한하지 않는다. 다만 자유 텍스트는 분석과 설명이고 실행 권한을 갖지 않는다. 숫자·단위·시점·원조건·변경 범위와 비용/청산/검증 한계를 명확히 하며, 근거 없는 방향 확률과 자동 위임 유도는 금지한다.

원본의 `taiSystem/taiConvSystem/taiMarketRules` 지침을 제거하고 실제 `taiBuildSystem`은 자산·봉·초안·Mock 성과·관측 시각의 bounded JSON 데이터만 만듭니다. 양수 holdout을 통과라고 부르지 않습니다. `taiOhlc`의 분석 지시문도 제거했습니다. source 함수를 실행한 합성730샘플 budget 회귀로16,000자 이내를 확인했으며 무한 사용자 데이터의 최대값이나 실공급자 조회 성공을 증명하지 않습니다.

브라우저 `system`은 user 역할의 **미확인 참고자료**로 옮기고 JSON 문자열로 감싼다. 이 과정은 자료의 내용을 검증한 것이 아니다. 서버 지침은 고정된 registry에서 선택하고, 참고자료·웹 페이지·assistant 이력의 지시가 권위를 얻지 못하게 한다. 현재 사용자 발화는 마지막에 보존한다. 이력이16개보다 많거나 너무 크면 거절하고 몰래 자르지 않는다. 원본은11개 이력을 전송하므로 서버가 빠진 내용을 복구할 수 없습니다. `historyTruncated` 또는 assistant-leading 이력은 설정 진입을 거절하며 없는 기억은 재확인해야 합니다. 클라이언트가 숨긴 잘림까지 증명하지는 못합니다.

`plain:true`는 원본 `BT_SYS_J`/`BT_SYS_R`의 **정확한 digest** 두 개만 스타일 식별자로 받는다. 해당 원문은 모델 system으로 전달하지 않는다. 수정된 unknown plain 정책은422, `think:true` 내레이션도422다. Node가 기존 plain을 무시하고 도구를 켜던 차이를 해소했다. 요청 형식 오류400, 과도한 입력413, provider 부재503 및 SSE `{error:true}`는 성공이 아니다. 실제 생성이 `end_turn`으로 끝나고 안전한 본문이 있어야 `{done:true}`를 보낸다.

모델의 ORDER/ACT/SETUP/STRATEGY/GAUGE/TLINE/work/chips/think 제어문은 인용이나 코드 블록에서도 차단한다. 완료 응답에 붙는 SETUP은 모델 출력이 아니라 서버가 현재 사용자의 `비트코인 전략 만들어줘`, `이더리움으로 전략을 만들고 싶어요` 같은 좁은 요청을 확인해 만든 **Mock 설정 화면 이동**이다. 진입 방식은null로 남겨 사용자가 선택합니다. 서버가 별도 id/digest의 설정 안내 정책을 선택해 화면 이동과 본문을 맞춥니다. 이전 user가 현재와 동일한 단순 자산 요청 외의 발화였거나 이력이 assistant로 시작하거나 클라이언트가 잘림을 표시하면 이동을 허용하지 않습니다. 브라우저 잘림 표시는 이동 거부에만 사용하며 승인 권한을 주지 않습니다. 타이밍 질문·부정·숏/레버리지/숫자/지표 조건·assistant/browser 문장은 이 이동을 허용하지 않습니다. 실패·거절·잘림 응답에는 이동을 붙이지 않는다.

출력 필터는 금융 사실이나 자유 텍스트의 의미를 판정하지 않는다. `상승 확률97%`, `주문을 완료했습니다`라는 평문 허위 주장은 프롬프트와 별도 의미 평가의 문제다. 태그0건을 허위 사실0건으로 보고하지 않는다. CHART/ASK/NEXT/TITLE의 기존 표시 소비 검증도 주문 계약이나 실시간 데이터 검증이 아니다. SDK text delta 분할은 provider SSE UTF-8 바이트 분할 및 브라우저 복구의 검증과 다르다.

## 로컬 검증

Node22.15 이상에서 실행한다. 제품 dependency의 버전·integrity는 이번 변경에서 그대로다.

```bash
cd server
npm ci --ignore-scripts
npm run check
npm test
```

시험은 SDK import를 명시적으로 fixture로 대체한다. Node는 실제 loopback `/api/chat`, Worker는 실제 `fetch` entry를 사용하지만 provider는 합성이다. fixture는 비밀값을 요구하지 않고 외부 fetch를 거절한다. `npm start`를 통한 실제 API 호출은 별도 승인된 provider/보존/비용 설정이 필요하다. 테스트 스크립트를 실제 서버 구동 방법으로 사용하지 않는다.

`server-quality`는 PR에서 위 검증과 Worker dry-run을 실행합니다. BT_SYS_J/BT_SYS_R source를 수정하면 exact digest 계약도 함께 갱신해야 하며 이 CI의 source-bound 회귀가 필수입니다. **main에 server 변경을 병합하면 기존 workflow가 자동으로 Worker 운영 배포를 시도합니다. 실제 서비스 NO-GO 상태에서는 main 병합과 수동 deploy를 금지합니다. 후보 PR의 대상은 migration이며 이 변경을 자동 배포 가능한 main으로 승격하지 않습니다.** 기존 workflow의 check/test 및 최소 permissions/ignore-scripts는 품질 확인을 보강하며 배포 허용을 뜻하지 않습니다. Worker dry-run은 번들링 확인이고 Cloudflare runtime/배포 성공이 아니다.

사고 텍스트 생성을 유도하거나 화면에 중계하지 않고 실제 도구 이벤트를 유지한다. API의 `display: omitted` 설정은 [Claude thinking 문서](https://platform.claude.com/docs/en/build-with-claude/thinking)를 따른다. 조회 도구의 호출 한도는 [web fetch 문서](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-fetch-tool)의 `max_uses`를 사용한다.

## 검수와 잔여

Opus5.5(personal1), Astra6, Gemini3.8 Flash High의 읽기 전용 source 검토에서 사용자 질문의 위임 오인, 근거 없는 확률, 조건 치환, 한계 은폐, 브라우저 지침 권위가 확인됐다. Astra 후속 검토가 발견한 일반 영어 인용의 오차단은 실제 제어문 문법 경계 및 회귀로 교정했다. Gemini의 `depth` 이름 변경 제안은 내부 변수 이름만으로 금융 의미 오류가 증명되지 않아 인수하지 않았다. 계약 이름을 추측해 변경하지 않는다.

실제 Opus5.5 CLI batch24개를 정책 수정마다 확인했습니다. 최초의 다중 질문축, 증거금→계좌 손실률 오류, 환산 전 USD/USDT 산술을 발견했고 후속에서는 미확인 담보/MMR의 청산 선후 단정도 확인했습니다. 1.3.0에서는 질문 하나에 거래소와 마진 방식을 함께 묻거나 문안 정정에서 여러 자료를 요구하는 UX와 양수 holdout의 해석 문제가 남았습니다. 이를 숨기지 않고 각 run의 `observedReviewIssues`에 보존했습니다. 1.4.0은 확인축 예시, MMF 원금 손실/환매 구분, 검증 없는 회복·손실 확률 비교 금지와 holdout 미판정 표현을 강화합니다. 기록의 마지막 run만 현재 정책 digest에 결속합니다. batch는24개의 독립 provider 호출이나 실제 `/api/chat` provider 평가가 아닙니다.

최종 코드 검수에서 Opus가 찾은 Unicode 대문자 확장의 스트림 위치 오류는 ASCII 정규화와4접두×모든 split 회귀로 교정했습니다. Astra가 찾은 source 최종 wrapper/다른 차트 자산 및 잘린 이력의 조건 유실은 actual source VM·history 회귀로 교정했습니다. 비텍스트 이벤트는 server-observed 키 allowlist를 적용하며 도구 목적/검색 제목의 내용은 금융 검증 완료로 해석하지 않습니다. Node의 기존 문자 깨짐 중 사용자 표시 두 문구를 교정했습니다.

남은 출시 조건은 정식 표시용 전략 제안/DraftPatch와 frontend의 연결, 주문 비교 연산자·수량·유효기간·기준시각의 계약 및 승인, 실제 provider/보존/비용/독립 평가, 문장 사실 검증, 브라우저 여정/UTF-8 전송·중단 복구, 기존 프록시 인증/쿼터/KV 오류 정책 검토다. 기존 rich STRATEGY와 ORDER 카드의 모든 동선을 보존했다고 하지 않는다. 원격main 원본과 최신 migration의 React2,135개 snapshot은 비교 기준으로 보존한다. 후보 source index는 기존 지침 제거/데이터 context 전환/잘림 표시와 함께 SETUP가 최종wrapper에서 AI질문으로 재전송되지 않도록 fixed를 전달하고 명시된 자산을 settingsPair로 전달한다. 기존 차트가 다른 자산이어도 요청 자산으로 설정하며 차트는 바꾸지 않는다. 이 경로는 실제 source 함수를 실행한 Node VM으로 검사하고 browser E2E로 승격하지 않는다. 실제 모델이나 주문 기능을 활성화하거나 배포하지 않는다.

기존 프록시의 구체적인 운영 잔여는 다음과 같습니다. `wrangler.toml`에 RL binding이 없어 일일 KV 상한은 비활성이고, KV 장애는 fail-open입니다. Worker는 요청 검증 전에 quota를 차감하며 Node와 다릅니다. Origin 확인은 인증을 대체하지 않습니다. Node는 `pause_turn`을 오류로 처리하고 Worker는 제한된 continuation을 수행합니다. 이 조건에서 본 후보의 자동 시험 통과를 공개 금융서비스 운영 승인으로 해석하지 않습니다.

최종 검증과 독립 판정은 Program 정본 §16과 WORK_LEDGER를 따릅니다. 실제 provider·거래소·배포0이며 synthetic 회귀와 모델 batch 점검을 구분합니다.

## 현재 후보의 검증 기록

| 검증 | 실제 결과와 범위 |
|---|---|
| Node24.14.0 / Node22.15.0 | 각각351 PASS / 0 FAIL / 0 SKIP. Node loopback·Worker fetch 실제 route와 합성 SDK, source VM, recorded 응답 회귀 |
| clean npm ci / syntax / Worker dry-run | 각각exit0. Wrangler4.130.0으로 번들만 생성. 배포0 |
| production npm audit | omit-dev 취약점0. 기존 개발 도구 advisory는 dependency pin 유지 상태로 별도 정비 |
| React manifest | 2,135개 verified, 출처75a5f5bbb820ad27f66304927ff4c70954fea318, digest da197956817507fa6483f53a3bad80c07c294a66a5dabe775ff80b88e77621c5 |
| 실제 모델 개발 점검 | personal(1) claude-opus-5-5로24사례×5batch. 독립120 provider 호출이 아님. 마지막24응답만 현재1.4정책에 결속 |
| Astra6 독립 검수 | 코드후속 C0/H0/M0/L2의 문서/안내 Low 수정 확인. 1.4 실제응답 C0/H0/M0/L1, DRAFT_REVIEW_GO / SERVICE_NO_GO |

남은 문장 Low는 holdout 답변이 제공자료의 사전 평가 기준 미확인을 기준 부재로 표현한 부분입니다. 전체 결론은 미판정이며 기록에 남겼습니다. 이 검증 표의 개발 회귀 PASS는 모델의 모든 문장 합격이나 출시 합격이 아닙니다. 최초·중간·최종 테스트 수를 합산하지 않습니다.

최종 Opus5.5 독립 source 검수는 C0/H0/M0/L6·DRAFT_REVIEW_GO·SERVICE_NO_GO입니다. 이후 좁은 Low delta로 rvHidden/rvNew의 숨은 STRATEGY 요구를 제거하고 Mock 데이터와 미승인 분석 요청을 유지했습니다. rvDraft의 근거 없는 보유 전략보다 낮다는 문장과 미선택 매도 조건도 제거했습니다. assistant 이력에 붙이던 정정 명령은 미확인 도구 기록 JSON으로 전환했습니다. TLINE은 서버 검증된 사건이 없는 모델 JSON이 실측 가격과 결합되지 않도록 차단하며 기존 사건 카드 기능의 실연결 완료로 보고하지 않습니다.

후보를 최신 migration d53a80670cb7842f700b927db674435026d09ffd 위로 재정렬했고 거래소 연결 후보13개 추가 파일을 포함한2,135 snapshot은 그대로 보존했습니다. 이때20개 runtime/시험/CI 입력은 이전 검증과 동일했고, 마지막TLINE/숨은요청 delta는 새351개 전체검증으로 확인합니다. main은현재 branch protection이없으므로 draft라는 상태와main배포금지 기록만으로운영승인을대체하지않습니다. 출시 전 보호정책을확정해야합니다.

마지막 personal(1) Opus5.5 delta 검수도 C0/H0/M0/L6·DRAFT_REVIEW_GO·SERVICE_NO_GO이며 Astra6는 새High/Medium0과현재14개검증입력hash결속을확인했습니다. 비차단 Low는 TLINE의 명시적 프롬프트 금지 목록 추가, 도구 기록 JSON 호출의 별도 회귀, rvFix의 typed 제안 대기, 칩 클릭을 user 발화로 처리하는 표시 의미, 기존 주석/띄어쓰기, recorded holdout 문장입니다. 이는 미완료를 숨기거나 실제 서비스 합격으로 바꾼 판정이 아닙니다.

MMF의 원금 손실 가능성과 환매 조건을 예금과 구분하는 일반 투자상품 설명은 [SEC 투자자 안내](https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins/updated-12)로 확인했습니다. 국가별 보호 제도나 특정 상품의 약관을 확인한 결과로 확대하지 않습니다.
