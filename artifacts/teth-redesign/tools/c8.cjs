// 파운더: 정렬 칩 이름. Codex 3라운드: r3 설명(P1-03), 끝값 비율(P1-08), 그래프 색 경계(P2-05)
const fs=require('fs'), D=__dirname+'/';
const one=(s,x,y)=>{ const n=s.split(x).length-1; if(n!==1) throw new Error('x'+n+': '+x.slice(0,60)); return s.replace(x,()=>y); };
let s=fs.readFileSync(D+'rd-ui.js','utf8');
s=one(s,"['win','수익 낸 거래']]","['win','거래 승률']]");
s=one(s,"if((k===0&&w>0)||(k===10&&w<100)) return (w<1||w>99?w.toFixed(1):String(Math.round(w)))+'%';",
        "if((k===0&&w>0)||(k===10&&w<100)) return w<1?'1% 미만':w>99?'99% 넘게':Math.round(w)+'%';");
// 색 경계: 0% 선에서 정확히 나누고, 0% 위에 그대로 머문 평평한 구간만 초록으로 덧그린다
s=one(s,"height=\"'+(yb+3.2).toFixed(1)+'\"/></clipPath>'\n    +'<clipPath id=\"'+id+'d\"><rect x=\"-2\" y=\"'+(yb+1.2).toFixed(1)+'\"",
        "height=\"'+(yb+2).toFixed(1)+'\"/></clipPath>'\n    +'<clipPath id=\"'+id+'d\"><rect x=\"-2\" y=\"'+yb.toFixed(1)+'\"");
s=one(s,"+'<g clip-path=\"url(#'+id+'u)\">'+ln(G)+'</g><g clip-path=\"url(#'+id+'d)\">'+ln(Rd)+'</g></svg>';",
        "+'<g clip-path=\"url(#'+id+'u)\">'+ln(G)+'</g><g clip-path=\"url(#'+id+'d)\">'+ln(Rd)+'</g>'+mkFlatAtBase(eq,base,X,Y,G)+'</svg>';");
s+="\nfunction mkFlatAtBase(eq,base,X,Y,G){ var d=''; for(var i=0;i<eq.length-1;i++) if(Math.abs(eq[i].v-base)<1e-12&&Math.abs(eq[i+1].v-base)<1e-12) d+='M'+X(i).toFixed(1)+' '+Y(base).toFixed(1)+' L'+X(i+1).toFixed(1)+' '+Y(base).toFixed(1)+' '; return d?'<path d=\"'+d+'\" fill=\"none\" stroke=\"'+G+'\" stroke-width=\"2\" stroke-linecap=\"round\" vector-effect=\"non-scaling-stroke\"/>':''; }\n";
fs.writeFileSync(D+'rd-ui.js',s);
const cp=JSON.parse(fs.readFileSync(D+'copy.json','utf8'));
cp.r3.one='이더리움이 산 가격보다 3% 넘게 떨어진 날 팔아요. 오르면 15%까지, 길어도 25일 기다려요.';
fs.writeFileSync(D+'copy.json',JSON.stringify(cp,null,1));
console.log('ok');
