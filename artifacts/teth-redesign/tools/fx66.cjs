// 시작 금액 기준선 이름은 차트 안이 아니라 범례에(겹침 방지), 앱 배너 다운로드는 흰 알약
const fs=require('fs');
const rep=(f,a,b)=>{ let s=fs.readFileSync(f,'utf8'); if(!s.includes(a)) throw new Error(f+' miss '+a.slice(0,60)); s=s.split(a).join(b); fs.writeFileSync(f,s); };
rep('sk-bt.js',`<text x="'+(G.W-G.pr)+'" y="'+(y-6).toFixed(1)+'" text-anchor="end" font-size="12" fill="#cdcdcd">시작 금액 $'+Math.round(BT.amt).toLocaleString()+'</text></g>'`,`</g>'`);
fs.appendFileSync('sk-bt.js',`
(function(){ if(typeof btLegend!=='function') return; var l0=btLegend; btLegend=function(){ var h=l0.apply(this,arguments); try{ if(h.indexOf('skb-lg-base')<0) h=h.replace('<span class="b">','<span class="skb-lg-base">시작 금액 $'+Math.round(BT.amt).toLocaleString()+'</span><span class="b">'); }catch(e){} return h; }; })();
`);
fs.appendFileSync('sk-bt.css',`
/* 범례: 시작 금액 기준선(차트 안 흰 1px 선) */
#bt-root .bt-leg .skb-lg-base{display:inline-flex;align-items:center;gap:6px;color:#cdcdcd}
#bt-root .bt-leg .skb-lg-base::before{content:"";width:18px;height:0;border-top:1px solid rgba(255,255,255,.6)}
`);
fs.appendFileSync('sk-main.css',`
/* 앱 배너 다운로드: 파란 단추 대신 흰 알약(주 단추 규칙) */
#g-appbanner .dl{background:#fff!important;color:#000!important}
#g-appbanner .dl:hover{background:#e6e6e6!important}
`);
console.log('ok');
