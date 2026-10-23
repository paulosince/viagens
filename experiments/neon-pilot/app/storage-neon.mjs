// Viaggio Neon-only media adapter (Stage 07/14).
// Authorization is ALWAYS enforced again by the Neon Function. Routing is not
// permission. Never retry another person's project after a 401/403/404.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED=new Set(['trip-images','profile-photos','day-attachments']);
const safeError=message=>Object.assign(new Error(message),{code:'VIAGGIO_NEON_MEDIA'});
function validate(bucket,path){
  if(!ALLOWED.has(bucket))throw safeError('Categoria de arquivo não reconhecida.');
  if(typeof path!=='string'||path.length>900||path.startsWith('/')||path.includes('\\')
    ||path.split('/').some(x=>!x||x==='.'||x==='..')||/[\x00-\x1f\x7f?#]/.test(path))
    throw safeError('Caminho de arquivo inválido.');
  const prefix=path.split('/')[0];
  if(!UUID.test(prefix))throw safeError('Arquivo sem vínculo válido.');
  return prefix;
}
async function unwrap(r,route){
  if(!r.ok) {
    const message=r.status===401?'Sessão Neon expirada ou inválida. Entre novamente.'
      :r.status===403?'Você não tem permissão para acessar este arquivo.'
      :r.status===404?'Arquivo não encontrado neste projeto.'
      :'Serviço privado de arquivos indisponível ('+r.status+').';
    throw safeError(message);
  }
  if(route==='download'){
    const blob=await r.blob();
    if(!blob||!blob.size)throw safeError('Arquivo de mídia vazio.');
    return {data:blob,error:null};
  }
  const body=await r.json().catch(()=>null);
  if(!body||typeof body!=='object')throw safeError('Resposta inválida do serviço de arquivos.');
  if(route==='sign'){
    const signedUrl=body.data?.signedUrl||body.signedUrl||body.url;
    if(typeof signedUrl!=='string'||!signedUrl.startsWith('https://'))
      throw safeError('Assinatura de arquivo inválida.');
    return {data:{signedUrl},error:null};
  }
  return {data:body.data??body,error:null};
}
export function createNeonMediaClient({projects,accessToken,fetcher=fetch,allowMutations=false}){
  if(!Array.isArray(projects)||projects.length!==2||typeof accessToken!=='function'||typeof fetcher!=='function')
    throw safeError('Serviço de arquivos não configurado.');
  async function home(){
    const contexts=await Promise.all(projects.map(async p=>{
      const res=await p.client.rpc('project_context');
      if(res.error)throw res.error;
      return res.data?.is_home?p:null;
    }));
    const matches=contexts.filter(Boolean);
    if(matches.length!==1)throw safeError('Projeto pessoal não identificado.');
    return matches[0];
  }
  async function locateTrip(tripId){
    const matches=await Promise.all(projects.map(async p=>{
      const r=await p.client.from('trips').select('id').eq('id',tripId).limit(1);
      if(r.error)throw r.error;
      return Array.isArray(r.data)&&r.data.length===1?p:null;
    }));
    const found=matches.filter(Boolean);
    if(found.length!==1)throw safeError('Viagem inexistente ou acesso não autorizado.');
    return found[0];
  }
  async function destination(bucket,path){
    const ownerOrTrip=validate(bucket,path);
    if(bucket!=='profile-photos')return locateTrip(ownerOrTrip);
    const personal=await home();
    const profile=await personal.client.from('passenger_profiles').select('user_id').limit(2);
    if(profile.error)throw profile.error;
    if(profile.data?.length!==1)throw safeError('Perfil pessoal indisponível.');
    if(profile.data[0].user_id===ownerOrTrip)return personal;
    // Shared trip owner's avatar: only a validated shared_trip_owners RPC
    // result can nominate that foreign project. Never guess or blind fallback.
    const visibleOwners=await Promise.all(projects.map(async p=>{
      const r=await p.client.rpc('shared_trip_owners');
      if(r.error)throw r.error;
      return Array.isArray(r.data)&&r.data.some(o=>o.avatar_path===path)?p:null;
    }));
    const matches=visibleOwners.filter(Boolean);
    if(matches.length!==1)throw safeError('Foto de perfil não compartilhada com esta conta.');
    return matches[0];
  }
  async function request(p,route,bucket,path,{body,headers={},expires}={}){
    const jwt=await accessToken();
    if(typeof jwt!=='string'||jwt.split('.').length!==3)
      throw safeError('Sessão Neon sem token JWT. Entre na sua conta.');
    if(!p.media||!/^https:\/\/[^/]+\/$/.test(p.media))
      throw safeError('Destino de mídia do Neon inválido.');
    const endpoint=(route==='upload'||route==='remove')?p.mediaWrite:p.media;
    if(!endpoint||!/^https:\/\/[^/]+\/$/.test(endpoint))
      throw safeError('Destino de escrita de mídia não configurado.');
    const u=new URL(route,endpoint);
    u.searchParams.set('bucket',bucket);
    if(path)u.searchParams.set('path',path);
    if(expires!==undefined)u.searchParams.set('expires',String(expires));
    // Redirect errors prevent the Bearer token from being replayed to another host.
    return fetcher(u.toString(),{
      method:body===undefined?'GET':'POST',body,
      headers:{Authorization:'Bearer '+jwt,...headers},
      mode:'cors',credentials:'omit',redirect:'error',
      cache:'no-store',referrerPolicy:'no-referrer',
      signal:AbortSignal.timeout(45000)
    });
  }
  async function read(bucket,path,route,expires){
    try{
      validate(bucket,path);
      if(route==='sign'&&(!Number.isInteger(expires)||expires<1||expires>3600))
        throw safeError('Validade de link privado inválida.');
      const project=await destination(bucket,path);
      return await unwrap(await request(project,route,bucket,path,{expires}),route);
    }catch(error){return {data:null,error};}
  }
  return {from(bucket){
    return {
      download:path=>read(bucket,path,'download'),
      createSignedUrl:(path,expires)=>read(bucket,path,'sign',expires),
      async upload(path,file,options={}){
        try{
          if(!allowMutations)throw safeError('Upload aguardando a validação final da etapa 7.');
          validate(bucket,path);
          if(!(file instanceof Blob)||file.size<=0)throw safeError('Arquivo vazio ou inválido.');
          const project=await destination(bucket,path);
          const response=await request(project,'upload',bucket,path,{
            body:file,headers:{
              'Content-Type':options.contentType||file.type||'application/octet-stream',
              'x-upsert':String(options.upsert===true)
            }
          });
          return await unwrap(response,'upload');
        }catch(error){return {data:null,error};}
      },
      async remove(paths){
        try{
          if(!allowMutations)throw safeError('Exclusão aguardando a validação final da etapa 7.');
          if(!Array.isArray(paths)||!paths.length||paths.length>25)
            throw safeError('Lista de arquivos inválida.');
          paths.forEach(path=>validate(bucket,path));
          const owners=await Promise.all(paths.map(path=>destination(bucket,path)));
          if(new Set(owners.map(p=>p.id)).size!==1)
            throw safeError('Exclusão entre projetos diferentes bloqueada.');
          const result=await request(owners[0],'remove',bucket,null,{
            body:JSON.stringify({paths}),
            headers:{'Content-Type':'application/json'}
          });
          return await unwrap(result,'remove');
        }catch(error){return {data:null,error};}
      }
    };
  }};
}
