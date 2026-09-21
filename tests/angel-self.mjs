import {chromium} from 'playwright';import assert from 'node:assert/strict';
const base=process.env.TEST_URL||'http://127.0.0.1:4199';const seats=[];let code;
async function api(i,action,extra={}){const res=await fetch(`${base}/api`,{method:'POST',headers:{'Content-Type':'application/json',...(seats[i]?{Authorization:`Bearer ${seats[i].token}`}:{})},body:JSON.stringify({code,action,...extra})});const data=await res.json();assert.equal(res.status,200,JSON.stringify(data));return data;}
const browser=await chromium.launch();try{
 const first=await api(0,'create',{name:'Self-limit host'});code=first.state.code;seats.push(first);for(let i=1;i<5;i++)seats.push(await api(i,'join',{name:`Player ${i}`}));
 async function pageFor(i){const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await ctx.addInitScript(seat=>localStorage.setItem('asl-mafia-seat-v2',JSON.stringify(seat)),{code,token:seats[i].token});const page=await ctx.newPage();await page.goto(base);return page;}
 const host=await pageFor(0);await host.locator('.angel-settings summary').click();await host.locator('#angelFrequency').selectOption('alternate');await host.locator('#angelCountOn').selectOption('self');await host.getByText('Only self-protection is limited.',{exact:false}).waitFor();assert.equal((await api(0,'state')).state.config.angelCountOn,'self');await host.getByRole('button',{name:'Start game',exact:true}).click();let state=(await api(0,'state')).state;for(let i=0;i<5;i++)await api(i,'ready',{stage:state.stage});
 const states=await Promise.all(seats.map((_,i)=>api(i,'state').then(d=>d.state)));const angel=states.findIndex(s=>s.me.role==='angel'),mafia=states.findIndex(s=>s.me.role==='mafia'),sheriff=states.findIndex(s=>s.me.role==='sheriff'),town=states.findIndex(s=>s.me.role==='town');const page=await pageFor(angel);
 for(let round=1;round<=3;round++){
  state=(await api(angel,'state')).state;assert.equal(state.round,round);assert.equal(state.me.angelAvailable,true);assert.equal(state.me.angelSelfAvailable,round!==2);
  const target=states[round===2?town:angel].me.id;
  await api(mafia,'choose',{stage:state.stage,target});await api(sheriff,'choose',{stage:state.stage,target:states[mafia].me.id});
  await page.reload();await page.getByRole('button',{name:'Open my private turn'}).click();assert.equal(await page.locator(`[data-choice="${states[angel].me.id}"]`).count(),round===2?0:1);if(round===2)await page.getByText('Self-protection is unavailable tonight.',{exact:false}).waitFor();await page.locator(`[data-choice="${target}"]`).click();await page.getByRole('button',{name:'Lock my choice'}).click();await page.getByRole('heading',{name:'Nobody died last night.'}).waitFor();
  state=(await api(0,'state')).state;assert.equal(state.phase,'discussion');assert.equal(state.report.name,null);
  if(round<3){state=(await api(0,'vote',{stage:state.stage})).state;for(let i=0;i<5;i++)await api(i,'choose',{stage:state.stage,target:'skip'});state=(await api(0,'state')).state;await api(0,'night',{stage:state.stage});}
 }
 console.log('PASS: settings save; self-protection on nights 1 and 3; self excluded on night 2 while another player can be protected; all three saves resolve correctly.');
}finally{await browser.close();}
