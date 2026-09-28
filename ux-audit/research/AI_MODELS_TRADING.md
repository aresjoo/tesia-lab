# 거래 판단용 AI 모델과 파인스크립트 작성용 AI 모델 목록 (초안, 2026-09-28)

작성: Claude(웹 검색 근거) → Codex 검증 → 합의본. 표기: [확인] 출처로 확인된 사실, [추정] 출처가 약하거나 경험칙, [미검] 검증 필요.

## 0. 두 작업이 요구하는 능력
| 작업 | 필요한 능력 | 왜 |
|---|---|---|
| A. 실거래 판단 (시장 데이터 받아 판단, 주문) | 도구 호출 정확도(가격, 잔고, 주문 API), 구조화 출력(JSON), 긴 컨텍스트(수백 봉 + 뉴스), 낮은 지연과 비용(15분마다 호출), 환각 억제, 실시간 정보 접근 | 판단은 반복 호출이라 비용과 안정성이 품질만큼 중요 |
| B. 파인스크립트 작성 (TradingView Pine v6) | Pine v6 문법 정확성(v5와 혼동 없음), 컴파일 오류 자가 수정, 전략 로직 번역 | 일반 LLM은 v5/v6 혼합과 스코프 오류를 자주 냄 [확인: TradersPost 테스트] |

## 1. 실제 존재하는 모델 목록 (2026년 9월 기준)
| 회사 | 현행 모델 | 출시 | 가격(입력/출력, 1M 토큰) | 컨텍스트 | 근거 |
|---|---|---|---|---|---|
| OpenAI | GPT-6 Astra(최상위), GPT-6 Sol, GPT-6 Luna | 2026-09-03 / 9월 | Astra $10/$50(272K 초과 시 $20/$75), Sol $2/$10, Luna $0.10/$0.50 | Astra 1.05M, 출력 128K. 도구 호출·JSON 스키마 구조화 출력 지원 | [확인] openrouter, llm-stats, cloudzero |
| Anthropic | Claude Fable 5.1(=Mythos 5.1 동급), Claude Opus 5.5, Sonnet 5, Haiku 4.5 | Fable 9-01, Opus 5.5 9-22 | Opus 5.5 $4/$20(캐시 읽기 $0.20), Fable 미확인 | Opus 5.5 1M, 출력 128K, 적응형 사고 기본 켜짐 | [확인] llm-stats, finout, emergent |
| Google | Gemini 3.8 Flash (Pro 계열은 3.1 Pro가 최신 확인) | 2026-09-02 | 3.7 Flash와 동일 도입가 | 3.1 Pro 2.5M [확인] | [확인] |
| xAI | Grok 4.7 (거래 실험 변형 Grok 4.20) | 2026-09-21 | $2/$6 | 500K | [확인] lorka, x.ai |
| DeepSeek | V4 / V4-Pro-Max(오픈 웨이트 MIT), V4.1-Flash | V4.1-Flash 9-10 | V4.1-Flash $0.15/$0.60(비피크) | V3.2 기준 164K | [확인] |
| Alibaba | Qwen 3.8 Max / Flash-Next / Omni-Flash (거래 대회 우승은 Qwen3 Max) | 9-18 | Flash-Next $0.15/$0.47 | 미확인 | [확인] |
| Moonshot | Kimi K3 (1M 컨텍스트, 네이티브 멀티모달) | 2026-07-16 | 출력 $15 (가장 비쌈) | 1M | [확인] |
| Zhipu | GLM-5.3 / 5.3 Flash | 9월 | Flash $0.15/$0.50 | 미확인 | [확인] |
| Meta | Muse Spark 1.3 (Meta 첫 유료 API, 1.1은 7-09) | 2026-09-02 | $1.25/$4.25 | 1M | [확인] newspaceeconomy, 9월 트래커 |
| Mistral | Mistral Large 3(675B MoE), Mistral Medium 3.5(128B dense) | Large 3 2025-12, Medium 3.5 2026-04 | Large 3 $2/$6, Medium 3.5 $1.50/$7.50 | Medium 3.5 256K | [확인] vals.ai, docs.mistral.ai |
| Perplexity | Sonar Pro(검색 결합, 유지보수 모드), Agent API 권장 | | | | [확인] 검색 근거 공급용, 판단기 아님 |

## 2. 실거래 판단 능력: 무엇이 실제로 검증됐나
### 실제 돈으로 돌린 공개 대회 (nof1 Alpha Arena)
- 시즌 1 (2025년 10~11월, Hyperliquid 무기한, 모델당 $10,000): 참가 Claude 4.5 Sonnet, DeepSeek V3.1, Gemini 2.5 Pro, GPT-5, Grok 4, Qwen3 Max. **Qwen3 Max 1위**, 6개 중 4개 손실, GPT-5가 −63%로 최하위 [확인].
- 시즌 1.5 (2025-11-19 ~ 12-03, 미국 주식): "Mystery Model" = **Grok 4.20(실험 변형)** 이 +12.11%(4개 테마 합산)로 유일한 흑자, 상위 6개 중 4개가 Grok 변형 [확인: Yahoo Finance, gncrypto]. 다른 보도의 최종 계정가치: Grok 4.20 $10,927, GPT-5.1 $9,053, Gemini 3 Pro $6,718 [추정: X 게시물 인용].
- 2026년 새 시즌 공개 결과 없음(8월 기준) [확인].
- 해석: 2주짜리 대회는 표본이 작아 "어느 모델이 돈을 잘 번다"의 근거로는 약하다. 학술 벤치마크(Agent Market Arena, KTD-Fin, CLQT, StockBench)의 공통 결론은 "LLM 에이전트의 수익은 대부분 시장 노출로 설명되고 지속적 알파는 약하다" [확인: arXiv 2605.28359 등].

