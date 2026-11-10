import json,math,random,collections
random.seed(3)
exist=json.load(open('data.json'))
ids={s[0] for e in exist for s in e['s']}
rows=[l.split('|') for l in open('dowdun-pines.txt').read().strip().split('\n')]
Q={'quest_bkf':"Black Knight's Fortress",'quest_sq1':'Nodestones (Valerius)','quest_sq2':'Wanted!','quest_sq3':'Biohazard'}
BOSS={'blue_dragon':'Dragón azul','zogre':'Zogre','houndmaster_rexiton':'Houndmaster Rexiton','summoner_flament':'Summoner Flament','stormpact_demon':'Stormpact Demon','sergeant_blister':'Sergeant Blister','rat_master_skrexis':'Rat Master Skrexis','black_knight_titan':'Black Knight Titan'}
NPC={'zanik':'Zanik','wise_old_man':'Wise Old Man','vannaka':'Vannaka','valerius':'Valerius','spittletoe':'Spittletoe','putrilius':'Putrilius','postie_pete':'Postie Pete','offalfoot':'Offalfoot','doric':'Doric'}
pts=[];seen=set()
for id_,cat,sub,name,la,ln,z in rows:
    if id_ in ids: continue
    la,ln=int(la),int(ln);key=(round(la/250),round(ln/250),z)
    pr=1 if cat=='quest' else 0
    p=dict(id=id_,sub=sub,name=name,la=la,ln=ln,ug=(z=='2'),pr=pr)
    if sub=='treasure_chest': k,t,d='cofre','Cofre del tesoro',''
    elif sub=='lore_item': k,t,d='lore',name or 'Objeto de lore',''
    elif sub=='lodestone': k,t,d='viaje',name,'Lodestone'
    elif sub in Q: k,t,d='mision',name or Q[sub],Q[sub]
    elif sub in BOSS: k,t,d='jefe',BOSS[sub],'Enemigo importante'
    elif sub=='misc_dreamstone_shard': k,t,d='secreto','Fragmento de Dreaming Stone',''
    elif sub=='misc_strange_raven': k,t,d='secreto','Cuervo extraño','Biohazard'
    elif sub=='recipe_book': k,t,d='secreto','Libro de recetas',''
    elif sub=='kebbit_burrow': k,t,d='secreto','Madriguera de kebbit',''
    elif sub=='sanguine_urn': k,t,d='secreto','Urna sanguina',''
    elif sub=='agility_course': k,t,d='secreto','Agilidad: '+(name or 'circuito'),''
    elif sub in NPC: k,t,d='npc',NPC[sub],'NPC'
    else: k,t,d='npc',name or sub,''
    if p['ug']: d=(d+' · ' if d else '')+'Subterráneo'
    p.update(k=k,t=t,d=d)
    if key in seen:
        # prefer quest pins
        old=[q for q in pts if (round(q['la']/250),round(q['ln']/250),'2' if q['ug'] else '1')==key][0]
        if pr>old['pr']: pts.remove(old); pts.append(p)
        continue
    seen.add(key);pts.append(p)
print(len(pts),collections.Counter(p['ug'] for p in pts))
LM=[('el Lodestone de Dowdun',28802,220779),('The Menagerie',54270,182630),('The Library',43571,199160),('The Cathedral',50670,213955),('The Courtyard',37325,218771),('The Nexus',54000,228500),('The Bastion',63730,229100),('The Garrison',21991,230685),('The Pastures',45028,253706)]
LMU=[('la Cripta',33500,209000),('el Lago subterráneo',44735,223315),('la Demon Gate',40328,218469)]
def d(a,b): return math.hypot(a[0]-b[0],a[1]-b[1])
def kmeans(P,k):
    xs=[(p['la'],p['ln']) for p in P];best=None
    for t in range(40):
        C=random.sample(xs,k)
        for _ in range(60):
            G=[[] for _ in range(k)]
            for x in xs: G[min(range(k),key=lambda i:d(x,C[i]))].append(x)
            C=[(sum(a for a,b in g)/len(g),sum(b for a,b in g)/len(g)) if g else C[i] for i,g in enumerate(G)]
        lab=[min(range(k),key=lambda i:d(x,C[i])) for x in xs];sz=collections.Counter(lab).values()
        sc=sum(d(x,C[l])**2 for x,l in zip(xs,lab))+(max(sz)-min(sz))*1.5e8
        if best is None or sc<best[0]: best=(sc,lab,C)
    return best[1],best[2]
def tour(P,start):
    rem=P[:];cur=start;out=[]
    while rem:
        n=min(rem,key=lambda p:d(cur,(p['la'],p['ln'])));out.append(n);rem.remove(n);cur=(n['la'],n['ln'])
    L=lambda o:sum(d((o[i]['la'],o[i]['ln']),(o[i+1]['la'],o[i+1]['ln'])) for i in range(len(o)-1))+d(start,(o[0]['la'],o[0]['ln']))
    imp=True
    while imp:
        imp=False
        for i in range(len(out)-1):
            for j in range(i+1,len(out)):
                n=out[:i]+out[i:j+1][::-1]+out[j+1:]
                if L(n)<L(out)-1: out=n;imp=True
    return out
new=[];cur=(28802,220779)
for ug,K,lms,reg in [(False,7,LM,'Dowdun Reach'),(True,2,LMU,'Dowdun Reach · Subterráneo')]:
    P=[p for p in pts if p['ug']==ug];lab,C=kmeans(P,K)
    groups=[[p for p,l in zip(P,lab) if l==i] for i in range(K)];rem=list(range(K));used=set()
    while rem:
        i=min(rem,key=lambda i:d(cur,C[i]));rem.remove(i)
        t=tour(groups[i],cur)
        nm=min([l for l in lms if l[0] not in used] or lms,key=lambda l:d(C[i],(l[1],l[2])))[0];used.add(nm)
        new.append({'r':reg,'n':nm[0].upper()+nm[1:],'s':[[p['id'],p['k'],p['t'],p['d'],p['la'],p['ln']]+([1] if p['ug'] else []) for p in t]})
        cur=(t[-1]['la'],t[-1]['ln'])
        print(reg,nm,len(t))
json.dump(exist+new,open('data2.json','w'),ensure_ascii=False,separators=(',',':'))
