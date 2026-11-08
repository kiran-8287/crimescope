import {createContext,useContext,useEffect,useMemo,useState,type ReactNode} from 'react';
import {useLocation} from 'react-router-dom';
import {fetchDataset,dataMode} from '../api/client';
import {DEFAULT_YEAR,isSupportedYear} from '../config/scope';
import type {Dataset} from '../types';

type DataContextValue={data:Dataset;isDemo:boolean;loading:boolean;error:string;retry:()=>void;yearAdjustedFrom:number|null;isCurrent:boolean};
const Context=createContext<DataContextValue|null>(null);
const viewByPath:Record<string,string>={'/':'overview','/compare':'compare','/trends':'trends','/quality':'quality','/pca':'pca','/clusters':'clusters','/anomalies':'anomalies','/rules':'rules','/methodology':'methodology'};

export function DataProvider({children}:{children:ReactNode}){
 const location=useLocation();const params=useMemo(()=>new URLSearchParams(location.search),[location.search]);
 // Normalise a stale/bookmarked year (e.g. 2020) before the first request so the
 // dashboard recovers instead of failing validation against the active scope.
 const yearParam=params.get('year');const requestedYear=yearParam===null?NaN:Number(yearParam);
 const year=Number.isInteger(requestedYear)&&isSupportedYear(requestedYear)?requestedYear:DEFAULT_YEAR;
 const staleYear=Number.isInteger(requestedYear)&&!isSupportedYear(requestedYear)?requestedYear:null;
 const query={view:viewByPath[location.pathname]??'overview',year,state:params.get('state')??'all',unitType:params.get('unitType')??'administrative_district',category:params.get('category')??'all'};
 const requestKey=JSON.stringify(query);const [data,setData]=useState<Dataset|null>(null);const [error,setError]=useState('');const [loading,setLoading]=useState(true);const [attempt,setAttempt]=useState(0);
 // The query key the currently-held dataset was fetched for. While it differs from
 // `requestKey` the dataset is stale (a refetch is in flight); consumers must not
 // derive or reconcile scope-dependent state from it.
 const [resolvedKey,setResolvedKey]=useState<string|null>(null);
 const isCurrent=resolvedKey===requestKey;
 const [yearAdjustedFrom,setYearAdjustedFrom]=useState<number|null>(null);
 useEffect(()=>{if(staleYear!==null&&yearAdjustedFrom!==staleYear)setYearAdjustedFrom(staleYear)},[staleYear,yearAdjustedFrom]);
 useEffect(()=>{const abort=new AbortController();setError('');setLoading(true);fetchDataset(query,abort.signal).then(next=>{setData(next);setResolvedKey(requestKey);setLoading(false)}).catch(e=>{if(e.name!=='AbortError'){setError(e.message);setLoading(false)}});return()=>abort.abort()},[requestKey,attempt]);
 const retry=()=>setAttempt(x=>x+1);
 if(!data)return <main className="startup"><div className="empty"><h1>{error?'We couldn’t load this view.':'Loading CrimeScope…'}</h1>{error&&<><p role="alert">{error}</p><button className="button primary" onClick={retry}>Retry</button></>}</div></main>;
 return <Context.Provider value={{data,isDemo:dataMode==='demo',loading,error,retry,yearAdjustedFrom,isCurrent}}>{children}</Context.Provider>;
}
export function useData(){const c=useContext(Context);if(!c)throw new Error('DataProvider missing');return c}
