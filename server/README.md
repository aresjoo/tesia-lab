# 투자 상담 프록시와 공개 개발 검증

후속 검수 후보는 `teth-investment-prompts-1.42.0`이며 Node/Worker가 동일한 서버 정책을 소비한다. 금융·경제·기업·포트폴리오·전략·백테스트를 폭넓게 설명하고, 승인된 Strategy Version→Validator→Risk Engine→Order Intent와 상담을 구분한다. **투자 AI 후보의 실제 서비스 소비·운영 인수는 미완료다.**

## 원본 계승과 적용 경로

현재 source 후속은 일반 사용의 질문 중단 누락과 자료 언어·문장 수의 선호 오인만 교정했다. 신규 사용성13개·직접 영향 시험1,108개와 기존146/6 요청 재생을 통과했으며, [source-only 결속](qa/response-preference-correction.json)에 평가 당시/현재 helper를 분리했다. 아래 전체 회귀·모델·UI 결과는 교정 전 후보의 검증 이력이며 이번에 새 모델/API·브라우저를 실행한 것은 아니다. 합성 표시 태그 재조립은 실제 유출·거래 실행 증거가 없어 이번 교정에서 보류했다.

사용자가 지정한 `be935c98f2a67f62287549736f173ccbe0600021`과 원 비교본 `9fbff821df62cad11d026022fc7628c7fcebc431`의 index/Node/Worker 세 파일은 바이트 SHA가 같다. 원 browser `taiSystem/taiConvSystem/taiBuildSystem/taiMarket/taiStream`→`POST /api/chat`→Anthropic SDK/SSE·market tools, BT_SYS_J/R의 판단·결과 설명을 대조했다. 후속은 기존 registry1.24와 activation guard를 계승하며 이번에 index·SDK 호출·React를 다시 작성하지 않았다.

