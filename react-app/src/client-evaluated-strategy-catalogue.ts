import type { ListPerformance } from './client-strategy-list-performance'
import type { StrategyKind } from './client-strategy-classification'

/** Private local presentation contract. Never a service API or executable version. */
export type EvaluatedStrategy = {
  id: string; policyVersionId: string; kind: StrategyKind; name: string; description: string
  symbol: 'BTCUSDT'; market: 'crypto'; exchange: 'binance'; marketType: 'usd_m_perpetual'
  author: { type: 'model' | 'deterministic' | 'hybrid'; name: string; requestedModel: string | null; identityBasis: string | null }
  sourceAgentId: string | null; policy: Record<string, unknown>; provenance: Record<string, unknown>
  evaluation: { basis: string; status: 'evaluated'; returnPct: string; maxDrawdownPct: string; winRatePct: string | null; tradeCount: number; fillCount: number; failedDecisionCount: number }
  equity: { at: string; value: string }[]
  judgments: { id: string; at: string; sourceAction: string | null; effectiveAction: string | null; status: string; rationale: string | null; gate: { allowed: boolean; reason: string } | null }[]
  trades: { id: string; openedAt: string; closedAt: string; side: string; exitReason: string; netPnl: string; returnPct: string | null }[]
  /** Only the separate generated-policy parser may supply this display evidence. */
  discovery?: { sourceSha: string; policyHash: string; eligible: boolean; decisionIntervalHours: 1; displayNames?: Record<string, string> }
  operation: { status: 'historical_evaluation'; actualExecutionReady: false; copyReady: false; issuedStrategyVersionId: null }
}
export type EvaluatedCatalogue = { revision: string; month: '2026-09'; period: { startAt: string; endExclusive: string }; items: EvaluatedStrategy[]; rejected: number; counts: Record<StrategyKind, number>; sourceBindings?: Record<string, { sourceSha: string; sourceId: string; schema: string }> }
const sha = /^[a-f0-9]{64}$/
const kinds = ['agent', 'rule', 'mix'] as const
const basis = { agent: 'stored_ai_policy_replay', rule: 'deterministic_rule_replay', mix: 'stored_ai_signal_with_rule_gate' }
const authors = { agent: 'model', rule: 'deterministic', mix: 'hybrid' }
function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value) }
function keys(value: Record<string, unknown>, allowed: string[]) { return Object.keys(value).every(key => allowed.includes(key)) }
function text(value: unknown, max = 30000): value is string { return typeof value === 'string' && value.length <= max && value.trim().length > 0 }
function decimal(value: unknown): value is string { return typeof value === 'string' && /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(value) && value.length < 128 && Number.isFinite(Number(value)) }
function count(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 }
function timestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|\+00:00)$/.exec(value)
  if (!parts) return false
  const date = new Date(value)
  return Number.isFinite(date.getTime()) && [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()].every((part, index) => part === Number(parts[index + 1]))
}
const nullableText = (value: unknown) => value === null || text(value)

