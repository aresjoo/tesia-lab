import source from './client-about-source.json' with { type: 'json' }
import type { ClientLanguage } from './client-preferences'

// Row order is the deduplicated, exact Korean source inventory. Tests require
// every locale to cover every row. Screenshots keep the authored Korean UI.
const en = `AI trading for people who trade
Describe your strategy, validate it on real market data, and run it in your existing exchange account.
Start for free
View pricing
Free forever, no card required
TETH terminal with chart and decision panel (Korean preview)
How it works
From conversation to execution, all in one place.
Conversation
Build a strategy in your own words
Share your idea and TETH structures it into a strategy with entry, exit and stop-loss conditions.
TETH asks about missing conditions first
Organized into entry, exit and stop-loss rules
Chart rules, AI decisions and hybrid strategies
Build a strategy
TETH strategy card with assets and trading conditions (Korean preview)
Validation
Validate with real data
Run your strategy on historical market data and see returns and risk in numbers.
From the latest three months to the full period
Returns and maximum drawdown
A record of every decision
View results
TETH backtest results with balance chart and decision history (Korean preview)
Connection
Keep your existing account
Choose an exchange and authorize the connection once; the strategy places orders in that account.
Seven exchanges available to connect
Connect with one authorization
Connection permissions: balance access and orders
Connect an exchange
TETH exchange selection screen (Korean preview)
Execution
Record the reasons behind decisions
The strategy watches the market around the clock and records why it bought or sold.
Round-the-clock automated execution
TETH’s view and decision history
Pause or emergency stop at any time
Open terminal
TETH terminal decision panel (Korean preview)
Choose how to use TETH
Choose the option that fits your exchange account.
TETH invited account
For people who trade
Use an exchange account registered through a TETH invitation. If you do not have one, register a new exchange account.
/ month
Included features
Automated strategy execution
Trading fee rebates
Strategy competition entry
No card registration
24-hour customer support
Bitget, Binance, OKX, Bybit and MEXC rebate 20% of trading fees; WOO X and Gate rebate 50%. Your TETH invitation status is checked during connection.
TETH subscription
Connect an exchange account that was not registered through TETH. Keep your existing account and run your strategies.
Start with a subscription
Subscription benefits
Connect without an invitation
Connect all seven exchanges
Billed automatically each month. Cancel at any time in Settings → Billing and keep access for the remainder of your subscription period.
Before you start
Trading limits
Set the amount and loss-stop conditions for each strategy yourself.
Validation period
Backtests use real market data for your selected period, shown alongside the results.
Connection permissions
Connect with balance access and order permissions. Disconnect at any time.
Decision history
The reason behind each trade is recorded for you to revisit.
Frequently asked questions
What is TETH?
An AI trading service for building strategies in your own words, validating them on real market data and running them on a connected exchange.
How are strategies executed?
Validated strategies run automatically in your connected exchange account. You approve before starting.
Which exchanges can I connect?
Connect Bitget, Binance, OKX, Bybit, MEXC, WOO X and Gate.
Where can I see backtest results?
Validate a strategy after creating it, then view returns, maximum drawdown and decision history in the results.
What permissions does the connection use?
Can I use it for free?
An exchange account registered through TETH qualifies as a TETH invited account. Free forever, with no card required.
Is there a mobile app?
iOS and Android apps are in preparation. Visit the
app download page
for updates.
Start with one idea. Build and validate a strategy, then run it on your existing exchange.
If you get stuck, support is available around the clock.
Ask support`.split('\n')

