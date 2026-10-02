import type { ClientLanguage } from './client-preferences'

// Source Korean unchanged; AGY gemini-3.8-flash-high display-label translation.
// New copy-trading body localization remains a separately tracked migration task.
const labels = {
  '카피하기': ['카피하기', 'Copy', 'コピーする', '跟单', '跟單', 'Copiar', 'Copier'],
  '트레이더 프로필': ['트레이더 프로필', 'Trader Profile', 'トレーダープロフィール', '交易员主页', '交易員主頁', 'Perfil del trader', 'Profil du trader'],
  '카피 설정': ['카피 설정', 'Copy Settings', 'コピー設定', '跟单设置', '跟單設定', 'Configuración de copia', 'Paramètres de copie'],
  '카피 상세': ['카피 상세', 'Copy Details', 'コピー詳細', '跟单详情', '跟單詳情', 'Detalles de la copia', 'Détails de la copie'],
} as const
const languages: ClientLanguage[] = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']
export function copyTradingLabel(language: ClientLanguage, key: keyof typeof labels): string {
  return labels[key][Math.max(0, languages.indexOf(language))]
}

// Display-only copy for the source dashboard/detail. No currency conversion or state changes.
const summaryLabels = {
  '로그인 후 카피를 관리할 수 있어요': ['Sign in to manage copies', 'ログインしてコピーを管理できます', '登录后可管理跟单', '登入後可管理跟單', 'Inicia sesión para gestionar copias', 'Connectez-vous pour gérer vos copies'],
  '로그인': ['Log in', 'ログイン', '登录', '登入', 'Iniciar sesión', 'Se connecter'],
  '카피를 찾을 수 없어요': ['Copy not found', 'コピーが見つかりません', '找不到跟单', '找不到跟單', 'Copia no encontrada', 'Copie introuvable'],
  '지금은 볼 수 없는 트레이더예요': ['This trader is currently unavailable', '現在このトレーダーは表示できません', '当前无法查看此交易员', '目前無法查看此交易員', 'Este trader no está disponible', 'Ce trader est actuellement indisponible'],
  '전략들로 돌아가기': ['Back to strategies', '戦略一覧へ戻る', '返回策略列表', '返回策略列表', 'Volver a estrategias', 'Retour aux stratégies'],
  '전 자산 USDT 표기, 시뮬레이션 데이터 기준': ['All assets in USDT, based on simulated data', '全資産はUSDT表示、シミュレーションデータに基づく', '所有资产以 USDT 显示，基于模拟数据', '所有資產以 USDT 顯示，基於模擬資料', 'Todos los activos en USDT, con datos simulados', 'Tous les actifs en USDT, sur données simulées'],
  '카피 자산 평가': ['Copy asset value', 'コピー資産評価額', '跟单资产估值', '跟單資產估值', 'Valor de activos copiados', 'Valeur des actifs copiés'],
  '평가 금액': ['Equity', '評価額', '权益', '權益', 'Patrimonio', 'Valeur totale'],
  '가용 잔고': ['Available balance', '利用可能残高', '可用余额', '可用餘額', 'Saldo disponible', 'Solde disponible'],
  '가용': ['Available', '利用可能', '可用', '可用', 'Disponible', 'Disponible'],
  '순손익 (분배 차감 후)': ['Net P&L (after profit sharing)', '純損益（利益分配後）', '净盈亏（扣除分润后）', '淨損益（扣除分潤後）', 'PyG netas (tras reparto)', 'P&L net (après partage)'],
  '정산 시점 미실현': ['Unrealized P&L at settlement', '精算時の未実現損益', '结算时未实现盈亏', '結算時未實現損益', 'PyG no realizadas al liquidar', 'P&L latent au règlement'],
  '미실현 손익': ['Unrealized P&L', '未実現損益', '未实现盈亏', '未實現損益', 'PyG no realizadas', 'P&L latent'],
  '실현 손익': ['Realized P&L', '実現損益', '已实现盈亏', '已實現損益', 'PyG realizadas', 'P&L réalisé'],
  '수익 분배 지급': ['Profit sharing paid', '利益分配支払額', '已支付分润', '已支付分潤', 'Reparto pagado', 'Partage versé'],
  '순손익': ['Net P&L', '純損益', '净盈亏', '淨損益', 'PyG netas', 'P&L net'],
  '순손익 (정산 확정)': ['Net P&L (settled)', '純損益（精算確定）', '净盈亏（已结算）', '淨損益（已結算）', 'PyG netas (liquidadas)', 'P&L net (réglé)'],
  '누적 투자': ['Total invested', '累計投資額', '累计投入', '累計投入', 'Total invertido', 'Total investi'],
  '회수 금액': ['Amount returned', '返還額', '收回金额', '收回金額', 'Importe devuelto', 'Montant restitué'],
  '카피 대시보드': ['Copy dashboard', 'コピーダッシュボード', '跟单概览', '跟單總覽', 'Panel de copias', 'Tableau de copie'],
  '실시간 카피': ['Live copies', 'リアルタイムコピー', '实时跟单', '即時跟單', 'Copias en tiempo real', 'Copies en temps réel'],
  '{count}건 진행 중, 전 자산 USDT 표기': ['{count} active, all assets in USDT', '{count}件稼働中、全資産USDT表示', '{count} 笔进行中，所有资产以 USDT 显示', '{count} 筆進行中，所有資產以 USDT 顯示', '{count} activas, todos los activos en USDT', '{count} en cours, tous les actifs en USDT'],
  '지금은 손실 구간이에요. 카피는 트레이더의 손절 규칙까지 그대로 따라가니, 원칙이 지켜지는지 프로필의 판단 기록을 확인해보세요.': ['This copy is currently at a loss. It follows the trader’s stop-loss rules too. Check the decision history in their profile to see whether those rules are being followed.', '現在は損失が出ています。コピーはトレーダーの損切りルールも引き継ぐため、プロフィールの判断記録でルールが守られているか確認しましょう。', '目前处于亏损阶段。跟单也会遵循交易员的止损规则，请查看主页中的决策记录，确认是否遵守原则。', '目前處於虧損階段。跟單也會遵循交易員的停損規則，請查看主頁中的決策紀錄，確認是否遵守原則。', 'Esta copia está en pérdidas. También sigue las reglas de stop-loss del trader. Revisa su historial de decisiones para comprobar si las respeta.', 'Cette copie est en perte. Elle suit aussi les règles de stop-loss du trader. Consultez son historique de décisions pour vérifier leur respect.'],
  '수익 분배는 실현 수익에서만 차감돼요. 미실현 수익에는 분배가 붙지 않아요.': ['Profit sharing is deducted only from realized profits, not unrealized profits.', '利益分配は実現利益からのみ差し引かれ、未実現利益には発生しません。', '分润仅从已实现收益中扣除，未实现收益不收取分润。', '分潤僅從已實現收益中扣除，未實現收益不收取分潤。', 'El reparto se descuenta solo de beneficios realizados, no de los no realizados.', 'Le partage est prélevé uniquement sur les gains réalisés, pas sur les gains latents.'],
  '카피 표시': ['Copy filter', 'コピー表示', '跟单筛选', '跟單篩選', 'Filtro de copias', 'Filtre des copies'],
  '종료 포함': ['Include closed', '終了分を含む', '包含已结束', '包含已結束', 'Incluir cerradas', 'Inclure les clôturées'],
  '카피 중': ['Copying', 'コピー中', '跟单中', '跟單中', 'Copiando', 'Copie en cours'],
  '종료됨': ['Closed', '終了済み', '已结束', '已結束', 'Cerrada', 'Clôturée'],
  '비율 따라가기': ['Proportional copy', '比率コピー', '比例跟单', '比例跟單', 'Copia proporcional', 'Copie proportionnelle'],
  '분배 10%': ['10% share', '分配10%', '分润 10%', '分潤 10%', 'Reparto 10%', 'Partage 10%'],
  '수익 분배 10%': ['10% profit sharing', '利益分配10%', '收益分润 10%', '收益分潤 10%', 'Reparto de beneficios 10%', 'Partage des gains 10%'],
  '{date} 시작': ['Started {date}', '{date} 開始', '{date} 开始', '{date} 開始', 'Inicio: {date}', 'Début : {date}'],
  '카피 원본 데이터를 확인할 수 없어요': ['Copy source data is unavailable', 'コピー元データを確認できません', '无法获取跟单源数据', '無法取得跟單來源資料', 'Los datos de origen no están disponibles', 'Les données sources sont indisponibles'],
  '상세': ['Details', '詳細', '详情', '詳情', 'Detalles', 'Détails'],
  '기록 보기': ['View history', '記録を見る', '查看记录', '查看紀錄', 'Ver historial', 'Voir l’historique'],
  '잔고 조정': ['Adjust balance', '残高調整', '调整余额', '調整餘額', 'Ajustar saldo', 'Ajuster le solde'],
  '카피 종료': ['Stop copying', 'コピー終了', '结束跟单', '結束跟單', 'Detener copia', 'Arrêter la copie'],
  '설정': ['Settings', '設定', '设置', '設定', 'Ajustes', 'Paramètres'],
  '정산 완료, {amount} 회수': ['Settled, {amount} returned', '精算完了、{amount}返還', '结算完成，收回 {amount}', '結算完成，收回 {amount}', 'Liquidada, {amount} devueltos', 'Réglée, {amount} restitués'],
  '진행 중인 카피가 없어요': ['No active copies', '稼働中のコピーはありません', '没有进行中的跟单', '沒有進行中的跟單', 'No hay copias activas', 'Aucune copie en cours'],
  '종료 기록 보기': ['View closed copies', '終了記録を見る', '查看已结束记录', '查看已結束紀錄', 'Ver copias cerradas', 'Voir les copies clôturées'],
  '복제 검증': ['Clone validation', '複製検証', '复刻验证', '複製驗證', 'Validación de clones', 'Validation des copies de stratégie'],
  '전략을 복제해 내 계정으로 재검증한 기록': ['Strategies cloned and revalidated in my account', '戦略を複製し自分のアカウントで再検証した記録', '复制策略并在我的账户中重新验证的记录', '複製策略並在我的帳戶中重新驗證的紀錄', 'Estrategias clonadas y revalidadas en mi cuenta', 'Stratégies dupliquées et revalidées sur mon compte'],
  '따라가기': ['Following', 'フォロー', '跟随', '跟隨', 'Siguiendo', 'Suivi'],
  '지금 열려 있는 카피 포지션이 없어요': ['No open copy positions', '現在オープン中のコピーポジションはありません', '当前没有跟单持仓', '目前沒有跟單持倉', 'No hay posiciones copiadas abiertas', 'Aucune position copiée ouverte'],
  '포지션이 없는 동안에도 카피는 유지돼요.': ['Copying stays active even without an open position.', 'ポジションがなくてもコピーは継続します。', '没有持仓时，跟单仍会保持开启。', '沒有持倉時，跟單仍會保持開啟。', 'La copia sigue activa aunque no haya posiciones abiertas.', 'La copie reste active même sans position ouverte.'],
  '종료된 카피예요. 기록 탭에서 이력을 볼 수 있어요.': ['This copy is closed. View its history in the history tabs.', '終了したコピーです。履歴タブで記録を確認できます。', '此跟单已结束，可在记录标签中查看历史。', '此跟單已結束，可在紀錄標籤中查看歷史。', 'Esta copia está cerrada. Consulta las pestañas de historial.', 'Cette copie est clôturée. Consultez les onglets d’historique.'],
  '트레이더가 진입하면 자동으로 함께 진입하고, 여기에 실시간으로 표시돼요.': ['When the trader enters a position, the copy enters automatically and appears here in real time.', 'トレーダーがエントリーすると自動で同時にエントリーし、ここにリアルタイムで表示されます。', '交易员建仓时会自动跟随，并在此实时显示。', '交易員建倉時會自動跟隨，並在此即時顯示。', 'Cuando el trader abre una posición, la copia entra automáticamente y aparece aquí en tiempo real.', 'Lorsque le trader ouvre une position, la copie entre automatiquement et s’affiche ici en temps réel.'],
  '포지션 1건이 열려 있어요. 미실현 손익 ': ['1 position is open. Unrealized P&L ', '1件のポジションがオープン中です。未実現損益 ', '当前有 1 笔持仓。未实现盈亏 ', '目前有 1 筆持倉。未實現損益 ', 'Hay 1 posición abierta. PyG no realizadas ', '1 position ouverte. P&L latent '],
  '. 트레이더의 손절 규칙까지 그대로 따라가요.': ['. The trader’s stop-loss rules are followed too.', '。トレーダーの損切りルールもそのまま引き継ぎます。', '。同时遵循交易员的止损规则。', '。同時遵循交易員的停損規則。', '. También se siguen las reglas de stop-loss del trader.', '. Les règles de stop-loss du trader sont aussi suivies.'],
  '카피 포지션': ['Copy positions', 'コピーポジション', '跟单持仓', '跟單持倉', 'Posiciones copiadas', 'Positions copiées'],
  '규모': ['Size', '規模', '规模', '規模', 'Tamaño', 'Taille'],
  '평균 진입가': ['Average entry', '平均エントリー価格', '平均开仓价', '平均開倉價', 'Entrada media', 'Entrée moyenne'],
  '현재가': ['Current price', '現在価格', '当前价格', '目前價格', 'Precio actual', 'Cours actuel'],
  '청산 위험': ['Liquidation risk', '清算リスク', '强平风险', '強平風險', 'Riesgo de liquidación', 'Risque de liquidation'],
  '손절 / 목표': ['Stop / target', '損切り / 目標', '止损 / 目标', '停損 / 目標', 'Stop / objetivo', 'Stop / objectif'],
  '낮음': ['Low', '低', '低', '低', 'Bajo', 'Faible'],
  '포지션 전체 정리': ['Close all positions', '全ポジションを決済', '平掉所有仓位', '平掉所有倉位', 'Cerrar todas las posiciones', 'Fermer toutes les positions'],
} as const satisfies Record<string, readonly [string, string, string, string, string, string]>
export type CopySummaryKey = keyof typeof summaryLabels
export function copySummaryText(language: ClientLanguage, key: CopySummaryKey, values: Record<string, string | number> = {}): string {
  const index = languages.indexOf(language)
  const text = index <= 0 ? key : summaryLabels[key][index - 1]
  return text.replace(/\{(\w+)\}/g, (placeholder, name: string) => Object.hasOwn(values, name) ? String(values[name]) : placeholder)
}

