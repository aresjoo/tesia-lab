# Robinhood Agentic Trading / nof1 Alpha Arena 리서치 노트 (2026-09 기준)

목적: TETH의 "AI 직접 판단 매매" 및 "AI 트레이더 팔로우" 모드 UX 설계 참고. 실제 읽은 페이지만 인용. 컴플라이언스 관점 배제.

## A. Robinhood 소견

출처: https://robinhood.com/us/en/agentic-trading/ (브라우저 실측), https://robinhood.com/us/en/support/articles/agentic-trading-overview/, https://robinhood.com/us/en/support/articles/trading-with-your-agent/, https://robinhood.com/us/en/newsroom/robinhood-is-now-open-to-agents/, https://techcrunch.com/2026/05/27/robinhood-now-lets-your-ai-agents-trade-stocks/, https://www.finder.com/stock-trading/robinhood-agentic-accounts, https://genfinity.io/2026/07/30/robinhood-ai-trading-agent-technical-indicators-launch/, https://nexustrade.io/blog/robinhood-agentic-trading-mcp-review-20260708, https://vorplabs.com/agent-tools/robinhood-cli, https://secprove.com/trading-agent-safety/connect-claude, https://algoalpha.co/blog/robinhood-cortex-review

**제품 구조 (2026-05-27 출시, 9월 현재 주식/옵션/크립토)**
- Robinhood는 자체 에이전트를 만들지 않는다. "Bring your agent": 사용자가 Claude, ChatGPT, Codex, Cursor, Grok 등 외부 에이전트를 MCP URL 하나(`https://agent.robinhood.com/mcp/trading`)로 연결. 44개 MCP 툴(계좌 조회, 호가, 주문, 워치리스트, 스캐너, 기술지표 18종).
- Cortex는 별개 제품: Gold 구독($5/월) 안의 분석 어시스턴트(Digests, Trade Builder, 대화형 주문). 자율 매매는 안 함. 카피: "Research the market, dive into the technicals and make trades...All in conversation."

**활성화 플로우 (랜딩 페이지 실측 문자열)**
- 히어로: "Let your agent trade" / "Market access for AI agents. Now available for equities, options, and crypto through Robinhood's MCP server." / CTA "Get started"
- "Set up in minutes" 3단계:
  - "01 Connect via MCP: Paste one URL into your MCP config to connect most agents out of the box."
  - "02 Create an agentic account: Fund your account with an amount reserved for your agent's trades."
  - "03 Run your strategy: Your agent can analyze markets and place trades, with activity and performance visible in the app."
- 인증과 계좌 개설이 동시에 일어남(데스크톱 전용, OAuth). 에이전트 연결 시 Robinhood가 "open and fund your Agentic account"를 요구.

**계좌 vs 에이전트 분리**
- "Robinhood Agentic Account"는 별도 self-directed 계좌(최대 10개 중 하나). 에이전트는 전 계좌를 읽기 전용으로 보되, "Your agent can only place trades in your Robinhood Agentic account." 주 계좌 잔고는 절대 못 건드림.
- 예산 = 이체한 금액. "dedicated budget"이 리스크 상한을 대체하는 개념. 계좌당 에이전트 1개(전략 분리 불가는 리뷰어 불만).

**에이전트 활동/판단 표현**
- 앱 내: 실시간 Activity 피드(모든 주문이 Agentic 계좌 "Activity"와 히스토리에 표시), 거래마다 푸시 알림, P&L 트래커, 원탭 연결 해제. 주문 프리뷰(선택적 사전 승인) 제공.
- 추론 자체는 앱이 아니라 에이전트 쪽(채팅 창)에 남는다. 즉 Robinhood는 "무슨 거래가 났나"만 보여주고 "왜"는 표시 안 함.

**시각 위계 / 프리미엄 언어**
- 블랙 배경 + 세리프 대형 헤드라인 + 라임 CTA, 3D 오브제. 숫자 넘버링 "01/02/03"으로 단순함 강조.
- 신뢰 문구: "Designed for safety" / "Set your agent up for trading in an account with a dedicated budget, with notifications on each trade, and the option to disconnect anytime from directly in the app." 신뢰 요소를 항상 3종 세트(예산 격리, 알림, 즉시 해제)로 반복.
- CEO 포지셔닝: "give the everyday person access to the same tools, the same computation, the same power that institutional investors ... have been enjoying" (thestreet/cnbc 검색 스니펫).
- 복잡성 축소: "Paste one URL", "connect most agents out of the box". 프롬프트 예시는 자연어("screen for stocks growing 20%+", "rebalance by sector exposure").

**한계(리뷰어 지적)**: 페이퍼 트레이딩 없음, 손실 상한/킬스위치 없음(계좌 격리만), 응답 포맷 미문서화, 에이전트가 켜져 있어야 동작(Claude Code 상주 필요).

## B. nof1 Alpha Arena 소견

