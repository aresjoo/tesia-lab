import type { ClientLanguage } from '../client-preferences'

const messages = {
  ko: ['거래소 계정 연결', '거래소에서 로그인하고 권한에 동의하면 연결 결과를 확인할 수 있습니다.', '거래소 연결 확인 중', '연결 결과를 확인하고 있습니다.', '거래소 계정 연결 완료', '연결된 계정을 확인했습니다.', '연결을 완료하지 못했습니다. 다시 시도해주세요.', '다른 거래소 연결', '연결 해제', '다시 확인', '연결 취소', '거래소', '계정', '거래 권한 확인 대기', '출금 권한 없음', 'TETH에 로그인한 뒤 거래소를 연결해주세요.'],
  en: ['Connect an exchange account', 'Sign in at the exchange and approve access to view the connection result.', 'Checking exchange connection', 'Checking the connection result.', 'Exchange account connected', 'Your connected account has been confirmed.', 'The connection could not be completed. Please try again.', 'Connect another exchange', 'Disconnect', 'Check again', 'Cancel connection', 'Exchange', 'Account', 'Trading permissions awaiting verification', 'No withdrawal permission', 'Sign in to TETH before connecting an exchange.'],
  ja: ['取引所アカウントを接続', '取引所でログインして権限に同意すると、接続結果を確認できます。', '取引所の接続を確認中', '接続結果を確認しています。', '取引所アカウント接続完了', '接続されたアカウントを確認しました。', '接続を完了できませんでした。もう一度お試しください。', '別の取引所を接続', '接続解除', '再確認', '接続をキャンセル', '取引所', 'アカウント', '取引権限の確認待ち', '出金権限なし', 'TETHにログインしてから取引所を接続してください。'],
  'zh-CN': ['连接交易所账户', '在交易所登录并同意授权后即可查看连接结果。', '正在检查交易所连接', '正在检查连接结果。', '交易所账户已连接', '已确认连接的账户。', '无法完成连接，请重试。', '连接其他交易所', '断开连接', '再次检查', '取消连接', '交易所', '账户', '交易权限等待验证', '无提现权限', '请先登录TETH，再连接交易所。'],
  'zh-TW': ['連接交易所帳戶', '在交易所登入並同意授權後即可查看連接結果。', '正在檢查交易所連接', '正在檢查連接結果。', '交易所帳戶已連接', '已確認連接的帳戶。', '無法完成連接，請重試。', '連接其他交易所', '中斷連接', '再次檢查', '取消連接', '交易所', '帳戶', '交易權限等待驗證', '無提領權限', '請先登入TETH，再連接交易所。'],
  es: ['Conectar una cuenta del exchange', 'Inicia sesión en el exchange y autoriza el acceso para ver el resultado.', 'Comprobando la conexión', 'Comprobando el resultado de la conexión.', 'Cuenta del exchange conectada', 'Se confirmó la cuenta conectada.', 'No se pudo completar la conexión. Inténtalo de nuevo.', 'Conectar otro exchange', 'Desconectar', 'Comprobar de nuevo', 'Cancelar conexión', 'Exchange', 'Cuenta', 'Permisos de trading pendientes de verificación', 'Sin permiso de retiro', 'Inicia sesión en TETH antes de conectar un exchange.'],
  fr: ['Connecter un compte de plateforme', 'Connectez-vous à la plateforme et autorisez l’accès pour voir le résultat.', 'Vérification de la connexion', 'Vérification du résultat de la connexion.', 'Compte de plateforme connecté', 'Le compte connecté a été confirmé.', 'La connexion n’a pas pu être établie. Veuillez réessayer.', 'Connecter une autre plateforme', 'Déconnecter', 'Vérifier à nouveau', 'Annuler la connexion', 'Plateforme', 'Compte', 'Autorisations de trading en attente de vérification', 'Aucune autorisation de retrait', 'Connectez-vous à TETH avant de connecter une plateforme.'],
} as const
const extra = {
  ko: ['접근 권한', '조회', '현물 거래', '선물 거래', '출금', '요청하지 않음 · 실제 권한 확인 전', 'TETH의 연결 정보를 삭제했습니다. 거래소에서도 해당 API 키를 삭제해주세요.', '이번 연결 시도에서 TETH용 API 키가 생성되었다면 거래소에서 해당 키를 삭제해주세요.'],
  en: ['Access permissions', 'Read', 'Spot trading', 'Futures trading', 'Withdrawal', 'Not requested · actual permissions unverified', 'The connection was removed from TETH. Delete the API key at the exchange as well.', 'If this attempt created a TETH API key, delete that key at the exchange.'],
  ja: ['アクセス権限', '参照', '現物取引', '先物取引', '出金', '未要求 · 実際の権限は未確認', 'TETHの接続情報を削除しました。取引所でも該当APIキーを削除してください。', '今回の接続でTETH用APIキーが作成された場合は取引所で削除してください。'],
  'zh-CN': ['访问权限', '查询', '现货交易', '合约交易', '提现', '未申请 · 实际权限未验证', '已删除TETH连接信息，请同时在交易所删除该API密钥。', '如果本次连接生成了TETH专用API密钥，请在交易所删除该密钥。'],
  'zh-TW': ['存取權限', '查詢', '現貨交易', '合約交易', '提領', '未申請 · 實際權限未驗證', '已刪除TETH連接資訊，請同時在交易所刪除該API金鑰。', '如果本次連接產生了TETH專用API金鑰，請在交易所刪除該金鑰。'],
  es: ['Permisos de acceso', 'Lectura', 'Trading spot', 'Trading de futuros', 'Retiro', 'No solicitado · permisos reales sin verificar', 'Se eliminó la conexión de TETH. Elimina también la clave API en el exchange.', 'Si este intento creó una clave API de TETH, elimínala en el exchange.'],
  fr: ['Autorisations d’accès', 'Lecture', 'Trading au comptant', 'Trading de contrats à terme', 'Retrait', 'Non demandé · autorisations réelles non vérifiées', 'La connexion a été supprimée de TETH. Supprimez aussi la clé API sur la plateforme.', 'Si cette tentative a créé une clé API TETH, supprimez-la sur la plateforme.'],
} as const
export type ExchangeCopyKey = 'title' | 'intro' | 'pendingTitle' | 'pending' | 'connectedTitle' | 'connected' | 'failed' | 'add' | 'disconnect' | 'refresh' | 'cancel' | 'exchange' | 'account' | 'permissions' | 'withdrawal' | 'login' | 'access' | 'read' | 'spot' | 'futures' | 'withdrawLabel' | 'unverifiedWithdrawal' | 'localRemoved' | 'cleanup'
const keys: readonly ExchangeCopyKey[] = ['title', 'intro', 'pendingTitle', 'pending', 'connectedTitle', 'connected', 'failed', 'add', 'disconnect', 'refresh', 'cancel', 'exchange', 'account', 'permissions', 'withdrawal', 'login']
const extraKeys: readonly ExchangeCopyKey[] = ['access', 'read', 'spot', 'futures', 'withdrawLabel', 'unverifiedWithdrawal', 'localRemoved', 'cleanup']
export function exchangeText(language: ClientLanguage, key: ExchangeCopyKey): string {
  const additional = extraKeys.indexOf(key)
  return additional >= 0 ? (extra[language] ?? extra.en)[additional] : (messages[language] ?? messages.en)[keys.indexOf(key)]
}
