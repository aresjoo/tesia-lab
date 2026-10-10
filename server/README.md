# 투자 상담 프록시와 공개 개발 검증

서버 소유 정책 `teth-investment-prompts-1.24.0`을 Node loopback와 Worker가 소비합니다. 금융·경제·기업·포트폴리오·전략을 넓게 상담하며, 자유 텍스트에는 주문·예약·DraftPatch 반영 권한이 없습니다. **migration 대상 draft, SERVICE_NO_GO**입니다. React의 local Mock producer와 AI40의 offline compiler에는 이 정책이 적용되지 않습니다. 승인 Strategy Version→결정론적 Validator/Risk Engine→OrderIntent는 별도 서버 경로입니다.

## 파일과 신뢰 경계

| 파일 | 역할 |
|---|---|
| `investment-prompts.mjs` | 상담·Mock 설정 안내·과거 판단·성과 설명 4모드의 immutable text/id/SHA-256, bounded 요청 검증 |
| `investment-response-preferences.mjs` | 실제 user의 명시 언어·문장 수·질문 중단을 폐쇄 문법/원문span으로 확인. 후행 지시 우선, 인용/보고/부정 및 지속 응답 형식과 일회 변환 형식을 구분. 인식 문형은 유한 |
| `investment-intent-admission.mjs` | 초기 또는 이전 조건을 가져오지 않는다고 명시한 폐쇄형 BTC/ETH 요청만 Mock 설정 이동. entryMode는 null |
| `investment-output-gate.mjs` | SDK text delta에서 실행/확률/사고 태그 차단, 완전한 표시 JSON 검증, 실패·부분 응답의 완료 금지 |
| `../investment-ui-contract.mjs`, `investment-display-contract.mjs` | 서버와 source 브라우저가 함께 쓰는 표시 parser/schema. ASK 한 축·2~4옵션, NEXT 최대2, 첫 턴 TITLE, CHART 심볼·시장 일치 |
| `investment-tool-policy.mjs` | 읽기 전용 market_data의 immutable 정의와 별도 fingerprint. 목적 문장은 진행 사실로 표시하지 않음 |
| `index.mjs`, `worker.mjs` | 동일 정책·출력 경계. plain/lite 도구 없음, 실제 응답 model 또는 null을 기록, 다른 모델로 자동 fallback 없음 |
| `tests/public-investment-*-cases.json` | 공개 합성 개별 턴·다중 턴·처음 사용 후 교정에 활용한 공개 일반화 개발 사례. hidden holdout 아님 |
| `tools/run-public-investment-eval.py` | personal(1) Opus5.5 CLI, 도구0, 개별 실제 assistant 답변을 다음 턴에 보존. 실제 request builder와 assistant 이력, 전체 runtime 입력 동결·변경 검출, 실제 호출 수와 실패·비용·지연 기록 |
| `tests/*.test.mjs`, `tests/fixtures/` | 실제 route/Worker continuation·source VM·분할 스트림·표시 schema·공개 기록 회귀. SDK 합성 fixture, 외부 fetch 금지 |

브라우저 system은 JSON으로 감싼 user 참고자료이며 지침 권위가 없습니다. assistant 이력은 사용자 승인·사실 근거가 아닙니다. 현재 사용자 발화는 마지막에 보존합니다. 최대16개·개별16,000자·전체64,000자, context16,000자이며 과도한 입력은 거절합니다. source는 최근 짝 맞춘14개 이력과 길이가 제한된 완전한 이전 사용자 문장을 제공합니다. 기억 누락을 표시하고, wizard 선택은 현재 대화에 결속된 경우에만 미확인 Mock 정보로 제공합니다. 이 기억은 영구 프로필이나 서버 검증값이 아닙니다.

