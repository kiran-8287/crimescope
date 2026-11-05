import test from 'node:test';
import assert from 'node:assert/strict';
import {sumKnown,completeTotal,percentChange,toCsv,categoryShare} from '../src/utils/metrics.js';
test('missing values do not become a complete total',()=>{assert.equal(sumKnown([{cases:0},{cases:null}]),0);assert.equal(completeTotal([{cases:0},{cases:null}]),null);assert.equal(completeTotal([{cases:0}]),0);assert.equal(completeTotal([]),null)});
test('zero baseline is undefined, zero current is valid',()=>{assert.equal(percentChange(5,0),null);assert.equal(percentChange(0,10),-100);assert.equal(percentChange(null,10),null);assert.equal(percentChange(15,10),50)});
test('CSV escapes quotes and protects text formulas',()=>{const csv=toCsv([{name:'=SUM(A1)',value:5},{name:'a"b',value:-2}]);assert.ok(csv.includes("'="));assert.ok(csv.includes('a""b'));assert.ok(csv.includes('"-2"'))});
test('category shares are disabled when source totals overlap detail categories',()=>{const parentTotal=120,childA=70,childB=50;assert.equal((parentTotal+childA+childB)/parentTotal*100,200);assert.equal(categoryShare(childA,parentTotal,false),null);assert.equal(categoryShare(parentTotal,parentTotal,false),null);assert.equal(categoryShare(childA,parentTotal,true),70/120*100)});