출처: https://nof1.ai/ (LIVE 페이지 실측), https://nof1.ai/leaderboard, https://nof1.ai/models/17, https://nof1.ai/blog (Exploring the Limits of LLMs as Quant Traders, 2025-10-27), https://gist.github.com/wquguru/7d268099b8c04b7e5b6ad6fae922ae83 (커뮤니티 역설계 프롬프트), https://www.onedayadvisor.com/2025/12/nof1ai-alpha-arena-review-season-15.html, https://www.traderank.ai/blog/alpha-arena-alternatives-2026

**현황**: 시즌 1(2025-10 크립토 perp, Hyperliquid, 모델당 $10k) → 시즌 1.5(2025-11~12-03, 미국 주식 perp, 4개 대회 x 8모델). 2026-09 현재 사이트 배너: "Update: The official competition has ended as of December 3rd, 2025 ... Models are no longer running." 2026-05 $15M 투자 후 "coding agents for markets" 소비자 제품 준비 중, 네비에 "JOIN THE PLATFORM WAITLIST".

**루프 개념 (블로그 원문)**: "At each inference call (~2-3 mins), the agents receive (a) a concise instruction set (system prompt) and (b) live market + account state (user prompt), and return actions that are fed into a Hyperliquid trade execution pipeline." 출력 필드: coin, direction, quantity, leverage + "a short justification, confidence score in [0, 1], and an exit plan with pre-defined profit targets, stop losses, and invalidation conditions". 툴 사용/멀티에이전트/대화 히스토리 없음(무상태 루프). 액션 공간 4개: buy_to_enter / sell_to_enter / hold / close. hold도 매 사이클 로그됨(Claude가 BTC 포지션을 "443 consecutive evaluations" 동안 홀드한 사례).

**LIVE 페이지 레이아웃**
- 상단: 종목 티커 바(TSLA $376.77 ...), 대회 탭 "Aggregate Index | 1: New Baseline | 2: Monk Mode | 3: Situational Awareness | 4: Max Leverage", 자산가치 라인차트.
- 좌: 회사 스토리 + "Join the Waitlist". 우: "MODELCHAT | SEASON 1.5 DETAILS" 탭, "FILTER: ALL MODELS ▼".
- MODELCHAT 카드 1장 = 모델명(색 아이콘) | 대회명 | 타임스탬프(12/06 21:51:07) + 1인칭 2문장 요약 + "click to expand".
- 펼치면 3단 접기: "▶ USER_PROMPT" (규제 스냅샷, Raw Data Dashboard, Narrative vs Reality Check, FOMO Map, Alpha Setups 가설 A/B/C, Edge Quality Matrix, CURRENT AVAILABLE CAPITAL, CURRENT NAV, CURRENT LIVE POSITIONS 딕셔너리) → "▶ CHAIN_OF_THOUGHT" (수백 단어의 1인칭 사고, "Reviewing Current Positions / New Trade Opportunities / Final Plan / Important Details" 식 소제목) → "▶ TRADING_DECISIONS" (종목별 키-값: INVALIDATION CONDITION, RISK USD, CONFIDENCE, IS ADD, JUSTIFICATION, PROFIT TARGET, COIN, LEVERAGE, SIGNAL, QUANTITY, STOP LOSS).
- 요약문 예: "I'm betting on a breakout in NVDA, seeing a strong setup as it holds support ... with a target of 189.2 and a stop just below 180. I'm also holding my existing NDX and MSFT positions, though I'm uneasy about MSFT's zero stop loss."
- SIGNAL이 "hold"인 카드도 동일 구조로 매 2~3분 쌓임. 피드의 80% 이상이 hold.

**LEADERBOARD 페이지**: "COMPETITION: Aggregate Index ▼", 탭 "OVERALL STATS | ADVANCED ANALYTICS".
- OVERALL: RANK, MODEL, ACCT VALUE, RETURN %, TOTAL P&L, FEES, WIN RATE, BIGGEST WIN, BIGGEST LOSS, SHARPE, TRADES.
- ADVANCED: AVG/MEDIAN TRADE SIZE, AVG/MEDIAN HOLD, % LONG, EXPECTANCY, MEDIAN/AVG LEVERAGE, AVG/MEDIAN CONFIDENCE.
- 하단 주석: "All statistics (except Account Value and P&L) reflect completed trades only."

**모델 페이지(/models/17)**: 헤더 "Total Account Value / Available Cash / [LINK TO WALLET]" → "Total P&L / Total Fees / Net Realized" 3칸 → "Average Leverage, Average Confidence, Biggest Win, Biggest Loss" + "HOLD TIMES Long 46.3% / Short 7.7% / Flat 46.0%" → "ACTIVE POSITIONS"(카드: LONG MSFT, EXIT PLAN, ENTRY TIME, ENTRY PRICE, QUANTITY, LEVERAGE 10X, LIQUIDATION, MARGIN, UNREALIZED P&L) → "LAST 25 TRADES" 테이블(SIDE, COIN, ENTRY/EXIT PRICE, QUANTITY, HOLDING TIME, NOTIONAL ENTRY/EXIT, TOTAL FEES, NET P&L).

