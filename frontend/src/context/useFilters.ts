import {useEffect} from 'react';
import {useSearchParams} from 'react-router-dom';
import {useData} from './DataContext';
import type {Filters} from '../types';
import {categoriesForYear} from '../utils/categories';

export function useFilters(){
 const {data,isCurrent}=useData();const [params,setParams]=useSearchParams();const years=data.meta.years;
 const y=Number(params.get('year'));const year=years.includes(y)?y:Math.max(...years);
 const states=[...new Set(data.regions.filter(r=>r.year===year).map(r=>r.state))];
 const categories=categoriesForYear(data,year);
 const types=[...new Set(data.regions.filter(r=>r.year===year).map(r=>r.regionType??'unknown'))];
 const stateParam=params.get('state')??'all';const state=states.includes(stateParam)?stateParam:'all';
 const preferredType=types.includes('administrative_district')?'administrative_district':'all';
 const typeParam=params.get('unitType')??preferredType;const unitType=typeParam==='all'||types.includes(typeParam)?typeParam:preferredType;
 const categoryParam=params.get('category')??'all';const category=categories.some(c=>c.id===categoryParam)?categoryParam:'all';
 const metric:Filters['metric']=data.meta.categoryDisplay?.compositionSharesAvailable&&params.get('metric')==='share'?'share':'count';
 const filters:Filters={year,state,category,metric,unitType};
 // Write the normalised year/category/unitType/state/metric back to the URL. Skipped
 // while the held dataset is stale (a refetch for a new scope is in flight); otherwise
 // `unitType`/`state` are temporarily derived from the previous scope and would be
 // normalised to `all` or a fallback, corrupting the URL for the scope being loaded.
 useEffect(()=>{if(!isCurrent)return;if(params.get('year')!==String(year)||params.get('category')!==category||params.get('unitType')!==unitType||params.get('state')!==state||params.get('metric')!==metric){const next=new URLSearchParams(params);next.set('year',String(year));next.set('category',category);next.set('unitType',unitType);next.set('state',state);next.set('metric',metric);setParams(next,{replace:true})}},[year,category,unitType,state,metric,params,setParams,isCurrent]);
 function update(key:keyof Filters,value:string){setParams(p=>{const n=new URLSearchParams(p);n.set(key,value);return n},{replace:true})}
 return {filters,update,reset:()=>setParams({}),states,categories,years,unitTypes:types};
}
