/** Client 621cbed T6/T7 display snapshot, NOT current fee verification or
 * exchange/order/billing authority. Unknown source values remain unknown.
 * Preserve the source post-merge Bybit traderN=0 and Upbit asset list. */
export const BROKER_SOURCE_COMMIT = '621cbedcdd6b8f30b9b678763d8ed0bf2767e8bb'
export type ClientBroker = { id:string; name:string; ord:number; tag:string; assets:string; conn:boolean; rating:number|null; ratingSrc?:string|null; traders:string; fw0:number; lev?:string; lev2?:{spot:string;fut:string}; asof?:string; feeNote?:string; col:string; fg:string; site:string; about:string; promo?:string; assetsList:string[]; rvN?:number; traderN?:number; fees?:{dep:string;wd:string;ina:string;mk:string;tk:string;fmk?:string;ftk?:string|null} }
export type BrokerInfo = { founded:string; hq?:string; docsUrl?:string; community?:string; communityUrl?:string; assetsList?:string[]; rvN?:number; traderN?:number; caps?:Record<string,boolean|'unknown'>; about?:string; faq?:{q:string;a:string}[] }
export type BrokerReview = {id:number;rating:number;text:string;author:string;date:string;categories:string[]}
export const CLIENT_BROKERS: readonly ClientBroker[] = [
  {
    "id": "binance",
    "name": "Binance",
    "ord": 1,
    "tag": "거래소",
    "assets": "암호화폐",
    "conn": true,
    "rating": 4.7,
    "ratingSrc": "App Store 영국 기준, 약 12만 개 평가",
    "traders": "1.2천",
    "fw0": 830,
    "asof": "2026.09",
    "lev2": {
      "spot": "1:1",
      "fut": "최대 150x"
    },
    "col": "#F3BA2F",
    "fg": "#181818",
    "promo": "이용 시 영원히 TETH 이용료 ₩0",
    "site": "binance.com",
    "fees": {
      "dep": "없음 (암호화폐 입금)",
      "wd": "네트워크 수수료",
      "ina": "없음",
      "mk": "0.10%",
      "tk": "0.10%",
      "fmk": "0.02%",
      "ftk": "0.05%"
    },
    "about": "글로벌 최대 거래량의 암호화폐 거래소예요. 현물, 선물과 폭넓은 알트코인을 지원하고, 유동성이 깊어 체결이 안정적입니다. TETH 연결은 조회와 거래 권한만 사용하고 출금 권한은 요구하지 않아요.",
    "assetsList": [
      "암호화폐 현물",
      "USDⓈ-M 선물, 무기한"
    ],
    "rvN": 44,
    "traderN": 1200
  },
  {
    "id": "okx",
    "name": "OKX",
    "ord": 2,
    "tag": "거래소",
    "assets": "암호화폐",
    "conn": true,
    "rating": 4.6,
    "ratingSrc": "App Store 미국 기준, 약 2.3만 개 평가",
    "traders": "640",
    "fw0": 410,
    "asof": "2026.09",
    "lev2": {
      "spot": "1:1",
      "fut": "최대 100x"
    },
    "col": "#0a0a0c",
    "fg": "#fff",
    "promo": "이용 시 영원히 TETH 이용료 ₩0",
    "site": "okx.com",
    "fees": {
      "dep": "없음 (암호화폐 입금)",
      "wd": "네트워크 수수료",
      "ina": "없음",
      "mk": "0.10%",
      "tk": "0.20%",
      "fmk": "0.02%",
      "ftk": "0.05%"
    },
    "feeNote": "현물 수수료는 지역에 따라 다를 수 있다고 공식 페이지가 고지해요. 표기값은 싱가포르 일반 등급 기준.",
    "about": "파생상품과 웹3 지갑까지 아우르는 종합 거래소예요. API 인증에 Passphrase가 필요한 점이 다른 거래소와 달라요. TETH 연결은 조회와 거래 권한만 사용하고 출금 권한은 요구하지 않아요.",
    "assetsList": [
      "암호화폐 현물",
      "마진",
      "만기 선물",
      "무기한 선물",
      "옵션"
    ],
    "rvN": 37,
    "traderN": 640
  },
  {
    "id": "bybit",
    "name": "Bybit",
    "ord": 3,
    "tag": "거래소",
    "assets": "암호화폐",
    "conn": true,
    "rating": 4.7,
    "ratingSrc": "App Store 미국 기준",
    "traders": "410",
    "fw0": 280,
    "asof": "2026.09",
    "lev2": {
      "spot": "1:1",
      "fut": "최대 150x"
    },
    "col": "#15192a",
    "fg": "#f7a600",
    "promo": "이용 시 영원히 TETH 이용료 ₩0",
    "site": "bybit.com",
    "fees": {
      "dep": "없음 (암호화폐 입금)",
      "wd": "네트워크 수수료",
      "ina": "없음",
      "mk": "0.10%",
      "tk": "0.10%",
      "fmk": "0.02%",
      "ftk": "0.055%"
    },
    "about": "파생상품 중심의 글로벌 거래소예요. 현물과 무기한 선물, 옵션을 v5 통합 API로 제공하고 조건부 주문 기능이 폭넓습니다. TETH 연결은 조회와 거래 권한만 사용하고 출금 권한은 요구하지 않아요.",
    "assetsList": [
      "암호화폐 현물",
      "무기한, 선물",
      "옵션"
    ],
    "rvN": 18,
    "traderN": 0
  },
  {
    "id": "bitget",
    "name": "Bitget",
    "ord": 4,
    "tag": "거래소",
    "assets": "암호화폐",
    "conn": true,
    "rating": 4.6,
    "ratingSrc": "App Store 미국 기준, 약 5.5천 개 평가",
    "traders": "310",
    "fw0": 240,
    "asof": "2026.09",
    "lev2": {
      "spot": "1:1",
      "fut": "최대 125x"
    },
    "col": "#00F0FF",
    "fg": "#00251f",
    "promo": "이용 시 영원히 TETH 이용료 ₩0",
    "site": "bitget.com",
    "fees": {
      "dep": "없음 (암호화폐 입금)",
      "wd": "네트워크 수수료",
      "ina": "없음",
      "mk": "0.10%",
      "tk": "0.10%",
      "fmk": "0.02%",
      "ftk": "0.06%"
    },
    "about": "2018년 출범해 세이셸 등록 법인이 운영하는 글로벌 거래소예요. 카피 트레이딩 기능으로 특히 잘 알려져 있고, 현물과 USDT 무기한 선물을 폭넓게 지원합니다. TETH 연결은 조회와 거래 권한만 사용하고 출금 권한은 요구하지 않아요.",
    "assetsList": [
      "암호화폐 현물",
      "USDT 무기한 선물",
      "카피 트레이딩"
    ],
    "rvN": 21,
    "traderN": 310
  },
  {
    "id": "mexc",
    "name": "MEXC",
    "ord": 5,
    "tag": "거래소",
    "assets": "암호화폐",
    "conn": true,
    "rating": 4.7,
    "ratingSrc": "App Store 미국 기준, 약 8.3천 개 평가",
    "traders": "270",
    "fw0": 200,
    "asof": "2026.09",
    "lev2": {
      "spot": "1:1",
      "fut": "최대 500x"
    },
    "col": "#00b897",
    "fg": "#04150f",
    "promo": "이용 시 영원히 TETH 이용료 ₩0",
    "site": "mexc.com",
    "fees": {
      "dep": "없음 (암호화폐 입금)",
      "wd": "네트워크 수수료",
      "ina": "없음",
      "mk": "0.0000%",
      "tk": "0.0500%",
      "fmk": "0.000%",
      "ftk": "0.020%"
    },
    "feeNote": "선물 요율은 웹과 앱의 일반 주문 기준이에요. API 주문은 별도 요율이 적용된다고 공식 고지돼 있어요.",
    "about": "2018년 설립된 글로벌 거래소로, 낮은 수수료와 넓은 알트코인 상장 폭으로 알려져 있어요. BTC와 ETH 무기한 선물에서는 최대 500배 레버리지를 제공합니다. TETH 연결은 조회와 거래 권한만 사용하고 출금 권한은 요구하지 않아요.",
    "assetsList": [
      "암호화폐 현물",
      "USDT 무기한 선물"
    ],
    "rvN": 17,
    "traderN": 270
  },
  {
    "id": "woox",
    "name": "WOO X",
    "ord": 6,
    "tag": "거래소",
    "assets": "암호화폐",
    "conn": true,
    "rating": null,
    "ratingSrc": null,
    "traders": "220",
    "fw0": 150,
    "asof": "2026.09",
    "lev2": {
      "spot": "1:1",
      "fut": "최대 100x"
    },
    "col": "#0a0a0a",
    "fg": "#fff",
    "promo": "이용 시 영원히 TETH 이용료 ₩0",
    "site": "woox.io",
    "fees": {
      "dep": "없음 (암호화폐 입금)",
      "wd": "네트워크 수수료",
      "ina": "없음",
      "mk": "0.08%",
      "tk": "0.10%",
      "fmk": "0.00%",
      "ftk": null
    },
    "feeNote": "선물 Taker 요율은 2026년 5월 개편 뒤 공식 공개 표가 없어 미표기예요.",
    "about": "낮은 수수료와 깊은 유동성을 내세우는 거래소예요. 리드 트레이더를 복제하는 소셜 트레이딩도 함께 제공합니다. TETH 연결은 조회와 거래 권한만 사용하고 출금 권한은 요구하지 않아요.",
    "assetsList": [
      "암호화폐 현물",
      "무기한 선물",
      "소셜 트레이딩"
    ],
    "rvN": 23,
    "traderN": 220
  },
  {
    "id": "upbit",
    "name": "업비트",
    "ord": 7,
    "tag": "거래소",
    "assets": "암호화폐 현물 (원화 마켓)",
    "assetsList": [
      "암호화폐 현물 (원화 마켓)"
    ],
    "conn": false,
    "rating": null,
    "traders": "준비 중",
    "fw0": 520,
    "col": "#093687",
    "fg": "#fff",
    "site": "upbit.com",
    "about": "업비트는 두나무가 2017년에 출시한 국내 최대 규모의 디지털 자산 거래소예요. 원화 마켓을 중심으로 BTC, USDT 마켓과 스테이킹 서비스를 함께 제공합니다. 케이뱅크 실명계좌 연동과 자체 보안 인증 체계로 국내 투자자에게 가장 익숙한 거래 환경으로 꼽혀요. TETH 연결은 준비 중이며, 연결이 열리면 조회와 거래 권한만 사용하고 출금 권한은 요구하지 않아요.",
    "rvN": 29,
    "traderN": 0
  },
  {
    "id": "coinbase",
    "name": "Coinbase",
    "ord": 8,
    "tag": "거래소",
    "assets": "암호화폐 현물",
    "assetsList": [
      "암호화폐 현물",
      "암호화폐 파생상품 (일부 지역)",
      "스테이킹"
    ],
    "conn": false,
    "rating": null,
    "traders": "준비 중",
    "fw0": 490,
    "col": "#0052FF",
    "fg": "#fff",
    "site": "coinbase.com",
    "about": "Coinbase는 2012년 설립된 미국 최대 규모의 암호화폐 거래소예요. 2021년 나스닥에 상장했으며 규제 준수를 중시하는 운영으로 기관과 개인 투자자 모두에게 널리 쓰입니다. 현물 거래 외에 스테이킹, 커스터디, 일부 지역의 파생상품까지 폭넓게 제공해요. TETH 연결은 준비 중이며, 연결이 열리면 조회와 거래 권한만 사용하고 출금 권한은 요구하지 않아요."
  },
  {
    "id": "kis",
    "name": "한국투자증권",
    "ord": 9,
    "tag": "증권사",
    "assets": "국내 주식",
    "assetsList": [
      "국내 주식",
      "해외 주식",
      "ETF",
      "채권",
      "펀드",
      "연금, ISA"
    ],
    "conn": false,
    "rating": null,
    "traders": "준비 중",
    "fw0": 460,
    "col": "#5F4B3C",
    "fg": "#fff",
    "site": "koreainvestment.com",
    "about": "한국투자증권은 1974년 설립된 동원증권을 모태로 하는 한국투자금융지주 계열의 종합 증권사예요. 국내 주식과 해외 주식은 물론 채권, 펀드, 연금까지 아우르는 풀서비스 라인업을 갖추고 있습니다. 자기자본 기준 국내 최상위권 증권사로 IB와 리테일 양쪽에서 강한 입지를 보여줘요. TETH 연결은 준비 중이며, 연결이 열리면 조회와 거래 권한만 사용하고 출금 권한은 요구하지 않아요."
  },
  {
    "id": "robinhood",
    "name": "Robinhood",
    "ord": 10,
    "tag": "브로커",
    "assets": "미국 주식",
    "assetsList": [
      "미국 주식",
      "ETF",
      "옵션",
      "암호화폐",
      "선물"
    ],
    "conn": false,
    "rating": null,
    "traders": "준비 중",
    "fw0": 430,
    "col": "#00C805",
    "fg": "#fff",
    "site": "robinhood.com",
    "about": "Robinhood는 2013년 설립되어 수수료 없는 주식 거래를 대중화한 미국의 모바일 브로커예요. 미국 주식과 ETF, 옵션에 더해 암호화폐와 선물까지 지원 범위를 넓혀 왔습니다. 간결한 앱 경험으로 젊은 개인 투자자층에서 특히 많이 쓰여요. TETH 연결은 준비 중이며, 연결이 열리면 조회와 거래 권한만 사용하고 출금 권한은 요구하지 않아요."
  },
  {
    "id": "ibkr",
    "name": "Interactive Brokers",
    "ord": 11,
    "tag": "브로커",
    "assets": "글로벌 주식",
    "assetsList": [
      "글로벌 주식",
      "ETF",
      "옵션",
      "선물",
      "외환",
      "채권",
      "펀드"
    ],
    "conn": false,
    "rating": null,
    "traders": "준비 중",
    "fw0": 400,
    "col": "#D81222",
    "fg": "#fff",
    "site": "interactivebrokers.com",
    "about": "Interactive Brokers는 1978년 토머스 피터피가 세운 글로벌 온라인 브로커예요. 전 세계 다수의 거래소에 하나의 계좌로 접근할 수 있고 주식, 옵션, 선물, 외환, 채권까지 폭넓은 자산군을 지원합니다. 낮은 수수료와 전문가급 트레이딩 도구로 액티브 트레이더와 기관에서 널리 쓰여요. TETH 연결은 준비 중이며, 연결이 열리면 조회와 거래 권한만 사용하고 출금 권한은 요구하지 않아요."
  },
  {
    "id": "schwab",
    "name": "Charles Schwab",
    "ord": 12,
    "tag": "증권사",
    "assets": "미국 주식",
    "assetsList": [
      "미국 주식",
      "ETF",
      "옵션",
      "선물",
      "채권",
      "뮤추얼펀드"
    ],
    "conn": false,
    "rating": null,
    "traders": "준비 중",
    "fw0": 370,
    "col": "#00A0DF",
    "fg": "#fff",
    "site": "schwab.com",
    "about": "Charles Schwab은 1971년 설립된 미국의 대형 종합 증권사예요. 할인 브로커리지의 개척자로 꼽히며 TD Ameritrade 인수 이후 thinkorswim 등 강력한 트레이딩 플랫폼도 함께 제공합니다. 주식과 ETF부터 채권, 뮤추얼펀드, 자산관리 서비스까지 폭넓게 다뤄요. TETH 연결은 준비 중이며, 연결이 열리면 조회와 거래 권한만 사용하고 출금 권한은 요구하지 않아요."
  },
  {
    "id": "fidelity",
    "name": "Fidelity",
    "ord": 13,
    "tag": "증권사",
    "assets": "미국 주식",
    "assetsList": [
      "미국 주식",
      "ETF",
      "옵션",
      "채권",
      "뮤추얼펀드",
      "암호화폐 (일부)"
    ],
    "conn": false,
    "rating": null,
    "traders": "준비 중",
    "fw0": 340,
    "col": "#64A70B",
    "fg": "#fff",
    "site": "fidelity.com",
    "about": "Fidelity는 1946년 설립된 미국의 대표적인 자산운용사이자 리테일 증권사예요. 뮤추얼펀드와 퇴직연금 시장에서 오랜 강자로, 개인 투자자 대상 브로커리지에서도 최대 규모급 고객 기반을 갖고 있습니다. 주식과 ETF, 채권 외에 비트코인 등 일부 암호화폐 거래도 지원해요. TETH 연결은 준비 중이며, 연결이 열리면 조회와 거래 권한만 사용하고 출금 권한은 요구하지 않아요."
  },
  {
    "id": "etrade",
    "name": "E*TRADE",
    "ord": 14,
    "tag": "증권사",
    "assets": "미국 주식",
    "assetsList": [
      "미국 주식",
      "ETF",
      "옵션",
      "선물",
      "채권",
      "뮤추얼펀드"
    ],
    "conn": false,
    "rating": null,
    "traders": "준비 중",
    "fw0": 310,
    "col": "#6633CC",
    "fg": "#fff",
    "site": "etrade.com",
    "about": "E*TRADE는 1982년 출발한 온라인 주식 거래의 선구자격 증권사예요. 2020년 모건스탠리에 인수되어 현재는 E*TRADE from Morgan Stanley로 서비스되고 있습니다. 미국 주식과 ETF, 옵션, 선물까지 지원하며 Power E*TRADE 플랫폼이 트레이더들에게 잘 알려져 있어요. TETH 연결은 준비 중이며, 연결이 열리면 조회와 거래 권한만 사용하고 출금 권한은 요구하지 않아요."
  },
  {
    "id": "webull",
    "name": "Webull",
    "ord": 15,
    "tag": "브로커",
    "assets": "미국 주식",
    "assetsList": [
      "미국 주식",
      "ETF",
      "옵션",
      "선물"
    ],
    "conn": false,
    "rating": null,
    "traders": "준비 중",
    "fw0": 280,
    "col": "#007CFF",
    "fg": "#fff",
    "site": "webull.com",
    "about": "Webull은 2017년 설립된 모바일 중심의 미국 브로커 플랫폼이에요. 수수료 없는 주식과 ETF, 옵션 거래에 더해 상세한 차트와 시장 데이터를 무료로 제공하는 것이 강점입니다. 미국 외에도 여러 국가에서 현지 법인을 통해 서비스를 운영하고 있어요. TETH 연결은 준비 중이며, 연결이 열리면 조회와 거래 권한만 사용하고 출금 권한은 요구하지 않아요."
  },
  {
    "id": "etoro",
    "name": "eToro",
    "ord": 16,
    "tag": "브로커",
    "assets": "글로벌 주식",
    "assetsList": [
      "글로벌 주식",
      "ETF",
      "암호화폐",
      "CFD (지역별)"
    ],
    "conn": false,
    "rating": null,
    "traders": "준비 중",
    "fw0": 250,
    "col": "#13C636",
    "fg": "#fff",
    "site": "etoro.com",
    "about": "eToro는 2007년 이스라엘에서 설립된 글로벌 소셜 트레이딩 플랫폼이에요. 다른 투자자의 포트폴리오를 따라 투자하는 카피 트레이딩 기능으로 잘 알려져 있습니다. 주식과 ETF, 암호화폐를 지원하며 지역에 따라 CFD 상품도 제공해요. TETH 연결은 준비 중이며, 연결이 열리면 조회와 거래 권한만 사용하고 출금 권한은 요구하지 않아요."
  },
  {
    "id": "saxo",
    "name": "Saxo Bank",
    "ord": 17,
    "tag": "브로커",
    "assets": "글로벌 주식",
    "assetsList": [
      "글로벌 주식",
      "ETF",
      "옵션",
      "선물",
      "외환",
      "채권",
      "CFD"
    ],
    "conn": false,
    "rating": null,
    "traders": "준비 중",
    "fw0": 220,
    "col": "#14143C",
    "fg": "#fff",
    "site": "home.saxo",
    "about": "Saxo Bank는 1992년 덴마크에서 설립된 온라인 트레이딩과 투자 전문 은행이에요. 외환 거래에서 출발해 지금은 주식, ETF, 옵션, 선물, 채권까지 아우르는 멀티에셋 플랫폼을 제공합니다. SaxoTraderGO 등 자체 플랫폼과 기관 대상 화이트라벨 사업으로도 알려져 있어요. TETH 연결은 준비 중이며, 연결이 열리면 조회와 거래 권한만 사용하고 출금 권한은 요구하지 않아요."
  },
  {
    "id": "ig",
    "name": "IG",
    "ord": 18,
    "tag": "브로커",
    "assets": "CFD",
    "assetsList": [
      "CFD",
      "외환",
      "지수 파생",
      "주식 (일부 지역)",
      "스프레드 베팅 (영국)"
    ],
    "conn": false,
    "rating": null,
    "traders": "준비 중",
    "fw0": 190,
    "col": "#E40613",
    "fg": "#fff",
    "site": "ig.com",
    "about": "IG는 1974년 영국 런던에서 설립된 파생상품 트레이딩의 선구자예요. CFD와 스프레드 베팅 분야에서 세계 최대급 사업자로 꼽히며 런던 증시에 상장된 IG Group이 운영합니다. 외환과 지수, 원자재 등 폭넓은 기초자산을 다루고 일부 지역에서는 현물 주식 거래도 지원해요. TETH 연결은 준비 중이며, 연결이 열리면 조회와 거래 권한만 사용하고 출금 권한은 요구하지 않아요."
  },
  {
    "id": "moomoo",
    "name": "moomoo",
    "ord": 19,
    "tag": "브로커",
    "assets": "미국 주식",
    "assetsList": [
      "미국 주식",
      "홍콩 주식",
      "ETF",
      "옵션",
      "선물 (일부 지역)"
    ],
    "conn": false,
    "rating": null,
    "traders": "준비 중",
    "fw0": 160,
    "col": "#FF6900",
    "fg": "#fff",
    "site": "moomoo.com",
    "about": "moomoo는 나스닥 상장사인 Futu Holdings 계열의 글로벌 트레이딩 플랫폼으로 2018년 미국에서 서비스를 시작했어요. 미국 주식과 홍콩 주식, ETF, 옵션을 지원하며 기관급 시세 데이터와 분석 도구를 앱에서 무료에 가깝게 제공하는 것이 특징입니다. 미국, 싱가포르, 일본, 호주 등 여러 시장에서 운영되고 있어요. TETH 연결은 준비 중이며, 연결이 열리면 조회와 거래 권한만 사용하고 출금 권한은 요구하지 않아요."
  },
  {
    "id": "tiger",
    "name": "Tiger Brokers",
    "ord": 20,
    "tag": "브로커",
    "assets": "미국 주식",
    "assetsList": [
      "미국 주식",
      "홍콩 주식",
      "싱가포르 주식",
      "ETF",
      "옵션",
      "선물"
    ],
    "conn": false,
    "rating": null,
    "traders": "준비 중",
    "fw0": 130,
    "col": "#FF7300",
    "fg": "#fff",
    "site": "itiger.com",
    "about": "Tiger Brokers는 2014년 설립된 UP Fintech Holding이 운영하는 온라인 브로커예요. 나스닥 상장사이며 미국, 홍콩, 싱가포르 등 여러 시장의 주식과 ETF, 옵션, 선물 거래를 하나의 앱에서 지원합니다. 중화권과 동남아시아 투자자 기반이 특히 두터운 것으로 알려져 있어요. TETH 연결은 준비 중이며, 연결이 열리면 조회와 거래 권한만 사용하고 출금 권한은 요구하지 않아요."
  },
  {
    "id": "kiwoom",
    "name": "키움증권",
    "ord": 21,
    "tag": "증권사",
    "assets": "국내, 미국 주식",
    "conn": false,
    "rating": null,
    "traders": "준비 중",
    "fw0": 190,
    "lev": "현금 1:1",
    "col": "#5b2d86",
    "fg": "#fff",
    "site": "kiwoom.com",
    "about": "국내 개인 투자자 점유율 1위 증권사예요. 주식 전략 연결은 준비 중입니다.",
    "assetsList": [
      "국내 주식, ETF",
      "해외 주식 (미국)",
      "국내 선물, 옵션",
      "해외 선물, 옵션"
    ],
    "rvN": 12,
    "traderN": 0
  }
]
export const BROKER_INFO: Record<string,BrokerInfo> = {
  "bitget": {
    "founded": "2018",
    "hq": "세이셸 (Bitget Limited)",
    "communityUrl": "https://x.com/bitgetglobal",
    "community": "@bitgetglobal",
    "assetsList": [
      "암호화폐 현물",
      "USDT 무기한 선물",
      "카피 트레이딩"
    ],
    "rvN": 21,
    "traderN": 310,
    "caps": {
      "marketOrder": true,
      "limitOrder": true,
      "stopOrder": true,
      "stopLimitOrder": "unknown",
      "trailingStop": "unknown",
      "oco": "unknown",
      "postOnly": "unknown",
      "reduceOnly": "unknown",
      "demoAccount": "unknown",
      "publicApi": true,
      "level2": true
    }
  },
  "mexc": {
    "founded": "2018",
    "hq": "세이셸 빅토리아",
    "communityUrl": "https://x.com/MEXC_Official",
    "community": "@MEXC_Official",
    "assetsList": [
      "암호화폐 현물",
      "USDT 무기한 선물"
    ],
    "rvN": 17,
    "traderN": 270,
    "caps": {
      "marketOrder": true,
      "limitOrder": true,
      "stopOrder": true,
      "stopLimitOrder": "unknown",
      "trailingStop": "unknown",
      "oco": "unknown",
      "postOnly": "unknown",
      "reduceOnly": "unknown",
      "demoAccount": "unknown",
      "publicApi": true,
      "level2": true
    }
  },
  "upbit": {
    "founded": "2017",
    "hq": "서울 (두나무)",
    "docsUrl": "https://docs.upbit.com/",
    "assetsList": [
      "암호화폐 현물 (원화 마켓)"
    ],
    "rvN": 29,
    "traderN": 0,
    "caps": {
      "marketOrder": true,
      "limitOrder": true,
      "stopOrder": false,
      "stopLimitOrder": false,
      "trailingStop": false,
      "oco": false,
      "postOnly": true,
      "reduceOnly": false,
      "demoAccount": "unknown",
      "publicApi": true,
      "level2": true
    },
    "about": "두나무가 운영하는 국내 최대 디지털 자산 거래소로, 2017년 10월 서비스를 시작했어요. 국내 1호 가상자산사업자로 오픈 API와 호가 데이터를 공식 제공합니다.",
    "faq": [
      {
        "q": "시장가 주문은 API에서 어떻게 내나요?",
        "a": "매수는 ord_type=price로 주문 총액을 지정하고, 매도는 ord_type=market으로 수량을 지정해요. 이 외에 지정가(limit)와 최유리 지정가(best) 주문을 지원합니다."
      },
      {
        "q": "스톱로스(조건부) 주문을 지원하나요?",
        "a": "공식 API 문서 기준 주문 유형은 limit/price/market/best 4가지이며 스톱, 조건부 주문은 제공되지 않아요. 대신 지정가 주문에 IOC, FOK, post_only 체결 조건을 붙일 수 있습니다."
      }
    ]
  },
  "coinbase": {
    "founded": "2012",
    "hq": "미국 (원격 우선 체제)"
  },
  "kis": {
    "founded": "1974",
    "hq": "대한민국 서울"
  },
  "robinhood": {
    "founded": "2013",
    "hq": "미국 캘리포니아"
  },
  "ibkr": {
    "founded": "1978",
    "hq": "미국 코네티컷"
  },
  "schwab": {
    "founded": "1971",
    "hq": "미국 텍사스"
  },
  "fidelity": {
    "founded": "1946",
    "hq": "미국 매사추세츠"
  },
  "etrade": {
    "founded": "1982",
    "hq": "미국 버지니아"
  },
  "webull": {
    "founded": "2017",
    "hq": "미국 플로리다"
  },
  "etoro": {
    "founded": "2007",
    "hq": "이스라엘"
  },
  "saxo": {
    "founded": "1992",
    "hq": "덴마크 코펜하겐"
  },
  "ig": {
    "founded": "1974",
    "hq": "영국 런던"
  },
  "moomoo": {
    "founded": "2018",
    "hq": "미국 뉴저지"
  },
  "tiger": {
    "founded": "2014",
    "hq": "중국 베이징 (국제 사업 거점 싱가포르)"
  },
  "binance": {
    "founded": "2017",
    "hq": "글로벌 (ADGM 규제 법인)",
    "docsUrl": "https://developers.binance.com/docs/binance-spot-api-docs/rest-api/trading-endpoints",
    "community": "Binance Square",
    "communityUrl": "https://www.binance.com/en/square",
    "assetsList": [
      "암호화폐 현물",
      "USDⓈ-M 선물, 무기한"
    ],
    "rvN": 44,
    "traderN": 1200,
    "caps": {
      "marketOrder": true,
      "limitOrder": true,
      "stopOrder": true,
      "stopLimitOrder": true,
      "trailingStop": true,
      "oco": true,
      "postOnly": true,
      "reduceOnly": true,
      "demoAccount": true,
      "publicApi": true,
      "level2": true
    },
    "about": "2017년 7월 출범한 글로벌 블록체인 생태계로, 거래량 기준 세계 최대 디지털 자산 거래소로 스스로를 소개해요. 현물과 파생상품 거래 외에 Academy, Research, Binance Square 같은 생태계 서비스를 함께 운영하고 40개 언어의 24/7 고객 지원을 제공합니다.",
    "faq": [
      {
        "q": "실거래 전에 테스트할 수 있는 환경이 있나요?",
        "a": "네. 현물 API용 테스트넷(testnet.binance.vision)이 공식 문서에 명시되어 있어, 실제 자산 없이 주문 로직을 검증할 수 있어요."
      },
      {
        "q": "OCO 주문을 지원하나요?",
        "a": "네. 현물에서 OCO(One-Cancels-the-Other) 주문 리스트를 지원해요. 한쪽 주문이 활성화되면 다른 쪽이 즉시 취소되는 구조입니다."
      }
    ]
  },
  "okx": {
    "founded": "2017",
    "hq": "세이셸",
    "docsUrl": "https://www.okx.com/docs-v5/en/",
    "community": "@okx",
    "communityUrl": "https://x.com/okx",
    "assetsList": [
      "암호화폐 현물",
      "마진",
      "만기 선물",
      "무기한 선물",
      "옵션"
    ],
    "rvN": 37,
    "traderN": 640,
    "caps": {
      "marketOrder": true,
      "limitOrder": true,
      "stopOrder": true,
      "stopLimitOrder": true,
      "trailingStop": true,
      "oco": "unknown",
      "postOnly": true,
      "reduceOnly": "unknown",
      "demoAccount": true,
      "publicApi": true,
      "level2": true
    },
    "about": "2017년 설립된 암호화폐 거래소로, 100개국 이상 수백만 사용자에게 서비스한다고 소개해요. 현물, 마진, 만기/무기한 선물, 옵션 거래와 DeFi, 렌딩 같은 부가 금융 서비스를 제공하고, 2022년 OKEx에서 OKX로 리브랜딩했습니다.",
    "faq": [
      {
        "q": "데모 트레이딩을 API로도 쓸 수 있나요?",
        "a": "네. 공식 v5 API 문서에 데모 트레이딩 지원이 명시되어 있어요. 요청 헤더에 x-simulated-trading: 1을 추가해 사용합니다."
      },
      {
        "q": "어떤 주문 유형을 지원하나요?",
        "a": "지정가, 시장가, post only, FOK, IOC 기본 주문에 더해 트리거 주문, TP/SL, 트레일링 스탑, 아이스버그, TWAP 같은 알고 주문을 v5 API에서 지원해요."
      }
    ]
  },
  "woox": {
    "founded": "2021 (플랫폼 출시)",
    "hq": "WOOTECH Limited Corp. 운영 (공식 약관 기준)",
    "docsUrl": "https://docs.woox.io/",
    "community": "@_WOO_X",
    "communityUrl": "https://x.com/_WOO_X",
    "assetsList": [
      "암호화폐 현물",
      "무기한 선물",
      "소셜 트레이딩"
    ],
    "rvN": 23,
    "traderN": 220,
    "caps": {
      "marketOrder": true,
      "limitOrder": true,
      "stopOrder": true,
      "stopLimitOrder": true,
      "trailingStop": true,
      "oco": true,
      "postOnly": true,
      "reduceOnly": true,
      "demoAccount": true,
      "publicApi": true,
      "level2": true
    },
    "about": "멀티전략 트레이딩 회사 Kronos Research가 인큐베이팅한 거래소로, 2021년 출범했어요. 트레이더, 거래소, 기관, DeFi 플랫폼을 연결해 낮은 비용으로 깊은 유동성과 좋은 체결 품질에 접근하게 하는 것을 목표로 소개하며, 리드 트레이더의 거래를 복제하는 소셜 트레이딩도 제공합니다.",
    "faq": [
      {
        "q": "API 개발용 테스트 환경이 있나요?",
        "a": "네. 공식 API 문서에 프로덕션 배포 전 테스트할 수 있는 스테이징 환경(api.staging.woox.io)이 명시되어 있어요."
      },
      {
        "q": "스탑, 트레일링 같은 조건 주문은 어떻게 내나요?",
        "a": "알고 주문(algoType)으로 STOP, OCO, TRAILING_STOP, BRACKET을 지원해요. 무기한 선물에서는 reduce_only 옵션으로 포지션 축소 전용 주문도 가능합니다."
      }
    ]
  },
  "bybit": {
    "founded": "2018",
    "hq": "두바이, UAE",
    "docsUrl": "https://bybit-exchange.github.io/docs/v5/intro",
    "community": "@Bybit_Official",
    "communityUrl": "https://x.com/Bybit_Official",
    "assetsList": [
      "암호화폐 현물",
      "무기한, 선물",
      "옵션"
    ],
    "rvN": 18,
    "traderN": 0,
    "caps": {
      "marketOrder": true,
      "limitOrder": true,
      "stopOrder": true,
      "stopLimitOrder": true,
      "trailingStop": true,
      "oco": "unknown",
      "postOnly": true,
      "reduceOnly": true,
      "demoAccount": true,
      "publicApi": true,
      "level2": true
    },
    "about": "2018년 출범한 글로벌 암호화폐 거래소로, 현물과 무기한 선물(linear, inverse), 옵션 파생상품을 v5 통합 API로 제공해요. 조건부 주문, TP/SL, 트레일링 스탑, 포지션 축소 전용 주문 등 파생상품 중심의 주문 기능이 폭넓게 지원됩니다.",
    "faq": [
      {
        "q": "테스트넷이 있나요?",
        "a": "네. 공식 v5 API 문서에 테스트넷 엔드포인트(api-testnet.bybit.com)가 명시되어 있어요."
      },
      {
        "q": "조건부(트리거) 주문은 어떻게 동작하나요?",
        "a": "주문에 triggerPrice를 설정하면 자동으로 조건부 주문으로 전환되고, 트리거 전에는 증거금을 점유하지 않아요. 파생상품 포지션에는 가격 거리 기반 트레일링 스탑도 설정할 수 있습니다."
      }
    ]
  },
  "kiwoom": {
    "founded": "2000",
    "hq": "서울 여의도",
    "docsUrl": "https://openapi.kiwoom.com/main/home",
    "assetsList": [
      "국내 주식, ETF",
      "해외 주식 (미국)",
      "국내 선물, 옵션",
      "해외 선물, 옵션"
    ],
    "rvN": 12,
    "traderN": 0,
    "caps": {
      "marketOrder": true,
      "limitOrder": true,
      "stopOrder": true,
      "stopLimitOrder": "unknown",
      "trailingStop": true,
      "oco": "unknown",
      "postOnly": "unknown",
      "reduceOnly": "unknown",
      "demoAccount": true,
      "publicApi": true,
      "level2": true
    },
    "about": "2000년 설립된 온라인 중심 증권사로, 국내 주식시장 점유율 1위를 다년간 유지해 왔다고 소개해요. HTS 영웅문과 함께 국내와 미국 주식용 키움 REST API 포털을 운영하고, 모의투자와 스탑로스, 자동감시주문 같은 조건부 주문 기능을 제공합니다.",
    "faq": [
      {
        "q": "API로 자동매매를 하려면 무엇을 쓰나요?",
        "a": "키움 REST API 포털(openapi.kiwoom.com)에서 국내주식, 미국주식 API를 제공해요. JSON 기반 스펙과 모의투자 이용안내를 함께 안내합니다."
      },
      {
        "q": "스탑로스나 트레일링스탑 주문이 되나요?",
        "a": "네. 영웅문의 스탑로스 기능은 이익실현, 이익보존, 손실제한과 트레일링스탑 감시를 지원해요. 자동감시주문(서버자동주문)은 HTS를 꺼도 서버에서 감시, 주문됩니다."
      }
    ]
  }
}
const REVIEW_POOL:Record<string,BrokerReview[]> = {
  "bitget": [
    {
      "id": 0,
      "rating": 5,
      "text": "연결이 간단하고 체결이 빨라요. TETH에서 전략 돌리기엔 유동성이 제일 안정적이었어요.",
      "author": "minsu_k",
      "date": "9월 8일",
      "categories": [
        "플랫폼 사용성",
        "거래 기능"
      ]
    },
    {
      "id": 1,
      "rating": 4,
      "text": "수수료는 무난한데 알림이 조금 늦을 때가 있어요. 전반적으로는 만족합니다.",
      "author": "jae_trader",
      "date": "9월 5일",
      "categories": [
        "거래 조건",
        "고객 지원"
      ]
    },
    {
      "id": 2,
      "rating": 5,
      "text": "출금 권한 없이 연결된다는 게 제일 마음에 들어요. 권한 범위가 명확합니다.",
      "author": "sohee.lee",
      "date": "9월 2일",
      "categories": [
        "신뢰와 보안"
      ]
    },
    {
      "id": 3,
      "rating": 3,
      "text": "API 연동 자체는 쉬운데 처음에 권한 설정 찾는 게 헷갈렸어요. 가이드 보고 해결.",
      "author": "parkbull",
      "date": "8월 30일",
      "categories": [
        "계정 관리",
        "플랫폼 사용성"
      ]
    },
    {
      "id": 4,
      "rating": 5,
      "text": "Bitget 유동성이 깊어서 슬리피지 걱정이 덜해요. 전략 체결 로그도 깔끔하게 맞습니다.",
      "author": "quant_dobby",
      "date": "8월 28일",
      "categories": [
        "거래 기능",
        "신뢰와 보안"
      ]
    },
    {
      "id": 5,
      "rating": 4,
      "text": "모바일에서도 연결 상태 확인이 편해요. 앱 전환 없이 TETH에서 다 보이는 게 좋네요.",
      "author": "yunaaa",
      "date": "8월 26일",
      "categories": [
        "모바일"
      ]
    },
    {
      "id": 6,
      "rating": 5,
      "text": "파트너 가입으로 이용료 없이 시작했어요. 절차가 2분 정도로 짧았습니다.",
      "author": "coin_daddy",
      "date": "8월 24일",
      "categories": [
        "거래 조건"
      ]
    },
    {
      "id": 7,
      "rating": 4,
      "text": "계정 인증이 하루 걸린 것 빼면 다 순조로웠어요.",
      "author": "h.jin",
      "date": "8월 21일",
      "categories": [
        "계정 관리"
      ]
    },
    {
      "id": 8,
      "rating": 5,
      "text": "전략 일시 정지하고 수동 거래했다가 다시 재개해도 상태가 안 꼬였어요. 안정적입니다.",
      "author": "slowrich",
      "date": "8월 19일",
      "categories": [
        "거래 기능",
        "신뢰와 보안"
      ]
    },
    {
      "id": 9,
      "rating": 3,
      "text": "점검 시간대에 주문이 밀린 적이 있어요. 공지는 미리 왔지만 아쉬움.",
      "author": "nightowl",
      "date": "8월 17일",
      "categories": [
        "기술 안정성"
      ]
    },
    {
      "id": 10,
      "rating": 4,
      "text": "차트는 다른 앱을 쓰지만 주문 체결은 여기로 몰았어요. 체결 속도 하나는 확실합니다.",
      "author": "trad2r",
      "date": "8월 14일",
      "categories": [
        "거래 기능"
      ]
    },
    {
      "id": 11,
      "rating": 5,
      "text": "고객센터 문의에 반나절 만에 답이 왔어요. 답변도 매뉴얼 복붙이 아니라서 놀랐습니다.",
      "author": "ella_j",
      "date": "8월 11일",
      "categories": [
        "고객 지원"
      ]
    },
    {
      "id": 12,
      "rating": 2,
      "text": "출금 검토가 이틀 걸린 적이 있어요. 보안 때문이라는데 미리 알려줬으면 좋았을 듯.",
      "author": "bear_hunter",
      "date": "8월 9일",
      "categories": [
        "계정 관리",
        "신뢰와 보안"
      ]
    },
    {
      "id": 13,
      "rating": 5,
      "text": "수수료 등급이 올라가니까 확실히 체감돼요. 거래량 있는 분들은 이득입니다.",
      "author": "fee_min",
      "date": "8월 6일",
      "categories": [
        "거래 조건"
      ]
    },
    {
      "id": 14,
      "rating": 4,
      "text": "앱 위젯으로 포지션 확인하는 게 편해요. 다만 다크 모드에서 일부 화면이 눈부십니다.",
      "author": "uxlover",
      "date": "8월 3일",
      "categories": [
        "모바일",
        "플랫폼 사용성"
      ]
    },
    {
      "id": 15,
      "rating": 5,
      "text": "서브계정 나눠서 전략별로 돌리는데 관리가 깔끔해요. 이렇게 쓰는 걸 추천합니다.",
      "author": "multi_bot",
      "date": "7월 31일",
      "categories": [
        "계정 관리",
        "거래 기능"
      ]
    },
    {
      "id": 16,
      "rating": 3,
      "text": "신규 상장 직후엔 호가가 얇아요. 메이저 위주로 쓰면 문제 없습니다.",
      "author": "depth_check",
      "date": "7월 28일",
      "categories": [
        "거래 조건"
      ]
    },
    {
      "id": 17,
      "rating": 5,
      "text": "2년 넘게 쓰면서 출금 사고 한 번도 없었어요. 신뢰가 제일 큰 장점입니다.",
      "author": "longtimer",
      "date": "7월 25일",
      "categories": [
        "신뢰와 보안"
      ]
    },
    {
      "id": 18,
      "rating": 4,
      "text": "수수료 정산 내역이 투명하게 나와요. 월말에 엑셀로 뽑아서 정리하기 좋습니다.",
      "author": "ledger_kim",
      "date": "7월 22일",
      "categories": [
        "거래 조건",
        "계정 관리"
      ]
    },
    {
      "id": 19,
      "rating": 5,
      "text": "TETH 연결 후 첫 자동 주문이 체결되는 걸 보고 신기했어요. 로그가 그대로 남아서 안심됩니다.",
      "author": "auto_first",
      "date": "7월 19일",
      "categories": [
        "거래 기능",
        "플랫폼 사용성"
      ]
    },
    {
      "id": 20,
      "rating": 4,
      "text": "환승 이벤트로 넘어왔는데 자산 이전이 생각보다 수월했어요.",
      "author": "switcher",
      "date": "7월 16일",
      "categories": [
        "계정 관리"
      ]
    }
  ],
  "mexc": [
    {
      "id": 0,
      "rating": 5,
      "text": "연결이 간단하고 체결이 빨라요. TETH에서 전략 돌리기엔 유동성이 제일 안정적이었어요.",
      "author": "minsu_k",
      "date": "9월 8일",
      "categories": [
        "플랫폼 사용성",
        "거래 기능"
      ]
    },
    {
      "id": 1,
      "rating": 4,
      "text": "수수료는 무난한데 알림이 조금 늦을 때가 있어요. 전반적으로는 만족합니다.",
      "author": "jae_trader",
      "date": "9월 5일",
      "categories": [
        "거래 조건",
        "고객 지원"
      ]
    },
    {
      "id": 2,
      "rating": 5,
      "text": "출금 권한 없이 연결된다는 게 제일 마음에 들어요. 권한 범위가 명확합니다.",
      "author": "sohee.lee",
      "date": "9월 2일",
      "categories": [
        "신뢰와 보안"
      ]
    },
    {
      "id": 3,
      "rating": 3,
      "text": "API 연동 자체는 쉬운데 처음에 권한 설정 찾는 게 헷갈렸어요. 가이드 보고 해결.",
      "author": "parkbull",
      "date": "8월 30일",
      "categories": [
        "계정 관리",
        "플랫폼 사용성"
      ]
    },
    {
      "id": 4,
      "rating": 5,
      "text": "MEXC 유동성이 깊어서 슬리피지 걱정이 덜해요. 전략 체결 로그도 깔끔하게 맞습니다.",
      "author": "quant_dobby",
      "date": "8월 28일",
      "categories": [
        "거래 기능",
        "신뢰와 보안"
      ]
    },
    {
      "id": 5,
      "rating": 4,
      "text": "모바일에서도 연결 상태 확인이 편해요. 앱 전환 없이 TETH에서 다 보이는 게 좋네요.",
      "author": "yunaaa",
      "date": "8월 26일",
      "categories": [
        "모바일"
      ]
    },
    {
      "id": 6,
      "rating": 5,
      "text": "파트너 가입으로 이용료 없이 시작했어요. 절차가 2분 정도로 짧았습니다.",
      "author": "coin_daddy",
      "date": "8월 24일",
      "categories": [
        "거래 조건"
      ]
    },
    {
      "id": 7,
      "rating": 4,
      "text": "계정 인증이 하루 걸린 것 빼면 다 순조로웠어요.",
      "author": "h.jin",
      "date": "8월 21일",
      "categories": [
        "계정 관리"
      ]
    },
    {
      "id": 8,
      "rating": 5,
      "text": "전략 일시 정지하고 수동 거래했다가 다시 재개해도 상태가 안 꼬였어요. 안정적입니다.",
      "author": "slowrich",
      "date": "8월 19일",
      "categories": [
        "거래 기능",
        "신뢰와 보안"
      ]
    },
    {
      "id": 9,
      "rating": 3,
      "text": "점검 시간대에 주문이 밀린 적이 있어요. 공지는 미리 왔지만 아쉬움.",
      "author": "nightowl",
      "date": "8월 17일",
      "categories": [
        "기술 안정성"
      ]
    },
    {
      "id": 10,
      "rating": 4,
      "text": "차트는 다른 앱을 쓰지만 주문 체결은 여기로 몰았어요. 체결 속도 하나는 확실합니다.",
      "author": "trad2r",
      "date": "8월 14일",
      "categories": [
        "거래 기능"
      ]
    },
    {
      "id": 11,
      "rating": 5,
      "text": "고객센터 문의에 반나절 만에 답이 왔어요. 답변도 매뉴얼 복붙이 아니라서 놀랐습니다.",
      "author": "ella_j",
      "date": "8월 11일",
      "categories": [
        "고객 지원"
      ]
    },
    {
      "id": 12,
      "rating": 2,
      "text": "출금 검토가 이틀 걸린 적이 있어요. 보안 때문이라는데 미리 알려줬으면 좋았을 듯.",
      "author": "bear_hunter",
      "date": "8월 9일",
      "categories": [
        "계정 관리",
        "신뢰와 보안"
      ]
    },
    {
      "id": 13,
      "rating": 5,
      "text": "수수료 등급이 올라가니까 확실히 체감돼요. 거래량 있는 분들은 이득입니다.",
      "author": "fee_min",
      "date": "8월 6일",
      "categories": [
        "거래 조건"
      ]
    },
    {
      "id": 14,
      "rating": 4,
      "text": "앱 위젯으로 포지션 확인하는 게 편해요. 다만 다크 모드에서 일부 화면이 눈부십니다.",
      "author": "uxlover",
      "date": "8월 3일",
      "categories": [
        "모바일",
        "플랫폼 사용성"
      ]
    },
    {
      "id": 15,
      "rating": 5,
      "text": "서브계정 나눠서 전략별로 돌리는데 관리가 깔끔해요. 이렇게 쓰는 걸 추천합니다.",
      "author": "multi_bot",
      "date": "7월 31일",
      "categories": [
        "계정 관리",
        "거래 기능"
      ]
    },
    {
      "id": 16,
      "rating": 3,
      "text": "신규 상장 직후엔 호가가 얇아요. 메이저 위주로 쓰면 문제 없습니다.",
      "author": "depth_check",
      "date": "7월 28일",
      "categories": [
        "거래 조건"
      ]
    }
  ],
  "binance": [
    {
      "id": 0,
      "rating": 5,
      "text": "연결이 간단하고 체결이 빨라요. TETH에서 전략 돌리기엔 유동성이 제일 안정적이었어요.",
      "author": "minsu_k",
      "date": "9월 8일",
      "categories": [
        "플랫폼 사용성",
        "거래 기능"
      ]
    },
    {
      "id": 1,
      "rating": 4,
      "text": "수수료는 무난한데 알림이 조금 늦을 때가 있어요. 전반적으로는 만족합니다.",
      "author": "jae_trader",
      "date": "9월 5일",
      "categories": [
        "거래 조건",
        "고객 지원"
      ]
    },
    {
      "id": 2,
      "rating": 5,
      "text": "출금 권한 없이 연결된다는 게 제일 마음에 들어요. 권한 범위가 명확합니다.",
      "author": "sohee.lee",
      "date": "9월 2일",
      "categories": [
        "신뢰와 보안"
      ]
    },
    {
      "id": 3,
      "rating": 3,
      "text": "API 연동 자체는 쉬운데 처음에 권한 설정 찾는 게 헷갈렸어요. 가이드 보고 해결.",
      "author": "parkbull",
      "date": "8월 30일",
      "categories": [
        "계정 관리",
        "플랫폼 사용성"
      ]
    },
    {
      "id": 4,
      "rating": 5,
      "text": "Binance 유동성이 깊어서 슬리피지 걱정이 덜해요. 전략 체결 로그도 깔끔하게 맞습니다.",
      "author": "quant_dobby",
      "date": "8월 28일",
      "categories": [
        "거래 기능",
        "신뢰와 보안"
      ]
    },
    {
      "id": 5,
      "rating": 4,
      "text": "모바일에서도 연결 상태 확인이 편해요. 앱 전환 없이 TETH에서 다 보이는 게 좋네요.",
      "author": "yunaaa",
      "date": "8월 26일",
      "categories": [
        "모바일"
      ]
    },
    {
      "id": 6,
      "rating": 5,
      "text": "파트너 가입으로 이용료 없이 시작했어요. 절차가 2분 정도로 짧았습니다.",
      "author": "coin_daddy",
      "date": "8월 24일",
      "categories": [
        "거래 조건"
      ]
    },
    {
      "id": 7,
      "rating": 4,
      "text": "계정 인증이 하루 걸린 것 빼면 다 순조로웠어요.",
      "author": "h.jin",
      "date": "8월 21일",
      "categories": [
        "계정 관리"
      ]
    },
    {
      "id": 8,
      "rating": 5,
      "text": "전략 일시 정지하고 수동 거래했다가 다시 재개해도 상태가 안 꼬였어요. 안정적입니다.",
      "author": "slowrich",
      "date": "8월 19일",
      "categories": [
        "거래 기능",
        "신뢰와 보안"
      ]
    },
    {
      "id": 9,
      "rating": 3,
      "text": "점검 시간대에 주문이 밀린 적이 있어요. 공지는 미리 왔지만 아쉬움.",
      "author": "nightowl",
      "date": "8월 17일",
      "categories": [
        "기술 안정성"
      ]
    },
    {
      "id": 10,
      "rating": 4,
      "text": "차트는 다른 앱을 쓰지만 주문 체결은 여기로 몰았어요. 체결 속도 하나는 확실합니다.",
      "author": "trad2r",
      "date": "8월 14일",
      "categories": [
        "거래 기능"
      ]
    },
    {
      "id": 11,
      "rating": 5,
      "text": "고객센터 문의에 반나절 만에 답이 왔어요. 답변도 매뉴얼 복붙이 아니라서 놀랐습니다.",
      "author": "ella_j",
      "date": "8월 11일",
      "categories": [
        "고객 지원"
      ]
    },
    {
      "id": 12,
      "rating": 2,
      "text": "출금 검토가 이틀 걸린 적이 있어요. 보안 때문이라는데 미리 알려줬으면 좋았을 듯.",
      "author": "bear_hunter",
      "date": "8월 9일",
      "categories": [
        "계정 관리",
        "신뢰와 보안"
      ]
    },
    {
      "id": 13,
      "rating": 5,
      "text": "수수료 등급이 올라가니까 확실히 체감돼요. 거래량 있는 분들은 이득입니다.",
      "author": "fee_min",
      "date": "8월 6일",
      "categories": [
        "거래 조건"
      ]
    },
    {
      "id": 14,
      "rating": 4,
      "text": "앱 위젯으로 포지션 확인하는 게 편해요. 다만 다크 모드에서 일부 화면이 눈부십니다.",
      "author": "uxlover",
      "date": "8월 3일",
      "categories": [
        "모바일",
        "플랫폼 사용성"
      ]
    },
    {
      "id": 15,
      "rating": 5,
      "text": "서브계정 나눠서 전략별로 돌리는데 관리가 깔끔해요. 이렇게 쓰는 걸 추천합니다.",
      "author": "multi_bot",
      "date": "7월 31일",
      "categories": [
        "계정 관리",
        "거래 기능"
      ]
    },
    {
      "id": 16,
      "rating": 3,
      "text": "신규 상장 직후엔 호가가 얇아요. 메이저 위주로 쓰면 문제 없습니다.",
      "author": "depth_check",
      "date": "7월 28일",
      "categories": [
        "거래 조건"
      ]
    },
    {
      "id": 17,
      "rating": 5,
      "text": "2년 넘게 쓰면서 출금 사고 한 번도 없었어요. 신뢰가 제일 큰 장점입니다.",
      "author": "longtimer",
      "date": "7월 25일",
      "categories": [
        "신뢰와 보안"
      ]
    },
    {
      "id": 18,
      "rating": 4,
      "text": "수수료 정산 내역이 투명하게 나와요. 월말에 엑셀로 뽑아서 정리하기 좋습니다.",
      "author": "ledger_kim",
      "date": "7월 22일",
      "categories": [
        "거래 조건",
        "계정 관리"
      ]
    },
    {
      "id": 19,
      "rating": 5,
      "text": "TETH 연결 후 첫 자동 주문이 체결되는 걸 보고 신기했어요. 로그가 그대로 남아서 안심됩니다.",
      "author": "auto_first",
      "date": "7월 19일",
      "categories": [
        "거래 기능",
        "플랫폼 사용성"
      ]
    },
    {
      "id": 20,
      "rating": 4,
      "text": "환승 이벤트로 넘어왔는데 자산 이전이 생각보다 수월했어요.",
      "author": "switcher",
      "date": "7월 16일",
      "categories": [
        "계정 관리"
      ]
    },
    {
      "id": 21,
      "rating": 1,
      "text": "점검 공지를 놓쳐서 전략이 몇 시간 멈춘 적이 있습니다. 알림 채널을 더 늘려주세요.",
      "author": "angry_bull",
      "date": "7월 13일",
      "categories": [
        "기술 안정성",
        "고객 지원"
      ]
    },
    {
      "id": 22,
      "rating": 5,
      "text": "호가창 반응 속도가 빨라서 스캘핑 전략도 밀리지 않아요.",
      "author": "tick_rider",
      "date": "7월 10일",
      "categories": [
        "거래 기능",
        "기술 안정성"
      ]
    },
    {
      "id": 23,
      "rating": 4,
      "text": "입금 반영이 빠르고 원화 환산 표시가 정확해요. 초보자도 헷갈릴 게 없습니다.",
      "author": "krw_easy",
      "date": "7월 7일",
      "categories": [
        "플랫폼 사용성"
      ]
    },
    {
      "id": 24,
      "rating": 5,
      "text": "보안 설정 단계가 촘촘해요. OTP에 출금 화이트리스트까지 걸어두니 마음이 편합니다.",
      "author": "safe_first",
      "date": "7월 4일",
      "categories": [
        "신뢰와 보안"
      ]
    },
    {
      "id": 25,
      "rating": 3,
      "text": "수수료 이벤트 조건이 좀 복잡해요. 조건 읽다가 포기했습니다.",
      "author": "event_tired",
      "date": "7월 1일",
      "categories": [
        "거래 조건"
      ]
    },
    {
      "id": 26,
      "rating": 5,
      "text": "Binance 앱 안정성이 좋아졌어요. 작년에 있던 강제 종료 문제가 요즘은 없습니다.",
      "author": "app_watch",
      "date": "6월 27일",
      "categories": [
        "모바일",
        "기술 안정성"
      ]
    },
    {
      "id": 27,
      "rating": 4,
      "text": "API 문서가 깔끔해서 봇 붙이기 쉬웠어요. 예제 코드도 그대로 돌아갑니다.",
      "author": "dev_jun",
      "date": "6월 24일",
      "categories": [
        "플랫폼 사용성",
        "거래 기능"
      ]
    },
    {
      "id": 28,
      "rating": 5,
      "text": "대량 주문도 분할 체결이 매끄러워요. 큰 물량 굴리는 분들한테 추천합니다.",
      "author": "whale_jr",
      "date": "6월 21일",
      "categories": [
        "거래 기능"
      ]
    },
    {
      "id": 29,
      "rating": 4,
      "text": "수수료 캐시백이 생각보다 쏠쏠해요. 정산도 매일 자동으로 들어옵니다.",
      "author": "cashback",
      "date": "6월 18일",
      "categories": [
        "거래 조건"
      ]
    },
    {
      "id": 30,
      "rating": 2,
      "text": "고객센터 첫 응대가 챗봇이라 답답했어요. 상담사 연결까지 시간이 걸립니다.",
      "author": "human_pls",
      "date": "6월 15일",
      "categories": [
        "고객 지원"
      ]
    },
    {
      "id": 31,
      "rating": 5,
      "text": "전략 로그와 거래소 체결 내역이 1원 단위까지 일치해요. 정산 검증이 편합니다.",
      "author": "audit_me",
      "date": "6월 12일",
      "categories": [
        "신뢰와 보안",
        "거래 기능"
      ]
    },
    {
      "id": 32,
      "rating": 4,
      "text": "모바일 지문 로그인 지원이 편해요. 다만 태블릿 레이아웃은 아직 아쉽습니다.",
      "author": "pad_user",
      "date": "6월 9일",
      "categories": [
        "모바일"
      ]
    },
    {
      "id": 33,
      "rating": 5,
      "text": "신규 가입 절차가 10분이면 끝나요. 신분증 인증도 바로 통과됐습니다.",
      "author": "quick_join",
      "date": "6월 6일",
      "categories": [
        "계정 관리"
      ]
    },
    {
      "id": 34,
      "rating": 3,
      "text": "차트 지표 종류가 적은 편이에요. 분석은 다른 툴 병행을 추천합니다.",
      "author": "chart_geek",
      "date": "6월 3일",
      "categories": [
        "플랫폼 사용성"
      ]
    },
    {
      "id": 35,
      "rating": 5,
      "text": "서버 점검이 새벽 시간대로 고정이라 전략 운영에 영향이 거의 없어요.",
      "author": "night_shift",
      "date": "5월 31일",
      "categories": [
        "기술 안정성"
      ]
    },
    {
      "id": 36,
      "rating": 4,
      "text": "출금 수수료가 네트워크 상황 따라 안내돼서 예측하기 좋아요.",
      "author": "net_fee",
      "date": "5월 28일",
      "categories": [
        "거래 조건"
      ]
    },
    {
      "id": 37,
      "rating": 5,
      "text": "2단계 인증 리셋 절차가 엄격해서 오히려 믿음이 갑니다. 계정 탈취 걱정을 덜었어요.",
      "author": "otp_lost",
      "date": "5월 25일",
      "categories": [
        "신뢰와 보안",
        "고객 지원"
      ]
    },
    {
      "id": 38,
      "rating": 4,
      "text": "김프 확인용 시세 비교가 편해요. 원화 사용자 배려가 느껴집니다.",
      "author": "kimchi_p",
      "date": "5월 22일",
      "categories": [
        "플랫폼 사용성"
      ]
    },
    {
      "id": 39,
      "rating": 5,
      "text": "Binance 연동 후 반년째 자동 매매 중인데 체결 누락이 한 번도 없었습니다.",
      "author": "half_year",
      "date": "5월 19일",
      "categories": [
        "거래 기능",
        "기술 안정성"
      ]
    },
    {
      "id": 40,
      "rating": 3,
      "text": "수수료 등급 산정 기준이 분기마다 바뀌어서 따라가기 어렵네요.",
      "author": "tier_maze",
      "date": "5월 16일",
      "categories": [
        "거래 조건"
      ]
    },
    {
      "id": 41,
      "rating": 4,
      "text": "입출금 내역 필터가 세분화돼 있어서 세금 신고 자료 만들기 좋아요.",
      "author": "tax_szn",
      "date": "5월 13일",
      "categories": [
        "계정 관리"
      ]
    },
    {
      "id": 42,
      "rating": 5,
      "text": "문의 남겼더니 한국어로 정확하게 답이 왔어요. 번역투가 아니라 사람이 쓴 답변이었습니다.",
      "author": "ko_support",
      "date": "5월 10일",
      "categories": [
        "고객 지원"
      ]
    },
    {
      "id": 43,
      "rating": 2,
      "text": "앱 업데이트 직후 위젯이 초기화된 적이 있어요. 복구는 됐지만 당황스러웠습니다.",
      "author": "widget_gone",
      "date": "5월 7일",
      "categories": [
        "모바일",
        "기술 안정성"
      ]
    }
  ],
  "okx": [
    {
      "id": 0,
      "rating": 5,
      "text": "연결이 간단하고 체결이 빨라요. TETH에서 전략 돌리기엔 유동성이 제일 안정적이었어요.",
      "author": "minsu_k",
      "date": "9월 8일",
      "categories": [
        "플랫폼 사용성",
        "거래 기능"
      ]
    },
    {
      "id": 1,
      "rating": 4,
      "text": "수수료는 무난한데 알림이 조금 늦을 때가 있어요. 전반적으로는 만족합니다.",
      "author": "jae_trader",
      "date": "9월 5일",
      "categories": [
        "거래 조건",
        "고객 지원"
      ]
    },
    {
      "id": 2,
      "rating": 5,
      "text": "출금 권한 없이 연결된다는 게 제일 마음에 들어요. 권한 범위가 명확합니다.",
      "author": "sohee.lee",
      "date": "9월 2일",
      "categories": [
        "신뢰와 보안"
      ]
    },
    {
      "id": 3,
      "rating": 3,
      "text": "API 연동 자체는 쉬운데 처음에 권한 설정 찾는 게 헷갈렸어요. 가이드 보고 해결.",
      "author": "parkbull",
      "date": "8월 30일",
      "categories": [
        "계정 관리",
        "플랫폼 사용성"
      ]
    },
    {
      "id": 4,
      "rating": 5,
      "text": "OKX 유동성이 깊어서 슬리피지 걱정이 덜해요. 전략 체결 로그도 깔끔하게 맞습니다.",
      "author": "quant_dobby",
      "date": "8월 28일",
      "categories": [
        "거래 기능",
        "신뢰와 보안"
      ]
    },
    {
      "id": 5,
      "rating": 4,
      "text": "모바일에서도 연결 상태 확인이 편해요. 앱 전환 없이 TETH에서 다 보이는 게 좋네요.",
      "author": "yunaaa",
      "date": "8월 26일",
      "categories": [
        "모바일"
      ]
    },
    {
      "id": 6,
      "rating": 5,
      "text": "파트너 가입으로 이용료 없이 시작했어요. 절차가 2분 정도로 짧았습니다.",
      "author": "coin_daddy",
      "date": "8월 24일",
      "categories": [
        "거래 조건"
      ]
    },
    {
      "id": 7,
      "rating": 4,
      "text": "계정 인증이 하루 걸린 것 빼면 다 순조로웠어요.",
      "author": "h.jin",
      "date": "8월 21일",
      "categories": [
        "계정 관리"
      ]
    },
    {
      "id": 8,
      "rating": 5,
      "text": "전략 일시 정지하고 수동 거래했다가 다시 재개해도 상태가 안 꼬였어요. 안정적입니다.",
      "author": "slowrich",
      "date": "8월 19일",
      "categories": [
        "거래 기능",
        "신뢰와 보안"
      ]
    },
    {
      "id": 9,
      "rating": 3,
      "text": "점검 시간대에 주문이 밀린 적이 있어요. 공지는 미리 왔지만 아쉬움.",
      "author": "nightowl",
      "date": "8월 17일",
      "categories": [
        "기술 안정성"
      ]
    },
    {
      "id": 10,
      "rating": 4,
      "text": "차트는 다른 앱을 쓰지만 주문 체결은 여기로 몰았어요. 체결 속도 하나는 확실합니다.",
      "author": "trad2r",
      "date": "8월 14일",
      "categories": [
        "거래 기능"
      ]
    },
    {
      "id": 11,
      "rating": 5,
      "text": "고객센터 문의에 반나절 만에 답이 왔어요. 답변도 매뉴얼 복붙이 아니라서 놀랐습니다.",
      "author": "ella_j",
      "date": "8월 11일",
      "categories": [
        "고객 지원"
      ]
    },
    {
      "id": 12,
      "rating": 2,
      "text": "출금 검토가 이틀 걸린 적이 있어요. 보안 때문이라는데 미리 알려줬으면 좋았을 듯.",
      "author": "bear_hunter",
      "date": "8월 9일",
      "categories": [
        "계정 관리",
        "신뢰와 보안"
      ]
    },
    {
      "id": 13,
      "rating": 5,
      "text": "수수료 등급이 올라가니까 확실히 체감돼요. 거래량 있는 분들은 이득입니다.",
      "author": "fee_min",
      "date": "8월 6일",
      "categories": [
        "거래 조건"
      ]
    },
    {
      "id": 14,
      "rating": 4,
      "text": "앱 위젯으로 포지션 확인하는 게 편해요. 다만 다크 모드에서 일부 화면이 눈부십니다.",
      "author": "uxlover",
      "date": "8월 3일",
      "categories": [
        "모바일",
        "플랫폼 사용성"
      ]
    },
    {
      "id": 15,
      "rating": 5,
      "text": "서브계정 나눠서 전략별로 돌리는데 관리가 깔끔해요. 이렇게 쓰는 걸 추천합니다.",
      "author": "multi_bot",
      "date": "7월 31일",
      "categories": [
        "계정 관리",
        "거래 기능"
      ]
    },
    {
      "id": 16,
      "rating": 3,
      "text": "신규 상장 직후엔 호가가 얇아요. 메이저 위주로 쓰면 문제 없습니다.",
      "author": "depth_check",
      "date": "7월 28일",
      "categories": [
        "거래 조건"
      ]
    },
    {
      "id": 17,
      "rating": 5,
      "text": "2년 넘게 쓰면서 출금 사고 한 번도 없었어요. 신뢰가 제일 큰 장점입니다.",
      "author": "longtimer",
      "date": "7월 25일",
      "categories": [
        "신뢰와 보안"
      ]
    },
    {
      "id": 18,
      "rating": 4,
      "text": "수수료 정산 내역이 투명하게 나와요. 월말에 엑셀로 뽑아서 정리하기 좋습니다.",
      "author": "ledger_kim",
      "date": "7월 22일",
      "categories": [
        "거래 조건",
        "계정 관리"
      ]
    },
    {
      "id": 19,
      "rating": 5,
      "text": "TETH 연결 후 첫 자동 주문이 체결되는 걸 보고 신기했어요. 로그가 그대로 남아서 안심됩니다.",
      "author": "auto_first",
      "date": "7월 19일",
      "categories": [
        "거래 기능",
        "플랫폼 사용성"
      ]
    },
    {
      "id": 20,
      "rating": 4,
      "text": "환승 이벤트로 넘어왔는데 자산 이전이 생각보다 수월했어요.",
      "author": "switcher",
      "date": "7월 16일",
      "categories": [
        "계정 관리"
      ]
    },
    {
      "id": 21,
      "rating": 1,
      "text": "점검 공지를 놓쳐서 전략이 몇 시간 멈춘 적이 있습니다. 알림 채널을 더 늘려주세요.",
      "author": "angry_bull",
      "date": "7월 13일",
      "categories": [
        "기술 안정성",
        "고객 지원"
      ]
    },
    {
      "id": 22,
      "rating": 5,
      "text": "호가창 반응 속도가 빨라서 스캘핑 전략도 밀리지 않아요.",
      "author": "tick_rider",
      "date": "7월 10일",
      "categories": [
        "거래 기능",
        "기술 안정성"
      ]
    },
    {
      "id": 23,
      "rating": 4,
      "text": "입금 반영이 빠르고 원화 환산 표시가 정확해요. 초보자도 헷갈릴 게 없습니다.",
      "author": "krw_easy",
      "date": "7월 7일",
      "categories": [
        "플랫폼 사용성"
      ]
    },
    {
      "id": 24,
      "rating": 5,
      "text": "보안 설정 단계가 촘촘해요. OTP에 출금 화이트리스트까지 걸어두니 마음이 편합니다.",
      "author": "safe_first",
      "date": "7월 4일",
      "categories": [
        "신뢰와 보안"
      ]
    },
    {
      "id": 25,
      "rating": 3,
      "text": "수수료 이벤트 조건이 좀 복잡해요. 조건 읽다가 포기했습니다.",
      "author": "event_tired",
      "date": "7월 1일",
      "categories": [
        "거래 조건"
      ]
    },
    {
      "id": 26,
      "rating": 5,
      "text": "OKX 앱 안정성이 좋아졌어요. 작년에 있던 강제 종료 문제가 요즘은 없습니다.",
      "author": "app_watch",
      "date": "6월 27일",
      "categories": [
        "모바일",
        "기술 안정성"
      ]
    },
    {
      "id": 27,
      "rating": 4,
      "text": "API 문서가 깔끔해서 봇 붙이기 쉬웠어요. 예제 코드도 그대로 돌아갑니다.",
      "author": "dev_jun",
      "date": "6월 24일",
      "categories": [
        "플랫폼 사용성",
        "거래 기능"
      ]
    },
    {
      "id": 28,
      "rating": 5,
      "text": "대량 주문도 분할 체결이 매끄러워요. 큰 물량 굴리는 분들한테 추천합니다.",
      "author": "whale_jr",
      "date": "6월 21일",
      "categories": [
        "거래 기능"
      ]
    },
    {
      "id": 29,
      "rating": 4,
      "text": "수수료 캐시백이 생각보다 쏠쏠해요. 정산도 매일 자동으로 들어옵니다.",
      "author": "cashback",
      "date": "6월 18일",
      "categories": [
        "거래 조건"
      ]
    },
    {
      "id": 30,
      "rating": 2,
      "text": "고객센터 첫 응대가 챗봇이라 답답했어요. 상담사 연결까지 시간이 걸립니다.",
      "author": "human_pls",
      "date": "6월 15일",
      "categories": [
        "고객 지원"
      ]
    },
    {
      "id": 31,
      "rating": 5,
      "text": "전략 로그와 거래소 체결 내역이 1원 단위까지 일치해요. 정산 검증이 편합니다.",
      "author": "audit_me",
      "date": "6월 12일",
      "categories": [
        "신뢰와 보안",
        "거래 기능"
      ]
    },
    {
      "id": 32,
      "rating": 4,
      "text": "모바일 지문 로그인 지원이 편해요. 다만 태블릿 레이아웃은 아직 아쉽습니다.",
      "author": "pad_user",
      "date": "6월 9일",
      "categories": [
        "모바일"
      ]
    },
    {
      "id": 33,
      "rating": 5,
      "text": "신규 가입 절차가 10분이면 끝나요. 신분증 인증도 바로 통과됐습니다.",
      "author": "quick_join",
      "date": "6월 6일",
      "categories": [
        "계정 관리"
      ]
    },
    {
      "id": 34,
      "rating": 3,
      "text": "차트 지표 종류가 적은 편이에요. 분석은 다른 툴 병행을 추천합니다.",
      "author": "chart_geek",
      "date": "6월 3일",
      "categories": [
        "플랫폼 사용성"
      ]
    },
    {
      "id": 35,
      "rating": 5,
      "text": "서버 점검이 새벽 시간대로 고정이라 전략 운영에 영향이 거의 없어요.",
      "author": "night_shift",
      "date": "5월 31일",
      "categories": [
        "기술 안정성"
      ]
    },
    {
      "id": 36,
      "rating": 4,
      "text": "출금 수수료가 네트워크 상황 따라 안내돼서 예측하기 좋아요.",
      "author": "net_fee",
      "date": "5월 28일",
      "categories": [
        "거래 조건"
      ]
    }
  ],
  "woox": [
    {
      "id": 0,
      "rating": 5,
      "text": "연결이 간단하고 체결이 빨라요. TETH에서 전략 돌리기엔 유동성이 제일 안정적이었어요.",
      "author": "minsu_k",
      "date": "9월 8일",
      "categories": [
        "플랫폼 사용성",
        "거래 기능"
      ]
    },
    {
      "id": 1,
      "rating": 4,
      "text": "수수료는 무난한데 알림이 조금 늦을 때가 있어요. 전반적으로는 만족합니다.",
      "author": "jae_trader",
      "date": "9월 5일",
      "categories": [
        "거래 조건",
        "고객 지원"
      ]
    },
    {
      "id": 2,
      "rating": 5,
      "text": "출금 권한 없이 연결된다는 게 제일 마음에 들어요. 권한 범위가 명확합니다.",
      "author": "sohee.lee",
      "date": "9월 2일",
      "categories": [
        "신뢰와 보안"
      ]
    },
    {
      "id": 3,
      "rating": 3,
      "text": "API 연동 자체는 쉬운데 처음에 권한 설정 찾는 게 헷갈렸어요. 가이드 보고 해결.",
      "author": "parkbull",
      "date": "8월 30일",
      "categories": [
        "계정 관리",
        "플랫폼 사용성"
      ]
    },
    {
      "id": 4,
      "rating": 5,
      "text": "WOO X 유동성이 깊어서 슬리피지 걱정이 덜해요. 전략 체결 로그도 깔끔하게 맞습니다.",
      "author": "quant_dobby",
      "date": "8월 28일",
      "categories": [
        "거래 기능",
        "신뢰와 보안"
      ]
    },
    {
      "id": 5,
      "rating": 4,
      "text": "모바일에서도 연결 상태 확인이 편해요. 앱 전환 없이 TETH에서 다 보이는 게 좋네요.",
      "author": "yunaaa",
      "date": "8월 26일",
      "categories": [
        "모바일"
      ]
    },
    {
      "id": 6,
      "rating": 5,
      "text": "파트너 가입으로 이용료 없이 시작했어요. 절차가 2분 정도로 짧았습니다.",
      "author": "coin_daddy",
      "date": "8월 24일",
      "categories": [
        "거래 조건"
      ]
    },
    {
      "id": 7,
      "rating": 4,
      "text": "계정 인증이 하루 걸린 것 빼면 다 순조로웠어요.",
      "author": "h.jin",
      "date": "8월 21일",
      "categories": [
        "계정 관리"
      ]
    },
    {
      "id": 8,
      "rating": 5,
      "text": "전략 일시 정지하고 수동 거래했다가 다시 재개해도 상태가 안 꼬였어요. 안정적입니다.",
      "author": "slowrich",
      "date": "8월 19일",
      "categories": [
        "거래 기능",
        "신뢰와 보안"
      ]
    },
    {
      "id": 9,
      "rating": 3,
      "text": "점검 시간대에 주문이 밀린 적이 있어요. 공지는 미리 왔지만 아쉬움.",
      "author": "nightowl",
      "date": "8월 17일",
      "categories": [
        "기술 안정성"
      ]
    },
    {
      "id": 10,
      "rating": 4,
      "text": "차트는 다른 앱을 쓰지만 주문 체결은 여기로 몰았어요. 체결 속도 하나는 확실합니다.",
      "author": "trad2r",
      "date": "8월 14일",
      "categories": [
        "거래 기능"
      ]
    },
    {
      "id": 11,
      "rating": 5,
      "text": "고객센터 문의에 반나절 만에 답이 왔어요. 답변도 매뉴얼 복붙이 아니라서 놀랐습니다.",
      "author": "ella_j",
      "date": "8월 11일",
      "categories": [
        "고객 지원"
      ]
    },
    {
      "id": 12,
      "rating": 2,
      "text": "출금 검토가 이틀 걸린 적이 있어요. 보안 때문이라는데 미리 알려줬으면 좋았을 듯.",
      "author": "bear_hunter",
      "date": "8월 9일",
      "categories": [
        "계정 관리",
        "신뢰와 보안"
      ]
    },
    {
      "id": 13,
      "rating": 5,
      "text": "수수료 등급이 올라가니까 확실히 체감돼요. 거래량 있는 분들은 이득입니다.",
      "author": "fee_min",
      "date": "8월 6일",
      "categories": [
        "거래 조건"
      ]
    },
    {
      "id": 14,
      "rating": 4,
      "text": "앱 위젯으로 포지션 확인하는 게 편해요. 다만 다크 모드에서 일부 화면이 눈부십니다.",
      "author": "uxlover",
      "date": "8월 3일",
      "categories": [
        "모바일",
        "플랫폼 사용성"
      ]
    },
    {
      "id": 15,
      "rating": 5,
      "text": "서브계정 나눠서 전략별로 돌리는데 관리가 깔끔해요. 이렇게 쓰는 걸 추천합니다.",
      "author": "multi_bot",
      "date": "7월 31일",
      "categories": [
        "계정 관리",
        "거래 기능"
      ]
    },
    {
      "id": 16,
      "rating": 3,
      "text": "신규 상장 직후엔 호가가 얇아요. 메이저 위주로 쓰면 문제 없습니다.",
      "author": "depth_check",
      "date": "7월 28일",
      "categories": [
        "거래 조건"
      ]
    },
    {
      "id": 17,
      "rating": 5,
      "text": "2년 넘게 쓰면서 출금 사고 한 번도 없었어요. 신뢰가 제일 큰 장점입니다.",
      "author": "longtimer",
      "date": "7월 25일",
      "categories": [
        "신뢰와 보안"
      ]
    },
    {
      "id": 18,
      "rating": 4,
      "text": "수수료 정산 내역이 투명하게 나와요. 월말에 엑셀로 뽑아서 정리하기 좋습니다.",
      "author": "ledger_kim",
      "date": "7월 22일",
      "categories": [
        "거래 조건",
        "계정 관리"
      ]
    },
    {
      "id": 19,
      "rating": 5,
      "text": "TETH 연결 후 첫 자동 주문이 체결되는 걸 보고 신기했어요. 로그가 그대로 남아서 안심됩니다.",
      "author": "auto_first",
      "date": "7월 19일",
      "categories": [
        "거래 기능",
        "플랫폼 사용성"
      ]
    },
    {
      "id": 20,
      "rating": 4,
      "text": "환승 이벤트로 넘어왔는데 자산 이전이 생각보다 수월했어요.",
      "author": "switcher",
      "date": "7월 16일",
      "categories": [
        "계정 관리"
      ]
    },
    {
      "id": 21,
      "rating": 1,
      "text": "점검 공지를 놓쳐서 전략이 몇 시간 멈춘 적이 있습니다. 알림 채널을 더 늘려주세요.",
      "author": "angry_bull",
      "date": "7월 13일",
      "categories": [
        "기술 안정성",
        "고객 지원"
      ]
    },
    {
      "id": 22,
      "rating": 5,
      "text": "호가창 반응 속도가 빨라서 스캘핑 전략도 밀리지 않아요.",
      "author": "tick_rider",
      "date": "7월 10일",
      "categories": [
        "거래 기능",
        "기술 안정성"
      ]
    }
  ],
  "upbit": [
    {
      "id": 0,
      "rating": 5,
      "text": "연결이 간단하고 체결이 빨라요. TETH에서 전략 돌리기엔 유동성이 제일 안정적이었어요.",
      "author": "minsu_k",
      "date": "9월 8일",
      "categories": [
        "플랫폼 사용성",
        "거래 기능"
      ]
    },
    {
      "id": 1,
      "rating": 4,
      "text": "수수료는 무난한데 알림이 조금 늦을 때가 있어요. 전반적으로는 만족합니다.",
      "author": "jae_trader",
      "date": "9월 5일",
      "categories": [
        "거래 조건",
        "고객 지원"
      ]
    },
    {
      "id": 2,
      "rating": 5,
      "text": "출금 권한 없이 연결된다는 게 제일 마음에 들어요. 권한 범위가 명확합니다.",
      "author": "sohee.lee",
      "date": "9월 2일",
      "categories": [
        "신뢰와 보안"
      ]
    },
    {
      "id": 3,
      "rating": 3,
      "text": "API 연동 자체는 쉬운데 처음에 권한 설정 찾는 게 헷갈렸어요. 가이드 보고 해결.",
      "author": "parkbull",
      "date": "8월 30일",
      "categories": [
        "계정 관리",
        "플랫폼 사용성"
      ]
    },
    {
      "id": 4,
      "rating": 5,
      "text": "업비트 유동성이 깊어서 슬리피지 걱정이 덜해요. 전략 체결 로그도 깔끔하게 맞습니다.",
      "author": "quant_dobby",
      "date": "8월 28일",
      "categories": [
        "거래 기능",
        "신뢰와 보안"
      ]
    },
    {
      "id": 5,
      "rating": 4,
      "text": "모바일에서도 연결 상태 확인이 편해요. 앱 전환 없이 TETH에서 다 보이는 게 좋네요.",
      "author": "yunaaa",
      "date": "8월 26일",
      "categories": [
        "모바일"
      ]
    },
    {
      "id": 6,
      "rating": 5,
      "text": "파트너 가입으로 이용료 없이 시작했어요. 절차가 2분 정도로 짧았습니다.",
      "author": "coin_daddy",
      "date": "8월 24일",
      "categories": [
        "거래 조건"
      ]
    },
    {
      "id": 7,
      "rating": 4,
      "text": "계정 인증이 하루 걸린 것 빼면 다 순조로웠어요.",
      "author": "h.jin",
      "date": "8월 21일",
      "categories": [
        "계정 관리"
      ]
    },
    {
      "id": 8,
      "rating": 5,
      "text": "전략 일시 정지하고 수동 거래했다가 다시 재개해도 상태가 안 꼬였어요. 안정적입니다.",
      "author": "slowrich",
      "date": "8월 19일",
      "categories": [
        "거래 기능",
        "신뢰와 보안"
      ]
    },
    {
      "id": 9,
      "rating": 3,
      "text": "점검 시간대에 주문이 밀린 적이 있어요. 공지는 미리 왔지만 아쉬움.",
      "author": "nightowl",
      "date": "8월 17일",
      "categories": [
        "기술 안정성"
      ]
    },
    {
      "id": 10,
      "rating": 4,
      "text": "차트는 다른 앱을 쓰지만 주문 체결은 여기로 몰았어요. 체결 속도 하나는 확실합니다.",
      "author": "trad2r",
      "date": "8월 14일",
      "categories": [
        "거래 기능"
      ]
    },
    {
      "id": 11,
      "rating": 5,
      "text": "고객센터 문의에 반나절 만에 답이 왔어요. 답변도 매뉴얼 복붙이 아니라서 놀랐습니다.",
      "author": "ella_j",
      "date": "8월 11일",
      "categories": [
        "고객 지원"
      ]
    },
    {
      "id": 12,
      "rating": 2,
      "text": "출금 검토가 이틀 걸린 적이 있어요. 보안 때문이라는데 미리 알려줬으면 좋았을 듯.",
      "author": "bear_hunter",
      "date": "8월 9일",
      "categories": [
        "계정 관리",
        "신뢰와 보안"
      ]
    },
    {
      "id": 13,
      "rating": 5,
      "text": "수수료 등급이 올라가니까 확실히 체감돼요. 거래량 있는 분들은 이득입니다.",
      "author": "fee_min",
      "date": "8월 6일",
      "categories": [
        "거래 조건"
      ]
    },
    {
      "id": 14,
      "rating": 4,
      "text": "앱 위젯으로 포지션 확인하는 게 편해요. 다만 다크 모드에서 일부 화면이 눈부십니다.",
      "author": "uxlover",
      "date": "8월 3일",
      "categories": [
        "모바일",
        "플랫폼 사용성"
      ]
    },
    {
      "id": 15,
      "rating": 5,
      "text": "서브계정 나눠서 전략별로 돌리는데 관리가 깔끔해요. 이렇게 쓰는 걸 추천합니다.",
      "author": "multi_bot",
      "date": "7월 31일",
      "categories": [
        "계정 관리",
        "거래 기능"
      ]
    },
    {
      "id": 16,
      "rating": 3,
      "text": "신규 상장 직후엔 호가가 얇아요. 메이저 위주로 쓰면 문제 없습니다.",
      "author": "depth_check",
      "date": "7월 28일",
      "categories": [
        "거래 조건"
      ]
    },
    {
      "id": 17,
      "rating": 5,
      "text": "2년 넘게 쓰면서 출금 사고 한 번도 없었어요. 신뢰가 제일 큰 장점입니다.",
      "author": "longtimer",
      "date": "7월 25일",
      "categories": [
        "신뢰와 보안"
      ]
    },
    {
      "id": 18,
      "rating": 4,
      "text": "수수료 정산 내역이 투명하게 나와요. 월말에 엑셀로 뽑아서 정리하기 좋습니다.",
      "author": "ledger_kim",
      "date": "7월 22일",
      "categories": [
        "거래 조건",
        "계정 관리"
      ]
    },
    {
      "id": 19,
      "rating": 5,
      "text": "TETH 연결 후 첫 자동 주문이 체결되는 걸 보고 신기했어요. 로그가 그대로 남아서 안심됩니다.",
      "author": "auto_first",
      "date": "7월 19일",
      "categories": [
        "거래 기능",
        "플랫폼 사용성"
      ]
    },
    {
      "id": 20,
      "rating": 4,
      "text": "환승 이벤트로 넘어왔는데 자산 이전이 생각보다 수월했어요.",
      "author": "switcher",
      "date": "7월 16일",
      "categories": [
        "계정 관리"
      ]
    },
    {
      "id": 21,
      "rating": 1,
      "text": "점검 공지를 놓쳐서 전략이 몇 시간 멈춘 적이 있습니다. 알림 채널을 더 늘려주세요.",
      "author": "angry_bull",
      "date": "7월 13일",
      "categories": [
        "기술 안정성",
        "고객 지원"
      ]
    },
    {
      "id": 22,
      "rating": 5,
      "text": "호가창 반응 속도가 빨라서 스캘핑 전략도 밀리지 않아요.",
      "author": "tick_rider",
      "date": "7월 10일",
      "categories": [
        "거래 기능",
        "기술 안정성"
      ]
    },
    {
      "id": 23,
      "rating": 4,
      "text": "입금 반영이 빠르고 원화 환산 표시가 정확해요. 초보자도 헷갈릴 게 없습니다.",
      "author": "krw_easy",
      "date": "7월 7일",
      "categories": [
        "플랫폼 사용성"
      ]
    },
    {
      "id": 24,
      "rating": 5,
      "text": "보안 설정 단계가 촘촘해요. OTP에 출금 화이트리스트까지 걸어두니 마음이 편합니다.",
      "author": "safe_first",
      "date": "7월 4일",
      "categories": [
        "신뢰와 보안"
      ]
    },
    {
      "id": 25,
      "rating": 3,
      "text": "수수료 이벤트 조건이 좀 복잡해요. 조건 읽다가 포기했습니다.",
      "author": "event_tired",
      "date": "7월 1일",
      "categories": [
        "거래 조건"
      ]
    },
    {
      "id": 26,
      "rating": 5,
      "text": "업비트 앱 안정성이 좋아졌어요. 작년에 있던 강제 종료 문제가 요즘은 없습니다.",
      "author": "app_watch",
      "date": "6월 27일",
      "categories": [
        "모바일",
        "기술 안정성"
      ]
    },
    {
      "id": 27,
      "rating": 4,
      "text": "API 문서가 깔끔해서 봇 붙이기 쉬웠어요. 예제 코드도 그대로 돌아갑니다.",
      "author": "dev_jun",
      "date": "6월 24일",
      "categories": [
        "플랫폼 사용성",
        "거래 기능"
      ]
    },
    {
      "id": 28,
      "rating": 5,
      "text": "대량 주문도 분할 체결이 매끄러워요. 큰 물량 굴리는 분들한테 추천합니다.",
      "author": "whale_jr",
      "date": "6월 21일",
      "categories": [
        "거래 기능"
      ]
    }
  ],
  "bybit": [
    {
      "id": 0,
      "rating": 5,
      "text": "연결이 간단하고 체결이 빨라요. TETH에서 전략 돌리기엔 유동성이 제일 안정적이었어요.",
      "author": "minsu_k",
      "date": "9월 8일",
      "categories": [
        "플랫폼 사용성",
        "거래 기능"
      ]
    },
    {
      "id": 1,
      "rating": 4,
      "text": "수수료는 무난한데 알림이 조금 늦을 때가 있어요. 전반적으로는 만족합니다.",
      "author": "jae_trader",
      "date": "9월 5일",
      "categories": [
        "거래 조건",
        "고객 지원"
      ]
    },
    {
      "id": 2,
      "rating": 5,
      "text": "출금 권한 없이 연결된다는 게 제일 마음에 들어요. 권한 범위가 명확합니다.",
      "author": "sohee.lee",
      "date": "9월 2일",
      "categories": [
        "신뢰와 보안"
      ]
    },
    {
      "id": 3,
      "rating": 3,
      "text": "API 연동 자체는 쉬운데 처음에 권한 설정 찾는 게 헷갈렸어요. 가이드 보고 해결.",
      "author": "parkbull",
      "date": "8월 30일",
      "categories": [
        "계정 관리",
        "플랫폼 사용성"
      ]
    },
    {
      "id": 4,
      "rating": 5,
      "text": "Bybit 유동성이 깊어서 슬리피지 걱정이 덜해요. 전략 체결 로그도 깔끔하게 맞습니다.",
      "author": "quant_dobby",
      "date": "8월 28일",
      "categories": [
        "거래 기능",
        "신뢰와 보안"
      ]
    },
    {
      "id": 5,
      "rating": 4,
      "text": "모바일에서도 연결 상태 확인이 편해요. 앱 전환 없이 TETH에서 다 보이는 게 좋네요.",
      "author": "yunaaa",
      "date": "8월 26일",
      "categories": [
        "모바일"
      ]
    },
    {
      "id": 6,
      "rating": 5,
      "text": "파트너 가입으로 이용료 없이 시작했어요. 절차가 2분 정도로 짧았습니다.",
      "author": "coin_daddy",
      "date": "8월 24일",
      "categories": [
        "거래 조건"
      ]
    },
    {
      "id": 7,
      "rating": 4,
      "text": "계정 인증이 하루 걸린 것 빼면 다 순조로웠어요.",
      "author": "h.jin",
      "date": "8월 21일",
      "categories": [
        "계정 관리"
      ]
    },
    {
      "id": 8,
      "rating": 5,
      "text": "전략 일시 정지하고 수동 거래했다가 다시 재개해도 상태가 안 꼬였어요. 안정적입니다.",
      "author": "slowrich",
      "date": "8월 19일",
      "categories": [
        "거래 기능",
        "신뢰와 보안"
      ]
    },
    {
      "id": 9,
      "rating": 3,
      "text": "점검 시간대에 주문이 밀린 적이 있어요. 공지는 미리 왔지만 아쉬움.",
      "author": "nightowl",
      "date": "8월 17일",
      "categories": [
        "기술 안정성"
      ]
    },
    {
      "id": 10,
      "rating": 4,
      "text": "차트는 다른 앱을 쓰지만 주문 체결은 여기로 몰았어요. 체결 속도 하나는 확실합니다.",
      "author": "trad2r",
      "date": "8월 14일",
      "categories": [
        "거래 기능"
      ]
    },
    {
      "id": 11,
      "rating": 5,
      "text": "고객센터 문의에 반나절 만에 답이 왔어요. 답변도 매뉴얼 복붙이 아니라서 놀랐습니다.",
      "author": "ella_j",
      "date": "8월 11일",
      "categories": [
        "고객 지원"
      ]
    },
    {
      "id": 12,
      "rating": 2,
      "text": "출금 검토가 이틀 걸린 적이 있어요. 보안 때문이라는데 미리 알려줬으면 좋았을 듯.",
      "author": "bear_hunter",
      "date": "8월 9일",
      "categories": [
        "계정 관리",
        "신뢰와 보안"
      ]
    },
    {
      "id": 13,
      "rating": 5,
      "text": "수수료 등급이 올라가니까 확실히 체감돼요. 거래량 있는 분들은 이득입니다.",
      "author": "fee_min",
      "date": "8월 6일",
      "categories": [
        "거래 조건"
      ]
    },
    {
      "id": 14,
      "rating": 4,
      "text": "앱 위젯으로 포지션 확인하는 게 편해요. 다만 다크 모드에서 일부 화면이 눈부십니다.",
      "author": "uxlover",
      "date": "8월 3일",
      "categories": [
        "모바일",
        "플랫폼 사용성"
      ]
    },
    {
      "id": 15,
      "rating": 5,
      "text": "서브계정 나눠서 전략별로 돌리는데 관리가 깔끔해요. 이렇게 쓰는 걸 추천합니다.",
      "author": "multi_bot",
      "date": "7월 31일",
      "categories": [
        "계정 관리",
        "거래 기능"
      ]
    },
    {
      "id": 16,
      "rating": 3,
      "text": "신규 상장 직후엔 호가가 얇아요. 메이저 위주로 쓰면 문제 없습니다.",
      "author": "depth_check",
      "date": "7월 28일",
      "categories": [
        "거래 조건"
      ]
    },
    {
      "id": 17,
      "rating": 5,
      "text": "2년 넘게 쓰면서 출금 사고 한 번도 없었어요. 신뢰가 제일 큰 장점입니다.",
      "author": "longtimer",
      "date": "7월 25일",
      "categories": [
        "신뢰와 보안"
      ]
    }
  ],
  "kiwoom": [
    {
      "id": 0,
      "rating": 5,
      "text": "연결이 간단하고 체결이 빨라요. TETH에서 전략 돌리기엔 유동성이 제일 안정적이었어요.",
      "author": "minsu_k",
      "date": "9월 8일",
      "categories": [
        "플랫폼 사용성",
        "거래 기능"
      ]
    },
    {
      "id": 1,
      "rating": 4,
      "text": "수수료는 무난한데 알림이 조금 늦을 때가 있어요. 전반적으로는 만족합니다.",
      "author": "jae_trader",
      "date": "9월 5일",
      "categories": [
        "거래 조건",
        "고객 지원"
      ]
    },
    {
      "id": 2,
      "rating": 5,
      "text": "출금 권한 없이 연결된다는 게 제일 마음에 들어요. 권한 범위가 명확합니다.",
      "author": "sohee.lee",
      "date": "9월 2일",
      "categories": [
        "신뢰와 보안"
      ]
    },
    {
      "id": 3,
      "rating": 3,
      "text": "API 연동 자체는 쉬운데 처음에 권한 설정 찾는 게 헷갈렸어요. 가이드 보고 해결.",
      "author": "parkbull",
      "date": "8월 30일",
      "categories": [
        "계정 관리",
        "플랫폼 사용성"
      ]
    },
    {
      "id": 4,
      "rating": 5,
      "text": "키움증권 유동성이 깊어서 슬리피지 걱정이 덜해요. 전략 체결 로그도 깔끔하게 맞습니다.",
      "author": "quant_dobby",
      "date": "8월 28일",
      "categories": [
        "거래 기능",
        "신뢰와 보안"
      ]
    },
    {
      "id": 5,
      "rating": 4,
      "text": "모바일에서도 연결 상태 확인이 편해요. 앱 전환 없이 TETH에서 다 보이는 게 좋네요.",
      "author": "yunaaa",
      "date": "8월 26일",
      "categories": [
        "모바일"
      ]
    },
    {
      "id": 6,
      "rating": 5,
      "text": "파트너 가입으로 이용료 없이 시작했어요. 절차가 2분 정도로 짧았습니다.",
      "author": "coin_daddy",
      "date": "8월 24일",
      "categories": [
        "거래 조건"
      ]
    },
    {
      "id": 7,
      "rating": 4,
      "text": "계정 인증이 하루 걸린 것 빼면 다 순조로웠어요.",
      "author": "h.jin",
      "date": "8월 21일",
      "categories": [
        "계정 관리"
      ]
    },
    {
      "id": 8,
      "rating": 5,
      "text": "전략 일시 정지하고 수동 거래했다가 다시 재개해도 상태가 안 꼬였어요. 안정적입니다.",
      "author": "slowrich",
      "date": "8월 19일",
      "categories": [
        "거래 기능",
        "신뢰와 보안"
      ]
    },
    {
      "id": 9,
      "rating": 3,
      "text": "점검 시간대에 주문이 밀린 적이 있어요. 공지는 미리 왔지만 아쉬움.",
      "author": "nightowl",
      "date": "8월 17일",
      "categories": [
        "기술 안정성"
      ]
    },
    {
      "id": 10,
      "rating": 4,
      "text": "차트는 다른 앱을 쓰지만 주문 체결은 여기로 몰았어요. 체결 속도 하나는 확실합니다.",
      "author": "trad2r",
      "date": "8월 14일",
      "categories": [
        "거래 기능"
      ]
    },
    {
      "id": 11,
      "rating": 5,
      "text": "고객센터 문의에 반나절 만에 답이 왔어요. 답변도 매뉴얼 복붙이 아니라서 놀랐습니다.",
      "author": "ella_j",
      "date": "8월 11일",
      "categories": [
        "고객 지원"
      ]
    }
  ]
}
export const brokerReviews=(broker:ClientBroker):BrokerReview[]=>REVIEW_POOL[broker.id]??[]
export const BROKER_CATEGORIES=['전체','거래 조건','플랫폼 사용성','고객 지원','거래 기능','계정 관리','신뢰와 보안','기술 안정성','모바일'] as const
export const BROKER_FILTERS=[['all','전체'],['ex','거래소'],['stock','증권사'],['broker','브로커'],['conn','연결 지원'],['soon','지원 예정']] as const
export type BrokerFilter=typeof BROKER_FILTERS[number][0]
/** Sort/display only. Missing statistics use zero only as a sort key; the
 * fixture keeps them absent and never creates reviews for an unknown count. */
export function filterBrokers(filter:BrokerFilter,sort:string){
  return CLIENT_BROKERS.filter(b=>filter==='conn'?b.conn:filter==='soon'?!b.conn:filter==='ex'?b.tag==='거래소':filter==='stock'?b.tag==='증권사':filter==='broker'?b.tag==='브로커':true).sort((a,b)=>
    sort==='reviews'?(b.rvN??0)-(a.rvN??0)||(b.rating??0)-(a.rating??0)
    :sort==='users'?(b.traderN??0)-(a.traderN??0)||(b.rating??0)-(a.rating??0)
    :sort==='rating'?(b.rating??0)-(a.rating??0)||(b.rvN??0)-(a.rvN??0)
    :a.ord-b.ord)
}
