import type { ClientLanguage } from './client-preferences'

type Row = readonly [string, string, string, string, string, string, string]
const column = { ko: 0, en: 1, ja: 2, 'zh-CN': 3, 'zh-TW': 4, es: 5, fr: 6 } as const
/** Fixed source-preview chrome only; never translate supplied names or prose. */
export const terminalLedgerCopy: Readonly<Record<string, Row>> = {
  '알림': ['알림', 'Notifications', '通知', '通知', '通知', 'Notificaciones', 'Notifications'],
  '알림, {count}개 안읽음': ['알림, {count}개 안읽음', 'Notifications, {count} unread', '通知、未読{count}件', '通知，{count}条未读', '通知，{count}則未讀', 'Notificaciones, {count} sin leer', 'Notifications, {count} non lues'],
  '알림, {count}개 안읽음 (단수)': ['알림, {count}개 안읽음', 'Notifications, {count} unread', '通知、未読{count}件', '通知，{count}条未读', '通知，{count}則未讀', 'Notificaciones, {count} sin leer', 'Notifications, {count} non lue'],
  '포지션': ['포지션', 'Positions', 'ポジション', '持仓', '持倉', 'Posiciones', 'Positions'],
  '미체결 주문': ['미체결 주문', 'Open orders', '未約定注文', '未成交订单', '未成交訂單', 'Órdenes abiertas', 'Ordres ouverts'],
  '주문 내역': ['주문 내역', 'Order history', '注文履歴', '订单历史', '訂單紀錄', 'Historial de órdenes', 'Historique des ordres'],
  '체결 내역': ['체결 내역', 'Fill history', '約定履歴', '成交历史', '成交紀錄', 'Historial de ejecuciones', 'Historique des exécutions'],
  '종료 포지션': ['종료 포지션', 'Closed positions', '終了ポジション', '已平仓持仓', '已平倉持倉', 'Posiciones cerradas', 'Positions clôturées'],
  '자산': ['자산', 'Assets', '資産', '资产', '資產', 'Activos', 'Actifs'],
  '전체 전략': ['전체 전략', 'All strategies', 'すべての戦略', '全部策略', '全部策略', 'Todas las estrategias', 'Toutes les stratégies'],
  '현재 전략': ['현재 전략', 'Current strategy', '現在の戦略', '当前策略', '目前策略', 'Estrategia actual', 'Stratégie actuelle'],
  '검증 시뮬레이션 파생 기록이에요, {scope} 범위': ['검증 시뮬레이션 파생 기록이에요, {scope} 범위', 'Records derived from validation simulation, scoped to {scope}', '検証シミュレーション由来の記録、範囲：{scope}', '验证模拟派生记录，范围：{scope}', '驗證模擬衍生紀錄，範圍：{scope}', 'Registros derivados de simulación de validación, ámbito: {scope}', 'Registres issus de la simulation de validation, périmètre : {scope}'],
  '{label} 표': ['{label} 표', '{label} table', '{label}の表', '{label}表格', '{label}表格', '{label} — tabla', '{label} — tableau'],
  '미연결 (위임 대기)': ['미연결 (위임 대기)', 'Not connected (delegation pending)', '未接続（委任待ち）', '未连接（等待委托）', '未連接（等待委託）', 'Sin conexión (delegación pendiente)', 'Non connecté (délégation en attente)'],
  '{name} 중지': ['{name} 중지', 'Stop {name}', '{name}を停止', '停止{name}', '停止{name}', 'Detener {name}', 'Arrêter {name}'],
  '중지': ['중지', 'Stop', '停止', '停止', '停止', 'Detener', 'Arrêter'],
  '시뮬레이션 전략 중지, 포지션 청산이 아닙니다': ['시뮬레이션 전략 중지, 포지션 청산이 아닙니다', 'Stop the simulation strategy; this does not close the position', 'シミュレーション戦略の停止であり、ポジション決済ではありません', '停止模拟策略，并非平仓', '停止模擬策略，並非平倉', 'Detener la estrategia simulada, no liquidar la posición', 'Arrêt de la stratégie simulée, pas liquidation de la position'],
  '대기': ['대기', 'Pending', '待機', '等待', '等待', 'Pendiente', 'En attente'],
  '손절 STOP': ['손절 STOP', 'Stop-loss STOP', '損切り STOP', '止损 STOP', '停損 STOP', 'Stop de pérdidas STOP', 'Stop de perte STOP'],
  '익절 LIMIT': ['익절 LIMIT', 'Take-profit LIMIT', '利確 LIMIT', '止盈 LIMIT', '停利 LIMIT', 'Toma de beneficios LIMIT', 'Prise de bénéfices LIMIT'],
  '기간 시장가': ['기간 시장가', 'Time-based market exit', '保有期間による成行決済', '按持有期市价退出', '按持有期市價退出', 'Salida a mercado por tiempo de tenencia', 'Sortie au marché selon la durée de détention'],
  '진입 시장가': ['진입 시장가', 'Market entry order', '成行エントリー', '市价入场', '市價進場', 'Orden de entrada a mercado', 'Ordre d’entrée au marché'],
  '규칙 주문, 취소는 전략 중지로': ['규칙 주문, 취소는 전략 중지로', 'Rule-based order; stop the strategy to cancel', 'ルール注文、取消は戦略停止で', '规则订单，停止策略以取消', '規則訂單，停止策略以取消', 'Orden por reglas; detén la estrategia para cancelar', 'Ordre basé sur les règles ; arrêter la stratégie pour annuler'],
  '규칙 주문': ['규칙 주문', 'Rule-based order', 'ルール注文', '规则订单', '規則訂單', 'Orden por reglas', 'Ordre basé sur les règles'],
  '{name} {date} 종료 포지션 상세': ['{name} {date} 종료 포지션 상세', 'Closed position details for {name}, {date}', '{name} {date}の終了ポジション詳細', '{name} {date}已平仓持仓详情', '{name} {date}已平倉持倉詳情', 'Detalles de posición cerrada de {name}, {date}', 'Détails de la position clôturée de {name}, {date}'],
  '{count}봉': ['{count}봉', '{count} bars', '{count}本の足', '{count}根K线', '{count}根K線', '{count} velas', '{count} bougies'],
  '{count}봉 (단수)': ['{count}봉', '{count} bar', '{count}本の足', '{count}根K线', '{count}根K線', '{count} vela', '{count} bougie'],
  '체결 완료': ['체결 완료', 'Filled', '約定済み', '已成交', '已成交', 'Ejecutada', 'Exécuté'],
  '계정 전체 범위, 검증 시뮬레이션 파생이에요': ['계정 전체 범위, 검증 시뮬레이션 파생이에요', 'Account-wide scope, derived from validation simulation', '口座全体の範囲、検証シミュレーション由来です', '账户整体范围，源于验证模拟', '帳戶整體範圍，源於驗證模擬', 'Ámbito de toda la cuenta, derivado de simulación de validación', 'Périmètre du compte entier, issu de la simulation de validation'],
  '{name} 자산': ['{name} 자산', '{name} assets', '{name}の資産', '{name}资产', '{name}資產', 'Activos: {name}', 'Actifs : {name}'],
  '{name} 자산 금액': ['{name} 자산 금액', '{name} asset amounts', '{name}の資産額', '{name}资产金额', '{name}資產金額', 'Importes de activos: {name}', 'Montants des actifs : {name}'],
  '전략 {count}개': ['전략 {count}개', '{count} strategies', '戦略{count}件', '{count}个策略', '{count}個策略', '{count} estrategias', '{count} stratégies'],
  '전략 {count}개 (단수)': ['전략 {count}개', '{count} strategy', '戦略{count}件', '{count}个策略', '{count}個策略', '{count} estrategia', '{count} stratégie'],
  'Equity': ['Equity', 'Equity', '資産総額', '权益', '權益', 'Patrimonio', 'Capital'],
  'Available': ['Available', 'Available', '利用可能', '可用', '可用', 'Disponible', 'Disponible'],
  'Used': ['Used', 'Used', '使用中', '已使用', '已使用', 'Utilizado', 'Utilisé'],
  '미실현': ['미실현', 'Unrealized', '未実現', '未实现', '未實現', 'No realizado', 'Non réalisé'],
  '고정 체험 데이터, 시뮬레이션': ['고정 체험 데이터, 시뮬레이션', 'Fixed preview data, simulation', '固定体験データ、シミュレーション', '固定体验数据，模拟', '固定體驗資料，模擬', 'Datos fijos de demostración, simulación', 'Données fixes de démonstration, simulation'],
  '고정 체험 데이터, 시뮬레이션, 위임 예산 공용': ['고정 체험 데이터, 시뮬레이션, 위임 예산 공용', 'Fixed preview data, simulation, shared delegation budget', '固定体験データ、シミュレーション、委任予算を共有', '固定体验数据，模拟，共用委托预算', '固定體驗資料，模擬，共用委託預算', 'Datos fijos de demostración, simulación, presupuesto de delegación compartido', 'Données fixes de démonstration, simulation, budget de délégation partagé'],
  '연결된 자산이 없어요': ['연결된 자산이 없어요', 'No connected assets', '接続済み資産がありません', '没有已连接资产', '沒有已連接資產', 'No hay activos conectados', 'Aucun actif connecté'],
  '전략을 만들면 거래소별 자산 현황이 여기 모여요.': ['전략을 만들면 거래소별 자산 현황이 여기 모여요.', 'Create a strategy to see assets by exchange here.', '戦略を作成すると、取引所別の資産状況がここに集まります。', '创建策略后，这里将汇总各交易所的资产情况。', '建立策略後，這裡將彙整各交易所的資產情況。', 'Crea una estrategia para ver aquí los activos por plataforma.', 'Créez une stratégie pour voir ici les actifs par plateforme.'],
  '거래소': ['거래소', 'Exchange', '取引所', '交易所', '交易所', 'Plataforma', 'Plateforme'],
  '전략': ['전략', 'Strategy', '戦略', '策略', '策略', 'Estrategia', 'Stratégie'],
  '심볼': ['심볼', 'Symbol', '銘柄', '交易对', '交易對', 'Símbolo', 'Symbole'],
  '방향': ['방향', 'Side', '方向', '方向', '方向', 'Dirección', 'Sens'],
  '수량': ['수량', 'Quantity', '数量', '数量', '數量', 'Cantidad', 'Quantité'],
  '진입가': ['진입가', 'Entry price', 'エントリー価格', '入场价', '進場價', 'Precio de entrada', 'Prix d’entrée'],
  '현재가': ['현재가', 'Current price', '現在価格', '当前价', '目前價格', 'Precio actual', 'Prix actuel'],
  '손절가': ['손절가', 'Stop-loss price', '損切り価格', '止损价', '停損價', 'Precio de stop loss', 'Prix de stop de perte'],
  '전략 제어': ['전략 제어', 'Strategy controls', '戦略操作', '策略控制', '策略控制', 'Controles de estrategia', 'Commandes de stratégie'],
  '유형': ['유형', 'Type', '種類', '类型', '類型', 'Tipo', 'Type'],
  '가격': ['가격', 'Price', '価格', '价格', '價格', 'Precio', 'Prix'],
  '상태': ['상태', 'Status', '状態', '状态', '狀態', 'Estado', 'État'],
  '규칙': ['규칙', 'Rule', 'ルール', '规则', '規則', 'Regla', 'Règle'],
  '일자': ['일자', 'Date', '日付', '日期', '日期', 'Fecha', 'Date'],
  '체결가': ['체결가', 'Fill price', '約定価格', '成交价', '成交價', 'Precio de ejecución', 'Prix d’exécution'],
  '수수료': ['수수료', 'Fee', '手数料', '手续费', '手續費', 'Comisión', 'Frais'],
  '진입': ['진입', 'Entry', 'エントリー', '入场', '進場', 'Entrada', 'Entrée'],
  '청산': ['청산', 'Exit', '決済', '平仓', '平倉', 'Salida', 'Sortie'],
  '보유': ['보유', 'Holding', '保有', '持有', '持有', 'Tenencia', 'Détention'],
  '실현 손익': ['실현 손익', 'Realized profit/loss', '実現損益', '已实现盈亏', '已實現損益', 'Resultado realizado', 'Résultat réalisé'],
  '현재 포지션이 없습니다.': ['현재 포지션이 없습니다.', 'No current positions.', '現在のポジションはありません。', '当前没有持仓。', '目前沒有持倉。', 'No hay posiciones actuales.', 'Aucune position actuelle.'],
  '실행 중 전략이 진입하면 여기에 표시돼요.': ['실행 중 전략이 진입하면 여기에 표시돼요.', 'Positions appear here when a running strategy enters.', '実行中の戦略がエントリーするとここに表示されます。', '运行中的策略入场后会显示在这里。', '執行中的策略進場後會顯示在這裡。', 'Las posiciones aparecen aquí cuando entra una estrategia activa.', 'Les positions apparaissent ici lorsqu’une stratégie active entre.'],
  '미체결 주문이 없습니다.': ['미체결 주문이 없습니다.', 'No open orders.', '未約定注文はありません。', '没有未成交订单。', '沒有未成交訂單。', 'No hay órdenes abiertas.', 'Aucun ordre ouvert.'],
  '포지션이 열리면 규칙 기반 손절, 익절 주문이 여기 걸려요.': ['포지션이 열리면 규칙 기반 손절, 익절 주문이 여기 걸려요.', 'Rule-based stop-loss and take-profit orders appear here when a position opens.', 'ポジションが開くとルールに基づく損切り・利確注文がここに表示されます。', '开仓后，规则止损和止盈订单会显示在这里。', '開倉後，規則停損和停利訂單會顯示在這裡。', 'Las órdenes de stop loss y beneficios por reglas aparecen aquí al abrir una posición.', 'Les ordres de stop de perte et de prise de bénéfices apparaissent ici à l’ouverture d’une position.'],
  '주문 내역이 없어요': ['주문 내역이 없어요', 'No order history', '注文履歴がありません', '没有订单历史', '沒有訂單紀錄', 'No hay historial de órdenes', 'Aucun historique d’ordres'],
  '전략이 거래를 실행하면 주문 이벤트가 기록돼요.': ['전략이 거래를 실행하면 주문 이벤트가 기록돼요.', 'Order events are recorded when a strategy trades.', '戦略が取引すると注文イベントが記録されます。', '策略交易时会记录订单事件。', '策略交易時會記錄訂單事件。', 'Los eventos de órdenes se registran cuando opera una estrategia.', 'Les événements d’ordres sont enregistrés quand une stratégie négocie.'],
  '체결 내역이 없어요': ['체결 내역이 없어요', 'No fill history', '約定履歴がありません', '没有成交历史', '沒有成交紀錄', 'No hay historial de ejecuciones', 'Aucun historique d’exécutions'],
  '체결이 발생하면 여기에 표시돼요.': ['체결이 발생하면 여기에 표시돼요.', 'Fills appear here when they occur.', '約定するとここに表示されます。', '成交后会显示在这里。', '成交後會顯示在這裡。', 'Las ejecuciones aparecen aquí cuando se producen.', 'Les exécutions apparaissent ici lorsqu’elles se produisent.'],
  '종료된 포지션이 없어요': ['종료된 포지션이 없어요', 'No closed positions', '終了したポジションがありません', '没有已平仓持仓', '沒有已平倉持倉', 'No hay posiciones cerradas', 'Aucune position clôturée'],
  '완결된 거래가 생기면 Agent 판단 기록과 연결돼요.': ['완결된 거래가 생기면 Agent 판단 기록과 연결돼요.', 'Completed trades link to agent decision records.', '完了した取引はエージェントの判断記録にリンクされます。', '已完成交易会关联智能体决策记录。', '已完成交易會連結代理決策紀錄。', 'Las operaciones completadas enlazan con las decisiones del agente.', 'Les transactions achevées sont liées aux décisions de l’agent.'],
}

export function terminalLedgerText(language: ClientLanguage, original: string, values: Readonly<Record<string, string | number>> = {}): string {
  // Fail closed: unknown API/customer prose is never modified.
  if (!Object.hasOwn(terminalLedgerCopy, original)) return original
  const index = column[language]
  if (index === undefined) return original
  const singularKey = `${original} (단수)`
  const key = Object.hasOwn(terminalLedgerCopy, singularKey) && Number.isFinite(Number(values.count)) && new Intl.PluralRules(language).select(Number(values.count)) === 'one' ? singularKey : original
  const text = terminalLedgerCopy[key][index]
  return text.replace(/\{(\w+)\}/g, (token, key: string) => Object.hasOwn(values, key) ? String(values[key]) : token)
}
