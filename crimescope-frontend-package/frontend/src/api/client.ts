import type { Dataset } from '../types';
import { demoDataset } from '../data/demo';
export const dataMode=import.meta.env.VITE_DATA_MODE ?? 'demo';
const base=(import.meta.env.VITE_API_BASE_URL??'http://localhost:3001/api/v1').replace(/\/$/,'');
// This is the ONLY integration boundary. Replace with endpoint composition if your API differs.
export async function fetchDataset(signal?:AbortSignal):Promise<Dataset>{
 if(dataMode==='demo')return structuredClone(demoDataset);
 if(dataMode!=='api')throw new Error('VITE_DATA_MODE must be demo or api.');
 const response=await fetch(`${base}/dashboard`,{signal,headers:{Accept:'application/json'}});
 if(!response.ok)throw new Error(`API request failed (${response.status}). Check the backend and CORS settings.`);
 const data:unknown=await response.json();
 validateDataset(data);return data;
}
function validateDataset(value:unknown):asserts value is Dataset {
 const d=value as Dataset;
 if(!d||!d.meta||!Array.isArray(d.meta.years)||!d.meta.years.length||!Array.isArray(d.regions)||!Array.isArray(d.observations)||!d.analysis||!Array.isArray(d.analysis.points)||!Array.isArray(d.analysis.variance)||!Array.isArray(d.analysis.loadings)||!Array.isArray(d.analysis.profiles)||!Array.isArray(d.rules)||!Array.isArray(d.issues))throw new Error('Unexpected API response. See docs/API_CONNECTION.md for the Dataset contract.');
 if(d.observations.some(o=>!Number.isFinite(o.year)||(o.cases!==null&&(!Number.isFinite(o.cases)||o.cases<0))))throw new Error('Invalid observation values in API response.');
}
