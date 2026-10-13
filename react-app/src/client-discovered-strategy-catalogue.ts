import { canonicalCatalogueJson, type EvaluatedStrategy } from './client-evaluated-strategy-catalogue'

type RecordValue = Record<string, unknown>
export type DiscoveredStrategy = {
  id: string; name: string; kind: 'agent'; symbol: 'BTCUSDT'; exchange: 'binance'
  author: EvaluatedStrategy['author']; policyVersionId: string; policy: RecordValue; provenance: RecordValue
  evaluation: EvaluatedStrategy['evaluation'] & { decisionCount: number; eligible: boolean; feesUsd: string; fundingUsd: string }
  equity: EvaluatedStrategy['equity']; trades: Omit<EvaluatedStrategy['trades'][number], 'returnPct'>[]
  judgments: EvaluatedStrategy['judgments']; operation: EvaluatedStrategy['operation']
}
export type DiscoveredCatalogue = {
  schemaVersion: 'arena-strategy-discovery-0.1'; revision: string; generatedAt: string; month: '2026-09'
  period: { startAt: string; endExclusive: string }; source: Record<string, string>
  counts: { received: number; unique: number; duplicates: number; evaluated: number; eligible: number; failed: number }
  failures: { candidateId: string | null; stage: 'policy' | 'generation' | 'evaluation'; reason: string }[]
  items: DiscoveredStrategy[]
}
const SHA = /^[a-f0-9]{64}$/
const sourceKeys = ['inputHash', 'engineSha256', 'candidatesSha256', 'generationManifestSha256', 'evaluatorSha256']
const common = { allocationBps: [500, 5000], stopLossBps: [50, 500], takeProfitBps: [50, 1000], maxHoldHours: [1, 24], cooldownHours: [0, 6] } as const
const families: Record<string, Record<string, readonly [number, number]>> = {
  ema_trend: { fast: [2, 30], slow: [4, 64] }, ema_rsi: { fast: [2, 30], slow: [4, 64], rsiPeriod: [2, 28], lowerRsi: [10, 49], upperRsi: [51, 90] },
  rsi_reversion: { period: [2, 28], lower: [10, 49], upper: [51, 90] }, range_breakout: { lookback: [4, 63], bufferBps: [0, 100] },
  mean_reversion: { lookback: [4, 64], thresholdBps: [10, 300] }, momentum: { lookback: [2, 63], thresholdBps: [10, 300] },
}
const indicators = { ema: 'first_confirmed_close_seed_recursive_2_over_p_plus_1', rsi: 'last_p_close_deltas_gain_loss_sums_flat50_no_loss100', range: 'prior_lookback_high_low_excluding_signal_bar', momentum: 'close_over_prior_lookback_close_bps' }
const record = (v: unknown): v is RecordValue => v !== null && typeof v === 'object' && !Array.isArray(v)
const exact = (v: unknown, keys: readonly string[]): v is RecordValue => record(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k))
const text = (v: unknown, max = 1000): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= max && !Array.from(v).some(char => char.codePointAt(0)! < 32 || char.codePointAt(0) === 127)
const decimal = (v: unknown): v is string => typeof v === 'string' && /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(v) && v.length <= 128 && Number.isFinite(Number(v))
const count = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 0
const stamp = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?Z$/.test(v) && Number.isFinite(Date.parse(v))
export async function catalogueHash(value: unknown) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalCatalogueJson(value) + '\n'))
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('')
}
const invalid = (): never => { throw Error('Invalid generated strategy catalogue') }

