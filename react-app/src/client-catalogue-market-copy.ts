import type { ClientLanguage } from './client-preferences'

const copy = {
  ko: { snapshot: '원본 가격 스냅샷', close: '종가', future: '무기한', spot: '현물', missing: '보유 종목이 없어 연결할 차트가 없습니다.', volume: '일봉 OHLC · 거래량 미제공', closes: '일별 종가 · OHLC·거래량 미제공', history: '과거 스냅샷입니다. 실시간 시세·개인 체결이 아닙니다.', fit: '전체 구간' },
  en: { snapshot: 'Source price snapshot', close: 'Close', future: 'Perpetual', spot: 'Spot', missing: 'No held asset is available to link a chart.', volume: 'Daily OHLC · volume not supplied', closes: 'Daily closes · OHLC and volume not supplied', history: 'Historical snapshot, not live prices or personal fills.', fit: 'Fit all' },
  ja: { snapshot: '元の価格スナップショット', close: '終値', future: '無期限', spot: '現物', missing: '保有銘柄がないためチャートを連携できません。', volume: '日足OHLC · 出来高未提供', closes: '日次終値 · OHLC・出来高未提供', history: '過去のスナップショットです。リアルタイム価格や個人の約定ではありません。', fit: '全期間' },
  'zh-CN': { snapshot: '原始价格快照', close: '收盘价', future: '永续', spot: '现货', missing: '没有可关联图表的持仓资产。', volume: '日线OHLC · 未提供成交量', closes: '每日收盘价 · 未提供OHLC和成交量', history: '历史快照，非实时行情或个人成交。', fit: '完整区间' },
  'zh-TW': { snapshot: '原始價格快照', close: '收盤價', future: '永續', spot: '現貨', missing: '沒有可連結圖表的持倉資產。', volume: '日線OHLC · 未提供成交量', closes: '每日收盤價 · 未提供OHLC和成交量', history: '歷史快照，非即時行情或個人成交。', fit: '完整區間' },
  es: { snapshot: 'Instantánea de precios original', close: 'Cierre', future: 'Perpetuo', spot: 'Contado', missing: 'No hay activos en posición para vincular un gráfico.', volume: 'OHLC diario · volumen no disponible', closes: 'Cierres diarios · OHLC y volumen no disponibles', history: 'Instantánea histórica, no precios en vivo ni ejecuciones personales.', fit: 'Todo el intervalo' },
  fr: { snapshot: 'Instantané des prix source', close: 'Clôture', future: 'Perpétuel', spot: 'Au comptant', missing: 'Aucun actif détenu ne permet de relier un graphique.', volume: 'OHLC journalier · volume non fourni', closes: 'Clôtures journalières · OHLC et volume non fournis', history: 'Instantané historique, pas de cours en direct ni d’exécutions personnelles.', fit: 'Toute la période' },
} satisfies Record<ClientLanguage, Record<string, string>>
export const catalogueMarketCopy = (language: ClientLanguage) => copy[language]
