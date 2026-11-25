
export function streakModel(days,today){
 const valid=[...new Set((Array.isArray(days)?days:[]).filter(d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)))].sort();
 const present=new Set(valid);
 const move=(d,n)=>{const x=new Date(d+'T12:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10);};
 let last=present.has(today)?today:move(today,-1),current=0;
 while(present.has(last)){current++;last=move(last,-1);}
 let best=0,run=0,prev='';
 for(const d of valid){run=prev&&move(prev,1)===d?run+1:1;best=Math.max(best,run);prev=d;}
 return {current,best,days:valid,active:present.has(today)};
}
export function buildAdminModel(payload){
 if(!payload?.accounts||!Array.isArray(payload.accounts.users)||!Array.isArray(payload.snapshots))throw Error('Dados incompletos.');
 const people=new Map(payload.accounts.users.map(u=>[String(u.id),{...u,id:String(u.id),owned:[],shared:[],quotas:[],streak:streakModel(u.days,payload.accounts.today)}]));
 const trips=new Map(),edges=[],edgeKeys=new Set(),unmapped=new Set();
 for(const [idx,s] of payload.snapshots.entries()){
  const ids=new Map(s.identities.map(i=>[String(i.legacy_id),i.id?String(i.id):null]));
  const addEdge=(personId,trip,role)=>{
   const p=people.get(personId);
   if(!p){unmapped.add(trip.id+':'+personId+':'+role);return;}
   const key=personId+':'+trip.id+':'+role;if(edgeKeys.has(key))return;edgeKeys.add(key);
   const e={userId:personId,tripId:trip.id,role};edges.push(e);
   (role==='owner'?p.owned:p.shared).push({...trip,role});
  };
  const owner=people.get(ids.get(String(s.project_owner)));
  if(owner&&s.quota)owner.quotas.push({...s.quota,project:idx===0?'A':'B'});
  const projectTrips=new Map();
  for(const t of s.trips){if(t.deleted)continue;const id=String(t.id),trip={id,name:t.name||'Viagem sem título'};if(!trips.has(id))trips.set(id,trip);projectTrips.set(id,trip);addEdge(ids.get(String(t.owner_id))||'sem-vinculo:'+t.owner_id,trip,'owner');}
  for(const m of s.memberships){const trip=projectTrips.get(String(m.trip_id));if(!trip)continue;addEdge(ids.get(String(m.user_id))||'sem-vinculo:'+m.user_id,trip,m.role);}
 }
 const users=[...people.values()];
 return {users,trips:[...trips.values()],edges,unmapped:unmapped.size,registered:users.length,creators:users.filter(u=>u.owned.length).length,sharedOnly:users.filter(u=>!u.owned.length&&u.shared.length).length,noTrips:users.filter(u=>!u.owned.length&&!u.shared.length).length,today:payload.accounts.today};
}

const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e;};
const initial=name=>String(name||'?').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'?';
const roleLabel=r=>r==='owner'?'Criador':r==='editor'?'Edição':r==='viewer'?'Visualização':String(r||'Não informado');
const safeImage=x=>{try{const u=new URL(x);return u.protocol==='https:'?u.href:null;}catch{return null;}};
const displayImage=u=>u.profilePhotoUrl||safeImage(u.image);
const dayCount=n=>n+' '+(n===1?'dia':'dias');
// Share the native HTML renderer to avoid WebKit SVG image/blob inconsistencies.
export function createAdminAvatarImage(user,onError=()=>{},doc=document){
 const src=displayImage(user);if(!src)return null;
 const img=doc.createElement('img');img.alt='';img.draggable=false;
 img.addEventListener('error',onError,{once:true});img.src=src;return img;
}
const bytes=n=>{if(n==null||!Number.isFinite(Number(n)))return 'N/D';const v=Number(n);return v>=1e9?(v/1e9).toLocaleString('pt-BR',{maximumFractionDigits:2})+' GB':v>=1e6?(v/1e6).toLocaleString('pt-BR',{maximumFractionDigits:1})+' MB':v.toLocaleString('pt-BR')+' B';};
const svgNode=(tag,attrs={})=>{const e=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,String(v));return e;};
function renderGraph(model,host){
 const card=node('section',null,'admin-card');card.append(node('h3','Conexões entre usuários e viagens'));
 if(!model.edges.length){card.append(node('p','Nenhum vínculo ativo registrado.','admin-caption'));host.append(card);return;}
 // Fixed columns with independent vertical positions; all edges share the same role legend.
 const users=model.users,trips=model.trips,height=Math.max(120,users.length*72,trips.length*66)+20,width=330;
 const graph=node('div',null,'admin-graph-wrap');
 const svg=svgNode('svg',{viewBox:'0 0 '+width+' '+height,width,height,class:'admin-graph',role:'img','aria-label':'Grafo de usuários e viagens, com conexões por tipo de permissão'});
 graph.append(svg);
 const uy=new Map(users.map((u,i)=>[u.id,36+i*72])),ty=new Map(trips.map((t,i)=>[t.id,36+i*66]));
 for(const edge of model.edges){const a=uy.get(edge.userId),b=ty.get(edge.tripId);if(a==null||b==null)continue;const color=edge.role==='owner'?'#23895d':edge.role==='editor'?'#2579c4':edge.role==='viewer'?'#a77c34':'#8795a5';svg.append(svgNode('path',{d:'M 48 '+a+' C 120 '+a+', 155 '+b+', 205 '+b,fill:'none',stroke:color,'stroke-width':edge.role==='owner'?2.8:1.7,'stroke-dasharray':edge.role==='viewer'?'4 4':'none',opacity:.75}));}
 for(const u of users){const y=uy.get(u.id),r=19,cx=26,ratio=Math.min(1,u.streak.current/7),circ=2*Math.PI*22;
 svg.append(svgNode('circle',{cx,cy:y,r:22,fill:'white',stroke:'#dbe6ef','stroke-width':3}));
 if(ratio>0)svg.append(svgNode('circle',{cx,cy:y,r:22,fill:'none',stroke:'#29aa76','stroke-width':3,'stroke-dasharray':(circ*ratio)+' '+circ,transform:'rotate(-90 '+cx+' '+y+')'}));
 svg.append(svgNode('circle',{cx,cy:y,r,fill:'#eaf3ff'}));
 const label=svgNode('text',{x:cx,y:y+4,'text-anchor':'middle','font-size':11,fill:'#2465a5','font-weight':700});label.textContent=initial(u.name);svg.append(label);
 const overlay=node('div',null,'admin-graph-photo');overlay.setAttribute('aria-hidden','true');
 overlay.style.left=(cx-r)/width*100+'%';overlay.style.top=(y-r)/height*100+'%';overlay.style.width=2*r/width*100+'%';
 const photo=createAdminAvatarImage(u,()=>overlay.remove());
 if(photo){overlay.append(photo);graph.append(overlay);}
 const name=svgNode('text',{x:52,y:y-6,'font-size':10,fill:'#223951','font-weight':700});name.textContent=String(u.name||u.email||'Usuário').slice(0,19);svg.append(name);
 const streak=svgNode('text',{x:52,y:y+8,'font-size':9,fill:'#287d5b'});streak.textContent=dayCount(u.streak.current);svg.append(streak);}
 for(const t of trips){const y=ty.get(t.id);svg.append(svgNode('rect',{x:205,y:y-17,width:122,height:34,rx:8,fill:'#f1f5fa',stroke:'#dce5ee'}));const n=svgNode('text',{x:214,y:y+4,'font-size':10,fill:'#213a55','font-weight':650});n.textContent=String(t.name).slice(0,21);const full=svgNode('title');full.textContent=t.name;n.append(full);svg.append(n);}
 card.append(graph);const legend=node('div',null,'admin-legend');for(const [label,color] of [['Criação','#23895d'],['Edição','#2579c4'],['Visualização','#a77c34']]){const x=node('span',label);x.style.borderLeft='3px solid '+color;x.style.paddingLeft='5px';legend.append(x);}card.append(legend,node('p','O anel corresponde aos dias consecutivos, completando a volta aos 7 dias; o número mostra o streak real.','admin-caption'));host.append(card);
}
function render(model,host){
 host.replaceChildren();const grid=node('div',null,'admin-grid');
 for(const [label,value] of [['Contas cadastradas',model.registered],['Criaram viagens',model.creators],['Somente compartilhadas',model.sharedOnly],['Sem viagens ativas',model.noTrips],['Viagens ativas',model.trips.length],['Acessaram hoje',model.users.filter(u=>u.streak.active).length]]){const tile=node('div',null,'admin-metric');tile.append(node('strong',value),node('span',label));grid.append(tile);}host.append(grid);
 renderGraph(model,host);
 if(model.unmapped)host.append(node('p',model.unmapped+' vínculos não puderam ser associados a uma conta central. Não foram atribuídos por suposição.','admin-caption'));
 const heading=node('h3','Usuários');heading.style.margin='4px 0 0';host.append(heading);
 for(const u of model.users){const card=node('section',null,'admin-card'),person=node('div',null,'admin-person'),avatar=node('div',initial(u.name),'admin-avatar');avatar.dataset.active=String(u.streak.active);
 const photo=createAdminAvatarImage(u,()=>{avatar.textContent=initial(u.name)});if(photo)avatar.replaceChildren(photo);
 const name=node('div',null,'admin-person-name');name.append(node('strong',u.name||'Usuário'),node('small',u.email||''));person.append(avatar,name,node('div',dayCount(u.streak.current),'admin-streak'));card.append(person);
 const tags=node('div',null,'admin-tags');for(const t of [u.owned.length+' próprias',u.shared.length+' compartilhadas',u.verified?'E-mail confirmado':'E-mail não confirmado','Recorde: '+u.streak.best+' dias'])tags.append(node('span',t,'admin-tag'));card.append(tags);
 const list=node('ul',null,'admin-trips');for(const t of [...u.owned,...u.shared])list.append(node('li',t.name+' · '+roleLabel(t.role)));if(list.children.length)card.append(list);else card.append(node('p','Nenhuma viagem ativa associada.','admin-caption'));
 for(const q of u.quotas){for(const [label,used,limit] of [['Banco de dados do projeto',q.database_bytes,q.database_quota_bytes],['Arquivos registrados',q.registered_storage_bytes,q.storage_quota_bytes]]){const line=node('div',null,'admin-line'),meter=node('div',null,'admin-meter'),bar=node('i');const pct=Number(limit)>0&&used!=null?100*Number(used)/Number(limit):null;line.append(node('span',label),node('strong',bytes(used)+' / '+bytes(limit)));bar.style.width=Math.max(0,Math.min(100,pct||0))+'%';meter.append(bar);card.append(line,meter);}}
 if(!u.quotas.length)card.append(node('p','Cota de projeto próprio não identificada.','admin-caption'));
 const dayTitle=node('p',u.streak.days.length+' dias de acesso registrados · horário de Brasília','admin-caption');card.append(dayTitle);
 if(u.streak.days.length){const dates=node('div',null,'admin-days');for(const d of [...u.streak.days].reverse().slice(0,30))dates.append(node('span',d.split('-').reverse().join('/'),'admin-day'));card.append(dates);}
 host.append(card);}
 host.append(node('p','Contagens de viagens não incluem viagens excluídas. Cotas correspondem ao projeto do proprietário; arquivos registrados não são uma medição física independente. Acessos são registrados a partir da implantação, sem reconstruir histórico.','admin-caption'));
}
export function createAdminPanel({getClient,getUser,onError=()=>{}}){
 const entry=document.getElementById('admin_home_button'),profile=document.getElementById('admin_profile_button'),dialog=document.getElementById('admin_dialog'),status=document.getElementById('admin_status'),content=document.getElementById('admin_content'),refresh=document.getElementById('admin_refresh');
 let generation=0,actor=null,allowed=false,checking=null,lastAccess='',lastAttempt=0,loadId=0;
 const photoUrls=new Set();
 function releasePhotos(){for(const url of photoUrls)URL.revokeObjectURL(url);photoUrls.clear();}
 function clearContent(){content?.replaceChildren();releasePhotos();}
 const show=value=>{for(const e of [entry,profile])if(e)e.hidden=!value;};
 const key=()=>String(getUser()?.neon_subject||'');
 const accessDay=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 function reset(){generation++;loadId++;actor=null;allowed=false;checking=null;lastAccess='';lastAttempt=0;show(false);clearContent();if(dialog?.open)dialog.close();}
 async function sessionChanged(){
  const id=key();if(!id){reset();return;}
  if(actor!==id){reset();actor=id;}
  if(!navigator.onLine)return;
  if(checking)return checking;
  const now=Date.now(),day=accessDay();
  if(lastAccess===day&&now-lastAttempt<60000)return;
  const g=generation;lastAttempt=now;
  const task=(async()=>{
   const client=await getClient();if(!client?.admin)throw Error('Administração indisponível.');
   if(g!==generation||key()!==id)return;
   if(lastAccess!==day){try{await client.admin.recordAccess();if(g===generation&&key()===id)lastAccess=day;}catch(e){onError(e);}}
   const ok=await client.admin.allowed();
   if(g!==generation||key()!==id)return;
   allowed=ok;show(ok);
   if(!ok){loadId++;clearContent();if(dialog?.open)dialog.close();}
  })().catch(e=>{if(g===generation){allowed=false;show(false);if(dialog?.open)dialog.close();}onError(e);}).finally(()=>{if(checking===task)checking=null;});
  checking=task;return task;
 }
 async function load(){
  const g=generation,id=key();if(!allowed||!id||!dialog?.open)return;
  const request=++loadId;
  clearContent();status.textContent='Consultando dados e fotos de perfil…';refresh.disabled=true;
  try{
   const client=await getClient();if(!client?.admin)throw Error('Sem conexão.');
   const data=await client.admin.overview();
   if(g!==generation||key()!==id||request!==loadId||!dialog.open||!allowed)return;
   const model=buildAdminModel(data);
   for(const u of model.users){const blob=data.photoBlobs?.get(u.id);if(blob){const url=URL.createObjectURL(blob);photoUrls.add(url);u.profilePhotoUrl=url;}}
   render(model,content);status.textContent='Dados consultados agora';
  }
  catch(e){if(g===generation&&key()===id&&request===loadId){status.textContent='Não foi possível consultar todos os dados. Nenhum total parcial será exibido.';clearContent();}onError(e);}
  finally{if(g===generation&&request===loadId)refresh.disabled=false;}
 }
 function open(){if(!allowed||!dialog||!key())return;dialog.showModal();load();}
 entry?.addEventListener('click',open);profile?.addEventListener('click',open);refresh?.addEventListener('click',load);
 document.getElementById('admin_close')?.addEventListener('click',()=>dialog?.close());
 dialog?.addEventListener('close',()=>{loadId++;clearContent();refresh.disabled=false;});
 show(false);return {sessionChanged,reset};
}
