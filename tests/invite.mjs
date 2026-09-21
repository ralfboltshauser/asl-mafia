import {chromium,webkit} from 'playwright';
import jsQR from 'jsqr';
import assert from 'node:assert/strict';
const base=process.env.TEST_URL||'http://127.0.0.1:4197';
for(const engine of [chromium,webkit]){
 const browser=await engine.launch();try{
 const context=await browser.newContext({viewport:{width:320,height:740},isMobile:true,hasTouch:true});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{if(window.denyClipboard)throw Error('Denied');window.copied=text;}}}));
 await page.goto(base);assert.equal(await page.locator('#invite-qr').isVisible(),false);await page.locator('#name').fill('QR host');await page.getByRole('button',{name:'Create room',exact:true}).click();await page.locator('.room-code').waitFor();const code=await page.locator('.room-code').textContent();const link=`${new URL(base).origin}/?room=${code}`;
 await page.locator('.room-code').click();assert.equal(await page.evaluate(()=>window.copied),link);await page.getByText('Invite link copied',{exact:true}).waitFor();assert.equal(await page.locator('#invite-dialog').isVisible(),false);
 await page.locator('#invite-qr').click();await page.locator('#invite-dialog').waitFor();
 const pixels=await page.locator('#invite-image').evaluate(async img=>{await img.decode();const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);return {width:canvas.width,height:canvas.height,data:Array.from(ctx.getImageData(0,0,canvas.width,canvas.height).data)};});
 const decoded=jsQR(new Uint8ClampedArray(pixels.data),pixels.width,pixels.height);assert.equal(decoded?.data,link,'QR must decode to invite URL without seat token');
 for(const [width,height] of [[320,568],[390,844],[844,390]]){await page.setViewportSize({width,height});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.ok(await page.locator('#invite-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth));}
 await page.locator('#invite-copy').click();assert.equal(await page.locator('#invite-note').textContent(),'Invite link copied.');await page.locator('#invite-close').click();assert.equal(await page.locator('#invite-qr').evaluate(el=>el===document.activeElement),true);
 await page.locator('#invite-qr').click();await page.keyboard.press('Escape');assert.equal(await page.locator('#invite-dialog').isVisible(),false);
 await page.evaluate(()=>window.denyClipboard=true);await page.locator('.room-link').click();await page.locator('#invite-dialog').waitFor();assert.equal(await page.locator('#invite-link').inputValue(),link);
 const guest=await (await browser.newContext()).newPage();await guest.goto(decoded.data);assert.equal(await guest.locator('#code').inputValue(),code);await guest.locator('#name').fill('QR guest');await guest.getByRole('button',{name:'Join the table'}).click();await guest.locator('.room-code').waitFor();assert.equal(await guest.locator('.room-code').textContent(),code);
 assert.deepEqual(errors,[]);console.log(`PASS ${engine.name()}: code copies exact link, QR independently decoded, scanning joins correct room, dialog keyboard/focus, clipboard failure fallback, small/landscape layout.`);
 }finally{await browser.close();}
}
