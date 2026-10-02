import type { ClientLanguage } from '../client-preferences'
import { terminalReadText, type terminalReadCopy } from '../client-terminal-read-copy'

// Reuse the original seven-language labels. Only source-fixture claims are replaced.
const display = {
  nav: ['전략 NAV', 'Strategy NAV', '戦略NAV', '策略 NAV', '策略 NAV', 'NAV de la estrategia', 'NAV de la stratégie'],
  unavailable: ['아직 공급된 데이터가 없습니다.', 'Data has not been supplied yet.', 'データはまだ提供されていません。', '尚未提供数据。', '尚未提供資料。', 'Aún no se han proporcionado datos.', 'Les données ne sont pas encore fournies.'],
  positionUnavailable: ['현재 포지션 정보가 제공되지 않았습니다.', 'Current position data has not been supplied.', '現在のポジション情報は提供されていません。', '尚未提供当前持仓信息。', '尚未提供目前持倉資訊。', 'No se ha proporcionado la posición actual.', 'La position actuelle n’a pas été fournie.'],
  curveUnavailable: ['NAV 관측 데이터가 제공되지 않았습니다.', 'NAV observations have not been supplied.', 'NAV観測データは提供されていません。', '尚未提供 NAV 观测数据。', '尚未提供 NAV 觀測資料。', 'No se han proporcionado observaciones NAV.', 'Les observations NAV n’ont pas été fournies.'],
  curveInvalid: ['NAV 관측 데이터를 표시할 수 없습니다.', 'NAV observations cannot be displayed.', 'NAV観測データを表示できません。', '无法显示 NAV 观测数据。', '無法顯示 NAV 觀測資料。', 'No se pueden mostrar las observaciones NAV.', 'Les observations NAV ne peuvent pas être affichées.'],
  positionDetails: ['포지션 상세 보기', 'View position details', 'ポジション詳細を見る', '查看持仓详情', '查看持倉詳情', 'Ver detalles de la posición', 'Voir la position en détail'],
  observedNav: ['관측 NAV', 'Observed NAV', '観測NAV', '观测 NAV', '觀測 NAV', 'NAV observado', 'NAV observée'],
  chartKeys: ['좌우 화살표로 관측값을 확인하세요.', 'Use the left and right arrows to inspect observations.', '左右の矢印キーで観測値を確認できます。', '使用左右方向键查看观测值。', '使用左右方向鍵查看觀測值。', 'Usa las flechas izquierda y derecha para ver observaciones.', 'Utilisez les flèches gauche et droite pour consulter les observations.'],
} as const
type ExtraKey = keyof typeof display
export type NativeTerminalViewCopyKey = ExtraKey | keyof typeof terminalReadCopy
const columns = { ko: 0, en: 1, ja: 2, 'zh-CN': 3, 'zh-TW': 4, es: 5, fr: 6 } as const
export function nativeTerminalViewCopy(language: ClientLanguage, key: NativeTerminalViewCopyKey, values?: Readonly<Record<string, string>>): string {
  return key in display ? display[key as ExtraKey][columns[language]] : terminalReadText(language, key as keyof typeof terminalReadCopy, values)
}
