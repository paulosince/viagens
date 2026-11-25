// Viaggio cash flow: isolated from the legacy planning budget.
export function forecast({balance,days,people,food,rides,fare,extra=0,reserve=0}) {
  const cents=n=>Math.round((Number(n)||0)*100);
  const nn=n=>Math.max(0,cents(n));
  const count=n=>Math.max(0,Math.floor(Number(n)||0));
  const d=Math.min(365,count(days)),p=Math.max(1,count(people)),r=count(rides);
  const b=cents(balance),f=nn(food)*p,t=nn(fare)*r*p,x=nn(extra),s=nn(reserve);
  const daily=f+t,total=d*daily+x,usable=b-x-s;
  const end=b-total,available=end-s;
  const firstOver=usable<0?0:daily>0&&Math.floor(usable/daily)<d?Math.floor(usable/daily)+1:null;
  const maxFood=d?Math.max(0,Math.floor((usable-d*t)/(d*p))):0;
  const maxRides=d&&nn(fare)>0?Math.max(0,Math.floor((usable-d*f)/(d*p*nn(fare)))):null;
  const maxDaily=d?Math.max(0,Math.floor(usable/d)):0;
  const toMoney=n=>n/100;
  return {days:d,people:p,foodDaily:toMoney(f),transportDaily:toMoney(t),daily:toMoney(daily),foodTotal:toMoney(f*d),transportTotal:toMoney(t*d),extra:toMoney(x),reserve:toMoney(s),total:toMoney(total),end:toMoney(end),available:toMoney(available),shortfall:toMoney(Math.max(0,-available)),firstOver,maxFood:toMoney(maxFood),maxRides,maxDaily:toMoney(maxDaily),trajectory:Array.from({length:d},(_,i)=>toMoney(b-x-daily*(i+1)))};
}

