# TETH AI 모델 초안 검증 보고서

작성: CODEX, 2026-09-28. 대상: [Claude 초안](AI_MODELS_TRADING.md). 목적: A 실거래 판단 에이전트와 B Pine Script v6 작성 모델의 선정 근거 검토.

초안의 모델 목록에는 실제 모델이 다수 포함되어 있다. 그러나 모델 세대 간 사양 전용, 벤치마크 해석, Pine 실험 인용에 이의가 있다. 현재 근거만으로 실거래 판단 또는 Pine 작성의 최종 우승 모델을 정할 수 없다. 아래 조합은 TETH 평가를 시작할 후보이며 구현 완료나 수익성 검증을 뜻하지 않는다.

## 1. 판정 방법과 지식의 한계

사용자가 요청한 지식 대조와 이번 웹 확인을 구분한다. **초안에 제시된 2026년 신모델의 구체적인 출시일, 현재 가격, 최신 벤치마크 점수는 지식만으로 확인 불가**다. 기억에 없는 모델을 가짜라고 단정하지 않는다. 이 세션의 도구에 보이는 모델명도 공개 API 출시나 가격의 근거로 쓰지 않았다. 정확한 내부 지식 컷오프 날짜를 임의로 제시하지 않는다.

표의 판정은 지식 대조에 2026-09-28 공식 웹 확인을 보강한 결과다. 근거가 `공식 웹`이면 새로 읽은 자료이며, 기존 지식으로 알고 있었다는 뜻이 아니다. `지식 기반`은 일반적인 엔지니어링 원리다. 출처를 찾지 못했거나 원문을 열 수 없는 최신 수치는 계속 `확인 불가`로 남긴다.

| 판정 | 뜻 |
| --- | --- |
| 확인 | 표시된 출처가 해당 사실이나 발행자의 수치 발표를 뒷받침한다. 독립 재현, TETH 적합성 또는 거래 수익 검증을 뜻하지 않는다. |
| 이의 | 공식 값과 다르거나, 서로 다른 모델과 실험 조건을 섞거나, 근거보다 강하게 일반화했다. 근거 열에 정정 값이나 대안을 적는다. |
| 확인 불가 | 지식만으로 확정할 수 없고 이번 확인에서도 충분한 1차 근거를 확보하지 못했다. 허위 또는 부존재 판정이 아니다. |

모델명, 발표일, API 제공일, 가중치 공개일은 다를 수 있다. 가격은 별도 표시가 없으면 USD, 입력/출력 100만 토큰당 표준 API 요금이다. 모델의 최대 컨텍스트와 최대 입력 또는 출력 토큰도 구분한다. 원문 주장 한 줄에 판정이 갈리면 여러 행으로 나눴다.

## 2. 표 1: 모델명, 출시일, 가격, 컨텍스트

