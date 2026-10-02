import type { ClientLanguage } from '../client-preferences'
import { nativeStrategyCopy } from './native-strategy-copy'

// Display-only workflow labels. Never translate server evidence, timestamps,
// identifiers, projection values or values passed to an approval request.
type Translations = readonly [string, string, string, string, string, string, string]
const column = { ko: 0, en: 1, ja: 2, 'zh-CN': 3, 'zh-TW': 4, es: 5, fr: 6 } as const satisfies Record<ClientLanguage, number>
export const nativeWorkflowCopy = {
  editingReady: ["현재 서버 초안을 수정할 수 있습니다. 이전 승인 버전과 결과는 바뀌지 않으며, 실행 중인 서버 작업은 계속됩니다. 화면 전환은 취소가 아닙니다. 수정 내용을 입력한 뒤 다시 검증하고 새 버전을 명시적으로 승인해주세요.","You can edit the current server draft. The previously approved version and its results do not change, and server work that is running continues. Switching the view is not a cancellation. Enter your changes, then validate again and explicitly approve a new version.","現在のサーバードラフトを修正できます。以前の承認バージョンと結果は変わらず、実行中のサーバー処理も続きます。画面の切り替えは取り消しではありません。修正内容を入力したうえで再度検証し、新しいバージョンを明示的に承認してください。","现在可以修改当前服务器草稿。此前的批准版本和结果不会改变，正在进行的服务器处理也会继续。切换界面并不是取消。请输入修改内容后重新验证，并明确批准新版本。","現在可以修改目前的伺服器草稿。先前的核准版本與結果不會改變，正在進行的伺服器處理也會繼續。切換畫面並不是取消。請輸入修改內容後重新驗證，並明確核准新版本。","Puedes modificar el borrador actual del servidor. La versión aprobada anteriormente y sus resultados no cambian, y el procesamiento en curso en el servidor continúa. Cambiar de pantalla no es una cancelación. Introduce los cambios, vuelve a validar y aprueba explícitamente una versión nueva.","Vous pouvez modifier le brouillon actuel du serveur. La version approuvée précédemment et ses résultats ne changent pas, et le traitement en cours côté serveur se poursuit. Changer d'écran n'est pas une annulation. Saisissez vos modifications, validez de nouveau, puis approuvez explicitement une nouvelle version."],
  priorResult: ["이전 승인 버전의 결과입니다. 현재 초안이나 새 작업의 검증 결과가 아닙니다.","These are the results of a previously approved version. They are not validation results for the current draft or for a new job.","以前の承認バージョンの結果です。現在のドラフトや新しい作業の検証結果ではありません。","这是此前批准版本的结果。不是当前草稿或新作业的验证结果。","這是先前核准版本的結果。不是目前草稿或新作業的驗證結果。","Son los resultados de una versión aprobada anteriormente. No son resultados de validación del borrador actual ni de un trabajo nuevo.","Il s'agit des résultats d'une version approuvée précédemment. Ce ne sont pas les résultats de validation du brouillon actuel ni d'une nouvelle tâche."],
  summary: ["전략 요약","Strategy summary","戦略の要約","策略摘要","策略摘要","Resumen de la estrategia","Résumé de la stratégie"],
  draft: ["전략 초안","Strategy draft","戦略ドラフト","策略草稿","策略草稿","Borrador de estrategia","Brouillon de stratégie"],
  target: ["대상","Target","対象","对象","對象","Objetivo","Cible"],
  pairUnset: ["거래쌍 미정","Trading pair undetermined","取引ペア未定","交易对未定","交易對未定","Par de negociación sin definir","Paire de trading non définie"],
  timeframeUnset: ["주기 미정","Interval undetermined","周期未定","周期未定","週期未定","Intervalo sin definir","Intervalle non défini"],
  unset: nativeStrategyCopy.unknown,
  leverage: nativeStrategyCopy.leverageValue,
  orderAmount: nativeStrategyCopy.amount,
  changes: ["변경 항목: {changes}","Changed items: {changes}","変更項目：{changes}","变更项：{changes}","變更項目：{changes}","Elementos modificados: {changes}","Éléments modifiés : {changes}"],
  noChanges: ["변경 없음 또는 복원된 초안","No changes, or a restored draft","変更なし、または復元されたドラフト","无变更或已恢复的草稿","無變更或已還原的草稿","Sin cambios o borrador restaurado","Aucune modification ou brouillon restauré"],
  source: nativeStrategyCopy.source,
  blockers: ["지원 범위 확인 필요: {reasons}","Supported scope needs to be checked: {reasons}","サポート範囲の確認が必要：{reasons}","需确认支持范围：{reasons}","需確認支援範圍：{reasons}","Es necesario comprobar el alcance admitido: {reasons}","Portée prise en charge à vérifier : {reasons}"],
  validate: ["전략 검증","Validate strategy","戦略を検証","验证策略","驗證策略","Validar estrategia","Valider la stratégie"],
  validated: ["검증 완료 · 만료: {expiresAt}. 아직 사용자 승인 전입니다.","Validation complete · Expires: {expiresAt}. Not yet approved by the user.","検証完了 · 有効期限：{expiresAt}。まだユーザーの承認前です。","验证完成 · 到期：{expiresAt}。尚未经用户批准。","驗證完成 · 到期：{expiresAt}。尚未經使用者核准。","Validación completada · Vence: {expiresAt}. Todavía sin aprobación del usuario.","Validation terminée · Expire : {expiresAt}. Pas encore approuvé par l'utilisateur."],
  reviewApproval: ["승인 내용 확인","Review approval details","承認内容を確認","查看批准内容","查看核准內容","Revisar los detalles de la aprobación","Vérifier le contenu de l'approbation"],
  loginContinue: ["로그인 후 백테스트 계속","Log in to continue the backtest","ログインしてバックテストを続行","登录后继续回测","登入後繼續回測","Inicia sesión para continuar el backtest","Se connecter pour poursuivre le backtest"],
  consent: ["현재 전략·MMR 미검증 제한을 확인했습니다. 실제 주문을 승인하는 것이 아닙니다.","I have confirmed the current strategy and the limitation that MMR is not verified. This does not approve a real order.","現在の戦略と、MMRが未検証であるという制限を確認しました。実際の注文を承認するものではありません。","我已确认当前策略与 MMR 未验证的限制。这并不是批准实际下单。","我已確認目前策略與 MMR 未驗證的限制。這並不是核准實際下單。","He confirmado la estrategia actual y la limitación de que el MMR no está verificado. Esto no aprueba una orden real.","J'ai pris connaissance de la stratégie actuelle et de la limite selon laquelle le MMR n'est pas vérifié. Cela n'approuve pas un ordre réel."],
  costs: ["비용은 서버 실행 프로필의 가정을 따르며 결과에 분리 표시됩니다.","Costs follow the assumptions of the server execution profile and are shown separately in the results.","費用はサーバー実行プロファイルの前提に従い、結果には分けて表示されます。","费用遵循服务器执行配置文件的假设，并在结果中单独显示。","費用依循伺服器執行設定檔的假設，並在結果中分開顯示。","Los costes siguen los supuestos del perfil de ejecución del servidor y se muestran por separado en los resultados.","Les coûts suivent les hypothèses du profil d'exécution du serveur et sont affichés séparément dans les résultats."],
  approvalTarget: ["승인 대상:","Approval target:","承認対象：","批准对象：","核准對象：","Objeto de la aprobación:","Objet de l'approbation :"],
  approve: ["이 전략 버전 승인","Approve this strategy version","この戦略バージョンを承認","批准此策略版本","核准此策略版本","Aprobar esta versión de la estrategia","Approuver cette version de la stratégie"],
  approvedVersion: ["승인 버전:","Approved version:","承認バージョン：","批准版本：","核准版本：","Versión aprobada:","Version approuvée :"],
  submit: ["과거 데이터 백테스트 시작","Start backtest on historical data","過去データでバックテストを開始","开始历史数据回测","開始歷史資料回測","Iniciar backtest con datos históricos","Lancer le backtest sur données historiques"],
  paper: ["기록 Paper 열기","Open recorded Paper","記録Paperを開く","打开记录 Paper","開啟記錄 Paper","Abrir el Paper registrado","Ouvrir le Paper enregistré"],
  smoke: ["합성 구조 시험 열기","Open synthetic structural test","合成構造テストを開く","打开合成结构测试","開啟合成結構測試","Abrir la prueba estructural sintética","Ouvrir le test structurel synthétique"],
  edit: ["현재 초안 수정하기","Edit the current draft","現在のドラフトを修正","修改当前草稿","修改目前草稿","Editar el borrador actual","Modifier le brouillon actuel"],
  editNotice: ["현재 초안만 수정합니다. 이전 승인 버전·결과는 보존되며, 실행 중인 서버 작업을 취소하지 않습니다.","This edits only the current draft. Previously approved versions and results are kept, and it does not cancel server work that is running.","現在のドラフトのみを修正します。以前の承認バージョン・結果は保持され、実行中のサーバー処理を取り消すものではありません。","仅修改当前草稿。此前的批准版本和结果将保留，且不会取消正在进行的服务器处理。","僅修改目前草稿。先前的核准版本與結果會保留，且不會取消正在進行的伺服器處理。","Solo se modifica el borrador actual. Las versiones aprobadas y los resultados anteriores se conservan, y no se cancela el procesamiento en curso en el servidor.","Seul le brouillon actuel est modifié. Les versions approuvées et les résultats précédents sont conservés, et le traitement en cours côté serveur n'est pas annulé."],
  recoveryLabel: ["요청 복구","Request recovery","リクエストの復旧","请求恢复","請求復原","Recuperación de la solicitud","Récupération de la requête"],
  recoveryTitle: ["요청 상태 확인","Checking the request status","リクエスト状態の確認","检查请求状态","檢查請求狀態","Comprobación del estado de la solicitud","Vérification de l'état de la requête"],
  recoveryNotice: ["아래 안내를 확인해주세요. 저장 기록만으로 승인이나 실행 완료를 표시하지 않습니다.","Please check the guidance below. A stored record alone does not indicate approval or completed execution.","以下の案内をご確認ください。保存された記録だけで承認や実行完了を示すものではありません。","请查看下方说明。仅凭保存的记录并不表示已批准或已执行完成。","請查看下方說明。僅憑儲存的記錄並不表示已核准或已執行完成。","Consulta las indicaciones de abajo. El registro guardado por sí solo no indica que haya aprobación ni que la ejecución se haya completado.","Veuillez consulter les indications ci-dessous. Un enregistrement conservé ne signifie pas à lui seul qu'il y a eu approbation ou exécution terminée."],
} as const satisfies Record<string, Translations>
export type NativeWorkflowTextKey = keyof typeof nativeWorkflowCopy
export function nativeWorkflowText(language: ClientLanguage, key: NativeWorkflowTextKey, values: Readonly<Record<string, string | number>> = {}): string {
  return nativeWorkflowCopy[key][column[language]].replace(/\{([a-zA-Z]+)\}/g,
    (placeholder, name: string) => Object.hasOwn(values, name) ? String(values[name]) : placeholder)
}

export function nativeWorkflowLeverage(language: ClientLanguage, value: string | number | null | undefined): string {
  return value == null ? nativeWorkflowText(language, 'unset') : nativeWorkflowText(language, 'leverage', { value })
}
