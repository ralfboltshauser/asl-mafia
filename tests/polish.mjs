import {chromium,webkit} from 'playwright';
import assert from 'node:assert/strict';
const base=process.env.TEST_URL||'http://127.0.0.1:4200';
for(const engine of [chromium,webkit]){
 const browser=await engine.launch();
 try{
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  let release,creates=0;const gate=new Promise(r=>release=r);
  await page.route('**/api',async route=>{if(route.request().postDataJSON().action==='create'){creates++;await gate;}await route.continue();});
  await page.goto(base);await page.locator('#name').fill('Polish test');await page.locator('[type=submit]').click();
  await page.getByRole('button',{name:'Creating room…'}).waitFor();assert.equal(await page.locator('[type=submit]').isDisabled(),true);assert.equal(await page.locator('#app').getAttribute('aria-busy'),'true');assert.equal(creates,1);
  await page.screenshot({path:`/tmp/mafia-polish-${engine.name()}-submitting.png`});
  release();await page.locator('.room-code').waitFor();assert.equal(await page.locator('#app').getAttribute('aria-busy'),'false');await page.locator('.lobby-players').evaluate(el=>el.open=true);await page.getByText('Waiting for your friends',{exact:true}).waitFor();
  await page.screenshot({path:`/tmp/mafia-polish-${engine.name()}-empty.png`,fullPage:true});
  await page.unroute('**/api');
  let unblock;const restoreGate=new Promise(r=>unblock=r);
  await page.route('**/api',async route=>{await restoreGate;await route.continue();});
  await page.reload();await page.getByRole('heading',{name:'Returning to your room'}).waitFor();assert.equal(await page.locator('#entry').count(),0);
  await page.screenshot({path:`/tmp/mafia-polish-${engine.name()}-loading.png`});
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.loading-emblem .spinner').evaluate(el=>getComputedStyle(el).animationName),'none');
  unblock();await page.locator('.room-code').waitFor();await page.unroute('**/api');
  await page.route('**/api',route=>route.abort());await page.reload();await page.getByRole('heading',{name:'Can’t reach your room'}).waitFor();assert.ok(await page.evaluate(()=>localStorage.getItem('asl-mafia-seat-v2')));assert.equal(await page.locator('#entry').count(),0);
  await page.screenshot({path:`/tmp/mafia-polish-${engine.name()}-offline.png`});
  await page.unroute('**/api');await page.getByRole('button',{name:'Try again',exact:true}).click();await page.locator('.room-code').waitFor();
  assert.deepEqual(errors,[]);console.log(`PASS ${engine.name()}: pending submission, duplicate prevention, empty lobby, saved-room loading without entry flash, reduced motion, connection failure and retry.`);
 }finally{await browser.close();}
}
