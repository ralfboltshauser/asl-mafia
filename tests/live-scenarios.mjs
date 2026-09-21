import assert from 'node:assert/strict';
const base=process.env.TEST_URL||'http://127.0.0.1:4188';
let assertions=0;
async function call(seat,action,extra={},expected=200){const res=await fetch(base+'/api',{method:'POST',headers:{'Content-Type':'application/json',...(seat?.token?{Authorization:`Bearer ${seat.token}`}:{})},body:JSON.stringify({action,...(seat?{code:seat.code,stage:seat.state?.stage}:{}),...extra})});const data=await res.json();assert.equal(res.status,expected,`${action}: ${data.error||res.status}`);assertions++;if(expected!==200)return data;if(seat){if(data.token)seat.token=data.token;seat.state=data.state;seat.code=data.state.code;return seat;}return {token:data.token,state:data.state,code:data.state.code};}
async function room(config,count=7){const host=await call(null,'create',{name:'QA creator'}),seats=[host];for(let i=1;i<count;i++)seats.push(await call(null,'join',{name:`QA player ${i}`,code:host.code}));await call(host,'configure',{config:{mafia:1,sheriff:true,angel:true,...config}});await call(host,'start');await Promise.all(seats.map(s=>call(s,'state')));await Promise.all(seats.map(s=>call(s,'ready')));await Promise.all(seats.map(s=>call(s,'state')));assert.ok(seats.every(s=>s.state.phase==='night'));return seats;}
const refresh=seats=>Promise.all(seats.map(s=>call(s,'state')));
async function day(seats,target='skip'){await refresh(seats);await call(seats[0],'vote');await refresh(seats);const living=seats.filter(s=>s.state.me.alive);await Promise.all(living.map(s=>call(s,'choose',{target:target===s.state.me.id?'skip':target})));await refresh(seats);}
async function angelScenario(config){
 const label=Object.values(config).join('/'),seats=await room(config),host=seats[0];
 const mafia=seats.find(s=>s.state.me.role==='mafia'),angel=seats.find(s=>s.state.me.role==='angel'),sheriff=seats.find(s=>s.state.me.role==='sheriff');let lastUsed=null;
 for(let round=1;round<=3;round++){
  await refresh(seats);const available=config.angelFrequency==='every'||(config.angelFrequency==='once'?lastUsed===null:lastUsed!==round-1);
  assert.equal(angel.state.me.angelAvailable,available,`${label} availability at night ${round}`);assertions++;
  const target=seats.find(s=>s.state.me.alive&&s.state.me.role==='town'),miss=config.angelCountOn==='save'&&round===1;
  if(config.angelInformed&&available){assert.equal(angel.state.me.angelWaiting,true);await call(angel,'choose',{target:target.state.me.id},400);}
  await call(mafia,'choose',{target:target.state.me.id});await refresh(seats);
  assert.equal(angel.state.me.angelTarget,config.angelInformed&&available?target.state.me.name:null);
  assert.ok(seats.filter(s=>s!==angel).every(s=>!('angelTarget'in s.state.me)));
  assert.ok(seats.every(s=>s.state.players.every(p=>!('role'in p)&&!('token'in p))));assertions+=3;
  const protect=available?(miss?angel.state.me.id:target.state.me.id):'sleep';
  await Promise.all(seats.filter(s=>s.state.me.nightActionRequired&&s!==mafia).map(s=>call(s,'choose',{target:s===angel?protect:s===sheriff?mafia.state.me.id:'sleep'})));
  await refresh(seats);const saved=available&&!miss;
  if(available&&(config.angelCountOn==='use'||saved))lastUsed=round;
  assert.equal(host.state.phase,'discussion');assert.equal(host.state.report.name,saved?null:target.state.me.name);assert.equal(sheriff.state.me.investigation.mafia,true);assert.ok(seats.filter(s=>s!==sheriff).every(s=>s.state.me.investigation===null));assertions+=4;
  if(!saved)await call(target,'choose',{target:'skip'},400);
  await day(seats,round===3?mafia.state.me.id:'skip');
  if(round<3){assert.equal(host.state.phase,'result');assert.equal(host.state.report.name,null);await call(host,'night');}
 }
 assert.equal(host.state.phase,'over');assert.equal(host.state.winner,'town');assertions+=2;
 console.log(`PASS angel ${label}: 3 actual nights, failed/successful saves, cooldown/use limit, sheriff privacy, abstention, town win.`);
}
async function mafiaGame(){const seats=await room({mafia:2,sheriff:false,angel:false},7),host=seats[0];for(let round=1;round<=2;round++){await refresh(seats);const target=seats.find(s=>s.state.me.alive&&s.state.me.role==='town');await Promise.all(seats.filter(s=>s.state.me.nightActionRequired).map(s=>call(s,'choose',{target:s.state.me.role==='mafia'?target.state.me.id:'sleep'})));await refresh(seats);assert.equal(host.state.report.name,target.state.me.name);if(round===1){const towns=seats.filter(s=>s.state.me.alive&&s.state.me.role==='town');await day(seats,towns[0].state.me.id);assert.equal(host.state.phase,'result');await call(host,'night');}}
 assert.equal(host.state.phase,'over');assert.equal(host.state.winner,'mafia');assert.ok(host.state.players.every(p=>p.role));await call(host,'restart');assert.equal(host.state.phase,'lobby');assert.ok(host.state.players.every(p=>p.alive&&!('role'in p)));console.log('PASS complete mafia win: optional roles disabled, two mafia, night/day elimination, parity, full reveal, replay.');}
