import type { ClientLanguage } from './client-preferences'
const mandatory = ['결제와 보안 알림은 이메일로 항상 보냅니다', 'Billing and security notifications are always sent by email.', '決済とセキュリティの通知は常にメールで送信されます。', '账单和安全通知始终通过电子邮件发送。', '帳單和安全通知一律以電子郵件寄送。', 'Las notificaciones de facturación y seguridad se envían siempre por correo.', 'Les notifications de facturation et de sécurité sont toujours envoyées par e-mail.'] as const
const languages: readonly ClientLanguage[] = ['ko','en','ja','zh-CN','zh-TW','es','fr']
const group = ['{topic} 알림', '{topic} notifications', '{topic}の通知', '{topic}通知', '{topic}通知', 'Notificaciones: {topic}', 'Notifications : {topic}'] as const
export function notificationGroupText(language: ClientLanguage, topic: string) { return group[languages.indexOf(language)].replace('{topic}', () => topic) }
export function notificationMandatoryText(language: ClientLanguage) { return mandatory[languages.indexOf(language)] ?? mandatory[0] }
