import type { ClientLanguage } from './client-preferences'
import { sourceQuestionCopy } from './client-source-question-view'

/** Source-owned display copy. Not parser aliases or model instructions. */
type Translations = readonly [string, string, string, string, string, string, string]
const column = { ko: 0, en: 1, ja: 2, 'zh-CN': 3, 'zh-TW': 4, es: 5, fr: 6 } as const satisfies Record<ClientLanguage, number>
export const sourceProposalCopy = {
  whyEntry: sourceQuestionCopy.whyEntry,
  largestRisk: sourceQuestionCopy.largestRisk,
  nextEntry: sourceQuestionCopy.nextEntry,
  reduceRisk: sourceQuestionCopy.reduceRisk,
  appliedPaused: ['{version} 적용 완료. 안전을 위해 전략은 중지 상태예요.', '{version} applied. The strategy is stopped for safety.', '{version} を適用しました。安全のため戦略は停止中です。', '{version} 已应用。为安全起见，策略已停止。', '{version} 已套用。為安全起見，策略已停止。', '{version} aplicada. La estrategia está detenida por seguridad.', '{version} appliquée. La stratégie est arrêtée par sécurité.'],
  resumeApplied: ['바로 재개', 'Resume now', '今すぐ再開', '立即恢复', '立即恢復', 'Reanudar ahora', 'Reprendre maintenant'],
  resumeFailed: ['재개하지 못했어요. 현재 상태를 확인하고 다시 시도해주세요.', 'Could not resume. Check the current state and try again.', '再開できませんでした。現在の状態を確認して再試行してください。', '无法恢复。请确认当前状态后重试。', '無法恢復。請確認目前狀態後重試。', 'No se pudo reanudar. Comprueba el estado actual e inténtalo de nuevo.', 'Impossible de reprendre. Vérifiez l’état actuel puis réessayez.'],
  snappedUnchangedTitle: ['조정하면 지금 설정과 같아져요', 'The adjusted value matches your current settings', '調整すると現在の設定と同じになります', '调整后与当前设置相同', '調整後與目前設定相同', 'El valor ajustado coincide con la configuración actual', 'La valeur ajustée correspond aux paramètres actuels'],
  snappedUnchangedText: ['현재 설정이 요청값에 가장 가까운 허용값이라 바꿀 것이 없어요.', 'Your current setting is the nearest allowed value, so there is nothing to change.', '現在の設定が要求値に最も近い許容値のため、変更はありません。', '当前设置是最接近请求值的允许值，因此无需更改。', '目前設定是最接近要求值的允許值，因此無需變更。', 'La configuración actual es el valor permitido más cercano; no hay nada que cambiar.', 'Le paramètre actuel est la valeur autorisée la plus proche : rien ne change.'],
  "lowerRisk": [
    "리스크 낮춰줘",
    "Lower risk",
    "リスクを下げる",
    "降低风险",
    "降低風險",
    "Reducir riesgo",
    "Réduire le risque"
  ],
  "explainStop": [
    "손절 기준 설명",
    "Explain stop-loss",
    "損切り基準の説明",
    "说明止损标准",
    "說明停損標準",
    "Explicar el stop loss",
    "Expliquer le stop-loss"
  ],
  "recentAnalysis": [
    "이번 판단 다시 분석",
    "Re-analyze this decision",
    "今回の判断を再分析",
    "重新分析本次判断",
    "重新分析本次判斷",
    "Reanalizar esta decisión",
    "Réanalyser cette décision"
  ],
  "inputLabel": [
    "전략 Agent에게 질문",
    "Ask the strategy Agent",
    "戦略Agentに質問",
    "向策略 Agent 提问",
    "向策略 Agent 提問",
    "Preguntar al Agent de la estrategia",
    "Poser une question à l'Agent de la stratégie"
  ],
  "inputPlaceholder": [
    "예: 손절을 -3%로 바꿔 주십시오",
    "e.g. 손절을 -3%로 바꿔 주십시오",
    "例: 손절을 -3%로 바꿔 주십시오",
    "例如：손절을 -3%로 바꿔 주십시오",
    "例如：손절을 -3%로 바꿔 주십시오",
    "Ej.: 손절을 -3%로 바꿔 주십시오",
    "Ex. : 손절을 -3%로 바꿔 주십시오"
  ],
  "send": [
    "Agent에게 보내기",
    "Send to the Agent",
    "Agentに送信",
    "发送给 Agent",
    "傳送給 Agent",
    "Enviar al Agent",
    "Envoyer à l'Agent"
  ],
  "rowStop": [
    "손절선",
    "Stop-loss line",
    "損切りライン",
    "止损线",
    "停損線",
    "Línea de stop loss",
    "Ligne de stop-loss"
  ],
  "rowTarget": [
    "익절 목표",
    "Take-profit target",
    "利確目標",
    "止盈目标",
    "停利目標",
    "Objetivo de take profit",
    "Objectif de take-profit"
  ],
  "rowRsi": [
    "진입 RSI 임계",
    "Entry RSI threshold",
    "エントリーRSI閾値",
    "入场 RSI 阈值",
    "進場 RSI 門檻",
    "Umbral de RSI de entrada",
    "Seuil RSI d'entrée"
  ],
  "rowTrend": [
    "추세 필터",
    "Trend filter",
    "トレンドフィルター",
    "趋势过滤器",
    "趨勢過濾器",
    "Filtro de tendencia",
    "Filtre de tendance"
  ],
  "none": [
    "없음",
    "None",
    "なし",
    "无",
    "無",
    "Ninguno",
    "Aucun"
  ],
  "new": [
    "신설",
    "New",
    "新規",
    "新增",
    "新增",
    "Nuevo",
    "Nouveau"
  ],
  "enabled": [
    "사용",
    "Enabled",
    "使用",
    "启用",
    "啟用",
    "Activado",
    "Activé"
  ],
  "disabled": [
    "미사용",
    "Disabled",
    "未使用",
    "未启用",
    "未啟用",
    "Desactivado",
    "Désactivé"
  ],
  "added": [
    "추가",
    "Added",
    "追加",
    "添加",
    "新增",
    "Añadido",
    "Ajouté"
  ],
  "removed": [
    "제거",
    "Removed",
    "削除",
    "移除",
    "移除",
    "Eliminado",
    "Supprimé"
  ],
  "stopSnap": [
    "손절 {from}% → 허용값 {to}%로 조정",
    "Stop-loss {from}% → adjusted to allowed value {to}%",
    "損切り {from}% → 許容値 {to}% に調整",
    "止损 {from}% → 调整为允许值 {to}%",
    "停損 {from}% → 調整為允許值 {to}%",
    "Stop loss {from}% → ajustado al valor permitido {to}%",
    "Stop-loss {from}% → ajusté à la valeur autorisée {to}%"
  ],
  "targetSnap": [
    "익절 +{from}% → 허용값 +{to}%로 조정",
    "Take profit +{from}% → adjusted to allowed value +{to}%",
    "利確 +{from}% → 許容値 +{to}% に調整",
    "止盈 +{from}% → 调整为允许值 +{to}%",
    "停利 +{from}% → 調整為允許值 +{to}%",
    "Take profit +{from}% → ajustado al valor permitido +{to}%",
    "Take-profit +{from}% → ajusté à la valeur autorisée +{to}%"
  ],
  "rsiSnap": [
    "RSI {from} → 허용값 {to}으로 조정",
    "RSI {from} → adjusted to allowed value {to}",
    "RSI {from} → 許容値 {to} に調整",
    "RSI {from} → 调整为允许值 {to}",
    "RSI {from} → 調整為允許值 {to}",
    "RSI {from} → ajustado al valor permitido {to}",
    "RSI {from} → ajusté à la valeur autorisée {to}"
  ],
  "riskLower": [
    "리스크 축소 → 손절 {from}% → {to}%",
    "Lower risk → stop-loss {from}% → {to}%",
    "リスク縮小 → 損切り {from}% → {to}%",
    "降低风险 → 止损 {from}% → {to}%",
    "降低風險 → 停損 {from}% → {to}%",
    "Menor riesgo → stop loss {from}% → {to}%",
    "Risque réduit → stop-loss {from}% → {to}%"
  ],
  "riskHigher": [
    "리스크 확대 → 손절 {from}% → {to}%",
    "Higher risk → stop-loss {from}% → {to}%",
    "リスク拡大 → 損切り {from}% → {to}%",
    "提高风险 → 止损 {from}% → {to}%",
    "提高風險 → 停損 {from}% → {to}%",
    "Mayor riesgo → stop loss {from}% → {to}%",
    "Risque accru → stop-loss {from}% → {to}%"
  ],
  "stopTight": [
    "손절이 이미 가장 타이트한 값({value}%)이에요",
    "The stop-loss is already at the tightest value ({value}%)",
    "損切りはすでに最もタイトな値（{value}%）です",
    "止损已是最紧的值（{value}%）",
    "停損已是最緊的值（{value}%）",
    "El stop loss ya está en el valor más ajustado ({value}%)",
    "Le stop-loss est déjà à la valeur la plus serrée ({value}%)"
  ],
  "riskTrend": [
    "리스크 축소 → 추세 필터 추가",
    "Lower risk → trend filter added",
    "リスク縮小 → トレンドフィルター追加",
    "降低风险 → 添加趋势过滤器",
    "降低風險 → 新增趨勢過濾器",
    "Menor riesgo → filtro de tendencia añadido",
    "Risque réduit → filtre de tendance ajouté"
  ],
  "unsupportedEma": [
    "EMA 조건",
    "EMA condition",
    "EMA条件",
    "EMA 条件",
    "EMA 條件",
    "Condición EMA",
    "Condition EMA"
  ],
  "unsupportedPartial": [
    "부분 청산 규칙",
    "Partial exit rule",
    "部分決済ルール",
    "部分平仓规则",
    "部分平倉規則",
    "Regla de salida parcial",
    "Règle de sortie partielle"
  ],
  "unsupportedLeverage": [
    "레버리지",
    "Leverage",
    "レバレッジ",
    "杠杆",
    "槓桿",
    "Apalancamiento",
    "Levier"
  ],
  "unsupportedTimeframe": [
    "타임프레임 변경",
    "Timeframe change",
    "タイムフレーム変更",
    "时间周期变更",
    "時間週期變更",
    "Cambio de marco temporal",
    "Changement d'unité de temps"
  ],
  "tooLongTitle": [
    "요청을 조금 짧게 입력해주세요",
    "Please make the request a little shorter",
    "リクエストを少し短く入力してください",
    "请把请求写得短一些",
    "請把請求寫得短一些",
    "Escribe la solicitud un poco más corta",
    "Veuillez raccourcir un peu la demande"
  ],
  "tooLongText": [
    "전략 변경 요청은 4,000자까지 입력할 수 있어요.",
    "Strategy change requests can be up to 4,000 characters.",
    "戦略変更のリクエストは4,000文字まで入力できます。",
    "策略变更请求最多可输入 4,000 个字符。",
    "策略變更請求最多可輸入 4,000 個字元。",
    "Las solicitudes de cambio de estrategia admiten hasta 4000 caracteres.",
    "Les demandes de modification de stratégie peuvent contenir jusqu'à 4 000 caractères."
  ],
  "invalidTitle": [
    "입력한 수치를 확인해주세요",
    "Please check the numbers you entered",
    "入力した数値を確認してください",
    "请确认输入的数值",
    "請確認輸入的數值",
    "Revisa los números que has introducido",
    "Veuillez vérifier les valeurs saisies"
  ],
  "invalidText": [
    "해석 가능한 유한한 숫자로 손절, 익절 또는 RSI 조건을 입력해주세요. 전략은 변경하지 않았어요.",
    "Enter the stop-loss, take-profit or RSI condition as a finite, interpretable number. The strategy was not changed.",
    "損切り、利確またはRSI条件を解釈可能な有限の数値で入力してください。戦略は変更していません。",
    "请用可解析的有限数字输入止损、止盈或 RSI 条件。策略未做更改。",
    "請用可解析的有限數字輸入停損、停利或 RSI 條件。策略未做變更。",
    "Introduce el stop loss, el take profit o la condición de RSI como un número finito e interpretable. La estrategia no se ha cambiado.",
    "Saisissez le stop-loss, le take-profit ou la condition RSI sous forme de nombre fini et interprétable. La stratégie n'a pas été modifiée."
  ],
  "unchangedTitle": [
    "변경 사항이 없어요",
    "No changes",
    "変更はありません",
    "没有变更",
    "沒有變更",
    "Sin cambios",
    "Aucune modification"
  ],
  "unchangedText": [
    "요청한 값이 현재 설정과 같아요. 버전을 만들지 않았어요.",
    "The requested value is the same as the current setting. No version was created.",
    "要求された値は現在の設定と同じです。バージョンは作成していません。",
    "请求的值与当前设置相同。未创建版本。",
    "請求的值與目前設定相同。未建立版本。",
    "El valor solicitado es igual al ajuste actual. No se creó ninguna versión.",
    "La valeur demandée est identique au réglage actuel. Aucune version n'a été créée."
  ],
  "unsupportedTitle": [
    "이 요청은 아직 자동 변환을 지원하지 않아요",
    "This request isn't supported for automatic conversion yet",
    "このリクエストはまだ自動変換に対応していません",
    "此请求尚不支持自动转换",
    "此請求尚不支援自動轉換",
    "Esta solicitud todavía no admite conversión automática",
    "Cette demande ne prend pas encore en charge la conversion automatique"
  ],
  "supportText": [
    "지원: 손절(%), 익절(%), 진입 RSI 임계, 추세 필터 켜기/끄기, 리스크 낮춰/높여.",
    "Supported: stop-loss (%), take-profit (%), entry RSI threshold, trend filter on/off, lower/raise risk.",
    "対応：損切り（%）、利確（%）、エントリーRSI閾値、トレンドフィルターのオン/オフ、リスクの縮小/拡大。",
    "支持：止损（%）、止盈（%）、入场 RSI 阈值、趋势过滤器开/关、降低/提高风险。",
    "支援：停損（%）、停利（%）、進場 RSI 門檻、趨勢過濾器開/關、降低/提高風險。",
    "Compatible: stop loss (%), take profit (%), umbral de RSI de entrada, filtro de tendencia on/off, bajar/subir riesgo.",
    "Pris en charge : stop-loss (%), take-profit (%), seuil RSI d'entrée, filtre de tendance activé/désactivé, réduire/augmenter le risque."
  ],
  "unsupportedText": [
    " 요청하신 {items}은 아직 규칙 엔진이 지원하지 않아 적용할 수 없어요.",
    " The {items} you requested is not supported by the rule engine yet, so it can't be applied.",
    " ご要望の{items}はまだルールエンジンが対応しておらず、適用できません。",
    " 你请求的{items}规则引擎尚不支持，无法应用。",
    " 你請求的{items}規則引擎尚不支援，無法套用。",
    " El {items} que has solicitado todavía no lo admite el motor de reglas, así que no se puede aplicar.",
    " Le {items} demandé n'est pas encore pris en charge par le moteur de règles, il ne peut donc pas être appliqué."
  ],
  "stopTitle": [
    "손절 기준",
    "Stop-loss rule",
    "損切り基準",
    "止损标准",
    "停損標準",
    "Criterio de stop loss",
    "Critère de stop-loss"
  ],
  "stopText": [
    "이 전략의 손절선은 진입가 대비 {stop}%예요. 검증 구간에서 이 규칙이 최대 낙폭을 {mdd}% 안에서 관리했고, 손절 청산은 총 {count}회 실행됐어요. 손절 폭을 좁히면 낙폭은 줄지만 거래가 짧게 끊길 수 있어요. \"손절 -3%로 바꿔줘\"라고 하면 실제 재검증 수치로 비교해드려요.",
    "This strategy's stop-loss line is {stop}% from the entry price. In the validation period this rule kept the max drawdown within {mdd}%, and stop-loss exits were executed {count} times in total. A tighter stop reduces drawdown but can cut trades short. Say \"손절 -3%로 바꿔줘\" and we'll compare it with the actual re-validation numbers.",
    "この戦略の損切りラインはエントリー価格に対して{stop}%です。検証区間ではこのルールが最大ドローダウンを{mdd}%以内に抑え、損切り決済は合計{count}回実行されました。損切り幅を狭めるとドローダウンは減りますが、取引が早く途切れることがあります。「손절 -3%로 바꿔줘」と伝えると、実際の再検証数値で比較します。",
    "该策略的止损线为相对入场价 {stop}%。在验证区间内，该规则将最大回撤控制在 {mdd}% 以内，止损平仓共执行 {count} 次。收窄止损幅度可以减小回撤，但交易可能被提前中断。说“손절 -3%로 바꿔줘”，就会用实际重新验证的数值进行比较。",
    "此策略的停損線為相對進場價 {stop}%。在驗證區間內，該規則將最大回撤控制在 {mdd}% 以內，停損平倉共執行 {count} 次。收窄停損幅度可以減小回撤，但交易可能被提前中斷。說「손절 -3%로 바꿔줘」，就會用實際重新驗證的數值進行比較。",
    "La línea de stop loss de esta estrategia es del {stop}% respecto al precio de entrada. En el periodo de validación esta regla mantuvo la caída máxima dentro del {mdd}% y las salidas por stop loss se ejecutaron {count} veces en total. Un stop más ajustado reduce la caída, pero puede cortar las operaciones antes. Di \"손절 -3%로 바꿔줘\" y lo compararemos con las cifras reales de revalidación.",
    "La ligne de stop-loss de cette stratégie est à {stop}% du prix d'entrée. Sur la période de validation, cette règle a contenu la perte maximale à {mdd}% et les sorties au stop-loss ont été exécutées {count} fois au total. Un stop plus serré réduit la perte maximale mais peut écourter les opérations. Dites « 손절 -3%로 바꿔줘 » et nous comparerons avec les chiffres réels de revalidation."
  ],
  "recentTitle": [
    "최근 판단",
    "Recent decision",
    "最近の判断",
    "最近判断",
    "最近判斷",
    "Decisión reciente",
    "Décision récente"
  ],
  "recentText": [
    "마지막 평가: {last}. 현재 설정은 전봉 RSI {rsi} 미만 + 반등 확인 진입, 손절 {stop}%{target} 규칙이에요. 검증 성과는 수익 {ret}, MDD {mdd}%, 승률 {winRate}%입니다.",
    "Last evaluation: {last}. The current setup enters on a confirmed rebound with the previous bar's RSI below {rsi}, with a {stop}% stop-loss{target}. Validation results: return {ret}, MDD {mdd}%, win rate {winRate}%.",
    "最後の評価：{last}。現在の設定は前足RSI {rsi} 未満＋反発確認でエントリー、損切り {stop}%{target} のルールです。検証成績は収益 {ret}、MDD {mdd}%、勝率 {winRate}% です。",
    "最后一次评估：{last}。当前设置为前一根K线 RSI 低于 {rsi} + 确认反弹入场，止损 {stop}%{target} 规则。验证成绩为收益 {ret}、MDD {mdd}%、胜率 {winRate}%。",
    "最後一次評估：{last}。目前設定為前一根K線 RSI 低於 {rsi} + 確認反彈進場，停損 {stop}%{target} 規則。驗證成績為收益 {ret}、MDD {mdd}%、勝率 {winRate}%。",
    "Última evaluación: {last}. La configuración actual entra al confirmarse el rebote con el RSI de la vela anterior por debajo de {rsi}, con un stop loss del {stop}%{target}. Resultados de validación: rentabilidad {ret}, MDD {mdd}%, tasa de acierto {winRate}%.",
    "Dernière évaluation : {last}. La configuration actuelle entre sur rebond confirmé avec le RSI de la bougie précédente sous {rsi}, avec un stop-loss de {stop}%{target}. Résultats de validation : rendement {ret}, MDD {mdd}%, taux de réussite {winRate}%."
  ],
  "targetClause": [
    ", 익절 +{target}%",
    ", take profit +{target}%",
    "、利確 +{target}%",
    "，止盈 +{target}%",
    "，停利 +{target}%",
    ", take profit +{target}%",
    ", take-profit +{target}%"
  ],
  "noRecord": [
    "기록 없음",
    "No record",
    "記録なし",
    "无记录",
    "無紀錄",
    "Sin registro",
    "Aucun enregistrement"
  ],
  "comparisonRegion": [
    "전략 변경안 비교",
    "Strategy change proposal comparison",
    "戦略変更案の比較",
    "策略变更方案对比",
    "策略變更方案對比",
    "Comparación de la propuesta de cambio de estrategia",
    "Comparaison de la proposition de modification de la stratégie"
  ],
  "deepAnalysis": [
    "채팅에서 깊게 분석 →",
    "Analyze in depth in chat →",
    "チャットで詳しく分析 →",
    "在聊天中深入分析 →",
    "在聊天中深入分析 →",
    "Analizar en detalle en el chat →",
    "Analyser en détail dans le chat →"
  ],
  "discuss": [
    "채팅에서 논의 →",
    "Discuss in chat →",
    "チャットで相談 →",
    "在聊天中讨论 →",
    "在聊天中討論 →",
    "Comentar en el chat →",
    "Discuter dans le chat →"
  ],
  "updated": [
    "전략이 업데이트됐어요. 새 설정과 실행 상태를 확인해주세요.",
    "The strategy was updated. Check the new settings and the run state.",
    "戦略が更新されました。新しい設定と実行状態を確認してください。",
    "策略已更新。请确认新设置和运行状态。",
    "策略已更新。請確認新設定與執行狀態。",
    "La estrategia se ha actualizado. Comprueba los nuevos ajustes y el estado de ejecución.",
    "La stratégie a été mise à jour. Vérifiez les nouveaux paramètres et l'état d'exécution."
  ]
} as const satisfies Record<string, Translations>

export function sourceProposalText(language: ClientLanguage, key: keyof typeof sourceProposalCopy, values: Readonly<Record<string, string>> = {}): string {
  return sourceProposalCopy[key][column[language]].replace(/\{(\w+)\}/g, (token, name: string) => Object.hasOwn(values, name) ? values[name] : token)
}

/** Labels follow preferences; source-preview parser commands never follow translated labels. */
export const sourceAgentPresets = [
  { key: 'whyEntry', request: '왜 아직 진입 안 했어?' },
  { key: 'largestRisk', request: '지금 가장 큰 리스크는?' },
  { key: 'nextEntry', request: '다음 진입 조건은?' },
  { key: 'reduceRisk', request: '리스크 낮춰줘' },
] as const satisfies readonly { key: keyof typeof sourceProposalCopy; request: string }[]
