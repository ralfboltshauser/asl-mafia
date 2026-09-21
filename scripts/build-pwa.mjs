import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../public/',import.meta.url);
const file=new URL('sw.js',root),source=await readFile(file,'utf8');
const paths=JSON.parse(source.match(/const SHELL=(\[[^;]+\]);/)[1].replaceAll("'",'"'));
const hash=createHash('sha256');
for(const path of paths)hash.update(await readFile(new URL(path==='/'?'index.html':path.slice(1),root)));
await writeFile(file,source.replace(/asl-mafia-shell-[a-z0-9]+/,`asl-mafia-shell-${hash.digest('hex').slice(0,16)}`));
console.log('PWA shell version generated.');
