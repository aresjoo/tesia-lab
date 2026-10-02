import type { ClientLanguage } from './client-preferences'

// Korean source: tesia-lab taiErrCard and the empty interrupted-response branch.
// Translations preserve the same failure/retry meaning, not a new success claim.
const copy = {
  regenerate: ['다시 생성', 'Regenerate', '再生成', '重新生成', '重新產生', 'Regenerar', 'Régénérer'],
  title: ['답변을 불러오지 못했습니다.', 'Failed to load response.', '回答を読み込めませんでした。', '无法加载回答。', '無法載入回答。', 'No se pudo cargar la respuesta.', 'Impossible de charger la réponse.'],
  detail: ['네트워크 연결이 불안정하거나 AI 요청 처리 중 문제가 발생했습니다.', 'Network connection is unstable or an error occurred while processing the AI request.', 'ネットワーク接続が不安定か、AIリクエストの処理中に問題が発生しました。', '网络连接不稳定或处理 AI 请求时出现问题。', '網路連線不穩定或處理 AI 請求時發生問題。', 'La conexión de red es inestable o se produjo un error al procesar la solicitud de IA.', 'La connexion réseau est instable ou un problème est survenu lors du traitement de la requête IA.'],
  retry: ['다시 시도', 'Retry', '再試行', '重试', '重試', 'Reintentar', 'Réessayer'],
} as const
const languages: readonly ClientLanguage[] = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']

export function responseRetryText(language: ClientLanguage, key: keyof typeof copy): string {
  return copy[key][languages.indexOf(language)]!
}
