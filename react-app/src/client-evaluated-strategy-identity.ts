import { canonicalCatalogueJson, type EvaluatedStrategy } from './client-evaluated-strategy-catalogue'
import { evaluatedExecutionDestination } from './client-evaluated-execution'

type Family = 'daily' | 'rebound' | 'trend' | 'adaptive' | 'trendMomentum' | 'trendBreakout'
type Profile = { family: Family; direction: 'long' | 'short' | 'both'; accountSha256: string }
const sourceMonthlySha256 = (import.meta.env?.DEV ?? true) ? 'c153dc92fc1cd306c6a06e2afabb823d80fe7411b379280754c6a40b398ba035' : ''
const profiles: Record<string, Profile> = (import.meta.env?.DEV ?? true) ? {
  "claude-aggressive": {
    "accountSha256": "4c79bc85b7c303f3b48c3fdb1ac8262663f8a8c648db8778361bd48452957b41",
    "direction": "both",
    "family": "trendBreakout"
  },
  "claude-disciplined": {
    "accountSha256": "b9b7856f03d2465c17bcc9923a1c3880fb5af769868763a5db1c482a87cf2556",
    "direction": "both",
    "family": "trendBreakout"
  },
  "claude-market_context": {
    "accountSha256": "bb6a568fdba14097f2219749b3b42fc0ff6a58e67d4c2550e58b1d1d11077bd9",
    "direction": "both",
    "family": "trend"
  },
  "claude-standard": {
    "accountSha256": "d1023d0193c94402c7cbf81f29d8b3dd90ceb6a3abcd8223fd87811d4fcf7570",
    "direction": "both",
    "family": "trendBreakout"
  },
  "codex-aggressive": {
    "accountSha256": "6a46976077149c7cbd186d8683f1419899fc1b2be821aecaf3bec4fa0a618058",
    "direction": "both",
    "family": "trendBreakout"
  },
  "codex-disciplined": {
    "accountSha256": "063f708e5a35507e7631e75b6c2b76fd9345fe70f6a8c79fa75752edf10d4af8",
    "direction": "both",
    "family": "trend"
  },
  "codex-market_context": {
    "accountSha256": "06857e318a0d465b30e583719b19a01401acc8fc885f8d599252c565000bf96f",
    "direction": "both",
    "family": "trendBreakout"
  },
  "codex-standard": {
    "accountSha256": "c1b79c3934d8434789fe59aadfe5f67354ab88b99b0d12a62b03a535a55b1859",
    "direction": "both",
    "family": "trendBreakout"
  },
  "deepseek-aggressive": {
    "accountSha256": "4177e94ac0af4031868ee6f1c8739d0b610e766618ba1abe26b2017db3fa21f2",
    "direction": "both",
    "family": "trendBreakout"
  },
  "deepseek-disciplined": {
    "accountSha256": "96a6e76a810b3748f568b7a648df8d1a6ce7322fee626d283b79c6122fc0d730",
    "direction": "both",
    "family": "trend"
  },
  "deepseek-market_context": {
    "accountSha256": "d30be882a04cb8cf316f0cd2ab020b111feed263a7c994233c53d8cdf40383f7",
    "direction": "both",
    "family": "trend"
  },
  "deepseek-standard": {
    "accountSha256": "7e77e53fa31a214fe0c7c6a6e944b209b9fe4aaa24d85057bdba75c8b3662fb9",
    "direction": "both",
    "family": "trendBreakout"
  },
  "gemini-aggressive": {
    "accountSha256": "d6855a51cbf3d8cabdba7b893ba7c4098761758154c8cddb8400b87ded67875d",
    "direction": "long",
    "family": "rebound"
  },
  "gemini-disciplined": {
    "accountSha256": "ba97655558b3b9cd9af0a996f05803accbf29818963c23e6d2ac439d3b7cb614",
    "direction": "long",
    "family": "trend"
  },
  "gemini-market_context": {
    "accountSha256": "9fa66b95307ae772081d80382a4455a5beb9c806da68cf895ed90e9a46cfba77",
    "direction": "long",
    "family": "daily"
  },
  "gemini-standard": {
    "accountSha256": "26e66bc32c1bbe77189ed2c9343766a056b189c839209186229a589ada6f02fd",
    "direction": "both",
    "family": "adaptive"
  },
  "kimi-aggressive": {
    "accountSha256": "b4745560a5e8ff8c7237d56534734b4790ec169e0f3dcba4a05054af15c2c3bb",
    "direction": "both",
    "family": "trendMomentum"
  },
  "kimi-disciplined": {
    "accountSha256": "a45e08e9a46a5327824f26934435b61a8b22d894578f4a096140426d8cbe1d83",
    "direction": "both",
    "family": "trend"
  },
  "kimi-market_context": {
    "accountSha256": "354d0b7902e06fbd07dd7834679a1269f0fe46a8627cc4f2224bbca884553659",
    "direction": "both",
    "family": "trendMomentum"
  },
  "kimi-standard": {
    "accountSha256": "38d53778c05132f64373bbd0a7049a3e25b0fbc38fdea97294f30225f94134f5",
    "direction": "both",
    "family": "trendBreakout"
  },
  "qwen-market_context": {
    "accountSha256": "9a29ac2d4838d9f24cac91b530344eb33cea762a4417a93d92e836f8658eaf90",
    "direction": "long",
    "family": "daily"
  },
  "qwen-standard": {
    "accountSha256": "3eeee8c01ddd9423f765e1fa34d139a457b0d1cda1980c9b766d7874c13362b0",
    "direction": "long",
    "family": "daily"
  }
} : {}
const phrases = {
  ko: {
    rebound: '대표 코인 반등 따라가기', trendLong: '대표 코인 상승 추세 따라가기', trendBoth: '대표 코인 롱숏 따라가기', adaptive: '대표 코인 흐름 비교하기',
    trendMomentum: '대표 코인 추세와 탄력 따라가기', trendBreakout: '대표 코인 추세와 돌파 따라가기', daily: '대표 코인 매일 방향 고르기',
    emaFast: '빠른 이평선으로 롱숏 고르기', emaSlow: '느린 이평선으로 롱숏 고르기', rsi: '대표 코인 과열·침체 되돌림',
    breakout: '대표 코인 고저점 돌파 따라가기', emaRsi: '대표 코인 추세와 힘 함께 보기', mean: '대표 코인 평균 회귀 따라가기',
    mix: '대표 코인 판단과 추세 함께 보기', description: '확정된 가격 흐름을 보고 진입과 청산을 판단합니다.',
    reboundDescription: '가격이 되돌아오는 흐름과 추세를 검토해 롱 진입을 판단합니다.',
    longDescription: '상승 흐름을 확인해 롱 진입과 청산을 판단합니다.',
  },
  en: {
    rebound: 'Bitcoin rebound opportunities', trendLong: 'Bitcoin uptrend entries', trendBoth: 'Bitcoin long and short decisions', adaptive: 'Compare Bitcoin market signals', trendMomentum: 'Bitcoin trend and momentum', trendBreakout: 'Bitcoin trend and breakouts', daily: 'Daily Bitcoin direction', emaFast: 'Fast moving-average long and short', emaSlow: 'Slow moving-average long and short', rsi: 'Bitcoin overbought and oversold reversals', breakout: 'Bitcoin high and low breakouts', emaRsi: 'Bitcoin trend and strength', mean: 'Bitcoin mean reversion', mix: 'Bitcoin decisions with trend confirmation', description: 'Review confirmed price movements for entry and exit decisions.', reboundDescription: 'Review rebounds and trends for long entries.', longDescription: 'Review upward trends for long entries and exits.',
  },
  ja: {
    rebound: 'ビットコインの反発を追う', trendLong: 'ビットコインの上昇トレンド', trendBoth: 'ビットコインのロング・ショート', adaptive: 'ビットコインの動向を比較', trendMomentum: 'ビットコインのトレンドと勢い', trendBreakout: 'ビットコインのトレンドと突破', daily: 'ビットコインの方向を毎日判断', emaFast: '短期移動平均で方向を判断', emaSlow: '長期移動平均で方向を判断', rsi: '買われ過ぎ・売られ過ぎの反転', breakout: 'ビットコインの高値・安値突破', emaRsi: 'ビットコインのトレンドと強さ', mean: 'ビットコインの平均回帰', mix: 'ビットコインの判断とトレンド', description: '確定した価格の動きからエントリーと決済を判断します。', reboundDescription: '反発とトレンドからロングを判断します。', longDescription: '上昇トレンドからロングのエントリーと決済を判断します。',
  },
  'zh-CN': {
    rebound: '比特币反弹机会', trendLong: '比特币上升趋势', trendBoth: '比特币多空选择', adaptive: '比较比特币行情信号', trendMomentum: '比特币趋势与动能', trendBreakout: '比特币趋势与突破', daily: '每日判断比特币方向', emaFast: '短期均线多空选择', emaSlow: '长期均线多空选择', rsi: '比特币超买超卖反转', breakout: '比特币高低点突破', emaRsi: '比特币趋势与强度', mean: '比特币均值回归', mix: '比特币判断与趋势确认', description: '根据已确认价格走势判断开仓与平仓。', reboundDescription: '分析反弹与趋势判断做多机会。', longDescription: '根据上涨趋势判断做多与平仓。',
  },
  'zh-TW': {
    rebound: '比特幣反彈機會', trendLong: '比特幣上升趨勢', trendBoth: '比特幣多空選擇', adaptive: '比較比特幣行情訊號', trendMomentum: '比特幣趨勢與動能', trendBreakout: '比特幣趨勢與突破', daily: '每日判斷比特幣方向', emaFast: '短期均線多空選擇', emaSlow: '長期均線多空選擇', rsi: '比特幣超買超賣反轉', breakout: '比特幣高低點突破', emaRsi: '比特幣趨勢與強度', mean: '比特幣均值回歸', mix: '比特幣判斷與趨勢確認', description: '根據已確認價格走勢判斷開倉與平倉。', reboundDescription: '分析反彈與趨勢判斷做多機會。', longDescription: '根據上漲趨勢判斷做多與平倉。',
  },
  es: {
    rebound: 'Oportunidades de rebote de Bitcoin', trendLong: 'Tendencia alcista de Bitcoin', trendBoth: 'Decisiones largas y cortas de Bitcoin', adaptive: 'Comparar señales de Bitcoin', trendMomentum: 'Tendencia e impulso de Bitcoin', trendBreakout: 'Tendencia y rupturas de Bitcoin', daily: 'Dirección diaria de Bitcoin', emaFast: 'Dirección con medias rápidas', emaSlow: 'Dirección con medias lentas', rsi: 'Reversiones de sobrecompra y sobreventa', breakout: 'Rupturas de máximos y mínimos', emaRsi: 'Tendencia y fuerza de Bitcoin', mean: 'Reversión a la media de Bitcoin', mix: 'Decisiones y tendencia de Bitcoin', description: 'Examina precios confirmados para entradas y cierres.', reboundDescription: 'Examina rebotes y tendencias para entradas largas.', longDescription: 'Examina tendencias alcistas para entradas y cierres.',
  },
  fr: {
    rebound: 'Occasions de rebond de Bitcoin', trendLong: 'Tendance haussière de Bitcoin', trendBoth: 'Décisions long et short de Bitcoin', adaptive: 'Comparer les signaux de Bitcoin', trendMomentum: 'Tendance et élan de Bitcoin', trendBreakout: 'Tendance et cassures de Bitcoin', daily: 'Direction quotidienne de Bitcoin', emaFast: 'Direction par moyennes rapides', emaSlow: 'Direction par moyennes lentes', rsi: 'Retournements de surachat et survente', breakout: 'Cassures des hauts et bas de Bitcoin', emaRsi: 'Tendance et force de Bitcoin', mean: 'Retour à la moyenne de Bitcoin', mix: 'Décisions et tendance de Bitcoin', description: 'Examine les prix confirmés pour entrer et sortir.', reboundDescription: 'Examine les rebonds et tendances pour les entrées longues.', longDescription: 'Examine les tendances haussières pour entrer et sortir.',
  },
} as const
const ruleNames = { 'ema12-26': 'emaFast', 'ema20-50': 'emaSlow', 'rsi14-reversal': 'rsi', 'prior20-breakout': 'breakout', 'ema-rsi-combination': 'emaRsi', 'mean20-reversion': 'mean' } as const