export function createCashFlow({panel,clientForTrip,getTrip,canEdit,getPassengerCount=()=>0}) {
  let currentTrip = null, rows = [], display = 'EUR', fx = null, fxDate = null, loading = false, loaded = false, request = 0;
  const scenarios = new Map();
  const money = (v,c='EUR') => new Intl.NumberFormat('pt-BR',{style:'currency',currency:c}).format(Number(v)||0);
  const euro = r => Number(r.amount)*Number(r.exchange_rate_to_eur);
  const el = (tag,cls,text) => { const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n; };
  const dateLocal = d => {const x=new Date(d+'T12:00:00');return x.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});};
  const isoDay = d => [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  const today = () => isoDay(new Date());
  const css = `
    .cf-root{display:grid;gap:14px;padding:4px 0 28px;color:#243346;color-scheme:light}
    .cf-card{background:#fff;border:1px solid rgba(125,135,150,.13);border-radius:18px;padding:17px;box-shadow:0 3px 14px rgba(0,0,0,.045);display:grid;gap:12px}
    .cf-caption{font-size:12px;color:#78818e}.cf-title{font-size:15px;font-weight:700}.cf-big{font-size:29px;font-weight:750;letter-spacing:-.7px;overflow-wrap:anywhere}
    .cf-row{display:flex;align-items:center;justify-content:space-between;gap:10px}.cf-sub{font-size:12px;color:#798391;line-height:1.5}
    .cf-divider{border-top:1px solid rgba(120,130,145,.15)}.cf-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
    .cf-stats strong{font-size:13px;overflow-wrap:anywhere}.cf-green{color:#23966d}.cf-red{color:#d46565}
    .cf-button{border:0;background:#242d3c;color:white;border-radius:10px;padding:10px 13px;font-weight:650}
    .cf-select,.cf-input{border:1px solid #9daab8;background:#fff;color:#18283c;border-radius:9px;padding:10px;width:100%;min-width:0;font:inherit;font-size:16px;min-height:46px}
    .cf-input::placeholder{color:#7d8898;opacity:1}.cf-input:focus-visible,.cf-select:focus-visible{outline:2px solid #087afa;outline-offset:2px}
    .cf-line{display:grid;grid-template-columns:32px minmax(0,1fr) auto 24px;gap:9px;align-items:center;padding:9px 0;border-bottom:1px solid rgba(125,135,150,.12)}
    .cf-line strong{font-size:13px}.cf-line small{display:block;color:#87909d;font-size:11px}.cf-line .cf-amount{font-size:13px;white-space:nowrap}
    .cf-icon{width:31px;height:31px;border-radius:10px;background:rgba(125,135,150,.1);display:grid;place-items:center}
    .cf-remove{border:0;background:transparent;color:#89909b;font-size:20px;padding:4px}
    .cf-form{display:grid;gap:10px;background:rgba(130,140,155,.07);padding:13px;border-radius:12px}
    .cf-form label{display:grid;gap:5px;color:#344358;font-size:13px;font-weight:650}
    .cf-segment{display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:4px;border-radius:10px;background:rgba(120,130,140,.1)}
    .cf-segment button{border:0;border-radius:8px;background:transparent;padding:10px;font-weight:650;color:#344358}
    .cf-segment button[aria-pressed=true]{background:#fff;color:#18283c;box-shadow:0 1px 5px #0002}
    .cf-chart{width:100%;height:auto;display:block}.cf-legend{display:flex;gap:12px;flex-wrap:wrap;font-size:10px;color:#798391}
    .cf-dot{display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:4px}
    .cf-currency-segment{display:grid;grid-template-columns:1fr 1fr;position:relative;min-width:176px;padding:4px;border-radius:13px;background:#dce4e8;isolation:isolate}
    .cf-currency-segment:before{content:'';position:absolute;z-index:-1;left:4px;top:4px;bottom:4px;width:calc((100% - 8px)/2);border-radius:10px;background:#28b463;box-shadow:0 2px 7px #168b4c55;transform:translateX(0);transition:transform .2s ease}
    .cf-currency-segment[data-currency="BRL"]:before{transform:translateX(100%)}
    .cf-currency-segment button{border:0;background:transparent;border-radius:10px;padding:10px 12px;font:inherit;font-size:13px;font-weight:750;color:#485763;cursor:pointer;transition:color .2s}
    .cf-currency-segment button[aria-pressed="true"]{color:#fff}
    .cf-currency-segment button:focus-visible{outline:2px solid #177f4c;outline-offset:2px}
    .cf-currency-segment button:disabled{opacity:.45;cursor:not-allowed}
    .cf-switch{display:flex;align-items:center;gap:8px;color:#344358;font-size:12px}
    .cf-switch input{accent-color:#28b463;width:18px;height:18px}

    .cf-sim-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
    .cf-sim-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    .cf-sim-grid label,.cf-sim-field{display:grid;gap:5px;font-size:12px;font-weight:650;min-width:0}
    .cf-sim-grid input,.cf-sim-field input{box-sizing:border-box;width:100%}
    .cf-sim-wide{grid-column:1/-1}
    .cf-sim-slider{width:100%;accent-color:#23966d;margin:4px 0;min-height:26px}
    .cf-sim-result{display:grid;gap:10px}
    .cf-sim-bar{display:flex;height:12px;background:#e7edf0;border-radius:7px;overflow:hidden}
    .cf-sim-bar span{height:100%;transition:width .15s ease}
    .cf-sim-days{max-height:240px;overflow-y:auto;display:grid;gap:6px}
    .cf-sim-day{display:flex;justify-content:space-between;gap:10px;font-size:12px;padding:4px 0;border-bottom:1px solid #e7edf0}
    .cf-sim-tip{background:#f3f6f8;border-radius:10px;padding:10px;line-height:1.5;font-size:12px;color:#344358}
    .cf-sim-reset{border:0;background:transparent;color:#53677b;font:inherit;font-size:12px;text-decoration:underline;padding:8px;cursor:pointer}

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
    const end=isoDay(finish);
    const remaining=Math.max(0,Math.round((new Date(end+'T12:00:00')-new Date((today()<start?start:today())+'T12:00:00'))/86400000)+1);
    const credits=rows.filter(x=>x.entry_type==='credit').reduce((a,x)=>a+euro(x),0);
    const debits=rows.filter(x=>x.entry_type==='debit').reduce((a,x)=>a+euro(x),0);
    const balance=credits-debits, daily=remaining?balance/remaining:0;
    const card=()=>{const x=el('section','cf-card');root.append(x);return x;};
    const top=card();top.append(el('div','cf-caption','SALDO DISPONÍVEL'),el('div','cf-big',(loaded?fmt(balance):'—')),el('div','cf-divider'));
    const stats=el('div','cf-stats');
    for(const [label,val,cl] of [['Créditos',credits,'cf-green'],['Débitos',debits,'cf-red'],['Saldo',balance,'']]){
      const b=el('div');b.append(el('div','cf-caption',label),el('strong',cl,(label==='Débitos'?'−':label==='Créditos'?'+':'')+fmt(val)));stats.append(b);
    }top.append(stats);
    const proj=card();proj.append(el('div','cf-title','▥  Projeção diária'),el('div','cf-big',loaded?fmt(daily)+' / dia':'—'),el('div','cf-sub',remaining?('Saldo distribuído pelos '+remaining+' dias restantes, incluindo hoje.'): 'Viagem encerrada: sem dias restantes.'),el('div','cf-divider'),el('div','cf-title','Gastos por dia'),el('div','cf-caption','Comparação com o limite diário disponível'));
    const dates=[];for(let d=new Date(start+'T12:00:00'),i=0;i<Math.min(60,Number(currentTrip.day_count)||14);i++,d.setDate(d.getDate()+1))dates.push(isoDay(d));
    // Historical benchmark is reconstructed for each date from its own ledger position,
    // never from today's remaining balance. Same-day credits are available to spend;
    // same-day debits are measured against the benchmark, not subtracted from it.
    const totals=dates.map(d=>rows.filter(r=>r.entry_date===d&&r.entry_type==='debit').reduce((a,r)=>a+euro(r),0));
    const limits=dates.map((d,i)=>{
      const before=rows.filter(r=>r.entry_date<d).reduce((a,r)=>a+(r.entry_type==='credit'?1:-1)*euro(r),0);
      const creditsToday=rows.filter(r=>r.entry_date===d&&r.entry_type==='credit').reduce((a,r)=>a+euro(r),0);
      return (before+creditsToday)/(dates.length-i);
    });
    const max=Math.max(1,...totals,...limits.filter(x=>Number.isFinite(x)&&x>0));
    const width=Math.max(340,dates.length*35+20),height=154;
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.setAttribute('class','cf-chart');svg.setAttribute('role','img');svg.setAttribute('aria-label','Gastos por dia e limites diários reconstruídos a partir dos lançamentos de cada data');
    const shape=(tag,attrs)=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));svg.append(n);return n;};
    const y=v=>119-Math.max(0,v)/max*95;
    for(let i=0;i<4;i++)shape('line',{x1:8,x2:width-8,y1:24+i*32,y2:24+i*32,stroke:'currentColor','stroke-opacity':'.1','stroke-dasharray':'3 4'});
    dates.forEach((d,i)=>{
      const v=totals[i],limit=limits[i],x=16+i*35;
      const future=d>today();
      const bar=shape('rect',{x,y:y(v),width:21,height:Math.max(1,119-y(v)),rx:3,fill:v>Math.max(0,limit)?'#dc7777':'#43a995',opacity:v?1:.22});
      const tooltip=document.createElementNS('http://www.w3.org/2000/svg','title');
      tooltip.textContent=`${dateLocal(d)} · Gastos: ${fmt(v)} · Limite do dia: ${fmt(limit)}${future?' (projeção)':''}`;bar.append(tooltip);
      if(!future&&limit>0)shape('line',{x1:x-3,x2:x+24,y1:y(limit),y2:y(limit),stroke:'#4a90d9','stroke-width':2.5,'stroke-linecap':'round'});
      const tx=shape('text',{x:x+10.5,y:140,'text-anchor':'middle','font-size':10,fill:'currentColor',opacity:'.75'});tx.textContent=d.slice(8);
    });
    const scroll=el('div');scroll.style.overflowX='auto';scroll.append(svg);proj.append(scroll);
    const legend=el('div','cf-legend');legend.innerHTML='<span><i class="cf-dot" style="background:#43a995"></i>Dentro do limite</span><span><i class="cf-dot" style="background:#dc7777"></i>Acima do limite</span><span><i class="cf-dot" style="background:#4a90d9"></i>Limite de cada dia</span>';proj.append(legend);
    proj.append(el('div','cf-sub','Cada marca azul usa o saldo disponível naquele dia, distribuído pelos dias restantes. Créditos do próprio dia entram no limite; débitos do dia são comparados a ele. Lançamentos retroativos podem recalcular o histórico.'));
    renderSimulator(card(),balance,remaining,start);
    const list=card();const currencyRow=el('div','cf-row');currencyRow.append(el('strong',null,'Moeda de exibição'));
    const segment=el('div','cf-currency-segment');segment.dataset.currency=display;segment.setAttribute('role','group');segment.setAttribute('aria-label','Moeda de exibição');
    for(const [code,label] of [['EUR','€ EUR'],['BRL','R$ BRL']]){
      const button=el('button',null,label);button.type='button';button.setAttribute('aria-pressed',String(display===code));button.disabled=code==='BRL'&&!fx;
      button.addEventListener('click',()=>{if(code!==display){display=code;render();}});segment.append(button);
    }currencyRow.append(segment);list.append(currencyRow);
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

  function renderSimulator(container,balance,remaining,start){
    const id=String(currentTrip.id);
    const group=Number(getPassengerCount(currentTrip))||0;
    const defaults=()=>({days:remaining,people:group||1,food:12,rides:4,fare:/paris/i.test([currentTrip.name,currentTrip.destination].join(' '))?2.55:0,extra:0,reserve:0,manual:''});
    let s=scenarios.get(id);
    if(!s){s=defaults();scenarios.set(id,s);}
    const head=el('div','cf-sim-head');head.append(el('div','cf-title','Simulador de orçamento'));
    const reset=el('button','cf-sim-reset','Restaurar cenário');reset.type='button';reset.addEventListener('click',()=>{scenarios.delete(id);render();});head.append(reset);
    container.append(head,el('div','cf-sub','Projete alimentação e transporte para todo o grupo. Os valores são cenários editáveis em euros, não lançamentos nem tarifas verificadas. Os resultados acompanham a moeda de exibição.'));
    const grid=el('div','cf-sim-grid');
    const out=el('div','cf-sim-result');
    const inputs={};
    function field(key,label,{min=0,max,step=.01,wide=false,placeholder='',range=false}={}){
      const wrap=el('label',wide?'cf-sim-wide':null);wrap.append(el('span',null,label));
      const n=el('input','cf-input');n.type='number';n.inputMode=step===1?'numeric':'decimal';n.min=String(min);if(max!=null)n.max=String(max);n.step=String(step);n.value=String(s[key]);n.placeholder=placeholder;wrap.append(n);inputs[key]=n;
      let slider=null;
      if(range){slider=el('input','cf-sim-slider');slider.type='range';slider.min=String(min);slider.max=String(max);slider.step=String(step);slider.value=n.value;slider.setAttribute('aria-label',label+' — controle deslizante');wrap.append(slider);slider.addEventListener('input',()=>{n.value=slider.value;s[key]=Number(slider.value);update();});}
      n.addEventListener('input',()=>{if(key==='manual'&&n.value===''){s[key]='';update();return;}if(n.value===''||!n.validity.valid)return;s[key]=Number(n.value);if(slider)slider.value=n.value;update();});
      n.addEventListener('change',()=>{if(key==='manual'&&n.value==='')return;if(n.value===''||!n.validity.valid)n.value=String(s[key]);});
      grid.append(wrap);
    }
    field('manual','Saldo real da conta (€), opcional',{min:-100000000,wide:true,placeholder:loaded?String(Math.round(balance*100)/100):'Informe o saldo disponível'});
    field('days','Dias a projetar',{max:365,step:1});
    field('people','Pessoas',{min:1,max:1000,step:1});
    field('food','Alimentação por pessoa/dia (€)',{max:500,step:.5,wide:true,range:true});
    field('rides','Passagens por pessoa/dia',{max:30,step:1,wide:true,range:true});
    field('fare','Preço médio de uma passagem (€)',{max:10000});
    field('extra','Outros gastos pendentes (€)',{max:100000000});
    field('reserve','Reserva para imprevistos (€)',{max:100000000,wide:true});
    container.append(grid,el('div','cf-divider'),out);
    const addRow=(label,value,cls='')=>{const line=el('div','cf-row');line.append(el('span','cf-sub',label),el('strong',cls,value));out.append(line);};
    const dateAt=i=>{const d=new Date((today()<start?start:today())+'T12:00:00');d.setDate(d.getDate()+i);return dateLocal(isoDay(d));};
    function update(){
      out.replaceChildren();
      const hasManual=s.manual!=='';
      if(!hasManual&&(!loaded||loading)){out.append(el('div','cf-sim-tip',loading?'Aguardando os lançamentos. Você pode informar o saldo real acima para simular agora.':'Saldo não confirmado. Informe o saldo real acima para simular.'));return;}
      const base=hasManual?Number(s.manual):balance;
      const v=forecast({...s,balance:base});
      out.append(el('div','cf-caption',hasManual?'Usando saldo informado manualmente':'Usando saldo dos lançamentos carregados'));
      if(s.days!==remaining)out.append(el('div','cf-sub','Horizonte personalizado: '+s.days+' dias (roteiro: '+remaining+' dias restantes).'));
      if(!group)out.append(el('div','cf-sub','Quantidade de viajantes não encontrada; ajuste o campo Pessoas.'));
      if(s.rides>0&&s.fare===0)out.append(el('div','cf-sim-tip','A tarifa está em zero. Se houver transporte pago, informe o valor médio antes de confiar na projeção.'));
      addRow('Alimentação por dia · grupo',fmt(v.foodDaily));
      addRow('Transporte por dia · grupo',fmt(v.transportDaily));
      addRow('Gasto diário combinado',fmt(v.daily));
      addRow('Limite diário após extras e reserva',fmt(v.maxDaily));
      addRow('Alimentação no período',fmt(v.foodTotal));
      addRow('Transporte no período',fmt(v.transportTotal));
      addRow('Despesas previstas',fmt(v.total));
      addRow('Saldo final previsto',fmt(v.end),v.end<0?'cf-red':'cf-green');
      if(v.reserve) addRow('Reserva separada',fmt(v.reserve));
      const totalWithReserve=v.total+v.reserve, scale=Math.max(1,Math.max(0,base),totalWithReserve);
      const bar=el('div','cf-sim-bar');bar.setAttribute('role','img');bar.setAttribute('aria-label','Proporção do saldo disponível e do valor que falta');
      for(const [val,color] of [[Math.min(Math.max(0,base),totalWithReserve),'#23966d'],[Math.max(0,totalWithReserve-Math.max(0,base)),'#d46565']]){const part=el('span');part.style.width=String(val/scale*100)+'%';part.style.background=color;bar.append(part);}
      out.append(bar,el('div','cf-caption',v.shortfall>0?'DINHEIRO ADICIONAL NECESSÁRIO':'SALDO LIVRE APÓS A RESERVA'),el('div','cf-big '+(v.shortfall>0?'cf-red':'cf-green'),fmt(v.shortfall>0?v.shortfall:v.available)));
      const tip=text=>out.append(el('div','cf-sim-tip',text));
      if(v.firstOver===0)tip('Os gastos pendentes e a reserva já superam o saldo disponível, antes das despesas diárias.');
      else if(v.firstOver!==null)tip('O orçamento ultrapassa o saldo utilizável em '+dateAt(v.firstOver-1)+' (dia '+v.firstOver+' da projeção). A data pressupõe gastos uniformes e extras reservados agora.');
      else if(v.days)tip(v.available===0?'O cenário consome todo o saldo livre. Qualquer gasto adicional gera déficit.':'O cenário cabe no orçamento. Mantenha a reserva e atualize os valores conforme os gastos reais.');
      if(v.shortfall>0&&v.days){
        if(v.maxFood<s.food)tip('Mantendo o transporte, o limite de alimentação por pessoa/dia é '+money(v.maxFood)+'. Se for insuficiente para se alimentar adequadamente, reforce o saldo ou reduza outros gastos.');
        if(v.maxRides!==null&&v.maxRides<s.rides)tip('Mantendo a alimentação, o limite é de '+v.maxRides+' passagem(ns) paga(s) por pessoa/dia, se a tarifa permanecer igual.');
        if(v.maxFood===0)tip('Apenas os demais gastos podem consumir o orçamento: não conte com alimentação gratuita para compensar.');
        tip('Priorize alimentação, deslocamentos essenciais e retorno. Compare tarifas, agrupe passeios próximos e confira os gastos pendentes.');
      }
      if(v.days){out.append(el('div','cf-title','Saldo projetado por dia'));const list=el('div','cf-sim-days');for(const [i,value] of v.trajectory.entries()){const row=el('div','cf-sim-day');row.append(el('span',null,dateAt(i)),el('strong',value<v.reserve?'cf-red':'cf-green',fmt(value)));list.append(row);}out.append(list,el('div','cf-sub','Saldo ao fim de cada dia, descontando os extras antecipadamente. Vermelho indica saldo abaixo da reserva. Não inclui despesas não informadas.'));}
    }
    update();
  }

  function showForm(container){
    const old=container.querySelector('.cf-form');if(old){old.remove();return;}
    const form=el('form','cf-form');const seg=el('div','cf-segment');let kind='debit';
    const b1=el('button',null,'− Débito'),b2=el('button',null,'+ Crédito');
    for(const [btn,k] of [[b1,'debit'],[b2,'credit']]){btn.type='button';btn.addEventListener('click',()=>{kind=k;b1.setAttribute('aria-pressed',String(k==='debit'));b2.setAttribute('aria-pressed',String(k==='credit'))})}b1.setAttribute('aria-pressed','true');b2.setAttribute('aria-pressed','false');seg.append(b1,b2);form.append(seg);
    const field=(label,type,value='')=>{const wrap=el('label');wrap.append(el('span',null,label));const input=el('input','cf-input');input.type=type;input.value=value;input.required=true;wrap.append(input);form.append(wrap);return input;};
    const value=field('Valor (€)','number');value.min='0.01';value.step='0.01';value.inputMode='decimal';value.placeholder='0,00';
    const description=field('Descrição','text');description.maxLength=180;description.placeholder='Ex.: alimentação, transporte';
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
    if(!trip)return;
    if(currentTrip?.id!==trip.id){rows=[];loaded=false;}
    currentTrip=trip;const token=++request;loading=true;status.textContent='Atualizando lançamentos…';render();
    try{const client=await clientForTrip();if(!client)throw Error('Sem conexão Neon');const res=await client.from('cash_flow_entries').select('*').eq('trip_id',trip.id).order('entry_date',{ascending:false});if(res.error)throw res.error;if(token!==request)return;rows=res.data||[];loaded=true;status.textContent='';}
    catch(e){if(token!==request)return;loaded=false;status.textContent='Não foi possível consultar os lançamentos: '+e.message;}
    finally{if(token===request){loading=false;render();}}
  }
  rate();
  return {load};
}
