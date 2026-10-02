import type { ClientLanguage } from '../client-preferences'

const copy = {
  prices: ['가격, 거래 시점, Holdout 봉인 구간', 'Price, executions and holdout period', '価格・約定時点・ホールドアウト期間', '价格、成交时点和留出区间', '價格、成交時點與保留區間', 'Precio, ejecuciones y periodo holdout', 'Prix, exécutions et période de réserve'],
  equity: ['자산 곡선', 'Equity curve', '資産曲線', '资产曲线', '資產曲線', 'Curva de capital', 'Courbe de capital'],
  unavailable: ['아직 공급된 차트 데이터가 없습니다.', 'Chart data has not been supplied yet.', 'チャートデータはまだ提供されていません。', '尚未提供图表数据。', '尚未提供圖表資料。', 'Aún no se han proporcionado datos del gráfico.', 'Les données du graphique ne sont pas encore fournies.'],
  empty: ['이 구간의 관측 데이터가 없습니다.', 'There are no observations in this window.', 'この区間の観測データはありません。', '此区间没有观测数据。', '此區間沒有觀測資料。', 'No hay observaciones en este intervalo.', 'Aucune observation sur cette fenêtre.'],
  invalid: ['공급된 차트 데이터를 표시할 수 없습니다.', 'The supplied chart data cannot be displayed.', '提供されたチャートデータを表示できません。', '无法显示提供的图表数据。', '無法顯示提供的圖表資料。', 'No se pueden mostrar los datos del gráfico.', 'Les données du graphique ne peuvent pas être affichées.'],
  oversized: ['표시 한도를 초과했습니다. 더 작은 구간을 공급해주세요.', 'The display limit was exceeded. Supply a smaller window.', '表示上限を超えました。より小さい区間を指定してください。', '超过显示上限，请提供更小的区间。', '超過顯示上限，請提供較小的區間。', 'Se superó el límite de visualización. Proporciona un intervalo menor.', 'La limite d’affichage est dépassée. Fournissez une fenêtre plus petite.'],
  stale: ['다른 전략 버전의 데이터입니다. 현재 버전의 데이터를 기다립니다.', 'This data belongs to another strategy version. Waiting for the current version.', '別の戦略バージョンのデータです。現在のバージョンを待っています。', '数据属于其他策略版本，正在等待当前版本。', '資料屬於其他策略版本，正在等待目前版本。', 'Los datos pertenecen a otra versión. Esperando la versión actual.', 'Ces données appartiennent à une autre version. En attente de la version actuelle.'],
  ready: ['공급 데이터', 'Supplied data', '提供データ', '提供的数据', '提供資料', 'Datos suministrados', 'Données fournies'],
  inspect: ['좌우 화살표로 관측값 확인', 'Inspect observations with left/right arrows', '左右キーで観測値を確認', '使用左右键查看观测值', '使用左右鍵查看觀測值', 'Consultar observaciones con flechas izquierda/derecha', 'Consulter les observations avec les flèches gauche/droite'],
  openAnalysis: ['전문 차트 열기', 'Open professional chart', '詳細チャートを開く', '打开专业图表', '開啟專業圖表', 'Abrir gráfico profesional', 'Ouvrir le graphique professionnel'],
  dataTable: ['관측값 표 보기', 'View observation table', '観測値の表を見る', '查看观测数据表', '查看觀測資料表', 'Ver tabla de observaciones', 'Voir le tableau des observations'],
  fills: ['실제 체결', 'Actual executions', '実際の約定', '实际成交', '實際成交', 'Ejecuciones reales', 'Exécutions réelles'],
  tradeIntervals: ['진입·청산 구간', 'Entry–exit intervals', 'エントリー・決済区間', '入场与离场区间', '進場與出場區間', 'Intervalos de entrada y salida', 'Intervalles d’entrée et de sortie'],
  entry: ['진입 (UTC)', 'Entry (UTC)', 'エントリー (UTC)', '入场 (UTC)', '進場 (UTC)', 'Entrada (UTC)', 'Entrée (UTC)'],
  exit: ['청산 (UTC)', 'Exit (UTC)', '決済 (UTC)', '离场 (UTC)', '出場 (UTC)', 'Salida (UTC)', 'Sortie (UTC)'],
  outcome: ['공급된 손익', 'Supplied outcome', '提供された損益', '提供的盈亏', '提供的損益', 'Resultado suministrado', 'Résultat fourni'],
  time: ['시각 (UTC)', 'Time (UTC)', '時刻 (UTC)', '时间 (UTC)', '時間 (UTC)', 'Hora (UTC)', 'Heure (UTC)'],
  open: ['시가', 'Open', '始値', '开盘', '開盤', 'Apertura', 'Ouverture'],
  high: ['고가', 'High', '高値', '最高', '最高', 'Máximo', 'Plus haut'],
  low: ['저가', 'Low', '安値', '最低', '最低', 'Mínimo', 'Plus bas'],
  close: ['종가', 'Close', '終値', '收盘', '收盤', 'Cierre', 'Clôture'],
  value: ['자산', 'Equity', '資産', '资产', '資產', 'Capital', 'Capital'],
  side: ['구분', 'Side', '売買', '方向', '方向', 'Lado', 'Sens'],
  price: ['체결가', 'Execution price', '約定価格', '成交价', '成交價', 'Precio de ejecución', 'Prix d’exécution'],
  quantity: ['수량', 'Quantity', '数量', '数量', '數量', 'Cantidad', 'Quantité'],
  previous: ['이전', 'Previous', '前へ', '上一页', '上一頁', 'Anterior', 'Précédent'],
  next: ['다음', 'Next', '次へ', '下一页', '下一頁', 'Siguiente', 'Suivant'],
  fit: ['전체 구간', 'Fit window', '全区間', '完整区间', '完整區間', 'Ajustar intervalo', 'Ajuster la fenêtre'],
  limit: ['표시 한도', 'Display limit', '表示上限', '显示上限', '顯示上限', 'Límite de visualización', 'Limite d’affichage'],
  reset: ['선택 해제', 'Clear selection', '選択解除', '清除选择', '清除選取', 'Borrar selección', 'Effacer la sélection'],
  failed: ['차트를 표시하지 못했습니다. 관측값 표에서 확인해주세요.', 'The chart could not be displayed. Use the observation table.', 'チャートを表示できませんでした。観測値の表をご確認ください。', '无法显示图表，请查看观测数据表。', '無法顯示圖表，請查看觀測資料表。', 'No se pudo mostrar el gráfico. Consulta la tabla de observaciones.', 'Le graphique n’a pas pu être affiché. Consultez le tableau des observations.'],
} as const
export type ResearchChartCopyKey = keyof typeof copy
const columns = { ko: 0, en: 1, ja: 2, 'zh-CN': 3, 'zh-TW': 4, es: 5, fr: 6 } as const
export function researchChartCopy(language: ClientLanguage, key: ResearchChartCopyKey): string { return copy[key][columns[language]] }
