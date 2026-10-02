import type { ClientLanguage } from '../client-preferences'
import { conversationCopy } from '../client-conversation-copy'

// Display names only. Pane identity, focus and result bindings are not localized.
type Translations = readonly [string, string, string, string, string, string, string]
const column = { ko: 0, en: 1, ja: 2, 'zh-CN': 3, 'zh-TW': 4, es: 5, fr: 6 } as const satisfies Record<ClientLanguage, number>
export const nativeAnalysisCopy = {
  chat: conversationCopy.chat,
  viewLabel: ['대화와 결과 보기', 'Chat and result view', '会話と結果の表示', '对话与结果视图', '對話與結果檢視', 'Vista de conversación y resultados', 'Affichage de la conversation et des résultats'],
  analysis: ['차트·분석', 'Chart & analysis', 'チャート・分析', '图表与分析', '圖表與分析', 'Gráfico y análisis', 'Graphique et analyse'],
  analysisRegion: ['차트와 분석', 'Chart and analysis', 'チャートと分析', '图表与分析', '圖表與分析', 'Gráfico y análisis', 'Graphique et analyse'],
} as const satisfies Record<string, Translations>

export function nativeAnalysisText(language: ClientLanguage, key: keyof typeof nativeAnalysisCopy): string {
  return nativeAnalysisCopy[key][column[language]]
}
