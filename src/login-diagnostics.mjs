// Temporary, local-only diagnostics. Never retain URLs, headers, credentials,
// response bodies, exception text, identifiers or user-agent strings.
export function createLoginDiagnostics({authUrl, apiRoots, render, standalone=false, online=true}) {
  const auth = new URL(authUrl);
  const apis = Object.values(apiRoots).map(value=>new URL(value));
  let active=false, events=[], pending=[];
  const note=(label)=>{if(active && events.length<30)events.push(label)};
  function route(input) {
    try {
      const url=new URL(typeof input==='string' || input instanceof URL ? input : input.url);
      if(url.origin===auth.origin && url.pathname.startsWith(auth.pathname+'/')) {
        const path=url.pathname.slice(auth.pathname.length);
        return ({'/sign-in/email':'senha','/get-session':'sessao','/token':'jwt'})[path]||null;
      }
      if(apis.some(api=>url.origin===api.origin && url.pathname.startsWith(api.pathname+'/'))) {
        if(url.pathname.endsWith('/rpc/project_context'))return 'projeto';
        if(url.pathname.endsWith('/passenger_profiles'))return 'perfil';
      }
    }catch{/* Unrelated or unsupported request. */}
    return null;
  }
  return {
    start(){events=[];pending=[];active=true;render('')},
    note,
    wrapFetch(fetchImpl){return async function(input,init){
      const label=active?route(input):null;
      try {
        const response=await fetchImpl(input,init);
        if(label){
          note(label+': HTTP '+response.status);
          if(label==='sessao' && response.ok) {
            // Inspect only presence, never stringify or retain response data.
            pending.push(response.clone().json().then(data=>{
              note('sessao: '+(data?.session && data?.user?'presente':'ausente'));
            }).catch(()=>note('sessao: resposta nao JSON')));
          }
        }
        return response;
      }catch(error){if(label)note(label+': falha de rede/CORS');throw error}
    }},
    async finish(failed){
      await Promise.allSettled(pending);
      const report=['VIAGGIO DIAG D2',standalone?'modo: PWA':'modo: navegador',online?'rede: online':'rede: offline',...events].join('\n');
      active=false;
      if(failed)render(report);
    }
  };
}
