import {useState} from 'react';
import {NavLink,Outlet,useLocation,Link} from 'react-router-dom';
import {ScanLine,LayoutDashboard,GitCompareArrows,ChartNoAxesCombined,ShieldCheck,ScatterChart,Network,TriangleAlert,Workflow,BookOpen,Menu,X,Database,ArrowUpRight} from 'lucide-react';
import {useData} from '../context/DataContext';
import {useFilters} from '../context/useFilters';

export const navigation = [
  {path:'/',label:'Overview',icon:LayoutDashboard,section:'EXPLORE'},
  {path:'/compare',label:'Regional comparison',icon:GitCompareArrows},
  {path:'/trends',label:'Yearly trends',icon:ChartNoAxesCombined},
  {path:'/quality',label:'Data quality',icon:ShieldCheck},
  {path:'/pca',label:'PCA explorer',icon:ScatterChart,section:'ANALYSE'},
  {path:'/clusters',label:'Cluster profiles',icon:Network},
  {path:'/anomalies',label:'Unusual observations',icon:TriangleAlert},
  {path:'/rules',label:'Association rules',icon:Workflow},
  {path:'/methodology',label:'Methodology & sources',icon:BookOpen,section:'REFERENCE'}
];

export function Layout(){
  const [open,setOpen]=useState(false);
  const {data,isDemo}=useData();
  const {filters}=useFilters();
  const location=useLocation();
  const units=data.regions.filter(r=>r.year===filters.year&&(filters.unitType==='all'||r.regionType===filters.unitType)&&(filters.state==='all'||r.state===filters.state));
  const types:Record<string,string>={all:'reporting units',administrative_district:'districts',city_police:'city-police units',railway:'railway units',other_police_unit:'specialized/rural police units'};

  return (
    <div className="shell">
      <a className="skip-link" href="#main">Skip to content</a>
      {open&&<button className="scrim" aria-label="Close navigation" onClick={()=>setOpen(false)}/>}
      <aside className={`sidebar ${open?'open':''}`}>
        <Link to="/" className="brand">
          <span className="brand-icon"><ScanLine size={25}/></span>
          <div>CrimeScope<small>REGIONAL INTELLIGENCE</small></div>
        </Link>
        <button className="mobile-close" aria-label="Close navigation" onClick={()=>setOpen(false)}><X/></button>
        <nav aria-label="Main navigation">
          {navigation.map(n=>(
            <div key={n.path}>
              {n.section&&<span className="nav-section">{n.section}</span>}
              <NavLink end={n.path==='/'} to={{pathname:n.path,search:location.search}} onClick={()=>setOpen(false)} className={({isActive})=>isActive?'nav-link active':'nav-link'}>
                <n.icon size={18}/>{n.label}
              </NavLink>
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Database size={18}/>
          <div>
            <strong>Coverage: 2021–2024 · 36 states/UTs</strong>
            <small>{filters.year} · {units.length} {types[filters.unitType]??'reporting units'}</small>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div>
            <button className="menu-button" aria-label="Open navigation" onClick={()=>setOpen(true)}><Menu size={20}/></button>
            <span className="breadcrumb">Workspace <span>/</span> {navigation.find(n=>n.path===location.pathname)?.label??'Page not found'}</span>
          </div>
          <div className="topbar-right">
            <span className="status-dot"/>
            <span>Coverage: 2021–2024 · 36 states/UTs</span>
            <Link to="/methodology" className="top-help">Methodology & Provenance <ArrowUpRight size={14}/></Link>
          </div>
        </header>

        {isDemo ? (
          <div className="demo-strip"><span>DESIGN PREVIEW</span> Fictional regions and sample results. No real crime or safety findings.</div>
        ) : filters.year === 2020 ? (
          <div className="notice warning"><Database size={16}/><span><strong>2020 coverage is limited to Andhra Pradesh.</strong> All other states begin reporting in the 2021 national cohort.</span></div>
        ) : (
          <div className="notice"><Database size={16}/><span><strong>Coverage: 2021–2024 · 36 states/UTs.</strong> Reported records reflect police recording practices and population sizes.</span></div>
        )}

        <main id="main" tabIndex={-1}><Outlet/></main>
        <footer>
          <span>CrimeScope · Reported crime analytics</span>
          <span>Release {data.meta.releaseId} · Reported records do not measure all crime.</span>
        </footer>
      </div>
    </div>
  );
}

export function PageTitle({eyebrow,title,description,action}:{eyebrow:string;title:string;description:string;action?:React.ReactNode}){
  return (
    <div className="page-title">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