| 항목 | 초안 주장 | 판정 | 근거와 수정 값 |
| --- | --- | --- | --- |
| OpenAI 모델명 | GPT-6 Astra, Sol, Luna | 확인 | 공식 웹: 세 API 모델이 명시되어 있다. [OpenAI 모델 목록][o-models]. 지식 단독 대조는 확인 불가. |
| OpenAI 출시일 | Astra 2026-09-03, Sol과 Luna 9월 | 확인 | 공식 API 변경 이력은 Astra 09-03, Sol과 Luna 09-22로 기록한다. [OpenAI 변경 이력][o-log]. |
| OpenAI 가격 | Sol $2/$10, Luna $0.10/$0.50, Astra 미확인 | 확인 | Sol과 Luna는 일치한다. 미확인이던 Astra는 $10/$50로 보완한다. 입력 272K 이하의 표준 요금이며 장문과 처리 등급은 별도다. [Astra][o-astra], [Sol][o-sol], [Luna][o-luna]. |
| OpenAI 컨텍스트 | 미확인 | 확인 | 세 모델 모두 1,050,000 컨텍스트, 최대 출력 128,000으로 보완 가능하다. [Astra][o-astra], [Sol][o-sol], [Luna][o-luna]. |
| Anthropic 모델명 | Fable 5.1, Opus 5.5, Sonnet 5, Haiku 4.5 | 확인 | 공식 모델 목록에 모두 있다. [Claude 모델 개요][a-models]. 지식 단독 대조는 확인 불가. |
| Fable와 Mythos 관계 | Fable 5.1은 Mythos 5.1 동급 | 이의 | 공식 설명은 같은 기반 모델에 서로 다른 safeguards를 적용한 별도 제공 형태다. Fable은 일반 제공, Mythos는 제한된 접근 프로그램이다. 접근성과 실제 응답을 동등하게 취급할 수 없다. [Anthropic 발표][a-fable]. |
| Anthropic 출시일 | Fable 09-01, Opus 5.5 09-22 | 확인 | 공식 발표와 모델 개요의 출시 관련 기록에 부합한다. Sonnet와 Haiku의 출시일은 초안에 없으므로 이 날짜를 적용하지 않는다. [Fable 발표][a-fable], [Opus 발표 목록][a-opus]. |
| Anthropic 가격 | 미확인, Opus 4.8은 $5/$25였음 | 이의 | 현재 모델 가격을 구세대 값으로 추정하면 안 된다. Fable 5.1 $10/$50, Opus 5.5 $4/$20, Sonnet 5 $2/$10, Haiku 4.5 $1/$5로 분리한다. Opus 4.8의 과거 요금 주장은 별도 확인 불가로 둔다. [Claude 모델 개요][a-models]. |
| Anthropic 컨텍스트 | 미확인 | 확인 | Fable, Opus, Sonnet는 1M, Haiku는 200K로 보완한다. 최대 출력은 앞의 세 모델 128K, Haiku 64K다. [Claude 모델 개요][a-models]. |
| Google 모델명과 날짜 | Gemini 3.8 Flash, 2026-09-02 | 확인 | Google 공식 출시 글의 모델명과 날짜가 일치한다. [Google 발표][g-launch]. 지식 단독 대조는 확인 불가. |
| Google 가격 | 3.7 Flash와 같은 도입가 | 확인 | 표준 입력 $0.75, 출력 $3.75로 두 모델이 같다. 공식 가격표상 2026-12-31까지의 도입가이며 2027-01-01부터 $1.50/$7.50로 안내한다. [Gemini 가격][g-price]. |
| Gemini 3.1 Pro 컨텍스트 | 2.5M | 이의 | 공식 `gemini-3.1-pro-preview` 입력 한도는 1,048,576, 출력 한도는 65,536이다. 2.5M을 뒷받침하지 않는다. [Gemini 3.1 Pro 문서][g-pro]. |
| Gemini Flash에 Pro 사양 적용 | 3.8 Flash의 장점으로 Pro의 2.5M 인용 | 이의 | 다른 모델 사양을 전용했다. `gemini-3.8-flash` 자체 입력 한도도 1,048,576, 출력 한도는 65,536이다. [Gemini 3.8 Flash 문서][g-flash]. |
| Google 최신성 | Pro 계열 최신은 3.1 Pro | 확인 불가 | 해당 모델의 존재는 확인했지만 Pro 계열 전체의 최신성을 입증하지 않았다. 존재와 최신 모델 여부를 분리한다. |
| xAI 모델명, 날짜 | Grok 4.7, 2026-09-21 | 확인 | 공식 릴리스 노트와 일치한다. [xAI 릴리스 노트][x-log]. 지식 단독 대조는 확인 불가. |
| xAI 가격, 컨텍스트 | $2/$6, 500K | 확인 | 표준 짧은 입력 구간 가격과 컨텍스트가 일치한다. 200K 초과 입력에는 $4/$12가 적용된다. 검색 요금도 별도다. [xAI 모델][x-models], [릴리스 노트][x-log]. |
| Grok 세대 관계 | Grok 4.7의 거래 실험 변형은 Grok 4.20 | 이의 | 과거 4.20 실험을 4.7의 변형으로 표현할 근거가 없다. 대회 당시 실험 모델, 현재 공개 4.20, 4.7을 구분해야 한다. 대회 버전과 공개 API의 동일성은 확인 불가다. |
| DeepSeek 모델명 | V4, V4-Pro-Max, V4.1-Flash | 이의 | 공개 모델과 API ID는 V4-Pro, V4.1-Flash 등을 구분한다. `V4-Pro Max`는 모델 카드에서 추론 설정을 포함한 평가 표기다. 별도 API 모델처럼 쓰지 않는다. [V4-Pro 모델 카드][d-pro], [DeepSeek 가격][d-price]. |
| DeepSeek 출시일 | V4.1-Flash 2026-09-10 | 확인 | 공식 변경 이력과 일치한다. V4 최초 preview는 04-24로 별도 기록되어 있다. [DeepSeek 변경 이력][d-log]. |
| DeepSeek 가격 | V4.1-Flash 비피크 $0.15/$0.60 | 확인 | 캐시 미적중 비피크 요금으로 맞다. 피크는 $0.30/$1.20다. 비피크 가격을 24시간 고정 요금으로 계산해서는 안 된다. [DeepSeek 가격][d-price]. |
| DeepSeek 컨텍스트 | V3.2 기준 164K | 이의 | V4와 V4.1 사양을 구세대로 설명했다. 현재 V4.1-Flash와 V4-Pro API 표에는 1M이 명시되어 있다. V3.2의 164K 자체는 이번 검토에서 확인 불가다. [DeepSeek 가격][d-price]. |
| DeepSeek 공개 가중치 | V4 계열 오픈 웨이트 MIT | 확인 | V4-Pro와 V4.1-Flash 공식 카드에서 가중치와 MIT 라이선스를 확인했다. API 서비스와 로컬 모델의 동일한 지연이나 처리량까지 보장하지 않는다. [V4-Pro][d-pro], [V4.1-Flash][d-flash]. |
| Qwen 모델명 | Qwen3.8 Max, Flash-Next, Omni-Flash | 확인 | Max는 공식 캐시 지원 모델 목록, Flash-Next는 Alibaba 발표, Omni-Flash는 Qwen 발표에서 확인된다. [Qwen 캐시 문서][q-max], [Flash-Next 발표][q-flash], [Qwen 발표 목록][q-omni]. |
| Qwen 출시일 | 모두 09-18로 읽히는 단일 날짜 | 이의 | 09-18은 Omni-Flash 발표와 맞지만 Flash-Next 발표는 08-27이다. Max의 정확한 최초 출시일은 확인 불가. 모델별 날짜를 분리한다. [Flash-Next 발표][q-flash], [Qwen 발표 목록][q-omni]. |
| Qwen 가격과 배포 이름 | Flash-Next $0.15/$0.47 | 이의 | Alibaba 발표는 공개 가중치 Flash-Next와 서비스 모델 Qwen3.8-Flash를 구분하고, 후자를 QwenCloud에서 $0.16/$0.47로 안내한다. 통화, 리전, 제공자를 생략한 $0.15를 확정할 수 없다. [Flash-Next 발표][q-flash]. |
| Qwen 컨텍스트 | 미확인 | 확인 | Flash-Next는 기본 262,144, YaRN 확장 1M, 발표 당시 서비스 Flash는 기본 1M이다. 이 값을 Max나 Omni에 일괄 적용하지 않는다. [Flash-Next 발표][q-flash]. |
| Kimi 이름, 날짜, 사양 | Kimi K3, 07-16, 네이티브 멀티모달, 1M | 확인 | 공식 홈페이지 연구 목록에 2026-07-16이 있고 K3 설명에 멀티모달과 1M이 있다. 공식 포럼의 07-22 게시일은 별도다. [Moonshot 홈페이지][k-home], [K3 발표][k-announce]. |
| Kimi 가격 | 출력 $15 | 확인 | 공식 발표는 비캐시 입력 $3, 캐시 입력 $0.30, 출력 $15를 안내한다. [K3 발표][k-announce]. |
| Kimi 가격 순위 | 가장 비쌈 | 이의 | 같은 기준의 Astra와 Fable 출력은 $50, Opus 5.5는 $20다. K3 $15가 가장 비싸다는 결론은 틀리다. [Astra][o-astra], [Claude 모델 개요][a-models]. |
| GLM 모델명 | GLM-5.3, GLM-5.3 Flash | 확인 | 공식 ZCode와 Z.ai 발표에 존재한다. 정식 표기는 `GLM-5.3-Flash`다. [ZCode][z-code], [Z.ai 발표][z-flash]. |
| GLM 출시일 | 9월 | 확인 불가 | Flash 공식 Z.ai 글에는 08-26, AutoClaw 소개에는 09-26이 보인다. 게시일과 실제 출시일을 구분할 릴리스 이력을 확보하지 못했다. 5.3과 Flash에 같은 9월을 적용하지 않는다. [Z.ai 발표][z-flash], [AutoClaw 소개][z-auto]. |
| GLM 가격 | Flash $0.15/$0.50 | 확인 불가 | 해당 숫자의 공식 과금표, 리전과 할인 조건을 확보하지 못했다. 비용 확정표에서 제외한다. |
| GLM 컨텍스트 | 미확인 | 확인 | Flash 공식 발표에 최대 1M 문맥을 다루는 설계가 설명되어 있다. API의 실제 입력과 출력 상한은 추가 확인이 필요하다. [Z.ai 발표][z-flash]. |
| Muse Spark 제조사와 존재 | Muse Spark 1.3, 제조사 미확인 | 이의 | Meta의 공식 개발자 페이지에 Muse Spark 1.3이 명시되어 있다. 제조사는 Meta로 정정한다. [Meta 개발자 페이지][meta-muse]. |
| Muse Spark 날짜와 미기재 사양 | 9월, 가격과 컨텍스트 공란 | 확인 | Meta 공식 업데이트에 2026-09-02가 보인다. 가격과 컨텍스트는 이번 검토에서 확인 불가로 유지한다. [Meta 업데이트][meta-events]. |
| 기타 모델 | Mistral, Meta Llama 계열만 기재 | 이의 | 회사나 제품군만으로 비교할 수 없다. 5절에 실제 모델 ID와 평가 역할을 보완했다. |

