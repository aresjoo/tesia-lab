// Kept independent of React and the main bundle so bootstrap failure can
// still explain recovery in the user's stored language.
export const clientEntryCopy = {
  "ko": {
    "failure": "화면을 불러오지 못했습니다. 다시 시도해주세요.",
    "reload": "다시 불러오기",
    "title": "TETH AI — 거래를 위한 AI"
  },
  "en": {
    "failure": "The screen could not be loaded. Please try again.",
    "reload": "Reload",
    "title": "TETH AI — AI for Trading"
  },
  "ja": {
    "failure": "画面を読み込めませんでした。もう一度お試しください。",
    "reload": "再読み込み",
    "title": "TETH AI — 取引のためのAI"
  },
  "zh-CN": {
    "failure": "未能加载界面。请重试。",
    "reload": "重新加载",
    "title": "TETH AI — 为交易而生的 AI"
  },
  "zh-TW": {
    "failure": "未能載入畫面。請再試一次。",
    "reload": "重新載入",
    "title": "TETH AI — 為交易而生的 AI"
  },
  "es": {
    "failure": "No se pudo cargar la pantalla. Inténtalo de nuevo.",
    "reload": "Volver a cargar",
    "title": "TETH AI — IA para operar"
  },
  "fr": {
    "failure": "L'écran n'a pas pu être chargé. Veuillez réessayer.",
    "reload": "Recharger",
    "title": "TETH AI — l'IA pour le trading"
  }
} as const

export function storedEntryLanguage(): keyof typeof clientEntryCopy {
  try {
    const language = localStorage.getItem('tethLang')
    if (language && Object.hasOwn(clientEntryCopy, language)) return language as keyof typeof clientEntryCopy
  } catch { /* Unavailable preferences must not prevent the recovery screen. */ }
  return 'ko'
}
