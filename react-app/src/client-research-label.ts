import type { ClientLanguage } from './client-preferences'

/** Distinguish the saved base document from the current result's plan CTA. */
const previousResearchLabels: Record<ClientLanguage, string> = {
  ko: '이전 연구 문서', en: 'Previous Research Doc', ja: '過去の研究文書',
  'zh-CN': '先前研究文档', 'zh-TW': '先前研究文件',
  es: 'Doc. de investigación previo', fr: 'Doc. de recherche précédent',
}
export const previousResearchLabel = (language: ClientLanguage) => previousResearchLabels[language]

/** tesia-lab 311ffb2 G_LBL: display only, never rewrite document IDs or evidence. */
const labels: Readonly<Record<string, string>> = {
  'Strategy Architect': '전략 설계', 'Quant Validator': '백테스트 검증',
  'Sanity Check': '무결성 점검', 'Strategy Critic': '비판 검토',
  'Risk Reviewer': '위험 심사', 'Market Context': '시장 데이터',
  Explanation: '쉬운 설명', 'Sealed Holdout': '봉인 구간',
  'Research Verdict': '종합 판정', 'Research Plan': '연구 계획',
  'Final Report': '검증 결과', Activity: '연구 과정', Hypothesis: '가설',
  'Critic Review': '비판 검토 기록', 'Stress Test': '스트레스 테스트',
  'Holdout Test': '봉인 구간 검증', Artifacts: '연구 문서', 'Research Team': 'AI 연구팀',
  'Research 데이터': '연구 데이터', 'Holdout 데이터': '봉인 구간',
  'Investment Hypothesis': '투자 가설',
}

export function clientResearchLabel(value: string, language: ClientLanguage = 'ko'): string {
  // Other languages keep their existing label, not a silent Korean override.
  if (language !== 'ko') return value
  if (Object.hasOwn(labels, value)) return labels[value]
  const version = /^(Backtest|Strategy) v(\d+)$/.exec(value)
  return version ? `${version[1] === 'Backtest' ? '백테스트' : '전략'} v${version[2]}` : value
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
