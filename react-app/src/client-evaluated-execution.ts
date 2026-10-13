import type { ClientLanguage } from './client-preferences'

export function evaluatedExecutionDestination(language: string, issued = false) {
  const actual = { ko: 'Bitget에서 실행', en: 'Execution on Bitget', ja: 'Bitgetで実行', 'zh-CN': '在Bitget执行', 'zh-TW': '於Bitget執行', es: 'Ejecución en Bitget', fr: 'Exécution sur Bitget' }
  return { venue: { name: 'Bitget', logo: 'bitget' as const }, name: 'Bitget', logo: '/assets/logos/bitget-512.png', label: issued ? actual[language as ClientLanguage] ?? actual.en : 'Bitget' }
}

export function evaluatedExecutionHint(language: string, issued: boolean) {
  const hints = { ko: ['이 전략의 실행 대상 거래소입니다. 계좌 연결과 복사 설정에서 실행 상태를 확인합니다.', '승인된 전략의 실행 대상 거래소입니다. 복사하려면 이 거래소 계정을 연결해야 합니다.'], en: ['The execution venue for this strategy. Check execution status in account and copy settings.', 'The venue for the approved strategy. Connect an account there to copy it.'], ja: ['この戦略の実行先です。口座接続とコピー設定で実行状態を確認します。', '承認された戦略の実行先です。コピーにはこの取引所の口座が必要です。'], 'zh-CN': ['这是策略的执行平台，请在账户连接与复制设置中查看执行状态。', '这是已批准策略的执行平台，复制需连接该平台账户。'], 'zh-TW': ['這是策略的執行平台，請在帳戶連接與複製設定中查看執行狀態。', '這是已批准策略的執行平台，複製需連接該平台帳戶。'], es: ['Plataforma de ejecución de la estrategia. Compruebe el estado en la conexión y la configuración de copia.', 'Plataforma de la estrategia aprobada. Conecte una cuenta para copiarla.'], fr: ['Plateforme de la stratégie. Vérifiez son état dans la connexion et les paramètres de copie.', 'Plateforme de la stratégie approuvée. Connectez un compte pour la copier.'] }
  return (hints[language as ClientLanguage] ?? hints.en)[issued ? 1 : 0]
}


export function evaluatedExchangeFilterSummary(language: ClientLanguage, names: string, count: number) {
  const templates = {
    ko: ['{names} 전략 {count}개입니다.', '{names} 전략이 아직 없습니다.'],
    en: ['{count} strategies on {names}.', 'No strategies on {names} yet.'],
    ja: ['{names}の戦略が{count}件あります。', '{names}の戦略はまだありません。'],
    'zh-CN': ['有{count}个{names}策略。', '暂无{names}策略。'],
    'zh-TW': ['有{count}個{names}策略。', '尚無{names}策略。'],
    es: ['{count} estrategias en {names}.', 'Aún no hay estrategias en {names}.'],
    fr: ['{count} stratégies sur {names}.', 'Aucune stratégie sur {names} pour le moment.'],
  }
  return templates[language][count ? 0 : 1].replace('{names}', names).replace('{count}', count.toLocaleString(language))
}
