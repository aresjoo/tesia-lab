// 전략 없는 터미널 오른쪽 칸: 복사한 전략이 있으면 그 목록과 관리
const fs=require('fs');
let p=fs.readFileSync('px.js','utf8');
const a="var br=document.getElementById('tft-brainin'); if(br) br.innerHTML=";
const i=p.indexOf(a); if(i<0) throw new Error('miss');
const j=p.indexOf(";\n",i);
p=p.slice(0,i)+"var br=document.getElementById('tft-brainin'); if(br) br.innerHTML=pxTermSide()"+p.slice(j);
p+=`
/* 터미널 오른쪽 칸: 복사한 전략이 있으면 목록(이름, 운용, 순손익, 관리), 없으면 전략 찾기 */
function pxTermSide(){
  var cps=[]; try{ cps=((tfS().cp&&tfS().cp.copies)||[]).filter(function(c){ return c.status==='active'; }); }catch(e){}
  if(!cps.length) return '<div class="px-tbrain"><b>실행 중인 전략이 없습니다</b><span>전략을 고르면 TETH의 판단과 주문이 여기에 표시됩니다.</span><button type="button" class="pl-cta pl-cta-w" onclick="tfShareHub()">전략 찾기</button><button type="button" class="pl-link" onclick="tfBackToChat()">새 전략 만들기</button></div>';
  return '<div class="px-tbrain"><b>복사한 전략 '+cps.length+'개가 실행 중입니다</b><div class="px-tcps">'+cps.map(function(c){ var d=cpCalc(c), s=tfSSFind(c.nick);
    return '<div class="r"><div><b>'+gEsc(s?mkTitle(s):c.nick)+'</b><span class="num">운용 '+cpUsd(c.amt||d.alloc||0,0)+', 순손익 <i class="'+(d.net>=0?'mk-up':'mk-dn')+'">'+cpUsd(d.net)+'</i></span></div><button type="button" class="pl-link" onclick="tfShareHub(\'follow\')">관리</button></div>'; }).join('')+'</div><button type="button" class="pl-link" onclick="tfShareHub()">전략 더 찾기</button></div>';
}
`;
fs.writeFileSync('px.js',p);
let c=fs.readFileSync('px.css','utf8');
c+=`
.px-tcps{display:grid;width:100%;margin:4px 0 8px;border-top:1px solid rgba(255,255,255,.1)}
.px-tcps .r{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 0;border-bottom:1px solid rgba(255,255,255,.1)}
.px-tcps .r>div{display:grid;gap:3px;min-width:0}
.px-tcps .r b{font-size:14.5px;font-weight:600;color:#fff}
.px-tcps .r span{font-size:13px;color:#cdcdcd;margin:0}
.px-tcps .r i{font-style:normal}
/* 복사한 전략만 있는 터미널: 아래에 따로 붙던 목록은 오른쪽 칸으로 옮겼으니 숨김 */
.tft-page .tm-follow{display:none}
`;
fs.writeFileSync('px.css',c); console.log('ok');
