import {randomInt,randomBytes} from 'node:crypto';
export const secret=()=>randomBytes(24).toString('hex');
export const code=()=>Array.from({length:6},()=> 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[randomInt(31)]).join('');
const fail=message=>{throw Object.assign(new Error(message),{status:400});};
export function newPlayer(name){name=typeof name==='string'?name.trim():'';if(!name||name.length>24)fail('Use a name between 1 and 24 characters.');return {id:secret().slice(0,12),token:secret(),name,alive:true,role:null};}
export const living=r=>r.players.filter(p=>p.alive);
export function winner(r){const n=living(r),m=n.filter(p=>p.role==='mafia').length;return m===0?'town':m>=n.length-m?'mafia':null;}
export function createRoom(name){const p=newPlayer(name);return {code:code(),host:p.id,players:[p],phase:'lobby',round:0,stage:0,revision:0,actions:{},report:null,investigations:{},config:{mafia:1,sheriff:true,angel:true,angelInformed:false,angelFrequency:'every',angelCountOn:'use',dayVoteVisibility:'secret'},expires:Date.now()+86400000};}
export function join(r,p){if(r.phase!=='lobby')fail('This game has already started.');if(r.players.length>=12)fail('This room is full.');if(r.players.some(q=>q.name.toLowerCase()===p.name.toLowerCase()))fail('That name is already taken.');r.players.push(p);}
export function playerFor(r,token){const p=r.players.find(p=>p.token===token);if(!p)throw Object.assign(new Error('Your seat could not be found. Join the room again.'),{status:401});return p;}
function phase(r,next){r.phase=next;r.stage++;r.actions={};if(next==='night'){r.nightTarget=null;r.nightGuide=r.guidedNext?{step:'mafia',started:Date.now(),after:null}:null;}}
function endIfWon(r){const won=winner(r);if(won){r.winner=won;phase(r,'over');return true;}return false;}
export function angelAvailable(r){return r.config.angelFrequency==='every'||(r.config.angelFrequency==='once'?!r.angelLastUsed:r.angelLastUsed!==r.round-1);}
export const needsNightAction=(r,p)=>p.alive&&p.role!=='town'&&(p.role!=='angel'||angelAvailable(r));
// A state poll can finish a pre-update night that was waiting only on villagers.
export function settleNight(r){
 if(r.phase!=='night')return false;
 let changed=false;
 if(r.nightGuide){
  const g=r.nightGuide,now=Date.now();
  const pending=living(r).filter(p=>p.role===g.step&&needsNightAction(r,p));
  if(!pending.every(p=>Object.hasOwn(r.actions,p.id)))return false;
  if(g.after===null){g.after=Math.max(g.started+15000,now+3000);changed=true;}
  if(now<g.after)return changed;
  const steps=['mafia',...(r.config.sheriff?['sheriff']:[]),...(r.config.angel?['angel']:[])];
  const next=steps[steps.indexOf(g.step)+1];
  if(next){r.nightGuide={step:next,started:now,after:null};changed=true;}
 }
 const alive=living(r),mafia=alive.filter(p=>p.role==='mafia');
 if(!r.nightTarget&&mafia.length&&mafia.every(p=>Object.hasOwn(r.actions,p.id))){
  const counts={};for(const p of mafia){const target=r.actions[p.id];counts[target]=(counts[target]||0)+1;}
  const max=Math.max(...Object.values(counts)),tied=Object.keys(counts).filter(id=>counts[id]===max);
  r.nightTarget=tied[randomInt(tied.length)];changed=true;
 }
 if(r.nightGuide&&Date.now()<(r.nightGuide.after??Infinity))return changed;
 if(!r.nightTarget||!alive.filter(p=>needsNightAction(r,p)).every(p=>Object.hasOwn(r.actions,p.id)))return changed;
 const angel=alive.find(p=>p.role==='angel'),sheriff=alive.find(p=>p.role==='sheriff');
 if(sheriff){const checked=r.players.find(p=>p.id===r.actions[sheriff.id]);r.investigations[sheriff.id]={name:checked.name,mafia:checked.role==='mafia',round:r.round};}
 const protection=angel&&angelAvailable(r)?r.actions[angel.id]:null;
 const killed=protection===r.nightTarget?null:r.players.find(p=>p.id===r.nightTarget);
 if(angel&&protection&&protection!=='sleep'&&(r.config.angelCountOn==='use'||!killed))r.angelLastUsed=r.round;
 if(killed)killed.alive=false;
 r.report={kind:'night',name:killed?.name||null};
 if(!endIfWon(r))phase(r,'discussion');
 return true;
}
export function act(r,p,body){
 const {action,target,stage}=body;
 if(action==='guide'){if(r.host!==p.id)fail('Only the room creator can do that.');r.guidedNext=true;return;}
 if(stage!==r.stage)fail('The game moved on. Your screen is updating.');
 if(['start','night','vote','restart','remove','configure','resolve-vote'].includes(action)&&r.host!==p.id)fail('Only the room creator can do that.');
 if(action==='configure'){if(r.phase!=='lobby')fail('Roles can only change before the game.');const c=body.config;if(!c||!Number.isInteger(c.mafia)||c.mafia<1||c.mafia>5||typeof c.sheriff!=='boolean'||typeof c.angel!=='boolean')fail('Choose 1–5 mafia and valid role options.');const config={...r.config,...c};if(typeof config.angelInformed!=='boolean'||!['every','alternate','once'].includes(config.angelFrequency)||!['use','save'].includes(config.angelCountOn))fail('Choose valid angel rules.');if(config.dayVoteVisibility!==undefined&&!['secret','public','in-person'].includes(config.dayVoteVisibility))fail('Choose secret, public, or in-person day voting.');r.config=config;return;}
 if(action==='remove'){if(r.phase!=='lobby'||target===p.id)fail('You can only remove other players before the game.');r.players=r.players.filter(p=>p.id!==target);return;}
 if(action==='start'){
  if(r.phase!=='lobby'||r.players.length<5)fail('You need 5–12 players to start.');
  const n=r.players.length,m=r.config.mafia;if(m>=n-m)fail('Mafia must be fewer than the town team.');const roles=[...Array(m).fill('mafia'),...(r.config.sheriff?['sheriff']:[]),...(r.config.angel?['angel']:[])];if(roles.length>n)fail('There are more roles than players.');while(roles.length<n)roles.push('town');
  for(let i=n-1;i>0;i--){const j=randomInt(i+1);[roles[i],roles[j]]=[roles[j],roles[i]];}
  r.players.forEach((p,i)=>{p.role=roles[i];p.alive=true;});r.round=1;r.angelLastUsed=null;phase(r,'roles');return;
 }
 if(action==='ready'){if(r.phase!=='roles')fail('Roles have already been dealt.');r.actions[p.id]=true;if(r.players.every(p=>r.actions[p.id]))phase(r,'night');return;}
 if(action==='restart'){if(r.phase!=='over')fail('Finish this game first.');r.players.forEach(p=>{p.role=null;p.alive=true;});r.report=null;r.investigations={};r.winner=null;r.round=0;phase(r,'lobby');return;}
 if(action==='night'){if(r.phase!=='result')fail('The next night is not ready.');r.round++;r.investigations={};phase(r,'night');return;}
 if(action==='vote'){if(r.phase!=='discussion')fail('Voting is not ready yet.');phase(r,'vote');return;}
 // The creator records the table's outcome, even when eliminated themselves.
 if(action==='resolve-vote'){
  if(r.phase!=='vote'||r.config.dayVoteVisibility!=='in-person')fail('In-person voting is not open.');
  if(body.confirmed!==true)fail('Confirm the group’s result before locking it in.');
  const killed=r.players.find(q=>q.id===target&&q.alive);
  if(target!=='skip'&&!killed)fail('Choose a living player or nobody.');
  if(killed)killed.alive=false;
  r.report={kind:'vote',method:'in-person',name:killed?.name||null};
  if(!endIfWon(r))phase(r,'result');
  return;
 }
 if(action==='choose'&&r.phase==='vote'&&r.config.dayVoteVisibility==='in-person')fail('Vote in person. The creator records the group’s result.');
 if(action!=='choose'||!['night','vote'].includes(r.phase))fail('That action is not available.');
 if(!p.alive)fail('Eliminated players cannot act.');if(Object.hasOwn(r.actions,p.id))return;
 const q=r.players.find(p=>p.id===target&&p.alive);
 if(r.phase==='night'){
  if(r.nightGuide&&needsNightAction(r,p)&&p.role!==r.nightGuide.step)fail('Wait for your role to be called.');
  if(p.role==='town'||(p.role==='angel'&&!angelAvailable(r))){if(target!=='sleep')fail('You have no available night ability.');}
  else if(p.role==='angel'){if(r.config.angelInformed&&!r.nightTarget)fail('Wait for the mafia to finish choosing.');if(target!=='sleep'&&!q)fail('Choose a living player or save your power.');}
  else if(!q||(p.role!=='angel'&&q.id===p.id)||(p.role==='mafia'&&q.role==='mafia'))fail('Choose a valid living player.');
 }else if(target!=='skip'&&!q)fail('Vote for a living player or abstain.');
 r.actions[p.id]=target;
 if(r.phase==='night'){settleNight(r);return;}
 if(living(r).every(p=>Object.hasOwn(r.actions,p.id))){
   const tally={};for(const t of Object.values(r.actions))tally[t]=(tally[t]||0)+1;
   const max=Math.max(...Object.values(tally)),leaders=Object.keys(tally).filter(id=>tally[id]===max);
   const killed=leaders.length===1&&leaders[0]!=='skip'?r.players.find(p=>p.id===leaders[0]):null;
   if(killed)killed.alive=false;r.report={kind:'vote',name:killed?.name||null,tally:Object.entries(tally).map(([id,count])=>({name:id==='skip'?'Abstain':r.players.find(p=>p.id===id).name,count}))};
   if(r.config.dayVoteVisibility==='public')r.report.ballots=Object.entries(r.actions).map(([id,target])=>({voter:r.players.find(p=>p.id===id).name,target:target==='skip'?'Abstain':r.players.find(p=>p.id===target).name}));
   if(!endIfWon(r))phase(r,'result');
 }
}
export function view(r,p){return {guidedNext:!!r.guidedNext,nightCue:r.phase==='night'?r.nightGuide?.step||null:null,revision:r.revision,code:r.code,config:r.config,host:r.host,phase:r.phase,stage:r.stage,round:r.round,winner:r.winner||null,report:r.report,me:{id:p.id,name:p.name,role:p.role,alive:p.alive,submitted:r.phase==='night'?!needsNightAction(r,p)||Object.hasOwn(r.actions,p.id):Object.hasOwn(r.actions,p.id),nightTurnOpen:!r.nightGuide||r.nightGuide.step===p.role,nightActionRequired:r.phase==='night'&&needsNightAction(r,p),investigation:r.investigations[p.id]||null,...(p.role==='angel'?{angelAvailable:angelAvailable(r),angelWaiting:r.phase==='night'&&r.config.angelInformed&&angelAvailable(r)&&!r.nightTarget,angelTarget:r.phase==='night'&&r.config.angelInformed&&angelAvailable(r)&&r.nightTarget?r.players.find(q=>q.id===r.nightTarget).name:null}:{})},team:p.role==='mafia'?r.players.filter(q=>q.role==='mafia'&&q.id!==p.id).map(q=>({id:q.id,name:q.name})):[],submitted:r.phase==='night'?0:Object.keys(r.actions).length,players:r.players.map(q=>({id:q.id,name:q.name,alive:q.alive,submitted:r.phase!=='night'&&Object.hasOwn(r.actions,q.id),...(r.phase==='over'?{role:q.role}:{})}))};}
