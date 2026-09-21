import {chromium,webkit} from 'playwright';import assert from 'node:assert/strict';
const base=process.env.TEST_URL||'http://127.0.0.1:4201';
for(const engine of [chromium,webkit]){const browser=await engine.launch();try{
 const context=await browser.newContext({viewport:{width:320,height:568},serviceWorkers:'block'});await context.addInitScript(()=>localStorage.setItem('asl-mafia-seat-v2',JSON.stringify({code:'ABC234',token:'fixture'})));
 const page=await context.newPage();let nativeDialogs=0,actions=0;page.on('dialog',d=>{nativeDialogs++;d.dismiss();});
 let state={revision:1,code:'ABC234',host:'0',stage:1,phase:'lobby',round:0,config:{mafia:1,sheriff:true,angel:true,angelFrequency:'every',angelCountOn:'use',dayVoteVisibility:'secret'},me:{id:'0',alive:true,submitted:false},players:['Ralf','Sam','Nina','Jo','Alex'].map((name,i)=>({id:String(i),name,alive:true})),team:[],submitted:0};
 await page.route('**/api',r=>{if(r.request().postDataJSON().action!=='state')actions++;return r.fulfill({json:{state}});});await page.goto(base);await page.locator('[data-action=start]').click();await page.getByRole('alertdialog').waitFor();assert.equal(await page.locator('#confirm-cancel').evaluate(el=>el===document.activeElement),true);
 for(let i=0;i<5;i++){await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.querySelector('#confirm-dialog').contains(document.activeElement)),true);}
 await page.evaluate(()=>Promise.all(document.getAnimations().map(a=>a.finished)));await page.screenshot({path:`/tmp/mafia-confirm-${engine.name()}.png`});assert.equal(await page.locator('#confirm-dialog').evaluate(el=>el.scrollWidth>el.clientWidth),false);
 await page.keyboard.press('Escape');await page.locator('#confirm-dialog').waitFor({state:'hidden'});assert.equal(await page.locator('[data-action=start]').evaluate(el=>el===document.activeElement),true);assert.equal(actions,0);
 await page.locator('[data-action=start]').click();state={...state,phase:'roles',stage:2,revision:2,me:{...state.me,role:'town'}};await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await page.locator('#app[data-phase=roles]').waitFor();await page.locator('#confirm-dialog').waitFor({state:'hidden'});assert.equal(actions,0);assert.equal(nativeDialogs,0);
 console.log(`PASS ${engine.name()}: 320px custom alert dialog; Cancel autofocus; trapped Tab; Escape and focus restore; game advance cancels pending action; no native dialogs.`);
}finally{await browser.close();}}
