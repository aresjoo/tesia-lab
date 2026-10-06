import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {MARKET_TOOL,MARKET_TOOL_POLICY,toolRequestReceipt} from '../investment-tool-policy.mjs';

test('market tool definition is immutable and exactly bound to its published fingerprint', () => {
  assert.equal(MARKET_TOOL_POLICY.definition,MARKET_TOOL);
  assert.equal(createHash('sha256').update(JSON.stringify(MARKET_TOOL)).digest('hex'),MARKET_TOOL_POLICY.sha256);
  for (const value of [MARKET_TOOL_POLICY,MARKET_TOOL,MARKET_TOOL.input_schema,MARKET_TOOL.input_schema.properties,MARKET_TOOL.input_schema.properties.interval.enum]) assert.ok(Object.isFrozen(value));
  assert.throws(()=>MARKET_TOOL.input_schema.required.push('purpose'),TypeError);
  assert.deepEqual(MARKET_TOOL.input_schema.required,['symbol','interval']);
  assert.equal(MARKET_TOOL.input_schema.additionalProperties,false);
});

test('request receipt covers exact complete SDK tools and disabled-tool requests',async()=>{
 const tools=[{type:'web_search_20260209',name:'web_search',max_uses:3},MARKET_TOOL];
 const active=await toolRequestReceipt(tools,'fast');
 assert.equal(active.toolsSha256,createHash('sha256').update(JSON.stringify(tools)).digest('hex'));
 assert.equal(active.marketToolPolicySha256,MARKET_TOOL_POLICY.sha256);
 assert.equal(active.requestedSpeed,'fast');
 const changed=await toolRequestReceipt([{...tools[0],max_uses:2},MARKET_TOOL]);
 assert.notEqual(active.toolsSha256,changed.toolsSha256);
 assert.deepEqual(await toolRequestReceipt(undefined),{toolsSha256:null,marketToolPolicySha256:null,requestedSpeed:'standard'});
 assert.equal((await toolRequestReceipt([tools[0]])).marketToolPolicySha256,null);
});
