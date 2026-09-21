import os,json,urllib.request,pathlib,concurrent.futures
root=pathlib.Path(__file__).resolve().parents[1]
key=os.environ.get('ELEVENLABS_API_KEY')
if not key:
 env_file=pathlib.Path.home()/'.env'
 if env_file.exists():
  key=next((line.split('=',1)[1].strip().strip("\"'") for line in env_file.read_text().splitlines() if line.startswith('ELEVENLABS_API_KEY=')),None)
if not key:
 raise SystemExit('Set ELEVENLABS_API_KEY to regenerate narration. Existing clips need no API key.')
lines={
'mafia':['The town sleeps. Mafia, choose your target. Try to look less pleased about it.','Night falls. Mafia, make your choice. Everyone else, practice looking innocent.'],
'sheriff':['Mafia, back to sleep. Sheriff, investigate one player. Suspicious eyebrows are not evidence.','Mafia, your work is done. Sheriff, choose someone to investigate. Trust issues finally have a purpose.'],
'angel':['The town still sleeps. Angel, choose one person to protect, or skip. Yes, saving yourself is allowed.','Keep those eyes closed. Angel, choose your protection, or skip. The town could use a small miracle.'],
'dawn':['Night actions are complete. Everyone, wake up and check your screens. Let the wildly confident accusations begin.','Good morning, town. Check your screens for the news. Coffee first, conspiracy theories immediately after.'],
'ready':['Your night host is ready. Keep this phone awake, turn the volume up, and trust almost no one.']}
(root/'public/audio/lines.json').write_text(json.dumps(lines,indent=2))
def generate(item):
 name,text=item;path=root/'public/audio'/f'{name}.mp3'
 if path.exists():return name+' cached'
 req=urllib.request.Request('https://api.elevenlabs.io/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb?output_format=mp3_44100_128',data=json.dumps({'text':text,'model_id':'eleven_multilingual_v2','voice_settings':{'stability':0.5,'similarity_boost':0.75}}).encode(),headers={'xi-api-key':key,'Content-Type':'application/json'})
 try:
  with urllib.request.urlopen(req,timeout=90) as res:path.write_bytes(res.read())
  return name+' generated'
 except urllib.error.HTTPError as e: return name+' FAILED '+str(e.code)+' '+e.read().decode()[:250]
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
 for result in pool.map(generate,[(f'{k}-{i}',v) for k,vs in lines.items() for i,v in enumerate(vs)]):print(result,flush=True)
