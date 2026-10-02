import type { ClientLanguage } from './client-preferences'

type TemplateCopy = { choose: string; ask: string; combine: string; analyze: string; questions: readonly string[]; commands: readonly string[] }
const translations: Record<Exclude<ClientLanguage, 'ko'>, TemplateCopy> = {
  en: { choose: 'Which assets would you like to explore?', ask: 'What would you like to know about {assets}?', combine: 'How should we approach {assets}?', analyze: 'Analyze the current market situation for {assets}',
    questions: ['How should AI trade {assets}?', 'Which indicators should we build for {assets}?', 'Would you like to explore strategy rankings for {assets}?', 'What would you like to analyze about {assets}?', 'How should {assets} fit into your portfolio?'],
    commands: ['Create an AI-managed trading strategy{assets}', 'Create custom indicators and a strategy that trades their signals{assets}', 'Show popular strategy rankings{assets}', 'Analyze current market conditions{assets}', 'Analyze portfolio allocation{assets}'] },
  ja: { choose: 'どの銘柄について考えましょうか？', ask: '{assets}について何が知りたいですか？', combine: '{assets}について、どのように進めましょうか？', analyze: '{assets}の現在の市場状況を分析して',
    questions: ['AIに{assets}をどう取引させますか？', '{assets}にどんな指標を作りますか？', '{assets}の戦略ランキングを見ますか？', '{assets}の何を分析しましょうか？', 'ポートフォリオに{assets}をどう組み込みますか？'],
    commands: ['{assets}AIに取引を任せる戦略を作って', '{assets}独自の指標とそのシグナルで取引する戦略を作って', '{assets}人気の戦略ランキングを見せて', '{assets}現在の市場状況を分析して', '{assets}ポートフォリオ配分を分析して'] },
  'zh-CN': { choose: '您想研究哪些标的？', ask: '关于{assets}，您想了解什么？', combine: '针对{assets}，您想如何进行？', analyze: '分析{assets}当前的市场情况',
    questions: ['您想让AI如何交易{assets}？', '您想为{assets}创建什么指标？', '想查看{assets}的策略排名吗？', '您想分析{assets}的哪些方面？', '您想如何在投资组合中配置{assets}？'],
    commands: ['{assets}创建由AI管理交易的策略', '{assets}创建自定义指标以及按其信号交易的策略', '{assets}展示热门策略排名', '{assets}分析当前市场情况', '{assets}分析投资组合配置'] },
  'zh-TW': { choose: '您想研究哪些標的？', ask: '關於{assets}，您想了解什麼？', combine: '針對{assets}，您想如何進行？', analyze: '分析{assets}目前的市場狀況',
    questions: ['您想讓AI如何交易{assets}？', '您想為{assets}建立什麼指標？', '想查看{assets}的策略排名嗎？', '您想分析{assets}的哪些面向？', '您想如何在投資組合中配置{assets}？'],
    commands: ['{assets}建立由AI管理交易的策略', '{assets}建立自訂指標及依其訊號交易的策略', '{assets}展示熱門策略排名', '{assets}分析目前市場狀況', '{assets}分析投資組合配置'] },
  es: { choose: '¿Qué activos te gustaría explorar?', ask: '¿Qué te gustaría saber sobre {assets}?', combine: '¿Cómo quieres abordar {assets}?', analyze: 'Analiza la situación actual del mercado de {assets}',
    questions: ['¿Cómo debería operar la IA con {assets}?', '¿Qué indicadores creamos para {assets}?', '¿Quieres ver la clasificación de estrategias para {assets}?', '¿Qué quieres analizar sobre {assets}?', '¿Cómo distribuimos {assets} en tu cartera?'],
    commands: ['Crea una estrategia de trading gestionada por IA{assets}', 'Crea indicadores propios y una estrategia que opere con sus señales{assets}', 'Muestra la clasificación de estrategias populares{assets}', 'Analiza las condiciones actuales del mercado{assets}', 'Analiza la distribución de la cartera{assets}'] },
  fr: { choose: 'Quels actifs souhaitez-vous explorer ?', ask: 'Que souhaitez-vous savoir sur {assets} ?', combine: 'Comment souhaitez-vous aborder {assets} ?', analyze: 'Analyse la situation actuelle du marché pour {assets}',
    questions: ['Comment l’IA doit-elle trader {assets} ?', 'Quels indicateurs créer pour {assets} ?', 'Souhaitez-vous voir le classement des stratégies pour {assets} ?', 'Que souhaitez-vous analyser sur {assets} ?', 'Quelle place donner à {assets} dans votre portefeuille ?'],
    commands: ['Crée une stratégie de trading pilotée par IA{assets}', 'Crée des indicateurs et une stratégie qui utilise leurs signaux{assets}', 'Présente le classement des stratégies populaires{assets}', 'Analyse les conditions actuelles du marché{assets}', 'Analyse la répartition du portefeuille{assets}'] },
}

/** Generate new template text only; never translate an existing user draft or turn. */
export function localizedTemplateText(language: Exclude<ClientLanguage, 'ko'>, actions: readonly string[], labels: readonly string[]) {
  const copy = translations[language]
  const assets = new Intl.ListFormat(language, { style: 'long', type: 'conjunction' }).format(labels)
  const fill = (text: string, value = assets) => text.replaceAll('{assets}', value)
  if (!actions.length) return { q: fill(copy.ask), cmd: fill(copy.analyze) }
  const indexes = actions.map(id => ['auto', 'ind', 'rank', 'anal', 'port'].indexOf(id))
  const context = !assets ? '' : language === 'ja' ? `${assets}について、` : language === 'zh-CN' ? `针对${assets}，` : language === 'zh-TW' ? `針對${assets}，` : language === 'es' ? ` para ${assets}` : language === 'fr' ? ` pour ${assets}` : ` for ${assets}`
  return {
    q: !assets ? copy.choose : fill(indexes.length === 1 ? copy.questions[indexes[0]] : copy.combine),
    cmd: indexes.map(index => fill(copy.commands[index], context)).join(language.startsWith('zh') || language === 'ja' ? '。' : '. '),
  }
}
