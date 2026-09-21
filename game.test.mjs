import test from 'node:test';import assert from 'node:assert/strict';
import {createRoom,newPlayer,join,act,view,winner,settleNight} from './engine.mjs';
function game(roles=['mafia','sheriff','angel','town','town']){const r=createRoom('Player 1');for(let i=1;i<roles.length;i++)join(r,newPlayer(`Player ${i+1}`));r.players.forEach((p,i)=>p.role=roles[i]);r.phase='night';r.round=1;return r;}
const move=(r,i,action,target)=>act(r,r.players[i],{action,target,stage:r.stage});
test('angel protection, private sheriff result, no role or token leaks',()=>{const r=game();for(const [i,target]of [[0,r.players[3].id],[1,r.players[0].id],[2,r.players[3].id]])move(r,i,'choose',target);assert.equal(r.phase,'discussion');assert.equal(r.report.name,null);assert.equal(r.players.filter(p=>p.alive).length,5);assert.equal(view(r,r.players[1]).me.investigation.mafia,true);for(const p of r.players){const v=view(r,p);assert.ok(v.players.every(q=>!('role'in q)&&!('token'in q)));assert.ok(!JSON.stringify(v).includes(r.players[0].token));if(p.role!=='sheriff')assert.equal(v.me.investigation,null);}});
test('angel can self-protect and sheriff acts on the night they die',()=>{const r=game();move(r,0,'choose',r.players[1].id);move(r,1,'choose',r.players[0].id);move(r,2,'choose',r.players[2].id);assert.equal(r.players[1].alive,false);assert.equal(view(r,r.players[1]).me.investigation.mafia,true);assert.throws(()=>move(r,1,'choose','skip'));});
test('day ties eliminate nobody and votes cannot be changed',()=>{const r=game();r.phase='vote';move(r,0,'choose',r.players[1].id);move(r,0,'choose',r.players[2].id);assert.equal(r.actions[r.players[0].id],r.players[1].id);move(r,1,'choose',r.players[0].id);move(r,2,'choose',r.players[0].id);move(r,3,'choose',r.players[1].id);move(r,4,'choose','skip');assert.equal(r.phase,'result');assert.equal(r.report.name,null);});
test('majority eliminates last mafia, reveals roles, and finishes the game',()=>{const r=game();r.phase='vote';move(r,0,'choose','skip');for(let i=1;i<5;i++)move(r,i,'choose',r.players[0].id);assert.equal(r.phase,'over');assert.equal(r.winner,'town');assert.ok(view(r,r.players[2]).players.every(p=>p.role));});
test('configurable cast validates parity and respects disabled special roles',()=>{const r=createRoom('One');for(let i=2;i<=5;i++)join(r,newPlayer(String(i)));assert.throws(()=>move(r,1,'start'));act(r,r.players[0],{action:'configure',stage:r.stage,config:{mafia:3,sheriff:false,angel:false}});assert.throws(()=>move(r,0,'start'));act(r,r.players[0],{action:'configure',stage:r.stage,config:{mafia:2,sheriff:false,angel:false}});move(r,0,'start');assert.equal(r.players.filter(p=>p.role==='mafia').length,2);assert.equal(r.players.filter(p=>p.role==='town').length,3);assert.equal(r.phase,'roles');assert.throws(()=>act(r,r.players[0],{action:'ready',stage:-1}));});
test('mafia parity wins, illegal targets and duplicate names are rejected',()=>{const r=game();r.players[3].alive=false;r.players[4].alive=false;r.players[2].alive=false;assert.equal(winner(r),'mafia');assert.throws(()=>move(r,0,'choose',r.players[0].id));assert.throws(()=>join(createRoom('One'),newPlayer('one')));});

