import test from 'node:test';
import assert from 'node:assert/strict';
import {sumKnown,completeTotal,percentChange,toCsv} from '../src/utils/metrics.js';
test('missing values do not become a complete total',()=>{assert.equal(sumKnown([{cases:0},{cases:null}]),0);assert.equal(completeTotal([{cases:0},{cases:null}]),null);assert.equal(completeTotal([{cases:0}]),0);assert.equal(completeTotal([]),null)});
test('zero baseline is undefined, zero current is valid',()=>{assert.equal(percentChange(5,0),null);assert.equal(percentChange(0,10),-100);assert.equal(percentChange(null,10),null);assert.equal(percentChange(15,10),50)});
test('CSV escapes quotes and protects text formulas',()=>{const csv=toCsv([{name:'=SUM(A1)',value:5},{name:'a"b',value:-2}]);assert.ok(csv.includes("'="));assert.ok(csv.includes('a""b'));assert.ok(csv.includes('"-2"'))});
