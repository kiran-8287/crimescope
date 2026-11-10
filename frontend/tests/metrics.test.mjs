import test from 'node:test';
import assert from 'node:assert/strict';
import {sumKnown,completeTotal,percentChange,toCsv,categoryShare} from '../src/utils/metrics.js';
test('missing values do not become a complete total',()=>{assert.equal(sumKnown([{cases:0},{cases:null}]),0);assert.equal(completeTotal([{cases:0},{cases:null}]),null);assert.equal(completeTotal([{cases:0}]),0);assert.equal(completeTotal([]),null)});
test('zero baseline is undefined, zero current is valid',()=>{assert.equal(percentChange(5,0),null);assert.equal(percentChange(0,10),-100);assert.equal(percentChange(null,10),null);assert.equal(percentChange(15,10),50)});
test('CSV escapes quotes and protects text formulas',()=>{const csv=toCsv([{name:'=SUM(A1)',value:5},{name:'a"b',value:-2}]);assert.ok(csv.includes("'="));assert.ok(csv.includes('a""b'));assert.ok(csv.includes('"-2"'))});
test('category shares are disabled when source totals overlap detail categories',()=>{const parentTotal=120,childA=70,childB=50;assert.equal((parentTotal+childA+childB)/parentTotal*100,200);assert.equal(categoryShare(childA,parentTotal,false),null);assert.equal(categoryShare(parentTotal,parentTotal,false),null);assert.equal(categoryShare(childA,parentTotal,true),70/120*100)});

// Minimal RFC4180 record parser: counts CSV records while honouring quoted fields, so
// a value containing a newline is not miscounted as an extra row.
function parseCsvRecords(text){
  const records=[];let field='';let row=[];let inQuotes=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(inQuotes){
      if(c==='"'){ if(text[i+1]==='"'){field+='"';i++;} else inQuotes=false; } else field+=c;
    } else if(c==='"'){ inQuotes=true; }
    else if(c===','){ row.push(field);field=''; }
    else if(c==='\r'){ if(text[i+1]==='\n')i++; row.push(field);records.push(row);row=[];field=''; }
    else if(c==='\n'){ row.push(field);records.push(row);row=[];field=''; }
    else field+=c;
  }
  if(field!==''||row.length){ row.push(field);records.push(row); }
  return records;
}
test('exported CSV record count equals the exported rows, counted as parsed records',()=>{
  // Two rule rows; the second carries an embedded newline inside a quoted cell.
  const rows=[{id:'r1',antecedent:'a + b',consequent:'c'},{id:'r2',antecedent:'x',consequent:'y\nz'}];
  const csv=toCsv(rows);
  const records=parseCsvRecords(csv);
  assert.equal(records.length-1,rows.length,'parsed records minus the header must equal the exported row count');
  assert.equal(records[0].length,Object.keys(rows[0]).length,'every record has one cell per column');
  // A naive newline split over-counts because of the embedded newline — this is why the
  // export count must be verified as parsed records, not line breaks.
  assert.notEqual(csv.split('\n').length-1,rows.length);
});
