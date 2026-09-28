// TETH AI 트레이더 캐릭터 20종. 같은 화풍(어두운 배경 + 색 기운 + 흉상), 부품 조합으로 서로 다른 인물.
// 사용: node avatars.cjs  → assets/avatars/t01.svg ... t20.svg + 미리보기 sheet.html
const fs=require('fs');
const OUT='C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab fork 1/assets/avatars/';
const SKIN={a:['#f7d9bf','#e9bd9c'],b:['#f0c8a4','#dca982'],c:['#d9a47a','#c08a60'],d:['#b47a52','#99633f'],e:['#8a5a3a','#6f452a'],f:['#fbe3d0','#efc7ae']};
const HAIRC={black:'#16181d',brown:'#4a2f22',dark:'#2a2019',auburn:'#7a3b22',blond:'#d9b36a',gray:'#aeb4bd',white:'#e6e9ee',navy:'#1f2a44',mint:'#2fe0a0',pink:'#e8729a',violet:'#7d6bf0'};

const HAIR_BACK={
  bob:c=>`<path d="M25 45c0-21 9-33 23-33s23 12 23 33v15c0 4-2 6-6 6H31c-4 0-6-2-6-6z" fill="${c}"/>`,
  long:c=>`<path d="M23 47c0-23 10-36 25-36s25 13 25 36v31H23z" fill="${c}"/>`,
  pony:c=>`<path d="M62 24c12 1 18 12 16 27-1 8-5 13-9 14 3-12 1-24-9-33z" fill="${c}"/>`,
  afro:c=>`<circle cx="48" cy="34" r="27" fill="${c}"/>`,
  hood:c=>`<path d="M19 78c-2-34 9-62 29-62s31 28 29 62z" fill="${c}"/>`
};
const HAIR_FRONT={
  short:c=>`<path d="M29 44c-2-18 7-29 19-29s21 11 19 29c-2-6-5-10-8-12-5 3-16 4-26 1-3 2-5 6-4 11z" fill="${c}"/>`,
  side:c=>`<path d="M29 46c-4-20 6-32 20-32 13 0 22 10 18 31-2-8-5-14-10-17-8 5-17 6-24 4-2 3-4 8-4 14z" fill="${c}"/>`,
  buzz:c=>`<path d="M30 41c-1-16 7-25 18-25s19 9 18 25c-3-9-9-14-18-14s-15 5-18 14z" fill="${c}" opacity=".9"/>`,
  fringe:c=>`<path d="M29 45c-1-17 7-28 19-28s20 11 19 28c-2-5-4-8-7-10-3 2-7 3-12 3s-9-1-12-3c-3 2-5 5-7 10z" fill="${c}"/>`,
  part:c=>`<path d="M30 45c0-16 7-27 18-27s18 11 18 27c-3-10-9-16-18-19-9 3-15 9-18 19z" fill="${c}"/>`,
  bun:c=>`<circle cx="48" cy="13" r="8.5" fill="${c}"/><path d="M30 43c0-15 8-25 18-25s18 10 18 25c-4-8-10-13-18-13s-14 5-18 13z" fill="${c}"/>`,
  curly:c=>[[31,30],[38,22],[48,19],[58,22],[65,30],[29,39],[67,39]].map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="7.4" fill="${c}"/>`).join(''),
  swept:c=>`<path d="M29 44c-3-17 6-29 20-29 12 0 21 9 18 28-3-9-8-15-18-17-8 1-15 6-20 18z" fill="${c}"/>`,
  spiky:c=>`<path d="M29 44c-2-9 0-17 4-22l3 6 3-11 5 9 5-12 4 12 6-9 2 11 5-5c3 6 4 13 2 21-3-8-8-13-20-13-10 0-16 5-19 13z" fill="${c}"/>`,
  afro:c=>`<path d="M29 44c-1-12 6-20 19-20s20 8 19 20c-3-7-9-11-19-11s-16 4-19 11z" fill="${c}"/>`,
  none:()=>''
};
const HEAD={
  none:()=>'',
  cap:(c,c2)=>`<path d="M28 38c0-14 8-23 20-23s20 9 20 23z" fill="${c}"/><path d="M27 35h43c6 0 11 3 13 7H27z" fill="${c2||c}"/><circle cx="48" cy="16" r="2" fill="${c2||c}"/>`,
  beanie:(c,c2)=>`<path d="M28 38c0-16 8-26 20-26s20 10 20 26z" fill="${c}"/><rect x="26" y="33" width="44" height="8.5" rx="4" fill="${c2||c}"/>`,
  helmet:(c,c2)=>`<path d="M25.5 50c-3-23 6-38 22.5-38s25.5 15 22.5 38c-.4 3-1.6 5.6-3.4 7.6 1.4-12-.6-19.6-4.6-24.6-4.5 2-9.5 3-14.5 3s-10-1-14.5-3c-4 5-6 12.6-4.6 24.6-1.8-2-3-4.6-3.4-7.6z" fill="${c}"/><path d="M33 33c4.5-2 9.5-3 15-3s10.5 1 15 3" stroke="${c2}" stroke-width="3.2" fill="none" stroke-linecap="round"/><path d="M46.6 12.2h2.8v12h-2.8z" fill="${c2}"/>`,
  phones:(c,c2)=>`<path d="M27 44c-2-20 7-32 21-32s23 12 21 32" fill="none" stroke="${c}" stroke-width="4" stroke-linecap="round"/><rect x="22.5" y="38" width="8" height="15" rx="4" fill="${c2}"/><rect x="65.5" y="38" width="8" height="15" rx="4" fill="${c2}"/>`,
  bucket:(c,c2)=>`<path d="M30 35c1-12 8-19 18-19s17 7 18 19z" fill="${c}"/><path d="M21 38c8-5 17-7 27-7s19 2 27 7c-7 3-17 5-27 5s-20-2-27-5z" fill="${c2||c}"/>`
};
const EYES={
  dot:()=>`<circle cx="41" cy="45" r="2.3" fill="#1b1d22"/><circle cx="55" cy="45" r="2.3" fill="#1b1d22"/>`,
  calm:()=>`<path d="M38 45.5c2-2 4.5-2 6.5 0M51.5 45.5c2-2 4.5-2 6.5 0" fill="none" stroke="#1b1d22" stroke-width="2" stroke-linecap="round"/>`,
  smile:()=>`<path d="M38 46c2-3 4.5-3 6.5 0M51.5 46c2-3 4.5-3 6.5 0" fill="none" stroke="#1b1d22" stroke-width="2.2" stroke-linecap="round"/>`,
  sharp:()=>`<path d="M37.5 44l7 1.2M58.5 44l-7 1.2" stroke="#1b1d22" stroke-width="2.6" stroke-linecap="round"/><circle cx="41.5" cy="46.5" r="1.7" fill="#1b1d22"/><circle cx="54.5" cy="46.5" r="1.7" fill="#1b1d22"/>`,
  wide:()=>`<circle cx="41" cy="45" r="3.4" fill="#fff"/><circle cx="55" cy="45" r="3.4" fill="#fff"/><circle cx="41.6" cy="45.4" r="1.9" fill="#1b1d22"/><circle cx="55.6" cy="45.4" r="1.9" fill="#1b1d22"/>`,
  none:()=>''
};
const BROW={
  flat:c=>`<path d="M37 39.5h8M51 39.5h8" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`,
  up:c=>`<path d="M37 40c2-2 5-2.4 8-1.4M51 38.6c3-1 6-.6 8 1.4" stroke="${c}" stroke-width="2" fill="none" stroke-linecap="round"/>`,
  angry:c=>`<path d="M37 38l8 2.4M59 38l-8 2.4" stroke="${c}" stroke-width="2.2" stroke-linecap="round"/>`,
  soft:c=>`<path d="M37.5 40.5c2.5-1.6 5-1.6 7.500 0M51 40.5c2.5-1.6 5-1.6 7.500 0" stroke="${c}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
  none:()=>''
};
const GLASS={
  none:()=>'',
  round:c=>`<circle cx="40.5" cy="45" r="6.2" fill="rgba(255,255,255,.10)" stroke="${c}" stroke-width="1.8"/><circle cx="55.500" cy="45" r="6.2" fill="rgba(255,255,255,.10)" stroke="${c}" stroke-width="1.8"/><path d="M46.700 45h2.600" stroke="${c}" stroke-width="1.8"/>`,
  square:c=>`<rect x="33.500" y="40" width="13" height="10" rx="2.500" fill="rgba(255,255,255,.10)" stroke="${c}" stroke-width="1.800"/><rect x="49.500" y="40" width="13" height="10" rx="2.500" fill="rgba(255,255,255,.10)" stroke="${c}" stroke-width="1.800"/><path d="M46.500 44.500h3" stroke="${c}" stroke-width="1.800"/>`,
  shade:c=>`<rect x="31" y="40" width="34" height="10.500" rx="5.200" fill="#0d1116"/><rect x="33.200" y="42.200" width="12.600" height="6" rx="3" fill="${c}"/><rect x="50.200" y="42.200" width="12.600" height="6" rx="3" fill="${c}"/>`,
  half:c=>`<path d="M34 44h12v3.500c0 2.500-2 4.500-6 4.500s-6-2-6-4.500zM50 44h12v3.500c0 2.500-2 4.500-6 4.500s-6-2-6-4.500z" fill="rgba(255,255,255,.12)" stroke="${c}" stroke-width="1.600"/><path d="M46 45h4" stroke="${c}" stroke-width="1.600"/>`
};
const MOUTH={
  smile:()=>`<path d="M42.500 56.500c3 3 8 3 11 0" fill="none" stroke="#7a3d30" stroke-width="2" stroke-linecap="round"/>`,
  grin:()=>`<path d="M41.500 55.500h13c-1 4.500-3.500 6.500-6.500 6.500s-5.500-2-6.500-6.500z" fill="#fff" stroke="#7a3d30" stroke-width="1.400" stroke-linejoin="round"/>`,
  flat:()=>`<path d="M43.500 58h9" stroke="#7a3d30" stroke-width="2" stroke-linecap="round"/>`,
  smirk:()=>`<path d="M43 58c3 .800 6.500 0 9.500-3" fill="none" stroke="#7a3d30" stroke-width="2" stroke-linecap="round"/>`,
  o:()=>`<ellipse cx="48" cy="58" rx="2.600" ry="3" fill="#7a3d30"/>`,
  none:()=>''
};
const FACIAL={
  none:()=>'',
  beard:c=>`<path d="M30.500 49c1 13 8 19.500 17.500 19.500S64.500 62 65.500 49c-3 5-6 6.500-9 6.500-2.500-2.500-5-3-8.500-3s-6 .500-8.500 3c-3 0-6-1.500-9-6.500z" fill="${c}"/>`,
  stache:c=>`<path d="M40 54.500c3-2.500 6-2.500 8-.500 2-2 5-2 8 .500-2 3-6 3.200-8 1-2 2.200-6 2-8-1z" fill="${c}"/>`,
  goatee:c=>`<path d="M43 60c1.500 5 3 7.500 5 7.500s3.500-2.500 5-7.500c-3 1.400-7 1.400-10 0z" fill="${c}"/>`,
  stubble:c=>`<path d="M31 50c1 12 8 18.500 17 18.500S64 62 65 50c-3 7-9 10-17 10s-14-3-17-10z" fill="${c}" opacity=".28"/>`
};
const CLOTH={
  tee:(c)=>`<path d="M12 96c2-18 15-28 36-28s34 10 36 28z" fill="${c}"/>`,
  shirt:(c,c2)=>`<path d="M12 96c2-18 15-28 36-28s34 10 36 28z" fill="${c}"/><path d="M38.500 68.500l9.500 13 9.500-13-9.500-3z" fill="#eef1f5"/><path d="M46 76h4l2.200 13-4.200 5-4.200-5z" fill="${c2}"/>`,
  suit:(c,c2)=>`<path d="M12 96c2-18 15-28 36-28s34 10 36 28z" fill="${c}"/><path d="M38 68l10 15 10-15-10-3z" fill="#eef1f5"/><path d="M46.200 77h3.600l1.800 12-3.600 4.500L44.400 89z" fill="${c2}"/><path d="M38 68l-8 6 12 22h6z" fill="rgba(0,0,0,.28)"/><path d="M58 68l8 6-12 22h-6z" fill="rgba(0,0,0,.28)"/>`,
  hoodie:(c,c2)=>`<path d="M10 96c2-19 15-29 38-29s36 10 38 29z" fill="${c}"/><path d="M36 69c3 6 7 9 12 9s9-3 12-9l4 3c-3 9-9 13-16 13s-13-4-16-13z" fill="rgba(0,0,0,.25)"/><path d="M43 80v9M53 80v9" stroke="${c2}" stroke-width="1.800" stroke-linecap="round"/>`,
  turtle:(c,c2)=>`<path d="M12 96c2-18 15-28 36-28s34 10 36 28z" fill="${c}"/><path d="M38.500 60.500h19v10c-5 3.500-14 3.500-19 0z" fill="${c2||c}"/>`,
  jacket:(c,c2)=>`<path d="M12 96c2-18 15-28 36-28s34 10 36 28z" fill="${c}"/><path d="M40 68l8 10 8-10 5 3-9 25h-8l-9-25z" fill="${c2}"/><path d="M48 78v18" stroke="rgba(0,0,0,.35)" stroke-width="1.600"/>`,
  vneck:(c,c2)=>`<path d="M12 96c2-18 15-28 36-28s34 10 36 28z" fill="${c}"/><path d="M39 68l9 15 9-15z" fill="${c2}"/>`
};
const EXTRA={
  none:()=>'',
  earring:c=>`<circle cx="30" cy="52" r="2" fill="${c}"/>`,
  scarf:c=>`<path d="M33 64c5 5 25 5 30 0l3 7c-7 6-29 6-36 0z" fill="${c}"/><path d="M56 70l4 15-7 2-2-15z" fill="${c}" opacity=".85"/>`,
  mole:()=>`<circle cx="57.500" cy="54" r="1" fill="#5a3324"/>`,
  blush:()=>`<ellipse cx="37" cy="52" rx="3.400" ry="2" fill="#ff8f8f" opacity=".35"/><ellipse cx="59" cy="52" rx="3.400" ry="2" fill="#ff8f8f" opacity=".35"/>`,
  freckle:()=>[[37,51],[39.500,52.500],[56.500,52.500],[59,51]].map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r=".800" fill="#a8623f" opacity=".7"/>`).join('')
};

const FACE={
  oval:c=>`<ellipse cx="48" cy="44" rx="18.5" ry="21.5" fill="${c}"/>`,
  round:c=>`<ellipse cx="48" cy="45" rx="20" ry="20" fill="${c}"/>`,
  long:c=>`<ellipse cx="48" cy="44.5" rx="16.6" ry="23" fill="${c}"/>`,
  square:c=>`<path d="M29.5 41c0-13 8-18.5 18.5-18.5S66.5 28 66.5 41v9c0 9.5-7.5 16-18.5 16s-18.5-6.5-18.5-16z" fill="${c}"/>`,
  vchin:c=>`<path d="M29.5 41c0-13 8-18.5 18.5-18.5S66.5 28 66.5 41c0 13-8.5 25.5-18.5 25.5S29.5 54 29.5 41z" fill="${c}"/>`
};
const EARX={oval:[29.5,66.5],round:[28,68],long:[31.2,64.8],square:[29.3,66.7],vchin:[29.5,66.5]};
function make(id,o){
  const sk=SKIN[o.skin], hc=HAIRC[o.hair]||o.hair, tint=o.tint, gid='g'+id;
  const p=[];
  p.push(`<defs><radialGradient id="${gid}" cx="${o.gx||72}%" cy="${o.gy||18}%" r="90%"><stop offset="0" stop-color="${tint}" stop-opacity=".62"/><stop offset=".6" stop-color="${tint}" stop-opacity=".16"/><stop offset="1" stop-color="${tint}" stop-opacity="0"/></radialGradient></defs>`);
  p.push(`<rect width="96" height="96" fill="#15181d"/><rect width="96" height="96" fill="url(#${gid})"/>`);
  if(o.back) p.push(HAIR_BACK[o.back](o.back==='hood'?o.cloth[1]:hc));
  p.push(`<path d="M41.500 58h13v12c-3.500 3.500-9.500 3.500-13 0z" fill="${sk[1]}"/>`);
  p.push(CLOTH[o.cloth[0]](o.cloth[1],o.cloth[2]));
  if(o.extra==='scarf') p.push(EXTRA.scarf(o.extraC));
  const fc=o.face||'oval', ex=EARX[fc];
  p.push(`<ellipse cx="${ex[0]}" cy="46" rx="3" ry="4.500" fill="${sk[1]}"/><ellipse cx="${ex[1]}" cy="46" rx="3" ry="4.500" fill="${sk[1]}"/>`);
  p.push(FACE[fc](sk[0]));
  if(o.facial) p.push(FACIAL[o.facial](o.facialC?HAIRC[o.facialC]||o.facialC:hc));
  if(o.extra&&o.extra!=='scarf') p.push(EXTRA[o.extra](o.extraC));
  if(true){
    p.push(BROW[o.brow||'flat'](o.browC?HAIRC[o.browC]:(o.hair==='blond'||o.hair==='gray'||o.hair==='white'?'#6b5a48':hc)));
    if(o.glass!=='shade') p.push(EYES[o.eyes||'dot']());
    p.push(GLASS[o.glass||'none'](o.glassC||'#1b1d22'));
    p.push(`<path d="M48 46.500v4.500l-2.200 1.400" fill="none" stroke="rgba(90,50,35,.5)" stroke-width="1.500" stroke-linecap="round" stroke-linejoin="round"/>`);
  }
  p.push(MOUTH[o.mouth||'smile']());
  p.push(HAIR_FRONT[o.front||'none'](hc));
  if(o.head) p.push(HEAD[o.head](o.headC[0],o.headC[1]));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">${p.join('')}</svg>`.replace(/(\d)\.(\d)00\b/g,'$1.$2');
}

const LIST=JSON.parse(fs.readFileSync(__dirname+'/avatars.json','utf8'));
let sheet='<!doctype html><meta charset="utf-8"><body style="margin:0;background:#0f1012;color:#e3e3e3;font:13px Pretendard,system-ui,sans-serif"><div style="display:grid;grid-template-columns:repeat(5,1fr);gap:18px;padding:24px;width:1100px">';
LIST.forEach(o=>{ const svg=make(o.id,o); fs.writeFileSync(OUT+o.id+'.svg',svg);
  sheet+=`<div style="display:flex;gap:12px;align-items:center;background:#17191c;border-radius:14px;padding:14px"><img src="${o.id}.svg?r=${Date.now()}" width="112" height="112" style="border-radius:50%"><div><img src="${o.id}.svg?r=${Date.now()}" width="44" height="44" style="border-radius:50%;display:block;margin-bottom:8px"><b>${o.id}</b><br>${o.name||''}</div></div>`; });
fs.writeFileSync(OUT+'_sheet.html',sheet+'</div>');
console.log('made',LIST.length);
