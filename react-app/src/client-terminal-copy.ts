import type { ClientLanguage } from './client-preferences'

// Shared terminal presentation only; never a source of panel identity or authority.
type Translations = readonly [string, string, string, string, string, string, string]
const column = { ko: 0, en: 1, ja: 2, 'zh-CN': 3, 'zh-TW': 4, es: 5, fr: 6 } as const satisfies Record<ClientLanguage, number>
export const clientTerminalCopy = {
  pos: ['포지션', 'Positions', 'ポジション', '持仓', '持倉', 'Posiciones', 'Positions'],
  open: ['미체결 주문', 'Open orders', '未約定注文', '未成交订单', '未成交訂單', 'Órdenes abiertas', 'Ordres ouverts'],
  orders: ['주문 내역', 'Order history', '注文履歴', '订单记录', '訂單紀錄', 'Historial de órdenes', 'Historique des ordres'],
  fills: ['체결 내역', 'Fill history', '約定履歴', '成交记录', '成交紀錄', 'Historial de ejecuciones', 'Historique des exécutions'],
  closed: ['종료 포지션', 'Closed positions', '決済済みポジション', '已平仓仓位', '已平倉部位', 'Posiciones cerradas', 'Positions clôturées'],
  assets: ['자산', 'Assets', '資産', '资产', '資產', 'Activos', 'Actifs'],
  connectionTitle: ['거래소를 연결하면 실계좌 데이터가 표시돼요', 'Connect an exchange to see your account data', '取引所を接続すると実口座のデータが表示されます', '连接交易所后显示实盘账户数据', '連接交易所後顯示實際帳戶資料', 'Conecta un exchange para ver los datos de tu cuenta', 'Connectez une plateforme pour voir les données de votre compte'],
  connectionBody: ['포지션, 주문, 자산 내역은 API 연결 후 이 자리에 나타납니다.', 'Positions, orders and assets appear here after an API connection.', 'API接続後、ポジション、注文、資産の情報がここに表示されます。', 'API连接后，持仓、订单及资产记录将显示在此处。', 'API連接後，持倉、訂單及資產紀錄將顯示在此處。', 'Las posiciones, órdenes y activos aparecerán aquí tras conectar la API.', 'Les positions, ordres et actifs apparaîtront ici après la connexion API.'],
  connectExchange: ['거래소 연결하기', 'Connect an exchange', '取引所を接続', '连接交易所', '連接交易所', 'Conectar un exchange', 'Connecter une plateforme'],
  accountUnavailable: ['현재 환경에서는 거래소 계좌 조회와 연결을 지원하지 않습니다. 기록 Paper 결과는 실계좌 데이터로 표시하지 않습니다.', 'Exchange account access and connection are not available in this environment. Recorded Paper results are not live account data.', 'この環境では取引所口座の参照・接続に対応していません。記録Paperの結果は実口座データとして表示しません。', '当前环境不支持交易所账户查询及连接。记录Paper结果不会显示为实盘账户数据。', '目前環境不支援交易所帳戶查詢及連接。記錄Paper結果不會顯示為實際帳戶資料。', 'Este entorno no permite consultar ni conectar cuentas de exchange. Los resultados Paper registrados no son datos de una cuenta real.', 'Cet environnement ne permet pas de consulter ni de connecter un compte de plateforme. Les résultats Paper enregistrés ne sont pas des données de compte réel.'],
  closeTerminal: ["터미널 닫기","Close terminal","ターミナルを閉じる","关闭终端","關閉終端機","Cerrar el terminal","Fermer le terminal"],
  noticeRegion: ["데이터 해석 안내","Data interpretation guidance","データ解釈の案内","数据解读说明","資料解讀說明","Guía de interpretación de los datos","Guide d'interprétation des données"],
  panelTablist: ["터미널 영역","Terminal areas","ターミナル領域","终端区域","終端機區域","Áreas del terminal","Zones du terminal"],
  widthSeparator: ["{label} 너비","{label} width","{label} の幅","{label} 宽度","{label} 寬度","Ancho de {label}","Largeur de {label}"],
  bottomRegion: ["거래 데이터","Trading data","取引データ","交易数据","交易資料","Datos de negociación","Données de négociation"],
  bottomTablist: ["거래 데이터 항목","Trading data items","取引データ項目","交易数据项","交易資料項目","Elementos de datos de negociación","Éléments de données de négociation"],
} as const satisfies Record<string, Translations>
export function clientTerminalText(language: ClientLanguage, key: keyof typeof clientTerminalCopy, values: Readonly<Record<string, string>> = {}): string {
  return clientTerminalCopy[key][column[language]].replace(/\{([a-zA-Z]+)\}/g, (placeholder, name: string) => Object.hasOwn(values, name) ? values[name] : placeholder)
}
