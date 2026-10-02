import type { ClientLanguage } from './client-preferences'

/** Original source lifecycle copy. Never translate or reinterpret supplied event text. */
type Translations = readonly [string, string, string, string, string, string, string]
const column = { ko: 0, en: 1, ja: 2, 'zh-CN': 3, 'zh-TW': 4, es: 5, fr: 6 } as const satisfies Record<ClientLanguage, number>
export const lifecycleCopy = {
  "title": [
    "{asset} LONG 거래 추적",
    "{asset} LONG trade tracking",
    "{asset} LONG 取引トラッキング",
    "{asset} LONG 交易追踪",
    "{asset} LONG 交易追蹤",
    "Seguimiento de la operación LONG de {asset}",
    "Suivi de l'opération LONG de {asset}"
  ],
  "region": [
    "거래 판단 기록",
    "Trade decision log",
    "取引判断記録",
    "交易判断记录",
    "交易判斷紀錄",
    "Registro de decisiones de la operación",
    "Journal des décisions de l'opération"
  ],
  "close": [
    "닫기",
    "Close",
    "閉じる",
    "关闭",
    "關閉",
    "Cerrar",
    "Fermer"
  ],
  "empty": [
    "거래 판단 기록이 제공되지 않았습니다.",
    "No trade decision log was provided.",
    "取引判断記録は提供されていません。",
    "未提供交易判断记录。",
    "未提供交易判斷紀錄。",
    "No se proporcionó el registro de decisiones de la operación.",
    "Aucun journal des décisions de l'opération n'a été fourni."
  ],
  "entryDecision": [
    "진입 결정",
    "Entry decision",
    "エントリー決定",
    "入场决策",
    "進場決策",
    "Decisión de entrada",
    "Décision d'entrée"
  ],
  "orderCreated": [
    "주문 생성",
    "Order created",
    "注文作成",
    "订单生成",
    "訂單生成",
    "Orden creada",
    "Ordre créé"
  ],
  "fill": [
    "체결",
    "Fill",
    "約定",
    "成交",
    "成交",
    "Ejecución",
    "Exécution"
  ],
  "positionManagement": [
    "포지션 관리",
    "Position management",
    "ポジション管理",
    "持仓管理",
    "持倉管理",
    "Gestión de la posición",
    "Gestion de la position"
  ],
  "exitDecision": [
    "청산 결정",
    "Exit decision",
    "決済決定",
    "平仓决策",
    "平倉決策",
    "Decisión de salida",
    "Décision de sortie"
  ],
  "exitFill": [
    "청산 체결",
    "Exit fill",
    "決済約定",
    "平仓成交",
    "平倉成交",
    "Ejecución de salida",
    "Exécution de sortie"
  ],
  "finalResult": [
    "최종 결과",
    "Final result",
    "最終結果",
    "最终结果",
    "最終結果",
    "Resultado final",
    "Résultat final"
  ],
  "conditionsMet": [
    "조건 충족",
    "Conditions met",
    "条件成立",
    "条件满足",
    "條件滿足",
    "Condiciones cumplidas",
    "Conditions remplies"
  ],
  "marketBuy": [
    "시장가 매수, 수량 {quantity}",
    "Market buy, quantity {quantity}",
    "成行買い、数量 {quantity}",
    "市价买入，数量 {quantity}",
    "市價買入，數量 {quantity}",
    "Compra a mercado, cantidad {quantity}",
    "Achat au marché, quantité {quantity}"
  ],
  "validated": [
    "검증 통과 설정으로 자동 생성",
    "Automatic creation from the settings that passed validation",
    "検証を通過した設定で自動生成",
    "按通过验证的设置自动生成",
    "依通過驗證的設定自動生成",
    "Creación automática con los ajustes que pasaron la validación",
    "Création automatique à partir des paramètres ayant passé la validation"
  ],
  "filled": [
    "전량 체결 (시뮬레이션)",
    "Fully filled (simulation)",
    "全量約定（シミュレーション）",
    "全部成交（模拟）",
    "全部成交（模擬）",
    "Ejecución completa (simulación)",
    "Exécution intégrale (simulation)"
  ],
  "heldBars": [
    "{bars}봉 보유",
    "Held for {bars} bars",
    "{bars}本保有",
    "持仓 {bars} 根K线",
    "持倉 {bars} 根K線",
    "Mantenida {bars} velas",
    "Détenue pendant {bars} bougies"
  ],
  "heldBar": [
    "{bars}봉 보유",
    "Held for {bars} bar",
    "{bars}本保有",
    "持仓 {bars} 根K线",
    "持倉 {bars} 根K線",
    "Mantenida {bars} vela",
    "Détenue pendant {bars} bougie"
  ],
  "managing": [
    "매 봉 손절 {stop}%{target}, 25봉 규칙 평가, 조건 미도달로 유지",
    "Every bar: stop {stop}%{target}, 25-bar rule evaluated, held as the conditions were not reached",
    "毎足で損切り {stop}%{target}、25本ルールを評価、条件未達のため保有継続",
    "每根K线评估止损 {stop}%{target}、25根K线规则，条件未达成故继续持仓",
    "每根K線評估停損 {stop}%{target}、25根K線規則，條件未達成故繼續持倉",
    "Cada vela: stop {stop}%{target}, regla de 25 velas evaluada, se mantiene al no alcanzarse las condiciones",
    "À chaque bougie : stop {stop}%{target}, règle des 25 bougies évaluée, conservée faute de conditions atteintes"
  ],
  "target": [
    ", 익절 +{target}%",
    ", take profit +{target}%",
    "、利確 +{target}%",
    "，止盈 +{target}%",
    "，停利 +{target}%",
    ", take profit +{target}%",
    ", take-profit +{target}%"
  ],
  "immediateExit": [
    "진입 직후 청산 조건 도달",
    "Exit condition reached right after entry",
    "エントリー直後に決済条件に到達",
    "入场后随即达到平仓条件",
    "進場後隨即達到平倉條件",
    "Condición de salida alcanzada justo tras la entrada",
    "Condition de sortie atteinte juste après l'entrée"
  ],
  "ruleExecuted": [
    "규칙 실행",
    "Rule executed",
    "ルール実行",
    "规则执行",
    "規則執行",
    "Regla ejecutada",
    "Règle exécutée"
  ],
  "stopFill": [
    "손절 규칙가 기준 (시뮬레이션)",
    "At the stop-loss rule price (simulation)",
    "損切りルール価格基準（シミュレーション）",
    "以止损规则价为准（模拟）",
    "以停損規則價為準（模擬）",
    "Según el precio de la regla de stop loss (simulación)",
    "Au prix de la règle de stop-loss (simulation)"
  ],
  "targetFill": [
    "익절 규칙가 기준 (시뮬레이션)",
    "At the take-profit rule price (simulation)",
    "利確ルール価格基準（シミュレーション）",
    "以止盈规则价为准（模拟）",
    "以停利規則價為準（模擬）",
    "Según el precio de la regla de take profit (simulación)",
    "Au prix de la règle de take-profit (simulation)"
  ],
  "closeFill": [
    "종가 기준 (시뮬레이션)",
    "At the close price (simulation)",
    "終値基準（シミュレーション）",
    "以收盘价为准（模拟）",
    "以收盤價為準（模擬）",
    "Según el precio de cierre (simulación)",
    "Au cours de clôture (simulation)"
  ],
  "fees": [
    "수수료 왕복 {fee}% 반영",
    "Round-trip fee of {fee}% applied",
    "手数料 往復{fee}% を反映",
    "已计入往返手续费 {fee}%",
    "已計入來回手續費 {fee}%",
    "Comisión de ida y vuelta del {fee}% aplicada",
    "Frais aller-retour de {fee}% appliqués"
  ]
} as const satisfies Record<string, Translations>
export function lifecycleText(language: ClientLanguage, key: keyof typeof lifecycleCopy, values: Readonly<Record<string, string>> = {}): string {
  return lifecycleCopy[key][column[language]].replace(/\{([a-zA-Z]+)\}/g, (placeholder, name: string) => Object.hasOwn(values, name) ? values[name] : placeholder)
}
