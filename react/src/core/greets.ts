import { GREETS_ALL } from './i18n.data';

/** 히어로 카피 6종 로테이션 (ko). 다른 언어는 GREETS_ALL. */
const GREETS_KO = ['차트 볼 줄\n몰라도 됩니다', '차트 대신\n말로 하십시오', '투자 아이디어만\n있으면 됩니다', '당신의 생각을\n투자 전략으로', '투자도 그냥\n말하면 됩니다', '시장은 혼자\n이기기 어렵습니다'];

/** 서브카피는 로테이션 없이 고정. '\n' 은 모바일 전용 줄바꿈 자리. */
export const GSUB: Record<string, string> = {
  ko: '템플릿을 사용해 보거나 채팅으로 투자를 설명하십시오.\nTETH 모델로 만듭니다.',
  en: 'Try a template or describe your investing idea in chat.\nThe TETH model will build it.',
  ja: 'テンプレートを試すか、チャットで投資を説明してください。\nTETHモデルが作ります。',
  'zh-CN': '试试模板，或在聊天中描述你的投资。\n由TETH模型来构建。',
  'zh-TW': '試試模板，或在聊天中描述你的投資。\n由TETH模型來構建。',
  es: 'Prueba una plantilla o describe tu inversión en el chat.\nEl modelo TETH la construye.',
  fr: "Essayez un modèle ou décrivez votre investissement dans le chat.\nLe modèle TETH s'en charge.",
};

export function greetPool(lang: string): string[] {
  if (lang !== 'ko' && GREETS_ALL[lang]) return GREETS_ALL[lang].map((g) => g.h);
  return GREETS_KO;
}
export function pickGreet(lang: string): string {
  const pool = greetPool(lang);
  return pool[Math.floor(Math.random() * pool.length)];
}