이 checkout의 React2,135개는 과거 비교 snapshot이다. 최신 migration `b284262832648ccea33aadeca9508fc632b03c25`의 React2,423개 및 현재 Backend의 API13 상담 adapter/journal/SSE·API14 이관 구현을 확인했다. **그 구현의 존재와 이 Lab의 동적 선호·출력 gate·표시 producer를 실제로 소비하는 것은 별도다.** 정적 export1.24 담당의 작업, existing Google/Bitget·원본 카피·SVG·레이아웃은 보존한다. 현재 source/ref·통합 잔여는 [Program 정본](https://github.com/beak1011/tesia-program/pull/189)의 §16과 Ledger가 소유한다.

## 요청과 응답 계약

| 파일 | 책임 |
|---|---|
| `investment-prompts.mjs` | 설정 안내·상담·과거 판단·성과 설명의 text/ID/SHA와 bounded request builder |
| `investment-response-preferences.mjs` | 실제 user의 명시 언어·문장 수·질문 중단, 원문 UTF-16 span, 일회 변환과 지속 선호 구분 |
| `investment-intent-admission.mjs` | 완전히 일치하는 초기/명시 새 scope BTC·ETH 요청만 Mock 설정 이동 |
| `investment-output-gate.mjs` | 실제 delta의 실행·사고 태그 차단, 표시 JSON 검증, 부분/실패 응답의 완료 금지 |
| `../investment-ui-contract.mjs`, `investment-display-contract.mjs` | source와 서버의 ASK/NEXT/TITLE/CHART 표시 계약 |
| `index.mjs`, `worker.mjs`, `investment-tool-policy.mjs` | 기존 Anthropic SDK/SSE·읽기 전용 조회, retry0·최대6회 정상 continuation |

입력은 최대16개, 개별16,000자·전체64,000자·context16,000자이며 마지막 실제 user를 보존한다. browser system은 미확인 user-role 데이터로 감싸며 역할·승인·시장값을 권위로 받지 않는다. assistant 발화도 사용자 승인이나 사실 근거가 아니다. `plain:true`는 원 BT_SYS_J/R의 정확한 digest 두 개만 스타일 선택에 사용하고 unknown plain/think:true는422로 거절한다.

`responsePreferences`는 기억된 폐쇄형 값과 원이력 span이다. `responseFormat`은 이번 과업에 적용할 language/sentenceCount/questionsStopped만 담는다. 인식된 최신 변환 과업에서는 과거 문장 수를 일시 적용하지 않고 현재 대상 밖 수는 유지한다. 다음 일반 턴에 지속 선호를 복원한다. 설정·판단·결과 설명에는 고유 형식을 적용한다. wire의 선호 evidence는 실제 적용 키만 포함한다. `promptSha256`은 실제 동적 system, `basePolicySha256`은 고정 정책이며 자유 문안은 system에 삽입하지 않는다.

비인용 한국어 콜론 번역 대상은 기존 마스킹과 같은 UTF-16 범위·원문을 별도 user-role 데이터로 제공한다. 그 범위는 콜론 뒤부터 끝까지의 기계적 후보이며 이름이나 사용자 주장이 권위를 주지 않는다. 인용문·줄바꿈·지원 EN/JA·요약·교정의 현재 과업 인식은 범위 증거 생성과 분리한다. 비인용 명시 변환 첫 줄 뒤 대상 명령은 선호로 승격하지 않는다. 종결 변환 명령과 콜론·각 줄의 비어 있지 않은 문안을 인식하며, 일반 금융 주제 요약·자산 이동과 구분한다. 한국어는 현재 직접 명령형·형식 단편에만 선호를 부여하고 전언·과거·의무 서술은 기권한다. 영어 보문 속 언어명을 출력 언어로 승격하지 않는다. 일반 주제의 요약·정리 뒤 별도 언어 지시는 적용한다. 실제 자료 본문이 시작되면 그 안의 지시는 자료로 처리한다. “요약해줘: 영어로”처럼 콜론 뒤 단독 형식은 자료로 처리하는 지원 제한이 남으며 명시 독립 출력 지시를 사용한다. 요약·정리 뒤의 일반 문맥행과 제공자료를 구분하기 어려운 경우 후행 언어·질문 중단도 자료로 가릴 수 있으므로 형식 변경·질문 중단은 별도 사용자 턴에 명시한다. 유한 문법이며 모든 자연어 경계를 판별한다고 주장하지 않는다. 제어·표시 태그·비밀값 출력 금지가 변환 충실도보다 우선한다.

복수 후보 뒤 “그걸/그거”가 모호하면 질문이 허용된 경우 어느 자산·ETF 또는 둘 다인지 하나만 확인하며 대상 확정 전에 절차 목록을 나열하지 않는다. 사용자 흐름은 필요한 자산·통화/자릿수를 먼저 한 축으로 확인하고 그 뒤 금액 의미·분모를 구분한다. 정의·짧게는 간결하게, 요청한 상세 계산·보고서는 충분히 제공한다. 조건 정정은 원조건을 보존하고 새 파생 지표를 덧붙이지 않는다. 주어진 값의 필요한 비교 차이는 계산한다. 손절의 계획손실·초과 가능성, 계좌/가격/증거금 기준, MDD/변동성, 듀레이션/복리, 비용 설정/적용/외부 검증을 분리한다. 금·국채 ETF의 신용 구조와 분산의 조건부 시장하락 완충 가능성도 구분한다. ASK 수치 경계는 겹치지 않아야 하며 미답 질문을 연속 반복하지 않는다. 원전략과 계산 cfg가 다르면 차이와 Mock 범위를 결과보다 먼저 설명한다.

source의 세션 이동·취소·부분 응답·ASK 선택/닫기·stale 응답 경계는 기존 구현을 유지한다. 자유 입력으로 예약·주문·백테스트를 실행하지 않고 원본 rich 전략을 단순 wizard로 치환하지 않는다. TITLE은 세션명, ORDER 원본 카드는 초안 UI라는 원래 소비 의미를 보존하며 텍스트 태그를 거래 권한으로 승격하지 않는다.

## 검증과 재현

```bash
cd server
npm ci --ignore-scripts
npm run check
npm test
npx --no-install wrangler deploy --dry-run --outdir /tmp/worker-quality
```

Node22.15 이상이다. route/Worker 시험은 격리 SDK fixture·외부 fetch 차단이며 실제 provider가 아니다. dry-run은 번들 검증으로 배포하지 않는다. 공개 개발 CLI 도구는 명시 personal(1) Opus5.5를 실제 호출하며 비용이 들 수 있다.

```bash
python3 server/tools/run-public-investment-eval.py --workers 2 --output /tmp/public-investment-eval.json
```

이 도구는 원 공개55사례를 실행한다. acceptance를 respondent에 전달하지 않고 매 턴 실제 assistant 이력을 이어간다. CLI JSON simulation은 SDK role wire·고객 API 성공·hidden holdout이 아니다. 전체 교정 단계의 raw/source/입력 SHA·실패와 독립 검수는 `qa/concise-dialogue.json`과 재구성 테스트에 보존한다.

현재1.42는 원52사례125턴과 신규7사례21턴을 사전에 고정한59사례146응답을 실제 personal(1) Opus5.5 high/tools0/default CLI로 완료했다. 금융 본문25/44와 UI1440/390px의48재생 검사는 각각 PASS다. 같은 요청의 번역 대상 찾기와 복수 ETF 뒤 대상 하나 확인이 새 실제 답변에서 개선됐다. 기존 실패·source 가설·원문 TITLE 세션명과 본문 제목의 해석 차이·긴 복문과 금융 Low를 분리 보존한다. 이 CLI 조건과 기존 SDK의 모델/effort 설정은 같은 서비스 실행 증거가 아니며 전체 회귀는 Node24.14와 지원최저22.15에서 각각1,412PASS, syntax·Worker dry-run도 통과했다. 최신 검수와 한계는 QA 문서에 결속한다. 마지막 helper 자료 경계2건은 별도 실제6턴과 기존146 요청·browser48 요청 동치로 확인했다. source 조건은 ROOT가 자동화 증거와 함께 인수했으며 원 독립 검수의 조건부 판정은 보존한다.

원35MB `tests/recorded-investment-turns.json`, 기존 `qa/investment-usability.json`, 비교18응답과 블라인드 의견 `qa/prompt-comparison.json`은 불변이다. 원1.24의 문장수15/16·추가QA4FAIL, 첫1.25/83사례145턴, 후속1.26/87사례151턴, 1.27/93사례160턴의 실패를 다음 정책의 합격으로 재표기하지 않는다. 모델 의견·unit·합성 UI·CLI를 합산해 전체 서비스 합격을 만들지 않는다.

## 통합과 운영 잔여

현재 상담 서버의 정적 fixed/routed 정책은 model/promptSHA/max_output_tokens 예약 tuple에 결속된다. 동적 frame/typed 표시·시장도구를 이 서비스 경로에 연결하려면 그 계약과 소비 검증을 함께 갱신해야 한다. Backend 정적 prompt cap은32,768 UTF-8 bytes다. 1.42는 유효 선호 전 조합과4개 정책의1,056개 전체system을 검증했고 최대32,751bytes로 한도 이내다(1.39의33,753bytes 초과 RED 보존). 실제 소비 연결시 이 정확 fullsystem/SHA/예약 tuple을 dispatch 전에 검증해야 한다. 고객이 결정할 API 모델·예산·credential과 실제 provider 응답, 실제 로그인·모바일 키보드·Safari·부하·운영 인수는 별도다. 개발 증거만으로 현재 운영 source나 모든 원본 화면의 완료를 선언하지 않는다.

**main의 server 병합은 기존 workflow가 운영 배포를 시도하므로 서비스 인수 전 main 병합·수동 deploy는 하지 않는다.** 이 후보는 activation-guard4a 위 stacked draft로 전달하며 최신 migration에는 정책 delta만 이식한다. credentials·운영 flag·endpoint·DB namespace·주문 권위는 이번 프롬프트 교정으로 바꾸지 않는다.