## 3. 표 2: 거래 대회와 벤치마크 주장

### 3.1 Alpha Arena와 학술 근거

Alpha Arena 수치는 지식 기반으로 독립 확인할 수 없다. 주최자 [nof1 원문][nof1]은 이번 조회에서 HTTP 403으로 열리지 않았다. 보도 검색 결과와 초안의 숫자가 비슷하다는 이유만으로 공식 결산을 검증했다고 표시하지 않는다.

| 항목 | 초안 주장 | 판정 | 근거와 수정 방향 |
| --- | --- | --- | --- |
| S1 환경과 기간 | 2025년 10~11월, Hyperliquid 무기한, 각 $10,000 | 확인 불가 | 지식 기반 확인 불가. 주최자 규정, 시작과 종료 시각, 계정 원장을 열람하지 못했다. 보도 내용의 사실 여부와 별개로 본 검증에서는 미확정이다. |
| S1 참가 모델 | Claude 4.5 Sonnet, DeepSeek V3.1, Gemini 2.5 Pro, GPT-5, Grok 4, Qwen3 Max | 확인 불가 | 주최자의 당시 모델 ID와 설정을 확보하지 못했다. 공식 모델명 표기는 `Claude Sonnet 4.5`처럼 세대와 제품명을 정리하되 참가 사실과 분리한다. |
| S1 최종 순위 | Qwen3 Max 1위, 6개 중 4개 손실, GPT-5 약 -63% 최하위 | 확인 불가 | 종료 시점 공식 결산과 수익률 계산 기준 미확보. 중간 순위, 최종 미실현 평가액, 수수료 반영 여부를 구분해야 한다. |
| S1.5 환경과 기간 | 2025-11-19~12-03 미국 주식 | 확인 불가 | 지식 기반 확인 불가. 현물인지 파생상품인지, 거래 가능 시간과 비용까지 확인할 공식 규정이 필요하다. |
| S1.5 모델 정체와 수익 | Mystery Model은 Grok 4.20, 4개 테마 합산 +12.11%, 유일한 흑자 | 확인 불가 | 공식 모델 공개문과 테마별 원장 미확보. 합산 수익률인지 평균 수익률인지도 불명확하다. |
| S1.5 계정 순위 | 상위 6개 중 4개가 Grok 변형 | 확인 불가 | 모델 순위와 테마별 계정 순위의 분모가 다를 수 있다. 같은 표에서 나온 순위인지 확인해야 한다. |
| S1.5 최종 계정가치 | Grok $10,927, GPT-5.1 $9,053, Gemini 3 Pro $6,718 | 확인 불가 | X 인용의 원장과 시점이 없다. 산술상 시작금 $10,000에서 $10,927은 +9.27%다. +12.11%라면 $11,211이다. 다른 계정이나 집계라면 그 차이를 명시해야 한다. |
| 2026년 시즌 부재 | 8월 기준 새 공개 결과 없음 | 확인 불가 | 검색에서 못 찾은 것은 부재의 증명이 아니다. 9월 문서에 8월 관찰을 현재 사실처럼 쓰지 않는다. |
| 단기 대회 해석 | 2주 대회로 지속적 알파를 판단하기 어려움 | 확인 | 지식 기반: 독립 표본, 시장 국면, 노출, 회전율과 비용을 통제하지 않은 단기 수익 순위로 지속성을 식별할 수 없다. |
| KTD-Fin 논문 | 수익 대부분 시장 노출, 지속적 알파 제한적 | 확인 | 공식 웹: 10개 에이전트, CSI300, 2024~2026 평가에서 시장과 스타일 노출의 기여가 크고 지속적 종목 선택 알파의 근거가 제한적이라는 초록과 부합한다. 이 실험 범위로 한정한다. [KTD-Fin][p-ktd]. |
| CLQT 논문 | 위와 같은 결론 | 이의 | 비용 통제 후 지수 초과가 뚜렷하지 않다는 점은 부합하지만 핵심은 과정 진단과 분석-행동 불일치다. KTD-Fin과 같은 요인 분해 결과로 요약하면 부정확하다. [CLQT v3][p-clqt]. |
| Agent Market Arena | 지속적 알파 약함이 공통 결론 | 이의 | 초록의 중심 결과는 기반 모델보다 에이전트 구조와 위험 스타일에 따른 행동 차이다. 시장 베타가 대부분이라는 결론으로 묶을 근거가 부족하다. ACM Web Conf 2026 게재 여부도 이번 검토에서 확인 불가다. [AMA][p-ama]. |
| StockBench | 지속적 알파 약함이 공통 결론 | 이의 | 다수가 buy-and-hold를 넘지 못하지만 일부 모델의 더 높은 수익과 위험관리 가능성도 보고한다. 모든 연구가 같은 알파 분해를 했다고 쓰지 않는다. [StockBench][p-stock]. |
| 선택 기준 | 수익 대신 도구 호출, 구조화, 비용, 실시간성 | 이의 | 지식 기반: 운영 요건은 필수지만 거래 목적의 성과 평가를 대체하지 않는다. 동일 데이터와 비용으로 비LLM 기준선 대비 순성과, 낙폭, 노출, 주문 오류를 함께 평가한다. |

### 3.2 모델별 능력 수치

