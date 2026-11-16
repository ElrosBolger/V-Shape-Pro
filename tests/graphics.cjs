'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const splashScript=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)][0][1];
const swScript=fs.readFileSync(path.join(root,'sw.js'),'utf8');
class Target {
 constructor(){this.listeners=new Map()}
 addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn)}
 removeEventListener(type,fn){this.listeners.get(type)?.delete(fn)}
 fire(type,data={}){for(const fn of [...this.listeners.get(type)||[]])fn(data)}
}
function splashHarness(opts={}){
 let now=0,id=0;const timers=new Map(),writes=[];
 const body={children:[],appendChild(el){this.children.push(el);el.parent=this}};
 const document=new Target();document.hidden=!!opts.hidden;document.body=body;
 document.createElement=tag=>{const el=new Target();el.tag=tag;el.hidden=false;el.classes=new Set();el.classList={add:x=>el.classes.add(x)};el.setAttribute=()=>{};el.appendChild=x=>{el.image=x};el.remove=()=>{body.children=body.children.filter(x=>x!==el)};return el};
 const window=new Target();window.matchMedia=()=>({matches:!!opts.reduced});
 const stored=opts.raw??JSON.stringify(opts.active?{active:opts.workout||{stage:'train'},records:[{id:'sentinel'}]}:{active:null,records:[{id:'sentinel'}]});
 const context={document,window,localStorage:{getItem(){if(opts.denied)throw Error('denied');return stored},setItem(...args){writes.push(args)},removeItem(){throw Error('must not delete')}},location:{search:opts.query||''},URLSearchParams,Date:{now:()=>1700000000000+now},performance:{now:()=>now,getEntriesByType:()=>[{type:opts.navigation||'navigate'}]},setTimeout(fn,delay){timers.set(++id,{at:now+delay,fn});return id},clearTimeout(id){timers.delete(id)}};
 vm.runInNewContext(splashScript,context);
 function advance(ms){const until=now+ms;while(true){const pending=[...timers].filter(([,t])=>t.at<=until).sort((a,b)=>a[1].at-b[1].at)[0];if(!pending)break;now=pending[1].at;timers.delete(pending[0]);pending[1].fn()}now=until}
 return {document,window,body,writes,advance,get overlay(){return body.children[0]},get now(){return now}};
}
test('loaded artwork fades at 2500 ms and removes by 2920 ms, without storage writes',()=>{
 const h=splashHarness(),el=h.overlay;assert.equal(el.hidden,true);el.image.fire('load');assert.equal(el.hidden,false);h.advance(2499);assert(!el.classes.has('vs-splash-out'));h.advance(1);assert(el.classes.has('vs-splash-out'));h.advance(420);assert.equal(h.overlay,undefined);assert.deepEqual(h.writes,[]);
});
for(const [label,opts] of Object.entries({'invalid saved JSON':{raw:'broken'},'storage unavailable':{denied:true},'Spotify code callback':{query:'?code=test&state=test'},'Spotify error callback':{query:'?error=access_denied'},'history return':{navigation:'back_forward'},'background opening':{hidden:true}})){
 test('skip introduction: '+label,()=>{const h=splashHarness(opts);assert.equal(h.overlay,undefined);assert.deepEqual(h.writes,[])})
}
test('failed image removes overlay immediately',()=>{const h=splashHarness();h.overlay.image.fire('error');assert.equal(h.overlay,undefined);h.advance(2000);assert.equal(h.overlay,undefined)});
test('image never loads: no visible black overlay and cleanup still runs',()=>{const h=splashHarness();assert(h.overlay.hidden);h.advance(2000);assert.equal(h.overlay,undefined)});
test('late image never covers the app',()=>{const h=splashHarness();h.advance(1900);h.overlay.image.fire('load');assert.equal(h.overlay,undefined)});
test('reduced motion: no fade at deadline',()=>{const h=splashHarness({reduced:true});const el=h.overlay;el.image.fire('load');h.advance(2500);assert.equal(h.overlay,undefined);assert(!el.classes.has('vs-splash-out'))});
for(const [label,fire] of Object.entries({'page hidden':h=>{h.document.hidden=true;h.document.fire('visibilitychange')},'pagehide':h=>h.window.fire('pagehide'),'BFCache return':h=>h.window.fire('pageshow',{persisted:true}),'touch/click':h=>h.document.fire('pointerdown'),'keyboard':h=>h.document.fire('keydown')})){
 test('immediate exit on '+label,()=>{const h=splashHarness();h.overlay.image.fire('load');fire(h);assert.equal(h.overlay,undefined)})
}
test('intro timeout is independent of an application startup exception',()=>{const h=splashHarness();h.overlay.image.fire('load');try{throw Error('application startup failure')}catch{}h.advance(2920);assert.equal(h.overlay,undefined)});