const ja = `トレードする人のためのAIトレーディング
言葉で戦略を作り、実際の市場データで検証し、今お使いの取引所口座で実行します。
無料で始める
料金を見る
ずっと無料、カード登録不要
TETHターミナルのチャートと判断パネル（韓国語プレビュー）
使い方
会話から実行まで、一か所でつながります。
会話
言葉で作る戦略
アイデアを伝えると、TETHがエントリー・決済・損切り条件を定めた戦略に整理します。
足りない条件はTETHから質問します
エントリー・決済・損切り条件に整理
チャートルール、AI判断、混合戦略
戦略を作る
資産と売買条件を示すTETH戦略カード（韓国語プレビュー）
検証
実際のデータで検証
過去の市場データで戦略を実行し、収益とリスクを数字で確認します。
直近3か月から全期間まで
収益率と最大下落幅
一回ごとの判断記録
結果を見る
残高チャートと判断記録を示すTETHバックテスト結果（韓国語プレビュー）
接続
今お使いの口座のまま
取引所を選んで一度承認すると、その口座で戦略が直接注文します。
接続可能な取引所7社
一度の承認で接続
接続権限：残高照会と注文
取引所を接続
TETH取引所選択画面（韓国語プレビュー）
実行
判断の根拠も記録
戦略が24時間市場を見て、売買の理由を文章で残します。
24時間自動実行
TETHの見解と判断記録
いつでも一時停止・緊急停止
ターミナルを開く
TETHターミナルの判断パネル（韓国語プレビュー）
利用方法を選びます
取引所口座に合った方法を選びます。
TETH招待口座
トレードする人のために
TETHの招待で登録した取引所口座で利用します。招待口座がなければ取引所に新規登録します。
/ 月
含まれる機能
戦略の自動実行
取引手数料の還元
戦略大会への参加
カード登録なしで利用
24時間カスタマーサポート
Bitget、Binance、OKX、Bybit、MEXCは取引手数料の20%、WOO XとGateは50%を還元します。接続時にTETH招待口座かどうかを確認します。
TETHサブスクリプション
TETHの招待で登録していない取引所口座も接続できます。既存の口座を維持して戦略を実行します。
サブスクリプションで始める
サブスクリプションの特典
招待登録なしで口座を接続
取引所7社すべてに接続
毎月自動決済されます。設定の支払いからいつでも解約でき、解約後も残りの契約期間中は利用できます。
利用前に確認します
取引上限
戦略ごとの利用金額と損失時の停止条件を自分で設定します。
検証期間
バックテストは選んだ期間の実際の市場データで行い、結果画面に期間も表示します。
接続権限
残高照会と注文権限で接続します。いつでも接続を解除できます。
判断記録
取引ごとの判断根拠を記録し、いつでも見返せます。
よくある質問
TETHはどんなサービスですか？
言葉で投資戦略を作り、実際の市場データで検証し、接続した取引所で実行するAIトレーディングサービスです。
戦略はどう実行しますか？
検証済みの戦略は接続した取引所口座で自動実行します。開始前に自分で承認します。
どの取引所を接続できますか？
Bitget、Binance、OKX、Bybit、MEXC、WOO X、Gateの7社を接続できます。
バックテスト結果はどこで確認できますか？
戦略を作ったら検証し、結果画面で収益率・最大下落幅・判断記録を確認できます。
接続にはどの権限を使いますか？
無料で利用できますか？
TETHの招待で登録した取引所口座はTETH招待口座として利用できます。ずっと無料、カード登録不要です。
モバイルアプリはありますか？
iOS・Androidアプリを準備しています。
アプリのダウンロードページ
で最新情報をご確認ください。
ひとつのアイデアから始めます。戦略を作って検証し、今お使いの取引所で実行します。
困ったときは24時間サポートが回答します。
サポートに聞く`.split('\n')

