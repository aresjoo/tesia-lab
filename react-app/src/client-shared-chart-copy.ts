import type { ClientLanguage } from './client-preferences'

/** Original chart UI copy; no result, trading or execution authority. */
const ko = {
  "좌우 방향키로 각 관측일, Home과 End로 처음과 끝을 확인하세요. Escape로 상세 표시를 닫습니다.": "좌우 방향키로 각 관측일, Home과 End로 처음과 끝을 확인하세요. Escape로 상세 표시를 닫습니다.",
  "낙폭 곡선 (Drawdown)": "낙폭 곡선 (Drawdown)",
  "고점 대비 하락률, 최저 {value}%": "고점 대비 하락률, 최저 {value}%",
  "낙폭 곡선": "낙폭 곡선",
  "차트 데이터가 없어요": "차트 데이터가 없어요"
} as const
export type SharedChartCopyKey = keyof typeof ko
const translations: Record<Exclude<ClientLanguage, 'ko'>, Record<SharedChartCopyKey, string>> = {
  "en": {
    "좌우 방향키로 각 관측일, Home과 End로 처음과 끝을 확인하세요. Escape로 상세 표시를 닫습니다.": "Use the left and right arrow keys to step through each observation date, and Home and End for the first and last. Press Escape to close the details.",
    "낙폭 곡선 (Drawdown)": "Drawdown curve",
    "고점 대비 하락률, 최저 {value}%": "Decline from peak, low of {value}%",
    "낙폭 곡선": "Drawdown curve",
    "차트 데이터가 없어요": "No chart data"
  },
  "ja": {
    "좌우 방향키로 각 관측일, Home과 End로 처음과 끝을 확인하세요. Escape로 상세 표시를 닫습니다.": "左右の方向キーで各観測日、HomeとEndで最初と最後を確認できます。Escapeで詳細表示を閉じます。",
    "낙폭 곡선 (Drawdown)": "ドローダウン曲線 (Drawdown)",
    "고점 대비 하락률, 최저 {value}%": "高値からの下落率、最低 {value}%",
    "낙폭 곡선": "ドローダウン曲線",
    "차트 데이터가 없어요": "チャートデータがありません"
  },
  "zh-CN": {
    "좌우 방향키로 각 관측일, Home과 End로 처음과 끝을 확인하세요. Escape로 상세 표시를 닫습니다.": "用左右方向键查看各观测日，用 Home 和 End 跳到开头和结尾。按 Escape 关闭详情显示。",
    "낙폭 곡선 (Drawdown)": "回撤曲线 (Drawdown)",
    "고점 대비 하락률, 최저 {value}%": "相对高点的跌幅，最低 {value}%",
    "낙폭 곡선": "回撤曲线",
    "차트 데이터가 없어요": "暂无图表数据"
  },
  "zh-TW": {
    "좌우 방향키로 각 관측일, Home과 End로 처음과 끝을 확인하세요. Escape로 상세 표시를 닫습니다.": "用左右方向鍵查看各觀測日，用 Home 和 End 前往開頭與結尾。按 Escape 關閉詳細顯示。",
    "낙폭 곡선 (Drawdown)": "回撤曲線 (Drawdown)",
    "고점 대비 하락률, 최저 {value}%": "相對高點的跌幅，最低 {value}%",
    "낙폭 곡선": "回撤曲線",
    "차트 데이터가 없어요": "目前沒有圖表資料"
  },
  "es": {
    "좌우 방향키로 각 관측일, Home과 End로 처음과 끝을 확인하세요. Escape로 상세 표시를 닫습니다.": "Usa las flechas izquierda y derecha para recorrer cada día observado, y Home y End para ir al principio y al final. Pulsa Escape para cerrar el detalle.",
    "낙폭 곡선 (Drawdown)": "Curva de caída (Drawdown)",
    "고점 대비 하락률, 최저 {value}%": "Caída desde el máximo, mínimo del {value}%",
    "낙폭 곡선": "Curva de caída",
    "차트 데이터가 없어요": "No hay datos del gráfico"
  },
  "fr": {
    "좌우 방향키로 각 관측일, Home과 End로 처음과 끝을 확인하세요. Escape로 상세 표시를 닫습니다.": "Utilisez les flèches gauche et droite pour parcourir chaque jour observé, Home et End pour aller au début et à la fin. Appuyez sur Escape pour fermer le détail.",
    "낙폭 곡선 (Drawdown)": "Courbe de repli (Drawdown)",
    "고점 대비 하락률, 최저 {value}%": "Baisse depuis le plus haut, minimum {value}%",
    "낙폭 곡선": "Courbe de repli",
    "차트 데이터가 없어요": "Aucune donnée de graphique"
  }
}

export function sharedChartCopy(language: ClientLanguage, key: SharedChartCopyKey, values: Record<string, string | number> = {}): string {
  const text = language === 'ko' ? ko[key] : translations[language][key]
  return text.replace(/\{([a-zA-Z]+)\}/g, (match, name: string) => Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : match)
}
