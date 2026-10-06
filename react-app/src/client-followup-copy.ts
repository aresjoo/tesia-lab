import type { ClientLanguage } from './client-preferences'

const copy = {
  continue: ['이어서 계속','Continue','続ける','继续','繼續','Continuar','Continuer'],
  title: ['다음으로 이어가기','Continue the conversation','会話を続ける','继续对话','繼續對話','Continuar la conversación','Poursuivre la conversation'],
  free: ['무료, 즉시','Free, instantly','無料、すぐに','免费，即刻','免費，即刻','Gratis, al instante','Gratuit, immédiatement'],
  note: ['전략 초안과 검증은 무료예요. 실제 주문은 거래소 연결과 최종 확인 후에만 시작됩니다.','Strategy drafts and validation are free. Live orders start only after connecting an exchange and final confirmation.','戦略の下書きと検証は無料です。実際の注文は取引所接続と最終確認後にのみ開始されます。','策略草案和验证免费。实际订单仅在连接交易所并最终确认后启动。','策略草案和驗證免費。實際訂單僅在連接交易所並最終確認後啟動。','Los borradores y la validación son gratis. Las órdenes reales solo empiezan tras conectar una plataforma de intercambio y confirmar.','Les brouillons et la validation sont gratuits. Les ordres réels ne débutent qu’après la connexion à la plateforme et la confirmation finale.'],
  saved: ['조건 저장됨 ✓','Condition saved ✓','条件を保存しました ✓','条件已保存 ✓','條件已儲存 ✓','Condición guardada ✓','Condition enregistrée ✓'],
  pending: ['요청을 전달하는 중','Sending request','リクエスト送信中','正在发送请求','正在傳送請求','Enviando solicitud','Envoi de la demande'],
  failed: ['요청을 전달하지 못했습니다. 다시 시도해주세요.','Could not send the request. Please try again.','リクエストを送信できませんでした。再試行してください。','请求未能发送，请重试。','請求未能傳送，請重試。','No se pudo enviar la solicitud. Inténtalo de nuevo.','L’envoi a échoué. Réessayez.'],
  unavailable: ['현재 대화에서 이 작업을 진행할 수 없습니다.','This action is not available in this conversation.','この会話ではこの操作を実行できません。','当前对话无法执行此操作。','目前對話無法執行此操作。','Esta acción no está disponible en esta conversación.','Cette action n’est pas disponible dans cette conversation.'],
  busy: ['이전 답변을 마무리하는 중이에요, 끝나면 다시 눌러주세요','Wait for the current response to finish.','前の回答が完了してからお試しください。','请等待当前回复完成。','請等待目前回覆完成。','Espera a que termine la respuesta actual.','Attendez la fin de la réponse en cours.'],
} as const
const languages: readonly ClientLanguage[] = ['ko','en','ja','zh-CN','zh-TW','es','fr']
export function followupText(language: ClientLanguage, key: keyof typeof copy): string {
  return copy[key][languages.indexOf(language)]!
}
