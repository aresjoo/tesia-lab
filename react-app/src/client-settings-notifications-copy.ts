import type { ClientLanguage } from './client-preferences'
const mandatory = ['결제와 보안 알림은 이메일로 항상 보냅니다', 'Billing and security notifications are always sent by email.', '決済とセキュリティの通知は常にメールで送信されます。', '账单和安全通知始终通过电子邮件发送。', '帳單和安全通知一律以電子郵件寄送。', 'Las notificaciones de facturación y seguridad se envían siempre por correo.', 'Les notifications de facturation et de sécurité sont toujours envoyées par e-mail.'] as const
const languages: readonly ClientLanguage[] = ['ko','en','ja','zh-CN','zh-TW','es','fr']
export function notificationMandatoryText(language: ClientLanguage) { return mandatory[languages.indexOf(language)] ?? mandatory[0] }
