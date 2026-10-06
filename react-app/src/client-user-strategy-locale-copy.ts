import { Fragment, createElement, type ReactNode } from 'react'
import { useClientPreferences, type ClientLanguage } from './client-preferences'
import { delegationLocaleText } from './client-delegation-locale-copy'
import type { SourceTerminalParameters } from './client-terminal-source-fixture'
import { singularUiTemplate } from './client-static-ui-plural-copy'

type Row = readonly [string, string, string, string, string, string, string]
const languages: readonly ClientLanguage[] = ['ko','en','ja','zh-CN','zh-TW','es','fr']
export const userStrategyLocaleRows = [
  ['시작 대기','Ready to start','開始待ち','等待开始','等待開始','Lista para empezar','Prête à démarrer'],
  ['가상 실행','Paper trading','ペーパートレード','模拟运行','模擬執行','Trading simulado','Trading simulé'],
  ['라이브 (시뮬레이션)','Live (simulation)','ライブ（シミュレーション）','实盘（模拟）','實盤（模擬）','En vivo (simulación)','En direct (simulation)'],
  ['실행 일시정지','Pause execution','実行を一時停止','暂停执行','暫停執行','Pausar ejecución','Suspendre l’exécution'],
  ['라이브(시뮬레이션)로 전환','Switch to live (simulation)','ライブ（シミュレーション）に切替','切换为实盘（模拟）','切換為實盤（模擬）','Cambiar a en vivo (simulación)','Passer en direct (simulation)'],
  ['가상 시뮬레이션으로 전환','Switch to paper simulation','ペーパーシミュレーションに切替','切换为虚拟模拟','切換為虛擬模擬','Cambiar a simulación virtual','Passer en simulation virtuelle'],
  ['지금 시작하기','Start now','今すぐ開始','立即开始','立即開始','Empezar ahora','Commencer maintenant'],
  ['전략을 시작하면 검증 시뮬레이션 체결이 여기에 쌓여요.','Backtest simulation fills will appear here after you start the strategy.','戦略を開始すると検証シミュレーションの約定がここに表示されます。','启动策略后，回测模拟成交记录将显示在这里。','啟動策略後，回測模擬成交紀錄將顯示在這裡。','Las ejecuciones simuladas aparecerán aquí al iniciar la estrategia.','Les exécutions simulées apparaîtront ici après le lancement de la stratégie.'],
  ['신호가 발생해 체결이 확정되면 여기에 표시돼요.','Confirmed fills appear here when a signal triggers.','シグナルが発生し約定が確定するとここに表示されます。','信号触发并确认成交后将显示在这里。','訊號觸發並確認成交後將顯示在這裡。','Las ejecuciones confirmadas aparecerán aquí al generarse una señal.','Les exécutions confirmées apparaîtront ici lorsqu’un signal se déclenche.'],
  ['검증 기준 거래소','Backtest reference exchange','検証基準の取引所','回测参考交易所','回測參考交易所','Exchange de referencia del backtest','Plateforme de référence du backtest'],
  ['연결 거래소','Connected exchange','接続取引所','已连接交易所','已連接交易所','Exchange conectado','Plateforme connectée'],
  ['미연결','Not connected','未接続','未连接','未連接','Sin conexión','Non connectée'],
  ['실행 환경','Execution environment','実行環境','执行环境','執行環境','Entorno de ejecución','Environnement d’exécution'],
  ['실행 권한','Execution permission','実行権限','执行权限','執行權限','Permiso de ejecución','Droit d’exécution'],
  ['확인되지 않음','Not verified','未確認','未确认','未確認','Sin verificar','Non vérifié'],
  ['등록일','Created on','登録日','创建日期','建立日期','Fecha de creación','Date de création'],
  ['요청을 완료하지 못했어요. 다시 시도해 주세요.','Could not complete the request. Please try again.','リクエストを完了できませんでした。再試行してください。','无法完成请求，请重试。','無法完成請求，請重試。','No se pudo completar la solicitud. Inténtalo de nuevo.','Impossible de terminer la demande. Réessayez.'],
  ['RSI {0} 눌림 진입, 손절 {1}%, {2}{3}','RSI {0} pullback entry, stop loss {1}%, {2}{3}','RSI {0}の押し目でエントリー、損切り{1}%、{2}{3}','RSI {0}回调入场，止损{1}%，{2}{3}','RSI {0}回檔進場，停損{1}%，{2}{3}','Entrada en retroceso RSI {0}, stop loss {1}%, {2}{3}','Entrée sur repli RSI {0}, stop loss {1} %, {2}{3}'],
  ['익절 +{0}%','take profit +{0}%','利確+{0}%','止盈+{0}%','停利+{0}%','take profit +{0}%','take profit +{0} %'],
  [', 추세 필터',', trend filter','、トレンドフィルター','，趋势过滤','，趨勢過濾',', filtro de tendencia',', filtre de tendance'],
  ['진입','Entry','エントリー','入场','進場','Entrada','Entrée'],
  ['관망','Watching','様子見','观望','觀望','En espera','Observation'],
  ['보유 리스크','Position risk','保有リスク','持仓风险','持倉風險','Riesgo de posición','Risque de position'],
  ['진입 조건 충족: 전봉 RSI {0} < 임계 {1}, 반등 +{2}%{3}','Entry conditions met: previous-bar RSI {0} < threshold {1}, rebound +{2}%{3}','エントリー条件を充足：前足RSI {0} < 閾値{1}、反発+{2}%{3}','满足入场条件：前一根RSI {0} < 阈值{1}，反弹+{2}%{3}','滿足進場條件：前一根RSI {0} < 門檻{1}，反彈+{2}%{3}','Entrada confirmada: RSI previo {0} < umbral {1}, rebote +{2}%{3}','Conditions d’entrée remplies : RSI précédent {0} < seuil {1}, rebond +{2} %{3}'],
  [', 추세 필터 통과',', trend filter passed','、トレンドフィルター通過','，通过趋势过滤','，通過趨勢過濾',', filtro de tendencia superado',', filtre de tendance validé'],
  ['조건 미충족: 전봉 RSI {0} ≥ 임계 {1}','Conditions not met: previous-bar RSI {0} ≥ threshold {1}','条件未達：前足RSI {0} ≥ 閾値{1}','条件未满足：前一根RSI {0} ≥ 阈值{1}','條件未滿足：前一根RSI {0} ≥ 門檻{1}','Condiciones no cumplidas: RSI previo {0} ≥ umbral {1}','Conditions non remplies : RSI précédent {0} ≥ seuil {1}'],
  ['조건 미충족: 반등 미확인 ({0}% < +0.50%)','Conditions not met: rebound unconfirmed ({0}% < +0.50%)','条件未達：反発未確認（{0}% < +0.50%）','条件未满足：未确认反弹（{0}% < +0.50%）','條件未滿足：未確認反彈（{0}% < +0.50%）','Condiciones no cumplidas: rebote no confirmado ({0}% < +0.50%)','Conditions non remplies : rebond non confirmé ({0} % < +0.50 %)'],
  ['조건 미충족: 추세 필터 미충족 (이평 괴리 부족)','Conditions not met: trend filter failed (insufficient moving-average divergence)','条件未達：トレンドフィルター未充足（移動平均の乖離不足）','条件未满足：趋势过滤未通过（均线乖离不足）','條件未滿足：趨勢過濾未通過（均線乖離不足）','Condiciones no cumplidas: filtro de tendencia fallido (divergencia de medias insuficiente)','Conditions non remplies : filtre de tendance non validé (écart des moyennes insuffisant)'],
  ['손절선 {0}% 도달, 규칙대로 청산','Stop loss {0}% reached; exited according to the rule','損切りライン{0}%に到達、ルール通りに決済','达到{0}%止损线，按规则平仓','達到{0}%停損線，按規則平倉','Stop loss {0}% alcanzado; cierre según la regla','Stop loss {0} % atteint ; clôture selon la règle'],
  ['익절 목표 +{0}% 도달, 규칙대로 청산','Take profit +{0}% reached; exited according to the rule','利確目標+{0}%に到達、ルール通りに決済','达到+{0}%止盈目标，按规则平仓','達到+{0}%停利目標，按規則平倉','Take profit +{0}% alcanzado; cierre según la regla','Take profit +{0} % atteint ; clôture selon la règle'],
  ['보유 25봉 경과, 기간 청산 규칙 실행 ({0}%)','Held for 25 bars; time-exit rule executed ({0}%)','保有25足経過、期間決済ルールを実行（{0}%）','已持有25根K线，执行期限平仓规则（{0}%）','已持有25根K線，執行期限平倉規則（{0}%）','25 velas en posición; cierre temporal ejecutado ({0}%)','Position conservée 25 bougies ; clôture temporelle exécutée ({0} %)'],
  ['보유 중, 현재 {0}%, 손절 규칙 {1}%{2} 대기','Holding, current {0}%; awaiting stop loss {1}%{2}','保有中、現在{0}%、損切りルール{1}%{2}を待機','持仓中，当前{0}%，等待止损规则{1}%{2}','持倉中，目前{0}%，等待停損規則{1}%{2}','En posición, actual {0}%; esperando stop loss {1}%{2}','Position ouverte, résultat actuel {0} % ; attente du stop loss {1} %{2}'],
  [', 익절 +{0}%',', take profit +{0}%','、利確+{0}%','，止盈+{0}%','，停利+{0}%',', take profit +{0}%',', take profit +{0} %'],
  ['진입 체결 확인, 청산 규칙 감시 시작','Entry fill confirmed; monitoring exit rules','新規約定を確認、決済ルールの監視を開始','入场成交已确认，开始监控平仓规则','進場成交已確認，開始監控平倉規則','Entrada confirmada; vigilando reglas de salida','Exécution d’entrée confirmée ; surveillance des règles de sortie'],
  ['재검증 결과: TETH {score} ({verdict}), 검증 수익 {return}, 최대 낙폭 {drawdown}%, 체결 {count}회 {simulation}','Retest: TETH {score} ({verdict}), return {return}, maximum drawdown {drawdown}%, {count} fills {simulation}','再検証結果：TETH {score}（{verdict}）、検証リターン{return}、最大ドローダウン{drawdown}%、約定{count}回 {simulation}','重新回测结果：TETH {score}（{verdict}），回测收益{return}，最大回撤{drawdown}%，成交{count}次 {simulation}','重新回測結果：TETH {score}（{verdict}），回測收益{return}，最大回撤{drawdown}%，成交{count}次 {simulation}','Reevaluación: TETH {score} ({verdict}), rentabilidad {return}, caída máxima {drawdown}%, {count} ejecuciones {simulation}','Nouveau test : TETH {score} ({verdict}), rendement {return}, baisse maximale {drawdown} %, {count} exécutions {simulation}'],
] as const satisfies readonly Row[]
const rows = new Map<string, Row>(userStrategyLocaleRows.map(row => [row[0], row]))
export function userStrategyLocaleText(language: ClientLanguage, source: string, ...values: (string | number)[]) {
  const text = rows.get(source)?.[languages.indexOf(language)] ?? delegationLocaleText(language, source)
  return text.replace(/\{(\d+)\}/g, (slot, index: string) => values[Number(index)] === undefined ? slot : String(values[Number(index)]))
}
export function useUserStrategyLocaleText() {
  const { language } = useClientPreferences()
  return Object.assign((source: string, ...values: (string | number)[]) => userStrategyLocaleText(language, source, ...values), {
    rich: (source: string, values: Record<string, ReactNode>) => (singularUiTemplate(language, source, values) ?? userStrategyLocaleText(language, source)).split(/(\{\w+\})/g)
      .map((part, index) => createElement(Fragment, { key: index }, /^\{\w+\}$/.test(part) ? values[part.slice(1,-1)] ?? part : part)),
  })
}
export function userStrategyRuleText(language: ClientLanguage, parameters: SourceTerminalParameters, original: string) {
  if (language === 'ko') return original
  const t = (source: string, ...values: (string | number)[]) => userStrategyLocaleText(language, source, ...values)
  return t('RSI {0} 눌림 진입, 손절 {1}%, {2}{3}', parameters.rsiTh, parameters.sl,
    parameters.tp !== null ? t('익절 +{0}%', parameters.tp) : t('기간 청산'), parameters.trendFilter ? t(', 추세 필터') : '')
}

