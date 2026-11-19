# Junta las partidas guardadas (sin id) con las nuevas (con id), sin contarlas dos veces.
# Las viejas no traen id: una partida nueva del mismo parche cuenta como repetida si ya hay una igual (resultado + objetos).
import json,os,sys,collections
OLD,NEW,OUT=sys.argv[1:4]
os.makedirs(OUT,exist_ok=True)
tot=collections.Counter()
for f in sorted(os.listdir(NEW)):
    new=json.load(open(os.path.join(NEW,f)))
    old=json.load(open(os.path.join(OLD,f))) if os.path.exists(os.path.join(OLD,f)) else []
    have=collections.Counter((m['w'],m['ids'],m['patch']) for m in old)
    out=[dict(w=m['w'],ids=m['ids'],patch=m['patch']) for m in old]
    added=collections.Counter()
    for m in new:
        k=(m['w'],m['ids'],m['patch'])
        if have[k]>0: have[k]-=1; continue
        out.append(dict(w=m['w'],ids=m['ids'],patch=m['patch'])); added[m['patch']]+=1
    json.dump(out,open(os.path.join(OUT,f),'w'))
    tot.update(added)
    c=collections.Counter(m['patch'] for m in out)
    print(f[:-5],'antes',len(old),'nuevas',dict(added),'ob47',c['ob47'],'ob48',c['ob48'])
print('TOTAL nuevas',dict(tot))
