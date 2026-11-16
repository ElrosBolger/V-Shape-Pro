'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),output=path.join(root,'verification');
fs.mkdirSync(output,{recursive:true});
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 const relative=pathname==='/'?'index.html':decodeURIComponent(pathname).replace(/^\/+/,'');
 const file=path.resolve(root,relative);
 if(!file.startsWith(root+path.sep)||relative.split('/').some(p=>p.startsWith('.'))){res.writeHead(403);res.end();return}
 fs.readFile(file,(error,data)=>{
  if(error){res.writeHead(404);res.end();return}
  const mime={'.html':'text/html','.js':'application/javascript','.png':'image/png','.jpg':'image/jpeg','.webmanifest':'application/manifest+json','.json':'application/json'};
  res.setHeader('Content-Type',mime[path.extname(file)]||'text/plain');res.setHeader('Cache-Control','no-store');res.end(data);
 });
});
const fixture=active=>({week:1,loads:{'A:1:0':'40'},records:[{date:'2026-11-10T12:00:00Z',day:'A',week:1,entries:[{exercise:'Lat machine avanti',kg:'40',reps:12,rir:'2'}]}],active:active||null,measurements:{weight:'80'},measurementHistory:[],profile:{},warmDone:{}});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port+'/',browser=await chromium.launch({headless:true}),cases=[];
 async function openCase(name,{viewport={width:432,height:960},active=null,query='',reduced=false,failImage=false,workers='block'}={}){
  const context=await browser.newContext({viewport,isMobile:true,hasTouch:true,deviceScaleFactor:1,reducedMotion:reduced?'reduce':'no-preference',serviceWorkers:workers,acceptDownloads:true});
  const stored=JSON.stringify(fixture(active));
  await context.addInitScript(({stored})=>{
   try{if(!localStorage.getItem('vshape_final_v1'))localStorage.setItem('vshape_final_v1',stored)}catch{}
   window.__introEvents=[];
   const record=phase=>window.__introEvents.push({phase,time:performance.now()});
   new MutationObserver(records=>{
    for(const entry of records){
     for(const node of entry.addedNodes||[])if(node.id==='vs-launch-splash')record('added');
     if(entry.target.id==='vs-launch-splash'&&entry.type==='attributes'&&!entry.target.hidden)record(entry.target.classList.contains('vs-splash-out')?'fade':'visible');
     for(const node of entry.removedNodes||[])if(node.id==='vs-launch-splash')record('removed');
    }
   }).observe(document,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','class']});
  },{stored});
  const page=await context.newPage(),errors=[],consoleErrors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&!(failImage&&m.text().includes('Failed to load resource')))consoleErrors.push(m.text())});
  if(failImage)await page.route('**/splash-1080x2400.jpg',route=>route.abort());
  await page.goto(base+query,{waitUntil:'domcontentloaded'});
  return {name,page,context,stored,errors,consoleErrors};
 }
 async function finish(c,details={}){
  assert.deepEqual(c.errors,[],c.name+' JavaScript errors');assert.deepEqual(c.consoleErrors,[],c.name+' console errors');
  assert.equal(await c.page.evaluate(()=>localStorage.getItem('vshape_final_v1')),c.stored,c.name+' changed workout data');
  const events=await c.page.evaluate(()=>window.__introEvents);
  cases.push({name:c.name,status:'passed',...details,events,javascriptErrors:c.errors,consoleErrors:c.consoleErrors,storedDataUnchanged:true});
  await c.context.close();
 }
 try{
  for(const viewport of [{width:432,height:960},{width:360,height:800},{width:960,height:432}]){
   const active={day:'A',week:1,ex:0,set:1,stage:'rest',restEnd:Date.now()+120000,entries:[],started:'2026-11-16T12:00:00Z',transition:false};
   const c=await openCase('active workout '+viewport.width+'x'+viewport.height,{viewport,active}),splash=c.page.locator('#vs-launch-splash');
   await splash.waitFor({state:'visible',timeout:3500});
   const geometry=await splash.evaluate(el=>{
    const img=el.querySelector('img'),box=el.getBoundingClientRect(),scale=Math.min(box.width/img.naturalWidth,box.height/img.naturalHeight);
    return {imageCount:el.querySelectorAll('img').length,source:img.getAttribute('src'),naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight,fit:getComputedStyle(img).objectFit,background:getComputedStyle(el).backgroundColor,transition:getComputedStyle(el).transitionDuration,box:{x:box.x,y:box.y,width:box.width,height:box.height},paintedWidth:img.naturalWidth*scale,paintedHeight:img.naturalHeight*scale,viewport:{width:innerWidth,height:innerHeight}};
   });
   assert.equal(geometry.imageCount,1);assert.equal(geometry.source,'./splash-1080x2400.jpg');assert.equal(geometry.fit,'contain');assert.equal(geometry.background,'rgb(0, 0, 0)');assert.equal(geometry.transition,'0.4s');assert.equal(geometry.naturalWidth,1080);assert.equal(geometry.naturalHeight,2400);
   assert(geometry.paintedWidth<=geometry.box.width+.1&&geometry.paintedHeight<=geometry.box.height+.1);assert.equal(geometry.box.x,0);assert.equal(geometry.box.y,0);
   await c.page.screenshot({path:path.join(output,'splash-'+viewport.width+'x'+viewport.height+'.png')});
   await splash.waitFor({state:'detached',timeout:5500});
   const events=await c.page.evaluate(()=>window.__introEvents),visible=events.find(e=>e.phase==='visible'),fade=events.find(e=>e.phase==='fade'),removed=events.find(e=>e.phase==='removed');
   assert(visible&&fade&&removed,JSON.stringify(events));assert(fade.time-visible.time>=2400&&fade.time-visible.time<=3000,'2.5 second hold');assert(removed.time-fade.time>=390&&removed.time-fade.time<=850,'0.4 second fade');
   await c.page.getByRole('button',{name:'Riprendi seduta',exact:true}).click();await c.page.locator('#clock').waitFor({state:'visible'});
   assert.equal(await c.page.evaluate(()=>JSON.parse(localStorage.getItem('vshape_final_v1')).active.restEnd),active.restEnd);
   await finish(c,{geometry,holdMs:Math.round(fade.time-visible.time),fadeAndCleanupMs:Math.round(removed.time-fade.time)});
  }
  const training=await openCase('active training workout introduction',{active:{day:'A',week:1,ex:0,set:0,stage:'train',entries:[]}});
  await training.page.locator('#vs-launch-splash').waitFor({state:'visible'});await training.page.mouse.click(8,8);await training.page.locator('#vs-launch-splash').waitFor({state:'detached'});await finish(training,{dismissedOnInteraction:true});
  for(const [name,options] of [['recovery already expired',{active:{stage:'rest',restEnd:Date.now()-1000}}],['recovery ending within intro',{active:{stage:'rest',restEnd:Date.now()+1000}}],['Spotify error callback',{query:'?error=access_denied'}],['Spotify code callback',{query:'?code=synthetic&state=invalid-test-state'}],['immediate resume link',{query:'?resume=1'}]]){
   const c=await openCase(name,options);await c.page.locator('#app').waitFor({state:'visible'});assert.equal(await c.page.locator('#vs-launch-splash').count(),0);await finish(c,{introductionSkipped:true});
  }
  const reduced=await openCase('reduced motion',{reduced:true});await reduced.page.locator('#vs-launch-splash').waitFor({state:'visible'});assert.equal(await reduced.page.locator('#vs-launch-splash').evaluate(el=>getComputedStyle(el).transitionDuration),'0s');await reduced.page.locator('#vs-launch-splash').waitFor({state:'detached',timeout:4500});await finish(reduced,{noTransition:true});
  const failed=await openCase('image loading failure',{failImage:true});await failed.page.locator('#vs-launch-splash').waitFor({state:'detached',timeout:3500});await failed.page.getByRole('heading',{name:'Allenati per crescere',exact:true}).waitFor({state:'visible'});await finish(failed,{usableAfterImageFailure:true});
  const offline=await openCase('cached application offline',{workers:'allow'});await offline.page.evaluate(async()=>{await navigator.serviceWorker.ready});await offline.page.locator('#vs-launch-splash').waitFor({state:'detached',timeout:5500});await offline.context.setOffline(true);await offline.page.reload({waitUntil:'domcontentloaded'});await offline.page.locator('#vs-launch-splash').waitFor({state:'visible',timeout:3000});await offline.page.locator('#vs-launch-splash').waitFor({state:'detached',timeout:5500});await offline.page.getByRole('heading',{name:'Allenati per crescere',exact:true}).waitFor({state:'visible'});await finish(offline,{offlineApplicationAndOriginalArtwork:true});
  const report={status:'passed',engine:'Chromium via Playwright 1.56.1',syntheticDataOnly:true,nativeAndroidNotEmulated:true,authenticatedSpotifyNotTested:true,cases};
  fs.writeFileSync(path.join(output,'mobile-graphics-results.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({status:report.status,passedCases:cases.length,viewports:['432x960','360x800','960x432'],cases:cases.map(c=>({name:c.name,holdMs:c.holdMs,fadeAndCleanupMs:c.fadeAndCleanupMs,status:c.status}))},null,2));
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
})().catch(error=>{console.error(error);server.close();process.exitCode=1});
