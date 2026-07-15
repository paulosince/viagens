import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const supabase = createClient('https://siabldasqinpfmxslwji.supabase.co', 'sb_publishable_UgbBIOq1TnInuPRrQpAFag_JLIzYuFf');
const app = document.querySelector('#app');
const themes = [
  { id:'classic', name:'Clássico', title:'Cormorant Garamond', body:'Montserrat', primary:'#14212b', secondary:'#b89d63' },
  { id:'modern', name:'Contemporâneo', title:'Playfair Display', body:'DM Sans', primary:'#243447', secondary:'#c2785c' },
  { id:'warm', name:'Aconchegante', title:'Lora', body:'Nunito Sans', primary:'#6b4f3a', secondary:'#d39b67' },
  { id:'bold', name:'Aventureiro', title:'Fraunces', body:'Work Sans', primary:'#1e5147', secondary:'#d5a84a' },
  { id:'quiet', name:'Minimalista', title:'Libre Baskerville', body:'Manrope', primary:'#304052', secondary:'#9bafc4' }
];
let state = { user:null, trips:[], route:'home', activeTrip:null, days:[], activeDay:null, activities:[], wizard:{step:1, passengers:1, theme:'classic'} };

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const formatDate = value => value ? new Intl.DateTimeFormat('pt-BR',{dateStyle:'medium'}).format(new Date(`${value}T12:00:00`)) : '';
function setTheme(theme){ document.documentElement.style.setProperty('--primary',theme.primary); document.documentElement.style.setProperty('--secondary',theme.secondary); }
function shell(content){ const back=state.route==='trip'?'<button class="btn ghost top-back" data-action="back-home">← Minhas viagens</button>':state.route==='day'?'<button class="btn ghost top-back" data-action="back-trip">← Book da viagem</button>':'<div class="brand">Viagens</div>'; return `<main class="shell"><header class="topbar">${back}${state.user?'<button class="btn ghost" data-action="logout">Sair</button>':''}</header>${content}</main>`; }
function render(){
  if(!state.user){ app.innerHTML=shell(authView()); return; }
  if(state.route==='wizard'){ app.innerHTML=shell(wizardView()); return; }
  if(state.route==='trip'){ app.innerHTML=shell(bookView()); return; }
  if(state.route==='day'){ app.innerHTML=shell(dayView()); return; }
  app.innerHTML=shell(homeView());
}
function authView(){ return `<section class="hero"><span class="eyebrow">SEUS BOOKS DE VIAGEM</span><h1>Planeje.<br>Viva.<br>Relembre.</h1><p>Crie viagens com roteiro, mapa, fotos, orçamento e checklist em um único lugar.</p></section><section class="card"><div class="section-row"><div><span class="eyebrow">ACESSO</span><h2 class="section-title">Entrar na sua conta</h2></div></div><form data-form="auth" class="grid"><div class="field"><label>E-mail</label><input name="email" type="email" required autocomplete="email"></div><div class="field"><label>Senha</label><input name="password" type="password" required minlength="6" autocomplete="current-password"></div><div><button class="btn primary" type="submit">Entrar</button><button class="btn ghost" type="button" data-action="signup">Criar conta</button></div><p class="message" data-message></p></form></section>`; }
function homeView(){
  if(!state.trips.length) return `<section class="hero"><span class="eyebrow">BEM-VINDO</span><h1>Crie o seu<br>primeiro Book.</h1><p>Comece pelas informações básicas da viagem. Depois, vamos construir cada dia juntos.</p></section><section class="card empty"><h2>Nenhuma viagem ainda</h2><p class="muted">Sua próxima história começa com um destino.</p><button class="btn primary" data-action="new-trip">＋ Criar viagem</button></section>`;
  return `<section class="section-row"><div><span class="eyebrow">MINHAS VIAGENS</span><h1 class="section-title">Seus Books</h1></div><button class="btn primary" data-action="new-trip">＋ Nova viagem</button></section><section class="grid trip-grid">${state.trips.map(trip=>`<article class="card trip-card"><div class="trip-cover" style="background-image:url('${esc(trip.cover_url||'')}')"></div><div class="trip-body"><span class="eyebrow">${esc(formatDate(trip.start_date))} — ${esc(formatDate(trip.end_date))}</span><h3>${esc(trip.name)}</h3><p class="muted">${esc(trip.destination||'Destino a definir')}</p><button class="btn" data-action="open-trip" data-id="${trip.id}">Abrir Book →</button></div></article>`).join('')}</section>`;
}
function bookView(){
  const t=state.activeTrip;
  return `<section class="book-head"><span class="eyebrow">BOOK DA VIAGEM</span><h1 class="section-title">${esc(t.name)}</h1><p class="muted">${esc(t.destination)} · ${esc(formatDate(t.start_date))} — ${esc(formatDate(t.end_date))}</p></section><section class="grid day-grid">${state.days.map(day=>`<article class="card day-card ${day.status==='empty'?'empty-day':''}"><div class="day-card-image" style="background-image:url('${esc(day.photo_url||t.cover_url||'')}')"></div><div class="day-card-body"><span class="eyebrow">DIA ${day.day_number} · ${esc(formatDate(day.date))}</span><h2>${esc(day.title||'Dia sem programação')}</h2><p class="muted">${esc(day.summary||'Este dia ainda não tem programação. Crie manhã, tarde e noite.')}</p><button class="btn ${day.status==='empty'?'primary':''}" data-action="open-day" data-id="${day.id}">${day.status==='empty'?'＋ Preencher dia':'Abrir dia →'}</button></div></article>`).join('')}</section>`;
}
function dayView(){
  const d=state.activeDay, t=state.activeTrip;
  const periods=[['morning','MANHÃ'],['afternoon','TARDE'],['night','NOITE']];
  return `<section class="book-head"><span class="eyebrow">DIA ${d.day_number} · ${esc(formatDate(d.date))}</span><h1 class="section-title">${esc(d.title||'Dia sem programação')}</h1><p class="muted">${esc(t.name)}</p></section><section class="card day-editor"><form data-form="day" class="form-grid"><div class="field full"><label>Título do dia</label><input name="title" value="${esc(d.title||'')}" placeholder="Ex.: Torre Eiffel e o Sena"></div><div class="field full"><label>Resumo</label><input name="summary" value="${esc(d.summary||'')}" placeholder="Uma frase para apresentar este dia no Book"></div><div class="field full"><label>Foto do dia (opcional)</label><input name="photo_url" value="${esc(d.photo_url||'')}" placeholder="Cole uma URL de imagem por enquanto"></div><div><button class="btn primary" type="submit">Salvar informações</button></div></form><div class="divider"></div>${periods.map(([key,label])=>`<section class="period"><div class="section-row"><h2>${label}</h2><button class="btn" type="button" data-action="new-activity" data-period="${key}">＋ Atividade</button></div>${state.activities.filter(a=>a.period===key).map(a=>`<article class="activity"><strong>${esc(a.starts_at?new Date(a.starts_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})+' · ':'')}${esc(a.title)}</strong><p class="muted">${esc(a.place_name||'Local a definir')} · ${esc(a.description||'')}</p></article>`).join('')||'<p class="muted">Nenhuma atividade cadastrada.</p>'}</section>`).join('')}<div class="danger-zone"><button class="btn ghost" type="button" data-action="clear-day">Limpar programação deste dia</button></div></section>`;
}
function wizardView(){
  const w=state.wizard; const steps=['Viagem','Passageiros','Personalidade'];
  return `<section class="card wizard"><div class="wizard-head"><div><span class="eyebrow">CRIAR VIAGEM · ${w.step}/3</span><h1>${steps[w.step-1]}</h1></div><button class="btn ghost" data-action="cancel-wizard">Cancelar</button></div>${w.step===1?basicStep():w.step===2?passengersStep():themeStep()}<div class="actions">${w.step>1?'<button class="btn" data-action="prev-step">← Voltar</button>':'<span></span>'}${w.step<3?'<button class="btn primary" data-action="next-step">Continuar →</button>':'<button class="btn primary" data-action="save-trip">Criar Book</button>'}</div><p class="message" data-message></p></section>`;
}
function basicStep(){return `<form data-form="basic" class="form-grid"><div class="field full"><label>Nome da viagem</label><input name="name" placeholder="Ex.: Paris em família" required></div><div class="field"><label>Data de início</label><input name="start_date" type="date" required></div><div class="field"><label>Data de fim</label><input name="end_date" type="date" required></div><div class="field"><label>Destino</label><input name="destination" placeholder="Ex.: Paris, França" required></div><div class="field"><label>Como chegar?</label><select name="arrival_method"><option>Avião</option><option>Carro</option><option>Trem</option><option>Ônibus</option><option>Outro</option></select></div><div class="field full"><label>Local principal</label><input name="location_label" placeholder="Busque um lugar ou endereço"><div class="choice-map">O mapa e o autocomplete entram aqui na próxima etapa da V1.</div></div></form>`;}
function passengersStep(){return `<div><p class="muted">Adicione quem vai participar desta viagem. Fotos são opcionais.</p><div id="passengers">${Array.from({length:state.wizard.passengers},(_,i)=>`<div class="passenger"><div class="passenger-head"><strong>Passageiro ${i+1}</strong>${i?`<button class="btn ghost" type="button" data-action="remove-passenger" data-index="${i}">Remover</button>`:''}</div><div class="form-grid"><div class="field"><label>Nome</label><input data-passenger="name" data-index="${i}" placeholder="Nome completo"></div><div class="field"><label>Idade</label><input data-passenger="age" data-index="${i}" type="number" min="0" max="120"></div><div class="field"><label>Gênero (opcional)</label><select data-passenger="gender" data-index="${i}"><option value="">Prefiro não informar</option><option>Feminino</option><option>Masculino</option><option>Outro</option></select></div><div class="field"><label>Foto (opcional)</label><input data-passenger="photo" data-index="${i}" type="file" accept="image/*"></div></div></div>`).join('')}</div><button class="btn" data-action="add-passenger" type="button">＋ Adicionar passageiro</button></div>`;}
function themeStep(){return `<div><p class="muted">Escolha uma personalidade para este Book. Você poderá mudar depois.</p><div class="theme-grid">${themes.map(t=>`<button type="button" class="theme-option ${state.wizard.theme===t.id?'selected':''}" data-action="choose-theme" data-theme="${t.id}"><div class="theme-swatch" style="background:linear-gradient(135deg,${t.primary},${t.secondary})"></div><strong>${t.name}</strong><div class="muted">${t.title} + ${t.body}</div></button>`).join('')}</div></div>`;}

