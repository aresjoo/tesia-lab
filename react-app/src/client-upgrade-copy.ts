import type { ClientLanguage } from './client-preferences'

// Display copy only. Source Korean, fixed offer credits and caller authority stay unchanged.
const languageIndex = { ko: 0, en: 1, ja: 2, 'zh-CN': 3, 'zh-TW': 4, es: 5, fr: 6 } as const satisfies Record<ClientLanguage, number>
// Shared upgrade flow copy. Tuple order: [ko, en, ja, zh-CN, zh-TW, es, fr]
export const UPGRADE_SHEET_COPY = {
  closeAccountNotice: ['계정 알림 닫기', 'Dismiss account notification', 'アカウント通知を閉じる', '关闭账户通知', '關閉帳戶通知', 'Cerrar notificación de cuenta', 'Fermer la notification de compte'],
  followTitle: ['이 전략을 따라하려면 연결이 필요해요', 'Connecting is required to follow this strategy', 'この戦略をフォローするには連携が必要です', '跟随该策略需要先连接', '跟隨此策略需要先連結', 'Necesitas conectar para seguir esta estrategia', 'Une liaison est nécessaire pour suivre cette stratégie'],
  followDescription: ['전략 설정을 복제해 내 조건으로 재검증한 뒤 실행해요. 계좌 미러링이 아니라 검증을 통과해야 실행됩니다.', 'We copy the strategy settings, re-validate them under your own conditions, and then run it. This is not account mirroring; it runs only after passing validation.', '戦略設定を複製し、自分の条件で再検証してから実行します。口座ミラーリングではなく、検証を通過してはじめて実行されます。', '复制策略设置，按你的条件重新验证后再执行。这不是账户镜像跟单，只有通过验证才会执行。', '複製策略設定，依你的條件重新驗證後再執行。這不是帳戶鏡像跟單，只有通過驗證才會執行。', 'Copiamos la configuración de la estrategia, la revalidamos con tus condiciones y luego la ejecutamos. No es duplicación de cuenta: solo se ejecuta si pasa la validación.', "Nous copions les réglages de la stratégie, les revalidons selon vos conditions, puis l'exécutons. Ce n'est pas une réplication de compte : l'exécution n'a lieu qu'après validation."],
  backtestTitle: ['검증을 통과했어요. 실행하려면 연결하세요', 'Validation passed. Connect to run it', '検証を通過しました。実行するには連携してください', '已通过验证。要执行请先连接', '已通過驗證。要執行請先連結', 'Validación superada. Conecta para ejecutarla', 'Validation réussie. Établissez la liaison pour l’exécuter'],
  backtestDescription: ['지금 연결하면 이 전략을 바로 실행 단계로 이어갈 수 있어요.', 'Connect now to take this strategy straight to the execution step.', '今連携すれば、この戦略をそのまま実行段階へ進められます。', '现在连接，就能把这个策略直接进入执行阶段。', '現在連結，就能把這個策略直接進入執行階段。', 'Si conectas ahora, puedes llevar esta estrategia directamente al paso de ejecución.', 'En établissant la liaison maintenant, vous pouvez passer directement cette stratégie à l’étape d’exécution.'],
  quotaTitle: ['무료 분석 사용량을 모두 썼어요', 'You have used all of your free analyses', '無料分析の利用回数をすべて使い切りました', '免费分析次数已全部用完', '免費分析次數已全部用完', 'Has usado todos tus análisis gratuitos', 'Vous avez utilisé toutes vos analyses gratuites'],
  quotaDescription: ['UID 를 연동(무료)하거나 구독하면 바로 계속할 수 있어요. 입력한 내용은 그대로 남아 있어요.', 'Link your UID (free) or subscribe to continue right away. What you entered stays as it is.', 'UID を連携（無料）するか、購読すればすぐに続けられます。入力した内容はそのまま残っています。', '免费绑定 UID 或订阅即可立即继续。你输入的内容会原样保留。', '免費綁定 UID 或訂閱即可立即繼續。你輸入的內容會原樣保留。', 'Vincula tu UID (gratis) o suscríbete para continuar de inmediato. Lo que escribiste se conserva tal cual.', 'Liez votre UID (gratuit) ou abonnez-vous pour continuer immédiatement. Ce que vous avez saisi reste intact.'],
  planTitle: ['PRO 로 업그레이드', 'Upgrade to PRO', 'PRO にアップグレード', '升级到 PRO', '升級到 PRO', 'Actualizar a PRO', 'Passer à PRO'],
  planDescription: ['UID 무료 연동 또는 구독으로 고급 분석을 계속 사용할 수 있어요.', 'You can keep using advanced analysis with free UID linking or a subscription.', 'UID の無料連携または購読で、高度な分析を使い続けられます。', '通过免费绑定 UID 或订阅，可以继续使用高级分析。', '透過免費綁定 UID 或訂閱，可以繼續使用進階分析。', 'Puedes seguir usando el análisis avanzado con la vinculación gratuita de UID o una suscripción.', 'Vous pouvez continuer à utiliser l’analyse avancée avec la liaison UID gratuite ou un abonnement.'],
  bkTitle: ['{name} 연결에는 플랜이 필요해요', 'Connecting {name} requires a plan', '{name} の連携にはプランが必要です', '连接 {name} 需要方案', '連結 {name} 需要方案', 'Conectar {name} requiere un plan', 'La liaison de {name} nécessite un forfait'],
  bkTitleFallback: ['연결에는 플랜이 필요해요', 'Connecting requires a plan', '連携にはプランが必要です', '连接需要方案', '連結需要方案', 'Conectar requiere un plan', 'La liaison nécessite un forfait'],
  bkDescription: ['UID 무료 연동 또는 구독으로 시작할 수 있어요. 연동은 1분이면 끝나요.', 'You can start with free UID linking or a subscription. Linking takes just a minute.', 'UID の無料連携または購読で始められます。連携は1分で終わります。', '可以通过免费绑定 UID 或订阅开始。绑定只需 1 分钟。', '可以透過免費綁定 UID 或訂閱開始。綁定只需 1 分鐘。', 'Puedes empezar con la vinculación gratuita de UID o una suscripción. Vincular solo toma 1 minuto.', 'Vous pouvez commencer avec la liaison UID gratuite ou un abonnement. La liaison prend 1 minute.'],
  closeLabel: ['닫기', 'Close', '閉じる', '关闭', '關閉', 'Cerrar', 'Fermer'],
  simulationBadge: ['시뮬레이션', 'Simulation', 'シミュレーション', '模拟', '模擬', 'Simulación', 'Simulation'],
  quotaRowLabel: ['무료 고급 분석', 'Free advanced analysis', '無料の高度な分析', '免费高级分析', '免費進階分析', 'Análisis avanzado gratuito', 'Analyse avancée gratuite'],
  quotaRowValue: ['{used} / 10회 사용', '{used} / 10 used', '{used} / 10回 使用', '已用 {used} / 10 次', '已用 {used} / 10 次', '{used} / 10 usados', '{used} / 10 utilisées'],
  quotaUnavailable: ['사용량이 제공되지 않았습니다.', 'Usage data was not provided.', '使用量が提供されませんでした。', '未提供使用量数据。', '未提供使用量資料。', 'No se proporcionaron datos de uso.', 'Les données d’utilisation n’ont pas été fournies.'],
  uidFreeBadge: ['무료', 'Free', '無料', '免费', '免費', 'Gratis', 'Gratuit'],
  uidTimeBadge: ['소요 1분', 'Takes 1 min', '所要1分', '耗时 1 分钟', '耗時 1 分鐘', 'Tarda 1 min', 'Dure 1 min'],
  uidCardTitle: ['UID 무료 연동 (Fast API)', 'Free UID linking (Fast API)', 'UID 無料連携（Fast API）', 'UID 免费绑定（Fast API）', 'UID 免費綁定（Fast API）', 'Vinculación gratuita de UID (Fast API)', 'Liaison UID gratuite (Fast API)'],
  uidCardAmount: ['1,000C', '1,000C', '1,000C', '1,000C', '1,000C', '1,000C', '1,000C'],
  uidCardGrant: ['지급', 'granted', '付与', '赠送', '贈送', 'otorgados', 'offerts'],
  uidCardNote: ['거래 1회 체결 시 무제한 전환', 'Switches to unlimited after 1 filled trade', '取引が1回約定すると無制限に移行', '成交 1 笔交易后转为无限', '成交 1 筆交易後轉為無限', 'Pasa a ilimitado con 1 operación ejecutada', 'Passe en illimité dès 1 transaction exécutée'],
  uidBullet1: ['거래소 UID 입력만으로 1분 연동', 'Link in 1 minute just by entering your exchange UID', '取引所の UID を入力するだけで1分で連携', '只需输入交易所 UID，1 分钟完成绑定', '只需輸入交易所 UID，1 分鐘完成綁定', 'Vincula en 1 minuto solo con introducir tu UID del exchange', 'Liaison en 1 minute avec le simple UID de la plateforme'],
  uidBullet2: ['출금 권한 없는 조회와 거래 전용', 'Read and trade only, no withdrawal permission', '出金権限なしの照会と取引専用', '仅查询与交易，无提现权限', '僅查詢與交易，無提領權限', 'Solo consulta y operativa, sin permiso de retiro', 'Consultation et trading uniquement, sans droit de retrait'],
  uidBullet3: ['PRO 심층 분석 100회분 크레딧', 'Credits for 100 PRO deep analyses', 'PRO 深層分析100回分のクレジット', '相当于 100 次 PRO 深度分析的额度', '相當於 100 次 PRO 深度分析的額度', 'Créditos para 100 análisis profundos PRO', 'Crédits pour 100 analyses approfondies PRO'],
  uidButton: ['무료로 연동하기', 'Link for free', '無料で連携する', '免费绑定', '免費綁定', 'Vincular gratis', 'Lier gratuitement'],
  uidUnavailable: ['UID 연동 기능을 준비 중이에요.', 'UID linking is being prepared.', 'UID 連携機能を準備中です。', 'UID 绑定功能正在准备中。', 'UID 綁定功能正在準備中。', 'La vinculación de UID está en preparación.', 'La liaison UID est en préparation.'],
  uidPending: ['연동 요청 중…', 'Requesting link…', '連携をリクエスト中…', '正在请求绑定…', '正在請求綁定…', 'Solicitando vinculación…', 'Demande de liaison…'],
  linkError: ['요청을 완료하지 못했습니다. 다시 시도해주세요.', 'The request could not be completed. Please try again.', 'リクエストを完了できませんでした。もう一度お試しください。', '请求未能完成。请重试。', '請求未能完成。請重試。', 'No se pudo completar la solicitud. Inténtalo de nuevo.', 'La demande n’a pas pu aboutir. Veuillez réessayer.'],
  subBadge: ['PRO 무제한', 'PRO unlimited', 'PRO 無制限', 'PRO 无限', 'PRO 無限', 'PRO ilimitado', 'PRO illimité'],
  subCardTitle: ['구독', 'Subscription', '購読', '订阅', '訂閱', 'Suscripción', 'Abonnement'],
  subCardAmount: ['무제한', 'Unlimited', '無制限', '无限', '無限', 'Ilimitado', 'Illimité'],
  subCardNote: ['모든 고급 분석, 차감 없음', 'All advanced analysis, no deductions', 'すべての高度な分析、消費なし', '全部高级分析，不扣次数', '全部進階分析，不扣次數', 'Todo el análisis avanzado, sin descontar usos', 'Toutes les analyses avancées, sans décompte'],
  subBullet1: ['AI 심층 분석 무제한', 'Unlimited AI deep analysis', 'AI 深層分析が無制限', 'AI 深度分析无限次', 'AI 深度分析無限次', 'Análisis profundo con IA ilimitado', 'Analyse approfondie par IA illimitée'],
  subBullet2: ['검증 통과 전략 실행', 'Run strategies that pass validation', '検証を通過した戦略の実行', '执行通过验证的策略', '執行通過驗證的策略', 'Ejecución de estrategias que pasan la validación', 'Exécution des stratégies ayant passé la validation'],
  subBullet3: ['알림, 복기, 정산 전체 이용', 'Full access to alerts, reviews, and settlement', '通知・振り返り・精算のすべてを利用', '通知、复盘、结算全部可用', '通知、復盤、結算全部可用', 'Acceso completo a alertas, revisiones y liquidación', 'Accès complet aux alertes, revues et règlements'],
  subButton: ['구독으로 업그레이드', 'Upgrade with a subscription', '購読でアップグレード', '订阅升级', '訂閱升級', 'Actualizar con suscripción', 'Passer à l’abonnement'],
  footerNote: ['체험 모드예요. 결제와 연동은 시뮬레이션이에요.', 'This is trial mode. Payment and linking are simulated.', '体験モードです。決済と連携はシミュレーションです。', '这是体验模式。支付与绑定均为模拟。', '這是體驗模式。付款與綁定均為模擬。', 'Es modo de prueba. El pago y la vinculación son simulados.', 'Mode démo. Le paiement et la liaison sont simulés.'],
  footerLater: ['나중에 하기', 'Maybe later', '後で行う', '稍后再说', '稍後再說', 'Más tarde', 'Plus tard'],
  subscribeFromPlanNotice: ['전략 검증을 통과하면 구독 단계로 이어져요. 채팅에서 전략을 맡겨보세요.', 'Once a strategy passes validation, it continues to the subscription step. Try delegating a strategy in chat.', '戦略の検証を通過すると購読ステップへ進みます。チャットで戦略を任せてみてください。', '策略通过验证后会进入订阅步骤。在聊天中试着委托策略吧。', '策略通過驗證後會進入訂閱步驟。在聊天中試著委託策略吧。', 'Cuando una estrategia pasa la validación, continúa al paso de suscripción. Prueba a delegar una estrategia en el chat.', 'Une fois la validation de la stratégie réussie, le parcours se poursuit vers l’étape d’abonnement. Essayez de déléguer une stratégie dans le chat.'],
} as const satisfies Record<string, readonly [string, string, string, string, string, string, string]>

export function upgradeText(language: ClientLanguage, key: keyof typeof UPGRADE_SHEET_COPY, values: { name?: string; used?: string } = {}): string {
  return UPGRADE_SHEET_COPY[key][languageIndex[language] ?? 0].replace(/\{(name|used)\}/g, (token, name: 'name' | 'used') => values[name] ?? token)
}
