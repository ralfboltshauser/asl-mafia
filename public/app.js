import qrcode from '/qrcode.js';
import {NightAudio} from '/audio.js';
const app=document.querySelector('#app'),error=document.querySelector('#error'),connection=document.querySelector('#connection');
const storageKey='asl-mafia-seat-v2',roleNames={mafia:'Mafia',sheriff:'Sheriff',angel:'Angel',town:'Townsperson'};
const roleCopy={mafia:'Blend in by day. Choose a town player to eliminate each night. You win when mafia equals or outnumbers the town.',sheriff:'Investigate one player each night. Their mafia status is revealed privately at dawn. You win with the town.',angel:'Protect one player from the mafia each night. You can protect yourself and choose the same person again. You win with the town.',town:'Listen, question, and find the mafia. Your vote during the day is your power. You win when every mafia member is out.'};
let paused=false,seat=null,s=null,mode=new URLSearchParams(location.search).has('room')?'join':'create',revealed=false,choice=null,busy=false,lastJson='',lastAnnounced=null,paintedStage=null,settingUndo=null,pendingAction=null,polling=false,restoring=false,restoreFailed=false;
try{seat=JSON.parse(localStorage.getItem(storageKey));}catch{}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(label,action,cls='primary',disabled=false)=>`<button class="${cls}" data-action="${action}" ${disabled?'disabled':''}>${label}</button>`;
const host=()=>s&&s.host===s.me.id;
const total=()=>s.phase==='roles'?s.players.length:s.players.filter(p=>p.alive).length;
function status(text,retry=false){if(connection.dataset.message===text)return;connection.dataset.message=text;connection.replaceChildren();connection.hidden=!text;if(!text)return;const message=document.createElement('span');message.textContent=text;connection.append(message);if(retry){const retryButton=document.createElement('button');retryButton.className='link';retryButton.textContent='Retry now';retryButton.onclick=()=>poll();connection.append(retryButton);}}
const spinner='<span class="spinner" aria-hidden="true"></span>';
const pendingLabels={create:'Creating room…',join:'Joining room…',configure:'Saving settings…',start:'Dealing roles…',ready:'Getting ready…',unready:'Updating…',choose:'Submitting…','resolve-vote':'Recording result…',night:'Starting night…',vote:'Opening vote…',restart:'Preparing lobby…',remove:'Removing player…',guide:'Enabling guide…',sleep:'Skipping protection…'};
function busyFeedback(){
 app.setAttribute('aria-busy',String(busy));for(const id of ['exit','audio-mode','audio-replay'])document.getElementById(id).disabled=busy;
 if(!busy)return;
 app.querySelectorAll('button,input,select').forEach(el=>el.disabled=true);
 const target=app.querySelector(pendingAction==='create'||pendingAction==='join'?'#entry button[type=submit]':`button[data-action="${pendingAction}"]`);
 if(target){target.style.minWidth=`${target.getBoundingClientRect().width}px`;target.classList.add('is-loading');target.innerHTML=`${spinner}<span>${pendingLabels[pendingAction]||'Saving…'}</span>`;}else{const heading=app.querySelector('.cast-card .section-title');if(heading)heading.insertAdjacentHTML('beforeend',`<span class="saving-state">${spinner} ${pendingLabels[pendingAction]||'Saving…'}</span>`);}
}
function loadingScreen(){return `<section class="focus loading-screen"><div class="loading-emblem" aria-hidden="true">${restoreFailed?'↻':spinner}</div><h1>${restoreFailed?'Can’t reach your room':'Returning to your room'}</h1><p class="muted">${restoreFailed?'Your saved seat is still here. Check your connection and try again.':`Connecting to room <span class="inline-code">${esc(seat.code)}</span>…`}</p>${restoreFailed?`${button('Try again','retry')}${button('Back to start','pause','secondary')}`:'<div class="loading-lines" aria-hidden="true"><span></span><span></span><span></span></div>'}</section>`;}
function stateSymbol(kind){const paths={moon:'<path d="M28 6a16 16 0 1 0 14 24A16 16 0 0 1 28 6Z"/>',check:'<circle cx="24" cy="24" r="18"/><path d="m16 24 6 6 11-12"/>',people:'<circle cx="18" cy="17" r="6"/><path d="M7 37v-3a11 11 0 0 1 22 0v3M31 11a6 6 0 0 1 0 12m4 4a10 10 0 0 1 6 10"/>'};return `<div class="state-symbol" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${paths[kind]}</svg></div>`;}
function polishState(){
 const focus=app.querySelector('.focus');if(!focus||!s)return;
 const kind=s.phase==='roles'&&s.me.submitted?'check':s.phase==='vote'&&s.me.submitted?'check':s.phase==='night'&&(s.me.submitted||!s.me.nightActionRequired||s.me.nightTurnOpen===false)?(s.me.submitted?'check':'moon'):s.phase==='lobby'&&!host()?'people':null;
 if(kind)focus.insertAdjacentHTML('afterbegin',stateSymbol(kind));
}

