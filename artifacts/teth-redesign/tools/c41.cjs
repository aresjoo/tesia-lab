const fs=require('fs'), D=__dirname+'/';
const one=(s,x,y)=>{ const c=s.split(x).length-1; if(c!==1) throw new Error('x'+c+': '+x.slice(0,70)); return s.replace(x,()=>y); };
let g=fs.readFileSync(D+'bt-go.js','utf8');
g=one(g,"<ol class=\"btg-guide\"><li>'+nm+'에 로그인해 <b>API 관리</b>로 가요</li><li>새 키를 만들고 <b>조회</b>와 <b>거래</b>만 켜요. 출금은 꺼 두세요</li><li>만들어진 값 '+(okx?'세':'두')+' 개를 아래에 붙여 넣어요</li></ol>","<ol class=\"btg-guide\"><li><span>'+nm+'에 로그인해 <b>API 관리</b>로 가요</span></li><li><span>새 키를 만들고 <b>조회</b>와 <b>거래</b>만 켜요. 출금은 꺼 두세요</span></li><li><span>만들어진 값 '+(okx?'세':'두')+' 개를 아래에 붙여 넣어요</span></li></ol>");
g=one(g,"function btGoRe(){ BT_RUN++; var e=$('btg-flow'); if(!e){ btGoView(); return; } e.innerHTML=btGoFlow();","function btGoRe(){ BT_RUN++; var e=$('btg-flow'); if(!e){ btGoView(); return; } var r0=$('bt-root'); if(r0) r0.classList.remove('busy'); e.innerHTML=btGoFlow();");
fs.writeFileSync(D+'bt-go.js',g); console.log('ok');
