// Migration 5/14 — Neon Auth, legacy-data identity translation.
// No Supabase Auth URL, user passwords or application JWTs are stored here.
// The central Neon Auth account UUID is DIFFERENT from the legacy UUID in
// viaggio_app tables. Translate ONLY from a JWT-authorized home profile.
const noAccess = msg=>Object.assign(new Error(msg),{code:'VIAGGIO_NEON_IDENTITY'});
function normalizeSession(r) {
  if(r?.error)throw r.error;
  const session=r?.data?.session||null;
  if(!session)return null;
  const user=session.user||r?.data?.user;
  if(!user?.id||!user?.email)throw noAccess('Sessão Neon incompleta.');
  return {session,user};
}
export function createNeonIdentity({sdkAuth,projects}) {
  if(!sdkAuth||typeof sdkAuth.getSession!=='function'||typeof sdkAuth.signInWithPassword!=='function'
    ||typeof sdkAuth.signOut!=='function'||!Array.isArray(projects)||projects.length!==2)
    throw noAccess('Autenticação não configurada.');
  let lastNeonSubject=null,lastLegacyUser=null;
  const observers=new Set();
  let busyIdentity=null;
  async function token(){
    const current=normalizeSession(await sdkAuth.getSession());
    if(!current)return null;
    const jwt=current.session.access_token;
    if(typeof jwt!=='string'||jwt.split('.').length!==3)
      throw noAccess('Neon Auth não forneceu JWT de acesso à Data API.');
    return jwt;
  }
  async function identify() {
    if(busyIdentity)return busyIdentity;
    busyIdentity=(async()=>{
      const current=normalizeSession(await sdkAuth.getSession());
      if(!current){lastNeonSubject=null;lastLegacyUser=null;return null;}
      // Request JWT first: the project's Data API enforces signature and RLS.
      await token();
      if(current.user.id===lastNeonSubject&&lastLegacyUser)
        return {user:lastLegacyUser,session:{...current.session,user:lastLegacyUser}};
      const projectHomes=await Promise.all(projects.map(async p=>{
        const ctx=await p.client.rpc('project_context');
        if(ctx.error)throw ctx.error;
        return ctx.data?.is_home ? p : null;
      }));
      const homes=projectHomes.filter(Boolean);
      if(homes.length!==1)throw noAccess('Projeto pessoal Neon não identificado.');
      const profile=await homes[0].client.from('passenger_profiles').select('user_id,name').limit(2);
      if(profile.error)throw profile.error;
      if(profile.data?.length!==1 || !profile.data[0]?.user_id)
        throw noAccess('Vínculo de identidade ainda não confirmado.');
      const user={...current.user,id:profile.data[0].user_id,
        neon_subject:current.user.id,
        user_metadata:{...(current.user.user_metadata||{}),name:profile.data[0].name||current.user.name||current.user.email?.split('@')[0]}};
      lastNeonSubject=current.user.id;lastLegacyUser=user;
      return {user,session:{...current.session,user}};
    })().finally(()=>{busyIdentity=null;});
    return busyIdentity;
  }
  async function normalized() {
    try {
      const identity=await identify();
      return {data:{session:identity?.session||null,user:identity?.user||null},error:null};
    }catch(error){return {data:{session:null,user:null},error};}
  }
  function notify(kind,session) {
    for(const callback of observers)try{callback(kind,session)}catch{/* consumer error */}
  }
  async function signInWithPassword({email,password}) {
    const reply=await sdkAuth.signInWithPassword({email,password});
    if(reply.error)return reply;
    lastNeonSubject=null;lastLegacyUser=null;
    const result=await normalized();
    if(result.error)return result;
    if(!result.data.session)return {data:null,error:noAccess('A conta Neon não criou sessão.')};
    notify('SIGNED_IN',result.data.session);
    return {data:result.data,error:null};
  }
  async function signOut() {
    const result=await sdkAuth.signOut();
    if(result.error)return result;
    lastNeonSubject=null;lastLegacyUser=null;
    notify('SIGNED_OUT',null);
    return {error:null};
  }
  return {
    accessToken:token,
    auth:{
      getSession:normalized,
      async getUser(){const r=await normalized();return {data:{user:r.data?.user||null},error:r.error};},
      signInWithPassword,
      signOut,
      async signUp(){return {data:null,error:noAccess('Novos cadastros desabilitados na prévia Neon.')};},
      onAuthStateChange(callback) {
        observers.add(callback);
        return {data:{subscription:{unsubscribe:()=>observers.delete(callback)}},error:null};
      }
    }
  };
}
