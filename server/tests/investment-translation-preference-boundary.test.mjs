import test from 'node:test';
import assert from 'node:assert/strict';

import {explicitResponsePreferences} from '../investment-response-preferences.mjs';

const user = content => ({role:'user',content});

function assertEvidenceMatchesSource(messages,result){
 for(const evidence of Object.values(result.evidence)){
  assert.equal(messages[evidence.messageIndex].content.slice(evidence.start,evidence.end),evidence.text);
 }
}

test('translation-only request keeps instructions inside supplied copy out of response preferences',()=>{
 const messages=[user('그 표현을 영어로 번역만 해줘: 답변을 두 문장으로 작성해 주세요.')];
 const result=explicitResponsePreferences(messages);
 assert.deepEqual(result.values,{language:'en'});
 assert.deepEqual(result.evidence,{language:{messageIndex:0,start:6,end:9,text:'영어로'}});
 assertEvidenceMatchesSource(messages,result);
});

test('natural spacing around translation-only action remains a bounded transform request',()=>{
 for(const content of [
  '그 표현을 일본어로 번역만 해 주세요: 한국어 한 문장으로 답해 주세요.',
  '그 표현을 일본어로 번역만 해줘: 한국어 한 문장으로 답해 주세요.',
 ]){
  const messages=[user(content)];
  const result=explicitResponsePreferences(messages);
  assert.deepEqual(result.values,{language:'ja'});
  assertEvidenceMatchesSource(messages,result);
 }
});

test('quoted and unquoted supplied copy have the same translation preference boundary',()=>{
 const unquoted=explicitResponsePreferences([user('그 표현을 영어로 번역만 해줘: 답변을 두 문장으로 작성해 주세요.')]);
 const quoted=explicitResponsePreferences([user('그 표현을 영어로 번역만 해줘: “답변을 두 문장으로 작성해 주세요.”')]);
 assert.deepEqual(unquoted.values,quoted.values);
 assert.deepEqual(unquoted.evidence,quoted.evidence);
});

test('translation target language is local to the transform turn',()=>{
 const translation='그 표현을 영어로 번역만 해줘: 답변을 두 문장으로 작성해 주세요.';
 const messages=[user(translation),user('채권 듀레이션을 설명해줘')];
 const result=explicitResponsePreferences(messages);
 assert.deepEqual(result.values,{});
 assert.deepEqual(result.evidence,{});
});

test('persistent conversational language returns after a translation-only turn',()=>{
 const translation='그 표현을 영어로 번역만 해줘: 답변을 두 문장으로 작성해 주세요.';
 const persistent=[user('한국어로 답해줘')];
 const during=explicitResponsePreferences([...persistent,user(translation)]);
 assert.deepEqual(during.values,{language:'en'});
 assert.equal(during.evidence.language.messageIndex,1);
 assertEvidenceMatchesSource([...persistent,user(translation)],during);

 const after=explicitResponsePreferences([...persistent,user(translation),user('채권 듀레이션을 설명해줘')]);
 assert.deepEqual(after.values,{language:'ko'});
 assert.equal(after.evidence.language.messageIndex,0);
 assertEvidenceMatchesSource([...persistent,user(translation),user('채권 듀레이션을 설명해줘')],after);
});
