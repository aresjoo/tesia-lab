import type { ClientLanguage } from './client-preferences'

// Korean labels from tesia-lab 9fbff821 sk-ins.js. Display only: never replace
// a publisher's tag key, filter operand, article metadata, or route slug.
const columns = { ko: 0, en: 1, ja: 2, 'zh-CN': 3, 'zh-TW': 4, es: 5, fr: 6 } as const
type Translations = readonly [string, string, string, string, string, string, string]
export const INSIGHT_TAG_LABELS = {
  bitcoin: ['비트코인', 'Bitcoin', 'ビットコイン', '比特币', '比特幣', 'Bitcoin', 'Bitcoin'],
  ethereum: ['이더리움', 'Ethereum', 'イーサリアム', '以太坊', '以太坊', 'Ethereum', 'Ethereum'],
  crypto: ['암호화폐', 'Crypto', '暗号資産', '加密货币', '加密貨幣', 'Criptomonedas', 'Cryptomonnaies'],
  'on-chain': ['온체인', 'On-chain', 'オンチェーン', '链上', '鏈上', 'En cadena', 'On-chain'],
  liquidity: ['유동성', 'Liquidity', '流動性', '流动性', '流動性', 'Liquidez', 'Liquidité'],
  macro: ['매크로', 'Macro', 'マクロ', '宏观', '總體經濟', 'Macroeconomía', 'Macroéconomie'],
  fees: ['수수료', 'Fees', '手数料', '手续费', '手續費', 'Comisiones', 'Frais'],
  earnings: ['실적', 'Earnings', '決算', '业绩', '業績', 'Resultados', 'Résultats'],
  nasdaq: ['나스닥', 'Nasdaq', 'ナスダック', '纳斯达克', '納斯達克', 'Nasdaq', 'Nasdaq'],
  derivatives: ['파생', 'Derivatives', 'デリバティブ', '衍生品', '衍生品', 'Derivados', 'Produits dérivés'],
  dollar: ['달러', 'Dollar', 'ドル', '美元', '美元', 'Dólar', 'Dollar'],
  risk: ['위험 관리', 'Risk management', 'リスク管理', '风险管理', '風險管理', 'Gestión de riesgos', 'Gestion des risques'],
  rates: ['금리', 'Interest rates', '金利', '利率', '利率', 'Tipos de interés', 'Taux d’intérêt'],
  bonds: ['채권', 'Bonds', '債券', '债券', '債券', 'Bonos', 'Obligations'],
  bond: ['채권', 'Bonds', '債券', '债券', '債券', 'Bonos', 'Obligations'],
  dominance: ['도미넌스', 'Dominance', 'ドミナンス', '市占率', '市占率', 'Dominancia', 'Dominance'],
  jpy: ['엔화', 'Yen', '円', '日元', '日圓', 'Yen', 'Yen'],
  usdt: ['USDT', 'USDT', 'USDT', 'USDT', 'USDT', 'USDT', 'USDT'],
  usdc: ['USDC', 'USDC', 'USDC', 'USDC', 'USDC', 'USDC', 'USDC'],
  ai: ['AI', 'AI', 'AI', 'AI', 'AI', 'IA', 'IA'],
  semiconductor: ['반도체', 'Semiconductors', '半導体', '半导体', '半導體', 'Semiconductores', 'Semi-conducteurs'],
  nvidia: ['엔비디아', 'NVIDIA', 'エヌビディア', '英伟达', '輝達', 'NVIDIA', 'NVIDIA'],
  energy: ['에너지', 'Energy', 'エネルギー', '能源', '能源', 'Energía', 'Énergie'],
  cloud: ['클라우드', 'Cloud', 'クラウド', '云计算', '雲端', 'Nube', 'Cloud'],
  'data-center': ['데이터센터', 'Data centers', 'データセンター', '数据中心', '資料中心', 'Centros de datos', 'Centres de données'],
  infrastructure: ['인프라', 'Infrastructure', 'インフラ', '基础设施', '基礎建設', 'Infraestructura', 'Infrastructure'],
  staking: ['스테이킹', 'Staking', 'ステーキング', '质押', '質押', 'Staking', 'Staking'],
  'layer-2': ['레이어2', 'Layer 2', 'レイヤー2', '二层网络', '二層網路', 'Capa 2', 'Couche 2'],
  mining: ['채굴', 'Mining', 'マイニング', '挖矿', '挖礦', 'Minería', 'Minage'],
  options: ['옵션', 'Options', 'オプション', '期权', '選擇權', 'Opciones', 'Options'],
  volatility: ['변동성', 'Volatility', 'ボラティリティ', '波动性', '波動性', 'Volatilidad', 'Volatilité'],
  gold: ['금', 'Gold', '金', '黄金', '黃金', 'Oro', 'Or'],
  oil: ['원유', 'Oil', '原油', '原油', '原油', 'Petróleo', 'Pétrole'],
  buyback: ['자사주 매입', 'Share buybacks', '自社株買い', '股票回购', '庫藏股買回', 'Recompra de acciones', 'Rachats d’actions'],
  solana: ['솔라나', 'Solana', 'ソラナ', '索拉纳', '索拉納', 'Solana', 'Solana'],
  stablecoin: ['스테이블코인', 'Stablecoins', 'ステーブルコイン', '稳定币', '穩定幣', 'Monedas estables', 'Stablecoins'],
  etf: ['ETF', 'ETF', 'ETF', 'ETF', 'ETF', 'ETF', 'ETF'],
  fed: ['연준', 'Federal Reserve', '米連邦準備制度', '美联储', '聯準會', 'Reserva Federal', 'Réserve fédérale'],
} as const satisfies Record<string, Translations>

export function insightTagLabel(language: ClientLanguage, tag: string): string {
  const key = tag.toLowerCase()
  return Object.hasOwn(INSIGHT_TAG_LABELS, key)
    ? INSIGHT_TAG_LABELS[key as keyof typeof INSIGHT_TAG_LABELS][columns[language]] : tag
}

const rows = {
  heading: ['시장은 이렇게 움직입니다', 'Here’s how the markets are moving', '市場はこう動いています', '市场正在这样变化', '市場正這樣變化', 'Así se mueven los mercados', 'Voici comment évoluent les marchés'],
  subheading: ['내 전략에 무엇이 달라지는지 함께 봅니다', 'See what changes for your strategy', '戦略にどんな変化があるか、一緒に見ていきます', '一起看看你的策略需要如何调整', '一起看看你的策略需要如何調整', 'Veamos qué cambia para tu estrategia', 'Voyons ce qui change pour votre stratégie'],
  topics: ['주제별로 보기', 'Browse by topic', 'トピック別に見る', '按主题浏览', '依主題瀏覽', 'Explorar por tema', 'Parcourir par thème'],
  popular: ['많이 읽는 글', 'Most read', 'よく読まれている記事', '热门文章', '熱門文章', 'Lo más leído', 'Les plus lus'],
  negative: ['도움 안 됨', 'Not helpful', '役に立たない', '没有帮助', '沒有幫助', 'No fue útil', 'Pas utile'],
  neutral: ['조금 도움', 'Somewhat helpful', '少し役に立った', '有点帮助', '有點幫助', 'Algo útil', 'Un peu utile'],
  positive: ['도움 됨', 'Helpful', '役に立った', '有帮助', '有幫助', 'Útil', 'Utile'],
} as const satisfies Record<string, Translations>
export function insightSourceCopy(language: ClientLanguage, key: keyof typeof rows): string { return rows[key][columns[language]] }
