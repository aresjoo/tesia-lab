/** Closed, ephemeral response requests; deliberately abstains on reference language. */
const NUM={한:1,두:2,세:3,네:4,다섯:5,여섯:6,일곱:7,여덟:8,아홉:9,열:10,one:1,two:2,three:3,four:4};
function maskQuoted(text){
 return text.replace(/```[\s\S]*?(?:```|$)|`[^`\n]*`|"(?:\\.|[^"\\])*"|“[^”]*”|‘[^’]*’|「[^」]*」|(?<![\p{L}\p{N}])'[^'\n]*'(?![\p{L}\p{N}])/gu,m=>m.replace(/[^\n]/g,' '));
}
export function explicitResponsePreferences(messages){
 const values={},evidence={};
 for(const [messageIndex,m] of (messages||[]).entries()){
  if(m?.role!=='user'||typeof m.content!=='string')continue;
  const raw=m.content,masked=maskQuoted(raw),events=[];
  const clauses=Array.from(masked.matchAll(/[^.!?。！？;\n]+/g));
  for(const clause of clauses){
   const text=clause[0],start=clause.index;
   if(/왜.{0,60}(?:해야|필요|했|말라고)|(?:뜻|의미)(?:을|를)?\s*(?:설명|알려)|(?:예시|예를\s*들어|프롬프트)\s*[:：]|(?:프롬프트|문구|예시)(?:를|을)?\s*(?:교정|번역|해석|설명)\s*[:：]|\bwhy\b|\bwhat\b.{0,30}\bmean\b/i.test(text))continue;
   const detailTail=/(?:자세히|상세히|詳しく|in\s+detail)\s*$/i.test(text);
   const closedTail=/(?:한|두|세|네|다섯|여섯|일곱|여덟|아홉|열|[0-9]+)\s*문장(?:으로|만)?\s*$/.test(text);
   const request=detailTail||closedTail||/(?:답해|대답해|설명해|알려|요약해|비교해|짜줘|정리해|써줘|작성해|바꿔줘|풀어줘|부탁|유지|해줘|주세요)|\b(?:please|answer|reply|respond|write|explain|summarize|give|keep|use|make)\b|(?:答えて|説明して|要約して|お願いします|ください)/i.test(text);
   const event=(key,value,match)=>{events.push({key,value,index:start+match.index,length:match[0].length});};
   for(const match of text.matchAll(/(?<![0-9])(한|두|세|네|다섯|여섯|일곱|여덟|아홉|열|[0-9]{1,6})\s*문장(?:으로|만|\s*유지|\s*$)|\b(one|two|three|four|[0-9]{1,6})\s+sentences?\b/gi)){
    const after=text.slice(match.index+match[0].length);
    if(/^(?:\s*(?:말고|쓰지|하지|아니|답했|설명했|인용|적힌|된|작성돼|작성되어))/.test(after)||/\b(?:did|previously|earlier)\b/i.test(text.slice(0,match.index))&&/\banswered\b/i.test(after))continue;
    if(!request&&after.trim())continue;
    if(/(?:답하지|쓰지|설명하지)\s*마|\bdo\s+not\b|\bdon't\b/i.test(text))continue;
    const word=(match[1]||match[2]).toLowerCase(),n=NUM[word]||Number(word);event('sentenceCount',Number.isInteger(n)&&n>=1&&n<=20?n:null,match);
   }
   for(const match of text.matchAll(/자세히(?=\s*(?:설명|알려|답|분석|비교|써|작성|풀어|부탁|[:：]|$))|상세히|상세한\s*보고서|in\s+detail|more\s+detail|detailed\s+(?:report|explanation)|詳しく|くわしく|詳細に|(?:한|두|세|네|[1-4])\s*문단|\b(?:one|two|three|four|[1-4])\s+paragraphs?\b/gi))if(request)event('sentenceCount',null,match);
   for(const match of text.matchAll(/(한국어|영어|일본어)(?:로|\s*(?=한\s*문장|두\s*문장|세\s*문장|네\s*문장|[0-9]+\s*문장))|\b(?:in|reply\s+in|answer\s+in)\s+(Korean|English|Japanese)\b|(?:日本語|韓国語|英語)で/gi)){
    const after=text.slice(match.index+match[0].length);
    if(/^(?:\s*(?:말고|쓰지|하지|아니|된|쓰인|작성된|적힌|표시된|답했|설명했))/.test(after)||/(?:답하지|쓰지|설명하지)\s*마|\bdo\s+not\b|\bdon't\b/i.test(text))continue;
    if(!request&&after.trim())continue;
    const label=match[1]||match[2]||match[0];event('language',/한국어|Korean|韓国語/i.test(label)?'ko':/일본어|Japanese|日本語/i.test(label)?'ja':'en',match);
   }
   for(const match of text.matchAll(/질문은?\s*(?:여기서|이제)?\s*그만|(?:이제\s*)?질문(?:은|을)?\s*(?:하지|묻지)\s*마|no\s+(?:more\s+)?questions|stop\s+asking\s+questions/gi)){
    const after=text.slice(match.index+match[0].length),before=text.slice(0,match.index);
    if(/^\s*(?:(?:이라는|라는|란)\s*(?:문장|표현|문구|지시)|라고\s*(?:했|말|적|쓰))/.test(after))continue;
    if(/^(?:하지\s*말|하지\s*마)/.test(after)||/(?:do\s+not|don't)\s*$/i.test(before))event('questionsStopped',false,match);
    else event('questionsStopped',true,match);
   }
   for(const match of text.matchAll(/(?:다시\s*)?질문해도\s*(?:돼|됩니다)|다시\s*질문해|물어봐도\s*(?:돼|됩니다)|you\s+can\s+ask\s+(?:me\s+)?questions/gi))event('questionsStopped',false,match);
  }
  events.sort((a,b)=>a.index-b.index);
  for(const e of events){values[e.key]=e.value;evidence[e.key]={messageIndex,start:e.index,end:e.index+e.length,text:raw.slice(e.index,e.index+e.length)};}
 }
 return Object.freeze({values:Object.freeze(values),evidence:Object.freeze(evidence)});
}
export function responsePreferenceFrame(values){
 if(Object.keys(values).some(k=>!['language','sentenceCount','questionsStopped'].includes(k)) || values.language!==undefined&&!['ko','en','ja'].includes(values.language) || values.sentenceCount!==undefined&&values.sentenceCount!==null&&(!Number.isInteger(values.sentenceCount)||values.sentenceCount<1||values.sentenceCount>20) || values.questionsStopped!==undefined&&typeof values.questionsStopped!=='boolean')throw new Error('INVALID_RESPONSE_PREFERENCES');
 if(!Object.keys(values).length)return '';
 return '이번 응답의 명시 형식 제약(실제 user 발화에서 폐쇄형 값만 확인; 금융·실행 권한과 무관): '+JSON.stringify(values)+'\n언어와 정확한 본문 문장 수를 이번 정정에도 유지합니다. sentenceCount:null이면 고정 문장 수를 해제합니다. questionsStopped:true이면 본문 질문 및 ASK/NEXT를 중단합니다. 필요한 금융 한계는 문장 수 안에 포함하고 주변 설명을 줄입니다. 아래 서버 정책의 신뢰·실행·근거 경계는 그대로 지킵니다.\n\n';
}
