const fs=require('fs'), D=__dirname+'/', F='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/index.html', R=String.raw;
let s=fs.readFileSync(D+'rd-ui.js','utf8');
const one=(a,b)=>{ const n=s.split(a).length-1; if(n!==1) throw new Error('rd x'+n+': '+a.slice(0,60)); s=s.replace(a,()=>b); };
one("function mk3Head(s,ne,pd,watching){","function mk3Head(s,ne,pd,watching){\n  watching=(tfS().watch||[]).indexOf(s.nick)>=0; /* 어떤 주소로 들어와도 현재 이름으로 판정 */");
one(R`onclick="tfSS3WatchTgl(\''+ne+'\');this.setAttribute(\'aria-pressed\',String(this.getAttribute(\'aria-pressed\')!==\'true\'))">★ 즐겨찾기</button>`, R`onclick="tfSS3WatchTgl(\''+ne+'\');mkWatchSync(\''+ne+'\')">★ 즐겨찾기</button>`);
one(R`id="ss3-watch-btn" aria-pressed="'+watching+'" onclick="tfSS3WatchTgl(\''+ne+'\')">`, R`id="ss3-watch-btn" aria-pressed="'+watching+'" onclick="tfSS3WatchTgl(\''+ne+'\');mkWatchSync(\''+ne+'\')">`);
s+='\n'+fs.readFileSync(D+'wind.js','utf8'); fs.writeFileSync(D+'rd-ui.js',s);
// 목록의 상태 표시: 5g 의 결과 문자열을 index 와 apply2 양쪽에서 같이 고친다
const A=":on?'따라가는 중':'중단됨')", B=":on?(c2.winding?'정리 대기':'따라가는 중'):'중단됨')";
let t=fs.readFileSync(F,'utf8'); if(t.split(A).length-1!==1) throw new Error('idx tag'); t=t.replace(A,B); fs.writeFileSync(F,t);
let a=fs.readFileSync(D+'apply2.cjs','utf8'); if(a.split(A).length-1!==1) throw new Error('ap tag'); a=a.replace(A,B);
const k=a.indexOf('// 6. rd'); const J=x=>JSON.stringify(x);
const reps=[
 [R`'">'+(on?'따라가는 중':'중단됨')+'</span></div></div>'`, R`'">'+(on?(c2.winding?'정리 대기':'따라가는 중'):'중단됨')+'</span></div></div>'`],
 [R`    +(on?'<button type="button" class="obtn" onclick="cpAdjDlg(\''+cid+'\')">예산 조정</button>'`, R`    +(on&&c2.winding?mkWindActs(cid):on?'<button type="button" class="obtn" onclick="cpAdjDlg(\''+cid+'\')">예산 조정</button>'`],
 [R`      +(on?'<div class="cpd-acts"><button type="button" class="wbtn" onclick="cpDetailGo(\''+c2.id+'\')">상세</button>'`, R`      +(on&&c2.winding?'<div class="cpd-acts"><button type="button" class="wbtn" onclick="cpDetailGo(\''+c2.id+'\')">상세</button>'+mkWindActs(c2.id)+'</div>':on?'<div class="cpd-acts"><button type="button" class="wbtn" onclick="cpDetailGo(\''+c2.id+'\')">상세</button>'`]
];
a=a.slice(0,k)+'// 5r. 중단의 정리 대기 상태를 따라가는 중 화면에 표시\n'+reps.map(r=>'rep('+J(r[0])+','+J(r[1])+',true);').join('\n')+'\n'+a.slice(k);
fs.writeFileSync(D+'apply2.cjs',a); console.log('ok');