`plain:true`는 source BT_SYS_J/BT_SYS_R의 정확한 두 digest만 스타일 식별자로 받으며 그 문안을 모델 system으로 전달하지 않습니다. unknown plain과 think:true는422입니다. plain은 과거 시점과 비용·원조건 일치를 구분하고 제공 자료만 설명합니다. 정상 end_turn와 안전한 본문이 있어야 done을 보냅니다. 모델 ORDER/ACT/SETUP/STRATEGY/GAUGE/TLINE/work/chips/think는 인용·코드에서도 차단합니다. 서버가 추가한 SETUP은 Mock 설정 화면 이동뿐입니다. 풍부한 전략/레버리지/미지원 봉/지표를 단순 wizard로 치환하지 않습니다.

실제 user에서 확인된 폐쇄 선호 값만 해당 응답의 system 프레임에 반영하고 원문span은 user 참고로 제공합니다. `promptSha256`은 실제 동적 system, `basePolicySha256`은 registry 고정 정책입니다. 원문 지시나 자유 텍스트를 system에 삽입하지 않습니다. 지속 선호와 최신 턴의 일회성 번역·요약·교정 형식을 분리하며 다음 일반 질문에는 기존 지속 선호를 복원합니다. 질문 중단에는 ASK/NEXT를 억제하되 본문을 잘라 조건을 잃지 않습니다. 문장 수·금융 의미는 별도 평가하며 자연어 전체 추출을 보장하지 않습니다.

실제 SDK tools JSON 전체의 `toolsSha256`과 실제 market_data 요청 때만 `marketToolPolicySha256`을 기록합니다. plain/lite의 두 값은 null입니다. `requestedSpeed`는 요청값이며 provider 적용의 증명이 아닙니다. 응답 model이 없으면 null이고 fallback은 없습니다.

표시 schema는 금융 사실 검증기가 아닙니다. 없는 기준과 미확인을 구분하고, 손익 분모·예산 통화와 거래 시장·입출금 수익률·비용 기준·승률과 기대값을 구분하도록 지침과 실제 문장 평가를 병행합니다. 한 조건 정정은 그 조건만 바꾸며, 최신 언어/길이/숙련도 요청을 반영합니다. 이를 모든 미래 응답의 정확성 보장으로 보고하지 않습니다.

## source 사용 흐름

root index는 exact 전체 선택값에만 로컬 Mock 설정을 바꿉니다. 질문·부정·복수 조건·자유 텍스트 정정은 상담으로 보냅니다. 자유 입력으로 예산 변경·백테스트 실행·예약 등록을 하지 않습니다. 수정 CTA는 미승인 상담이며 다른 전략 비교는 현재 결과를 보존한 새 대화입니다. 늦은 이전 응답은 새 턴 UI를 변경하지 않습니다. 세션 이동은 소유한 요청/진행 블록만 중단하고 전송 잠금을 풀며, 이전 세션에 부분 응답·미완성 표시·원 질문 재생성 경로를 보존합니다. ASK 선택은 제목의 질문표 앞 부분·전체 선택값·설명을 함께 보내고 닫은 질문은 현재 정보로만 이어갑니다.

unsigned GitHub config로 프록시 주소를 바꾸던 코드를 제거했습니다. 원격은 사전 구성한 `TETH_CONFIG.aiProxy`의 HTTPS origin 또는 동일 origin `/api/chat`, 로컬은 localhost8799입니다. config 파일을 실행하면 deployment 설정 권위가 있으므로 운영 배포 전 target·인증 검증이 필요합니다. 합성 사고 내레이션·임의 전망선·실행 완료 약속을 제거하고 응답 대기와 실제 도구 이벤트만 표시합니다.

Mock 판단 자료는 실제 cfg/출처/관측일/신호일/체결일을 구분하고 다음날 체결가·최종 손익을 당시 판단 이유에서 제외합니다. 성과는 완료 거래와 미청산 평가, 비용 후 전략과 비용 전 보유 비교, 원조건 일치 미검증, 선물 MMR 단순 모형을 명시합니다. 이 브라우저 계산을 실제 AI 결정이나 실거래 검증으로 부르지 않습니다.

