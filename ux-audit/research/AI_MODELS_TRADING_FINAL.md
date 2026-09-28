# 거래 판단용 AI와 파인스크립트용 AI, 합의본 (2026-09-28)

Claude 초안(웹 검색) → Codex 검증(공식 문서 대조, 이의 40여 건) → 리드 합의. 초안 AI_MODELS_TRADING.md, 검증 CODEX_VERIFY_MODELS.md. 표기: [확인] 공식 문서나 1차 출처, [보도] 언론·커뮤니티 보도(2차), [미검] 검증 못 함.

## 1. 실제 존재하는 모델 (2026년 9월)
| 회사 | 모델 | 가격 입력/출력 ($/1M) | 컨텍스트 | 거래 판단(A) 관점 | Pine 작성(B) 관점 |
|---|---|---|---|---|---|
| OpenAI | GPT-6 Astra | 10 / 50 (272K 초과 시 20/75) | 1.05M, 출력 128K, 도구 호출·JSON 스키마 [확인] | 최상위 추론. 15분 주기 반복 호출엔 너무 비쌈(100종목 월 약 $25,920) | 어려운 수정용 상위 후보 |
| OpenAI | GPT-6 Sol | 2 / 10 | [확인] | 복잡한 판단 검토의 기본 비교 후보 | Pine 기본 생성 비교 후보 |
| OpenAI | GPT-6 Luna | 0.10 / 0.50 | [확인] | 반복 선별(스캔)의 최저가 후보(100종목 월 약 $259) | 대량 생성 |
| Anthropic | Claude Fable 5.1 | 10 / 50 [확인] | | 도구 사용 HLE 65.0%(Fable 값, Opus로 복제 금지) [확인] | 상위 |
| Anthropic | Claude Opus 5.5 | 4 / 20, 캐시 읽기 0.20 | 1M, 출력 128K, 적응형 사고 기본 [확인] | 복잡한 판단 검토 상위 후보(100종목 월 약 $10,368) | 어려운 수정 상위 비교 |
| Anthropic | Claude Sonnet 5 | 2 / 10 [확인] | | 복잡한 판단 검토 기본 비교 | Pine 기본 생성 비교 후보 |
| Anthropic | Claude Haiku 4.5 | 1 / 5 [확인] | | 경량 | 경량 |
| Google | Gemini 3.8 Flash | 0.75 / 3.75(도입가) | 입력 1,048,576, 출력 65,536 [확인, 2.5M 아님] | 선별 비교 후보, Search grounding 있음 | 비교 후보 |
| Google | Gemini 3.1 Pro (preview) | | 입력 1,048,576 [확인] | | |
| xAI | Grok 4.7 (2026-09-21) | 2 / 6 | 500K [확인] | X 실시간 검색 통합이 편의점. 실시간 정보 자체는 Sonar·Gemini grounding으로도 가능 | |
| xAI | Grok 4.20 (공개 버전) | | | Alpha Arena S1.5 우승은 "실험 변형"이며 공개 4.20·4.7과 동일성 미확인 [보도] | |
| DeepSeek | V4-Pro, V4.1-Flash(9-10) | Flash 0.15/0.60 비피크, 피크 2배 | API 표 1M [확인] | 반복 선별 최우선 대조군(100종목 월 $346~691). 실시간 정보는 도구 호출로 공급 | V4-Pro SWE-bench Verified 80.6(오픈 웨이트 1위) [보도], Flash에 이 점수 전용 금지 |
| Alibaba | Qwen3.8-Max / Flash-Next(8-27, 공개 가중치) / Flash(서비스 0.16/0.47) / Omni-Flash(9-18) | | | 저가 스캔 후보(리전·계약 확인 필요). Qwen3 Max의 S1 우승을 3.8에 보장 금지 | |
| Moonshot | Kimi K3 (7-16) | 3 / 15 | 1M, 네이티브 멀티모달 [확인] | Astra·Fable(50)·Opus(20)보다 출력 단가 낮음. 장문 리서치용 | |
| Zhipu | GLM-5.3 / 5.3 Flash | Flash 0.15/0.50 | | 저가 대안(지수 점수는 버전·날짜 없이 비교 불가) | |
| Meta | Muse Spark 1.3 (9-02, 1.1은 7-09) | 1.25 / 4.25 | 1M [확인] | 중가 후보, 공개 가중치 아님 | |
| Meta | Llama 3.3 70B Instruct | 공개 가중치 | | 폐쇄망 요약·추출 기준선 | |
| Mistral | Medium 3.5 (4-28, 128B dense, Modified MIT), Large 3 | Medium 1.50/7.50, Large 2/6 | Medium 256K [확인] | 자체 호스팅 대조군, 도구 호출·구조화 출력 | 자체 운영 Pine 대조군 |
| Perplexity | Sonar (Legacy 구역), Agent API 권장 | 1 / 1 + 검색 요청 $5/1,000회 | 128K [확인] | 뉴스·공시 출처 수집. 신규 통합 수명 확인 | |
| Cohere | Command A (command-a-03-2025) | 2.50 / 10 | 256K, 한국어 명시 [확인] | 한국어 공시 RAG | |
| Amazon | Nova 2 Lite (2025-12) | Bedrock | 1M [확인] | AWS 내부 운영 후보 | |

