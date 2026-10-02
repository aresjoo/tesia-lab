import type { ClientLanguage } from './client-preferences'

const copy = {
  singleDockNote: ['아래에서 골라 주십시오 ↓','Please choose below ↓','以下からお選びください ↓','请在下方选择 ↓','請在下方選擇 ↓','Elige una opción abajo ↓','Choisissez ci-dessous ↓'],
  freePlaceholder: ['직접 답을 적어 주십시오','Write your answer','回答を入力してください','请填写答案','請填寫答案','Escribe tu respuesta','Rédigez votre réponse'],
  confirm: ['확인','Confirm','確認','确认','確認','Confirmar','Confirmer'],
  nextShort: ['다음','Next','次へ','下一步','下一步','Siguiente','Suivant'],
  sendShort: ['보내기','Send','送信','发送','傳送','Enviar','Envoyer'],
  writeAnswer: ['답을 적어 주십시오','Please enter an answer.','回答を入力してください。','请填写答案。','請填寫答案。','Escribe una respuesta.','Veuillez saisir une réponse.'],
  tooLong: ['답변을 합쳐 1,000자 이내로 줄여 주세요. 입력은 유지됩니다.','Keep the combined answer within 1,000 characters. Your draft is kept.','回答全体を1,000文字以内にしてください。入力は保持されます。','请将答案总长度缩短到1,000字以内，输入会保留。','請將答案總長度縮短到1,000字以內，輸入會保留。','Reduce la respuesta a 1.000 caracteres. Se conserva el borrador.','Limitez la réponse à 1 000 caractères. Votre brouillon est conservé.'],
  dockNote: ['몇 가지만 여쭙겠습니다. 아래에서 {total}개에 답해 주십시오 ↓','Please answer {total} questions below ↓','以下の{total}問にお答えください ↓','请回答下面的{total}个问题 ↓','請回答下面的{total}個問題 ↓','Responde a las {total} preguntas de abajo ↓','Répondez aux {total} questions ci-dessous ↓'],
  previousNote: ['이전 질문','Earlier question','以前の質問','之前的问题','先前的問題','Pregunta anterior','Question précédente'],
  title: ['몇 가지만 확인할게요','A few quick questions','いくつか確認させてください','请确认几个问题','請確認幾個問題','Unas preguntas rápidas','Quelques précisions'],
  page: ['{total}개 중 {current}','{current} of {total}','{total}問中 {current}問目','第 {current} 项，共 {total} 项','第 {current} 項，共 {total} 項','{current} de {total}','{current} sur {total}'],
  previous: ['이전 질문','Previous question','前の質問','上一题','上一題','Pregunta anterior','Question précédente'],
  next: ['다음 질문','Next question','次の質問','下一题','下一題','Pregunta siguiente','Question suivante'],
  close: ['질문 카드 닫기','Close question card','質問カードを閉じる','关闭问题卡片','關閉問題卡片','Cerrar preguntas','Fermer les questions'],
  direct: ['직접 답변 작성','Write my own answer','自分で回答する','自行填写答案','自行填寫答案','Escribir mi respuesta','Rédiger ma réponse'],
  writePlaceholder: ['이 질문에 직접 답해주세요: {title}','Write your answer to: {title}','この質問に回答してください: {title}','请回答这个问题：{title}','請回答這個問題：{title}','Responde a esta pregunta: {title}','Répondez à cette question : {title}'],
  count: ['{count}개 선택됨','Selected: {count}','{count}個選択済み','已选择 {count} 项','已選擇 {count} 項','Seleccionadas: {count}','Sélections : {count}'],
  delegate: ['AI가 알아서 판단','Let AI decide','AIに判断を任せる','让 AI 判断','讓 AI 判斷','Dejar que la IA decida','Laisser l’IA décider'],
  continue: ['다음 →','Next →','次へ →','下一步 →','下一步 →','Siguiente →','Suivant →'],
  send: ['선택한 답변 전송','Send selected answers','選択した回答を送信','发送所选答案','傳送所選答案','Enviar respuestas','Envoyer les réponses'],
  pending: ['답변 전송 중','Sending answers','回答を送信中','正在发送答案','正在傳送答案','Enviando respuestas','Envoi des réponses'],
  choose: ['선택지를 하나 골라주세요. 애매하면 "AI가 알아서 판단"을 눌러도 됩니다','Choose an option, or let AI decide.','選択肢を選ぶか、AIに判断を任せてください。','请选择一个选项，或让 AI 判断。','請選擇一個選項，或讓 AI 判斷。','Elige una opción o deja que la IA decida.','Choisissez une option ou laissez l’IA décider.'],
  writing: ['직접 입력하셔도 좋아요. 카드의 선택은 그대로 유지됩니다','Write in the conversation. Your selections are kept.','会話欄に入力できます。選択内容は保持されます。','可在对话中输入，已选内容会保留。','可在對話中輸入，已選內容會保留。','Escribe en la conversación. Se conservan tus selecciones.','Écrivez dans la conversation. Vos choix sont conservés.'],
  busy: ['이전 답변을 마무리하는 중이에요, 끝나면 다시 눌러주세요','The previous response is still in progress. Try again when it finishes.','前の回答を処理中です。完了後にもう一度お試しください。','上一条回复仍在处理中，请完成后重试。','上一則回覆仍在處理中，請完成後重試。','La respuesta anterior sigue en curso. Vuelve a intentarlo al terminar.','La réponse précédente est en cours. Réessayez une fois terminée.'],
  unavailable: ['현재 대화에 답변을 전달할 수 없습니다. 선택은 유지됩니다.','Answers cannot be sent in this conversation yet. Your selections are kept.','この会話にはまだ回答を送信できません。選択内容は保持されます。','当前对话暂时无法接收答案，已选内容会保留。','目前對話暫時無法接收答案，已選內容會保留。','Aún no se pueden enviar respuestas aquí. Se conservan tus selecciones.','L’envoi n’est pas disponible dans cette conversation. Vos choix sont conservés.'],
  failed: ['답변을 전달하지 못했습니다. 선택은 유지되니 다시 시도해주세요.','Could not send your answers. Your selections are kept; please try again.','回答を送信できませんでした。選択内容を保持しています。再試行してください。','答案未能发送，已选内容会保留，请重试。','答案未能傳送，已選內容會保留，請重試。','No se pudieron enviar las respuestas. Se conservan tus selecciones; inténtalo de nuevo.','L’envoi a échoué. Vos choix sont conservés ; réessayez.'],
  selection: ['선택','Selection','選択','选择','選擇','Selección','Sélection'],
  suffix: [' 기준으로 진행해줘',' — proceed with these choices','を基準に進めてください','，请按这些选择继续','，請按這些選擇繼續',' — continúa con estas opciones',' — poursuivez avec ces choix'],
  delegateText: ['세부 조건은 알아서 합리적으로 판단해서 바로 진행해줘','Use reasonable judgement for the details and proceed.','詳細条件は合理的に判断して進めてください。','请合理判断具体条件并继续。','請合理判斷具體條件並繼續。','Decide los detalles de forma razonable y continúa.','Déterminez raisonnablement les détails et poursuivez.'],
} as const
const languages: readonly ClientLanguage[] = ['ko','en','ja','zh-CN','zh-TW','es','fr']
export function marketQuestionText(language: ClientLanguage, key: keyof typeof copy, values: Record<string, string | number> = {}): string {
  return copy[key][languages.indexOf(language)]!.replace(/\{(\w+)\}/g, (all, name: string) => values[name] === undefined ? all : String(values[name]))
}
