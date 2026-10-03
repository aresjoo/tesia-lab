# 투자 상담 프록시와 공개 개발 검증

서버 소유 정책 `teth-investment-prompts-1.16.0`을 Node loopback와 Worker가 소비합니다. 금융·경제·기업·포트폴리오·전략을 넓게 상담하며, 자유 텍스트에는 주문·예약·DraftPatch 반영 권한이 없습니다. **migration 대상 draft, SERVICE_NO_GO**입니다. React의 local Mock producer와 AI40의 offline compiler에는 이 정책이 적용되지 않습니다. 승인 Strategy Version→결정론적 Validator/Risk Engine→OrderIntent는 별도 서버 경로입니다.

## 파일과 신뢰 경계

| 파일 | 역할 |
|---|---|
| `investment-prompts.mjs` | 상담·Mock 설정 안내·과거 판단·성과 설명 4모드의 immutable text/id/SHA-256, bounded 요청 검증 |
| `investment-response-preferences.mjs` | 실제 user의 명시 언어·문장 수·질문 중단을 폐쇄 문법/원문span으로 확인. 후행 지시 우선, 인용/보고/부정은 구분하고 불확실하면 보류 |
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

실제 user에서 확인된 폐쇄 선호 값만 해당 응답의 system 프레임에 반영하고 원문span은 user 참고로 제공합니다. `promptSha256`은 실제 동적 system, `basePolicySha256`은 registry 고정 정책입니다. 원문 지시나 자유 텍스트를 system에 삽입하지 않습니다. 질문 중단에는 ASK/NEXT를 억제하되 본문을 잘라 조건을 잃지 않습니다. 문장 수·금융 의미는 별도 평가하며 자연어 전체 추출을 보장하지 않습니다.

실제 SDK tools JSON 전체의 `toolsSha256`과 실제 market_data 요청 때만 `marketToolPolicySha256`을 기록합니다. plain/lite의 두 값은 null입니다. `requestedSpeed`는 요청값이며 provider 적용의 증명이 아닙니다. 응답 model이 없으면 null이고 fallback은 없습니다.

표시 schema는 금융 사실 검증기가 아닙니다. 없는 기준과 미확인을 구분하고, 손익 분모·예산 통화와 거래 시장·입출금 수익률·비용 기준·승률과 기대값을 구분하도록 지침과 실제 문장 평가를 병행합니다. 한 조건 정정은 그 조건만 바꾸며, 최신 언어/길이/숙련도 요청을 반영합니다. 이를 모든 미래 응답의 정확성 보장으로 보고하지 않습니다.

## source 사용 흐름

root index는 exact 전체 선택값에만 로컬 Mock 설정을 바꿉니다. 질문·부정·복수 조건·자유 텍스트 정정은 상담으로 보냅니다. 자유 입력으로 예산 변경·백테스트 실행·예약 등록을 하지 않습니다. 수정 CTA는 미승인 상담이며 다른 전략 비교는 현재 결과를 보존한 새 대화입니다. 늦은 이전 응답은 새 턴 UI를 변경하지 않습니다. 세션 이동은 소유한 요청/진행 블록만 중단하고 전송 잠금을 풀며, 이전 세션에 부분 응답·미완성 표시·원 질문 재생성 경로를 보존합니다. ASK 선택은 제목·선택값·설명을 함께 보내고 닫은 질문은 현재 정보로만 이어갑니다.

unsigned GitHub config로 프록시 주소를 바꾸던 코드를 제거했습니다. 원격은 사전 구성한 `TETH_CONFIG.aiProxy`의 HTTPS origin 또는 동일 origin `/api/chat`, 로컬은 localhost8799입니다. config 파일을 실행하면 deployment 설정 권위가 있으므로 운영 배포 전 target·인증 검증이 필요합니다. 합성 사고 내레이션·임의 전망선·실행 완료 약속을 제거하고 응답 대기와 실제 도구 이벤트만 표시합니다.

Mock 판단 자료는 실제 cfg/출처/관측일/신호일/체결일을 구분하고 다음날 체결가·최종 손익을 당시 판단 이유에서 제외합니다. 성과는 완료 거래와 미청산 평가, 비용 후 전략과 비용 전 보유 비교, 원조건 일치 미검증, 선물 MMR 단순 모형을 명시합니다. 이 브라우저 계산을 실제 AI 결정이나 실거래 검증으로 부르지 않습니다.

## 재현

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

최종 후보 검증은 Node22/24 각각578 PASS·0 FAIL·0 SKIP, source 브라우저42 및 별도세션/부분복구 범위입니다. 실제 공개 CLI55사례·92응답은완주했지만 금융원기준24/25, 개인화문장수2턴과ASK표현잔여로 **MODEL_QUALITY_NO_GO**입니다. Gate92/92는schema결과입니다. actual92완주후source UI만후속교정했으며원indexSHA와최종UI의차이는공개record의postEvalSourceCorrection으로보존합니다. 원문·실패·중대도이견을지우지않고실제배포승인은보류합니다.
