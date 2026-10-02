import type { ClientLanguage } from '../client-preferences'

type InlineResultCopy = { title: string; open: string; IS: string; OOS: string; detailLoading: string; detailError: string; edit: string }
/** Navigation and segment labels only; all server evidence stays untranslated. */
export const nativeInlineResultCopy: Record<ClientLanguage, InlineResultCopy> = {
  ko: { edit: "조건을 직접 수정할게요", title: '전략 검증 결과', open: '리포트와 차트 보기', IS: 'IS · 설계 구간', OOS: 'OOS · 표본 외 구간', detailLoading: '보고서 수치는 확인됐습니다. 차트·거래 상세를 확인하고 있습니다.', detailError: '보고서 수치는 유지합니다. 차트·거래 상세는 확인이 필요합니다.' },
  en: { edit: "I'll edit the conditions directly", title: 'Strategy validation results', open: 'View report and chart', IS: 'IS · Design segment', OOS: 'OOS · Out-of-sample segment', detailLoading: 'Report metrics are available. Checking chart and trade details.', detailError: 'Report metrics are retained. Chart and trade details need checking.' },
  ja: { edit: "条件を直接修正します", title: '戦略の検証結果', open: 'レポートとチャートを見る', IS: 'IS · 設計区間', OOS: 'OOS · サンプル外区間', detailLoading: 'レポートの数値を確認済みです。チャートと取引詳細を確認しています。', detailError: 'レポートの数値は保持しています。チャートと取引詳細の確認が必要です。' },
  'zh-CN': { edit: "直接修改条件", title: '策略验证结果', open: '查看报告与图表', IS: 'IS · 设计区间', OOS: 'OOS · 样本外区间', detailLoading: '报告指标已确认。正在检查图表和交易详情。', detailError: '报告指标已保留。图表和交易详情需要检查。' },
  'zh-TW': { edit: "直接修改條件", title: '策略驗證結果', open: '查看報告與圖表', IS: 'IS · 設計區間', OOS: 'OOS · 樣本外區間', detailLoading: '報告指標已確認。正在檢查圖表和交易詳情。', detailError: '報告指標已保留。圖表和交易詳情需要檢查。' },
  es: { edit: "Modificaré las condiciones directamente", title: 'Resultados de validación de la estrategia', open: 'Ver informe y gráfico', IS: 'IS · Segmento de diseño', OOS: 'OOS · Segmento fuera de muestra', detailLoading: 'Las métricas del informe están disponibles. Comprobando el gráfico y las operaciones.', detailError: 'Se conservan las métricas del informe. Hay que revisar el gráfico y las operaciones.' },
  fr: { edit: "Je vais modifier les conditions directement", title: 'Résultats de validation de la stratégie', open: 'Voir le rapport et le graphique', IS: 'IS · Segment de conception', OOS: 'OOS · Segment hors échantillon', detailLoading: 'Les métriques du rapport sont disponibles. Vérification du graphique et des opérations.', detailError: 'Les métriques du rapport sont conservées. Le graphique et les opérations doivent être vérifiés.' },
}