/** A separate closed contract. This parser never calls the legacy 32-item validator. */
export async function parseDiscoveredCatalogue(input: unknown): Promise<DiscoveredCatalogue> {
  if (!exact(input, ['schemaVersion', 'revision', 'generatedAt', 'month', 'period', 'source', 'counts', 'items', 'failures']) || input.schemaVersion !== 'arena-strategy-discovery-0.1' || input.month !== '2026-09' || !SHA.test(String(input.revision)) || !stamp(input.generatedAt)) return invalid()
  if (!exact(input.period, ['startAt', 'endExclusive']) || input.period.startAt !== '2026-09-01T00:00:00Z' || input.period.endExclusive !== '2026-10-01T00:00:00Z' || !exact(input.source, sourceKeys) || !sourceKeys.every(k => SHA.test(String((input.source as RecordValue)[k])))) return invalid()
  const counts = input.counts, source = input.source
  if (!exact(counts, ['received', 'unique', 'duplicates', 'evaluated', 'eligible', 'failed']) || !Object.values(counts).every(count) || Number(counts.received) > 100 || !Array.isArray(input.items) || !Array.isArray(input.failures) || input.items.length > 100 || input.failures.length > 100) return invalid()
  const { revision, ...body } = input
  if (await catalogueHash(body) !== revision) return invalid()
  if (!input.failures.every(f => exact(f, ['candidateId', 'stage', 'reason']) && (f.candidateId === null || text(f.candidateId, 64)) && ['policy', 'generation', 'evaluation'].includes(String(f.stage)) && text(f.reason, 1000))) return invalid()
  if (counts.evaluated !== input.items.length || counts.failed !== input.failures.length || counts.unique !== input.items.length + input.failures.filter(f => (f as RecordValue).stage === 'evaluation').length || counts.received !== Number(counts.unique) + Number(counts.duplicates) + input.failures.filter(f => (f as RecordValue).stage !== 'evaluation').length) return invalid()
  const start = Date.parse(String(input.period.startAt)), end = Date.parse(String(input.period.endExclusive))
  const ids = new Set<string>(), titles = new Set<string>(), hashes = new Set<string>()
  for (const item of input.items) {
    if (!exact(item, ['id', 'name', 'kind', 'symbol', 'exchange', 'author', 'policyVersionId', 'policy', 'provenance', 'evaluation', 'equity', 'trades', 'judgments', 'operation']) || !text(item.name, 50) || item.kind !== 'agent' || item.symbol !== 'BTCUSDT' || item.exchange !== 'binance') return invalid()
    const policy = item.policy, provenance = item.provenance, evaluation = item.evaluation, author = item.author
    if (!exact(policy, ['family', 'params', ...Object.keys(common), 'leverage', 'decisionIntervalHours', 'indicatorCalculation', 'rationale']) || !text(policy.rationale, 600) || policy.leverage !== 1 || policy.decisionIntervalHours !== 1 || canonicalCatalogueJson(policy.indicatorCalculation) !== canonicalCatalogueJson(indicators)) return invalid()
    const bounds = families[String(policy.family)]
    if (!bounds || !exact(policy.params, Object.keys(bounds)) || !Object.entries(bounds).every(([k, [min, max]]) => Number.isSafeInteger((policy.params as RecordValue)[k]) && Number((policy.params as RecordValue)[k]) >= min && Number((policy.params as RecordValue)[k]) <= max) || !Object.entries(common).every(([k, [min, max]]) => Number.isSafeInteger(policy[k]) && Number(policy[k]) >= min && Number(policy[k]) <= max)) return invalid()
    if ('fast' in policy.params && Number(policy.params.slow) < Number(policy.params.fast) + 2) return invalid()
    const effective = Object.fromEntries(Object.entries(policy).filter(([key]) => key !== 'rationale'))
    const policyHash = await catalogueHash(effective)
    if (item.id !== `generated-${policyHash.slice(0, 24)}` || item.policyVersionId !== `policy_${policyHash}` || !exact(provenance, ['policySha256', ...sourceKeys, 'candidateIds', 'generationProofs']) || provenance.policySha256 !== policyHash || !sourceKeys.every(k => provenance[k] === source[k])) return invalid()
    if (ids.has(String(item.id)) || titles.has(item.name.normalize('NFKC').trim().toLowerCase()) || hashes.has(policyHash)) return invalid()
    ids.add(String(item.id)); titles.add(item.name.normalize('NFKC').trim().toLowerCase()); hashes.add(policyHash)
    if (!exact(author, ['type', 'name', 'requestedModel', 'identityBasis']) || author.type !== 'model' || !text(author.name, 100) || !text(author.requestedModel, 500) || !text(author.identityBasis, 100)) return invalid()
    if (!Array.isArray(provenance.candidateIds) || !Array.isArray(provenance.generationProofs) || !provenance.candidateIds.length || provenance.candidateIds.length !== provenance.generationProofs.length || provenance.candidateIds.length > 100 || new Set(provenance.candidateIds).size !== provenance.candidateIds.length) return invalid()
    for (const [i, proof] of provenance.generationProofs.entries()) {
      if (!exact(proof, ['provider', 'requestedModel', 'actualModel', 'identityBasis', 'promptSha256', 'responseSha256', 'receiptSha256', 'status', 'candidateIds']) || proof.status !== 'completed' || !text(proof.provider, 100) || !text(proof.requestedModel, 500) || !(proof.actualModel === null || text(proof.actualModel, 500)) || !text(proof.identityBasis, 100) || !['promptSha256', 'responseSha256', 'receiptSha256'].every(k => SHA.test(String(proof[k]))) || !Array.isArray(proof.candidateIds) || !proof.candidateIds.includes(provenance.candidateIds[i]) || !text(provenance.candidateIds[i], 64)) return invalid()
      if (!i && (proof.provider !== author.name || proof.requestedModel !== author.requestedModel || proof.identityBasis !== author.identityBasis)) return invalid()
    }
    if (!exact(item.operation, ['status', 'actualExecutionReady', 'copyReady', 'issuedStrategyVersionId']) || item.operation.status !== 'historical_evaluation' || item.operation.actualExecutionReady !== false || item.operation.copyReady !== false || item.operation.issuedStrategyVersionId !== null) return invalid()
    if (!exact(evaluation, ['basis', 'status', 'returnPct', 'maxDrawdownPct', 'winRatePct', 'tradeCount', 'fillCount', 'decisionCount', 'failedDecisionCount', 'eligible', 'feesUsd', 'fundingUsd']) || evaluation.basis !== 'ai_generated_rule_replay' || evaluation.status !== 'evaluated' || !['returnPct', 'maxDrawdownPct', 'feesUsd', 'fundingUsd'].every(k => decimal(evaluation[k])) || Number(evaluation.maxDrawdownPct) < 0 || Number(evaluation.maxDrawdownPct) > 100 || Number(evaluation.feesUsd) < 0 || !['tradeCount', 'fillCount', 'decisionCount', 'failedDecisionCount'].every(k => count(evaluation[k])) || typeof evaluation.eligible !== 'boolean') return invalid()
    if (!Array.isArray(item.equity) || item.equity.length !== 31 || !item.equity.every((p, i) => exact(p, ['at', 'value']) && stamp(p.at) && Date.parse(p.at) === start + i * 86_400_000 && decimal(p.value) && Number(p.value) > 0) || Number((item.equity[0] as RecordValue).value) !== 10000 || Number((item.equity[1] as RecordValue).value) !== 10000) return invalid()
    if (Math.abs((Number((item.equity.at(-1) as RecordValue).value) / 10000 - 1) * 100 - Number(evaluation.returnPct)) > 0.000001) return invalid()
    const inPeriod = (v: unknown) => stamp(v) && Date.parse(v) >= start && Date.parse(v) <= end
    if (!Array.isArray(item.trades) || item.trades.length !== evaluation.tradeCount || item.trades.length > 10000 || Number(evaluation.fillCount) < item.trades.length * 2 || new Set(item.trades.map(t => record(t) ? t.id : null)).size !== item.trades.length || !item.trades.every(t => exact(t, ['id', 'side', 'openedAt', 'closedAt', 'netPnl', 'exitReason']) && text(t.id, 160) && ['LONG', 'SHORT'].includes(String(t.side)) && inPeriod(t.openedAt) && inPeriod(t.closedAt) && Date.parse(String(t.closedAt)) >= Date.parse(String(t.openedAt)) && decimal(t.netPnl) && text(t.exitReason, 100))) return invalid()
    if (item.trades.length ? !decimal(evaluation.winRatePct) || Math.abs(item.trades.filter(t => Number((t as RecordValue).netPnl) > 0).length / item.trades.length * 100 - Number(evaluation.winRatePct)) > 0.00001 : evaluation.winRatePct !== null) return invalid()
    if (!Array.isArray(item.judgments) || item.judgments.length !== 696 || evaluation.decisionCount !== 696 || new Set(item.judgments.map(j => record(j) ? j.id : null)).size !== 696 || !item.judgments.every((j, i) => exact(j, ['id', 'at', 'sourceAction', 'effectiveAction', 'status', 'rationale', 'gate']) && text(j.id, 160) && stamp(j.at) && Date.parse(j.at) === start + 86_400_000 + i * 3_600_000 && ['open_long', 'open_short', 'close', 'hold'].includes(String(j.sourceAction)) && j.sourceAction === j.effectiveAction && ['executed', 'held', 'failed', 'rejected'].includes(String(j.status)) && (j.rationale === null || text(j.rationale, 2000)) && j.gate === null)) return invalid()
    const failed = item.judgments.filter(j => (j as RecordValue).status === 'failed').length, rejected = item.judgments.filter(j => (j as RecordValue).status === 'rejected').length
    if (evaluation.failedDecisionCount !== failed || evaluation.eligible !== (item.trades.length >= 20 && failed === 0 && rejected === 0)) return invalid()
  }
  if (counts.eligible !== input.items.filter(item => (item as RecordValue).evaluation && ((item as RecordValue).evaluation as RecordValue).eligible === true).length) return invalid()
  return input as unknown as DiscoveredCatalogue
}

