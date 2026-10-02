import type { ClientLanguage } from './client-preferences'
import { researchDate } from './research-library'

// UI chrome only. Research titles, article bodies and follow prompts retain their source text.
const ko = {
  history: '연구 기록', schedule: '예약된 검증', ranking: '전략 랭킹', sharing: '전략 공유', brokers: '지원 거래소', insight: '인사이트',
  return: '대화로 돌아가기', insightError: '인사이트를 불러오지 못했어요. 대화는 그대로 유지됩니다.', insightLoading: '인사이트를 불러오는 중…',
  boundary: 'MOCK · 디자인 검토용 화면입니다. 실제 예약·공개·보상은 발생하지 않습니다.',
  search: "연구 기록 검색", clearSearch: '검색 지우기', recent: '최근', noResults: '검색 결과가 없어요', noHistory: "아직 연구 기록이 없습니다. 새 전략을 만들면 여기에 쌓입니다.",
  newStrategy: '＋ 새 전략', more: "아래로 내리면 더 불러옵니다", resultCount: '검색 결과 {count}개', weekly: '매주 월 09:00', holdout: '홀드아웃 재검증',
  scheduleDescription: '실행 중인 전략은 매주 최신 구간으로 자동 재검증됩니다.', noSchedule: '예약된 검증이 없어요. 전략을 실행하면 정기 재검증 일정이 여기에 표시됩니다.', scheduleDisconnected: '현재는 예약 서버가 연결되지 않았습니다.',
  rankingDescription: '검증을 통과한 공개 전략들이에요. 따라하기를 누르면 내 계정으로 같은 전략을 검증부터 다시 진행해요.',
  assetStrategy: '{asset} 전략', score: '{score}점', returnLabel: '검증 수익', followers: '팔로워 {count}', followLabel: '{nick} 전략 따라하기', follow: '따라하기', myPublic: '내 공개 전략', open: '열기',
  rankingFootnote: '점수·수익·팔로워는 클라이언트 원본의 샘플입니다. 따라하기는 검토할 문구를 입력창에 가져오며, 검증이나 주문을 자동 실행하지 않습니다.',
  sharingDescription: '내 전략을 공개하면 랭킹에 닉네임으로 노출돼요. 누가 내 전략을 따라하면 보상을 드려요 (요금의 10%)', previewLabel: '{title} 공개 미리보기',
  previewOn: '공개 미리보기를 켰습니다. 외부에 공유되지 않습니다.', previewOff: '공개 미리보기를 껐습니다.', previewError: '이 탭에 설정을 저장하지 못했습니다. 외부에 공유되지 않습니다.',
  reward: '팔로워 0명, 누적 보상 {amount}', noSharing: '공유할 전략이 아직 없어요. 채팅에서 전략을 맡기고 검증을 통과하면 여기서 공유할 수 있어요.',
  sharingFootnote: '공개·보상 설명은 원본 디자인 카피입니다. 실제 공유 기능과 보상 정책은 아직 제공되지 않습니다.', bitcoin: '비트코인', nasdaq: '나스닥',
}
export type ResearchCopyKey = keyof typeof ko
type ResearchCopy = Record<ResearchCopyKey, string>

/** Navigation keeps the original shorter Korean ranking label. */
export function researchNavigationLabel(language: ClientLanguage, page: 'history' | 'schedule' | 'ranking' | 'sharing' | 'brokers' | 'insight') {
  if (page === 'ranking' && language === 'ko') return '랭킹'
  return researchCopy(language, page)
}