const zhCN = `为交易者打造的 AI 交易
用语言创建策略，通过真实市场数据验证，并在现有交易所账户中执行。
免费开始
查看价格
永久免费，无需绑卡
TETH 终端、图表和判断面板（韩语预览）
使用方式
从对话到执行，在同一处完成。
对话
用语言创建策略
描述想法，TETH 会整理为包含入场、平仓和止损条件的策略。
缺少的条件由 TETH 主动询问
整理为入场、平仓和止损条件
图表规则、AI 判断和混合策略
创建策略
TETH 策略卡、资产和买卖条件（韩语预览）
验证
使用真实数据验证
用历史市场数据运行策略，以数字查看收益和风险。
从最近三个月到完整期间
收益率和最大回撤
每次判断的记录
查看结果
TETH 回测结果、余额图表和判断记录（韩语预览）
连接
保留现有账户
选择交易所并授权一次，策略即可在该账户中直接下单。
可连接七家交易所
一次授权即可连接
连接权限：余额查询和下单
连接交易所
TETH 交易所选择界面（韩语预览）
执行
记录判断依据
策略全天关注市场，并用文字记录买卖原因。
全天自动执行
TETH 的观点和判断记录
随时暂停或紧急停止
打开终端
TETH 终端判断面板（韩语预览）
选择使用方式
选择适合交易所账户的方式。
TETH 邀请账户
为交易者打造
使用通过 TETH 邀请注册的交易所账户。如果还没有邀请账户，请新注册交易所账户。
/ 月
包含功能
自动执行策略
交易手续费返还
参加策略比赛
无需绑卡
24 小时客户支持
Bitget、Binance、OKX、Bybit 和 MEXC 返还交易手续费的 20%，WOO X 和 Gate 返还 50%。连接时会确认是否为 TETH 邀请账户。
TETH 订阅
也可连接未通过 TETH 邀请注册的交易所账户，保留现有账户执行策略。
通过订阅开始
订阅权益
无需邀请注册即可连接账户
连接全部七家交易所
每月自动扣款。可随时在设置的账单页面取消，取消后仍可使用至当前订阅期结束。
使用前请确认
交易限额
自行设置每个策略的投入金额和亏损停止条件。
验证期间
回测使用所选期间的真实市场数据，结果页面会同时显示期间。
连接权限
使用余额查询和下单权限连接，可随时断开。
判断记录
记录每笔交易的判断依据，随时回顾。
常见问题
TETH 是什么服务？
用语言创建投资策略，通过真实市场数据验证，并在已连接的交易所执行的 AI 交易服务。
如何执行策略？
验证后的策略在已连接的交易所账户中自动执行，开始前由您亲自批准。
可以连接哪些交易所？
可以连接 Bitget、Binance、OKX、Bybit、MEXC、WOO X 和 Gate 七家交易所。
在哪里查看回测结果？
创建策略后即可验证，并在结果页面查看收益率、最大回撤和判断记录。
连接需要哪些权限？
可以免费使用吗？
通过 TETH 邀请注册的交易所账户可作为 TETH 邀请账户使用，永久免费，无需绑卡。
有移动应用吗？
iOS 和 Android 应用正在筹备中，请在
应用下载页面
查看最新消息。
从一个想法开始。创建并验证策略，再在现有交易所中执行。
遇到问题，客服全天为您解答。
咨询客服`.split('\n')

