import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createNeonMediaClient} from '../experiments/neon-pilot/app/storage-neon.mjs';
const source=readFileSync(new URL('../experiments/neon-pilot/app/backend-neon.mjs',import.meta.url),'utf8');
const config=name=>new Function('return '+source.match(new RegExp('const '+name+'=Object.freeze\\((\\{[\\s\\S]*?\\})\\);'))[1])();
const media=config('MEDIA'),attachments=media,writes=config('MEDIA_WRITE');
// Branch-to-Data-API associations verified against Neon compute metadata.
const branches={a:'br-silent-band-b80nklzl',b:'br-falling-leaf-b8xuv1d0'};
for(const id of ['a','b']) {
 const trip='11111111-1111-4111-8111-111111111111';
 const calls=[];
 const projects=['a','b'].map(key=>({id:key,media:media[key],attachmentMedia:attachments[key],mediaWrite:writes[key],client:{from(){return {select(){return this},eq(){return this},async limit(){return {data:key===id?[{id:trip}]:[]}}}}}}));
 let status=200;
 const client=createNeonMediaClient({projects,accessToken:async()=>'test.jwt.token',fetcher:async(url,options)=>{calls.push({url:new URL(url),options});return status===200?new Response('image-bytes',{headers:{'content-type':'image/png'}}):Response.json({error:'ACCESS_DENIED'},{status});}});
 const path=trip+'/general/ticket.png';
 const result=await client.from('day-attachments').download(path);
 assert.equal(result.error,null);
 assert.equal(calls[0].url.hostname,branches[id]+'-appmedia.compute.c-14.us-east-1.aws.neon.tech');
 assert.equal(calls[0].url.pathname,'/download');
 assert.equal(calls[0].url.searchParams.get('path'),path);
 assert.equal(calls[0].options.headers.Authorization,'Bearer test.jwt.token');
 assert.equal(calls[0].options.redirect,'error');
 const preview=await client.from('day-attachments').createSignedUrl(path,60);
 assert.match(preview.data.signedUrl,/^blob:/);
 URL.revokeObjectURL(preview.data.signedUrl);
 status=403;
 const before=calls.length;
 assert.ok((await client.from('day-attachments').download(path)).error);
 assert.equal(calls.length,before+1,'Denied downloads must not retry another project');
 status=200;
 await client.from('trip-images').download(path);
 assert.equal(calls.at(-1).url.hostname,branches[id]+'-appmedia.compute.c-14.us-east-1.aws.neon.tech','Itinerary photos must be read from the same branch as the Data API');
}
console.log('Ticket media: both verified branch mappings, JWT, blob preview, denied access and photo routing passed.');
