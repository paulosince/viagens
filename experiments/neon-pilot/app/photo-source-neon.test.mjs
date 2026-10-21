import test from 'node:test';
import assert from 'node:assert/strict';
import {activityPhotoForPreview} from './photo-source-neon.mjs';
const tram='https://images.unsplash.com/photo-1585208798174-6cedd86e019a';
test('never substitute shared Unsplash image for an unavailable managed photo',()=>{
 assert.equal(activityPhotoForPreview({photo_path:'trip/activity/hotel.png',photo_url:null},{photo_url:tram}),'');
});
test('use verified private photo URL when it is hydrated',()=>{
 assert.equal(activityPhotoForPreview({photo_path:'trip/activity/hotel.png',photo_url:'blob:hotel'},{photo_url:tram}),'blob:hotel');
});
test('public fallback remains available for an activity with no managed media',()=>{
 assert.equal(activityPhotoForPreview({photo_path:null,photo_url:null},{photo_url:tram}),tram);
});
test('activity public photo takes precedence when no private managed path exists',()=>{
 assert.equal(activityPhotoForPreview({photo_url:'https://images.example/hotel.jpg'},{photo_url:tram}),'https://images.example/hotel.jpg');
});
