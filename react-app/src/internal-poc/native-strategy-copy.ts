import type { ClientLanguage } from '../client-preferences'

// Static presentation copy only; never translate the server projection or
// coerce its decimal values. Column order follows client language preferences.
type Translations = readonly [string, string, string, string, string, string, string]
const column = { ko: 0, en: 1, ja: 2, 'zh-CN': 3, 'zh-TW': 4, es: 5, fr: 6 } as const satisfies Record<ClientLanguage, number>
export const nativeStrategyCopy = {
  unknown: ["미정","Undetermined","未定","未定","未定","Sin definir","Non défini"],
  symbol: ["거래쌍","Trading pair","取引ペア","交易对","交易對","Par de negociación","Paire de trading"],
  exchange: ["거래소","Exchange","取引所","交易所","交易所","Exchange","Plateforme d'échange"],
  timeframe: ["조건 평가 주기","Condition evaluation interval","条件評価の周期","条件评估周期","條件評估週期","Intervalo de evaluación de condiciones","Intervalle d'évaluation des conditions"],
  amount: ["고정 주문 금액","Fixed order amount","固定注文金額","固定下单金额","固定下單金額","Importe fijo de la orden","Montant fixe de l'ordre"],
  leverage: ["레버리지","Leverage","レバレッジ","杠杆","槓桿","Apalancamiento","Levier"],
  leverageValue: ["{value}배","{value}x","{value}倍","{value}倍","{value}倍","{value}x","{value}x"],
  marketType: ["시장 유형","Market type","市場タイプ","市场类型","市場類型","Tipo de mercado","Type de marché"],
  timezone: ["시간대","Time zone","タイムゾーン","时区","時區","Zona horaria","Fuseau horaire"],
  article: ["현재 서버 전략 초안","Current server strategy draft","現在のサーバー戦略ドラフト","当前服务器策略草稿","目前伺服器策略草稿","Borrador de estrategia actual del servidor","Brouillon de stratégie actuel du serveur"],
  draftNotice: ["현재 서버에서 확인한 초안입니다. 승인된 전략 버전이나 실행 결과와 다를 수 있습니다.","This is the draft retrieved from the server. It may differ from the approved strategy version or from execution results.","現在サーバーで確認したドラフトです。承認済みの戦略バージョンや実行結果と異なる場合があります。","这是当前从服务器确认的草稿。可能与已批准的策略版本或执行结果不同。","這是目前從伺服器確認的草稿。可能與已核准的策略版本或執行結果不同。","Este es el borrador consultado en el servidor. Puede diferir de la versión aprobada de la estrategia o de los resultados de ejecución.","Il s'agit du brouillon consulté sur le serveur. Il peut différer de la version approuvée de la stratégie ou des résultats d'exécution."],
  workflowNotice: ["검증과 승인은 각각 요청해야 진행됩니다.","Verification and approval must be requested separately to proceed.","検証と承認はそれぞれリクエストする必要があります。","验证和批准需分别请求方可进行。","驗證與批准需分別請求方可進行。","La verificación y la aprobación deben solicitarse por separado para continuar.","La vérification et l'approbation doivent être demandées séparément pour continuer."],
  features: ["사용 지표","Indicators used","使用指標","使用的指标","使用的指標","Indicadores utilizados","Indicateurs utilisés"],
  noFeatures: ["등록된 지표가 없습니다.","No indicators are registered.","登録された指標はありません。","没有已登记的指标。","沒有已登錄的指標。","No hay indicadores registrados.","Aucun indicateur enregistré."],
  entries: ["진입 조건","Entry conditions","エントリー条件","入场条件","進場條件","Condiciones de entrada","Conditions d'entrée"],
  noEntries: ["등록된 진입 규칙이 없습니다.","No entry rules are registered.","登録されたエントリールールはありません。","没有已登记的入场规则。","沒有已登錄的進場規則。","No hay reglas de entrada registradas.","Aucune règle d'entrée enregistrée."],
  clockSet: ["봉 마감 시 봉당 한 번 평가합니다.","Evaluated once per bar, at bar close.","足の確定時に1本につき1回評価します。","在K线收盘时每根K线评估一次。","在K線收盤時每根K線評估一次。","Se evalúa una vez por vela, al cierre de la vela.","Évalué une fois par bougie, à la clôture de la bougie."],
  clockUnset: ["평가 시점은 미정입니다.","The evaluation timing is undetermined.","評価時点は未定です。","评估时点未定。","評估時點未定。","El momento de evaluación está sin definir.","Le moment de l'évaluation n'est pas défini."],
  longEntry: ["롱 진입","Long entry","ロングエントリー","做多入场","做多進場","Entrada en largo","Entrée longue"],
  positionRule: ["보유 포지션이 있으면 건너뜁니다. 조건이 충족되지 않으면 다시 활성화합니다.","Skipped if a position is held. Re-activated when the condition is not met.","保有ポジションがある場合はスキップします。条件が満たされない場合は再び有効化します。","如有持仓则跳过。条件不满足时重新启用。","如有持倉則跳過。條件不滿足時重新啟用。","Se omite si hay una posición abierta. Se reactiva cuando la condición no se cumple.","Ignoré si une position est ouverte. Réactivé lorsque la condition n'est pas remplie."],
  ruleInfo: ["규칙 정보","Rule information","ルール情報","规则信息","規則資訊","Información de la regla","Informations sur la règle"],
  ruleId: ["규칙 ID","Rule ID","ルールID","规则 ID","規則 ID","ID de la regla","ID de la règle"],
  entryOrder: ["진입 주문","Entry order","エントリー注文","入场订单","進場訂單","Orden de entrada","Ordre d'entrée"],
  marketOrder: ["시장가","Market","成行","市价","市價","A mercado","Au marché"],
  exits: ["청산 조건","Exit conditions","決済条件","平仓条件","平倉條件","Condiciones de salida","Conditions de sortie"],
  noExits: ["등록된 청산 규칙이 없습니다.","No exit rules are registered.","登録された決済ルールはありません。","没有已登记的平仓规则。","沒有已登錄的平倉規則。","No hay reglas de salida registradas.","Aucune règle de sortie enregistrée."],
  distanceNotice: ["거리 비율은 진입 체결가를 기준으로 합니다. 계좌 손익률이나 해당 가격의 체결 보장이 아닙니다.","Distance ratios are based on the entry fill price. They are not the account profit and loss rate, nor an assurance of a fill at that price.","距離比率はエントリー約定価格を基準とします。口座の損益率ではなく、その価格での約定を保証するものでもありません。","距离比例以入场成交价为基准。它不是账户盈亏率，也不表示能在该价格成交。","距離比例以進場成交價為基準。它不是帳戶損益率，也不表示能在該價格成交。","Los porcentajes de distancia se basan en el precio de ejecución de entrada. No son el porcentaje de pérdidas y ganancias de la cuenta ni aseguran una ejecución a ese precio.","Les pourcentages de distance sont basés sur le prix d'exécution d'entrée. Ils ne correspondent pas au taux de profits et pertes du compte et n'assurent pas une exécution à ce prix."],
  stopLoss: ["손절 거리","Stop-loss distance","損切り距離","止损距离","停損距離","Distancia del stop loss","Distance du stop-loss"],
  takeProfit: ["익절 거리","Take-profit distance","利確距離","止盈距离","停利距離","Distancia del take profit","Distance du take-profit"],
  exitExecution: ["마크 가격 기준 · 시장가 · 포지션 축소 전용","Based on mark price · Market · Reduce-only","マーク価格基準 · 成行 · ポジション縮小専用","以标记价格为基准 · 市价 · 仅减仓","以標記價格為基準 · 市價 · 僅減倉","Según el precio de marca · A mercado · Solo reducción de posición","Basé sur le prix mark · Au marché · Réduction de position uniquement"],
  rawDistance: ["거리 비율 원값","Raw distance ratio value","距離比率の元値","距离比例原始值","距離比例原始值","Valor bruto de la proporción de distancia","Valeur brute du rapport de distance"],
  priority: ["서버 우선순위 값","Server priority value","サーバー優先順位の値","服务器优先级值","伺服器優先順序值","Valor de prioridad del servidor","Valeur de priorité du serveur"],
  blockers: ["지원 범위 확인 필요","Supported scope needs to be checked","サポート範囲の確認が必要","需确认支持范围","需確認支援範圍","Es necesario comprobar el alcance admitido","Portée prise en charge à vérifier"],
  source: ["전체 조건과 시스템 위험 제한 보기","View the full conditions and system risk limits","全条件とシステムのリスク制限を見る","查看完整条件与系统风险限制","查看完整條件與系統風險限制","Ver todas las condiciones y los límites de riesgo del sistema","Voir toutes les conditions et les limites de risque du système"],
  sourceLabel: ["현재 서버 초안 전체 조건","Full conditions of the current server draft","現在のサーバードラフトの全条件","当前服务器草稿的完整条件","目前伺服器草稿的完整條件","Todas las condiciones del borrador actual del servidor","Toutes les conditions du brouillon actuel du serveur"],
  binding: ["초안 식별 정보","Draft identification information","ドラフト識別情報","草稿标识信息","草稿識別資訊","Información de identificación del borrador","Informations d'identification du brouillon"],
  conversationId: ["대화 ID","Conversation ID","会話ID","对话 ID","對話 ID","ID de conversación","ID de conversation"],
  draftId: ["초안 ID","Draft ID","ドラフトID","草稿 ID","草稿 ID","ID del borrador","ID du brouillon"],
  conversationRevision: ["대화 revision","Conversation revision","会話 revision","对话 revision","對話 revision","Revision de la conversación","Revision de la conversation"],
  draftRevision: ["초안 revision","Draft revision","ドラフト revision","草稿 revision","草稿 revision","Revision del borrador","Revision du brouillon"],
  conversationHash: ["대화 상태 hash","Conversation state hash","会話状態 hash","对话状态 hash","對話狀態 hash","Hash del estado de la conversación","Hash de l'état de la conversation"],
  open: ["시가","Open","始値","开盘价","開盤價","Apertura","Ouverture"],
  high: ["고가","High","高値","最高价","最高價","Máximo","Plus haut"],
  low: ["저가","Low","安値","最低价","最低價","Mínimo","Plus bas"],
  close: ["종가","Close","終値","收盘价","收盤價","Cierre","Clôture"],
  volume: ["거래량","Volume","出来高","成交量","成交量","Volumen","Volume"],
  price: ["가격","Price","価格","价格","價格","Precio","Prix"],
  index: ["지표값","Indicator value","指標値","指标值","指標值","Valor del indicador","Valeur de l'indicateur"],
  timeframe15m: ["15분봉","15-minute bars","15分足","15分钟K线","15分鐘K線","Velas de 15 minutos","Bougies de 15 minutes"],
  rsi: ["RSI ({period}봉, {source}, {timeframe})","RSI ({period} bars, {source}, {timeframe})","RSI（{period}本、{source}、{timeframe}）","RSI（{period}根K线，{source}，{timeframe}）","RSI（{period}根K線，{source}，{timeframe}）","RSI ({period} velas, {source}, {timeframe})","RSI ({period} bougies, {source}, {timeframe})"],
  sma: ["SMA 단순이동평균 ({period}봉, {source}, {timeframe})","SMA simple moving average ({period} bars, {source}, {timeframe})","SMA 単純移動平均（{period}本、{source}、{timeframe}）","SMA 简单移动平均（{period}根K线，{source}，{timeframe}）","SMA 簡單移動平均（{period}根K線，{source}，{timeframe}）","SMA media móvil simple ({period} velas, {source}, {timeframe})","SMA moyenne mobile simple ({period} bougies, {source}, {timeframe})"],
  ema: ["EMA 지수이동평균 ({period}봉, {source}, {timeframe})","EMA exponential moving average ({period} bars, {source}, {timeframe})","EMA 指数移動平均（{period}本、{source}、{timeframe}）","EMA 指数移动平均（{period}根K线，{source}，{timeframe}）","EMA 指數移動平均（{period}根K線，{source}，{timeframe}）","EMA media móvil exponencial ({period} velas, {source}, {timeframe})","EMA moyenne mobile exponentielle ({period} bougies, {source}, {timeframe})"],
  rolling_max: ["구간 최댓값 ({period}봉, {source}, {timeframe}, 현재 봉 제외)","Rolling maximum ({period} bars, {source}, {timeframe}, current bar excluded)","期間内最大値（{period}本、{source}、{timeframe}、現在の足を除く）","区间最大值（{period}根K线，{source}，{timeframe}，不含当前K线）","區間最大值（{period}根K線，{source}，{timeframe}，不含目前K線）","Máximo del intervalo ({period} velas, {source}, {timeframe}, excluida la vela actual)","Maximum de la période ({period} bougies, {source}, {timeframe}, bougie actuelle exclue)"],
  rolling_min: ["구간 최솟값 ({period}봉, {source}, {timeframe}, 현재 봉 제외)","Rolling minimum ({period} bars, {source}, {timeframe}, current bar excluded)","期間内最小値（{period}本、{source}、{timeframe}、現在の足を除く）","区间最小值（{period}根K线，{source}，{timeframe}，不含当前K线）","區間最小值（{period}根K線，{source}，{timeframe}，不含目前K線）","Mínimo del intervalo ({period} velas, {source}, {timeframe}, excluida la vela actual)","Minimum de la période ({period} bougies, {source}, {timeframe}, bougie actuelle exclue)"],
  rateUnconfirmed: ["비율 확인 필요","Ratio needs to be checked","比率の確認が必要","需确认比例","需確認比例","Proporción sin confirmar","Rapport non confirmé"],
  featureUnconfirmed: ["지표 ID {id} (확인 필요)","Indicator ID {id} (needs checking)","指標ID {id}（確認が必要）","指标 ID {id}（需确认）","指標 ID {id}（需確認）","ID de indicador {id} (requiere comprobación)","ID d'indicateur {id} (à vérifier)"],
  missingFeature: ["지표 ID {id}: 참조 대상을 찾을 수 없습니다. 전체 조건 원문을 확인해주세요.","Indicator ID {id}: the referenced target could not be found. Please check the original text of the full conditions.","指標ID {id}：参照対象が見つかりません。全条件の原文を確認してください。","指标 ID {id}：找不到引用对象。请查看完整条件原文。","指標 ID {id}：找不到引用對象。請查看完整條件原文。","ID de indicador {id}: no se encuentra el elemento referenciado. Consulte el texto original de todas las condiciones.","ID d'indicateur {id} : la référence est introuvable. Veuillez consulter le texte original de toutes les conditions."],
  duplicateFeature: ["지표 ID {id}: 중복된 ID로 참조 대상을 정할 수 없습니다. 전체 조건 원문을 확인해주세요.","Indicator ID {id}: the referenced target cannot be determined because the ID is duplicated. Please check the original text of the full conditions.","指標ID {id}：IDが重複しているため参照対象を特定できません。全条件の原文を確認してください。","指标 ID {id}：ID 重复，无法确定引用对象。请查看完整条件原文。","指標 ID {id}：ID 重複，無法確定引用對象。請查看完整條件原文。","ID de indicador {id}: el ID está duplicado y no se puede determinar el elemento referenciado. Consulte el texto original de todas las condiciones.","ID d'indicateur {id} : l'ID est en double, la référence ne peut pas être déterminée. Veuillez consulter le texte original de toutes les conditions."],
  complexityWarning: ["조건이 너무 깊거나 길거나 순환하여 전체 설명을 표시하지 않았습니다. 전체 조건 원문을 확인해주세요.","The condition is too deep, too long, or circular, so the full description was not displayed. Please check the original text of the full conditions.","条件が深すぎる、長すぎる、または循環しているため、全体の説明を表示しませんでした。全条件の原文を確認してください。","条件过深、过长或存在循环，因此未显示完整说明。请查看完整条件原文。","條件過深、過長或存在循環，因此未顯示完整說明。請查看完整條件原文。","La condición es demasiado profunda, demasiado larga o circular, por lo que no se mostró la descripción completa. Consulte el texto original de todas las condiciones.","La condition est trop profonde, trop longue ou circulaire : la description complète n'a pas été affichée. Veuillez consulter le texte original de toutes les conditions."],
  logicalWarning: ["논리 조건에 필요한 하위 조건이 부족하여 설명을 표시하지 않았습니다. 전체 조건 원문을 확인해주세요.","The logical condition lacks the required sub-conditions, so the description was not displayed. Please check the original text of the full conditions.","論理条件に必要な下位条件が不足しているため、説明を表示しませんでした。全条件の原文を確認してください。","逻辑条件缺少所需的子条件，因此未显示说明。请查看完整条件原文。","邏輯條件缺少所需的子條件，因此未顯示說明。請查看完整條件原文。","La condición lógica carece de las subcondiciones necesarias, por lo que no se mostró la descripción. Consulte el texto original de todas las condiciones.","La condition logique manque des sous-conditions requises : la description n'a pas été affichée. Veuillez consulter le texte original de toutes les conditions."],
  conditionFallback: ["조건 설명 확인 필요 · 전체 조건 원문을 확인해주세요.","Condition description needs to be checked · Please check the original text of the full conditions.","条件の説明の確認が必要 · 全条件の原文を確認してください。","需确认条件说明 · 请查看完整条件原文。","需確認條件說明 · 請查看完整條件原文。","Es necesario comprobar la descripción de la condición · Consulte el texto original de todas las condiciones.","Description de la condition à vérifier · Veuillez consulter le texte original de toutes les conditions."],
  and: ["그리고","and","かつ","并且","並且","y","et"],
  or: ["또는","or","または","或者","或者","o","ou"],
  crossAbove: ["{left} 값이 {right} 값을 상향 교차","{left} value crosses above {right} value","{left} の値が {right} の値を上抜け","{left} 值向上穿越 {right} 值","{left} 值向上穿越 {right} 值","El valor de {left} cruza al alza el valor de {right}","La valeur de {left} croise à la hausse la valeur de {right}"],
  crossBelow: ["{left} 값이 {right} 값을 하향 교차","{left} value crosses below {right} value","{left} の値が {right} の値を下抜け","{left} 值向下穿越 {right} 值","{left} 值向下穿越 {right} 值","El valor de {left} cruza a la baja el valor de {right}","La valeur de {left} croise à la baisse la valeur de {right}"],
} as const satisfies Record<string, Translations>
export type NativeStrategyTextKey = keyof typeof nativeStrategyCopy

export function nativeStrategyText(language: ClientLanguage, key: NativeStrategyTextKey, values: Readonly<Record<string, string | number>> = {}): string {
  // One pass with a callback: inserted IDs/values are literal, including $&
  // and placeholder-looking text. Never interpret a server value as a template.
  return nativeStrategyCopy[key][column[language]].replace(/\{([a-z]+)\}/g, (placeholder, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : placeholder)
}
