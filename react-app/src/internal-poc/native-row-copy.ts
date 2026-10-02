import type { ClientLanguage } from '../client-preferences'
const columns = { ko: 0, en: 1, ja: 2, 'zh-CN': 3, 'zh-TW': 4, es: 5, fr: 6 } as const
const copy = {
  edit: ['수정 요청', 'Request a change', '変更を依頼', '请求修改', '請求修改', 'Solicitar cambio', 'Demander une modification'],
  comment: ['코멘트', 'Comment', 'コメント', '备注', '備註', 'Comentario', 'Commentaire'],
  placeholder: ['수정 요청, 예: -2%로', 'Request a change, e.g. to -2%', '変更内容、例：-2%に', '修改请求，例如改为 -2%', '修改請求，例如改為 -2%', 'Cambio, p. ej. a -2%', 'Modification, par ex. à -2 %'],
  apply: ['적용', 'Apply', '適用', '应用', '套用', 'Aplicar', 'Appliquer'],
  cancel: ['취소', 'Cancel', 'キャンセル', '取消', '取消', 'Cancelar', 'Annuler'],
  previous: ['이전 행의 수정 요청', 'Requests for previous rows', '以前の行への変更依頼', '先前行的修改请求', '先前列的修改請求', 'Solicitudes de filas anteriores', 'Demandes pour les lignes précédentes'],
  tooLong: ['행 이름을 포함해 4000자 이내로 입력해주세요. 원문은 유지했습니다.', 'Use at most 4000 characters including the row name. Your text is preserved.', '行名を含め4000文字以内で入力してください。入力内容は保持しています。', '包括行名称在内，请不超过4000字符。原文已保留。', '包括行名稱在內，請勿超過4000字元。原文已保留。', 'Máximo 4000 caracteres, incluido el nombre de la fila. Su texto se conserva.', '4000 caractères maximum, nom de ligne compris. Votre texte est conservé.'],
  sending: ['수정 요청을 보내는 중…', 'Sending your change request…', '変更依頼を送信中…', '正在发送修改请求…', '正在傳送修改請求…', 'Enviando la solicitud…', 'Envoi de la demande…'],
  uncertain: ['응답을 확인하지 못했습니다. 대화에서 같은 요청으로 재개해주세요.', 'Response unconfirmed. Resume the same request in the conversation.', '応答を確認できません。会話で同じ依頼を再開してください。', '未确认响应。请在对话中恢复同一请求。', '未確認回應。請在對話中恢復同一請求。', 'Respuesta sin confirmar. Reanude la misma solicitud en la conversación.', 'Réponse non confirmée. Reprenez la même demande dans la conversation.'],
  notSent: ['전송하지 못했습니다. 작성 내용은 유지했습니다.', 'Not sent. Your text has been preserved.', '送信できませんでした。入力内容は保持しています。', '未能发送。输入内容已保留。', '未能傳送。輸入內容已保留。', 'No se envió. Su texto se ha conservado.', 'Non envoyé. Votre texte est conservé.'],
  applied: ['서버 초안을 갱신했습니다. 변경된 조건을 확인해주세요.', 'Server draft updated. Review the returned conditions.', 'サーバーのドラフトを更新しました。条件を確認してください。', '服务器草稿已更新。请检查返回的条件。', '伺服器草稿已更新。請檢查傳回的條件。', 'Borrador del servidor actualizado. Revise las condiciones.', 'Brouillon du serveur mis à jour. Vérifiez les conditions.'],
  clarification: ['추가 확인이 필요합니다. 아래 질문을 확인해주세요.', 'More information is needed. Review the question below.', '追加の確認が必要です。下の質問を確認してください。', '需要补充信息。请查看下方问题。', '需要補充資訊。請查看下方問題。', 'Se necesita más información. Revise la pregunta.', 'Des précisions sont nécessaires. Consultez la question.'],
  unsupported: ['지원하지 않는 조건이 있습니다. 대화에서 응답을 확인해주세요.', 'Some conditions are unsupported. Check the response in the conversation.', '未対応の条件があります。会話で応答を確認してください。', '存在不支持的条件。请在对话中查看响应。', '存在不支援的條件。請在對話中查看回應。', 'Hay condiciones no admitidas. Consulte la respuesta en la conversación.', 'Certaines conditions ne sont pas prises en charge. Consultez la réponse dans la conversation.'],
  rejected: ['초안 변경이 반영되지 않았습니다. 대화에서 사유를 확인해주세요.', 'The draft change was rejected. Check the reason in the conversation.', '変更は反映されませんでした。会話で理由を確認してください。', '草稿修改被拒绝。请在对话中查看原因。', '草稿修改遭拒。請在對話中查看原因。', 'El cambio fue rechazado. Consulte el motivo en la conversación.', 'Modification refusée. Consultez le motif dans la conversation.'],
  proposed: ['변경 제안을 받았습니다. 초안 반영은 확인되지 않았습니다.', 'Change proposal received. Draft application is not confirmed.', '変更提案を受信しました。反映は確認されていません。', '已收到修改建议。尚未确认草稿应用。', '已收到修改建議。尚未確認草稿套用。', 'Propuesta recibida. No se ha confirmado su aplicación.', 'Proposition reçue. Son application au brouillon n’est pas confirmée.'],
  stale: ['초안이 변경되었습니다. 현재 조건을 확인하고 수정 내용을 다시 입력해주세요.', 'The draft changed. Review the current conditions and re-enter your request.', 'ドラフトが変更されました。現在の条件を確認し、依頼を入力し直してください。', '草稿已更改。请检查当前条件并重新输入请求。', '草稿已變更。請檢查目前條件並重新輸入請求。', 'El borrador cambió. Revise las condiciones y vuelva a escribir la solicitud.', 'Le brouillon a changé. Vérifiez les conditions et saisissez à nouveau la demande.'],
} as const satisfies Record<string, readonly [string, string, string, string, string, string, string]>
export const nativeRowText = (language: ClientLanguage, key: keyof typeof copy) => copy[key][columns[language]]
