import type { ClientLanguage } from './client-preferences'

const column = { ko: 0, en: 1, ja: 2, 'zh-CN': 3, 'zh-TW': 4, es: 5, fr: 6 } as const
type Translations = readonly [string, string, string, string, string, string, string]
/** Source sk-term labels; public rule evidence, not private model reasoning. */
export const ruleCheckCopy = {
  full: ['판단 전문', 'Full decision', '判断の全文', '判断全文', '判斷全文', 'Decisión completa', 'Décision complète'],
  holding: ['보유 유지', 'Holding', '保有維持', '继续持仓', '繼續持倉', 'Mantener posición', 'Maintien de la position'],
  trades: ['거래 기록', 'Trade history', '取引記録', '交易记录', '交易紀錄', 'Historial de operaciones', 'Historique des transactions'],
  count: ['{count}회', '{count} checks', '{count}回', '{count}次', '{count}次', '{count} evaluaciones', '{count} évaluations'],
  holdingSummary: ['손절과 익절 조건에 닿지 않아 그대로 들고 있습니다.', 'The position is held as stop-loss and take-profit conditions have not been reached.', '損切りと利確の条件に達していないため、保有を続けています。', '尚未达到止损和止盈条件，继续持仓。', '尚未達到停損和停利條件，繼續持倉。', 'Se mantiene la posición al no alcanzar las condiciones de stop-loss ni de toma de beneficios.', 'La position est conservée, les conditions de stop-loss et de prise de bénéfices ne sont pas atteintes.'],
  watchSummary: ['진입 조건이 맞지 않아 주문을 내지 않았습니다.', 'No order was placed because entry conditions were not met.', 'エントリー条件を満たしていないため、注文していません。', '未满足入场条件，因此未下单。', '未滿足進場條件，因此未下單。', 'No se envió ninguna orden porque no se cumplieron las condiciones de entrada.', 'Aucun ordre n’a été passé car les conditions d’entrée ne sont pas remplies.'],
  entrySummary: ['진입 조건이 모두 맞아 롱 포지션을 열었습니다.', 'All entry conditions were met and a long position was opened.', 'すべてのエントリー条件を満たし、ロングポジションを開きました。', '满足所有入场条件，已开立多头仓位。', '滿足所有進場條件，已開立多頭部位。', 'Se abrió una posición larga al cumplirse todas las condiciones de entrada.', 'Une position longue a été ouverte, toutes les conditions d’entrée étant remplies.'],
  tpSummary: ['익절 목표에 닿아 정리했습니다.', 'The position was closed at the take-profit target.', '利確目標に達したため決済しました。', '达到止盈目标后平仓。', '達到停利目標後平倉。', 'Se cerró la posición al alcanzar el objetivo de beneficios.', 'La position a été clôturée à l’objectif de prise de bénéfices.'],
  slSummary: ['손절 기준에 닿아 정리했습니다.', 'The position was closed at the stop-loss threshold.', '損切り基準に達したため決済しました。', '达到止损标准后平仓。', '達到停損標準後平倉。', 'Se cerró la posición al alcanzar el umbral de stop-loss.', 'La position a été clôturée au seuil de stop-loss.'],
  timeSummary: ['최대 보유 기간이 지나 정리했습니다.', 'The position was closed after the maximum holding period.', '最大保有期間を過ぎたため決済しました。', '超过最长持仓期限后平仓。', '超過最長持倉期限後平倉。', 'Se cerró la posición al superar el período máximo de tenencia.', 'La position a été clôturée après la durée maximale de détention.'],
  title: ['규칙 검사', 'Rule check', 'ルール検査', '规则检查', '規則檢查', 'Comprobación de reglas', 'Vérification des règles'],
  ok: ['충족', 'Met', '充足', '满足', '滿足', 'Cumplido', 'Rempli'],
  no: ['미충족', 'Not met', '未充足', '未满足', '未滿足', 'No cumplido', 'Non rempli'],
  hit: ['도달', 'Reached', '到達', '到达', '到達', 'Alcanzado', 'Atteint'],
  na: ['미도달', 'Not reached', '未到達', '未到达', '未到達', 'No alcanzado', 'Non atteint'],
  unknown: ['미확인', 'Unconfirmed', '未確認', '未确认', '未確認', 'Sin confirmar', 'Non confirmé'],
  rsi: ['전봉 RSI < {value}', 'Previous candle RSI < {value}', '前足 RSI < {value}', '前根K线 RSI < {value}', '前根K線 RSI < {value}', 'RSI vela previa < {value}', 'RSI bougie précédente < {value}'],
  bounce: ['반등 +0.5% 초과', 'Rebound > +0.5%', '反発 +0.5% 超', '反弹超过 +0.5%', '反彈超過 +0.5%', 'Rebote superior a +0.5%', 'Rebond supérieur à +0.5%'],
  trend: ['이평 괴리 > 3% (20/60)', 'MA disparity > 3% (20/60)', '移動平均乖離 > 3% (20/60)', '均线乖离 > 3% (20/60)', '均線乖離 > 3% (20/60)', 'Disparidad de MA > 3% (20/60)', 'Écart MA > 3% (20/60)'],
  holding25: ['25봉 청산', '25-bar exit', '25足決済', '25根K线平仓', '25根K線平倉', 'Cierre a 25 velas', 'Clôture à 25 bougies'],
  order: ['주문', 'Order', '注文', '订单', '訂單', 'Orden', 'Ordre'],
  risk: ['위험 규칙', 'Risk rules', 'リスクルール', '风控规则', '風控規則', 'Reglas de riesgo', 'Règles de risque'],
  result: ['결과', 'Result', '結果', '结果', '結果', 'Resultado', 'Résultat'],
  buy: ['시장가 매수', 'Market buy', '成行買い', '市价买入', '市價買入', 'Compra a mercado', 'Achat au marché'],
  sell: ['전량 시장가 매도', 'Sell all at market', '全量成行売り', '全部市价卖出', '全部市價賣出', 'Venta total a mercado', 'Vente totale au marché'],
  watch: ['관망 유지, {count}회, {days}일', 'Watching, {count} checks, {days} days', '静観維持、{count}回、{days}日', '保持观望，{count}次，{days}天', '保持觀望，{count}次，{days}天', 'Mantener espera, {count} veces, {days} días', "Maintien de l’attente, {count} fois, {days} jours"],
  expand: ['펼치기', 'Expand', '展開', '展开', '展開', 'Desplegar', 'Développer'],
  collapse: ['접기', 'Collapse', '折りたたむ', '收起', '收合', 'Contraer', 'Réduire'],
} as const satisfies Record<string, Translations>

export function ruleCheckText(language: ClientLanguage, key: keyof typeof ruleCheckCopy, values: Readonly<Record<string, string>> = {}) {
  return ruleCheckCopy[key][column[language]].replace(/\{([a-zA-Z]+)\}/g, (placeholder, name: string) => Object.hasOwn(values, name) ? values[name] : placeholder)
}
