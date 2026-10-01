// Codex s2 반영: 제목 32, 섹션 18, 카드는 검정 바탕 윤곽, 선택은 2px #9a9a9a, 앱과 같은 글꼴, 모바일 상담 단추가 본문을 가리지 않게, 정책 탭 줄바꿈
const fs=require('fs');
const R='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/';
const FONT='-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans KR","Apple SD Gothic Neo",sans-serif';
const MARK='/* s2 검수 반영 */';
const COMMON=`body{font-family:${FONT}!important}
@media (max-width:760px){ #teth-help,#teth-help-pop{display:none!important} }
.sub-help{max-width:1080px;margin:0 auto;padding:0 24px 56px;font-size:14px;color:#9a9a9a}
.sub-help a{color:#cdcdcd;text-decoration:underline;text-underline-offset:4px;margin-left:6px}
.sub-help a:hover{color:#fff}
@media (max-width:900px){ .sub-help{padding:0 16px 40px} }`;
const HELP='<p class="sub-help">막히면 상담원이 24시간 답합니다.<a href="../">상담원에게 묻기</a></p>\r\n';
function patch(rel,css,extra){
  const F=R+rel; let h=fs.readFileSync(F,'utf8');
  if(h.includes(MARK)){ console.log('skip',rel); return; }
  const i=h.lastIndexOf('</style>'); /* 각 페이지의 마지막 스타일 블록 끝에 덧붙임 */
  const head=h.indexOf('</head>'); if(i<0||i>head) throw new Error('style '+rel);
  h=h.slice(0,i)+'\n'+MARK+'\n'+COMMON+'\n'+css+'\n'+h.slice(i);
  if(extra) h=extra(h);
  fs.writeFileSync(F,h); console.log('ok',rel);
}
/* 소개 */
patch('about/index.html',`.ab-h1{font-size:32px;line-height:1.3}
.ab-sh{font-size:18px;line-height:1.5}
.ab-ss{font-size:16px}
.ab-card{background:transparent}
.pl-card{background:transparent}
.ab-hero{padding-top:112px}
@media (max-width:860px){ .ab-h1{font-size:28px} .ab-sh{font-size:18px} }`);
/* 다운로드 */
patch('download/index.html',`.dl-h1{font-size:32px;line-height:1.3}
.dl-stores{background:transparent}
.tabs button[aria-selected=true]{background:#303030;box-shadow:inset 0 0 0 2px #9a9a9a}
@media (max-width:900px){ .dl-h1{font-size:28px} }`,h=>h.includes('class="sub-help"')?h:h.replace('<div id="site-footer"></div>',HELP+'<div id="site-footer"></div>'));
/* 정책 */
patch('policies/index.html',`.pg-h1{font-size:32px;line-height:1.3}
.ov .cell,.sum{background:transparent}
.tabs a.on{background:#303030;box-shadow:inset 0 0 0 2px #9a9a9a}
@media (max-width:960px){
  .pg-h1{font-size:28px}
  .tabs{display:flex;flex-wrap:wrap;gap:8px;padding:0;border:0;border-radius:0;overflow:visible}
  .tabs a{border:1px solid rgba(255,255,255,.16)}
  .tabs a.on{border-color:transparent}
}`,h=>h.includes('class="sub-help"')?h:h.replace('<div id="site-footer"></div>',HELP+'<div id="site-footer"></div>'));
/* 인사이트 평가 단추 문구(해요체, 문장 어미 제거) */
const IF=R+'index.html'; let x=fs.readFileSync(IF,'utf8');
const a="[['0','👎','아니요'],['1','😐','조금요'],['2','👍','도움이 됐습니다']]";
if(x.includes(a)){ x=x.replace(a,"[['0','👎','도움 안 됨'],['1','😐','조금 도움'],['2','👍','도움 됨']]"); fs.writeFileSync(IF,x); console.log('ok fb'); } else console.log('fb skip');
