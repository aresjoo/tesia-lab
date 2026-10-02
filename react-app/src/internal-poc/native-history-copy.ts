import type { ClientLanguage } from '../client-preferences'

// Display only. No claim about collection size, persistence or a future release.
// Opus 5 personal(1) copy review: e3ce03f4-5eec-4e8f-a161-22cab8521583.
export const nativeHistoryCopy: Record<ClientLanguage, { title: string; body: string }> = {
  ko: { title: '전체 연구 기록 조회는 아직 연결되지 않았습니다', body: '지금 대화와 실행 결과는 그대로 유지되며, 대화로 돌아가 이어서 진행할 수 있어요.' },
  en: { title: 'Full research history isn’t connected yet', body: 'Your current conversation and its run results are preserved, and you can go back to the conversation to continue.' },
  ja: { title: '研究履歴の一覧はまだ接続されていません', body: '現在の会話と実行結果はそのまま保持されており、会話に戻って続けられます。' },
  'zh-CN': { title: '完整研究记录的查询尚未接入', body: '当前对话和执行结果均已保留，可返回对话继续。' },
  'zh-TW': { title: '完整研究紀錄的查詢尚未接上', body: '目前的對話與執行結果皆已保留，可返回對話繼續。' },
  es: { title: 'El historial de investigación completo aún no está conectado', body: 'Tu conversación actual y sus resultados de ejecución se conservan, y puedes volver a la conversación para continuar.' },
  fr: { title: 'L’historique complet des recherches n’est pas encore connecté', body: 'Votre conversation actuelle et ses résultats d’exécution sont conservés, et vous pouvez revenir à la conversation pour continuer.' },
}
