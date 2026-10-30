const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('experiments/neon-pilot/app/main-neon.js', 'utf8');
const context = {}; vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('function summarizeTripBudget('), source.indexOf('function renderTripBudget(')), context);
const totals = context.summarizeTripBudget([
 {currency:'BRL',planned_amount:100,actual_amount:80,purchase_status:'purchased'},
 {currency:'EUR',planned_amount:20,purchase_status:'pending'}
]);
const converted = context.budgetDisplayTotals(totals, 5);
assert.equal(converted.get('BRL').planned,200);
assert.equal(converted.get('BRL').paid,80);
assert.equal(converted.get('BRL').toBuy,100);
assert.equal(converted.get('EUR').planned,40);
assert.equal(converted.get('EUR').paid,16);
assert.equal(converted.get('EUR').toBuy,20);
assert.equal(totals.get('EUR').planned,20);
assert.equal(context.budgetDisplayTotals(totals,0).get('EUR').planned,null);
assert.equal(context.budgetDisplayTotals(totals,NaN).get('BRL').paid,null);
console.log('PASS mixed currencies, unpaid status, conversion and missing rate');
