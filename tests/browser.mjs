import {chromium,webkit} from 'playwright';
import assert from 'node:assert/strict';
const base=process.env.TEST_URL||'http://127.0.0.1:4187';
const browser=await (process.env.BROWSER==='webkit'?webkit:chromium).launch({headless:true});const pages=[],errors=[];
try{
 for(let i=0;i<5;i++){const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));pages.push(p);}
 if(process.env.GUIDED)await pages[0].addInitScript(()=>{window.audioStarts=0;const start=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(...args){window.audioStarts++;return start.apply(this,args);};});
 const creator=pages[0];await creator.goto(base);await creator.locator('#name').fill('Ralf');await creator.getByRole('button',{name:'Create room',exact:true}).click();await creator.locator('.room-code').waitFor();const code=await creator.locator('.room-code').textContent();
 for(let i=1;i<5;i++){await pages[i].goto(`${base}/?room=${code}`);await pages[i].locator('#name').fill(['','Nina','Sam','Alex','Jo'][i]);await pages[i].getByRole('button',{name:'Join the table'}).click();await pages[i].locator('.room-code').waitFor();}
 await creator.getByRole('button',{name:'Start game'}).waitFor();await creator.locator('#sheriff').uncheck();await creator.locator('#sheriff:not(:checked)').waitFor();await creator.locator('#sheriff').check();
 if(process.env.PUBLIC_VOTES)await creator.locator('#dayVoteVisibility').selectOption('public');
 if(process.env.ANGEL_VARIANT){await creator.locator('.angel-settings summary').click();await creator.locator('#angelInformed').selectOption('true');await creator.locator('#angelFrequency').selectOption('alternate');await creator.locator('#angelCountOn').selectOption('save');}
 if(process.env.GUIDED){await creator.locator('#audio-controls summary').click();await creator.locator('#audio-mode').selectOption('narration');await creator.getByText('Guided night:',{exact:false}).waitFor();}
 await creator.getByRole('button',{name:'Start game'}).click();
 const seats=[],states=[];
 for(const p of pages){await p.getByRole('button',{name:'View private information'}).click();await p.locator('.secret-card').waitFor();seats.push(await p.evaluate(()=>JSON.parse(localStorage.getItem('asl-mafia-seat-v2'))));await p.getByRole('button',{name:'Ready'}).click();}
 async function getState(i){const res=await fetch(`${base}/api`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${seats[i].token}`},body:JSON.stringify({action:'state',code})});assert.equal(res.status,200);return (await res.json()).state;}
 for(let i=0;i<5;i++)states.push(await getState(i));assert.ok(states.every(s=>s.phase==='night'));
 const mafia=states.findIndex(s=>s.me.role==='mafia'),sheriff=states.findIndex(s=>s.me.role==='sheriff'),angel=states.findIndex(s=>s.me.role==='angel'),town=states.findIndex(s=>s.me.role==='town');
 assert.ok(states.every(s=>s.players.every(p=>!('role'in p)&&!('token'in p))));
 for(let i=0;i<5;i++)if(states[i].me.role==='town'){await pages[i].getByText('Nothing to do tonight.',{exact:true}).waitFor();assert.equal(await pages[i].getByRole('button',{name:'Sleep until morning'}).count(),0);}
 const order=process.env.GUIDED?[mafia,sheriff,angel]:process.env.ANGEL_VARIANT?[mafia,...[0,1,2,3,4].filter(i=>i!==mafia)]:[0,1,2,3,4];
 for(const i of order.filter(i=>states[i].me.nightActionRequired)){await pages[i].getByRole('button',{name:'Open my private turn'}).click();if(states[i].me.role==='town'){await pages[i].getByRole('button',{name:'Sleep until morning'}).click();}else{const target=i===sheriff?states[mafia].me.id:states[town].me.id;await pages[i].locator(`[data-choice="${target}"]`).click();await pages[i].getByRole('button',{name:'Lock my choice'}).click();}}
 await creator.getByRole('button',{name:'Start voting'}).waitFor();
 for(let i=0;i<5;i++){const st=await getState(i);assert.equal(st.phase,'discussion');assert.equal(st.report.name,null);assert.equal(st.players.filter(p=>p.alive).length,5);assert.equal(st.me.investigation?.mafia,i===sheriff?true:undefined);}
 await pages[sheriff].reload();await pages[sheriff].getByRole('button',{name:'View private information'}).waitFor();assert.equal(await pages[sheriff].locator('.secret-card').count(),0);await pages[sheriff].getByRole('button',{name:'View private information'}).click();await pages[sheriff].getByText(`${states[mafia].me.name} is mafia.`,{exact:false}).waitFor();
 await creator.getByRole('button',{name:'Start voting'}).click();
 for(let i=0;i<5;i++){await pages[i].locator('[data-choice]').first().waitFor();await pages[i].locator(`[data-choice="${i===mafia&&!process.env.SELF_VOTE?'skip':states[mafia].me.id}"]`).click();await pages[i].getByRole('button',{name:'Lock my vote'}).click();}
 await creator.getByRole('button',{name:'Play again'}).waitFor();
 for(let i=0;i<5;i++){const st=await getState(i);assert.equal(st.phase,'over');assert.equal(st.winner,'town');if(process.env.PUBLIC_VOTES){assert.equal(st.report.ballots.length,5);assert.equal(st.report.ballots.find(b=>b.voter===states[mafia].me.name).target,process.env.SELF_VOTE?states[mafia].me.name:'Abstain');}else assert.equal(st.report.ballots,undefined);}
 assert.equal(await creator.locator('.public-ballots').count(),process.env.PUBLIC_VOTES?1:0);
 await creator.getByRole('button',{name:'Play again'}).waitFor();await creator.screenshot({path:'/tmp/mafia-game-complete.png'});await creator.getByRole('button',{name:'Play again'}).click();await creator.locator('.room-code').waitFor();
 assert.equal(await creator.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);assert.deepEqual(errors,[]);if(process.env.GUIDED)assert.ok(await creator.evaluate(()=>window.audioStarts)>=4,'Real narration audio buffers must start for all role cues and dawn');
 console.log('PASS: five private browser sessions, role settings, role deal, simultaneous night actions, protection, private investigation, reconnect, voting, win, replay, mobile layout.');
}finally{await browser.close();}
