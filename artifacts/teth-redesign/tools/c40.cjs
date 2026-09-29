// 자체 점검 3: 비교 수익률은 범례에, 조사, 짧은 멈춤, 기간 단추 한 줄
const fs=require('fs'), D=__dirname+'/';
const one=(s,x,y)=>{ const c=s.split(x).length-1; if(c!==1) throw new Error('x'+c+': '+x.slice(0,70)); return s.replace(x,()=>y); };
let a=fs.readFileSync(D+'bt-a.js','utf8');
a=one(a,"    +'<text class=\"bt-bl\" x=\"'+(W-G.pr-2)+'\" y=\"'+bTxtY.toFixed(1)+'\" text-anchor=\"end\" font-size=\"11.5\" fill=\"#a3a8af\">그냥 들고 있었다면 '+mkPct0(R.benchRet,1)+'</text>'\n","");
a=one(a,"    else if(nBrief<12){ st.dw=ai?520:360; nBrief++; }","    else if(nBrief<9){ st.dw=ai?440:320; nBrief++; }");
fs.writeFileSync(D+'bt-a.js',a);
let b=fs.readFileSync(D+'bt-b.js','utf8');
b=one(b,"<span class=\"b\">그냥 들고 있었다면</span>","<span class=\"b\">그냥 들고 있었다면 <i class=\"num\">'+(BT.R?mkPct0(BT.R.benchRet,1):'')+'</i></span>");
b=one(b,"  btSub(); btChartDraw();\n  btCap('시작 금액',btUsd(BT.amt),'','');","  btSub(); btChartDraw(); { var lg=document.querySelector('.bt-leg .b i'); if(lg) lg.textContent=mkPct0(BT.R.benchRet,1); }\n  btCap('시작 금액',btUsd(BT.amt),'','');");
fs.writeFileSync(D+'bt-b.js',b);
let g=fs.readFileSync(D+'bt-go.js','utf8');
g=one(g,"gEsc(mkHook(s))+'을 연결하고 있어요')","gEsc(mkHook(s))+' 전략을 연결하고 있어요')");
fs.writeFileSync(D+'bt-go.js',g);
fs.appendFileSync(D+'bt3.css',`
/* 자체 점검 3 */
.bt-leg .b i{font-style:normal;color:var(--gt2);margin-left:2px}
.bt-seg{gap:5px}
.bt-seg button{padding:0 9px;font-size:12.5px}
`);
console.log('ok');
