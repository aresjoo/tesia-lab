# ROUND 0 (Claude Code, FableD 5.1): 독립 감사 + 독립 리서치

기준 화면: `baseline-main.png`, `baseline-main-full.png`, `baseline-detail.png`, `baseline-detail-full.png`. Codex 결과를 보기 전에 작성.

## 1. 포렌식 감사 요약
| 항목 | 현재 상태 | 위치 |
|---|---|---|
| 목록 라우트 | `tfShareHub('find')`, 해시 `#/share` | `tfSS3GridHtml`, `mkCard` |
| 상세 라우트 | `#/share/s/<이름>/<기간>/<탭>` | `tfSS3DetailRender`, `mkOvTab`, `mkPerfTab`, `mkTradesTab`, `mkLogTab`, `mkInfoTab` |
| 데이터 | `MK_CAT` 20종(전부 규칙형), 자산별 가격 `mkPx`, 엔진 `runBacktestCore` | 20종 x 10페이지 반복 |
| 전략 유형 | 코드에 `kind` 필터(rule, agent)와 `tfKindBadge` 가 있으나 목록 데이터는 전부 rule. "유형 전체" 필터에서 agent 를 고르면 빈 화면 | `mkKindPick` |
| 아바타 | 사람형 SVG 20종 | `assets/avatars/t01~t20.svg` |
| 색 | 라임 CTA, 수익 초록(#2fb98a 계열), 같은 카드 안에서 경쟁 | `.mk-pri`, `.mk-up` |
| 상태 | "지금 뭘 하나"는 상세 개요 하단에만, RSI 원문 표기 | `mkStatusHtml` |
| 판단 기록 | 활동 탭에 있음. 규칙 검사 카드(RSI 수치, 체크 표시) | `mkLogTab` |
| 날짜 | 데이터가 2026.08.28 에서 끝남. 오늘과 한 달 차이 | `idxToDate` |

## 2. 리서치 (참고 13개)
| # | 출처 | 교훈 |
|---|---|---|
| 1 | Smashing Magazine, Designing for Agentic AI (2026.02) https://www.smashingmagazine.com/2026/02/designing-agentic-ai-practical-ux-patterns/ | 의도 미리보기, 근거 한 줄, 행동 기록. 근거는 기술 로그가 아니라 사용자 말로 된 한 문장 |
| 2 | Microsoft Design, UX design for agents https://microsoft.design/articles/ux-design-for-agents/ | "에이전트 상태는 항상 보여야 한다", 배경 작업은 행동 기록으로 |
| 3 | Microsoft AI Agents for Beginners, Agentic design principles https://microsoft.github.io/ai-agents-for-beginners/03-agentic-design-patterns/ | 과거(한 일), 현재(하는 일), 미래(할 일)를 나눠 보여줌 |
| 4 | Fuselab, UI design for AI agents 2026 https://fuselabcreative.com/ui-design-for-ai-agents/ | 상태 전달과 복구가 에이전트 UX 의 고유 과제 |
| 5 | arXiv 2601.06223 Three-pillar model https://arxiv.org/pdf/2601.06223 | 투명성은 판단 과정 공개, 책임은 행동 이력 |
| 6 | nof1 Alpha Arena 해설 (RockFlow, ReviewNexa, aiwith.me) https://rockflow.ai/blog/what-is-ai-trading-arena | 모델별 보유 포지션, 완료 거래, 판단 요약을 나란히 공개. 화려함보다 실시간 데이터. 다만 모델 공급사 이름이 정체성이라 TETH 와 다름 |
| 7 | CHI 2024, Stranger Danger? 카피트레이딩 투자자 행동 https://dl.acm.org/doi/full/10.1145/3613904.3642715 | 투자자는 헤드라인 수익률에 끌리고 플랫폼 설계가 그걸 부추김. 리더보드는 규제 당국이 보는 "디지털 유인 장치" |
| 8 | CopiDay, Copy trading FOMO https://copiday.com/blog/copy-trading-fomo-discipline | 30일 수익률은 잡음이 지배. 수익률이 가장 큰 요소면 추격 매수 유도 |
| 9 | CFTC 경고 보도 (AI 트레이딩 봇) https://kr.tradingview.com/news/cryptodaily:0189a41e2094b:0-cftc-cautions-investors-about-the-dangers-of-using-ai-trading-bots | "AI 가 높은 수익"은 사기의 전형 문구. 수익 약속형 카피는 위험 신호 |
| 10 | Royal Q 분석 https://dehek.substack.com/p/exposing-royal-q-the-risks-of-their | 거래소 로고를 앞세우는 것은 사기 상품의 흔한 수법. 거래소가 보증인처럼 보이면 안 됨 |
| 11 | Medium, 봇 테스트 후기와 Reddit 요약 https://medium.com/@fabulous_snow_manatee_698/i-lost-14-000-testing-crypto-bots-here-is-what-actually-works-28413353892a | "AI 라더니 IF/THEN 이더라"가 가장 흔한 불신. 규칙형을 AI 로 포장하면 역효과 |
| 12 | Emerald APJML, 로보어드바이저 의인화 연구 https://www.emerald.com/insight/content/doi/10.1108/apjml-09-2023-0939/full/html | 의인화 효과는 조건부. 중간 수준이 낫고, 항상 이득은 아님 |
| 13 | Fast Company, AI 생성 얼굴 https://www.fastcompany.com/90723105/ai-generated-faces-have-crossed-the-uncanny-valley-and-are-now-more-trustworthy-than-real-ones 와 BrandShield 가짜 프로필 https://www.brandshield.com/blog/fake-profiles-ai-powered-scams/ | 금융 맥락의 가상 인물 얼굴은 가짜 프로필 사기와 같은 문법 |
| 14 | prg.sh, AI 가 만든 UI 의 공통점 https://prg.sh/ramblings/Why-Your-AI-Keeps-Building-the-Same-Purple-Gradient-Website | 색 기운 배경, 균일한 3~4열 카드, 의미 없는 그라데이션이 "자동 생성 티" |

Reddit 원문은 검색 도구로 직접 열리지 않아 Reddit 논의를 요약한 2차 출처(8, 11)로 확인했다. 이 한계는 Codex 리서치와 교차 확인한다.

## 3. 가설 판정
| 가설 | 판정 | 근거와 설계 결정 |
|---|---|---|
| H1 사람형 아바타가 신뢰를 깎는다 | PARTIAL | 의인화는 조건부로 신뢰를 올리지만(12), 금융에서 가상 인물 얼굴 20개는 가짜 트레이더 프로필 문법(13). 현재 카드 상세의 "TETH AI 트레이더" 표기와 사람 얼굴이 충돌. 두 변형을 렌더해 결정 |
| H2 밈형 이름이 신뢰를 파괴 | SUPPORTED | "김대리", "야수의 심장"은 운영자가 사람인지 AI 인지 흐림. 돈을 맡기는 대상의 이름으로 가벼움 |
| H3 퀀트식 이름은 어렵고 매력 없음 | SUPPORTED | 초보 대상. 다만 자산과 행동을 담는 장점은 가져감 |
| H4 정체성은 보고, 판단하고, 하는 일에서 나옴 | SUPPORTED | 1, 2, 3, 6 공통. 현재 카드에는 상태가 전혀 없음 |
| H5 토큰 수, 모델명은 신뢰 연출 | SUPPORTED | 품질 지표가 아님. 현재 정보 탭의 "Claude, Gemini" 행은 제거 후보 |
| H6 성과 숫자가 가장 크면 수익률 마케팅처럼 보임 | SUPPORTED | 7, 8, 9. 현재 카드에서 +17.8% 가 26px 초록으로 제목(15px)보다 큼 |
| H7 세 유형이 같은 문법이면 차이를 모름 | SUPPORTED | 현재는 유형 자체가 없음. 카드 구조 한 줄이 유형마다 달라야 함 |

## 4. 구체 비판 (요소 → 문제 → 사용자 해석 → 제안)
1. 카드 아바타(사람 얼굴 44px) → 상세에는 "TETH AI 트레이더"라고 적혀 있음 → "사람이 운영하나, AI 인가, 캐릭터 놀이인가" → 비인간 식별 기호 또는 절제된 표현으로 교체, 두 안 렌더 비교.
2. 이름 "김대리의 나스닥", "애플 농부" → 직업 캐릭터 → "게임 캐릭터를 고르는 화면" → 행동과 대상을 담은 이름 체계 3안 비교.
3. 30일 수익률(26px, 초록) → 카드에서 가장 크고 진함 → "수익률 자랑 목록" → 크기와 채도를 낮추고 판단 방식 줄을 위로.
4. 한줄소개 "목표는 20%", "한 번에 18%를 봅니다" → 수익 목표가 카피의 주어 → "20% 벌어준다는 말" → 행동 서술로 교체, 수치는 상세 규칙으로.
5. 라임 "따라가기" 20개 + 초록 수익률 20개 + 초록 차트 20개 → 한 화면에 강조색 60개 → 시선이 머물 곳이 없음, 카지노 인상 → 카드의 따라가기는 외곽선, 라임은 상세의 주 버튼에만. 수익 색은 채도 낮춤.
6. 거래소 로고가 제목 바로 아래 → 전략 제작자나 보증인처럼 보임(10) → 카드 하단 메타 줄로 내리고 "실행" 맥락을 붙임.
7. 카드에 현재 상태 없음 → 20장이 전부 정적 프로필 → "돌아가는 시스템"으로 안 보임 → 유형별 상태 한 줄(지금 보는 것, 기다리는 조건).
8. 필터 "유형 전체" → 선택지가 규칙과 에이전트인데 데이터는 규칙뿐 → 필터가 장식 → "판단 방식" 세그먼트(전체, 직접 탐색, 조건 실행, 혼합)로 교체하고 데이터를 채움.
9. 상세 첫 화면: 거래소 로고, 이름, 따라가기, 필수사항, AI 요약, 큰 누적 수익률 → 큰 카드의 반복 → 정체성과 현재 상태, 최근 판단이 첫 화면에 와야 함.
10. 상세 "지금 뭘 하나": "RSI(14) 전봉 < 26, 전봉 84 ✗" → 지표 원문 → 초보자는 뜻을 모름 → "가격이 충분히 밀리지 않아 기다리는 중" 같은 문장과 조건까지의 거리.
11. 상세 누적 수익률 +66.2%(40px 초록) → 화면에서 가장 큰 요소 → 성과 판매 → 성과 구역을 아래로, 크기 축소.
12. 활동 탭 → 판단 기록이 탭 안에 숨어 있음 → 신뢰의 핵심 증거를 못 봄 → 개요에 최근 판단 5건을 "본 것, 판단, 행동"으로.
13. 데이터 마지막 날 2026.08.28 → 오늘은 09.29 → "한 달 전에 멈춘 시스템" → 날짜 기준을 오늘 기준으로 맞추는 방안 검토.
14. 정보 탭 "이번 판단에 사용 Claude, Gemini" → 모델 공급사 → 신뢰 연출(H5) → 제거.
15. 배경 색 기운 아바타 20색 → 무지개 → 자동 생성 티(14) → 단색 체계.

## 5. 재설계 제안 (Round 1 후보)
### 5.1 제품 모델
세 가지 판단 방식. 화면 용어는 쉬운 말.
| 내부 | 화면 용어 | 하는 일 | 데이터 |
|---|---|---|---|
| Agentic | 직접 탐색 | 여러 종목을 매일 비교해 거래 대상과 비중을 스스로 정함. 시장이 약하면 쉼 | 새 계산기: 종목 묶음의 가격으로 매일 순위, 선택, 비중, 진입과 청산을 결정하고 그 과정을 판단 기록으로 남김 |
| Rule | 조건 실행 | 정해진 자산에서 정해진 조건이 오면 실행 | 기존 엔진 |
| Hybrid | 혼합 | AI 가 종목을 고르고, 진입과 청산은 규칙이 실행 | 새 계산기(선택) + 기존 규칙(실행) |

판단 기록과 성과는 같은 계산에서 나온다. 기록을 글로 지어내지 않는다.

### 5.2 카드 문법 (배지 없이 구조로 구분)
제목 아래 "판단 줄" 하나가 유형마다 다른 구조를 가진다.
- 직접 탐색: 보는 범위와 지금 고른 것. 예 "가상자산 8종을 비교, 지금은 SOL"
- 조건 실행: 자산과 기다리는 조건. 예 "BTC, 반등 조건 대기"
- 혼합: 역할 분담. 예 "AI 가 고른 NVDA, 규칙으로 진입 대기"

### 5.3 이름 체계 3안 (Round 1 에서 8장씩 렌더)
A 행동 우선 / B 제품화된 에이전트 이름 / C 고유 이름 + 쉬운 설명. 승자는 스크린샷으로.

### 5.4 식별 표현 2안
A 절제된 사람형 / B 전략의 실제 값으로 그리는 기호(탐색형은 종목 격자에서 고른 점, 조건형은 기준선과 방아쇠 위치, 혼합은 둘의 결합). B 는 장식이 아니라 데이터 도식.

### 5.5 상세 구조
정체성(이름, 판단 방식, 보는 시장, 실행 거래소, 현재 상태) → 하는 일 → 지금(유형별로 다름) → 최근 판단 → 행동 방식 → 성과. 유형별 중심: 탐색형은 보는 종목과 현재 선택, 조건형은 조건과 조건까지의 거리, 혼합은 단계.