| 항목 | 초안 주장 | 판정 | 근거와 수정 방향 |
| --- | --- | --- | --- |
| Astra 도구 사용 | 105개 중 5위, 70.6점 | 확인 불가 | 지식 기반 확인 불가. 평가명, 버전, 평가일, agent harness, 원시 결과가 없다. 공개 API 문서는 이 순위를 입증하지 않는다. |
| Astra Terminal-Bench | Science 64.6% | 확인 불가 | 해당 모델과 Science 버전, 추론 예산을 명시한 1차 결과를 이번 검토에서 확보하지 못했다. 다른 Terminal-Bench 버전과 비교하지 않는다. |
| Fable HLE | 도구 사용 시 65.0% | 확인 | Anthropic 발표가 Fable 5.1의 HLE with tools 65.0%를 보고한다. 발표자 수치 확인이며 독립 재현은 아니다. [Fable 발표][a-fable]. |
| HLE의 의미 | HLE 점수로 도구 호출 신뢰성 우위 판정 | 이의 | 지식 기반: 도구를 사용할 수 있는 난문제 정답률과 주문 API 인자 정확률은 다른 지표다. 잘못된 종목, 수량, 중복 주문을 측정한 점수가 아니다. |
| HLE 모델 범위와 비교 | Opus 5.5 / Fable 5.1은 65.0%, Astra 57.2%보다 높음 | 이의 | 확인한 65.0은 Fable 값이며 Opus 5.5에 복제할 수 없다. Astra 57.2의 동일 조건 원문은 확인 불가다. [Fable 발표][a-fable]. |
| Claude 코딩 | DeepSWE 73.7% | 확인 불가 | 정확한 모델, DeepSWE 버전, 실행기와 추론 설정이 없는 묶음 수치다. 확인한 Opus 발표 본문에서 이 수치를 확인하지 못했다. [Opus 발표][a-opus-launch]. |
| Claude 설명 품질 | TETH 이유 문장에 유리 | 확인 불가 | 사용자 문장과 한국어 평가 결과가 없다. 자연스러운 설명과 실제 결정의 충실성은 따로 평가해야 한다. |
| Gemini 코딩 순위 | Terminal-Bench 2.1에서 Opus 5보다 높음 | 확인 불가 | Google 발표의 읽을 수 있는 본문에서 해당 비교표를 확보하지 못했다. 벤치마크 버전과 harness가 같은 원표가 필요하다. [Google 발표][g-launch]. |
| Gemini 지연과 비용 | 싸고 빠름 | 이의 | 요금표상 상대적으로 저렴하다는 비교는 가능하다. TETH 입력에서 p95 지연을 측정하지 않았으므로 빠름을 확정하지 않는다. 가격도 Luna, DeepSeek보다 높다. |
| 구세대 대회 성적 전용 | GPT-5, Gemini 2.5/3 Pro 부진을 최신 모델의 약점으로 제시 | 이의 | 지식 기반: 모델, 프롬프트, 도구, 시장 국면이 달라 최신 Astra 또는 Flash의 성능 근거로 전용할 수 없다. |
| Grok 정보 접근 | X 실시간 데이터와 뉴스 접근 | 확인 | X Search를 명시적으로 연결할 수 있다. 모델 자체의 지식이 실시간이라는 뜻은 아니다. [X Search 문서][x-search]. |
| Grok 유일성 | 실시간 뉴스 접근이 유일한 차별점 | 이의 | Sonar의 웹 검색, Gemini의 Search grounding 등 대안이 있다. X 전용 검색 통합의 편의와 모든 실시간 정보 접근의 독점을 구분한다. [Sonar][sonar], [Gemini Flash][g-flash]. |
| Grok 거래 실력 전용 | 4.20 우승으로 4.7 선택 | 이의 | 대회 결과 자체가 이번 검토에서는 확인 불가이며, 확인되더라도 4.7의 거래 품질을 입증하지 않는다. |
| DeepSeek SWE-bench | 80.6% | 확인 | 공식 V4-Pro 카드의 `DS-V4-Pro Max`에 SWE Verified 80.6이 있다. V4.1-Flash 점수로 쓰면 안 된다. [V4-Pro 카드][d-pro]. |
| DeepSeek 순위 | 오픈 웨이트 1위 | 확인 불가 | 발표 시점, 비교 모델 집합, 같은 실행 조건을 명시한 최신 전체 순위가 없다. 80.6이라는 한 수치로 현재 1위를 확정할 수 없다. |
| DeepSeek 처리량 | 214 tok/s | 확인 불가 | 제공자, GPU, 양자화, 배치, 입력 길이, 첫 토큰 지연이 없다. 해당 처리량을 자체 호스팅 성능으로 간주할 수 없다. |
| DeepSeek 정보 접근 | 실시간 접근 없음 | 이의 | 기본 가중치는 실시간 정보를 포함하지 않지만 도구 호출로 시세와 뉴스를 전달할 수 있다. 기본 검색 서비스 부재와 외부 데이터 연결 불가능은 다르다. [DeepSeek 지원 기능][d-price]. |
| Qwen 최신 거래 능력 | Qwen3 Max 우승 계보, 저가 Flash | 이의 | Max와 Flash의 역할, 가격, 성능을 분리해야 한다. 과거 Qwen3 Max의 대회 순위로 Qwen3.8 Max나 Flash의 성과를 보장할 수 없다. |
| Qwen 한국어 | 미검 | 확인 | 이번 작업에서도 한국어 거래 설명 평가를 실행하지 않았다. 이 불확실성은 다른 후보에도 동일하게 적용한다. |
| Kimi GPQA | 93.5% | 확인 | 공식 K3 카드의 GPQA Diamond, max 설정 값이 93.5다. [K3 카드][k-card]. |
| Kimi GPQA 순위 | 최상 | 이의 | 같은 카드의 비교표에 GPT-5.6 Sol 94.1도 있다. 유일한 1위로 해석하면 틀리며 GPQA는 거래나 Pine 평가도 아니다. [K3 카드][k-card]. |
| Kimi 사용처 제한 | 출력 $15라 반복 호출 부적합 | 이의 | 최상위 모델보다 낮은 출력 단가다. 반복 호출 적합성은 토큰 수, 빈도, 품질 개선과 재시도 비용으로 판단한다. 6절의 같은 조건 계산에서는 Opus와 Astra보다 저렴하다. |
| GLM 지능 지수 | Flash 42, DeepSeek 40 | 이의 | 공식 Z.ai 글은 AA Intelligence Index v4.1.1의 Flash 점수를 57로 소개한다. 초안의 42와 40은 지수 버전과 날짜가 없어 비교를 재현할 수 없다. DeepSeek 40은 확인 불가다. [Z.ai 발표][z-flash]. |
| GLM 생태계 | 문서와 생태계가 약점 | 확인 불가 | 정량 기준이 없다. 필요한 SDK, 스키마 기능, 오류 코드, 상태 페이지와 지원 응답을 실제 통합 체크로 비교한다. |

## 4. 표 3: Pine Script v6 주장