/** Display adaptation only. Missing per-trade returns remain unavailable. */
export function discoveredPresentation(item: DiscoveredStrategy, sourceSha: string): EvaluatedStrategy {
  return { ...item, kind: 'rule', market: 'crypto', marketType: 'usd_m_perpetual', sourceAgentId: null,
    description: String(item.policy.rationale), trades: item.trades.map(t => ({ ...t, returnPct: null })),
    discovery: { sourceSha, policyHash: String(item.provenance.policySha256), eligible: item.evaluation.eligible, decisionIntervalHours: 1 } }
}

// Short editorial names are bound to all effective policy parameters, never provider labels.
const displayNames: Record<string, readonly string[]> = (import.meta.env?.DEV ?? true) ? {
  "df2c377637b7368375a32878f697b03a0ca3295b77e3b93321041bb21684fe37": [
    "짧은 이평선 방향 따라가기",
    "Follow short averages",
    "短期移動平均を追う",
    "跟随短期均线",
    "跟隨短期均線",
    "Seguir medias cortas",
    "Suivre les moyennes courtes"
  ],
  "aa8daecb84535ecc263c0d0573f6c7adbe5f5bbf41989695fe9f4975b75b4dba": [
    "느린 이평선 추세 기다리기",
    "Wait for slow-average trends",
    "長期移動平均の流れを待つ",
    "等待慢均线趋势",
    "等待慢均線趨勢",
    "Esperar tendencias lentas",
    "Attendre les tendances lentes"
  ],
  "d3802495981efbd225522b95ec90ba22de6d7bb1194bdb4f7fe28e5058a69a69": [
    "짧은 추세에 힘 실릴 때",
    "Strength behind short trends",
    "短期トレンドに勢いがつく時",
    "短期趋势增强时",
    "短期趨勢增強時",
    "Fuerza en tendencias cortas",
    "Force des tendances courtes"
  ],
  "f3aa87a003f6cf749c0d9d497f82f3eef4706ba9d2997f51fc19d92af56332ee": [
    "느린 추세와 강도 함께 보기",
    "Slow trends with strength",
    "長期トレンドと強さを見る",
    "慢趋势与强度结合",
    "慢趨勢與強度結合",
    "Tendencias lentas y fuerza",
    "Tendances lentes et force"
  ],
  "34d891eaf07df6d33dc288ddb91aa05a509fb51aaeeb027ddc912c531cb7e7f9": [
    "짧은 과열·침체 되돌림 찾기",
    "Short overbought and oversold reversals",
    "短期の過熱と売られ過ぎの反転",
    "短期超买超卖回转",
    "短期超買超賣回轉",
    "Reversiones cortas de extremos",
    "Retournements courts des extrêmes"
  ],
  "28f06e965faab17071a627f48722c3b58c0825726588330099476dea43374021": [
    "긴 강도 변화의 되돌림 기다리기",
    "Wait for slow RSI reversals",
    "長期RSIの反転を待つ",
    "等待慢RSI回转",
    "等待慢RSI回轉",
    "Esperar reversiones RSI lentas",
    "Attendre les retournements RSI lents"
  ],
  "8fd28c2ba3cd80ed4e7bc1c4c030718668b70152ab5b7a7895b54b1a992fba5a": [
    "짧은 박스 경계 따라가기",
    "Follow short range edges",
    "短いレンジの境界を追う",
    "跟随短区间边界",
    "跟隨短區間邊界",
    "Seguir bordes de rangos cortos",
    "Suivre les bords de ranges courts"
  ],
  "64b8a8dc612fc4b2d6a317ecb86a19304dadfec0cc597f81ad0bed3d92e976a6": [
    "넓은 박스 밖 흐름 따라가기",
    "Follow outside wide ranges",
    "広いレンジの外を追う",
    "跟随宽区间外走势",
    "跟隨寬區間外走勢",
    "Seguir fuera de rangos amplios",
    "Suivre hors des ranges larges"
  ],
  "3c778c0b3cb3d45206d6271b26e79ebbc906f63d592a66f0d36e61511026340b": [
    "가까운 평균으로 돌아오기",
    "Return to a nearby mean",
    "近い平均への回帰",
    "回到近端均值",
    "回到近端均值",
    "Volver a una media cercana",
    "Retour à une moyenne proche"
  ],
  "d868e2a9b3c9b9995178470dddd53d9d58608914ce6f01e7f00f4dcc29361db2": [
    "멀어진 평균으로 되돌림 보기",
    "Reversion from a distant mean",
    "遠い平均からの回帰を見る",
    "观察远离均值后的回归",
    "觀察遠離均值後的回歸",
    "Reversión desde medias distantes",
    "Retour après un écart lointain"
  ],
  "d73a4d2f524b032f8ea854b9eedad2ee88bdb96f837b431a81498b23fb5f2ce8": [
    "짧은 가격 탄력 따라가기",
    "Follow short price momentum",
    "短期の価格の勢いを追う",
    "跟随短期价格动能",
    "跟隨短期價格動能",
    "Seguir momentum corto",
    "Suivre le momentum court"
  ],
  "0176e562cf3fcdeb567dffbe4ae6d004c08caf1c47bd3052c97826874aaa3a8f": [
    "길게 이어지는 탄력 살피기",
    "Watch extended momentum",
    "続く勢いを確認",
    "观察持续动能",
    "觀察持續動能",
    "Observar momentum prolongado",
    "Observer le momentum prolongé"
  ],
  "9e1fb4c63d96c07b28d35468f4e33c3dd92f42a2c86186f61d1805f3064ef3da": [
    "이평선 추세를 하루 안에 읽기",
    "Read average trends within a day",
    "移動平均の流れを一日内で読む",
    "一天内读取均线趋势",
    "一天內讀取均線趨勢",
    "Leer tendencias en un día",
    "Lire les tendances sur une journée"
  ],
  "5940e992f3b49bbeb3b5d9b21cd1a654dbbde119ac701f9cf4ef0788005fc88e": [
    "빠른 이평선 교차 따라가기",
    "Follow fast average crosses",
    "速い移動平均交差を追う",
    "跟随快速均线交叉",
    "跟隨快速均線交叉",
    "Seguir cruces rápidos",
    "Suivre les croisements rapides"
  ],
  "11f22e8429cdcc37790eaca794e37da27a6669090482bf4d77055ae2a529515a": [
    "이평선 12·36에 힘 더하기",
    "Strength with averages 12·36",
    "移動平均12·36に強さを加える",
    "均线12·36结合强度",
    "均線12·36結合強度",
    "Fuerza con medias 12·36",
    "Force avec moyennes 12·36"
  ],
  "d542cd5417bc21b85e5f764f0ea02c69747bc35912760e3899811b311083a883": [
    "빠른 교차에 힘 붙을 때",
    "Strength after a fast cross",
    "速い交差に勢いがつく時",
    "快速交叉增强时",
    "快速交叉增強時",
    "Fuerza tras un cruce rápido",
    "Force après un croisement rapide"
  ],
  "5c66e4107e1417a284ea9f62ccd81ec54a77b4dc851373e49a3a4f4fd8322f0b": [
    "RSI 14 되돌림, 반나절 안에",
    "RSI 14 reversal within half a day",
    "RSI14の反転を半日内で見る",
    "半天内RSI14回转",
    "半天內RSI14回轉",
    "RSI 14 en medio día",
    "RSI 14 sur une demi-journée"
  ],
  "9da71bc93d047e98f6d2d99822c663942b267f47c54186db5b73c334ed46f8df": [
    "빠른 RSI 극단에서 방향 바꾸기",
    "Turn at fast RSI extremes",
    "速いRSIの極端で反転",
    "快速RSI极值回转",
    "快速RSI極值回轉",
    "Girar en extremos RSI rápidos",
    "Retour aux extrêmes RSI rapides"
  ],
  "1e8e3ec3a115681919b7c94b7923dbfb829311647b623a4ff60eec955210e53a": [
    "48봉 박스 끝에서 따라가기",
    "Follow the 48-bar range edge",
    "48本レンジの端を追う",
    "跟随48根区间边缘",
    "跟隨48根區間邊緣",
    "Seguir el rango de 48 velas",
    "Suivre le range de 48 bougies"
  ],
  "868236610c9c1d718e7add83d91ba245e71f34bd4b3d5b2b862a0b1ae57f4705": [
    "12봉 박스 넘어가면 따라가기",
    "Follow beyond a 12-bar range",
    "12本レンジを越えて追う",
    "跟随12根区间突破",
    "跟隨12根區間突破",
    "Seguir fuera de 12 velas",
    "Suivre hors du range de 12 bougies"
  ],
  "8e9430d1c7c04fec4fdfb91239353d2c338d1b2c66d9fbad6e3e48b6a8d118cb": [
    "48봉 평균으로 돌아가기",
    "Return to the 48-bar mean",
    "48本平均への回帰",
    "回归48根均值",
    "回歸48根均值",
    "Volver a la media de 48 velas",
    "Retour à la moyenne de 48 bougies"
  ],
  "65b665b7c7e7418e230f6edb0e8187ba522554740b1a024edf6ae384adee3a5c": [
    "16봉 평균 가까이 되돌아오기",
    "Revert toward the 16-bar mean",
    "16本平均へ戻る",
    "回归16根均值附近",
    "回歸16根均值附近",
    "Acercarse a la media de 16 velas",
    "Se rapprocher de la moyenne de 16 bougies"
  ],
  "820a54f4fac9545951d89b9983f979241b320194a059caef7eff99eabbcc8301": [
    "32봉 흐름에 탄력 실릴 때",
    "Momentum in a 32-bar move",
    "32本の流れに勢いがつく時",
    "32根走势增强时",
    "32根走勢增強時",
    "Momentum en 32 velas",
    "Momentum sur 32 bougies"
  ],
  "e1de16374982ce5dad4146504b27b511ea1dac43333a217cc8c0bb6adf1efa93": [
    "6봉 짧은 탄력 따라가기",
    "Follow six-bar momentum",
    "6本の短い勢いを追う",
    "跟随6根短期动能",
    "跟隨6根短期動能",
    "Seguir momentum de seis velas",
    "Suivre le momentum sur six bougies"
  ],
  "5fe06d0a3563ca497f3124919e94889f07bc5174f06e13e6e0a6fa0f47d76eac": [
    "단기 이평선 흐름 확인하기",
    "Confirm short average trends",
    "短期移動平均の流れを確認",
    "确认短期均线走势",
    "確認短期均線走勢",
    "Confirmar tendencias cortas",
    "Confirmer les tendances courtes"
  ],
  "e5699787cef7d3a99287799af6bd020a1d9b94717d7adacc5fb5e849050ee51d": [
    "중간 이평선 흐름 이어가기",
    "Follow medium average trends",
    "中期移動平均の流れを追う",
    "跟随中期均线走势",
    "跟隨中期均線走勢",
    "Seguir tendencias medias",
    "Suivre les tendances moyennes"
  ],
  "2d9700c1f3f8c905abe941d1a6813920c94ccd713bfc90b4e236b54b6df90f08": [
    "단기 정배열과 강도 맞추기",
    "Align short averages and RSI",
    "短期移動平均と強さを合わせる",
    "短期均线与强度匹配",
    "短期均線與強度匹配",
    "Alinear medias cortas y RSI",
    "Aligner moyennes courtes et RSI"
  ],
  "a744250d2833b341a14b2a3290dbe7f579278208b6f1852960c0e84e03ae89c7": [
    "중간 추세에 강도 확인하기",
    "Confirm strength in medium trends",
    "中期トレンドの強さを確認",
    "确认中期趋势强度",
    "確認中期趨勢強度",
    "Confirmar fuerza de tendencias medias",
    "Confirmer la force des tendances moyennes"
  ],
  "8cad21c441b196685efd466bc8738adf38d6715b0b1effadb1c8b352d142d98a": [
    "RSI 7 극단에서 반전 찾기",
    "Reversals at RSI 7 extremes",
    "RSI7の極端で反転を探す",
    "寻找RSI7极值反转",
    "尋找RSI7極值反轉",
    "Reversiones en extremos RSI 7",
    "Retournements aux extrêmes RSI 7"
  ],
  "34d0371bb8807ffc252f00d317867104f73644622e07bdd4b00a6708080aa916": [
    "RSI 14 극단에서 되돌림 보기",
    "Watch reversals at RSI 14 extremes",
    "RSI14の極端で反転を見る",
    "观察RSI14极值回转",
    "觀察RSI14極值回轉",
    "Reversiones en extremos RSI 14",
    "Retournements aux extrêmes RSI 14"
  ],
  "3227a459eacc7e5a7fbd6faf8f1007b9f5a1a24c2c7c25cd9f47f5029ac60ff4": [
    "16봉 박스 경계 넘기기",
    "Cross the 16-bar range edge",
    "16本レンジの境界を越える",
    "跨越16根区间边界",
    "跨越16根區間邊界",
    "Cruzar el rango de 16 velas",
    "Franchir le range de 16 bougies"
  ],
  "da636d151e39a1ac825efd8f63323db33b80ab707717aaf131142db75a76d338": [
    "넓은 채널 밖 방향 찾기",
    "Find direction outside wide channels",
    "広いチャネル外の方向を探す",
    "寻找宽通道外方向",
    "尋找寬通道外方向",
    "Dirección fuera de canales amplios",
    "Direction hors des canaux larges"
  ],
  "cee3407f95c824dea3ad84d23fa98bdb6b85fc5cd9710516087fc5408cfeafe5": [
    "짧은 평균과 벌어진 간격 좁히기",
    "Revert short mean deviations",
    "短い平均との乖離を戻す",
    "回归短期均值偏差",
    "回歸短期均值偏差",
    "Revertir desvíos de medias cortas",
    "Retour des écarts à la moyenne courte"
  ],
  "806c8f66316ba1e49f71395dd08de12edb80148f998131a4b4553603c82db671": [
    "중간 평균에서 멀어지면 되돌림 보기",
    "Revert medium mean deviations",
    "中期平均からの乖離を戻す",
    "回归中期均值偏差",
    "回歸中期均值偏差",
    "Revertir desvíos de medias medias",
    "Retour des écarts à la moyenne moyenne"
  ],
  "c0c1b4e6d62e4e7de7fc8ebd195e2c3f13f7a9695f539d8c2fef21dbc093cf5d": [
    "단기 급등락의 탄력 따라가기",
    "Follow sudden short moves",
    "短期急変の勢いを追う",
    "跟随短期急变动能",
    "跟隨短期急變動能",
    "Seguir movimientos bruscos cortos",
    "Suivre les mouvements courts brusques"
  ],
  "0070dbf34090cf972b8060a74929d3f7d9b250b6537de0722216af7da34bf5dc": [
    "중간 가격 흐름의 탄력 이어가기",
    "Follow medium price momentum",
    "中期価格の勢いを追う",
    "跟随中期价格动能",
    "跟隨中期價格動能",
    "Seguir momentum de precios medios",
    "Suivre le momentum des prix moyens"
  ]
} : {}
export function discoveredDisplayNames(items: readonly DiscoveredStrategy[], language: string) {
  const locale = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'].indexOf(language)
  return new Map(items.map(item => [item.id, displayNames[String(item.provenance.policySha256)]?.[locale < 0 ? 1 : locale] ?? item.name]))
}

