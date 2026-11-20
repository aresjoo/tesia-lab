/* 생성 파일: tools/extract-from-html.mjs 가 원본 index.html 에서 그대로 꺼낸다. 손으로 고치지 않는다. */
/* 원본 teth-copy.js 의 window.TFC 그대로 */
export const TFC = {
 "score": {
  "wWin": 0.3,
  "wRet": 0.28,
  "wMdd": 0.27,
  "wVol": 0.15,
  "winLo": 35,
  "winHi": 60,
  "retLo": 0,
  "retHi": 6,
  "mddLo": -25,
  "mddHi": -6,
  "volLo": 9,
  "volHi": 4,
  "pass": 0,
  "maxTries": 5
 },
 "price": {
  "month": 599000,
  "year": 5000000
 },
 "exchanges": [
  {
   "id": "binance",
   "name": "Binance",
   "rank": 1,
   "ref": "https://accounts.binance.com/register?ref=TETH_AI",
   "uidLabel": "Binance UID",
   "apiGuide": [
    "바이낸스 로그인 후 프로필 아이콘, 계정 설정으로 이동",
    "API 관리(API Management) 메뉴에서 Create API 선택",
    "라벨에 TETH 입력 후 생성, 보안 인증 완료",
    "Enable Reading과 Enable Spot Trading만 체크 (출금 권한은 켜지 마십시오)",
    "API Key와 Secret Key를 복사해 아래에 붙여넣기"
   ]
  },
  {
   "id": "bybit",
   "name": "Bybit",
   "rank": 4,
   "ref": "https://www.bybit.com/invite?ref=TETHAI",
   "uidLabel": "Bybit UID",
   "apiGuide": [
    "Bybit 로그인 후 프로필, API 메뉴로 이동",
    "API 키 생성 선택, 이름에 TETH 입력",
    "권한은 읽기와 거래(현물, 파생)만 선택 (출금 제외)",
    "API Key와 Secret Key를 복사해 아래에 붙여넣기"
   ]
  },
  {
   "id": "bitget",
   "name": "Bitget",
   "rank": 5,
   "ref": "https://www.bitget.com/referral/register?from=TETHAI",
   "uidLabel": "Bitget UID",
   "apiGuide": [
    "Bitget 로그인 후 프로필, API 관리로 이동",
    "API 키 생성, 이름에 TETH 입력, 패스프레이즈 설정",
    "권한은 읽기 전용과 거래만 선택 (출금 제외)",
    "API Key와 Secret Key를 복사해 아래에 붙여넣기"
   ]
  },
  {
   "id": "mexc",
   "name": "MEXC",
   "rank": 6,
   "ref": "https://www.mexc.com/register?inviteCode=TETHAI",
   "uidLabel": "MEXC UID",
   "apiGuide": [
    "MEXC 로그인 후 계정, API 관리로 이동",
    "API 키 생성, 메모에 TETH 입력",
    "권한은 시세 조회와 거래만 선택 (출금 제외)",
    "API Key와 Secret Key를 복사해 아래에 붙여넣기"
   ]
  },
  {
   "id": "okx",
   "name": "OKX",
   "rank": 2,
   "ref": "https://www.okx.com/join/TETHAI",
   "uidLabel": "OKX UID",
   "apiGuide": [
    "OKX 로그인 후 프로필, API 메뉴로 이동",
    "API 키 생성 선택, 이름에 TETH 입력",
    "권한은 읽기와 거래만 선택 (출금 제외)",
    "패스프레이즈 설정 후 생성",
    "API Key와 Secret Key를 복사해 아래에 붙여넣기"
   ]
  },
  {
   "id": "woox",
   "name": "WOO X",
   "rank": 3,
   "ref": "https://x.woo.org/register?ref=TETHAI",
   "uidLabel": "WOO X UID",
   "apiGuide": [
    "WOO X 로그인 후 계정, API 관리로 이동",
    "Create API Key 선택",
    "권한은 Read와 Trade만 허용 (Withdraw 제외)",
    "API Key와 Secret Key를 복사해 아래에 붙여넣기"
   ]
  }
 ],
 "community": {
  "rewardRate": 0.1,
  "currency": "KRW"
 },
 "credit": {
  "version": 1,
  "uidGrant": 1000,
  "costHigh": 10,
  "warnRatio": 0.8,
  "activityDays": 30,
  "freeQuota": 10
 },
 "billing": {
  "version": 1,
  "WELCOME_CREDIT": 100,
  "UID_CREDIT_CAP": 2000,
  "CARD_CREDIT_MONTHLY": 3000,
  "AI_CALL_COST": 10,
  "THRESHOLD_WARN": 0.2,
  "THRESHOLD_STOP": 0,
  "VOLUME_TO_CREDIT_RATE": {
   "binance": {
    "spot": 0.0004,
    "futures": 0.0006
   },
   "okx": {
    "spot": 0.0004,
    "futures": 0.0006
   },
   "woox": {
    "spot": 0.0005,
    "futures": 0.0007
   }
  },
  "GRACE_HOURS": 24,
  "CARD_PLAN_PRICE_USD": 49,
  "DUNNING_RETRY_MAX": 3,
  "DISCOUNT_RESCUE": 0.9,
  "PROMO_AI_CREDIT_USD": 100
 },
 "copytrade": {
  "version": 1,
  "PROFIT_SHARE": 0,
  "COPIER_CAP": 500,
  "DELAY_HOURS": 1,
  "LOSS_GUARD": -0.2,
  "MIN_COPY_USDT": 50,
  "MARGIN_RANGE": [
   10,
   100000
  ],
  "TRUST_MIN_DAYS": 90,
  "TRUST_HI_ROI": 50
 },
 "rebate": {
  "rate": 0.1
 }
} as const;
