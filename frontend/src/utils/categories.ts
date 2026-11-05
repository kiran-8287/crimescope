import type {CategoryMeta,Dataset} from '../types';

const warned=new Set<string>();
export function categoryLabel(data:Dataset,id:string):string{
 const value=data.meta.categories?.find(category=>category.id===id)?.label;
 if(value)return value;
 if(!warned.has(id)){console.warn(`CrimeScope category metadata missing for ${id}`);warned.add(id)}
 return `[Unknown category: ${id}]`;
}
export function categoriesForYear(data:Dataset,year:number):CategoryMeta[]{
 const list=data.meta.categories??[...new Map(data.observations.filter(row=>row.year===year).map(row=>[row.category,{id:row.category,label:row.categoryLabel??row.category,years:[year]}])).values()];
 return list.filter(category=>category.years.includes(year)).sort((a,b)=>a.label.localeCompare(b.label));
}
export function roleFor(data:Dataset,id:string,year:number):string{
 return data.meta.categories?.find(category=>category.id===id)?.rolesByYear?.[String(year)]?.[0]??'unclassified';
}