| 항목 | 초안 주장 | 판정 | 근거와 수정 방향 |
| --- | --- | --- | --- |
| TradersPost 실험의 범위 | 2026년 범용 LLM 실측 | 이의 | 확인한 글은 2026-04-13 비교 안내 글이다. 모델 snapshot, 프롬프트별 원출력, 반복 횟수, 컴파일 로그를 갖춘 재현 가능한 실험 보고서가 아니다. [TradersPost 원문][pine-post]. |
| ChatGPT 결과 | 컴파일되지만 input와 스코프 오류, 2회 수정 | 이의 | 원문은 일반적인 초안 문제와 첫 시도에서 1~3개 컴파일 오류 수정 가능성을 설명한다. 정확히 2회 수정했다는 실험과 해당 오류 조합은 없다. 컴파일 성공과 컴파일 오류도 구분해야 한다. [TradersPost 원문][pine-post]. |
| Claude 결과 | input 혼용, 숏 손절 누락, 1회 수정 | 이의 | 원문은 일반적으로 더 깔끔하고 JSON 알림 문자열 조정이 필요할 수 있다고 한다. 이 특정 실패와 수정 횟수는 찾을 수 없다. [TradersPost 원문][pine-post]. |
| Gemini 결과 | v5 문법, 알림 미연결, 대폭 재작성 | 이의 | 해당 글의 비교 대상과 EMA 예시에는 Gemini 실험이 없다. 다른 원문이 없다면 이 인용은 삭제해야 한다. [TradersPost 원문][pine-post]. |
| 전문 도구 85% | Pineify, LuxAlgo Quant 약 85% 성공 | 이의 | 원문의 약 85% 첫 컴파일 주장은 Pineify에 붙어 있다. LuxAlgo에 같은 수치를 붙일 근거가 없다. Pineify 수치도 독립 검증값은 확인 불가다. [TradersPost 원문][pine-post]. |
| TradePilot 99% | v6 전용, 99% 첫 컴파일 목표 | 확인 | 판매자 페이지가 v6 생성과 약 99% 첫 컴파일 성공을 주장한다는 사실은 확인된다. 표본과 원로그가 없으므로 실제 99% 성능은 확인 불가다. 목표, 판매자 주장, 독립 실측을 구분한다. [TradePilot 판매자 설명][pine-tradepilot]. |
| 전문 도구 전체 우위 | 컴파일률, v6, 통합, 수정 전부 범용 모델보다 우위 | 이의 | 같은 요구사항과 같은 모델 버전으로 수행한 대조 실험이 없다. 제품 통합 기능이 좋은 것과 기반 모델의 코드 정확도가 높은 것은 별개다. |
| 버전 판별 기준 | input 혼용을 v5/v6 오류의 근거로 사용 | 이의 | `input()`은 v6에도 유효하고 `input.int()` 등도 v5에 이미 있었다. 함수명만으로 버전 오류를 판단할 수 없다. 공식 v6 문법과 정확한 컴파일 메시지를 확인해야 한다. [TradingView Inputs][tv-input]. |
| 인용 원문의 전략 알림 예시 | TradersPost 예시를 올바른 연결 기준으로 사용 | 이의 | 원문은 `strategy()`에서 `alertcondition()`을 사용한다. 공식 문서에서 `alertcondition()` 알림은 indicator 전용이다. 전략에는 `alert()` 또는 주문 체결 알림과 `alert_message`를 사용해야 한다. 컴파일만으로 알림 동작을 검증할 수 없다는 실제 반례다. [TradingView Alerts][tv-alert]. |
| 최상위 Pine 모델 | Opus 5.5, Astra, V4가 가장 적합 | 확인 불가 | 같은 Pine v6 평가 세트와 정답 로직으로 비교하지 않았다. 일반 코딩 점수만으로 순위를 정할 수 없다. |
| 컴파일 피드백 루프 | 오류를 모델에 되먹여 수정 | 확인 | 지식 기반: 유용한 검증 방식이다. 다만 컴파일 통과는 전략 의미, 리페인팅, 미래 데이터 누출, 손절과 알림의 정확성을 보장하지 않는다. |
| TETH 자동 연동 | 제품 안에서 TradingView 컴파일을 2~3회 자동 실행 | 이의 | 공식 문서는 Pine Editor 저장과 차트 추가 시 컴파일을 설명한다. TETH 서버에서 호출할 공식 컴파일 API는 이번 확인에서 확보하지 못했다. 수동 오류 전달은 제안 가능하지만 자동 연동을 이미 가능한 전제로 설계하면 안 된다. [TradingView 제한 문서][tv-limit]. |
| 재시도 횟수 | 2~3회면 충분 | 확인 불가 | 측정 근거가 없다. 최대 3회 같은 제품 예산은 정할 수 있지만 성공률 보장과 다르다. 실패 시 중단하고 사람이 검토하는 경로가 필요하다. |

## 5. 누락된 실제 모델 보완

아래 모델은 존재를 확인했다. 최신 전체 목록이나 Pine 성능 순위가 아니다. 추가 모델의 최신 사양도 지식만으로 확정한 것이 아니라 공식 웹으로 보완했다.

| 추가 모델 | 확인된 정보와 배포 | TETH 평가에 넣을 이유 | 한계와 근거 |
| --- | --- | --- | --- |
| Mistral Medium 3.5, `mistral-medium-3-5-26-04` 문서 항목 | 2026-04-28, 256K, $1.50/$7.50. 공개 가중치, Modified MIT. 도구 호출과 구조화 출력 지원 | Pine 코드 생성과 에이전트의 API 및 자체 호스팅 비교 후보 | Modified MIT 조건을 읽어야 한다. 일반 MIT로 축약하지 않는다. Pine v6 실측은 없음. [Mistral 모델 문서][m-medium]. |
| Meta Llama 3.3 70B Instruct, `meta-llama/Llama-3.3-70B-Instruct` | 실재하는 공개 가중치 모델. Llama 라이선스하에 자체 배포 가능 | 폐쇄망 문서 요약, 추출, 자체 운영 비용의 기준 후보 | 최신 또는 최고 코딩 모델이라고 추천하는 것은 아니다. 호스팅별 가격이 달라 단일 API 가격을 적지 않는다. 한국어 품질과 constrained decoding은 배포 스택에서 평가한다. [Meta 공식 모델 카드][m-llama]. |
| Perplexity Sonar, `sonar` | 128K, 토큰 $1/$1에 검색 요청 비용 별도. 웹 검색과 출처 제공 | 뉴스와 공시의 출처 수집 및 요약. Grok 뉴스 보조 역할의 대조군 | 문서에서 Sonar API는 Legacy 구역에 있다. 신규 통합 수명과 후속 API를 먼저 확인한다. 주문 판단 또는 Pine 1순위 근거는 없다. 자체 가중치 배포 대상으로 보지 않는다. [Sonar 모델 문서][sonar], [모델 목록][sonar-models]. |
| Cohere Command A, `command-a-03-2025` | 256K, $2.50/$10. 도구 사용과 구조화 출력. 한국어를 지원 언어로 명시 | 한국어 공시 RAG, 출처 기반 리서치와 내부 문서 질의 | 문서는 두 GPU 배포를 안내하지만 상업 자체 배포 조건을 별도 확인해야 한다. 한국어 지원은 한국 금융 설명 우위의 증거가 아니다. [Cohere Command A][m-cohere]. |
| Amazon Nova 2 Lite | 2025-12-02 발표, 1M, Bedrock 제공, 추론 예산 조절과 웹 grounding, 코드 실행 | AWS 안에서 운영할 추출, 요약, 도구 기반 에이전트 후보 | 공식 출시 문서로 존재와 기능을 확인했다. 리전별 가격, 계정 접근, 엄격한 스키마 지원 조합은 이번 검토에서 미확정이다. 공개 가중치 자체 호스팅 모델로 취급하지 않는다. [AWS 발표][m-nova]. |

초안의 Meta 누락은 Muse Spark 1.3 제조사 정정으로도 보완된다. 다만 Llama의 공개 가중치 성격을 Muse Spark에 그대로 적용해서는 안 된다. Devstral 2도 실제 코딩 모델이지만 현재 Mistral 문서는 2026-05-22 폐기와 Medium 3.5 대체를 안내하므로 신규 API 기본 후보에 넣지 않았다. [Devstral 2 수명 문서][m-devstral].

## 6. 4절 조합 제안에 대한 엔지니어링 이의

### 6.1 15분 주기 비용 계산

암호자산 24시간 운용, 30일, 종목당 주기별 모델 호출 1회라는 가정이다. 한국 또는 미국 주식은 장 운영 시간과 거래일 수로 다시 계산해야 한다. 아래는 추정 사용량에 공개 단가를 곱한 계산이며 실제 청구서가 아니다.

