// One unlocked audio context on the creator's phone; no runtime speech service.
export class NightAudio {
 constructor(notify){this.notify=notify;this.mode='off';this.context=null;this.buffers=new Map();this.sources=[];this.event=null;this.generation=0;this.previous={};}
 stop(){this.generation++;for(const source of this.sources){try{source.stop();}catch{}}this.sources=[];}
 async enable(mode){
  this.stop();this.mode=mode;this.event=null;
  if(mode==='off')return;
  try{
   this.context??=new (window.AudioContext||window.webkitAudioContext)();
   await this.context.resume();
   if(this.context.state!=='running')throw Error('Audio is paused');
   if(mode==='narration')await Promise.all(['mafia','sheriff','angel','dawn','ready'].flatMap(cue=>Array.from({length:cue==='ready'?1:2},(_,i)=>`${cue}-${i}`)).map(async name=>{
    if(this.buffers.has(name))return;const r=await fetch(`/audio/${name}.mp3`);if(!r.ok)throw Error('Audio download failed');this.buffers.set(name,await this.context.decodeAudioData(await r.arrayBuffer()));
   }));
   this.play('ready');
  }catch{this.mode='off';this.notify('Audio could not start. Tap an audio mode to retry; the on-screen host still works.');}
 }
 play(cue){
  if(this.mode==='off')return;
  this.stop();const ctx=this.context;if(ctx?.state!=='running'){this.notify('Audio is paused. Keep this phone awake and tap an audio mode to resume.');return;}
  const notes={mafia:[220,165,110],sheriff:[440,660],angel:[523,659,784],dawn:[392,523,659,784],ready:[523,784]}[cue];if(!notes)return;
  const at=ctx.currentTime;
  notes.forEach((hz,i)=>{const osc=ctx.createOscillator(),gain=ctx.createGain(),t=at+i*.22;osc.type='sine';osc.frequency.value=hz;gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(.2,t+.015);gain.gain.exponentialRampToValueAtTime(.001,t+.65);osc.connect(gain).connect(ctx.destination);osc.start(t);osc.stop(t+.7);this.sources.push(osc);});
  if(this.mode==='narration'){
   const count=cue==='ready'?1:2,index=this.previous[cue]===undefined?Math.floor(Math.random()*count):(this.previous[cue]+1)%count;this.previous[cue]=index;
   const buffer=this.buffers.get(`${cue}-${index}`);if(!buffer)return;
   const source=ctx.createBufferSource();source.buffer=buffer;source.connect(ctx.destination);source.start(at+notes.length*.22+.3);this.sources.push(source);
  }
 }
 update(s){
  if(!s||s.host!==s.me.id){this.stop();return;}
  const cue=s.phase==='night'?s.nightCue:s.report?.kind==='night'&&['discussion','over'].includes(s.phase)?'dawn':null;
  const event=`${s.code}:${s.round}:${s.stage}:${cue}`;
  if(event===this.event)return;this.event=event;
  if(cue)this.play(cue);else this.stop();
 }
}
