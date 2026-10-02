import type { ClientLanguage } from './client-preferences'

/** Source comparison chrome only. Supplied rows, notes and request text stay verbatim. */
type Translations = readonly [string, string, string, string, string, string, string]
const column = { ko: 0, en: 1, ja: 2, 'zh-CN': 3, 'zh-TW': 4, es: 5, fr: 6 } as const satisfies Record<ClientLanguage, number>
export const strategyProposalCopy = {
  "title": [
    "전략 변경안",
    "Strategy change proposal",
    "戦略の変更案",
    "策略变更方案",
    "策略變更方案",
    "Propuesta de cambio de estrategia",
    "Proposition de modification de la stratégie"
  ],
  "subtitle": [
    "{version} 기준, 재검증 실계산",
    "Based on {version}, re-validation recomputed",
    "{version} 基準、再検証を実計算",
    "以 {version} 为基准，重新验证实算",
    "以 {version} 為基準，重新驗證實算",
    "Basado en {version}, revalidación recalculada",
    "Sur la base de {version}, revalidation recalculée"
  ],
  "comparison": [
    "전략 변경 비교표",
    "Strategy change comparison table",
    "戦略変更の比較表",
    "策略变更对比表",
    "策略變更對比表",
    "Tabla comparativa del cambio de estrategia",
    "Tableau comparatif de la modification de stratégie"
  ],
  "field": [
    "항목",
    "Field",
    "項目",
    "项目",
    "項目",
    "Campo",
    "Champ"
  ],
  "return": [
    "검증 수익",
    "Validation return",
    "検証収益",
    "验证收益",
    "驗證收益",
    "Rentabilidad de validación",
    "Rendement de validation"
  ],
  "drawdown": [
    "최대 낙폭",
    "Max drawdown",
    "最大ドローダウン",
    "最大回撤",
    "最大回撤",
    "Caída máxima",
    "Drawdown maximal"
  ],
  "trades": [
    "거래 수",
    "Trade count",
    "取引数",
    "交易数",
    "交易數",
    "Número de operaciones",
    "Nombre d'opérations"
  ],
  "tradesValue": [
    "{before} → {after}회",
    "{before} → {after}",
    "{before} → {after}回",
    "{before} → {after}次",
    "{before} → {after}次",
    "{before} → {after}",
    "{before} → {after}"
  ],
  "score": [
    "재검증 점수",
    "Re-validation score",
    "再検証スコア",
    "重新验证评分",
    "重新驗證評分",
    "Puntuación de revalidación",
    "Score de revalidation"
  ],
  "scoreValue": [
    "{score}점 {status}",
    "{score} points, {status}",
    "{score}点 {status}",
    "{score} 分，{status}",
    "{score} 分，{status}",
    "{score} puntos, {status}",
    "{score} points, {status}"
  ],
  "passed": [
    "통과",
    "passed",
    "合格",
    "通过",
    "通過",
    "superado",
    "réussi"
  ],
  "below": [
    "기준 미달",
    "below the threshold",
    "基準未達",
    "未达标准",
    "未達標準",
    "por debajo del umbral",
    "sous le seuil"
  ],
  "unsupported": [
    "미지원이라 반영 안 됨: {items}",
    "Not applied because unsupported: {items}",
    "未対応のため反映されません：{items}",
    "因不支持未予应用：{items}",
    "因不支援未予套用：{items}",
    "No aplicado por no ser compatible: {items}",
    "Non appliqué car non pris en charge : {items}"
  ],
  "original": [
    "요청 원문: \"{request}\". 위 표의 항목만 반영돼요. 원문의 다른 표현은 해석되지 않았어요.",
    "Original request: \"{request}\". Only the fields in the table above are applied. Other wording in the request was not interpreted.",
    "要求原文：「{request}」。上の表の項目のみ反映されます。原文の他の表現は解釈されていません。",
    "请求原文：“{request}”。仅应用上表中的项目。原文中的其他表述未被解析。",
    "請求原文：「{request}」。僅套用上表中的項目。原文中的其他表述未被解析。",
    "Solicitud original: \"{request}\". Solo se aplican los campos de la tabla anterior. El resto del texto no se interpretó.",
    "Demande d'origine : « {request} ». Seuls les champs du tableau ci-dessus sont appliqués. Le reste du texte n'a pas été interprété."
  ],
  "stopNotice": [
    "적용 시 이 전략은 {status}돼요. 자동 재개는 없으며, 확인 후 직접 재개해야 해요.",
    "Applying this will leave the strategy {status}. There is no automatic resume; you must resume it yourself after checking.",
    "適用するとこの戦略は{status}になります。自動再開はなく、確認後にご自身で再開する必要があります。",
    "应用后该策略将{status}。不会自动恢复，确认后需要你手动恢复。",
    "套用後此策略將{status}。不會自動恢復，確認後需要你手動恢復。",
    "Al aplicarlo, la estrategia quedará {status}. No se reanuda automáticamente; debes reanudarla tú tras comprobarlo.",
    "Après application, la stratégie sera {status}. Aucune reprise automatique ; vous devez la relancer vous-même après vérification."
  ],
  "stopped": [
    "중지",
    "stopped",
    "停止",
    "停止",
    "停止",
    "detenida",
    "arrêtée"
  ],
  "stale": [
    "전략 상태가 바뀌어 변경안이 무효화됐어요. 다시 요청해주세요",
    "The strategy state changed, so this proposal is no longer valid. Please request it again",
    "戦略の状態が変わったため、この変更案は無効になりました。もう一度リクエストしてください",
    "策略状态已变更，此变更方案已失效。请重新请求",
    "策略狀態已變更，此變更方案已失效。請重新請求",
    "El estado de la estrategia cambió, por lo que la propuesta ya no es válida. Solicítala de nuevo",
    "L'état de la stratégie a changé : cette proposition n'est plus valide. Veuillez la redemander"
  ],
  "invalid": [
    "변경안 정보가 올바르지 않습니다. 다시 요청해주세요.",
    "The proposal data is not valid. Please request it again.",
    "変更案の情報が正しくありません。もう一度リクエストしてください。",
    "变更方案的信息不正确。请重新请求。",
    "變更方案的資訊不正確。請重新請求。",
    "Los datos de la propuesta no son válidos. Solicítala de nuevo.",
    "Les données de la proposition ne sont pas valides. Veuillez la redemander."
  ],
  "unavailable": [
    "변경 적용 기능이 제공되지 않았습니다.",
    "The apply-change action was not provided.",
    "変更適用の機能は提供されていません。",
    "未提供变更应用功能。",
    "未提供變更套用功能。",
    "No se proporcionó la función para aplicar el cambio.",
    "La fonction d'application de la modification n'a pas été fournie."
  ],
  "pending": [
    "적용 중…",
    "Applying…",
    "適用中…",
    "正在应用…",
    "正在套用…",
    "Aplicando…",
    "Application en cours…"
  ],
  "cancel": [
    "취소",
    "Cancel",
    "キャンセル",
    "取消",
    "取消",
    "Cancelar",
    "Annuler"
  ],
  "belowTitle": [
    "재검증 기준(80점) 미달",
    "Below the re-validation threshold (80 points)",
    "再検証基準（80点）未達",
    "未达重新验证标准（80 分）",
    "未達重新驗證標準（80 分）",
    "Por debajo del umbral de revalidación (80 puntos)",
    "Sous le seuil de revalidation (80 points)"
  ],
  "stopApply": [
    "중지하고 적용",
    "Stop and apply",
    "停止して適用",
    "停止并应用",
    "停止並套用",
    "Detener y aplicar",
    "Arrêter et appliquer"
  ],
  "apply": [
    "변경 적용",
    "Apply change",
    "変更を適用",
    "应用变更",
    "套用變更",
    "Aplicar el cambio",
    "Appliquer la modification"
  ],
  "cannotApply": [
    "기준 미달, 적용 불가",
    "Below the threshold, cannot apply",
    "基準未達のため適用不可",
    "未达标准，无法应用",
    "未達標準，無法套用",
    "Por debajo del umbral, no se puede aplicar",
    "Sous le seuil, application impossible"
  ]
} as const satisfies Record<string, Translations>

export function strategyProposalText(language: ClientLanguage, key: keyof typeof strategyProposalCopy, values: Readonly<Record<string, string>> = {}): string {
  return strategyProposalCopy[key][column[language]].replace(/\{(\w+)\}/g, (token, name: string) => Object.hasOwn(values, name) ? values[name] : token)
}

let requestSegmenter: Intl.Segmenter | undefined
/** Keep the source 60 UTF-16-unit preview budget, but never split a grapheme.
 * The original request remains untouched and is still passed to the caller.
 */
export function proposalRequestExcerpt(request: string): string {
  if (request.length <= 60) return request
  requestSegmenter ??= new Intl.Segmenter('und', { granularity: 'grapheme' })
  let boundary = 0
  for (const { index, segment } of requestSegmenter.segment(request)) {
    const end = index + segment.length
    if (end > 60) break
    boundary = end
  }
  return `${request.slice(0, boundary)}…`
}