const zhTW = `為交易者打造的 AI 交易
用語言建立策略，透過真實市場資料驗證，並在現有交易所帳戶中執行。
免費開始
查看價格
永久免費，無需綁卡
TETH 終端、圖表和判斷面板（韓語預覽）
使用方式
從對話到執行，在同一處完成。
對話
用語言建立策略
描述想法，TETH 會整理為包含進場、平倉和停損條件的策略。
缺少的條件由 TETH 主動詢問
整理為進場、平倉和停損條件
圖表規則、AI 判斷和混合策略
建立策略
TETH 策略卡、資產和買賣條件（韓語預覽）
驗證
使用真實資料驗證
用歷史市場資料執行策略，以數字查看報酬和風險。
從最近三個月到完整期間
報酬率和最大回撤
每次判斷的紀錄
查看結果
TETH 回測結果、餘額圖表和判斷紀錄（韓語預覽）
連接
保留現有帳戶
選擇交易所並授權一次，策略即可在該帳戶中直接下單。
可連接七家交易所
一次授權即可連接
連接權限：餘額查詢和下單
連接交易所
TETH 交易所選擇畫面（韓語預覽）
執行
記錄判斷依據
策略全天關注市場，並用文字記錄買賣原因。
全天自動執行
TETH 的觀點和判斷紀錄
隨時暫停或緊急停止
開啟終端
TETH 終端判斷面板（韓語預覽）
選擇使用方式
選擇適合交易所帳戶的方式。
TETH 邀請帳戶
為交易者打造
使用透過 TETH 邀請註冊的交易所帳戶。如果還沒有邀請帳戶，請新註冊交易所帳戶。
/ 月
包含功能
自動執行策略
交易手續費返還
參加策略比賽
無需綁卡
24 小時客戶支援
Bitget、Binance、OKX、Bybit 和 MEXC 返還交易手續費的 20%，WOO X 和 Gate 返還 50%。連接時會確認是否為 TETH 邀請帳戶。
TETH 訂閱
也可連接未透過 TETH 邀請註冊的交易所帳戶，保留現有帳戶執行策略。
透過訂閱開始
訂閱權益
無需邀請註冊即可連接帳戶
連接全部七家交易所
每月自動扣款。可隨時在設定的帳單頁面取消，取消後仍可使用至目前訂閱期結束。
使用前請確認
交易限額
自行設定每個策略的投入金額和虧損停止條件。
驗證期間
回測使用所選期間的真實市場資料，結果頁面會同時顯示期間。
連接權限
使用餘額查詢和下單權限連接，可隨時中斷連接。
判斷紀錄
記錄每筆交易的判斷依據，隨時回顧。
常見問題
TETH 是什麼服務？
用語言建立投資策略，透過真實市場資料驗證，並在已連接的交易所執行的 AI 交易服務。
如何執行策略？
驗證後的策略在已連接的交易所帳戶中自動執行，開始前由您親自核准。
可以連接哪些交易所？
可以連接 Bitget、Binance、OKX、Bybit、MEXC、WOO X 和 Gate 七家交易所。
在哪裡查看回測結果？
建立策略後即可驗證，並在結果頁面查看報酬率、最大回撤和判斷紀錄。
連接需要哪些權限？
可以免費使用嗎？
透過 TETH 邀請註冊的交易所帳戶可作為 TETH 邀請帳戶使用，永久免費，無需綁卡。
有行動應用程式嗎？
iOS 和 Android 應用程式正在籌備中，請在
應用程式下載頁面
查看最新消息。
從一個想法開始。建立並驗證策略，再在現有交易所中執行。
遇到問題，客服全天為您解答。
諮詢客服`.split('\n')

