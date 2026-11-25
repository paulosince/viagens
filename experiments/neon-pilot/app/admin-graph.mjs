// Deterministic bipartite graph: authenticated users and active trips.
// No admin payload is persisted; avatars use already-authorized private blobs.
const NS='http://www.w3.org/2000/svg';
const palette={owner:'#167bb5',editor:'#b87511',viewer:'#63748c',unknown:'#9467a5'};
const roleLabel={owner:'Proprietário',editor:'Edição e visualização',viewer:'Somente visualização',unknown:'Permissão não reconhecida'};
export function buildGraph(model){
 const users=(model.users||[]).map(u=>({id:'u:'+u.id,label:u.name||u.email||'Sem nome',avatarPath:u.avatarPath||null,streak:u.streak||{current:0,longest:0,total:0}}));
 const trips=new Map((model.graphTrips||[]).map(t=>[t.id,{id:'t:'+t.id,label:t.name||'Sem título'}]));
 const edges=new Map();
 for(const u of model.users||[]){
  for(const t of u.owned||[])if(!t.deleted){if(!trips.has(t.id))trips.set(t.id,{id:'t:'+t.id,label:t.name||'Sem título'});edges.set(u.id+':'+t.id,{from:'u:'+u.id,to:'t:'+t.id,role:'owner'});}
  for(const t of u.shared||[]){if(!trips.has(t.id))trips.set(t.id,{id:'t:'+t.id,label:t.name||'Sem título'});const key=u.id+':'+t.id;if(!edges.has(key))edges.set(key,{from:'u:'+u.id,to:'t:'+t.id,role:['editor','viewer'].includes(t.role)?t.role:'unknown'});}
 }
 return {users,trips:[...trips.values()],edges:[...edges.values()]};
}
export function streakRatio(streak){
 const current=Number(streak?.current)||0,record=Number(streak?.longest)||0;
 return record>0?Math.min(1,Math.max(0,current/record)):0;
}
export function graphLayout(graph){
 const height=Math.max(220,72+Math.max(graph.users.length,graph.trips.length)*112);
 const place=(items,x)=>items.map((n,i)=>({...n,x,y:66+(height-100)*(i+.5)/Math.max(1,items.length)}));
 return {width:620,height,users:place(graph.users,130),trips:place(graph.trips,455)};
}
const svg=(tag,attrs={},value)=>{const e=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,String(v));if(value!==undefined)e.textContent=value;return e;};
const html=(tag,value)=>{const e=document.createElement(tag);if(value!==undefined)e.textContent=value;return e;};
const initials=s=>s.trim().split(/\s+/).slice(0,2).map(x=>Array.from(x)[0]||'').join('').toUpperCase()||'?';
const shorten=(s,n=26)=>Array.from(s).length>n?Array.from(s).slice(0,n-1).join('')+'…':s;
let instance=0;
export function mountAdminGraph(model,loadAvatar){
 const graph=buildGraph(model),layout=graphLayout(graph),prefix='viaggio-graph-'+(++instance);
 const section=html('section');section.className='viaggio-admin-user viaggio-admin-graph';
 const header=html('h3','Rede de viagens');const intro=html('p','Toque em uma pessoa ou viagem para destacar suas conexões. O anel mostra streak atual / recorde pessoal.');
 intro.className='viaggio-admin-muted';
 const legend=html('div');legend.style.cssText='display:flex;flex-wrap:wrap;gap:8px 14px;margin:12px 0;font-size:12px';
 for(const role of ['owner','editor','viewer']){const item=html('span');item.style.cssText='display:inline-flex;align-items:center;gap:6px';const line=html('i');line.style.cssText='width:22px;border-top:'+ (role==='owner'?'3px solid':role==='editor'?'2px dashed':'2px dotted')+' '+palette[role];item.append(line,html('span',roleLabel[role]));legend.append(item);}
 const viewport=html('div');viewport.style.cssText='overflow:auto;max-height:62dvh;border:1px solid #e0e9f1;border-radius:12px;background:#f7fbff;overscroll-behavior:contain';
 const diagram=svg('svg',{viewBox:'0 0 '+layout.width+' '+layout.height,width:layout.width,height:layout.height,role:'group','aria-label':'Grafo de usuários e viagens'});
 diagram.style.cssText='display:block;width:100%;min-width:520px;height:auto;font-family:inherit';
 const defs=svg('defs');diagram.append(defs);
 diagram.append(svg('text',{x:130,y:30,'text-anchor':'middle',fill:'#526b80','font-size':12,'font-weight':700},'PESSOAS'),svg('text',{x:455,y:30,'text-anchor':'middle',fill:'#526b80','font-size':12,'font-weight':700},'VIAGENS ATIVAS'));
 const all=[...layout.users,...layout.trips],positions=new Map(all.map(n=>[n.id,n])),lines=[],nodes=new Map(),urls=new Set();let disposed=false,selected=null;
 for(const e of graph.edges){const a=positions.get(e.from),b=positions.get(e.to);if(!a||!b)continue;
  const x1=a.x+36,x2=b.x-116;const mid=(x1+x2)/2;
  const path=svg('path',{d:'M '+x1+' '+a.y+' C '+mid+' '+a.y+', '+mid+' '+b.y+', '+x2+' '+b.y,fill:'none',stroke:palette[e.role],'stroke-width':e.role==='owner'?3:2,'stroke-dasharray':e.role==='editor'?'8 5':e.role==='viewer'?'2 5':e.role==='unknown'?'4 4':'none','stroke-linecap':'round',opacity:.8});
  path.append(svg('title',{},a.label+' — '+roleLabel[e.role]+' — '+b.label));diagram.append(path);lines.push({e,path});}
 const status=html('p','Todas as conexões visíveis.');status.className='viaggio-admin-muted';status.setAttribute('aria-live','polite');
 const reset=html('button','Mostrar todos');reset.type='button';reset.style.cssText='margin-top:10px;padding:8px 12px;border:0;border-radius:8px;background:#e8f4ff;color:#125d97;font:inherit';reset.hidden=true;
 function select(id){
  selected=selected===id?null:id;
  const connected=new Set(selected?[selected]:[]);
  for(const {e,path} of lines){const active=!selected||e.from===selected||e.to===selected;if(active&&selected){connected.add(e.from);connected.add(e.to);}path.setAttribute('opacity',active ? .95 : .08);}
  for(const [key,g] of nodes){g.setAttribute('opacity',!selected||connected.has(key)?1:.23);g.setAttribute('aria-pressed',String(key===selected));}
  reset.hidden=!selected;
  if(!selected){status.textContent='Todas as conexões visíveis.';return;}
  const edges=graph.edges.filter(e=>e.from===selected||e.to===selected);
  status.textContent=positions.get(selected).label+' — '+(edges.length?edges.map(e=>positions.get(e.from===selected?e.to:e.from).label+' ('+roleLabel[e.role]+')').join(' · '):'Nenhuma conexão ativa.');
 }
 function interactive(g,n){g.setAttribute('role','button');g.setAttribute('tabindex','0');g.setAttribute('aria-label',n.label);g.setAttribute('aria-pressed','false');g.style.cursor='pointer';g.addEventListener('click',()=>select(n.id));g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select(n.id);}});nodes.set(n.id,g);diagram.append(g);}
 for(const [i,n] of layout.users.entries()){
  const g=svg('g',{transform:'translate('+n.x+' '+n.y+')'});
  const r=33,circ=2*Math.PI*r,ratio=streakRatio(n.streak);
  g.append(svg('circle',{r:36,fill:'#fff',stroke:'#dce7ef','stroke-width':1}),svg('circle',{r,fill:'none',stroke:'#dbe9f2','stroke-width':5}));
  if(ratio>0)g.append(svg('circle',{r,fill:'none',stroke:'#16a36e','stroke-width':5,'stroke-linecap':'round','stroke-dasharray':(circ*ratio)+' '+circ,transform:'rotate(-90)'}));
  g.append(svg('circle',{r:27,fill:'#deeffa'}),svg('text',{y:5,'text-anchor':'middle',fill:'#23688c','font-size':19,'font-weight':700},initials(n.label)));
  const clipId=prefix+'-avatar-'+i,clip=svg('clipPath',{id:clipId});clip.append(svg('circle',{r:27}));defs.append(clip);
  const image=svg('image',{x:-27,y:-27,width:54,height:54,'clip-path':'url(#'+clipId+')',preserveAspectRatio:'xMidYMid slice'});
  g.append(image,svg('rect',{x:-25,y:20,width:50,height:19,rx:9,fill:'#fff',stroke:'#dce7ef'}),svg('text',{y:33,'text-anchor':'middle',fill:'#187853','font-size':11,'font-weight':750},n.streak.current+' d'),svg('text',{y:53,'text-anchor':'middle',fill:'#183c55','font-size':12,'font-weight':650},shorten(n.label,22)),svg('text',{y:67,'text-anchor':'middle',fill:'#62788a','font-size':10},'Recorde: '+n.streak.longest+' d'));
  g.append(svg('title',{},n.label+' — streak '+n.streak.current+' dias, recorde '+n.streak.longest+', total '+n.streak.total));
  interactive(g,n);
  if(n.avatarPath&&loadAvatar)Promise.resolve().then(()=>loadAvatar(n.avatarPath)).then(blob=>{if(disposed||!(blob instanceof Blob)||!/^image\/(jpeg|png|webp|gif|avif)$/i.test(blob.type)||!blob.size)return;const url=URL.createObjectURL(blob);urls.add(url);image.setAttribute('href',url);}).catch(()=>{});
 }
 for(const n of layout.trips){
  const g=svg('g',{transform:'translate('+n.x+' '+n.y+')'});
  const count=graph.edges.filter(e=>e.to===n.id).length;
  g.append(svg('rect',{x:-116,y:-28,width:232,height:56,rx:13,fill:'#fff',stroke:'#c5dcec','stroke-width':1.5}),svg('text',{x:-99,y:-4,fill:'#1478b9','font-size':16},'✈'),svg('text',{x:-73,y:-3,fill:'#193d56','font-size':13,'font-weight':650},shorten(n.label,25)),svg('text',{x:-73,y:15,fill:'#62788a','font-size':11},count+' '+(count===1?'participante':'participantes')));
  g.append(svg('title',{},n.label));interactive(g,n);
 }
 if(!graph.users.length||!graph.trips.length)diagram.append(svg('text',{x:!graph.users.length?130:455,y:layout.height/2,'text-anchor':'middle',fill:'#62788a','font-size':13},!graph.users.length?'Sem usuários':'Sem viagens'));
 viewport.append(diagram);reset.addEventListener('click',()=>{if(selected)select(selected);});section.append(header,intro,legend,viewport,reset,status);
 return {element:section,dispose(){disposed=true;for(const url of urls)URL.revokeObjectURL(url);urls.clear();}};
}