test('informed angel waits for all mafia; intended victim stays private',()=>{const r=game(['mafia','mafia','sheriff','angel','town','town','town']);r.config.angelInformed=true;assert.equal(view(r,r.players[3]).me.angelWaiting,true);assert.throws(()=>move(r,3,'choose',r.players[4].id));move(r,0,'choose',r.players[4].id);assert.equal(view(r,r.players[3]).me.angelWaiting,true);move(r,1,'choose',r.players[4].id);assert.equal(view(r,r.players[3]).me.angelTarget,r.players[4].name);assert.equal(view(r,r.players[2]).me.angelTarget,undefined);assert.equal(view(r,r.players[4]).me.angelTarget,undefined);move(r,3,'choose',r.players[4].id);move(r,2,'choose',r.players[0].id);assert.equal(r.report.name,null);});
function finishProtectedNight(r,protect){move(r,0,'choose',r.players[3].id);move(r,1,'choose',r.players[0].id);move(r,2,'choose',protect);}
test('once-per-game protection is spent on use, while skipping preserves it',()=>{const r=game();r.config.angelFrequency='once';finishProtectedNight(r,r.players[4].id);assert.equal(r.angelLastUsed,1);r.phase='night';r.round=2;r.actions={};assert.equal(view(r,r.players[2]).me.angelAvailable,false);assert.throws(()=>move(r,2,'choose',r.players[2].id));move(r,2,'choose','sleep');const skipped=game();skipped.config.angelFrequency='once';finishProtectedNight(skipped,'sleep');assert.equal(skipped.angelLastUsed,undefined);});
test('alternate protection rests the following night and returns one night later',()=>{const r=game();r.config.angelFrequency='alternate';finishProtectedNight(r,r.players[3].id);r.round=2;assert.equal(view(r,r.players[2]).me.angelAvailable,false);r.round=3;assert.equal(view(r,r.players[2]).me.angelAvailable,true);});
test('successful-save accounting spends power only when a death is prevented',()=>{const r=game();r.config.angelFrequency='once';r.config.angelCountOn='save';finishProtectedNight(r,r.players[4].id);assert.equal(r.angelLastUsed,undefined);assert.equal(view(r,r.players[2]).me.angelAvailable,true);const saved=game();saved.config.angelFrequency='once';saved.config.angelCountOn='save';finishProtectedNight(saved,saved.players[3].id);assert.equal(saved.angelLastUsed,1);assert.equal(view(saved,saved.players[2]).me.angelAvailable,false);});

test('new rooms default to secret day votes and legacy rooms stay secret',()=>{assert.equal(createRoom('Host').config.dayVoteVisibility,'secret');const r=game();delete r.config.dayVoteVisibility;r.phase='vote';for(let i=0;i<5;i++)move(r,i,'choose','skip');assert.equal(r.phase,'result');assert.equal(r.report.ballots,undefined);assert.equal(r.config.dayVoteVisibility,undefined);});
test('public votes are revealed only after everyone submits, including abstentions',()=>{const r=game();r.config.dayVoteVisibility='public';r.phase='vote';for(let i=0;i<4;i++){move(r,i,'choose','skip');assert.equal(view(r,r.players[4]).report?.ballots,undefined);assert.equal(r.phase,'vote');}move(r,4,'choose','skip');assert.equal(r.phase,'result');assert.equal(r.report.ballots.length,5);assert.deepEqual(r.report.ballots.map(b=>b.target),Array(5).fill('Abstain'));assert.equal(r.report.ballots[0].voter,r.players[0].name);});
test('public ballots remain available on a game-ending vote',()=>{const r=game();r.config.dayVoteVisibility='public';r.phase='vote';move(r,0,'choose','skip');for(let i=1;i<5;i++)move(r,i,'choose',r.players[0].id);assert.equal(r.phase,'over');assert.equal(r.winner,'town');assert.equal(r.report.ballots.length,5);assert.equal(r.report.ballots[1].target,r.players[0].name);});
test('vote visibility cannot be changed during a running game',()=>{const r=game();assert.throws(()=>act(r,r.players[0],{action:'configure',stage:r.stage,config:{...r.config,dayVoteVisibility:'public'}}));assert.equal(r.config.dayVoteVisibility,'secret');r.phase='lobby';assert.throws(()=>act(r,r.players[0],{action:'configure',stage:r.stage,config:{...r.config,dayVoteVisibility:'invalid'}}));assert.throws(()=>act(r,r.players[1],{action:'configure',stage:r.stage,config:{...r.config,dayVoteVisibility:'public'}}));});
test('older clients can update unrelated lobby settings without overwriting voting mode',()=>{const r=game();r.phase='lobby';r.config.dayVoteVisibility='public';const oldConfig={...r.config};delete oldConfig.dayVoteVisibility;act(r,r.players[0],{action:'configure',stage:r.stage,config:oldConfig});assert.equal(r.config.dayVoteVisibility,'public');});

