import type { ClientLanguage } from './client-preferences'

/** Display projection only. Never a billing receipt or server entitlement. */
export type UsageTier = 'FREE' | 'UID' | 'CARD' | 'CARD_UID'
export type UsagePresentation = {
  source: 'mock' | 'service' | 'unavailable'
  scope: string | null
  month: string
  tier: UsageTier | null
  pct: number | null
  creditUsd: number | null
  resetAt: number | null
  autoTopup?: boolean | null
}
export type UsageDismissal = { scope: string; month: string }
export type UsageAction = 'new' | 'edit' | 'analyze' | 'read'
export const usageTopupAmounts = [10, 25, 50, 100] as const
export type UsageTopupAmount = typeof usageTopupAmounts[number]
export type UsagePreviewInput = {
  scope: string; month: string; tier: UsageTier; usedUsd: number; balanceUsd: number; resetAt: number
  autoTopup?: boolean
}
const tiers: readonly string[] = ['FREE', 'UID', 'CARD', 'CARD_UID']
const monthValid = (value: string) => /^\d{4}-(?:0?[1-9]|1[0-2])$/.test(value)
const timeValid = (value: number) => Number.isSafeInteger(value) && value >= 0 && value <= 8640000000000000

/** Source 9fbff821 aiMeter formula, isolated to the explicitly local preview.
 * Calendar/reset inputs are supplied; no Date.now, automatic charge or storage. */
export function deriveUsagePreview(input: UsagePreviewInput): UsagePresentation | null {
  if (!input.scope?.trim() || !monthValid(input.month) || !tiers.includes(input.tier)
    || !Number.isFinite(input.usedUsd) || input.usedUsd < 0 || !Number.isFinite(input.balanceUsd)
    || !timeValid(input.resetAt)) return null
  const credit = Math.max(0, input.balanceUsd)
  const allowance = input.tier === 'FREE' || input.tier === 'UID' ? input.usedUsd + credit
    : 200 + (input.tier === 'CARD_UID' ? credit : 0)
  if (!Number.isFinite(allowance)) return null
  const pct = allowance > 0 ? Math.min(100, Math.round(input.usedUsd / allowance * 100)) : input.usedUsd > 0 ? 100 : 0
  return { source: 'mock', scope: input.scope, month: input.month, tier: input.tier,
    pct, creditUsd: credit, resetAt: input.resetAt, autoTopup: input.autoTopup }
}

/** Source aiBill math only. Gross and month inflow are supplied, never guessed.
 * The output is preview arithmetic, not a confirmed next invoice. */
export function usageBillPreview(input: UsagePreviewInput, grossUsd: number, monthInflowUsd: number) {
  if (!deriveUsagePreview(input) || !Number.isFinite(grossUsd) || grossUsd < 0 || !Number.isFinite(monthInflowUsd) || monthInflowUsd < 0) return null
  const credit = input.tier === 'CARD_UID' || input.tier === 'UID' ? Math.min(grossUsd, monthInflowUsd) : 0
  const extra = input.tier === 'CARD' || input.tier === 'CARD_UID'
    ? Math.max(0, input.usedUsd - 200 - (input.tier === 'CARD_UID' ? Math.max(0, input.balanceUsd) : 0)) : 0
  const total = Math.max(0, grossUsd - credit + extra)
  return Number.isFinite(total) ? { source: 'mock' as const, gross: grossUsd, credit, extra, total } : null
}

export function usagePresentationBound(value: UsagePresentation | undefined | null, scope?: string | null): value is UsagePresentation {
  return Boolean(value && scope?.trim() && value.scope === scope && ['mock', 'service'].includes(value.source)
    && monthValid(value.month) && value.tier && tiers.includes(value.tier)
    && typeof value.pct === 'number' && Number.isFinite(value.pct) && value.pct >= 0 && value.pct <= 100)
}
/** UI admission only; the server remains the authority for every operation. */
export function usageGate(value: UsagePresentation | undefined | null, scope: string | null | undefined, action: UsageAction): 'allow' | 'warn' | 'block' | 'unavailable' {
  if (action === 'read' || !scope) return 'allow'
  if (!usagePresentationBound(value, scope)) return 'unavailable'
  return value.pct! >= 100 ? 'block' : value.pct! >= 80 ? 'warn' : 'allow'
}
export function usageBannerVisible(value: UsagePresentation | undefined | null, scope?: string | null, dismissed?: UsageDismissal | null) {
  return usagePresentationBound(value, scope) && value.pct! >= 80
    && (value.pct! >= 100 || !dismissed || dismissed.scope !== scope || dismissed.month !== value.month)
}

