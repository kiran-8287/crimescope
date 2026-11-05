export function sumKnown(rows){return rows.reduce((sum,r)=>sum+(r.cases??0),0)}
export function completeTotal(rows){return rows.length&&rows.every(r=>r.cases!==null)?sumKnown(rows):null}
export function percentChange(current,previous){return current!==null&&previous!==null&&previous>0?(current-previous)/previous*100:null}
export function categoryShare(value,denominator,sharesAvailable){if(!sharesAvailable||value===null||denominator===null||denominator<=0)return null;return value/denominator*100}
export function csvCell(value){let s=String(value??'');if(typeof value==='string'&&/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"'}
export function toCsv(rows){if(!rows.length)return '';const keys=Object.keys(rows[0]);return [keys.map(csvCell).join(','),...rows.map(r=>keys.map(k=>csvCell(r[k])).join(','))].join('\r\n')}
