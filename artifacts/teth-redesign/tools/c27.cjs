// 한 페이지 상세: Codex 검수(o1-codex.md)의 P1 다섯 건과 P2 일부
const fs=require('fs'), D=__dirname+'/';
const one=(s,x,y)=>{ const c=s.split(x).length-1; if(c!==1) throw new Error('x'+c+': '+x.slice(0,70)); return s.replace(x,()=>y); };
let s=fs.readFileSync(D+'rd-ui.js','utf8');
// P1-03 거래내역 전체로 가기, 돌아오기
s=one(s,"<button type=\"button\" class=\"mko-go\" onclick=\"tfSS3Go(\\''+ne+'\\',\\'all\\',\\'trades\\')\">","<button type=\"button\" class=\"mko-go\" onclick=\"mkGoTrades(\\''+ne+'\\')\">");
s=one(s,"<button type=\"button\" class=\"mk-lnk mko-back\" onclick=\"tfSS3Go(\\''+ne+'\\',\\'all\\',\\'ov\\')\">← 개요로</button>'","<button type=\"button\" class=\"mk-lnk mko-back\" onclick=\"mkBackOv(\\''+ne+'\\')\">← 개요로</button>'");
s=one(s,"+(o.length>MK_ORD_N?'<button type=\"button\" class=\"mkc-more mko-more\" id=\"mko-more\" onclick=\"mkOrdMore()\">이전 거래 더 보기</button>':'')+'</div>';","+(o.length>MK_ORD_N?'<button type=\"button\" class=\"mkc-more mko-more\" id=\"mko-more\" onclick=\"mkOrdMore()\">이전 거래 더 보기</button>':'')+'<button type=\"button\" class=\"mk-lnk mko-back mko-back2\" onclick=\"mkBackOv(\\''+ne+'\\')\">← 개요로</button></div>';");
// 개요를 그린 뒤 보던 기간과 위치를 되살린다
s=one(s,"    +mkChatHtml(s,R0,ne,pd)\n    +mkOrdersSec(s,ne)\n    +'</div>';\n}","    +mkChatHtml(s,R0,ne,pd)\n    +mkOrdersSec(s,ne)\n    +'</div>';\n}\nfunction mkOvAfter(ne){ setTimeout(function(){ try{ mkOvRestore(ne); }catch(e){} },0); }");
s=one(s,"MKD.per=30; MKD.s=s.cfg?s:null;","MKD.per=30; MKD.s=s.cfg?s:null; mkOvAfter(ne);");
// P2-01 승률을 표시하지 않는 이유
s=one(s,"win:'끝난 거래 중 이익으로 끝난 거래의 비율이에요. 거래가 5번 미만이면 표시하지 않아요.',","win:'끝난 거래 중 이익으로 끝난 거래의 비율이에요. 고른 기간에 끝난 거래가 5번 미만이면 - 로 표시해요.',");
// 그래프 설명
s=one(s,"['pnl','수익금','1,000 USDT로 시작했다면 지금까지 벌거나 잃은 금액이에요. 수수료를 뺀 금액이에요.'],['bal','잔고','1,000 USDT로 시작했다면 지금 계좌에 있는 금액이에요. 처음 넣은 1,000 USDT에 수익금을 더한 값이에요.']","['pnl','수익금','처음에 1,000 USDT로 시작한 계좌에서, 고른 기간 동안 늘거나 줄어든 금액이에요. 수수료를 뺀 금액이에요.'],['bal','잔고','처음에 1,000 USDT로 시작한 계좌에 그날 들어 있던 금액이에요. 아래 거래내역의 금액과 같은 기준이에요.']");
const i=s.indexOf('/* ── 개요의 대화:'); if(i<0) throw new Error('chat block'); const j=s.lastIndexOf('\n',i);
s=s.slice(0,j)+fs.readFileSync(D+'c27.js','utf8')+s.slice(j);
fs.writeFileSync(D+'rd-ui.js',s);
fs.appendFileSync(D+'rd.css',`
/* 거래내역 전체 화면 아래쪽의 돌아가기, 좁은 화면의 줄 간격, 지표 설명이 화면 밖으로 나가지 않게 */
.mko-back2{display:block;margin:26px 0 0}
@media (max-width:640px){
  #g-root .mko-tbl tr{padding:12px 0;row-gap:2px}
  #g-root .mk3-kpis .mkd-tip,#g-root .mkd-pill .mkd-tip{max-width:calc(100vw - 48px)}
  #g-root .mk3-kpis>div:nth-child(even) .mkd-tip{left:auto;right:0}
  #g-root .mkd-pill:nth-child(n+2) .mkd-tip{left:auto;right:0}
}
`);
let a=fs.readFileSync(D+'apply2.cjs','utf8'); const m=a.indexOf('// 6. rd'); if(a.includes('// 5w.')) throw new Error('dup');
a=a.slice(0,m)+"// 5w. 달력의 월 요약: 세는 것은 끝난 거래다\nrep(\"'%, 체결 '+trM.length+'회'\",\"'%, 끝난 거래 '+trM.length+'건'\",true);\n"+a.slice(m);
fs.writeFileSync(D+'apply2.cjs',a); console.log('ok');
