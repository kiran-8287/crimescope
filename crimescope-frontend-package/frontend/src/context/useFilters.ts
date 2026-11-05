import {useSearchParams} from 'react-router-dom';
import {useData} from './DataContext';
import type {Filters} from '../types';
export function useFilters(){const {data}=useData();const [params,setParams]=useSearchParams();const years=data.meta.years;const states=[...new Set(data.regions.map(r=>r.state))];const cats=[...new Set(data.observations.map(r=>r.category))];const y=Number(params.get('year'));const state=params.get('state')??'all',category=params.get('category')??'all';const filters:Filters={year:years.includes(y)?y:Math.max(...years),state:states.includes(state)?state:'all',category:cats.includes(category as never)?category:'all',metric:params.get('metric')==='share'?'share':'count'};
 function update(key:keyof Filters,value:string){setParams(p=>{const n=new URLSearchParams(p);n.set(key,value);return n},{replace:true})}
 return {filters,update,reset:()=>setParams({}),states,categories:cats,years};}
