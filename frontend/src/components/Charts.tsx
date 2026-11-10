import {useId} from 'react';
import {number} from '../utils/format';
import {lineCommands} from '../utils/chartPath';
import {compact, barScale, AXIS_GUTTER_PX, AXIS_FONT_PX} from '../utils/axis';
export const colors=['#237866','#6689ba','#cf9b46','#9176ae'];
export function Bars({items,unit='',max}:{items:{label:string;value:number|null;color?:string}[];unit?:string;max?:number}){const m=max??Math.max(...items.map(i=>i.value??0),1);return <div className="bars">{items.map((item,i)=><div className="bar-row" key={item.label}><span>{item.label}</span><div className="bar-track"><div style={{width:`${Math.min(100,Math.max(0,(item.value??0)/m*100))}%`,background:item.color??colors[i%4]}}/></div><strong>{item.value===null?'Unavailable':number(item.value,1)+(unit?' '+unit:'')}</strong></div>)}</div>}
// A series may opt out of connecting adjacent points. `connect(fromIndex)` decides
// whether the segment from labels[fromIndex] to labels[fromIndex+1] is drawn; when
// omitted, adjacent non-null points are connected. Annual cross-framework totals pass
// `connect: () => false` so they render as isolated points, while a matched cohort
// connects only its own two endpoints.
export type Series={name:string;values:(number|null)[];connect?:(fromIndex:number)=>boolean};
export function Lines({labels,series,unit='cases'}:{labels:string[];series:Series[];unit?:string}){const id=useId();const w=680,h=240,left=AXIS_GUTTER_PX.line,right=18,top=26,bottom=36;const maximum=Math.max(1,...series.flatMap(s=>s.values.map(v=>v??0)))*1.12;const x=(i:number)=>left+i*(w-left-right)/Math.max(1,labels.length-1),y=(v:number)=>h-bottom-v/maximum*(h-top-bottom);return <><svg className="line-chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-labelledby={id}><title id={id}>{unit} over {labels.join(', ')}. Exact values are available in the data table below.</title>{[0,1,2,3,4].map(i=><g key={i}><line x1={left} x2={w-right} y1={y(maximum*i/4)} y2={y(maximum*i/4)} stroke="#e7ebe8"/><text x={left-8} y={y(maximum*i/4)+4} textAnchor="end">{compact(maximum*i/4)}</text></g>)}{labels.map((l,i)=><text key={l} x={x(i)} y={h-10} textAnchor="middle">{l}</text>)}{series.map((s,j)=>{const commands=lineCommands(s.values,s.connect);const path=s.values.map((v,i)=>v===null?'':`${commands[i]}${x(i)},${y(v)} `).join('');return <g key={s.name}><path d={path} fill="none" stroke={colors[j%4]} strokeWidth="2.5"/>{s.values.map((v,i)=>v!==null&&<circle key={i} cx={x(i)} cy={y(v)} r="3.5" fill="white" stroke={colors[j%4]} strokeWidth="2"><title>{s.name}, {labels[i]}: {number(v,1)} {unit}</title></circle>)}</g>})}</svg><div className="legend">{series.map((s,i)=><span key={s.name}><i style={{background:colors[i%4]}}/>{s.name}</span>)}</div></>}
export function Scatter({points,selected,onSelect}:{points:{id:string;label:string;x:number;y:number;cluster:number}[];selected?:string;onSelect:(id:string)=>void}){const max=Math.max(2.5,...points.flatMap(p=>[Math.abs(p.x),Math.abs(p.y)]));const x=(v:number)=>300+v/max*240,y=(v:number)=>165-v/max*125;return <svg className="scatter" viewBox="0 0 600 340" role="group" aria-label="PCA region plot. Points are keyboard selectable.">{[-2,-1,0,1,2].map(v=><g key={v}><line x1={x(v)} x2={x(v)} y1="30" y2="300" stroke="#e8ece9"/><line x1="50" x2="550" y1={y(v)} y2={y(v)} stroke="#e8ece9"/><text x={x(v)} y="319" textAnchor="middle">{v}</text><text x="35" y={y(v)+4}>{v}</text></g>)}<text x="300" y="338" textAnchor="middle">Principal component 1</text><text transform="translate(13 170) rotate(-90)" textAnchor="middle">Principal component 2</text>{points.map(p=><circle key={p.id} tabIndex={0} role="button" aria-label={`${p.label}, profile ${p.cluster+1}, PC1 ${p.x.toFixed(2)}, PC2 ${p.y.toFixed(2)}`} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(p.id)}}} onClick={()=>onSelect(p.id)} cx={x(p.x)} cy={y(p.y)} r={selected===p.id?10:7} fill={colors[p.cluster%4]} stroke={selected===p.id?'#172c28':'white'} strokeWidth="2" className="scatter-point"><title>{p.label}</title></circle>)}</svg>}
// Signed diverging bars centred on zero, for values where the sign carries
// meaning (e.g. cluster centroid deviations in standardized feature space).
// Every row shares one maximum absolute value so the rows are directly
// comparable, and labels are built from the shared `number` formatter so a
// rounded negative zero never renders as "-0.00" and a value never carries a
// double sign ("+-").
export function DivergingBars({items,unit='σ'}:{items:{label:string;value:number}[];unit?:string}){const max=Math.max(1e-9,...items.map(i=>Math.abs(i.value)));return <div style={{display:'flex',flexDirection:'column',gap:'0.35rem'}}>{items.map((item,i)=>{const pct=Math.min(100,Math.abs(item.value)/max*100);const positive=item.value>=0;const rounded=Number(item.value.toFixed(2));const label=`${rounded>0?'+':''}${number(rounded,2)}${unit?' '+unit:''}`;return <div key={`${i}-${item.label}`} style={{display:'flex',alignItems:'center',gap:'0.5rem'}}><span style={{flex:'0 0 44%',fontSize:'0.8rem',overflowWrap:'anywhere'}} title={item.label}>{item.label}</span><div style={{position:'relative',flex:1,height:'10px',background:'#eef1f0',borderRadius:'5px'}} aria-hidden="true"><span style={{position:'absolute',left:'50%',top:0,bottom:0,width:'1px',background:'#c9cfcb'}}/><span style={{position:'absolute',top:0,bottom:0,borderRadius:'5px',background:positive?'#237866':'#b45309',...(positive?{left:'50%',width:`${pct/2}%`}:{right:'50%',width:`${pct/2}%`})}}/></div><strong style={{flex:'0 0 4.5rem',textAlign:'right',fontSize:'0.8rem',whiteSpace:'nowrap',color:positive?'#0f766e':'#b45309'}}>{label}</strong></div>})}</div>}

