# 카피트레이딩 UX 리서치 (Binance / Bitget / OKX / Bybit, 2026-09 기준)

목적: TETH 전략 마켓플레이스(스크립트 + AI 판단 매매 + AI 트레이더 팔로우)의 탐색, 상세, 카피 설정, 모니터링, 크리에이터 화면 설계 근거. 실제 읽은 공식 문서 URL만 인용. 컴플라이언스 관점은 배제.

---

## A. 플랫폼별 발견

### A1. Binance Futures Copy Trading ("Copy Trading Portfolio")

**탐색/리스트**
- 진입: [Trade] - [Copy Trading] - Futures 탭. 기간 토글 7 / 30 / 90 / 180일.
- 정렬 지표: ROI, PNL, MDD, AUM, Copy Traders, Copy Trader PNL, Sharpe Ratio. 부가 도구: Smart Filter, 태그 필터(예: "high leverage" = 7일 내 20x 이상, "10x-20x leverage"), 커스텀 지표 범위 필터, Lead Trader Comparison(비교 툴). (how-to-use-copy-trading 문서)
- Recommended 탭은 High PNL / High ROI / High Copiers' PNL / Most Copied 4개 랭킹으로 구성. Smart Filter는 매일 00:00 UTC에 "최근 30일 중 14일 이상 수익일, MDD 20% 이하, 다기간 PNL 양수" 등 조건으로 자동 선별. (performance-indicators 문서)
- 지표 정의: ROI(MaxBaseBalance 기반, 시간 단위 갱신), PNL(실현+미실현, 수수료 차감), Sharpe(12시간마다, 30일 운용 후 노출), MDD = (현재ROI - 최고ROI)/(1+최고ROI), Win Rate(완전 청산 포지션만 집계), AUM = 리드 투자금 + 카피어 투자금 합, Runtime(포트폴리오 생성 후 경과).

**상세**
- 탭: Performance / Positions / Trade History / Copiers. 리드 배지 hover 시 elite tier 표시.

**카피 설정 플로우**
- 모드: Fixed Amount(거래당 고정 금액) / Fixed Ratio(총 투자금 기준 비례). Copy Amount 10~300,000 USDT.
- 기존 포지션 처리 3택: 전부 복제 / 더 좋은 진입가만 복제 / 건너뛰기.
- Margin Mode: 리드 따라가기 또는 Cross/Isolated 고정. Leverage: "Follow the Lead Trader" 또는 Fixed 1x~10x. 리드 레버리지와 불일치 감지 시 카피 실패(FAQ).
- Max Entry Slippage 0.1~3%, TP/SL 자동 주문, Portfolio Stop Loss(USDT 또는 %), Cost Per Order, Symbol Preferences(화이트리스트), Auto-Invest(정기 입금).
- 확정: 서비스 약관 동의 후 **[Copy]** 클릭. 자금은 Spot 계정에서 Copy Trading 계정으로 이동.

**모니터링**
- Portfolio Management 페이지: 진행 중/종료 포트폴리오. 버튼 **[Adjust Balance] / [Pause] / [Settings] / [Expand Details]**. 포지션 단위 **[Close Position]**(부분 청산 가능), TP/SL 수정, 마진 추가, 전체 청산.
- 지표: Net Copy Amount, Margin Balance, Realized/Unrealized PNL, Profit Shared, Net Profit.
- Stop Copying 시 "포지션 자동 청산" 또는 "직접 관리로 전환" 택1.

**리드 트레이더 측**
- 별도 Lead Trading 페이지(선물 UI와 유사) 또는 Futures 화면 탭 전환. 포트폴리오 생성 필드: Nickname, Introduction, Public/Private, Amount(최소 500 USDT), Profit Sharing(Public은 10% 고정, Private만 커스텀, 생성 후 변경 불가), Enable Forced Sync(카피어 설정을 리드 설정에 강제 동기화, 총 손절 제외), Minimum Copy Amount.
- "My Lead" 대시보드: [Adjust Balance], [Close], 카피어 목록 + [Remove], 슬롯 200개(가득 차면 200개 자동 추가), 락업 7D/14D/30D.
- 리드 자격: Sharpe 유지, 90일 MDD 25% 이하, 리드 마진 10,000 USDT 이상(Growth Plan). 최대 수익배분 30% + 카피어 수수료 10%.

