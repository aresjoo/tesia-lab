// Client visual/copy source: aresjoo/tesia-lab 02cebe3. No trading or entitlement authority.
import type { ClientLanguage } from './client-preferences'
import { localizedTemplateText } from './client-template-copy'
import { homeTemplateLabel } from './client-shell-copy'
export interface HomeTemplateSelection { acts: string[]; assets: string[] }
export interface HomeTemplateAction {
  id: string; lb: string; brand?: number
  q0: string; q: string; frag: string; frag0: string; more: string
}
export interface HomeTemplateAsset { id: string; lb: string; img: string; bg: string; inv?: number }
export const HOME_TEMPLATE_MAX = 10
export const CLIENT_HOME_ACTIONS: readonly HomeTemplateAction[] = [
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
]
export const CLIENT_HOME_ASSETS: readonly HomeTemplateAsset[] = [
  {
    "id": "spx",
    "lb": "S&P 500",
    "img": "/client-template-assets/spx.svg",
    "bg": "#12141a"
  },
  {
    "id": "ndx",
    "lb": "NASDAQ 100",
    "img": "/client-template-assets/ndx.svg",
    "bg": "#0a1522",
    "inv": 1
  },
  {
    "id": "btc",
    "lb": "BTC",
    "img": "/client-template-assets/btc.svg",
    "bg": "#16100a"
  },
  {
    "id": "eth",
    "lb": "ETH",
    "img": "/client-template-assets/eth.svg",
    "bg": "#12131f",
    "inv": 1
  },
  {
    "id": "sec",
    "lb": "삼성전자",
    "img": "/client-template-assets/sec.svg",
    "bg": "#0c1630",
    "inv": 1
  },
  {
    "id": "hyx",
    "lb": "SK하이닉스",
    "img": "/client-template-assets/hyx.svg",
    "bg": "#1c0f0a",
    "inv": 1
  },
  {
    "id": "tsla",
    "lb": "TSLA",
    "img": "/client-template-assets/tsla.svg",
    "bg": "#150a0c"
  },
  {
    "id": "spcx",
    "lb": "SPACEX",
    "img": "/client-template-assets/spcx.svg",
    "bg": "#0b0f16",
    "inv": 1
  },
  {
    "id": "nvda",
    "lb": "NVDA",
    "img": "/client-template-assets/nvda.svg",
    "bg": "#0d130c",
    "inv": 1
  },
  {
    "id": "aapl",
    "lb": "AAPL",
    "img": "/client-template-assets/aapl.svg",
    "bg": "#101216",
    "inv": 1
  },
  {
    "id": "msft",
    "lb": "MSFT",
    "img": "/client-template-assets/msft.svg",
    "bg": "#0e1420"
  },
  {
    "id": "googl",
    "lb": "GOOGL",
    "img": "/client-template-assets/googl.svg",
    "bg": "#101216"
  },
  {
    "id": "amzn",
    "lb": "AMZN",
    "img": "/client-template-assets/amzn.svg",
    "bg": "#10120f",
    "inv": 1
  },
  {
    "id": "meta",
    "lb": "META",
    "img": "/client-template-assets/meta.svg",
    "bg": "#0a1220",
    "inv": 1
  },
  {
    "id": "avgo",
    "lb": "AVGO",
    "img": "/client-template-assets/avgo.svg",
    "bg": "#170b0b",
    "inv": 1
  },
  {
    "id": "tsm",
    "lb": "TSM",
    "img": "/client-template-assets/tsm.svg",
    "bg": "#0d1118"
  },
  {
    "id": "brk",
    "lb": "BRK.B",
    "img": "/client-template-assets/brk.svg",
    "bg": "#12100c",
    "inv": 1
  },
  {
    "id": "lly",
    "lb": "LLY",
    "img": "/client-template-assets/lly.svg",
    "bg": "#160a0c"
  },
  {
    "id": "wmt",
    "lb": "WMT",
    "img": "/client-template-assets/wmt.svg",
    "bg": "#0d1526"
  },
  {
    "id": "jpm",
    "lb": "JPM",
    "img": "/client-template-assets/jpm.svg",
    "bg": "#12100e",
    "inv": 1
  },
  {
    "id": "visa",
    "lb": "VISA",
    "img": "/client-template-assets/visa.svg",
    "bg": "#0c1226"
  },
  {
    "id": "ma",
    "lb": "마스터카드",
    "img": "/client-template-assets/ma.svg",
    "bg": "#140e0a"
  },
  {
    "id": "nflx",
    "lb": "NFLX",
    "img": "/client-template-assets/nflx.svg",
    "bg": "#140a0a"
  },
  {
    "id": "xom",
    "lb": "XOM",
    "img": "/client-template-assets/xom.svg",
    "bg": "#150b0b"
  },
  {
    "id": "orcl",
    "lb": "ORCL",
    "img": "/client-template-assets/orcl.svg",
    "bg": "#150b0b"
  },
  {
    "id": "cost",
    "lb": "COST",
    "img": "/client-template-assets/cost.svg",
    "bg": "#101425"
  },
  {
    "id": "pg",
    "lb": "P&G",
    "img": "/client-template-assets/pg.svg",
    "bg": "#0c1322"
  },
  {
    "id": "aramco",
    "lb": "아람코",
    "img": "/client-template-assets/aramco.png",
    "bg": "#0b1512",
    "inv": 1
  },
  {
    "id": "sap",
    "lb": "SAP",
    "img": "/client-template-assets/sap.svg",
    "bg": "#0a1322"
  },
  {
    "id": "asml",
    "lb": "ASML",
    "img": "/client-template-assets/asml.svg",
    "bg": "#0d1118"
  },
  {
    "id": "bac",
    "lb": "BAC",
    "img": "/client-template-assets/bac.svg",
    "bg": "#141019",
    "inv": 1
  },
  {
    "id": "hd",
    "lb": "홈디포",
    "img": "/client-template-assets/hd.svg",
    "bg": "#170e07"
  },
  {
    "id": "cola",
    "lb": "코카콜라",
    "img": "/client-template-assets/cola.svg",
    "bg": "#160909",
    "inv": 1
  },
  {
    "id": "mcd",
    "lb": "MCD",
    "img": "/client-template-assets/mcd.svg",
    "bg": "#141006"
  },
  {
    "id": "tm",
    "lb": "토요타",
    "img": "/client-template-assets/tm.svg",
    "bg": "#131013"
  },
  {
    "id": "amd",
    "lb": "AMD",
    "img": "/client-template-assets/amd.svg",
    "bg": "#101214",
    "inv": 1
  },
  {
    "id": "intc",
    "lb": "INTC",
    "img": "/client-template-assets/intc.svg",
    "bg": "#0a1420"
  },
  {
    "id": "crm",
    "lb": "CRM",
    "img": "/client-template-assets/crm.svg",
    "bg": "#081420"
  },
  {
    "id": "pltr",
    "lb": "PLTR",
    "img": "/client-template-assets/pltr.svg",
    "bg": "#101216",
    "inv": 1
  },
  {
    "id": "tcehy",
    "lb": "텐센트",
    "img": "/client-template-assets/tcehy.svg",
    "bg": "#0a1424"
  },
  {
    "id": "baba",
    "lb": "알리바바",
    "img": "/client-template-assets/baba.svg",
    "bg": "#170f08"
  },
  {
    "id": "lvmh",
    "lb": "LVMH",
    "img": "/client-template-assets/lvmh.svg",
    "bg": "#121014",
    "inv": 1
  },
  {
    "id": "hmc",
    "lb": "현대차",
    "img": "/client-template-assets/hmc.svg",
    "bg": "#0c1424",
    "inv": 1
  },
  {
    "id": "nvr",
    "lb": "NAVER",
    "img": "/client-template-assets/nvr.svg",
    "bg": "#0a140c"
  },
  {
    "id": "kko",
    "lb": "카카오",
    "img": "/client-template-assets/kko.svg",
    "bg": "#141006"
  },
  {
    "id": "xrp",
    "lb": "XRP",
    "img": "/client-template-assets/xrp.svg",
    "bg": "#101216",
    "inv": 1
  },
  {
    "id": "sol",
    "lb": "SOL",
    "img": "/client-template-assets/sol.svg",
    "bg": "#0d0a16"
  },
  {
    "id": "bnb",
    "lb": "BNB",
    "img": "/client-template-assets/bnb.svg",
    "bg": "#141006"
  },
  {
    "id": "doge",
    "lb": "DOGE",
    "img": "/client-template-assets/doge.png",
    "bg": "#141006"
  },
  {
    "id": "ada",
    "lb": "ADA",
    "img": "/client-template-assets/ada.svg",
    "bg": "#0a1220",
    "inv": 1
  }
]
export const CLIENT_HOME_HEADLINES: Readonly<Record<string, readonly string[]>> = {
  "en": [
    "How should we read\ntonight's market?",
    "You don't need to\nread charts",
    "The market is hard\nto beat alone",
    "The market\nwon't wait",
    "News is late,\nmarkets are fast",
    "Should I buy now?\nJust ask",
    "Samsung vs SK hynix,\nwhich one?",
    "Stocks, crypto, gold,\nask anything about markets",
    "Why did Tesla drop?\nJust ask",
    "Conquer the market\nwith TETH"
  ],
  "ja": [
    "今夜の相場、\nどう見ますか？",
    "チャートが読めなくても\n大丈夫です",
    "相場はひとりで\n勝つのが難しい",
    "今買ってもいい？\n聞いてみてください",
    "ニュースは遅く、\n相場は速い",
    "TETHと一緒に\n相場を制覇しましょう"
  ],
  "zh-CN": [
    "今晚的行情，\n该怎么看？",
    "不会看K线\n也没关系",
    "市场很难\n独自战胜",
    "现在能买吗？\n问问就知道",
    "新闻太慢，\n市场太快",
    "与TETH一起\n征服市场"
  ],
  "zh-TW": [
    "今晚的行情，\n該怎麼看？",
    "不會看K線\n也沒關係",
    "市場很難\n獨自戰勝",
    "現在能買嗎？\n問問就知道",
    "新聞太慢，\n市場太快",
    "與TETH一起\n征服市場"
  ],
  "es": [
    "¿Cómo leemos el\nmercado esta noche?",
    "No necesitas saber\nleer gráficos",
    "El mercado es difícil\nde vencer en solitario",
    "¿Compro ahora?\nSolo pregunta",
    "Las noticias llegan tarde,\nel mercado no espera",
    "Conquista el mercado\ncon TETH"
  ],
  "fr": [
    "Comment lire le\nmarché ce soir ?",
    "Pas besoin de savoir\nlire les graphiques",
    "Le marché est dur\nà battre seul",
    "Acheter maintenant ?\nDemandez-nous",
    "Les nouvelles sont lentes,\nle marché est rapide",
    "Conquérez le marché\navec TETH"
  ],
  "ko": [
    "차트 볼 줄\n몰라도 됩니다",
    "차트 대신\n말로 하십시오",
    "투자 아이디어만\n있으면 됩니다",
    "당신의 생각을\n투자 전략으로",
    "투자도 그냥\n말하면 됩니다",
    "시장은 혼자\n이기기 어렵습니다"
  ]
}
export const CLIENT_HOME_SUBCOPY: Readonly<Record<string, string>> = {
  "ko": "템플릿을 사용해 보거나 채팅으로 투자를 설명하십시오.\nTETH 모델로 만듭니다.",
  "en": "Try a template or describe your investing idea in chat.\nThe TETH model will build it.",
  "ja": "テンプレートを試すか、チャットで投資を説明してください。\nTETHモデルが作ります。",
  "zh-CN": "试试模板，或在聊天中描述你的投资。\n由TETH模型来构建。",
  "zh-TW": "試試模板，或在聊天中描述你的投資。\n由TETH模型來構建。",
  "es": "Prueba una plantilla o describe tu inversión en el chat.\nEl modelo TETH la construye.",
  "fr": "Essayez un modèle ou décrivez votre investissement dans le chat.\nLe modèle TETH s'en charge."
}