const confirmDialog=document.querySelector('#confirm-dialog');
let confirmation=null;
const confirmationContext=()=>`${seat?.code}:${s?.stage}:${s?.nightCue}:${s?.me.submitted}`;
function confirmAction(message,label='Confirm'){
 if(confirmation)return Promise.resolve(false);
 closeHelp();
 const split=message.indexOf('?');
 document.querySelector('#confirm-title').textContent=split>=0?message.slice(0,split+1):'Confirm this action';
 document.querySelector('#confirm-description').textContent=split>=0?message.slice(split+1).trim():message;
 document.querySelector('#confirm-accept').textContent=label;
 const trigger=document.activeElement,context=confirmationContext();
 return new Promise(resolve=>{confirmation={resolve,trigger,context};confirmDialog.returnValue='cancel';confirmDialog.showModal();document.querySelector('#confirm-cancel').focus({preventScroll:true});});
}
confirmDialog.addEventListener('close',()=>{
 const pending=confirmation;if(!pending)return;confirmation=null;
 const accepted=confirmDialog.returnValue==='confirm'&&pending.context===confirmationContext();
 const fallback=pending.trigger?.id?document.getElementById(pending.trigger.id):pending.trigger?.dataset.action?app.querySelector(`[data-action="${pending.trigger.dataset.action}"]`):null;
 (pending.trigger?.isConnected?pending.trigger:fallback||app.querySelector('h1[tabindex]')||app).focus({preventScroll:true});
 pending.resolve(accepted);
});
confirmDialog.addEventListener('keydown',event=>{if(event.key!=='Tab')return;const first=document.querySelector('#confirm-cancel'),last=document.querySelector('#confirm-accept');if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}});
confirmDialog.addEventListener('click',event=>{if(event.target===confirmDialog){const r=confirmDialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)confirmDialog.close('cancel');}});
const nightAudio=new NightAudio(text=>{error.textContent=text;});
async function request(action,extra={}){const res=await fetch('/api',{method:'POST',headers:{'Content-Type':'application/json',...(seat?{Authorization:`Bearer ${seat.token}`}:{})},body:JSON.stringify({action,code:seat?.code,stage:s?.stage,...extra}),signal:AbortSignal.timeout(12000)});const data=await res.json();if(!res.ok)throw Object.assign(new Error(data.error||'Could not reach the host. Try again.'),{status:res.status});return data;}
function accept(data){if(s&&s.code===data.state.code&&s.revision>data.state.revision)return;const oldStage=s?.stage,oldCue=s?.nightCue;restoring=false;restoreFailed=false;s=data.state;if(confirmation&&confirmation.context!==confirmationContext())confirmDialog.close('cancel');paused=false;if(data.token){seat={token:data.token,code:s.code};try{localStorage.setItem(storageKey,JSON.stringify(seat));}catch{status('Your browser cannot save your seat. Keep this tab open.');}}
 if(oldStage!==s.stage||oldCue!==s.nightCue){revealed=false;choice=null;}
 const json=JSON.stringify(s);if(json!==lastJson){lastJson=json;render();}
 nightAudio.update(s);
}
async function send(action,extra={}){
 if(busy)return false;
 const before=action==='configure'?{...s.config}:null;
 busy=true;pendingAction=extra.target==='sleep'?'sleep':action;error.textContent='';busyFeedback();document.querySelector('#action-status').textContent=pendingLabels[action]||'Saving…';
 try{accept(await request(action,extra));if(action==='ready')revealed=false;
  if(action==='configure')settingUndo=extra.expectedConfig?null:{code:s.code,before,after:{...s.config}};
  status('');return true;
 }catch(e){error.textContent=e.status?e.message:'Connection interrupted. Your action may not have reached the room. Check your connection, then try again.';return false;}finally{busy=false;pendingAction=null;document.querySelector('#action-status').textContent='';render();}
}

