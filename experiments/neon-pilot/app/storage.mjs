// All file authorization remains on the server. Never fall back to source storage.
export function createMediaClient({projects,accessToken,fetcher=fetch}) {
 const error=message=>Object.assign(new Error(message),{code:'NEON_MEDIA'});
 async function home(){
  const found=await Promise.all(projects.map(async p=>{const r=await p.client.rpc('project_context');if(r.error)throw r.error;return r.data?.is_home?p:null}));
  const matches=found.filter(Boolean);if(matches.length!==1)throw error('Projeto pessoal indisponível.');return matches[0];
 }
 async function destination(bucket,path){
  if(bucket==='profile-photos')return home();
  const id=path.split('/')[0];
  const found=await Promise.all(projects.map(async p=>{const r=await p.client.from('trips').select('id').eq('id',id).limit(1);if(r.error)throw r.error;return r.data?.length?p:null}));
  const matches=found.filter(Boolean);if(matches.length!==1)throw error('Projeto da viagem indisponível.');return matches[0];
 }
 async function request(p,route,bucket,path,{body,headers={},expires}={}) {
  const token=await accessToken();if(!token)throw error('Entre na sua conta para acessar arquivos.');
  const url=new URL(route,p.media);url.searchParams.set('bucket',bucket);
  if(path)url.searchParams.set('path',path);if(expires)url.searchParams.set('expires',expires);
  return fetcher(url,{method:body===undefined?'GET':'POST',body,headers:{authorization:'Bearer '+token,...headers},redirect:'error',signal:AbortSignal.timeout(45000)});
 }
 async function read(bucket,path,route,expires){
  try{
   const primary=await destination(bucket,path);
   // Legacy copies are retained for shared profile references during migration.
   for(const p of [primary,...projects.filter(p=>p!==primary)]){
    const r=await request(p,route,bucket,path,{expires});
    if(r.ok)return route==='download'?{data:await r.blob(),error:null}:{...(await r.json()),error:null};
    if(![403,404].includes(r.status))throw error('Falha no serviço de arquivos ('+r.status+').');
   }
   throw error('Arquivo indisponível ou sem permissão.');
  }catch(e){return {data:null,error:e};}
 }
 return {from(bucket){return {
  download:path=>read(bucket,path,'download'),
  createSignedUrl:(path,expires)=>read(bucket,path,'sign',expires),
  async upload(path,file,options={}){
   try{const p=await destination(bucket,path);const r=await request(p,'upload',bucket,path,{body:file,headers:{'content-type':options.contentType||file.type||'application/octet-stream','x-upsert':String(!!options.upsert)}});const body=await r.json();if(!r.ok)throw error(body.error||'Falha no upload.');return {...body,error:null};}catch(e){return {data:null,error:e};}
  },
  async remove(paths){
   try{if(!Array.isArray(paths)||!paths.length)throw error('Lista de arquivos vazia.');const targets=await Promise.all(paths.map(path=>destination(bucket,path)));if(new Set(targets.map(p=>p.id)).size!==1)throw error('Exclusão entre projetos não permitida.');const r=await request(targets[0],'remove',bucket,null,{body:JSON.stringify({paths}),headers:{'content-type':'application/json'}});const body=await r.json();if(!r.ok)throw error(body.error||'Falha ao excluir.');return {...body,error:null};}catch(e){return {data:null,error:e};}
  }
 }}};
}