**공개 설계 문서**: 블로그가 하네스 설계 공개(시스템 프롬프트는 비공개, 유저 프롬프트는 UI에서 전문 공개). 핵심 발견: 데이터 순서를 "OLDEST → NEWEST"로 바꿔야 오독 방지, "free collateral"/"available cash" 용어 혼용 시 행동 불안정, 초기엔 수수료가 PnL을 잠식해 "fewer but larger, higher-conviction positions" 및 confidence 연동 사이징으로 교정. 대회 설명 문자열: "2: Monk Mode - New experimental system prompt & harness, ~50% shorter than baseline, more opinionated guardrails".

## C. TETH에 이식할 원칙 10

1. **예산 격리가 곧 안전장치** | RH "Fund your account with an amount reserved for your agent's trades" | TETH: OKX 서브계정/전용 지갑에 "AI 예산"을 이체하는 단계를 온보딩의 핵심 화면으로. 리스크 설정 대신 "얼마를 맡길까"로 질문.
2. **3단계 넘버링 온보딩** | RH "01 Connect / 02 Create / 03 Run" | TETH: "01 거래소 연결 / 02 AI 예산 넣기 / 03 전략 켜기"로 동일 리듬.
3. **신뢰 3종 세트를 모든 화면에 반복** | RH "dedicated budget, notifications on each trade, disconnect anytime" | TETH: 예산 상한, 체결 알림, 즉시 정지 토글을 헤더 고정 배지로.
4. **hold도 판단이다** | nof1 피드는 SIGNAL: hold 카드가 대부분 | TETH 활동 로그에 "관망" 카드를 매 평가마다 남겨 "AI가 살아있고 보고 있다"를 증명. 일↔말 교대 리듬과 맞물림.
5. **요약 2문장 → 펼치면 3층** | nof1 "click to expand" → USER_PROMPT / CHAIN_OF_THOUGHT / TRADING_DECISIONS | TETH: 1인칭 요약(모바일 기본) → 근거 데이터 → 구조화 결정(키-값). 사고 전문은 접어둔다.
6. **결정은 키-값 스키마로 고정** | nof1 SIGNAL, CONFIDENCE, STOP LOSS, PROFIT TARGET, INVALIDATION CONDITION, JUSTIFICATION | TETH: 모든 AI 주문 카드에 같은 11개 필드. 특히 invalidation condition(무효화 조건)을 노출하면 "왜 아직 안 파는지"가 설명됨.
7. **1인칭 화법** | nof1 "I'm holding my TSLA ... because they are currently profitable" | TETH: AI 트레이더를 "나는"으로 말하게 해 팔로우 대상(nof1류 페르소나)으로 만든다.
8. **성과 지표는 2층(기본/고급)** | nof1 OVERALL STATS vs ADVANCED ANALYTICS | TETH 리더보드: 기본은 자산/수익률/P&L/수수료/승률, 고급은 평균 보유시간, 롱 비율, 기대값, 평균 레버리지, 평균 confidence. "완료 거래 기준" 각주 필수.
9. **수수료를 1급 지표로** | nof1 FEES, TOTAL FEES 열 + "Net Realized" | TETH: net 표시 원칙과 일치. AI 과매매를 사용자가 즉시 알아채게.
10. **에이전트는 외부, 실행은 우리** | RH는 모델을 안 만들고 MCP로 연결, 앱은 활동/PNL/해제만 담당 | TETH: "AI 트레이더 팔로우" 모드에서 외부 에이전트/모델을 플러그인처럼 받아들이고, 우리 화면은 예산/활동/정지에 집중.

## D. 피할 안티패턴 5

1. **"왜"가 앱 밖에 있음**: RH는 거래 알림만 주고 추론은 채팅 툴에 남는다. TETH는 판단 근거를 활동 피드 안에 두어야 함.
2. **hold 카드 무한 스크롤**: nof1 LIVE는 2~3분마다 hold 카드가 쌓여 신호가 묻힘. 연속 hold는 "관망 중 (12회, 36분)"으로 접어 요약.
3. **로우 프롬프트 노출을 기본값으로**: nof1 USER_PROMPT 펼침은 수천 자. 연구용엔 좋지만 소비자 기본 뷰엔 금지. 3층 중 최상층만 기본.
4. **confidence 무의미화**: nof1 발견처럼 자기보고 confidence는 모델별 편향이 크고 성과와 무관("decoupled from actual trading performance"). 숫자 그대로 노출 말고 포지션 사이징/색 강도로만 번역.
5. **계좌 격리를 리스크 관리 전부로 취급**: RH는 손실 상한, 킬스위치, 페이퍼 모드가 없어 리뷰어 비판. TETH는 예산 격리 + 일일 손실 한도 + 모의 모드를 온보딩에서 같이 제시.
