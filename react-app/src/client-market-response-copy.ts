import type { ClientLanguage } from './client-preferences'
const copy = {
  timeline: ['주요 사건과 당시 시세 흐름','Key events and market movements','主な出来事と当時の値動き','主要事件与当时走势','主要事件與當時走勢','Eventos clave y movimientos del mercado','Événements clés et mouvements du marché'],
  daily: ['실측 일봉 기준','Observed daily prices','観測した日足に基づく','基于实测日线','基於實測日線','Precios diarios observados','Cours journaliers observés'],
  mapped: ['{date} 거래일 반영','Reflected on trading day {date}','取引日 {date} に反映','反映于 {date} 交易日','反映於 {date} 交易日','Reflejado el día de negociación {date}','Reporté à la séance du {date}'],
  caveat: ['사건 발생 시점과 당시 일봉의 선후 관계를 정리한 것이며, 사건이 등락의 유일하거나 직접적인 원인임을 뜻하지 않습니다. 등락은 직전 거래일 종가 대비.','This shows the timing of events alongside daily prices, not proof of a sole or direct cause. Changes compare with the previous trading day’s close.','出来事と日足の時間的な関係であり、値動きの唯一または直接の原因を意味しません。騰落は前取引日の終値比です。','仅展示事件与日线的时间关系，不代表涨跌的唯一或直接原因。涨跌相对上一交易日收盘价。','僅展示事件與日線的時間關係，不代表漲跌的唯一或直接原因。漲跌相對上一交易日收盤價。','La secuencia de eventos y precios diarios no demuestra una causa única ni directa. Las variaciones se comparan con el cierre de la sesión anterior.','Cette chronologie ne prouve pas de cause unique ou directe. Les variations sont calculées par rapport à la clôture de la séance précédente.'],
  evidence: ['근거: 웹 검색 {searches}회, 결과 {results}개, 원문 {pages}개 확인.','Evidence: {searches} web searches, {results} results, {pages} pages checked.','根拠: ウェブ検索 {searches}回、結果 {results}件、原文 {pages}件を確認。','依据：网页搜索 {searches} 次，结果 {results} 条，核查原文 {pages} 篇。','依據：網頁搜尋 {searches} 次，結果 {results} 條，核查原文 {pages} 篇。','Fuentes: {searches} búsquedas, {results} resultados y {pages} páginas consultadas.','Sources : {searches} recherches, {results} résultats et {pages} pages consultées.'],
  sources: ['출처 상세와 링크','Source details and links','出典の詳細とリンク','来源详情与链接','來源詳情與連結','Detalles y enlaces de las fuentes','Détails et liens des sources'],
  direction: ['방향 감각','Directional estimate','方向の目安','方向估计','方向估計','Estimación de dirección','Estimation de direction'],
  estimate: ['지표 기반 추정, 검증된 확률 아님','Indicator-based estimate, not a validated probability','指標に基づく推定であり、検証済みの確率ではありません','基于指标的估计，并非经过验证的概率','基於指標的估計，並非經過驗證的機率','Estimación basada en indicadores, no una probabilidad validada','Estimation fondée sur des indicateurs, pas une probabilité validée'],
  up: ['상승','Up','上昇','上涨','上漲','Subida','Hausse'],
  down: ['하락','Down','下落','下跌','下跌','Bajada','Baisse'],
  analysis: ['분석 {interval} 기준','Analysis based on {interval}','分析は {interval} 基準','分析基于 {interval}','分析基於 {interval}','Análisis basado en {interval}','Analyse fondée sur {interval}'],
} as const
const languages: readonly ClientLanguage[] = ['ko','en','ja','zh-CN','zh-TW','es','fr']
export function marketResponseText(language: ClientLanguage, key: keyof typeof copy, values: Record<string,string | number> = {}): string {
  return copy[key][languages.indexOf(language)]!.replace(/\{(\w+)\}/g, (all, name: string) => values[name] === undefined ? all : String(values[name]))
}
