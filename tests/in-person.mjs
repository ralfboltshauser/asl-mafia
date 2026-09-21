import {chromium,webkit} from 'playwright';
import assert from 'node:assert/strict';
const base=process.env.TEST_URL||'http://127.0.0.1:4194';
const browser=await (process.env.BROWSER==='webkit'?webkit:chromium).launch();
try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.locator('#name').fill('Manual host');await page.getByRole('button',{name:'Create room',exact:true}).click();await page.locator('.room-code').waitFor();
 await page.locator('#dayVoteVisibility').selectOption('in-person');await page.getByText('Vote aloud as a group.',{exact:false}).waitFor();
 const seats=[await page.evaluate(()=>JSON.parse(localStorage.getItem('asl-mafia-seat-v2')))];const code=seats[0].code;
 async function api(i,action,extra={},expected=200){const res=await fetch(`${base}/api`,{method:'POST',headers:{'Content-Type':'application/json',...(seats[i]?{Authorization:`Bearer ${seats[i].token}`}:{})},body:JSON.stringify({code,action,...extra})});const data=await res.json();assert.equal(res.status,expected,JSON.stringify(data));return data;}
 for(let i=1;i<5;i++){const data=await api(i,'join',{name:`Guest ${i}`});seats.push({code,token:data.token});}
 await page.getByRole('button',{name:'Start game'}).click();let state=(await api(0,'state')).state;
 for(let i=0;i<5;i++)await api(i,'ready',{stage:state.stage});
 const states=await Promise.all(seats.map((_,i)=>api(i,'state').then(d=>d.state)));const mafia=states.findIndex(s=>s.me.role==='mafia'),sheriff=states.findIndex(s=>s.me.role==='sheriff'),angel=states.findIndex(s=>s.me.role==='angel'),town=states.findIndex(s=>s.me.role==='town');
 async function night(){const s=(await api(0,'state')).state;for(const i of [mafia,sheriff,angel])await api(i,'choose',{stage:s.stage,target:states[i===sheriff?mafia:town].me.id});}
 await night();await page.getByRole('button',{name:'Begin in-person vote'}).click();await page.getByRole('button',{name:'Lock group result'}).waitFor();
 const guest=await (await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true})).newPage();await guest.addInitScript(seat=>localStorage.setItem('asl-mafia-seat-v2',JSON.stringify(seat)),seats[1]);await guest.goto(base);await guest.getByText('No phone vote is needed.',{exact:false}).waitFor();assert.equal(await guest.locator('[data-choice]').count(),0);assert.equal(await guest.locator('.progress-details').count(),0);
 state=(await api(0,'state')).state;const voteStage=state.stage;await api(1,'resolve-vote',{stage:voteStage,target:'skip',confirmed:true},400);await api(0,'resolve-vote',{stage:voteStage,target:'skip'},400);await api(1,'choose',{stage:voteStage,target:'skip'},400);
 assert.equal(await page.locator(`[data-choice="${state.me.id}"]`).count(),1,'creator can record self-elimination');
 await page.locator(`[data-choice="${state.me.id}"]`).click();page.once('dialog',async dialog=>{assert.match(dialog.message(),/eliminate Manual host/);await dialog.dismiss();});await page.getByRole('button',{name:'Lock group result'}).click();assert.equal((await api(0,'state')).state.phase,'vote');
 await page.locator('[data-choice="skip"]').click();page.once('dialog',async dialog=>{assert.match(dialog.message(),/nobody is eliminated/);await dialog.accept();});await page.getByRole('button',{name:'Lock group result'}).click();await page.getByRole('button',{name:'Start next night'}).waitFor();state=(await api(0,'state')).state;assert.equal(state.report.name,null);assert.equal(state.report.method,'in-person');assert.equal(state.report.tally,undefined);
 await api(0,'resolve-vote',{stage:voteStage,target:states[town].me.id,confirmed:true},400);assert.ok((await api(0,'state')).state.players.every(p=>p.alive));
 await page.getByRole('button',{name:'Start next night'}).click();await night();await page.getByRole('button',{name:'Begin in-person vote'}).click();await page.locator(`[data-choice="${states[mafia].me.id}"]`).click();page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Lock group result'}).click();await page.getByRole('button',{name:'Play again'}).waitFor();state=(await api(0,'state')).state;assert.equal(state.winner,'town');assert.equal(state.report.name,states[mafia].me.name);assert.equal(state.report.ballots,undefined);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 console.log('PASS in-person: lobby choice, read-only guests, host self-target, cancelled confirmation, no elimination, stale duplicate rejection, second night, confirmed elimination and victory.');
}finally{await browser.close();}
