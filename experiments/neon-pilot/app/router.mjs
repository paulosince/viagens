// Routing is a convenience, never authorization: each project's RLS checks the JWT.
const PERSONAL = new Set(['passenger_profiles', 'saved_passengers']);
const METHODS = new Set(['select','insert','update','upsert','delete','eq','in','is','order','limit','single','maybeSingle']);
const MUTATIONS = new Set(['insert','update','upsert','delete']);
const fail = message => { throw Object.assign(new Error(message), {code:'NEON_ROUTING'}); };
export function createRouter({projects, auth, functions, storage}) {
  async function home() {
    const results = await Promise.all(projects.map(async p => {
      const r = await p.client.rpc('project_context');
      if (r.error) throw r.error;
      return r.data?.is_home ? p : null;
    }));
    const found = results.filter(Boolean);
    if (found.length !== 1) fail('Projeto pessoal não identificado. Nenhuma alteração enviada.');
    return found[0];
  }
  async function locate(table, column, value) {
    const found = await Promise.all(projects.map(async p => {
      const r = await p.client.from(table).select(column).eq(column,value).limit(1);
      if (r.error) throw r.error;
      return r.data?.length ? p : null;
    }));
    const matches=found.filter(Boolean);
    if(matches.length!==1)fail('Destino ausente ou ambíguo. Atualize a viagem antes de salvar.');
    return matches[0];
  }
  async function target(table, calls) {
    if(PERSONAL.has(table))return home();
    const mutation=calls.find(([m])=>MUTATIONS.has(m));
    if(table==='trips' && mutation?.[0]==='insert')return home();
    const body=['insert','upsert'].includes(mutation?.[0]) ? mutation[1][0] : null;
    const rows=body ? (Array.isArray(body)?body:[body]) : [];
    const refs=[];
    for(const row of rows) {
      if(row.trip_id)refs.push(['trips','id',row.trip_id]);
      else if(row.day_id)refs.push(['trip_days','id',row.day_id]);
      else if(row.id)refs.push([table,'id',row.id]);
      else fail('Registro sem referência de viagem.');
    }
    for(const [method,args] of calls) {
      if(!['eq','in'].includes(method))continue;
      const [column,value]=args;
      const parent=column==='trip_id'?'trips':column==='day_id'?'trip_days':column==='id'?table:null;
      if(parent)for(const id of method==='in'?value:[value])refs.push([parent,'id',id]);
    }
    if(!refs.length)fail('Gravação sem destino explícito bloqueada.');
    const resolved=await Promise.all(refs.map(ref=>locate(...ref)));
    if(new Set(resolved.map(p=>p.id)).size!==1)fail('Uma gravação não pode abranger projetos diferentes.');
    return resolved[0];
  }
  function replay(project,table,calls,{reading=false}={}) {
    let q=project.client.from(table);
    for(const [method,args] of calls) {
      if(reading && ['single','maybeSingle','limit'].includes(method))continue;
      q=q[method](...args);
    }
    return q;
  }
  async function execute(table,calls) {
    try {
      const writing=calls.some(([m])=>MUTATIONS.has(m));
      if(writing)return await replay(await target(table,calls),table,calls);
      const selected=PERSONAL.has(table)?[await home()]:projects;
      const results=await Promise.all(selected.map(p=>replay(p,table,calls,{reading:true})));
      const bad=results.find(r=>r.error);if(bad)return bad;
      // Never silently accept a possibly truncated project response.
      if(results.some(r=>r.data?.length>=1000))fail('Resultado excede a página segura; paginação necessária.');
      let data=results.flatMap(r=>r.data||[]);
      const orders=calls.filter(([m])=>m==='order');
      data.sort((a,b)=>{for(const [, [key,options={}]] of orders){
        const av=a[key],bv=b[key];if(av===bv)continue;
        const asc=options.ascending!==false;
        if(av==null||bv==null){const first=options.nullsFirst??!asc;return av==null?(first?-1:1):(first?1:-1)}
        return (av<bv?-1:1)*(asc?1:-1);
      }return 0;});
      const limit=calls.find(([m])=>m==='limit');if(limit)data=data.slice(0,limit[1][0]);
      const single=calls.find(([m])=>['single','maybeSingle'].includes(m));
      if(single){if(data.length>1||(!data.length&&single[0]==='single'))fail('Quantidade inesperada de registros.');data=data[0]||null;}
      return {data,error:null};
    }catch(error){return {data:null,error};}
  }
  function from(table){
    const calls=[];let pending;
    const builder=new Proxy({}, {get(_,key){
      if(key==='then')return (yes,no)=>(pending??=execute(table,calls)).then(yes,no);
      if(!METHODS.has(key))throw new Error('Operação não suportada: '+String(key));
      return (...args)=>{if(pending)fail('Consulta já executada.');calls.push([key,args]);return builder;};
    }});return builder;
  }
  async function rpc(name,args={}) {
    try {
      if(args.p_trip_id)return await (await locate('trips','id',args.p_trip_id)).client.rpc(name,args);
      if(name==='restore_trip_snapshot' && args.p_snapshot_id)return await (await locate('state_snapshots','id',args.p_snapshot_id)).client.rpc(name,args);
      if(['shared_trip_owners','claim_trip_invitations'].includes(name)){
        const results=await Promise.all(projects.map(p=>p.client.rpc(name,args)));
        const bad=results.find(r=>r.error);if(bad)return bad;
        return {data:results.flatMap(r=>Array.isArray(r.data)?r.data:[]),error:null};
      }
      // Account deletion requires propagation to every project; fail closed until implemented.
      fail('Esta operação ainda não está disponível na prévia Neon: '+name);
    }catch(error){return {data:null,error};}
  }
  return {auth,functions,storage,from,rpc};
}