## 재현

### 기존 상담 서버에 동일 정책 전달

`tools/export-consultation-policies.mjs`는 세션 개선본 registry1.24의 4개 정책을 **글자·ID·SHA 변경 없이** 기존 Python 상담 설정의 `systemPrompt: {file, revision, sha256}` 형태로 준비한다. credential·모델·가격·크레딧 설정을 생성하거나 읽지 않으며 provider/서버/운영을 활성화하지 않는다. 출력 부모는 현재 사용자 소유의 실제 절대 경로·0700이어야 하고, 상위 경로는 root/현재 사용자 소유와 비공유 쓰기 또는 sticky 경계를 확인한다. 새 하위 디렉터리만 만들며 기존 파일/디렉터리는 덮어쓰지 않는다. 정책 파일은0600, 최대32768bytes/NFC/registry SHA를 먼저 확인한다. manifest는 임시 파일의 쓰기·sync 뒤 마지막에 exclusive link로 게시한다. 존재 여부만으로 성공을 판단하지 않고 parse·정책 해시를 재검증한다. 실패 시 부분 출력은 자동 삭제하거나 재사용하지 않는다. 파일/디렉터리 sync 이후에도 fsync 실패·전원 장애가 발생하면 존재하는 출력의 인수가 확정된 것은 아니며, 명시 검증 뒤 판단한다. root/sameUID에 대한 변조 방어 또는 코드 출처 서명의 대용 도구가 아니다.

```bash
node server/tools/export-consultation-policies.mjs /absolute/owner-private-parent/new-policy-directory
node --test server/tests/consultation-policy-export.test.mjs
```

`policy-inputs.json`의 해당 `systemPrompt` 항목과 정책 파일을 검토된 서버 설정에 결속한다. 설정과 prompt 파일은 같은 비공개 디렉터리에서 기존 서버 reader가 재검증해야 한다. 일반 투자 대화에는 `dialogue`를 사용한다. `settings`는 원 source의 Mock 설정 안내이므로 실서비스 일반 대화/실주문 정책으로 선택하지 않는다. 판단·보고서 모드는 실제 관측/보고서 producer와 결속된 요청에만 적용한다. 자동 난이도 라우팅의 각 모델 profile이 사용할 정책·가격·입출력 상한도 서버 설정에서 별도로 결속한다.

완료 인수에는 CLI exit0·pending 파일 없음·manifest parse·4개 정책 해시 재확인이 모두 필요하다. `POLICY_PUBLISHED_DURABILITY_UNCONFIRMED`는 게시 후 sync/정리 실패이므로 완료로 인수하지 않는다. `POLICY_DESTINATION_EXISTS`는 재사용 금지이며 기타 `POLICY_*` 진단은 경로/입력값을 포함하지 않는다. 부분 출력은 운영자가 확인 후 별도 새 디렉터리로 재시도한다. `sourceHashScope`의 3개 디스크 해시는 export 시점 참고 정보이지 평가된 모듈의 provenance·연결 완료 증거가 아니다. 1.24.0의 정책 길이·SHA는 시험의 별도 golden 리터럴로 고정한다. Node `--preserve-symlinks-main`은 상대 import를 바꾸므로 지원하지 않으며 정상 기본 CLI로 실행한다. 정적 모듈 import 자체가 실패하면 Node의 원래 오류 진단이 발생할 수 있다.

**이 전달만으로 개선본 전부가 서비스에 적용되는 것은 아니다.** 동적 `buildInvestmentRequest`의 선호/근거 처리, 출력 gate, ASK/NEXT/TITLE/CHART 표시 parser 및 실제 시장 도구는 별도 소비 연결이다. `runtimeScope`는 이 공백과 provider/활성화0을 명시한다. 기존 `/api/chat`를 인증 없는 공개 우회 경로로 추가하거나 브라우저 지침에 권위를 돌려주지 않는다. 원본 UI·카피·SVG를 바꾸지 않고 동일 상담 UX로 연결해야 한다. 실제 모델 길이/번역 QA 잔여도 이 파일 전달 시험으로 닫지 않는다.

