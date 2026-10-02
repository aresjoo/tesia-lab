import { StrictMode, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ClientSettingsNotifications } from '../../src/components/ClientSettingsNotifications'
import { readClientNotificationPreferences, type ClientNotificationGroups, type ClientNotificationRequest } from '../../src/client-settings-notifications-presentation'
import '../../src/styles.css'
import '../../src/client-reference.css'
import '../../src/client-settings.css'
const calls: {id:string;checked:boolean;generation:number;signal:AbortSignal}[]=[]
const pending: {resolve:()=>void;reject:()=>void}[]=[]
export function Fixture(){
 const [owner,setOwner]=useState('owner-a'),[dataset,setDataset]=useState('dataset-a'),[generation,setGeneration]=useState(0),[mounted,setMounted]=useState(true),[available,setAvailable]=useState(true)
 const [groups,setGroups]=useState<ClientNotificationGroups>([{id:'source',title:'Observed preferences',rows:[{id:'arbitrary/remote/push',label:'Opaque supplied label',checked:true,sourceNotification:{topic:'fill',channel:'push'}},{id:'arbitrary/remote/email',label:'Another opaque label',checked:false,sourceNotification:{topic:'fill',channel:'email'}},{id:'mandatory/email',label:'Mandatory observed false',checked:false,sourceNotification:{topic:'bill',channel:'email'}},{id:'legacy-row',label:'Keep this supplied legacy fact',checked:true}]}])
 const onRequest=useMemo<ClientNotificationRequest|undefined>(()=>available?(id,checked,signal)=>{calls.push({id,checked,generation,signal});return new Promise<void>((resolve,reject)=>pending.push({resolve,reject:()=>reject(Error('PRIVATE_NOTIFY_FAILURE'))}))}:undefined,[available,generation])
 Object.assign(window,{notificationSourceFixture:{setGroups,setOwner,setDataset,setMounted,setAvailable,replaceCallback:()=>setGeneration(n=>n+1),calls:()=>calls.map(({signal,...call})=>({...call,aborted:signal.aborted})),resolve:(i=0)=>pending[i].resolve(),reject:(i=0)=>pending[i].reject()}})
 return <main className="client-source-app client-settings-page"><div className="stg-main"><h1>알림</h1>{mounted&&<ClientSettingsNotifications scopeId={`${owner}:${dataset}`} groups={groups} onRequest={onRequest}/>}<div data-legacy-groups>{readClientNotificationPreferences(groups).legacyGroups.map(group=><p key={group.id}>{group.rows.map(row=>row.label).join(',')}</p>)}</div></div></main>
}
createRoot(document.getElementById('root')!).render(<StrictMode><Fixture/></StrictMode>)
