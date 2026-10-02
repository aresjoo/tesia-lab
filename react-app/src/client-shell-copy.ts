import type { ClientLanguage } from './client-preferences'
import { researchNavigationLabel } from './client-research-copy'

// UI-only translations. The Korean client copy and user-authored text stay intact.
type Translations = readonly [string, string, string, string, string, string, string]
const languages: readonly ClientLanguage[] = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']
const copy = {
  menuBack: ['메뉴로 돌아가기', 'Back to menu', 'メニューに戻る', '返回菜单', '返回選單', 'Volver al menú', 'Retour au menu'],
  usage: ['이용 현황', 'Usage', '利用状況', '使用情况', '使用情況', 'Uso', 'Utilisation'],
  account: ['내 계정', 'My account', 'マイアカウント', '我的账户', '我的帳戶', 'Mi cuenta', 'Mon compte'],
  profile: ['프로필', 'Profile', 'プロフィール', '个人资料', '個人資料', 'Perfil', 'Profil'],
  logout: ['로그아웃', 'Log out', 'ログアウト', '退出登录', '登出', 'Cerrar sesión', 'Se déconnecter'],
  planCredits: ['PLAN 및 크레딧', 'PLAN and credits', 'PLAN とクレジット', 'PLAN 与积分', 'PLAN 與點數', 'PLAN y créditos', 'PLAN et crédits'],
  dashboard: ['내 전략 대시보드 열기', 'Open my strategy dashboard', '戦略ダッシュボードを開く', '打开策略面板', '開啟策略面板', 'Abrir mi panel de estrategias', 'Ouvrir mon tableau de bord de stratégies'],
  sidebarLogin: ['사이드바 로그인', 'Log in from sidebar', 'サイドバーからログイン', '侧栏登录', '側欄登入', 'Iniciar sesión desde el menú', 'Se connecter depuis le menu'],
  accountSettings: ['{name} 설정', '{name} settings', '{name}の設定', '{name}的设置', '{name}的設定', 'Configuración de {name}', 'Paramètres de {name}'],
  closeBanner: ['앱 배너 닫기', 'Dismiss app banner', 'アプリ案内を閉じる', '关闭应用横幅', '關閉應用程式橫幅', 'Cerrar aviso de la app', 'Fermer la bannière'],
  accountMenu: ['계정 메뉴', 'Account menu', 'アカウントメニュー', '账户菜单', '帳戶選單', 'Menú de cuenta', 'Menu du compte'],
  menu: ['TETH 메뉴', 'TETH menu', 'TETHメニュー', 'TETH菜单', 'TETH選單', 'Menú de TETH', 'Menu TETH'],
  home: ['TETH AI 홈', 'TETH AI home', 'TETH AIホーム', 'TETH AI首页', 'TETH AI首頁', 'Inicio de TETH AI', 'Accueil TETH AI'],
  researchMenu: ['리서치 메뉴', 'Research menu', 'リサーチメニュー', '研究菜单', '研究選單', 'Menú de investigación', 'Menu de recherche'],
  sidebarTrading: ['AI 트레이딩', 'AI trading', 'AIトレーディング', 'AI交易', 'AI交易', 'Trading con IA', 'Trading IA'],
  sidebarSharing: ['전략 복사', 'Copy strategies', '戦略コピー', '复制策略', '複製策略', 'Copiar estrategias', 'Copier des stratégies'],
  sidebarBrokers: ['거래소 연결', 'Connect an exchange', '取引所接続', '连接交易所', '連接交易所', 'Conectar un exchange', 'Connecter une plateforme'],
  trading: ['내 트레이딩', 'My trading', 'マイトレード', '我的交易', '我的交易', 'Mis operaciones', 'Mes opérations'],
  strategies: ['전략들', 'Strategies', '戦略', '策略', '策略', 'Estrategias', 'Stratégies'],
  recent: ['최근', 'Recent', '最近', '最近', '最近', 'Recientes', 'Récents'],
  recentEmpty: ['아직 없음', 'Nothing yet', 'まだありません', '暂无', '尚無', 'Aún no hay nada', 'Rien pour le moment'],
  liveList: ['Live 목록', 'Live list', 'Live 一覧', 'Live 列表', 'Live 清單', 'Lista Live', 'Liste Live'],
  newResearch: ['새 연구 시작', 'Start new research', '新しい研究を開始', '开始新研究', '開始新研究', 'Iniciar investigación', 'Nouvelle recherche'],
  researchList: ['Research 목록', 'Research list', 'リサーチ一覧', '研究列表', '研究清單', 'Lista de investigaciones', 'Liste des recherches'],
  emptyResearch: ['아직 연구 기록이 없어요.', 'No research yet.', '研究履歴はまだありません。', '暂无研究记录。', '尚無研究紀錄。', 'Aún no hay investigaciones.', 'Aucune recherche pour le moment.'],
  serviceMenu: ['서비스 메뉴', 'Service menu', 'サービスメニュー', '服务菜单', '服務選單', 'Menú de servicios', 'Menu des services'],
  closeMenu: ['메뉴 닫기', 'Close menu', 'メニューを閉じる', '关闭菜单', '關閉選單', 'Cerrar menú', 'Fermer le menu'],
  templates: ['투자 템플릿', 'Investment templates', '投資テンプレート', '投资模板', '投資範本', 'Plantillas de inversión', 'Modèles d’investissement'],
  selected: ['선택한 템플릿', 'Selected templates', '選択したテンプレート', '已选模板', '已選範本', 'Plantillas seleccionadas', 'Modèles sélectionnés'],
  remove: ['{name} 선택 해제', 'Remove {name}', '{name}の選択を解除', '取消选择{name}', '取消選取{name}', 'Quitar {name}', 'Retirer {name}'],
  limit: ['최대 {count}개까지 선택할 수 있어요', 'Select up to {count} templates', '最大{count}個まで選べます', '最多选择{count}个模板', '最多選取{count}個範本', 'Selecciona hasta {count} plantillas', 'Sélectionnez jusqu’à {count} modèles'],
  strong: ['강력', 'Powerful', '強力', '强大', '強大', 'Potente', 'Puissant'],
  auto: ['AI가 대신 거래', 'AI-managed trading', 'AIに取引を任せる', 'AI代为交易', 'AI代為交易', 'Trading gestionado por IA', 'Trading piloté par IA'],
  ind: ['지표 생성 후, 거래', 'Build indicators, then trade', '指標を作って取引', '创建指标后交易', '建立指標後交易', 'Crear indicadores y operar', 'Créer des indicateurs et trader'],
  rank: ['전략 랭킹', 'Strategy rankings', '戦略ランキング', '策略排名', '策略排名', 'Clasificación de estrategias', 'Classement des stratégies'],
  anal: ['시장/종목 분석', 'Market / asset analysis', '市場・銘柄分析', '市场/标的分析', '市場/標的分析', 'Análisis de mercados y activos', 'Analyse de marchés et d’actifs'],
  port: ['포트폴리오 분석', 'Portfolio analysis', 'ポートフォリオ分析', '投资组合分析', '投資組合分析', 'Análisis de cartera', 'Analyse de portefeuille'],
} as const satisfies Record<string, Translations>
export type ShellCopyKey = keyof typeof copy
export function shellText(language: ClientLanguage, key: ShellCopyKey, values: Record<string, string | number> = {}) {
  return copy[key][languages.indexOf(language)].replace(/\{(\w+)\}/g, (match, name: string) => String(values[name] ?? match))
}
export function homeTemplateLabel(language: ClientLanguage, id: string, original: string) {
  return ['auto', 'ind', 'rank', 'anal', 'port'].includes(id) ? shellText(language, id as ShellCopyKey) : original
}

/** Frozen9fb sidebar-only labels; headings and legacy consumers stay separate. */
export function sourceSidebarNavigationLabel(language: ClientLanguage, page: 'history' | 'trading' | 'sharing' | 'brokers') {
  if (page === 'history') return researchNavigationLabel(language, 'history')
  return shellText(language, page === 'trading' ? 'sidebarTrading' : page === 'sharing' ? 'sidebarSharing' : 'sidebarBrokers')
}