function inviteCard(){return `<div class="card invite-card"><h2 class="invite-label">Invite friends</h2><div class="invite-code-row"><button class="room-code" data-action="copy-link" aria-label="Copy invite link for room ${s.code}" title="Copy invite link">${s.code}</button><button id="invite-qr" class="icon-button" data-action="qr" aria-label="Show room QR code" title="Show room QR code"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM15 15h2v2h-2zM20 14v4h-3v3M21 21h-1M12 3v2M12 9v3H3M9 12v3M12 18v3"/></svg></button></div>${button('Share invite','copy','copy')}</div>`;}
function playerDetails(){return `<details class="rules" data-disclosure="players"><summary>Players · ${s.players.filter(p=>p.alive).length} alive</summary>${roster()}</details>`;}
function roster(){return `<ul class="roster">${s.players.map(p=>`<li class="${p.alive?'':'out'}"><span class="player-name">${esc(p.name)}${p.id===s.me.id?' <span class="muted">(you)</span>':''}</span><span class="player-meta">${s.phase==='over'?roleNames[p.role]:!p.alive?'Out':p.id===s.host?'Host':''}</span>${s.phase==='lobby'&&host()&&p.id!==s.me.id?`<button class="remove" data-remove="${p.id}" aria-label="Remove ${esc(p.name)}">×</button>`:''}</li>`).join('')}</ul>`;}
function rules(){return `<details class="rules" data-disclosure="rules"><summary>How to play</summary><p>5–12 people, together in the same room. Everyone joins on their own phone. The creator chooses the roles and plays too.</p><p>Mafia choose a target each night. Most mafia picks wins; ties are resolved randomly. The angel can prevent that kill. The sheriff learns whether their target is mafia at dawn—even if the sheriff is eliminated that night.</p><p>Discuss out loud during the day, then vote on your phone. The creator chooses secret, public, or in-person day voting before the game. In-person voting happens aloud; the creator records and confirms the agreed elimination or nobody, even if the creator is out. For phone voting, public ballots are revealed together after everyone has voted. Most votes wins. A tie, or abstain winning, means no elimination. You may vote for yourself. Votes are final.</p><p>Mafia wins at equal numbers. Town wins when all mafia are out. Eliminated players stay quiet and roles stay hidden until the end. Rooms expire after 24 hours.</p></details>`;}
function progress(){
 if(s.phase==='night')return s.nightCue?`<p class="night-status">${roleNames[s.nightCue]}’s turn</p>`:'';
 const eligible=s.players.filter(p=>s.phase==='roles'||p.alive);
 const labels=s.phase==='vote'?['Not voted','Voted']:s.phase==='roles'?['Not ready','Ready']:['Pending','Done'];
 const ordered=[...eligible.filter(p=>!p.submitted),...eligible.filter(p=>p.submitted)];
 return `<details class="progress-details" data-disclosure="progress"><summary class="progress"><span class="progress-count">${s.submitted} / ${total()} ${s.phase==='vote'?'voted':'ready'}</span><span class="readiness-track" aria-hidden="true">${eligible.map(p=>`<span class="${p.submitted?'complete':''}"></span>`).join('')}</span></summary><ul class="readiness-list">${ordered.map(p=>`<li><span>${esc(p.name)}${p.id===s.me.id?' (you)':''}</span><span class="readiness-status ${p.submitted?'is-ready':''}">${p.submitted?'✓ ':''}${labels[p.submitted?1:0]}</span></li>`).join('')}</ul></details>`;
}
function angelDescription(){const c=s.config;if(c.angelCountOn==='self'&&c.angelFrequency!=='every')return `Protect another player every night. ${c.angelFrequency==='once'?'You may protect yourself once per game.':'You may protect yourself every other night; after protecting yourself, choose someone else or skip the next night.'} ${c.angelInformed?'You see the mafia’s target before choosing.':'You choose without knowing the mafia’s target.'}`;return `Protect a player, including yourself. ${c.angelInformed?'You see the mafia’s intended victim before choosing.':'Choose without knowing the mafia’s target.'} ${c.angelFrequency==='once'?'You have one protection for the game.':c.angelFrequency==='alternate'?'After a protection, skip at least one night.':'You may protect every night.'} ${c.angelFrequency!=='every'?`Your limit counts ${c.angelCountOn==='save'?'only when you prevent a death':'whenever you use protection'}.`:''}`;}
function secret(){return revealed?`<div class="secret-card">${s.me.investigation?`<p class="investigation-result"><strong>${esc(s.me.investigation.name)} is ${s.me.investigation.mafia?'mafia':'not mafia'}.</strong></p>`:''}${s.phase==='roles'?'':`<h2>${roleNames[s.me.role]}</h2>`}<p>${s.me.role==='angel'?angelDescription():roleCopy[s.me.role]}</p>${s.me.role==='mafia'?`<p><strong>${s.team.length?`Your team: ${s.team.map(p=>esc(p.name)).join(', ')}`:'You are the only mafia player.'}</strong></p>`:''}</div>${button('Hide private information','hide','private-toggle')}`:button('View private information','reveal',s.phase==='roles'&&!s.me.submitted?'primary':'private-toggle');}
// Preserve the reader's position and focus when another player updates the room.
function paint(html){
 const stage=s?`${s.code}:${s.stage}`:'entry',sameStage=stage===paintedStage;
 const y=window.scrollY,active=document.activeElement;
 const focusKey=active?.id?`#${CSS.escape(active.id)}`:active?.dataset.mode?`[data-mode="${active.dataset.mode}"]`:active?.dataset.choice?`[data-choice="${active.dataset.choice}"]`:active?.dataset.action?`[data-action="${active.dataset.action}"]`:null;
 const disclosureState=sameStage?[...app.querySelectorAll('details[data-disclosure]')].map(el=>[el.dataset.disclosure,el.open]):[];
 const openHelp=sameStage&&helpAnchor?{key:helpAnchor.dataset.help,pinned:helpPinned}:null;
 const drafts=!s?[...app.querySelectorAll('input')].map(el=>[el.id,el.value]):[];
 closeHelp();app.innerHTML=html;
 for(const [key,open] of disclosureState){const el=app.querySelector(`[data-disclosure="${key}"]`);if(el)el.open=open;}
 for(const [id,value] of drafts){const el=document.getElementById(id);if(el)el.value=value;}
 const primary=s?app.querySelector('.primary[data-action]'):null;
 document.body.classList.toggle('has-action',!!primary);
 if(primary){const dock=document.createElement('div');dock.className='action-dock';primary.before(dock);dock.append(primary);
  if(choice&&(s.phase==='vote'||(s.phase==='night'&&revealed))){const caption=document.createElement('div');caption.className='action-caption';caption.textContent=choice==='skip'?(s.config.dayVoteVisibility==='in-person'?'Group result: nobody eliminated':'Your vote: abstain'):`Selected: ${s.players.find(p=>p.id===choice)?.name||''}`;const clear=document.createElement('button');clear.className='link clear-choice';clear.dataset.action='clear-choice';clear.textContent='Clear';caption.append(clear);dock.prepend(caption);}
 }
 if(sameStage){if(focusKey)app.querySelector(focusKey)?.focus({preventScroll:true});window.scrollTo({top:y,behavior:'instant'});}else window.scrollTo({top:0,behavior:'instant'});
 addHelp();polishState();busyFeedback();
 if(openHelp){const anchor=document.querySelector(`[data-help="${openHelp.key}"]`);if(anchor)showHelp(anchor,openHelp.pinned);}
 if(!sameStage&&paintedStage!==null&&s){const heading=app.querySelector('h1');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}}
 if(!sameStage&&!matchMedia('(prefers-reduced-motion:reduce)').matches){const headline=app.querySelector('h1,.invite-label');headline?.animate([{opacity:0,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)'}],{duration:220,easing:'cubic-bezier(.25,1,.5,1)'});}
 paintedStage=stage;
}
function render(){
 if(confirmation&&confirmation.context!==confirmationContext())confirmDialog.close('cancel');
 if(!s)document.querySelector('#invite-dialog').close();document.querySelector('#exit').hidden=!s;document.querySelector('#audio-controls').hidden=!host();app.dataset.phase=s?.phase||'entry';document.querySelector('#audio-hint').textContent=s?.phase==='night'&&!s.nightCue&&s.guidedNext?'Guided turns begin next night. Keep this phone awake for audio.':s?.guidedNext?'Guided night: mafia → sheriff → angel → morning. Keep this phone awake.':'Enable audio to guide the night. Keep this phone awake.';
 if(!s&&restoring){app.dataset.phase='loading';paint(loadingScreen());return;}
 if(!s){paint(`${paused&&seat?button('Resume my room','resume'):''}<div class="home ${mode==='join'?'entry-join':''}"><section class="hero"><h1 class="wordmark">Mafia</h1><p class="intro">5–12 friends. One phone each.<br>No moderator needed.</p></section><section><div class="panel"><div class="tabs" role="tablist" aria-label="Enter a game"><button role="tab" id="tab-create" aria-controls="entry" tabindex="${mode==='create'?0:-1}" aria-selected="${mode==='create'}" data-mode="create">Create a room</button><button role="tab" id="tab-join" aria-controls="entry" tabindex="${mode==='join'?0:-1}" aria-selected="${mode==='join'}" data-mode="join">Join a room</button></div><form id="entry" role="tabpanel" aria-labelledby="tab-${mode}"><div class="field"><label for="name">Your name</label><input id="name" name="name" autocomplete="given-name" placeholder="Name" maxlength="24" required></div>${mode==='join'?`<div class="field"><label for="code">Room code</label><input id="code" name="code" placeholder="ABC123" maxlength="6" minlength="6" autocapitalize="characters" spellcheck="false" autocomplete="off" value="${esc(new URLSearchParams(location.search).get('room')||'')}" required></div>`:''}<button class="primary" type="submit">${mode==='create'?'Create room':'Join the table'}</button></form></div>${rules()}</section></div>`);return;}
 let html=['night','discussion','vote','result'].includes(s.phase)?`<div class="game-head">${s.phase==='night'?'Night':'Day'} ${s.round}</div>`:'';
 if(s.phase==='lobby'){const c=s.config,remaining=s.players.length-c.mafia-Number(c.sheriff)-Number(c.angel),valid=s.players.length>=5&&c.mafia<s.players.length-c.mafia&&remaining>=0;
 html+=`<div class="layout lobby"><section class="lobby-intro">${inviteCard()}<details class="card lobby-players" data-disclosure="players" ${s.players.length===1||!matchMedia('(max-width:760px), (max-width:1000px) and (pointer:coarse)').matches?'open':''}><summary class="section-title"><span>Players</span><span class="counter">${s.players.length} / 12</span></summary>${roster()}${s.players.length===1?'<div class="empty-players"><strong>Waiting for your friends</strong><p>Share the invite above. Friends appear here as they join.</p></div>':''}</details></section><section class="card cast-card"><div class="section-title"><h2>Game settings</h2></div><div class="role-option"><div class="role-description"><strong>Mafia</strong></div><select id="mafia" aria-label="Number of mafia" ${host()?'':'disabled'}>${[1,2,3,4,5].map(n=>`<option ${n===c.mafia?'selected':''}>${n}</option>`).join('')}</select></div>${['sheriff','angel'].map(role=>`<div class="role-option"><label><span class="role-description"><strong>${roleNames[role]}</strong></span><input type="checkbox" role="switch" id="${role}" ${c[role]?'checked':''} ${host()?'':'disabled'}></label></div>`).join('')}<div class="role-option"><div class="role-description"><strong>Town</strong></div><span class="role-count">${Math.max(0,remaining)}</span></div>${c.angel?`<details class="angel-settings" data-disclosure="angel"><summary>Angel rules</summary><div class="field"><label for="angelInformed">What does the angel know?</label><select id="angelInformed" ${host()?'':'disabled'}><option value="false" ${!c.angelInformed?'selected':''}>Choose blindly</option><option value="true" ${c.angelInformed?'selected':''}>See the mafia’s target</option></select></div><div class="field"><label for="angelFrequency">How often can the angel protect?</label><select id="angelFrequency" ${host()?'':'disabled'}><option value="every" ${c.angelFrequency==='every'?'selected':''}>Every night</option><option value="alternate" ${c.angelFrequency==='alternate'?'selected':''}>Rest the following night</option><option value="once" ${c.angelFrequency==='once'?'selected':''}>Once per game</option></select></div>${c.angelFrequency!=='every'?`<div class="field"><label for="angelCountOn">The limit counts…</label><select id="angelCountOn" ${host()?'':'disabled'}><option value="use" ${c.angelCountOn==='use'?'selected':''}>After every protection</option><option value="save" ${c.angelCountOn==='save'?'selected':''}>After a successful save</option><option value="self" ${c.angelCountOn==='self'?'selected':''}>After protecting yourself</option></select></div>`:''}<p class="caption">${c.angelCountOn==='self'&&c.angelFrequency!=='every'?'Only self-protection is limited. Protecting other players remains available every night.':'The angel may skip. Self-protection and repeat targets are allowed.'}</p></details>`:''}<div class="field vote-settings"><label for="dayVoteVisibility">Day voting</label><select id="dayVoteVisibility" ${host()?'':'disabled'}><option value="secret" ${!['public','in-person'].includes(c.dayVoteVisibility)?'selected':''}>Secret votes</option><option value="public" ${c.dayVoteVisibility==='public'?'selected':''}>Public votes</option><option value="in-person" ${c.dayVoteVisibility==='in-person'?'selected':''}>In-person voting</option></select><p class="caption">${c.dayVoteVisibility==='in-person'?'Vote aloud as a group. The creator selects and confirms the outcome; nobody votes on their phone.':c.dayVoteVisibility==='public'?'Votes are revealed together after everyone submits.':'Only vote totals are shown.'}</p></div>${!valid?`<p class="role-total">${s.players.length<5?`${5-s.players.length} more ${5-s.players.length===1?'player':'players'} needed to start.`:'Choose fewer mafia or special roles.'}</p>`:''}${host()?button('Start game','start','primary',!valid):'<p class="note">Waiting for the creator to start.</p>'}${canUndoSettings()?`<div class="setting-undo" role="status"><span>Settings updated</span>${button('Undo','undo-settings','link')}</div>`:''}${rules()}</section></div>`;
 if(!host())html=`<section class="focus"><h1>Waiting to start</h1><p class="muted">The creator will deal roles when everyone has joined.</p>${inviteCard()}<h2 class="list-heading">${s.players.length} / 12 players</h2>${roster()}<details class="rules" data-disclosure="settings"><summary>Game settings</summary><p>${c.mafia} mafia${c.sheriff?', sheriff':''}${c.angel?', angel':''}. ${c.dayVoteVisibility==='in-person'?'In-person voting':c.dayVoteVisibility==='public'?'Public votes':'Secret votes'}.</p>${c.angel?`<p>${angelDescription()}</p>`:''}</details></section>`;
 }else{html+='<section class="focus">';
 if(s.phase==='roles'){
 html+=`<h1>${s.me.submitted?'Waiting for players':revealed?`You’re ${s.me.role==='town'?'a townsperson':s.me.role==='angel'?'the angel':s.me.role==='sheriff'?'the sheriff':'mafia'}.`:'Check your role'}</h1>${!s.me.submitted&&!revealed?'<p class="muted">Make sure nobody can see your screen.</p>':''}${secret()}${!s.me.submitted&&revealed?button('Ready','ready'):s.me.submitted?button('Undo ready','unready','secondary'):''}${progress()}`;
 }
 if(s.phase==='night'){
 const active=s.me.alive&&s.me.nightActionRequired&&!s.me.submitted;
 const waiting=active&&(s.me.nightTurnOpen===false||(revealed&&s.me.angelWaiting));
 const title=!s.me.alive?'You’re out':!s.me.nightActionRequired?'Nothing to do tonight.':s.me.submitted?'Choice submitted':waiting?'Wait for your turn':!revealed?'Your turn':s.me.role==='mafia'?'Who will you eliminate?':s.me.role==='sheriff'?'Who will you investigate?':'Who will you protect?';
 html+=`<h1>${title}</h1>`;
 if(!s.me.alive)html+='<p class="muted">Watch quietly. Keep your role secret.</p>';
 else if(!s.me.nightActionRequired)html+=`<p class="muted">${s.me.role==='angel'?(s.config.angelFrequency==='once'?'Your protection has been used.':'Your protection is resting this night.'):'The town is asleep.'} Morning starts automatically.</p>`;
 else if(s.me.submitted)html+='<p class="muted">Waiting for the remaining night actions.</p>';
 else if(waiting)html+=`<p class="muted">${s.me.angelWaiting&&revealed?'The mafia is still choosing.':'Your turn will open automatically.'}</p>`;
 else if(!revealed)html+=`<p class="muted">Make sure nobody can see your screen.</p>${button('Open my private turn','reveal')}`;
 else{
 html+=`<p class="muted">${s.me.role==='mafia'?'Your team’s most-picked target is eliminated.':s.me.role==='sheriff'?'You’ll get a private result at dawn.':s.me.angelSelfAvailable===false?'Self-protection is unavailable tonight. Choose someone else or skip.':'You may protect yourself or skip this night.'}</p>${s.me.angelTarget?`<p class="target-notice">Mafia’s target: <strong>${esc(s.me.angelTarget)}</strong></p>`:''}`;
 const opts=s.players.filter(p=>p.alive&&(p.id!==s.me.id||(s.me.role==='angel'&&s.me.angelSelfAvailable!==false))&&(s.me.role!=='mafia'||!s.team.some(t=>t.id===p.id)));
 html+=choices(opts)+button('Lock my choice','choose','primary',!choice);
 if(s.me.role==='angel')html+=button('Skip protection tonight','sleep','secondary');
 html+=button('Hide private information','hide','private-toggle');
 }
 html+=progress();
 }
 if(s.phase==='discussion'){
 html+=`<h1>${s.report.name?`${esc(s.report.name)} died last night.`:'Nobody died last night.'}</h1><p class="muted">${s.me.alive?'Discuss who you suspect before voting.':'You’re out. Listen quietly and keep your role secret.'}</p>${s.me.investigation&&!revealed?'<p class="private-notice">Your investigation result is ready.</p>':''}${secret()}${host()?button(s.config.dayVoteVisibility==='in-person'?'Begin in-person vote':'Start voting','vote'):'<p class="caption">Waiting for the creator to open voting.</p>'}${playerDetails()}`;
 }
 if(s.phase==='vote'&&s.config.dayVoteVisibility==='in-person'){
 html+=`<h1>${host()?'Record the group’s vote':'Vote in person'}</h1><p class="muted">${host()?'Select the agreed result. You’ll confirm before it is final.':s.me.alive?'Vote aloud or by a show of hands.':'You’re out. Only living players vote.'}</p>${host()?`${!s.me.alive?'<p class="caption">You can still record the result while eliminated.</p>':''}${choices(s.players.filter(p=>p.alive),true,'Nobody eliminated')}${button('Lock group result','resolve-vote','primary',!choice)}`:'<p class="caption">The creator records the result. No phone vote is needed.</p>'}`;
 }else if(s.phase==='vote'){
 html+=`<h1>${!s.me.alive?'You’re out':s.me.submitted?'Vote submitted':'Who should be voted out?'}</h1><p class="muted">${!s.me.alive?'Waiting for the living players to vote.':s.me.submitted?'Your vote is locked. Waiting for the remaining players.':s.config.dayVoteVisibility==='public'?'Everyone will see your vote after voting ends.':'Your vote is secret.'}</p>${s.me.alive&&!s.me.submitted?choices(s.players.filter(p=>p.alive),true)+button('Lock my vote','choose','primary',!choice)+'<details class="rules" data-disclosure="vote-rules"><summary>Voting rules</summary><p>You may vote for yourself. Votes are final; a tie eliminates nobody.</p></details>':''}${progress()}`;
 }
 if(s.phase==='result'){
 html+=`<h1>${s.report.name?`${esc(s.report.name)} was voted out.`:'Nobody was voted out.'}</h1><p class="muted">${s.report.name?'Their role stays secret until the game ends.':s.report.method==='in-person'?'The group chose not to eliminate anyone.':'The vote was tied or abstain received the most votes.'}</p>${s.report.method==='in-person'?'<p class="caption">Confirmed by the room creator.</p>':tally()}${host()?button('Start next night','night'):'<p class="caption">Waiting for the creator to begin the next night.</p>'}`;
 }
 if(s.phase==='over'){
 html+=`<h1>${s.winner==='mafia'?'Mafia wins.':'Town wins.'}</h1><p class="muted">${s.winner==='mafia'?'Mafia equals or outnumbers the town.':'All mafia players are out.'}</p>${s.report?.name?`<p>${esc(s.report.name)} ${s.report.kind==='night'?'died last night.':'was voted out.'}</p>`:''}<h2 class="list-heading">Everyone’s roles</h2>${roster()}${s.report?.ballots?`<details class="rules" data-disclosure="final-votes"><summary>Final vote</summary>${tally()}</details>`:''}${host()?button('Play again','restart'):'<p class="caption">Waiting for the creator to start another game.</p>'}`;
 }
 html+='</section>';}

 paint(html);
}
function choices(players,skip=false,skipLabel='Abstain'){return `<div class="choice-list" role="group" aria-label="Choose a player">${players.map(p=>`<button data-choice="${p.id}" aria-pressed="${choice===p.id}"><span class="choice-name">${esc(p.name)}${p.id===s.me.id?' (you)':''}</span><span class="choice-mark" aria-hidden="true">${choice===p.id?'✓':''}</span></button>`).join('')}${skip?`<button data-choice="skip" aria-pressed="${choice==='skip'}">— ${esc(skipLabel)}</button>`:''}</div>`;}
function tally(){if(!s.report?.tally)return '';return `<ul class="results">${s.report.tally.map(t=>`<li><span>${esc(t.name)}</span><span>${t.count} vote${t.count===1?'':'s'}</span></li>`).join('')}</ul>${s.report.ballots?`<section class="public-ballots"><h2>Who voted for whom</h2><ul class="results">${s.report.ballots.map(b=>`<li><span>${esc(b.voter)}</span><span>→ ${esc(b.target)}</span></li>`).join('')}</ul></section>`:''}`;}
const helpText={
 mafia:'Mafia know their teammates and choose a target each night. They win when they equal or outnumber the town. Start with fewer mafia than town-side players.',
 sheriff:'Adds one sheriff. Each night they check whether one player is mafia. The result is shown privately at dawn, even if the sheriff dies that night.',
 angel:'Adds one angel who protects one selected player from the mafia. Open Angel rules to set what they know and how often they can protect.',
 town:'Remaining players are townspeople. They have no night action. They win by voting out every mafia member.',
 angelInformed:'Choose blindly: the angel does not see the mafia’s target. See the mafia’s target: the angel waits for all mafia choices, then sees the intended victim privately.',
 angelFrequency:'Every night has no limit. Rest the following night adds a one-night cooldown. Once per game allows one counted protection. The setting below decides what counts.',
 angelCountOn:'Every protection: using the ability counts, even if nobody is saved. Successful save: it counts only if a death is prevented. Protecting yourself: only self-protection is limited; you can still protect others on every night. Skipping never consumes a use.',
 dayVoteVisibility:'Secret: only totals are shown. Public: names and votes are revealed together after everyone submits. In-person: vote aloud; only the creator records and confirms the agreed result.',
 audio:'Audio plays on the creator’s phone. Sounds uses chimes; Voice + sounds adds narration. Enabling it guides future nights one role at a time. Keep this phone awake. Audio off mutes playback but keeps guided turns enabled.',
 start:'Deals random private roles and locks the room settings. Everyone must check their role before the first night. You will confirm before starting.',
 ready:'Marks you ready. You can undo while others are still getting ready. Once everyone is ready, the night starts automatically and readiness cannot be undone.',
 reveal:'Shows only your own role or night action. Keep your screen private. You can hide it again at any time.',
 choose:'Selecting a name does not submit anything. Tap another name to change it, or tap the selected name again to clear it. Locking opens a confirmation with the exact player; after confirmation the choice is final.',
 sleep:'Skips the angel’s protection for this night without consuming a use. You will confirm first; a submitted skip cannot be undone.',
 vote:'Ends the discussion and opens the configured vote. Make sure the group is ready: the game cannot go back to the discussion phase.',
 night:'Begins the next night after the vote result. The elimination stays final and cannot be undone.',
 restart:'Returns the same group to the lobby and clears the finished game. You can change settings and deal fresh roles. It does not create a new room.',
 'resolve-vote':'Records the group’s agreed outcome, not an individual vote. Select a living player or nobody. The named result must be confirmed and cannot be undone.',
 'undo-settings':'Restores your most recent setting change while the room is still in the lobby. If settings have changed elsewhere, undo is rejected instead of overwriting them.'
};
const helpPopover=document.querySelector('#help-popover');let helpAnchor=null,helpTimer,helpPinned=false;
function canUndoSettings(){return settingUndo&&s?.phase==='lobby'&&settingUndo.code===s.code&&Object.keys({...s.config,...settingUndo.after}).every(key=>s.config[key]===settingUndo.after[key]);}
function closeHelp(){clearTimeout(helpTimer);if(helpPopover.matches(':popover-open'))helpPopover.hidePopover();helpAnchor?.removeAttribute('aria-describedby');helpAnchor=null;helpPinned=false;}
function showHelp(anchor,pinned=false){closeHelp();helpAnchor=anchor;helpPinned=pinned;helpPopover.textContent=helpText[anchor.dataset.help];anchor.setAttribute('aria-describedby','help-popover');helpPopover.showPopover();const r=anchor.getBoundingClientRect(),w=helpPopover.offsetWidth,h=helpPopover.offsetHeight;helpPopover.style.left=`${Math.max(12,Math.min(r.left,innerWidth-w-12))}px`;helpPopover.style.top=`${Math.max(12,r.bottom+h+12<innerHeight?r.bottom+8:r.top-h-8)}px`;}
function helpButton(key,label='Explain this action'){const el=document.createElement('button');el.type='button';el.className='help-button';el.dataset.help=key;el.setAttribute('aria-label',label);el.innerHTML='<span aria-hidden="true">?</span>';return el;}
function addHelp(){
 for(const id of ['mafia','sheriff','angel','angelInformed','angelFrequency','angelCountOn','dayVoteVisibility']){
  const control=document.getElementById(id);if(!control)continue;
  if(['sheriff','angel'].includes(id)){const label=control.closest('label'),row=label.parentElement;label.htmlFor=id;row.append(control);row.insertBefore(helpButton(id,`About ${id}`),control);}
  else if(id==='mafia')control.before(helpButton(id,'About mafia'));
  else{const label=app.querySelector(`label[for="${id}"]`),wrap=document.createElement('div');wrap.className='help-label';label.before(wrap);wrap.append(label,helpButton(id,`About ${label.textContent}`));}
 }
 const town=app.querySelector('.role-count');if(town)town.before(helpButton('town','About townspeople'));
 for(const action of app.querySelectorAll('button[data-action]')){
  const key=action.dataset.action;if(!helpText[key])continue;
  // A single contextual help button per action; no explanation on obvious controls.
  const row=document.createElement('div');row.className='help-action';action.before(row);row.append(action,helpButton(key));
 }
}
document.addEventListener('click',e=>{const anchor=e.target.closest('[data-help]');if(!anchor){if(!helpPopover.contains(e.target))closeHelp();return;}if(helpAnchor===anchor&&helpPinned){closeHelp();return;}showHelp(anchor,true);});
document.addEventListener('pointerover',e=>{const anchor=e.target.closest('[data-help]');if(!anchor||!matchMedia('(hover:hover) and (pointer:fine)').matches)return;clearTimeout(helpTimer);helpTimer=setTimeout(()=>showHelp(anchor),200);});
document.addEventListener('pointerout',e=>{if(!e.target.closest('[data-help]')||helpPinned)return;clearTimeout(helpTimer);helpTimer=setTimeout(closeHelp,150);});
helpPopover.addEventListener('pointerenter',()=>clearTimeout(helpTimer));helpPopover.addEventListener('pointerleave',()=>{if(!helpPinned)closeHelp();});
document.addEventListener('focusin',e=>{const anchor=e.target.closest('[data-help]');if(anchor)showHelp(anchor);});
document.addEventListener('focusout',e=>{if(e.target.closest('[data-help]')&&!helpPinned)closeHelp();});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeHelp();});
window.addEventListener('resize',closeHelp);