// Editorial names summarize the bound original judgments, never a new policy or model identity.
const distinctNames: Record<string, readonly string[]> = (import.meta.env?.DEV ?? true) ? {
  "gemini-aggressive": [
    "과매도 반등에서 롱 찾기",
    "Long entries after oversold rebounds",
    "売られ過ぎの反発でロング",
    "超卖反弹做多",
    "超賣反彈做多",
    "Entradas tras rebotes de sobreventa",
    "Entrées après rebond de survente"
  ],
  "gemini-standard": [
    "지지와 이평선 회복 따라가기",
    "Support and moving-average recovery",
    "支持線と移動平均の回復",
    "支撑与均线回升",
    "支撐與均線回升",
    "Recuperación de soporte y medias",
    "Reprise du support et des moyennes"
  ],
  "gemini-market_context": [
    "저점 회복 뒤 상승 살피기",
    "Watch recovery from lows",
    "安値からの回復を確認",
    "观察低点回升",
    "觀察低點回升",
    "Observar la recuperación desde mínimos",
    "Observer la reprise depuis les creux"
  ],
  "kimi-aggressive": [
    "정배열과 탄력으로 방향 잡기",
    "Direction from averages and momentum",
    "移動平均と勢いで方向判断",
    "均线与动能选方向",
    "均線與動能選方向",
    "Dirección por medias y momentum",
    "Direction par moyennes et momentum"
  ],
  "kimi-disciplined": [
    "저점 높이는 추세에 진입하기",
    "Enter trends with rising lows",
    "切り上がる安値のトレンド",
    "低点抬升趋势入场",
    "低點抬升趨勢進場",
    "Entrar con mínimos crecientes",
    "Entrer avec des creux ascendants"
  ],
  "qwen-standard": [
    "가격대 하단에서 반등 찾기",
    "Rebounds near the range floor",
    "価格帯下限の反発を確認",
    "区间下沿寻找反弹",
    "區間下沿尋找反彈",
    "Rebotes cerca del suelo del rango",
    "Rebonds près du bas de la fourchette"
  ],
  "codex-disciplined": [
    "저항 돌파와 지지 이탈 확인하기",
    "Resistance breaks and support losses",
    "抵抗突破と支持割れを確認",
    "确认突破阻力与失守支撑",
    "確認突破阻力與失守支撐",
    "Rupturas de resistencia y soporte",
    "Cassures de résistance et de support"
  ],
  "codex-standard": [
    "거래량 실린 돌파 따라가기",
    "Follow volume-backed breakouts",
    "出来高を伴う突破を追う",
    "跟随放量突破",
    "跟隨放量突破",
    "Seguir rupturas con volumen",
    "Suivre les cassures avec volume"
  ],
  "kimi-market_context": [
    "펀딩과 추세로 롱숏 고르기",
    "Long or short by funding and trend",
    "資金調達率とトレンドで方向選択",
    "资金费率与趋势选多空",
    "資金費率與趨勢選多空",
    "Long o short por funding y tendencia",
    "Long ou short par funding et tendance"
  ],
  "deepseek-market_context": [
    "변동성과 추세 방향 함께 보기",
    "Volatility with trend direction",
    "変動率とトレンド方向を確認",
    "波动率与趋势方向结合",
    "波動率與趨勢方向結合",
    "Volatilidad y dirección de tendencia",
    "Volatilité et direction de tendance"
  ],
  "claude-disciplined": [
    "돌파 뒤 가격 안착 기다리기",
    "Wait for price to settle after a break",
    "突破後の価格定着を待つ",
    "等待突破后价格企稳",
    "等待突破後價格企穩",
    "Esperar consolidación tras la ruptura",
    "Attendre la stabilisation après cassure"
  ],
  "codex-market_context": [
    "거래량 늘어난 관찰선 넘기",
    "Cross watched levels on rising volume",
    "出来高増加で注目水準を突破",
    "放量跨越观察价位",
    "放量跨越觀察價位",
    "Cruzar niveles con volumen creciente",
    "Franchir les seuils avec plus de volume"
  ],
  "qwen-market_context": [
    "상승 정배열에서 지지 확인하기",
    "Support in an upward average alignment",
    "上向き移動平均で支持を確認",
    "上行均线确认支撑",
    "上行均線確認支撐",
    "Soporte con medias ascendentes",
    "Support avec moyennes ascendantes"
  ],
  "deepseek-disciplined": [
    "이평선 위 눌림과 돌파 보기",
    "Pullbacks and breaks above averages",
    "移動平均上の押し目と突破",
    "均线上方回调与突破",
    "均線上方回調與突破",
    "Retrocesos y rupturas sobre medias",
    "Replis et cassures au-dessus des moyennes"
  ],
  "codex-aggressive": [
    "추세 강화와 돌파 회복 따라가기",
    "Trend strength and breakout recovery",
    "トレンド強化と突破回復",
    "趋势增强与突破回升",
    "趨勢增強與突破回升",
    "Fuerza de tendencia y recuperación",
    "Renforcement et reprise des cassures"
  ],
  "claude-standard": [
    "하락 구조 깨지면 방향 바꾸기",
    "Change direction when declines break",
    "下落構造の崩れで方向転換",
    "跌势结构破坏后换方向",
    "跌勢結構破壞後換方向",
    "Cambiar al romper la estructura bajista",
    "Changer après rupture de structure baissière"
  ],
  "gemini-disciplined": [
    "오름세 이평선 위에서 롱 찾기",
    "Long entries above rising averages",
    "上向き移動平均の上でロング",
    "上涨均线上方寻找做多",
    "上漲均線上方尋找做多",
    "Long sobre medias ascendentes",
    "Long au-dessus des moyennes ascendantes"
  ],
  "deepseek-standard": [
    "추세와 거래량으로 방향 확인하기",
    "Confirm direction with trend and volume",
    "トレンドと出来高で方向確認",
    "趋势与成交量确认方向",
    "趨勢與成交量確認方向",
    "Confirmar por tendencia y volumen",
    "Confirmer par tendance et volume"
  ],
  "kimi-standard": [
    "박스 돌파와 눌림 나눠 보기",
    "Separate range breaks from pullbacks",
    "レンジ突破と押し目を見分ける",
    "区分区间突破与回调",
    "區分區間突破與回調",
    "Distinguir rupturas y retrocesos",
    "Distinguer cassures et replis"
  ],
  "claude-market_context": [
    "시장 흐름과 가격 다지기 읽기",
    "Read market flow and consolidation",
    "市場の流れと保ち合いを読む",
    "观察市场走势与盘整",
    "觀察市場走勢與盤整",
    "Leer el mercado y la consolidación",
    "Lire le marché et la consolidation"
  ],
  "deepseek-aggressive": [
    "저점 반등과 추세 지속 고르기",
    "Low rebounds and trend continuation",
    "安値反発とトレンド継続",
    "低点反弹与趋势延续",
    "低點反彈與趨勢延續",
    "Rebotes de mínimos y continuidad",
    "Rebonds des creux et continuation"
  ],
  "claude-aggressive": [
    "거래량과 고저점 돌파 읽기",
    "Read volume and high-low breaks",
    "出来高と高安値の突破を読む",
    "成交量与高低点突破",
    "成交量與高低點突破",
    "Leer volumen y rupturas de extremos",
    "Lire volume et cassures des extrêmes"
  ],
  "mix-codex": [
    "거래량 돌파를 EMA 추세로 거르기",
    "Filter volume breaks with EMA trends",
    "出来高突破をEMAで選別",
    "EMA筛选放量突破",
    "EMA篩選放量突破",
    "Filtrar rupturas con EMA",
    "Filtrer les cassures avec EMA"
  ],
  "mix-claude": [
    "방향 전환에 EMA 추세 겹치기",
    "EMA trends over direction changes",
    "方向転換にEMAを重ねる",
    "方向转变结合EMA趋势",
    "方向轉變結合EMA趨勢",
    "EMA para cambios de dirección",
    "EMA pour les changements de direction"
  ],
  "mix-gemini": [
    "지지 회복과 EMA 추세 맞추기",
    "Align support recovery with EMA",
    "支持回復とEMAを合わせる",
    "支撑回升匹配EMA趋势",
    "支撐回升匹配EMA趨勢",
    "Alinear soporte y EMA",
    "Aligner la reprise du support et EMA"
  ],
  "mix-kimi": [
    "박스 돌파에 EMA 확인 더하기",
    "EMA confirmation for range breaks",
    "レンジ突破にEMA確認を追加",
    "区间突破加入EMA确认",
    "區間突破加入EMA確認",
    "Confirmar rupturas de rango con EMA",
    "Confirmer les cassures de range avec EMA"
  ]
} : {}

