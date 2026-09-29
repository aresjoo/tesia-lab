// 자체 점검 2: 확인 창은 아직 그려지지 않은 오른쪽에 두고, 자리가 없으면 그래프 위 머리 쪽으로 올린다. 단추에는 자동 초점을 주지 않는다
const fs=require('fs'), D=__dirname+'/';
const one=(s,x,y)=>{ const c=s.split(x).length-1; if(c!==1) throw new Error('x'+c+': '+x.slice(0,70)); return s.replace(x,()=>y); };
let b=fs.readFileSync(D+'bt-b.js','utf8');
const i=b.indexOf("    /* 선이 있는 쪽을 가리지 않게"), j=b.indexOf("c.style.top=",i), k=b.indexOf("\n",j); if(i<0||j<0) throw new Error('call pos');
b=b.slice(0,i)+"    /* 선을 가리지 않게: 아직 그려지지 않은 오른쪽에 둔다. 오른쪽에 자리가 없으면 그래프 위 머리 쪽으로 올린다 */\n    var b=h.getBoundingClientRect(), k=b.width/G.W, x=G.X(st.j)*k, y=G.Y(R.eq[st.j].v)*k, w=Math.min(286,b.width-24), full=(r1?3:2)*40+10, right=x+16+w<=b.width-2;\n    c.style.width=w+'px'; c.style.left=(right?x+16:Math.max(4,x-w-16))+'px'; c.style.top=(right?Math.max(4,Math.min(b.height-full-40,y-full/2)):-(full-G.pt*k+6))+'px';"+b.slice(k);
fs.writeFileSync(D+'bt-b.js',b);
let g=fs.readFileSync(D+'bt-go.js','utf8');
const n0=g.split('class="bt-cta" data-af ').length-1; g=g.split('class="bt-cta" data-af ').join('class="bt-cta" ');
fs.writeFileSync(D+'bt-go.js',g);
let w=fs.readFileSync('C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/qa/walk.mjs','utf8');
w=one(w,"{type:'mouseMoved',x:30,y:H-20}","{type:'mouseMoved',x:700,y:6}");
fs.writeFileSync('C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/qa/walk.mjs',w);
console.log('ok',n0);
