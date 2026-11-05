import { createContext,useContext,useEffect,useState,type ReactNode } from 'react';
import { fetchDataset,dataMode } from '../api/client';
import type { Dataset } from '../types';
const Context=createContext<{data:Dataset;isDemo:boolean}|null>(null);
export function DataProvider({children}:{children:ReactNode}){
 const [data,setData]=useState<Dataset|null>(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 useEffect(()=>{const abort=new AbortController();setError('');fetchDataset(abort.signal).then(setData).catch(e=>{if(e.name!=='AbortError')setError(e.message)});return()=>abort.abort()},[attempt]);
 if(error)return <main className="startup"><div className="empty"><h1>We couldn’t load your workspace.</h1><p role="alert">{error}</p><button className="button primary" onClick={()=>setAttempt(x=>x+1)}>Try again</button><p>No demo fallback is used in API mode.</p></div></main>;
 if(!data)return <main className="startup" aria-busy="true"><span className="loader"/>Loading CrimeScope…</main>;
 return <Context.Provider value={{data,isDemo:dataMode==='demo'}}>{children}</Context.Provider>
}
export function useData(){const c=useContext(Context);if(!c)throw new Error('DataProvider missing');return c}