type RuleDescriptionBinding = { policyJson: string; provenanceJson: string; policyVersionId: string; description: string }
const ruleDescriptionBindings: Record<string, RuleDescriptionBinding> = (import.meta.env?.DEV ?? true) ? {
  "ema12-26": {
    "policyJson": "{\"allocation\":\"2500bps\",\"confidence\":\"100\",\"emaSeed\":\"first close of confirmed64 window; recursive alpha2/(period+1)\",\"entry\":\"EMA12 above EMA26 long; below short\",\"executionVerified\":false,\"exit\":\"Close on opposing trend before entering on a later decision\",\"heldSameDirection\":\"hold\",\"id\":\"ema12-26\",\"indicator\":\"ema12_26\",\"leverage\":\"1\",\"name\":\"EMA 12/26 trend\",\"originalExecutionStatus\":\"verification_failed\",\"reversal\":\"close held opposite first; enter only on a later decision\",\"rsi\":\"last14 close deltas; gain/loss sums; flat50; no loss100\",\"stop\":\"150bps\",\"strategy\":\"trend_following\",\"take\":\"300bps\",\"timing\":\"Daily decisions from last64 confirmed contract bars; next contract open; native minute risk\"}",
    "provenanceJson": "{\"engineSha256\":\"f3e87adc2d8a5d3c0e194b33efcfab2d514766e7e270bbd52e011906c8ba43a4\",\"inputHash\":\"15f6829307faeefb48ebf16ea8bf64822a4d92094734cbdc53af8b1e208f0c17\",\"monthlySha256\":\"c153dc92fc1cd306c6a06e2afabb823d80fe7411b379280754c6a40b398ba035\",\"originalExecutionStatus\":\"verification_failed\",\"policyDefinitionSha256\":\"a32144179dd981d75d6dba504f772ec9543e7ef63731ed44f9a082d158168f50\",\"receiptSha256\":\"d086c5818dc899452142f4d48c60d6b311c19a20ee341c5db5034b44da9f0a63\",\"sourceAccountSha256\":\"3bfac9bf891893c776deafbf366097ae21f0896652de0554490ba0c8fc2aace7\"}",
    "policyVersionId": "7bb8c76b01225f726714b1ac051c1ede152b9c1685cf836b5fc6016e9887708e",
    "description": "EMA12가 EMA26보다 높으면 롱, 낮으면 숏에 진입합니다. 반대 추세면 청산하고 이후 판단에서 재진입합니다."
  },
  "ema20-50": {
    "policyJson": "{\"allocation\":\"2500bps\",\"confidence\":\"100\",\"emaSeed\":\"first close of confirmed64 window; recursive alpha2/(period+1)\",\"entry\":\"EMA20 above EMA50 long; below short\",\"executionVerified\":false,\"exit\":\"Close on opposing trend before entering on a later decision\",\"heldSameDirection\":\"hold\",\"id\":\"ema20-50\",\"indicator\":\"ema20_50\",\"leverage\":\"1\",\"name\":\"EMA 20/50 trend\",\"originalExecutionStatus\":\"verification_failed\",\"reversal\":\"close held opposite first; enter only on a later decision\",\"rsi\":\"last14 close deltas; gain/loss sums; flat50; no loss100\",\"stop\":\"150bps\",\"strategy\":\"trend_following\",\"take\":\"300bps\",\"timing\":\"Daily decisions from last64 confirmed contract bars; next contract open; native minute risk\"}",
    "provenanceJson": "{\"engineSha256\":\"f3e87adc2d8a5d3c0e194b33efcfab2d514766e7e270bbd52e011906c8ba43a4\",\"inputHash\":\"15f6829307faeefb48ebf16ea8bf64822a4d92094734cbdc53af8b1e208f0c17\",\"monthlySha256\":\"c153dc92fc1cd306c6a06e2afabb823d80fe7411b379280754c6a40b398ba035\",\"originalExecutionStatus\":\"verification_failed\",\"policyDefinitionSha256\":\"4a14e5ac398b5f47e31f02d9f098a226ffebbfb17d8f309e535a42c0ecd9132b\",\"receiptSha256\":\"d086c5818dc899452142f4d48c60d6b311c19a20ee341c5db5034b44da9f0a63\",\"sourceAccountSha256\":\"3d1766cab2993f3a1a300aa1ff68a3a49d9246d27e4a2ac99412c9af7bc80533\"}",
    "policyVersionId": "b08bcedddb316104c425f08d27fd95bfa7695c01829f43dd1312e9b8186ef542",
    "description": "EMA20이 EMA50보다 높으면 롱, 낮으면 숏에 진입합니다. 반대 추세면 청산하고 이후 판단에서 재진입합니다."
  },
  "rsi14-reversal": {
    "policyJson": "{\"allocation\":\"2500bps\",\"confidence\":\"100\",\"emaSeed\":\"first close of confirmed64 window; recursive alpha2/(period+1)\",\"entry\":\"RSI14 at or below30 long; at or above70 short\",\"executionVerified\":false,\"exit\":\"Long closes at RSI50 or above; short closes at RSI50 or below\",\"heldSameDirection\":\"hold\",\"id\":\"rsi14-reversal\",\"indicator\":\"rsi14\",\"leverage\":\"1\",\"name\":\"RSI 14 reversal\",\"originalExecutionStatus\":\"verification_failed\",\"reversal\":\"close held opposite first; enter only on a later decision\",\"rsi\":\"last14 close deltas; gain/loss sums; flat50; no loss100\",\"stop\":\"150bps\",\"strategy\":\"reversal\",\"take\":\"300bps\",\"timing\":\"Daily decisions from last64 confirmed contract bars; next contract open; native minute risk\"}",
    "provenanceJson": "{\"engineSha256\":\"f3e87adc2d8a5d3c0e194b33efcfab2d514766e7e270bbd52e011906c8ba43a4\",\"inputHash\":\"15f6829307faeefb48ebf16ea8bf64822a4d92094734cbdc53af8b1e208f0c17\",\"monthlySha256\":\"c153dc92fc1cd306c6a06e2afabb823d80fe7411b379280754c6a40b398ba035\",\"originalExecutionStatus\":\"verification_failed\",\"policyDefinitionSha256\":\"29c685e88290a36800fd8137298739237dce50fad4ca28c23136f6cc670e4b7e\",\"receiptSha256\":\"d086c5818dc899452142f4d48c60d6b311c19a20ee341c5db5034b44da9f0a63\",\"sourceAccountSha256\":\"7fae4d078a9eea8c57ceb38076a9d1e164d2d77a1e088e98897e6107e0ecf57b\"}",
    "policyVersionId": "2c4b890f116739f1ff90144513f7e2606e5ab7a416e2babab97c09523047967f",
    "description": "RSI14가 30 이하면 롱, 70 이상이면 숏에 진입합니다. 롱은 50 이상, 숏은 50 이하에서 청산합니다."
  },
  "prior20-breakout": {
    "policyJson": "{\"allocation\":\"2500bps\",\"confidence\":\"100\",\"emaSeed\":\"first close of confirmed64 window; recursive alpha2/(period+1)\",\"entry\":\"Signal close above prior20 highs long; below prior20 lows short; exclude signal bar\",\"executionVerified\":false,\"exit\":\"Close long below prior20 lows; close short above prior20 highs\",\"heldSameDirection\":\"hold\",\"id\":\"prior20-breakout\",\"indicator\":\"breakout20\",\"leverage\":\"1\",\"name\":\"Prior 20 bar breakout\",\"originalExecutionStatus\":\"verification_failed\",\"reversal\":\"close held opposite first; enter only on a later decision\",\"rsi\":\"last14 close deltas; gain/loss sums; flat50; no loss100\",\"stop\":\"150bps\",\"strategy\":\"breakout\",\"take\":\"300bps\",\"timing\":\"Daily decisions from last64 confirmed contract bars; next contract open; native minute risk\"}",
    "provenanceJson": "{\"engineSha256\":\"f3e87adc2d8a5d3c0e194b33efcfab2d514766e7e270bbd52e011906c8ba43a4\",\"inputHash\":\"15f6829307faeefb48ebf16ea8bf64822a4d92094734cbdc53af8b1e208f0c17\",\"monthlySha256\":\"c153dc92fc1cd306c6a06e2afabb823d80fe7411b379280754c6a40b398ba035\",\"originalExecutionStatus\":\"verification_failed\",\"policyDefinitionSha256\":\"89f489865b18b11c06adbd7bbfd79f66fb9501586589f28065096c1953550036\",\"receiptSha256\":\"d086c5818dc899452142f4d48c60d6b311c19a20ee341c5db5034b44da9f0a63\",\"sourceAccountSha256\":\"8d79cb2a09ada6f512697c2d3381bc1febea52c6812b59bd4f0b3c3bc87ada6a\"}",
    "policyVersionId": "7ddd957030cc7b7e0baeee5ce7a8672e3b139a9e67e316f9950335e1404a767b",
    "description": "확정 종가가 직전 20봉 고가를 넘으면 롱, 저가를 밑돌면 숏에 진입합니다. 반대 경계 돌파 시 청산하며 신호 봉은 범위에서 제외합니다."
  },
  "ema-rsi-combination": {
    "policyJson": "{\"allocation\":\"2500bps\",\"confidence\":\"100\",\"emaSeed\":\"first close of confirmed64 window; recursive alpha2/(period+1)\",\"entry\":\"EMA20 above50 and RSI above50 long; below50 and RSI below50 short\",\"executionVerified\":false,\"exit\":\"Close long on EMA20 at or below50 or RSI at or below50; symmetric short exit\",\"heldSameDirection\":\"hold\",\"id\":\"ema-rsi-combination\",\"indicator\":\"ema_rsi\",\"leverage\":\"1\",\"name\":\"EMA 20/50 + RSI 14\",\"originalExecutionStatus\":\"verification_failed\",\"reversal\":\"close held opposite first; enter only on a later decision\",\"rsi\":\"last14 close deltas; gain/loss sums; flat50; no loss100\",\"stop\":\"150bps\",\"strategy\":\"momentum\",\"take\":\"300bps\",\"timing\":\"Daily decisions from last64 confirmed contract bars; next contract open; native minute risk\"}",
    "provenanceJson": "{\"engineSha256\":\"f3e87adc2d8a5d3c0e194b33efcfab2d514766e7e270bbd52e011906c8ba43a4\",\"inputHash\":\"15f6829307faeefb48ebf16ea8bf64822a4d92094734cbdc53af8b1e208f0c17\",\"monthlySha256\":\"c153dc92fc1cd306c6a06e2afabb823d80fe7411b379280754c6a40b398ba035\",\"originalExecutionStatus\":\"verification_failed\",\"policyDefinitionSha256\":\"72e02c688003c65ba08537f2696cd6d91b2697465f5fd626bd828a84799308f5\",\"receiptSha256\":\"d086c5818dc899452142f4d48c60d6b311c19a20ee341c5db5034b44da9f0a63\",\"sourceAccountSha256\":\"713374859238e936e92262dff62f092c6cdb5df1786f4590def4cd42361fa708\"}",
    "policyVersionId": "3b41e88595b5b89c19cbff9113832e83e4fb93befd88cf870016cf54d76a162a",
    "description": "EMA20>EMA50·RSI14>50이면 롱, EMA20<EMA50·RSI14<50이면 숏에 진입합니다. 롱은 EMA20≤EMA50 또는 RSI14≤50, 숏은 EMA20≥EMA50 또는 RSI14≥50이면 청산합니다."
  },
  "mean20-reversion": {
    "policyJson": "{\"allocation\":\"2500bps\",\"confidence\":\"100\",\"emaSeed\":\"first close of confirmed64 window; recursive alpha2/(period+1)\",\"entry\":\"Close at least100bps below mean20 long; above mean20 short\",\"executionVerified\":false,\"exit\":\"Close long at mean20 or above; short at mean20 or below\",\"heldSameDirection\":\"hold\",\"id\":\"mean20-reversion\",\"indicator\":\"mean20\",\"leverage\":\"1\",\"name\":\"Mean 20 reversion\",\"originalExecutionStatus\":\"verification_failed\",\"reversal\":\"close held opposite first; enter only on a later decision\",\"rsi\":\"last14 close deltas; gain/loss sums; flat50; no loss100\",\"stop\":\"150bps\",\"strategy\":\"mean_reversion\",\"take\":\"300bps\",\"timing\":\"Daily decisions from last64 confirmed contract bars; next contract open; native minute risk\"}",
    "provenanceJson": "{\"engineSha256\":\"f3e87adc2d8a5d3c0e194b33efcfab2d514766e7e270bbd52e011906c8ba43a4\",\"inputHash\":\"15f6829307faeefb48ebf16ea8bf64822a4d92094734cbdc53af8b1e208f0c17\",\"monthlySha256\":\"c153dc92fc1cd306c6a06e2afabb823d80fe7411b379280754c6a40b398ba035\",\"originalExecutionStatus\":\"verification_failed\",\"policyDefinitionSha256\":\"a8cbefde91ce4f93870df15cf3392bc4428dfbf56d976b466658bd8a2024124b\",\"receiptSha256\":\"d086c5818dc899452142f4d48c60d6b311c19a20ee341c5db5034b44da9f0a63\",\"sourceAccountSha256\":\"c7f473f8623fefe850c2efe81728f812953d8016d613c9b981c1f62b307089d9\"}",
    "policyVersionId": "8a2e0d1ca1084cb633732a0e10c10c5cfbe25b1b57b6492132986219bdcb112a",
    "description": "종가가 20봉 평균보다 1% 이상 낮으면 롱, 1% 이상 높으면 숏에 진입합니다. 롱은 평균 이상, 숏은 평균 이하에서 청산합니다."
  }
} : {}
const ruleDescriptions = {
  en: {
    'ema12-26': 'Enter long when EMA12 is above EMA26 and short when it is below. Close on the opposing trend, then re-enter on a later decision.',
    'ema20-50': 'Enter long when EMA20 is above EMA50 and short when it is below. Close on the opposing trend, then re-enter on a later decision.',
    'rsi14-reversal': 'Enter long when RSI14 is at or below 30 and short when it is at or above 70. Close longs at or above 50 and shorts at or below 50.',
    'prior20-breakout': 'Enter long when the confirmed close exceeds the highs of the prior 20 bars and short when it falls below their lows. Close on a breakout of the opposite boundary; exclude the signal bar from the range.',
    'ema-rsi-combination': 'Enter long when EMA20>EMA50 and RSI14>50; enter short when EMA20<EMA50 and RSI14<50. Close longs when EMA20≤EMA50 or RSI14≤50; close shorts when EMA20≥EMA50 or RSI14≥50.',
    'mean20-reversion': 'Enter long when the close is at least 1% below the 20-bar average and short when it is at least 1% above. Close longs at or above the average and shorts at or below it.',
  },
  ja: {
    'ema12-26': 'EMA12がEMA26より高ければロング、低ければショートでエントリーします。反対のトレンドで決済し、その後の判断で再エントリーします。',
    'ema20-50': 'EMA20がEMA50より高ければロング、低ければショートでエントリーします。反対のトレンドで決済し、その後の判断で再エントリーします。',
    'rsi14-reversal': 'RSI14が30以下ならロング、70以上ならショートでエントリーします。ロングは50以上、ショートは50以下で決済します。',
    'prior20-breakout': '確定終値が直前20本の高値を超えればロング、安値を下回ればショートでエントリーします。反対側の境界を突破したら決済し、シグナル足は範囲から除外します。',
    'ema-rsi-combination': 'EMA20>EMA50かつRSI14>50ならロング、EMA20<EMA50かつRSI14<50ならショートでエントリーします。ロングはEMA20≤EMA50またはRSI14≤50、ショートはEMA20≥EMA50またはRSI14≥50で決済します。',
    'mean20-reversion': '終値が20本平均より1%以上低ければロング、1%以上高ければショートでエントリーします。ロングは平均以上、ショートは平均以下で決済します。',
  },
  'zh-CN': {
    'ema12-26': 'EMA12高于EMA26时做多，低于时做空。趋势反向时平仓，并在之后的决策中重新入场。',
    'ema20-50': 'EMA20高于EMA50时做多，低于时做空。趋势反向时平仓，并在之后的决策中重新入场。',
    'rsi14-reversal': 'RSI14不高于30时做多，不低于70时做空。多单在50或以上平仓，空单在50或以下平仓。',
    'prior20-breakout': '已确认收盘价突破此前20根K线的最高价时做多，跌破最低价时做空。突破相反边界时平仓，范围不包含信号K线。',
    'ema-rsi-combination': 'EMA20>EMA50且RSI14>50时做多，EMA20<EMA50且RSI14<50时做空。多单在EMA20≤EMA50或RSI14≤50时平仓，空单在EMA20≥EMA50或RSI14≥50时平仓。',
    'mean20-reversion': '收盘价低于20根K线均价至少1%时做多，高于均价至少1%时做空。多单在均价或以上平仓，空单在均价或以下平仓。',
  },
  'zh-TW': {
    'ema12-26': 'EMA12高於EMA26時做多，低於時做空。趨勢反向時平倉，並在之後的判斷中重新進場。',
    'ema20-50': 'EMA20高於EMA50時做多，低於時做空。趨勢反向時平倉，並在之後的判斷中重新進場。',
    'rsi14-reversal': 'RSI14不高於30時做多，不低於70時做空。多單在50或以上平倉，空單在50或以下平倉。',
    'prior20-breakout': '已確認收盤價突破前20根K線的最高價時做多，跌破最低價時做空。突破相反邊界時平倉，範圍不包含訊號K線。',
    'ema-rsi-combination': 'EMA20>EMA50且RSI14>50時做多，EMA20<EMA50且RSI14<50時做空。多單在EMA20≤EMA50或RSI14≤50時平倉，空單在EMA20≥EMA50或RSI14≥50時平倉。',
    'mean20-reversion': '收盤價低於20根K線均價至少1%時做多，高於均價至少1%時做空。多單在均價或以上平倉，空單在均價或以下平倉。',
  },
  es: {
    'ema12-26': 'Entra en largo cuando EMA12 supera EMA26 y en corto cuando está por debajo. Cierra con la tendencia contraria y vuelve a entrar en una decisión posterior.',
    'ema20-50': 'Entra en largo cuando EMA20 supera EMA50 y en corto cuando está por debajo. Cierra con la tendencia contraria y vuelve a entrar en una decisión posterior.',
    'rsi14-reversal': 'Entra en largo con RSI14 igual o inferior a 30 y en corto con un valor igual o superior a 70. Cierra largos en 50 o más y cortos en 50 o menos.',
    'prior20-breakout': 'Entra en largo cuando el cierre confirmado supera los máximos de las 20 velas anteriores y en corto cuando cae por debajo de sus mínimos. Cierra al romper el límite opuesto; excluye la vela de señal del rango.',
    'ema-rsi-combination': 'Entra en largo con EMA20>EMA50 y RSI14>50, y en corto con EMA20<EMA50 y RSI14<50. Cierra largos con EMA20≤EMA50 o RSI14≤50, y cortos con EMA20≥EMA50 o RSI14≥50.',
    'mean20-reversion': 'Entra en largo cuando el cierre está al menos un 1% por debajo de la media de 20 velas, y en corto cuando está al menos un 1% por encima. Cierra largos en la media o por encima, y cortos en la media o por debajo.',
  },
  fr: {
    'ema12-26': 'Entrée long si EMA12 dépasse EMA26, et short si elle est inférieure. Clôture à la tendance opposée, puis nouvelle entrée lors d’une décision ultérieure.',
    'ema20-50': 'Entrée long si EMA20 dépasse EMA50, et short si elle est inférieure. Clôture à la tendance opposée, puis nouvelle entrée lors d’une décision ultérieure.',
    'rsi14-reversal': 'Entrée long si RSI14 est inférieur ou égal à 30, et short s’il est supérieur ou égal à 70. Clôture des longs à 50 ou plus, et des shorts à 50 ou moins.',
    'prior20-breakout': 'Entrée long si la clôture confirmée dépasse les plus hauts des 20 bougies précédentes, et short si elle passe sous leurs plus bas. Clôture lors du franchissement de la limite opposée ; la bougie du signal est exclue de la plage.',
    'ema-rsi-combination': 'Entrée long si EMA20>EMA50 et RSI14>50, et short si EMA20<EMA50 et RSI14<50. Clôture des longs si EMA20≤EMA50 ou RSI14≤50, et des shorts si EMA20≥EMA50 ou RSI14≥50.',
    'mean20-reversion': 'Entrée long si la clôture est au moins 1% sous la moyenne de 20 bougies, et short si elle est au moins 1% au-dessus. Clôture des longs à la moyenne ou au-dessus, et des shorts à la moyenne ou en dessous.',
  },
} as const

