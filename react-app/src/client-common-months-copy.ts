import type { ClientLanguage } from './client-preferences'

// Frozen source 9fbff821, artifacts/teth-redesign/tools/sk-bt.js:97–103.
const copy = {
  ko: { before: '아직 한 달이 안 됐습니다. 지금까지 ', after: '입니다.', partial: '시작한 달과 마지막 달은 일부 기간만 계산했습니다.' },
  en: { before: 'A full month has not passed yet. The return so far is ', after: '.', partial: 'Only part of the first and last months was calculated.' },
  ja: { before: 'まだ1か月が経過していません。これまでの収益率は', after: 'です。', partial: '開始月と最終月は一部の期間のみを計算しました。' },
  'zh-CN': { before: '还未满一个月。目前收益率为 ', after: '。', partial: '起始月和最后一个月仅计算了部分期间。' },
  'zh-TW': { before: '還未滿一個月。目前收益率為 ', after: '。', partial: '起始月和最後一個月僅計算了部分期間。' },
  es: { before: 'Todavía no ha transcurrido un mes completo. El rendimiento hasta ahora es ', after: '.', partial: 'Solo se calculó parte del primer y del último mes.' },
  fr: { before: 'Un mois complet ne s’est pas encore écoulé. Le rendement à ce jour est de ', after: '.', partial: 'Seule une partie du premier et du dernier mois a été calculée.' },
} satisfies Record<ClientLanguage, { before: string; after: string; partial: string }>

export function commonMonthsShortText(language: ClientLanguage) { return copy[language] }
