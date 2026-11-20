/* 생성 파일: tools/extract-from-html.mjs 가 원본 index.html 에서 그대로 꺼낸다. 손으로 고치지 않는다. */
export type TplAct = { id: string; lb: string; brand?: number; q0: string; q: string; frag: string; frag0: string; more: string; bdg?: string };
export type TplAsset = { id: string; lb: string; img: string; bg: string; inv?: number; bdg?: string };
export const TF_TPL_ACTS: TplAct[] = [
 {
  "id": "auto",
  "lb": "AI가 대신 거래",
  "brand": 1,
  "q0": "AI가 어떤 종목을 대신 거래해 드리면 되겠습니까?",
  "q": "AI가 어떻게 {A} 거래를 해드리면 되겠습니까?",
  "frag": "{A} 거래를 AI에게 맡기는 전략을 만들",
  "frag0": "AI가 대신 거래하는 전략을 만들",
  "more": "AI 위임 거래 전략도 만들"
 },
 {
  "id": "ind",
  "lb": "지표 생성 후, 거래",
  "q0": "어떤 종목에 쓸 지표를 만들어 보겠습니까?",
  "q": "{A}에 어떤 지표를 만들어 거래해 보겠습니까?",
  "frag": "{A}에 맞는 지표를 만들어 그 신호로 거래하는 전략을 만들",
  "frag0": "나만의 지표를 만들어 그 신호로 거래하는 전략을 만들",
  "more": "전용 지표 기반 전략도 만들"
 },
 {
  "id": "rank",
  "lb": "전략 랭킹",
  "q0": "어떤 종목의 전략 랭킹이 궁금하십니까?",
  "q": "{A} 전략 랭킹을 보여드리면 되겠습니까?",
  "frag": "{A} 인기 전략 랭킹을 보여주",
  "frag0": "요즘 인기 전략 랭킹을 보여주",
  "more": "인기 전략 랭킹도 보여주"
 },
 {
  "id": "anal",
  "lb": "시장/종목 분석",
  "q0": "어떤 시장이나 종목을 분석해 드리면 되겠습니까?",
  "q": "{A}{obj} 어떻게 분석해 드리면 되겠습니까?",
  "frag": "{A} 시장 상태를 분석해주",
  "frag0": "지금 시장 전반을 분석해주",
  "more": "시장 상태 분석도 해주"
 },
 {
  "id": "port",
  "lb": "포트폴리오 분석",
  "q0": "포트폴리오를 어떻게 나눠 보겠습니까?",
  "q": "포트폴리오에서 {A}{obj} 어떻게 가져가겠습니까?",
  "frag": "{A} 중심의 포트폴리오 구성을 분석해주",
  "frag0": "포트폴리오 구성을 분석해주",
  "more": "포트폴리오 구성 분석도 해주"
 }
];
export const TF_TPL_ASSETS: TplAsset[] = [
 {
  "id": "spx",
  "lb": "S&P 500",
  "img": "assets/logos/spx.svg",
  "bg": "#12141a"
 },
 {
  "id": "ndx",
  "lb": "NASDAQ 100",
  "img": "assets/logos/ndx.svg",
  "bg": "#0a1522",
  "inv": 1
 },
 {
  "id": "btc",
  "lb": "BTC",
  "img": "assets/logos/btc.svg",
  "bg": "#16100a"
 },
 {
  "id": "eth",
  "lb": "ETH",
  "img": "assets/logos/eth.svg",
  "bg": "#12131f",
  "inv": 1
 },
 {
  "id": "sec",
  "lb": "삼성전자",
  "img": "assets/logos/sec.svg",
  "bg": "#0c1630",
  "inv": 1
 },
 {
  "id": "hyx",
  "lb": "SK하이닉스",
  "img": "assets/logos/hyx.svg",
  "bg": "#1c0f0a",
  "inv": 1
 },
 {
  "id": "tsla",
  "lb": "TSLA",
  "img": "assets/logos/tsla.svg",
  "bg": "#150a0c"
 },
 {
  "id": "spcx",
  "lb": "SPACEX",
  "img": "assets/logos/spcx.svg",
  "bg": "#0b0f16",
  "inv": 1
 },
 {
  "id": "nvda",
  "lb": "NVDA",
  "img": "assets/logos/nvda.svg",
  "bg": "#0d130c",
  "inv": 1
 },
 {
  "id": "aapl",
  "lb": "AAPL",
  "img": "assets/logos/aapl.svg",
  "bg": "#101216",
  "inv": 1
 },
 {
  "id": "msft",
  "lb": "MSFT",
  "img": "assets/logos/msft.svg",
  "bg": "#0e1420"
 },
 {
  "id": "googl",
  "lb": "GOOGL",
  "img": "assets/logos/googl.svg",
  "bg": "#101216"
 },
 {
  "id": "amzn",
  "lb": "AMZN",
  "img": "assets/logos/amzn.svg",
  "bg": "#10120f",
  "inv": 1
 },
 {
  "id": "meta",
  "lb": "META",
  "img": "assets/logos/meta.svg",
  "bg": "#0a1220",
  "inv": 1
 },
 {
  "id": "avgo",
  "lb": "AVGO",
  "img": "assets/logos/avgo.svg",
  "bg": "#170b0b",
  "inv": 1
 },
 {
  "id": "tsm",
  "lb": "TSM",
  "img": "assets/logos/tsm.svg",
  "bg": "#0d1118"
 },
 {
  "id": "brk",
  "lb": "BRK.B",
  "img": "assets/logos/brk.svg",
  "bg": "#12100c",
  "inv": 1
 },
 {
  "id": "lly",
  "lb": "LLY",
  "img": "assets/logos/lly.svg",
  "bg": "#160a0c"
 },
 {
  "id": "wmt",
  "lb": "WMT",
  "img": "assets/logos/wmt.svg",
  "bg": "#0d1526"
 },
 {
  "id": "jpm",
  "lb": "JPM",
  "img": "assets/logos/jpm.svg",
  "bg": "#12100e",
  "inv": 1
 },
 {
  "id": "visa",
  "lb": "VISA",
  "img": "assets/logos/visa.svg",
  "bg": "#0c1226"
 },
 {
  "id": "ma",
  "lb": "마스터카드",
  "img": "assets/logos/ma.svg",
  "bg": "#140e0a"
 },
 {
  "id": "nflx",
  "lb": "NFLX",
  "img": "assets/logos/nflx.svg",
  "bg": "#140a0a"
 },
 {
  "id": "xom",
  "lb": "XOM",
  "img": "assets/logos/xom.svg",
  "bg": "#150b0b"
 },
 {
  "id": "orcl",
  "lb": "ORCL",
  "img": "assets/logos/orcl.svg",
  "bg": "#150b0b"
 },
 {
  "id": "cost",
  "lb": "COST",
  "img": "assets/logos/cost.svg",
  "bg": "#101425"
 },
 {
  "id": "pg",
  "lb": "P&G",
  "img": "assets/logos/pg.svg",
  "bg": "#0c1322"
 },
 {
  "id": "aramco",
  "lb": "아람코",
  "img": "assets/logos/aramco.png",
  "bg": "#0b1512",
  "inv": 1
 },
 {
  "id": "sap",
  "lb": "SAP",
  "img": "assets/logos/sap.svg",
  "bg": "#0a1322"
 },
 {
  "id": "asml",
  "lb": "ASML",
  "img": "assets/logos/asml.svg",
  "bg": "#0d1118"
 },
 {
  "id": "bac",
  "lb": "BAC",
  "img": "assets/logos/bac.svg",
  "bg": "#141019",
  "inv": 1
 },
 {
  "id": "hd",
  "lb": "홈디포",
  "img": "assets/logos/hd.svg",
  "bg": "#170e07"
 },
 {
  "id": "cola",
  "lb": "코카콜라",
  "img": "assets/logos/cola.svg",
  "bg": "#160909",
  "inv": 1
 },
 {
  "id": "mcd",
  "lb": "MCD",
  "img": "assets/logos/mcd.svg",
  "bg": "#141006"
 },
 {
  "id": "tm",
  "lb": "토요타",
  "img": "assets/logos/tm.svg",
  "bg": "#131013"
 },
 {
  "id": "amd",
  "lb": "AMD",
  "img": "assets/logos/amd.svg",
  "bg": "#101214",
  "inv": 1
 },
 {
  "id": "intc",
  "lb": "INTC",
  "img": "assets/logos/intc.svg",
  "bg": "#0a1420"
 },
 {
  "id": "crm",
  "lb": "CRM",
  "img": "assets/logos/crm.svg",
  "bg": "#081420"
 },
 {
  "id": "pltr",
  "lb": "PLTR",
  "img": "assets/logos/pltr.svg",
  "bg": "#101216",
  "inv": 1
 },
 {
  "id": "tcehy",
  "lb": "텐센트",
  "img": "assets/logos/tcehy.svg",
  "bg": "#0a1424"
 },
 {
  "id": "baba",
  "lb": "알리바바",
  "img": "assets/logos/baba.svg",
  "bg": "#170f08"
 },
 {
  "id": "lvmh",
  "lb": "LVMH",
  "img": "assets/logos/lvmh.svg",
  "bg": "#121014",
  "inv": 1
 },
 {
  "id": "hmc",
  "lb": "현대차",
  "img": "assets/logos/hmc.svg",
  "bg": "#0c1424",
  "inv": 1
 },
 {
  "id": "nvr",
  "lb": "NAVER",
  "img": "assets/logos/nvr.svg",
  "bg": "#0a140c"
 },
 {
  "id": "kko",
  "lb": "카카오",
  "img": "assets/logos/kko.svg",
  "bg": "#141006"
 },
 {
  "id": "xrp",
  "lb": "XRP",
  "img": "assets/logos/xrp.svg",
  "bg": "#101216",
  "inv": 1
 },
 {
  "id": "sol",
  "lb": "SOL",
  "img": "assets/logos/sol.svg",
  "bg": "#0d0a16"
 },
 {
  "id": "bnb",
  "lb": "BNB",
  "img": "assets/logos/bnb.svg",
  "bg": "#141006"
 },
 {
  "id": "doge",
  "lb": "DOGE",
  "img": "assets/logos/doge.png",
  "bg": "#141006"
 },
 {
  "id": "ada",
  "lb": "ADA",
  "img": "assets/logos/ada.svg",
  "bg": "#0a1220",
  "inv": 1
 }
];