const es = `Trading con IA para quienes operan
Describe tu estrategia, valídala con datos reales del mercado y ejecútala en tu cuenta de exchange actual.
Empezar gratis
Ver precios
Gratis para siempre, sin tarjeta
Terminal TETH con gráfico y panel de decisiones (vista previa en coreano)
Cómo se usa
De la conversación a la ejecución, todo en un mismo lugar.
Conversación
Crea una estrategia con tus palabras
Cuenta tu idea y TETH la organiza en una estrategia con condiciones de entrada, salida y stop-loss.
TETH pregunta primero por las condiciones que faltan
Condiciones de entrada, salida y stop-loss
Reglas de gráficos, decisiones de IA y estrategias híbridas
Crear una estrategia
Tarjeta de estrategia TETH con activos y condiciones de compraventa (vista previa en coreano)
Validación
Valida con datos reales
Ejecuta la estrategia con datos históricos del mercado y consulta el rendimiento y el riesgo en cifras.
Desde los últimos tres meses hasta el período completo
Rentabilidad y caída máxima
Registro de cada decisión
Ver resultados
Resultados del backtest TETH con saldo y decisiones (vista previa en coreano)
Conexión
Conserva tu cuenta actual
Elige un exchange y autoriza la conexión una vez; la estrategia enviará órdenes directamente en esa cuenta.
Siete exchanges disponibles para conectar
Conecta con una sola autorización
Permisos de conexión: consulta de saldo y órdenes
Conectar un exchange
Pantalla de selección de exchange TETH (vista previa en coreano)
Ejecución
Registra los motivos de cada decisión
La estrategia observa el mercado las 24 horas y deja por escrito por qué compra o vende.
Ejecución automática las 24 horas
La perspectiva de TETH y el registro de decisiones
Pausa o parada de emergencia en cualquier momento
Abrir terminal
Panel de decisiones del terminal TETH (vista previa en coreano)
Elige cómo usar TETH
Elige la opción adecuada para tu cuenta de exchange.
Cuenta invitada de TETH
Para quienes operan
Usa una cuenta de exchange registrada mediante una invitación de TETH. Si no tienes una cuenta invitada, registra una nueva en el exchange.
/ mes
Funciones incluidas
Ejecución automática de estrategias
Reembolso de comisiones de trading
Participación en concursos de estrategias
Sin registrar una tarjeta
Atención al cliente las 24 horas
Bitget, Binance, OKX, Bybit y MEXC reembolsan el 20% de las comisiones de trading; WOO X y Gate, el 50%. Al conectar se comprueba si la cuenta fue invitada por TETH.
Suscripción TETH
También puedes conectar una cuenta no registrada mediante TETH. Conserva tu cuenta actual y ejecuta tus estrategias.
Empezar con una suscripción
Ventajas de la suscripción
Conecta sin registrarte por invitación
Conecta los siete exchanges
Se cobra automáticamente cada mes. Cancela cuando quieras en Ajustes → Facturación y conserva el acceso hasta el final del período contratado.
Antes de empezar
Límites de trading
Define cuánto usar y cuándo detenerse por pérdidas en cada estrategia.
Período de validación
El backtest usa datos reales del período elegido, que aparece junto a los resultados.
Permisos de conexión
Conecta con permisos de consulta de saldo y órdenes. Puedes desconectar en cualquier momento.
Registro de decisiones
Se registra el motivo de cada operación para que puedas revisarlo.
Preguntas frecuentes
¿Qué servicio ofrece TETH?
Un servicio de trading con IA que crea estrategias con tus palabras, las valida con datos reales y las ejecuta en un exchange conectado.
¿Cómo se ejecutan las estrategias?
Las estrategias validadas se ejecutan automáticamente en tu cuenta conectada. Tú autorizas el inicio.
¿Qué exchanges puedo conectar?
Puedes conectar Bitget, Binance, OKX, Bybit, MEXC, WOO X y Gate.
¿Dónde consulto los resultados del backtest?
Valida la estrategia tras crearla y consulta la rentabilidad, la caída máxima y las decisiones en los resultados.
¿Qué permisos usa la conexión?
¿Puedo usarlo gratis?
Las cuentas registradas mediante una invitación de TETH se usan como cuentas invitadas de TETH. Gratis para siempre y sin tarjeta.
¿Hay una aplicación móvil?
Estamos preparando las aplicaciones para iOS y Android. Consulta la
página de descarga de la app
para conocer las novedades.
Empieza con una idea. Crea y valida una estrategia y ejecútala en tu exchange actual.
Si necesitas ayuda, el equipo responde las 24 horas.
Consultar con soporte`.split('\n')