검수·수정 기록: 최초 후행 경로 separator 누락으로3PASS/1FAIL 뒤 교정했고, 독립 검수의 폐쇄 mode/ID·partial manifest·CLI symlink·golden 부재·반례 SHA 마스킹을 보완했다. 직접 영향6시험은6PASS/0FAIL/0SKIP다. 마지막 Opus검수의 시험 symlink가 공유/tmp의 import를 향하던 N1은 경로를0700부모 안쪽으로 옮기고 정확 오류·출력 미생성을 확인했다. N2조상 경계 반례도 추가했고 해당CLI·새조상2시험만2PASS/332.727ms로 확인했다. 이를 최종7시험 전체 재실행이나 최종모델 재승인으로 쓰지 않는다. 별도 실제 설치 reader는 합성 설정으로 fixed4 정책과 routed3 profile 결속을 확인했으며 provider0이다. workspace 상위0775로 실제 export가 거절된 것은 권한 정책의 정상 차단이다. 권한 완화 없이 별도 비공개 경로에서 export만 재확인하고 수용된4정책과 byte equality를 확인했다. socket class 대체/미지원 symlink-main 성공 기대는 하니스 실패로 원기록을 보존한다. root/sameUID 경합과 디스크 장애 fault injection은 완료 증거가 아니며 서버/React/운영 소비·실제 응답·서비스GO는 별도다. PM Ledger와 원자료 `.cache/investment-policy-service-bridge/`에서 실행별 범위를 구분한다.

```bash
cd server
npm ci --ignore-scripts
npm run check
npm test
npx --no-install wrangler deploy --dry-run --outdir /tmp/worker-quality
```

Node22.15 이상입니다. 테스트는 명시적 SDK fixture로 실제 Node HTTP/Worker entry를 호출하지만 실제 provider가 아닙니다. Worker의 pause_turn와 미승인 tool_result continuation도 네트워크 없는 fixture로 검증합니다. dry-run은 번들 생성뿐이며 배포0입니다.

아래 도구는 명시한 personal(1) CLI 모델을 실제 호출하므로 사용 가능한 해당 계정이 필요합니다. 모델 입력에서 acceptance를 제외하고, 매 턴 실제 assistant 답변을 이어갑니다. JSON 대화 simulation이며 앱 SDK role wire·실제 `/api/chat` provider·hidden holdout gate가 아닙니다.

```bash
python3 server/tools/run-public-investment-eval.py --workers 2 --output /tmp/public-investment-eval.json
```