export function evaluatedRuleDescription(item: EvaluatedStrategy, language: string): string {
  if (item.kind !== 'rule') return item.description
  const id = String(item.policy.id), binding = ruleDescriptionBindings[id]
  if (!binding || item.id !== `eval-rule-${id}` || item.policyVersionId !== binding.policyVersionId || item.description !== binding.description || canonicalCatalogueJson(item.policy) !== binding.policyJson || canonicalCatalogueJson(item.provenance) !== binding.provenanceJson) return item.description
  if (language === 'ko') return item.description
  const descriptions = ruleDescriptions[language as keyof typeof ruleDescriptions] ?? ruleDescriptions.en
  return descriptions[id as keyof typeof descriptions] ?? item.description
}

export function evaluatedStrategyEntryFamily(counts: Record<string, number>, directions: Record<string, number>): { family: Family; direction: 'long' | 'short' | 'both' } {
  const direction = directions.open_long > 0 && !directions.open_short ? 'long' : directions.open_short > 0 && !directions.open_long ? 'short' : 'both'
  if (Object.values(counts).reduce((sum, count) => sum + count, 0) < 3) return { family: 'daily', direction }
  if (direction === 'short') return { family: 'adaptive', direction }
  const trend = counts.trend_following ?? 0, rebound = (counts.mean_reversion ?? 0) + (counts.reversal ?? 0)
  if (!trend) return { family: 'adaptive', direction }
  if (direction === 'long' && rebound > trend) return { family: 'rebound', direction }
  const candidates: [Family, number][] = [['trendBreakout', counts.breakout ?? 0], ['trendMomentum', counts.momentum ?? 0], ['adaptive', rebound]]
  const top = Math.max(...candidates.map(([, count]) => count))
  if (top < 2) return { family: 'trend', direction }
  const leaders = candidates.filter(([, count]) => count === top)
  return { family: leaders.length > 1 ? 'adaptive' : leaders[0][0], direction }
}