export function normalizeTemplateSelection(selection: HomeTemplateSelection): HomeTemplateSelection {
  const acts = [...new Set(selection.acts)].filter(id => CLIENT_HOME_ACTIONS.some(item => item.id === id))
  const assets = [...new Set(selection.assets)].filter(id => CLIENT_HOME_ASSETS.some(item => item.id === id))
  return { acts: acts.slice(0, HOME_TEMPLATE_MAX), assets: assets.slice(0, HOME_TEMPLATE_MAX - acts.length) }
}

export function toggleTemplateSelection(selection: HomeTemplateSelection, kind: keyof HomeTemplateSelection, id: string): HomeTemplateSelection {
  const next = normalizeTemplateSelection(selection)
  const valid = (kind === 'acts' ? CLIENT_HOME_ACTIONS : CLIENT_HOME_ASSETS).some(item => item.id === id)
  if (!valid) return next
  if (next[kind].includes(id)) return { ...next, [kind]: next[kind].filter(value => value !== id) }
  if (next.acts.length + next.assets.length >= HOME_TEMPLATE_MAX) return next
  return { ...next, [kind]: [...next[kind], id] }
}

function hasFinalConsonant(word: string): boolean {
  const c = word.charCodeAt(word.length - 1)
  return c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 !== 0
}

