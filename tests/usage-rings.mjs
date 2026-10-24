// The former ring model now supplies quota percentages to horizontal bars.
import assert from 'node:assert/strict';
import {usageRingsModel} from '../experiments/neon-pilot/app/usage-rings.mjs';
assert.equal(usageRingsModel({database_bytes:250,storage_bytes:750}),null,'Missing limits must not be replaced by a misleading composition percentage');
const quota=usageRingsModel({database_bytes:200,storage_bytes:750,database_quota_bytes:1000,storage_quota_bytes:1500});
assert.equal(quota.mode,'quota');assert.equal(quota.databasePercent,20);assert.equal(quota.filesPercent,50);
const zero=usageRingsModel({database_bytes:0,storage_bytes:0,database_quota_bytes:1000,storage_quota_bytes:1500});
assert.equal(zero.databasePercent,0);assert.equal(zero.filesPercent,0);
assert.equal(usageRingsModel({database_bytes:0,storage_bytes:null}),null);
assert.equal(usageRingsModel({database_bytes:1200,storage_bytes:0,database_quota_bytes:1000,storage_quota_bytes:1500}).databasePercent,120,'Do not hide quota excess');
console.log('PASS: independent usage percentages, absent limits, empty storage and excess');
