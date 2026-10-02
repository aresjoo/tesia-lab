import type { ClientLanguage } from './client-preferences'

// Presentation only; the original Korean copy and attachment names stay intact.
type Translations = readonly [string, string, string, string, string, string, string]
const languages: readonly ClientLanguage[] = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']
const copy = {
  imageOnly: ['이미지 파일만 첨부할 수 있어요', 'You can only attach image files', '画像ファイルのみ添付できます', '只能附加图片文件', '只能附加圖片檔案', 'Solo puedes adjuntar archivos de imagen', 'Vous ne pouvez joindre que des fichiers image'],
  tooLarge: ['10MB 이하 이미지만 첨부할 수 있어요', 'You can only attach images of 10MB or less', '10MB以下の画像のみ添付できます', '只能附加 10MB 以内的图片', '只能附加 10MB 以內的圖片', 'Solo puedes adjuntar imágenes de 10MB o menos', 'Vous ne pouvez joindre que des images de 10MB ou moins'],
  attachmentAlt: ['첨부된 스크린샷', 'Attached screenshot', '添付されたスクリーンショット', '已附加的屏幕截图', '已附加的螢幕截圖', 'Captura de pantalla adjunta', "Capture d'écran jointe"],
  removeAttachment: ['첨부 제거', 'Remove attachment', '添付を削除', '移除附件', '移除附件', 'Quitar el adjunto', 'Retirer la pièce jointe'],
  unavailable: ['이 화면에서는 아직 전송이 연결되지 않았어요. 작성한 내용은 서버로 보내거나 저장하지 않습니다.', "Sending isn't connected on this screen yet. What you write is not sent to a server or stored.", 'この画面では送信がまだ接続されていません。入力内容はサーバーに送信も保存もされません。', '此界面尚未接入发送功能。你输入的内容不会发送到服务器，也不会被保存。', '此畫面尚未接上傳送功能。你輸入的內容不會傳送到伺服器，也不會被儲存。', 'El envío todavía no está conectado en esta pantalla. Lo que escribas no se envía a ningún servidor ni se guarda.', "L'envoi n'est pas encore connecté sur cet écran. Ce que vous écrivez n'est ni envoyé à un serveur ni conservé."],
} as const satisfies Record<string, Translations>
export function feedbackText(language: ClientLanguage, key: keyof typeof copy): string {
  return copy[key][languages.indexOf(language)]
}
