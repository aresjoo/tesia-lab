import type { ClientLanguage } from './client-preferences'

/** Source strategy actions; caller-supplied names and records remain verbatim. */
type Translations = readonly [string, string, string, string, string, string, string]
const column = { ko: 0, en: 1, ja: 2, 'zh-CN': 3, 'zh-TW': 4, es: 5, fr: 6 } as const satisfies Record<ClientLanguage, number>
export const strategyActionsCopy = {
  "menuLabel": [
    "{name} 전략 메뉴",
    "{name} strategy menu",
    "{name} の戦略メニュー",
    "{name} 策略菜单",
    "{name} 策略選單",
    "Menú de la estrategia {name}",
    "Menu de la stratégie {name}"
  ],
  "detail": [
    "전략 상세",
    "Strategy details",
    "戦略の詳細",
    "策略详情",
    "策略詳情",
    "Detalles de la estrategia",
    "Détails de la stratégie"
  ],
  "rename": [
    "이름 변경",
    "Rename",
    "名前を変更",
    "重命名",
    "重新命名",
    "Cambiar nombre",
    "Renommer"
  ],
  "clone": [
    "복제",
    "Duplicate",
    "複製",
    "复制",
    "複製",
    "Duplicar",
    "Dupliquer"
  ],
  "cloneExchange": [
    "다른 거래소에 복제",
    "Duplicate to another exchange",
    "他の取引所に複製",
    "复制到其他交易所",
    "複製到其他交易所",
    "Duplicar en otro exchange",
    "Dupliquer vers une autre plateforme d'échange"
  ],
  "pause": [
    "일시 중지",
    "Pause",
    "一時停止",
    "暂停",
    "暫停",
    "Pausar",
    "Mettre en pause"
  ],
  "resume": [
    "다시 시작",
    "Start again",
    "再開する",
    "重新启动",
    "重新啟動",
    "Volver a iniciar",
    "Relancer"
  ],
  "start": [
    "지금 시작",
    "Start now",
    "今すぐ開始",
    "立即启动",
    "立即啟動",
    "Iniciar ahora",
    "Démarrer maintenant"
  ],
  "versions": [
    "버전 기록",
    "Version history",
    "バージョン履歴",
    "版本记录",
    "版本紀錄",
    "Historial de versiones",
    "Historique des versions"
  ],
  "delete": [
    "삭제",
    "Delete",
    "削除",
    "删除",
    "刪除",
    "Eliminar",
    "Supprimer"
  ],
  "cantDelete": [
    "삭제할 수 없어요",
    "Can't delete this",
    "削除できません",
    "无法删除",
    "無法刪除",
    "No se puede eliminar",
    "Suppression impossible"
  ],
  "deleteTitle": [
    "전략 삭제",
    "Delete strategy",
    "戦略を削除",
    "删除策略",
    "刪除策略",
    "Eliminar estrategia",
    "Supprimer la stratégie"
  ],
  "required": [
    "이름을 입력해주세요",
    "Please enter a name",
    "名前を入力してください",
    "请输入名称",
    "請輸入名稱",
    "Introduce un nombre",
    "Veuillez saisir un nom"
  ],
  "tooLong": [
    "전략 이름은 30자까지 입력할 수 있어요",
    "Strategy names can be up to 30 characters",
    "戦略名は30文字まで入力できます",
    "策略名称最多可输入 30 个字符",
    "策略名稱最多可輸入 30 個字元",
    "El nombre de la estrategia admite hasta 30 caracteres",
    "Le nom de la stratégie peut contenir jusqu'à 30 caractères"
  ],
  "failed": [
    "요청을 완료하지 못했습니다. 다시 시도해주세요.",
    "The request could not be completed. Please try again.",
    "リクエストを完了できませんでした。もう一度お試しください。",
    "未能完成请求。请重试。",
    "未能完成請求。請再試一次。",
    "No se pudo completar la solicitud. Inténtalo de nuevo.",
    "La requête n'a pas pu être menée à bien. Veuillez réessayer."
  ],
  "name": [
    "전략 이름",
    "Strategy name",
    "戦略名",
    "策略名称",
    "策略名稱",
    "Nombre de la estrategia",
    "Nom de la stratégie"
  ],
  "cancel": [
    "취소",
    "Cancel",
    "キャンセル",
    "取消",
    "取消",
    "Cancelar",
    "Annuler"
  ],
  "save": [
    "저장",
    "Save",
    "保存",
    "保存",
    "儲存",
    "Guardar",
    "Enregistrer"
  ],
  "cloneHint": [
    "복제할 거래소를 선택해주세요.",
    "Select the exchange to duplicate to.",
    "複製先の取引所を選択してください。",
    "请选择要复制到的交易所。",
    "請選擇要複製到的交易所。",
    "Selecciona el exchange de destino.",
    "Sélectionnez la plateforme d'échange de destination."
  ],
  "cloneDescription": [
    "설정 그대로 다른 거래소에 실행 전 상태로 복제해요. (시뮬레이션)",
    "Duplicates to another exchange with the same settings, in the not-started state. (simulation)",
    "設定そのままで他の取引所に実行前の状態で複製します。（シミュレーション）",
    "按原设置复制到其他交易所，处于未执行状态。（模拟）",
    "依原設定複製到其他交易所，處於未執行狀態。（模擬）",
    "Se duplica en otro exchange con los mismos ajustes, en estado sin iniciar. (simulación)",
    "Duplication vers une autre plateforme d'échange avec les mêmes paramètres, à l'état non démarré. (simulation)"
  ],
  "cloneExchangeNote": [
    "복제 후 검증 상태 유지",
    "Validation state kept after duplication",
    "複製後も検証状態を維持",
    "复制后保持验证状态",
    "複製後保持驗證狀態",
    "Se mantiene el estado de validación tras duplicar",
    "État de validation conservé après duplication"
  ],
  "runningMessage": [
    "이 전략은 현재 {status}입니다.",
    "This strategy is currently {status}.",
    "この戦略は現在{status}です。",
    "该策略当前{status}。",
    "此策略目前{status}。",
    "Esta estrategia está actualmente {status}.",
    "Cette stratégie est actuellement {status}."
  ],
  "running": [
    "실행 중",
    "Running",
    "実行中",
    "运行中",
    "執行中",
    "En ejecución",
    "En cours d'exécution"
  ],
  "stopFirst": [
    "삭제하려면 먼저 전략 실행을 중지해야 합니다.",
    "To delete it, you must first stop the strategy.",
    "削除するには、まず戦略の実行を停止する必要があります。",
    "要删除，请先停止策略运行。",
    "要刪除，請先停止策略執行。",
    "Para eliminarla, primero debes detener la ejecución de la estrategia.",
    "Pour la supprimer, vous devez d'abord arrêter l'exécution de la stratégie."
  ],
  "deleteQuestion": [
    "\"{name}\" 전략을 삭제할까요?",
    "Delete the \"{name}\" strategy?",
    "「{name}」戦略を削除しますか？",
    "要删除“{name}”策略吗？",
    "要刪除「{name}」策略嗎？",
    "¿Eliminar la estrategia \"{name}\"?",
    "Supprimer la stratégie « {name} » ?"
  ],
  "deleteWarning": [
    "판단 기록과 버전 이력도 함께 사라져요. 되돌릴 수 없어요.",
    "The decision log and version history will be deleted as well. This cannot be undone.",
    "判断記録とバージョン履歴も一緒に削除されます。元に戻せません。",
    "判断记录和版本记录也会一并消失。此操作无法撤销。",
    "判斷紀錄和版本紀錄也會一併消失。此操作無法復原。",
    "También se eliminarán el registro de decisiones y el historial de versiones. No se puede deshacer.",
    "Le journal des décisions et l'historique des versions seront également supprimés. Cette action est irréversible."
  ],
  "stop": [
    "전략 중지",
    "Stop the strategy",
    "戦略を停止",
    "停止策略",
    "停止策略",
    "Detener la estrategia",
    "Arrêter la stratégie"
  ],
  "headerStop": [
    "중지",
    "Stop",
    "停止",
    "停止",
    "停止",
    "Detener",
    "Arrêter"
  ],
  "headerResume": [
    "재개",
    "Resume",
    "再開",
    "恢复",
    "恢復",
    "Reanudar",
    "Reprendre"
  ],
  "headerReconnect": [
    "다시 연결",
    "Reconnect",
    "再接続",
    "重新连接",
    "重新連接",
    "Volver a conectar",
    "Reconnecter"
  ]
} as const satisfies Record<string, Translations>

export function strategyActionsText(language: ClientLanguage, key: keyof typeof strategyActionsCopy, values: Readonly<Record<string, string>> = {}): string {
  return strategyActionsCopy[key][column[language]].replace(/\{(\w+)\}/g, (token, name: string) => Object.hasOwn(values, name) ? values[name] : token)
}
