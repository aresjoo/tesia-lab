import type { ClientLanguage } from './client-preferences'

const column = { ko: 0, en: 1, ja: 2, 'zh-CN': 3, 'zh-TW': 4, es: 5, fr: 6 } as const
type Row = readonly [string, string, string, string, string, string, string]
/** Source-preview presentation only, not execution state or a service contract. */
export const sourceJudgmentCopy = {
  entry: ['진입 조건을 기다리고 있습니다', 'Waiting for entry conditions', 'エントリー条件を待っています', '正在等待入场条件', '正在等待進場條件', 'Esperando las condiciones de entrada', "En attente des conditions d’entrée"],
  exit: ['{asset} 롱 포지션을 보유하고 있습니다', 'Holding a long position in {asset}', '{asset}のロングポジションを保有しています', '持有 {asset} 多头仓位', '持有 {asset} 多頭倉位', 'Manteniendo una posición larga en {asset}', 'Position longue sur {asset} détenue'],
  off: ['일시정지 중입니다', 'Paused', '一時停止中です', '已暂停', '已暫停', 'En pausa', 'En pause'],
  ready: ['실행 전입니다', 'Not started yet', '実行前です', '尚未开始', '尚未開始', 'Aún no se ha iniciado', 'Pas encore démarré'],
  err: ['연결 오류로 멈췄습니다', 'Stopped due to a connection error', '接続エラーで停止しました', '因连接错误而停止', '因連線錯誤而停止', 'Detenido por un error de conexión', 'Arrêté suite à une erreur de connexion'],
  watch: ['AI 판단이 잠시 멈춰 있습니다', 'AI decisions are temporarily paused', 'AIの判断は一時停止中です', 'AI 判断暂时暂停', 'AI 判斷暫時暫停', 'Las decisiones de IA están en pausa', "Les décisions de l’IA sont en pause"],
  result: ['검증 마지막 시점의 상태입니다', 'State at the end of validation', '検証終了時点の状態です', '验证结束时的状态', '驗證結束時的狀態', 'Estado al final de la validación', 'État à la fin de la validation'],
  scope: ['일봉 시뮬레이션 · {date} 기준', 'Daily-bar simulation · as of {date}', '日足シミュレーション · {date}時点', '日线模拟 · 截至 {date}', '日線模擬 · 截至 {date}', 'Simulación diaria · a {date}', 'Simulation journalière · au {date}'],
  position: ['포지션', 'Position', 'ポジション', '持仓', '持倉', 'Posición', 'Position'],
  none: ['없음', 'None', 'なし', '无', '無', 'Ninguna', 'Aucune'],
  long: ['롱', 'Long', 'ロング', '多头', '多頭', 'Larga', 'Longue'],
  stop: ['손절', 'Stop loss', '損切り', '止损', '停損', 'Stop loss', 'Stop loss'],
  target: ['익절', 'Take profit', '利確', '止盈', '停利', 'Take profit', 'Take profit'],
  holding: ['보유 기간', 'Holding period', '保有期間', '持仓时间', '持倉時間', 'Tiempo de tenencia', 'Durée de détention'],
  days: ['{days}일, 최대 25일', '{days} days, maximum 25 days', '{days}日、最大25日', '{days} 天，最多 25 天', '{days} 天，最多 25 天', '{days} días, máximo 25 días', '{days} jours, maximum 25 jours'],
  oneDay: ['1일, 최대 25일', '1 day, maximum 25 days', '1日、最大25日', '1 天，最多 25 天', '1 天，最多 25 天', '1 día, máximo 25 días', '1 jour, maximum 25 jours'],
  fromEntry: ['진입가 대비 {percent}', '{percent} from entry', 'エントリー価格比 {percent}', '相对入场价 {percent}', '相對進場價 {percent}', '{percent} respecto a la entrada', '{percent} par rapport au prix d’entrée'],
  thought: ['TETH의 생각', 'TETH’s view', 'TETHの見解', 'TETH 的看法', 'TETH 的看法', 'La visión de TETH', 'Le point de vue de TETH'],
  appliedRules: ['검증에 적용한 규칙', 'Rules applied in validation', '検証に適用したルール', '验证中应用的规则', '驗證中套用的規則', 'Reglas aplicadas en la validación', 'Règles appliquées à la validation'],
  maintain: ['저는 정해 둔 청산 조건에 따라 {asset} 롱을 유지합니다.', 'I maintain the {asset} long position under the defined exit rules.', '設定された決済条件に従い、{asset}のロングを維持します。', '我按设定的平仓条件维持 {asset} 多头仓位。', '我按設定的平倉條件維持 {asset} 多頭倉位。', 'Mantengo la posición larga en {asset} según las reglas de salida definidas.', 'Je conserve la position longue sur {asset} selon les règles de sortie définies.'],
  exitRule: ['진입가 대비 {stop}에 닿거나{target} {days}일 뒤 보유 기간이 끝나면 정리합니다.', 'Exit at {stop} from entry,{target} or when the holding period ends in {days} days.', 'エントリー価格比{stop}に到達した場合、{target}または{days}日後に保有期間が終了した場合に決済します。', '相对入场价达到 {stop}、{target}或在 {days} 天后持仓期限结束时平仓。', '相對進場價達到 {stop}、{target}或在 {days} 天後持倉期限結束時平倉。', 'Cerrar al alcanzar {stop} desde la entrada,{target} o cuando termine el plazo de tenencia en {days} días.', 'Clôture à {stop} du prix d’entrée,{target} ou à la fin de la durée de détention dans {days} jours.'],
  targetClause: [' {percent}에 닿거나', ' at {percent} from entry,', '{percent}に到達した場合、', '达到 {percent}、', '達到 {percent}、', ' al alcanzar {percent},', ' à {percent} du prix d’entrée,'],
  waitRule: ['저는 지금 포지션 없이 기다립니다. RSI가 {rsi} 아래로 눌렸다가 하루 0.5% 넘게 반등하는 날에만 진입합니다.', 'I am waiting without a position. I enter only when RSI has fallen below {rsi} and the daily rebound exceeds 0.5%.', '今はポジションを持たずに待っています。RSIが{rsi}未満に下がり、1日で0.5%超反発した場合のみエントリーします。', '我目前空仓等待。仅在 RSI 低于 {rsi} 且日反弹超过 0.5% 时入场。', '我目前空倉等待。僅在 RSI 低於 {rsi} 且日反彈超過 0.5% 時進場。', 'Espero sin posición. Solo entro cuando el RSI ha caído por debajo de {rsi} y el rebote diario supera el 0,5%.', 'J’attends sans position. J’entre uniquement lorsque le RSI est passé sous {rsi} et que le rebond quotidien dépasse 0,5 %.'],
  pausedRule: ['일시정지 중이라 새 주문을 내지 않습니다. 다시 시작하면 다음 봉 마감부터 판단합니다.', 'No new orders while paused. Evaluation resumes at the next bar close after restarting.', '一時停止中は新しい注文を出しません。再開後、次の足の終値から判断します。', '暂停期间不下新订单。恢复后从下一根K线收盘开始评估。', '暫停期間不下新訂單。恢復後從下一根K線收盤開始評估。', 'No se envían nuevas órdenes en pausa. La evaluación se retoma al cierre de la siguiente vela tras reiniciar.', 'Aucun nouvel ordre pendant la pause. L’évaluation reprend à la clôture de la prochaine bougie après redémarrage.'],
  condition: ['진입 조건', 'Entry conditions', 'エントリー条件', '入场条件', '進場條件', 'Condiciones de entrada', "Conditions d’entrée"],
  bounce: ['RSI {rsi} 아래에서 0.5% 넘게 반등', 'RSI below {rsi} with a rebound above 0.5%', 'RSIが{rsi}未満で0.5%超の反発', 'RSI 低于 {rsi} 且反弹超过 0.5%', 'RSI 低於 {rsi} 且反彈超過 0.5%', 'RSI inferior a {rsi} con rebote superior al 0,5%', 'RSI inférieur à {rsi} et rebond supérieur à 0,5 %'],
  trend: [', 20일과 60일 평균 차이 3% 초과', ', 20- and 60-day average gap above 3%', '、20日と60日平均の差が3%超', '，20 日与 60 日均线差超过 3%', '，20 日與 60 日均線差超過 3%', ', diferencia entre medias de 20 y 60 días superior al 3%', ', écart entre les moyennes à 20 et 60 jours supérieur à 3 %'],
} as const satisfies Record<string, Row>

export function sourceJudgmentText(language: ClientLanguage, key: keyof typeof sourceJudgmentCopy, values: Readonly<Record<string, string>> = {}): string {
  return sourceJudgmentCopy[key][column[language]].replace(/\{(\w+)\}/g, (token, name: string) => Object.hasOwn(values, name) ? values[name] : token)
}