function workerHarness(opts={}){
 const handlers={},deleted=[],put=[],added=[];let skip=0,claim=0;
 const scope='https://elrosbolger.github.io/V-Shape-Pro/';
 const cached=opts.cached||new Map();
 const cache={async addAll(assets){if(opts.installFail)throw Error('download failure');added.push(...assets)},async match(key){return cached.get(typeof key==='string'?new URL(key,scope).href:key.url)},async put(request,response){if(opts.quota)throw Error('quota');put.push(request.url);cached.set(request.url,response)}};
 const self={registration:{scope},location:{origin:new URL(scope).origin},addEventListener:(type,fn)=>handlers[type]=fn,skipWaiting:async()=>skip++,clients:{claim:async()=>claim++}};
 const caches={open:async()=>cache,keys:async()=>['vshape-pro-v8-20261116','vshape-pro-v9-original-graphics-20261116','vshape-pro-v10-pixel-graphics-20261116','another-app-cache'],delete:async key=>deleted.push(key)};
 vm.runInNewContext(swScript,{self,caches,URL,Set,Response,fetch:async request=>{if(opts.offline)throw Error('offline');return new Response('network',{status:200,headers:{'Content-Type':'text/plain'}})}});
 async function run(type,request){const pending=[];let response;handlers[type]({request,waitUntil:p=>pending.push(p),respondWith:p=>response=p});const result=response?await response:undefined;await Promise.all(pending);return result}
 return {run,deleted,put,added,cached,get skip(){return skip},get claim(){return claim}};
}
const request=(url,mode='cors',method='GET')=>({url,mode,method});
const scope='https://elrosbolger.github.io/V-Shape-Pro/';
test('worker install precaches all existing assets, including original graphics',async()=>{const h=workerHarness();await h.run('install');assert.equal(h.skip,1);assert(h.added.includes('./splash-1080x2400.jpg'));for(const asset of h.added){assert(fs.existsSync(path.join(root,asset==='./'?'index.html':asset)))}assert(!h.added.includes('./icon.svg'))});
test('failed precache never activates the incomplete worker',async()=>{const h=workerHarness({installFail:true});await assert.rejects(h.run('install'));assert.equal(h.skip,0)});
test('activation preserves unrelated app caches',async()=>{const h=workerHarness();await h.run('activate');assert.deepEqual(h.deleted,['vshape-pro-v8-20261116','vshape-pro-v9-original-graphics-20261116']);assert.equal(h.claim,1)});
for(const [label,req] of Object.entries({Spotify:request('https://api.spotify.com/v1/me/player'),OAuth:request('https://accounts.spotify.com/api/token','cors','POST'),'another app':request('https://elrosbolger.github.io/SAC-Desk/')})){
 test('worker leaves '+label+' requests alone',async()=>{const h=workerHarness();assert.equal(await h.run('fetch',req),undefined);assert.deepEqual(h.put,[])})
}
test('online icon response remains available if cache quota is exceeded',async()=>{const h=workerHarness({quota:true});const result=await h.run('fetch',request(scope+'icon-512.png'));assert.equal(await result.text(),'network')});
test('OAuth callback query strings are never cached',async()=>{const h=workerHarness();await h.run('fetch',request(scope+'?code=test&state=test','navigate'));assert.deepEqual(h.put,[])});
test('offline cached splash is served as image, not HTML',async()=>{const cached=new Map([[scope+'splash-1080x2400.jpg',new Response('image bytes',{headers:{'Content-Type':'image/jpeg'}})]]);const h=workerHarness({offline:true,cached});const res=await h.run('fetch',request(scope+'splash-1080x2400.jpg'));assert.equal(res.headers.get('Content-Type'),'image/jpeg')});
test('offline missing image returns network error instead of an HTML fallback',async()=>{const h=workerHarness({offline:true,cached:new Map([[scope+'index.html',new Response('<html>app</html>')]])});const res=await h.run('fetch',request(scope+'missing.jpg'));assert.equal(res.type,'error')});
test('offline navigation still opens the cached application',async()=>{const h=workerHarness({offline:true,cached:new Map([[scope+'index.html',new Response('<html>app</html>')]])});const res=await h.run('fetch',request(scope+'?offline','navigate'));assert.equal(await res.text(),'<html>app</html>')});

