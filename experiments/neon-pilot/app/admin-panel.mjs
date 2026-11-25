// Administrative data is memory-only and every RPC is independently JWT-authorized.
const AUTH_ADMIN_API='https://ep-small-bread-b7uq0zva.apirest.c-13.us-east-1.aws.neon.tech/viaggio_auth/rest/v1';
const dayMs=86400000;
const dayFormat=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'});
function todayKey(){const p=Object.fromEntries(dayFormat.formatToParts(new Date()).map(x=>[x.type,x.value]));return p.year+'-'+p.month+'-'+p.day;}
export function streakModel(days,today){
 const sorted=[...new Set(days||[])].filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&d<=today&&Number.isFinite(Date.parse(d))).sort();
 const numbers=sorted.map(d=>Date.parse(d)/dayMs); let longest=0,run=0,last=null;
 for(const n of numbers){run=n===last+1?run+1:1;longest=Math.max(longest,run);last=n;}
 const difference=Date.parse(today)/dayMs-last;
 return {days:sorted,total:sorted.length,current:sorted.length&&difference<=1?run:0,longest,last:sorted.at(-1)||null};
}
export function adminModel(accounts,projects){
 if(!Array.isArray(accounts?.users)||!Array.isArray(projects)||projects.length!==2||new Set(projects.map(p=>p.project)).size!==2)throw Error('Resposta incompleta');
 const ids=new Map(),trips=new Map(),memberships=new Map(),warnings=[];
 for(const p of projects){
  if(!Array.isArray(p.identities)||!Array.isArray(p.trips)||!Array.isArray(p.memberships))throw Error('Projeto incompleto');
  for(const i of p.identities)if(i.id){if(ids.has(i.legacy_id)&&ids.get(i.legacy_id)!==i.id)throw Error('Identidades divergentes');ids.set(i.legacy_id,i.id);}
  for(const t of p.trips){if(trips.has(t.id))throw Error('Viagem duplicada entre projetos');trips.set(t.id,t);}
  for(const m of p.memberships){const key=m.trip_id+':'+m.user_id;if(memberships.has(key)&&memberships.get(key).role!==m.role)throw Error('Permissões divergentes');memberships.set(key,m);}
 }
 const central=new Set(accounts.users.map(u=>u.id));
 const mapped=new Set(ids.values());
 for(const t of trips.values())if(!central.has(ids.get(t.owner_id)))warnings.push('Viagem sem conta central vinculada.');
 for(const m of memberships.values())if(!central.has(ids.get(m.user_id)))warnings.push('Compartilhamento sem conta central vinculada.');
 for(const p of projects)if(!central.has(ids.get(p.project_owner)))warnings.push('Projeto sem conta central vinculada.');
 const users=accounts.users.map(u=>{
  const owned=[...trips.values()].filter(t=>ids.get(t.owner_id)===u.id);
  const shared=[...memberships.values()].filter(m=>ids.get(m.user_id)===u.id&&trips.has(m.trip_id)&&!trips.get(m.trip_id).deleted&&ids.get(trips.get(m.trip_id).owner_id)!==u.id).map(m=>({name:trips.get(m.trip_id).name,id:m.trip_id,role:m.role}));
  const quotas=projects.filter(p=>ids.get(p.project_owner)===u.id).map(p=>({project:p.project,usage:p.usage}));
  return {...u,linked:mapped.has(u.id),owned,shared,quotas,streak:streakModel(u.days,accounts.today),
   kind:owned.length?'creator':shared.length?'shared':'none'};
 });
 return {users,creators:users.filter(u=>u.kind==='creator').length,sharedOnly:users.filter(u=>u.kind==='shared').length,withoutTrips:users.filter(u=>u.kind==='none').length,verified:users.filter(u=>u.verified).length,linked:users.filter(u=>u.linked).length,activeTrips:[...trips.values()].filter(t=>!t.deleted).length,warnings:[...new Set(warnings)]};
}
async function rpc(client,name){
 const jwt=await client?.accessToken?.();if(!jwt)throw Error('Sessão indisponível');
 const response=await fetch(AUTH_ADMIN_API+'/rpc/'+name,{method:'POST',headers:{authorization:'Bearer '+jwt,'content-type':'application/json','content-profile':'viaggio_admin','accept-profile':'viaggio_admin'},body:'{}',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(12000)});
 if(!response.ok){const e=Error('Serviço administrativo indisponível ('+response.status+')');e.status=response.status;throw e;}
 if(name==='record_access')return null;
 return response.json();
}
const node=(tag,value,cls)=>{const e=document.createElement(tag);if(value!==undefined)e.textContent=value;if(cls)e.className=cls;return e;};
const dateText=d=>d?String(d).slice(0,10).split('-').reverse().join('/'):'—';
const bytes=n=>{n=Number(n);if(!Number.isFinite(n)||n<0)return 'N/D';const units=['B','KB','MB','GB','TB'];let i=0;while(n>=1000&&i<4){n/=1000;i++;}return new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1}).format(n)+' '+units[i];};
const roleName=r=>r==='editor'?'Edição e visualização':r==='viewer'?'Somente visualização':String(r||'Não informado');
let current=null,clientFactory=null,trigger=null,dialog=null,content=null,refreshButton=null,request=null,generation=0,accessDay='',lastAttempt=0,adminAllowed=false,checking=false;
function ensureUI(){
 if(trigger)return true;
 const section=document.querySelector('#profile_created_at')?.closest('.form-section');if(!section)return false;
 const style=node('style');style.textContent=`
 .viaggio-admin-trigger[hidden]{display:none!important}
 .viaggio-admin-dialog{box-sizing:border-box;color:#172c42;background:#f4f8fc;border:0;border-radius:22px;padding:0;width:min(94vw,780px);max-height:90dvh;box-shadow:0 16px 60px #102c4955;font:inherit}
 .viaggio-admin-dialog::backdrop{background:#10273b88}
 .viaggio-admin-header{position:sticky;top:0;z-index:1;background:#fff;padding:16px 18px;display:flex;align-items:center;justify-content:space-between;gap:10px;border-bottom:1px solid #dce7ef}
 .viaggio-admin-header h2{font-size:20px;margin:0}.viaggio-admin-actions{display:flex;gap:6px;align-items:center}
 .viaggio-admin-actions button{border:0;border-radius:10px;padding:10px 12px;background:#e8f4ff;color:#125d97;font:inherit;font-weight:650}
 .viaggio-admin-body{padding:16px;display:grid;gap:12px}.viaggio-admin-body p{margin:0;line-height:1.4;overflow-wrap:anywhere}
 .viaggio-admin-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(115px,1fr));gap:8px}
 .viaggio-admin-kpi,.viaggio-admin-user{border:1px solid #dce7ef;border-radius:15px;background:#fff;padding:13px;min-width:0}
 .viaggio-admin-kpi strong{display:block;font-size:25px;color:#1478b9}.viaggio-admin-kpi small,.viaggio-admin-muted{font-size:12px;color:#506579}
 .viaggio-admin-user h3{margin:0 0 4px;font-size:17px;overflow-wrap:anywhere}.viaggio-admin-user h4{margin:13px 0 5px;font-size:14px}.viaggio-admin-user ul{padding-left:20px;margin:4px 0}.viaggio-admin-user li{margin:4px 0;overflow-wrap:anywhere}
 .viaggio-admin-quota{margin:7px 0}.viaggio-admin-quota progress{width:100%;height:10px;accent-color:#159bf0}
 .viaggio-admin-user details{margin-top:10px}.viaggio-admin-user summary{cursor:pointer;color:#126cab;font-weight:600}.viaggio-admin-user details p{margin-top:7px}
 .viaggio-admin-warning{color:#8a4e13;background:#fff7e7;padding:10px;border-radius:10px;font-size:13px}
 @media(max-width:480px){.viaggio-admin-dialog{width:100%;max-width:100%;max-height:96dvh;margin:auto 0 0;border-radius:20px 20px 0 0}.viaggio-admin-header{padding:14px}.viaggio-admin-body{padding:12px;padding-bottom:calc(20px + env(safe-area-inset-bottom))}}
 `;document.head.append(style);
 const group=node('div',undefined,'form-group');trigger=node('button','Administração ›','account-row viaggio-admin-trigger');trigger.type='button';trigger.hidden=true;group.append(trigger);section.append(group);
 dialog=node('dialog',undefined,'viaggio-admin-dialog');dialog.setAttribute('aria-label','Administração do Viaggio');
 const header=node('header',undefined,'viaggio-admin-header');header.append(node('h2','Administração'));
 const actions=node('div',undefined,'viaggio-admin-actions');refreshButton=node('button','Atualizar');refreshButton.type='button';const close=node('button','Fechar');close.type='button';actions.append(refreshButton,close);header.append(actions);
 content=node('div',undefined,'viaggio-admin-body');content.setAttribute('aria-live','polite');dialog.append(header,content);document.body.append(dialog);
 trigger.addEventListener('click',()=>{if(!adminAllowed||!current)return;dialog.showModal();void loadPanel();});
 refreshButton.addEventListener('click',()=>void loadPanel());close.addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>{content.replaceChildren();});
 for(const e of ['visibilitychange','pointerdown'])document.addEventListener(e,()=>void trackAndCheck(),{passive:true});
 window.addEventListener('online',()=>{lastAttempt=0;void trackAndCheck();});
 window.addEventListener('focus',()=>void trackAndCheck());
 return true;
}
function quota(container,title,value,limit){
 const d=node('div',undefined,'viaggio-admin-quota');let valid=value!=null&&limit!=null&&Number.isFinite(Number(value))&&Number(limit)>0;
 const pct=valid?100*Number(value)/Number(limit):null;
 d.append(node('p',title+': '+(valid?bytes(value)+' / '+bytes(limit)+' · '+pct.toLocaleString('pt-BR',{maximumFractionDigits:1})+'%':'N/D')));
 if(valid){const bar=node('progress');bar.max=100;bar.value=Math.min(100,Math.max(0,pct));bar.setAttribute('aria-label',title);d.append(bar);}
 container.append(d);
}
function render(model){
 const grid=node('div',undefined,'viaggio-admin-kpis');
 for(const [label,value] of [['Contas criadas',model.users.length],['Verificadas',model.verified],['Perfis vinculados',model.linked],['Criadores de viagens',model.creators],['Só compartilhadas',model.sharedOnly],['Sem viagens',model.withoutTrips],['Viagens ativas',model.activeTrips]]){
  const k=node('div',undefined,'viaggio-admin-kpi');k.append(node('strong',String(value)),node('small',label));grid.append(k);
 }
 content.replaceChildren(grid,node('p','Criadores incluem viagens ainda registradas, mesmo excluídas. Compartilhamentos indicam permissão atual, não prova de abertura da viagem.','viaggio-admin-muted'));
 if(model.warnings.length)content.append(node('p',model.warnings.join(' '),'viaggio-admin-warning'));
 for(const u of model.users){
  const c=node('article',undefined,'viaggio-admin-user');c.append(node('h3',u.name||u.email||'Sem nome'),node('p',u.email||'—','viaggio-admin-muted'),node('p',(u.verified?'E-mail verificado':'E-mail não verificado')+' · '+(u.linked?'Perfil vinculado':'Sem perfil vinculado')+' · Cadastro '+dateText(u.created_at),'viaggio-admin-muted'));
  c.append(node('h4','Viagens próprias · '+u.owned.filter(t=>!t.deleted).length+' ativas / '+u.owned.length+' registradas'));
  if(u.owned.length){const ul=node('ul');for(const t of u.owned)ul.append(node('li',(t.name||'Sem título')+(t.deleted?' · excluída':'')));c.append(ul);}else c.append(node('p','Nenhuma viagem própria.'));
  c.append(node('h4','Viagens compartilhadas · '+u.shared.length));
  if(u.shared.length){const ul=node('ul');for(const t of u.shared)ul.append(node('li',(t.name||'Sem título')+' — '+roleName(t.role)));c.append(ul);}else c.append(node('p','Nenhum compartilhamento ativo.'));
  c.append(node('h4','Cota do projeto pessoal'));
  if(!u.quotas.length)c.append(node('p','Sem projeto pessoal atribuído.','viaggio-admin-muted'));
  for(const q of u.quotas){if(!q.usage){c.append(node('p','Medição indisponível.','viaggio-admin-warning'));continue;}quota(c,'Dados',q.usage.database_bytes,q.usage.database_quota_bytes);quota(c,'Arquivos',q.usage.storage_bytes,q.usage.storage_quota_bytes);c.append(node('p','Medição do projeto '+q.project.toUpperCase()+' · '+dateText(q.usage.measured_at),'viaggio-admin-muted'));}
  c.append(node('h4','Streak de acesso'),node('p',u.streak.current+' dias consecutivos · '+u.streak.total+' dias registrados'),node('p','Recorde: '+u.streak.longest+' · Último acesso: '+dateText(u.streak.last),'viaggio-admin-muted'));
  const details=node('details');details.append(node('summary','Ver dias acessados'),node('p',u.streak.days.length?u.streak.days.slice().reverse().map(dateText).join(' · '):'Nenhum dia registrado ainda.'));c.append(details);content.append(c);
 }
 content.append(node('p','Acessos online registrados desde a ativação da métrica, no fuso de Brasília. Não há retroatividade nem contagem de acessos exclusivamente offline. Cotas são por projeto pessoal, incluindo histórico e arquivos físicos, sem duplicar viagens compartilhadas.','viaggio-admin-muted'));
}
async function loadPanel(){
 if(!adminAllowed||!current||request)return;
 const gen=generation;refreshButton.disabled=true;content.replaceChildren(node('p','Consultando dados atualizados…'));
 const job=(async()=>{try{
  const c=await clientFactory(5000);if(!c)throw Error('Conexão indisponível.');
  await rpc(c,'record_access').catch(()=>{});
  const [accounts,projects]=await Promise.all([rpc(c,'admin_accounts'),c.adminProjectData()]);
  if(gen===generation&&dialog.open)render(adminModel(accounts,projects));
 }catch(e){if(gen===generation&&dialog.open){content.replaceChildren(node('p','Não foi possível atualizar os dados administrativos. Verifique a conexão e tente novamente.','viaggio-admin-warning'));if(e.status===403||e.status===401){adminAllowed=false;trigger.hidden=true;dialog.close();}}}
 finally{if(request===job){request=null;refreshButton.disabled=false;}}})();
 request=job;
}
async function trackAndCheck(){
 if(!current||!navigator.onLine||document.visibilityState==='hidden'||checking)return;
 const day=todayKey();if(accessDay===day&&adminAllowed!==null)return;
 if(Date.now()-lastAttempt<30000)return;lastAttempt=Date.now();checking=true;
 const gen=generation;
 try{const c=await clientFactory(5000);if(!c)return;
  if(accessDay!==day){try{await rpc(c,'record_access');if(gen===generation)accessDay=day;}catch{/* retry on future foreground interaction */}}
  if(gen===generation&&adminAllowed===null){
   try{const a=await rpc(c,'admin_accounts');if(gen===generation){adminAllowed=Array.isArray(a?.users);trigger.hidden=!adminAllowed;}}
   catch(e){if(gen===generation&&(e.status===401||e.status===403)){adminAllowed=false;trigger.hidden=true;}}
  }
 }catch{/* never block offline-first startup */}finally{if(gen===generation)checking=false;}
}
export function syncAdminSession(user,getClient){
 if(!ensureUI())return;
 clientFactory=getClient;
 if(current!==user?.id){generation++;current=user?.id||null;accessDay='';lastAttempt=0;checking=false;adminAllowed=null;trigger.hidden=true;request=null;refreshButton.disabled=false;if(dialog.open)dialog.close();content.replaceChildren();}
 if(current)void trackAndCheck();
}