## 2. "실제로 돈을 굴려 본" 근거는 얼마나 믿을 만한가
- nof1 Alpha Arena 시즌 1 (2025-10~11, Hyperliquid 무기한, $10,000씩): Qwen3 Max 1위, 6개 중 4개 손실, GPT-5 −63% [보도, iweaver·protos]. 시즌 1.5 (2025-11-19~12-03, 미국 주식): Mystery Model = Grok 4.20 실험 변형이 +12.11% 합산으로 유일한 흑자 [보도, Yahoo Finance·gncrypto]. 2026년 새 시즌 공개 결과 없음.
- 한계(Codex 이의 수용): 2주 표본, 실험 변형과 공개 API 동일성 미확인, 구세대(GPT-5, Gemini 2.5/3 Pro) 성적을 최신 모델의 약점으로 전용 금지.
- 학술 벤치마크(KTD-Fin, CLQT, Agent Market Arena, StockBench): 다수 에이전트가 buy-and-hold를 넘지 못한다는 점은 공통, 다만 결론은 논문마다 다르다(요인 분해, 분석-행동 불일치, 에이전트 구조 차이). "모델별 실력 순위"로 읽으면 안 된다.
- 결론: 모델 선택은 도구 호출 오류율, 스키마 검증, 지연, 비용 + 동일 데이터에서의 paper trading 성과(순성과, 낙폭, 노출, 주문 오류)를 함께 측정해 정한다.

## 3. 파인스크립트(Pine v6)
- 범용 LLM은 첫 시도에 컴파일 오류 1~3개가 흔하다는 것이 실무 글의 공통 서술(TradersPost 2026-04 안내 글, 재현 실험 아님). 초안의 "ChatGPT 2회, Claude 1회, Gemini 재작성" 같은 구체 수치는 원문에 없어 삭제.
- 전문 도구(Pineify 약 85% 첫 컴파일 주장, TradePilot v6 전용 약 99% 주장)는 판매자 주장이며 독립 실측 없음.
- 주의: `input()`은 v6에도 유효해 함수명만으로 v5/v6 오류를 판단할 수 없다. strategy()에서는 alertcondition()이 아니라 alert() 또는 주문 체결 알림을 쓴다.
- TETH 흐름: 전략 명세 확정 → v6 생성 → TradingView Editor 검증 → 오류·실행 결과 전달 → 예산 내 수정(최대 3회) → 의미 검토(리페인팅, 미래 데이터 누출, 손절·알림). 공식 컴파일 API를 확보하기 전에는 사용자가 Editor 결과를 붙여넣는 방식.
- Pine 후보 비교는 GPT-6 Sol vs Claude Sonnet 5(기본), Opus 5.5 vs Astra(어려운 수정), Mistral Medium 3.5(자체 운영), DeepSeek V4.1-Flash(대량)로 같은 과제·같은 v6 문서로 측정한 뒤 정한다.

## 4. TETH 조합(합의안, 후속 엔지니어링 제안)
| 역할 | 후보 | 조건 |
|---|---|---|
| 시장 수치·규칙 검사 | 결정론적 코드 | 지표·노출·주문 제약은 LLM이 아니라 코드 |
| 반복 선별(15분 주기 스캔) | GPT-6 Luna, DeepSeek V4.1-Flash 우선 대조, Gemini 3.8 Flash 비교, Qwen3.8-Flash는 계약 확인 후 | 도구 오류율·스키마 검증·지연 통과 후 요청당 총비용 최저 |
| 복잡한 판단 검토(승격) | GPT-6 Sol 또는 Claude Sonnet 5 기본, Opus 5.5 상위, Astra·Fable은 측정된 개선 있을 때만 | 규칙 충돌·새 사건·입력 누락 같은 명시 조건에서만 호출 |
| 뉴스·심리 근거 | Grok 4.7 + X Search(X 필요 시), 일반 웹은 Sonar 또는 Gemini grounding | 원문 URL·발표 시각·종목 매핑 보존, 결과 공유 |
| 주문 실행 | 별도 서버 실행기 | 출력 검증, 노출 한도, 중복 방지, 상태 재조회, 긴급 정지. 모델 다수결은 승인 조건이 아님 |
| Pine 생성/수정 | 3절 | |

비용 감각(암호자산 24시간, 종목당 15분마다 1회, 입력 4,000·출력 1,000 토큰): 100종목 월 Luna $259, V4.1-Flash $346~691, Gemini 3.8 Flash $1,944, Grok 4.7 $4,032, Sol $5,184, Opus 5.5 $10,368, Astra $25,920. 100종목 저가 스캔 + 5% Opus 승격 = 약 $864~1,210 (검색 요청·시세·서버 비용 별도).

## 5. 출처(주요)
OpenAI 모델 페이지(Astra·Sol·Luna), Anthropic 모델 개요와 Fable 발표, Google Gemini 3.8 Flash·3.1 Pro 문서, x.ai 모델 페이지, DeepSeek 가격·V4-Pro 카드, Alibaba Qwen3.8 발표, Moonshot K3 카드, Z.ai GLM-5.3 Flash 발표, Meta 개발자 페이지(Muse Spark), Mistral 문서, Perplexity Sonar 문서, Cohere Command A 문서, AWS Nova 2 발표, TradingView Pine 문서, TradersPost 글, nof1 관련 보도(Yahoo Finance, gncrypto, iweaver, protos), arXiv 2605.28359 / 2606.29771, OpenReview StockBench.