const fr = `Le trading IA pour ceux qui tradent
Décrivez votre stratégie, validez-la sur des données de marché réelles et exécutez-la avec votre compte d’exchange actuel.
Commencer gratuitement
Voir les tarifs
Gratuit pour toujours, sans carte
Terminal TETH avec graphique et panneau de décisions (aperçu en coréen)
Comment l’utiliser
De la conversation à l’exécution, au même endroit.
Conversation
Créez une stratégie avec vos mots
Décrivez votre idée : TETH la structure en stratégie avec des conditions d’entrée, de sortie et de stop-loss.
TETH vous demande les conditions manquantes
Conditions d’entrée, de sortie et de stop-loss
Règles graphiques, décisions IA et stratégies hybrides
Créer une stratégie
Fiche de stratégie TETH avec actifs et conditions d’achat et de vente (aperçu en coréen)
Validation
Validez avec des données réelles
Exécutez votre stratégie sur les données historiques du marché et mesurez les rendements et les risques.
Des trois derniers mois à toute la période
Rendement et baisse maximale
Un historique de chaque décision
Voir les résultats
Résultats du backtest TETH avec solde et décisions (aperçu en coréen)
Connexion
Gardez votre compte actuel
Choisissez un exchange et autorisez la connexion une fois ; la stratégie passe ses ordres directement sur ce compte.
Sept exchanges disponibles à la connexion
Une seule autorisation pour se connecter
Autorisations : consultation du solde et ordres
Connecter un exchange
Écran de sélection d’exchange TETH (aperçu en coréen)
Exécution
Conservez les raisons de chaque décision
La stratégie observe le marché 24 h/24 et consigne par écrit les raisons de ses achats et ventes.
Exécution automatique 24 h/24
Le point de vue de TETH et l’historique des décisions
Pause ou arrêt d’urgence à tout moment
Ouvrir le terminal
Panneau de décisions du terminal TETH (aperçu en coréen)
Choisissez votre mode d’utilisation
Choisissez l’option adaptée à votre compte d’exchange.
Compte invité TETH
Pour ceux qui tradent
Utilisez un compte d’exchange créé sur invitation de TETH. Si vous n’en avez pas, créez un nouveau compte sur l’exchange.
/ mois
Fonctions incluses
Exécution automatique des stratégies
Remboursement des frais de trading
Participation aux concours de stratégies
Sans enregistrement de carte
Assistance client 24 h/24
Bitget, Binance, OKX, Bybit et MEXC remboursent 20 % des frais de trading ; WOO X et Gate, 50 %. Le statut de compte invité TETH est vérifié lors de la connexion.
Abonnement TETH
Connectez aussi un compte créé sans invitation TETH. Gardez votre compte actuel et exécutez vos stratégies.
Commencer avec un abonnement
Avantages de l’abonnement
Connexion sans inscription sur invitation
Connectez les sept exchanges
Facturation automatique mensuelle. Résiliez à tout moment dans Paramètres → Facturation et gardez l’accès jusqu’à la fin de la période souscrite.
Avant de commencer
Limites de trading
Définissez le montant et les conditions d’arrêt en cas de perte pour chaque stratégie.
Période de validation
Le backtest utilise les données réelles de la période choisie, affichée avec les résultats.
Autorisations de connexion
La connexion permet de consulter le solde et de passer des ordres. Déconnectez-vous à tout moment.
Historique des décisions
La raison de chaque transaction est enregistrée pour être consultée à nouveau.
Questions fréquentes
Quel service TETH propose-t-il ?
Un service de trading IA qui crée des stratégies avec vos mots, les valide sur des données réelles et les exécute sur un exchange connecté.
Comment les stratégies sont-elles exécutées ?
Les stratégies validées s’exécutent automatiquement sur votre compte connecté. Vous autorisez leur démarrage.
Quels exchanges puis-je connecter ?
Vous pouvez connecter Bitget, Binance, OKX, Bybit, MEXC, WOO X et Gate.
Où consulter les résultats du backtest ?
Validez la stratégie après sa création, puis consultez le rendement, la baisse maximale et les décisions dans les résultats.
Quelles autorisations la connexion utilise-t-elle ?
Puis-je l’utiliser gratuitement ?
Un compte créé sur invitation de TETH est un compte invité TETH. Gratuit pour toujours, sans carte.
Existe-t-il une application mobile ?
Les applications iOS et Android sont en préparation. Consultez la
page de téléchargement de l’application
pour les nouveautés.
Commencez par une idée. Créez et validez une stratégie, puis exécutez-la sur votre exchange actuel.
En cas de difficulté, l’assistance répond 24 h/24.
Contacter l’assistance`.split('\n')

const translations: Record<ClientLanguage, readonly string[]> = { ko: source.copy, en, ja, 'zh-CN': zhCN, 'zh-TW': zhTW, es, fr }
const indices = new Map(source.copy.map((text, index) => [text, index]))
export function aboutText(language: ClientLanguage, text: string): string {
  const index = indices.get(text)
  if (index === undefined) throw new Error('UNKNOWN_ABOUT_COPY')
  const translated = translations[language]?.[index]
  if (!translated) throw new Error('INCOMPLETE_ABOUT_LOCALE')
  return translated
}
export const aboutLocaleCoverage = (language: ClientLanguage) => translations[language]?.length === source.copy.length
