import re,html,json,subprocess,time,os,sys
gods=json.load(open('gods.json'))
os.makedirs('data',exist_ok=True)
RMAP={'Solo':'solo','Jungle':'jungle','Middle':'mid','Carry':'carry','Support':'support'}
def get(url):
    for a in range(3):
        r=subprocess.run(['curl','-sS','-A','Mozilla/5.0','--max-time','40',url],capture_output=True)
        if r.returncode==0 and len(r.stdout)>5000: return r.stdout.decode('utf8','replace')
        time.sleep(2+2*a)
    return ''
def slug(n):
    n={'Daji':'Da Ji'}.get(n,n)
    return re.sub(r'[^a-z0-9]+','-',n.lower()).strip('-')
ENT=re.compile(r'\[([a-z0-9-]+)\] ([\d.]+)% pick ([\d.]+)% win')
def parse(b):
    t=re.sub(r'<script.*?</script>|<style.*?</style>','',b,flags=re.S)
    t=re.sub(r'<img[^>]*icons/([a-z0-9-]+)[^>]*>',r' [\1] ',t)
    t=re.sub(r'<[^>]+>',' ',t); t=re.sub(r'\s+',' ',html.unescape(t))
    out={}
    m=re.search(r'(\S+) Tier ([\d.]+)% Win Rate ([\d.]+)% Pick Rate ([\d,]+) Matches',t)
    if not m: return None
    out.update(tier=m.group(1),wr=float(m.group(2)),pr=float(m.group(3)),n=int(m.group(4).replace(',','')))
    t=t[m.end():]
    def sec(a,b):
        i=t.find(a)
        if i<0: return ''
        j=t.find(b,i) if b else len(t)
        return t[i:j if j>0 else len(t)]
    ents=lambda s:[[x,float(p),float(w)] for x,p,w in ENT.findall(s)]
    asp=sec('Aspects','Relics')
    out['aspects']=ents(asp)
    mn=re.search(r'None ([\d.]+)% pick ([\d.]+)% win',asp)
    if mn: out['aspect_none']=[float(mn.group(1)),float(mn.group(2))]
    out['relics']=ents(sec('Relics','Starters'))[:6]
    out['starters']=ents(sec('Starters','Core'))[:6]
    core=sec('Core','The latest')
    parts=re.split(r' ([1-6]) (?=\[)',core)
    slots={}
    for k in range(1,len(parts)-1,2):
        slots[parts[k]]=ents(parts[k+1])[:25]
    out['slots']=slots
    return out
roles=json.load(open('roles.json'))
for g in gods:
    sl=slug(g['name']); fn=f'data/{sl}.json'
    if os.path.exists(fn): continue
    rec=dict(name=g['name'],key=g['key'],slug=sl,title=g['title'],pan=g['pan'],filt=g['filt'],roles={})
    for r,tier in roles[sl].items():
        b=get(f'https://smitebrain.com/gods/{sl}?role={r}')
        p=parse(b) if b else None
        if p: p['rtier']=tier; rec['roles'][r]=p
        else: print('FAIL',sl,r,len(b),flush=True)
        time.sleep(0.5)
    json.dump(rec,open(fn,'w'))
    print(sl,{k:(v['rtier'],v['wr'],v['n']) for k,v in rec['roles'].items()},flush=True)
print('DONE')
