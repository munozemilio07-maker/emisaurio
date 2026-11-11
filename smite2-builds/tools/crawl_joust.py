import re,json,subprocess,time,os
gods=json.load(open('gods.json'))
os.makedirs('joust',exist_ok=True)
RX=re.compile(r'<div class="ovm ovm--(win|loss)"\s+id="match-[^"]*"\s+data-match-id="([^"]+)"\s+data-player-id="([^"]*)"\s+data-build-ids="([^"]*)"(.*?)(?=<div class="gb-match-item">|\Z)',re.S)
def get(url):
    for a in range(3):
        r=subprocess.run(['curl','-sS','-A','Mozilla/5.0','--max-time','60',url],capture_output=True)
        if r.returncode==0 and len(r.stdout)>20000: return r.stdout.decode('utf8','replace')
        time.sleep(2+3*a)
    return ''
for g in gods:
    fn=f"joust/{g['key']}.json"
    if os.path.exists(fn): continue
    seen={}
    for pg in range(1,5):
        s=get(f"https://smite2.live/god/{g['key']}/builds?mode=joust&page={pg}")
        before=len(seen)
        for res,mid,pid,ids,rest in RX.findall(s):
            mode=re.search(r'ovm__mode">([^<]+)<',rest); patch=re.search(r'ovm__patch[^>]*>([^<]+)<',rest)
            if not mode or mode.group(1).strip()!='Joust': continue
            seen[mid+'|'+pid]=dict(w=res=='win',ids=ids,patch=patch.group(1).strip() if patch else '')
        time.sleep(0.3)
        if len(seen)-before<10: break
    json.dump(list(seen.values()),open(fn,'w'))
    print(g['key'],len(seen),sum(1 for m in seen.values() if m['patch']=='ob47'),flush=True)
print('DONE')