### 그래서 모델 선택 기준은 "수익"이 아니라 "도구 호출·구조화·비용·실시간성"
| 모델 | 판단 에이전트로서 강점 | 약점 | 판정 |
|---|---|---|---|
| GPT-6 Astra | 에이전트 도구 사용 상위(105개 중 5위, 70.6점), Terminal-Bench Science 64.6% [확인] | 가격 미확인(최상위급), Alpha Arena 계열 성적은 GPT-5/5.1이 부진 [확인] | 메인 판단기 후보 |
| Claude Opus 5.5 / Fable 5.1 | 도구 사용 HLE 65.0%로 Astra(57.2%) 앞섬, 코딩 에이전트 DeepSWE 73.7% [확인] | 비용 상위 | 메인 판단기 후보(근거 설명 문장 품질이 TETH 피드에 유리) [추정] |
| Gemini 3.8 Flash | Terminal-bench 2.1에서 Opus 5 앞섬, 값싸고 빠름, 2.5M 컨텍스트(3.1 Pro) [확인] | Alpha Arena S1(2.5 Pro)·S1.5(3 Pro) 성적 부진 [확인] | 대량 스크리닝·긴 로그 요약용 |
| Grok 4.7 | X 실시간 데이터·뉴스 접근이 유일한 차별점, S1.5 우승(4.20 변형), $2/$6, 500K [확인] | 우승 변형은 공개 API와 동일하지 않음 [추정], 재현성 미확인 | 뉴스·심리 판단 보조기 |
| DeepSeek V4 / V4.1-Flash | 가장 싼 축($0.15/$0.60), SWE-bench Verified 80.6%(오픈 웨이트 1위), 214 tok/s [확인] | 실시간 접근 없음, 서비스 안정성은 자체 호스팅 시 책임 | 15분 주기 반복 판단의 기본 엔진 후보(비용) |
| Qwen 3.8 (Max) | Alpha Arena S1 우승 계보(Qwen3 Max), 저가 Flash 계열 [확인] | 한국어 설명 품질 미검 | 보조·앙상블 |
| Kimi K3 | 1M 컨텍스트, GPQA 93.5% 최상 [확인] | 출력 $15로 반복 호출에 부적합 [확인] | 장문 리서치 전용 |
| GLM-5.3 Flash | $0.15/$0.50, 지능 지수 42로 V4.1-Flash(40) 근소 우위 [확인] | 생태계·문서 | 저가 대안 |

## 3. 파인스크립트(Pine v6) 작성 능력
- 일반 LLM 실측(TradersPost, 2026): ChatGPT는 컴파일되지만 input 문법·스코프 오류로 2회 수정, Claude는 더 깔끔하지만 v5/v6 input 혼용과 숏 손절 누락으로 1회 수정, Gemini는 v5 문법과 알림 미연결로 대폭 재작성 [확인].
- 전문 도구(Pineify, LuxAlgo Quant 약 85% 성공, TradePilot v6 전용 99% 첫 컴파일 목표)가 일반 챗봇보다 컴파일률·v6 적중·에디터 통합·오류 수정 전부 우위 [확인: 판매자 주장 포함, 할인해서 볼 것].
- 결론: 파인스크립트는 "가장 코딩 잘하는 범용 모델(Claude Opus 5.5, GPT-6 Astra, DeepSeek V4)" + "컴파일 오류를 다시 먹여주는 자동 루프"가 현실적. 모델 하나로 첫 시도 성공을 기대하면 안 됨.
- TETH에 적용: 전략 문장 → Pine 코드 생성 → TradingView 컴파일 결과를 다시 모델에 넣어 수정하는 2~3회 루프를 제품 안에 넣어야 함 [추정].

## 4. TETH 조합 제안 (검증 전 초안)
1. 판단(메인): Claude Opus 5.5 또는 GPT-6 Astra. 이유 문장 품질과 도구 호출 정확도.
2. 판단(반복 스캔, 비용): DeepSeek V4.1-Flash 또는 Gemini 3.8 Flash. 15분마다 전 종목 스캔은 여기서, 확신 구간만 메인으로 승격.
3. 뉴스·심리: Grok 4.7. X 실시간 데이터. 단독 판단기로 쓰지 말고 근거 한 줄 공급자로.
4. Pine 작성: Claude Opus 5.5(1순위), GPT-6 Astra(2순위) + 컴파일 재시도 루프. 대량 생성 시 DeepSeek V4.
5. 멀티모델 앙상블은 "다수결"보다 "역할 분담"이 낫다(대회 결과가 모델별로 요동침).

## 5. 출처
- nof1 Alpha Arena 정리: iweaver.ai, protos.com, euclideanai.com, Yahoo Finance(Grok 4.20), gncrypto.news, weex.com
- 9월 모델 트래커: llm-stats.com/llm-updates, digitalapplied.com 9월 트래커, local-ai-zone 9월 업데이트, teamday.ai
- 벤치마크: datacamp GPT-6 Astra, vellum.ai, emergent.sh, morphllm 오픈소스 비교, marktechpost Kimi K3 비교, tech-insider GLM/Qwen/Kimi
- Pine: blog.traderspost.io(Using AI to Write Pine Script), tradepilot.co.in, pineify.app
- 학술: arXiv 2605.28359(KTD-Fin), 2606.29771(CLQT), ACM Web Conf 2026(Agent Market Arena), OpenReview StockBench
