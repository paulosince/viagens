// Viaggio cash flow: isolated from the legacy planning budget.
export function createCashFlow({panel,clientForTrip,getTrip,canEdit}) {
  let currentTrip = null, rows = [], display = 'EUR', fx = null, fxDate = null, loading = false;
  const money = (v,c='EUR') => new Intl.NumberFormat('pt-BR',{style:'currency',currency:c}).format(Number(v)||0);
  const euro = r => Number(r.amount)*Number(r.exchange_rate_to_eur);
  const el = (tag,cls,text) => { const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n; };
  const dateLocal = d => {const x=new Date(d+'T12:00:00');return x.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});};
  const today = () => new Date().toLocaleDateString('en-CA');
  const css = `
    .cf-root{display:grid;gap:14px;padding:4px 0 28px;color:var(--text-primary,#20242c)}
    .cf-card{background:var(--surface,#fff);border:1px solid rgba(125,135,150,.13);border-radius:18px;padding:17px;box-shadow:0 3px 14px rgba(0,0,0,.045);display:grid;gap:12px}
    .cf-caption{font-size:12px;color:#78818e}.cf-title{font-size:15px;font-weight:700}.cf-big{font-size:29px;font-weight:750;letter-spacing:-.7px;overflow-wrap:anywhere}
    .cf-row{display:flex;align-items:center;justify-content:space-between;gap:10px}.cf-sub{font-size:12px;color:#798391;line-height:1.5}
    .cf-divider{border-top:1px solid rgba(120,130,145,.15)}.cf-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
    .cf-stats strong{font-size:13px;overflow-wrap:anywhere}.cf-green{color:#23966d}.cf-red{color:#d46565}
    .cf-button{border:0;background:#242d3c;color:white;border-radius:10px;padding:10px 13px;font-weight:650}
    .cf-select,.cf-input{border:1px solid #cbd0d8;background:var(--surface,#fff);color:inherit;border-radius:9px;padding:10px;width:100%;min-width:0;font:inherit}
    .cf-line{display:grid;grid-template-columns:32px minmax(0,1fr) auto 24px;gap:9px;align-items:center;padding:9px 0;border-bottom:1px solid rgba(125,135,150,.12)}
    .cf-line strong{font-size:13px}.cf-line small{display:block;color:#87909d;font-size:11px}.cf-line .cf-amount{font-size:13px;white-space:nowrap}
    .cf-icon{width:31px;height:31px;border-radius:10px;background:rgba(125,135,150,.1);display:grid;place-items:center}
    .cf-remove{border:0;background:transparent;color:#89909b;font-size:20px;padding:4px}
    .cf-form{display:grid;gap:10px;background:rgba(130,140,155,.07);padding:13px;border-radius:12px}
    .cf-form label{display:grid;gap:5px;font-size:12px;font-weight:600}
    .cf-segment{display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:4px;border-radius:10px;background:rgba(120,130,140,.1)}
    .cf-segment button{border:0;border-radius:8px;background:transparent;padding:10px;font-weight:650;color:inherit}
    .cf-segment button[aria-pressed=true]{background:var(--surface,#fff);box-shadow:0 1px 5px #0002}
    .cf-chart{width:100%;height:auto;display:block}.cf-legend{display:flex;gap:12px;flex-wrap:wrap;font-size:10px;color:#798391}
    .cf-dot{display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:4px}
    .cf-switch{display:flex;align-items:center;gap:8px;font-size:12px}.cf-switch input{accent-color:#344b70;width:18px;height:18px}
    @media(prefers-color-scheme:dark){.cf-root{color:var(--text-primary,#eee)}.cf-card{background:var(--surface,#232833)}.cf-input,.cf-select{background:var(--surface,#232833);border-color:#586070}}
  `;
  if(!document.getElementById('cf-styles')){const st=el('style');st.id='cf-styles';st.textContent=css;document.head.append(st);}
  const root=el('div','cf-root');
  const status=el('div','cf-sub');status.setAttribute('role','status');
  panel.replaceChildren(root);
  const convert = n => display==='BRL'&&fx ? n*fx : n;
  const fmt = n => money(convert(n),display==='BRL'?'BRL':'EUR');
  async function rate() {
    try {
      const res=await fetch('https://api.frankfurter.dev/v1/latest?base=EUR&symbols=BRL',{cache:'no-store'});
      if(!res.ok)throw Error('Cotação indisponível');
      const data=await res.json();
      if(!Number.isFinite(Number(data.rates?.BRL))||Number(data.rates.BRL)<=0)throw Error('Cotação inválida');
      fx=Number(data.rates.BRL);fxDate=data.date;render();
    }catch{fx=null;fxDate=null;render();}
  }
  function render(){
    if(!currentTrip)return;
    root.replaceChildren();
    const start=currentTrip.start_date||today();
    const finish=new Date(start+'T12:00:00');finish.setDate(finish.getDate()+Math.max(1,Number(currentTrip.day_count)||14)-1);
    const end=finish.toLocaleDateString('en-CA');
    const remaining=Math.max(0,Math.round((new Date(end+'T12:00:00')-new Date(today()+'T12:00:00'))/86400000)+1);
    const credits=rows.filter(x=>x.entry_type==='credit').reduce((a,x)=>a+euro(x),0);
    const debits=rows.filter(x=>x.entry_type==='debit').reduce((a,x)=>a+euro(x),0);
    const balance=credits-debits, daily=remaining?balance/remaining:0;
    const card=()=>{const x=el('section','cf-card');root.append(x);return x;};
    const top=card();top.append(el('div','cf-caption','SALDO DISPONÍVEL'),el('div','cf-big',fmt(balance)),el('div','cf-divider'));
    const stats=el('div','cf-stats');
    for(const [label,val,cl] of [['Créditos',credits,'cf-green'],['Débitos',debits,'cf-red'],['Saldo',balance,'']]){
      const b=el('div');b.append(el('div','cf-caption',label),el('strong',cl,(label==='Débitos'?'−':label==='Créditos'?'+':'')+fmt(val)));stats.append(b);
    }top.append(stats);
    const proj=card();proj.append(el('div','cf-title','▥  Projeção diária'),el('div','cf-big',fmt(daily)+' / dia'),el('div','cf-sub',remaining?('Saldo distribuído pelos '+remaining+' dias restantes, incluindo hoje.'): 'Viagem encerrada: sem dias restantes.'),el('div','cf-divider'),el('div','cf-title','Gastos por dia'),el('div','cf-caption','Comparação com o limite diário disponível'));
    const dates=[];for(let d=new Date(start+'T12:00:00'),i=0;i<Math.min(60,Number(currentTrip.day_count)||14);i++,d.setDate(d.getDate()+1))dates.push(d.toLocaleDateString('en-CA'));
    const totals=dates.map(d=>rows.filter(r=>r.entry_date===d&&r.entry_type==='debit').reduce((a,r)=>a+euro(r),0));
    const max=Math.max(1,...totals,daily);
    const width=Math.max(340,dates.length*35+20),height=154;
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.setAttribute('class','cf-chart');svg.setAttribute('role','img');svg.setAttribute('aria-label','Gastos diários comparados ao limite médio disponível');
    const shape=(tag,attrs)=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));svg.append(n);return n;};
    const y=v=>119-Math.max(0,v)/max*95;
    for(let i=0;i<4;i++)shape('line',{x1:8,x2:width-8,y1:24+i*32,y2:24+i*32,stroke:'currentColor','stroke-opacity':'.1','stroke-dasharray':'3 4'});
    if(daily>0)shape('line',{x1:8,x2:width-8,y1:y(daily),y2:y(daily),stroke:'#4a90d9','stroke-width':1.5,'stroke-dasharray':'5 4'});
    dates.forEach((d,i)=>{const v=totals[i],x=16+i*35;shape('rect',{x,y:y(v),width:21,height:Math.max(1,119-y(v)),rx:3,fill:v>daily?'#dc7777':'#43a995',opacity:v?1:.22});const tx=shape('text',{x:x+10.5,y:140,'text-anchor':'middle','font-size':10,fill:'currentColor',opacity:'.75'});tx.textContent=d.slice(8);});
    const scroll=el('div');scroll.style.overflowX='auto';scroll.append(svg);proj.append(scroll);
    const legend=el('div','cf-legend');legend.innerHTML='<span><i class="cf-dot" style="background:#43a995"></i>Dentro do limite</span><span><i class="cf-dot" style="background:#dc7777"></i>Acima do limite</span><span><i class="cf-dot" style="background:#4a90d9"></i>Limite projetado</span>';proj.append(legend);
    proj.append(el('div','cf-sub','Referência visual: limite disponível calculado agora. Histórico de limites por dia será registrado separadamente.'));
    const list=card();const currencyRow=el('div','cf-row');currencyRow.append(el('strong',null,'Moeda de exibição'));
    const switchLabel=el('label','cf-switch');const sw=el('input');sw.type='checkbox';sw.checked=display==='BRL';sw.disabled=!fx;sw.addEventListener('change',()=>{display=sw.checked?'BRL':'EUR';render()});switchLabel.append(el('span',null,'€ EUR'),sw,el('span',null,'R$ BRL'));currencyRow.append(switchLabel);list.append(currencyRow);
    if(!fx)list.append(el('div','cf-sub','Exibição em reais indisponível até obter a cotação.'));
    const heading=el('div','cf-row');heading.append(el('div','cf-title','Lançamentos'));const add=el('button','cf-button','+ Novo');add.type='button';add.disabled=!canEdit();add.addEventListener('click',()=>showForm(list));heading.append(add);list.append(el('div','cf-divider'),heading,status);
    for(const r of [...rows].sort((a,b)=>b.entry_date.localeCompare(a.entry_date)||b.created_at.localeCompare(a.created_at))){
      const line=el('div','cf-line');line.append(el('span','cf-icon',r.entry_type==='credit'?'↙':'↗'));
      const txt=el('div');txt.append(el('strong',null,r.description),el('small',null,dateLocal(r.entry_date)+(r.currency!=='EUR'?' · '+money(r.amount,r.currency):'')));line.append(txt);
      line.append(el('strong','cf-amount '+(r.entry_type==='credit'?'cf-green':''),(r.entry_type==='credit'?'+':'−')+fmt(euro(r))));
      const del=el('button','cf-remove','×');del.type='button';del.disabled=!canEdit();del.setAttribute('aria-label','Excluir '+r.description);del.addEventListener('click',async()=>{if(!confirm('Excluir este lançamento?'))return;try{const client=await clientForTrip();if(!client)throw Error('Sem conexão Neon');const result=await client.from('cash_flow_entries').delete().eq('id',r.id).eq('trip_id',currentTrip.id);if(result.error)throw result.error;await load(currentTrip)}catch(e){status.textContent=e.message}});line.append(del);list.append(line);
    }
    if(!rows.length)list.append(el('p','cf-sub','Nenhum lançamento. Comece registrando um crédito com o saldo inicial.'));
  }
  function showForm(container){
    const old=container.querySelector('.cf-form');if(old){old.remove();return;}
    const form=el('form','cf-form');const seg=el('div','cf-segment');let kind='debit';
    const b1=el('button',null,'− Débito'),b2=el('button',null,'+ Crédito');
    for(const [btn,k] of [[b1,'debit'],[b2,'credit']]){btn.type='button';btn.addEventListener('click',()=>{kind=k;b1.setAttribute('aria-pressed',String(k==='debit'));b2.setAttribute('aria-pressed',String(k==='credit'))})}b1.setAttribute('aria-pressed','true');b2.setAttribute('aria-pressed','false');seg.append(b1,b2);form.append(seg);
    const field=(label,type,value='')=>{const wrap=el('label');wrap.append(el('span',null,label));const input=el('input','cf-input');input.type=type;input.value=value;input.required=true;wrap.append(input);form.append(wrap);return input;};
    const description=field('Descrição','text');description.maxLength=180;
    const value=field('Valor','number');value.min='0.01';value.step='0.01';
    const date=field('Data','date',today());
    const exchange=el('label','cf-switch');const apply=el('input');apply.type='checkbox';exchange.append(apply,el('span',null,'Aplicar câmbio (lançamento em reais)'));form.append(exchange);
    const fxArea=el('div');fxArea.hidden=true;const note=el('div','cf-sub');const manual=field('Cotação EUR → BRL (R$ por € 1)','number');manual.step='0.000001';manual.min='0.000001';manual.required=false;manual.value=fx?String(fx):'';manual.parentElement.remove();fxArea.append(manual.parentElement);fxArea.append(note);form.append(fxArea);
    const toggle=()=>{fxArea.hidden=!apply.checked;manual.required=apply.checked;note.textContent=fx?'Cotação de '+fxDate+' (Frankfurter/ECB). Pode ajustar antes de salvar.':'Cotação automática indisponível. Informe a cotação manualmente.';value.previousSibling.textContent=apply.checked?'Valor (R$)':'Valor (€)';};apply.addEventListener('change',toggle);toggle();
    const submit=el('button','cf-button','Salvar lançamento');submit.type='submit';form.append(submit);
    form.addEventListener('submit',async e=>{e.preventDefault();const amt=Number(value.value),r=Number(manual.value);if(!Number.isFinite(amt)||amt<=0)return;if(apply.checked&&(!Number.isFinite(r)||r<=0)){status.textContent='Informe uma cotação válida.';return;}submit.disabled=true;try{
      const client=await clientForTrip();if(!client)throw Error('Conecte-se ao Neon para salvar.');
      const payload={trip_id:currentTrip.id,entry_date:date.value,entry_type:kind,description:description.value.trim(),amount:amt,currency:apply.checked?'BRL':'EUR',exchange_rate_to_eur:apply.checked?1/r:1,exchange_rate_date:apply.checked?(fxDate||today()):null,exchange_rate_source:apply.checked?(fx?'Frankfurter/ECB (editável)':'manual'):null};
      const result=await client.from('cash_flow_entries').insert(payload).select('*').single();if(result.error)throw result.error;await load(currentTrip);
    }catch(err){status.textContent=err.message||'Erro ao salvar';submit.disabled=false}});
    container.insertBefore(form,status);
  }
  async function load(trip){
    currentTrip=trip;if(!trip)return;status.textContent='Atualizando lançamentos…';render();
    try{const client=await clientForTrip();if(!client)throw Error('Sem conexão Neon');const res=await client.from('cash_flow_entries').select('*').eq('trip_id',trip.id).order('entry_date',{ascending:false});if(res.error)throw res.error;if(currentTrip.id!==trip.id)return;rows=res.data||[];status.textContent='';render();}
    catch(e){status.textContent='Não foi possível consultar os lançamentos: '+e.message;render();}
  }
  rate();
  return {load};
}
