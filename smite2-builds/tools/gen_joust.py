import json,glob,re,ast,os,subprocess,sys
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from collections import Counter
import gen
from es import ES,GODS_ES,PAN_ES,STAT_ES,PCT
from aspects_es import ASPECTS_ES,CLASS_OF
from PIL import Image
items=gen.items
OUT=sys.argv[1]
def cat(sl):
    if sl=='shifters-shield': return 'hyb'
    c=gen.cat(sl); return 'def' if c=='util' else c
def isAA(sl):
    st=dict(items[sl]['stats']); return 'InhandPower' in st or 'CritChance' in st or ('AttackSpeedPercent' in st and cat(sl)=='off')
DEF_DEFAULT={'mage':['freyas-tears','spirit-robe','magis-cloak','genjis-guard'],
 'phys':['shifters-shield','freyas-tears','magis-cloak','genjis-guard'],
 'aa':['magis-cloak','berserkers-shield','freyas-tears','spectral-armor'],
 'tank':['genjis-guard','breastplate-of-valor','spirit-robe','freyas-tears']}
OFF_DEFAULT=['brawlers-beat-stick','gladiators-shield','runeforged-hammer','shifters-shield']
SITU_IDS=['divine-ruin','brawlers-beat-stick','stygian-anchor','toxic-blade','sundering-arc','contagion','soul-reaver','obsidian-shard','heartseeker','titans-bane','qins-blade','the-executioner','dominance','void-shield','void-stone','genjis-guard','oni-hunters-garb','sphere-of-negation','wyrmskin-hide','breastplate-of-valor','leviathans-hide','hide-of-the-nemean-lion','spectral-armor','midgardian-mail','pharaohs-curse','phantom-shell','purification-beads','magis-cloak','spirit-robe','talisman-of-purification','resolute-mantle','hussars-wings','erosion','mystical-mail','shield-splitter','lernaean-bow','aegis-of-acceleration','mantle-of-discord','shifters-shield','freyas-tears','prophetic-cloak','draconic-scale','dwarven-plate','time-lock-aegis','stone-of-binding','screeching-gargoyle','avenging-blade','helm-of-radiance']
HEAL_EXTRA={'Anubis','Hades','Hercules','Chaac','Cerberus','Artio','Thanatos','Amaterasu'}
SHIELD_EXTRA={'Khepri'}
used=set(SITU_IDS)
for v in DEF_DEFAULT.values(): used|=set(v)
used|=set(OFF_DEFAULT)
def build_role(rn,r):
    P=gen.pool(r)
    for it in P: it['cat']=cat(it['id'])
    P=[it for it in P if it['pick']>=3][:16]
    if len(P)<6: return None
    meta=sorted(P[:6],key=lambda x:x['slot'])
    dc=sum(1 if x['cat']=='def' else .5 if x['cat']=='hyb' else 0 for x in meta)
    kind='off' if dc<=1 else 'hyb' if dc<=3.5 else 'def'
    offp=[x for x in P if x['cat']=='off']
    fm=sum(1 for x in offp[:8] if gen.flavor(x['id'])=='M'); fp=sum(1 for x in offp[:8] if gen.flavor(x['id'])=='P')
    aa=sum(1 for x in meta if isAA(x['id']))
    prof='tank' if kind=='def' else 'aa' if aa>=3 else 'mage' if fm>fp else 'phys'
    flav='M' if fm>fp else 'P'
    mids={x['id'] for x in meta}
    def mk(nO,nD):
        offs=[x for x in P if x['cat']=='off']+[x for x in P if x['cat']=='hyb']
        defs=[x for x in P if x['cat']=='def']+[x for x in P if x['cat']=='hyb']
        ch=[]; ids=set()
        for x in offs:
            if len(ch)>=nO: break
            ch.append(x); ids.add(x['id'])
        extra=[]
        if len(ch)<nO:
            for d in OFF_DEFAULT:
                if len(ch)+len(extra)>=nO: break
                if d not in ids: extra.append(d); ids.add(d)
        cd=[]
        for x in defs:
            if len(cd)>=nD: break
            if x['id'] in ids: continue
            cd.append(x); ids.add(x['id'])
        if len(cd)<nD:
            for d in DEF_DEFAULT[prof]:
                if len(cd)+len(extra)>=nD+ (nO-len(ch)) : break
                if d not in ids: extra.append(d); ids.add(d)
        rows=sorted(ch+cd,key=lambda x:x['slot'])
        out=[[x['id'],x['pick'],0 if x['id'] in mids else 1] for x in rows]+[[d,None,2] for d in extra]
        return out[:6] if len(out)>=6 else None
    M=[[x['id'],x['pick'],0] for x in meta]
    if kind=='off': b=dict(off=M,hyb=mk(4,2),**{'def':mk(3,3)})
    elif kind=='hyb': b=dict(off=mk(5,1),hyb=M,**{'def':mk(2,4)})
    else:
        noff=len([x for x in P if x['cat'] in('off','hyb')])
        b=dict(off=mk(3,3) if noff>=2 else None,hyb=mk(2,4),**{'def':M})
    sets={k:frozenset(x[0] for x in v) if v else None for k,v in b.items()}
    for k in ('off','hyb','def'):
        if k!=kind and sets[k] and sets[k]==sets[kind]: b[k]=None
    if b['off'] and b['hyb'] and sets['off']==sets['hyb']:
        b['off' if kind!='off' else 'hyb']=None
    for v in b.values():
        if v:
            for x in v: used.add(x[0])
    def top(lst,n=2):
        o=[[a,round(p),round(w)] for a,p,w in lst if a in items and p>=8][:n]
        for a in o: used.add(a[0])
        return o
    asp=None
    if r['aspects']:
        a=max(r['aspects'],key=lambda x:x[1]); nm=items.get(a[0],{}).get('name',a[0]).replace('Aspect of ','').strip()
        none=r.get('aspect_none') or [0,0]
        asp=dict(n=nm,p=round(a[1]),w=round(a[2]),np=round(none[0]),nw=round(none[1]))
    return dict(t=r['rtier'],wr=round(r['wr'],1),n=r['n'],prof=prof,flav=flav,meta=kind,st=top(r['starters']),re=top(r['relics']),asp=asp,b=b)
