// R11: 화면 문장을 합니다체로 맞춘다. 빌드 마지막 단계에서 돌린다 (여러 번 돌려도 결과가 같다)
// 사용: node hapnida.cjs [--dry]
const fs=require('fs');
const R='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/';
const FILES=['index.html','teth-copy.js','help-widget.js','site-footer.js'];
const DRY=process.argv.includes('--dry');
const B=0xAC00;
const dec=ch=>{ const c=ch.charCodeAt(0)-B; if(c<0||c>11171) return null; return {cho:Math.floor(c/588),jung:Math.floor(c%588/28),jong:c%28}; };
const com=(o)=>String.fromCharCode(B+(o.cho*21+o.jung)*28+o.jong);
const withJong=(ch,j)=>{ const d=dec(ch); if(!d) return null; d.jong=j; return com(d); };
const J_L=8,J_B=17,J_SS=20,J_N=4;
const KEEP=/(안녕하세|어서 오세)$/;
const EXC=[['는지예','는지를 뜻합니다'],['느냐예','느냐의 문제입니다'],['아니에','아닙니다'],['그래','그렇습니다'],['이래','이렇습니다'],['어때','어떻습니다'],['줄어','줄어듭니다'],['늘어','늘어납니다'],['물어','묻습니다'],
 ['바빠','바쁩니다'],['나빠','나쁩니다'],['아파','아픕니다'],['기뻐','기쁩니다'],['예뻐','예쁩니다'],['슬퍼','슬픕니다'],['모아','모읍니다'],['치러','치릅니다'],
 ['지어','짓습니다'],['이어','잇습니다'],['나아','낫습니다'],['켜','켭니다'],['펴','폅니다'],['아껴','아낍니다'],
 ['쉬워','쉽습니다'],['어려워','어렵습니다'],['가까워','가깝습니다'],['무거워','무겁습니다'],['가벼워','가볍습니다'],['새로워','새롭습니다'],['반가워','반갑습니다'],['고마워','고맙습니다'],['아쉬워','아쉽습니다'],['즐거워','즐겁습니다'],['두려워','두렵습니다'],['뜨거워','뜨겁습니다'],['차가워','차갑습니다'],['까다로워','까다롭습니다'],['번거로워','번거롭습니다'],['자유로워','자유롭습니다'],['도와','돕습니다'],['아까워','아깝습니다'],['알아들어','알아듣습니다'],['부러워','부럽습니다'],['안타까워','안타깝습니다'],['놀라워','놀랍습니다'],['자연스러워','자연스럽습니다'],['조심스러워','조심스럽습니다'],['부담스러워','부담스럽습니다'],['만족스러워','만족스럽습니다']];