오래된 prompt/system·production URL을 별도로 사용하던 probe 4개는 활성 참조가 없어 제거했습니다. Git 이력에서 복구할 수 있습니다. `tests/recorded-investment-turns.json`은 각 정책의 실제 개별 응답·원 acceptance·독립 의미 검수·실패·프롬프트/코퍼스 snapshot을 보존합니다. 1.14 혼합 입력 중단의57행은20실제 완료 호출과37호출 전 실패이며57실호출로 쓰지 않습니다. 1.11은 의미 검수 미실행입니다. 이전24사례×5 CLI batch와 후속 개별 실제 응답·실패를 공개 기록과 검수에 보존하고, 현재 정책 성공으로 바꾸지 않습니다. 최신 평가 수치·정책 결속·의미 실패·독립 판정은 공개 기록과 [Program PR189](https://github.com/beak1011/tesia-program/pull/189)의 정본 §16/Ledger를 따릅니다. [Lab PR5](https://github.com/aresjoo/tesia-lab/pull/5)는 migration draft입니다.

## 출시 전에 남은 조건

React2135 snapshot은 불변이며 source 개선이 React에 자동 반영되지 않습니다. 정식 rich 제안·승인·주문 계약 소비와 실제 provider/보존·비용·독립 hidden 평가, 실제 앱 전체 여정·UTF-8 전송/중단 복구를 완료해야 합니다. Origin 검사는 인증이 아닙니다. Worker RL binding 미설정·KV fail-open·검증 전 quota 차감, Node pause_turn 오류와 Worker continuation 차이가 남습니다. main branch protection도 없습니다. **main에 server 변경을 병합하면 기존 workflow가 운영 배포를 시도하므로 NO_GO 동안 main 병합·수동 deploy를 금지합니다.**

원본 source main과 React2135개(출처75a5f5b, manifest digest da197956817507fa6483f53a3bad80c07c294a66a5dabe775ff80b88e77621c5)는 비교 기준으로 보존합니다. 자동 회귀·Mock 브라우저·개발 CLI 응답을 실제 금융서비스 합격으로 합산하지 않습니다.

만기형 ETF 설명 교정은 [iShares의 직접 상품 설명](https://www.ishares.com/us/literature/press-release/ibonds-terminations-release.pdf)에 따라 종료일과 고정 원리금 상환을 구별합니다. 공개 개발 평가의 통과를 개인별 상품 적합성이나 실제 실행 권한으로 확대하지 않습니다.

현재1.24 후보의 공개55사례·92응답은 동결 완료했습니다. 금융 원기준25사례는25/25 PASS지만 별도 정밀도Low와 실제 문장수15/16·M1(두 문장 요청→세 문장)이 남습니다. 최종 형식 helper는 공개378사례와 기존기준 단위415 PASS/0 FAIL/0 SKIP·actual0로 검증합니다. 평가 당시 helper와 교정후 helper의 SHA·전체 snapshot·원92 입력/선호/근거/systemSHA 동치를 공개 postEvalRuntimeCorrection으로 결속하며 새 모델92호출로 쓰지 않습니다. 한 문장 요청의 폐쇄 tail 프레임, 자료 검증상태 구분, 보고된 타인 허락의 비권위, 명시 지속 선호, 인용·Latin 축약 경계를 교정했습니다. 원1.22 형식/1.23 의미 오류·중간 단위FAIL·기존 기대값은 보존합니다. 전체 Node22/24 각960 PASS/0 FAIL/0 SKIP(형식415포함)·입력불변, source 브라우저42 PASS, check/Worker dry-run/omit-dev audit/React manifest actual0입니다. 최종 Opus는ASCII 교정범위 C0/H0/신규M0/L2/NOTE1 DRAFT_REVIEW_GO이며 미지원 인용 문형과 모호성은 남습니다. exact head CI는 Program Ledger/PR checks를 확인하며 **MODEL_QUALITY_NO_GO / SERVICE_NO_GO**를 유지합니다.

DV01의 bp 개념은 [CME 설명](https://www.cmegroup.com/education/courses/introduction-to-sofr/understanding-the-importance-of-basis-point-value)을 따릅니다. ΔD≈−ΓΔb는 고정 포지션·bp 좌표의 명시 미분 정의에서 도출한 근사입니다. 분산의 조건부 효과와 비보장은 [SEC 설명](https://www.investor.gov/introduction-investing/investing-basics/save-and-invest/diversify-your-investments)을 따르며 개인 비중의 적합성이나 손실 상한으로 확대하지 않습니다.

실제 사용 QA는 [QA 결과](qa/README.md)와 [원문·실행 증거](qa/investment-usability.json)를 따른다. 새12사례·24응답에서 길이/번역 준수4FAIL, 기존92 재독에서 명확한 설명 부담18응답을 확인했다. React Mock의 RSI 정의→진입조건 요구도 별도 관측했다. 이번 검수는 제품 교정0이며 MODEL_QUALITY_NO_GO / SERVICE_NO_GO를 유지한다.
