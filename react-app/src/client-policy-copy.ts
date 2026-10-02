import type { ClientLanguage } from './client-preferences'
import publicCopy from './client-public-copy.json' with { type: 'json' }
import { downloadText } from './client-download-copy'
const languages = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const
const rows = {
  overview: ['개요', 'Overview', '概要', '概览', '概覽', 'Resumen', 'Présentation'],
  privacy: ['개인정보처리방침', 'Privacy policy', 'プライバシーポリシー', '隐私政策', '隱私權政策', 'Política de privacidad', 'Politique de confidentialité'],
  terms: ['서비스 약관', 'Terms of service', '利用規約', '服务条款', '服務條款', 'Términos del servicio', 'Conditions d’utilisation'],
  technologies: ['기술', 'Technologies', '技術', '技术', '技術', 'Tecnologías', 'Technologies'],
  faq: ['자주 묻는 질문', 'Frequently asked questions', 'よくある質問', '常见问题', '常見問題', 'Preguntas frecuentes', 'Questions fréquentes'],
} as const
// Only chrome is translated. Authored legal content remains Korean, explicitly
// marked lang=ko, under the existing publication/review gate.
export function policyLabels(language: ClientLanguage) {
  const index = languages.indexOf(language)
  return {
    title: language === 'ko' ? '개인정보 보호와 약관' : publicCopy.download.pol[index],
    about: publicCopy.about.navAbout[index],
    download: language === 'ko' ? '앱 다운로드' : publicCopy.about.navDl[index],
    start: downloadText(language, 'start'),
    help: downloadText(language, 'help'),
    ask: downloadText(language, 'ask'),
    overview: rows.overview[index], privacy: rows.privacy[index],
    terms: rows.terms[index], technologies: rows.technologies[index], faq: rows.faq[index],
  }
}
export type PolicyLabels = ReturnType<typeof policyLabels>
