import {test} from 'node:test'
import assert from 'node:assert/strict'
import {formatUsdt,adjustAllocation} from '../../src/copy-execution/money.js'
test('CE-MONEY-01 confirmed USDT exact decimal and missing remain distinct',()=>{
 assert.equal(formatUsdt('en','9007199254740993.125'),'9,007,199,254,740,993.13 USDT')
 assert.equal(formatUsdt('en','-0.005'),'−0.01 USDT')
 assert.equal(formatUsdt('en',null),'—');assert.equal(formatUsdt('en','0'),'0.00 USDT')
 assert.equal(formatUsdt('en','1e3'),'—')
})
test('CE-MONEY-02 budget delta preserves decimals without float rounding or zero intent',()=>{
 assert.equal(adjustAllocation('0.1','0.2',false),'0.3')
 assert.equal(adjustAllocation('1000','999.99',true),'0.01')
 assert.equal(adjustAllocation('1000','0',false),null)
 assert.equal(adjustAllocation('1000','1000',true),null)
 assert.equal(adjustAllocation('1000','1e3',false),null)
})
