import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,readdirSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {validateApiV18} from '../../src/copy-execution/fixtures/api-v0.18/validator.js'
import {api18CandidateFixture} from '../../src/copy-execution/candidate-fixture.js'
import {cases} from './fixture.js'
const root='src/copy-execution/fixtures/api-v0.18/'
const sha=(path:string)=>createHash('sha256').update(readFileSync(path)).digest('hex')
test('every mirrored candidate generated runtime byte matches its immutable generation manifest',()=>{
 const manifest=JSON.parse(readFileSync(root+'generation-manifest.json','utf8'))
 assert.equal(manifest.releaseStatus,'CANDIDATE_NOT_PUBLISHED');assert.equal(manifest.apiContractVersion,api18CandidateFixture.contractVersion);assert.equal(manifest.packageVersion,api18CandidateFixture.packageVersion)
 for(const file of readdirSync(root))if(file!=='generation-manifest.json')assert.equal(sha(root+file),manifest.generatedSha256[file],file)
 assert.equal(JSON.parse(readFileSync(root+'package.json','utf8')).tesiaReleaseStatus,'CANDIDATE_NOT_PUBLISHED')
 assert.equal(sha('tests/copy-execution/wire-cases.json'),manifest.sourceSha256['fixtures/api/v0.18/wire-cases.json'])
})
for(const item of cases)test('exact candidate normative payload: '+item.name,()=>assert.equal(validateApiV18(item.value,item.schemaName),item.valid,item.name))
