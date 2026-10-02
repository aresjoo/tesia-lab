import type { ClientLanguage } from './client-preferences'
type Translations = readonly [string, string, string, string, string, string, string]
const column = { ko: 0, en: 1, ja: 2, 'zh-CN': 3, 'zh-TW': 4, es: 5, fr: 6 } as const
export const botStrategyEditCopy = {
  title: ['전략 수정: {name}', 'Edit strategy: {name}', '戦略を編集: {name}', '修改策略：{name}', '修改策略：{name}', 'Editar estrategia: {name}', 'Modifier la stratégie : {name}'],
  close: ['닫기', 'Close', '閉じる', '关闭', '關閉', 'Cerrar', 'Fermer'],
  cancel: ['취소', 'Cancel', 'キャンセル', '取消', '取消', 'Cancelar', 'Annuler'],
  notice: ['설정을 바꾸면 다시 검증해요. 재검증을 통과해야 이 전략에 적용됩니다.', 'Changed settings must be validated again before they can be applied to this strategy.', '設定を変更したら再検証が必要です。合格後にこの戦略へ適用できます。', '修改设置后需要重新验证，通过后才能应用到此策略。', '修改設定後需要重新驗證，通過後才能套用至此策略。', 'Los cambios deben superar una nueva validación antes de aplicarse a esta estrategia.', 'Les modifications doivent être revalidées avant de pouvoir être appliquées à cette stratégie.'],
  stopLoss: ['손절선', 'Stop loss', '損切りライン', '止损线', '停損線', 'Stop loss', 'Seuil de perte'],
  takeProfit: ['익절 목표', 'Take-profit target', '利確目標', '止盈目标', '停利目標', 'Objetivo de beneficio', 'Objectif de gain'],
  rsi: ['진입 RSI 임계', 'Entry RSI threshold', 'エントリーRSI閾値', '入场RSI阈值', '進場RSI閾值', 'Umbral RSI de entrada', 'Seuil RSI d’entrée'],
  filter: ['추세 필터', 'Trend filter', 'トレンドフィルター', '趋势过滤器', '趨勢過濾器', 'Filtro de tendencia', 'Filtre de tendance'],
  stopShort: ['짧게 끊기', 'Tight', '短く抑える', '快速止损', '快速停損', 'Ajustado', 'Serré'],
  stopStandard: ['표준', 'Standard', '標準', '标准', '標準', 'Estándar', 'Standard'],
  stopWide: ['여유있게', 'Roomier', '余裕を持つ', '较宽松', '較寬鬆', 'Más amplio', 'Plus large'],
  stopLong: ['길게 버티기', 'Wider tolerance', '長めに待つ', '更大容忍度', '更大容忍度', 'Mayor tolerancia', 'Tolérance élargie'],
  stopOption: ['{value}%까지 ({label})', 'Up to {value}% ({label})', '{value}%まで（{label}）', '至{value}%（{label}）', '至{value}%（{label}）', 'Hasta {value}% ({label})', 'Jusqu’à {value}% ({label})'],
  rsiOption: ['RSI {value} 이하', 'RSI at or below {value}', 'RSI {value}以下', 'RSI不高于{value}', 'RSI不高於{value}', 'RSI igual o inferior a {value}', 'RSI inférieur ou égal à {value}'],
  periodExit: ['기간 청산', 'Period exit', '期間決済', '到期平仓', '到期平倉', 'Cierre por período', 'Clôture de période'],
  filterOn: ['사용 (20/60일 이평)', 'Enabled (20/60-day MA)', '使用（20/60日移動平均）', '启用（20/60日均线）', '啟用（20/60日均線）', 'Activado (medias de 20/60 días)', 'Activé (moyennes de 20/60 jours)'],
  filterOff: ['사용 안 함', 'Disabled', '使用しない', '不启用', '不啟用', 'Desactivado', 'Désactivé'],
  validate: ['재검증', 'Revalidate', '再検証', '重新验证', '重新驗證', 'Revalidar', 'Revalider'],
  validating: ['재검증 요청 중…', 'Requesting validation…', '再検証をリクエスト中…', '正在请求验证…', '正在請求驗證…', 'Solicitando validación…', 'Demande de validation…'],
  apply: ['이 전략에 적용', 'Apply to this strategy', 'この戦略に適用', '应用到此策略', '套用至此策略', 'Aplicar a esta estrategia', 'Appliquer à cette stratégie'],
  applying: ['적용 요청 중…', 'Requesting application…', '適用をリクエスト中…', '正在请求应用…', '正在請求套用…', 'Solicitando aplicación…', 'Demande d’application…'],
  changed: ['설정이 바뀌었어요. 재검증을 다시 통과해야 적용할 수 있어요.', 'Settings changed. Revalidate before applying.', '設定が変わりました。適用前に再検証してください。', '设置已更改，应用前请重新验证。', '設定已變更，套用前請重新驗證。', 'Los ajustes cambiaron. Revalida antes de aplicarlos.', 'Les réglages ont changé. Revalidez avant de les appliquer.'],
  custom: ['기존 설정에 기본 선택 범위 밖의 값이 있습니다. 공급된 값을 유지했으니 검토 후 재검증해주세요.', 'Existing settings include values outside the default choices. Supplied values were preserved; review and revalidate them.', '既存設定に既定の選択肢以外の値があります。提供値を保持しています。確認して再検証してください。', '现有设置包含默认选项之外的值，已保留提供的值，请检查并重新验证。', '現有設定包含預設選項之外的值，已保留提供的值，請檢查並重新驗證。', 'Hay valores fuera de las opciones predeterminadas. Se han conservado; revísalos y revalida.', 'Certains réglages ne figurent pas parmi les choix proposés. Ils ont été conservés ; vérifiez-les et revalidez.'],
  result: ['재검증 결과', 'Revalidation result', '再検証結果', '重新验证结果', '重新驗證結果', 'Resultado de revalidación', 'Résultat de revalidation'],
  passed: ['통과', 'Passed', '合格', '通过', '通過', 'Superada', 'Réussie'],
  failed: ['미통과', 'Not passed', '未合格', '未通过', '未通過', 'No superada', 'Non réussie'],
  return: ['검증 수익', 'Validated return', '検証収益', '验证收益', '驗證收益', 'Rendimiento validado', 'Rendement validé'],
  drawdown: ['최대 낙폭', 'Maximum drawdown', '最大ドローダウン', '最大回撤', '最大回撤', 'Caída máxima', 'Repli maximal'],
  trades: ['체결', 'Fills', '約定', '成交', '成交', 'Ejecuciones', 'Exécutions'],
  adjust: ['설정을 조정해 다시 검증해보세요. 통과 전에는 적용되지 않아요.', 'Adjust settings and validate again. They cannot be applied before passing.', '設定を調整して再検証してください。合格前は適用されません。', '请调整设置后重新验证，通过前不会应用。', '請調整設定後重新驗證，通過前不會套用。', 'Ajusta los parámetros y vuelve a validar. No se aplicarán antes de superar la validación.', 'Ajustez les paramètres et revalidez. Ils ne seront pas appliqués avant réussite.'],
  waitingValidation: ['재검증 요청을 전달했어요. 확인된 결과를 기다리고 있습니다.', 'Validation requested. Waiting for confirmed results.', '再検証を依頼しました。確認済みの結果を待っています。', '已请求重新验证，正在等待确认结果。', '已請求重新驗證，正在等待確認結果。', 'Validación solicitada. Esperando resultados confirmados.', 'Validation demandée. En attente des résultats confirmés.'],
  waitingApplication: ['적용 요청을 전달했어요. 확인된 적용 결과를 기다리고 있습니다.', 'Application requested. Waiting for the confirmed outcome.', '適用を依頼しました。確認済みの適用結果を待っています。', '已请求应用，正在等待确认结果。', '已請求套用，正在等待確認結果。', 'Aplicación solicitada. Esperando la confirmación.', 'Application demandée. En attente de confirmation.'],
  applied: ['전략 설정이 적용됐어요', 'Strategy settings applied', '戦略設定が適用されました', '策略设置已应用', '策略設定已套用', 'Ajustes de estrategia aplicados', 'Paramètres de stratégie appliqués'],
  requestFailed: ['요청을 완료하지 못했어요. 다시 시도해 주세요.', 'Could not complete the request. Please try again.', 'リクエストを完了できませんでした。もう一度お試しください。', '未能完成请求，请重试。', '未能完成請求，請重試。', 'No se pudo completar la solicitud. Inténtalo de nuevo.', 'Impossible de terminer la demande. Réessayez.'],
  unavailable: ['재검증 기능이 아직 연결되지 않았습니다.', 'Revalidation is not connected yet.', '再検証機能はまだ接続されていません。', '重新验证功能尚未连接。', '重新驗證功能尚未連接。', 'La revalidación aún no está conectada.', 'La revalidation n’est pas encore connectée.'],
  invalid: ['제공된 설정 값을 확인해주세요.', 'Please check the supplied settings.', '提供された設定値を確認してください。', '请检查提供的设置值。', '請檢查提供的設定值。', 'Revisa los ajustes proporcionados.', 'Vérifiez les paramètres fournis.'],
} as const satisfies Record<string, Translations>
export function botStrategyEditText(language: ClientLanguage, key: keyof typeof botStrategyEditCopy, values: Record<string, string | number> = {}): string {
  return botStrategyEditCopy[key][column[language]].replace(/\{(\w+)\}/g, (match, name: string) => Object.hasOwn(values, name) ? String(values[name]) : match)
}
