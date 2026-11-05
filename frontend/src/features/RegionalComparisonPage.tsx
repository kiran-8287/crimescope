import {useEffect,useState} from 'react';
import {useAnalytics} from '../context/useAnalytics';
import {PageTitle} from '../components/Layout';
import {Filters,Panel,Notice,ExportButton} from '../components/UI';
import {Bars,colors} from '../components/Charts';
import {DataTable} from '../components/DataTable';
import {number} from '../utils/format';
import {categoryLabel} from '../utils/categories';
import {completeTotal} from '../utils/metrics.js';
import {getObservationIndex,observationAt} from '../utils/observationIndex';

export default function RegionalComparisonPage(){
 const {data,filters,eligible,officialTotalId}=useAnalytics();
 const [selection,setSelection]=useState<string[]>([]);const [search,setSearch]=useState('');
 const eligibleKey=eligible.map(r=>r.id).join('|');const observationIndex=getObservationIndex(data.observations);
 useEffect(()=>{setSelection(old=>{const retained=old.filter(id=>eligible.some(r=>r.id===id));return retained.length?retained:eligible.slice(0,2).map(r=>r.id)})},[eligibleKey]);
 const selected=eligible.filter(r=>selection.includes(r.id));const categoryId=filters.category==='all'?officialTotalId:filters.category;const label=categoryId?categoryLabel(data,categoryId):'Official reported total';
 const rows=selected.map(r=>{const observation=categoryId?observationAt(observationIndex,r.id,filters.year,categoryId):undefined;return {id:r.id,region:r.name,state:r.state,regionType:r.regionType,categoryId,category:label,cases:completeTotal(observation?[observation]:[])}});
 const exportRows=rows.map(({categoryId,...row})=>({...row,categoryId}));
 const matches=eligible.filter(r=>`${r.name} ${r.state}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
 const shown=[...selected,...matches.filter(r=>!selection.includes(r.id)).slice(0,50)];
 return <><PageTitle eyebrow="SIDE BY SIDE" title="Regional comparison" description="Compare counts for one source category across the selected reporting-unit type." action={<ExportButton rows={exportRows} name="comparison"/>}/><Filters/><Panel title="Choose up to three reporting units" subtitle="Search the selected reporting units. At most 50 matches plus your selected units are shown; comparisons remain limited to three."><label className="search-label">Search districts or states<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Type a district or state"/></label><p className="panel-note">Showing {Math.min(matches.length,50)} of {matches.length} matching units.</p><div className="region-picker">{shown.map(r=><label key={r.id} className={selection.includes(r.id)?'selected':''}><input type="checkbox" checked={selection.includes(r.id)} disabled={!selection.includes(r.id)&&selected.length>=3} onChange={()=>setSelection(selection.includes(r.id)?selection.filter(x=>x!==r.id):[...selection.filter(id=>eligible.some(e=>e.id===id)),r.id])}/>{r.name} <span className="muted">{r.state}</span></label>)}</div></Panel>{selected.length?<><Panel title={label} subtitle={`${filters.year} · ${filters.unitType==='all'?'selected reporting units':filters.unitType.replaceAll('_',' ')}`}><Bars items={rows.map((r,i)=>({label:r.region,value:r.cases,color:colors[i%colors.length]}))} unit="cases"/><p className="panel-note">Unavailable means this source record was absent; it is never replaced with zero.</p></Panel><Panel title="Exact comparison values"><DataTable rows={rows} searchable={false} columns={[{key:'region',label:'Reporting unit'},{key:'regionType',label:'Unit type'},{key:'category',label:'Category'},{key:'cases',label:'Cases',render:r=>number(r.cases as number|null)}]}/></Panel></>:<Notice>No reporting units are available for the selected filters.</Notice>}{!data.meta.categoryDisplay?.compositionSharesAvailable&&<Notice>{data.meta.categoryDisplay?.reason??'Category shares are disabled because no mutually-exclusive category set has been verified.'}</Notice>}</>
}
