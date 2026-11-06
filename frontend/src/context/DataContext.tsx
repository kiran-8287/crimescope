import {createContext,useContext,useEffect,useMemo,useState,type ReactNode} from 'react';
import {useLocation} from 'react-router-dom';
import {fetchDataset,dataMode} from '../api/client';
import type {Dataset} from '../types';

type DataContextValue={data:Dataset;isDemo:boolean;loading:boolean;error:string;retry:()=>void};
const Context=createContext<DataContextValue|null>(null);
const viewByPath:Record<string,string>={'/':'overview','/compare':'compare','/trends':'trends','/quality':'quality','/pca':'pca','/clusters':'clusters','/anomalies':'anomalies','/rules':'rules','/methodology':'methodology'};

export function DataProvider({children}:{children:ReactNode}){
 const location=useLocation();const params=useMemo(()=>new URLSearchParams(location.search),[location.search]);
 const query={view:viewByPath[location.pathname]??'overview',year:Number(params.get('year'))||2024,state:params.get('state')??'all',unitType:params.get('unitType')??'administrative_district',category:params.get('category')??'all'};
 const requestKey=JSON.stringify(query);const [data,setData]=useState<Dataset|null>(null);const [error,setError]=useState('');const [loading,setLoading]=useState(true);const [attempt,setAttempt]=useState(0);
 useEffect(()=>{const abort=new AbortController();setError('');setLoading(true);fetchDataset(query,abort.signal).then(next=>{setData(next);setLoading(false)}).catch(e=>{if(e.name!=='AbortError'){setError(e.message);setLoading(false)}});return()=>abort.abort()},[requestKey,attempt]);
 const retry=()=>setAttempt(x=>x+1);
 if(!data)return <main className="startup"><div className="empty"><h1>{error?'We couldn’t load this view.':'Loading CrimeScope…'}</h1>{error&&<><p role="alert">{error}</p><button className="button primary" onClick={retry}>Retry</button></>}</div></main>;
 return <Context.Provider value={{data,isDemo:dataMode==='demo',loading,error,retry}}>{children}</Context.Provider>;
}
export function useData(){const c=useContext(Context);if(!c)throw new Error('DataProvider missing');return c}
