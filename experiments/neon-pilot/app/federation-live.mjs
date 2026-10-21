// Step 04/14: browser-only, read-only, real signed JWT federation smoke.
// Only the Neon Data APIs validate the JWT signature; no credential is logged,
// persisted, or sent to GitHub, ChatGPT, or any non-Neon endpoint.
export const ENDPOINTS=Object.freeze({
  a:'https://ep-empty-pine-b8r7sa8d.apirest.c-14.us-east-1.aws.neon.tech/viaggio_lab/rest/v1',
  b:'https://ep-spring-moon-b8fi6yxc.apirest.c-14.us-east-1.aws.neon.tech/viaggio_lab/rest/v1'
});
const JWT=/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const fail=(message)=>{throw new Error(message);};
function endpoint(url){
  const u=new URL(url);
  if(u.protocol!=='https:'||!u.pathname.endsWith('/rest/v1')||u.username||u.password||u.search||u.hash)
    fail('ENDPOINT_INVALID');
  return u.href.replace(/\/$/,'');
}
function opts(token,method='GET'){
  return {
    method,cache:'no-store',redirect:'error',mode:'cors',
    referrerPolicy:'no-referrer',
    headers:{
      Accept:'application/json','Accept-Profile':'viaggio_app',
      'Content-Profile':'viaggio_app',
      ...(token?{Authorization:'Bearer '+token}:{}),
      ...(method==='POST'?{'Content-Type':'application/json'}:{})
    },
    ...(method==='POST'?{body:'{}'}:{})
  };
}
async function response(fetcher,base,path,token,method='GET'){
  const http=await fetcher(base+path,opts(token,method));
  const payload=await http.json().catch(()=>null);
  return {status:http.status,ok:http.ok,payload};
}
function count(result,name){
  if(!result.ok||!Array.isArray(result.payload))
    fail(name+'_QUERY_FAILED_HTTP_'+result.status);
  return result.payload.length;
}
function context(result,name){
  if(!result.ok||typeof result.payload?.is_home!=='boolean')
    fail(name+'_CONTEXT_FAILED_HTTP_'+result.status);
  return result.payload.is_home;
}
export async function testSignedFederation({token,fetcher=fetch,endpoints=ENDPOINTS}={}){
  if(typeof token!=='string'||!JWT.test(token))fail('NO_REAL_NEON_JWT');
  const result={passed:false,projects:{},checks:0,persona:null};
  // Server-enforced denial of a forged JWT and an anonymous session.
  for(const [key,url] of Object.entries(endpoints)){
    const base=endpoint(url);
    const bad=await response(fetcher,base,'/trips?select=id&limit=1','eyJhbGciOiJFZERTQSJ9.eyJzdWIiOiJhYWFhYWFhYS1hYWFhLTRhYWEtOGFhYS1hYWFhYWFhYWFhYWFhYWEiLCJyb2xlIjoiYXV0aGVudGljYXRlZCJ9.YWJj');
    if(![400,401,403].includes(bad.status))fail(key+'_FORGED_JWT_NOT_REJECTED');
    result.checks++;
    const anon=await response(fetcher,base,'/trips?select=id&limit=1',null);
    if(anon.ok){
      if(!Array.isArray(anon.payload)||anon.payload.length)fail(key+'_ANONYMOUS_DATA_EXPOSED');
    }else if(![400,401,403].includes(anon.status))fail(key+'_ANONYMOUS_UNEXPECTED_HTTP_'+anon.status);
    result.checks++;
    // Exact same, real signed central Auth JWT is sent independently to both.
    const ctx=await response(fetcher,base,'/rpc/project_context',token,'POST');
    const trips=await response(fetcher,base,'/trips?select=id&limit=20',token);
    const profiles=await response(fetcher,base,'/passenger_profiles?select=id&limit=5',token);
    result.projects[key]={home:context(ctx,key),trips:count(trips,key+'_TRIPS'),profiles:count(profiles,key+'_PROFILES')};
    result.checks+=3;
  }
  const a=result.projects.a,b=result.projects.b;
  if(!a||!b||a.home===b.home)fail('NOT_EXACTLY_ONE_PERSONAL_PROJECT');
  if(a.home){
    result.persona='Titular do projeto A';
    if(a.trips!==4||a.profiles!==1||b.trips!==0||b.profiles!==0)
      fail('OWNER_A_RLS_UNEXPECTED_COUNTS');
  }else{
    result.persona='Titular do projeto B';
    if(a.trips!==1||a.profiles!==0||b.trips!==0||b.profiles!==1)
      fail('OWNER_B_RLS_UNEXPECTED_COUNTS');
  }
  result.checks++;
  result.passed=true;
  return result;
}
