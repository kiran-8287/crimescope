import {useData} from '../context/DataContext';
import {PageTitle} from '../components/Layout';
import {Panel,Stat,Notice,Badge,ExportButton} from '../components/UI';
import {DataTable} from '../components/DataTable';
import {number} from '../utils/format';

export default function DataQualityPage(){
 const {data,isDemo}=useData();
 const counts=new Map<string,{provided:number;known:number}>();let missing=0;
 // Aggregate in one pass. The former region × year × full-dataset filters
 // performed billions of comparisons on the national snapshot.
 for(const observation of data.observations){
  const key=`${observation.regionId}\u001f${observation.year}`;const count=counts.get(key)??{provided:0,known:0};count.provided++;
  if(observation.cases===null)missing++;else count.known++;
  counts.set(key,count);
 }
 const coverage=data.regions.map(region=>({id:region.id,region:region.name,...Object.fromEntries(data.meta.years.map(year=>{
  const count=counts.get(`${region.id}\u001f${year}`);return[String(year),count?`${count.known}/${count.provided}`:'Unavailable'];
 }))}));
 return <><PageTitle eyebrow="KNOW YOUR DATA" title="Data quality & coverage" description="Inspect completeness, known limitations and reporting gaps." action={<ExportButton rows={data.issues} name="quality-issues"/>}/><div className="stats three"><Stat label="Observations" value={number(data.observations.length)} detail="Region × year × category records"/><Stat label="Missing values" value={String(missing)} detail="Retained as null, never zero-filled"/><Stat label="Completeness" value={data.observations.length?`${((1-missing/data.observations.length)*100).toFixed(1)}%`:'Unavailable'} detail="Non-null values among supplied rows"/></div><Panel title="Reporting coverage" subtitle="Available / supplied category records. This does not prove full source coverage."><DataTable rows={coverage} columns={[{key:'region',label:'Region'},...data.meta.years.map(y=>({key:String(y),label:String(y),render:(r:Record<string,unknown>)=><Badge>{String(r[String(y)])}</Badge>}))]}/></Panel><Panel title="Issue register" subtitle="Known issues and their current handling."><DataTable rows={data.issues} columns={[{key:'region',label:'Scope'},{key:'type',label:'Issue'},{key:'status',label:'Status',render:r=><Badge tone="amber">{String(r.status)}</Badge>},{key:'detail',label:'Details'}]}/></Panel><Notice>{isDemo?'This page audits only synthetic interface fixtures. It is not a validation report for NCRB.':'Completeness among supplied rows cannot establish that all source tables were ingested.'} Boundary and category compatibility need separate source validation.</Notice></>
}
