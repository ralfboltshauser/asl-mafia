import assert from 'node:assert/strict';
const base=process.env.TEST_URL||'http://127.0.0.1:4187';
async function api(action,seat,extra={}){const res=await fetch(base+'/api',{method:'POST',headers:{'Content-Type':'application/json',...(seat?{Authorization:'Bearer '+seat.token}:{})},body:JSON.stringify({action,...(seat?{code:seat.state.code,stage:seat.state.stage}:{}),...extra})});const data=await res.json();assert.equal(res.status,200,data.error);return {...seat,...data};}
const count=Number(process.env.PLAYERS||7);
const owner=await api('create',null,{name:'Concurrent test'}),seats=[owner,...await Promise.all(Array.from({length:count-1},(_,i)=>api('join',null,{name:`Player ${i+2}`,code:owner.state.code})))];
seats[0]=await api('configure',owner,{config:{mafia:2,sheriff:true,angel:true}});seats[0]=await api('start',seats[0]);
for(let i=0;i<count;i++)seats[i]=await api('state',seats[i]);
await Promise.all(seats.map(s=>api('ready',s)));
for(let i=0;i<count;i++)seats[i]=await api('state',seats[i]);
assert.ok(seats.every(s=>s.state.phase==='night'));
const mafia=seats.find(s=>s.state.me.role==='mafia').state.me.id,target=seats.find(s=>s.state.me.role==='town').state.me.id;
await Promise.all(seats.filter(s=>s.state.me.nightActionRequired).map(s=>api('choose',s,{target:s.state.me.role==='sheriff'?mafia:s.state.me.role==='town'?'sleep':target})));
const result=await api('state',seats[0]);assert.equal(result.state.phase,'discussion');assert.equal(result.state.report.name,null);assert.equal(result.state.players.filter(p=>p.alive).length,count);
const denied=await fetch(base+'/api',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer wrong'},body:JSON.stringify({action:'state',code:owner.state.code})});assert.equal(denied.status,401);
console.log(`PASS: ${count} concurrent players joining and submitting, two mafia, no lost votes, protected target, unauthorized seat rejected.`);
