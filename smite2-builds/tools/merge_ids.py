# Suma una descarga nueva (con id) a las partidas actuales, saltando ids ya vistos en descargas anteriores.
# Para partidas viejas sin id, una del mismo parche con mismo resultado y objetos cuenta como repetida.
import json,os,sys,collections
CUR,OLDNOID,NEW,OUT=sys.argv[1:5]; SEEN=sys.argv[5:]
os.makedirs(OUT,exist_ok=True); tot=collections.Counter()
for f in sorted(os.listdir(NEW)):
    cur=json.load(open(os.path.join(CUR,f))) if os.path.exists(os.path.join(CUR,f)) else []
    seen=set()
    for d in SEEN:
        if os.path.exists(os.path.join(d,f)): seen|={m['id'] for m in json.load(open(os.path.join(d,f)))}
    old=json.load(open(os.path.join(OLDNOID,f))) if os.path.exists(os.path.join(OLDNOID,f)) else []
    have=collections.Counter((m['w'],m['ids'],m['patch']) for m in old)
    add=collections.Counter()
    for m in json.load(open(os.path.join(NEW,f))):
        if m['id'] in seen: continue
        k=(m['w'],m['ids'],m['patch'])
        if have[k]>0: have[k]-=1; continue
        cur.append(dict(w=m['w'],ids=m['ids'],patch=m['patch'])); add[m['patch']]+=1
    json.dump(cur,open(os.path.join(OUT,f),'w')); tot.update(add)
    print(f[:-5],dict(add))
print('TOTAL nuevas',dict(tot))
