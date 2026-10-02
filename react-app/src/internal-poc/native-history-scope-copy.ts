import type { ClientLanguage } from '../client-preferences'

export const nativeHistoryScopeCopy: Record<ClientLanguage, { title: string; body: string; load: string }> = {
  ko: {
    title: '현재 대화의 실행 이력',
    body: '이 대화에서 승인한 전략과 실행 결과만 확인합니다. 계정 전체 연구 기록은 포함하지 않습니다.',
    load: '실행 이력 불러오기',
  },
  en: {
    title: 'Run history for this conversation',
    body: 'Only strategies approved in this conversation and their run results are shown. Your account’s full research history is not included.',
    load: 'Load execution history',
  },
  ja: {
    title: 'この会話の実行履歴',
    body: 'この会話で承認した戦略とその実行結果のみを表示します。アカウント全体の研究履歴は含まれません。',
    load: '実行履歴を読み込む',
  },
  'zh-CN': {
    title: '当前对话的运行记录',
    body: '仅显示在本次对话中批准的策略及其运行结果，不包含账号的全部研究记录。',
    load: '加载运行记录',
  },
  'zh-TW': {
    title: '目前對話的執行紀錄',
    body: '僅顯示在本次對話中核准的策略及其執行結果，不包含帳號的完整研究紀錄。',
    load: '載入執行紀錄',
  },
  es: {
    title: 'Historial de ejecución de esta conversación',
    body: 'Solo se muestran las estrategias aprobadas en esta conversación y sus resultados de ejecución. No incluye el historial de investigación completo de la cuenta.',
    load: 'Cargar historial de ejecución',
  },
  fr: {
    title: 'Historique des exécutions de cette conversation',
    body: 'Seules les stratégies approuvées dans cette conversation et leurs résultats d’exécution sont affichés. L’historique complet des recherches du compte n’est pas inclus.',
    load: 'Charger l’historique des exécutions',
  },
}