test('night readiness stays anonymous; day readiness exposes only submission booleans',()=>{const r=game();move(r,0,'choose',r.players[3].id);const saved=JSON.stringify(r);const result=view(r,r.players[4]);assert.equal(JSON.stringify(r),saved,'Reading status must not modify a running room');assert.equal(result.submitted,0);assert.ok(result.players.every(p=>p.submitted===false));for(const p of result.players)assert.deepEqual(Object.keys(p).sort(),['alive','id','name','submitted']);assert.equal(result.actions,undefined);assert.equal(result.nightTarget,undefined);r.phase='vote';r.actions={};move(r,0,'choose',r.players[1].id);const voted=view(r,r.players[4]);assert.equal(voted.players[0].submitted,true);assert.equal(voted.report?.ballots,undefined);});
test('role readiness is available for rooms already in progress with old stored data',()=>{const r=game();r.phase='roles';delete r.config.dayVoteVisibility;move(r,1,'ready');assert.equal(view(r,r.players[0]).players[1].submitted,true);assert.equal(view(r,r.players[0]).players[0].submitted,false);});

test('villagers do not block the night and cannot reveal who has a night action',()=>{const r=game();assert.equal(view(r,r.players[3]).me.nightActionRequired,false);assert.equal(view(r,r.players[3]).me.submitted,true);move(r,0,'choose',r.players[3].id);move(r,1,'choose',r.players[0].id);const publicStatus=view(r,r.players[4]);assert.equal(publicStatus.submitted,0);assert.ok(publicStatus.players.every(p=>p.submitted===false));assert.equal(r.phase,'night');move(r,2,'choose',r.players[3].id);assert.equal(r.phase,'discussion');assert.equal(r.report.name,null);});
test('unavailable angel does not block the night or consume another use',()=>{for(const frequency of ['once','alternate']){const r=game();r.config.angelFrequency=frequency;r.angelLastUsed=1;r.round=2;assert.equal(view(r,r.players[2]).me.nightActionRequired,false);move(r,0,'choose',r.players[3].id);move(r,1,'choose',r.players[0].id);assert.equal(r.phase,'discussion');assert.equal(r.report.name,r.players[3].name);assert.equal(r.angelLastUsed,1);}});
test('an existing night waiting only for villagers settles once without losing saved choices',()=>{const r=game();r.actions={[r.players[0].id]:r.players[3].id,[r.players[1].id]:r.players[0].id,[r.players[2].id]:r.players[3].id};const round=r.round;assert.equal(settleNight(r),true);assert.equal(r.phase,'discussion');assert.equal(r.report.name,null);assert.equal(r.round,round);assert.equal(r.investigations[r.players[1].id].mafia,true);const saved=JSON.stringify(r);assert.equal(settleNight(r),false);assert.equal(JSON.stringify(r),saved);});
test('an existing incomplete night keeps its committed target and waits for the sheriff',()=>{const r=game();r.nightTarget=r.players[3].id;r.actions={[r.players[0].id]:r.players[3].id,[r.players[2].id]:r.players[3].id};const saved=JSON.stringify(r);assert.equal(settleNight(r),false);assert.equal(JSON.stringify(r),saved);move(r,1,'choose',r.players[0].id);assert.equal(r.phase,'discussion');assert.equal(r.report.name,null);});
test('mafia alone can finish the night when special roles are absent',()=>{const r=game(['mafia','town','town','town','town']);move(r,0,'choose',r.players[1].id);assert.equal(r.phase,'discussion');assert.equal(r.players[1].alive,false);});