```text
하루 주기 수 = 24 * 60 / 15 = 96
월 호출 수 = 96 * 30 * 종목 수 N = 2,880N
월 토큰 비용 = 2,880N * (입력 토큰 I * 입력 단가 Pi + 과금 출력 토큰 O * 출력 단가 Po) / 1,000,000

가정: I = 4,000, O = 1,000
종목 100개: 월 288,000회, 입력 1,152,000,000토큰, 출력 288,000,000토큰
```

출력 1,000은 사용자에게 보이는 설명 길이가 아니라 청구되는 추론 토큰을 포함한 예산이다. 도구 결과 재입력과 다중 턴은 위 입력 4,000에 포함되지 않으면 추가된다. 모델마다 한국어 토큰 수가 달라 같은 문자열로 실제 토큰화를 측정해야 한다.

| 모델과 적용 조건 | 입력/출력 단가 | 호출당 USD | 10종목 월 USD | 100종목 월 USD | 1,000종목 월 USD |
| --- | --- | --- | --- | --- | --- |
| GPT-6 Luna, 표준 짧은 입력 | $0.10/$0.50 | 0.00090 | 25.92 | 259.20 | 2,592.00 |
| DeepSeek V4.1-Flash, 비피크, 캐시 미적중 | $0.15/$0.60 | 0.00120 | 34.56 | 345.60 | 3,456.00 |
| DeepSeek V4.1-Flash, 피크, 캐시 미적중 | $0.30/$1.20 | 0.00240 | 69.12 | 691.20 | 6,912.00 |
| Qwen3.8-Flash, 발표의 QwenCloud 조건 | $0.16/$0.47 | 0.00111 | 31.97 | 319.68 | 3,196.80 |
| Gemini 3.8 Flash, 2026년 도입가 | $0.75/$3.75 | 0.00675 | 194.40 | 1,944.00 | 19,440.00 |
| Grok 4.7, 입력 200K 이하 | $2/$6 | 0.01400 | 403.20 | 4,032.00 | 40,320.00 |
| GPT-6 Sol, 표준 짧은 입력 | $2/$10 | 0.01800 | 518.40 | 5,184.00 | 51,840.00 |
| Kimi K3, 캐시 미적중 | $3/$15 | 0.02700 | 777.60 | 7,776.00 | 77,760.00 |
| Claude Opus 5.5 | $4/$20 | 0.03600 | 1,036.80 | 10,368.00 | 103,680.00 |
| GPT-6 Astra | $10/$50 | 0.09000 | 2,592.00 | 25,920.00 | 259,200.00 |

단가 출처: [Luna][o-luna], [Sol][o-sol], [Astra][o-astra], [DeepSeek 가격][d-price], [Qwen 발표][q-flash], [Gemini 가격][g-price], [Grok 가격][x-models], [Kimi 발표][k-announce], [Claude 개요][a-models].

DeepSeek 피크는 공식 문서상 중국 공휴일을 제외한 평일 UTC 01:00~04:00, 06:00~10:00다. 실제 월 비용은 시간대별 호출량으로 가중해야 한다. 위 두 행은 24시간 운용의 단일 확정 견적이 아니라 요금 범위다. Gemini는 공지된 2027년 단가 적용 시 같은 토큰량 비용이 두 배가 된다. [DeepSeek 가격][d-price], [Gemini 가격][g-price].

100종목을 모두 저가 스캔하고 5%를 Opus 5.5로 추가 검토하는 예에서는 DeepSeek 범위 $345.60~691.20에 Opus $518.40이 더해져 $864.00~1,209.60이다. 같은 길이 호출이 평균 10% 추가되는 재시도 가정까지 넣으면 $950.40~1,330.56이다. 이 계산은 독립된 2단계 호출이며 상위 검토의 더 긴 입력이나 더 많은 추론은 별도다.

검색, 거래소 시세 계약, 서버, 저장소, 로그, 세금과 네트워크는 제외했다. 예를 들어 Sonar 문서의 low 검색 요청 요금 $5/1,000회만으로도 288,000회 검색은 토큰 비용 외 $1,440이다. 같은 뉴스는 종목별로 재검색하기보다 시간과 주제 단위로 공유해야 한다. [Sonar 요청 요금][sonar]. 캐시 적중을 측정하지 않고 캐시 할인이나 Batch 할인을 실시간 운용 기본값으로 가정하지 않는다.

### 6.2 지연시간과 처리 용량

초안에는 실제 p50, p95, p99, 첫 토큰 지연, 도구 왕복, 429 비율이 없다. `214 tok/s` 같은 출력 속도는 한 주기의 총 지연이 아니다. 대기열, 긴 입력 처리, 추론, 시세 조회, 재시도와 주문 검증을 합쳐 측정해야 한다.

지식 기반 계산 예: 종목 100개, 한 작업 10초, 동시 실행 10개라면 이상적인 단일 단계도 `ceil(100/10) * 10 = 100초`다. 이는 관측값이나 p95 보장이 아니다. 15분 봉이 닫힌 직후 100종목을 1분 내 시작하려면 입력만 약 400,000 TPM, 100 RPM이 필요하며 실제 공급자 한도와 추론 토큰 계산을 확인해야 한다. 전 주기가 끝나기 전 새 주기가 시작되면 오래된 판단은 취소한다.

초기 제안은 봉 마감부터 최종 판단까지 p95 60초 이하를 목표로 측정하고, 데이터 유효기간과 의사결정 만료 시각을 별도로 설정하는 것이다. 이 수치는 제품 목표이지 검증된 모델 성능이 아니다. 손절과 긴급 중지는 15분 LLM 호출을 기다리게 해서는 안 된다.

### 6.3 도구 호출, 구조화 출력, 주문 신뢰성

| 후보 | 문서로 확인한 기능 | 엔지니어링 이의 또는 추가 확인 |
| --- | --- | --- |
| GPT-6 Astra, Sol, Luna | 모델 페이지에 function calling과 structured outputs가 명시됨 | Astra의 도구 호출은 Responses API가 필요하다. Luna는 Chat Completions에서 `reasoning_effort=none`일 때만 function calling을 지원한다고 안내한다. 모든 모델을 같은 Chat Completions 어댑터로 교체할 수 있다고 가정하면 안 된다. [변경 이력][o-log], [Luna][o-luna], [Sol][o-sol]. |
| Claude Opus 5.5 등 | Claude 문서에 JSON 스키마 출력과 strict tool use가 있음 | 스키마 부분집합, 거부, 토큰 상한, 플랫폼 차이를 검사한다. 일부 SDK는 지원하지 않는 수치 제약을 단순화하므로 원래 스키마로 서버에서 다시 검증해야 한다. [Claude 구조화 출력][a-structured]. |
| Gemini 3.8 Flash | Function calling과 structured outputs 지원 | 같은 요청에서 사용하는 도구와 스키마 조합을 실제 계약 테스트로 확인한다. [Flash 모델 문서][g-flash]. |
| DeepSeek V4.1-Flash | JSON Output과 Tool Calls 지원 | JSON 문법 지원만으로 임의 JSON Schema의 엄격한 준수를 확정하지 않는다. strict 모드, API 경로, 추론 모드 조합은 이번 문서 확인에서 미완료다. [DeepSeek 기능표][d-price]. |
| Grok 4.7 | 도구 호출, X Search, 구조화 출력 문서 제공 | 검색 활성화와 비용, 멀티턴 추론 상태 전달을 확인한다. 외부 뉴스는 주문 명령으로 취급하지 않는다. [Grok 모델][x-models], [X Search][x-search]. |
| Qwen, Kimi, GLM의 정확한 배포 버전 | 모델 존재와 일부 기능은 확인 | API 제공자별 strict 스키마, 도구 병렬 호출, 거부와 오류 형식의 조합은 미검증이다. 지원을 일괄 확정하지 않는다. |

