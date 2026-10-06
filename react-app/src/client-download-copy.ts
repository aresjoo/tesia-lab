import type { ClientLanguage } from './client-preferences'

/** Korean copy: 9fbff821 download/index.html. Artwork follows the selected locale. */
const rows = {
  app: ['TETH 앱', 'TETH app', 'TETHアプリ', 'TETH 应用', 'TETH 應用程式', 'App de TETH', 'Application TETH'],
  stop: ['자동 넘김 멈추기', 'Stop automatic slides', '自動切り替えを停止', '停止自动切换', '停止自動切換', 'Detener el cambio automático', 'Arrêter le défilement automatique'],
  title: ['주머니 속 AI 트레이더', 'An AI trader in your pocket', 'ポケットの中のAIトレーダー', '口袋里的 AI 交易员', '口袋裡的 AI 交易員', 'Un trader de IA en tu bolsillo', 'Un trader IA dans votre poche'],
  description: ['전략을 만들고, 검증하고, 실행 중인 판단까지 휴대전화 하나로 봅니다.', 'Create strategies, validate them, and follow decisions during execution, all on your phone.', '戦略の作成、検証、実行中の判断まで、スマートフォンひとつで確認できます。', '用一部手机创建策略、验证策略，并查看执行中的判断。', '用一部手機建立策略、驗證策略，並查看執行中的判斷。', 'Crea estrategias, valídalas y sigue las decisiones durante la ejecución desde tu teléfono.', 'Créez des stratégies, validez-les et suivez les décisions pendant leur exécution depuis votre téléphone.'],
  start: ['시작하기', 'Get started', '始める', '开始使用', '開始使用', 'Comenzar', 'Commencer'],
  web: ['웹에서 바로 시작하기', 'Start on the web', 'ウェブで今すぐ始める', '直接在网页上开始', '直接在網頁上開始', 'Empezar en la web', 'Commencer sur le Web'],
  free: ['영원히 무료, 카드 등록 없음', 'Free forever, no card required', 'ずっと無料、カード登録不要', '永久免费，无需绑卡', '永久免費，無需綁卡', 'Gratis para siempre, sin tarjeta', 'Gratuit pour toujours, sans carte'],
  preview: ['TETH 모바일 앱 미리보기', 'TETH mobile app preview', 'TETHモバイルアプリのプレビュー', 'TETH 移动应用预览', 'TETH 行動應用程式預覽', 'Vista previa de la app móvil TETH', 'Aperçu de l’application mobile TETH'],
  chat: ['대화', 'Chat', '対話', '对话', '對話', 'Chat', 'Discussion'],
  report: ['검증', 'Validation', '検証', '验证', '驗證', 'Validación', 'Validation'],
  live: ['실행', 'Execution', '実行', '执行', '執行', 'Ejecución', 'Exécution'],
  chatCaption: ['말하면 진입, 청산, 손절 조건이 정해진 전략 카드로 정리합니다.', 'Describe your idea and get a strategy card with entry, exit and stop-loss conditions.', '話した内容を、エントリー・決済・損切り条件が決まった戦略カードにまとめます。', '描述想法，即可整理为包含入场、平仓和止损条件的策略卡。', '描述想法，即可整理為包含進場、平倉和停損條件的策略卡。', 'Describe tu idea y se organiza en una tarjeta con condiciones de entrada, salida y stop-loss.', 'Décrivez votre idée : elle est structurée en une fiche avec les conditions d’entrée, de sortie et de stop-loss.'],
  reportCaption: ['실제 시장 데이터로 돌린 결과를 수익률과 내려간 폭으로 봅니다.', 'View returns and drawdowns from testing on real market data.', '実際の市場データで検証した結果を、収益率と下落幅で確認します。', '通过收益率和回撤查看真实市场数据的测试结果。', '透過報酬率和回撤查看真實市場資料的測試結果。', 'Consulta la rentabilidad y las caídas de las pruebas con datos reales de mercado.', 'Consultez les rendements et les baisses des tests sur des données de marché réelles.'],
  liveCaption: ['보유 종목과 TETH의 생각, 판단 기록을 24시간 남깁니다.', 'Keep a round-the-clock record of holdings, TETH’s view and decisions.', '保有銘柄、TETHの見解、判断記録を24時間残します。', '全天记录持有品种、TETH 的观点和判断。', '全天記錄持有標的、TETH 的觀點和判斷。', 'Registra las posiciones, la perspectiva de TETH y sus decisiones las 24 horas.', 'Conservez 24 h/24 les positions, le point de vue de TETH et ses décisions.'],
  chatAlt: ['TETH 모바일 대화 화면, 전략 카드', 'TETH mobile chat and strategy card', 'TETHモバイル対話と戦略カード', 'TETH 移动对话与策略卡', 'TETH 行動對話與策略卡', 'Chat móvil y tarjeta de estrategia TETH', 'Discussion mobile et fiche de stratégie TETH'],
  reportAlt: ['TETH 모바일 백테스트 결과 화면', 'TETH mobile backtest results', 'TETHモバイルバックテスト結果', 'TETH 移动回测结果', 'TETH 行動回測結果', 'Resultados de backtest móvil TETH', 'Résultats du backtest mobile TETH'],
  liveAlt: ['TETH 모바일 터미널 판단 패널', 'TETH mobile terminal decision panel', 'TETHモバイルターミナル判断パネル', 'TETH 移动终端判断面板', 'TETH 行動終端判斷面板', 'Panel de decisiones del terminal móvil TETH', 'Panneau de décisions du terminal mobile TETH'],
  scan: ['휴대전화 카메라로 스캔해 설치합니다', 'Scan with your phone camera to install', 'スマートフォンのカメラで読み取ってインストール', '使用手机摄像头扫码安装', '使用手機相機掃碼安裝', 'Escanea con la cámara del teléfono para instalar', 'Scannez avec l’appareil photo de votre téléphone pour installer'],
  install: ['스토어에서 바로 설치합니다', 'Install directly from the store', 'ストアから直接インストール', '直接从商店安装', '直接從商店安裝', 'Instala directamente desde la tienda', 'Installez directement depuis la boutique'],
  pending: ['앱을 준비하고 있습니다.', 'The app is on the way.', 'アプリを準備中です。', '应用正在准备中。', '應用程式正在準備中。', 'La app está en preparación.', 'L’application est en préparation.'],
  pendingQr: ['출시 준비 중입니다', 'Preparing for launch', '公開準備中', '即将推出', '即將推出', 'Preparando el lanzamiento', 'Lancement en préparation'],
  help: ['막히면 상담원이 24시간 답합니다.', 'Support is available around the clock when you get stuck.', '困ったときは24時間サポートに相談できます。', '遇到问题时，客服全天候提供帮助。', '遇到問題時，客服全天候提供協助。', 'Si necesitas ayuda, el soporte está disponible las 24 horas.', 'Si vous avez besoin d’aide, l’assistance est disponible 24 h/24.'],
  ask: ['상담원에게 묻기', 'Ask support', 'サポートに相談', '咨询客服', '詢問客服', 'Consultar al soporte', 'Contacter l’assistance'],
} as const satisfies Record<string, readonly [string, string, string, string, string, string, string]>
const column = { ko: 0, en: 1, ja: 2, 'zh-CN': 3, 'zh-TW': 4, es: 5, fr: 6 } as const
export function downloadText(language: ClientLanguage, key: keyof typeof rows): string { return rows[key][column[language]] }
