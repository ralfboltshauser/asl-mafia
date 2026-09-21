import assert from 'node:assert/strict';import {mkdirSync,writeFileSync,readFileSync,unlinkSync} from 'node:fs';import {createRoom,newPlayer,join} from '../engine.mjs';
const base=process.env.TEST_URL||'http://127.0.0.1:4192';if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw new Error('This persisted-room test is local-only.');
async function request(r,action='state',extra={}){const res=await fetch(base+'/api',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${r.players[0].token}`},body:JSON.stringify({action,code:r.code,stage:r.stage,...extra})});assert.equal(res.status,200);return (await res.json()).state;}
for(const variant of ['complete','partial','cooldown']){
 const r=createRoom('Legacy test');for(let i=1;i<5;i++)join(r,newPlayer(`Test ${i}`));r.players.forEach((p,i)=>p.role=['mafia','sheriff','angel','town','town'][i]);r.phase='night';r.round=variant==='cooldown'?2:1;r.stage=9;r.nightTarget=r.players[3].id;delete r.config.dayVoteVisibility;
 r.actions={[r.players[0].id]:r.players[3].id};
 if(variant!=='partial')r.actions[r.players[1].id]=r.players[0].id;
 if(variant!=='cooldown')r.actions[r.players[2].id]=r.players[3].id;else{r.config.angelFrequency='alternate';r.angelLastUsed=1;}
 mkdirSync(new URL('../.data/',import.meta.url),{recursive:true});const file=new URL(`../.data/${r.code}.json`,import.meta.url);writeFileSync(file,JSON.stringify(r),{flag:'wx',mode:0o600});
 try{
  const before=readFileSync(file,'utf8');const states=await Promise.all(Array.from({length:8},()=>request(r)));
  if(variant==='partial'){assert.ok(states.every(s=>s.phase==='night'));assert.equal(readFileSync(file,'utf8'),before);const res=await fetch(base+'/api',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${r.players[1].token}`},body:JSON.stringify({action:'choose',code:r.code,stage:r.stage,target:r.players[0].id})});assert.equal(res.status,200);assert.equal((await res.json()).state.phase,'discussion');}
  else{assert.ok(states.every(s=>s.phase==='discussion'));assert.ok(states.every(s=>s.stage===r.stage+1));assert.ok(states.every(s=>s.report.name===(variant==='cooldown'?r.players[3].name:null)));}
  const saved=JSON.parse(readFileSync(file,'utf8'));assert.equal(saved.round,r.round);assert.equal(saved.revision,1);assert.deepEqual(saved.players.map(p=>p.role),r.players.map(p=>p.role));assert.equal(saved.investigations[r.players[1].id].mafia,true);if(variant==='cooldown')assert.equal(saved.angelLastUsed,1);console.log(`PASS persisted ${variant} night: concurrent polls, preserved choices/roles, exactly one resolution, no reset.`);
 }finally{unlinkSync(file);}
}