// --------------------------------------------------------------------------- //
// Annual bar chart (zero baseline)
// --------------------------------------------------------------------------- //
// Vertical bars read directly, one bar per period, all rising from a shared zero
// baseline. Used for the annual overview and trends charts where four standalone
// totals previously rendered as isolated dots with hard-to-read ticks. The scale
// adapts to the data (lakh / thousand / raw) and the y-ticks are chosen from a
// fixed ladder so the tallest value label never collides with the top gridline
// and no tick label is clipped by the axis gutter.
export type AnnualBarDatum={label:string;value:number|null;units?:number;framework?:string};

export function AnnualBars({bars,unit='cases',breakAfterIndex,breakLabel,callout,height=300,ariaLabel}:{bars:AnnualBarDatum[];unit?:string;breakAfterIndex?:number;breakLabel?:string;callout?:string;height?:number;ariaLabel?:string}){
  const id=useId();
  const w=680,h=height,left=AXIS_GUTTER_PX.bars,right=24,top=38,bottom=76;
  const plotW=w-left-right,plotH=h-top-bottom;
  const maxVal=Math.max(1,...bars.map(b=>b.value??0));
  const {factor,scaleWord,ticks,top:yTop}=barScale(maxVal);
  const y=(v:number)=>top+plotH-(v/yTop)*plotH;
  const n=bars.length,slot=plotW/Math.max(1,n),barW=Math.min(66,slot*0.46);
  const valueLabel=(v:number)=>factor===1?number(v):number(v/factor,2);
  const fl=breakAfterIndex!=null?bars[breakAfterIndex]?.framework:undefined;
  const fr=breakAfterIndex!=null?bars[breakAfterIndex+1]?.framework:undefined;
  return <>
    <svg className="annual-bars" viewBox={`0 0 ${w} ${h}`} role="img" aria-labelledby={id} preserveAspectRatio="xMidYMid meet">
      <title id={id}>{ariaLabel??`Reported ${unit} per period with a zero baseline. Exact values and unit counts are in the table below.`}</title>
      {ticks.map(t=><g key={t}><line x1={left} x2={w-right} y1={y(t*factor)} y2={y(t*factor)} stroke={t===0?'#c9cfcb':'#eef1f0'}/><text x={left-8} y={y(t*factor)+4} textAnchor="end" fontSize={AXIS_FONT_PX} fill="#6b7280">{factor===1?number(t):number(t,1)}</text></g>)}
      <text x={left-8} y={top-18} textAnchor="end" fontSize={AXIS_FONT_PX} fill="#6b7280">{unit} ({scaleWord})</text>
      {bars.map((b,i)=>{const cx=left+slot*(i+0.5);if(b.value===null||b.value===undefined)return <text key={b.label} x={cx} y={y(0)-8} textAnchor="middle" fontSize={AXIS_FONT_PX} fill="#9ca3af">n/a</text>;const top_y=y(b.value);return <g key={b.label}><rect x={cx-barW/2} y={top_y} width={barW} height={Math.max(0,y(0)-top_y)} rx="3" fill={colors[i%4]}><title>{b.label}: {number(b.value)} {unit}{b.units!=null?` · ${number(b.units)} reporting units`:''}</title></rect><text x={cx} y={top_y-7} textAnchor="middle" fontSize="12" fontWeight={600} fill="#1f2937">{valueLabel(b.value)}</text></g>})}
      {breakAfterIndex!=null&&breakAfterIndex>=0&&breakAfterIndex<n-1&&(()=>{const bx=left+slot*(breakAfterIndex+1);return <g><line x1={bx} x2={bx} y1={top-10} y2={h-bottom} stroke="#b45309" strokeWidth="1.5" strokeDasharray="5 4"/><text x={bx} y={top-20} textAnchor="middle" fontSize="10" fill="#b45309">{breakLabel??'framework break'}</text>{fl&&<text x={bx-6} y={h-bottom+18} textAnchor="end" fontSize="10" fill="#6b7280">{fl}</text>}{fr&&<text x={bx+6} y={h-bottom+18} textAnchor="start" fontSize="10" fill="#6b7280">{fr}</text>}</g>})()}
      {bars.map((b,i)=><g key={`x-${b.label}`}><text x={left+slot*(i+0.5)} y={h-bottom+20} textAnchor="middle" fontSize="12" fill="#374151">{b.label}</text>{b.units!=null&&<text x={left+slot*(i+0.5)} y={h-bottom+36} textAnchor="middle" fontSize="10" fill="#6b7280">{number(b.units)} units</text>}</g>)}
    </svg>
    {callout&&<div className="annual-callout">{callout}</div>}
  </>;
}
