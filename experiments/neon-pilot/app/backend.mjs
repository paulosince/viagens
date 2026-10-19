import {createRouter} from './router.mjs?v=20261019-1';
const roots=[
 ['a','https://ep-floral-sea-b829egtf.apirest.c-14.us-east-1.aws.neon.tech/viaggio_lab'],
 ['b','https://ep-aged-pine-b8pd3upm.apirest.c-14.us-east-1.aws.neon.tech/viaggio_lab']
];
export function createPreviewBackend(createClient,legacy) {
 const accessToken=async()=>{const {data,error}=await legacy.auth.getSession();if(error)throw error;return data.session?.access_token||null;};
 const projects=roots.map(([id,url])=>({id,client:createClient(url,'neon-data-api',{
  accessToken,db:{schema:'viaggio_app'},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
 })}));
 const unavailable=async()=>({data:null,error:new Error('Uploads e exclusão de arquivos ainda não estão liberados nesta prévia.')});
 // Temporary bridge: existing media is read from the source. No source mutations.
 const storage={from(bucket){const source=legacy.storage.from(bucket);return {
  download:source.download.bind(source),createSignedUrl:source.createSignedUrl.bind(source),
  upload:unavailable,remove:unavailable
 }}};
 const auth=new Proxy(legacy.auth,{get(target,key){
  if(key==='signUp')return async()=>({data:null,error:new Error('Novos cadastros ainda não estão disponíveis nesta prévia.')});
  const value=target[key];return typeof value==='function'?value.bind(target):value;
 }});
 return createRouter({projects,auth,functions:legacy.functions,storage});
}