출처: https://www.binance.com/en/support/faq/how-to-use-copy-trading-on-binance-futures-0b3a91eea664402f812fe41358c8a206 , https://www.binance.com/en/support/faq/detail/54aa6d3b43bc4f6eb4a3a6e3aea40acd , https://www.binance.com/en/support/faq/frequently-asked-questions-on-binance-futures-copy-trading-6ed0995daf0b42d5816beaf1e31ca09d , https://www.binance.com/en/support/faq/how-to-lead-trade-on-binance-futures-6acfb4c1f50c4db1b9e915181ff31a4c , https://www.binance.com/en/support/faq/detail/abc27f5949cf46d9801d31b5e33d0b38 (Spot: Cost Per Order, Total Stop Loss, [Save], [Stop Copying], Portfolio History 탭 Holdings/Trade History/Profit Sharing/Balances History/Failed Orders)

### A2. Bitget Copy Trading ("Elite Traders")

**탐색/리스트**
- 카드 핵심 3지표: Win Rate, ROI, Followers' Profits(공식 가이드). 랜딩 리더보드 컬럼: Total profit / Copiers' profit / ROI / Max copiers. 리더보드 페이지는 Futures rankings / Spot rankings 분리, 랭킹 URL이 지표별(예 spot-roi).
- 2026 추가: 별칭 아래 market preference tag(crypto / stocks / commodities, 180일 거래량 30% 초과 시 부여), advanced filters 패널 최상단에 market preference 다중선택 필터. 서드파티 리뷰 기준 필터 축은 ROI, AUM, 카피어 수, MDD, 승률, 거래 빈도, 자산군. 기간 7 / 90 / 180일.

**상세**
- 총자산 노출 여부는 리드가 토글. "Open Position Protection" 켜면 카피어만 실시간 포지션, 비카피어는 1시간 지연 조회.

**카피 설정 플로우**
- 신 시스템(2026 업그레이드): 주문 기반에서 **포지션 기반 복제**로 전환, 모드는 Fixed Ratio(리드 진입마진/리드 자산 비율을 카피어 자산에 적용) / Fixed Margin(주문당 동일 마진). 청산은 모드와 무관하게 비례.
- 리스크 컨트롤: 주문당 최대 마진 비율 5~95%, 최대 보유가치 0~1,000,000 USDT, 거래쌍별 max copy amount, 손절/익절 비율, 슬리피지 한도, "Auto-Copy"(리드가 추가한 신규 페어 자동 포함), 기존 오픈 포지션 복제 옵션, "Equity Guardian"(순손실/자산 임계 도달 시 자동 중단, 신 시스템에서는 미제공).
- 레버리지/마진: "Follow trader's settings" / Cross / Isolated, 레버리지 고정 또는 페어별 커스텀. 신 시스템은 Cross만.
- 최소 50 USDT. 버튼: **Copy** 진입 후 설정, 완료 Confirm.

**모니터링 / 중단**
- Copy Trading > Futures > 화살표 열면 손익, 승률, 포지션. Details에서 자금 관리, **Edit**로 설정 변경.
- Stop copying 3택: 즉시 시장가 청산 / 리드 청산 대기 / 수동 청산(신 시스템은 수동 옵션 미제공). Smart Copy는 잔여 자금 자동 반환, Diverse Follow는 수동 이체.

**엘리트 트레이더 측**
- 신청: Trade > Tools > Copy trading > "Apply as elite trader", Futures 리더보드 아래 elite portfolio 생성. 포트폴리오별 독립 서브계정, 언제든 종료/재생성(7일 쿨다운 폐지). 엘리트 + 카피어 겸임 가능(계정 격리).
- Elite Trader Center 진입 2경로(Futures > Futures elite trader > Elite portfolio, Assets > Futures elite portfolio). 설정: 총자산 노출, Open Position Protection, Minimum Copy Amount, Profit Share 0~10%(승인 시 30%), Copied Trade Quota(잔여 쿼터, 페어별 최대 거래크기/레버리지).
- 대시보드 지표: 카피어 수(현재/최대), 시간별 수익배분 요약, 카피어 자산/마진 사용, TWR, AUM, 180일 이력. 수익배분은 high-water-mark, 카피어 총 PnL 양수일 때만 정산, 매일 00:00 UTC+8.

