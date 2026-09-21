import {chromium,webkit} from 'playwright';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
const base=process.env.TEST_URL||'http://127.0.0.1:4201';
for(const engine of [chromium,webkit]){
 let disconnected=false,proxy;let origin=base;
 // WebKit's offline emulation rejects navigation before the worker can respond.
 // A disconnected upstream tests the actual cache fallback without that emulator.
 if(engine===webkit){proxy=createServer(async(req,res)=>{if(disconnected){req.socket.destroy();return;}try{const chunks=[];for await(const chunk of req)chunks.push(chunk);const upstream=await fetch(base+req.url,{method:req.method,headers:{'Content-Type':'application/json',...(req.headers.authorization?{Authorization:req.headers.authorization}:{})},...(chunks.length?{body:Buffer.concat(chunks)}:{})});res.writeHead(upstream.status,{'Content-Type':upstream.headers.get('content-type')||'text/plain','Cache-Control':'no-store'});res.end(Buffer.from(await upstream.arrayBuffer()));}catch{res.writeHead(502);res.end();}});await new Promise(r=>proxy.listen(0,'127.0.0.1',r));origin=`http://127.0.0.1:${proxy.address().port}`;}
 const browser=await engine.launch();try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(origin);
 await page.getByRole('button',{name:'Add to home screen',exact:true}).click();
 // Chromium may offer a native install prompt after installability is determined; on first load fallback instructions are available.
 if(await page.locator('#install-dialog').isVisible()){await page.keyboard.press('Escape');assert.equal(await page.locator('#install-app').evaluate(el=>el===document.activeElement),true);}
 await page.locator('[data-mode=create]').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('[data-mode=join]').getAttribute('aria-selected'),'true');assert.equal(await page.locator('[data-mode=join]').evaluate(el=>el===document.activeElement),true);await page.keyboard.press('Home');
 const manifest=await page.evaluate(()=>fetch('/manifest.webmanifest').then(r=>r.json()));assert.equal(manifest.display,'standalone');assert.equal(manifest.start_url,'/');assert.ok(manifest.icons.some(i=>i.purpose==='maskable'));
 await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 await page.locator('#name').fill('PWA host');await page.locator('[type=submit]').click();await page.locator('.room-code').waitFor();const seat=await page.evaluate(()=>localStorage.getItem('asl-mafia-seat-v2'));
 for(const id of ['sheriff','angel']){const box=await page.locator(`#${id}`).boundingBox();assert.ok(box.width>=44&&box.height>=44);}
 const keys=await page.evaluate(async()=>{const result=[];for(const name of await caches.keys()){for(const request of await (await caches.open(name)).keys())result.push({url:request.url,method:request.method});}return result;});assert.ok(keys.length>=10);assert.ok(keys.every(k=>k.method==='GET'&&!new URL(k.url).pathname.startsWith('/api')));
 if(proxy)disconnected=true;else await context.setOffline(true);await page.reload();await page.getByRole('heading',{name:'Can’t reach your room'}).waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('asl-mafia-seat-v2')),seat);assert.equal(await page.locator('.secret-card').count(),0);await page.screenshot({path:`/tmp/mafia-pwa-${engine.name()}-offline.png`});
 if(proxy)disconnected=false;else await context.setOffline(false);await page.locator('.room-code').waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('asl-mafia-seat-v2')),seat);assert.deepEqual(errors,[]);
 console.log(`PASS ${engine.name()}: keyboard tabs; install metadata; active service worker; 44px switches; public-only cache; offline launch preserves seat; online recovery.`);
 }finally{await browser.close();if(proxy)await new Promise(r=>proxy.close(r));}
}
