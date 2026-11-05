import type { Dataset } from '../types';
import { demoDataset } from '../data/demo';
export const dataMode=import.meta.env.VITE_DATA_MODE ?? 'demo';
const configuredBase=(import.meta.env.VITE_API_BASE_URL??'http://localhost:4000/api/v1').replace(/\/$/,'');
// Accept either a full API base (`…/api/v1`) or the backend origin (`…:4000`).
const base=/\/api\/v1$/i.test(configuredBase)?configuredBase:`${configuredBase}/api/v1`;
// This is the ONLY integration boundary. Replace with endpoint composition if your API differs.
export async function fetchDataset(signal?:AbortSignal):Promise<Dataset>{
 if(dataMode==='demo')return structuredClone(demoDataset);
 if(dataMode!=='api')throw new Error('VITE_DATA_MODE must be demo or api.');
 const response=await fetch(`${base}/dashboard`,{signal,headers:{Accept:'application/json'}});
 if(!response.ok)throw new Error(`API request failed (${response.status}). Check the backend and CORS settings.`);
 const data:unknown=await response.json();
 validateDataset(data);return data;
}
export async function fetchAssociationRules(params:{year:number;minSupport:number;minConfidence:number;minLift:number;limit:number;offset:number},signal?:AbortSignal){
 const query=new URLSearchParams(Object.entries(params).map(([k,v])=>[k,String(v)]));
 const response=await fetch(`${base}/analysis/association-rules?${query}`,{signal,headers:{Accept:'application/json'}});
 const body=await response.json();
 if(!response.ok)throw new Error(body.message??`API request failed (${response.status}).`);
 return body;
}
function validateDataset(value:unknown):asserts value is Dataset {
 const d=value as Dataset;
 if(!d||!d.meta||!Array.isArray(d.meta.years)||!d.meta.years.length||!Array.isArray(d.regions)||!Array.isArray(d.observations)||!d.analysis||!Array.isArray(d.analysis.points)||!Array.isArray(d.analysis.variance)||!Array.isArray(d.analysis.loadings)||!Array.isArray(d.analysis.profiles)||!Array.isArray(d.rules)||!Array.isArray(d.issues))throw new Error('Unexpected API response. See docs/API_CONNECTION.md for the Dataset contract.');
 if(d.observations.some(o=>!Number.isFinite(o.year)||(o.cases!==null&&(!Number.isFinite(o.cases)||o.cases<0))))throw new Error('Invalid observation values in API response.');
}
