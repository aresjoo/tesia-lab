import type { ClientLanguage } from './client-preferences'
import { copyActionText, type CopyActionKey } from './client-copy-trading-copy'

// Presentation adapter only. Korean source projection and all calculation rules stay unchanged.
const labels = {
  '카피 방식': ['Copy mode', 'コピー方式', '跟单模式', '跟單模式', 'Modo de copia', 'Mode de copie'],
  '고정 마진': ['Fixed margin', '固定証拠金', '固定保证金', '固定保證金', 'Margen fijo', 'Marge fixe'],
  '비율 따라가기: 트레이더가 자기 자산의 몇 %를 쓰면, 내 카피 금액에서도 같은 비율만큼 따라 들어가요.': ['Proportional copy: when the trader uses a percentage of their assets, the same percentage of your copy amount is used.', '比率コピー：トレーダーが資産の何％かを使うと、あなたのコピー金額も同じ比率でエントリーします。', '比例跟单：交易员使用其资产的一定比例时，您的跟单金额也按相同比例入场。', '比例跟單：交易員使用其資產的一定比例時，您的跟單金額也按相同比例進場。', 'Copia proporcional: se utiliza el mismo porcentaje de tu importe de copia que el trader utiliza de sus activos.', 'Copie proportionnelle : le pourcentage de votre montant engagé est identique à celui des actifs utilisés par le trader.'],
  '고정 마진: 트레이더의 비중과 무관하게 주문마다 정해둔 금액만큼만 따라가요.': ['Fixed margin: each copied order uses a fixed amount, regardless of the trader’s allocation.', '固定証拠金：トレーダーの比率に関係なく、注文ごとに決めた金額でコピーします。', '固定保证金：无论交易员的仓位比例如何，每笔订单仅使用预设金额跟单。', '固定保證金：無論交易員的倉位比例如何，每筆訂單僅使用預設金額跟單。', 'Margen fijo: cada orden copiada utiliza un importe fijo, independientemente de la proporción del trader.', 'Marge fixe : chaque ordre copié utilise un montant fixe, quelle que soit l’allocation du trader.'],
  '고정 마진 모드는 준비 중이에요': ['Fixed margin mode is coming soon', '固定証拠金モードは準備中です', '固定保证金模式准备中', '固定保證金模式準備中', 'El modo de margen fijo estará disponible próximamente', 'Le mode marge fixe est en préparation'],
  '비율 따라가기로 설정하기': ['Use proportional copy', '比率コピーで設定する', '使用比例跟单', '使用比例跟單', 'Usar copia proporcional', 'Utiliser la copie proportionnelle'],
  '지금은 비율 따라가기로 시작할 수 있어요. 고정 마진이 열리면 알림으로 알려드릴게요.': ['You can start with proportional copy now. We’ll notify you when fixed margin becomes available.', '現在は比率コピーで開始できます。固定証拠金が利用可能になったら通知でお知らせします。', '现在可以使用比例跟单开始。固定保证金开放后会通知您。', '現在可以使用比例跟單開始。固定保證金開放後會通知您。', 'Puedes empezar con copia proporcional. Te avisaremos cuando esté disponible el margen fijo.', 'Vous pouvez commencer avec la copie proportionnelle. Nous vous informerons de la disponibilité de la marge fixe.'],
  '카피 금액': ['Copy amount', 'コピー金額', '跟单金额', '跟單金額', 'Importe de copia', 'Montant de copie'],
  '최소 50 USDT부터 시작할 수 있어요': ['Start with at least 50 USDT', '50 USDT以上から開始できます', '最低 50 USDT 起', '最低 50 USDT 起', 'Empieza con al menos 50 USDT', 'Commencez avec au moins 50 USDT'],
  '스팟 잔고보다 커요. 충전(+)하거나 금액을 줄여주세요': ['Exceeds your spot balance. Add funds (+) or reduce the amount', '現物残高を超えています。チャージ（+）するか金額を減らしてください', '超过现货余额，请充值（+）或减少金额', '超過現貨餘額，請加值（+）或減少金額', 'Supera tu saldo spot. Añade fondos (+) o reduce el importe', 'Dépasse votre solde spot. Ajoutez des fonds (+) ou réduisez le montant'],
  '스팟 잔고': ['Spot balance', '現物残高', '现货余额', '現貨餘額', 'Saldo spot', 'Solde spot'],
  '스팟 충전': ['Add spot funds', '現物残高チャージ', '现货充值', '現貨加值', 'Añadir fondos spot', 'Ajouter des fonds spot'],
  '충전은 스팟 계좌에서 카피 계좌로 옮겨져요': ['Funds move from your spot account to the copy account', '現物口座からコピー口座に資金を移動します', '资金从现货账户转入跟单账户', '資金從現貨帳戶轉入跟單帳戶', 'Los fondos pasan de la cuenta spot a la de copia', 'Les fonds passent du compte spot au compte de copie'],
  '따라갈 페어': ['Pairs to copy', 'コピーするペア', '跟随交易对', '跟隨交易對', 'Pares a copiar', 'Paires à copier'],
  ' 외 {count}개': [' and {count} more', ' ほか{count}ペア', ' 等 {count} 个', ' 等 {count} 個', ' y {count} más', ' et {count} autres'],
  '변경': ['Change', '変更', '更改', '變更', 'Cambiar', 'Modifier'],
  '고급 설정': ['Advanced settings', '詳細設定', '高级设置', '進階設定', 'Ajustes avanzados', 'Paramètres avancés'],
  '트레이더 설정 그대로 따름': ['Follow the trader’s settings', 'トレーダーの設定に従う', '跟随交易员设置', '跟隨交易員設定', 'Seguir los ajustes del trader', 'Suivre les paramètres du trader'],
  '마진 모드': ['Margin mode', '証拠金モード', '保证金模式', '保證金模式', 'Modo de margen', 'Mode de marge'],
  '교차, 트레이더 설정을 따라요': ['Cross, following the trader', 'クロス、トレーダーの設定に従います', '全仓，跟随交易员设置', '全倉，跟隨交易員設定', 'Cruzado, siguiendo al trader', 'Croisée, selon le trader'],
  '레버리지': ['Leverage', 'レバレッジ', '杠杆', '槓桿', 'Apalancamiento', 'Effet de levier'],
  '트레이더 레버리지 따름': ['Follow the trader’s leverage', 'トレーダーのレバレッジに従う', '跟随交易员杠杆', '跟隨交易員槓桿', 'Seguir el apalancamiento del trader', 'Suivre le levier du trader'],
  '체결가 차이 허용': ['Execution price tolerance', '約定価格差の許容', '成交价差容忍度', '成交價差容忍度', 'Tolerancia del precio de ejecución', 'Tolérance du prix d’exécution'],
  '시스템 기본': ['System default', 'システム既定', '系统默认', '系統預設', 'Por defecto', 'Par défaut'],
  '주문당 마진 상한': ['Margin limit per order', '注文ごとの証拠金上限', '每单保证金上限', '每單保證金上限', 'Límite de margen por orden', 'Plafond de marge par ordre'],
  '최대 포지션 금액': ['Maximum position amount', '最大ポジション金額', '最大持仓金额', '最大持倉金額', 'Importe máximo de posición', 'Montant maximal de position'],
  '{amount}까지, 자동': ['Up to {amount}, automatic', '{amount}まで、自動', '最高 {amount}，自动', '最高 {amount}，自動', 'Hasta {amount}, automático', 'Jusqu’à {amount}, automatique'],
  '카피 금액의 5배까지, 자동': ['Up to 5× the copy amount, automatic', 'コピー金額の5倍まで、自動', '最高跟单金额的 5 倍，自动', '最高跟單金額的 5 倍，自動', 'Hasta 5 veces el importe de copia, automático', 'Jusqu’à 5 fois le montant de copie, automatique'],
  '카피 시작': ['Start copying', 'コピー開始', '开始跟单', '開始跟單', 'Empezar a copiar', 'Commencer la copie'],
  '시작 후에도 언제든 중지할 수 있어요. 수익이 나면 10%를 트레이더와 나눠요.': ['You can stop at any time. If you make a profit, 10% is shared with the trader.', '開始後もいつでも停止できます。利益が出た場合、10%をトレーダーと分配します。', '开始后可随时停止。有收益时，将 10% 分给交易员。', '開始後可隨時停止。有收益時，將 10% 分給交易員。', 'Puedes parar cuando quieras. Si obtienes beneficios, compartes el 10% con el trader.', 'Vous pouvez arrêter à tout moment. En cas de gains, 10 % sont partagés avec le trader.'],
  '트레이더 요약': ['Trader summary', 'トレーダー概要', '交易员概览', '交易員總覽', 'Resumen del trader', 'Résumé du trader'],
  '트레이딩 기간': ['Trading duration', 'トレード期間', '交易时长', '交易期間', 'Tiempo operando', 'Durée de trading'],
  '{days}일': ['{days} days', '{days}日', '{days}天', '{days}天', '{days} días', '{days} jours'],
  '수익 분배': ['Profit sharing', '利益分配', '收益分润', '收益分潤', 'Reparto de beneficios', 'Partage des gains'],
  '180일 수익률': ['180-day return', '180日収益率', '180天收益率', '180天報酬率', 'Rentabilidad a 180 días', 'Rendement sur 180 jours'],
  '180일 손익': ['180-day P&L', '180日損益', '180天盈亏', '180天損益', 'PyG a 180 días', 'P&L sur 180 jours'],
  '카피어 누적 수익': ['Total copier profit', 'コピー利用者の累計利益', '跟单者累计收益', '跟單者累計收益', 'Beneficio total de copiadores', 'Gains cumulés des copieurs'],
  '운용 자산': ['Assets under management', '運用資産', '管理资产', '管理資產', 'Activos gestionados', 'Actifs sous gestion'],
  '따라갈 페어 선택': ['Select pairs to copy', 'コピーするペアを選択', '选择跟随交易对', '選擇跟隨交易對', 'Seleccionar pares a copiar', 'Choisir les paires à copier'],
  '트레이더가 이 페어에서 거래할 때만 따라가요.': ['Only copy trades in these pairs.', 'このペアでの取引のみコピーします。', '仅跟随交易员在这些交易对上的交易。', '僅跟隨交易員在這些交易對上的交易。', 'Solo se copian operaciones en estos pares.', 'Seules les opérations sur ces paires sont copiées.'],
  '주력': ['Primary', '主力', '主要', '主要', 'Principal', 'Principale'],
  '최소 1개 페어는 선택해야 해요': ['Select at least one pair', '1つ以上のペアを選択してください', '请至少选择一个交易对', '請至少選擇一個交易對', 'Selecciona al menos un par', 'Choisissez au moins une paire'],
  '적용': ['Apply', '適用', '应用', '套用', 'Aplicar', 'Appliquer'],
  '체험용 스팟 잔고를 충전해요.': ['Add funds to the preview spot balance.', '体験用の現物残高をチャージします。', '为体验用现货余额充值。', '為體驗用現貨餘額加值。', 'Añade fondos al saldo spot de prueba.', 'Ajoutez des fonds au solde spot de démonstration.'],
  '실서비스에서는 거래소 입금 플로우가 연결됩니다.': ['The live service will connect to the exchange deposit flow.', '実サービスでは取引所の入金フローが接続されます。', '正式服务将连接交易所入金流程。', '正式服務將連接交易所入金流程。', 'El servicio real se conectará al flujo de depósito del exchange.', 'Le service réel sera relié au dépôt sur la plateforme d’échange.'],
  '+1,000 USDT 충전': ['Add 1,000 USDT', '1,000 USDTをチャージ', '充值 1,000 USDT', '加值 1,000 USDT', 'Añadir 1.000 USDT', 'Ajouter 1 000 USDT'],
  '원칙대로만 삽니다. 손절은 기계처럼.': ['I trade by the rules. Stop-losses are mechanical.', 'ルール通りに買います。損切りは機械的に。', '只按原则买入，止损像机器一样执行。', '只按原則買入，停損像機器一樣執行。', 'Opero según mis reglas. El stop-loss es mecánico.', 'Je suis mes règles. Les stop-loss sont mécaniques.'],
  '추세가 확인되기 전에는 움직이지 않아요.': ['I wait for a confirmed trend before acting.', 'トレンドが確認できるまでは動きません。', '趋势确认前不行动。', '趨勢確認前不行動。', 'Espero a que se confirme la tendencia antes de actuar.', 'J’attends la confirmation de la tendance avant d’agir.'],
  '하락장에서 살아남는 것이 첫 번째 목표입니다.': ['Surviving a bear market is my first goal.', '下落相場を生き残ることが第一の目標です。', '在熊市中生存是首要目标。', '在熊市中生存是首要目標。', 'Mi primer objetivo es sobrevivir a un mercado bajista.', 'Survivre à un marché baissier est mon premier objectif.'],
  '복리는 지루함을 견딘 사람의 몫이에요.': ['Compounding rewards those who endure the boredom.', '複利は退屈に耐えた人のものです。', '复利属于能忍受无聊的人。', '複利屬於能忍受無聊的人。', 'El interés compuesto recompensa a quien soporta el aburrimiento.', 'La capitalisation récompense ceux qui supportent l’ennui.'],
  '트레이딩 {days}일차 계좌의 수익률 {roi}%는 아직 검증 기간이 짧아요. 최소 3개월 이상 이어지는지 지켜보고 판단해도 늦지 않아요.': ['A {roi}% return over {days} trading days is still a short track record. Consider waiting to see whether it lasts at least three months.', 'トレード{days}日目で収益率{roi}%はまだ検証期間が短いです。最低3か月以上続くかを見てから判断しても遅くありません。', '交易{days}天的账户收益率为{roi}%，验证期仍较短。不妨观察至少3个月后再判断。', '交易{days}天的帳戶報酬率為{roi}%，驗證期仍較短。不妨觀察至少3個月後再判斷。', 'Una rentabilidad del {roi}% en {days} días sigue siendo un historial corto. Considera observar si se mantiene al menos tres meses.', 'Un rendement de {roi} % sur {days} jours reste un historique court. Vous pouvez attendre de voir s’il dure au moins trois mois.'],
  '기록이 {days}일로 짧은 편이에요. 수치보다 손절 원칙이 지켜지는지를 먼저 봐주세요.': ['The {days}-day track record is short. Look at adherence to stop-loss rules before the numbers.', '記録は{days}日と短めです。数値よりも損切りルールが守られているかを先に確認してください。', '记录仅{days}天，时间较短。比起数字，请先关注是否遵守止损原则。', '紀錄僅{days}天，時間較短。比起數字，請先關注是否遵守停損原則。', 'El historial de {days} días es corto. Prioriza comprobar si se respetan las reglas de stop-loss.', 'L’historique de {days} jours est court. Vérifiez d’abord le respect des règles de stop-loss plutôt que les chiffres.'],
  '기록이 {days}일째 이어지고 있어요. 기간이 길수록 수치의 신뢰도가 높아요.': ['The track record spans {days} days. Longer records make the figures more reliable.', '記録は{days}日続いています。期間が長いほど数値の信頼性が高まります。', '记录已持续{days}天。时间越长，数据的可信度越高。', '紀錄已持續{days}天。時間越長，數據的可信度越高。', 'El historial abarca {days} días. Cuanto más largo, más fiables son las cifras.', 'L’historique couvre {days} jours. Une durée plus longue rend les chiffres plus fiables.'],
} as const satisfies Record<string, readonly [string, string, string, string, string, string]>
const languages: ClientLanguage[] = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']
export type CopySetupKey = keyof typeof labels | CopyActionKey
export function copySetupText(language: ClientLanguage, key: CopySetupKey, values: Record<string, string | number> = {}): string {
  if (!Object.hasOwn(labels, key)) return copyActionText(language, key as CopyActionKey, values)
  const index = languages.indexOf(language), text = index <= 0 ? key : labels[key as keyof typeof labels][index - 1]
  return text.replace(/\{(\w+)\}/g, (placeholder, name: string) => Object.hasOwn(values, name) ? String(values[name]) : placeholder)
}

