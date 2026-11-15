// Probe core, isolated from network and database drivers.
export async function runStorageProbe({id,image,reserve,put,head,get,commit,remove,absent,reclaim,budget}) {
 let key=null,verified=false,error=null;
 try {
  key=await reserve(id,image.length);
  if(typeof key!=='string'||!/^uploads\/[0-9a-f-]{36}$/.test(key))throw Error('INVALID_RESERVED_KEY');
  await put(key,image);
  const size=await head(key);
  if(!Number.isSafeInteger(size)||size!==image.length)throw Error('PHYSICAL_SIZE_MISMATCH');
  const content=await get(key);
  if(!Buffer.from(content).equals(image))throw Error('PHYSICAL_CONTENT_MISMATCH');
  await commit(id,size);verified=true;
 } catch(e){error=e}
 if(key){
  try{
   await remove(key);
   if(!await absent(key))throw Error('DELETE_NOT_VERIFIED');
   await reclaim(id);
  } catch {return {ok:false,error:'RECONCILIATION_REQUIRED'}}
 }
 if(!verified||error) return {ok:false,error:error?.message==='STORAGE_QUOTA_EXCEEDED'?'STORAGE_QUOTA_EXCEEDED':'TRANSFER_FAILED'};
 return {ok:true,bytes:image.length,checks:['RESERVE','PUT','HEAD','GET','CONTENT_MATCH','COMMIT','DELETE','HEAD_404','RECLAIM'],budget:await budget()};
}
