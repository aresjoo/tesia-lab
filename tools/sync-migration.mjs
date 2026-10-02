/** Explicit, local-only snapshot delivery. Never commits, pushes or deploys. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args=process.argv.slice(2),verify=args[0]==='--verify';
const manifestPath=path.join(root,'migration-manifest.json');
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const git=(cwd,...a)=>execFileSync('git',['-C',cwd,...a],{encoding:'utf8',maxBuffer:32*1024*1024});
const safe=p=>p&&!path.isAbsolute(p)&&!p.split('/').some(s=>s==='..'||s==='.git'||s==='node_modules')&&!p.includes('\\');
const destination=p=>{if(!safe(p))throw Error('Unsafe relative path');return path.join(root,'react-app',p)};
if(verify){
  const m=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  const actual=git(root,'ls-files','--cached','--others','--exclude-standard','-z','--','react-app').split('\0').filter(Boolean);
  const expected=new Set(m.files.map(f=>'react-app/'+f.path));
  const enumerated=new Set(actual);
  for(const f of m.files){const p=destination(f.path);if(!fs.existsSync(p)||digest(fs.readFileSync(p))!==f.sha256)throw Error('Snapshot mismatch: '+f.path)}
  for(const p of expected)if(!enumerated.has(p))throw Error('Snapshot path is ignored or omitted from Git: '+p);
  for(const p of actual)if(!expected.has(p))throw Error('Unexpected snapshot file: '+p);
  console.log(JSON.stringify({status:'verified',files:m.files.length,sourceCommit:m.sourceCommit,snapshotDigest:m.snapshotDigest}));
  process.exit(0);
}
if(args.length!==1)throw Error('Usage: node tools/sync-migration.mjs /absolute/path/to/tesia-web OR --verify');
if(git(root,'branch','--show-current').trim()!=='migration')throw Error('Run only on migration branch');
const source=fs.realpathSync(args[0]);
if(source===root||source.startsWith(root+path.sep))throw Error('Source must be a separate worktree');
if(JSON.parse(fs.readFileSync(path.join(source,'package.json'),'utf8')).name!=='tesia-web')throw Error('Expected tesia-web source');
const beforeHead=git(source,'rev-parse','HEAD').trim();
const beforeStatus=git(source,'status','--porcelain=v1','-z');
const tracked=git(source,'ls-files','-z').split('\0').filter(Boolean).sort();
const untracked=git(source,'ls-files','--others','--exclude-standard','-z').split('\0').filter(Boolean);
const unexpected=untracked.filter(p=>p!=='node_modules'&&!p.startsWith('node_modules/'));
if(unexpected.length)throw Error('Review untracked source files before delivery: '+unexpected.join(', '));
const files=[],buffers=new Map(),deleted=[];
for(const p of tracked){
  if(!safe(p)||/(^|\/)(\.env(?:\..*)?|id_rsa|id_ed25519)$|\.(pem|p12|pfx|key)$/i.test(p))throw Error('Sensitive or unsafe tracked path requires review: '+p);
  const file=path.join(source,p);
  if(!fs.existsSync(file)){deleted.push(p);continue}
  const stat=fs.lstatSync(file);if(!stat.isFile())throw Error('Expected regular source file: '+p);
  const body=fs.readFileSync(file);buffers.set(p,body);files.push({path:p,bytes:body.length,sha256:digest(body)});
}
if(beforeHead!==git(source,'rev-parse','HEAD').trim()||beforeStatus!==git(source,'status','--porcelain=v1','-z'))throw Error('Source changed during snapshot; retry without modifying source');
for(const f of files)if(digest(fs.readFileSync(path.join(source,f.path)))!==f.sha256)throw Error('Concurrent source write: '+f.path);
const previous=fs.existsSync(manifestPath)?JSON.parse(fs.readFileSync(manifestPath,'utf8')):null;
// Never overwrite client-side edits in a previously delivered snapshot.
if(previous)for(const f of previous.files){const p=destination(f.path);if(!fs.existsSync(p)||digest(fs.readFileSync(p))!==f.sha256)throw Error('Destination edited; reconcile first: '+f.path)}
const known=new Set((previous?.files||[]).map(f=>f.path));
const generatedDirectories=new Set(['node_modules','dist','dist-internal-poc','dist-service','test-results','playwright-report','.playwright-cli']);
const walk=dir=>fs.existsSync(dir)?fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()&&generatedDirectories.has(e.name)?[]:e.isDirectory()?walk(path.join(dir,e.name)):[path.relative(path.join(root,'react-app'),path.join(dir,e.name))]):[];
for(const p of walk(path.join(root,'react-app')))if(!known.has(p))throw Error('Unowned destination file: '+p);
for(const f of files){const target=destination(f.path);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,buffers.get(f.path))}
// Removed source paths are Git-restorable; only unchanged prior manifest files may be removed.
const removed=(previous?.files||[]).filter(f=>!buffers.has(f.path)).map(f=>f.path);
for(const p of removed)fs.unlinkSync(destination(p));
const observedClientMain=git(root,'rev-parse','refs/remotes/origin/main').trim();
const sourceMain=git(root,'merge-base','HEAD','refs/remotes/origin/main').trim();
const changed=git(source,'diff','HEAD','--name-only','-z').split('\0').filter(Boolean);
const m={schema:1,sourceRepository:'https://github.com/beak1011/tesia-web',sourceCommit:beforeHead,
  clientRepository:'https://github.com/aresjoo/tesia-lab',clientMain:sourceMain,observedClientMain,uiReference:'9fbff821df62cad11d026022fc7628c7fcebc431',
  capturedAt:new Date().toISOString(),sourceDirtyFiles:changed,sourceDeletedFiles:deleted,
  excluded:['node_modules','ignored local files including credentials, caches, build and test outputs','other worktrees and private unapplied QA proposals'],
  snapshotDigest:digest(JSON.stringify(files)),files};
fs.writeFileSync(manifestPath,JSON.stringify(m,null,2)+'\n');
console.log(JSON.stringify({status:'snapshotted',sourceCommit:beforeHead,clientMain:sourceMain,files:files.length,bytes:files.reduce((n,f)=>n+f.bytes,0),sourceDirtyFiles:changed,removedPriorPaths:removed,snapshotDigest:m.snapshotDigest}));