raw=open('dl/items_latest.js',encoding='utf8').read()
IDB,_=json.JSONDecoder().raw_decode(raw[raw.find('{'):])
def _sl(n): return re.sub(r'[^a-z0-9]+','-',n.lower().replace("'",'').replace('\u2019','')).strip('-')
ID2SL={k:_sl(v['data']['name']) for k,v in IDB.items() if 'data' in v}
def joust_stats(ms):
    n=len(ms); wins=sum(m['w'] for m in ms)
    cnt=Counter(); win=Counter(); slot=Counter(); st=Counter(); stw=Counter(); re_=Counter(); rew=Counter(); asp=Counter(); aspw=Counter()
    for m in ms:
        p=(m['ids'].split('|')+['','','',''])[:4]
        its=[ID2SL.get(x) for x in p[1].split(',')]
        for i,sl in enumerate(its):
            if sl and gen.finished(sl) and i<6:
                cnt[sl]+=1; win[sl]+=m['w']; slot[sl]+=i+1
        for fld,c,cw in ((p[0],st,stw),(p[2],re_,rew),(p[3],asp,aspw)):
            sl=ID2SL.get(fld)
            if sl: c[sl]+=1; cw[sl]+=m['w']
    pc=lambda c:100*c/n
    slots={'1':[[sl,pc(c),100*win[sl]/c] for sl,c in cnt.most_common() if c>=2]}
    r=dict(rtier='',wr=100*wins/n,n=n,slots={},starters=[[sl,pc(c),100*stw[sl]/c] for sl,c in st.most_common(6)],relics=[[sl,pc(c),100*rew[sl]/c] for sl,c in re_.most_common(6)],aspects=[[sl,pc(c),100*aspw[sl]/c] for sl,c in asp.most_common(3)])
    na=n-sum(asp.values()); naw=wins-sum(aspw.values())
    if asp and na>0: r['aspect_none']=[pc(na),100*naw/na]
    r['_pool']=[dict(id=sl,pick=round(pc(c)),win=round(100*win[sl]/c),slot=slot[sl]/c,cat=None) for sl,c in cnt.most_common() if c>=2]
    return r
gen.pool=lambda r:[dict(x) for x in r['_pool']]
G0={g['key']:g for g in json.load(open('gods.json'))}
gods=[]
for key,g in G0.items():
    fn=f'joust/{key}.json'
    if not os.path.exists(fn): continue
    allm=json.load(open(fn)); ms=[m for m in allm if m['patch']=='ob47']
    old=False
    if len(ms)<70 and len(allm)>len(ms): ms=allm; old=True
    if len(ms)<12: print('pocas partidas',key,len(ms)); continue
    tags=[x for l in re.findall(r'\[[^\]]*\]',g['filt']) for x in ast.literal_eval(l)]
    def asp_of(m):
        sl=ID2SL.get((m['ids'].split('|')+['']*4)[3]); return sl if sl and sl.startswith('aspect') else None
    ac=Counter(asp_of(m) for m in ms); ac.pop(None,None)
    def aspinfo(sl):
        en=items[sl]['name'].replace('Aspect of ','').strip(); es=ASPECTS_ES.get(en,(en,''))
        return dict(e=en,es=es[0],d=es[1])
    roles={}
    if ac:
        topa=ac.most_common(1)[0][0]; A=[m for m in ms if asp_of(m)==topa]; B=[m for m in ms if asp_of(m) is None]
        if len(A)>=25 and len(B)>=25:
            for k,grp in sorted((('asp',A),('base',B)),key=lambda kv:-len(kv[1])):
                br=build_role('joust',joust_stats(grp))
                if br: br['asp']=None; br['var']=dict(k=k,**aspinfo(topa)); br['old']=old; roles[k]=br
    if not roles:
        br=build_role('joust',joust_stats(ms))
        if not br: print('skip',key,len(ms)); continue
        if br['asp'] and ac:
            br['asp'].update(aspinfo(ac.most_common(1)[0][0]))
        br['old']=old; roles={'all':br}
    top=next(iter(roles.values()))
    N=len(ms); W=sum(m['w'] for m in ms); adj=100*(W+20)/(N+40)
    tier='S' if adj>=55 else 'A' if adj>=52.5 else 'B' if adj>=49.5 else 'C' if adj>=46 else 'D'
    if g['name'] not in CLASS_OF: print('SIN CLASE',g['name'])
    tr=[]
    if 'healing' in tags or 'sustain' in tags or g['name'] in HEAL_EXTRA: tr.append('heal')
    if 'shielding' in tags or g['name'] in SHIELD_EXTRA: tr.append('shield')
    if 'lockdown' in tags or 'crowd control' in tags: tr.append('cc')
    if top['meta']=='def': tr.append('tank')
    if top['prof']=='aa': tr.append('aa')
    if 'burst damage' in tags or 'stealth' in tags: tr.append('burst')
    slug=re.sub(r'[^a-z0-9]+','-',{'Daji':'Da Ji'}.get(g['name'],g['name']).lower()).strip('-')
    gods.append(dict(k=key,s=slug,n=GODS_ES.get(g['name'],g['name']),e=g['name'],p=PAN_ES.get(g['pan'],g['pan']),dmg='M' if 'magical' in tags else 'P',tr=tr,cls=CLASS_OF.get(g['name'],'Mago'),tier=tier,wr=round(100*W/N),tn=N,roles=roles))
