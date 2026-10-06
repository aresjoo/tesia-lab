import type { ClientLanguage } from '../client-preferences'

type Translations = readonly [string, string, string, string, string, string, string]
const column = { ko: 0, en: 1, ja: 2, 'zh-CN': 3, 'zh-TW': 4, es: 5, fr: 6 } as const satisfies Record<ClientLanguage, number>
/** Source gDocPlan labels only. Supplied conditions/numbers are never translated. */
export const nativeResearchPlanCopy = {
  title: ['연구 계획', 'Research plan', '研究計画', '研究计划', '研究計畫', 'Plan de investigación', 'Plan de recherche'],
  hint: ['행 위에서 💬로 수정 요청', 'Request changes with 💬 on a row', '行の💬から修正を依頼', '通过行上的💬请求修改', '透過列上的💬請求修改', 'Solicita cambios con 💬 en cada fila', 'Demandez une modification avec 💬 sur une ligne'],
  target: ['대상', 'Target', '対象', '标的', '標的', 'Objetivo', 'Cible'],
  entry: ['진입', 'Entry', 'エントリー', '入场', '入場', 'Entrada', 'Entrée'],
  stopLoss: ['손절', 'Stop loss', '損切り', '止损', '止損', 'Límite de pérdidas', 'Seuil de perte'],
  takeProfit: ['익절', 'Take profit', '利確', '止盈', '止盈', 'Objetivo de beneficio', 'Objectif de gain'],
  researchRange: ['연구 데이터', 'Research data', '研究データ', '研究数据', '研究資料', 'Datos de investigación', 'Données de recherche'],
  holdoutRange: ['봉인 구간', 'Holdout period', 'ホールドアウト期間', '留出区间', '保留區間', 'Período de reserva', 'Période de réserve'],
  costs: ['거래 비용', 'Trading costs', '取引コスト', '交易成本', '交易成本', 'Costes de negociación', 'Frais de transaction'],
  validation: ['검증', 'Validation', '検証', '验证', '驗證', 'Validación', 'Validation'],
  unavailable: ['미제공', 'Not supplied', '未提供', '未提供', '未提供', 'No proporcionado', 'Non fourni'],
  comment: ['코멘트', 'Comment', 'コメント', '评论', '註解', 'Comentario', 'Commentaire'],
  start: ['연구 시작', 'Start research', '研究を開始', '开始研究', '開始研究', 'Iniciar investigación', 'Lancer la recherche'],
  edit: ['조건 수정', 'Edit conditions', '条件を修正', '修改条件', '修改條件', 'Editar condiciones', 'Modifier les conditions'],
  pending: ['요청 확인 중', 'Checking request', 'リクエストを確認中', '正在确认请求', '正在確認請求', 'Comprobando la solicitud', 'Vérification de la demande'],
  failed: ['요청을 완료하지 못했어요. 다시 시도해 주세요.', 'Could not complete the request. Please try again.', 'リクエストを完了できませんでした。再試行してください。', '未能完成请求，请重试。', '未能完成請求，請重試。', 'No se pudo completar la solicitud. Inténtalo de nuevo.', 'La demande a échoué. Réessayez.'],
} as const satisfies Record<string, Translations>
export type NativeResearchPlanCopyKey = keyof typeof nativeResearchPlanCopy
export function nativeResearchPlanText(language: ClientLanguage, key: NativeResearchPlanCopyKey): string { return nativeResearchPlanCopy[key][column[language]] }
