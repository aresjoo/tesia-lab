import type { ClientLanguage } from './client-preferences'

const copy = {
  rendererLoading: ['차트를 준비하고 있습니다.','Preparing the chart.','チャートを準備しています。','正在准备图表。','正在準備圖表。','Preparando el gráfico.','Préparation du graphique.'],
  rendererFailed: ['차트를 불러오지 못했습니다.','Could not load the chart.','チャートを読み込めませんでした。','无法加载图表。','無法載入圖表。','No se pudo cargar el gráfico.','Impossible de charger le graphique.'],
  rendererReload: ['페이지 새로고침','Reload page','ページを再読み込み','刷新页面','重新整理頁面','Recargar página','Actualiser la page'],
  observed: ['관측','Observed','観測','观测','觀測','Observado','Observé'],
  scenario: ['시나리오','Scenario','シナリオ','情景','情境','Escenario','Scénario'],
  upper: ['상방','Upside','上方','上行','上行','Al alza','À la hausse'],
  lower: ['하방','Downside','下方','下行','下行','A la baja','À la baisse'],
  horizon: ['시나리오 기준 시점','Scenario horizon','シナリオの対象時点','情景目标时间','情境目標時間','Horizonte del escenario','Horizon du scénario'],
  scenarioCaveat: ['참고용, 예측 보장 아님','For reference, not a guaranteed forecast','参考用、予測を保証するものではありません','仅供参考，不保证预测结果','僅供參考，不保證預測結果','Solo como referencia, no es una previsión garantizada','À titre indicatif, sans garantie de prévision'],
  chart: ['가격 차트','Price chart','価格チャート','价格图表','價格圖表','Gráfico de precios','Graphique des cours'],
  interval: ['표시 주기','Chart interval','表示間隔','图表周期','圖表週期','Intervalo del gráfico','Intervalle du graphique'],
  loading: ['가격 데이터를 확인하고 있습니다.','Checking price data.','価格データを確認しています。','正在核对价格数据。','正在核對價格資料。','Comprobando los precios.','Vérification des cours.'],
  unavailable: ['이 구간의 가격 데이터가 아직 제공되지 않았습니다.','Price data for this period has not been provided yet.','この期間の価格データはまだ提供されていません。','尚未提供此期间的价格数据。','尚未提供此期間的價格資料。','Aún no se han proporcionado precios para este periodo.','Les cours de cette période ne sont pas encore disponibles.'],
  failed: ['가격 데이터를 불러오지 못했습니다. 다시 시도해주세요.','Could not load prices. Please try again.','価格データを読み込めませんでした。再試行してください。','无法加载价格数据，请重试。','無法載入價格資料，請重試。','No se pudieron cargar los precios. Inténtalo de nuevo.','Impossible de charger les cours. Réessayez.'],
  mismatch: ['선택한 자산과 주기에 맞는 가격 데이터를 확인할 수 없습니다.','Price data does not match the selected asset and interval.','選択した資産と間隔に一致する価格データを確認できません。','价格数据与所选资产和周期不符。','價格資料與所選資產和週期不符。','Los precios no coinciden con el activo y el intervalo seleccionados.','Les cours ne correspondent pas à l’actif et à l’intervalle sélectionnés.'],
  retry: ['다시 불러오기','Reload prices','再読み込み','重新加载','重新載入','Volver a cargar','Recharger les cours'],
} as const
const languages: readonly ClientLanguage[] = ['ko','en','ja','zh-CN','zh-TW','es','fr']
export function marketChartText(language: ClientLanguage, key: keyof typeof copy): string {
  return copy[key][languages.indexOf(language)]!
}