test('guided night enforces role order, pauses, private results and automatic dawn',()=>{
 const realNow=Date.now;let now=100000;Date.now=()=>now;
 try{const r=game();r.config.angelInformed=true;r.nightGuide={step:'mafia',started:now,after:null};
 assert.throws(()=>move(r,1,'choose',r.players[0].id));
 move(r,0,'choose',r.players[3].id);assert.equal(r.nightGuide.step,'mafia');now+=14999;settleNight(r);assert.equal(r.nightGuide.step,'mafia');now++;settleNight(r);assert.equal(r.nightGuide.step,'sheriff');
 assert.equal(view(r,r.players[2]).me.angelTarget,r.players[3].name);assert.equal(view(r,r.players[4]).me.angelTarget,undefined);
 move(r,1,'choose',r.players[0].id);now+=15000;settleNight(r);assert.equal(r.nightGuide.step,'angel');
 move(r,2,'choose',r.players[3].id);now+=14999;settleNight(r);assert.equal(r.phase,'night');now++;settleNight(r);assert.equal(r.phase,'discussion');assert.equal(r.report.name,null);assert.equal(r.investigations[r.players[1].id].mafia,true);
 const saved=JSON.stringify(r);settleNight(r);assert.equal(JSON.stringify(r),saved);
 }finally{Date.now=realNow;}
});
test('enabling guidance preserves the current night and starts at the next night',()=>{
 const r=game();move(r,0,'choose',r.players[3].id);const saved=JSON.stringify(r.actions);assert.throws(()=>move(r,1,'guide'));move(r,0,'guide');assert.equal(JSON.stringify(r.actions),saved);assert.equal(r.nightGuide,undefined);move(r,1,'choose',r.players[0].id);move(r,2,'choose',r.players[3].id);assert.equal(r.phase,'discussion');r.phase='result';move(r,0,'night');assert.equal(r.nightGuide.step,'mafia');
});
test('guided night keeps dead sheriff and resting angel turns anonymous and finishes',()=>{
 const realNow=Date.now;let now=100000;Date.now=()=>now;
 try{const r=game(['mafia','sheriff','angel','town','town','town']);r.players[1].alive=false;r.config.angelFrequency='once';r.angelLastUsed=1;r.round=2;r.nightGuide={step:'mafia',started:now,after:null};
 move(r,0,'choose',r.players[3].id);now+=15000;settleNight(r);assert.equal(view(r,r.players[4]).nightCue,'sheriff');settleNight(r);now+=15000;settleNight(r);assert.equal(view(r,r.players[4]).nightCue,'angel');settleNight(r);now+=15000;settleNight(r);assert.equal(r.phase,'discussion');assert.equal(r.angelLastUsed,1);
 }finally{Date.now=realNow;}
});
test('guided mafia-only game advances after the last choice plus three seconds',()=>{
 const realNow=Date.now;let now=100000;Date.now=()=>now;
 try{const r=game(['mafia','town','town','town','town']);r.config.sheriff=false;r.config.angel=false;r.nightGuide={step:'mafia',started:now,after:null};now+=20000;move(r,0,'choose',r.players[1].id);now+=2999;settleNight(r);assert.equal(r.phase,'night');now++;settleNight(r);assert.equal(r.phase,'discussion');assert.equal(r.report.name,r.players[1].name);
 }finally{Date.now=realNow;}
});

