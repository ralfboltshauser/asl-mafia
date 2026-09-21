import {createRoom,newPlayer,join,playerFor,act,view,settleNight} from '../engine.mjs';
import {read,write} from '../store.mjs';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');res.setHeader('X-Content-Type-Options','nosniff');
 const send=(status,data)=>{res.statusCode=status;res.end(JSON.stringify(data));};
 try{
  if(req.method!=='POST')return send(405,{error:'Use POST.'});
  if(req.headers['sec-fetch-site']==='cross-site')return send(403,{error:'Open the game directly to play.'});
  let body=req.body;if(!body){let text='';for await(const chunk of req){text+=chunk;if(text.length>4096)return send(413,{error:'Request is too large.'});}try{body=JSON.parse(text);}catch{return send(400,{error:'Invalid request.'});}}
  if(typeof body==='string')body=JSON.parse(body);if(!body||typeof body!=='object')return send(400,{error:'Invalid request.'});
  if(body.action==='create'){const r=createRoom(body.name);if(!await write(r.code,null,r))return send(409,{error:'Please try creating the room again.'});return send(200,{token:r.players[0].token,state:view(r,r.players[0])});}
  const code=String(body.code||'').toUpperCase();if(!/^[A-Z2-9]{6}$/.test(code))return send(400,{error:'Enter a six-character room code.'});
  const newcomer=body.action==='join'?newPlayer(body.name):null;
  for(let attempt=0;attempt<8;attempt++){
   const old=await read(code);if(!old)return send(404,{error:'Room not found. Check the code or create a new room.'});const r=JSON.parse(old);
   if(r.expires<Date.now())return send(404,{error:'This room expired. Create a new one.'});
   const p=newcomer||playerFor(r,req.headers.authorization?.replace(/^Bearer /,''));
   if(body.action==='state'){if(settleNight(r)){r.revision++;if(!await write(code,old,r))continue;}return send(200,{state:view(r,p)});}
   if(newcomer)join(r,newcomer);else act(r,p,body);
   r.revision++;
   if(await write(code,old,r))return send(200,{...(newcomer?{token:p.token}:{}),state:view(r,p)});
  }return send(409,{error:'The room is busy. Try again.'});
 }catch(e){send(e.status||503,{error:e.status?e.message:'The host could not connect to room storage. Try again.'});}
}
