import {mkdirSync,readFileSync,writeFileSync,renameSync} from 'node:fs';
const url=process.env.UPSTASH_REDIS_REST_URL,token=process.env.UPSTASH_REDIS_REST_TOKEN;
if(process.env.VERCEL&&(!url||!token))throw new Error('Redis environment is required on Vercel.');
const prefix='mafia:v1:';
async function redis(command){const res=await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(command),signal:AbortSignal.timeout(8000)});if(!res.ok)throw new Error('Room storage is unavailable.');const data=await res.json();if(data.error)throw new Error('Room storage command failed.');return data.result;}
function readLocal(code){try{return readFileSync(new URL(`./.data/${code}.json`,import.meta.url),'utf8');}catch(e){if(e.code==='ENOENT')return null;throw e;}}
export async function read(code){return url?redis(['GET',prefix+code]):readLocal(code);}
export async function write(code,old,next){const value=JSON.stringify(next);if(url){if(old===null)return await redis(['SET',prefix+code,value,'NX','EX',86400])==='OK';return await redis(['EVAL',"if redis.call('GET', KEYS[1]) == ARGV[1] then redis.call('SET', KEYS[1], ARGV[2], 'EX', 86400); return 1 else return 0 end",1,prefix+code,old,value])===1;}
 if(readLocal(code)!==old)return false;mkdirSync(new URL('./.data/',import.meta.url),{recursive:true,mode:0o700});const file=new URL(`./.data/${code}.json`,import.meta.url);writeFileSync(new URL(`./.data/${code}.tmp`,import.meta.url),value,{mode:0o600});renameSync(new URL(`./.data/${code}.tmp`,import.meta.url),file);return true;}