// Translate only exact, known source-preview templates. User-authored text is never rewritten.
export function copySetupSourceText(language: ClientLanguage, value: string): string {
  if (language === 'ko') return value
  if (Object.hasOwn(labels, value)) return copySetupText(language, value as keyof typeof labels)
  const templates = [
    ['트레이딩 {days}일차 계좌의 수익률 {roi}%는 아직 검증 기간이 짧아요. 최소 3개월 이상 이어지는지 지켜보고 판단해도 늦지 않아요.', /^트레이딩 (\d+)일차 계좌의 수익률 (-?\d+\.\d+)%는 아직 검증 기간이 짧아요\. 최소 3개월 이상 이어지는지 지켜보고 판단해도 늦지 않아요\.$/],
    ['기록이 {days}일로 짧은 편이에요. 수치보다 손절 원칙이 지켜지는지를 먼저 봐주세요.', /^기록이 (\d+)일로 짧은 편이에요\. 수치보다 손절 원칙이 지켜지는지를 먼저 봐주세요\.$/],
    ['기록이 {days}일째 이어지고 있어요. 기간이 길수록 수치의 신뢰도가 높아요.', /^기록이 (\d+)일째 이어지고 있어요\. 기간이 길수록 수치의 신뢰도가 높아요\.$/],
  ] as const
  for (const [key, pattern] of templates) {
    const match = value.match(pattern)
    if (match) return copySetupText(language, key, { days: Number(match[1]).toLocaleString(language), roi: match[2] === undefined ? '' : Number(match[2]).toLocaleString(language, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) })
  }
  return value
}