const appScript=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)][1][1];
test('leaving the rest screen stops only DOM updates; absolute rest deadline resumes correctly',()=>{
 const source=appScript.slice(appScript.indexOf('let ticker=null;'),appScript.indexOf('function adjustRest'));
 let now=100000,callback,cleared=0;
 const elements={clock:{textContent:''},ready:{textContent:''}};
 const active={day:'A',stage:'rest',ex:0,set:1,restEnd:220000};
 const before=JSON.stringify(active);
 const context={state:{active},app:{innerHTML:''},document:{getElementById:id=>elements[id]||null},Date:{now:()=>now},header:()=>'',days:{A:{ex:[{}]}},blockEx:()=>'',esc:x=>x,setInterval:fn=>{callback=fn;return 1},clearInterval:()=>cleared++,restFinishedAlert:()=>{}};
 vm.createContext(context);vm.runInContext(source,context);vm.runInContext('restView()',context);
 assert.equal(elements.clock.textContent,'02:00');
 delete elements.clock;delete elements.ready;const count=cleared;
 assert.doesNotThrow(()=>callback());assert(cleared>count);assert.equal(JSON.stringify(active),before);
 now+=10000;elements.clock={textContent:''};elements.ready={textContent:''};vm.runInContext('restView()',context);
 assert.equal(elements.clock.textContent,'01:50');assert.equal(JSON.stringify(active),before);
});
function backupHarness(){
 const source=appScript.slice(appScript.indexOf('function exportJSON'),appScript.indexOf('function localDay'));
 const stored={week:4,loads:{'A:1:0':'40'},records:[{date:'2026-11-10T12:00:00Z',day:'A',week:4,entries:[{exercise:'Lat machine avanti',kg:'40',reps:12,rir:'2'}]}],active:null,measurements:{weight:'80'},measurementHistory:[],profile:{}};
 const downloads=[],messages=[];let saves=0,homes=0;
 const context={state:structuredClone(stored),initial:{week:1,loads:{},records:[],active:null},download:(name,body,type)=>downloads.push({name,body,type}),appConfirm:(message,confirm)=>{messages.push(message);confirm()},save:()=>saves++,home:()=>homes++,alert:message=>messages.push(message)};
 vm.createContext(context);vm.runInContext(source,context);
 return {context,downloads,messages,stored,get saves(){return saves},get homes(){return homes}};
}
test('JSON export preserves all synthetic workout data',()=>{const h=backupHarness();vm.runInContext('exportJSON()',h.context);assert.deepEqual(JSON.parse(h.downloads[0].body),h.stored);assert.equal(h.downloads[0].type,'application/json')});
test('CSV export contains the synthetic set and UTF-8 BOM',()=>{const h=backupHarness();vm.runInContext('exportCSV()',h.context);assert(h.downloads[0].body.startsWith('\ufeff'));assert(h.downloads[0].body.includes('"Lat machine avanti";"40";"12";"2"'))});
test('valid synthetic JSON import preserves history, loads and measurements',async()=>{const h=backupHarness();await h.context.importJSON({target:{files:[{text:async()=>JSON.stringify(h.stored)}]}});assert.deepEqual(JSON.parse(JSON.stringify(h.context.state)),h.stored);assert.equal(h.saves,1);assert.equal(h.homes,1)});
test('invalid backup is rejected without overwriting current data',async()=>{const h=backupHarness();await h.context.importJSON({target:{files:[{text:async()=>'{"week":9}'}]}});assert.deepEqual(h.context.state,h.stored);assert.equal(h.saves,0);assert(h.messages.some(x=>x.includes('Formato non valido')))});

test('active training workout shows introduction without changing saved data',()=>{const h=splashHarness({active:true});assert(h.overlay);h.overlay.image.fire('load');assert(!h.overlay.hidden);h.advance(2920);assert.equal(h.overlay,undefined);assert.deepEqual(h.writes,[])});
test('active recovery with time remaining shows introduction without resetting deadline',()=>{const h=splashHarness({active:true,workout:{stage:'rest',restEnd:1700000120000}});assert(h.overlay);h.overlay.image.fire('load');h.advance(2920);assert.equal(h.overlay,undefined);assert.deepEqual(h.writes,[])});
for(const [label,opts] of Object.entries({'rest due now':{active:true,workout:{stage:'rest',restEnd:1700000000000}},'rest due during intro':{active:true,workout:{stage:'rest',restEnd:1700000002800}},'warm-up timer due':{active:true,workout:{stage:'warm',warmTimer:{running:true,ends:1700000002000}}},'explicit resume':{query:'?resume=1'},'explicit quick access':{query:'?quick=1'}})){
 test('immediate access bypasses intro: '+label,()=>assert.equal(splashHarness(opts).overlay,undefined));
}
test('ordinary foreground reopening after 30 seconds shows one new introduction',()=>{const h=splashHarness({active:true});h.overlay.image.fire('load');h.advance(2920);h.document.hidden=true;h.document.fire('visibilitychange');h.advance(30001);h.document.hidden=false;h.document.fire('visibilitychange');assert(h.overlay);h.overlay.image.fire('load');assert.equal(h.body.children.length,1);assert.deepEqual(h.writes,[])});
test('quick foreground reopening preserves immediate access without another intro',()=>{const h=splashHarness({active:true});h.overlay.image.fire('load');h.advance(2920);h.document.hidden=true;h.document.fire('visibilitychange');h.advance(1000);h.document.hidden=false;h.document.fire('visibilitychange');assert.equal(h.overlay,undefined)});