/** Mirrors producer canonical UTF-8 JSON; array order and original strings survive. */
export function canonicalCatalogueJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalCatalogueJson).join(',')}]`
  if (record(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalCatalogueJson(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}
export function localCatalogueEnabled(dev: boolean, hostname: string, service: boolean, optIn = false) {
  return dev && optIn && !service && ['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname)
}
const privatePublication = /(?:\b(?:api[_-]?key|access[_-]?token|token|secret|password|cookie|authorization)["']?\s*[=:]|\b(?:sk-(?:proj-)?|ghp_|github_pat_|xox[baprs]-)[a-z0-9_-]{16,}|\bAKIA[A-Z0-9]{16}\b|\bAIza[a-z0-9_-]{20,}|\bBearer\s+[a-z0-9._~+/-]{12,}|(?:^|[\s"'(])\/[a-z_.][^\s"')]*|\b[A-Z]:[\\/]|\\\\[a-z0-9_.-]+\\)/i
const prohibitedFields = new Set(['price', 'rawprice', 'entryprice', 'exitprice', 'markprice', 'quantity', 'funding', 'fundingrate', 'candles', 'contractbars', 'markbars', 'fundingevents', 'open', 'high', 'low', 'close', 'volume', 'rawreceipt', 'rawprompt', 'prompttext', 'prompt', 'promptpath', 'apikey', 'credentials', 'news', 'token', 'secret', 'cookie', 'password', 'authorization', 'privatepath'])
function safePublicJson(value: unknown, depth = 0): boolean {
  if (depth > 16) return false
  if (value === null || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value === 'string') return value.length <= 30000 && !privatePublication.test(value) && !/(?:Bearer\s+[A-Za-z0-9._-]+|\bsk-[A-Za-z0-9_-]{16,}|(?:\/home\/|\/Users\/|[A-Z]:\\Users\\))/i.test(value)
  if (Array.isArray(value)) return value.length <= 100000 && value.every(entry => safePublicJson(entry, depth + 1))
  return record(value) && Object.keys(value).length <= 100 && Object.entries(value).every(([key, entry]) => !prohibitedFields.has(key.replace(/[_-]/g, '').toLowerCase()) && !/(?:api.?key|access.?token|oauth.?secret|cookie|system.?prompt|raw.?receipt|private.?path)/i.test(key) && safePublicJson(entry, depth + 1))
}
function validItem(value: unknown, start: number, end: number, source: Record<string, unknown>): value is EvaluatedStrategy {
  if (!record(value) || !safePublicJson(value) || !text(value.id, 160) || !/^eval-[a-zA-Z0-9_-]+$/.test(value.id) || !sha.test(String(value.policyVersionId)) || !kinds.includes(value.kind as StrategyKind) || !text(value.name, 500) || !text(value.description) || value.symbol !== 'BTCUSDT' || value.market !== 'crypto' || value.exchange !== 'binance' || value.marketType !== 'usd_m_perpetual') return false
  if (!keys(value, ['id', 'policyVersionId', 'kind', 'name', 'description', 'symbol', 'market', 'exchange', 'marketType', 'author', 'sourceAgentId', 'policy', 'evaluation', 'equity', 'judgments', 'trades', 'operation', 'provenance'])) return false
  const kind = value.kind as StrategyKind, author = value.author, evaluation = value.evaluation, operation = value.operation
  if (!record(author) || author.type !== authors[kind] || !text(author.name, 500) || !nullableText(value.sourceAgentId) || !record(value.policy) || !Object.keys(value.policy).length || !record(value.provenance)) return false
  if (kind === 'rule' ? value.sourceAgentId !== null : !text(value.sourceAgentId, 500)) return false
  const provenance = value.provenance
  if (!keys(provenance, ['monthlySha256', 'receiptSha256', 'inputHash', 'engineSha256', 'sourceAccountSha256', 'policyDefinitionSha256', 'sourcePolicySha256', 'originalExecutionStatus']) || !keys(author, ['type', 'name', 'requestedModel', 'identityBasis'])) return false
  if (provenance.originalExecutionStatus !== 'verification_failed' || !['monthlySha256', 'receiptSha256', 'inputHash', 'engineSha256', 'sourceAccountSha256', 'policyDefinitionSha256'].every(key => typeof provenance[key] === 'string' && sha.test(provenance[key] as string))) return false
  if (!['monthlySha256', 'receiptSha256', 'inputHash', 'engineSha256'].every(key => provenance[key] === source[key]) || (provenance.sourcePolicySha256 !== undefined && !sha.test(String(provenance.sourcePolicySha256)))) return false
  if (kind !== 'rule' && (typeof provenance.sourcePolicySha256 !== 'string' || !sha.test(provenance.sourcePolicySha256))) return false
  if (!Object.values(value.policy).every(entry => entry === null || typeof entry === 'boolean' || text(entry))) return false
  if (kind === 'rule' ? author.requestedModel !== null || author.identityBasis !== null : !text(author.requestedModel, 500) || !['server_metadata', 'requested_cli_configured', 'requested_cli_reported'].includes(String(author.identityBasis))) return false
  if (kind !== 'rule' && !['Codex', 'Claude', 'Gemini', 'DeepSeek', 'Kimi', 'Qwen'].includes(String(author.name))) return false
  if (!record(operation) || operation.status !== 'historical_evaluation' || operation.actualExecutionReady !== false || operation.copyReady !== false || operation.issuedStrategyVersionId !== null) return false
  if (!keys(operation, ['status', 'actualExecutionReady', 'copyReady', 'issuedStrategyVersionId'])) return false
  if (!record(evaluation) || evaluation.basis !== basis[kind] || evaluation.status !== 'evaluated' || !decimal(evaluation.returnPct) || !decimal(evaluation.maxDrawdownPct) || !count(evaluation.tradeCount) || !count(evaluation.fillCount) || !count(evaluation.failedDecisionCount)) return false
  if (!keys(evaluation, ['basis', 'status', 'returnPct', 'maxDrawdownPct', 'winRatePct', 'tradeCount', 'fillCount', 'failedDecisionCount']) || Number(evaluation.maxDrawdownPct) < 0 || Number(evaluation.maxDrawdownPct) > 100) return false
  if (evaluation.tradeCount === 0 ? evaluation.winRatePct !== null : !decimal(evaluation.winRatePct) || Number(evaluation.winRatePct) < 0 || Number(evaluation.winRatePct) > 100) return false
  if (!Array.isArray(value.equity) || value.equity.length < 2 || value.equity.length > 100000) return false
  const inPeriod = (at: unknown, final = false) => timestamp(at) && Date.parse(at) >= start && (final ? Date.parse(at) <= end : Date.parse(at) < end)
  let previous = -Infinity
  for (const point of value.equity) {
    if (!record(point) || !keys(point, ['at', 'value']) || !inPeriod(point.at, true) || !decimal(point.value) || Number(point.value) <= 0 || Date.parse(String(point.at)) <= previous) return false
    previous = Date.parse(String(point.at))
  }
  const first = value.equity[0], last = value.equity.at(-1)!
  const normalized = value.equity.map(point => Number(point.value) / Number(first.value))
  if (!normalized.every(point => Number.isFinite(point) && point > 0)) return false
  let peak = 1, observedDrawdown = 0
  for (const point of normalized) { peak = Math.max(peak, point); observedDrawdown = Math.max(observedDrawdown, (peak - point) / peak * 100) }
  if (Number(evaluation.maxDrawdownPct) + 0.00001 < observedDrawdown) return false
  const computed = (Number(last.value) / Number(first.value) - 1) * 100
  if (!Number.isFinite(computed) || Math.abs(computed - Number(evaluation.returnPct)) > 0.00001) return false
  if (!Array.isArray(value.judgments) || !Array.isArray(value.trades) || value.judgments.length > 100000 || value.trades.length !== evaluation.tradeCount) return false
  const unique = (rows: unknown[]) => rows.every(row => record(row) && text(row.id, 200)) && new Set(rows.map(row => (row as Record<string, unknown>).id)).size === rows.length
  if (!unique(value.judgments) || !unique(value.trades)) return false
  const action = (entry: unknown) => entry === null || ['open_long', 'open_short', 'hold', 'close'].includes(String(entry))
  if (!value.judgments.every(row => record(row) && keys(row, ['id', 'at', 'sourceAction', 'effectiveAction', 'status', 'rationale', 'gate']) && inPeriod(row.at) && action(row.sourceAction) && action(row.effectiveAction) && ['executed', 'held', 'failed', 'rejected'].includes(String(row.status)) && (row.rationale === null || typeof row.rationale === 'string' && row.rationale.length <= 30000) && (row.gate === null || record(row.gate) && keys(row.gate, ['allowed', 'reason']) && typeof row.gate.allowed === 'boolean' && text(row.gate.reason)))) return false
  let previousJudgment = -Infinity
  for (const row of value.judgments) {
    const at = Date.parse(String(row.at))
    if (at <= previousJudgment) return false
    previousJudgment = at
    if (row.status === 'failed' && (row.sourceAction !== null || row.effectiveAction !== null || row.gate !== null)) return false
    if (row.status === 'held' && row.effectiveAction !== 'hold') return false
    if (['executed', 'rejected'].includes(String(row.status)) && !['open_long', 'open_short', 'close'].includes(String(row.effectiveAction))) return false
    if (row.status === 'executed' && row.gate?.allowed === false) return false
    if (kind !== 'mix' && (row.gate !== null || row.sourceAction !== row.effectiveAction)) return false
    if (kind === 'mix' && row.gate === null && row.sourceAction !== row.effectiveAction) return false
    if (kind === 'mix' && row.gate !== null && (!['open_long', 'open_short'].includes(String(row.sourceAction)) || row.effectiveAction !== (row.gate.allowed ? row.sourceAction : 'hold'))) return false
  }
  if (!value.trades.every(row => record(row) && keys(row, ['id', 'openedAt', 'closedAt', 'side', 'exitReason', 'netPnl', 'returnPct']) && inPeriod(row.openedAt) && inPeriod(row.closedAt, true) && Date.parse(String(row.closedAt)) >= Date.parse(String(row.openedAt)) && ['LONG', 'SHORT'].includes(String(row.side)) && text(row.exitReason, 500) && decimal(row.netPnl) && decimal(row.returnPct))) return false
  const wins = value.trades.filter(row => Number(row.netPnl) > 0).length
  if (value.trades.length && Math.abs(wins / value.trades.length * 100 - Number(evaluation.winRatePct)) > 0.00001) return false
  if (value.judgments.filter(row => row.status === 'failed').length !== evaluation.failedDecisionCount) return false
  return true
}

export async function parseEvaluatedCatalogue(input: unknown): Promise<EvaluatedCatalogue> {
  const invalid = () => { throw new Error('Invalid local evaluation catalogue') }
  if (!record(input) || input.schemaVersion !== 'arena-strategy-catalogue-0.1' || input.month !== '2026-09' || !sha.test(String(input.revision)) || !timestamp(input.generatedAt) || !record(input.period) || !timestamp(input.period.startAt) || !timestamp(input.period.endExclusive) || !record(input.source) || !record(input.rights) || input.rights.scope !== 'local_only' || input.rights.publicRedistributionAllowed !== false || !record(input.counts) || !Array.isArray(input.items) || input.items.length > 1000) return invalid()
  if (!keys(input, ['schemaVersion', 'revision', 'generatedAt', 'month', 'period', 'source', 'rights', 'counts', 'items']) || !keys(input.period, ['startAt', 'endExclusive']) || !keys(input.source, ['monthlySha256', 'receiptSha256', 'inputHash', 'manifestRawSha256', 'engineSha256']) || !keys(input.rights, ['scope', 'publicRedistributionAllowed']) || !keys(input.counts, [...kinds])) return invalid()
  if (!['monthlySha256', 'receiptSha256', 'inputHash', 'manifestRawSha256', 'engineSha256'].every(key => sha.test(String((input.source as Record<string, unknown>)[key])))) return invalid()
  const start = Date.parse(input.period.startAt as string), end = Date.parse(input.period.endExclusive as string)
  if (start !== Date.parse('2026-09-01T00:00:00Z') || end !== Date.parse('2026-10-01T00:00:00Z')) return invalid()
  const ids = new Set<string>()
  for (const item of input.items) { if (record(item) && typeof item.id === 'string') { if (ids.has(item.id)) return invalid(); ids.add(item.id) } }
  for (const kind of kinds) if (!count(input.counts[kind]) || input.counts[kind] !== input.items.filter(item => record(item) && item.kind === kind).length) return invalid()
  if (kinds.reduce((sum, kind) => sum + Number((input.counts as Record<string, unknown>)[kind]), 0) !== input.items.length) return invalid()
  const { revision, ...body } = input
  const hash = async (value: unknown) => {
    // Arena util canonical bytes include one trailing LF for every hash.
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalCatalogueJson(value) + '\n'))
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
  }
  if (await hash(body) !== revision) return invalid()
  const items: EvaluatedStrategy[] = []
  for (const item of input.items) {
    if (!validItem(item, start, end, input.source as Record<string, unknown>)) continue
    if (await hash(item.policy) !== item.provenance.policyDefinitionSha256) continue
    const binding = { id: item.id, definitionSha256: item.provenance.policyDefinitionSha256, sourcePolicySha256: item.provenance.sourcePolicySha256 ?? null, sourceAgentId: item.sourceAgentId, mode: item.policy.mode || item.policy.sourceMode || null, model: item.author.requestedModel, identityBasis: item.author.identityBasis }
    if (await hash(binding) !== item.policyVersionId) continue
    items.push(item)
  }
  return { revision: String(revision), month: '2026-09', period: { startAt: input.period.startAt as string, endExclusive: input.period.endExclusive as string }, counts: input.counts as Record<StrategyKind, number>, items, rejected: input.items.length - items.length }
}
export function evaluatedListPerformance(item: EvaluatedStrategy): ListPerformance {
  const base = Number(item.equity[0].value)
  return { values: item.equity.map(point => Number(point.value) / base), percent: Number(item.evaluation.returnPct), start: Date.parse(item.equity[0].at), end: Date.parse(item.equity.at(-1)!.at) }
}
const words = {
  ko: ['9월 수익률', '2026년 9월 · BTCUSDT · 거래 비용 반영', '9월 평가 자료를 불러오는 중이에요.', '9월 평가 자료를 읽지 못했어요.', '다시 시도', '검증하지 못한 항목은 표시하지 않습니다.', '승인된 전략 버전이 없어 복사할 수 없어요.', '종료 거래', '원 판단 → 적용 행동', '진입 조건', '운용 정책', '수수료·슬리피지·funding 반영', '판단 원문', '원 판단의 파생 평가이며, AI가 파생 계좌를 보고 새로 판단한 것이 아닙니다.', '모델 판단이 아닌 결정론적 기술 규칙 평가입니다.'],
  en: ['September return', 'September 2026 · BTCUSDT · Trading costs included', 'Loading September evaluations.', 'Could not read September evaluations.', 'Retry', 'Unvalidated items are omitted.', 'Copy requires an approved strategy version.', 'Closed trades', 'Source decision → effective action', 'Entry conditions', 'Operating policy', 'Fees, slippage and funding included', 'Original rationale', 'Derived from stored decisions; the AI did not reassess the derived account.', 'Deterministic technical rules, not model decisions.'],
  ja: ['9月収益率', '2026年9月 · BTCUSDT · 取引費用反映', '9月の評価を読み込み中です。', '9月の評価を読み込めませんでした。', '再試行', '未検証の項目は表示しません。', '承認された戦略バージョンが必要です。', '終了取引', '元の判断 → 適用行動', 'エントリー条件', '運用方針', '手数料・スリッページ・funding反映', '判断原文', '保存された判断の派生評価です。AIの再判断ではありません。', 'モデル判断ではなく決定論的技術ルール評価です。'],
  'zh-CN': ['9月收益率', '2026年9月 · BTCUSDT · 已含交易费用', '正在加载9月评估。', '无法读取9月评估。', '重试', '未验证项目不显示。', '复制需要已批准的策略版本。', '已结束交易', '原始判断 → 应用行动', '入场条件', '运行策略', '含手续费、滑点及funding', '判断原文', '基于存储判断的派生评估，AI没有对派生账户重新判断。', '确定性技术规则评估，不是模型判断。'],
  'zh-TW': ['9月收益率', '2026年9月 · BTCUSDT · 已含交易費用', '正在載入9月評估。', '無法讀取9月評估。', '重試', '未驗證項目不顯示。', '複製需要已批准的策略版本。', '已結束交易', '原始判斷 → 套用行動', '進場條件', '運作策略', '含手續費、滑點及funding', '判斷原文', '基於儲存判斷的衍生評估，AI沒有對衍生帳戶重新判斷。', '確定性技術規則評估，不是模型判斷。'],
  es: ['Rendimiento de septiembre', 'Septiembre de 2026 · BTCUSDT · Costes de negociación incluidos', 'Cargando evaluaciones de septiembre.', 'No se pudieron leer las evaluaciones.', 'Reintentar', 'Se omiten los elementos no validados.', 'Se requiere una versión de estrategia aprobada para copiar.', 'Operaciones cerradas', 'Decisión original → acción aplicada', 'Filtro técnico', 'Política operativa', 'Incluye comisiones, deslizamiento y funding', 'Razonamiento original', 'Evaluación derivada de decisiones guardadas; la IA no reevaluó la cuenta derivada.', 'Reglas técnicas deterministas, no decisiones de modelos.'],
  fr: ['Rendement de septembre', 'Septembre 2026 · BTCUSDT · Frais de transaction inclus', 'Chargement des évaluations de septembre.', 'Lecture des évaluations impossible.', 'Réessayer', 'Les éléments non validés sont omis.', 'Une version de stratégie approuvée est nécessaire pour copier.', 'Transactions clôturées', 'Décision originale → action appliquée', 'Filtre technique', 'Politique opérationnelle', 'Frais, glissement et funding inclus', 'Raisonnement original', 'Évaluation dérivée des décisions enregistrées ; l’IA n’a pas réévalué le compte dérivé.', 'Règles techniques déterministes, pas des décisions de modèles.'],
} as const
export type EvaluatedTextKey = 'return' | 'boundary' | 'loading' | 'error' | 'retry' | 'rejected' | 'copyUnavailable' | 'trades' | 'action' | 'gate' | 'policy' | 'costs' | 'rationale' | 'derived' | 'deterministic'
const wordKeys: EvaluatedTextKey[] = ['return', 'boundary', 'loading', 'error', 'retry', 'rejected', 'copyUnavailable', 'trades', 'action', 'gate', 'policy', 'costs', 'rationale', 'derived', 'deterministic']
export function evaluatedText(language: string, key: EvaluatedTextKey) { return (words[language as keyof typeof words] ?? words.en)[wordKeys.indexOf(key)] }

const evidenceLabels: Record<string, readonly string[]> = {
  open_long: ['롱 진입', 'Open long', 'ロングエントリー', '做多', '多頭進場', 'Abrir long', 'Ouvrir long'],
  open_short: ['숏 진입', 'Open short', 'ショートエントリー', '做空', '空頭進場', 'Abrir short', 'Ouvrir short'],
  hold: ['유지', 'Hold', '維持', '保持', '維持', 'Mantener', 'Maintenir'], close: ['청산', 'Close', '決済', '平仓', '平倉', 'Cerrar', 'Clôturer'],
  LONG: ['롱', 'Long', 'ロング', '多头', '多頭', 'Long', 'Long'], SHORT: ['숏', 'Short', 'ショート', '空头', '空頭', 'Short', 'Short'],
  executed: ['적용', 'Applied', '適用', '已应用', '已套用', 'Aplicada', 'Appliquée'], held: ['유지', 'Held', '維持', '保持', '維持', 'Mantenida', 'Maintenue'],
  failed: ['판단 실패', 'Decision failed', '判断失敗', '判断失败', '判斷失敗', 'Decisión fallida', 'Décision échouée'], rejected: ['거절', 'Rejected', '拒否', '已拒绝', '已拒絕', 'Rechazada', 'Rejetée'],
  decision_close: ['판단 청산', 'Decision close', '判断による決済', '判断平仓', '判斷平倉', 'Cierre por decisión', 'Clôture sur décision'],
  decision_flip: ['방향 전환 청산', 'Direction reversal close', '方向転換による決済', '方向反转平仓', '方向反轉平倉', 'Cierre por cambio de dirección', 'Clôture pour inversion'],
  stop_loss: ['손절', 'Stop loss', '損切り', '止损', '停損', 'Stop loss', 'Stop loss'], take_profit: ['익절', 'Take profit', '利確', '止盈', '停利', 'Take profit', 'Take profit'],
  liquidation: ['강제 청산', 'Liquidation', '強制決済', '强制平仓', '強制平倉', 'Liquidación', 'Liquidation'],
  liquidation_funding: ['펀딩에 따른 강제 청산', 'Funding liquidation', '資金調達による強制決済', '资金费用强制平仓', '資金費用強制平倉', 'Liquidación por financiación', 'Liquidation liée au financement'],
}
const localeIndex = (language: string) => Math.max(0, ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'].indexOf(language))
export function evaluatedEvidenceLabel(language: string, value: string | null) { return value === null ? '—' : evidenceLabels[value]?.[localeIndex(language)] ?? '—' }
export function evaluatedGateLabel(language: string, gate: NonNullable<EvaluatedStrategy['judgments'][number]['gate']>) {
  const flip = /flip entry/.test(gate.reason), flat = /flat entry/.test(gate.reason)
  const labels = flip ? gate.allowed
    ? ['방향 전환 허용', 'Direction reversal allowed', '方向転換を許可', '允许方向反转', '允許方向反轉', 'Cambio de dirección permitido', 'Inversion autorisée']
    : ['방향 전환 차단', 'Direction reversal blocked', '方向転換を遮断', '阻止方向反转', '阻止方向反轉', 'Cambio de dirección bloqueado', 'Inversion bloquée']
    : flat ? gate.allowed
      ? ['신규 진입 허용', 'New entry allowed', '新規エントリーを許可', '允许新开仓', '允許新開倉', 'Nueva entrada permitida', 'Nouvelle entrée autorisée']
      : ['신규 진입 차단', 'New entry blocked', '新規エントリーを遮断', '阻止新开仓', '阻止新開倉', 'Nueva entrada bloqueada', 'Nouvelle entrée bloquée']
      : gate.allowed
        ? ['진입 허용', 'Entry allowed', 'エントリーを許可', '允许开仓', '允許開倉', 'Entrada permitida', 'Entrée autorisée']
        : ['진입 차단', 'Entry blocked', 'エントリーを遮断', '阻止开仓', '阻止開倉', 'Entrada bloqueada', 'Entrée bloquée']
  return labels[localeIndex(language)]
}
export function evaluatedContextLabel(language: string, key: 'ruleAuthor' | 'authorMethod' | 'requestedModel' | 'ruleTiming' | 'monthEnd' | 'blocked', count = 0) {
  const labels = {
    ruleAuthor: ['고정 기술 규칙', 'Fixed technical rules', '固定テクニカルルール', '固定技术规则', '固定技術規則', 'Reglas técnicas fijas', 'Règles techniques fixes'],
    authorMethod: ['작성 방식', 'Creation method', '作成方式', '创建方式', '建立方式', 'Método de creación', 'Méthode de création'],
    requestedModel: ['요청 모델', 'Requested model', '要求モデル', '请求模型', '請求模型', 'Modelo solicitado', 'Modèle demandé'],
    ruleTiming: ['15분봉 기준 · 하루 1회', '15-minute bars · once daily', '15分足 · 1日1回', '15分钟K线 · 每日一次', '15分鐘K線 · 每日一次', 'Velas de 15 minutos · una vez al día', 'Bougies de 15 minutes · une fois par jour'],
    monthEnd: ['월말 보유 포지션 평가손익 포함', 'Includes month-end open-position PnL', '月末保有ポジションの評価損益を含む', '包含月末持仓估值损益', '包含月底持倉評價損益', 'Incluye PnL de posiciones abiertas al cierre del mes', 'Inclut le PnL des positions ouvertes en fin de mois'],
    blocked: [`진입 차단 ${count}회`, count === 1 ? '1 entry blocked' : `${count} entries blocked`, `エントリー遮断 ${count}回`, `阻止开仓 ${count}次`, `阻止開倉 ${count}次`, count === 1 ? '1 entrada bloqueada' : `${count} entradas bloqueadas`, count === 1 ? '1 entrée bloquée' : `${count} entrées bloquées`],
  }
  return labels[key][localeIndex(language)]
}

export function matchesEvaluatedCataloguePin(value: EvaluatedCatalogue, revision: string) {
  return sha.test(revision) && value.revision === revision && value.rejected === 0 && value.items.length === 32 && value.counts.agent === 22 && value.counts.rule === 6 && value.counts.mix === 4 && value.items.every(item => item.equity.length === 31 && item.judgments.length === 29)
}
