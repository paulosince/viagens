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
let state = { user:null, trips:[], route:'home', activeTrip:null, days:[], activeDay:null, activities:[], checklist:[], budget:[], activityForm:null, dayEditDraft:null, photoSuggestions:[], photoSearch:{page:1,loading:false,hasMore:true,timer:null}, showPhotoUrl:false, editingBudgetId:null, editingDay:false, wizard:{step:1, passengers:1, theme:'classic'} };
let transitionDirection='none';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const formatDate = value => value ? new Intl.DateTimeFormat('pt-BR',{dateStyle:'medium'}).format(new Date(`${value}T12:00:00`)) : '';
function setTheme(theme){ document.documentElement.style.setProperty('--primary',theme.primary); document.documentElement.style.setProperty('--secondary',theme.secondary); }
function shell(content){ const direction=transitionDirection; transitionDirection='none'; const back=['trip','day','checklist','budget'].includes(state.route)?`<button class="btn ghost top-back" data-action="${state.route==='trip'?'back-home':'back-trip'}">← ${state.route==='trip'?'Minhas viagens':'Book da viagem'}</button>`:'<div class="brand">Viagens</div>'; const nav=state.user&&['trip','day','checklist','budget'].includes(state.route)?appNav():''; return `<main class="shell page-transition page-${direction}"><header class="topbar">${back}${state.user?'<button class="btn ghost" data-action="logout">Sair</button>':''}</header>${content}</main>${nav}`; }
function appNav(){ const active=state.route==='day'?'trip':state.route; return `<nav class="app-nav" aria-label="Navegação da viagem"><button class="app-nav-item ${active==='trip'?'active':''}" data-action="back-trip"><span>⌂</span><small>Roteiro</small></button><button class="app-nav-item ${active==='checklist'?'active':''}" data-action="open-checklist"><span>✓</span><small>Checklist</small></button><button class="app-nav-item ${active==='budget'?'active':''}" data-action="open-budget"><span>R$</span><small>Orçamento</small></button><button class="app-nav-item" data-action="more"><span>•••</span><small>Mais</small></button></nav>`; }
function render(){
  document.body.classList.toggle('is-editing-day', state.route==='day'&&state.editingDay);
  if(!state.user){ app.innerHTML=shell(authView()); return; }
  if(state.route==='wizard'){ app.innerHTML=shell(wizardView()); return; }
  if(state.route==='trip'){ app.innerHTML=shell(bookView()); return; }
  if(state.route==='day'){ app.innerHTML=shell(agendaDayView()); setTimeout(drawDayMap,0); return; }
  if(state.route==='checklist'){ app.innerHTML=shell(checklistView()); return; }
  if(state.route==='budget'){ app.innerHTML=shell(invoiceBudgetView()); return; }
  app.innerHTML=shell(homeView());
}
function authView(){ return `<section class="hero"><span class="eyebrow">SEUS BOOKS DE VIAGEM</span><h1>Planeje.<br>Viva.<br>Relembre.</h1><p>Crie viagens com roteiro, mapa, fotos, orçamento e checklist em um único lugar.</p></section><section class="card"><div class="section-row"><div><span class="eyebrow">ACESSO</span><h2 class="section-title">Entrar na sua conta</h2></div></div><form data-form="auth" class="grid"><div class="field"><label>E-mail</label><input name="email" type="email" required autocomplete="email"></div><div class="field"><label>Senha</label><input name="password" type="password" required minlength="6" autocomplete="current-password"></div><div><button class="btn primary" type="submit">Entrar</button><button class="btn ghost" type="button" data-action="signup">Criar conta</button></div><p class="message" data-message></p></form></section>`; }
function homeView(){
  if(!state.trips.length) return `<section class="hero"><span class="eyebrow">BEM-VINDO</span><h1>Crie o seu<br>primeiro Book.</h1><p>Comece pelas informações básicas da viagem. Depois, vamos construir cada dia juntos.</p></section><section class="card empty"><h2>Nenhuma viagem ainda</h2><p class="muted">Sua próxima história começa com um destino.</p><button class="btn primary" data-action="new-trip">＋ Criar viagem</button></section>`;
  return `<section class="section-row"><div><span class="eyebrow">MINHAS VIAGENS</span><h1 class="section-title">Seus Books</h1></div><button class="btn primary" data-action="new-trip">＋ Nova viagem</button></section><section class="grid trip-grid">${state.trips.map(trip=>`<article class="card trip-card"><div class="trip-cover" style="background-image:url('${esc(trip.cover_url||'')}')"></div><div class="trip-body"><span class="eyebrow">${esc(formatDate(trip.start_date))} — ${esc(formatDate(trip.end_date))}</span><h3>${esc(trip.name)}</h3><p class="muted">${esc(trip.destination||'Destino a definir')}</p><button class="btn" data-action="open-trip" data-id="${trip.id}">Abrir Book →</button></div></article>`).join('')}</section>`;
}
function bookView(){
  const t=state.activeTrip;
  return `<section class="book-head"><span class="eyebrow">BOOK DA VIAGEM</span><h1 class="section-title">${esc(t.name)}</h1><p class="muted">${esc(t.destination)} · ${esc(formatDate(t.start_date))} — ${esc(formatDate(t.end_date))}</p></section><section class="grid day-grid">${state.days.map(day=>`<article class="card day-card ${day.status==='empty'?'empty-day':''}"><div class="day-card-image" style="background-image:url('${esc(day.photo_url||t.cover_url||'')}')"></div><div class="day-card-body"><span class="eyebrow">DIA ${day.day_number} · ${esc(formatDate(day.date))}</span><h2>${esc(day.title||'Dia sem programação')}</h2><p class="muted">${esc(day.summary||'Este dia ainda não tem programação. Crie manhã, tarde e noite.')}</p><button class="btn ${day.status==='empty'?'primary':''}" data-action="open-day" data-id="${day.id}">${day.status==='empty'?'＋ Preencher dia':'Abrir dia →'}</button></div></article>`).join('')}</section><section class="support-grid"><button class="card support-card" data-action="open-checklist"><span class="support-icon">✓</span><div><span class="eyebrow">ORGANIZAÇÃO</span><h2>Checklist</h2><p class="muted">${state.checklist.filter(i=>i.completed).length}/${state.checklist.length||0} tarefas concluídas</p></div><span>→</span></button><button class="card support-card" data-action="open-budget"><span class="support-icon">R$</span><div><span class="eyebrow">PLANEJAMENTO</span><h2>Orçamento</h2><p class="muted">Acompanhe previsto e realizado</p></div><span>→</span></button></section>`;
}
function dayView(){
  const d=state.activeDay, t=state.activeTrip;
  const periods=[['morning','MANHÃ'],['afternoon','TARDE'],['night','NOITE']];
  return `<section class="book-head"><span class="eyebrow">DIA ${d.day_number} · ${esc(formatDate(d.date))}</span><h1 class="section-title">${esc(d.title||'Dia sem programação')}</h1><p class="muted">${esc(t.name)}</p></section><section class="card day-editor"><form data-form="day" class="form-grid"><div class="field full"><label>Título do dia</label><input name="title" value="${esc(d.title||'')}" placeholder="Ex.: Torre Eiffel e o Sena"></div><div class="field full"><label>Resumo</label><input name="summary" value="${esc(d.summary||'')}" placeholder="Uma frase para apresentar este dia no Book"></div><div class="field full"><label>Foto do dia (opcional)</label><input name="photo_url" value="${esc(d.photo_url||'')}" placeholder="Cole uma URL de imagem por enquanto"></div><div><button class="btn primary" type="submit">Salvar informações</button></div></form><div class="divider"></div>${periods.map(([key,label])=>`<section class="period"><div class="section-row"><h2>${label}</h2><button class="btn" type="button" data-action="new-activity" data-period="${key}">＋ Atividade</button></div>${state.activities.filter(a=>a.period===key).map(a=>`<article class="activity"><strong>${esc(a.starts_at?String(a.starts_at).slice(11,16)+' · ':'')}${esc(a.title)}</strong><p class="muted">${esc(a.place_name||'Local a definir')} · ${esc(a.description||'')}</p></article>`).join('')||'<p class="muted">Nenhuma atividade cadastrada.</p>'}</section>`).join('')}<div class="danger-zone"><button class="btn ghost" type="button" data-action="clear-day">Limpar programação deste dia</button></div></section>`;
}
function readableDayView(){
  const d=state.activeDay, t=state.activeTrip, periods=[['morning','MANHÃ'],['afternoon','TARDE'],['night','NOITE']];
  const hero=d.photo_url||t.cover_url||'';
  const edit=state.editingDay?`<section class="card day-editor"><form data-form="day" class="form-grid"><div class="field full"><label>Título do dia</label><input name="title" value="${esc(d.title||'')}" placeholder="Ex.: Torre Eiffel e o Sena"></div><div class="field full"><label>Resumo</label><input name="summary" value="${esc(d.summary||'')}" placeholder="Uma frase para apresentar este dia no Book"></div><div class="field full"><label>Foto do dia (opcional)</label><input name="photo_url" value="${esc(d.photo_url||'')}" placeholder="Cole uma URL de imagem por enquanto"></div><div><button class="btn primary" type="submit">Salvar informações</button><button class="btn ghost" type="button" data-action="cancel-edit-day">Cancelar</button></div></form></section>`:'';
  return `<section class="day-hero" style="background-image:linear-gradient(180deg,rgba(20,33,43,.08),rgba(20,33,43,.84)),url('${esc(hero)}')"><div class="day-hero-top"><span class="eyebrow">DIA ${d.day_number} · ${esc(formatDate(d.date))}</span><button class="edit-pencil" type="button" data-action="edit-day" aria-label="Editar dia">✎</button></div><div class="day-hero-copy"><h1>${esc(d.title||'Dia sem programação')}</h1><p>${esc(t.name)}${d.summary?' · '+esc(d.summary):''}</p></div></section>${edit}<section class="card day-content">${periods.map(([key,label])=>`<section class="period"><div class="section-row"><h2>${label}</h2>${state.editingDay?`<button class="btn" type="button" data-action="new-activity" data-period="${key}">＋ Atividade</button>`:''}</div>${state.activities.filter(a=>a.period===key).map(a=>`<article class="activity"><strong>${esc(a.starts_at?String(a.starts_at).slice(11,16)+' · ':'')}${esc(a.title)}</strong><p class="muted">${esc(a.place_name||'Local a definir')} · ${esc(a.description||'')}</p></article>`).join('')||'<p class="muted">Nenhuma atividade cadastrada.</p>'}</section>`).join('')}<div class="danger-zone">${state.editingDay?'<button class="btn ghost" type="button" data-action="clear-day">Limpar programação deste dia</button>':'<span class="muted">Toque no lápis para editar este dia.</span>'}</div></section>`;
}


