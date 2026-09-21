import {chromium} from 'playwright';
import {readFile} from 'node:fs/promises';
const root=new URL('../public/',import.meta.url);
const logo=(await readFile(new URL('asl-logo.svg',root),'utf8')).replace('<svg ', '<svg viewBox="0 0 818 270" ');
const font=(await readFile(new URL('inter.woff2',root))).toString('base64');
const browser=await chromium.launch();
try{const page=await browser.newPage({viewport:{width:1200,height:630},deviceScaleFactor:1});
await page.setContent(`<style>@font-face{font-family:Inter;src:url(data:font/woff2;base64,${font})}*{box-sizing:border-box}body{margin:0;background:#101110;color:#f1f2ed;font-family:Inter;padding:56px 72px;height:630px}svg{width:216px;height:auto}h1{font-size:148px;line-height:1;letter-spacing:-9px;font-weight:550;margin:62px 0 24px}p{font-size:34px;line-height:1.35;margin:0;color:#a6aaa3}footer{position:absolute;bottom:52px;left:72px;right:72px;display:flex;justify-content:space-between;border-top:1px solid #30342e;padding-top:24px;font-size:21px;color:#a6aaa3}</style>${logo}<h1>Mafia.</h1><p>Your friends. Your phones.<br>The game hosts itself.</p><footer><span>5–12 players · Mafia, sheriff & angel</span><span>ASL Mafia</span></footer>`);
await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:new URL('social-card.png',root).pathname});
}finally{await browser.close();}
