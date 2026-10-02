import type { ClientLanguage } from './client-preferences'
import { sharedNumber, sharedPercent } from './client-shared-number-format'

/** Immutable, display-only observations from an existing source evaluation. */
export type SourceQuestionView = {
  question: 'whyEntry' | 'largestRisk' | 'nextEntry'
  rsi: number; threshold: number; rebound: number; gap: number | null; trend: boolean
  position: { change: number; distanceToStop: number } | null
  stop: number; target: number | null; mdd: number; worstTrade: number
}
const column = { ko: 0, en: 1, ja: 2, 'zh-CN': 3, 'zh-TW': 4, es: 5, fr: 6 } as const
type Row = readonly [string, string, string, string, string, string, string]
export const sourceQuestionCopy = {
  whyEntry: ['아직 진입하지 않은 이유', 'Why no entry yet', 'まだエントリーしていない理由', '尚未入场的原因', '尚未進場的原因', 'Por qué aún no ha entrado', 'Pourquoi aucune entrée'],
  largestRisk: ['가장 큰 위험', 'Largest risk', '最大のリスク', '最大风险', '最大風險', 'Mayor riesgo', 'Risque le plus important'],
  nextEntry: ['다음 진입 조건', 'Next entry conditions', '次のエントリー条件', '下一次入场条件', '下一次進場條件', 'Condiciones de la próxima entrada', 'Conditions de la prochaine entrée'],
  reduceRisk: ['위험 낮추기', 'Lower risk', 'リスクを下げる', '降低风险', '降低風險', 'Reducir riesgo', 'Réduire le risque'],
  scope: ['검증 마지막 시점 기준', 'At the end of validation', '検証最終時点の基準', '基于验证结束时点', '基於驗證結束時點', 'Al final de la validación', 'À la fin de la validation'],
  held: ['이미 롱 포지션을 보유하고 있어 새 진입 대신 청산 조건을 확인합니다.', 'A long position is already held; exit conditions are checked instead of a new entry.', 'すでにロングを保有しているため、新規エントリーではなく決済条件を確認します。', '已持有多头仓位，因此检查平仓条件而非新入场。', '已持有多頭部位，因此檢查平倉條件而非新進場。', 'Ya hay una posición larga; se comprueban las condiciones de salida en vez de una nueva entrada.', 'Une position longue est déjà détenue ; les conditions de sortie sont vérifiées plutôt qu’une nouvelle entrée.'],
  none: ['보유 포지션이 없습니다.', 'There is no open position.', '保有ポジションはありません。', '没有持仓。', '沒有持倉。', 'No hay una posición abierta.', 'Aucune position ouverte.'],
  rsi: ['전봉 RSI {value} / 진입 기준 {threshold} 미만', 'Previous RSI {value} / entry below {threshold}', '前足 RSI {value} / 基準 {threshold} 未満', '前根K线 RSI {value} / 入场低于 {threshold}', '前根K線 RSI {value} / 進場低於 {threshold}', 'RSI previo {value} / entrada por debajo de {threshold}', 'RSI précédent {value} / entrée sous {threshold}'],
  rebound: ['마지막 봉 반등 {value} / 진입 기준 +0.5% 초과', 'Last candle rebound {value} / entry above +0.5%', '最終足の反発 {value} / 基準 +0.5% 超', '最后K线反弹 {value} / 入场超过 +0.5%', '最後K線反彈 {value} / 進場超過 +0.5%', 'Rebote de la última vela {value} / entrada superior a +0.5%', 'Rebond de la dernière bougie {value} / entrée au-delà de +0.5%'],
  gap: ['20일·60일 평균 차이 {value} / 가격 대비 3% 초과', '20/60-day average gap {value} / over 3% of price', '20日・60日平均差 {value} / 価格比3%超', '20日与60日均线差 {value} / 超过价格的3%', '20日與60日均線差 {value} / 超過價格的3%', 'Diferencia de medias de 20/60 días {value} / más del 3% del precio', 'Écart des moyennes 20/60 jours {value} / plus de 3% du prix'],
  met: ['충족', 'Met', '充足', '满足', '滿足', 'Cumplido', 'Rempli'],
  unmet: ['미충족', 'Not met', '未充足', '未满足', '未滿足', 'No cumplido', 'Non rempli'],
  unknown: ['미확인', 'Unconfirmed', '未確認', '未确认', '未確認', 'Sin confirmar', 'Non confirmé'],
  entryRule: ['포지션이 없고 같은 봉 마감에 조건이 모두 맞으면 진입하는 규칙입니다.', 'The rule enters when no position is open and all conditions hold at the same candle close.', 'ポジションがなく、同じ足の終値で全条件を満たすとエントリーするルールです。', '规则是在没有持仓且同一K线收盘时满足全部条件后入场。', '規則是在沒有持倉且同一K線收盤時滿足全部條件後進場。', 'La regla entra si no hay posición y se cumplen todas las condiciones al cierre de la misma vela.', 'La règle entre sans position ouverte si toutes les conditions sont remplies à la clôture de la même bougie.'],
  positionRisk: ['보유 포지션 손익 {change}, 손절 기준가까지 {distance}입니다.', 'Position change {change}; distance above the stop price {distance}.', '保有ポジション損益 {change}、損切り基準価格まで {distance}です。', '持仓盈亏 {change}，距离止损价 {distance}。', '持倉損益 {change}，距離停損價 {distance}。', 'Cambio de la posición {change}; distancia sobre el precio de stop {distance}.', 'Variation de la position {change} ; distance au-dessus du prix stop {distance}.'],
  historyRisk: ['검증 구간 최대 낙폭 {mdd}, 가장 큰 단일 거래 손실 {worst}입니다.', 'Validation maximum drawdown {mdd}; largest single-trade loss {worst}.', '検証区間の最大ドローダウン {mdd}、最大単一取引損失 {worst}です。', '验证区间最大回撤 {mdd}，最大单笔交易亏损 {worst}。', '驗證區間最大回撤 {mdd}，最大單筆交易虧損 {worst}。', 'Caída máxima en la validación {mdd}; mayor pérdida por operación {worst}.', 'Baisse maximale en validation {mdd} ; perte maximale par transaction {worst}.'],
  riskLimit: ['손절 설정은 진입가 대비 {stop}입니다. 실제 체결가나 손실 한도를 보장하지는 않습니다.', 'The stop setting is {stop} from entry. It does not guarantee an execution price or loss limit.', '損切り設定はエントリー価格比 {stop}です。実際の約定価格や損失上限を保証しません。', '止损设置为入场价的 {stop}，不保证实际成交价或亏损上限。', '停損設定為進場價的 {stop}，不保證實際成交價或虧損上限。', 'El stop está a {stop} de la entrada. No garantiza precio de ejecución ni límite de pérdida.', 'Le stop est fixé à {stop} de l’entrée. Il ne garantit ni prix d’exécution ni plafond de perte.'],
  manage: ['바꾸기', 'Change', '変更', '修改', '修改', 'Cambiar', 'Modifier'],
  stop: ['손절 {value}', 'Stop-loss {value}', '損切り {value}', '止损 {value}', '停損 {value}', 'Stop-loss {value}', 'Stop-loss {value}'],
  target: ['익절 {value}', 'Take-profit {value}', '利確 {value}', '止盈 {value}', '停利 {value}', 'Take-profit {value}', 'Prise de bénéfices {value}'],
  budget: ['예산 {value}', 'Budget {value}', '予算 {value}', '预算 {value}', '預算 {value}', 'Presupuesto {value}', 'Budget {value}'],
} as const satisfies Record<string, Row>
export function sourceQuestionText(language: ClientLanguage, key: keyof typeof sourceQuestionCopy, values: Readonly<Record<string, string>> = {}) {
  return sourceQuestionCopy[key][column[language]].replace(/\{(\w+)\}/g, (token, name: string) => Object.hasOwn(values, name) ? values[name] : token)
}
/** No browser state, evaluator or private reasoning is imported here. */
export function projectSourceQuestion(view: SourceQuestionView, language: ClientLanguage) {
  const t = (key: keyof typeof sourceQuestionCopy, values?: Readonly<Record<string, string>>) => sourceQuestionText(language, key, values)
  const number = (value: number) => sharedNumber(value, language)
  const pct = (value: number) => sharedPercent(value, language)
  const check = (text: string, met: boolean | null) => `${text} · ${t(met === null ? 'unknown' : met ? 'met' : 'unmet')}`
  const conditions = [check(t('rsi', { value: number(view.rsi), threshold: sharedNumber(view.threshold, language, 'auto') }), view.rsi < view.threshold), check(t('rebound', { value: pct(view.rebound) }), view.rebound > .5)]
  if (view.trend) conditions.push(check(t('gap', { value: view.gap === null ? '—' : pct(view.gap) }), view.gap === null ? null : view.gap > 3))
  const lines = view.question === 'largestRisk'
    ? [view.position ? t('positionRisk', { change: pct(view.position.change), distance: pct(view.position.distanceToStop) }) : t('none'), t('historyRisk', { mdd: pct(view.mdd), worst: pct(view.worstTrade) }), t('riskLimit', { stop: pct(view.stop) })]
    : view.question === 'whyEntry' && view.position ? [t('held'), t('stop', { value: pct(view.stop) }), ...(view.target === null ? [] : [t('target', { value: pct(view.target) })])] : [...conditions, t('entryRule')]
  return { kind: 'answer' as const, title: t(view.question), text: [t('scope'), ...lines].join('\n') }
}
