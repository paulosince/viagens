const {chromium}=require('playwright');
const fs=require('fs'), assert=require('assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true, executablePath:process.env.CHROMIUM_PATH || undefined, args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']}); const page=await browser.newPage();
 const root=process.cwd()+'/';
 let html=fs.readFileSync('index.html','utf8').replace(/<script\b[\s\S]*?<\/script>/g,'').replace(/<link\b[^>]*>/g,'');
 html=html.replace('</head>','<style>'+fs.readFileSync('style.css','utf8')+'</style></head>');
 const source=fs.readFileSync('experiments/neon-pilot/app/main-neon.js','utf8');
 const funcs=source.slice(source.indexOf('function setHomeSearchOpen('),source.indexOf('function setYearMenu('));
 await page.route('**/*',route=>route.abort());
 for (const width of [320,390,430,768]) {
  await page.setViewportSize({width,height:844});await page.setContent(html);
  await page.evaluate(funcs=>{
   document.body.dataset.session='authenticated';document.body.dataset.appReady='true';document.getElementById('user_home').setAttribute('aria-hidden','false');
   const ids=[...document.querySelectorAll('[id]')].map(x=>x.id); if(new Set(ids).size!==ids.length)throw Error('Duplicate IDs');
   window.state={homeTab:'trips',homeFilter:'all',homeSearch:'',sharedByMe:new Set(['own']),tripFilesByTrip:new Map([['own',[{id:'a',trip_id:'own',day_id:null,file_name:'Ingressos Disney.pdf',mime_type:'application/pdf'},{id:'b',trip_id:'own',day_id:'day',file_name:'Restaurante Chez Remy.pdf',mime_type:'application/pdf'},{id:'c',trip_id:'own',day_id:null,file_name:'Apólice.pdf',mime_type:'application/pdf'}]]]),user:{id:'me'},selectedYear:2026,trips:[{id:'own',name:'Paris & Lisboa',user_id:'me',start_date:'2026-11-18',end_date:'2026-12-01'},{id:'received',name:'São Paulo',user_id:'other',start_date:'2026-10-01',end_date:'2026-10-05'}]};
   window.dom={tripList:document.getElementById('trip_list'),homeEmpty:document.getElementById('home_empty'),editTripsButton:document.getElementById('edit_trips_button')};
   window.favoriteStore={};window.offlineStore={getMeta:async()=>favoriteStore,setMeta:async(k,v)=>{favoriteStore=v;},loadTripData:async()=>({days:[],activities:[]})};window.derivedDayDate=day=>day.date;window.tripEndDate=t=>t.end_date;window.tripRole=t=>t.user_id==='me'?'owner':'viewer';window.tripListGroup=t=>t.id==='received'?'past':'upcoming';window.compareTripsForHome=()=>0;window.tripTiming=()=> 'em 25 dias';window.tripDateRange=t=>({start:new Date(t.start_date+'T00:00:00'),end:new Date(t.end_date+'T23:59:59')});
   window.createTripNode=t=>{const li=document.createElement('li');li.dataset.tripId=t.id;li.innerHTML='<article class="trip-card"><button class="trip-card-button"><span class="trip-copy"><h2>'+t.name+'</h2></span></button></article>';return li;};window.updateTripNode=()=>{};window.syncTripSelectionUI=()=>{};window.setYearMenu=()=>{};window.openTrip=async id=>{window.opened=id;};window.selectTripTab=tab=>{window.destination=tab;};
   (0,eval)(funcs);syncTripList();
  },funcs);
  assert.equal(await page.locator('.home-tabs button').count(),5);
  const bounds=await page.evaluate(()=>({doc:document.documentElement.scrollWidth, viewport:innerWidth,plus:document.getElementById('new_trip_button').getBoundingClientRect().y,year:document.getElementById('year_selector_button').getBoundingClientRect().y}));
  assert.ok(bounds.doc<=width,JSON.stringify(bounds));assert.ok(Math.abs(bounds.plus-bounds.year)<4);
  assert.equal(await page.locator('#home_search_reveal').getAttribute('aria-hidden'),'true');
  assert.equal((await page.locator('#home_search_reveal').boundingBox()).height,0);
  const pull = async (dx,dy) => page.evaluate(({dx,dy})=>{
    const home=document.querySelector('.trip-card-button');
    for (const [type,x,y] of [['touchstart',100,150],['touchmove',100+dx,150+dy],['touchend',100+dx,150+dy]]) {
      const event=new Event(type,{bubbles:true,cancelable:true});
      Object.defineProperty(event,'touches',{value:type==='touchend'?[]:[{clientX:x,clientY:y}]});home.dispatchEvent(event);
    }
  },{dx,dy});
  await pull(40,45); assert.equal(await page.locator('#home_search_reveal').getAttribute('aria-hidden'),'true');
  await pull(0,15); assert.equal(await page.locator('#home_search_reveal').getAttribute('aria-hidden'),'true');
  await pull(0,40); assert.equal(await page.locator('#home_search_reveal').getAttribute('aria-hidden'),'false');
  assert.equal(await page.locator('#user_home .home-bottom').count(),0,'Fixed tab bar must not be in animated #user_home');
  const bar=await page.locator('.home-tabs').boundingBox();assert.ok(bar.height<=61);assert.ok(844-bar.y-bar.height<=9);
  await page.locator('#home_search').fill('sao');assert.equal(await page.locator('#trip_list>li').count(),1);
  await page.locator('#home_search').fill('');await page.locator('[data-home-filter="received"]').click();assert.equal(await page.locator('#trip_list>li').count(),1);
  await page.locator('[data-home-filter="all"]').click();
  await page.locator('.home-tabs button[data-home-tab="tickets"]').click();
  assert.equal(await page.locator('.tickets-screen').count(),1);
  assert.equal(await page.locator('.tickets-item').count(),3);
  await page.locator('[data-ticket-filter="ticket"]').click();assert.equal(await page.locator('.tickets-item').count(),1);
  await page.locator('[data-ticket-filter="restaurant"]').click();assert.equal(await page.locator('.tickets-item').count(),1);
  await page.locator('[data-ticket-filter="all"]').click();
  await page.locator('.home-trip-shortcut').first().click();assert.equal(await page.evaluate(()=>destination),'arquivos');
  await page.locator('.home-tabs button[data-home-tab="budgets"]').click();await page.locator('.home-trip-shortcut').first().click();assert.equal(await page.evaluate(()=>destination),'orcamento');
  await page.locator('.home-tabs button[data-home-tab="calendar"]').click();await page.locator('.home-calendar').waitFor();assert.equal(await page.locator('.home-calendar').count(),1);
  assert.equal(await page.locator('#new_trip_button').isVisible(),false);
  assert.equal(await page.locator('.home-discovery').isVisible(),false);
  assert.match(await page.locator('.home-calendar-heading strong').first().textContent(),/novembro.*2026/);
  assert.equal(await page.locator('.calendar-trip').first().locator('.has-trip').count(),13);
  assert.equal(await page.locator('.calendar-trip .has-trip.range-start').count(),3);
  assert.equal(await page.locator('.calendar-trip .has-trip.range-end').count(),3);
  assert.equal(await page.locator('.calendar-trip .has-trip.range-start').first().evaluate(el=>getComputedStyle(el).borderTopLeftRadius),'11px');
  assert.equal(await page.locator('.trip-departure').count(),0);
  const hero=await page.locator('.calendar-countdown').first().boundingBox();assert.ok(Math.abs(hero.width-hero.height)<1);
  await page.evaluate(()=>{const holder=document.createElement('div');renderHomeCalendar(holder,state.trips[0],new Date());document.body.append(holder);holder.id='today_test';});
  assert.equal(await page.locator('#today_test [aria-current="date"]').textContent(),String(new Date().getDate()));await page.locator('#today_test').evaluate(el=>el.remove());
  await page.locator('[aria-label="Próximo mês"]').first().click();
  assert.match(await page.locator('.home-calendar-heading strong').first().textContent(),/dezembro.*2026/);
  assert.equal(await page.locator('.calendar-trip').first().locator('.has-trip').count(),1);
  await page.locator('#calendar_menu_button').click();assert.equal(await page.locator('.home-discovery').isVisible(),true);
  await page.locator('#home_search').fill('sao');await page.waitForFunction(()=>document.querySelectorAll('.calendar-milestone-slide').length===1);
  await page.evaluate(()=>{state.calendarMilestoneId='trip:own';});await page.locator('#home_search').fill('');await page.waitForFunction(()=>document.querySelectorAll('.calendar-milestone-slide').length===2);await page.locator('#calendar_menu_button').press('Escape');
  assert.equal(await page.locator('.home-discovery').isVisible(),false);
  await page.locator('[aria-label="Próximo marco"]').click();
  await page.waitForFunction(()=>document.querySelector('.calendar-trip-content>h2').textContent==='São Paulo');
  await page.evaluate(()=>{const button=createCalendarFavoriteButton({id:'day',trip_id:'own',date:'2026-11-24'},{id:'disney',title:'Disney'});button.id='favorite_test';button.style.cssText='position:fixed;top:0;left:0;z-index:100';document.body.append(button);});
  await page.locator('#favorite_test').click();await page.waitForFunction(()=>favoriteStore['own:disney']);
  await page.evaluate(()=>{state.calendarMilestoneId='trip:own';syncTripList();});
  await page.waitForFunction(()=>document.querySelectorAll('.calendar-milestone-slide').length===3);
  await page.locator('[aria-label="Próximo marco"]').click();
  await page.waitForFunction(()=>state.calendarMilestoneId==='activity:disney');
  assert.equal(await page.locator('.calendar-trip-content>h2').textContent(),'Paris & Lisboa');
  await page.locator('#favorite_test').click();await page.waitForFunction(()=>!favoriteStore['own:disney']);await page.locator('#favorite_test').evaluate(el=>el.remove());
  const countdowns=await page.evaluate(()=>[calendarCountdown(state.trips[0],new Date('2026-10-24T12:00:00')),calendarCountdown(state.trips[0],new Date('2026-11-18T12:00:00')),calendarCountdown(state.trips[0],new Date('2026-12-02T12:00:00'))]);
  assert.deepEqual(countdowns.map(x=>x.number),[25,1,1]);
  assert.match(countdowns[2].label,/retorno/);
  await page.locator('.home-tabs button[data-home-tab="trips"]').click();assert.equal(await page.locator('#trip_list>li').count(),2);
  await page.evaluate(()=>setHomeSearchOpen(true));await page.locator('#home_search').waitFor({state:'visible'});await page.locator('#home_search').focus();await page.waitForFunction(()=>document.activeElement.id==='home_search');await page.locator('#home_search').press('Escape');assert.equal(await page.locator('#home_search_reveal').getAttribute('aria-hidden'),'true');

  for(const tab of ['calendar','tickets','budgets','trips','calendar','trips']) {
    await page.locator('.home-tabs button[data-home-tab="'+tab+'"]').click();
    await page.waitForFunction(()=>{const a=document.querySelector('.home-tab-indicator').getBoundingClientRect(),b=document.querySelector('.home-tabs button[aria-current="true"]').getBoundingClientRect();return Math.abs(a.x+a.width/2-b.x-b.width/2)<2;});
  }
  console.log('PASS',width,'layout, search, filters, calendar, ticket/budget destinations');
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
