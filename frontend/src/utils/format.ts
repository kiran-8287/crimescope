// Rounded negative zero is normalised to zero, and a single number is formatted
// once so a value can never render with a double sign (e.g. "+-0.007" or "-0").
export const number=(v:number|null|undefined,digits=0)=>{
  if(v===null||v===undefined||Number.isNaN(v))return'Unavailable';
  const rounded=Number(v.toFixed(digits));
  const value=rounded===0?0:rounded;
  return new Intl.NumberFormat('en-IN',{maximumFractionDigits:digits,minimumFractionDigits:0}).format(value);
};
export function downloadCsv(rows:Record<string,unknown>[],filename:string){import('./metrics.js').then(({toCsv})=>{const url=URL.createObjectURL(new Blob(['\uFEFF'+toCsv(rows)],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)})}
