import {chromium,webkit} from 'playwright';import assert from 'node:assert/strict';
const base=process.env.TEST_URL||'http://127.0.0.1:4191';
async function api(action,seat,extra={}){const res=await fetch(base+'/api',{method:'POST',headers:{'Content-Type':'application/json',...(seat?{Authorization:`Bearer ${seat.token}`}:{})},body:JSON.stringify({action,...(seat?{code:seat.state.code,stage:seat.state.stage}:{}),...extra})});const data=await res.json();assert.equal(res.status,200,data.error);return {...seat,...data};}
for(const engine of [chromium,webkit]){
 const browser=await engine.launch(),context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});let seats=[await api('create',null,{name:'Rowan'})];for(const name of ['Mina','Alex','Jo','Zoe'])seats.push(await api('join',null,{name,code:seats[0].state.code}));
 const refresh=async()=>{seats=await Promise.all(seats.map(s=>api('state',s)));};
 await context.addInitScript(seat=>localStorage.setItem('asl-mafia-seat-v2',JSON.stringify(seat)),{token:seats[0].token,code:seats[0].state.code});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const poll=()=>page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
 const count=async(text)=>{await poll();await page.waitForFunction(text=>document.querySelector('.progress-count')?.textContent===text,text);};
 try{
  await page.goto(base);await page.locator('.lobby-players summary').click();assert.equal(await page.locator('.lobby-players li').count(),5);
  seats[0]=await api('start',seats[0]);await refresh();await count('0 / 5 ready');await page.locator('.progress-details summary').tap();assert.equal(await page.locator('.readiness-list li').count(),5);assert.equal(await page.locator('.readiness-status').first().textContent(),'Not ready');
  await api('ready',seats[1]);await count('1 / 5 ready');assert.equal(await page.locator('.progress-details').evaluate(e=>e.open),true);assert.match(await page.locator('.readiness-list li').filter({hasText:'Mina'}).textContent(),/✓ Ready/);
  await Promise.all(seats.filter((_,i)=>i!==1).map(s=>api('ready',s)));await refresh();await poll();await page.getByText('NIGHT IN PROGRESS',{exact:true}).waitFor();assert.equal(await page.locator('.progress-details').count(),0);
  const mafia=seats.find(s=>s.state.me.role==='mafia'),target=seats.find(s=>s.state.me.role==='town'),sheriff=seats.find(s=>s.state.me.role==='sheriff'),angel=seats.find(s=>s.state.me.role==='angel');
  await api('choose',mafia,{target:target.state.me.id});await poll();assert.equal(await page.locator('.readiness-list').count(),0);
  await Promise.all(seats.filter(s=>s!==mafia&&s.state.me.nightActionRequired).map(s=>api('choose',s,{target:s===sheriff?mafia.state.me.id:s===angel?angel.state.me.id:'sleep'})));await refresh();await api('vote',seats[0]);await refresh();await count('0 / 4 voted');await page.locator('.progress-details summary').tap();assert.equal(await page.locator('.readiness-list li').count(),4);assert.equal(await page.locator('.readiness-list li').filter({hasText:target.state.me.name}).count(),0);
  const voter=seats.find(s=>s.state.me.alive);await api('choose',voter,{target:'skip'});await count('1 / 4 voted');assert.match(await page.locator('.readiness-list li').filter({hasText:voter.state.me.name}).textContent(),/✓ Voted/);assert.equal(await page.locator('.readiness-list').getByText('Abstain',{exact:true}).count(),0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
  await page.screenshot({path:`/tmp/mafia-readiness-${engine.name()}.png`});console.log(`PASS ${engine.name()}: lobby roster, tap-to-expand readiness/vote status and anonymous night progress, live updates retain open panel, dead players excluded, no role/choice shown, no mobile overflow.`);
 }finally{await browser.close();}
}