출처: https://www.bitget.com/support/articles/12560603826748 , https://www.bitget.com/support/articles/12560603848377 , https://www.bitget.com/support/articles/12560603847588 , https://www.bitget.com/support/articles/12560603889147 , https://www.bitget.com/copy-trading/overview , https://www.cryptoninjas.net/exchange/bitget-copy-trading-review/

### A3. OKX Copy Trading ("Smart Sync")

**탐색/리스트**
- 진입: Trade > Bots & Copy > Copy trading. 마켓플레이스 카드 + 닉네임 검색. Spot / Futures 타입 필터.
- 정렬 지표: Overview(가중 종합), Win rate, PnL%, PnL, AUM, Current copy traders, Copy traders' PNL. 시간 단위 갱신.
- Overview 가중치 공개: 누적 PnL% 20, 30일 PnL% 15, 7일 PnL% 10, 역대 MDD 10, 주간 MDD 10, 카피어 수 20, 카피어 PnL 15.

**상세**
- 탭: Overview / Performance / Copy trader. Trading data(9지표: PnL%, PnL, Win rate, Profit/Loss ratio, 주문 수, Copy trader PnL, Avg. holding period, Current copy traders(현재/최대), AUM) + Trading charts(PnL 차트, Volume 차트, Crypto preferences 파이). Periodic 지표는 7일 / 30일 / 전체.

**카피 설정 플로우**
- 모드 3종: **Smart sync**(총 투자금만 입력, 최소 100 USDT, 레버리지/마진모드/포지션 비율 자동 동기화, 리드별 자금 격리), **Fixed amount**(주문당 마진, 최소 10 USDT), **Proportional**(멀티플라이어, "Smart recommendation multiplier = 보정계수 x min(내 자산, 최대 카피금)/리드 자산", 0.5~1.0).
- 공통: Copy ongoing positions 토글, Total stop loss for trader(리드 단위 누적 손절, 도달 시 카피 중단), Maximum total amount(도달 시 신규 주문 중단). 고급: Contract settings("Same as trader"/Custom, 마진모드 Cross/Isolated/Same as trader, 레버리지), Take profit per order, Stop loss per order.
- 확정: **Copy** 클릭 -> 주문 요약 확인 -> **Copy** 재클릭(2단계 확인).
- 한도: 주문당 10~100,000 USDT, 일 누적 200,000 USDT, 헤지모드 7명 / 단방향 1명.

**모니터링**
- My copies > 리드 선택 > Copy trade details > **Settings**: 진행/이력 포지션, 총 투자금 조정, 총 손절 조정, 카피 중단. **Manage** / **Stop copying** 아이콘. 포지션 개별 청산은 Trade > Copy trading > My trades > Close.
- Smart sync는 기존 카피 전환 불가(중단 후 재시작).

**리드 트레이더 측**
- App Discover > Copy Trading > Profile > Settings에서 수익배분 조정, 월 3회 한도. 비율은 레벨(90일 평균 AUM)로 상한 결정(예 L2 10%, 최대 30%). Private copy trading은 0~50%, 카피어 조회/제거 가능. 정산 주간(월요일 00:00 UTC+8), 연결 포지션 없을 때만. "Pending profits" 화면에서 누적/최근 정산/미정산.

출처: https://www.okx.com/en-us/help/copy-traders-introduction-to-smart-sync , https://www.okx.com/en-us/help/copy-trading-guidebook , https://www.okx.com/en-us/help/copy-traders-faqs , https://www.okx.com/en-gb/help/introduction-to-proportional-copy-trading-orders , https://www.okx.com/en-us/help/lead-traders-lead-trader-profile , https://www.okx.com/en-us/help/copy-traders-how-to-choose-a-lead-trader , https://www.okx.com/en-us/help/lead-traders-trader-profit-sharing-rules

### A4. Bybit (간략)

