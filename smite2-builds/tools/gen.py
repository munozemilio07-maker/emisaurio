import json,glob,re,ast
from collections import Counter,defaultdict
items=json.load(open('items.json'))
ALIAS={}
def cat(sl):
    x=items[sl]; st=dict(x['stats']); d=x['desc']
    dmg=any(k in st for k in('MagicalPower','PhysicalPower','InhandPower','CritChance','MagicalPenetrationPercent','MagicalPenetrationFlat','PhysicalPenetrationPercent','LifeStealPercent')) or 'Adaptive Stat' in d
    prot=any(k.startswith(('PhysicalProtection','MagicalProtection')) for k in st) or st.get('MaxHealth',0)>=250 or 'Plating' in st or 'Dampening' in st
    if 'AttackSpeedPercent' in st and not prot: dmg=True
    return 'hyb' if dmg and prot else 'off' if dmg else 'def' if prot else 'util'
def finished(sl):
    x=items.get(sl); return bool(x) and x['cost']>=2000 and x['type'] in('Passive','Active') and x['en']
def flavor(sl):
    st=dict(items[sl]['stats'])
    return 'M' if 'MagicalPower' in st else 'P' if ('PhysicalPower' in st or 'InhandPower' in st or 'CritChance' in st) else ''
def pool(r):
    tot=Counter(); wsum=Counter(); ssum=Counter()
    for s,lst in r['slots'].items():
        for sl,p,w in lst:
            if not finished(sl): continue
            tot[sl]+=p; wsum[sl]+=p*w; ssum[sl]+=p*int(s)
    return [dict(id=sl,pick=round(min(tot[sl],100)),win=round(wsum[sl]/tot[sl]),slot=ssum[sl]/tot[sl],cat=cat(sl)) for sl,_ in tot.most_common() if tot[sl]>=2]
if __name__=='__main__':
    unk=Counter(); used=Counter(); cats=Counter()
    for f in sorted(glob.glob('data/*.json')):
        g=json.load(open(f))
        for rn,r in g['roles'].items():
            for s,lst in r['slots'].items():
                for sl,p,w in lst:
                    if sl not in items and p>=3: unk[sl]+=1
            for it in pool(r)[:14]: used[it['id']]+=1
            for e in r['starters'][:3]+r['relics'][:3]+r['aspects']:
                if e[0] not in items: unk[e[0]]+=1
    print('unknown',unk.most_common(40))
    print(len(used)); print(sorted(used))
    print(Counter(cat(k) for k in used))
    print('util',[k for k in used if cat(k)=='util'],'hyb',[k for k in used if cat(k)=='hyb'])
