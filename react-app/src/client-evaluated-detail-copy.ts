import type { ClientLanguage } from './client-preferences'
import type { StrategyKind } from './client-strategy-classification'
import type { EvaluatedStrategy } from './client-evaluated-strategy-catalogue'

const rows = {
  ko: {
    tradeTable: '체결 표',
    execution: '실행 거래소', recordSource: '기록 기준', verifyUnavailable: '현재 기록은 직접 검증할 수 없어요.', mixBasisGeneral: '저장된 9월 AI 판단 · 조건 필터', pnl: '손익',
    week: '9월 마지막 7일', month: '9월 전체', all: '9월 전체 기록', quarter: '3개월', year: '1년', scope: '9월 기록',
    agent: '9월 판단 기록', rule: '규칙 기록', mix: 'AI 판단·추세 조건 기록', basis: '판단 기준',
    agentBasis: '저장된 9월 AI 판단', ruleBasis: '확정 15분봉 · 하루 1회', mixBasis: '저장된 9월 AI 판단 · EMA20·50 조건',
    mixDescription: '저장된 9월 AI 진입 신호가 EMA20·50 방향과 맞을 때 진입합니다. 명시적 청산은 그대로 따릅니다.',
  },
  en: {
    tradeTable: 'Trade table',
    execution: 'Execution venue', recordSource: 'Record source', verifyUnavailable: 'This record is unavailable for direct verification.', mixBasisGeneral: 'Saved September AI decisions · condition filter', pnl: 'PnL',
    week: 'Last 7 days of September', month: 'Full September', all: 'All September records', quarter: '3 months', year: '1 year', scope: 'September records',
    agent: 'September decision log', rule: 'Rule log', mix: 'AI decisions and trend conditions', basis: 'Decision basis',
    agentBasis: 'Saved September AI decisions', ruleBasis: 'Confirmed 15-minute bars · once daily', mixBasis: 'Saved September AI decisions · EMA20/50 conditions',
    mixDescription: 'Enter when saved September AI entry signals align with EMA20/50 direction. Explicit close signals pass through.',
  },
  ja: {
    tradeTable: '約定表',
    execution: '実行取引所', recordSource: '記録の基準', verifyUnavailable: 'この記録は直接検証できません。', mixBasisGeneral: '保存された9月のAI判断 · 条件フィルター', pnl: '損益',
    week: '9月最後の7日間', month: '9月全体', all: '9月の全記録', quarter: '3か月', year: '1年', scope: '9月の記録',
    agent: '9月の判断記録', rule: 'ルール記録', mix: 'AI判断・トレンド条件の記録', basis: '判断基準',
    agentBasis: '保存された9月のAI判断', ruleBasis: '確定15分足 · 1日1回', mixBasis: '保存された9月のAI判断 · EMA20/50条件',
    mixDescription: '保存された9月のAIエントリーシグナルがEMA20/50の方向と一致したときにエントリーします。明示的な決済シグナルはそのまま適用します。',
  },
  'zh-CN': {
    tradeTable: '成交表',
    execution: '执行交易所', recordSource: '记录来源', verifyUnavailable: '此记录无法直接验证。', mixBasisGeneral: '已保存的9月AI决策 · 条件过滤', pnl: '盈亏',
    week: '9月最后7天', month: '完整9月', all: '9月全部记录', quarter: '3个月', year: '1年', scope: '9月记录',
    agent: '9月决策记录', rule: '规则记录', mix: 'AI决策与趋势条件记录', basis: '决策依据',
    agentBasis: '已保存的9月AI决策', ruleBasis: '已确认15分钟K线 · 每日一次', mixBasis: '已保存的9月AI决策 · EMA20/50条件',
    mixDescription: '已保存的9月AI入场信号与EMA20/50方向一致时入场。明确的平仓信号按原样执行。',
  },
  'zh-TW': {
    tradeTable: '成交表',
    execution: '執行交易所', recordSource: '記錄來源', verifyUnavailable: '此記錄無法直接驗證。', mixBasisGeneral: '已儲存的9月AI判斷 · 條件篩選', pnl: '損益',
    week: '9月最後7天', month: '完整9月', all: '9月全部記錄', quarter: '3個月', year: '1年', scope: '9月記錄',
    agent: '9月判斷記錄', rule: '規則記錄', mix: 'AI判斷與趨勢條件記錄', basis: '判斷依據',
    agentBasis: '已儲存的9月AI判斷', ruleBasis: '已確認15分鐘K線 · 每日一次', mixBasis: '已儲存的9月AI判斷 · EMA20/50條件',
    mixDescription: '已儲存的9月AI進場訊號與EMA20/50方向一致時進場。明確的平倉訊號按原樣執行。',
  },
  es: {
    tradeTable: 'Tabla de operaciones',
    execution: 'Plataforma de ejecución', recordSource: 'Origen del registro', verifyUnavailable: 'Este registro no admite verificación directa.', mixBasisGeneral: 'Decisiones de IA guardadas en septiembre · filtro de condiciones', pnl: 'PnL',
    week: 'Últimos 7 días de septiembre', month: 'Septiembre completo', all: 'Todos los registros de septiembre', quarter: '3 meses', year: '1 año', scope: 'Registros de septiembre',
    agent: 'Decisiones de septiembre', rule: 'Registro de reglas', mix: 'Decisiones de IA y condiciones de tendencia', basis: 'Base de decisión',
    agentBasis: 'Decisiones de IA guardadas en septiembre', ruleBasis: 'Velas confirmadas de 15 minutos · una vez al día', mixBasis: 'Decisiones de IA guardadas en septiembre · condiciones EMA20/50',
    mixDescription: 'Entra cuando las señales de entrada de IA guardadas en septiembre coinciden con la dirección EMA20/50. Las señales explícitas de cierre se aplican directamente.',
  },
  fr: {
    tradeTable: 'Tableau des opérations',
    execution: 'Plateforme d’exécution', recordSource: 'Source du registre', verifyUnavailable: 'Ce registre ne permet pas de vérification directe.', mixBasisGeneral: 'Décisions IA enregistrées en septembre · filtre de conditions', pnl: 'PnL',
    week: '7 derniers jours de septembre', month: 'Septembre complet', all: 'Tous les enregistrements de septembre', quarter: '3 mois', year: '1 an', scope: 'Enregistrements de septembre',
    agent: 'Décisions de septembre', rule: 'Journal des règles', mix: 'Décisions IA et conditions de tendance', basis: 'Base de décision',
    agentBasis: 'Décisions IA enregistrées en septembre', ruleBasis: 'Bougies confirmées de 15 minutes · une fois par jour', mixBasis: 'Décisions IA enregistrées en septembre · conditions EMA20/50',
    mixDescription: 'Entre lorsque les signaux d’entrée IA enregistrés en septembre suivent la direction EMA20/50. Les signaux explicites de clôture sont appliqués directement.',
  },
} as const

export function evaluatedDetailText(language: ClientLanguage, key: keyof typeof rows.ko) { return rows[language][key] }
export function evaluatedPeriodLabel(language: ClientLanguage, days: number) {
  return evaluatedDetailText(language, days === 7 ? 'week' : days === 90 ? 'quarter' : days === 365 ? 'year' : days === 0 ? 'all' : 'month')
}
export function evaluatedJudgmentHeading(language: ClientLanguage, kind: StrategyKind) { return evaluatedDetailText(language, kind) }

export function evaluatedMixPolicyCopy(item: EvaluatedStrategy, language: ClientLanguage) {
  const bound = item.policy.gate === 'Flat and opposite-side flip entries only: open_long requires EMA20 aboveEMA50; open_short requires EMA20 belowEMA50; equality blocks' && item.policy.modelFeedback === 'Stored original signals only; original model never saw derived account; no new judgments or provider calls'
  return { description: bound ? evaluatedDetailText(language, 'mixDescription') : item.description, basis: evaluatedDetailText(language, bound ? 'mixBasis' : 'mixBasisGeneral') }
}