app.addEventListener('keydown',e=>{if(!e.target.matches('[role=tab]')||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const next=e.key==='Home'?'create':e.key==='End'?'join':mode==='create'?'join':'create';app.querySelector(`[data-mode="${next}"]`).click();app.querySelector(`[data-mode="${next}"]`).focus();});
window.addEventListener('online',()=>poll());
window.addEventListener('offline',()=>status('You’re offline. Reconnect to continue playing.',true));
app.addEventListener('focusout',e=>{if(e.target.matches('select'))setTimeout(poll,0);});
app.addEventListener('submit',async e=>{if(e.target.id!=='entry')return;e.preventDefault();if(seat&&!await confirmAction('Replace your saved seat with a different room? You will no longer be able to resume the old seat from this browser.','Change room'))return;send(mode,{name:document.querySelector('#name').value,...(mode==='join'?{code:document.querySelector('#code').value.trim().toUpperCase()}: {})});});
app.addEventListener('change',e=>{if(['mafia','sheriff','angel','angelInformed','angelFrequency','angelCountOn','dayVoteVisibility'].includes(e.target.id))send('configure',{config:{...s.config,dayVoteVisibility:document.querySelector('#dayVoteVisibility').value,mafia:Number(document.querySelector('#mafia').value),sheriff:document.querySelector('#sheriff').checked,angel:document.querySelector('#angel').checked,angelInformed:document.querySelector('#angelInformed')?.value==='true',angelFrequency:document.querySelector('#angelFrequency')?.value||s.config.angelFrequency,angelCountOn:document.querySelector('#angelCountOn')?.value||s.config.angelCountOn}});});
app.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b||busy)return;if(b.dataset.mode){const name=document.querySelector('#name')?.value;mode=b.dataset.mode;render();document.querySelector('#name').value=name;return;}if(b.dataset.choice){choice=choice===b.dataset.choice?null:b.dataset.choice;render();return;}if(b.dataset.remove){if(await confirmAction(`Remove ${s.players.find(p=>p.id===b.dataset.remove)?.name} from this room? They will need to join again. This cannot restore their old seat.`,'Remove player'))send('remove',{target:b.dataset.remove});return;}const a=b.dataset.action;if(!a)return;if(a==='clear-choice'){choice=null;render();return;}if(a==='undo-settings'){if(canUndoSettings())send('configure',{config:settingUndo.before,expectedConfig:settingUndo.after});return;}if(a==='pause'){paused=true;restoring=false;restoreFailed=false;status('');render();return;}if(a==='retry'||a==='resume'){paused=false;restoring=true;restoreFailed=false;render();poll();return;}if(a==='reveal'||a==='hide'){revealed=a==='reveal';render();return;}if(a==='qr'){showInvite();return;}if(a==='copy-link'){await copyInvite();return;}if(a==='copy'){const link=`${location.origin}/?room=${s.code}`;try{if(navigator.share){try{await navigator.share({title:'Join my Mafia room',text:`Room ${s.code} — ASL Mafia`,url:link});return;}catch(e){if(e.name==='AbortError')return;}}await navigator.clipboard.writeText(link);b.textContent='Invite link copied ✓';}catch{error.textContent=`Share this link: ${link}`;}return;}if(a==='resolve-vote'){const target=choice;if(!target)return;const name=s.players.find(p=>p.id===target)?.name;const text=target==='skip'?'Confirm the group’s result: nobody is eliminated?':`Confirm the group’s result: eliminate ${name}?`;if(await confirmAction(`${text}\n\nThis is final and may end the game.`,target==='skip'?'Confirm no elimination':'Eliminate player'))send('resolve-vote',{target,confirmed:true});return;}if(a==='sleep'){if(await confirmAction('Skip protection this night? Nobody will receive your protection. This cannot be changed after you submit.','Skip protection'))send('choose',{target:'sleep'});return;}if(a==='choose'){if(!choice)return;const name=s.players.find(p=>p.id===choice)?.name;const verb=s.phase==='vote'?'Vote for':s.me.role==='mafia'?'Choose as the mafia target:':s.me.role==='sheriff'?'Investigate':'Protect';const message=choice==='skip'?'Abstain from this vote?':`${verb} ${name}${choice===s.me.id?' (yourself)':''}?`;if(await confirmAction(`${message}\n\nYour choice is final. The game may advance immediately.`,s.phase==='vote'?'Lock vote':'Lock choice'))send('choose',{target:choice});return;}const warning={start:'Start the game and deal secret roles? Players and settings will be locked until the game ends.',ready:'Ready to begin? If you are the last player, the night starts immediately. You can undo readiness only while others are still getting ready.',vote:'End the discussion and start voting? You cannot return to the discussion phase.',night:'Start the next night? The previous result stays final.',restart:'Return everyone to the lobby? The finished game and roles will be cleared. You can adjust settings before dealing again.'}[a];if(warning&&!await confirmAction(warning,{start:'Start game',ready:'I’m ready',vote:'Start voting',night:'Start night',restart:'Return to lobby'}[a]))return;send(a);});
const inviteDialog=document.querySelector('#invite-dialog');
let copyTimer;
const inviteLink=()=>`${location.origin}/?room=${s.code}`;
function showInvite(){
 if(!s)return;
 const qr=qrcode(0,'M');qr.addData(inviteLink());qr.make();
 document.querySelector('#invite-image').src=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr.createSvgTag(8,32))}`;
 document.querySelector('#invite-code').textContent=s.code;
 document.querySelector('#invite-link').value=inviteLink();
 document.querySelector('#invite-note').textContent=s.phase==='lobby'?'Scan with your phone camera to join.':'This game has started. New players can join when the room returns to the lobby.';
 if(!inviteDialog.open)inviteDialog.showModal();
}
async function copyInvite(){
 if(!s)return;
 try{await navigator.clipboard.writeText(inviteLink());if(inviteDialog.open)document.querySelector('#invite-note').textContent='Invite link copied.';const notice=document.querySelector('#copy-notice');notice.textContent='Invite link copied';notice.hidden=false;clearTimeout(copyTimer);copyTimer=setTimeout(()=>notice.hidden=true,2500);}
 catch{showInvite();document.querySelector('#invite-note').textContent='Copy the link below, or scan the QR code.';document.querySelector('#invite-link').focus();document.querySelector('#invite-link').select();}
}
inviteDialog.addEventListener('close',()=>document.querySelector('#invite-qr')?.focus({preventScroll:true}));
document.querySelector('#invite-close').onclick=()=>inviteDialog.close();
document.querySelector('#invite-copy').onclick=copyInvite;
inviteDialog.addEventListener('click',e=>{if(e.target===inviteDialog){const r=inviteDialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)inviteDialog.close();}});
document.querySelector('#audio-mode').onchange=async e=>{const mode=e.target.value;if(mode!=='off'&&!s.guidedNext&&!await confirmAction('Enable guided turns for future nights? Roles will act one at a time. Turning audio off later only mutes sound; guided turns stay enabled.','Enable guide')){e.target.value=nightAudio.mode;return;}await nightAudio.enable(mode);e.target.value=nightAudio.mode;if(nightAudio.mode!=='off'){if(!s.guidedNext)await send('guide');nightAudio.event=null;nightAudio.update(s);if(!s.nightCue&&s.report?.kind!=='night')nightAudio.play('ready');}};
document.querySelector('#audio-replay').onclick=async()=>{await nightAudio.enable(document.querySelector('#audio-mode').value);nightAudio.event=null;nightAudio.update(s);if(!s.nightCue&&s.report?.kind!=='night')nightAudio.play('ready');};
document.querySelector('#exit').onclick=async()=>{if(await confirmAction('Leave this screen? Your seat stays in this browser; use Resume to return.','Leave room')){paused=true;restoring=false;restoreFailed=false;nightAudio.stop();s=null;lastJson='';render();}};
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(confirmDialog.open)confirmDialog.close('cancel');revealed=false;if(s)render();}else poll();});
async function poll(){
 if(!seat||paused||busy||polling||document.hidden||document.activeElement?.matches('select'))return;
 const pollingSeat=seat;polling=true;
 try{const result=await request('state');if(seat!==pollingSeat||busy||paused||document.activeElement?.matches('select'))return;accept(result);status('');}
 catch(e){
  if(seat!==pollingSeat||busy||paused)return;
  if(e.status===401||e.status===404){
   restoring=false;restoreFailed=false;seat=null;s=null;lastJson='';lastAnnounced=null;revealed=false;choice=null;
   try{localStorage.removeItem(storageKey);}catch{}
   status('');error.textContent=e.message;render();
  }else if(!s){if(!restoreFailed){restoring=true;restoreFailed=true;render();}}else status('Connection lost. Reconnecting automatically…',true);
 }finally{polling=false;}
}
restoring=!!seat;render();if(!navigator.onLine)status('You’re offline. Reconnect to continue playing.',true);if(seat)poll();setInterval(poll,2500);
