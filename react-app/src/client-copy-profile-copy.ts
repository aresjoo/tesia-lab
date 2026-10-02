import type { ClientLanguage } from './client-preferences'
import { copySetupSourceText, copySetupText, type CopySetupKey } from './client-copy-setup-copy'

// Display adapter for the client-source preview. No routing or trading semantics.
const labels = {
  '전략들': ['Strategies', '戦略', '策略', '策略', 'Estrategias', 'Stratégies'],
  '카피 시작하기': ['Start copying', 'コピーを開始', '开始跟单', '開始跟單', 'Empezar a copiar', 'Commencer la copie'],
  '트레이딩 {days}일차': ['Trading for {days} days', 'トレード{days}日目', '交易第{days}天', '交易第{days}天', '{days} días operando', '{days} jours de trading'],
  '수익 분배 {percent}%': ['Profit share {percent}%', '利益分配 {percent}%', '收益分成 {percent}%', '收益分潤 {percent}%', 'Reparto de beneficios {percent}%', 'Partage des gains {percent} %'],
  '{asset} 주력': ['Mainly {asset}', '{asset}が主力', '主要交易{asset}', '主要交易{asset}', 'Principalmente {asset}', 'Principalement {asset}'],
  '마지막 거래 {time}': ['Last trade {time}', '最終取引 {time}', '上次交易 {time}', '上次交易 {time}', 'Última operación {time}', 'Dernière opération {time}'],
  '{count}분 전': ['{count} min ago', '{count}分前', '{count}分钟前', '{count}分鐘前', 'Hace {count} min', 'Il y a {count} min'],
  '{count}시간 전': ['{count} hours ago', '{count}時間前', '{count}小时前', '{count}小時前', 'Hace {count} h', 'Il y a {count} h'],
  '알림 끄기': ['Turn off alerts', '通知をオフ', '关闭提醒', '關閉提醒', 'Desactivar avisos', 'Désactiver les alertes'],
  '알림받기': ['Get alerts', '通知を受け取る', '接收提醒', '接收提醒', 'Recibir avisos', 'Recevoir les alertes'],
  '트레이더 정보': ['Trader information', 'トレーダー情報', '交易员信息', '交易員資訊', 'Información del trader', 'Informations du trader'],
  '개요': ['Overview', '概要', '概览', '總覽', 'Resumen', 'Vue d’ensemble'],
  '포지션': ['Positions', 'ポジション', '持仓', '持倉', 'Posiciones', 'Positions'],
  '손익 캘린더': ['P&L calendar', '損益カレンダー', '盈亏日历', '損益日曆', 'Calendario de PyG', 'Calendrier des gains et pertes'],
  '자금 이동': ['Fund transfers', '資金移動', '资金划转', '資金劃轉', 'Transferencias', 'Transferts de fonds'],
  '카피하는 사람들': ['Copiers', 'コピー利用者', '跟单者', '跟單者', 'Copiadores', 'Copieurs'],
  '기간 선택': ['Select period', '期間を選択', '选择期间', '選擇期間', 'Seleccionar periodo', 'Choisir la période'],
  '기간 수익률': ['Period return', '期間収益率', '期间收益率', '期間報酬率', 'Rentabilidad del periodo', 'Rendement de la période'],
  '기간 손익': ['Period P&L', '期間損益', '期间盈亏', '期間損益', 'PyG del periodo', 'Gains et pertes de la période'],
  '승률': ['Win rate', '勝率', '胜率', '勝率', 'Tasa de acierto', 'Taux de réussite'],
  '최대 낙폭': ['Maximum drawdown', '最大ドローダウン', '最大回撤', '最大回撤', 'Caída máxima', 'Baisse maximale'],
  '카피하는 사람': ['Copiers', 'コピー利用者', '跟单人数', '跟單人數', 'Copiadores', 'Copieurs'],
  '트레이더 총자산': ['Trader total assets', 'トレーダー総資産', '交易员总资产', '交易員總資產', 'Activos totales del trader', 'Actifs totaux du trader'],
  '수익 / 손실 거래': ['Winning / losing trades', '利益 / 損失取引', '盈利 / 亏损交易', '獲利 / 虧損交易', 'Operaciones ganadoras / perdedoras', 'Opérations gagnantes / perdantes'],
  '수익 {wins}회, 손실 {losses}회 (기간 내 {total}회 청산)': ['Winning trades: {wins}, losing trades: {losses} ({total} closed in this period)', '利益{wins}回、損失{losses}回（期間内{total}回決済）', '盈利{wins}次，亏损{losses}次（期间内平仓{total}次）', '獲利{wins}次，虧損{losses}次（期間內平倉{total}次）', 'Ganadoras: {wins}, perdedoras: {losses} (cierres en el periodo: {total})', 'Gagnantes : {wins}, perdantes : {losses} (clôtures sur la période : {total})'],
  '수익률 곡선': ['Return curve', '収益率曲線', '收益率曲线', '報酬率曲線', 'Curva de rentabilidad', 'Courbe de rendement'],
  '선택한 기간 기준, 아래 지표와 같은 데이터예요': ['Based on the selected period, using the same data as the indicators below', '選択した期間に基づき、下の指標と同じデータを使用します', '基于所选期间，与下方指标使用相同数据', '基於所選期間，與下方指標使用相同資料', 'Basada en el periodo seleccionado y los mismos datos que los indicadores de abajo', 'Sur la période choisie, avec les mêmes données que les indicateurs ci-dessous'],
  '검증 곡선이 없어요': ['No validation curve available', '検証曲線がありません', '暂无验证曲线', '暫無驗證曲線', 'No hay curva de validación', 'Aucune courbe de validation'],
  '검증 구간 누적 수익 곡선': ['Cumulative return curve over the validation period', '検証期間の累積収益曲線', '验证期间累计收益曲线', '驗證期間累計報酬曲線', 'Curva de rentabilidad acumulada del periodo de validación', 'Courbe de rendement cumulé sur la période de validation'],
  '주간 순익': ['Weekly net profit', '週間純利益', '每周净收益', '每週淨收益', 'Beneficio neto semanal', 'Gain net hebdomadaire'],
  '최근 13주, 청산 완결 기준': ['Last 13 weeks, based on completed closes', '直近13週間、決済完了基準', '最近13周，按已完成平仓计算', '最近13週，按已完成平倉計算', 'Últimas 13 semanas, según cierres completados', '13 dernières semaines, sur les clôtures terminées'],
  '주간 순익 {count}주': ['Weekly net profit, {count} weeks', '週間純利益、{count}週間', '每周净收益，共{count}周', '每週淨收益，共{count}週', 'Beneficio neto semanal, {count} semanas', 'Gain net hebdomadaire, {count} semaines'],
  '{week}주: {amount}': ['Week {week}: {amount}', '{week}週：{amount}', '第{week}周：{amount}', '第{week}週：{amount}', 'Semana {week}: {amount}', 'Semaine {week} : {amount}'],
  '주간 데이터가 아직 부족해요': ['Not enough weekly data yet', '週間データがまだ不足しています', '每周数据尚不足', '每週資料尚不足', 'Aún no hay suficientes datos semanales', 'Pas encore assez de données hebdomadaires'],
  '청산이 쌓이면 주 단위 순익이 여기에 표시돼요.': ['Weekly net profit will appear here as closed trades accumulate.', '決済が増えると、週単位の純利益がここに表示されます。', '平仓记录积累后，每周净收益将显示在这里。', '平倉紀錄累積後，每週淨收益將顯示在這裡。', 'El beneficio neto semanal aparecerá aquí a medida que se acumulen cierres.', 'Le gain net hebdomadaire apparaîtra ici au fil des clôtures.'],
  '자산 비중': ['Asset allocation', '資産配分', '资产配置', '資產配置', 'Distribución de activos', 'Répartition des actifs'],
  '어떤 자산을 주로 거래하는지': ['Assets traded most often', '主に取引する資産', '主要交易哪些资产', '主要交易哪些資產', 'Activos más negociados', 'Actifs les plus négociés'],
  '기타': ['Other', 'その他', '其他', '其他', 'Otros', 'Autres'],
  '비트코인': ['Bitcoin', 'ビットコイン', '比特币', '比特幣', 'Bitcoin', 'Bitcoin'],
  '이더리움': ['Ethereum', 'イーサリアム', '以太坊', '以太坊', 'Ethereum', 'Ethereum'],
  '나스닥': ['Nasdaq', 'ナスダック', '纳斯达克', '那斯達克', 'Nasdaq', 'Nasdaq'],
  '지금은 표시할 오픈 포지션이 없어요': ['No open positions to display right now', '現在表示できるオープンポジションはありません', '当前暂无可显示的持仓', '目前暫無可顯示的持倉', 'No hay posiciones abiertas que mostrar', 'Aucune position ouverte à afficher'],
  '카피 시작 전에는 오픈 포지션이 1시간 지연 공개돼요. 카피를 시작하면 실시간으로 따라갑니다.': ['Before copying, open positions are shown with a one-hour delay. Once copying starts, they are followed in real time.', 'コピー開始前はオープンポジションが1時間遅れで公開されます。開始後はリアルタイムで追従します。', '开始跟单前，持仓延迟1小时公开。开始后实时跟随。', '開始跟單前，持倉延遲1小時公開。開始後即時跟隨。', 'Antes de copiar, las posiciones se muestran con una hora de retraso. Al empezar, se siguen en tiempo real.', 'Avant la copie, les positions sont affichées avec une heure de retard. Une fois la copie lancée, elles sont suivies en temps réel.'],
  '트레이더가 새로 진입하면 여기에 나타나고, 카피 중이라면 자동으로 함께 진입해요.': ['New trader entries appear here and are copied automatically while copying is active.', 'トレーダーの新規エントリーがここに表示され、コピー中は自動で同時にエントリーします。', '交易员新开仓会显示在这里，跟单期间会自动同步开仓。', '交易員新開倉會顯示在這裡，跟單期間會自動同步開倉。', 'Las nuevas entradas aparecen aquí y se copian automáticamente mientras la copia esté activa.', 'Les nouvelles entrées apparaissent ici et sont copiées automatiquement tant que la copie est active.'],
  '내 카피 손익 캘린더는 첫 청산 후에 채워져요': ['Your copy P&L calendar fills after the first close', 'コピー損益カレンダーは初回決済後に表示されます', '跟单盈亏日历将在首次平仓后更新', '跟單損益日曆將在首次平倉後更新', 'Tu calendario de PyG de copia se llena tras el primer cierre', 'Votre calendrier des gains et pertes de copie se remplit après la première clôture'],
  '이 트레이더의 검증 구간 일별 손익은 전략 상세 캘린더에서 지금도 볼 수 있어요.': ['You can already view this trader’s daily validation P&L in the strategy detail calendar.', 'このトレーダーの検証期間の日別損益は、戦略詳細カレンダーで今すぐ確認できます。', '现在即可在策略详情日历中查看该交易员验证期间的每日盈亏。', '現在即可在策略詳情日曆中查看該交易員驗證期間的每日損益。', 'Ya puedes ver el PyG diario de validación de este trader en el calendario de detalles de la estrategia.', 'Les gains et pertes quotidiens de validation de ce trader sont déjà visibles dans le calendrier des détails de la stratégie.'],
  '전략 상세에서 캘린더 보기': ['View calendar in strategy details', '戦略詳細でカレンダーを見る', '在策略详情中查看日历', '在策略詳情中查看日曆', 'Ver calendario en detalles de la estrategia', 'Voir le calendrier dans les détails de la stratégie'],
  '카피를 시작하고 첫 거래가 청산되면 일별 손익이 달력으로 쌓여요.': ['After copying starts and the first trade closes, daily P&L builds up in the calendar.', 'コピー開始後、最初の取引が決済されると日別損益がカレンダーに蓄積されます。', '开始跟单并完成首次平仓后，每日盈亏将累计到日历中。', '開始跟單並完成首次平倉後，每日損益將累積到日曆中。', 'Tras empezar a copiar y cerrar la primera operación, el PyG diario se acumula en el calendario.', 'Après le début de la copie et la première clôture, les gains et pertes quotidiens s’ajoutent au calendrier.'],
  '아직 자금 이동 내역이 없어요': ['No fund transfers yet', '資金移動履歴はまだありません', '暂无资金划转记录', '暫無資金劃轉紀錄', 'Aún no hay transferencias', 'Aucun transfert de fonds pour le moment'],
  '손실 후 입금이 반복되면 수익률이 실제보다 부풀려 보일 수 있어요. 그 패턴이 감지되면 TETH가 먼저 알려드립니다.': ['Repeated deposits after losses can make returns appear inflated. TETH will alert you if that pattern is detected.', '損失後の入金を繰り返すと収益率が実際より高く見えることがあります。そのパターンを検知したらTETHがお知らせします。', '亏损后反复入金可能使收益率看起来虚高。TETH检测到该模式时会主动提醒。', '虧損後反覆入金可能使報酬率看起來虛高。TETH偵測到該模式時會主動提醒。', 'Los depósitos repetidos tras pérdidas pueden inflar la rentabilidad aparente. TETH te avisará si detecta ese patrón.', 'Des dépôts répétés après des pertes peuvent gonfler le rendement apparent. TETH vous avertira si ce schéma est détecté.'],
  '트레이더가 카피 계좌에 돈을 넣거나 빼면 시각과 금액이 여기에 기록돼요 (최근 180일).': ['Deposits to and withdrawals from the trader’s copy account are recorded here with times and amounts (last 180 days).', 'トレーダーがコピー口座に入出金すると日時と金額がここに記録されます（直近180日）。', '交易员向跟单账户存取资金时，时间和金额会记录在这里（最近180天）。', '交易員向跟單帳戶存取資金時，時間和金額會記錄在這裡（最近180天）。', 'Aquí se registran las horas e importes de los depósitos y retiros de la cuenta de copia del trader (últimos 180 días).', 'Les dépôts et retraits du compte de copie du trader sont enregistrés ici avec leur date et montant (180 derniers jours).'],
  '카피하는 사람들 랭킹을 준비하고 있어요': ['Copier rankings are being prepared', 'コピー利用者ランキングを準備中です', '跟单者排名准备中', '跟單者排名準備中', 'Estamos preparando la clasificación de copiadores', 'Le classement des copieurs est en préparation'],
  '카피를 시작하면 내 순위도 이 목록에서 확인할 수 있어요.': ['Once you start copying, your ranking will appear here too.', 'コピーを始めると、この一覧で自分の順位も確認できます。', '开始跟单后，也可在此列表查看自己的排名。', '開始跟單後，也可在此清單查看自己的排名。', 'Al empezar a copiar, también podrás ver tu puesto aquí.', 'Après avoir commencé à copier, vous pourrez aussi voir votre classement ici.'],
  '지금 {count}명이 이 트레이더를 카피하고 있어요. 투자금과 수익 기준 랭킹이 곧 여기에 표시돼요.': ['{count} people are copying this trader. Rankings by investment and profit will appear here soon.', '現在{count}人がこのトレーダーをコピーしています。投資額と利益によるランキングがまもなくここに表示されます。', '目前有{count}人跟随该交易员。按投资额和收益的排名即将显示在这里。', '目前有{count}人跟隨該交易員。按投資額和收益的排名即將顯示在這裡。', '{count} personas copian a este trader. Pronto aparecerá la clasificación por inversión y beneficios.', '{count} personnes copient ce trader. Le classement par investissement et gains apparaîtra bientôt ici.'],
  '이어서 물어보기': ['Ask a follow-up', '続けて質問する', '继续提问', '繼續提問', 'Seguir preguntando', 'Poursuivre la discussion'],
  '이 트레이더의 위험 신호 분석시키기': ['Analyze this trader’s risk signals', 'このトレーダーのリスク兆候を分析', '分析该交易员的风险信号', '分析該交易員的風險訊號', 'Analizar las señales de riesgo del trader', 'Analyser les signaux de risque du trader'],
  '가장 힘들었던 구간에서 고점 대비 {mdd}% 내려갔어요. 이만큼의 평가 손실을 견딜 수 있는 금액으로만 시작하세요.': ['In the toughest period, the value fell {mdd}% from its peak. Start only with an amount for which you can tolerate that paper loss.', '最も厳しい区間では高値から{mdd}%下落しました。この評価損に耐えられる金額でのみ始めてください。', '最困难阶段较高点下跌{mdd}%。请仅以能承受该浮亏的金额开始。', '最困難階段較高點下跌{mdd}%。請僅以能承受該浮虧的金額開始。', 'En el periodo más difícil, el valor cayó un {mdd}% desde el máximo. Empieza solo con un importe cuya pérdida latente puedas soportar.', 'Sur la période la plus difficile, la valeur a baissé de {mdd} % depuis son sommet. Engagez uniquement un montant dont vous pouvez supporter cette perte latente.'],
  '최대 낙폭이 {mdd}%로 관리되는 편이에요. 그래도 하락 구간은 언제든 다시 올 수 있어요.': ['Maximum drawdown has been kept to {mdd}%. Still, another downturn can occur at any time.', '最大ドローダウンは{mdd}%に抑えられています。それでも下落局面はいつでも再び起こり得ます。', '最大回撤控制在{mdd}%。但下跌阶段随时可能再次出现。', '最大回撤控制在{mdd}%。但下跌階段隨時可能再次出現。', 'La caída máxima se ha mantenido en el {mdd}%. Aun así, puede haber otra caída en cualquier momento.', 'La baisse maximale a été contenue à {mdd} %. Un nouveau recul reste toutefois possible à tout moment.'],
} as const satisfies Record<string, readonly [string, string, string, string, string, string]>
const languages: ClientLanguage[] = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']
export type CopyProfileKey = keyof typeof labels | CopySetupKey
export function copyProfileText(language: ClientLanguage, key: CopyProfileKey, values: Record<string, string | number> = {}): string {
  if (!Object.hasOwn(labels, key)) return copySetupText(language, key as CopySetupKey, values)
  const index = languages.indexOf(language), text = index <= 0 ? key : labels[key as keyof typeof labels][index - 1]
  return text.replace(/\{(\w+)\}/g, (placeholder, name: string) => Object.hasOwn(values, name) ? String(values[name]) : placeholder)
}
export function copyProfileAsset(language: ClientLanguage, asset: string): string {
  return asset === '비트코인' || asset === '이더리움' || asset === '나스닥' || asset === '기타' ? copyProfileText(language, asset) : asset
}
const drawdownTemplates = [
  ['가장 힘들었던 구간에서 고점 대비 {mdd}% 내려갔어요. 이만큼의 평가 손실을 견딜 수 있는 금액으로만 시작하세요.', /^가장 힘들었던 구간에서 고점 대비 (-?\d+\.\d+)% 내려갔어요\. 이만큼의 평가 손실을 견딜 수 있는 금액으로만 시작하세요\.$/],
  ['최대 낙폭이 {mdd}%로 관리되는 편이에요. 그래도 하락 구간은 언제든 다시 올 수 있어요.', /^최대 낙폭이 (-?\d+\.\d+)%로 관리되는 편이에요\. 그래도 하락 구간은 언제든 다시 올 수 있어요\.$/],
] as const
export function copyProfileSourceText(language: ClientLanguage, value: string): string {
  if (language === 'ko') return value
  for (const [key, pattern] of drawdownTemplates) {
    const match = value.match(pattern)
    if (match) return copyProfileText(language, key, { mdd: Number(match[1]).toLocaleString(language, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) })
  }
  return copySetupSourceText(language, value)
}
