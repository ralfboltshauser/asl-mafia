import {chromium,webkit} from 'playwright';
import assert from 'node:assert/strict';
const base=process.env.TEST_URL||'http://127.0.0.1:4188';
const engine=process.env.BROWSER==='webkit'?webkit:chromium;
const browser=await engine.launch();
const names=['Alexandria Montgomery','Maximilian Schwarzenberg','A very long player name!','Zoë','Ralf','Nina','Sam','Jo','Riley','Morgan','Eli','Taylor'];
function fixture(){const players=names.map((name,i)=>({id:String(i),name,alive:true}));return {revision:1,code:'ABC234',config:{mafia:2,sheriff:true,angel:true,angelInformed:true,angelFrequency:'alternate',angelCountOn:'save'},host:'0',phase:'lobby',stage:0,round:1,winner:null,report:null,me:{id:'0',name:names[0],role:'sheriff',alive:true,nightActionRequired:true,submitted:false,investigation:null},team:[],submitted:0,players};}
try{
 for(const [width,height] of [[320,568],[375,667],[390,844],[430,932],[844,390]].filter(([w])=>!process.env.WIDTH||w===Number(process.env.WIDTH))){
  const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true});
  await context.addInitScript(()=>localStorage.setItem('asl-mafia-seat-v2',JSON.stringify({token:'test-seat',code:'ABC234'})));
  const page=await context.newPage();let state=fixture();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api',route=>route.fulfill({json:{state}}));
  async function update(phase){state.phase=phase;state.stage++;state.revision++;await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await page.waitForFunction(phase=>document.querySelector('.game-head')?.textContent.toLowerCase().includes(phase==='lobby'?'gathering':phase),phase);}
  async function layout(label){
   const metrics=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,dock:document.querySelector('.action-dock')?.getBoundingClientRect().toJSON(),height:innerHeight,smallInputs:[...document.querySelectorAll('input:not([type=checkbox]),select')].filter(e=>parseFloat(getComputedStyle(e).fontSize)<16).map(e=>e.id),smallButtons:[...document.querySelectorAll('button')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&(r.width<44||r.height<44)}).map(e=>e.textContent)}));
   assert.ok(metrics.scroll<=metrics.width,`${label} ${width}px overflow: ${metrics.scroll}`);assert.deepEqual(metrics.smallInputs,[],`${label}: iOS zoom-risk inputs`);assert.deepEqual(metrics.smallButtons,[],`${label}: small tap targets`);
   if(metrics.dock){assert.ok(metrics.dock.bottom<=metrics.height+1,`${label}: dock outside viewport`);assert.ok(metrics.dock.top>=0,`${label}: dock too tall`);}
  }
  await page.goto(base);await page.locator('.room-code').waitFor();await page.evaluate(()=>document.fonts.ready);await layout('lobby');
  await page.locator('.angel-settings summary').click();if(!await page.locator('.lobby-players').evaluate(e=>e.open))await page.locator('.lobby-players summary').click();await page.locator('.lobby-players').scrollIntoViewIfNeeded();
  const y=await page.evaluate(()=>scrollY);state.revision++;state.players[11].name='Someone just joined';await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await page.getByText('Someone just joined',{exact:true}).waitFor();
  assert.equal(await page.locator('.angel-settings').evaluate(e=>e.open),false);assert.equal(await page.locator('.lobby-players').evaluate(e=>e.open),true);assert.ok(Math.abs(await page.evaluate(()=>scrollY)-y)<3,'Polling jumped the page');
  await page.screenshot({path:`/tmp/mafia-lobby-${process.env.BROWSER||'chromium'}-${width}.png`});
  await update('vote');await page.locator('[data-choice="11"]').tap();await layout('vote');assert.equal(await page.locator('[data-choice="11"]').getAttribute('aria-pressed'),'true');assert.match(await page.locator('.action-caption').textContent(),/Someone just joined/);
  await page.screenshot({path:`/tmp/mafia-vote-${process.env.BROWSER||'chromium'}-${width}.png`});
  await update('roles');assert.equal(await page.evaluate(()=>scrollY),0);await page.locator('[data-action="reveal"]').tap();await layout('role');assert.equal(await page.locator('[data-action="ready"]').isEnabled(),true);
  state.me.role='angel';state.me.angelAvailable=true;state.me.angelWaiting=false;state.me.angelTarget=names[1];await update('night');await page.locator('[data-action="reveal"]').tap();await page.locator('[data-choice="1"]').tap();await layout('night');
  assert.deepEqual(errors,[]);console.log(`PASS ${process.env.BROWSER||'chromium'} ${width}×${height}: full lobby, live-update stability, voting, role reveal, night choice, dock, touch targets, 16px inputs.`);await context.close();
 }
}finally{await browser.close();}
