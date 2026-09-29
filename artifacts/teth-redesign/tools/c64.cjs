const fs=require('fs'), D=__dirname+'/', R='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/';
const ed=(file,pairs)=>{ let s=fs.readFileSync(file,'utf8'); for(const [x,y,n] of pairs){ const c=s.split(x).length-1; if(c!==(n||1)) throw new Error(file.slice(-14)+' x'+c+': '+x.slice(0,90)); s=s.split(x).join(y); } fs.writeFileSync(file,s); };
ed(R+'index.html',[
  ["<span class=\"tag\" title=\"Profit share ratio\">분배 '+Math.round((cpMeta(c2.nick).share)*100)+'%</span>","'+(cpMeta(c2.nick).share>0?'<span class=\"tag\" title=\"Profit share ratio\">분배 '+Math.round((cpMeta(c2.nick).share)*100)+'%</span>':'<span class=\"tag\">이용료 없음</span>')+'"],
  ["+K('순손익 (분배 차감 후)',sum.net)","+K(sum.share>0?'순손익 (분배 차감 후)':'순손익',sum.net)"],
  ["<small>순손익 (분배 차감 후)</small>","<small>순손익</small>"],
  ["cpAiHtml({w:0,t:'수익 분배는 실현 ","(sum.share>0?'':cpAiHtml({w:0,t:'따라가기는 무료예요. 원본 전략이 진입하면 내 예산 안에서 같은 비율로 함께 들어가요.'}))+(sum.share>0?cpAiHtml({w:0,t:'수익 분배는 실현 "],
]);
{ let h=fs.readFileSync(R+'index.html','utf8'); const i=h.indexOf("(sum.share>0?cpAiHtml({w:0,t:'수익 분배는 실현 "); const j=h.indexOf("}))",i); if(i<0||j<0) throw new Error('close'); h=h.slice(0,j+3)+":'')"+h.slice(j+3); fs.writeFileSync(R+'index.html',h); }
ed(D+'bt-fut.js',[
  ["['그냥 들고 있었다면','현물로 그냥 들고 있었다면'],['그냥 들고 있었을 때','현물로 그냥 들고 있었을 때']]","[/(현물로 )?그냥 들고 있었/g,'현물로 그냥 들고 있었']]"],
  ["for(var i=0;i<D.length;i++) if(x.indexOf(D[i][0])>=0) x=x.split(D[i][0]).join(D[i][1]); return x.split('현물로 현물로').join('현물로'); }","for(var i=0;i<D.length;i++){ if(typeof D[i][0]!=='string') x=x.replace(D[i][0],D[i][1]); else if(x.indexOf(D[i][0])>=0) x=x.split(D[i][0]).join(D[i][1]); } return x; }"],
]);
console.log('ok');
