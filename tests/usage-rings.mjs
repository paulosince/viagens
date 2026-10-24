import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {usageRingsModel,applyUsageRing} from '../experiments/neon-pilot/app/usage-rings.mjs';

const proportion=usageRingsModel({database_bytes:250,storage_bytes:750});
assert.equal(proportion.mode,'composition');
assert.equal(proportion.databasePercent,25);
assert.equal(proportion.filesPercent,75);
assert.equal(proportion.total,1000);
assert.equal(proportion.databaseLimit,null,'Do not invent an individual quota');

const quota=usageRingsModel({
 database_bytes:200,storage_bytes:750,database_quota_bytes:1000,storage_quota_bytes:1500
});
assert.equal(quota.mode,'quota');
assert.equal(quota.databasePercent,20);
assert.equal(quota.filesPercent,50);

const zero=usageRingsModel({database_bytes:0,storage_bytes:0});
assert.equal(zero.databasePercent,0);
assert.equal(zero.filesPercent,0);
assert.equal(usageRingsModel({database_bytes:0,storage_bytes:null}),null);

const circle={
 style:{},
 getAttribute(name){assert.equal(name,'r');return '44';}
};
applyUsageRing(circle,75);
const circumference=2*Math.PI*44;
assert.ok(Math.abs(Number(circle.style.strokeDashoffset)-circumference/4)<1e-8);
assert.equal(circle.style.opacity,'1');
applyUsageRing(circle,0);
assert.equal(circle.style.opacity,'0');
applyUsageRing(circle,120);
assert.equal(Number(circle.style.strokeDashoffset),0,'Full ring clamps to 100%');

for(const path of ['index.html','experiments/neon-pilot/app/neon-editable.html']){
 const html=readFileSync(path,'utf8');
 assert.equal((html.match(/data-usage-ring="database"/g)||[]).length,2,path+' must have compact and expanded database rings');
 assert.equal((html.match(/data-usage-ring="files"/g)||[]).length,2,path+' must have compact and expanded file rings');
 for(const id of ['home_database_usage','home_storage_usage','home_database_detail','home_storage_detail',
  'home_images_detail','home_attachments_detail','home_usage_total','home_usage_note']){
  assert.ok(html.includes('id="'+id+'"'),path+' missing '+id);
 }
}
const js=readFileSync('experiments/neon-pilot/app/main-neon.js','utf8');
assert.ok(js.includes("client.rpc('viaggio_my_usage')"),'Usage must come from the existing Neon RPC');
assert.ok(js.includes('usageRingsModel(data)'),'Render must use real usage data');
assert.ok(js.includes("applyUsageRing(el, rings?.databasePercent ?? 0)"));
assert.ok(js.includes("applyUsageRing(el, rings?.filesPercent ?? 0)"));
const css=readFileSync('style.css','utf8');
assert.ok(css.includes('.home-quota-rings--small')&&css.includes('.home-quota-rings--large'));
console.log('PASS: concentric quota rings use measured Bank/Files and do not invent individual limits');
