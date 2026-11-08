import {useMemo} from 'react';
import {useData} from './DataContext';
import {useFilters} from './useFilters';
import {sumKnown,completeTotal,percentChange} from '../utils/metrics.js';
import {categoryLabel,roleFor} from '../utils/categories';
import {getObservationIndex,observationAt} from '../utils/observationIndex';

export function useAnalytics(){
 const {data,isCurrent}=useData();const {filters}=useFilters();
 const observationIndex=useMemo(()=>getObservationIndex(data.observations),[data.observations]);
 const getObservations=(regionId:string,year:number,category:string)=>{const observation=observationAt(observationIndex,regionId,year,category);return observation?[observation]:[]};
 // Memoised so the array identity is stable across renders; consumers (e.g. the comparison
 // page) use `eligible` as an effect dependency and must not re-run on every render.
 const eligible=useMemo(()=>data.regions.filter(r=>r.year===filters.year&&(filters.state==='all'||r.state===filters.state)&&(filters.unitType==='all'||r.regionType===filters.unitType)),[data.regions,filters.year,filters.state,filters.unitType]);
 const ids=new Set(eligible.map(r=>r.id));
 const scoped=data.observations.filter(o=>ids.has(o.regionId)&&(filters.category==='all'||o.category===filters.category));
 const annual=scoped.filter(o=>o.year===filters.year);
 const currentCategory=filters.category==='all'?data.meta.categories?.find(c=>c.years.includes(filters.year)&&roleFor(data,c.id,filters.year)==='official_total')?.id:null;
 const selectedRecords=annual.filter(o=>filters.category==='all'?o.category===currentCategory:o.category===filters.category);
 const total=sumKnown(selectedRecords);
 const byUnit=new Map<string,typeof selectedRecords>();for(const record of selectedRecords){const bucket=byUnit.get(record.regionId);if(bucket)bucket.push(record);else byUnit.set(record.regionId,[record]);}
 const knownUnits=[...byUnit.values()].filter(records=>records.length>0&&records.every(o=>o.cases!==null)).length;
 const previousPair=data.meta.comparisonPairs?.find(p=>p.status==='available'&&p.toYear===filters.year);
 const previousUnits=new Map(data.regions.filter(r=>r.year===previousPair?.fromYear&&r.cohortId).map(r=>[r.cohortId!,r]));
 const displayedCategory=filters.category==='all'?currentCategory:filters.category;
 const previousCategory=previousPair&&filters.category==='all'?data.meta.categories?.find(c=>c.years.includes(previousPair.fromYear)&&roleFor(data,c.id,previousPair.fromYear)==='official_total')?.id:displayedCategory;
 const rows=eligible.map(r=>{
   const current=displayedCategory?getObservations(r.id,filters.year,displayedCategory):[];
   const priorRegion=r.cohortId?previousUnits.get(r.cohortId):undefined;
   const previous=priorRegion&&previousCategory?getObservations(priorRegion.id,previousPair!.fromYear,previousCategory):[];
   const cases=completeTotal(current);const base=previousPair?completeTotal(previous??[]):null;
   return {id:r.id,region:r.name,state:r.state,regionType:r.regionType,cases,share:null,change:previousPair?percentChange(cases,base):null,coverage:current.length&&current.every(o=>o.cases!==null)?'Complete':'Partial'};
 });
 return {data,filters,eligible,isCurrent,scoped,annual,total,denominator:null,rows,categories:filters.category==='all'?data.meta.categories?.filter(c=>c.years.includes(filters.year))??[]:data.meta.categories?.filter(c=>c.id===filters.category)??[],knownUnits,categoryLabel:(id:string)=>categoryLabel(data,id),officialTotalId:currentCategory};
}