async function edgeCases(){
 const seats=await room({mafia:2,angelInformed:true},7),host=seats[0],mafia=seats.filter(s=>s.state.me.role==='mafia'),angel=seats.find(s=>s.state.me.role==='angel'),sheriff=seats.find(s=>s.state.me.role==='sheriff'),town=seats.find(s=>s.state.me.role==='town');
 await call(seats[1],'vote',{},400);await call(host,'configure',{config:{mafia:1,sheriff:true,angel:true}},400);await call(null,'join',{name:'Too late',code:host.code},400);
 await call(mafia[0],'choose',{target:mafia[1].state.me.id},400);await call(sheriff,'choose',{target:sheriff.state.me.id},400);
 await call(mafia[0],'choose',{target:sheriff.state.me.id});await call(mafia[1],'choose',{target:town.state.me.id});await refresh(seats);
 const chosen=angel.state.me.angelTarget;assert.ok([sheriff.state.me.name,town.state.me.name].includes(chosen));await call(mafia[0],'choose',{target:angel.state.me.id});await refresh(seats);assert.equal(angel.state.me.angelTarget,chosen);
 await Promise.all(seats.filter(s=>s.state.me.role!=='mafia'&&s.state.me.nightActionRequired).map(s=>call(s,'choose',{target:s===angel?'sleep':s===sheriff?mafia[0].state.me.id:'sleep'})));await refresh(seats);assert.equal(host.state.report.name,chosen);assert.equal(sheriff.state.me.investigation.mafia,true);
 // Vote the creator out; if already killed at night, they still control the phase.
 await day(seats,host.state.me.alive?host.state.me.id:'skip');assert.equal(host.state.me.alive,false);assert.equal(host.state.phase,'result');await call(host,'night');await refresh(seats);assert.equal(host.state.phase,'night');await call(host,'choose',{target:'sleep'},400);
 console.log('PASS night tie consistency, locked actions, dead creator can advance, illegal targets, late joins, settings/creator authorization.');
 const lobby=await call(null,'create',{name:'Capacity QA'});await call(lobby,'start',{},400);await call(null,'join',{name:'capacity qa',code:lobby.code},400);
 const guests=[];for(let i=1;i<12;i++)guests.push(await call(null,'join',{name:`Guest ${i}`,code:lobby.code}));await call(null,'join',{name:'Guest 13',code:lobby.code},400);
 await call(lobby,'state');await call(lobby,'remove',{target:guests[0].state.me.id});await call(guests[0],'state',{},401);await call(null,'join',{name:'Replacement',code:lobby.code});
 console.log('PASS 5-player minimum, 12-player capacity, duplicate names, remove/rejoin, removed-seat authorization.');
}
const configs=[];for(const informed of [false,true])for(const frequency of ['every','once','alternate'])for(const countOn of ['use','save'])configs.push({angelInformed:informed,angelFrequency:frequency,angelCountOn:countOn});
for(let i=0;i<configs.length;i+=3)await Promise.all(configs.slice(i,i+3).map(angelScenario));
await mafiaGame();await edgeCases();console.log(`PASS ${configs.length+2} live scenarios, ${assertions} checked API responses/state assertions.`);
