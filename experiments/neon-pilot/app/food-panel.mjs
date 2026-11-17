export function createFoodPanel(ctx) {
  const host = document.getElementById('trip_food_days');
  const footer = document.getElementById('trip_food_summary');
  const notice = document.getElementById('trip_food_notice');
  const slots = [
    { key: 'cafe', label: 'Café da manhã' },
    { key: 'lanche_manha', label: 'Lanche da manhã' },
    { key: 'almoco', label: 'Almoço' },
    { key: 'lanche_tarde', label: 'Lanche da tarde' },
    { key: 'jantar', label: 'Jantar' }
  ];
  const extraPrefix = 'Alimentação avulsa | ';
  const fold = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const money = n => n == null ? '—' : new Intl.NumberFormat('pt-BR', {style:'currency',currency:'EUR'}).format(Number(n));
  const parseMoney = value => {
    const raw = String(value).trim().replace(/\s/g, '').replace(',', '.');
    if (!raw) return null;
    if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) throw new Error('Informe um valor válido, com até duas casas decimais.');
    return Number(raw);
  };
  const imageUrl = value => /^(https?:\/\/|blob:)/i.test(String(value || '')) ? String(value) : '';
  const dateOnly = value => String(value || '').slice(0,10);
  const suffixLabel = (date,key) => extraPrefix + date + ' | ' + key;
  const mealSlot = (activity,linkedBudgets = []) => {
    const text = fold(activity.title);
    const meal = fold(activity.meal);
    const budgetTitle = fold(linkedBudgets.map(row=>row.label).join(' '));
    // A nearby restaurant's facade or a grocery stop is not itself a meal.
    if (/sem refeicao|sem consumacao|foto da fachada/.test(text)) return -1;
    if (/compras para piquenique|comprar para piquenique|monoprix|compras no mercado/.test(text)) return -1;
    const time = String(activity.start_time || '').slice(0,5);
    if (/cafe da manha/.test(text) || (/cafe simples/.test(text) && time < '10:00')) return 0;
    if (/lanche da manha/.test(text)) return 1;
    if (/lanche da tarde/.test(text)) return 3;
    if (/almoco/.test(text)) return 2;
    if (/jantar/.test(text)) return 4;
    if (/cafe da manha/.test(budgetTitle)) return 0;
    if (/lanche da manha/.test(budgetTitle)) return 1;
    if (/lanche da tarde/.test(budgetTitle)) return 3;
    if (/almoco/.test(budgetTitle)) return 2;
    if (/jantar/.test(budgetTitle)) return 4;
    const food = /cafe|lanche|refeicao|piquenique|picnic|sala vip|lanche rapido/.test(text)
      || Boolean(meal) || (linkedBudgets.length>0 && /champ de mars|picnic|piquenique/.test(text));
    if (!food) return -1;
    if (time < '09:00') return 0;
    if (time < '12:00') return 1;
    if (time < '15:00') return 2;
    if (time < '18:00') return 3;
    return 4;
  };
  const html = (tag, className, textValue) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (textValue != null) el.textContent = textValue;
    return el;
  };
  const context = () => ctx.getContext();
  function render() {
    if (!host || !footer) return;
    const data = context();
    const {trip, days, budgets = [], files = [], getActivities, getLocations, editable} = data || {};
    if (!trip) return;
    const budgetsByActivity = new Map();
    const manualByLabel = new Map();
    budgets.forEach(item => {
      if (item.activity_id) {
        const id = String(item.activity_id);
        const list = budgetsByActivity.get(id) || [];
        list.push(item);
        budgetsByActivity.set(id, list);
      } else if (String(item.label || '').startsWith(extraPrefix)) {
        manualByLabel.set(String(item.label), item);
      }
    });
    const displayed = document.createDocumentFragment();
    let tripPlanned = 0, tripActual = 0, unpriced = 0, spentCount = 0, excludedCurrency = false;
    for (const day of days) {
      const date = ctx.dayDate(day,trip);
      const localized = new Intl.DateTimeFormat('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit'}).format(new Date(date+'T12:00:00'));
      const activities = getActivities(day).slice().sort((a,b)=>String(a.start_time||'').localeCompare(String(b.start_time||'')));
      const locations = getLocations(day);
      const foodRows = slots.map(slot => ({slot,activities:[],budgets:[]}));
      for (const activity of activities) {
        const linked = budgetsByActivity.get(String(activity.id)) || [];
        const slotIndex = mealSlot(activity,linked);
        if (slotIndex < 0) continue;
        foodRows[slotIndex].activities.push(activity);
        foodRows[slotIndex].budgets.push(...linked);
      }
      const card = html('section','food-day');
      const heading = html('header','food-day-heading');
      const h = html('div','food-day-heading-copy');
      h.append(html('strong','food-day-date',localized.charAt(0).toUpperCase()+localized.slice(1)),html('small','food-day-subtitle',day.title || 'Dia '+String(day.position+1)));
      const badge = html('span','food-day-total','—');
      heading.append(h,badge); card.append(heading);
      const headerCols=html('div','food-meal-columns');
      for(const label of ['Refeição / local','Previsto','Realizado']) headerCols.append(html('span','',label));
      card.append(headerCols);
      let dayPlanned=0, dayActual=0, dayMissing=false, daySpent=false;
      for (let i=0; i<foodRows.length; i++) {
        const group=foodRows[i],slot=group.slot;
        const activitiesForSlot=group.activities;
        const included = group.budgets.filter(item=>item.currency === 'EUR');
        if (group.budgets.some(item=>item.currency!=='EUR')) excludedCurrency=true;
        const manual=manualByLabel.get(suffixLabel(date,slot.key));
        const plannedNumbers=activitiesForSlot.map(activity=>{
          const rows=budgetsByActivity.get(String(activity.id)) || [];
          if (rows.length) {
            const estimates=rows.filter(item=>item.currency==='EUR').map(item=>item.planned_amount).filter(v=>v!=null);
            return estimates.length?estimates.reduce((n,v)=>n+Number(v),0):null;
          }
          return activity.currency && activity.currency!=='EUR' && activity.planned_amount!=null ? 0 : activity.planned_amount!=null ? Number(activity.planned_amount) : null;
        });
        const isUnpriced = activitiesForSlot.length>0 && plannedNumbers.some(v=>v===null);
        if(isUnpriced){dayMissing=true;unpriced++;}
        const planned=plannedNumbers.some(v=>v!=null)?plannedNumbers.reduce((a,v)=>a+(v||0),0):activitiesForSlot.length?null:null;
        const spentAmounts=included.filter(item=>item.actual_amount!=null);
        const spend=spentAmounts.reduce((n,item)=>n+Number(item.actual_amount),0)+(manual?.actual_amount!=null?Number(manual.actual_amount):0);
        const hasSpend=spentAmounts.length>0 || manual?.actual_amount!=null;
        if(planned!=null)dayPlanned+=planned;
        if(hasSpend){dayActual+=spend;daySpent=true;spentCount++;}
        const row=html('div','food-meal');
        const grid=html('div','food-meal-grid');
        const info=html('div','food-meal-info');
        info.append(html('strong','food-meal-name',slot.label));
        if(activitiesForSlot.length===0)info.append(html('span','food-meal-empty','Sem previsão na agenda'));
        for(const activity of activitiesForSlot){
          const entry=html('div','food-meal-entry');
          entry.append(html('span','food-meal-description',(activity.start_time?String(activity.start_time).slice(0,5)+' · ':'')+(activity.place_name || activity.title || 'Refeição')));
          const loc=locations.find(x=>String(x.id)===String(activity.place_id));
          const photo=imageUrl(activity.photo_url || loc?.photo_url);
          if(photo){
            const img=html('img','food-meal-image');
            img.src=photo;img.loading='lazy';img.decoding='async';img.alt='Imagem da agenda: '+(activity.place_name||activity.title||slot.label);
            img.addEventListener('error',()=>img.remove(),{once:true});
            entry.append(img);
          }
          const match = files.filter(file=>{
            if(file.item_category!=='restaurant')return false;
            if(file.activity_id && String(file.activity_id)===String(activity.id))return true;
            if(dateOnly(file.event_date)!==date)return false;
            const venue=fold([file.display_title,file.venue].filter(Boolean).join(' '));
            const place=fold(activity.place_name||'');
            return place.length>=6 && venue.includes(place);
          });
          for(const ticket of match){
            const button=html('button','food-meal-ticket','Ver reserva · '+(ticket.display_title||'comprovante'));
            button.type='button';
            button.addEventListener('click',()=>ctx.openTicket(ticket,files));
            entry.append(button);
          }
          info.append(entry);
        }
        const predicted=html('span','food-meal-amount',planned==null?'—':money(planned)+(isUnpriced?' + ?':''));
        const actual=html('div','food-meal-input-wrap');
        const input=html('input','food-meal-actual');
        input.type='text'; input.inputMode='decimal';
        input.placeholder='—';
        input.value=hasSpend?spend.toFixed(2).replace('.',','):'';
        input.setAttribute('aria-label','Realizado: '+slot.label+' '+localized);
        input.disabled=!editable || group.budgets.length>1 || excludedCurrency && group.budgets.some(item=>item.currency!=='EUR');
        if(group.budgets.length>1){
          input.title='Mais de uma despesa nesta refeição: edite individualmente na aba Orçamento.';
        }
        const status=html('small','food-meal-status','');
        input.addEventListener('change',async()=>{
          input.disabled=true;status.textContent='Salvando…';
          try{
            const amount=parseMoney(input.value);
            const linked=included.length===1 && group.budgets.length===1?included[0]:null;
            const saved=await saveAmount({data,activity:activitiesForSlot[0]||null,linked,manual,date,slot,amount});
            if(saved)ctx.applyBudget(saved);
            status.textContent='Salvo';
            render();
          }catch(error){status.textContent=error.message||'Falha ao salvar';input.disabled=false;}
        });
        actual.append(input,status);
        grid.append(info,predicted,actual);
        row.append(grid);card.append(row);
      }
      tripPlanned+=dayPlanned;tripActual+=dayActual;
      badge.textContent=money(dayPlanned)+(dayMissing?' + ?':'');
      const dayFoot=html('div','food-day-footer');
      dayFoot.append(html('span','','Total do dia'),html('strong','',money(dayPlanned)+' previsto / '+(daySpent?money(dayActual):'—')+' realizado'));
      card.append(dayFoot);displayed.append(card);
    }
    host.replaceChildren(displayed);
    footer.replaceChildren();
    const title=html('div','food-total-heading','Alimentação · totais da viagem');
    const grid=html('div','food-total-grid');
    for(const [label,value] of [['Previsto',money(tripPlanned)+(unpriced?'*':'')],['Realizado',spentCount?money(tripActual):'—'],['Diferença',spentCount?money(tripPlanned-tripActual):'—']]){
      const cell=html('div','food-total-cell');
      cell.append(html('small','',label),html('strong','',value));grid.append(cell);
    }
    footer.append(title,grid,html('small','food-total-note',unpriced?'*Há refeições com preço não informado; totais parciais.':'Valores realizados só aparecem após o lançamento.'));
    if(excludedCurrency)footer.append(html('small','food-total-note','Despesas em outras moedas não foram convertidas automaticamente.'));
    if(notice)notice.textContent=!editable?'Somente leitura.':'Preencha o realizado em cada refeição para acompanhar os gastos.';
  }
  async function saveAmount({data,activity,linked,manual,date,slot,amount}){
    const client=await ctx.getClient();
    if(!client)throw new Error('Conecte-se para registrar a despesa.');
    const tripId=String(data.trip.id);
    if(linked){
      const patch={actual_amount:amount,purchase_status:amount==null?'pending':'purchased'};
      const res=await client.from('budget_items').update(patch).eq('id',linked.id).eq('trip_id',tripId).select('*').single();
      if(res.error)throw res.error;
      return res.data;
    }
    const label=suffixLabel(date,slot.key);
    let existing=manual;
    if(!existing){
      const find=await client.from('budget_items').select('*').eq('trip_id',tripId).eq('label',label).limit(1);
      if(find.error)throw find.error;
      existing=find.data?.[0]||null;
    }
    if(!existing&&amount==null)return null;
    const patch={actual_amount:amount,purchase_status:amount==null?'pending':'purchased'};
    const result=existing
      ?await client.from('budget_items').update(patch).eq('id',existing.id).eq('trip_id',tripId).select('*').single()
      :await client.from('budget_items').insert({trip_id:tripId,activity_id:null,label,category:'Alimentação · refeições',currency:'EUR',planned_amount:0,...patch}).select('*').single();
    if(result.error)throw result.error;
    return result.data;
  }
  return {render};
}
