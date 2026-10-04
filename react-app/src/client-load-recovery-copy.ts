import type { ClientLanguage } from './client-preferences'

// Optional-chunk recovery chrome only. Preserve the existing Korean copy and
// actions; a language update must not replace the retained recovery subtree.
export const clientLoadRecoveryCopy = {
  ko: { loading: '페이지를 불러오는 중입니다', failed: '페이지를 불러오지 못했습니다', back: '대화로 돌아가기', reload: '페이지 새로고침', description: '연결 상태를 확인하거나 대화로 돌아가세요.' },
  en: { loading: 'Loading the page', failed: 'Could not load the page', back: 'Back to conversation', reload: 'Reload page', description: 'Check your connection or return to the conversation.' },
  ja: { loading: 'ページを読み込んでいます', failed: 'ページを読み込めませんでした', back: '会話に戻る', reload: 'ページを再読み込み', description: '接続状況を確認するか、会話に戻ってください。' },
  'zh-CN': { loading: '正在加载页面', failed: '无法加载页面', back: '返回对话', reload: '重新加载页面', description: '请检查网络连接或返回对话。' },
  'zh-TW': { loading: '正在載入頁面', failed: '無法載入頁面', back: '返回對話', reload: '重新載入頁面', description: '請檢查網路連線或返回對話。' },
  es: { loading: 'Cargando la página', failed: 'No se pudo cargar la página', back: 'Volver a la conversación', reload: 'Recargar página', description: 'Comprueba tu conexión o vuelve a la conversación.' },
  fr: { loading: 'Chargement de la page', failed: 'Impossible de charger la page', back: 'Retour à la conversation', reload: 'Actualiser la page', description: 'Vérifiez votre connexion ou revenez à la conversation.' },
} satisfies Record<ClientLanguage, Record<'loading' | 'failed' | 'back' | 'reload' | 'description', string>>
