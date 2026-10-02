import type { ClientLanguage } from './client-preferences'
const rows={
 copy:['전략 복사하기','Copy strategy','戦略をコピー','复制策略','複製策略','Copiar estrategia','Copier la stratégie'],
 verify:['직접 검증하기','Backtest it yourself','自分で検証','自行回测','自行回測','Probar personalmente','Tester soi-même'],
 verifyLabel:['직접 검증하기, 백테스트','Backtest it yourself','自分で検証、バックテスト','自行验证，回测','自行驗證，回測','Probar personalmente, backtest','Tester soi-même, backtest'],
 more:['더 보기','More','その他','更多','更多','Más','Plus'],
 watch:['즐겨찾기','Favorite','お気に入り','收藏','收藏','Favorito','Favori'],
 unwatch:['즐겨찾기 해제','Remove favorite','お気に入りを解除','取消收藏','取消收藏','Quitar favorito','Retirer le favori'],
 copyLink:['링크 복사','Copy link','リンクをコピー','复制链接','複製連結','Copiar enlace','Copier le lien'],
 minimum:['최소 운용 금액','Minimum budget','最低運用金額','最低运作金额','最低運作金額','Presupuesto mínimo','Budget minimum'],
 since:['시작일','Start date','開始日','开始日期','開始日期','Fecha de inicio','Date de début'],
 venueHint:['이 전략의 주문이 실제로 나가는 거래소입니다. 복사하려면 이 거래소 계정을 연결해야 합니다.','The exchange this strategy uses. Connect an account there to copy it.','この戦略が使う取引所です。コピーにはこの取引所の口座接続が必要です。','此策略使用的交易所。复制前须连接该交易所账户。','此策略使用的交易所。複製前須連接該交易所帳戶。','El exchange que usa esta estrategia. Conecta una cuenta allí para copiarla.','La plateforme utilisée par cette stratégie. Connectez un compte pour la copier.'],
 strategies:['전략 복사','Copy strategies','戦略コピー','策略复制','策略複製','Copiar estrategias','Copier des stratégies'],
} as const
const languages:readonly ClientLanguage[]=['ko','en','ja','zh-CN','zh-TW','es','fr']
export function catalogueHeaderText(language:ClientLanguage,key:keyof typeof rows){return rows[key][languages.indexOf(language)]??rows[key][0]}