지식 기반 설계 제안: 모델은 `action`, `symbol`, `side`, `quantity`, `price_limit`, `valid_until`, `evidence_ids`를 가진 판단 제안을 반환한다. 서버는 허용 종목, 시각, 단위, 잔고, 최대 노출, 호가 단위, 수량 단위, 중복 키를 검증한다. 구조가 맞는 JSON도 경제적으로 잘못된 주문일 수 있다.

모델에는 시세, 포지션, 뉴스의 읽기 도구를 주고 실제 주문은 별도 실행기가 처리한다. 주문 타임아웃 후 동일 주문을 무조건 재발행하지 않고 client order ID로 접수 상태를 조회한다. 부분 체결, 취소 중 체결, 잔고 변경, 429, 연결 끊김을 테스트한다. 재시도는 비용뿐 아니라 중복 주문 위험을 만든다. 모델 자체의 confidence 숫자만으로 상위 모델 승격이나 주문 승인을 결정하지 않는다.

### 6.4 자체 호스팅

초안의 공개 가중치와 자체 운영 가능성을 가격 우위로 바로 연결하는 데 이의가 있다. V4-Pro는 공식 카드상 총 1.6T, V4.1-Flash는 552B 규모다. 활성 파라미터 수가 작아도 전체 가중치와 KV 캐시의 메모리 부담이 사라지지 않는다. [V4-Pro][d-pro], [V4.1-Flash][d-flash].

DeepSeek MIT 가중치, Mistral Modified MIT, Meta Llama, Kimi K3 전용 라이선스는 각각 다르다. K3 카드도 가중치 공개를 확인할 수 있으므로 Kimi를 API 전용이라고 단정해서는 안 된다. [Mistral][m-medium], [Llama][m-llama], [Kimi 카드][k-card]. 자체 배포의 검토식은 `월 GPU 시간 * 시간당 비용 + 예비 용량 + 저장 및 통신 + 운영 인력`이다. GPU 견적과 목표 처리량을 측정하지 않았으므로 API보다 싸다는 결론은 확인 불가다.

양자화, 추론 엔진, 도구 파서, 스키마 강제 디코딩과 동시 처리 수준이 달라지면 공개 API와 행동이 달라질 수 있다. 상용 폐쇄 모델을 자체 호스팅할 수 있다고 가정하지 않는다. Bedrock 같은 관리형 제공과 공개 가중치 자체 배포도 구분한다.

### 6.5 한국어 품질

Qwen만 한국어 미검으로 적은 것은 불균형하다. 모든 후보에서 TETH 한국어 품질은 미검증이다. 한국어 지원 목록이나 번역 유창성만으로 금융 설명과 전략 해석을 검증할 수 없다.

초기 평가안은 동일한 한국어 요구사항 100개 이상을 고정하고, 롱과 숏, 수익률과 손익, 만원과 USDT, 손절과 익절, 미실현과 실현, 조건 부정과 예외의 보존을 채점하는 것이다. 같은 판단 JSON을 한국어 설명으로 바꿨을 때 수치와 방향이 바뀌지 않는지 별도로 검사한다. 자연스러움, 출처 충실성, 주문 의미 정확성을 나누어 사람이 모델명을 가린 상태로 평가한다. 이 표본 규모는 제안이며 평가를 실행한 것은 아니다.

## 7. TETH 조합 제안 수정안

모델을 5개 상시 연결하기보다 평가할 역할과 승격 조건부터 고정한다. 현재 TETH는 정적 데모이고 실제 모델 호출, 실거래 주문, 자동 Pine 컴파일 서비스는 미구현이다. 아래는 후속 엔지니어링 제안이며 제품의 현재 기능 설명이 아니다.

| 역할 | 수정 후보 | 선정 또는 승격 조건 |
| --- | --- | --- |
| A 시장 수치 계산과 규칙 검사 | 결정론적 코드 | OHLCV, 지표, 노출과 주문 제약은 코드로 계산한다. 같은 입력에 같은 결과를 주는 비LLM 기준선을 만든다. |
| A 반복 선별 | GPT-6 Luna와 DeepSeek V4.1-Flash를 우선 대조, Gemini 3.8 Flash는 비교 후보 | 실제 도구 오류율과 스키마 검증, 지연 목표를 통과한 후보 중 요청당 총비용이 낮은 모델을 택한다. Qwen3.8-Flash는 가격 적용 리전과 API 계약 확인 후 추가한다. |
| A 복잡한 판단 검토 | GPT-6 Sol 또는 Claude Sonnet 5를 기본 비교, Opus 5.5를 상위 후보로 평가 | 상위 모델 사용은 규칙 충돌, 새로운 사건, 입력 누락 같은 명시적 조건으로 제한한다. Astra와 Fable은 더 비싼 비용을 정당화할 개선이 측정될 때만 승격 후보로 쓴다. |
| A 뉴스와 심리 근거 | X가 필요한 경우 Grok 4.7 + X Search, 일반 웹은 Sonar 또는 Gemini grounding 비교 | 기사 원문 URL, 발표 시각, 수집 시각, 종목 매핑을 보존한다. 같은 뉴스 결과를 공유한다. Sonar의 Legacy API 수명도 확인한다. |
| A 주문 실행 | 별도 서버 실행기 | 모델 출력 검증, 노출 한도, 주문 중복 방지, 상태 재조회, 긴급 정지를 구현한다. 모델의 다수결은 주문 승인 조건을 대체하지 않는다. |
| B Pine 기본 생성 | GPT-6 Sol과 Claude Sonnet 5를 동일 과제로 비교 | 고정된 v6 문서와 전략 명세를 제공하고 첫 컴파일률, 로직 일치, 알림, 비용을 측정한다. 초안의 Opus 우선순위는 평가 전 가설로 낮춘다. |
| B 어려운 Pine 수정 | Claude Opus 5.5와 GPT-6 Astra를 상위 비교, Mistral Medium 3.5를 자체 운영 대조군으로 검토 | 기본 후보보다 성공당 비용이나 의미 정확도가 개선될 때만 승격한다. DeepSeek V4.1-Flash도 대량 생성 평가에는 넣을 수 있지만 V4-Pro 80.6 점수를 대신 붙이지 않는다. |