async function loadTrips(){ const {data,error}=await supabase.from('trips').select('*').order('start_date',{ascending:true}); if(error) throw error; state.trips=data||[]; }
async function openTrip(id){
  state.activeTrip=state.trips.find(t=>t.id===id); if(!state.activeTrip)return;
  setTheme({primary:state.activeTrip.primary_color||'#14212b',secondary:state.activeTrip.secondary_color||'#b89d63'});
  const r=await supabase.from('trip_days').select('*').eq('trip_id',id).order('day_number'); if(r.error)return message(r.error.message);
  state.days=r.data||[]; state.route='trip'; render();
}
async function openDay(id){
  state.activeDay=state.days.find(d=>d.id===id); if(!state.activeDay)return;
  const r=await supabase.from('activities').select('*').eq('day_id',id).order('position'); if(r.error)return message(r.error.message);
  state.activities=r.data||[]; state.route='day'; render();
}
async function saveDay(form){
  const data=Object.fromEntries(new FormData(form)); const r=await supabase.from('trip_days').update({title:data.title||null,summary:data.summary||null,photo_url:data.photo_url||null,status:data.title||data.summary?'planned':'empty'}).eq('id',state.activeDay.id); if(r.error)return message(r.error.message);
  Object.assign(state.activeDay,{title:data.title,summary:data.summary,photo_url:data.photo_url,status:data.title||data.summary?'planned':'empty'}); state.route='trip'; render();
}
async function clearDay(){
  if(!confirm('Limpar toda a programação deste dia? A data continuará na viagem.'))return;
  const r=await supabase.from('activities').delete().eq('day_id',state.activeDay.id); if(r.error)return message(r.error.message);
  const d=await supabase.from('trip_days').update({title:null,summary:null,photo_url:null,status:'empty'}).eq('id',state.activeDay.id); if(d.error)return message(d.error.message);
  state.activeDay.title=null;state.activeDay.summary=null;state.activeDay.photo_url=null;state.activeDay.status='empty';state.activities=[];state.route='trip';render();
}
async function saveTrip(){
  const w=state.wizard; const t=themes.find(x=>x.id===w.theme); const basic=w.basic; if(!basic) return;
  if(new Date(basic.end_date)<new Date(basic.start_date)) return message('A data final precisa ser igual ou posterior à inicial.');
  const {data:trip,error}=await supabase.from('trips').insert({user_id:state.user.id,name:basic.name,destination:basic.destination,start_date:basic.start_date,end_date:basic.end_date,arrival_method:basic.arrival_method,location_label:basic.location_label,theme_id:t.id,primary_color:t.primary,secondary_color:t.secondary}).select().single();
  if(error) return message(error.message);
  const membership=await supabase.from('trip_members').insert({trip_id:trip.id,user_id:state.user.id,role:'owner'}); if(membership.error) return message(membership.error.message);
  const passengers=(w.passengerData||[]).filter(p=>p.name).map(p=>({trip_id:trip.id,name:p.name,age:p.age?Number(p.age):null,gender:p.gender||null})); if(passengers.length) await supabase.from('passengers').insert(passengers);
  const days=[]; for(let d=new Date(`${basic.start_date}T12:00:00`),i=1;d<=new Date(`${basic.end_date}T12:00:00`);d.setDate(d.getDate()+1),i++) days.push({trip_id:trip.id,day_number:i,date:d.toISOString().slice(0,10),status:'empty'}); if(days.length) await supabase.from('trip_days').insert(days);
  await loadTrips(); state.route='home'; render();
}
function message(text){ const el=document.querySelector('[data-message]'); if(el) el.textContent=text; }
document.addEventListener('click',async e=>{const a=e.target.closest('[data-action]');if(!a)return;const action=a.dataset.action;
  if(action==='signup'){const email=prompt('Seu e-mail:');const password=prompt('Crie uma senha com pelo menos 6 caracteres:');if(!email||!password)return;const r=await supabase.auth.signUp({email,password,options:{emailRedirectTo:window.location.origin+window.location.pathname}});if(r.error)message(r.error.message);else message('Conta criada. Confira seu e-mail para confirmar o acesso.');}
  if(action==='logout'){await supabase.auth.signOut();state.user=null;state.trips=[];render();}
  if(action==='open-trip'){await openTrip(a.dataset.id);}
  if(action==='open-day'){await openDay(a.dataset.id);}
  if(action==='back-home'){state.route='home';render();}
  if(action==='back-trip'){state.route='trip';render();}
  if(action==='clear-day'){await clearDay();}
  if(action==='new-activity'){const title=prompt('Nome da atividade:');if(!title||!title.trim())return;const r=await supabase.from('activities').insert({day_id:state.activeDay.id,period:a.dataset.period,position:state.activities.length,title:title.trim()}).select().single();if(r.error)return message(r.error.message);state.activities.push(r.data);render();}
  if(action==='new-trip'){state.route='wizard';state.wizard={step:1,passengers:1,theme:'classic',passengerData:[]};render();}
  if(action==='cancel-wizard'){state.route='home';render();}
  if(action==='next-step'){if(state.wizard.step===1){const f=document.querySelector('[data-form="basic"]');const data=Object.fromEntries(new FormData(f));state.wizard.basic=data;}state.wizard.step++;render();}
  if(action==='prev-step'){state.wizard.step--;render();}
  if(action==='add-passenger'){state.wizard.passengers++;render();}
  if(action==='remove-passenger'){state.wizard.passengers--;render();}
  if(action==='choose-theme'){state.wizard.theme=a.dataset.theme;setTheme(themes.find(t=>t.id===state.wizard.theme));render();}
  if(action==='save-trip'){await saveTrip();}
});
document.addEventListener('input',e=>{if(e.target.dataset.passenger){const i=Number(e.target.dataset.index);state.wizard.passengerData=state.wizard.passengerData||[];state.wizard.passengerData[i]=state.wizard.passengerData[i]||{};state.wizard.passengerData[i][e.target.dataset.passenger]=e.target.value;}});
document.addEventListener('submit',async e=>{if(e.target.dataset.form!=='auth')return;e.preventDefault();const data=Object.fromEntries(new FormData(e.target));const r=await supabase.auth.signInWithPassword(data);if(r.error)return message(r.error.message);state.user=r.data.user;await loadTrips();render();});
document.addEventListener('submit',async e=>{if(e.target.dataset.form!=='day')return;e.preventDefault();await saveDay(e.target);});
async function boot(){const {data}=await supabase.auth.getSession();if(data.session){state.user=data.session.user;try{await loadTrips();}catch(e){message(e.message);}}render();}
supabase.auth.onAuthStateChange((_event,session)=>{if(session&&!state.user){state.user=session.user;loadTrips().then(render);}});boot();