test('in-person voting requires creator, confirmation, correct mode and valid living target',()=>{
 const r=game();r.phase='vote';r.config.dayVoteVisibility='in-person';
 const record=(i,target,confirmed=true,stage=r.stage)=>act(r,r.players[i],{action:'resolve-vote',target,confirmed,stage});
 const before=JSON.stringify(r);
 for(const fn of [()=>record(1,r.players[3].id),()=>record(0,r.players[3].id,false),()=>record(0,'missing'),()=>record(0,r.players[3].id,true,-1),()=>move(r,1,'choose',r.players[0].id)]){assert.throws(fn);assert.equal(JSON.stringify(r),before);}
 r.players[3].alive=false;assert.throws(()=>record(0,r.players[3].id));r.players[3].alive=true;
 record(0,r.players[3].id);assert.equal(r.phase,'result');assert.equal(r.players[3].alive,false);assert.deepEqual(r.report,{kind:'vote',method:'in-person',name:r.players[3].name});
 const saved=JSON.stringify(r);assert.throws(()=>record(0,r.players[4].id));assert.equal(JSON.stringify(r),saved);
 const normal=game();normal.phase='vote';assert.throws(()=>act(normal,normal.players[0],{action:'resolve-vote',target:'skip',confirmed:true,stage:normal.stage}));
});
test('in-person creator can record self-elimination, nobody, or a result while dead',()=>{
 const self=game();self.phase='vote';self.config.dayVoteVisibility='in-person';act(self,self.players[0],{action:'resolve-vote',target:self.players[0].id,confirmed:true,stage:self.stage});assert.equal(self.phase,'over');assert.equal(self.winner,'town');
 const r=game();r.host=r.players[4].id;r.players[4].alive=false;r.phase='vote';r.config.dayVoteVisibility='in-person';act(r,r.players[4],{action:'resolve-vote',target:'skip',confirmed:true,stage:r.stage});assert.equal(r.phase,'result');assert.equal(r.report.name,null);assert.equal(r.report.tally,undefined);assert.equal(r.report.ballots,undefined);
 r.phase='vote';act(r,r.players[4],{action:'resolve-vote',target:r.players[2].id,confirmed:true,stage:r.stage});assert.equal(r.players[2].alive,false);assert.equal(r.phase,'result');
});
test('in-person setting is lobby-only and older config updates preserve it',()=>{
 const r=game();const c={...r.config,dayVoteVisibility:'in-person'};assert.throws(()=>act(r,r.players[0],{action:'configure',config:c,stage:r.stage}));assert.equal(r.config.dayVoteVisibility,'secret');r.phase='lobby';act(r,r.players[0],{action:'configure',config:c,stage:r.stage});assert.equal(r.config.dayVoteVisibility,'in-person');delete c.dayVoteVisibility;act(r,r.players[0],{action:'configure',config:c,stage:r.stage});assert.equal(r.config.dayVoteVisibility,'in-person');
});
test('confirmed in-person elimination resolves mafia parity immediately',()=>{
 const r=game(['mafia','mafia','angel','town','town']);r.phase='vote';r.config.dayVoteVisibility='in-person';act(r,r.players[0],{action:'resolve-vote',target:r.players[4].id,confirmed:true,stage:r.stage});assert.equal(r.phase,'over');assert.equal(r.winner,'mafia');assert.equal(r.report.method,'in-person');
});
test('self-votes count normally in secret and public voting and remain final',()=>{
 for(const mode of ['secret','public']){
  const r=game();r.phase='vote';r.config.dayVoteVisibility=mode;
  move(r,0,'choose',r.players[0].id);move(r,0,'choose','skip');assert.equal(r.actions[r.players[0].id],r.players[0].id);
  assert.equal(view(r,r.players[1]).report?.ballots,undefined);
  for(let i=1;i<5;i++)move(r,i,'choose',r.players[0].id);
  assert.equal(r.phase,'over');assert.equal(r.winner,'town');assert.equal(r.report.tally[0].count,5);
  if(mode==='public')assert.deepEqual(r.report.ballots[0],{voter:r.players[0].name,target:r.players[0].name});else assert.equal(r.report.ballots,undefined);
 }
});