- 두 상품: Copy Trading Classic(오픈, 최대 10명 팔로우, 리드당 최소 50~100 USDT, 총 200,000 USDT)과 Copy Trading Pro(폐쇄형 펀드형, 주기적 오픈, Pro Master 자격: Silver 3주 + 30일 ROI 10% + Sharpe + MDD 20% 이하).
- 리스트: 큐레이션 카테고리(Top Balanced Traders, New Talents, Boosted Traders 등), 카드에 ROI(7D), 필터 승률/MDD/거래수/선호 페어. 상세: 누적 ROI 차트, 거래 이력(진입/청산가), 활성 포지션, Sharpe, 평균 보유시간, Followers' PnL.
- 설정: 투자금(최소 100 USDT), USDT Perp 또는 Bot 카피 선택, "More Settings"에서 Fixed ratio(기본)/Fixed amount, 주문당 상한, 총 포지션 상한, TP/SL 오버라이드, 슬리피지. 버튼 **Copy** -> **Confirm**.
- 마스터 측: Follower Settings에서 Whitelist, **SyncMaster**(켜면 팔로워가 파라미터 수정 불가, 마스터 설정 강제), Profit Sharing Ratio.
- 주의: 공식 help-center 페이지가 반복 타임아웃되어 아래 서드파티 가이드와 검색 스니펫에 의존.

출처: https://www.bitdegree.org/crypto/tutorials/bybit-copy-trading , https://ai-trading-ranked.com/posts/bybit-copy-trading-guide , (검색 스니펫) https://www.bybit.com/en/help-center/article/Copy-Trading-Copy-Mode-and-Parameters-Settings , https://www.bybit.com/en/help-center/article/How-to-Get-Started-Copy-Trading-on-Bybit-Master-Trader , https://www.bybit.com/en/help-center/article/FAQ-Copy-Trading-Pro

---

## B. 지표별: 왜 존재하나 / 의사결정을 바꾸나

| 지표 | 어디서 | 존재 이유 | 결정 변경력 | TETH 판단 |
|---|---|---|---|---|
| ROI (기간별) | 4사 전부, 기본 정렬 후보 | 수익성 한 줄 요약. Binance는 입출금 왜곡 막으려 MaxBaseBalance로 재정의 | 높음(첫 클릭 유도)이나 기간 토글 없으면 오독 | 기간 토글 필수, 기본 30일 |
| PnL(절대액) | 4사 | ROI의 규모 검증(소액 고ROI 걸러냄) | 중 | ROI 옆 보조 표기 |
| MDD | Binance 정렬, OKX 종합점수 20%, Bybit 필터 | 손실 인내 가능 여부. Binance 리드 자격(90일 25%) 자체가 MDD | 높음(탈락 기준) | 카드 필수, 색상 경고 |
| Win rate | 4사 | 일관성. 정의가 제각각(OKX 주문 기준, Binance 완전청산 기준, FAQ에는 수익일 기준) | 낮음(단독으로 오도) | P/L ratio와 함께만 |
| Copiers' PnL | Binance/Bitget/OKX/Bybit 모두 정렬 축 | "따라한 사람이 실제로 벌었나". Bitget은 3대 지표에 포함 | 매우 높음 | 카드 1순위 후보 |
| Copiers 수 / Max | 4사 | 사회적 증거 + 잔여 슬롯(희소성). OKX는 현재/최대 병기 | 중 | 슬롯 잔여로 표기 |
| AUM | 4사 | 자금 규모 = 신뢰, OKX는 리드 등급 산정 근거 | 중 | 크리에이터 등급 산정에 사용 |
| Sharpe | Binance(30일 후), OKX 프로필, Bybit Pro 자격 | 위험조정 수익. 신규 리드에겐 미노출 | 중(숙련자만) | 상세에서만 |
| Runtime / 거래일수 | Binance, Bybit 필터 | 표본 크기. Bybit 가이드는 90일 이상 권고 | 높음(신뢰 게이트) | 카드 필수 |
| Avg holding / 거래 빈도 | OKX, Bybit | 스타일 매칭(스캘프 vs 스윙) | 중(취향) | 태그로 축약 |
| 레버리지 태그 | Binance(high leverage 등) | 위험 성향 즉시 인지 | 높음 | 태그 채택 |
| 시장 선호 태그 | Bitget(crypto/stocks/commodities) | 자산군 매칭 필터 | 중 | 전략 유형 태그로 대체 |
| 자산 곡선 | OKX PnL 차트, Bybit ROI 차트 | 숫자보다 변동성 직관 | 높음 | 카드 스파크라인 |
| 종합 점수 | OKX Overview(가중치 공개), Binance Smart Filter | 초보자 기본 정렬 | 매우 높음(기본값 효과) | 공개 가중치 채택 |

