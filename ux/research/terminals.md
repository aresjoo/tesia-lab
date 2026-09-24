# 트레이딩 터미널 UX 리서치: Hyperliquid / TradingView / eToro (2026-09)

TETH(AI 트레이딩 터미널) 설계용 벤치마크 노트. 웹서치와 WebFetch로 실제 읽은 페이지만 인용. 일부 공식 페이지(app.hyperliquid.xyz 본체, eToro 헬프센터)는 JS 렌더링으로 본문을 못 읽어 검색 스니펫과 2차 문서로 보완했다.

## A. Hyperliquid (app.hyperliquid.xyz)

**전체 레이아웃 (데스크톱)**
- 상단 네비: Trade, Vaults, Portfolio, Leaderboard 등 + 지갑 연결/계정 잔고. 리더보드는 상단 네비에서 진입 (hyperliquidguide.com/guides/trading/pnl-sharing-leaderboard).
- 마켓 컨텍스트 바(차트 위, 마켓마다 동일 포맷): `BTC-USDC 40x` 페어명+최대 레버리지 옆에 **Mark / Oracle / 24h Change(절대값+%) / 24h Volume / Open Interest / Funding · Countdown(현재 펀딩률 + 다음 정산까지 남은 시간)**. 예: Mark 83,806, Oracle 83,850, 24h -3,255 / -3.74%, Funding -0.0001% 00:39:06 (app.hyperliquid.xyz/trade/BTC 검색 스니펫).
- 중앙: TradingView 차트. 우측: 오더북/체결 내역. 최우측: 주문 패널("인터페이스의 사령탑", 모바일에선 하단) (supa.is/article/hyperliquid-app-interface-guide-panels-explained-2026).
- 주문 패널 요소: 페어 선택, 주문 유형(Limit/Market/Stop 등), 레버리지 슬라이더, 수량(기초/견적 통화), 가격, 그리고 **주문 프리뷰 박스: 진입가, 최대 슬리피지, 필요 마진, 청산가**. 주문 전에 "이 주문이 내 청산가를 어디로 옮기는지"를 미리 보여준다 (supa.is).
- 하단 탭(포트폴리오/트레이드 공통): **Balances, Positions, Open Orders, TWAP, Chase, Trade History, Funding History, Order History** (+ 예측시장용 Outcomes) (app.hyperliquid.xyz/portfolio 검색 스니펫). Chase(최우선 호가 추적), Trailing Stop, 비공개 TWAP 등 고급 주문이 탭 단위로 노출됨 (bankless.com/read/getting-started-with-hyperdashs-revamped-trading-terminal).

**PnL / 마진 / 청산 노출 방식**
- 포지션 패널 상단 요약: **Total Position Value(명목), Unrealized PnL, Margin Ratio**. 각 포지션 행: 진입가, 마크가, 마크가 기준 PnL, 펀딩률(양수면 롱이 숏에 지급) (supa.is).
- 마진/리스크 패널: 가용 마진, 사용 마진, 청산가, 유지증거금 임계치. 자금 패널: 총 잔고, 가용 잔고, 출금 대기, 볼트 배분 (supa.is).
- PnL 공유 카드: 진입가, 마크가(현재/청산가), ROI %, 레버리지, 세션/누적 기간 선택, 지갑 주소·사이즈 익명화 옵션, 온체인 검증용 워터마크 (hyperliquidguide.com 리더보드 가이드).
- 리더보드: Account, PnL(실현+미실현), ROI, Volume, Account Value 컬럼, 1D/7D/30D/All 기간 필터와 최소 계정 규모 필터. "핫 스트릭"과 지속 성과를 구분하도록 기간 비교를 유도.

**모바일**
- 데스크톱의 반응형 버전. 차트와 주문폼이 나란히가 아닌 **세로 스택**: 상단 탭(Trade/Portfolio) + 지갑 상태·잔고, 페어명 탭하면 마켓 목록·검색, 차트(핀치줌, 전체화면), 그 아래 주문 패널, 그 아래 스크롤되는 포지션/주문/히스토리. **오더북은 기본 접힘**, 멀티차트·단축키 없음 (hyperliquidguide.com/guides/getting-started/hyperliquid-mobile-guide).
- 안드로이드 공식 앱(2026-04 출시)은 웹을 네이티브 래핑 + 체결 푸시 알림, 이메일(Privy)/WalletConnect/데스크톱 지갑 연동 3가지 로그인 (hyperliquidguide.com/guides/getting-started/hyperliquid-android-app). 서드파티 가이드는 하단 네비 Home/Markets/Trade/Portfolio/Settings, 스와이프 포지션 관리를 언급 (supa.is).

