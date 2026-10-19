import {createMediaClient} from './storage.mjs?v=20261019-3';
import {createRouter} from './router.mjs?v=20261019-1';
const roots=[
 ['a','https://ep-floral-sea-b829egtf.apirest.c-14.us-east-1.aws.neon.tech/viaggio_lab'],
 ['b','https://ep-aged-pine-b8pd3upm.apirest.c-14.us-east-1.aws.neon.tech/viaggio_lab']
];
export function createPreviewBackend(createClient,legacy) {
 const accessToken=async()=>{const {data,error}=await legacy.auth.getSession();if(error)throw error;return data.session?.access_token||null;};
 const media={a:'https://br-dawn-bread-b83r0ztn-appmedia.compute.c-14.us-east-1.aws.neon.tech/',b:'https://br-proud-paper-b83l1z7d-appmedia.compute.c-14.us-east-1.aws.neon.tech/'};
 const projects=roots.map(([id,url])=>({id,media:media[id],client:createClient(url,'neon-data-api',{
  accessToken,db:{schema:'viaggio_app'},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
 })}));
 const storage=createMediaClient({projects,accessToken});
 const auth=new Proxy(legacy.auth,{get(target,key){
  if(key==='signUp')return async()=>({data:null,error:new Error('Novos cadastros ainda não estão disponíveis nesta prévia.')});
  const value=target[key];return typeof value==='function'?value.bind(target):value;
 }});
 return createRouter({projects,auth,functions:legacy.functions,storage});
}
