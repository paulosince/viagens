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
  const formatInput = value => value == null ? '' : Number(value).toFixed(2).replace('.', ',');
  const previewAmount = value => { try { return parseMoney(value); } catch { return null; } };
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
    const daySummaries = [];
    let refreshSummary = () => {};
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
      const mealStates=[];
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
        const unresolved = activitiesForSlot.length>0 && plannedNumbers.some(v=>v===null);
        const fallback = plannedNumbers.filter(v=>v!=null).reduce((a,v)=>a+v,0);
        const manualCanCover = group.budgets.length===0 && (activitiesForSlot.length===0 || plannedNumbers.every(v=>v==null || v===0));
        const manualPlan = manualCanCover && manual?.planned_amount!=null ? Number(manual.planned_amount) : null;
        const isUnpriced = unresolved && manualPlan==null;
        if(isUnpriced){dayMissing=true;unpriced++;}
        const planned = manualPlan!=null ? manualPlan : plannedNumbers.some(v=>v!=null) ? fallback : null;
        const spentAmounts=included.filter(item=>item.actual_amount!=null);
        const spend=spentAmounts.reduce((n,item)=>n+Number(item.actual_amount),0)+(manual?.actual_amount!=null?Number(manual.actual_amount):0);
        const hasSpend=spentAmounts.length>0 || manual?.actual_amount!=null;
        if(planned!=null)dayPlanned+=planned;
        if(hasSpend){dayActual+=spend;daySpent=true;spentCount++;}
        const row=html('div','food-meal');
        const lineState={planned,actual:hasSpend?spend:null,unpriced:isUnpriced,needsPrice:activitiesForSlot.length>0};
        mealStates.push(lineState);
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
          info.append(entry);
        }
        const tickets=files.filter(file=>{
          if(file.meal_day_id && file.meal_slot){
            return String(file.meal_day_id)===String(day.id) && file.meal_slot===slot.key;
          }
          if(file.activity_id && activitiesForSlot.some(activity=>String(activity.id)===String(file.activity_id))) return true;
          if(file.item_category!=='restaurant' || dateOnly(file.event_date)!==date) return false;
          const venue=fold([file.display_title,file.venue].filter(Boolean).join(' '));
          return activitiesForSlot.some(activity=>{
            const place=fold(activity.place_name||'');
            const aliases=[place,place.replace(/ by .*/,''),place.replace(/ \(.*\)/,'')].filter(value=>value.length>=6);
            return aliases.some(value=>venue.includes(value));
          });
        });
        for(const ticket of tickets){
          const button=html('button','food-meal-ticket','Ver reserva · '+(ticket.display_title||ticket.file_name||'comprovante'));
          button.type='button';
          button.addEventListener('click',()=>ctx.openTicket(ticket,files));
          info.append(button);
        }
        if(editable){
          const bind=html('button','food-meal-link',tickets.length?'Vincular outro ticket':'Vincular reserva');
          bind.type='button';
          bind.addEventListener('click',()=>openLinkDialog({data,day,date,slot,activities:activitiesForSlot}));
          info.append(bind);
        }
        const plannedWrap=html('div','food-meal-input-wrap');
        const plannedInput=html('input','food-meal-budget');
        plannedInput.type='text'; plannedInput.inputMode='decimal'; plannedInput.placeholder='—';
        plannedInput.value=formatInput(planned);
        plannedInput.setAttribute('aria-label','Previsto: '+slot.label+' '+localized);
        const mixedCurrency=group.budgets.some(item=>item.currency!=='EUR');
        const tooManyBudgets=group.budgets.length>1;
        const complexFallback=group.budgets.length===0 && activitiesForSlot.length>1 && plannedNumbers.some(v=>v!=null && v!==0);
        const canPlan=editable && !mixedCurrency && !tooManyBudgets && !complexFallback;
        plannedInput.disabled=!canPlan;
        if (!canPlan && editable) plannedInput.title='Mais de uma previsão ou moeda diferente. Ajuste individualmente na aba Orçamento.';
        const plannedStatus=html('small','food-meal-status','');
        plannedInput.addEventListener('input',()=>{
          const amount=previewAmount(plannedInput.value);
          const valid=!plannedInput.value.trim() || amount!==null;
          plannedInput.setAttribute('aria-invalid',String(!valid));
          if(valid){
            lineState.planned=amount;
            lineState.unpriced=amount==null && lineState.needsPrice;
            refreshSummary();
          }
        });
        plannedInput.addEventListener('change',async()=>{
          const old=formatInput(planned);
          plannedInput.disabled=true; plannedStatus.textContent='Salvando…';
          try{
            const amount=parseMoney(plannedInput.value);
            const saved=await saveMealValue({field:'planned_amount',data,activities:activitiesForSlot,budgets:group.budgets,manual,date,slot,amount});
            if(saved)ctx.applyBudget(saved);
            render();
          }catch(error){
            plannedStatus.textContent=error.message||'Não foi possível salvar';
            plannedInput.value=old;lineState.planned=planned;lineState.unpriced=isUnpriced;
            plannedInput.disabled=!canPlan;refreshSummary();
          }
        });
        plannedWrap.append(plannedInput,plannedStatus);
        const actual=html('div','food-meal-input-wrap');
        const input=html('input','food-meal-actual');
        input.type='text'; input.inputMode='decimal';
        input.placeholder='—';
        input.value=hasSpend?formatInput(spend):'';
        input.setAttribute('aria-label','Realizado: '+slot.label+' '+localized);
        input.disabled=!editable || tooManyBudgets || mixedCurrency || (group.budgets.length>0 && manual?.actual_amount!=null);
        if(input.disabled && editable) input.title='Há múltiplos lançamentos nesta refeição. Edite individualmente na aba Orçamento.';
        input.addEventListener('input',()=>{
          const amount=previewAmount(input.value);
          const valid=!input.value.trim() || amount!==null;
          input.setAttribute('aria-invalid',String(!valid));
          if(valid){lineState.actual=amount;refreshSummary();}
        });
        const status=html('small','food-meal-status','');
        input.addEventListener('change',async()=>{
          input.disabled=true;status.textContent='Salvando…';
          try{
            const amount=parseMoney(input.value);
            const saved=await saveMealValue({field:'actual_amount',data,activities:activitiesForSlot,budgets:group.budgets,manual,date,slot,amount});
            if(saved)ctx.applyBudget(saved);
            status.textContent='Salvo';
            render();
          }catch(error){status.textContent=error.message||'Falha ao salvar';input.value=hasSpend?formatInput(spend):'';lineState.actual=hasSpend?spend:null;input.disabled=!editable || tooManyBudgets || mixedCurrency;refreshSummary();}
        });
        actual.append(input,status);
        grid.append(info,plannedWrap,actual);
        row.append(grid);card.append(row);
      }
      tripPlanned+=dayPlanned;tripActual+=dayActual;
      badge.textContent=money(dayPlanned)+(dayMissing?' + ?':'');
      const dayFoot=html('div','food-day-footer');
      dayFoot.append(html('span','','Total do dia'),html('strong','',money(dayPlanned)+' previsto / '+(daySpent?money(dayActual):'—')+' realizado'));
      const dayTotalText=dayFoot.children[1];
      card.append(dayFoot);displayed.append(card);
      daySummaries.push({badge,dayTotalText,rows:mealStates});
    }
    host.replaceChildren(displayed);
    footer.replaceChildren();
    const title=html('div','food-total-heading','Alimentação · totais da viagem');
    const grid=html('div','food-total-grid');
    const totalCells=[];
    for(const [label,value] of [['Previsto',money(tripPlanned)+(unpriced?'*':'')],['Realizado',spentCount?money(tripActual):'—'],['Diferença',spentCount?money(tripPlanned-tripActual):'—']]){
      const cell=html('div','food-total-cell');
      const valueNode=html('strong','',value);
      cell.append(html('small','',label),valueNode);grid.append(cell);totalCells.push(valueNode);
    }
    const summaryNote=html('small','food-total-note','');
    footer.append(title,grid,summaryNote);
    refreshSummary=()=>{
      let forecast=0,spent=0,actualRows=0,missing=0;
      for(const day of daySummaries){
        let dp=0,da=0,hasActual=false,hasUnknown=false;
        for(const row of day.rows){
          if(row.planned!=null)dp+=row.planned;
          if(row.actual!=null){da+=row.actual;hasActual=true;actualRows++;}
          if(row.unpriced)hasUnknown=true;
        }
        forecast+=dp;spent+=da;
        if(hasUnknown)missing++;
        day.badge.textContent=money(dp)+(hasUnknown?' + ?':'');
        day.dayTotalText.textContent=money(dp)+' previsto / '+(hasActual?money(da):'—')+' realizado';
      }
      totalCells[0].textContent=money(forecast)+(missing?'*':'');
      totalCells[1].textContent=actualRows?money(spent):'—';
      totalCells[2].textContent=actualRows?money(forecast-spent):'—';
      summaryNote.textContent=missing?'*Há refeições sem preço informado; totais parciais.':'Valores realizados só aparecem após o lançamento.';
    };
    refreshSummary();
    const contingency=budgets.filter(item=>!item.activity_id && item.currency==='EUR' && /reserva de alimentacao/.test(fold(item.label)))
      .reduce((total,item)=>total+(Number(item.planned_amount)||0),0);
    if(contingency)footer.append(html('small','food-total-note','Reserva para imprevistos: '+money(contingency)+' (fora das cinco refeições diárias).'));
    const detached=budgets.filter(item=>!item.activity_id && /alimentacao/.test(fold(item.category))
      && !String(item.label||'').startsWith(extraPrefix) && !/reserva de alimentacao/.test(fold(item.label)));
    if(detached.length)footer.append(html('small','food-total-note',detached.length+' gasto(s) do orçamento sem atividade vinculada; verificar na aba Orçamento antes de somar.'));
    if(excludedCurrency)footer.append(html('small','food-total-note','Despesas em outras moedas não foram convertidas automaticamente.'));
    if(notice)notice.textContent=!editable?'Somente leitura.':'Preencha o realizado em cada refeição para acompanhar os gastos.';
  }

  function openLinkDialog({data,day,date,slot,activities}){
    const tripId=String(data.trip.id);
    const files=data.files||[];
    const existing=files.find(file=>String(file.meal_day_id||'')===String(day.id) && file.meal_slot===slot.key);
    const dialog=html('dialog','food-link-dialog');
    const title=html('h3','','Vincular reserva · '+slot.label);
    const subtitle=html('p','','Escolha um comprovante já salvo em Tickets. Ele continuará no local original e será exibido aqui como reserva.');
    const form=html('form','food-link-form');
    form.method='dialog';
    const label=html('label','','Ticket existente');
    const select=html('select','food-link-select');
    const empty=html('option','','Selecione um ticket');
    empty.value='';
    select.append(empty);
    const sorted=[...files].sort((a,b)=>{
      const rank=file=>(String(file.meal_day_id||'')===String(day.id)?0:dateOnly(file.event_date)===date?1:String(file.day_id||'')===String(day.id)?2:file.item_category==='restaurant'?3:4);
      return rank(a)-rank(b);
    });
    for(const file of sorted){
      const option=html('option','',(file.display_title||file.file_name||'Arquivo')+
        (file.item_category==='restaurant'?' · Restaurante':'')+
        (file.event_date?' · '+dateOnly(file.event_date).slice(8,10)+'/'+dateOnly(file.event_date).slice(5,7):''));
      option.value=String(file.id);
      select.append(option);
    }
    if(existing)select.value=String(existing.id);
    label.append(select);
    const message=html('p','food-link-message','');
    const actions=html('div','food-link-actions');
    const cancel=html('button','','Cancelar');cancel.type='button';
    cancel.addEventListener('click',()=>dialog.close());
    const submit=html('button','food-link-save','Vincular ticket');submit.type='button';submit.disabled=files.length===0;
    submit.addEventListener('click',async()=>{
      const file=files.find(item=>String(item.id)===String(select.value));
      if(!file){message.textContent='Selecione um ticket da lista.';return;}
      submit.disabled=true;message.textContent='Salvando vínculo…';
      try{
        const client=await ctx.getClient();
        if(!client)throw new Error('Conecte-se para vincular o ticket.');
        const activity=activities.length===1?activities[0]:null;
        const patch={
          meal_day_id:String(day.id),meal_slot:slot.key,
          activity_id:activity?.id||null,item_category:'restaurant',
          event_date:date
        };
        if(!file.event_time && activity?.start_time)patch.event_time=activity.start_time;
        // Do not change day_id: for general attachments the storage policy
        // requires it to remain null even when linked to a meal.
        const result=await client.from('day_attachments').update(patch)
          .eq('trip_id',tripId).eq('id',file.id).select('*').single();
        if(result.error)throw result.error;
        ctx.applyTicket({...file,...result.data,signedUrl:file.signedUrl||'',cardSignedUrl:file.cardSignedUrl||''});
        dialog.close();render();
      }catch(error){message.textContent=error.message||'Não foi possível vincular o ticket.';submit.disabled=false;}
    });
    actions.append(cancel,submit);
    if(!files.length)form.append(html('p','food-link-message','Não há tickets carregados. Envie o comprovante na aba Tickets e volte aqui.'));
    form.append(label,message,actions);
    dialog.append(title,subtitle,form);
    dialog.addEventListener('close',()=>dialog.remove(),{once:true});
    document.body.append(dialog);
    dialog.showModal();
  }
  async function saveMealValue({field,data,activities,budgets,manual,date,slot,amount}){
    const client=await ctx.getClient();
    if(!client)throw new Error('Conecte-se para registrar o valor.');
    const tripId=String(data.trip.id);
    if(budgets.length>1 || budgets.some(item=>item.currency!=='EUR')) throw new Error('Edite os lançamentos separadamente no Orçamento.');
    if(field==='actual_amount' && budgets.length && manual?.actual_amount!=null) throw new Error('Há mais de um gasto nesta refeição; use a aba Orçamento.');
    const activity=activities.length===1?activities[0]:null;
    const linked=budgets.length===1?budgets[0]:null;
    const label=suffixLabel(date,slot.key);
    let existing=linked||manual;
    if(!existing){
      const found=await client.from('budget_items').select('*').eq('trip_id',tripId).eq('label',label).limit(1);
      if(found.error)throw found.error;
      existing=found.data?.[0]||null;
    }
    if(!existing && amount==null)return null;
    const patch={[field]:amount};
    if(field==='actual_amount')patch.purchase_status=amount==null?'pending':'purchased';
    if(existing){
      const result=await client.from('budget_items').update(patch).eq('id',existing.id).eq('trip_id',tripId).select('*').single();
      if(result.error)throw result.error;
      return result.data;
    }
    const newRow={
      trip_id:tripId,activity_id:activity?.id||null,
      label:activity?date.slice(8,10)+'/'+date.slice(5,7)+' · '+activity.title+' · alimentação':label,
      category:'Alimentação · refeições',currency:'EUR',
      planned_amount:field==='planned_amount'?amount:activity?.planned_amount??null,
      actual_amount:field==='actual_amount'?amount:null,
      purchase_status:field==='actual_amount'&&amount!=null?'purchased':'pending'
    };
    const result=await client.from('budget_items').insert(newRow).select('*').single();
    if(result.error)throw result.error;
    return result.data;
  }
  return {render};
}