const actionLabels = {
  '현재 계정의 카피 상태를 다시 확인해주세요.': ['Check the copy state for your current account.', '現在のアカウントのコピー状態を再確認してください。', '请重新确认当前账户的跟单状态。', '請重新確認目前帳戶的跟單狀態。', 'Comprueba el estado de copia de tu cuenta actual.', 'Vérifiez l’état de copie de votre compte actuel.'],
  '입력을 확인해주세요.': ['Check your input.', '入力を確認してください。', '请检查输入。', '請檢查輸入。', 'Revisa los datos introducidos.', 'Vérifiez votre saisie.'],
  '진행 중인 카피가 아니에요.': ['This copy is not active.', '稼働中のコピーではありません。', '此跟单未在运行。', '此跟單未在執行。', 'Esta copia no está activa.', 'Cette copie n’est pas active.'],
  '로그인 후 카피 미리보기를 이용해주세요.': ['Sign in to use the copy preview.', 'ログインしてコピープレビューをご利用ください。', '请登录后使用跟单预览。', '請登入後使用跟單預覽。', 'Inicia sesión para usar la vista previa de copia.', 'Connectez-vous pour utiliser l’aperçu de copie.'],
  '현재 계정 정보를 다시 확인해주세요.': ['Check your current account details.', '現在のアカウント情報を再確認してください。', '请重新确认当前账户信息。', '請重新確認目前帳戶資訊。', 'Comprueba los datos de tu cuenta actual.', 'Vérifiez les informations de votre compte actuel.'],
  '카피 미리보기의 저장 상태를 확인할 수 없어 변경을 멈췄어요. 기존 기록은 보존되어 있어요.': ['Changes are paused because the saved copy preview state could not be verified. Existing records are preserved.', 'コピープレビューの保存状態を確認できないため変更を停止しました。既存の記録は保持されています。', '无法确认跟单预览的保存状态，已停止更改。现有记录已保留。', '無法確認跟單預覽的儲存狀態，已停止變更。現有紀錄已保留。', 'Los cambios se han pausado porque no se pudo verificar el estado guardado. Los registros existentes se conservan.', 'Les modifications sont suspendues car l’état enregistré n’a pas pu être vérifié. Les données existantes sont conservées.'],
  '저장된 카피 미리보기의 계정이 일치하지 않아요.': ['The saved copy preview belongs to a different account.', '保存されたコピープレビューのアカウントが一致しません。', '已保存的跟单预览账户不匹配。', '已儲存的跟單預覽帳戶不符。', 'La vista previa guardada pertenece a otra cuenta.', 'L’aperçu de copie enregistré appartient à un autre compte.'],
  '이 브라우저에서 카피 미리보기를 저장할 수 없어요.': ['This browser cannot save the copy preview.', 'このブラウザではコピープレビューを保存できません。', '此浏览器无法保存跟单预览。', '此瀏覽器無法儲存跟單預覽。', 'Este navegador no puede guardar la vista previa de copia.', 'Ce navigateur ne peut pas enregistrer l’aperçu de copie.'],
  '카피 미리보기를 불러오지 못했어요. 다시 시도해주세요.': ['Could not load the copy preview. Try again.', 'コピープレビューを読み込めませんでした。もう一度お試しください。', '无法加载跟单预览，请重试。', '無法載入跟單預覽，請重試。', 'No se pudo cargar la vista previa de copia. Inténtalo de nuevo.', 'Impossible de charger l’aperçu de copie. Réessayez.'],
  '카피 미리보기를 저장하지 못했어요. 다시 시도해주세요.': ['Could not save the copy preview. Try again.', 'コピープレビューを保存できませんでした。もう一度お試しください。', '无法保存跟单预览，请重试。', '無法儲存跟單預覽，請重試。', 'No se pudo guardar la vista previa de copia. Inténtalo de nuevo.', 'Impossible d’enregistrer l’aperçu de copie. Réessayez.'],
  '카피 미리보기의 저장 결과를 확인하지 못했어요. 다시 불러와 확인해주세요.': ['Could not verify whether the copy preview was saved. Reload it to check.', 'コピープレビューの保存結果を確認できませんでした。再読み込みして確認してください。', '无法确认跟单预览的保存结果，请重新加载后检查。', '無法確認跟單預覽的儲存結果，請重新載入後檢查。', 'No se pudo verificar si se guardó la vista previa. Vuelve a cargarla para comprobarlo.', 'Impossible de vérifier si l’aperçu a été enregistré. Rechargez-le pour vérifier.'],
  '최소 50': ['Minimum 50', '最低50', '最低 50', '最低 50', 'Mínimo 50', 'Minimum 50'],
  '금액': ['Amount', '金額', '金额', '金額', 'Importe', 'Montant'],
  '최대': ['Max', '最大', '最大', '最大', 'Máx.', 'Max.'],
  '0보다 큰 금액을 입력해주세요': ['Enter an amount greater than 0', '0より大きい金額を入力してください', '请输入大于 0 的金额', '請輸入大於 0 的金額', 'Introduce un importe mayor que 0', 'Saisissez un montant supérieur à 0'],
  '스팟 잔고보다 커요': ['Exceeds your spot balance', '現物残高を超えています', '超过现货余额', '超過現貨餘額', 'Supera tu saldo spot', 'Dépasse votre solde spot'],
  '출금 가능 금액을 넘었어요': ['Exceeds the available withdrawal amount', '出金可能額を超えています', '超过可提现金额', '超過可提領金額', 'Supera el importe disponible para retirar', 'Dépasse le montant disponible au retrait'],
  '잠깐, 손실 구간이에요': ['Pause: this copy is at a loss', '現在は損失が出ています', '请注意，当前处于亏损', '請注意，目前處於虧損', 'Atención: esta copia está en pérdidas', 'Attention : cette copie est en perte'],
  '잔고 조정, {nick}': ['Adjust balance, {nick}', '残高調整、{nick}', '调整余额，{nick}', '調整餘額，{nick}', 'Ajustar saldo, {nick}', 'Ajuster le solde, {nick}'],
  '카피 설정, {nick}': ['Copy settings, {nick}', 'コピー設定、{nick}', '跟单设置，{nick}', '跟單設定，{nick}', 'Ajustes de copia, {nick}', 'Paramètres de copie, {nick}'],
  '따라갈 페어: ': ['Pairs to copy: ', 'コピーするペア: ', '跟随交易对：', '跟隨交易對：', 'Pares a copiar: ', 'Paires à copier : '],
  '모드와 카피 금액 변경은 카피를 종료한 뒤 다시 시작할 때 고를 수 있어요.': ['To change the mode or copy amount, stop this copy and start again.', 'モードとコピー金額は、コピーを終了して再開する際に変更できます。', '如需更改模式和跟单金额，请结束跟单后重新开始。', '如需更改模式和跟單金額，請結束跟單後重新開始。', 'Para cambiar el modo o el importe, detén esta copia y vuelve a iniciarla.', 'Pour modifier le mode ou le montant, arrêtez cette copie puis relancez-la.'],
  '잔고는 잔고 조정에서 언제든 바꿀 수 있어요.': ['You can change the balance at any time under Adjust balance.', '残高は「残高調整」でいつでも変更できます。', '可随时通过调整余额更改余额。', '可隨時透過調整餘額更改餘額。', 'Puedes cambiar el saldo cuando quieras desde Ajustar saldo.', 'Vous pouvez modifier le solde à tout moment via Ajuster le solde.'],
  '닫기': ['Close', '閉じる', '关闭', '關閉', 'Cerrar', 'Fermer'],
  '잔고 조정 열기': ['Open balance adjustment', '残高調整を開く', '打开余额调整', '開啟餘額調整', 'Abrir ajuste de saldo', 'Ouvrir l’ajustement du solde'],
  '지금 손실 구간이에요. 추가 입금은 평균 단가를 낮추지만 위험도 같이 커져요. 금액을 늘리기 전에 전략 자체를 다시 점검해보세요.': ['This copy is at a loss. Adding funds lowers the average entry price but also increases risk. Review the strategy before increasing the amount.', '現在は損失が出ています。追加入金は平均取得単価を下げますが、リスクも高まります。金額を増やす前に戦略を再確認しましょう。', '当前处于亏损。追加资金会降低平均成本，但也会增加风险。增加金额前，请重新审视策略。', '目前處於虧損。追加資金會降低平均成本，但也會增加風險。增加金額前，請重新檢視策略。', 'Esta copia está en pérdidas. Añadir fondos reduce el precio medio de entrada, pero aumenta el riesgo. Revisa la estrategia antes de aumentar el importe.', 'Cette copie est en perte. Ajouter des fonds réduit le prix d’entrée moyen mais accroît le risque. Réexaminez la stratégie avant d’augmenter le montant.'],
  '{amount}를 추가할까요?': ['Add {amount}?', '{amount}を追加しますか？', '追加 {amount}？', '追加 {amount}？', '¿Añadir {amount}?', 'Ajouter {amount} ?'],
  '이 카피의 현재 수익률 ': ['Current return on this copy ', 'このコピーの現在の収益率 ', '此跟单当前收益率 ', '此跟單目前報酬率 ', 'Rentabilidad actual de esta copia ', 'Rendement actuel de cette copie '],
  '잔고 조정 방식': ['Balance adjustment type', '残高調整方法', '余额调整方式', '餘額調整方式', 'Tipo de ajuste de saldo', 'Type d’ajustement du solde'],
  '추가 입금': ['Add funds', '追加入金', '追加资金', '追加資金', 'Añadir fondos', 'Ajouter des fonds'],
  '출금': ['Withdraw', '出金', '提现', '提領', 'Retirar', 'Retirer'],
  '조정 금액': ['Adjustment amount', '調整金額', '调整金额', '調整金額', 'Importe del ajuste', 'Montant de l’ajustement'],
  '추가 가능 (스팟 잔고)': ['Available to add (spot balance)', '追加可能額（現物残高）', '可追加（现货余额）', '可追加（現貨餘額）', 'Disponible para añadir (saldo spot)', 'Disponible à ajouter (solde spot)'],
  '출금 가능': ['Available to withdraw', '出金可能額', '可提现', '可提領', 'Disponible para retirar', 'Disponible au retrait'],
  '스팟 계좌에서 카피 계좌로 옮겨져요. 추가한 금액은 다음 진입부터 반영돼요.': ['Funds move from your spot account to the copy account. The added amount applies from the next entry.', '現物口座からコピー口座へ移動します。追加額は次のエントリーから反映されます。', '资金从现货账户转入跟单账户，追加金额从下次开仓起生效。', '資金從現貨帳戶轉入跟單帳戶，追加金額從下次開倉起生效。', 'Los fondos pasan de la cuenta spot a la de copia. El importe añadido se aplica desde la próxima entrada.', 'Les fonds passent du compte spot au compte de copie. Le montant ajouté s’applique dès la prochaine entrée.'],
  '카피 계좌에서 스팟 계좌로 옮겨져요. 포지션에 잡혀 있는 금액은 출금할 수 없어요.': ['Funds move from the copy account to your spot account. Funds held in positions cannot be withdrawn.', 'コピー口座から現物口座へ移動します。ポジションに拘束された金額は出金できません。', '资金从跟单账户转入现货账户，持仓占用的金额不可提现。', '資金從跟單帳戶轉入現貨帳戶，持倉占用的金額不可提領。', 'Los fondos pasan de la cuenta de copia a la spot. No puedes retirar fondos retenidos en posiciones.', 'Les fonds passent du compte de copie au compte spot. Les montants engagés dans des positions ne peuvent pas être retirés.'],
  '다시 생각할게요': ['Let me reconsider', '考え直す', '再考虑一下', '再考慮一下', 'Voy a reconsiderarlo', 'Je vais reconsidérer'],
  '취소': ['Cancel', 'キャンセル', '取消', '取消', 'Cancelar', 'Annuler'],
  '{amount} 추가할게요': ['Add {amount}', '{amount}を追加する', '追加 {amount}', '追加 {amount}', 'Añadir {amount}', 'Ajouter {amount}'],
  '확인': ['Confirm', '確認', '确认', '確認', 'Confirmar', 'Confirmer'],
  '열려 있는 카피 포지션을 현재가로 정리해요.': ['Close open copy positions at the current price.', '保有中のコピーポジションを現在価格で決済します。', '以当前价格平掉跟单持仓。', '以目前價格平掉跟單持倉。', 'Cierra las posiciones copiadas abiertas al precio actual.', 'Fermez les positions copiées ouvertes au cours actuel.'],
  '미실현 {amount}이 실현 손익으로 확정되고, 카피는 유지되어 다음 진입부터 다시 따라가요.': ['Unrealized P&L of {amount} becomes realized. Copying stays active and resumes with the next entry.', '未実現損益{amount}が実現損益として確定します。コピーは継続し、次のエントリーから再び追従します。', '未实现盈亏 {amount} 将转为已实现盈亏，跟单保持开启，从下次开仓起继续跟随。', '未實現損益 {amount} 將轉為已實現損益，跟單保持開啟，從下次開倉起繼續跟隨。', 'Las PyG no realizadas de {amount} se realizan. La copia sigue activa y se reanuda con la próxima entrada.', 'Le P&L latent de {amount} devient réalisé. La copie reste active et reprend à la prochaine entrée.'],
  '{nick} 님 카피를 종료할까요?': ['Stop copying {nick}?', '{nick}さんのコピーを終了しますか？', '结束跟随 {nick}？', '結束跟隨 {nick}？', '¿Dejar de copiar a {nick}?', 'Arrêter de copier {nick} ?'],
  '보유 중인 카피 포지션을 현재가로 정리하고, 정산된 금액을 스팟 계좌로 돌려드려요.': ['Open copy positions are closed at the current price and the settled amount is returned to your spot account.', '保有中のコピーポジションを現在価格で決済し、精算額を現物口座に返還します。', '将以当前价格平掉跟单持仓，并将结算金额退回现货账户。', '將以目前價格平掉跟單持倉，並將結算金額退回現貨帳戶。', 'Las posiciones copiadas se cierran al precio actual y el importe liquidado vuelve a tu cuenta spot.', 'Les positions copiées sont fermées au cours actuel et le montant réglé revient sur votre compte spot.'],
  '정리 후 순손익': ['Net P&L after closing', '決済後の純損益', '平仓后净盈亏', '平倉後淨損益', 'PyG netas tras el cierre', 'P&L net après clôture'],
  '정리 후 수익 분배 지급': ['Profit sharing paid after closing', '決済後の利益分配支払額', '平仓后已付分润', '平倉後已付分潤', 'Reparto pagado tras el cierre', 'Partage versé après clôture'],
  '정리 후 평가 금액': ['Equity after closing', '決済後の評価額', '平仓后权益', '平倉後權益', 'Patrimonio tras el cierre', 'Valeur totale après clôture'],
  '계속 카피': ['Keep copying', 'コピーを続ける', '继续跟单', '繼續跟單', 'Seguir copiando', 'Continuer à copier'],
  '정리하기': ['Close positions', '決済する', '平仓', '平倉', 'Cerrar posiciones', 'Fermer les positions'],
  '종료하고 정산': ['Stop and settle', '終了して精算', '结束并结算', '結束並結算', 'Detener y liquidar', 'Arrêter et régler'],
} as const satisfies Record<string, readonly [string, string, string, string, string, string]>
export type CopyActionKey = keyof typeof actionLabels | CopySummaryKey
export function copyActionText(language: ClientLanguage, key: CopyActionKey, values: Record<string, string | number> = {}): string {
  if (Object.hasOwn(summaryLabels, key)) return copySummaryText(language, key as CopySummaryKey, values)
  const index = languages.indexOf(language)
  const text = index <= 0 ? key : actionLabels[key as keyof typeof actionLabels][index - 1]
  return text.replace(/\{(\w+)\}/g, (placeholder, name: string) => Object.hasOwn(values, name) ? String(values[name]) : placeholder)
}

/** Translate only known preview errors. Preserve unknown sanitized caller messages. */
export function copyActionError(language: ClientLanguage, message: string): string {
  if (Object.hasOwn(actionLabels, message) || Object.hasOwn(summaryLabels, message)) return copyActionText(language, message as CopyActionKey)
  const withoutPeriod = message.endsWith('.') ? message.slice(0, -1) : message
  if (Object.hasOwn(actionLabels, withoutPeriod) || Object.hasOwn(summaryLabels, withoutPeriod)) return `${copyActionText(language, withoutPeriod as CopyActionKey)}.`
  return message
}
