import type { ClientLanguage } from '../client-preferences'
import { conversationCopy } from '../client-conversation-copy-data'

// UI chrome only. Supplied titles, observations and document prose stay verbatim.
type Translations = readonly [string, string, string, string, string, string, string]
const column = { ko: 0, en: 1, ja: 2, 'zh-CN': 3, 'zh-TW': 4, es: 5, fr: 6 } as const satisfies Record<ClientLanguage, number>
export const nativeResearchCopy = {
  newStrategy: conversationCopy.newStrategy,
  running: conversationCopy.researchRunning,
  unavailable: ['연구 상태 미공급', 'Research status not supplied', '研究状況は未提供です', '未提供研究状态', '未提供研究狀態', 'Estado de investigación no proporcionado', 'État de la recherche non fourni'],
  paused: ['연구 일시 정지', 'Research paused', '研究を一時停止', '研究已暂停', '研究已暫停', 'Investigación en pausa', 'Recherche en pause'],
  completed: ['연구 완료', 'Research completed', '研究完了', '研究已完成', '研究已完成', 'Investigación completada', 'Recherche terminée'],
  failed: ['연구 실패', 'Research failed', '研究失敗', '研究失败', '研究失敗', 'Investigación fallida', 'Échec de la recherche'],
  stopped: ['중단됨', 'Stopped', '中断', '已中止', '已中止', 'Detenido', 'Arrêté'],
  logStopped: ['연구 중단됨', 'Research stopped', '研究を中断', '研究已中止', '研究已中止', 'Investigación detenida', 'Recherche arrêtée'],
  logCompleted: ['연구 기록 완료', 'Research log complete', '研究記録完了', '研究记录已完成', '研究紀錄已完成', 'Registro de investigación completo', 'Journal de recherche terminé'],
  replayPaused: ['재생 일시 정지', 'Playback paused', '再生を一時停止', '播放已暂停', '播放已暫停', 'Reproducción en pausa', 'Lecture en pause'],
  notSupplied: ['미공급', 'Not supplied', '未提供', '未提供', '未提供', 'No proporcionado', 'Non fourni'],
  waiting: ['대기', 'Waiting', '待機', '等待', '等待', 'En espera', 'En attente'],
  working: ['작업 중', 'Working', '作業中', '工作中', '工作中', 'En curso', 'En cours'],
  done: ['완료', 'Done', '完了', '完成', '完成', 'Completado', 'Terminé'],
  roleFailed: conversationCopy.failed,
  back: ['대화로 돌아가기', 'Back to conversation', '会話に戻る', '返回对话', '返回對話', 'Volver a la conversación', 'Retour à la conversation'],
  backDocument: ['문서로 돌아가기', 'Back to document', '文書に戻る', '返回文档', '返回文件', 'Volver al documento', 'Retour au document'],
  openArtifacts: ['{label} 열기', 'Open {label}', '{label}を開く', '打开{label}', '開啟{label}', 'Abrir {label}', 'Ouvrir {label}'],
  closeArtifacts: ['{label} 닫기', 'Close {label}', '{label}を閉じる', '关闭{label}', '關閉{label}', 'Cerrar {label}', 'Fermer {label}'],
  openedDocuments: ['열린 연구 문서', 'Open research documents', '開いている研究文書', '已打开的研究文档', '已開啟的研究文件', 'Documentos de investigación abiertos', 'Documents de recherche ouverts'],
  document: ['{label} 문서', '{label} document', '{label}文書', '{label}文档', '{label}文件', 'Documento {label}', 'Document {label}'],
  composerContext: ['컨텍스트, {label}', 'Context, {label}', 'コンテキスト、{label}', '上下文，{label}', '上下文，{label}', 'Contexto, {label}', 'Contexte, {label}'],
  newResponse: conversationCopy.newResponse,
  missingDocument: ['아직 공급된 {label} 문서가 없습니다.', 'No {label} document has been supplied yet.', '{label}文書はまだ提供されていません。', '尚未提供{label}文档。', '尚未提供{label}文件。', 'Aún no se ha proporcionado el documento {label}.', 'Aucun document {label} n’a encore été fourni.'],
  missingAnalysis: ['아직 공급된 분석 화면이 없습니다.', 'No analysis view has been supplied yet.', '分析画面はまだ提供されていません。', '尚未提供分析视图。', '尚未提供分析畫面。', 'Aún no se ha proporcionado una vista de análisis.', 'Aucune vue d’analyse n’a encore été fournie.'],
  chart: ['차트로 자세히 보기', 'View details in chart', 'チャートで詳しく見る', '在图表中查看详情', '在圖表中查看詳情', 'Ver detalles en el gráfico', 'Voir les détails sur le graphique'],
  log: ['연구 진행 기록', 'Research activity log', '研究進行記録', '研究进展记录', '研究進展紀錄', 'Registro de actividad de investigación', 'Journal d’activité de recherche'],
  missingLog: ['아직 공급된 연구 진행 기록이 없습니다.', 'No research activity records have been supplied yet.', '研究進行記録はまだ提供されていません。', '尚未提供研究进展记录。', '尚未提供研究進展紀錄。', 'Aún no se han proporcionado registros de investigación.', 'Aucun enregistrement d’activité de recherche n’a encore été fourni.'],
  elapsed: ['시작 후 {seconds}초', '{seconds} seconds since start', '開始から{seconds}秒', '开始后{seconds}秒', '開始後{seconds}秒', '{seconds} segundos desde el inicio', '{seconds} secondes depuis le début'],
  missingElapsed: ['경과 시간 미공급', 'Elapsed time not supplied', '経過時間は未提供です', '未提供已用时间', '未提供經過時間', 'Tiempo transcurrido no proporcionado', 'Temps écoulé non fourni'],
  warning: ['주의: ', 'Warning: ', '注意: ', '注意：', '注意：', 'Advertencia: ', 'Attention : '],
  failure: ['실패: ', 'Failed: ', '失敗: ', '失败：', '失敗：', 'Error: ', 'Échec : '],
  plain: ['쉽게 말하면', 'In plain language', '簡単に言うと', '简单来说', '簡單來說', 'En palabras sencillas', 'En termes simples'],
  professional: ['전문가용 원문', 'Professional wording', '専門家向け原文', '专业原文', '專業原文', 'Texto profesional', 'Texte professionnel'],
  meaning: ['의미', 'Meaning', '意味', '含义', '含義', 'Significado', 'Signification'],
  nextAction: ['다음 행동', 'Next action', '次の行動', '下一步行动', '下一步行動', 'Siguiente acción', 'Prochaine action'],
  completedStages: ['검증 {count}단계 완료', '{count} validation stages completed', '検証{count}段階完了', '已完成{count}个验证阶段', '已完成{count}個驗證階段', '{count} etapas de validación completadas', '{count} étapes de validation terminées'],
  strategyRevisions: ['전략 수정 {count}회', '{count} strategy revisions', '戦略修正{count}回', '策略修改{count}次', '策略修改{count}次', '{count} revisiones de estrategia', '{count} révisions de stratégie'],
  backtestRuns: ['백테스트 {count}회', '{count} backtests', 'バックテスト{count}回', '回测{count}次', '回測{count}次', '{count} backtests', '{count} backtests'],
  holdoutPassed: ['Holdout 통과', 'Holdout passed', 'ホールドアウト合格', '留出验证通过', '留出驗證通過', 'Holdout superado', 'Holdout réussi'],
  holdoutWarning: ['Holdout 경고', 'Holdout warning', 'ホールドアウト警告', '留出验证警告', '留出驗證警告', 'Advertencia de holdout', 'Avertissement du holdout'],
  missingCompletionSummary: ['완료 요약이 아직 제공되지 않았습니다.', 'The completion summary has not been supplied yet.', '完了サマリーはまだ提供されていません。', '尚未提供完成摘要。', '尚未提供完成摘要。', 'Aún no se ha proporcionado el resumen final.', 'Le résumé final n’a pas encore été fourni.'],
  openFinalReport: ['최종 보고서 열기', 'Open final report', '最終レポートを開く', '打开最终报告', '開啟最終報告', 'Abrir informe final', 'Ouvrir le rapport final'],
  reportUnavailable: ['최종 보고서가 아직 제공되지 않았습니다.', 'The final report has not been supplied yet.', '最終レポートはまだ提供されていません。', '尚未提供最终报告。', '尚未提供最終報告。', 'Aún no se ha proporcionado el informe final.', 'Le rapport final n’a pas encore été fourni.'],
  researchInterrupted: ['연구가 중단됐어요', 'Research was interrupted', '研究が中断されました', '研究已中断', '研究已中斷', 'La investigación se ha interrumpido', 'La recherche a été interrompue'],
  resumeResearch: ['이어서 진행', 'Continue research', '研究を再開', '继续研究', '繼續研究', 'Continuar investigación', 'Reprendre la recherche'],
  viewResearchPlan: ['연구 계획 보기', 'View research plan', '研究計画を見る', '查看研究计划', '查看研究計畫', 'Ver plan de investigación', 'Voir le plan de recherche'],
  resumePending: ['요청 중…', 'Requesting…', 'リクエスト中…', '正在请求…', '正在請求…', 'Solicitando…', 'Demande en cours…'],
  resumeSubmitted: ['재개 요청을 전달했습니다. 확인된 연구 상태를 기다리고 있습니다.', 'The resume request was sent. Waiting for the confirmed research state.', '再開リクエストを送信しました。確認済みの研究状況を待っています。', '已发送恢复请求，正在等待确认的研究状态。', '已傳送恢復請求，正在等待確認的研究狀態。', 'Se envió la solicitud de reanudación. Esperando el estado confirmado.', 'La demande de reprise a été envoyée. En attente de l’état confirmé.'],
  resumeFailed: ['연구를 재개하지 못했습니다. 다시 시도해주세요.', 'Could not resume research. Please try again.', '研究を再開できませんでした。もう一度お試しください。', '无法恢复研究，请重试。', '無法恢復研究，請重試。', 'No se pudo reanudar la investigación. Inténtalo de nuevo.', 'Impossible de reprendre la recherche. Réessayez.'],
  resumeUnavailable: ['연구 재개 기능이 아직 연결되지 않았습니다.', 'Research resumption is not connected yet.', '研究の再開機能はまだ接続されていません。', '研究恢复功能尚未连接。', '研究恢復功能尚未連接。', 'La reanudación de la investigación aún no está conectada.', 'La reprise de la recherche n’est pas encore connectée.'],
} as const satisfies Record<string, Translations>

export function nativeResearchText(language: ClientLanguage, key: keyof typeof nativeResearchCopy, values: Record<string, string | number> = {}): string {
  return nativeResearchCopy[key][column[language]].replace(/\{(\w+)\}/g, (placeholder, name: string) => Object.hasOwn(values, name) ? String(values[name]) : placeholder)
}
