import type { ClientLanguage } from './client-preferences'

// Source layout is unchanged. Current service copy never promotes unconfigured
// providers, billing, illustrative balances or future execution to live facts.
const labels = {
  research: ['말로 투자 아이디어를 전략으로 정리하고 연구·검증합니다.', 'Turn investment ideas into strategies to research and validate.', '投資アイデアを戦略にまとめ、調査・検証します。', '将投资想法整理为策略，进行研究与验证。', '將投資想法整理為策略，進行研究與驗證。', 'Convierte ideas de inversión en estrategias para investigar y validar.', 'Transformez vos idées en stratégies à étudier et valider.'],
  connection: ['거래소 연결은 준비 중입니다. 연결 권한은 별도로 확인하고 승인합니다.', 'Exchange connections are being prepared. Connection permissions require a separate review and approval.', '取引所連携は準備中です。権限は別途確認・承認します。', '交易所连接正在准备中，权限需单独确认与批准。', '交易所連接正在準備中，權限需單獨確認與核准。', 'Las conexiones a exchanges están en preparación y requieren aprobación aparte.', 'Les connexions aux plateformes sont en préparation et nécessitent une approbation distincte.'],
  connectionLabel: ['거래소 연결 준비 중', 'Exchange connections coming soon', '取引所連携準備中', '交易所连接准备中', '交易所連接準備中', 'Conexiones en preparación', 'Connexions en préparation'],
  execution: ['자동 실행은 준비 중이며 현재 실제 주문을 실행하지 않습니다.', 'Automated execution is being prepared; real orders are not currently executed.', '自動実行は準備中で、現在は実際の注文を実行しません。', '自动执行正在准备中，目前不执行真实订单。', '自動執行正在準備中，目前不執行真實訂單。', 'La ejecución automática está en preparación; no se ejecutan órdenes reales actualmente.', "L’exécution automatique est en préparation ; aucun ordre réel n’est exécuté actuellement."],
  executionLabel: ['자동 실행 준비 중', 'Automated execution coming soon', '自動実行準備中', '自动执行准备中', '自動執行準備中', 'Ejecución automática en preparación', 'Exécution automatique en préparation'],
  support: ['문의하기', 'Contact support', 'お問い合わせ', '联系我们', '聯絡我們', 'Contactar con soporte', 'Contacter l’assistance'],
  refund: ['거래소 제휴와 환급 조건은 확정 후 안내합니다.', 'Exchange partnership and rebate terms will be announced when confirmed.', '提携・還元条件は確定後にご案内します。', '交易所合作与返还条件将在确认后公布。', '交易所合作與返還條件將在確認後公布。', 'Las condiciones de colaboración y reembolso se anunciarán cuando estén confirmadas.', 'Les conditions de partenariat et de remboursement seront annoncées après confirmation.'],
  refundLabel: ['제휴·환급 준비 중', 'Partnerships and rebates coming soon', '提携・還元準備中', '合作与返还准备中', '合作與返還準備中', 'Colaboración y reembolsos en preparación', 'Partenariats et remboursements en préparation'],
  billing: ['구독과 결제는 준비 중입니다. 현재 이 페이지에서 결제하거나 자동 청구하지 않습니다.', 'Subscriptions and billing are being prepared. This page does not currently charge or bill automatically.', '購読・決済は準備中です。このページでは現在課金しません。', '订阅与支付正在准备中，此页面目前不扣款或自动收费。', '訂閱與支付正在準備中，此頁面目前不扣款或自動收費。', 'Las suscripciones y pagos están en preparación; esta página no cobra actualmente.', 'Les abonnements et paiements sont en préparation ; cette page ne facture pas actuellement.'],
  billingLabel: ['TETH 구독 준비 중', 'TETH subscriptions coming soon', 'TETH購読準備中', 'TETH订阅准备中', 'TETH訂閱準備中', 'Suscripciones TETH en preparación', 'Abonnements TETH en préparation'],
  results: ['서버에서 연구·검증이 완료된 결과만 확인합니다. 결과가 준비되지 않으면 수익률을 표시하지 않습니다.', 'Only completed, server-confirmed research results are shown. Returns are not displayed when results are unavailable.', 'サーバーで検証が完了した結果のみを表示します。未確認の収益率は表示しません。', '仅显示服务器确认的研究验证结果，未准备好时不显示收益率。', '僅顯示伺服器確認的研究驗證結果，未準備好時不顯示收益率。', 'Solo se muestran resultados confirmados por el servidor; no se inventan rentabilidades.', 'Seuls les résultats confirmés par le serveur sont affichés ; aucun rendement n’est inventé.'],
} as const
const languageIndex = { ko: 0, en: 1, ja: 2, 'zh-CN': 3, 'zh-TW': 4, es: 5, fr: 6 } as const
const sourceKeys: Readonly<Record<string, keyof typeof labels>> = {
  "말로 전략을 만들고, 실제 시장 데이터로 검증하고, 지금 쓰는 거래소 계정에서 실행합니다.": "research",
  "말로 투자 전략을 만들고, 실제 시장 데이터로 검증하고, 연결한 거래소에서 실행하는 AI 트레이딩 서비스입니다.": "research",
  "아이디어 하나로 시작합니다. 전략을 만들고 검증한 뒤, 지금 쓰는 거래소에서 실행합니다.": "research",
  "대화에서 시작해 실행까지 한 곳에서 이어집니다.": "research",
  "거래소를 고르고 한 번 승인하면, 전략이 그 계정에서 직접 주문합니다.": "connection",
  "Bitget, Binance, OKX, Bybit, MEXC, WOO X, Gate 7곳을 연결합니다.": "connection",
  "잔고 조회와 주문 권한으로 연결합니다. 연결은 언제든 해제할 수 있습니다.": "connection",
  "연결 권한: 잔고 조회와 주문": "connection",
  "TETH 초대로 가입하지 않은 거래소 계정도 연결합니다. 기존 계정을 유지하며 전략을 실행합니다.": "connection",
  "연결 가능한 거래소 7곳": "connectionLabel",
  "거래소 7곳 모두 연결": "connectionLabel",
  "초대 가입 없이 계정 연결": "connectionLabel",
  "한 번 승인으로 연결": "connectionLabel",
  "거래소 연결하기": "connectionLabel",
  "검증을 마친 전략은 연결한 거래소 계정에서 자동으로 실행합니다. 시작 전에 직접 승인합니다.": "execution",
  "전략이 24시간 시장을 보고, 사고판 이유를 문장으로 남깁니다.": "execution",
  "언제든 일시정지와 긴급 정지": "executionLabel",
  "24시간 자동 실행": "executionLabel",
  "전략 자동 실행": "executionLabel",
  "24시간 고객 지원": "support",
  "막히면 상담원이 24시간 답합니다.": "support",
  "Bitget, Binance, OKX, Bybit, MEXC는 거래 수수료의 20%, WOO X과 Gate는 50%를 환급합니다. 연결 과정에서 TETH 초대 계정 여부를 확인합니다.": "refund",
  "TETH 초대로 가입한 거래소 계정이면 TETH 초대 계정으로 씁니다. 영원히 무료, 카드 등록 없음입니다.": "refund",
  "TETH 초대로 가입한 거래소 계정으로 이용합니다. 초대 계정이 없다면 거래소에 새로 가입합니다.": "refund",
  "TETH 초대 계정": "refundLabel",
  "거래 수수료 환급": "refundLabel",
  "매월 자동 결제됩니다. 설정의 결제에서 언제든 해지할 수 있으며, 해지 후에도 남은 구독 기간 동안 이용할 수 있습니다.": "billing",
  "TETH 구독": "billingLabel",
  "구독으로 시작하기": "billingLabel",
  "구독 혜택": "billingLabel",
  "전략을 만들면 바로 검증하고, 결과 화면에서 수익률, 가장 크게 내려간 폭, 판단 기록을 보여 줍니다.": "results"
}

export function servicePageCopy(language: ClientLanguage, key: string, original: string): string {
  const name = sourceKeys[key]
  return name ? labels[name][languageIndex[language]] : original
}