export const CLIENT_RESEARCH_COPY: Record<ClientLanguage, ResearchCopy> = {
  ko,
  en: {
    history: 'Research history', schedule: 'Scheduled validations', ranking: 'Strategy rankings', sharing: 'Strategy sharing', brokers: 'Supported exchanges', insight: 'Insights',
    return: 'Back to conversation', insightError: 'Insights could not be loaded. Your conversation is preserved.', insightLoading: 'Loading insights…',
    boundary: 'MOCK · Design preview. No real scheduling, publishing or rewards occur.', search: "Search research history", clearSearch: 'Clear search', recent: 'Recent', noResults: 'No results found', noHistory: "No research history yet. New strategies will be recorded here.",
    newStrategy: '＋ New strategy', more: "Scroll down to load more.", resultCount: 'Search results: {count}', weekly: 'Every Mon at 09:00', holdout: 'Holdout revalidation', scheduleDescription: 'Running strategies are automatically revalidated each week using the latest period.', noSchedule: 'No scheduled validations. Regular revalidation schedules appear here when you run a strategy.', scheduleDisconnected: 'The scheduling server is not connected yet.',
    rankingDescription: 'These public strategies have passed validation. Follow a strategy to validate it again in your own account.', assetStrategy: '{asset} strategy', score: '{score} pts', returnLabel: 'Validation return', followers: 'Followers {count}', followLabel: 'Follow {nick}’s strategy', follow: 'Follow', myPublic: 'My public strategy', open: 'Open',
    rankingFootnote: 'Scores, returns and followers are samples from the original client design. Follow inserts text for review into the composer; it does not automatically run validation or place orders.',
    sharingDescription: 'Publish your strategy to appear in the rankings under your nickname. Receive rewards when someone follows your strategy (10% of the fee).', previewLabel: 'Public preview of {title}', previewOn: 'Public preview is on. Nothing is shared externally.', previewOff: 'Public preview is off.', previewError: 'Settings could not be saved in this tab. Nothing is shared externally.', reward: '0 followers, total rewards {amount}', noSharing: 'No strategy to share yet. Entrust a strategy in chat and pass validation to share it here.', sharingFootnote: 'Publishing and reward descriptions are original design copy. Actual sharing and reward policies are not available yet.', bitcoin: 'Bitcoin', nasdaq: 'Nasdaq',
  },
  ja: {
    history: '研究履歴', schedule: '検証スケジュール', ranking: '戦略ランキング', sharing: '戦略の共有', brokers: '対応取引所', insight: 'インサイト',
    return: '会話に戻る', insightError: 'インサイトを読み込めませんでした。会話は保持されています。', insightLoading: 'インサイトを読み込み中…',
    boundary: 'MOCK · デザイン確認用の画面です。実際の予約・公開・報酬は発生しません。', search: "研究履歴を検索", clearSearch: '検索をクリア', recent: '最近', noResults: '検索結果がありません', noHistory: "まだ研究履歴がありません。新しい戦略を作成するとここに蓄積されます。",
    newStrategy: '＋ 新しい戦略', more: "下にスクロールするとさらに読み込みます。", resultCount: '検索結果：{count}件', weekly: '毎週月曜 09:00', holdout: 'ホールドアウト再検証', scheduleDescription: '実行中の戦略は、毎週最新の期間で自動的に再検証されます。', noSchedule: '検証の予約はありません。戦略を実行すると、定期的な再検証の予定がここに表示されます。', scheduleDisconnected: '現在、予約サーバーには接続されていません。',
    rankingDescription: '検証を通過した公開戦略です。フォローすると、自分のアカウントで同じ戦略を検証からやり直せます。', assetStrategy: '{asset}戦略', score: '{score}点', returnLabel: '検証リターン', followers: 'フォロワー {count}', followLabel: '{nick}の戦略をフォロー', follow: 'フォロー', myPublic: '自分の公開戦略', open: '開く',
    rankingFootnote: 'スコア・リターン・フォロワーは元のクライアントデザインのサンプルです。フォローすると確認用の文面が入力欄に入り、検証や注文は自動実行されません。',
    sharingDescription: '戦略を公開するとニックネームでランキングに表示されます。他の人がフォローすると報酬を受け取れます（料金の10%）。', previewLabel: '{title}の公開プレビュー', previewOn: '公開プレビューをオンにしました。外部には共有されません。', previewOff: '公開プレビューをオフにしました。', previewError: 'このタブに設定を保存できませんでした。外部には共有されません。', reward: 'フォロワー0人、累計報酬 {amount}', noSharing: '共有する戦略はまだありません。チャットで戦略を任せ、検証を通過するとここから共有できます。', sharingFootnote: '公開・報酬の説明は元のデザイン文面です。実際の共有機能と報酬ポリシーはまだ提供されていません。', bitcoin: 'ビットコイン', nasdaq: 'ナスダック',
  },
  'zh-CN': {
    history: '研究记录', schedule: '验证计划', ranking: '策略排行', sharing: '策略分享', brokers: '支持的交易所', insight: '洞察', return: '返回对话', insightError: '无法加载洞察。您的对话已保留。', insightLoading: '正在加载洞察…',
    boundary: 'MOCK · 仅供设计预览。不会产生实际预约、发布或奖励。', search: "搜索研究记录", clearSearch: '清除搜索', recent: '最近', noResults: '没有搜索结果', noHistory: "暂无研究记录。创建新策略后将记录在此。", newStrategy: '＋ 新策略', more: "向下滚动加载更多。", resultCount: '搜索结果：{count}条', weekly: '每周一 09:00', holdout: '留出集重新验证', scheduleDescription: '运行中的策略每周会使用最新区间自动重新验证。', noSchedule: '暂无验证计划。运行策略后，定期重新验证的日程将显示在此处。', scheduleDisconnected: '预约服务器尚未连接。',
    rankingDescription: '这些公开策略已通过验证。点击跟随，即可在自己的账户中重新验证同一策略。', assetStrategy: '{asset}策略', score: '{score}分', returnLabel: '验证收益', followers: '关注者 {count}', followLabel: '跟随{nick}的策略', follow: '跟随', myPublic: '我的公开策略', open: '打开', rankingFootnote: '评分、收益和关注者均为原始客户端设计中的示例。跟随会将待审阅文字填入输入框，不会自动执行验证或下单。',
    sharingDescription: '发布策略后，将以昵称显示在排行榜中。有人跟随您的策略时，您将获得奖励（费用的10%）。', previewLabel: '{title}的公开预览', previewOn: '已开启公开预览。不会对外分享。', previewOff: '已关闭公开预览。', previewError: '无法在此标签页中保存设置。不会对外分享。', reward: '关注者0人，累计奖励 {amount}', noSharing: '暂无可分享的策略。在聊天中委托策略并通过验证后，即可在此分享。', sharingFootnote: '发布及奖励说明为原始设计文案。实际分享功能和奖励政策尚未提供。', bitcoin: '比特币', nasdaq: '纳斯达克',
  },
  'zh-TW': {
    history: '研究紀錄', schedule: '驗證排程', ranking: '策略排行', sharing: '策略分享', brokers: '支援的交易所', insight: '洞察', return: '返回對話', insightError: '無法載入洞察。您的對話已保留。', insightLoading: '正在載入洞察…',
    boundary: 'MOCK · 僅供設計預覽。不會產生實際預約、發布或獎勵。', search: "搜尋研究記錄", clearSearch: '清除搜尋', recent: '最近', noResults: '沒有搜尋結果', noHistory: "尚無研究記錄。建立新策略後將記錄在此。", newStrategy: '＋ 新策略', more: "向下滾動載入更多。", resultCount: '搜尋結果：{count}筆', weekly: '每週一 09:00', holdout: '保留集重新驗證', scheduleDescription: '執行中的策略每週會使用最新區間自動重新驗證。', noSchedule: '尚無驗證排程。執行策略後，定期重新驗證的時程將顯示於此處。', scheduleDisconnected: '預約伺服器尚未連線。',
    rankingDescription: '這些公開策略已通過驗證。點擊跟隨，即可在自己的帳戶中重新驗證相同策略。', assetStrategy: '{asset}策略', score: '{score}分', returnLabel: '驗證收益', followers: '追蹤者 {count}', followLabel: '跟隨{nick}的策略', follow: '跟隨', myPublic: '我的公開策略', open: '開啟', rankingFootnote: '評分、收益和追蹤者均為原始客戶端設計中的範例。跟隨會將待檢視文字填入輸入框，不會自動執行驗證或下單。',
    sharingDescription: '發布策略後，將以暱稱顯示在排行榜中。有人跟隨您的策略時，您將獲得獎勵（費用的10%）。', previewLabel: '{title}的公開預覽', previewOn: '已開啟公開預覽。不會對外分享。', previewOff: '已關閉公開預覽。', previewError: '無法在此分頁中儲存設定。不會對外分享。', reward: '追蹤者0人，累計獎勵 {amount}', noSharing: '尚無可分享的策略。在聊天中委託策略並通過驗證後，即可在此分享。', sharingFootnote: '發布及獎勵說明為原始設計文案。實際分享功能和獎勵政策尚未提供。', bitcoin: '比特幣', nasdaq: '納斯達克',
  },
  es: {
    history: 'Historial de investigación', schedule: 'Validaciones programadas', ranking: 'Clasificación de estrategias', sharing: 'Compartir estrategias', brokers: 'Plataformas compatibles', insight: 'Perspectivas', return: 'Volver a la conversación', insightError: 'No se pudieron cargar las perspectivas. Tu conversación se conserva.', insightLoading: 'Cargando perspectivas…',
    boundary: 'MOCK · Vista previa del diseño. No se realizan programaciones, publicaciones ni recompensas reales.', search: "Buscar historial de investigación", clearSearch: 'Borrar búsqueda', recent: 'Recientes', noResults: 'No hay resultados', noHistory: "Aún no hay historial de investigación. Las nuevas estrategias se registrarán aquí.", newStrategy: '＋ Nueva estrategia', more: "Desplácese hacia abajo para cargar más.", resultCount: 'Resultados: {count}', weekly: 'Cada lunes a las 09:00', holdout: 'Revalidación del conjunto reservado', scheduleDescription: 'Las estrategias en ejecución se revalidan automáticamente cada semana con el período más reciente.', noSchedule: 'No hay validaciones programadas. Al ejecutar una estrategia, su calendario de revalidación periódica aparecerá aquí.', scheduleDisconnected: 'El servidor de programación aún no está conectado.',
    rankingDescription: 'Estas estrategias públicas han superado la validación. Pulsa Seguir para volver a validar la misma estrategia en tu cuenta.', assetStrategy: 'Estrategia de {asset}', score: '{score} pts', returnLabel: 'Rentabilidad de validación', followers: 'Seguidores {count}', followLabel: 'Seguir la estrategia de {nick}', follow: 'Seguir', myPublic: 'Mi estrategia pública', open: 'Abrir', rankingFootnote: 'Las puntuaciones, rentabilidades y seguidores son ejemplos del diseño original. Seguir inserta texto para revisar en el cuadro de entrada; no ejecuta validaciones ni órdenes automáticamente.',
    sharingDescription: 'Publica tu estrategia para aparecer en la clasificación con tu apodo. Recibe recompensas cuando alguien la siga (el 10% de la tarifa).', previewLabel: 'Vista previa pública de {title}', previewOn: 'Vista previa pública activada. No se comparte nada externamente.', previewOff: 'Vista previa pública desactivada.', previewError: 'No se pudo guardar la configuración en esta pestaña. No se comparte nada externamente.', reward: '0 seguidores, recompensas acumuladas {amount}', noSharing: 'Aún no hay estrategias para compartir. Delega una estrategia en el chat y supera la validación para compartirla aquí.', sharingFootnote: 'Las descripciones de publicación y recompensas son textos del diseño original. Las funciones reales de compartir y las políticas de recompensas aún no están disponibles.', bitcoin: 'Bitcoin', nasdaq: 'Nasdaq',
  },
  fr: {
    history: 'Historique des recherches', schedule: 'Validations planifiées', ranking: 'Classement des stratégies', sharing: 'Partage de stratégies', brokers: 'Plateformes compatibles', insight: 'Éclairages', return: 'Revenir à la conversation', insightError: 'Impossible de charger les éclairages. Votre conversation est conservée.', insightLoading: 'Chargement des éclairages…',
    boundary: 'MOCK · Aperçu du design. Aucune planification, publication ou récompense réelle.', search: "Rechercher dans l'historique de recherche", clearSearch: 'Effacer la recherche', recent: 'Récentes', noResults: 'Aucun résultat', noHistory: "Aucun historique de recherche pour le moment. Les nouvelles stratégies seront enregistrées ici.", newStrategy: '＋ Nouvelle stratégie', more: "Faites défiler vers le bas pour en charger plus.", resultCount: 'Résultats : {count}', weekly: 'Chaque lundi à 09:00', holdout: 'Revalidation sur données réservées', scheduleDescription: 'Les stratégies en cours sont automatiquement revalidées chaque semaine sur la période la plus récente.', noSchedule: 'Aucune validation planifiée. Lancez une stratégie pour afficher ici son calendrier de revalidation périodique.', scheduleDisconnected: 'Le serveur de planification n’est pas encore connecté.',
    rankingDescription: 'Ces stratégies publiques ont passé la validation. Cliquez sur Suivre pour revalider la même stratégie dans votre compte.', assetStrategy: 'Stratégie {asset}', score: '{score} pts', returnLabel: 'Rendement de validation', followers: 'Abonnés {count}', followLabel: 'Suivre la stratégie de {nick}', follow: 'Suivre', myPublic: 'Ma stratégie publique', open: 'Ouvrir', rankingFootnote: 'Les scores, rendements et abonnés sont des exemples du design original. Suivre insère un texte à examiner dans le champ de saisie et ne lance aucune validation ni aucun ordre automatiquement.',
    sharingDescription: 'Publiez votre stratégie pour apparaître au classement sous votre pseudonyme. Recevez des récompenses lorsque quelqu’un la suit (10 % du tarif).', previewLabel: 'Aperçu public de {title}', previewOn: 'Aperçu public activé. Aucun partage externe.', previewOff: 'Aperçu public désactivé.', previewError: 'Impossible d’enregistrer les paramètres dans cet onglet. Aucun partage externe.', reward: '0 abonné, récompenses cumulées {amount}', noSharing: 'Aucune stratégie à partager pour le moment. Confiez une stratégie dans le chat et passez la validation pour la partager ici.', sharingFootnote: 'Les descriptions de publication et de récompenses proviennent du design original. Le partage réel et les politiques de récompenses ne sont pas encore disponibles.', bitcoin: 'Bitcoin', nasdaq: 'Nasdaq',
  },
}

export function researchCopy(language: ClientLanguage, key: ResearchCopyKey, values: Record<string, string | number> = {}) {
  return CLIENT_RESEARCH_COPY[language][key].replace(/\{(\w+)\}/g, (token, name: string) => String(values[name] ?? token))
}

export function localizedResearchDate(timestamp: number, language: ClientLanguage, now = new Date()) {
  if (language === 'ko') return researchDate(timestamp, now)
  const date = new Date(timestamp)
  if (!Number.isFinite(date.getTime())) return ''
  const day = (value: Date) => Date.UTC(value.getFullYear(), value.getMonth(), value.getDate())
  const elapsed = (day(now) - day(date)) / 86400000
  if (elapsed === 0 || elapsed === 1) return new Intl.RelativeTimeFormat(language, { numeric: 'auto' }).format(-elapsed, 'day')
  return new Intl.DateTimeFormat(language, { month: 'short', day: 'numeric', ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' as const } : {}) }).format(date)
}