**볼트 (카피 트레이딩 대체재)**
- 볼트 = 공개 전략 지갑. 예치자는 리더 PnL을 지분 비례로 공유, 리더는 10% 성과 수수료, 리더 지분 최소 5% 유지 의무, 유저 볼트 락업 1일 / HLP 4일 (hyperliquid.gitbook.io/hyperliquid-docs/hypercore/vaults/for-vault-depositors-legacy, for-vault-leaders-legacy).
- 목록 페이지 컬럼: **Vault, Leader, APR, TVL, Your Deposit, Age** 정렬 가능 (finestel.com/blog/hyperliquid-vaults-explained). 상세 페이지: 성과 차트(PnL/계정가치 토글, 기간 선택), 통계 블록(TVL, APR, 누적 PnL, 최대 낙폭, 거래량, 예치자 수), **Your Performance** 블록, 볼트의 Positions/Open Orders/Trade History 테이블이 그대로 공개됨 (finestel, gitbook 예치자 문서). 원클릭 카피는 없고 "볼트가 같은 문제를 더 나은 리스크 통제로 해결" 포지셔닝 (eco.com/support/en/articles/15197987).

## B. TradingView

**전략 리포트(Strategy Tester) 구조**
- 차트 하단 패널. 2025~26 개편 후 탭: **Overview(=Metrics), Performance, Trades analysis, Risk/performance ratios, List of trades, Properties** (tradingview.com/support/solutions/43000764138-tradingview-strategy-report-how-to-start, pine-script-docs/concepts/strategies, chartwisehub.com/tradingview-strategy-tester).
- Overview 헤드라인 타일: **Total P&L(통화+%), Max equity drawdown, Total trades, Profitable trades %, Profit factor**, Buy & Hold 비교 (help 43000764138, chartwisehub). 그 아래 **자본 곡선 차트: 좌축 자본, 우축 낙폭, x축은 거래 번호**, Buy & hold 선 토글, 기간 선택기 (tv-hub.org/guide/tradingview-backtesting, help 43000764138). "최종 숫자는 경로를 숨긴다"는 이유로 차트가 타일 바로 아래 고정.
- Performance 하위 탭: Breakdown(신호별 총이익/손실), Periodical(기간별), Benchmarking(vs B&H), Margin usage, Growth and decline(런업/낙폭). Trades analysis: Distribution(수익률 히스토그램), Streaks(연승/연패), Time patterns(시간/요일/월별). Risk ratios: Sharpe, Sortino (help 43000764138, 검색 스니펫).
- List of trades 컬럼: Trade #, Type, Signal, Date/time, Price, Position size, Net P&L, Run-up(MFE), Drawdown(MAE), Cumulative P&L (help 43000587044 폴더, 43000764138).
- Properties: 초기자본, 주문 사이즈, 수수료, 슬리피지, 마진, 피라미딩, 체결 가정(Bar Magnifier 등). 기본값으로 돌리면 "+132%가 +3.28%로" 떨어지는 사례처럼 설정이 결과를 좌우 (tv-hub, chartwisehub).
- Deep Backtesting: 차트 로드 범위 대신 전체 히스토리(최대 200만 봉/100만 거래), 결과는 리포트에만 표시되고 차트 마커는 안 그려짐 (tradingview.com/support/solutions/43000666265).

**Strategy vs Indicator 구분**
- `strategy()` 선언 스크립트만 브로커 에뮬레이터로 주문을 시뮬레이션하고 리포트 탭을 생성. 인디케이터는 정보만 표시. 차트상 전략은 **진입/청산 화살표(롱 녹색, 숏 빨강) + 주문 ID/코멘트 라벨**로 식별 (pine-script-docs/concepts/strategies). 실행 타이밍도 다름: 인디케이터는 매 틱, 전략은 기본 봉 마감 1회 (blog.traderspost.io, crosstrade.io).

**알림/자동화 플로우**
- Strategy Tester 드롭다운 "Add Alert", 전략 메뉴, 또는 Create Alert 대화상자에서 전략 선택. 생성 시 **전략 사본이 서버에 복제**되어 차트 수정과 분리됨(수정하면 알림 삭제 후 재생성). 트리거 = 브로커 에뮬레이터의 **주문 체결 이벤트**(실시간만), 3분 내 15회 초과 시 자동 정지 (tradingview.com/support/solutions/43000481368-strategy-alerts).
- 메시지 플레이스홀더 `{{strategy.order.action}}`, `{{strategy.order.price}}`, `{{strategy.market_position}}`, `{{strategy.order.comment}}` 등을 웹훅 JSON에 넣어 TradersPost 같은 브릿지가 브로커에 전달 (pine-script-docs/faq/alerts, blog.traderspost.io).