const words = {
  title: ['사용량', 'Usage', '使用量', '使用量', '使用量', 'Uso', 'Utilisation'],
  month: ['이번 달 AI 사용량', 'AI usage this month', '今月のAI使用量', '本月 AI 使用量', '本月 AI 使用量', 'Uso de IA este mes', 'Utilisation de l’IA ce mois-ci'],
  mode: ['이용 방식', 'Usage plan', '利用方法', '使用方式', '使用方式', 'Modalidad de uso', 'Mode d’utilisation'],
  credit: ['거래 크레딧', 'Trading credit', '取引クレジット', '交易额度', '交易額度', 'Crédito de operaciones', 'Crédit de trading'],
  FREE: ['무료 둘러보기', 'Free preview', '無料プレビュー', '免费浏览', '免費瀏覽', 'Vista previa gratuita', 'Aperçu gratuit'],
  UID: ['TETH 초대 계정', 'TETH invited account', 'TETH招待アカウント', 'TETH 邀请账户', 'TETH 邀請帳戶', 'Cuenta invitada TETH', 'Compte invité TETH'],
  CARD: ['TETH 구독', 'TETH subscription', 'TETHサブスクリプション', 'TETH 订阅', 'TETH 訂閱', 'Suscripción TETH', 'Abonnement TETH'],
  CARD_UID: ['TETH 구독과 초대 계정', 'TETH subscription and invited account', 'TETHサブスクリプションと招待アカウント', 'TETH 订阅和邀请账户', 'TETH 訂閱和邀請帳戶', 'Suscripción y cuenta invitada TETH', 'Abonnement et compte invité TETH'],
  FREEHow: ['둘러보기용 무료 사용량입니다.', 'Free usage for exploring.', 'プレビュー用の無料使用量です。', '供浏览使用的免费额度。', '供瀏覽使用的免費額度。', 'Uso gratuito para explorar.', 'Utilisation gratuite pour découvrir.'],
  UIDHow: ['모자라면 카드를 등록해 계속 쓸 수 있습니다.', 'Add a card to continue if you need more.', '不足する場合はカードを登録して継続できます。', '额度不足时可添加银行卡继续使用。', '額度不足時可新增信用卡繼續使用。', 'Añada una tarjeta para continuar si necesita más.', 'Ajoutez une carte pour continuer si nécessaire.'],
  CARDHow: ['초대 계정을 연결하면 사용량이 매달 더 생깁니다.', 'Connect an invited account for more usage each month.', '招待アカウントを接続すると毎月の使用量が増えます。', '连接邀请账户可增加每月使用额度。', '連接邀請帳戶可增加每月使用額度。', 'Conecte una cuenta invitada para más uso mensual.', 'Connectez un compte invité pour davantage d’utilisation mensuelle.'],
  CARD_UIDHow: ['모자라면 크레딧을 추가해 계속 쓸 수 있습니다.', 'Add credit to continue if you need more.', '不足する場合はクレジットを追加して継続できます。', '额度不足时可添加额度继续使用。', '額度不足時可新增額度繼續使用。', 'Añada crédito para continuar si necesita más.', 'Ajoutez du crédit pour continuer si nécessaire.'],
  nextFREE: ['이용 방식 고르기', 'Choose a plan', '利用方法を選択', '选择使用方式', '選擇使用方式', 'Elegir modalidad', 'Choisir un mode'],
  nextUID: ['카드 등록', 'Add a card', 'カードを登録', '添加银行卡', '新增信用卡', 'Añadir tarjeta', 'Ajouter une carte'],
  nextCARD: ['초대 계정 연결', 'Connect invited account', '招待アカウントを接続', '连接邀请账户', '連接邀請帳戶', 'Conectar cuenta invitada', 'Connecter un compte invité'],
  nextCARD_UID: ['크레딧 추가', 'Add credit', 'クレジットを追加', '添加额度', '新增額度', 'Añadir crédito', 'Ajouter du crédit'],
  warning: ['이번 달 AI 사용량의 {pct}%를 썼습니다.', 'You have used {pct}% of your AI usage this month.', '今月のAI使用量の{pct}%を使いました。', '您已使用本月 AI 额度的 {pct}%。', '您已使用本月 AI 額度的 {pct}%。', 'Ha utilizado el {pct}% de su uso de IA este mes.', 'Vous avez utilisé {pct}% de votre quota d’IA ce mois-ci.'],
  full: ['이번 달 AI 사용량을 모두 써서 새 요청은 잠시 멈춥니다. 실행 중인 전략과 결과 보기는 그대로입니다.', 'Your AI usage for this month is exhausted. New requests are paused. Running strategies and viewing results remain available.', '今月のAI使用量を使い切ったため新規リクエストを一時停止します。実行中の戦略と結果の閲覧は継続できます。', '本月 AI 额度已用完，新请求暂时停止。运行中的策略和结果查看不受影响。', '本月 AI 額度已用完，新請求暫時停止。執行中的策略和結果查看不受影響。', 'Se ha agotado el uso de IA del mes. Las nuevas solicitudes se pausan. Las estrategias en ejecución y la consulta de resultados siguen disponibles.', 'Votre quota mensuel d’IA est épuisé. Les nouvelles demandes sont suspendues. Les stratégies en cours et la consultation des résultats restent disponibles.'],
  paused: ['새 요청은 잠시 멈춥니다. 실행 중인 전략과 결과 보기는 그대로입니다.', 'New requests are paused. Running strategies and viewing results remain available.', '新規リクエストを一時停止します。実行中の戦略と結果の閲覧は継続できます。', '新请求暂时停止。运行中的策略和结果查看不受影响。', '新請求暫時停止。執行中的策略和結果查看不受影響。', 'Las nuevas solicitudes se pausan. Las estrategias y la consulta de resultados siguen disponibles.', 'Les nouvelles demandes sont suspendues. Les stratégies et la consultation des résultats restent disponibles.'],
  reset: ['{date}에 초기화됩니다.', 'Resets on {date}.', '{date}にリセットされます。', '将于 {date} 重置。', '將於 {date} 重設。', 'Se reinicia el {date}.', 'Réinitialisation le {date}.'],
  topupHint: ['충전한 금액에서 쓴 만큼 차감됩니다. 남은 금액은 다음 달로 이어집니다.', 'Usage is deducted from your top-up. The remaining balance carries over to next month.', 'チャージ金額から使用分が差し引かれます。残額は翌月に繰り越されます。', '已用金额从充值金额中扣除。余额结转至下月。', '已用金額從儲值金額中扣除。餘額結轉至下月。', 'El uso se descuenta de la recarga. El saldo restante pasa al mes siguiente.', 'L’utilisation est déduite de la recharge. Le solde est reporté au mois suivant.'],
  auto: ['잔액이 $5 아래로 내려가면 $25를 자동으로 충전합니다', 'Automatically add $25 when the balance falls below $5', '残高が$5未満になると$25を自動チャージします', '余额低于 $5 时自动充值 $25', '餘額低於 $5 時自動儲值 $25', 'Recargar $25 automáticamente cuando el saldo baje de $5', 'Ajouter automatiquement 25 $ lorsque le solde passe sous 5 $'],
  close: ['닫기', 'Close', '閉じる', '关闭', '關閉', 'Cerrar', 'Fermer'],
  unavailable: ['아직 제공되지 않은 정보입니다.', 'This information is not available yet.', 'この情報はまだ提供されていません。', '此信息尚未提供。', '此資訊尚未提供。', 'Esta información todavía no está disponible.', 'Ces informations ne sont pas encore disponibles.'],
  failed: ['요청을 완료하지 못했어요. 다시 시도해주세요.', 'The request could not be completed. Please try again.', 'リクエストを完了できませんでした。もう一度お試しください。', '无法完成请求，请重试。', '無法完成請求，請重試。', 'No se pudo completar la solicitud. Inténtelo de nuevo.', 'La demande n’a pas abouti. Réessayez.'],
} as const
const languages: readonly ClientLanguage[] = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']
export function usageText(language: ClientLanguage, key: keyof typeof words, values: Readonly<Record<string, string | number>> = {}) {
  let text: string = words[key][languages.indexOf(language)] ?? words[key][0]
  for (const [name, value] of Object.entries(values)) text = text.replaceAll(`{${name}}`, String(value))
  return text
}
export function usageResetLabel(resetAt: number | null, language: ClientLanguage) {
  if (resetAt === null || !timeValid(resetAt)) return null
  return new Intl.DateTimeFormat(language, { year: 'numeric', month: 'long', day: 'numeric' }).format(resetAt)
}