export function getTemplateText(selection: HomeTemplateSelection, language: ClientLanguage = 'ko'): { q: string; cmd: string } | null {
  const normalized = normalizeTemplateSelection(selection)
  const acts = normalized.acts.map(id => CLIENT_HOME_ACTIONS.find(item => item.id === id)!)
  const assets = normalized.assets.map(id => CLIENT_HOME_ASSETS.find(item => item.id === id)!)
  if (!acts.length && !assets.length) return null
  const labels = assets.map(item => item.lb)
  if (language !== 'ko') return localizedTemplateText(language, acts.map(item => item.id), assets.map(item => homeTemplateLabel(language, item.id, item.lb)))
  const asset = labels.length > 1 ? labels.slice(0, -1).join(', ') + (hasFinalConsonant(labels[labels.length - 2]) ? '과' : '와') + ' ' + labels[labels.length - 1] : (labels[0] ?? '')
  const fill = (text: string) => text.replace('{A}{obj}', asset ? asset + (hasFinalConsonant(asset) ? '을' : '를') : '').replace('{A}', asset)
  const end = (stem: string) => stem.endsWith('주') ? stem.slice(0, -1) + '줘' : stem + '어줘'
  if (!acts.length) return {
    q: labels.length === 1 ? asset + '에 대해 무엇이 궁금하십니까?' : asset + ', 무엇이 궁금하십니까?',
    cmd: labels.length === 1 ? asset + ' 지금 어떤 상황인지 분석해줘' : asset + ' 지금 상황을 비교 분석해줘',
  }
  if (acts.length === 1) return { q: asset ? fill(acts[0].q) : acts[0].q0, cmd: end(asset ? fill(acts[0].frag) : acts[0].frag0) }
  const actionLabels = acts.map(item => item.lb).join(', ')
  const stems = [asset ? fill(acts[0].frag) : acts[0].frag0, ...acts.slice(1).map(item => item.more)]
  return {
    q: asset ? asset + '로 ' + actionLabels + '까지 한 번에 해드리면 되겠습니까?' : actionLabels + ', 어떤 종목으로 해보겠습니까?',
    cmd: stems.slice(0, -1).map(stem => stem + '고').join(', ') + ', ' + end(stems[stems.length - 1]),
  }
}

export function composeTemplatePrompt(selection: HomeTemplateSelection, input = '', language: ClientLanguage = 'ko'): string {
  const text = input.trim()
  const template = getTemplateText(selection, language)
  return template ? (text ? template.cmd + '. ' + text : template.cmd) : text
}