export function evaluatedStrategyNamingBasis(item: EvaluatedStrategy) {
  const profile = item.kind === 'agent' && item.sourceAgentId && item.provenance.monthlySha256 === sourceMonthlySha256 ? profiles[item.sourceAgentId] : undefined
  return profile?.accountSha256 === item.provenance.sourceAccountSha256 ? profile : undefined
}

const mixedTitlePolicyHashes: Record<string, string> = {"eval-mix-codex-ema-gate": "ef8271996b603507142ad7b239ea3906812829d2e868d97d5540db00e89e8882", "eval-mix-claude-ema-gate": "7548828409c11c647520db20d942f5138f21e28ddb7151bbaf00c5edcc559abb", "eval-mix-gemini-ema-gate": "57dbf52d515a89925cdd905bea9fb4ebf9cb7480707d9d8a62a7871c946fa6b9", "eval-mix-kimi-ema-gate": "f26634071f8feca195999f0f7f352785d1b0261ae6a27420ff21770c3d376878"}

export function evaluatedStrategyIdentity(item: EvaluatedStrategy, language: string) {
  if (item.discovery) return { name: item.discovery.displayNames?.[language] ?? item.name, description: item.description, byline: evaluatedModelBrand(item.author.name), dataLabel: evaluatedExecutionDestination(language).label }
  const t = phrases[language as keyof typeof phrases] ?? phrases.en
  const bound = evaluatedStrategyNamingBasis(item)
  const rule = ruleNames[item.policy.id as keyof typeof ruleNames]
  const family = bound?.family
  const baseName = item.kind === 'rule' ? rule ? t[rule] : t.daily : item.kind === 'mix' ? t.mix : family === 'trend' ? t[bound?.direction === 'long' ? 'trendLong' : 'trendBoth'] : family ? t[family] : t.daily
  const description = item.kind === 'rule' ? evaluatedRuleDescription(item, language) : item.kind === 'mix' ? item.description : family === 'daily' ? t.description : family === 'rebound' ? t.reboundDescription : bound?.direction === 'long' ? t.longDescription : t.description
  const profile = item.sourceAgentId && item.provenance.monthlySha256 === sourceMonthlySha256 ? profiles[item.sourceAgentId] : undefined
  const named = profile?.accountSha256 === item.provenance.sourceAccountSha256 && (item.kind === 'agent' || item.kind === 'mix' && mixedTitlePolicyHashes[item.id] === item.provenance.policyDefinitionSha256 && item.policy.type === 'stored_ai_signal_with_rule_gate' && item.policy.sourceMode === 'standard')
    ? distinctNames[item.kind === 'mix' ? `mix-${item.policy.sourceProvider}` : item.sourceAgentId!] : undefined
  const locale = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'].indexOf(language)
  const name = named?.[locale < 0 ? 1 : locale] ?? baseName
  return { name, description, byline: item.kind === 'rule' ? '' : evaluatedModelBrand(item.author.name), dataLabel: evaluatedExecutionDestination(language).label }
}

export function evaluatedModelBrand(name: string) { return ({ codex: 'Codex', claude: 'Claude', gemini: 'Gemini', deepseek: 'DeepSeek', qwen: 'Qwen', kimi: 'Kimi' } as Record<string, string>)[name.toLowerCase()] ?? name }
