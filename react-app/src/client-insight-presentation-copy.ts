import type { ClientLanguage } from './client-preferences'

/** Only new service-state copy. Source-authored article/UI copy is unchanged. */
export const insightPresentationCopy = {
  ko: { emptyArticles: '아직 게시된 인사이트가 없어요', shareUnavailable: '공유 주소가 아직 제공되지 않았습니다.', emailUnavailable: '이메일 미리보기가 아직 제공되지 않았습니다.', latestInsight: '최신 인사이트 보기', questionUnavailable: '질문 연결이 아직 제공되지 않았습니다. 작성한 내용은 유지됩니다.' },
  en: { emptyArticles: 'No insights have been published yet', shareUnavailable: 'A share link has not been provided yet.', emailUnavailable: 'An email preview has not been provided yet.', latestInsight: 'View the latest insight', questionUnavailable: 'The question connection is not available yet. Your draft is preserved.' },
  ja: { emptyArticles: 'まだ公開されたインサイトはありません', shareUnavailable: '共有リンクはまだ提供されていません。', emailUnavailable: 'メールのプレビューはまだ提供されていません。', latestInsight: '最新のインサイトを見る', questionUnavailable: '質問の接続先はまだ提供されていません。入力内容は保持されます。' },
  'zh-CN': { emptyArticles: '尚未发布洞察文章', shareUnavailable: '尚未提供分享链接。', emailUnavailable: '尚未提供邮件预览。', latestInsight: '查看最新洞察', questionUnavailable: '尚未提供提问连接。已保留你输入的内容。' },
  'zh-TW': { emptyArticles: '尚未發布洞察文章', shareUnavailable: '尚未提供分享連結。', emailUnavailable: '尚未提供郵件預覽。', latestInsight: '查看最新洞察', questionUnavailable: '尚未提供提問連接。已保留你輸入的內容。' },
  es: { emptyArticles: 'Todavía no se han publicado perspectivas', shareUnavailable: 'Todavía no se ha facilitado un enlace para compartir.', emailUnavailable: 'Todavía no se ha facilitado una vista previa del correo.', latestInsight: 'Ver la perspectiva más reciente', questionUnavailable: 'La conexión para enviar preguntas aún no está disponible. Tu borrador se conserva.' },
  fr: { emptyArticles: 'Aucune analyse n’a encore été publiée', shareUnavailable: 'Aucun lien de partage n’a encore été fourni.', emailUnavailable: 'Aucun aperçu de l’e-mail n’a encore été fourni.', latestInsight: 'Voir la dernière analyse', questionUnavailable: 'La connexion pour envoyer une question n’est pas encore disponible. Votre brouillon est conservé.' },
} satisfies Record<ClientLanguage, Record<'emptyArticles' | 'shareUnavailable' | 'emailUnavailable' | 'latestInsight' | 'questionUnavailable', string>>