const ONE={'사':'삽니다','타':'탑니다','빼':'뺍니다','해':'합니다','돼':'됩니다','봐':'봅니다','와':'옵니다','줘':'줍니다','써':'씁니다','커':'큽니다','꺼':'끕니다','떠':'뜹니다'};
const SKIP_TAIL=/(거든|잖아|는데|은데|인데|텐데|던데|군|라서|어서|해서|아서|니까|으면|라면|다면|부터|까지|에서|으로|에게|라고|다고|이라|구|걸|더라고|더라구|고|도|은|는|만|면|로|에|데|대|래|이|의|를|을|가요|필|중|주|수|개|소|강|긴|불필|비|다|죠|지|서|며|네|게|까|나)$/;
const L_KEEP=/(만들|열|팔|늘|줄|걸|풀|끌|들|알|살|놀|울|벌|빌|밀|날|달|돌|물)$/; // ㄹ 받침 어간
function q(s,isQ){ return isQ?s.replace(/습니다$/,'습니까').replace(/니다$/,'니까').replace(/십시오$/,'십니까'):s; }
function stemEnd(S){ // 어간 + 평서형
  if(!S) return null; const L=S[S.length-1], d=dec(L); if(!d) return null;
  if(d.jong===0) return S.slice(0,-1)+withJong(L,J_B)+'니다';
  if(d.jong===J_L) return S.slice(0,-1)+withJong(L,J_B)+'니다';
  return S+'습니다';
}
const NA_VERB=/(끝나|나타나|일어나|늘어나|떠나|만나|지나|벗어나|드러나|살아나|태어나|뛰어나|빛나|생겨나|불어나|깨어나)$/;
function conv(W,isQ){
  if(KEEP.test(W)) return null;
  for(const [a,b] of EXC) if(W.endsWith(a)) return q(W.slice(0,-a.length)+b,isQ);
  const L=W[W.length-1], d=dec(L); if(!d) return null;
  const P=W.length>1?W[W.length-2]:'', pd=P?dec(P):null;
  // 이에요, 예요, 세요
  if(W==='거예') return q(W.slice(0,-2)+'것입니다',isQ);
  if(W.endsWith('이에')) return q(W.slice(0,-2)+'입니다',isQ);
  if(L==='예'&&W.length>1) return q(W.slice(0,-1)+'입니다',isQ);
  if(L==='세'&&W.length>1) return q(W.slice(0,-1)+'십시오',isQ);
  // 네요, 나요?, 가요?, 까요, 게요
  if(L==='네'&&W.length>1){ const r=stemEnd(W.slice(0,-1)); return r?q(r,isQ):null; }
  if(L==='군'&&W.length>1){ const r=stemEnd(W.slice(0,-1)); return r?q(r,isQ):null; }
  if(L==='서') return /(나서|앞서|멈춰서|일어서|들어서|올라서|내려서|물러서)$/.test(W)?q(W.slice(0,-1)+'섭니다',isQ):null;
  if(L==='나'&&W.length>1&&(isQ||!NA_VERB.test(W))){ const r=stemEnd(W.slice(0,-1)); return r?q(r,true):null; }
  if(L==='가'&&pd&&pd.jong===J_N&&W.length>2){ if(P==='은') return W.slice(0,-2)+'습니까'; if(P==='인') return W.slice(0,-2)+'입니까'; return W.slice(0,-2)+withJong(P,J_B)+'니까'; }
  if((L==='까'||L==='게')&&pd&&pd.jong===J_L){ const S=W.slice(0,-1); const tail=L==='까'?'겠습니까':'겠습니다';
    if(L==='까'){ if(S.endsWith('드릴')) return S.slice(0,-1)+'리면 되겠습니까'; if(S.endsWith('일')&&S.length>1) return S.slice(0,-1)+'입니까'; if(P==='을'&&S.length>1&&(dec(S[S.length-2])||{}).jong===J_SS) return S.slice(0,-1)+'습니까'; }
    if(P==='을') return S.slice(0,-1)+tail; if(L_KEEP.test(S)) return S+tail; return S.slice(0,-1)+withJong(P,0)+tail; }
  if(W.length===1) return ONE[W]?q(ONE[W],isQ):null;
  if(ONE[L]&&(L==='해'||L==='돼')) return q(W.slice(0,-1)+ONE[L],isQ);
  // 받침 뒤 어요, 아요
  if((L==='어'||L==='아')&&pd){
    if(pd.jong===0) return q(W.slice(0,-2)+withJong(P,J_B)+'니다',isQ);
    if(pd.jong===J_L) return q(W.slice(0,-2)+withJong(P,J_B)+'니다',isQ);
    return q(W.slice(0,-1)+'습니다',isQ);
  }
  if(SKIP_TAIL.test(W)&&!(d.jong===0&&[0,4].includes(d.jung)&&/(끝나|나타나|일어나|늘어나|떠나|만나|지나|벗어나|드러나|살아나|태어나|뛰어나|나가|들어가|따라가|올라가|내려가|넘어가|돌아가|나아가|이어가|다가가|건너가|빠져나가|가|서|건너|나서|앞서|멈춰서)$/.test(W))) return null;
  if(d.jong!==0) return null;
  switch(d.jung){
    case 0: case 4: // ㅏ ㅓ
      if(d.cho===5&&pd&&pd.jong===J_L) return q(W.slice(0,-2)+withJong(P,0)+'릅니다',isQ);
      if('써커꺼떠'.includes(L)) return q(W.slice(0,-1)+ONE[L],isQ);
      return q(W.slice(0,-1)+withJong(L,J_B)+'니다',isQ);
    case 1: return q(W.slice(0,-1)+withJong(L,J_B)+'니다',isQ); // ㅐ
    case 6: return q(W.slice(0,-1)+com({cho:d.cho,jung:20,jong:J_B})+'니다',isQ); // ㅕ
    case 9: return q(W.slice(0,-1)+com({cho:d.cho,jung:8,jong:J_B})+'니다',isQ); // ㅘ
    case 14: return q(W.slice(0,-1)+com({cho:d.cho,jung:13,jong:J_B})+'니다',isQ); // ㅝ
    case 10: return q(W.slice(0,-1)+com({cho:d.cho,jung:11,jong:J_B})+'니다',isQ); // ㅙ
  }
  return null;
}
// 정규식 리터럴 안은 건드리지 않는다 (사용자 입력을 읽는 패턴)
function regexSpans(line){ const out=[]; const re=/(^|[(,=:\[!&|?{};\s])\/(?![*\/])((?:[^\/\\\n]|\\.)+)\/[gimsuy]*/g; let m; while((m=re.exec(line))){ out.push([m.index+m[1].length,re.lastIndex]); } return out; }
const TERM="[.!?'\"<,\\s~)\\]:;]|\\\\|$";
const RE=new RegExp("([가-힣]+)요(?="+TERM+")","g"), RE2=new RegExp("([가-힣]+)죠(?="+TERM+")","g");
const RE3=new RegExp("([\"'>)%0-9A-Za-z])(예요|이에요)(?="+TERM+")","g");
const stat={}, skipped={};
let total=0;
function convText(src){ const nl=src.includes('\r\n')?'\r\n':'\n';
  const lines=src.split(nl);
  const out=lines.map(line=>{
    if(line.indexOf('요')<0&&line.indexOf('죠')<0) return line;
    if(/해요체|HAPNIDA_KEEP/.test(line)) return line;
    const sp=/\.(test|match|replace|search|split|exec)\(|RegExp/.test(line)?regexSpans(line):[];
    const inRe=i=>sp.some(([a,b])=>i>=a&&i<b);
    const rep=(re,tail)=>line=line.replace(re,(m,W,off,str)=>{
      if(inRe(off)) return m;
      const after=str.slice(off+m.length,off+m.length+1), isQ=after==='?';
      const r=tail==='죠'?(()=>{ const x=stemEnd(W); return x?q(x,isQ):null; })():conv(W,isQ);
      if(!r||r===m){ const k=m.slice(-6); skipped[k]=(skipped[k]||0)+1; return m; }
      const k=m.slice(-7)+' → '+r.slice(-8); stat[k]=(stat[k]||0)+1; total++; return r; });
    rep(RE,'요'); rep(RE2,'죠');
    /* 기호나 태그 바로 뒤에 붙은 예요, 이에요 */
    line=line.replace(RE3,(m,pre,w,off)=>{ if(inRe(off)) return m; total++; stat[w+' → 입니다']=(stat[w+' → 입니다']||0)+1; return pre+'입니다'; });
    return line;
  });
  return out.join(nl);
}
module.exports={convText};
if(require.main!==module) return;
for(const f of FILES){
  if(!fs.existsSync(R+f)) continue;
  const res=convText(fs.readFileSync(R+f,'utf8'));
  if(!DRY) fs.writeFileSync(R+f,res);
}
const srt=o=>Object.entries(o).sort((a,b)=>b[1]-a[1]).map(([k,v])=>v+'\t'+k).join('\n');
fs.mkdirSync(R+'qa/16-fixes',{recursive:true});
if(total||DRY) fs.writeFileSync(R+'qa/16-fixes/R11-'+(DRY?'dry':'conversions')+'.txt','바꾼 문장 끝 '+total+'곳\n\n[바꾼 것]\n'+srt(stat)+'\n\n[그대로 둔 것]\n'+srt(skipped));
console.log('hapnida',DRY?'dry':'write','changed',total,'kinds',Object.keys(stat).length,'skipped kinds',Object.keys(skipped).length);
