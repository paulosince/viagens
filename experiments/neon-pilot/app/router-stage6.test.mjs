import test from 'node:test';
import assert from 'node:assert/strict';
import {createRouter} from './router-neon.mjs';

const TRIP='trip-A', USER='user-guest';
const err=(msg)=>new Error(msg);
function fixture({home='b',visible='a',member=true,authorized=true,claim=[0,0],owners=[[],[]],profile=[],errorProject=null}={}){
 const calls=[], projects=[];
 for(const id of ['a','b']){
  const client={
   async rpc(name,args={}){
    calls.push({project:id,action:'rpc',name,args});
    if(errorProject===id && name==='claim_trip_invitations')return {data:null,error:err('DENIED_'+id)};
    if(name==='project_context')return {data:{is_home:id===home},error:null};
    if(name==='claim_trip_invitations')return {data:claim[id==='a'?0:1],error:null};
    if(name==='shared_trip_owners')return {data:owners[id==='a'?0:1],error:null};
    if(name==='invite_trip_by_email'){
      if(!authorized)return {data:null,error:err('only owner')};
      return {data:'pending',error:null};
    }
    if(name==='remove_trip_share'){
      if(!authorized)return {data:null,error:err('only owner')};
      return {data:null,error:null};
    }
    if(name==='list_trip_shares'){
      if(!authorized)return {data:null,error:err('only owner')};
      return {data:[{email:'friend@example.test',pending:true,role:'viewer'}],error:null};
    }
    return {data:[],error:null};
   },
   from(table){
    let op='read',column='',value='';
    const query={
     select(){return query},eq(c,v){column=c;value=v;return query},
     in(c,v){column=c;value=v;return query},
     is(){return query},order(){return query},limit(){return query},
     single(){return query},maybeSingle(){return query},
     insert(row){op='insert';return query},update(){op='update';return query},delete(){op='delete';return query},
     upsert(){op='upsert';return query},
     then(resolve,reject){
       calls.push({project:id,action:'from',table,op,column,value});
       const canSee=visible===id && member;
       const rows=table==='trips'?canSee?[{id:TRIP}]:[]
        :table==='passenger_profiles'&&id===home?profile:[];
       let output={data:rows,error:null};
       if(op!=='read'&&!authorized)output={data:null,error:err('RLS denied')};
       return Promise.resolve(output).then(resolve,reject);
     }
    };
    return query;
   }
  };
  projects.push({id,client});
 }
 const router=createRouter({projects,auth:{},functions:{},storage:{}});
 return {router,calls};
}
test('known trip invite is routed ONLY to owning project',async()=>{
 const f=fixture();const r=await f.router.rpc('invite_trip_by_email',{p_trip_id:TRIP,p_email:'friend@example.test',p_role:'viewer'});
 assert.equal(r.error,null);assert.equal(r.data,'pending');
 assert.deepEqual(f.calls.filter(x=>x.name==='invite_trip_by_email').map(x=>x.project),['a']);
});
test('existing trip share listing is routed only to trip A',async()=>{
 const f=fixture();const r=await f.router.rpc('list_trip_shares',{p_trip_id:TRIP});
 assert.equal(r.error,null);assert.equal(r.data[0].pending,true);
 assert.deepEqual(f.calls.filter(x=>x.name==='list_trip_shares').map(x=>x.project),['a']);
});
test('revocation never touches a second project',async()=>{
 const f=fixture();const r=await f.router.rpc('remove_trip_share',{p_trip_id:TRIP,p_email:'friend@example.test'});
 assert.equal(r.error,null);
 assert.deepEqual(f.calls.filter(x=>x.name==='remove_trip_share').map(x=>x.project),['a']);
});
test('unknown trip rejects invitation without executing write RPC',async()=>{
 const f=fixture({member:false});const r=await f.router.rpc('invite_trip_by_email',{p_trip_id:TRIP,p_email:'friend@example.test',p_role:'viewer'});
 assert.ok(r.error);assert.equal(f.calls.filter(x=>x.name==='invite_trip_by_email').length,0);
});
test('guest cannot revoke or invite; database rejection propagates',async()=>{
 const f=fixture({authorized:false});
 const invite=await f.router.rpc('invite_trip_by_email',{p_trip_id:TRIP,p_email:'friend@example.test',p_role:'editor'});
 const remove=await f.router.rpc('remove_trip_share',{p_trip_id:TRIP,p_email:'friend@example.test'});
 assert.match(invite.error.message,/owner/);assert.match(remove.error.message,/owner/);
});
test('after membership revocation, lost visibility prevents further routing',async()=>{
 const f=fixture({member:false});
 const r=await f.router.rpc('remove_trip_share',{p_trip_id:TRIP,p_email:'friend@example.test'});
 assert.ok(r.error);assert.equal(f.calls.filter(x=>x.name==='remove_trip_share').length,0);
});
test('two project claim counts are summed as integers, not treated as arrays',async()=>{
 const f=fixture({claim:[1,2]});const r=await f.router.rpc('claim_trip_invitations');
 assert.equal(r.error,null);assert.equal(r.data,3);
 assert.deepEqual(f.calls.filter(x=>x.name==='claim_trip_invitations').map(x=>x.project),['a','b']);
});
test('zero invitations returns numeric zero (not empty list)',async()=>{
 const f=fixture();const r=await f.router.rpc('claim_trip_invitations');assert.equal(r.data,0);
});
test('one project claim failure never reports global success',async()=>{
 const f=fixture({errorProject:'b'});const r=await f.router.rpc('claim_trip_invitations');
 assert.ok(r.error);assert.match(r.error.message,/DENIED_b/);
});
test('invalid cross-project claim result fails closed',async()=>{
 for(const value of [null,-1,'1',1.5]){
   const f=fixture({claim:[value,0]});
   const r=await f.router.rpc('claim_trip_invitations');
   assert.ok(r.error,'value '+String(value));
 }
});
test('shared owner lists merge only valid arrays',async()=>{
 const f=fixture({owners:[[{trip_id:'a',owner_name:'A'}],[{trip_id:'b',owner_name:'B'}]]});
 const r=await f.router.rpc('shared_trip_owners');assert.deepEqual(r.data.map(x=>x.trip_id),['a','b']);
});
test('invalid owner metadata result is not silently ignored',async()=>{
 const f=fixture({owners:[null,[]]});
 const r=await f.router.rpc('shared_trip_owners');assert.ok(r.error);
});
test('personal passenger profile always routes to home B',async()=>{
 const f=fixture({home:'b',profile:[{user_id:USER}]});
 const result=await f.router.from('passenger_profiles').select('*').limit(1);
 assert.equal(result.error,null);assert.equal(result.data.length,1);
 assert.deepEqual(f.calls.filter(x=>x.action==='from'&&x.table==='passenger_profiles').map(x=>x.project),['b']);
});
test('trip membership creation targets same home of existing trip only',async()=>{
 const f=fixture();const result=await f.router.from('trip_members').insert({trip_id:TRIP,user_id:USER,role:'viewer'});
 assert.equal(result.error,null);
 assert.deepEqual(f.calls.filter(x=>x.action==='from'&&x.table==='trip_members'&&x.op==='insert').map(x=>x.project),['a']);
});
test('failed RLS write is not treated as success',async()=>{
 const f=fixture({authorized:false});const result=await f.router.from('trip_members').insert({trip_id:TRIP,user_id:USER,role:'viewer'});
 assert.match(result.error.message,/RLS denied/);
});
