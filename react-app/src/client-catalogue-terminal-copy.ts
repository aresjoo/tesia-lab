import type { ClientLanguage } from './client-preferences'

const languages = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const
const copy = {
  choose: ['복사한 전략', 'Copied strategies', 'コピーした戦略', '已复制策略', '已複製策略', 'Estrategias copiadas', 'Stratégies copiées'],
  agent: ['AI 판단', 'AI decisions', 'AI判断', 'AI判断', 'AI判斷', 'Decisiones de IA', 'Décisions IA'],
  mix: ['혼합 전략', 'Hybrid strategy', 'ハイブリッド戦略', '混合策略', '混合策略', 'Estrategia híbrida', 'Stratégie hybride'],
  rule: ['차트 규칙', 'Chart rules', 'チャートルール', '图表规则', '圖表規則', 'Reglas del gráfico', 'Règles du graphique'],
  holding: ['{assets} 보유하고 있습니다', 'Holding {assets}', '{assets}を保有しています', '正在持有{assets}', '正在持有{assets}', 'Manteniendo {assets}', 'Détention de {assets}'],
  waiting: ['현금으로 기다리고 있습니다', 'Waiting in cash', '現金で待機しています', '持现金观望', '持現金觀望', 'Esperando en efectivo', 'En attente, en liquidités'],
  signal: ['{asset} 진입 신호를 기다리고 있습니다', 'Waiting for a {asset} entry signal', '{asset}のエントリーシグナルを待っています', '等待{asset}入场信号', '等待{asset}進場訊號', 'Esperando una señal de entrada en {asset}', 'En attente d’un signal d’entrée sur {asset}'],
  position: ['포지션', 'Position', 'ポジション', '仓位', '部位', 'Posición', 'Position'],
  none: ['없음', 'None', 'なし', '无', '無', 'Ninguna', 'Aucune'],
  spot: ['보유', 'Holding', '保有', '持有', '持有', 'En cartera', 'Détenu'],
  weight: ['비중', 'Weight', '比率', '比重', '比重', 'Peso', 'Pondération'],
  cash: ['현금', 'Cash', '現金', '现金', '現金', 'Efectivo', 'Liquidités'],
  selected: ['선정 종목', 'Selected asset', '選定銘柄', '选定资产', '選定資產', 'Activo elegido', 'Actif sélectionné'],
  exit: ['정리 기준', 'Exit condition', '決済条件', '退出条件', '出場條件', 'Condición de salida', 'Condition de sortie'],
  trail: ['유리한 가격에서 {percent}% 되돌리면', 'A {percent}% reversal from the favorable price', '有利な価格から{percent}%戻ったら', '从有利价格回撤{percent}%', '從有利價格回撤{percent}%', 'Retroceso del {percent}% desde el precio favorable', 'Repli de {percent}% depuis le prix favorable'],
  stop: ['진입가에서 {percent}% 불리하면', 'A {percent}% adverse move from entry', 'エントリー価格から{percent}%不利に動いたら', '从入场价不利变动{percent}%', '從進場價不利變動{percent}%', 'Movimiento adverso del {percent}% desde la entrada', 'Mouvement défavorable de {percent}% depuis l’entrée'],
  rerank: ['재평가에서 방향이나 순위가 바뀌면', 'Direction or rank changes at reassessment', '再評価で方向や順位が変わったら', '重新评估时方向或排名改变', '重新評估時方向或排名改變', 'Cambio de dirección o rango al reevaluar', 'Changement de direction ou de rang à la réévaluation'],
  agentExit: ['고점 대비 -{percent}%, 재평가 순위 하락', '-{percent}% from the high or a lower rank at reassessment', '高値から-{percent}%、再評価で順位低下', '较高点-{percent}%或重新评估排名下降', '較高點-{percent}%或重新評估排名下降', '-{percent}% desde máximos o descenso de rango', '-{percent}% depuis le sommet ou baisse de rang'],
  stopTarget: ['손절 {stop}%', 'Stop loss {stop}%', '損切り{stop}%', '止损{stop}%', '停損{stop}%', 'Stop loss {stop}%', 'Stop loss {stop}%'],
  target: [', 익절 +{target}%', ', take profit +{target}%', '、利確+{target}%', '，止盈+{target}%', '，停利+{target}%', ', beneficio +{target}%', ', prise de profit +{target}%'],
  thought: ['TETH의 생각', 'TETH’s view', 'TETHの見解', 'TETH的观点', 'TETH的觀點', 'La visión de TETH', 'Le point de vue de TETH'],
  more: ['더 보기', 'Read more', 'もっと見る', '展开', '展開', 'Ver más', 'Voir plus'],
  less: ['접기', 'Collapse', '閉じる', '收起', '收合', 'Contraer', 'Réduire'],
  full: ['판단 전문', 'Full explanation', '判断の全文', '判断全文', '判斷全文', 'Explicación completa', 'Explication complète'],
  manage: ['복사 관리', 'Manage copy', 'コピー管理', '管理复制', '管理複製', 'Gestionar copia', 'Gérer la copie'],
  find: ['전략 더 찾기', 'Find more strategies', '他の戦略を探す', '查找更多策略', '尋找更多策略', 'Buscar más estrategias', 'Trouver d’autres stratégies'],
  basis: ['원본 전략 · {date} 기준', 'Source strategy · As of {date}', '元の戦略 · {date}時点', '原始策略 · 截至{date}', '原始策略 · 截至{date}', 'Estrategia original · A {date}', 'Stratégie source · Au {date}'],
  preview: ['원본 스냅샷의 규칙 설명입니다. 실제 계좌 보유·주문·AI 응답이 아닙니다.', 'Rule explanations from the source snapshot, not live holdings, orders or AI responses.', '元のスナップショットのルール説明です。実口座の保有・注文・AI応答ではありません。', '原始快照的规则说明，并非实际持仓、订单或AI回复。', '原始快照的規則說明，並非實際持倉、訂單或AI回覆。', 'Explicaciones del snapshot original, no posiciones reales, órdenes ni respuestas de IA.', 'Explications du snapshot source, pas des positions réelles, des ordres ou des réponses IA.'],
} as const
export function catalogueTerminalText(language: ClientLanguage, key: keyof typeof copy, values: Readonly<Record<string, string>> = {}): string {
  return copy[key][languages.indexOf(language)].replace(/\{(\w+)\}/g, (token, name: string) => values[name] ?? token)
}
