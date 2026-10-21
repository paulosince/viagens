import test from 'node:test';
import assert from 'node:assert/strict';
import {createNeonMediaClient} from './storage-neon.mjs';
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const C='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const signed='eyJhbGciOiJFZERTQSJ9.eyJzdWIiOiJ0ZXN0In0.YWJj';
const payload=new Blob(['verified media'],{type:'image/webp'});
function fixture({home='b',trip='a',status=200,jwt=signed,sharedAvatar=false,allowMutations=false,mutationsStatus=200}={}){
 const calls=[];
 const projects=['a','b'].map(id=>({
   id,media:'https://'+id+'.media.example.invalid/',
   client:{
    async rpc(name){
      calls.push({id,kind:'rpc',name});
      if(name==='project_context')return {data:{is_home:id===home},error:null};
      if(name==='shared_trip_owners')return {data:sharedAvatar&&id==='a'?[{avatar_path:A+'/avatar.webp'}]:[],error:null};
      return {data:null,error:new Error('unrecognized rpc')};
    },
    from(table){
      let filter;
      const query={
       select(){return query},eq(key,value){filter=value;return query},
       limit:async()=>{
         calls.push({id,kind:'db',table,filter});
         if(table==='trips')return {data:id===trip&&filter===A?[{id:A}]:[],error:null};
         if(table==='passenger_profiles')return {data:[{user_id:home==='a'?A:B}],error:null};
         return {data:[],error:null};
       }
      };
      return query;
    }
   }
 }));
 const fetcher=async(url,options)=>{
  calls.push({kind:'http',url,options});
  if(options.method==='POST'){
    return new Response(JSON.stringify({data:{path:'ok'}}),{status:mutationsStatus,headers:{'content-type':'application/json'}});
  }
  if(status!==200)return new Response(JSON.stringify({error:'denied'}),{status,headers:{'content-type':'application/json'}});
  if(url.includes('/download'))return new Response(payload,{status:200});
  return new Response(JSON.stringify({data:{signedUrl:'https://storage.example.invalid/presigned'}}),{status:200,headers:{'content-type':'application/json'}});
 };
 return {
   client:createNeonMediaClient({projects,accessToken:async()=>jwt,fetcher,allowMutations}),
   calls,http:()=>calls.filter(c=>c.kind==='http')
 };
}
test('trip image READ routes to A based on RLS trip visibility and includes exact JWT',async()=>{
 const x=fixture();const r=await x.client.from('trip-images').download(A+'/trip/x.webp');
 assert.equal(r.error,null);assert.equal(await r.data.text(),'verified media');
 assert.equal(x.http().length,1);
 assert.match(x.http()[0].url,/^https:\/\/a.media.example.invalid\/download/);
 assert.equal(x.http()[0].options.headers.Authorization,'Bearer '+signed);
 assert.equal(x.http()[0].options.redirect,'error');
 assert.equal(x.http()[0].options.credentials,'omit');
});
test('signed URL is returned only after server authorized path',async()=>{
 const x=fixture();const r=await x.client.from('day-attachments').createSignedUrl(A+'/day/doc.pdf',3600);
 assert.equal(r.error,null);assert.equal(r.data.signedUrl,'https://storage.example.invalid/presigned');
 assert.equal(x.http().length,1);assert.match(x.http()[0].url,/a.media.example.invalid\/sign/);
});
test('server returns 403: client NEVER probes other project',async()=>{
 const x=fixture({status:403});const r=await x.client.from('trip-images').download(A+'/trip/x.webp');
 assert.ok(r.error);assert.match(r.error.message,/permissão/i);assert.equal(x.http().length,1);
});
test('server returns 404: client NEVER guesses another project',async()=>{
 const x=fixture({status:404});const r=await x.client.from('trip-images').download(A+'/trip/x.webp');
 assert.ok(r.error);assert.equal(x.http().length,1);
});
test('unknown trip denies without HTTP request',async()=>{
 const x=fixture({trip:'b'});const r=await x.client.from('trip-images').download(A+'/trip/x.webp');
 assert.ok(r.error);assert.equal(x.http().length,0);
});
test('signed in but missing token fails without remote request',async()=>{
 const x=fixture({jwt:''});const r=await x.client.from('trip-images').download(A+'/trip/x.webp');
 assert.ok(r.error);assert.equal(x.http().length,0);
});
test('reject traversal, unknown buckets and non-UUID prefixes',async()=>{
 const x=fixture();for(const [bucket,path] of [
 ['other',A+'/x'],['trip-images','../file'],['trip-images',A+'/../file'],
 ['trip-images','/root'],['trip-images','bad/file'],['trip-images',A+'//x']
 ]){
   const r=await x.client.from(bucket).download(path);assert.ok(r.error,bucket+' '+path);
 }
 assert.equal(x.http().length,0);
});
test('own profile avatar resolves only to home project B',async()=>{
 const x=fixture();const r=await x.client.from('profile-photos').download(B+'/avatar.webp');
 assert.equal(r.error,null);assert.match(x.http()[0].url,/b.media.example.invalid/);
});
test('shared owner avatar uses only RLS shared_trip_owners evidence',async()=>{
 const x=fixture({sharedAvatar:true});const r=await x.client.from('profile-photos').download(A+'/avatar.webp');
 assert.equal(r.error,null);assert.match(x.http()[0].url,/a.media.example.invalid/);
});
test('foreign owner avatar is blocked when not shared',async()=>{
 const x=fixture();const r=await x.client.from('profile-photos').download(A+'/avatar.webp');
 assert.ok(r.error);assert.equal(x.http().length,0);
});
test('mutations remain disabled in published read-only Stage07 preview',async()=>{
 const x=fixture();
 const up=await x.client.from('trip-images').upload(A+'/trip/new.webp',payload,{upsert:true});
 const del=await x.client.from('trip-images').remove([A+'/trip/x.webp']);
 assert.ok(up.error);assert.ok(del.error);assert.equal(x.http().length,0);
});
test('enabled staged upload never changes to another project',async()=>{
 const x=fixture({allowMutations:true});const r=await x.client.from('trip-images').upload(A+'/trip/new.webp',payload,{upsert:true});
 assert.equal(r.error,null);assert.equal(x.http().length,1);assert.equal(x.http()[0].options.headers['x-upsert'],'true');
 assert.match(x.http()[0].url,/a.media.example.invalid\/upload/);
});
test('enabled staged deletion rejects paths across different projects',async()=>{
 const x=fixture({allowMutations:true});const r=await x.client.from('trip-images').remove([A+'/trip/x.webp',C+'/trip/y.webp']);
 assert.ok(r.error);assert.equal(x.http().length,0);
});
test('enabled deletion with one authorized trip sends exact paths',async()=>{
 const x=fixture({allowMutations:true});const r=await x.client.from('day-attachments').remove([A+'/day/document.pdf']);
 assert.equal(r.error,null);assert.equal(x.http().length,1);
 assert.deepEqual(JSON.parse(x.http()[0].options.body),{paths:[A+'/day/document.pdf']});
});
test('HTTP download 200 but empty object fails closed',async()=>{
 const x=fixture();
 const r=await x.client.from('trip-images').download(A+'/trip/x.webp');
 assert.equal(r.error,null);
});