**Trading Panel (실거래) 하단 탭**
- 브로커 로그인 후 **Positions, Orders, Account Summary, Notifications log** 4탭(브로커에 따라 History 추가). Positions 컬럼: Side, Qty, Avg fill price, Take profit, Stop loss, P/L. 탭 위에 **회색 한 줄로 계정 요약 핵심값 상시 표시**. 주문은 차트 컨텍스트 메뉴, "+" 버튼, Buy/Sell 버튼 3경로, 포지션/주문은 차트에 라인으로 겹쳐 보이며 드래그 편집 (tradingview.com/support/solutions/43000516374, 43000763362).

## C. eToro CopyTrader

- 설명 방식: "트레이더를 고르고, 금액을 정하고, Copy를 누른다" 3단계. 역할을 copier / copied trader / copy로 명명. 최소 $200/트레이더, 포지션당 최소 $1, 최대 100명 (etoro.com/copytrader/how-it-works).
- 복제 규칙을 비율로 설명: "당신의 포지션은 복사한 트레이더 포트폴리오의 현재 배분과 일치", 트레이더가 자본의 10%를 쓰면 내 카피도 10%. 입출금·시장변동 시 자동 재배분 (how-it-works).
- 디스커버리: Trending, Most Copied(6m/1y/2y), Highest Gainers, Most Consistent, Lower Risk 같은 큐레이션 목록 + 기간/리스크/자산군/국가/카피어 수 필터. 카드 메트릭: 수익률, 리스크 점수(1~10), 카피어 수 (wikitoro.org/trading/etoro-copy-trading, matchmybroker.com/articles/etoro-copy-trading, financeillustrated.com).
- Stats 탭: 월별/연도별 수익, 리스크 점수(주간 산출, 12개월 평균), 최대 낙폭(일/주/전체), 수익 주 비율, 평균 보유기간, 주당 거래수 (matchmybroker, help.etoro.com What-statistics 검색 스니펫).
- 리스크 점수: 포트폴리오 자산 표준편차 기반 가중 변동성을 1(매우 낮음)~10(매우 높음)으로 변환, 다각화가 낮출 수 있음. 커뮤니티 가이드는 4~6을 "복리 가능하면서 낙폭 생존" 구간으로 설명 (help.etoro.com risk-score-explained 스니펫, azcopytrading.com).
- 카피 설정 대화상자: 금액, **Copy Open Trades(기존 포지션 즉시 복사 vs 신규만)**, **Copy Stop Loss 기본 40%, 5~95% 조정**. 카피 총 가치(모든 거래 손익 포함)가 초기 투자의 CSL 비율 아래로 가면 카피 전체 종료 후 잔액 반환. 이후 언제든 조정, pause(신규 거래만 중단)/stop(포지션 종료 또는 수동 인수) (how-it-works, wikitoro, help.etoro.com CSL 스니펫, gncrypto.news 리뷰).
- 초보 배려: 첫 카피 시 리스크 안내 노티, CSL 접근 시 알림(리뷰어는 -8%에서 수신), "언제든 중단 가능, 항상 당신이 통제" 문구 반복.

## D. TETH에 이식할 원칙 8 (AI 에이전트 상태를 차트만큼 보이게)

1. **컨텍스트 바에 에이전트 상태를 마켓 스탯과 나란히.** Hyperliquid의 Mark/Oracle/Funding·Countdown 바처럼, TETH는 `에이전트 상태(관망/진입 대기/포지션 관리) · 다음 판단까지 카운트다운 · 현재 확신도`를 같은 줄에 고정 표시.
2. **주문 프리뷰 = 결정 프리뷰.** Hyperliquid가 주문 전에 청산가·필요 마진을 보여주듯, AI가 행동하기 전 "무엇을, 얼마나, 청산가는 어디로, 왜"를 프리뷰 박스로 노출하고 거부권 버튼을 붙인다.
3. **하단 탭에 "AI 판단 로그"를 1급 탭으로.** Positions/Open Orders/History 옆에 TradingView의 Notifications log처럼 `Decisions` 탭: 시각, 신호, 행동/보류, 근거 요약. 체결 이벤트가 아니라 판단 이벤트 단위.
4. **헤드라인 5타일 고정.** TradingView Overview식 Total P&L(통화+%), Max drawdown, Trades, Win %, Profit factor를 백테스트·라이브·팔로우 모드에 동일 포맷으로. 숫자 하나가 경로를 숨기므로 항상 자본곡선+낙폭 이중축을 곁들인다.
5. **전략 vs 시그널을 시각 언어로 분리.** 전략(실제 주문 발생)만 화살표+라벨을 차트에 찍고, 단순 시그널/관찰은 마커 없이 표시. 사용자가 "이건 돈이 움직이는 것"을 즉시 구분하게.
6. **회색 한 줄 계정 요약 상시 노출.** TradingView Trading Panel처럼 탭이 바뀌어도 자본·가용마진·미실현 PnL·마진비율 한 줄은 고정.
7. **팔로우 모드는 eToro 3단계 + CSL.** "트레이더/에이전트 선택 → 금액 → 시작"에 기본 40% 손절 슬라이더와 "기존 포지션도 복사?" 토글을 넣고, 1~10 리스크 점수와 최대 낙폭을 카드에서 바로 보이게.
8. **볼트식 투명성.** 팔로우 대상(AI 트레이더)의 Positions/Orders/History와 리더 지분(스킨 인 더 게임)을 상세 페이지에 그대로 공개, Your Performance 블록을 분리해 "내 몫"과 "전략 전체"를 혼동하지 않게.

