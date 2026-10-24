const {chromium}=require('playwright');
const fs=require('fs'), assert=require('assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true, executablePath:process.env.CHROMIUM_PATH || undefined, args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']}); const page=await browser.newPage();
 const root=process.cwd()+'/';
 let html=fs.readFileSync('index.html','utf8').replace(/<script\b[\s\S]*?<\/script>/g,'').replace(/<link\b[^>]*>/g,'');
 html=html.replace('</head>','<style>'+fs.readFileSync('style.css','utf8')+'</style></head>');
 const source=fs.readFileSync('experiments/neon-pilot/app/main-neon.js','utf8');
 const funcs=source.slice(source.indexOf('function matchesHomeFilters('),source.indexOf('function setYearMenu('));
 await page.route('**/*',route=>route.abort());
 for (const width of [320,390,430,768]) {
  await page.setViewportSize({width,height:844});await page.setContent(html);
  await page.evaluate(funcs=>{
   document.body.dataset.session='authenticated';document.body.dataset.appReady='true';document.getElementById('user_home').setAttribute('aria-hidden','false');
   const ids=[...document.querySelectorAll('[id]')].map(x=>x.id); if(new Set(ids).size!==ids.length)throw Error('Duplicate IDs');
   window.state={homeTab:'trips',homeFilter:'all',homeSearch:'',sharedByMe:new Set(['own']),user:{id:'me'},selectedYear:2026,trips:[{id:'own',name:'Paris & Lisboa',user_id:'me',start_date:'2026-11-18',end_date:'2026-12-01'},{id:'received',name:'São Paulo',user_id:'other',start_date:'2026-10-01',end_date:'2026-10-05'}]};
   window.dom={tripList:document.getElementById('trip_list'),homeEmpty:document.getElementById('home_empty'),editTripsButton:document.getElementById('edit_trips_button')};
   window.tripRole=t=>t.user_id==='me'?'owner':'viewer';window.tripListGroup=t=>t.id==='received'?'past':'upcoming';window.compareTripsForHome=()=>0;window.tripTiming=()=> 'em 25 dias';window.tripDateRange=t=>({start:new Date(t.start_date+'T00:00:00'),end:new Date(t.end_date+'T23:59:59')});
   window.createTripNode=t=>{const li=document.createElement('li');li.dataset.tripId=t.id;li.innerHTML='<article class="trip-card"><button class="trip-card-button"><span class="trip-copy"><h2>'+t.name+'</h2></span></button></article>';return li;};window.updateTripNode=()=>{};window.syncTripSelectionUI=()=>{};window.setYearMenu=()=>{};window.openTrip=async id=>{window.opened=id;};window.selectTripTab=tab=>{window.destination=tab;};
   (0,eval)(funcs);syncTripList();
  },funcs);
  assert.equal(await page.locator('.home-tabs button').count(),5);
  const bounds=await page.evaluate(()=>({doc:document.documentElement.scrollWidth, viewport:innerWidth,plus:document.getElementById('new_trip_button').getBoundingClientRect().y,year:document.getElementById('year_selector_button').getBoundingClientRect().y}));
  assert.ok(bounds.doc<=width,JSON.stringify(bounds));assert.ok(Math.abs(bounds.plus-bounds.year)<4);
  await page.locator('#home_search').fill('sao');assert.equal(await page.locator('#trip_list>li').count(),1);
  await page.locator('#home_search').fill('');await page.locator('[data-home-filter="received"]').click();assert.equal(await page.locator('#trip_list>li').count(),1);
  await page.locator('[data-home-filter="all"]').click();
  await page.locator('[data-home-tab="tickets"]').click();await page.locator('.home-trip-shortcut').first().click();assert.equal(await page.evaluate(()=>destination),'arquivos');
  await page.locator('[data-home-tab="budgets"]').click();await page.locator('.home-trip-shortcut').first().click();assert.equal(await page.evaluate(()=>destination),'orcamento');
  await page.locator('[data-home-tab="calendar"]').click();assert.equal(await page.locator('.home-calendar').count(),1);await page.locator('[aria-label="Próximo mês"]').click();
  await page.locator('[data-home-tab="trips"]').click();assert.equal(await page.locator('#trip_list>li').count(),2);

  console.log('PASS',width,'layout, search, filters, calendar, ticket/budget destinations');
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
