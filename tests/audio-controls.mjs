import {chromium,webkit} from 'playwright';
import assert from 'node:assert/strict';
const base=process.env.TEST_URL||'http://127.0.0.1:4193';
for(const engine of [chromium,webkit]){
 const browser=await engine.launch();try{
 const page=await browser.newPage({viewport:{width:320,height:740},isMobile:true,hasTouch:true});
 page.on('dialog',d=>d.accept());
 await page.addInitScript(()=>{window.tones=0;const start=OscillatorNode.prototype.start;OscillatorNode.prototype.start=function(...args){window.tones++;return start.apply(this,args);};});
 await page.goto(base);await page.locator('#name').fill('Audio QA');await page.getByRole('button',{name:'Create room',exact:true}).click();await page.locator('.room-code').waitFor();
 await page.locator('#audio-controls summary').click();await page.locator('#audio-mode').selectOption('sounds');await page.getByText('Guided night:',{exact:false}).waitFor();assert.ok(await page.evaluate(()=>window.tones)>0);
 for(const width of [320,375,390,430]){await page.setViewportSize({width,height:740});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`overflow ${width}`);}
 await page.locator('#audio-mode').selectOption('off');const before=await page.evaluate(()=>window.tones);await page.locator('#audio-replay').click();assert.equal(await page.evaluate(()=>window.tones),before);console.log(`PASS ${engine.name()}: sounds-only, mute, replay, 320–430px layout`);
 }finally{await browser.close();}
}
