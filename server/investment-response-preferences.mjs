/** Closed, ephemeral response requests; deliberately abstains on reference language. */
const EN_REPORT_VERB='(?:said|says|say|saying|tell|tells|telling|told|asked|asks|asking)';
const EN_REPORT_ADDRESSEE='(?:\\s+(?:me|us|you|him|her|them))?';
const NUM={한:1,두:2,세:3,네:4,다섯:5,여섯:6,일곱:7,여덟:8,아홉:9,열:10,one:1,two:2,three:3,four:4};
// One lexicon supplies both event matching and adjacent persistent targets.
// Retain each event's original captures, flags and word boundaries unchanged.
const KO_COUNT_EVENT_SOURCE=/((?<![0-9\p{L}])(?:한|두|세|네|다섯|여섯|일곱|여덟|아홉|열)|(?<![0-9])[0-9]{1,6})\s*문장(?:으로|만|\s*유지|\s*$)/u.source;
const KO_LANGUAGE_EVENT_SOURCE=/(한국어|영어|일본어)(?:로|\s*(?=한\s*문장|두\s*문장|세\s*문장|네\s*문장|[0-9]+\s*문장))/.source;
const KO_DETAIL_EVENT_SOURCE=/자세히(?=\s*(?:설명|알려|답|분석|비교|써|작성|풀어|부탁|[:：]|$))|상세히|상세한\s*보고서/.source;
const KO_PARAGRAPH_EVENT_SOURCE=/(?:한|두|세|네|[1-4])\s*문단/.source;
const COUNT_EVENTS=new RegExp(KO_COUNT_EVENT_SOURCE+'|'+/\b(one|two|three|four|[0-9]{1,6})\s+sentences?\b/.source,'giu');
const DETAIL_EVENTS=new RegExp(KO_DETAIL_EVENT_SOURCE+'|'+/in\s+detail|more\s+detail|detailed\s+(?:report|explanation)|詳しく|くわしく|詳細に/.source+'|'+KO_PARAGRAPH_EVENT_SOURCE+'|'+/\b(?:one|two|three|four|[1-4])\s+paragraphs?\b/.source,'gi');
const LANGUAGE_EVENTS=new RegExp(KO_LANGUAGE_EVENT_SOURCE+'|'+/\b(?:in(?:to)?|reply\s+in|answer\s+in)\s+(Korean|English|Japanese)\b|(?:日本語|韓国語|英語)(?:で|に(?=\s*翻訳(?:して)?(?:ください|下さい)))/.source,'gi');
function maskQuoted(text){
 // One reverse index per delimiter, then one forward scan. Unclosed ordinary
 // quotes remain literal text; fenced code keeps its original to-end contract.
 const chars=text.split(''),n=text.length,wordAt=i=>i>=0&&i<n&&/[\p{Script=Latin}\p{N}]/u.test(text.charCodeAt(i)>=0xDC00&&text.charCodeAt(i)<=0xDFFF&&i>0?text.slice(i-1,i+1):String.fromCodePoint(text.codePointAt(i))),internal=i=>wordAt(i-1)&&wordAt(i+1);
 const escaped=new Uint8Array(n);let slashes=0;for(let i=0;i<n;i++){escaped[i]=slashes%2;slashes=text[i]==='\\'?slashes+1:0;}
 const types=['"','”','’','」',"'",'`'],next={};for(const mark of types){const a=new Int32Array(n+1);a.fill(-1);let close=-1;for(let i=n-1;i>=0;i--){a[i]=close;if(text[i]===mark&&!escaped[i]&&(mark!=="'"||!wordAt(i+1))&&(mark!=='’'||!internal(i)))close=i;}next[mark]=a;}
 const newlines=new Int32Array(n+1);newlines.fill(-1);let line=-1;for(let i=n-1;i>=0;i--){newlines[i]=line;if(text[i]==='\n')line=i;}
 const blank=(a,b)=>{for(let j=a;j<b;j++)if(chars[j]!=='\n')chars[j]=' ';};
 for(let i=0;i<n;){
  if(text.startsWith('```',i)){const end=text.indexOf('```',i+3);const stop=end<0?n:end+3;blank(i,stop);i=stop;continue;}
  const ch=text[i],endMark=ch==='“'?'”':ch==='‘'?'’':ch==='「'?'」':ch;
  if(!['"','“','‘','「',"'",'`'].includes(ch)||ch==="'"&&wordAt(i-1)||escaped[i]){i++;continue;}
  const end=next[endMark][i];if(end<0){i++;continue;}
  if((ch==="'"||ch==='`')&&newlines[i]>=0&&newlines[i]<end){i++;continue;}
  blank(i,end+1);i=end+1;
 }
 return chars.join('');
}
// Transformation targets are local when a target format directly qualifies a
// transformation verb. Nominal objects below cover format-free references; no
// arbitrary scan across sentences or financial analysis subjects.
const KO_OPERATION_END='(?:\\s*(?:(?:만|좀)\\s*)?해\\s*(?:줘|주세요|줘요|주십시오|주시겠어요|주실\\s*수\\s*있나요|줄래(?:요)?|주실래요|주시겠습니까)|\\s*하(?:세요|십시오)|\\s*부탁(?:해요|해|합니다|드립니다|드려요))';
function operationCommandAtEnd(clause,operations){return new RegExp('(?:'+operations+')'+KO_OPERATION_END+'\\s*[:：]?\\s*$','u').test(clause);}
function pointedCopyObject(clause,earlierOnly=false){
 const pointer=earlierOnly?'(?:위(?:의)?|윗|방금|이전|앞선)':'(?:아래(?:의)?|다음(?:의)?|뒤(?:의)?)';
 // A referent is a supplied textual artifact, not a prefix of 위험 or a future period.
 const object='(?:자료|답변|응답|답|문장|문단|문안|기사|단락|글|문서|보고서|텍스트|인용문|내용|공시|표|메모|이메일|편지|재무제표|회의록|뉴스)';
 const inputFormat='(?:(?:한|두|세|네|[0-9]+)\\s*(?:문장|문단|줄)(?:만)?\\s*)?';
 return new RegExp('(?<![\\p{L}\\p{N}])'+pointer+'\\s*'+inputFormat+object+'(?:을|를)?(?=\\s|$)','u').test(clause);
}
function koreanReferencePredicate(text,processOnly=false){
 // These are process verbs with attributive/past morphology, not a noun's final consonant.
 return /^(?:답|대답|응답|설명|요약|정리|작성|분석|비교|교정|번역|진행|발표|발행|출판|배포|보도|공개|공시|게재|제출|게시|기록|방송|제공|표시)(?:한|된|했던|하는|하던|되어|돼|해\s*준)(?=\s|$)/u.test(text)
  ||!processOnly&&/^(?:받(?:은|았던)|읽(?:은|었던)|쓰(?:인|던)|쓴|적(?:힌|은)|열(?:린|었던)|나온)(?=\s|$)/u.test(text)
  ||/^(?:하고\s*나서|나서)(?=\s|$)/u.test(text);
}
function inputFormatObject(text,index,length){
 const before=text.slice(0,index),after=text.slice(index+length);
 return /^\s+in\s+(?:[\p{Script=Latin}\p{N}]+['’]s\b|(?:the|this|that|a)\s+(?:report|statement|letter|article|text)\b)/iu.test(after)||/\b(?:these|those|the|first|last|previous|following)\s*$/iu.test(before)||/^\s+(?:of|from)\s+(?!now\s+on\b)\S+/iu.test(after)||koreanLanguageReference(after.replace(/^\s*(?:으로|로|만)?\s*/u,''))||/(?<![\p{L}\p{N}])(?:이|그|위|아래|다음|이전|앞선)(?:의)?\s*$/u.test(before)||/^(?:의|을|를|은|는)(?=\s|$)/u.test(after);
}
function koreanNarrativePredicate(text){
 // 현재 명령 뒤에 덧붙는 자료/과거 절을 현재 출력 요청으로 승격하지 않습니다.
 return /(?:했|줬|받았|나왔|돌아왔|있었|없었|싶었)(?:는데|더니|고|어|어요|다)(?=\s|$|[,，])/u.test(text)
  ||/(?:하고\s*나서|하고\s*싶(?:은|었|어)|하(?:는|던)\s+[^\s]+(?:의|을|를))/u.test(text);
}
function koreanOutputModifiers(text){
 return text.replace(/^(?:(?:(?:한|두|세|네|다섯|여섯|일곱|여덟|아홉|열|[0-9]+)\s*(?:문장|문단|줄)(?:으로|로|만)?|최대한|가능한(?:\s+한)?|되도록|(?:간단|간결|자세|상세|정확|명확|정중)한(?=\s*(?:답|답변|설명|요약|정리)))\s*)+/u,'');
}
function koreanLanguageReference(text){
 const words=koreanOutputModifiers(text.replace(/^만\s*/u,'')).slice(0,256).trim().split(/\s+/u);
 // A supplied artifact may have a topical object before its relative predicate.
 // Stop at a current output command so a later reference cannot absorb it.
 let crossedObject=false;
 for(let i=0;i<words.length;i++){
  if(koreanReferencePredicate(words.slice(i).join(' '),crossedObject))return true;
  if(currentKoreanFormatRequest(words[i],false))break;
  if(/(?:을|를|의|에서)$/u.test(words[i]))crossedObject=true;
 }
 return false;
}
function currentKoreanLanguageAttachment(text,index,length){
 const after=text.slice(index+length).trim();
 if(koreanLanguageReference(after)||koreanNarrativePredicate(after))return false;
 if(/^(?:답|대답|응답|설명|요약|정리|작성|분석|비교|교정|번역|말)하\s*$/u.test(after))return true;
 return true;
}
function isTransformRequest(text){
 const count='(?:한|두|세|네|다섯|여섯|일곱|여덟|아홉|열|[0-9]+)\\s*문장(?:으로|만)?';
 const format='(?:\\s*(?:(?:한국어|영어|일본어)(?:로)?|'+count+'|짧게|간단히|자세히|정중하게|다시))*\\s*';
 const action='(?:번역\\s*(?:만\\s*)?(?:해|하)|요약(?:만\\s*)?(?:해|하)|정리(?:만\\s*)?(?:해|하)|교정(?:만\\s*)?(?:해|하)|바꿔|고쳐|다듬)';
 const target='(?:(?:한국어|영어|일본어)로|'+count+')';
 // A trailing format qualifies the same conversion, including omitted objects.
 if(new RegExp(action+'(?:줘|주세요)?\\s*'+target+format,'i').test(text))return true;
 // Format-free summary commands establish a task for adjacent format clauses.
 // Do not reinterpret a response format before an intervening analysis subject.
 const hasFormat=/(?:한국어|영어|일본어)(?:로)?|(?:한|두|세|네|다섯|여섯|일곱|여덟|아홉|열|[0-9]+)\s*문장|\b(?:Korean|English|Japanese|sentences?)\b/i.test(text);
 if(!hasFormat&&/(?:요약|정리)(?:만\s*)?(?:해|하)|\bsummarize\b/i.test(text))return true;
 // Target-format adjacency does not depend on the noun or its particle.
 // A general response format before an intervening analysis subject is not
 // transformation evidence: "한국어 한 문장으로 성과를 요약해줘" stays separate.
 if(new RegExp('(?:(?:한국어|영어|일본어)로|'+count+')'+format+action,'i').test(text))return true;
 // English imperative has verb-object-target order. Restrict the scan to one
 // clause, so a later independent response directive does not scope this task.
 if(/\bsummarize\b[^.!?。！？;,，:\n]*\b(?:in\s+(?:Korean|English|Japanese)|(?:one|two|three|four|[0-9]+)\s+sentences?)\b/i.test(text))return true;
 if(new RegExp('(?:답변|답|응답|결과|출력형식|출력|문장|문단|문안|기사|단락|글|문서|보고서|텍스트|내용)(?:을|를)'+format+action,'i').test(text))return true;
 if(new RegExp('(?:고객에게\\s*보낼|(?:간단한|정확한|정중한)\\s*문장(?:으로)?)'+format+'(?:바꿔|고쳐|교정|다듬)','i').test(text))return true;
 return /(?:번역\s*(?:만\s*)?(?:해|하)|옮겨\s*(?:줘|주세요|줘요)|翻訳(?:して|してください))|\b(?:translate|rewrite)\b|\b(?:write|summarize|render|convert|put)\s+(?:this|that|(?:the|a|provided|following)\s+(?:report|article|paragraph|text|sentence))\b/i.test(text);
}
function directiveBoundaries(text){
 // Replace only conjunctions of known directive verbs; preserve UTF-16 offsets.
 return text.replace(/((?:답해주|대답해주|대답하|답하|요약하|정리하|번역하|설명하|유지하|바꾸|고치|교정하))고(?=\s|[,，])/g,'$1;')
  .replace(/(^|\s)그리고(?=\s)/g,(_,space)=>space+';;;');
}

// Reuse this boundary for preference masking and supplied-target evidence.
// Coordinates always address the original history, before auxiliary messages.
function hasReferencedResponseObject(clause,earlierOnly=false){
 const pointer=earlierOnly?'(?:위(?:의)?|방금|이전|앞선)':'(?:다음|위(?:의)?|아래|이|그|방금|이전|앞선)';
 const nouns=earlierOnly?'(?:답변|답|응답|내용|문장|문단|문안|기사|단락|글|문서|보고서|텍스트|인용문)':'(?:답변|답|응답)';
 return new RegExp('(?<![\\p{L}\\p{N}])'+pointer+'\\s*'+nouns+'(?=\\s|$|(?:을|를|은|는|이|가|로|의)(?:\\s|$))','u').test(clause);
}
function hasSuppliedTextObject(clause){
 // Ordinary financial content/results are not supplied copy without a pointer.
 const textNouns='(?:문장|문단|문안|기사|단락|글|문서|보고서|텍스트|인용문)';
 const boundary='(?=\\s|$|(?:을|를|은|는|이|가|로|의)(?:\\s|$))';
 return pointedCopyObject(clause)||new RegExp('(?<![\\p{L}\\p{N}])'+textNouns+'(?:을|를)?(?=\\s|$)','u').test(clause)
  ||new RegExp('(?<![\\p{L}\\p{N}])(?:다음|위|아래|이|그|방금)\\s*(?:'+textNouns+'|출력형식|출력|내용)'+boundary,'u').test(clause)
  ||hasReferencedResponseObject(clause)
  // Bare 그 결과 is also an adverbial causal link. Treat it as copy only when
  // an object particle or immediately adjacent output/task format identifies it.
  ||new RegExp('(?<![\\p{L}\\p{N}])(?:다음|위|아래|이|그|방금)\\s*결과(?:(?:을|를)(?=\\s|$)|(?:은|는)?(?=\\s*(?:$|(?:한국어|영어|일본어)로|(?:한|두|세|네|[0-9]+)\\s*문장|(?:요약|교정|정리|번역)(?:해|하))))','u').test(clause)
  ||/(?:인용문|따옴표\s*안)/u.test(clause)
  ||/\b(?:(?:this|that)(?:\s+(?:report|article|paragraph|text|sentence)\b|\s+in(?:to)?\s+(?:Korean|English|Japanese)\b|\s*$)|(?:the|a|provided|following)\s+(?:report|article|paragraph|text|sentence)\b)/i.test(clause);
}
function hasOrdinarySummaryTopic(command){
 if(hasSuppliedTextObject(command)||!operationCommandAtEnd(command,'요약|정리'))return false;
 const subject=command.replace(new RegExp('(?:요약|정리)'+KO_OPERATION_END+'\\s*$','u'),'')
  .replace(LANGUAGE_EVENTS,' ').replace(COUNT_EVENTS,' ').replace(DETAIL_EVENTS,' ')
  .replace(/(?:짧게|간단히|정중하게|자연스럽게|다시|조금|좀|더|만|으로|로)/gu,' ').trim();
 return !!subject;
}
// A topic alone does not establish supplied copy. A non-directive body line
// under its terminal operation does; inspect that line once without tail recursion.
function ordinaryTransformationBody(raw,masked,start){
 // Skip blank source lines, not quote-masked text: a quoted body is still copy.
 while(start<raw.length){
  let end=raw.indexOf('\n',start);if(end<0)end=raw.length;
  if(raw.slice(start,end).trim()){
   const first=masked.slice(start,end).trim().split(/[.!?。！？;,，]/u)[0].trim();
   // Quoted source is still supplied copy, even when its masked text is empty.
   if(!first)return true;
   return !currentKoreanFormatRequest(first)&&!directEnglishClause(first)&&!independentAfterQuotedCopy(first);
  }
  start=end+1;
 }
 return false;
}
function hasBareSuppliedCommand(prefix,tail,delimiter=null){
 if(!tail.trim())return false;
 const command=prefix.replace(/[\s.!?。！？:：]+$/u,'').trim();
 // A terminal operation supplies copy independently of spelling/style modifiers.
 // A financial subject stays ordinary unless an explicit supplied-text object exists.
 const operation=/(?:요약|교정|정리)\s*(?:만\s*)?(?:해(?:\s*(?:줘|주세요|줘요))?|하(?:세요|십시오)|\s*부탁(?:해|드려)(?:요)?)$|(?:바꿔|고쳐|다듬어)(?:\s*(?:줘|주세요|줘요))$/u;
 const financialTopic=/(?:\b(?:BTC|ETH|RSI|MACD|FOMC)\b|비트코인|이더리움|금리|손절|비중|계좌|증거금|레버리지|투자|백테스트|주식|채권|국채|시장|경제|거래|회의|전략)/iu;
 if(operation.test(command)||operationCommandAtEnd(command,'요약|교정|정리')||/(?:바꿔|고쳐|다듬어)\s*(?:줘|주세요|줘요|주십시오)\s*$/u.test(command))return delimiter==='colon'||hasSuppliedTextObject(command)||!hasOrdinarySummaryTopic(command)&&!financialTopic.test(command);
 if(/^\s*(?:please\s+)?rewrite\s*$/iu.test(command))return true;
 return /^\s*(?:please\s+)?summarize\s+(?:this|that|the\s+following|following)(?:\s+(?:text|paragraph|sentence|article|report))?\s*$/iu.test(command);
}

function hasQualifiedTransformationFormat(clause){
 const target='(?:(?:한국어|영어|일본어)로|(?:한|두|세|네|다섯|여섯|일곱|여덟|아홉|열|[0-9]+)\\s*문장(?:으로|만)?)';
 const modifiers='(?:\\s*(?:짧게|간단히|자세히|정중하게|자연스럽게|다시))*\\s*';
 const action='(?:번역|요약|정리|교정)(?:만\\s*)?(?:해|하)|바꿔|고쳐|다듬|옮겨';
 return new RegExp(target+modifiers+'(?:'+action+')','u').test(clause)||new RegExp('(?:'+action+')(?:줘|주세요)?\\s*'+target,'u').test(clause)||/\bsummarize\b[^.!?。！？;,，:\n]*\b(?:in\s+(?:Korean|English|Japanese)|(?:one|two|three|four|[0-9]+)\s+sentences?)\b/i.test(clause);
}
const KO_STOP_SOURCE=/질문(?:은|을)?\s*(?:여기서|이제)?\s*그만|(?:이제\s*)?질문(?:은|을)?\s*(?:여기서|이제)?\s*(?:하지|묻지)\s*(?:말고|말아|마)/.source;
function currentQuestionDirective(text,index,length,continuation=null,allowContinuation=true){
 const match=text.slice(index,index+length),after=text.slice(index+length).trim(),before=text.slice(0,index);
 if(isReportedQuestionDirective(text,index,length))return false;
 if(/질문/u.test(match)){
  if(allowContinuation&&after==='하고'&&continuation!==null)return currentDirectContinuation(continuation.replace(/^[\s,，]+/u,'').split(/[.!?。！？;,，\n]/u)[0]);
  if(allowContinuation&&/^하고\s+/u.test(after)){const next=after.replace(/^하고\s+/u,'');if(currentDirectContinuation(next)||/^[\p{L}\p{N}]+만$/u.test(next))return true;}
  if(allowContinuation&&/^하지\s*말고\s+/u.test(after)&&currentDirectContinuation(after.replace(/^하지\s*말고\s+/u,'')))return true;
  if(allowContinuation&&/말고$/u.test(match)&&currentDirectContinuation(after))return true;
  return !after||allowContinuation&&after==='하고'||/^(?:(?:해|하)(?:\s*(?:줘|주세요|줘요|주십시오|세요)|요)?|하지\s*(?:말아\s*(?:줘|주세요|줘요)|(?:말|마)(?:세요|요|십시오)?)|요|세요|십시오|줘|주세요)$/.test(after);}
 return /^(?:\s*(?:please|do\s+not|don['’]t)\s*)*$/iu.test(before)&&/^(?:\s*please)?$/iu.test(after);
}
function currentKoreanQuestionCommand(text){
 const matches=Array.from(text.matchAll(new RegExp(KO_STOP_SOURCE,'gi')));if(!matches.length)return false;
 const last=matches.at(-1);
 // A repeated conjunction chain has no current grant when both its final stop
 // and its final output command are absent. Inspect that suffix once, not every tail.
 if(!currentQuestionDirective(text,last.index,last[0].length)&&!currentKoreanFormatRequest(text,false))return false;
 for(const match of matches)if(currentQuestionDirective(text,match.index,match[0].length))return true;
 return false;
}
function currentKoreanFormatRequest(text,allowQuestion=true){
 text=text.split(/[:：]/u)[0].replace(/[:：\s]+$/u,'');
 if(allowQuestion&&currentKoreanQuestionCommand(text))return true;
 // An affirmative current imperative, not an embedded report/obligation/past stem.
 const terminal=/(?:답|대답|응답|설명|요약|정리|작성|분석|비교|교정|번역|말)\s*(?:해(?:\s*(?:줘|주세요|줘요|주십시오))?|하(?:세요|십시오))\s*$|(?:알려|써|바꿔|고쳐|다듬어|옮겨|풀어|짜)(?:\s*(?:줘|주세요|줘요|주십시오))\s*$|(?:부탁(?:해(?:요)?|합니다|드립니다)|유지(?:해(?:\s*(?:줘|주세요|줘요))?|하세요)|해주세요)\s*$/u;
 const postLanguage=text.match(/(?:한국어|영어|일본어)로\s*$/u);
 if(postLanguage&&terminal.test(text.slice(0,postLanguage.index).trim()))return true;
 if(terminal.test(text)||operationCommandAtEnd(text,'답|대답|응답|설명|요약|정리|작성|분석|비교|교정|번역|말')||/(?:답해주|답하|대답해주|대답하|설명하|유지하)고\s*$/u.test(text)||/(?:끝내\s*(?:줘|주세요)|答えて|説明して|要約して|お願いします|ください)\s*$/u.test(text)||/(?:해(?:\s*만)?|만\s*해)\s*(?:줘|주세요|줘요|주십시오)\s*$/u.test(text)||/(?:자세히|상세히)\s*$/u.test(text)||/(?:한|두|세|네|다섯|여섯|일곱|여덟|아홉|열|[0-9]+)\s*문장(?:으로|만)?\s*$/u.test(text))return true;
 // Closed format fragments carry no speaker, topical content or narrative verb.
 const rest=text.replace(LANGUAGE_EVENTS,' ').replace(COUNT_EVENTS,' ').replace(DETAIL_EVENTS,' ')
  .replace(/(?:말고|아니고|(?:한|두|세|네|다섯|여섯|일곱|여덟|아홉|열|[0-9]+)\s*문장(?:으로|만)?|앞으로(?:는|도)?|이후\s*대화(?:에서는|에서|는)?|항상|이번(?:에는|엔)?|답변(?:은|는)?|응답(?:은|는)?|대답(?:은|는)?|조금|더|좀|짧게|간단히|정중하게|만|으로|유지)/gu,' ').trim();
 return !rest;
}
function currentEnglishFormatFragment(text){
 const rest=text.replace(LANGUAGE_EVENTS,' ').replace(COUNT_EVENTS,' ').replace(DETAIL_EVENTS,' ')
  .replace(/\b(?:from\s+now\s+on|always|in|into|to|with|only|just|please|exactly|more|one|two|three|four|[0-9]+|sentences?|paragraphs?|detail|and)\b/gi,' ').trim();
 return !rest;
}
function currentDirectContinuation(tail){
 tail=tail.trim();if(!tail||koreanNarrativePredicate(tail)||koreanReferencePredicate(tail))return false;
 // 꼬리 판정은 질문 재귀를 호출하지 않습니다. 마지막 stop 어미만 비재귀로 확인합니다.
 if(!currentKoreanFormatRequest(tail,false)){
  let last=null;for(const match of tail.matchAll(new RegExp(KO_STOP_SOURCE,'gi')))last=match;
  return !!last&&currentQuestionDirective(tail,last.index,last[0].length,null,false);
 }
 // 주제 명사·형용사를 서술어로 오인하지 않고 실제 현재 종결 명령을 요구합니다.
 const command=tail.match(/(?:(?:답|대답|응답|설명|요약|정리|분석|비교|교정|작성|번역)\s*(?:해(?:\s*(?:줘|주세요|줘요|주십시오))?|하(?:세요|십시오))|(?:알려|말해|써|보여|바꿔|고쳐|다듬어|옮겨|풀어)\s*(?:줘|주세요|줘요|주십시오)|부탁(?:해요|해|합니다|드립니다))\s*$/u);
 if(command){const topic=tail.slice(0,command.index);if(topic.length<=128&&/[\p{L}\p{N}]+(?:은|는|을|를|도|에|의|이|가|만)(?=\s|$)/u.test(topic))return true;}
 return /^(?:왜|어떻게|무엇을)(?=\s)/u.test(tail)||/^(?:(?:한국어|영어|일본어)로|(?:한|두|세|네|[0-9]+)\s*문장|자세히|상세히|(?:답|대답|응답|설명|요약|정리|작성|분석|비교|교정|번역|말)\s*(?:해|하)|알려|써|바꿔|고쳐|다듬어|옮겨|풀어|부탁|(?:바로|다시|계속|이제)\s+|계속(?:해|하))/u.test(tail)||hasSuppliedTextObject(tail)||/^[\p{L}\p{N}%]+(?:은|는|을|를|도|에|의)(?=\s)/u.test(tail)||/^[\p{Script=Latin}\p{N}'’]+\s+[\p{L}\p{N}]+(?:은|는|을|를|도|에|의)(?=\s)/u.test(tail);
}
function affirmativeConjunctionContinuation(raw,end){
 const fullTail=raw.slice(end+1).replace(/^[\s,，]+/u,''),first=fullTail.split(/[.!?。！？;,，\n]/u)[0];
 // The same report owns its coordinated language and question command. Inspect
 // attribution before punctuation truncation; keep the original raw event span.
 for(const match of first.matchAll(new RegExp(KO_STOP_SOURCE,'gi')))if(isReportedQuestionDirective(fullTail,match.index,match[0].length))return false;
 return currentDirectContinuation(first);
}
function hasEnglishReportedCommaPrefix(before){
 const clause=before.split(/[.!?。！？;\n]/u).at(-1);
 const parts=clause.split(/[,，:：]/u);
 if(parts.length<2)return false;
 const lead=parts.slice(0,-1).join(',');
 return !/^\s*as\s+I\s+said\s*$/iu.test(lead)&&new RegExp('\\b'+EN_REPORT_VERB+'\\b','i').test(lead)&&!directEnglishClause(lead);
}
function currentEnglishLanguageAttachment(text,index,length=0,continuation=''){
 const before=text.slice(0,index).replace(/^\s*as\s+I\s+said\s*[,，]\s*/iu,''),after=text.slice(index+length)+continuation;
 if(/^\s*[,，]\s*(?:then|and)\s+/iu.test(after)&&directEnglishClause(after.replace(/^\s*[,，]\s*(?:then|and)\s+/iu,'')))return true;
 if(/\b(?:whether|if|is|are|was|were)\b/i.test(before)||/^\s*(?:is|are|was|were)\b/i.test(after))return false;
 // Attach format only to an output command, never to a topical preposition.
 // Generic pronouns/addressees may intervene, but arbitrary topical nouns may not.
 const output=directEnglishClause(before)&&/\b(?:answer|reply|respond|explain|write|say|tell|translate|rewrite|summarize)(?:\s+(?:to\s+)?(?:me|us|it|this|that|everything|all|them)(?:\s+(?:text|sentence|report|article|paragraph))?)?\s*$/i.test(before);
 if(output&&/^\s*(?:how|why|what|whether|that)\b/iu.test(after))return true;
 // Format fragments accept only a closed continuation; an adjective, numeral,
 // slash, hyphen or comma-followed topical argument is not response authority.
 const rest=after.replace(COUNT_EVENTS,' ').replace(DETAIL_EVENTS,' ').replace(/[,，:：]/gu,' ')
  .replace(/\b(?:from\s+now\s+on|always|please|only|just|exactly|now|again|briefly|too|and|but|in|with|using|sentences?|paragraphs?)\b/gi,' ').trim();
 const processAttachment=/(?:\b[a-z]+ed|\bheld|\bgiven|\bspoken|\btaken|\bwritten|\bwrote|\bshown|\bsent|\bmade)\s*$/iu.test(before)&&!/\b(?:the|a|an|this|that)\s+[a-z]+ed\s*$/iu.test(before);
 return !rest&&(!before.trim()||currentEnglishFormatFragment(before)||directEnglishClause(before)&&!processAttachment);
}
function directEnglishFormatPrefix(before){
 const directClause=before.split(/[.!?。！？;,，\n]/u).at(-1);
 // A comma in reported speech does not turn its nested command into a grant.
 const reportPrefix=new RegExp('\\b'+EN_REPORT_VERB+EN_REPORT_ADDRESSEE+'\\s*[,，:：]\\s*(?:that\\s+)?(?:please\\s+|just\\s+|kindly\\s+)?(?:tell|say|answer|reply|respond|write|explain|translate)\\b','i');
 if(reportPrefix.test(before)||hasEnglishReportedCommaPrefix(before))return false;
 return /^\s*(?:(?:please|just|kindly)\s+)*(?:(?:could|would|can|will)\s+you\s+(?:(?:please|just|kindly)\s+)*)?(?:tell|say)(?:\s+(?:me|us))?(?:\s+(?:that|this|it))?\s*$/i.test(directClause);
}
function directEnglishClause(clause){
 const normalized=clause.replace(/^\s*as\s+I\s+said\s*[,，]\s*/iu,'').replace(/^\s*(?:from\s+now\s+on|always)\s+/i,'').replace(/^\s*(?:and|then|but)\s+/i,'').trim();
 const direct=/^(?:(?:please|just|kindly)\s+)*(?:(?:could|would|can|will)\s+you\s+(?:(?:please|just|kindly)\s+)*)?(?:answer|reply|respond|tell|say|write|explain|summarize|translate|rewrite|give|keep|use|make|ask)\b/i;
 if(!direct.test(normalized))return false;
 return !/^(?:(?:please|just|kindly)\s+)*(?:answer|reply|respond|tell|say|write|explain|summarize|translate|rewrite|give|keep|use|make|ask)\s+(?:is|are|was|were|means|denotes)\b/i.test(normalized);
}
function independentAfterQuotedCopy(maskedTail){
 const first=maskedTail.replace(/^[\s.!?。！？;,，]+/u,'').split(/[.!?。！？;,，\n]/u)[0];
 if(!first.trim())return false;
 // Explicit target-end statements retain later independent output requests.
 if(/(?:번역|교정|요약)?\s*대상(?:은|는)?\s*여기까지|대상(?:이|은|는)?\s*(?:아니|아님)|\b(?:end\s+of\s+(?:the\s+)?(?:translation|target|quote)|(?:translation\s+)?target\s+ends?\s+here)\b/iu.test(first))return true;
 if(directEnglishClause(first)||/^\s*(?:no\s+(?:more\s+)?questions|stop\s+asking\s+questions)\s*$/i.test(first))return true;
 if(/^\s*(?:질문(?:은|을)?\s*(?:여기서|이제)?\s*(?:그만|하지\s*마)|다시\s*질문)/u.test(first))return true;
 // An explicit response/output subject or persistent response marker differs
 // from narrative after a quote. Mere article noun/connective never grants.
 const output=/^\s*(?:(?:그리고\s*)?(?:앞으로(?:는|도)?|항상|이후\s*대화(?:에서는|에서|는)?)(?:\s|$)|(?:그\s*)?(?:결과|설명|번역문|번역\s*결과|답변|응답|출력)(?:은|는|만|\s*뒤(?:에는|에)?))/u;
 return output.test(first)&&/(?:답해|답하|대답해|대답하|설명해|알려|써줘|작성해|해줘|해주세요|출력해|덧붙여|부탁)/u.test(first);
}
function quotedOnlyBoundary(prefix,rawTail,maskedTail){
 if(!/^\s*["'“‘「`]/u.test(rawTail))return false;
 const rawStart=rawTail.search(/\S/u);
 if(maskedTail[rawStart]!== ' ')return false;
 if(!maskedTail.trim())return true;
 // Closing a quote alone does not promote article prose to user authority.
 // Only an explicit independent request or target-end statement opens the tail.
 return independentAfterQuotedCopy(maskedTail);
}
function onlyResponseFormatCommands(text){
 const clauses=text.split(/[.!?。！？;\n]/u).filter(c=>c.trim());
 return clauses.length>0&&clauses.every(clause=>{
  if(!currentKoreanFormatRequest(clause,false)&&!directEnglishClause(clause))return false;
  const rest=clause.replace(LANGUAGE_EVENTS,' ').replace(COUNT_EVENTS,' ').replace(DETAIL_EVENTS,' ')
   .replace(new RegExp('(?:답|대답|응답|말)'+KO_OPERATION_END,'gu'),' ')
   .replace(/(?:앞으로(?:는|도)?|이후\s*대화(?:에서는|에서|는)?|항상|이번(?:에는|엔)?|답변(?:은|는)?|응답(?:은|는)?|대답(?:은|는)?|짧게|간단히|정중하게|만|으로|로)/gu,' ')
   .replace(/\b(?:from\s+now\s+on|always|please|answer|reply|respond|in|to|only|just|now|again|briefly|exactly|sentences?|and)\b/giu,' ').trim();
  return !rest;
 });
}
function earlierSuppliedTextBoundary(raw,masked){
 // 후방 참조 변환 명령이 자료의 끝을 정합니다. 뒤의 인사나 독립 지시는
 // 그대로 남겨 지시 판정에 맡기며, 인사 어휘 목록으로 자료 권한을 결정하지 않습니다.
 const lines=[];let start=0;for(let i=0;i<=masked.length;i++)if(i===masked.length||masked[i]==='\n'){lines.push({start,end:i,text:masked.slice(start,i)});start=i+1;}
 for(let k=lines.length-1;k>=1;k--){const line=lines[k],command=line.text.trim();if(!command)continue;
  if(!pointedCopyObject(command,true)||!explicitTransformImperative(command,true))continue;
  const mark=line.start-1;if(!raw.slice(0,mark).trim())return null;
  if(hasReferencedResponseObject(command)&&onlyResponseFormatCommands(masked.slice(0,mark)))continue;
  return {masked:masked.slice(0,mark).replace(/[^\n]/g,' ')+masked.slice(mark),start:0,end:mark,prefix:command,delimiter:'preceding'};
 }
 return null;
}
function newlineIndependentDirective(prefix,tail){
 const backward=hasReferencedResponseObject(prefix,true);
 // An ordinary object+operation refers to a topic, not the text below it.
 // Forward supplied-copy pointers retain tail data even if it resembles commands.
 const forward=pointedCopyObject(prefix);
 const topic=!hasSuppliedTextObject(prefix)&&/[^\s]+(?:을|를)\s/u.test(prefix);
 const knownTopic=!hasSuppliedTextObject(prefix)&&/(?:\b(?:BTC|ETH|RSI|MACD|FOMC)\b|비트코인|이더리움|금리|손절|비중|계좌|증거금|레버리지|투자|백테스트|주식|채권|국채|시장|경제|거래|회의|전략)/iu.test(prefix);
 return !forward&&(backward||topic||knownTopic)&&independentAfterQuotedCopy(tail);
}
function suppliedTransformationBoundary(raw){
 let masked=maskQuoted(raw),quotedTaskPrefix;
 const earlier=earlierSuppliedTextBoundary(raw,masked);if(earlier)return earlier;
 // One scan keeps a significant endpoint and a pending clause boundary.
 // A boundary becomes preceding context only when new content follows it;
 // trailing punctuation/newline runs never repeatedly trim a growing prefix.
 let lastSignificant=-1,lastBreak=-1,pendingBreak=-1,prefixStart=-1,prefixEnd=-1,prefix='',eligible=false,boundaryHandled=false;
 let finalContent=-1;for(let i=raw.length-1;i>=0;i--)if(!/\s/u.test(raw[i])){finalContent=i;break;}
 for(let i=0;i<masked.length;i++){
  const ch=masked[i];
  if(ch===':'||ch==='：'||ch==='\n'){
   if(prefixStart!==lastBreak+1||prefixEnd!==lastSignificant+1){
    prefixStart=lastBreak+1;prefixEnd=lastSignificant+1;
    prefix=masked.slice(prefixStart,prefixEnd);boundaryHandled=false;
    eligible=explicitTransformImperative(prefix,hasBareSuppliedCommand(prefix,i<finalContent?'x':'',ch===':'||ch==='：'?'colon':'newline'))||pointedCopyObject(prefix)&&operationCommandAtEnd(prefix,'분석|설명|비교')||ch==='\n'&&hasOrdinarySummaryTopic(prefix)&&ordinaryTransformationBody(raw,masked,i+1);
   }
   if(eligible&&!boundaryHandled){
    boundaryHandled=true;
    const rawTail=raw.slice(i+1),maskedTail=masked.slice(i+1);
    if(ch==='\n'&&newlineIndependentDirective(prefix,maskedTail)){}
    else if(quotedOnlyBoundary(prefix,rawTail,maskedTail)){quotedTaskPrefix=prefix;}
    else return {masked:masked.slice(0,i+1)+maskedTail.replace(/[^\n]/g,' '),start:i+1,end:raw.length,prefix,delimiter:ch==='\n'?'newline':'colon'};
   }
  }
  if(/[.!?。！？;,，:：\n]/u.test(ch))pendingBreak=i;
  if(!/[.!?。！？:：\s]/u.test(ch)){
   if(pendingBreak>=0&&pendingBreak<i)lastBreak=pendingBreak;
   lastSignificant=i;
  }
 }
 return {masked,quotedTaskPrefix};
}

function explicitTransformImperative(clause,suppliedTarget=false){
 clause=clause.replace(/[.!?。！？\s]+$/u,'');
 // Attribute a command, not arbitrary modifier words such as 뜻/의미/않게.
 if(/(?:번역|요약|교정|정리)(?:을|를)?\s*(?:하지\s*(?:말|마)|하지\s*않)|(?:해|하|줘|주세요|세요)\s*(?:이?라(?:고|는|더|던)|란(?=\s|$))|\b(?:why|said|says|told)\b|(?:と言|という)/iu.test(clause))return false;
 if(/(?:뜻|의미)(?:을|를)?\s*(?:설명|알려)|왜.{0,60}(?:해야|필요|했)/u.test(clause))return false;
 const translation=operationCommandAtEnd(clause,'번역')||/(?:번역\s*(?:만\s*)?(?:해(?:\s*(?:줘|주세요|줘요))?|하(?:세요|십시오)))\s*[:：]?\s*$/u.test(clause)||/옮겨\s*(?:줘|주세요|줘요|주십시오)\s*[:：]?\s*$/u.test(clause)&&(hasSuppliedTextObject(clause)||hasQualifiedTransformationFormat(clause));
 const conversion=operationCommandAtEnd(clause,'요약|교정|정리')&&(suppliedTarget||hasSuppliedTextObject(clause)||hasQualifiedTransformationFormat(clause))||/(?:요약|교정|정리)\s*(?:만\s*)?(?:해(?:\s*(?:줘|주세요|줘요))?|하(?:세요|십시오))\s*[:：]?\s*$/u.test(clause)||/(?:바꿔|고쳐|다듬어)(?:\s*(?:줘|주세요|줘요|주십시오))\s*[:：]?\s*$/u.test(clause)||operationCommandAtEnd(clause,'요약|교정|정리')&&(suppliedTarget||hasSuppliedTextObject(clause)||hasQualifiedTransformationFormat(clause))||suppliedTarget&&/교정(?:만\s*)?\s*부탁(?:해|드려)(?:요)?\s*[:：]?\s*$/u.test(clause);
 const declarativeLabel=/^\s*(?:translate|rewrite|summarize|render|convert|put|write)(?:\s+in(?:to)?\s+(?:Korean|English|Japanese))?\s+(?:is|are|was|were|means|denotes)\b/iu.test(clause);
 const en=!declarativeLabel&&/^\s*(?:please\s+)?(?:translate|rewrite|summarize|render|convert|put|write)\b/iu.test(clause)&&(/\btranslate\b/i.test(clause)||suppliedTarget||hasSuppliedTextObject(clause)||hasQualifiedTransformationFormat(clause));
 const ja=/翻訳(?:して)?(?:ください|下さい)\s*[:：]?\s*$/u.test(clause);
 return translation||conversion&&(suppliedTarget||hasSuppliedTextObject(clause)||hasQualifiedTransformationFormat(clause))||en||ja;
}
export function currentTransformationTask(messages){
 if(!Array.isArray(messages)||messages.at(-1)?.role!=='user'||typeof messages.at(-1).content!=='string')return false;
 const boundary=suppliedTransformationBoundary(messages.at(-1).content);
 if(boundary.delimiter&&explicitTransformImperative(boundary.prefix,true)||boundary.quotedTaskPrefix&&explicitTransformImperative(boundary.quotedTaskPrefix,true))return true;
 const masked=boundary.masked;
 return directiveBoundaries(masked).split(/[.!?。！？;,，\n]/).some(clause=>explicitTransformImperative(clause));
}
export function providedTransformationEvidence(messages){
 if(!Array.isArray(messages)||messages.at(-1)?.role!=='user'||typeof messages.at(-1).content!=='string')return null;
 const raw=messages.at(-1).content,boundary=suppliedTransformationBoundary(raw);
 // Positive, terminal imperative only. Broad masking is not task admission.
 if(boundary.delimiter!=='colon'||boundary.start===undefined||!(operationCommandAtEnd(boundary.prefix,'번역')||/(?:^|\s)번역\s*(?:만\s*)?(?:해(?:\s*(?:줘|주세요|줘요))?|하(?:세요|십시오))\s*$/u.test(boundary.prefix)))return null;
 if(/(?:왜|뜻|의미|예시|프롬프트|라고|라는|하지\s*마|말고|않|서비스|프로그램|도구)/u.test(boundary.prefix))return null;
 if(/^\s*["'“‘「`]/u.test(raw.slice(boundary.start)))return null;
 const text=raw.slice(boundary.start,boundary.end);if(!text.trim())return null;
 return Object.freeze({source:'original_user_history',boundaryRule:'unquoted_colon_to_message_end',messageIndex:messages.length-1,start:boundary.start,end:boundary.end,text});
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

function isReportedQuestionDirective(text,index,length,formatEvent=false){
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
 const koreanReported=/^\s*(?:[,，]\s*)?(?:달\s*(?:라고|라는|래|랬|라더|라던)|주라고|재|자고|이?라(?:고|는|더|던)|래|랬|란(?=\s|$))/.test(after)||/^\s*[,，]\s*(?:(?:그러|이러|저러)(?:더라|던데)|그랬(?:어|다고)|하더(?:라|라고)|말했(?:어|다고))/.test(after);
 // Active/passive report verbs share the same local grammar. The addressee is
 // optional; this admits "was told" without inferring a speaker's identity.
 const speech=EN_REPORT_VERB+EN_REPORT_ADDRESSEE;
 const englishBefore=new RegExp('\\b'+speech+'\\s*[,，:：]?\\s*(?:(?:that|to)\\s+)?$','i').test(before);
 const followingDirect=/^\s*[,，]\s*(?:then|and)\s+/iu.test(after)&&directEnglishClause(after.replace(/^\s*[,，]\s*(?:then|and)\s+/iu,''));
 const englishAfter=!followingDirect&&new RegExp('^\\s*[,，]\\s*(?:[a-z]+(?:\\s+[a-z]+){0,2}\\s+)?'+speech+'\\b','i').test(after);
 // Only a subject-free direct format command is exempt; They tell remains a report.
 const directFormatCommand=formatEvent&&(directEnglishFormatPrefix(before)||/^\s*as\s+I\s+said\s*[,，]\s*$/iu.test(before));
 const koreanBeforeReport=/(?<![\p{L}\p{N}])(?:한|했던|해\s*준|말한|전한)\s*(?:말|요청|지시|내용)\s*[:：]\s*$/u.test(before);
 return koreanBeforeReport||koreanReported||englishBefore&&!directFormatCommand||englishAfter||hasEnglishReportedCommaPrefix(before);
}

function isReportedFormatDirective(text,index,length){
 if(isReportedQuestionDirective(text,index,length,true))return true;
 const after=text.slice(index+length,index+length+128).split(/\n/u)[0];
 const action='(?:(?:번역|요약|교정|정리|설명|작성|답|대답|응답)(?:해|하)(?:\\s*(?:줘|주세요|세요))?|바꿔(?:\\s*(?:줘|주세요|줘요))?|써(?:\\s*(?:줘|주세요|줘요))?|알려(?:\\s*(?:줘|주세요|줘요))?|말해(?:\\s*(?:줘|주세요|줘요))?)';
 const formats='(?:\\s*(?:(?:한국어|영어|일본어)로|(?:한|두|세|네|다섯|여섯|일곱|여덟|아홉|열|[0-9]+)\\s*문장(?:으로|만)?|조금|더|자세히))*\\s*';
 if(new RegExp('^'+formats+action+'\\s*(?:달\\s*(?:라고|라는|래|랬|라더|라던)|주라고|재|이?라(?:고|는|더|던)|란(?=\\s|$))','u').test(after))return true;
 const before=text.slice(Math.max(0,index-128),index);
 return new RegExp('\\b'+EN_REPORT_VERB+EN_REPORT_ADDRESSEE+'\\s*[,，:：]?\\s*(?:(?:that|to)\\s+)?(?:please\\s+)?(?:answer|reply|respond|write|explain|translate)(?:\\s+(?:in|only|just|Korean|English|Japanese|one|two|three|four|[0-9]+|sentences?))*\\s*$','i').test(before);
}
export function explicitResponsePreferences(messages){
 const values={},evidence={};
 let localValues={},localEvidence={};
 for(const [messageIndex,m] of (messages||[]).entries()){
  if(m?.role!=='user'||typeof m.content!=='string')continue;
  const raw=m.content,events=[],suppliedBoundary=suppliedTransformationBoundary(raw);let masked=suppliedBoundary.masked;
  // A local transformation overlays this user turn only. Older local values never
  // replace the remembered explicit response preferences.
  localValues={};localEvidence={};
  // A colon after a transformation introduces supplied copy. Quoted copy is
  // already masked; unquoted copy extends to the end of this message.
  masked=directiveBoundaries(masked);
  const clauses=Array.from(masked.matchAll(/[^.!?。！？;,，\n]+/g));
  const localScopes=localTransformClauses(clauses);
  for(const [clauseIndex,clause] of clauses.entries()){
   let text=clause[0];const start=clause.index;
   const persistentScope=hasPersistentResponseMarker(text)&&/(?:답해|답하|대답|응답|설명해)|\b(?:answer|reply|respond)\b/i.test(text);
   const localTransform=localScopes[clauseIndex]||suppliedBoundary.delimiter&&start<suppliedBoundary.start&&start+text.length>=suppliedBoundary.start-1;
   const descriptiveTail=/^\s*(?:(?:발표|발행|출판|배포|보도|작성|기록|방송|제공|설명|답변|답|번역|요약|말|쓰|표시|적|옮)[^\s,.!?]{0,16}(?:된|되어|돼|하는|주는|인|던|힌|은|는))/;
   const describesService=/(?:도구|서비스|프로그램|앱|사이트)/.test(text)&&/(?:해주는|해\s*주는|하는|된|쓰인|발표된)/.test(text);
   const koreanQuestionRequest=currentKoreanQuestionCommand(text);
   const definitionRequest=/(?:뜻|의미)(?:을|를)?\s*(?:설명|알려)/u.test(text);
   if((/왜.{0,60}(?:해야|필요|했|말라고)|(?:예시|예를\s*들어|프롬프트)\s*[:：]|(?:프롬프트|문구|예시)(?:를|을)?\s*(?:교정|번역|해석|설명)\s*[:：]|\bwhy\b|\bwhat\b.{0,30}\bmean\b/i.test(text)||definitionRequest)&&!koreanQuestionRequest)continue;
   const detailTail=/(?:자세히|상세히|詳しく|in\s+detail)\s*$/i.test(text);
   const closedTail=/(?:한|두|세|네|다섯|여섯|일곱|여덟|아홉|열|[0-9]+)\s*문장(?:으로|만)?\s*$/.test(text);
   const conjunctiveRequest=masked[start+text.length]===';'&&raw[start+text.length]==='고'&&/(?:답해주|대답해주|대답하|답하|요약하|정리하|번역하|설명하|유지하|바꾸|고치|교정하)\s*$/u.test(text)&&affirmativeConjunctionContinuation(raw,start+text.length);
   const koreanRequest=koreanQuestionRequest||currentKoreanFormatRequest(text,false)||conjunctiveRequest;
   const englishRequest=directEnglishClause(text)||currentEnglishFormatFragment(text);
   const request=koreanRequest||englishRequest||/(?:答えて|説明して|要約して|お願いします|ください)/i.test(text);
   const event=(key,value,match)=>{events.push({key,value,index:start+match.index,length:match[0].length,local:key!=='questionsStopped'&&localTransform&&!persistentScope});};
   for(const match of text.matchAll(COUNT_EVENTS)){
    if(/문장/u.test(match[0])?!koreanRequest:!englishRequest)continue;
    const after=text.slice(match.index+match[0].length);
    if(inputFormatObject(text,match.index,match[0].length))continue;
    if(descriptiveTail.test(after)||isReportedFormatDirective(masked,start+match.index,match[0].length))continue;
    if(/에서\s*$/.test(text.slice(0,match.index))&&/^\s*(?:번역|옮겨)/.test(after))continue;
    if(/^(?:\s*(?:말고|쓰지|하지|아니|답했|설명했|인용|적힌|된|작성돼|작성되어))/.test(after)||/\b(?:did|previously|earlier)\b/i.test(text.slice(0,match.index))&&/\banswered\b/i.test(after))continue;
    if(!request&&after.trim())continue;
    if(/(?:답하지|쓰지|설명하지)\s*마|\bdo\s+not\b|\bdon['’]t\b/i.test(text))continue;
    const word=(match[1]||match[2]).toLowerCase(),n=NUM[word]||Number(word);event('sentenceCount',Number.isInteger(n)&&n>=1&&n<=20?n:null,match);
   }
   for(const match of text.matchAll(DETAIL_EVENTS)){
    if(inputFormatObject(text,match.index,match[0].length))continue;
    const previous=clauses[clauseIndex-1];
    const commaSameCount=previous&&/[,，]/u.test(masked[previous.index+previous[0].length]||'')&&/^\s*(?:(?:조금|좀)\s*(?:더\s*)?|더\s*)?(?:자세히|상세히)/u.test(text)&&isDependentFormatClause(previous[0]);
    const countStart=commaSameCount?previous.index:start;
    if(request&&(!/\bin\s+detail|\bmore\s+detail|\bdetailed\s+(?:report|explanation)|\b(?:one|two|three|four|[1-4])\s+paragraphs?\b/i.test(match[0])||englishRequest)&&!isReportedFormatDirective(masked,start+match.index,match[0].length)&&!events.some(e=>e.key==='sentenceCount'&&e.value!==null&&e.index>=countStart))event('sentenceCount',null,match);
   }
   for(const match of text.matchAll(LANGUAGE_EVENTS)){
    if(/한국어|영어|일본어/u.test(match[0])&&(!koreanRequest||!currentKoreanLanguageAttachment(text,match.index,match[0].length)))continue;
    if(isReportedFormatDirective(masked,start+match.index,match[0].length))continue;
    // A final English language phrase is not authority by being last. Accept a
    // format-only fragment or a current direct request, never declarative prose.
    if(/\b(?:Korean|English|Japanese)\b/i.test(match[0])){
     const fragment=text.replace(LANGUAGE_EVENTS,' ').replace(/\b(?:from\s+now\s+on|always|please|just|only|in|to|one|two|three|four|[0-9]+|sentences?|detail)\b/gi,' ').trim();
     if(fragment&&!directEnglishClause(text)||!currentEnglishLanguageAttachment(text,match.index,match[0].length,/[,，]/u.test(masked[start+text.length]||'')?masked.slice(start+text.length).split(/[.!?。！？;\n]/u)[0]:''))continue;
    }
    const after=text.slice(match.index+match[0].length);
    if(/^(?:\s*(?:말고|쓰지|하지|아니|된|쓰인|작성된|적힌|표시된|답했|설명했))/.test(after)||/(?:답하지|쓰지|설명하지)\s*마|\bdo\s+not\b|\bdon['’]t\b/i.test(text))continue;
    if(!request&&after.trim())continue;
    const referenceAfter=after.replace(/^\s*(?:한|두|세|네|다섯|여섯|일곱|여덟|아홉|열|[0-9]+)\s*문장(?:으로|만)?\s*/,'');
    if(descriptiveTail.test(referenceAfter)||/^\s*(?:된|쓰인|작성된|적힌|표시된)/.test(referenceAfter)||describesService||/\b(?:written|published|released|issued|presented|available)\s*$/i.test(text.slice(0,match.index)))continue;
    const label=match[1]||match[2]||match[0];event('language',/한국어|Korean|韓国語/i.test(label)?'ko':/일본어|Japanese|日本語/i.test(label)?'ja':'en',match);
   }
   for(const match of text.matchAll(new RegExp(KO_STOP_SOURCE+'|'+/no\s+(?:more\s+)?questions|stop\s+asking\s+questions/.source,'gi'))){
    const after=text.slice(match.index+match[0].length),before=text.slice(0,match.index);
    if(/질문/u.test(match[0])&&!koreanQuestionRequest)continue;
    if(/(?<![\p{L}\p{N}])(?:이|그|해당|이번)\s*$/u.test(before))continue;
    if(!currentQuestionDirective(text,match.index,match[0].length,masked.slice(start+clause[0].length))||isReportedQuestionDirective(masked,start+match.index,match[0].length))continue;
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
