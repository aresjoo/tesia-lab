import type { ClientLanguage } from './client-preferences'

/** Distinguish the saved base document from the current result's plan CTA. */
const previousResearchLabels: Record<ClientLanguage, string> = {
  ko: '이전 연구 문서', en: 'Previous Research Doc', ja: '過去の研究文書',
  'zh-CN': '先前研究文档', 'zh-TW': '先前研究文件',
  es: 'Doc. de investigación previo', fr: 'Doc. de recherche précédent',
}
export const previousResearchLabel = (language: ClientLanguage) => previousResearchLabels[language]

/** tesia-lab 311ffb2 G_LBL: display only, never rewrite document IDs or evidence. */
const column = { ko: 0, en: 1, ja: 2, 'zh-CN': 3, 'zh-TW': 4, es: 5, fr: 6 } as const
type Translations = readonly [string, string, string, string, string, string, string]
const labels: Readonly<Record<string, Translations>> = {
  'Strategy Architect': ['전략 설계', 'Strategy Architect', '戦略設計', '策略设计', '策略設計', 'Diseño de estrategias', 'Conception de stratégies'],
  'Quant Validator': ['백테스트 검증', 'Quant Validator', 'バックテスト検証', '回测验证', '回測驗證', 'Validación de backtests', 'Validation des backtests'],
  'Sanity Check': ['무결성 점검', 'Sanity Check', '整合性チェック', '完整性检查', '完整性檢查', 'Comprobación de integridad', 'Contrôle d’intégrité'],
  'Strategy Critic': ['비판 검토', 'Strategy Critic', '批判的検討', '策略审查', '策略審查', 'Revisión crítica', 'Examen critique'],
  'Risk Reviewer': ['위험 심사', 'Risk Reviewer', 'リスク審査', '风险审核', '風險審核', 'Revisión de riesgos', 'Examen des risques'],
  'Market Context': ['시장 데이터', 'Market Context', '市場データ', '市场数据', '市場資料', 'Datos del mercado', 'Données de marché'],
  Explanation: ['쉬운 설명', 'Explanation', 'わかりやすい説明', '通俗说明', '淺白說明', 'Explicación sencilla', 'Explication simple'],
  'Sealed Holdout': ['봉인 구간', 'Sealed Holdout', '封印された検証区間', '封存留出区间', '封存保留區間', 'Periodo de reserva sellado', 'Période de réserve scellée'],
  'Research Verdict': ['종합 판정', 'Research Verdict', '総合判定', '综合判定', '綜合判定', 'Dictamen general', 'Verdict global'],
  'Research Plan': ['연구 계획', 'Research Plan', '研究計画', '研究计划', '研究計畫', 'Plan de investigación', 'Plan de recherche'],
  'Final Report': ['검증 결과', 'Final Report', '最終レポート', '最终报告', '最終報告', 'Informe final', 'Rapport final'],
  Activity: ['연구 과정', 'Activity', '研究過程', '研究过程', '研究過程', 'Actividad de investigación', 'Activité de recherche'],
  Hypothesis: ['가설', 'Hypothesis', '仮説', '假设', '假設', 'Hipótesis', 'Hypothèse'],
  'Critic Review': ['비판 검토 기록', 'Critic Review', '批判的レビュー', '批判性审查', '批判性審查', 'Revisión crítica', 'Revue critique'],
  'Stress Test': ['스트레스 테스트', 'Stress Test', 'ストレステスト', '压力测试', '壓力測試', 'Prueba de estrés', 'Test de résistance'],
  'Holdout Test': ['봉인 구간 검증', 'Holdout Test', 'ホールドアウト検証', '留出验证', '保留區間驗證', 'Prueba sobre reserva', 'Test sur réserve'],
  Artifacts: ['연구 문서', 'Artifacts', '研究文書', '研究文档', '研究文件', 'Documentos de investigación', 'Documents de recherche'],
  'Research Team': ['AI 연구팀', 'Research Team', 'AI研究チーム', 'AI研究团队', 'AI研究團隊', 'Equipo de investigación de IA', 'Équipe de recherche IA'],
  'Research 데이터': ['연구 데이터', 'Research data', '研究データ', '研究数据', '研究資料', 'Datos de investigación', 'Données de recherche'],
  'Holdout 데이터': ['봉인 구간', 'Holdout data', 'ホールドアウトデータ', '留出数据', '保留區間資料', 'Datos de reserva', 'Données de réserve'],
  'Investment Hypothesis': ['투자 가설', 'Investment Hypothesis', '投資仮説', '投资假设', '投資假設', 'Hipótesis de inversión', 'Hypothèse d’investissement'],
  '거래소 연결': ['거래소 연결', 'Connect exchange', '取引所接続', '连接交易所', '連接交易所', 'Conectar una plataforma', 'Connecter une plateforme'],
  '실행 확인': ['실행 확인', 'Confirm execution', '実行確認', '确认执行', '確認執行', 'Confirmar ejecución', 'Confirmer l’exécution'],
  Live: ['Live', 'Live', 'ライブ', '实盘', '實盤', 'En vivo', 'En direct'],
}

export function isClientResearchSystemLabel(value: string): boolean {
  return Object.hasOwn(labels, value) || /^(Backtest|Strategy) v(\d+)$/.test(value)
}

export function clientResearchLabel(value: string, language: ClientLanguage = 'ko'): string {
  // Exact known system labels only. Unknown/authored titles remain verbatim.
  if (Object.hasOwn(labels, value)) return labels[value][column[language]]
  const version = /^(Backtest|Strategy) v(\d+)$/.exec(value)
  const names = version?.[1] === 'Backtest'
    ? ['백테스트', 'Backtest', 'バックテスト', '回测', '回測', 'Backtest', 'Backtest']
    : ['전략', 'Strategy', '戦略', '策略', '策略', 'Estrategia', 'Stratégie']
  return version ? `${names[column[language]]} v${version[2]}` : value
}

type TitleSession = { id: string; title: string; renamed?: boolean; pair: string; mode: string; idea: string }

/** Allocate a source-style title without changing an authored title or stored record. */
export function clientResearchAutoTitle(session: TitleSession, others: readonly TitleSession[]): string {
  // Legacy records without explicit provenance must not lose a potentially authored name.
  if (session.renamed !== false) return session.title
  if (!session.pair || !session.mode) return Array.from(session.idea).slice(0, 40).join('')
  if (session.mode !== 'dip' && session.mode !== 'trend') return session.title
  const asset = session.pair === 'BTC/USDT' ? '비트코인' : session.pair === 'ETH/USDT' ? '이더리움' : session.pair.split('/')[0]
  const base = `${asset}${session.mode === 'trend' ? ' 따라타기' : ' 눌림목 줍기'}`
  const occupied = new Set(others.filter(other => other.id !== session.id).map(other => other.title))
  // Keep an allocated suffix across follow-ups, even if an earlier chat was deleted.
  const suffix = session.title.startsWith(`${base} `) ? session.title.slice(base.length + 1) : ''
  if (session.title === base || /^(?:[2-9]\d*|1\d+)호$/.test(suffix)) return session.title
  let candidate = base
  for (let index = 2; occupied.has(candidate); index += 1) candidate = `${base} ${index}호`
  return candidate
}
