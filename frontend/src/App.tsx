import {lazy,Suspense} from 'react';
import {BrowserRouter,Routes,Route,Link} from 'react-router-dom';
import {DataProvider} from './context/DataContext';
import {Layout} from './components/Layout';
const Overview=lazy(()=>import('./features/OverviewPage'));
const Compare=lazy(()=>import('./features/RegionalComparisonPage'));
const Trends=lazy(()=>import('./features/TrendsPage'));
const Quality=lazy(()=>import('./features/DataQualityPage'));
const Pca=lazy(()=>import('./features/PcaPage'));
const Clusters=lazy(()=>import('./features/ClustersPage'));
const Anomalies=lazy(()=>import('./features/AnomaliesPage'));
const Rules=lazy(()=>import('./features/AssociationRulesPage'));
const Methodology=lazy(()=>import('./features/MethodologyPage'));
export default function App(){return <BrowserRouter future={{v7_startTransition:true,v7_relativeSplatPath:true}}><DataProvider><Suspense fallback={<div className="startup">Loading page…</div>}><Routes><Route element={<Layout/>}><Route index element={<Overview/>}/><Route path="compare" element={<Compare/>}/><Route path="trends" element={<Trends/>}/><Route path="quality" element={<Quality/>}/><Route path="pca" element={<Pca/>}/><Route path="clusters" element={<Clusters/>}/><Route path="anomalies" element={<Anomalies/>}/><Route path="rules" element={<Rules/>}/><Route path="methodology" element={<Methodology/>}/><Route path="*" element={<div className="empty"><h1>Page not found</h1><Link to="/">Return to overview</Link></div>}/></Route></Routes></Suspense></DataProvider></BrowserRouter>}
