import type { ClientLanguage } from './client-preferences'

const languages: readonly ClientLanguage[] = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']
type Translation = readonly [string, string, string, string, string, string, string]
const copy = {
  title: ['무엇이 문제였나요?', 'What was the issue?', 'どのような問題がありましたか？', '出了什么问题？', '出了什麼問題？', '¿Cuál fue el problema?', 'Quel était le problème ?'],
  help: ['제공해 주시는 의견은 TETH를 모두에게 더 유용하도록 개선하는 데 도움이 됩니다.', 'Your feedback helps make TETH more useful for everyone.', 'ご意見は、TETHをすべての方にとってより有用なサービスにするための改善につながります。', '您的反馈有助于让 TETH 对所有人都更有帮助。', '您的意見有助於讓 TETH 對所有人都更有幫助。', 'Tus comentarios ayudan a que TETH sea más útil para todos.', 'Vos commentaires nous aident à rendre TETH plus utile à tous.'],
  factual: ['사실과 다름', 'Factually incorrect', '事実と異なる', '与事实不符', '與事實不符', 'Información incorrecta', 'Informations factuellement incorrectes'],
  instructions: ['요청 사항을 따르지 않음', 'Did not follow the request', 'リクエストに従っていない', '未遵循请求', '未遵循要求', 'No siguió la solicitud', 'Ne respecte pas la demande'],
  unhelpful: ['내용이 도움이 되지 않음', 'Not helpful', '内容が役に立たない', '内容没有帮助', '內容沒有幫助', 'No es útil', 'Contenu peu utile'],
  outdated: ['오래되거나 부정확한 정보', 'Outdated or inaccurate information', '古い、または不正確な情報', '过时或不准确的信息', '過時或不準確的資訊', 'Información desactualizada o inexacta', 'Informations obsolètes ou inexactes'],
  unsafe: ['안전하지 않거나 부적절함', 'Unsafe or inappropriate', '安全でない、または不適切', '不安全或不恰当', '不安全或不適當', 'Inseguro o inapropiado', 'Dangereux ou inapproprié'],
  other: ['기타', 'Other', 'その他', '其他', '其他', 'Otro', 'Autre'],
  placeholder: ['어떤 점이 문제였는지 알려주세요', 'Tell us what went wrong', 'どのような問題があったか教えてください', '请告诉我们哪里出了问题', '請告訴我們哪裡出了問題', 'Cuéntanos qué salió mal', 'Dites-nous ce qui ne va pas'],
  submit: ['제출', 'Submit', '送信', '提交', '提交', 'Enviar', 'Envoyer'],
} as const satisfies Record<string, Translation>
export type AnswerFeedbackKey = keyof typeof copy
export const answerFeedbackReasons = ['factual', 'instructions', 'unhelpful', 'outdated', 'unsafe'] as const
export function answerFeedbackText(language: ClientLanguage, key: AnswerFeedbackKey) { return copy[key][languages.indexOf(language)] }
