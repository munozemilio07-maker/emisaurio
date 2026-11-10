import json,math,random,collections
random.seed(7)
rows=[l.split('|') for l in open('pins.txt').read().strip().split('\n')]
pts=[];seen={}
for id_,cat,sub,name,la,ln,desc in rows:
    la=int(la);ln=int(ln);key=(round(la/300),round(ln/300))
    p=dict(id=id_,cat=cat,sub=sub,name=name,la=la,ln=ln)
    if key in seen:
        if cat=='q' and seen[key]['cat']!='q': pts.remove(seen[key]); pts.append(p); seen[key]=p
        continue
    seen[key]=p; pts.append(p)
def macro(p):
    la,ln=p['la'],p['ln']
    if la<45000: return 'Fellhollow'
    if ln>112000 and la>133000: return 'Bloodblight'
    if la>140000 or (la>133000 and ln>85000): return 'Brynmoor'
    if ln<50000 and la<110000: return 'Highlands'
    return 'Fractured'
K={'Brynmoor':4,'Bloodblight':1,'Highlands':1,'Fractured':3,'Fellhollow':7}
LM=[("Templo (Lodestone)",189026,5065),("Crasorak Kara",191874,37458),("Thishepen Kara",150931,26827),("Bramblemead",177605,48500),("el Castillo del Duque",160992,61409),("Pantano Susurrante",144813,102752),("Takla Kara",118288,74800),("Manktongue",120899,43673),("Ashien's Watch",77714,138097),("Chaktan Kara",80494,16385),("Kletterbuja Kara",168454,118972),("Fenkenstrain",157086,125148),("la Guarida de Velgar",100247,98829),("el Templo Olvidado",35470,127610),("Emberwood",-51139,29580),("Lago de las Almas Perdidas",-57714,144594),("Skekven Kara",-42244,197429),("Coalridge",-74597,200519),("Bleakfields",-18830,139414),("Hope's Fall",-57991,131804)]
def d(a,b): return math.hypot(a[0]-b[0],a[1]-b[1])
def kmeans(P,k):
    xs=[(p['la'],p['ln']) for p in P]
    best=None
    for t in range(30):
        C=random.sample(xs,k)
        for _ in range(50):
            G=[[] for _ in range(k)]
            for x in xs: G[min(range(k),key=lambda i:d(x,C[i]))].append(x)
            C=[(sum(a for a,b in g)/len(g),sum(b for a,b in g)/len(g)) if g else C[i] for i,g in enumerate(G)]
        lab=[min(range(k),key=lambda i:d(x,C[i])) for x in xs]
        sizes=collections.Counter(lab).values()
        score=sum(d(x,C[l])**2 for x,l in zip(xs,lab))+ (max(sizes)-min(sizes))*2e8
        if best is None or score<best[0]: best=(score,lab,C)
    return best[1],best[2]
def tour(P,start):
    rem=P[:];cur=start;out=[]
    while rem:
        n=min(rem,key=lambda p:d(cur,(p['la'],p['ln'])));out.append(n);rem.remove(n);cur=(n['la'],n['ln'])
    def L(o): return sum(d((o[i]['la'],o[i]['ln']),(o[i+1]['la'],o[i+1]['ln'])) for i in range(len(o)-1))+d(start,(o[0]['la'],o[0]['ln']))
    imp=True
    while imp:
        imp=False
        for i in range(len(out)-1):
            for j in range(i+1,len(out)):
                n=out[:i]+out[i:j+1][::-1]+out[j+1:]
                if L(n)<L(out)-1: out=n;imp=True
    return out,L(out)
order=['Brynmoor','Bloodblight','Highlands','Fractured','Fellhollow']
REG={'Brynmoor':'Brynmoor','Bloodblight':'Brynmoor · Pantano Bloodblight','Highlands':'Ghornfell · Stormtouched Highlands','Fractured':'Ghornfell · Fractured Plains','Fellhollow':'Fellhollow'}
exps=[];cur=(189026,5065);used=collections.Counter()
for r in order:
    P=[p for p in pts if macro(p)==r]
    lab,C=kmeans(P,K[r])
    groups=[[p for p,l in zip(P,lab) if l==i] for i in range(K[r])]
    # order clusters by greedy from cur
    rem=list(range(K[r]))
    while rem:
        i=min(rem,key=lambda i:d(cur,C[i]));rem.remove(i)
        g=groups[i]; t,length=tour(g,cur)
        nm=min([l for l in LM if not used[l[0]]] or LM,key=lambda l:d(C[i],(l[1],l[2])))[0]
        used[nm]+=1
        exps.append(dict(region=REG[r],near=nm,stops=t,length=round(length)))
        cur=(t[-1]['la'],t[-1]['ln'])
for e in exps: print(e['region'],e['near'],len(e['stops']),e['length'])
json.dump(exps,open('exps.json','w'),ensure_ascii=False)
