import type { ClientLanguage } from './client-preferences'

const rows = {
  devicesTitle: ['로그인한 기기', 'Signed-in devices', 'ログイン中の端末', '已登录设备', '已登入裝置', 'Dispositivos conectados', 'Appareils connectés'],
  otherDevicesTitle: ['다른 모든 기기', 'All other devices', '他のすべての端末', '其他所有设备', '其他所有裝置', 'Todos los demás dispositivos', 'Tous les autres appareils'],
  otherDevicesHint: ['이 기기의 로그인은 유지합니다.', 'This device stays signed in.', 'この端末のログインは維持されます。', '此设备将保持登录。', '此裝置會保持登入。', 'Este dispositivo seguirá conectado.', 'Cet appareil reste connecté.'],
  logoutAll: ['모두 로그아웃', 'Sign out all', 'すべてログアウト', '全部退出', '全部登出', 'Cerrar todas las sesiones', 'Tout déconnecter'],
  exchangesTitle: ['거래소 연결', 'Exchange connections', '取引所接続', '交易所连接', '交易所連線', 'Conexiones de exchanges', 'Connexions aux plateformes'],
  connectExchange: ['거래소 연결', 'Connect exchange', '取引所を接続', '连接交易所', '連接交易所', 'Conectar exchange', 'Connecter une plateforme'],
  disconnectExchange: ['연결 끊기', 'Disconnect', '接続を解除', '断开连接', '中斷連線', 'Desconectar', 'Déconnecter'],
  emptyExchangeHint: ['연결하면 거래소마다 허용한 권한이 여기에 보입니다.', 'Permissions allowed for each exchange appear here after connection.', '接続すると各取引所で許可した権限がここに表示されます。', '连接后，这里会显示各交易所允许的权限。', '連接後，這裡會顯示各交易所允許的權限。', 'Aquí se muestran los permisos de cada exchange tras conectarlo.', 'Les autorisations de chaque plateforme apparaissent ici après connexion.'],
  logoutDeviceTitle: ['{label}에서 로그아웃하시겠습니까?', 'Sign out of {label}?', '{label}からログアウトしますか？', '退出{label}？', '登出{label}？', '¿Cerrar sesión en {label}?', 'Déconnecter {label} ?'],
  logoutDeviceHint: ['이 기기의 로그인은 유지합니다.', 'This device stays signed in.', 'この端末のログインは維持されます。', '此设备将保持登录。', '此裝置會保持登入。', 'Este dispositivo seguirá conectado.', 'Cet appareil reste connecté.'],
  disconnectTitle: ['{label} 연결을 끊으시겠습니까?', 'Disconnect {label}?', '{label}との接続を解除しますか？', '断开与{label}的连接？', '中斷與{label}的連線？', '¿Desconectar {label}?', 'Déconnecter {label} ?'],
  disconnectHint: ['이 거래소에서 돌아가는 전략은 새 주문을 내지 않습니다. 열려 있는 포지션은 거래소에 그대로 남습니다.', 'Strategies on this exchange will place no new orders. Open positions remain on the exchange.', 'この取引所の戦略は新しい注文を出しません。保有ポジションは取引所に残ります。', '此交易所上的策略将不再发出新订单。未平仓头寸仍留在交易所。', '此交易所上的策略將不再送出新訂單。未平倉部位仍留在交易所。', 'Las estrategias de este exchange no enviarán nuevas órdenes. Las posiciones abiertas permanecerán en el exchange.', 'Les stratégies de cette plateforme ne passeront plus de nouveaux ordres. Les positions ouvertes y resteront.'],
  currentDevice: ['이 기기', 'This device', 'この端末', '此设备', '此裝置', 'Este dispositivo', 'Cet appareil'],
  noDevices: ['로그인된 기기가 없습니다', 'No signed-in devices', 'ログイン中の端末はありません', '没有已登录设备', '沒有已登入裝置', 'No hay dispositivos conectados', 'Aucun appareil connecté'],
  noPermissions: ['연결된 거래소가 없습니다', 'No connected exchanges', '接続済みの取引所はありません', '没有已连接的交易所', '沒有已連接的交易所', 'No hay exchanges conectados', 'Aucune plateforme connectée'],
  on: ['켜짐', 'On', 'オン', '已开启', '已開啟', 'Activada', 'Activée'],
  off: ['꺼짐', 'Off', 'オフ', '已关闭', '已關閉', 'Desactivada', 'Désactivée'],
  enable: ['2단계 인증을 켜시겠습니까?', 'Enable two-factor authentication?', '2段階認証を有効にしますか？', '开启两步验证？', '開啟兩步驟驗證？', '¿Activar la autenticación en dos pasos?', 'Activer l’authentification à deux facteurs ?'],
  disable: ['2단계 인증을 끄시겠습니까?', 'Disable two-factor authentication?', '2段階認証を無効にしますか？', '关闭两步验证？', '關閉兩步驟驗證？', '¿Desactivar la autenticación en dos pasos?', 'Désactiver l’authentification à deux facteurs ?'],
  logoutTitle: ['다른 기기를 모두 로그아웃하시겠습니까?', 'Sign out all other devices?', '他のすべての端末からログアウトしますか？', '退出其他所有设备？', '登出其他所有裝置？', '¿Cerrar sesión en los demás dispositivos?', 'Déconnecter tous les autres appareils ?'],
  requestHint: ['변경을 요청합니다. 확인된 상태는 서버 응답에 따라 표시됩니다.', 'Request a change. Confirmed status is shown from the server response.', '変更をリクエストします。確認済みの状態はサーバーの応答に基づき表示されます。', '提交更改请求。确认状态将根据服务器响应显示。', '提交變更請求。確認狀態將依伺服器回應顯示。', 'Solicite el cambio. El estado confirmado depende de la respuesta del servidor.', 'Demandez la modification. L’état confirmé dépend de la réponse du serveur.'],
  confirm: ['확인', 'Confirm', '確認', '确认', '確認', 'Confirmar', 'Confirmer'],
  working: ['요청을 처리하고 있습니다', 'Processing your request', 'リクエストを処理中です', '正在处理请求', '正在處理請求', 'Procesando la solicitud', 'Traitement de la demande'],
  failed: ['변경 결과를 확인하지 못했습니다. 현재 상태를 확인한 뒤 다시 시도해 주십시오.', 'Could not confirm the outcome. Check the current status before trying again.', '結果を確認できませんでした。現在の状態を確認してから再度お試しください。', '无法确认结果。请检查当前状态后重试。', '無法確認結果。請檢查目前狀態後重試。', 'No se pudo confirmar el resultado. Compruebe el estado antes de volver a intentarlo.', 'Le résultat n’a pas pu être confirmé. Vérifiez l’état actuel avant de réessayer.'],
  passwordTitle: ['비밀번호 변경', 'Change password', 'パスワード変更', '更改密码', '變更密碼', 'Cambiar contraseña', 'Modifier le mot de passe'],
  currentPassword: ['지금 비밀번호', 'Current password', '現在のパスワード', '当前密码', '目前密碼', 'Contraseña actual', 'Mot de passe actuel'],
  newPassword: ['새 비밀번호', 'New password', '新しいパスワード', '新密码', '新密碼', 'Nueva contraseña', 'Nouveau mot de passe'],
  confirmPassword: ['새 비밀번호 확인', 'Confirm new password', '新しいパスワードの確認', '确认新密码', '確認新密碼', 'Confirmar nueva contraseña', 'Confirmer le nouveau mot de passe'],
  currentRequired: ['지금 비밀번호를 입력해 주십시오', 'Enter your current password.', '現在のパスワードを入力してください', '请输入当前密码', '請輸入目前密碼', 'Introduzca su contraseña actual.', 'Saisissez votre mot de passe actuel.'],
  passwordRequired: ['새 비밀번호를 입력해 주십시오', 'Enter a new password.', '新しいパスワードを入力してください', '请输入新密码', '請輸入新密碼', 'Introduzca una nueva contraseña.', 'Saisissez un nouveau mot de passe.'],
  mismatch: ['새 비밀번호가 서로 다릅니다', 'The new passwords do not match.', '新しいパスワードが一致しません', '新密码不一致', '新密碼不一致', 'Las nuevas contraseñas no coinciden.', 'Les nouveaux mots de passe ne correspondent pas.'],
  same: ['지금 비밀번호와 다른 것을 써 주십시오', 'Use a different password from your current one.', '現在とは異なるパスワードを入力してください', '请使用与当前密码不同的密码', '請使用與目前密碼不同的密碼', 'Use una contraseña distinta de la actual.', 'Utilisez un mot de passe différent de l’actuel.'],
} as const
const languages: readonly ClientLanguage[] = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']
export function securityText(language: ClientLanguage, key: keyof typeof rows): string {
  return rows[key][languages.indexOf(language)] ?? rows[key][0]
}
