import {StrictMode,useMemo,useRef,useState} from 'react'
import {createRoot} from 'react-dom/client'
import {ClientCatalogueDetailHeader} from '../../src/components/ClientCatalogueStrategyDetail'
import {ClientSharedDetailShell} from '../../src/components/ClientSharedDetailShell'
import {catalogueIdentity} from '../../src/client-catalogue-presentation'
import {catalogueSourceSha,catalogueStrategies} from '../../src/client-catalogue'
import {loadCatalogueMarketData} from '../../src/client-catalogue-market-data'
import {runCatalogueFuturesPreview} from '../../src/client-catalogue-futures-engine'
import {catalogueVerificationRequest} from '../../src/client-catalogue-detail-header-presentation'
import type {CataloguePreviewResult} from '../../src/client-catalogue-preview'
import '../../src/styles.css'
import '../../src/client-reference.css'
const calls:{kind:string;generation?:number;signal?:AbortSignal;question?:string|null}[]=[],pending:{resolve:()=>void;reject:()=>void}[]=[]
export function Fixture({initial}:{initial:CataloguePreviewResult}){
 const [owner,setOwner]=useState('owner-a'),[value,setValue]=useState(initial),[generation,setGeneration]=useState(0),[available,setAvailable]=useState(true),[mounted,setMounted]=useState(true),[legacy,setLegacy]=useState(false),[watched,setWatched]=useState(false)
 const title=useRef<HTMLHeadingElement>(null)
 const onVerify=useMemo(()=>available?(signal:AbortSignal)=>{calls.push({kind:'verify',generation,signal,question:catalogueVerificationRequest(value)});return new Promise<void>((resolve,reject)=>pending.push({resolve,reject:()=>reject(Error('PRIVATE_CATALOGUE_ERROR'))}))}:undefined,[available,generation,value])
 const actions={onCopy:()=>{calls.push({kind:'copy'})},onAnalyze:()=>{calls.push({kind:'analyze'})},onWatch:()=>{calls.push({kind:'watch'});setWatched(v=>!v)},onCopyLink:()=>{calls.push({kind:'link'})},watched,analyzing:false}
 Object.assign(window,{catalogueSourceFixture:{setOwner,setValue,setAvailable,setMounted,setLegacy,replaceCallback:()=>setGeneration(n=>n+1),calls:()=>calls.map(({signal,...call})=>({...call,aborted:signal?.aborted})),resolve:(i=0)=>pending[i].resolve(),reject:(i=0)=>pending[i].reject()}})
 return <main className="client-source-app"><section className="client-strategy-sharing">{mounted&&<ClientSharedDetailShell row={catalogueIdentity(value.strategy)} info={[]} location={{period:'all'}} title={title} onNavigate={()=>{}} {...actions} header={!legacy?<ClientCatalogueDetailHeader value={value} owner={owner} title={title} {...actions} onVerify={onVerify}/>:undefined}><p>Fixture body</p></ClientSharedDetailShell>}</section></main>
}
loadCatalogueMarketData().then(data=>{const strategy=catalogueStrategies[0];if(!strategy.fut)throw Error('Expected source future fixture');const initial:CataloguePreviewResult={source:'client-snapshot-preview',sourceSha:catalogueSourceSha,strategy,period:'all',calculation:'full-run',contextPeriod:'selected',calendar:{start:data.spot.start,asof:data.spot.asof},dataVersion:{spot:data.spot.v,futures:data.future.v},result:runCatalogueFuturesPreview(strategy,data)};createRoot(document.getElementById('root')!).render(<StrictMode><Fixture initial={initial}/></StrictMode>)})
