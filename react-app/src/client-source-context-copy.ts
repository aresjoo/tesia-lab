import type { ClientLanguage } from './client-preferences'

type Translations = readonly [string, string, string, string, string, string, string]
const column = { ko: 0, en: 1, ja: 2, 'zh-CN': 3, 'zh-TW': 4, es: 5, fr: 6 } as const satisfies Record<ClientLanguage, number>
/** Source preview provenance/status only. Never evidence of a native service run. */
export const sourceContextCopy = {
  "unknownExchange": [
    "연결 거래소 미확인",
    "Connected exchange unconfirmed",
    "接続取引所は未確認",
    "未确认连接的交易所",
    "未確認連線的交易所",
    "Exchange conectado sin confirmar",
    "Plateforme d'échange connectée non confirmée"
  ],
  "context": [
    "검증과 판단 기록은 공통 합성 일봉 시뮬레이션이에요",
    "Validation and the decision log both use a shared synthetic daily-bar simulation",
    "検証と判断記録は共通の合成日足シミュレーションです",
    "验证与判断记录均为共用的合成日线模拟",
    "驗證與判斷紀錄均為共用的合成日線模擬",
    "La validación y el registro de decisiones usan una simulación sintética común de velas diarias",
    "La validation et le journal des décisions utilisent une simulation synthétique commune en bougies journalières"
  ],
  "paper": [
    "가상 실행",
    "Virtual run",
    "仮想実行",
    "虚拟执行",
    "虛擬執行",
    "Ejecución virtual",
    "Exécution virtuelle"
  ],
  "liveSimulation": [
    "라이브 (시뮬레이션)",
    "Live (simulation)",
    "ライブ（シミュレーション）",
    "实时（模拟）",
    "即時（模擬）",
    "En vivo (simulación)",
    "En direct (simulation)"
  ],
  "evaluating": [
    "최근 평가 방금 전, 다음 평가 다음 봉 (시뮬레이션 주기)",
    "Last evaluation just now, next evaluation at the next bar (simulation cycle)",
    "直近の評価はたった今、次の評価は次の足（シミュレーション周期）",
    "最近评估刚刚，下次评估在下一根K线（模拟周期）",
    "最近評估剛剛，下次評估在下一根K線（模擬週期）",
    "Última evaluación hace un instante, siguiente evaluación en la próxima vela (ciclo de simulación)",
    "Dernière évaluation à l'instant, prochaine évaluation à la bougie suivante (cycle de simulation)"
  ],
  "evaluationStopped": [
    "평가 중단됨",
    "Evaluation stopped",
    "評価停止",
    "评估已停止",
    "評估已停止",
    "Evaluación detenida",
    "Évaluation arrêtée"
  ],
  "evaluationWaiting": [
    "평가 대기",
    "Evaluation pending",
    "評価待ち",
    "等待评估",
    "等待評估",
    "Evaluación en espera",
    "Évaluation en attente"
  ],
  "sourceLabel": [
    "검증 구간 리플레이, 일봉 시뮬레이션",
    "Validation period replay, daily-bar simulation",
    "検証区間のリプレイ、日足シミュレーション",
    "验证区间回放，日线模拟",
    "驗證區間重播，日線模擬",
    "Repetición del periodo de validación, simulación de velas diarias",
    "Rejeu de la période de validation, simulation en bougies journalières"
  ],
  "railFooter": [
    "실행, 체결, 손익은 체험 모드 시뮬레이션이에요",
    "Runs, fills and P&L are all trial-mode simulation",
    "実行、約定、損益は体験モードのシミュレーションです",
    "执行、成交和盈亏都是体验模式的模拟",
    "執行、成交和損益都是體驗模式的模擬",
    "El funcionamiento, las ejecuciones y el resultado son simulación en modo de prueba",
    "Le fonctionnement, les exécutions et le résultat sont une simulation en mode découverte"
  ],
  "unavailable": [
    "전략 상태 변경이 연결되지 않았어요.",
    "Strategy status changes aren't connected.",
    "戦略の状態変更は接続されていません。",
    "未接入策略状态变更。",
    "未接上策略狀態變更。",
    "El cambio de estado de la estrategia no está conectado.",
    "La modification de l'état de la stratégie n'est pas connectée."
  ],
  "check": [
    "전략 상태를 확인해주세요",
    "Please check the strategy status",
    "戦略の状態を確認してください",
    "请确认策略状态",
    "請確認策略狀態",
    "Comprueba el estado de la estrategia",
    "Veuillez vérifier l'état de la stratégie"
  ],
  "notFound": [
    "전략을 찾을 수 없습니다.",
    "The strategy could not be found.",
    "戦略が見つかりません。",
    "找不到策略。",
    "找不到策略。",
    "No se encontró la estrategia.",
    "La stratégie est introuvable."
  ],
  "connectionRequired": [
    "연결 오류 상태예요. 먼저 다시 연결해주세요",
    "There's a connection error. Please reconnect first",
    "接続エラーの状態です。まず再接続してください",
    "处于连接错误状态。请先重新连接",
    "處於連線錯誤狀態。請先重新連線",
    "Hay un error de conexión. Vuelve a conectar primero",
    "Il y a une erreur de connexion. Veuillez d'abord vous reconnecter"
  ],
  "belowThreshold": [
    "재검증 점수 {score}점, 실행 기준(80점) 미달이에요. 전략을 수정해 기준을 넘겨주세요",
    "Re-validation score {score}, below the run threshold (80 points). Adjust the strategy to pass the threshold",
    "再検証スコア{score}点、実行基準（80点）未達です。戦略を修正して基準を超えてください",
    "重新验证评分 {score} 分，未达执行标准（80 分）。请修改策略以超过标准",
    "重新驗證評分 {score} 分，未達執行標準（80 分）。請修改策略以超過標準",
    "Puntuación de revalidación {score}, por debajo del umbral de ejecución (80 puntos). Ajusta la estrategia para superarlo",
    "Score de revalidation {score}, sous le seuil d'exécution (80 points). Modifiez la stratégie pour dépasser le seuil"
  ],
  "closeStatus": [
    "전략 상태 알림 닫기",
    "Dismiss the strategy status notice",
    "戦略の状態通知を閉じる",
    "关闭策略状态通知",
    "關閉策略狀態通知",
    "Cerrar el aviso de estado de la estrategia",
    "Fermer l'avis d'état de la stratégie"
  ],
  "close": [
    "닫기",
    "Close",
    "閉じる",
    "关闭",
    "關閉",
    "Cerrar",
    "Fermer"
  ]
} as const satisfies Record<string, Translations>

export function sourceContextText(language: ClientLanguage, key: keyof typeof sourceContextCopy, values: Readonly<Record<string, string>> = {}): string {
  return sourceContextCopy[key][column[language]].replace(/\{(\w+)\}/g, (token, name: string) => Object.hasOwn(values, name) ? values[name] : token)
}
