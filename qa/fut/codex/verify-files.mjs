import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawnSync}from 'node:child_process';
import {fileURLToPath}from 'node:url';
const dir=new URL('./',import.meta.url),checks=[];
for(const entry of fs.readdirSync(dir)){
 if(!/\.(mjs|md|json)$/.test(entry))continue;
 const file=new URL(entry,dir),text=fs.readFileSync(file,'utf8');
 if(entry.endsWith('.mjs')){const result=spawnSync(process.execPath,['--check',fileURLToPath(file)],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);}
 if(entry.endsWith('.json'))JSON.parse(text);
 assert.ok(!text.split('\n').some(l=>/[\t ]+$/.test(l)),'trailing whitespace: '+entry);
 checks.push(entry);
}
console.log('PASS syntax / JSON / whitespace:',checks.length,'files');
