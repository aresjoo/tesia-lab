/** Closed, ephemeral response requests; deliberately abstains on reference language. */
const NUM={한:1,두:2,세:3,네:4,다섯:5,여섯:6,일곱:7,여덟:8,아홉:9,열:10,one:1,two:2,three:3,four:4};
// One lexicon supplies both event matching and adjacent persistent targets.
// Retain each event's original captures, flags and word boundaries unchanged.
const KO_COUNT_EVENT_SOURCE=/((?<![0-9\p{L}])(?:한|두|세|네|다섯|여섯|일곱|여덟|아홉|열)|(?<![0-9])[0-9]{1,6})\s*문장(?:으로|만|\s*유지|\s*$)/u.source;
const KO_LANGUAGE_EVENT_SOURCE=/(한국어|영어|일본어)(?:로|\s*(?=한\s*문장|두\s*문장|세\s*문장|네\s*문장|[0-9]+\s*문장))/.source;
const KO_DETAIL_EVENT_SOURCE=/자세히(?=\s*(?:설명|알려|답|분석|비교|써|작성|풀어|부탁|[:：]|$))|상세히|상세한\s*보고서/.source;
const KO_PARAGRAPH_EVENT_SOURCE=/(?:한|두|세|네|[1-4])\s*문단/.source;
const COUNT_EVENTS=new RegExp(KO_COUNT_EVENT_SOURCE+'|'+/\b(one|two|three|four|[0-9]{1,6})\s+sentences?\b/.source,'giu');
const DETAIL_EVENTS=new RegExp(KO_DETAIL_EVENT_SOURCE+'|'+/in\s+detail|more\s+detail|detailed\s+(?:report|explanation)|詳しく|くわしく|詳細に/.source+'|'+KO_PARAGRAPH_EVENT_SOURCE+'|'+/\b(?:one|two|three|four|[1-4])\s+paragraphs?\b/.source,'gi');
const LANGUAGE_EVENTS=new RegExp(KO_LANGUAGE_EVENT_SOURCE+'|'+/\b(?:in|reply\s+in|answer\s+in)\s+(Korean|English|Japanese)\b|(?:日本語|韓国語|英語)で/.source,'gi');
function maskQuoted(text){
 // Latin contractions share one word predicate with ASCII delimiter complements.
 // Korean noun/particle adjacency remains a literal quoted-data boundary.
 const latinWordChar='[\\p{Script=Latin}\\p{N}]';
 const asciiQuote="(?<!"+latinWordChar+")'(?:[^'\\n]|(?<="+latinWordChar+")'(?="+latinWordChar+"))*'(?!"+latinWordChar+")";
 const otherQuotes=/```[\s\S]*?(?:```|$)|`[^`\n]*`|"(?:\\.|[^"\\])*"|“[^”]*”|‘(?:[^’]|(?<=[\p{Script=Latin}\p{N}])’(?=[\p{Script=Latin}\p{N}]))*(?!(?<=[\p{Script=Latin}\p{N}])’(?=[\p{Script=Latin}\p{N}]))’|「[^」]*」/gu;
 return text.replace(new RegExp(otherQuotes.source+'|'+asciiQuote,'gu'),m=>m.replace(/[^\n]/g,' '));
}

// Transformation targets are local when a target format directly qualifies a
// transformation verb. Nominal objects below cover format-free references; no
// arbitrary scan across sentences or financial analysis subjects.
function isTransformRequest(text){
 const count='(?:한|두|세|네|다섯|여섯|일곱|여덟|아홉|열|[0-9]+)\\s*문장(?:으로|만)?';
 const format='(?:\\s*(?:(?:한국어|영어|일본어)(?:로)?|'+count+'|짧게|간단히|자세히|정중하게|다시))*\\s*';
 const action='(?:번역(?:해|하)|요약(?:해|하)|정리(?:해|하)|교정(?:해|하)|바꿔|고쳐|다듬)';
 const target='(?:(?:한국어|영어|일본어)로|'+count+')';
 // A trailing format qualifies the same conversion, including omitted objects.
 if(new RegExp(action+'(?:줘|주세요)?\\s*'+target+format,'i').test(text))return true;
 // Format-free summary commands establish a task for adjacent format clauses.
 // Do not reinterpret a response format before an intervening analysis subject.
 const hasFormat=/(?:한국어|영어|일본어)(?:로)?|(?:한|두|세|네|다섯|여섯|일곱|여덟|아홉|열|[0-9]+)\s*문장|\b(?:Korean|English|Japanese|sentences?)\b/i.test(text);
 if(!hasFormat&&/(?:요약|정리)(?:해|하)|\bsummarize\b/i.test(text))return true;
 // Target-format adjacency does not depend on the noun or its particle.
 // A general response format before an intervening analysis subject is not
 // transformation evidence: "한국어 한 문장으로 성과를 요약해줘" stays separate.
 if(new RegExp('(?:(?:한국어|영어|일본어)로|'+count+')'+format+action,'i').test(text))return true;
 // English imperative has verb-object-target order. Restrict the scan to one
 // clause, so a later independent response directive does not scope this task.
 if(/\bsummarize\b[^.!?。！？;,，:\n]*\b(?:in\s+(?:Korean|English|Japanese)|(?:one|two|three|four|[0-9]+)\s+sentences?)\b/i.test(text))return true;
 if(new RegExp('(?:답변|답|응답|결과|출력형식|출력|문장|문단|문안|기사|단락|글|문서|보고서|텍스트|내용)(?:을|를)'+format+action,'i').test(text))return true;
 if(new RegExp('(?:고객에게\\s*보낼|(?:간단한|정확한|정중한)\\s*문장(?:으로)?)'+format+'(?:바꿔|고쳐|교정|다듬)','i').test(text))return true;
 return /(?:번역(?:해|하)|옮겨(?:줘|주세요)|翻訳(?:して|してください))|\b(?:translate|rewrite)\b|\b(?:write|summarize|render|convert|put)\s+(?:this|that|(?:the|a|provided|following)\s+(?:report|article|paragraph|text|sentence))\b/i.test(text);
}
function directiveBoundaries(text){
 // Replace only conjunctions of known directive verbs; preserve UTF-16 offsets.
 return text.replace(/((?:답해주|대답해주|대답하|답하|요약하|정리하|번역하|설명하|바꾸|고치|교정하))고(?=\s)/g,'$1;')
  .replace(/(^|\s)그리고(?=\s)/g,(_,space)=>space+';;;');
}

// Only format-only or explicitly task-referential clauses can inherit a nearby
// conversion scope. Independent response/topic clauses are boundaries.
function hasPersistentResponseMarker(text){
 // Adjacent targets use the actual KO event grammar, including its lookarounds.
 // Noun continuations such as 항상성/앞으로의 remain outside that grammar.
 const target='(?:'+[KO_LANGUAGE_EVENT_SOURCE,KO_COUNT_EVENT_SOURCE,KO_DETAIL_EVENT_SOURCE,KO_PARAGRAPH_EVENT_SOURCE].join('|')+')';
 return new RegExp('(?:^|\\s|(?:답변|응답|대답)(?:은|는))(?:(?:앞으로(?:는|도)?|항상|이후\\s*대화(?:에서(?:는|도)?|는|도)?)(?=\\s|[:：]|$|'+target+')|(?:from\\s+now\\s+on|always)(?=\\s|[:：]|$))','iu').test(text);
}
function isDependentFormatClause(text){
 // Standalone persistent markers cannot inherit a conversion's local scope.
 // Delimit markers to avoid treating always-on or 항상성 prose as a grant.
 if(hasPersistentResponseMarker(text))return false;
 const hasFormat=/(?:한국어|영어|일본어)로|(?:한|두|세|네|다섯|여섯|일곱|여덟|아홉|열|[0-9]+)\s*문장|\b(?:Korean|English|Japanese|sentences?)\b|자세히|상세히|in\s+detail/i.test(text);
 if(!hasFormat)return false;
 if(/^\s*(?:그\s*)?(?:결과|설명|요약|번역문|출력|답변)(?:은|는)/.test(text))return true;
 const rest=text
  .replace(/(?:한국어|영어|일본어)(?:로)?|(?:한|두|세|네|다섯|여섯|일곱|여덟|아홉|열|[0-9]+)\s*문장(?:으로|만)?|\b(?:one|two|three|four|[0-9]+)\s+sentences?\b|\b(?:Korean|English|Japanese)\b|자세히|상세히|in\s+detail/gi,' ')
  .replace(/\b(?:keep|it|to|in|only|just|please)\b|(?:해줘|해주세요|부탁해|부탁합니다)/gi,' ').trim();
 return !rest;
}
function localTransformClauses(clauses){
 const transforms=clauses.map(c=>isTransformRequest(c[0]));
 const dependents=clauses.map(c=>isDependentFormatClause(c[0]));
 const local=transforms.slice();
 // A contiguous run of task/formats is local iff it contains a transformation.
 // Single scan avoids rewalking a long sequence of format-only clauses.
 for(let i=0;i<clauses.length;){
  if(!transforms[i]&&!dependents[i]){i++;continue;}
  const start=i;let hasTransform=false;
  while(i<clauses.length&&(transforms[i]||dependents[i])){hasTransform ||= transforms[i];i++;}
  if(hasTransform)for(let j=start;j<i;j++)local[j]=true;
 }
 return local;
}

// Attribution is checked at the matched permission, across an adjacent comma or
// colon, rather than against every permission in the same message. The fixed
// local window avoids rescanning long messages and preserves independent grants.
const questionNegationBefore=/(?:do\s+not|don['’]t)\s*$/i;

function isReportedQuestionDirective(text,index,length){
 // Include negation in attribution context only; the event raw span stays intact.
 const before=text.slice(Math.max(0,index-128),index)
  .replace(questionNegationBefore,'');
 let after=text.slice(index+length,index+length+128);
 // Only the matched stop stem needs its connective ending consumed for attribution.
 // Longer negated endings precede 하; raw event spans remain unchanged.
 if(/그만$/.test(text.slice(index,index+length)))after=after
  .replace(/^\s*하지\s*(?:말|마)(?:세요|요)?/,'')
  .replace(/^\s*(?:해|하)/,'');
 after=after.replace(/^\s*(?:줘|주세요|요)(?=\s|$)/,'')
  .replace(/^\s*하지\s*(?:말|마)/,'');
 // Quotation/connective stems identify reported speech; later speech endings
 // stay unrestricted. Bare 라 also starts ordinary nouns and is not a marker.
 const koreanReported=/^\s*(?:[,，]\s*)?(?:이?라(?:고|는|더|던)|란(?=\s|$))/.test(after);
 // Active/passive report verbs share the same local grammar. The addressee is
 // optional; this admits "was told" without inferring a speaker's identity.
 const speech='(?:said|says|say|saying|tell|tells|telling|told)(?:\\s+(?:me|us|you|him|her|them))?';
 const englishBefore=new RegExp('\\b'+speech+'\\s*[,，:：]?\\s*(?:that\\s+)?$','i').test(before);
 const englishAfter=new RegExp('^\\s*[,，]\\s*(?:[a-z]+(?:\\s+[a-z]+){0,2}\\s+)?'+speech+'\\b','i').test(after);
 return koreanReported||englishBefore||englishAfter;
}

export function explicitResponsePreferences(messages){
 const values={},evidence={};
 let localValues={},localEvidence={};
 for(const [messageIndex,m] of (messages||[]).entries()){
  if(m?.role!=='user'||typeof m.content!=='string')continue;
  const raw=m.content,events=[];let masked=maskQuoted(raw);
  // A local transformation overlays this user turn only. Older local values never
  // replace the remembered explicit response preferences.
  localValues={};localEvidence={};
  const transformText=directiveBoundaries(masked).split(/[.!?。！？;,，\n]/).some(isTransformRequest);
  // A colon after a transformation introduces supplied copy. Quoted copy is
  // already masked; unquoted copy extends to the end of this message.
  if(transformText)for(const mark of masked.matchAll(/[:：]/g)){
   const prefix=masked.slice(0,mark.index).split(/[.!?。！？;,，\n]/).at(-1);
   if(!/(?:번역|바꿔|옮겨|요약|정리|교정|고쳐|써|다듬|翻訳)|\b(?:translate|rewrite|write|summarize|render|convert|put)\b/i.test(prefix))continue;
   if(/^\s*["'“‘「`]/.test(raw.slice(mark.index+1)))continue;
   masked=masked.slice(0,mark.index+1)+masked.slice(mark.index+1).replace(/[^\n]/g,' ');break;
  }
  masked=directiveBoundaries(masked);
  const clauses=Array.from(masked.matchAll(/[^.!?。！？;,，\n]+/g));
  const localScopes=localTransformClauses(clauses);
  for(const [clauseIndex,clause] of clauses.entries()){
   let text=clause[0];const start=clause.index;
   const persistentScope=hasPersistentResponseMarker(text)&&/(?:답해|답하|대답|응답|설명해)|\b(?:answer|reply|respond)\b/i.test(text);
   const localTransform=localScopes[clauseIndex];
   const descriptiveTail=/^\s*(?:(?:발표|발행|출판|배포|보도|작성|기록|방송|제공|설명|답변|답|번역|요약|말|쓰|표시|적|옮)[^\s,.!?]{0,16}(?:된|되어|돼|하는|주는|인|던|힌|은|는))/;
   const describesService=/(?:도구|서비스|프로그램|앱|사이트)/.test(text)&&/(?:해주는|해\s*주는|하는|된|쓰인|발표된)/.test(text);
   if(/왜.{0,60}(?:해야|필요|했|말라고)|(?:뜻|의미)(?:을|를)?\s*(?:설명|알려)|(?:예시|예를\s*들어|프롬프트)\s*[:：]|(?:프롬프트|문구|예시)(?:를|을)?\s*(?:교정|번역|해석|설명)\s*[:：]|\bwhy\b|\bwhat\b.{0,30}\bmean\b/i.test(text))continue;
   const detailTail=/(?:자세히|상세히|詳しく|in\s+detail)\s*$/i.test(text);
   const closedTail=/(?:한|두|세|네|다섯|여섯|일곱|여덟|아홉|열|[0-9]+)\s*문장(?:으로|만)?\s*$/.test(text);
   const request=detailTail||closedTail||/(?:답해|답하|대답해|대답하|설명해|설명하|알려|요약해|요약하|비교해|짜줘|정리해|써줘|작성해|바꿔줘|풀어줘|부탁|유지|해줘|주세요)|\b(?:please|answer|reply|respond|write|explain|summarize|translate|rewrite|give|keep|use|make)\b|(?:答えて|説明して|要約して|お願いします|ください)/i.test(text);
   const event=(key,value,match)=>{events.push({key,value,index:start+match.index,length:match[0].length,local:key!=='questionsStopped'&&localTransform&&!persistentScope});};
   for(const match of text.matchAll(COUNT_EVENTS)){
    const after=text.slice(match.index+match[0].length);
    if(descriptiveTail.test(after))continue;
    if(/에서\s*$/.test(text.slice(0,match.index))&&/^\s*(?:번역|옮겨)/.test(after))continue;
    if(/^(?:\s*(?:말고|쓰지|하지|아니|답했|설명했|인용|적힌|된|작성돼|작성되어))/.test(after)||/\b(?:did|previously|earlier)\b/i.test(text.slice(0,match.index))&&/\banswered\b/i.test(after))continue;
    if(!request&&after.trim())continue;
    if(/(?:답하지|쓰지|설명하지)\s*마|\bdo\s+not\b|\bdon['’]t\b/i.test(text))continue;
    const word=(match[1]||match[2]).toLowerCase(),n=NUM[word]||Number(word);event('sentenceCount',Number.isInteger(n)&&n>=1&&n<=20?n:null,match);
   }
   for(const match of text.matchAll(DETAIL_EVENTS))if(request)event('sentenceCount',null,match);
   for(const match of text.matchAll(LANGUAGE_EVENTS)){
    const after=text.slice(match.index+match[0].length);
    if(/^(?:\s*(?:말고|쓰지|하지|아니|된|쓰인|작성된|적힌|표시된|답했|설명했))/.test(after)||/(?:답하지|쓰지|설명하지)\s*마|\bdo\s+not\b|\bdon['’]t\b/i.test(text))continue;
    if(!request&&after.trim())continue;
    const referenceAfter=after.replace(/^\s*(?:한|두|세|네|다섯|여섯|일곱|여덟|아홉|열|[0-9]+)\s*문장(?:으로|만)?\s*/,'');
    if(descriptiveTail.test(referenceAfter)||/^\s*(?:된|쓰인|작성된|적힌|표시된)/.test(referenceAfter)||describesService||/\b(?:written|published|released|issued|presented|available)\s*$/i.test(text.slice(0,match.index)))continue;
    const label=match[1]||match[2]||match[0];event('language',/한국어|Korean|韓国語/i.test(label)?'ko':/일본어|Japanese|日本語/i.test(label)?'ja':'en',match);
   }
   for(const match of text.matchAll(/질문은?\s*(?:여기서|이제)?\s*그만|(?:이제\s*)?질문(?:은|을)?\s*(?:하지|묻지)\s*(?:말고|마)|no\s+(?:more\s+)?questions|stop\s+asking\s+questions/gi)){
    const after=text.slice(match.index+match[0].length),before=text.slice(0,match.index);
    if(/(?<![\p{L}\p{N}])(?:이|그|해당|이번)\s*$/u.test(before))continue;
    if(isReportedQuestionDirective(masked,start+match.index,match[0].length))continue;
    if(/^(?:하지\s*말|하지\s*마)/.test(after)||questionNegationBefore.test(before))event('questionsStopped',false,match);
    else event('questionsStopped',true,match);
   }
   for(const match of text.matchAll(/(?:다시\s*)?질문해도\s*(?:돼|됩니다)(?=요?(?:\s|$))|다시\s*질문해(?=\s*(?:(?:줘|주세요)(?:\s|$)|$))|물어봐도\s*(?:돼|됩니다)(?=요?(?:\s|$))|you\s+can\s+ask\s+(?:me\s+)?questions\b/gi)){
    // A reported permission has no user authority; a later independent grant
    // keeps its own exact raw span even across clause punctuation.
    if(isReportedQuestionDirective(masked,start+match.index,match[0].length))continue;
    const isPermissionQuestion=/[?？]/.test(masked[start+clause[0].length]||'');
    const explicitAssistantTarget=/(?:나한테|저한테|나에게|저에게|내게|제게)|(?:네가|너는)\s*(?:다시\s*)?(?:질문|물어)|you\s+can\s+ask/i.test(text);
    // A bare fragment never authorizes resume by default. Only an imperative
    // ending or an explicitly directed, terminal assistant command can do so.
    if(/^다시\s*질문해$/.test(match[0])&&!/^\s*(?:줘|주세요)(?:\s|$)/.test(text.slice(match.index+match[0].length))&&!explicitAssistantTarget)continue;
    if((isPermissionQuestion&&!explicitAssistantTarget)||/(?:내가|제가)\s*(?:(?:너에게|네게|당신에게)\s*)?(?:다시\s*)?$/.test(text.slice(0,match.index)))continue;
    event('questionsStopped',false,match);
   }
  }
  events.sort((a,b)=>a.index-b.index);
  for(const e of events){
   const span={messageIndex,start:e.index,end:e.index+e.length,text:raw.slice(e.index,e.index+e.length)};
   if(e.local){localValues[e.key]=e.value;localEvidence[e.key]=span;}
   else{values[e.key]=e.value;evidence[e.key]=span;delete localValues[e.key];delete localEvidence[e.key];}
  }
 }
 return Object.freeze({values:Object.freeze({...values,...localValues}),evidence:Object.freeze({...evidence,...localEvidence})});
}
export function responsePreferenceFrame(values){
 if(Object.keys(values).some(k=>!['language','sentenceCount','questionsStopped'].includes(k)) || values.language!==undefined&&!['ko','en','ja'].includes(values.language) || values.sentenceCount!==undefined&&values.sentenceCount!==null&&(!Number.isInteger(values.sentenceCount)||values.sentenceCount<1||values.sentenceCount>20) || values.questionsStopped!==undefined&&typeof values.questionsStopped!=='boolean')throw new Error('INVALID_RESPONSE_PREFERENCES');
 if(!Object.keys(values).length)return '';
 const composition=values.sentenceCount===1?'본문은 현재 요청에 직접 답하는 정확히 한 문장으로 완결합니다. 필요한 비교 차이·정정·유지 조건·미실행 상태와 꼭 필요한 가정·미확인·한계는 그 한 문장 안에 연결하고, 독립 주의문이나 추가 안내로 둘째 문장을 만들지 않습니다. 정의·번역·교정에는 불필요한 계산이나 위험 안내를 추가하지 않습니다. ':'';
 return composition+'이번 응답의 명시 형식 제약(user 역할 대화에 명시된 폐쇄형 값만 확인; 금융·실행 권한과 무관): '+JSON.stringify(values)+'\n언어와 정확한 본문 문장 수를 이번 응답에도 유지합니다. sentenceCount:null이면 고정 문장 수를 해제합니다. questionsStopped:true이면 본문 질문 및 ASK/NEXT를 중단합니다. 필요한 금융 한계는 문장 수 안에 포함하고 주변 설명을 줄입니다. '+(values.sentenceCount===1?'서버 정책':'아래 서버 정책')+'의 신뢰·실행·근거 경계는 그대로 지킵니다.\n\n';
}