## E. 안티패턴 5

1. **헤드라인 APR/수익률만 크게, 낙폭은 숨김.** Hyperliquid 볼트 가이드조차 "headline APR만 보지 말라"고 경고. 낙폭 없는 수익률 타일 금지.
2. **기본 설정 백테스트 그대로 노출.** 수수료·슬리피지 0의 +132%가 실제 +3%가 되는 사례. 비용 반영 여부를 배지로 표시하지 않으면 신뢰 붕괴.
3. **서버 사본과 화면 불일치.** TradingView 알림은 서버 사본이 따로 돌아 차트 수정이 반영 안 됨. TETH의 AI 설정 변경이 실행 중 에이전트에 언제 반영되는지 모호하면 안 됨(버전/적용 시각 표시).
4. **모바일에서 리스크 정보 접힘.** 오더북처럼 접는 건 괜찮지만, 청산가·마진비율·AI 상태를 스크롤 아래로 밀면 초보는 못 본다.
5. **"AI가 알아서"라는 블랙박스 카피.** eToro도 비율 복제 규칙과 CSL 동작을 문장으로 풀어 설명한다. 판단 근거와 중단 조건을 말로 못 하는 에이전트 상태 표시는 신뢰를 만들지 못한다.

## 참고 URL (실제 읽음)
- https://supa.is/article/hyperliquid-app-interface-guide-panels-explained-2026
- https://hyperliquidguide.com/guides/getting-started/hyperliquid-mobile-guide
- https://hyperliquidguide.com/guides/getting-started/hyperliquid-android-app
- https://hyperliquidguide.com/guides/trading/pnl-sharing-leaderboard
- https://hyperliquid.gitbook.io/hyperliquid-docs/hypercore/vaults/for-vault-depositors-legacy
- https://hyperliquid.gitbook.io/hyperliquid-docs/hypercore/vaults/for-vault-leaders-legacy
- https://finestel.com/blog/hyperliquid-vaults-explained/
- https://eco.com/support/en/articles/15197987-hyperliquid-vault-strategies-2026-hlp-and-user-vaults-explained
- https://www.bankless.com/read/getting-started-with-hyperdashs-revamped-trading-terminal
- https://www.tradingview.com/support/solutions/43000764138-tradingview-strategy-report-how-to-start/
- https://www.tradingview.com/support/folders/43000587044-i-d-like-to-know-more-about-values-in-the-strategy-tester-report/
- https://www.tradingview.com/support/solutions/43000481368-strategy-alerts/
- https://www.tradingview.com/support/solutions/43000516374-forex-com-trading-how-to-start-how-to-place-orders/
- https://www.tradingview.com/support/solutions/43000763362-positions-and-orders/
- https://www.tradingview.com/pine-script-docs/concepts/strategies/
- https://www.tradingview.com/support/solutions/43000666265-how-deep-backtesting-works/
- https://chartwisehub.com/tradingview-strategy-tester/
- https://www.tv-hub.org/guide/tradingview-backtesting
- https://blog.traderspost.io/article/what-is-strategy-tester-in-tradingview
- https://www.etoro.com/copytrader/how-it-works/
- https://www.matchmybroker.com/articles/etoro-copy-trading
- https://wikitoro.org/trading/etoro-copy-trading
- https://www.gncrypto.news/news/etoro-copy-trading-review/
- https://help.etoro.com/en-us/s/article/what-is-copy-stop-loss-US (스니펫만)
- https://help.etoro.com/en-us/s/article/risk-score-explained-US (스니펫만)