Pine 흐름은 `전략 명세 확정 -> v6 생성 -> TradingView Editor 검증 -> 오류와 실행 결과 전달 -> 예산 내 수정 -> 의미 검토`로 제안한다. 공식 컴파일 연동 경로를 확보하기 전에는 사용자가 Editor 결과를 전달하는 방식으로 설계한다. 수정 횟수 제한에 도달하면 성공으로 표시하지 않고 실패 이유와 코드를 남긴다.

Pine 평가에는 EMA 같은 단순 예제뿐 아니라 멀티타임프레임, 세션과 시간대, 롱/숏 손절, 청산과 반전, 수수료와 슬리피지, 리페인팅, 주문 체결 알림을 포함한다. 동일한 생성 기회와 최대 3회 수정 예산으로 첫 컴파일률, 최종 컴파일률, 요구사항 일치율, 실행 의미 오류율, 성공한 전략 1개당 비용과 시간을 기록한다. 컴파일 성공과 손익이 좋아 보이는 백테스트를 같은 성공 지표로 합치지 않는다.

실거래 후보는 동일 데이터와 도구 계약에서 테스트한 뒤 paper trading으로 전환한다. 수익률만 비교하지 않고 순성과, 최대 낙폭, 시장 노출, 회전율, 거래 비용, 주문 오류, 기권률과 지연을 함께 기록한다. 최신 모델의 지식 컷오프와 겹치는 과거 데이터는 기억 오염 가능성이 있으므로 종목과 날짜 마스킹 및 이후 기간 평가를 병행한다. KTD-Fin과 CLQT가 지적하는 평가 문제를 TETH에서도 확인하기 위한 제안이다. [KTD-Fin][p-ktd], [CLQT][p-clqt].

## 8. 검증 범위와 남은 항목

수행: 초안의 모든 모델 행, 거래 대회 주장, 모델별 벤치마크 수치, Pine 주장과 4절 조합을 검토했다. 공식 API 문서, 제조사 모델 카드, 논문 초록과 인용 원문을 대조했고 비용식을 계산했다. 초안은 직접 수정하지 않았다.

미수행: 실제 유료 API 호출, 거래 주문, 모델별 지연과 한국어 실측, Pine 컴파일 및 전략 실행, 판매자 성공률 재현, Alpha Arena 공식 원장 재계산. API 계정과 실행 실험을 사용하지 않았고 nof1 원문은 403이었다. 따라서 본 문서는 소스 검증 보고서이며 모델 실측 성능 보고서가 아니다. 표에서 `확인 불가`인 출시일과 수치, GLM 가격, 공급자별 strict 스키마 조합은 합의본에서도 미확정으로 유지해야 한다.

새 문서 역할을 저장소 AGENTS.md의 파일 표에 등록했다. 문서 변경만 수행하므로 브라우저 제품 회귀는 실행하지 않았다. `rtk proxy git diff --check`를 통과했고 금지 문자, 출처 참조 49개, 초안 상대 링크, 비용표 10행의 산술을 검사했다. 판정은 확인 30개, 이의 36개, 확인 불가 21개다. 원본 초안의 SHA-256이 작업 전후 일치하며 기존 AGENTS.md 변경분도 보존했다.

[o-models]: https://developers.openai.com/api/docs/models
[o-log]: https://developers.openai.com/api/docs/changelog
[o-astra]: https://developers.openai.com/api/docs/models/gpt-6-astra
[o-sol]: https://developers.openai.com/api/docs/models/gpt-6-sol
[o-luna]: https://developers.openai.com/api/docs/models/gpt-6-luna
[a-models]: https://platform.claude.com/docs/en/models/overview
[a-fable]: https://www.anthropic.com/claude-fable-and-mythos-5-1
[a-opus]: https://www.anthropic.com/claude/opus
[a-opus-launch]: https://www.anthropic.com/claude-opus-5-5
[a-structured]: https://platform.claude.com/docs/en/build-with-claude/structured-outputs
[g-launch]: https://blog.google/innovation-and-ai/models-and-research/gemini-models/3-8-flash-and-3-8-flash-cyber/
[g-price]: https://ai.google.dev/gemini-api/docs/pricing
[g-pro]: https://ai.google.dev/gemini-api/docs/models/gemini-3.1-pro-preview
[g-flash]: https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash
[x-log]: https://docs.x.ai/developers/release-notes
[x-models]: https://docs.x.ai/developers/models
[x-search]: https://docs.x.ai/developers/tools/x-search
[d-log]: https://api-docs.deepseek.com/updates/
[d-price]: https://api-docs.deepseek.com/quick_start/pricing/
[d-pro]: https://huggingface.co/deepseek-ai/DeepSeek-V4-Pro
[d-flash]: https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash
[q-max]: https://www.alibabacloud.com/help/en/model-studio/context-cache
[q-flash]: https://www.alibabacloud.com/blog/qwen3-8-flash-next-a-new-architecture-towardsultimate-cost-efficiency_603501
[q-omni]: https://qwen.ai/research/qwen3.8-livetranslate
[k-home]: https://www.moonshot.ai/
[k-announce]: https://forum.moonshot.ai/t/kimi-k3-is-here-our-most-capable-model/480
[k-card]: https://huggingface.co/moonshotai/Kimi-K3
[z-code]: https://zcode.z.ai/en
[z-flash]: https://z.ai/blog/glm-5.3-flash
[z-auto]: https://autoclaw.z.ai/blog/model/glm-5.3-flash/
[meta-muse]: https://ai.meta.com/llama
[meta-events]: https://ai.meta.com/events/
[nof1]: https://nof1.ai/
[p-ktd]: https://arxiv.org/abs/2605.28359
[p-clqt]: https://arxiv.org/abs/2606.29771v3
[p-ama]: https://arxiv.org/abs/2510.11695v2
[p-stock]: https://arxiv.org/abs/2510.02209v2
[pine-post]: https://blog.traderspost.io/article/using-ai-to-write-tradingview-pine-script
[pine-tradepilot]: https://tradepilot.co.in/tradingview-strategy-generator
[tv-input]: https://www.tradingview.com/pine-script-docs/concepts/inputs/
[tv-alert]: https://www.tradingview.com/pine-script-docs/concepts/alerts/
[tv-limit]: https://www.tradingview.com/pine-script-docs/writing/limitations/
[m-medium]: https://docs.mistral.ai/models/mistral-medium-3-5-26-04
[m-devstral]: https://docs.mistral.ai/models/devstral-2-25-12
[m-llama]: https://huggingface.co/meta-llama/Llama-3.3-70B-Instruct
[sonar]: https://docs.perplexity.ai/docs/sonar/models/sonar
[sonar-models]: https://docs.perplexity.ai/docs/sonar/models
[m-cohere]: https://docs.cohere.com/docs/command-a
[m-nova]: https://aws.amazon.com/blogs/aws/introducing-amazon-nova-2-lite-a-fast-cost-effective-reasoning-model/

ux-audit/research/CODEX_VERIFY_MODELS.md
