import {Link} from 'react-router-dom';
import {ArrowUpRight} from 'lucide-react';
import {PageTitle} from '../components/Layout';
import {Panel,Filters,Stat,Notice,Badge,ExportButton} from '../components/UI';
import {Lines} from '../components/Charts';
import {DataTable} from '../components/DataTable';
import {useAnalytics} from '../context/useAnalytics';
import {number} from '../utils/format';
import {categoryLabel,roleFor} from '../utils/categories';
import {getObservationIndex,observationAt} from '../utils/observationIndex';

export default function OverviewPage(){
 const {data,filters,total,rows,annual,categories,knownUnits,officialTotalId}=useAnalytics();
 const observationIndex=getObservationIndex(data.observations);
 const labels=data.meta.years.map(String);
 const pairs=data.meta.comparisonPairs?.filter(p=>p.status==='available')??[];
 const selectedLabel=filters.category==='all'?'Official reported total':categoryLabel(data,filters.category);
 const totalSeries=pairs.map(pair=>{
   const values:(number|null)[]=data.meta.years.map(()=>null);
   const categoryAt=(year:number)=>filters.category==='all'?data.meta.categories?.find(c=>c.years.includes(year)&&roleFor(data,c.id,year)==='official_total')?.id:filters.category;
   const fromCategory=categoryAt(pair.fromYear),toCategory=categoryAt(pair.toYear);
   if(!fromCategory||!toCategory)return {name:`${pair.fromYear}–${pair.toYear} comparable cohort (unavailable)`,values};
   const fromRegions=data.regions.filter(r=>r.year===pair.fromYear&&r.cohortId?.startsWith(`${pair.id}:`)&&(filters.unitType==='all'||r.regionType===filters.unitType)&&(filters.state==='all'||r.state===filters.state));
   const toIds=new Set(data.regions.filter(r=>r.year===pair.toYear&&r.cohortId?.startsWith(`${pair.id}:`)&&(filters.unitType==='all'||r.regionType===filters.unitType)&&(filters.state==='all'||r.state===filters.state)).map(r=>r.cohortId));
   const candidate=fromRegions.filter(r=>toIds.has(r.cohortId));
   const usable=candidate.filter(r=>[pair.fromYear,pair.toYear].every(year=>{const region=data.regions.find(x=>x.year===year&&x.cohortId===r.cohortId);const category=year===pair.fromYear?fromCategory:toCategory;return !!region&&!!category&&(observationAt(observationIndex,region.id,year,category)?.cases??null)!==null}));
   for(const [year,cat] of [[pair.fromYear,fromCategory],[pair.toYear,toCategory]] as const){const index=data.meta.years.indexOf(year);const ids=new Set(usable.map(r=>r.cohortId));const yearRegions=data.regions.filter(r=>r.year===year&&ids.has(r.cohortId));const valuesFor=yearRegions.map(r=>observationAt(observationIndex,r.id,year,cat)?.cases??null);values[index]=valuesFor.length&&valuesFor.every(v=>v!==null)?valuesFor.reduce<number>((a,v)=>a+(v??0),0):null;}
   return {name:`${pair.fromYear}–${pair.toYear} comparable cohort (${usable.length} ${filters.unitType==='administrative_district'?'districts':'units'})`,values};
 });
 const currentYear=filters.year;const currentCat=filters.category==='all'?officialTotalId:filters.category;
 const singleValues:(number|null)[]=data.meta.years.map(()=>null);const currentIndex=data.meta.years.indexOf(currentYear);
 const singleRows=annual.filter(o=>o.category===currentCat);singleValues[currentIndex]=singleRows.length&&singleRows.every(o=>o.cases!==null)?singleRows.reduce((a,o)=>a+(o.cases??0),0):null;
 const chartSeries=[...totalSeries,{name:`${currentYear} standalone · ${selectedLabel}`,values:singleValues}];
 const detailRows=chartSeries.flatMap(series=>series.values.flatMap((value,i)=>value===null?[]:[{id:`${series.name}-${labels[i]}`,period:series.name,year:Number(labels[i]),category:selectedLabel,cases:value}]));
 return <><PageTitle eyebrow="THE BIG PICTURE" title="Reported crime overview" description={`Explore source-reported counts for ${data.meta.geographyScope??'the selected scope'}.`} action={<ExportButton rows={annual.map(o=>({...o,categoryId:o.category,category:categoryLabel(data,o.category)}))} name="observations"/>}/><Filters/><div className="stats"><Stat label="Reported cases" value={number(total)} detail={`${knownUnits} of ${rows.length} selected reporting units have this total`}/><Stat label="Reporting units" value={number(rows.length)} detail={`${filters.year} · ${filters.unitType==='administrative_district'?'administrative districts':filters.unitType}`}/><Stat label="Categories available" value={number(categories.length)} detail={`${filters.year} source categories; one series shown by default`}/><Stat label="Reporting period" value={String(filters.year)} detail={`${data.meta.years.length} years in source export`}/></div><div className="grid two-one"><Panel title="Reported total over time" subtitle="Comparable periods are separated; IPC/BNS and geography breaks are not connected." action={<Link className="text-link" to="/trends">Explore trends <ArrowUpRight size={14}/></Link>}><Lines labels={labels} series={chartSeries} unit="cases"/><details className="details"><summary>View chart values</summary><DataTable searchable={false} rows={detailRows} columns={[{key:'period',label:'Cohort'},{key:'year',label:'Year'},{key:'category',label:'Category'},{key:'cases',label:'Cases'}]}/></details></Panel><Panel title="Category totals" subtitle="Counts are displayed individually; category values overlap and are not a composition."><Notice>{data.meta.categoryDisplay?.reason??'Category shares are disabled because categories have not been verified as mutually exclusive.'} Use the searchable category filter to chart one category at a time.</Notice><DataTable rows={categories.filter(c=>c.id!==officialTotalId).slice(0,8).map(c=>({id:c.id,categoryId:c.id,label:categoryLabel(data,c.id),role:roleFor(data,c.id,filters.year)}))} columns={[{key:'label',label:'Available category'},{key:'role',label:'Source role'}]} searchable={false}/></Panel></div><Panel title="Regional snapshot" subtitle="Official total or the selected category; unavailable source records remain gaps." action={<Link className="text-link" to="/compare">Compare regions <ArrowUpRight size={14}/></Link>}><DataTable rows={rows} columns={[{key:'region',label:'Reporting unit'},{key:'regionType',label:'Unit type'},{key:'state',label:'State / UT'},{key:'cases',label:'Cases',render:r=>number(r.cases as number|null)},{key:'change',label:'Comparable change',render:r=>r.change===null?'Unavailable':`${number(r.change as number,1)}%`},{key:'coverage',label:'Coverage',render:r=><Badge tone={r.coverage==='Complete'?'green':'amber'}>{String(r.coverage)}</Badge>}]}/></Panel><Notice>{data.meta.warnings.join(' ')}</Notice></>
}