---

## C. 전략 마켓플레이스 전이 원칙 10

1. **기본 정렬은 공개된 가중 종합 점수로.** OKX Overview는 7개 지표 가중치를 문서에 공개, Binance Smart Filter는 선별 조건을 공개. 기본값이 곧 결정이므로 근거를 드러낸다.
2. **카드 3대 지표는 ROI + 위험 + 팔로워 실적.** Bitget 공식 가이드의 Win Rate / ROI / Followers' Profits, Binance Recommended의 High Copiers' PNL 탭. TETH 카드는 ROI(30d), MDD, 팔로워 PnL.
3. **기간 토글은 리스트와 상세 모두.** Binance 7/30/90/180, OKX 7/30/전체, Bitget 7/90/180. 기간 없는 ROI는 표시하지 않는다.
4. **원클릭 모드 + 고급 모드 2단.** OKX Smart sync(투자금만), Bybit "More Settings", Binance Fixed Ratio 기본. 기본은 비례, 고급에서 고정금액/멀티플라이어.
5. **손절은 두 층위.** 리드(전략) 단위 Total stop loss(OKX, Binance Portfolio Stop Loss, Bitget Equity Guardian)와 주문 단위 TP/SL(OKX per order, Binance TP/SL). TETH도 전략 단위 예산 손절 + AI 판단 매매의 거래별 SL.
6. **기존 포지션 처리 선택을 명시.** Binance 3택(전부/더 좋은 진입가/건너뛰기), OKX/Bitget 토글. "지금 시작하면 뭐가 열리나"를 확인 단계에 표시.
7. **확인은 요약 + 재클릭.** OKX "Copy -> 요약 -> Copy", Bybit "Copy -> Confirm", Binance 약관 동의 후 [Copy]. 버튼 라벨은 동작 동사 1개.
8. **중단 시 포지션 처리 3택.** Bitget(즉시 청산/리드 청산 대기/수동), Binance(자동 청산/직접 관리). 중단 = 청산이 아님을 UI로 분리.
9. **크리에이터 화면은 완전 분리, 겸임 허용.** Binance Lead Trading 페이지 + "My Lead", Bitget Elite Trader Center(포트폴리오별 서브계정, 겸임 허용), Bybit SyncMaster/Whitelist. 수익배분은 크리에이터 설정(OKX 월 3회, Binance 생성 후 고정, Bitget 0~10%)이며 카피어에게는 확인 단계에서 %로 노출.
10. **정산은 high-water-mark 로 팔로워 순이익일 때만.** Bitget 신 시스템, OKX 손익 상계 후 정산. TETH 과금 모델의 max(0, 비용-크레딧)과 정합.

---

## D. 안티패턴 5

1. **정의가 다른 승률을 같은 라벨로.** OKX(주문 기준), Binance(완전 청산만), FAQ(수익일 기준)가 혼재. 라벨 옆에 정의 툴팁 없으면 비교 불가.
2. **레버리지 불일치로 조용한 카피 실패.** Binance FAQ: 리드 레버리지 따라가기 중 불일치 감지 시 실패. 실패 주문을 별도 탭(Failed Orders)에만 숨기지 말고 즉시 알림.
3. **로딩 셸이 곧 리더보드.** Bitget 리더보드/오버뷰 페이지는 서버 렌더에 지표가 없어 클라이언트 로딩 전까지 빈 화면. 첫 페인트에 정적 지표 포함.
4. **설정 항목 과다 노출.** Binance 카피 다이얼로그는 12개 이상 필드(슬리피지, Auto-Invest, 심볼 화이트리스트 등)를 한 화면에. 기본값으로 접고 고급 섹션에 격리.
5. **모드 전환 불가.** OKX Smart sync는 기존 카피에서 전환 불가(중단 후 재시작 필요). 모드 변경을 재시작 없이 허용하거나, 불가하면 설정 진입 전에 경고.