/** Exact original evaluator templates only. Not a translator for service logs
 * or user-authored prose; unknown source messages remain untouched. */
export function sourceActionLogLocaleText(language: ClientLanguage, source: string) {
  if (language === 'ko') return source
  const t = (key: string, ...values: (string | number)[]) => userStrategyLocaleText(language, key, ...values)
  let match: RegExpExecArray | null
  if ((match = /^진입 조건 충족: 전봉 RSI ([\d.]+) < 임계 ([\d.]+), 반등 \+([\d.]+)%(, 추세 필터 통과)?$/.exec(source))) return t('진입 조건 충족: 전봉 RSI {0} < 임계 {1}, 반등 +{2}%{3}', match[1],match[2],match[3],match[4] ? t(', 추세 필터 통과') : '')
  if ((match = /^조건 미충족: 전봉 RSI ([\d.]+) ≥ 임계 ([\d.]+)$/.exec(source))) return t('조건 미충족: 전봉 RSI {0} ≥ 임계 {1}',match[1],match[2])
  if ((match = /^조건 미충족: 반등 미확인 \((-?[\d.]+)% < \+0.50%\)$/.exec(source))) return t('조건 미충족: 반등 미확인 ({0}% < +0.50%)',match[1])
  if ((match = /^손절선 (-?[\d.]+)% 도달, 규칙대로 청산$/.exec(source))) return t('손절선 {0}% 도달, 규칙대로 청산',match[1])
  if ((match = /^익절 목표 \+([\d.]+)% 도달, 규칙대로 청산$/.exec(source))) return t('익절 목표 +{0}% 도달, 규칙대로 청산',match[1])
  if ((match = /^보유 25봉 경과, 기간 청산 규칙 실행 \(([+-]?[\d.]+)%\)$/.exec(source))) return t('보유 25봉 경과, 기간 청산 규칙 실행 ({0}%)',match[1])
  if ((match = /^보유 중, 현재 ([+-]?[\d.]+)%, 손절 규칙 (-?[\d.]+)%(?:, 익절 \+([\d.]+)%)? 대기$/.exec(source))) return t('보유 중, 현재 {0}%, 손절 규칙 {1}%{2} 대기',match[1],match[2],match[3] ? t(', 익절 +{0}%',match[3]) : '')
  return t(source)
}