export function discoveredPolicyDetails(item: EvaluatedStrategy, language: string) {
  const labels = ({ ko: ['1시간마다 마지막 64개 확정 15분봉으로 판단합니다.', '모델이 생성한 규칙의 시간 단위 평가', '최대 보유', '재진입 대기', '손절', '익절', '배정'], en: ['Evaluate hourly using the last 64 confirmed 15-minute bars.', 'Hourly evaluation of model-generated rules', 'Maximum holding', 'Cooldown', 'Stop loss', 'Take profit', 'Allocation'], ja: ['直近64本の確定15分足で1時間ごとに判断します。', 'モデル生成ルールの時間単位評価', '最大保有', '再エントリー待機', '損切り', '利確', '配分'], 'zh-CN': ['每小时根据最近64根已确认15分钟K线判断。', '模型生成规则的小时评估', '最长持仓', '再入场等待', '止损', '止盈', '分配'], 'zh-TW': ['每小時根據最近64根已確認15分鐘K線判斷。', '模型生成規則的小時評估', '最長持倉', '再進場等待', '停損', '停利', '配分'], es: ['Evalúa cada hora las últimas 64 velas confirmadas de 15 minutos.', 'Evaluación horaria de reglas generadas por modelos', 'Duración máxima', 'Espera de reentrada', 'Stop loss', 'Take profit', 'Asignación'], fr: ['Évalue chaque heure les 64 dernières bougies confirmées de 15 minutes.', 'Évaluation horaire des règles générées par modèles', 'Durée maximale', 'Attente de réentrée', 'Stop loss', 'Take profit', 'Allocation'] } as Record<string, string[]>)[language] ?? ['Evaluate hourly using the last 64 confirmed 15-minute bars.', 'Hourly evaluation of model-generated rules', 'Maximum holding', 'Cooldown', 'Stop loss', 'Take profit', 'Allocation']
  const p = item.policy, values = p.params as Record<string, number>
  const locale = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'].indexOf(language), index = locale < 0 ? 1 : locale
  const long = ['롱', 'Long', 'ロング', '做多', '做多', 'Long', 'Long'][index], short = ['숏', 'Short', 'ショート', '做空', '做空', 'Short', 'Short'][index]
  const terms = [['직전', '고점', '저점', '종가 평균', '종가 변화'], ['Previous', 'high', 'low', 'close mean', 'close change'], ['直前', '高値', '安値', '終値平均', '終値変化'], ['此前', '高点', '低点', '收盘均值', '收盘变化'], ['此前', '高點', '低點', '收盤均值', '收盤變化'], ['Previo', 'máximo', 'mínimo', 'media de cierre', 'cambio de cierre'], ['Précédent', 'haut', 'bas', 'moyenne de clôture', 'variation de clôture']][index]
  const conditions = p.family === 'ema_trend' ? `EMA${values.fast} > EMA${values.slow}: ${long} / <: ${short}`
    : p.family === 'ema_rsi' ? `EMA${values.fast} > EMA${values.slow}, RSI${values.rsiPeriod} ≥ ${values.upperRsi}: ${long} / EMA${values.fast} < EMA${values.slow}, RSI${values.rsiPeriod} ≤ ${values.lowerRsi}: ${short}`
    : p.family === 'rsi_reversion' ? `RSI${values.period} ≤ ${values.lower}: ${long} / ≥ ${values.upper}: ${short}`
    : p.family === 'range_breakout' ? `${terms[0]} ${values.lookback} × 15m, ${terms[1]} + ${values.bufferBps / 100}%: ${long} / ${terms[2]} − ${values.bufferBps / 100}%: ${short}`
    : p.family === 'mean_reversion' ? `${values.lookback} × 15m ${terms[3]}, −${values.thresholdBps / 100}%: ${long} / +${values.thresholdBps / 100}%: ${short}`
    : `${values.lookback} × 15m ${terms[4]}, +${values.thresholdBps / 100}%: ${long} / −${values.thresholdBps / 100}%: ${short}`
  const summaries = { ema_trend: ['이평선 배열에 따라 롱과 숏을 전환합니다.', 'Switch long and short with moving-average alignment.', '移動平均の並びに応じてロングとショートを切り替えます。', '根据均线排列切换多空。', '依均線排列切換多空。', 'Alterna long y short según las medias móviles.', 'Alterne long et short selon les moyennes mobiles.'], ema_rsi: ['이평선 방향과 RSI를 함께 보고 롱과 숏을 선택합니다.', 'Choose long or short using moving averages and RSI.', '移動平均の方向とRSIからロングとショートを選びます。', '结合均线方向与RSI选择多空。', '結合均線方向與RSI選擇多空。', 'Elige long o short con medias móviles y RSI.', 'Choisit long ou short avec les moyennes et le RSI.'], rsi_reversion: ['RSI가 낮거나 높아지면 되돌림을 살핍니다.', 'Watch for reversals at low or high RSI.', 'RSIが低い・高い水準で反転を探します。', '在RSI低位或高位寻找回转。', '在RSI低位或高位尋找回轉。', 'Busca retrocesos con RSI bajo o alto.', 'Cherche un retour avec un RSI bas ou haut.'], range_breakout: ['최근 가격 범위를 벗어나는 방향을 따라갑니다.', 'Follow breakouts from the recent price range.', '直近価格レンジを抜ける方向を追います。', '跟随突破近期价格区间的方向。', '跟隨突破近期價格區間的方向。', 'Sigue rupturas del rango reciente.', 'Suit les sorties du range récent.'], mean_reversion: ['가격이 최근 평균에서 멀어지면 되돌림을 살핍니다.', 'Watch for reversions away from the recent mean.', '直近平均から離れた価格の回帰を探します。', '价格偏离近期均值时寻找回归。', '價格偏離近期均值時尋找回歸。', 'Busca retornos a la media reciente.', 'Cherche un retour vers la moyenne récente.'], momentum: ['최근 가격 변화의 방향과 탄력을 따라갑니다.', 'Follow the direction and momentum of recent price changes.', '直近価格変化の方向と勢いを追います。', '跟随近期价格变化的方向与动能。', '跟隨近期價格變化的方向與動能。', 'Sigue la dirección y el impulso reciente.', 'Suit la direction et le momentum récents.'] } as Record<string, string[]>
  return { summary: summaries[String(p.family)]?.[index] ?? item.description, timing: labels[0], basis: conditions, parameters: `${conditions} · ${labels[2]} ${p.maxHoldHours}h · ${labels[3]} ${p.cooldownHours}h · ${labels[4]} ${Number(p.stopLossBps) / 100}% · ${labels[5]} ${Number(p.takeProfitBps) / 100}% · ${labels[6]} ${Number(p.allocationBps) / 100}%` }
}