function periodForTime(time){
  const hour=Number(String(time||'').slice(0,2));
  if(!Number.isFinite(hour))return 'morning';
  return hour<12?'morning':hour<18?'afternoon':'night';
}
function periodLabel(period){
  return period==='morning'?'Manhã':period==='afternoon'?'Tarde':'Noite';
}
function dayEditorView(){
  const d=state.activeDay, draft=state.dayEditDraft||d, suggestions=state.photoSuggestions||[];
  const photos=suggestions.length?suggestions.map((p,i)=>'<button type="button" class="photo-suggestion '+(draft.photo_url===p.url?'selected':'')+'" data-action="choose-day-photo" data-index="'+i+'"><img src="'+esc(p.thumb)+'" alt="'+esc(p.title)+'"><span>'+esc(p.title)+'</span></button>').join(''):'<p class="muted">Informe o local principal e toque em “Buscar fotos”.</p>';
  const activities=(state.editingDay?(draft.activities||[]):state.activities).slice().sort((a,b)=>(a.starts_at||'99').localeCompare(b.starts_at||'99'));
  const editorDate=new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'numeric',month:'long'}).format(new Date(d.date+'T12:00:00'));
  const agenda=activities.length?activities.map(a=>'<div class="reminder-item"><button type="button" class="sheet-agenda-row reminder-row" data-action="edit-activity" data-id="'+a.id+'"><span class="reminder-circle" aria-hidden="true"></span><span class="reminder-content"><strong>'+esc(a.starts_at?String(a.starts_at).slice(11,16)+' · ':'')+esc(a.title||'Nova entrada')+'</strong><small>'+esc(a.place_name||'Local a definir')+'</small></span><span class="reminder-info" aria-hidden="true">ⓘ</span></button>'+(state.activityForm&&state.activityForm.id===a.id?activityEditor():'')+'</div>').join(''):'<p class="muted">Nenhuma entrada ainda.</p>';
  const newEditor=state.activityForm&&!state.activityForm.id?activityEditor():'';
  if(!state.editingDay)return '';
  return '<div class="edit-sheet-backdrop"><section class="edit-sheet" role="dialog" aria-modal="true" aria-label="Editar dia" data-stop-click="true"><header class="sheet-header"><button type="button" class="sheet-close" data-action="cancel-edit-day" aria-label="Cancelar"><span class="close-icon" aria-hidden="true"></span></button><h2>'+esc(editorDate)+'</h2><button type="button" data-action="save-day-draft" class="sheet-done" aria-label="Salvar">✓</button></header><section class="sheet-form" aria-label="Detalhes do dia"><div class="sheet-section day-details-section"><label>Detalhes do dia</label><input name="title" data-draft-day value="'+esc(draft.title||'')+'" placeholder="Título do dia"><input name="main_place_name" data-draft-day data-photo-query value="'+esc(draft.main_place_name||'')+'" placeholder="Local principal"><small>O local principal sugere a foto de capa.</small><div class="photo-suggestions" id="photo-results" data-photo-scroll="true">'+photos+'</div><div class="photo-actions"><button type="button" class="btn" data-action="search-day-photos">Buscar fotos</button><button type="button" class="btn ghost" data-action="toggle-photo-url">'+(state.showPhotoUrl?'Ocultar URL específica':'Usar uma URL específica')+'</button></div>'+(state.showPhotoUrl?'<input name="photo_url" data-draft-day value="'+esc(draft.photo_url||'')+'" placeholder="URL da imagem">':'')+'<textarea name="summary" data-draft-day rows="3" placeholder="Resumo do dia">'+esc(draft.summary||'')+'</textarea></div><section class="sheet-section agenda-sheet-section"><div class="sheet-section-heading"><div><label>Agenda do dia</label><small>Toque em uma entrada para editar.</small></div><button type="button" class="btn" data-action="new-activity" data-period="morning">＋ Entrada</button></div>'+agenda+newEditor+'</section></section></section></div>';
}
function activityEditor(){
  const draft=state.dayEditDraft||{}, a=(draft.activities||[]).find(x=>x.id===state.activityForm?.id)||state.activityForm||{};
  const time=a.starts_at?String(a.starts_at).slice(11,16):'';
  return '<form id="activity-edit-form" class="activity-editor card" data-form="activity" novalidate><div class="section-row"><div><span class="eyebrow">AGENDA DO DIA</span><h3>Editar entrada</h3></div></div><div class="ios-activity-fields"><div class="field"><label>Horário</label><input name="time" data-draft-activity type="time" value="'+esc(time)+'"><small>Período: '+esc(periodLabel(periodForTime(time)))+'</small></div><div class="field full"><label>Texto principal</label><input name="title" data-draft-activity value="'+esc(a.title||'')+'" placeholder="Ex.: Chegada ao Hotel Jardim Lisboa"></div><div class="field full"><label>Locais</label><input name="place_name" data-draft-activity value="'+esc(a.place_name||'')+'" placeholder="Selecione tags de locais"><small>Você poderá adicionar locais reconhecidos pelo mapa.</small></div><div class="field full"><label>Detalhes</label><textarea name="description" data-draft-activity rows="5" placeholder="Descreva o que faremos...">'+esc(a.description||'')+'</textarea></div></div></form>';
}
function agendaDayView(){
  const d=state.activeDay, t=state.activeTrip, periods=[['morning','MANHÃ'],['afternoon','TARDE'],['night','NOITE']], hero=d.photo_url||t.cover_url||'', edit=dayEditorView(), items=state.activities.slice().sort((a,b)=>(a.starts_at||'99').localeCompare(b.starts_at||'99'));
  const periodHtml=periods.map(([key,label])=>{const p=items.filter(a=>a.period===key);const rows=p.map(a=>'<article class="timeline-item"><time>'+(a.starts_at?esc(String(a.starts_at).slice(11,16)):'—')+'</time><div><strong>'+esc(a.title)+'</strong><p class="muted">'+esc(a.place_name||'Local a definir')+'</p><p>'+esc(a.description||'')+'</p>'+(a.meal?'<small>🍽 '+esc(a.meal)+'</small>':'')+(a.transport?'<small>↔ '+esc(a.transport)+'</small>':'')+(a.shopping_items?'<small>🛍 '+esc(a.shopping_items)+'</small>':'')+(a.notes?'<small>✦ '+esc(a.notes)+'</small>':'')+(state.editingDay?'<div class="activity-actions"><button class="btn ghost" type="button" data-action="edit-activity" data-id="'+a.id+'">Editar</button><button class="btn ghost danger" type="button" data-action="delete-activity" data-id="'+a.id+'">Excluir</button></div>':'')+'</div></article>').join('')||'<p class="muted">Nenhuma atividade cadastrada.</p>';return '<section class="period"><div class="section-row"><h3>'+label+'</h3>'+(state.editingDay?'<button class="btn" type="button" data-action="new-activity" data-period="'+key+'">＋ Entrada</button>':'')+'</div>'+rows+'</section>';}).join('');
  return '<section class="day-hero" style="background-image:linear-gradient(180deg,rgba(20,33,43,.08),rgba(20,33,43,.84)),url(\''+esc(hero)+'\')"><div class="day-hero-top"><span class="eyebrow">DIA '+d.day_number+' · '+esc(new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'numeric',month:'long'}).format(new Date(d.date+'T12:00:00')) )+'</span><button class="edit-pencil" type="button" data-action="edit-day" aria-label="Editar dia">✎</button></div><div class="day-hero-copy"><h1>'+esc(d.title||'Dia sem programação')+'</h1><p>'+esc(t.name)+(d.summary?' · '+esc(d.summary):'')+'</p></div></section><div class="day-scroll-header"><span class="eyebrow">DIA '+d.day_number+' · '+esc(new Intl.DateTimeFormat('pt-BR',{weekday:'short',day:'numeric',month:'short'}).format(new Date(d.date+'T12:00:00')) )+'</span><strong>'+esc(d.title||'Dia sem programação')+'</strong><button class="edit-pencil small" data-action="'+(state.editingDay?'cancel-edit-day':'edit-day')+'" aria-label="'+(state.editingDay?'Cancelar edição':'Editar dia')+'">'+(state.editingDay?'×':'✎')+'</button></div>'+edit+'<section class="map-panel card"><div class="section-row"><div><span class="eyebrow">DESLOCAMENTOS</span><h2>Mapa do dia</h2></div><span class="muted">'+items.filter(i=>i.latitude&&i.longitude).length+' pontos</span></div><div id="day-map" class="day-map"><div class="map-empty">Adicione latitude e longitude às atividades para visualizar os pontos do dia.</div></div></section><section class="card day-content agenda-content"><div class="section-row"><div><span class="eyebrow">AGENDA</span><h2>O que faremos</h2></div>'+(state.editingDay?'<span class="muted">Use + para adicionar uma entrada</span>':'')+'</div>'+periodHtml+'<div class="danger-zone">'+(state.editingDay?'<button class="btn ghost" type="button" data-action="clear-day">Limpar programação deste dia</button>':'<span class="muted">Toque no lápis para editar este dia.</span>')+'</div></section>';
}
function drawDayMap(){
  const el=document.querySelector('#day-map'); if(!el||!window.L)return;
  const points=state.activities.filter(a=>a.latitude&&a.longitude).map(a=>({lat:Number(a.latitude),lng:Number(a.longitude),title:a.title})); if(!points.length)return;
  el.innerHTML=''; const map=window.L.map(el,{scrollWheelZoom:false}).setView([points[0].lat,points[0].lng],13); window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors'}).addTo(map); const bounds=[];points.forEach(p=>{window.L.marker([p.lat,p.lng]).addTo(map).bindPopup(p.title);bounds.push([p.lat,p.lng]);}); if(points.length>1)map.fitBounds(bounds,{padding:[25,25]});
}
function checklistView(){
  const done=state.checklist.filter(i=>i.completed).length;
  return `<section class="book-head"><span class="eyebrow">ORGANIZAÇÃO</span><h1 class="section-title">Checklist</h1><p class="muted">${esc(state.activeTrip.name)} · ${done} de ${state.checklist.length} concluídas</p></section><section class="card checklist-list">${state.checklist.length?state.checklist.map(item=>`<label class="check-item ${item.completed?'is-done':''}"><input type="checkbox" data-action="toggle-check" data-id="${item.id}" ${item.completed?'checked':''}><span><strong>${esc(item.label)}</strong>${item.due_at?`<small>Prazo: ${esc(formatDate(item.due_at.slice(0,10)))}</small>`:''}</span></label>`).join(''):'<p class="muted">Nenhuma tarefa cadastrada ainda.</p>'}</section>`;
}
function budgetView(){
  const planned=state.budget.reduce((s,i)=>s+Number(i.planned_amount||0),0), actual=state.budget.reduce((s,i)=>s+Number(i.actual_amount||0),0);
  return `<section class="book-head"><span class="eyebrow">PLANEJAMENTO</span><h1 class="section-title">Orçamento</h1><p class="muted">${esc(state.activeTrip.name)} · valores na moeda registrada</p></section><section class="budget-summary"><div class="card"><span class="eyebrow">PREVISTO</span><strong>R$ ${planned.toLocaleString('pt-BR',{minimumFractionDigits:2})}</strong></div><div class="card"><span class="eyebrow">REALIZADO</span><strong>R$ ${actual.toLocaleString('pt-BR',{minimumFractionDigits:2})}</strong></div><div class="card"><span class="eyebrow">DIFERENÇA</span><strong>R$ ${(planned-actual).toLocaleString('pt-BR',{minimumFractionDigits:2})}</strong></div></section><section class="card budget-list">${state.budget.length?state.budget.map(item=>`<article class="budget-item"><div><strong>${esc(item.label)}</strong><small>${esc(item.category||'Sem categoria')} · ${esc(item.purchase_status)}</small></div><div class="budget-values"><span>R$ ${Number(item.planned_amount||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</span><small>realizado: R$ ${Number(item.actual_amount||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</small></div></article>`).join(''):'<p class="muted">Nenhum item de orçamento cadastrado ainda.</p>'}</section>`;
}
function invoiceBudgetView(){
  const planned=state.budget.reduce((s,i)=>s+Number(i.planned_amount||0),0), actual=state.budget.reduce((s,i)=>s+Number(i.actual_amount||0),0), diff=planned-actual;
  const groups=[...new Set(state.budget.map(i=>i.category||'Outros'))];
  const brl=value=>`R$ ${Number(value||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}`;
  const diffClass=diff>=0?'positive':'negative', diffText=`${diff>=0?'+':''}${brl(diff)}`;
  return `<section class="book-head"><span class="eyebrow">PLANEJAMENTO</span><h1 class="section-title">Orçamento</h1><p class="muted">${esc(state.activeTrip.name)}</p></section><section class="budget-sticky card"><div><span class="eyebrow">TOTAL PREVISTO</span><strong>${brl(planned)}</strong></div><div><span class="eyebrow">REALIZADO</span><strong>${brl(actual)}</strong></div><div class="${diffClass}"><span class="eyebrow">${diff>=0?'ECONOMIA':'ACIMA DO ORÇADO'}</span><strong>${diffText}</strong></div></section><section class="card invoice">${groups.map(group=>`<section class="invoice-section"><div class="invoice-section-head"><span>${esc(group)}</span><span>Previsto · Realizado</span></div>${state.budget.filter(i=>(i.category||'Outros')===group).map(item=>{const over=item.actual_amount!==null&&Number(item.actual_amount)>Number(item.planned_amount||0);return `<article class="invoice-row ${state.editingBudgetId===item.id?'is-editing':''}" data-action="edit-budget" data-id="${item.id}"><div><strong>${esc(item.label)}</strong><small class="purchase-status ${item.actual_amount!==null?'purchased':'not-purchased'}"><span>${item.actual_amount!==null?'✓':'○'}</span>${item.actual_amount!==null?'Comprado':'Não comprado'}</small></div><div class="invoice-values"><span>${brl(item.planned_amount)}</span><span class="${over?'negative':'realized'}">${item.actual_amount===null?'—':brl(item.actual_amount)}</span></div></article>${state.editingBudgetId===item.id?`<form class="budget-edit-form" data-form="budget"><label>Valor pago</label><div class="budget-edit-line"><input name="actual_amount" type="number" min="0" step="0.01" value="${item.actual_amount??''}" placeholder="0,00"><button class="btn primary" type="submit">Salvar</button><button class="btn ghost" type="button" data-action="cancel-budget">Cancelar</button></div></form>`:''}`;}).join('')}</section>`).join('')||'<p class="muted">Nenhum item de orçamento cadastrado ainda.</p>'}</section>`;
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
  state.days=r.data||[];
  const c=await supabase.from('checklist_items').select('id,completed').eq('trip_id',id); state.checklist=c.data||[];
  state.route='trip'; render();
}
async function openDay(id){
  state.activeDay=state.days.find(d=>d.id===id); if(!state.activeDay)return;
  const r=await supabase.from('activities').select('*').eq('day_id',id).order('position'); if(r.error)return message(r.error.message);
  state.activities=r.data||[]; state.activityForm=null; state.dayEditDraft=null; state.photoSuggestions=[]; state.showPhotoUrl=false; state.editingDay=false; state.route='day'; render();
}
async function openChecklist(){ const r=await supabase.from('checklist_items').select('*').eq('trip_id',state.activeTrip.id).order('completed').order('label'); if(r.error)return message(r.error.message);state.checklist=r.data||[];state.route='checklist';render(); }
async function openBudget(){ const r=await supabase.from('budget_items').select('*').eq('trip_id',state.activeTrip.id).order('category').order('label'); if(r.error)return message(r.error.message);state.budget=r.data||[];state.route='budget';render(); }
async function toggleChecklist(id,checked){ const r=await supabase.from('checklist_items').update({completed:checked}).eq('id',id); if(r.error)return message(r.error.message);const item=state.checklist.find(i=>i.id===id);if(item)item.completed=checked;render(); }
async function saveBudget(form){ const amount=form.actual_amount.value===''?null:Number(form.actual_amount.value); const r=await supabase.from('budget_items').update({actual_amount:amount,purchase_status:amount===null?'pending':'purchased'}).eq('id',state.editingBudgetId); if(r.error)return message(r.error.message);const item=state.budget.find(i=>i.id===state.editingBudgetId);if(item){item.actual_amount=amount;item.purchase_status=amount===null?'pending':'purchased';}state.editingBudgetId=null;render(); }
function shoppingRows(activity){
  return (activity.shopping_items||'').split('\n').map(x=>x.trim()).filter(Boolean).map(line=>{
    const parts=line.split('|'), amount=parts[1]?Number(parts[1].replace(',','.').replace(/[^\d.]/g,'')):null;
    return {trip_id:state.activeTrip.id,activity_id:activity.id,label:parts[0].trim(),category:'Compras da agenda',planned_amount:Number.isFinite(amount)?amount:null,currency:'BRL',purchase_status:'pending'};
  });
}
async function saveDayDraft(){
  const draft=state.dayEditDraft;
  if(!draft)return;
  for(const activity of (draft.activities||[])){if(!String(activity.title||'').trim())return message('Preencha o texto principal de todas as entradas da agenda.');}
  const dayPayload={title:draft.title||null,summary:draft.summary||null,photo_url:draft.photo_url||null,main_place_name:draft.main_place_name||null,status:draft.title||draft.summary||draft.main_place_name?'planned':'empty'};
  const dayResult=await supabase.from('trip_days').update(dayPayload).eq('id',state.activeDay.id);
  if(dayResult.error)return message(dayResult.error.message);
  for(const id of (draft.deletedActivityIds||[])){
    const removedBudget=await supabase.from('budget_items').delete().eq('activity_id',id); if(removedBudget.error)return message(removedBudget.error.message);
    const removed=await supabase.from('activities').delete().eq('id',id); if(removed.error)return message(removed.error.message);
  }
  const saved=[];
  for(const activity of (draft.activities||[])){
    const startsAt=activity.starts_at||null;
    const payload={day_id:state.activeDay.id,period:activity.period||'morning',position:activity.position||0,title:activity.title||'',place_name:activity.place_name||null,description:activity.description||null,shopping_items:activity.shopping_items||null,meal:activity.meal||null,transport:activity.transport||null,notes:activity.notes||null,latitude:activity.latitude||null,longitude:activity.longitude||null,starts_at:startsAt};
    const isNew=String(activity.id).startsWith('new-');
    const result=isNew?await supabase.from('activities').insert(payload).select().single():await supabase.from('activities').update(payload).eq('id',activity.id).select().single();
    if(result.error)return message(result.error.message);
    const savedActivity=result.data;
    const removedBudget=await supabase.from('budget_items').delete().eq('activity_id',savedActivity.id); if(removedBudget.error)return message(removedBudget.error.message);
    const shopping=shoppingRows({...activity,id:savedActivity.id}); if(shopping.length){const added=await supabase.from('budget_items').insert(shopping);if(added.error)return message(added.error.message);}
    saved.push(savedActivity);
  }
  Object.assign(state.activeDay,dayPayload); state.activities=saved; state.dayEditDraft=null; state.editingDay=false; state.activityForm=null; state.photoSuggestions=[]; state.showPhotoUrl=false; render();
}
async function searchDayPhotos(reset=false){
  const place=(state.dayEditDraft&&state.dayEditDraft.main_place_name||'').trim(); if(!place)return;
  if(reset){state.photoSuggestions=[];state.photoSearch={page:1,loading:false,hasMore:true,timer:null};}
  if(state.photoSearch.loading||!state.photoSearch.hasMore)return;
  state.photoSearch.loading=true;
  const params=new URLSearchParams({tags:place,tagmode:'all',format:'json',nojsoncallback:'1',page:String(state.photoSearch.page)});
  try{
    const response=await fetch('https://www.flickr.com/services/feeds/photos_public.gne?'+params.toString()),json=await response.json();
    const results=(json.items||[]).map(p=>({url:(p.media&&p.media.m||'').replace('_m.','_b.'),thumb:p.media&&p.media.m,title:p.title||place,creator:p.author||''})).filter(p=>p.url&&p.thumb);
    const unique=results.filter(p=>!state.photoSuggestions.some(old=>old.thumb===p.thumb));
    state.photoSuggestions=reset?unique:state.photoSuggestions.concat(unique);
    state.photoSearch.page+=1; state.photoSearch.hasMore=unique.length>0&&state.photoSearch.page<=5;
  }catch(error){state.photoSearch.hasMore=false;message('Não foi possível buscar fotos agora. Você pode usar uma URL específica.');}
  state.photoSearch.loading=false; render();
}

async function deleteActivity(id){
  if(!confirm('Excluir esta entrada da agenda?'))return;
  const r=await supabase.from('activities').delete().eq('id',id); if(r.error)return message(r.error.message); await supabase.from('budget_items').delete().eq('activity_id',id); state.activities=state.activities.filter(a=>a.id!==id); state.activityForm=null; render();
}
function clearDay(){
  if(!confirm('Limpar toda a programação deste dia? A data continuará na viagem.'))return;
  if(!state.dayEditDraft)return;
  state.dayEditDraft.title=null;state.dayEditDraft.summary=null;state.dayEditDraft.photo_url=null;state.dayEditDraft.main_place_name=null;state.dayEditDraft.deletedActivityIds=(state.dayEditDraft.activities||[]).filter(x=>!String(x.id).startsWith('new-')).map(x=>x.id);state.dayEditDraft.activities=[];state.activityForm=null;state.photoSuggestions=[];render();
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
document.addEventListener('click',async e=>{const a=e.target.closest('button[data-action]');if(!a)return;if(a.classList.contains('reminder-row')&&a.closest('.reminder-swipe')?.classList.contains('swiped')){a.closest('.reminder-swipe').classList.remove('swiped');return;}const action=a.dataset.action;if(a.closest('.edit-sheet')&&action!=='cancel-edit-day'&&action!=='save-day-draft'&&action!=='edit-activity'&&action!=='new-activity'&&action!=='search-day-photos'&&action!=='choose-day-photo'&&action!=='toggle-photo-url'&&action!=='cancel-activity')return;
  if(action==='signup'){const email=prompt('Seu e-mail:');const password=prompt('Crie uma senha com pelo menos 6 caracteres:');if(!email||!password)return;const r=await supabase.auth.signUp({email,password,options:{emailRedirectTo:window.location.origin+window.location.pathname}});if(r.error)message(r.error.message);else message('Conta criada. Confira seu e-mail para confirmar o acesso.');}
  if(action==='logout'){await supabase.auth.signOut();state.user=null;state.trips=[];render();}
  if(action==='open-trip'){transitionDirection='forward';await openTrip(a.dataset.id);}
  if(action==='open-day'){transitionDirection='forward';await openDay(a.dataset.id);}
  if(action==='open-checklist'){transitionDirection='forward';await openChecklist();}
  if(action==='open-budget'){transitionDirection='forward';await openBudget();}
  if(action==='toggle-check'){await toggleChecklist(a.dataset.id,a.checked);}
  if(action==='edit-budget'){state.editingBudgetId=a.dataset.id;render();}
  if(action==='cancel-budget'){state.editingBudgetId=null;render();}
  if(action==='more'){alert('Compartilhamento, passageiros e configurações entrarão nesta área.');}
  if(action==='edit-day'){state.editingDay=true;state.activityForm=null;state.dayEditDraft={...state.activeDay,activities:state.activities.map(a=>({...a})),deletedActivityIds:[]};render();if(state.dayEditDraft.main_place_name)await searchDayPhotos(true);}
  if(action==='cancel-edit-day'){state.editingDay=false;state.activityForm=null;state.dayEditDraft=null;state.photoSuggestions=[];render();}
  if(action==='back-home'){transitionDirection='back';state.route='home';render();}
  if(action==='back-trip'){transitionDirection='back';state.route='trip';render();}
  if(action==='clear-day'){await clearDay();}
  if(action==='new-activity'){const id='new-'+Date.now();state.dayEditDraft.activities.push({id,day_id:state.activeDay.id,period:a.dataset.period||'morning',position:state.dayEditDraft.activities.length,title:'',place_name:null,description:null,shopping_items:null,meal:null,transport:null,notes:null,starts_at:null});state.activityForm={id};render();}
  if(action==='edit-activity'){state.activityForm={id:a.dataset.id};render();}
  
  if(action==='choose-day-photo'){state.dayEditDraft=state.dayEditDraft||{};state.dayEditDraft.photo_url=state.photoSuggestions[Number(a.dataset.index)]?.url||'';render();}
  if(action==='toggle-photo-url'){state.showPhotoUrl=!state.showPhotoUrl;render();}
  if(action==='search-day-photos'){await searchDayPhotos();}
  if(action==='cancel-activity'){state.activityForm=null;render();}
  if(action==='new-trip'){transitionDirection='forward';state.route='wizard';state.wizard={step:1,passengers:1,theme:'classic',passengerData:[]};render();}
  if(action==='cancel-wizard'){transitionDirection='back';state.route='home';render();}
  if(action==='next-step'){transitionDirection='forward';if(state.wizard.step===1){const f=document.querySelector('[data-form="basic"]');const data=Object.fromEntries(new FormData(f));state.wizard.basic=data;}state.wizard.step++;render();}
  if(action==='prev-step'){transitionDirection='back';state.wizard.step--;render();}
  if(action==='add-passenger'){state.wizard.passengers++;render();}
  if(action==='remove-passenger'){state.wizard.passengers--;render();}
  if(action==='choose-theme'){state.wizard.theme=a.dataset.theme;setTheme(themes.find(t=>t.id===state.wizard.theme));render();}
  if(action==='save-trip'){await saveTrip();}
});
document.addEventListener('change',async e=>{const field=e.target;if(field.matches('input[data-action="toggle-check"]')){await toggleChecklist(field.dataset.id,field.checked);return;}if(state.editingDay&&field.matches('[data-draft-activity]')&&field.name==='period'&&state.activityForm?.id){const a=(state.dayEditDraft.activities||[]).find(x=>x.id===state.activityForm.id);if(a)a.period=field.value;}});
document.addEventListener('input',e=>{const field=e.target;if(state.editingDay&&field.name){if(field.matches('[data-draft-day]'))state.dayEditDraft[field.name]=field.value;if(field.matches('[data-draft-activity]')&&state.activityForm?.id){const a=(state.dayEditDraft.activities||[]).find(x=>x.id===state.activityForm.id);if(a){if(field.name==='time')a.starts_at=field.value?state.activeDay.date+'T'+field.value+':00':null;else a[field.name]=field.value;}}}if(field.matches('[data-photo-query]')){clearTimeout(state.photoSearch.timer);state.photoSearch.timer=setTimeout(()=>searchDayPhotos(true),450);}if(field.dataset.passenger){const i=Number(field.dataset.index);state.wizard.passengerData=state.wizard.passengerData||[];state.wizard.passengerData[i]=state.wizard.passengerData[i]||{};state.wizard.passengerData[i][field.dataset.passenger]=field.value;}});
document.addEventListener('submit',async e=>{if(e.target.dataset.form!=='auth')return;e.preventDefault();const data=Object.fromEntries(new FormData(e.target));const r=await supabase.auth.signInWithPassword(data);if(r.error)return message(r.error.message);state.user=r.data.user;await loadTrips();render();});
document.addEventListener('submit',async e=>{if(e.target.dataset.form!=='day'&&e.target.dataset.form!=='activity')return;e.preventDefault();await saveDayDraft();});
document.addEventListener('submit',async e=>{if(e.target.dataset.form!=='budget')return;e.preventDefault();await saveBudget(e.target);});
document.addEventListener('scroll',()=>{const el=document.querySelector('#photo-results');if(el&&el.scrollTop+el.clientHeight>=el.scrollHeight-80)searchDayPhotos(false);},true);
async function boot(){const {data}=await supabase.auth.getSession();if(data.session){state.user=data.session.user;try{await loadTrips();}catch(e){message(e.message);}}render();}
supabase.auth.onAuthStateChange((_event,session)=>{if(session&&!state.user){state.user=session.user;loadTrips().then(render);}});boot();
