// 1차 자체 점검 반영: 확인 창은 선을 가리지 않는 쪽에, 해석은 오른쪽 요약 아래에, 요약 줄은 낮게, 재생은 더 짧게
const fs=require('fs'), D=__dirname+'/';
const one=(s,x,y)=>{ const c=s.split(x).length-1; if(c!==1) throw new Error('x'+c+': '+x.slice(0,70)); return s.replace(x,()=>y); };
let a=fs.readFileSync(D+'bt-a.js','utf8');
a=one(a,"var ai=s.kind!=='rule'&&(btGate(s)||s.kind==='agent'), full=ai?1150:620, brief=ai?520:300, keep={};","var ai=s.kind!=='rule'&&(btGate(s)||s.kind==='agent'), full=ai?1000:560, brief=ai?430:260;");
a=one(a,"    else if(nFull<(ai?4:2)&&(ix<2||hasSkip||nFull<2)){ st.dw=full; nFull++; }\n    else if(nBrief<10||hasSkip&&nBrief<14){ st.dw=brief; nBrief++; }","    else if(nFull<(ai?3:2)&&(ix<1||hasSkip||(ix<2&&!ai))){ st.dw=full; nFull++; }\n    else if(nBrief<8||(hasSkip&&nBrief<11)){ st.dw=brief; nBrief++; }");
a=one(a,"var bar=Math.max(3.2,Math.min(9,3000/R.N))","var bar=Math.max(2.6,Math.min(8,2600/R.N))");
a=one(a,"R.seg=seg; R.runMs=t; R.prepMs=900; R.wrapMs=700;","R.seg=seg; R.runMs=t; R.prepMs=800; R.wrapMs=600;");
a=one(a,"+'<text id=\"bt-ddt\" x=\"0\" y=\"'+(G.pt+16)+'\"","+'<text id=\"bt-ddt\" x=\"0\" y=\"'+(H-G.pb-10)+'\"");
fs.writeFileSync(D+'bt-a.js',a);
let b=fs.readFileSync(D+'bt-b.js','utf8');
b=one(b,"    var b=h.getBoundingClientRect(), x=G.X(st.j)/G.W*b.width, y=G.Y(R.eq[st.j].v)/G.H*b.height, w=Math.min(250,b.width-24), left=x+16; if(left+w>b.width-4) left=x-w-16; if(left<4) left=Math.max(4,Math.min(b.width-w-4,x-w/2));\n    c.style.width=w+'px'; c.style.left=left+'px'; c.style.top=Math.max(6,Math.min(b.height-150,y-70))+'px';",
"    /* 선이 있는 쪽을 가리지 않게: 점이 위쪽이면 아래 빈 곳에, 아래쪽이면 위에 둔다 */\n    var b=h.getBoundingClientRect(), k=b.width/G.W, x=G.X(st.j)*k, y=G.Y(R.eq[st.j].v)*k, w=Math.min(286,b.width-24), left=x+14; if(left+w>b.width-4) left=x-w-14; if(left<4) left=Math.max(4,Math.min(b.width-w-4,x-w/2));\n    var hh=c.offsetHeight||((r1?3:2)*38+8), full=(r1?3:2)*38+8, lowY=(G.H-G.pb)*k-full-30, top=y<b.height*0.52?Math.max(y+26,lowY):G.pt*k+2;\n    c.style.width=w+'px'; c.style.left=left+'px'; c.style.top=Math.max(4,Math.min(b.height-full-8,top))+'px';");
b=one(b,"    +'<section class=\"bt-read\" id=\"bt-read\"></section>'\n","");
b=one(b,"$('bt-live').innerHTML=''; $('bt-read').innerHTML=''; $('bt-rail').innerHTML=btReadyRail();","$('bt-live').innerHTML=''; $('bt-rail').innerHTML=btReadyRail();");
b=one(b,"$('bt-ev').innerHTML=''; $('bt-read').innerHTML=''; btChartDraw(); btLiveInit();","$('bt-ev').innerHTML=''; btChartDraw(); btLiveInit();");
b=one(b,"  $('bt-read').innerHTML='<h3>TETH의 해석</h3>'+btRead().map(function(x){ return '<p>'+gEsc(x)+'</p>'; }).join('');\n","");
b=one(b,"<div><small>평균 보유</small><b class=\"num\">'+Math.round(R.r.avgHold||0)+'일</b></div></div></section>'","<div><small>평균 보유</small><b class=\"num\">'+Math.round(R.r.avgHold||0)+'일</b></div></div></section>'\n    +'<section class=\"bt-box bt-read\"><h3>TETH의 해석</h3>'+btRead().map(function(x){ return '<p>'+gEsc(x)+'</p>'; }).join('')+'</section>'");
b=one(b,"<small>'+l+'</small><b class=\"num\">'+v+'</b><i>근거 보기</i></button>'","<small>'+l+'</small><b class=\"num\">'+v+'</b><svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M9 5l7 7-7 7\"/></svg></button>'");
fs.writeFileSync(D+'bt-b.js',b);
let w=fs.readFileSync('C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/qa/walk.mjs','utf8');
w=one(w,"read:document.getElementById('bt-read').innerText.replace(/\\\\s+/g,' '),","");
fs.writeFileSync('C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/qa/walk.mjs',w);
fs.appendFileSync(D+'bt2.css',`
/* 자체 점검 1 */
.bt-call .r{grid-template-columns:70px minmax(0,1fr)}
.bt-live.res>button{position:relative;padding:12px 26px 12px 0}
.bt-live.res>button+button{padding-left:16px}
.bt-live.res>button svg{position:absolute;right:10px;top:50%;margin-top:-7px;color:var(--gt3);transition:transform .15s,color .15s}
.bt-live.res>button:hover svg{color:#c8f43c;transform:translateX(2px)}
.bt-live>div{padding:12px 0 2px}
.bt-rail .bt-read p{font-size:13px;line-height:1.62;margin:0 0 8px;color:var(--gt)}
.bt-rail .bt-read p:last-child{color:var(--gt2)}
.bt-rail .bt-read{padding:16px 18px 14px}
.bt-verdict{padding-bottom:12px}
.bt-k3{margin-top:12px}
.bt-k3>div{padding:9px 0}
.bt-chain{gap:0}
.bt-chain span+span{margin-left:0}
.bt-chain span+span::before{content:none}
.bt-chain span{position:relative;margin-right:18px}
.bt-chain span:last-child{margin-right:0}
.bt-chain span:not(:last-child)::after{content:"";position:absolute;right:-13px;top:50%;width:5px;height:5px;border-top:1.4px solid rgba(255,255,255,.4);border-right:1.4px solid rgba(255,255,255,.4);transform:translateY(-50%) rotate(45deg)}
`);
console.log('ok');