gods.sort(key=lambda g:g['e'])
# sprites
os.makedirs(OUT+'/img',exist_ok=True); os.makedirs(OUT+'/cards',exist_ok=True); os.makedirs('img/item',exist_ok=True)
GC=10; S=96
sheet=Image.new('RGB',(GC*S,((len(gods)+GC-1)//GC)*S),(10,10,16))
for i,g in enumerate(gods):
    g['i']=i
    im=Image.open(f"img/portrait/{g['k']}.webp").convert('RGB').resize((S,S),Image.LANCZOS)
    sheet.paste(im,((i%GC)*S,(i//GC)*S))
sheet.save(OUT+'/img/gods.webp',quality=82,method=6)
ids=sorted(used); miss=[k for k in ids if k not in ES]; print('sin traduccion',miss)
IC=16; T=64
sh=Image.new('RGB',(IC*T,((len(ids)+IC-1)//IC)*T),(10,10,16))
I={}
for i,k in enumerate(ids):
    x=items[k]; fn=f'img/item/{k}.webp'
    if not os.path.exists(fn) or os.path.getsize(fn)<300:
        subprocess.run(['curl','-sS','-A','Mozilla/5.0','--max-time','30','-o',fn,f"https://static.smite2.live/smite2/items/icons/{x['icon']}.webp"])
    try:
        im=Image.open(fn).convert('RGBA'); bg=Image.new('RGBA',im.size,(16,16,24,255)); bg.alpha_composite(im)
        sh.paste(bg.convert('RGB').resize((T,T),Image.LANCZOS),((i%IC)*T,(i//IC)*T))
    except Exception as e: print('icon fail',k,e)
    chips=[]
    for a,b in x['stats']:
        if a in STAT_ES and b: chips.append(f"+{b:g}{'%' if a in PCT else ''} {STAT_ES[a]}")
    m=re.search(r'Adaptive Stat: \+(\d+) Strength or \+(\d+) Intelligence',x['desc'])
    if m: chips.insert(0,f"+{m.group(1)} Fuerza o +{m.group(2)} Inteligencia")
    es=ES.get(k,(x['name'],''))
    I[k]=dict(n=es[0],e=x['name'].strip(),d=es[1],s=chips[:4],c=cat(k) if x['type'] in('Passive','Active') else 'x',i=i,g=round(x['cost']))
sh.save(OUT+'/img/items.webp',quality=84,method=6)
data=dict(patch='OB47',mode='joust',gc=GC,gr=sheet.height//S,ic=IC,ir=sh.height//T,items=I,gods=gods)
json.dump(data,open('data.json','w'),ensure_ascii=False,separators=(',',':'))
print(len(gods),'dioses',len(ids),'items')

print('null builds',Counter(k for g in gods for r in g['roles'].values() for k,v in r['b'].items() if v is None))
print('n partidas: min',min(g['tn'] for g in gods),'mediana',sorted(g['tn'] for g in gods)[len(gods)//2])
print(Counter(g['tier'] for g in gods),Counter(g['cls'] for g in gods),'con dos variantes',[g['e'] for g in gods if len(g['roles'])>1])
for nm in ['Zeus','Ares','Anubis','Hel']:
    g=next((x for x in gods if x['e']==nm),None)
    if not g: continue
    for rk,r in g['roles'].items():
        print(nm,rk,g['tier'],g['wr'],r['n'],r['prof'],r['meta'],g['tr'],r['st'],r['re'],r['asp'],r.get('var'))
        for k,v in r['b'].items(): print('  ',k,[(x[0],x[1]) for x in v] if v else None)
