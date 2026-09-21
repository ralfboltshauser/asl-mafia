import {chromium} from 'playwright';
import {readFile} from 'node:fs/promises';
const root=new URL('../public/',import.meta.url);
const logo=(await readFile(new URL('asl-logo.svg',root),'utf8')).replace('<svg ', '<svg viewBox="0 0 818 270" ');
const font=(await readFile(new URL('inter.woff2',root))).toString('base64');
const browser=await chromium.launch();
try{for(const [name,size] of [['icon-192',192],['icon-512',512],['icon-maskable',512],['apple-touch-icon',180]]){
 const page=await browser.newPage({viewport:{width:size,height:size},deviceScaleFactor:1});
 await page.setContent(`<style>@font-face{font-family:Inter;src:url(data:font/woff2;base64,${font})}*{box-sizing:border-box}body{margin:0;background:#101110;color:#f1f2ed;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh}strong{font:550 48vw/1 Inter;letter-spacing:-4vw;margin-left:-4vw}svg{width:43vw;height:auto;margin-top:5vw}</style><strong>M</strong>${logo}`);
 await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:new URL(`${name}.png`,root).pathname});await page.close();
}}finally{await browser.close();}
