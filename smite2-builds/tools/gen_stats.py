"""Genera src/curado/stats_base.json: stats base por nivel y ataque básico de cada dios.

Necesita carpetas que NO están en el repo:
    python3 tools/gen_stats.py <carpeta_info> <carpeta_niveles> [parche]
  <carpeta_info>     páginas https://smite2.live/god/<Key>/info guardadas como <Key>.html
  <carpeta_niveles>  https://smite2.live/god/<Key>/character_stats/<nivel>?version=... guardadas
                     como <Key>_1.html, <Key>_10.html y <Key>_20.html
Los stats crecen en línea recta: se guarda el nivel 1 y lo que suman por nivel, y se comprueba
con el nivel 10.
"""
import html, json, os, re, sys
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INFO, LVL = sys.argv[1], sys.argv[2]; PARCHE = sys.argv[3] if len(sys.argv) > 3 else "OB48"
gods = json.load(open(os.path.join(root, "src", "data.json"), encoding="utf8"))["gods"]

def lvl(path):
    s = open(path, encoding="utf8", errors="replace").read()
    toks = [x.strip() for x in html.unescape(re.sub(r"<[^>]+>", "\n", s)).split("\n") if x.strip()]
    out = {}
    for i, x in enumerate(toks[:-1]):
        if re.fullmatch(r"[A-Za-z][A-Za-z ]+", x) and re.fullmatch(r"-?[\d.]+", toks[i + 1]) and x not in out:
            out[x] = float(toks[i + 1])
    return out

def basic(path):
    s = open(path, encoding="utf8", errors="replace").read()
    i = s.find("data-ability-heading>"); j = s.find("data-ability-heading>", i + 20)
    blk = s[i:j]
    if "BASIC" not in blk[:400]: return None
    body = html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", re.sub(r"<script.*?</script>", "", blk, flags=re.S))))
    dmg = re.search(r"([\d.]+) \+ ([\d.]+) (Physical|Magical) Damage", body)
    sc = re.search(r"([\d.]+)% Strength(?: or Inhand Power)? and ([\d.]+)% Intelligence", body)
    r = {"tipo": (dmg.group(3) if dmg else ""), "texto": body[:400]}
    if sc: r.update(fuerza=float(sc.group(1)) / 100, inteligencia=float(sc.group(2)) / 100)
    else: r["pendiente_verificar"] = True
    return r

KEYS = {"Max Health": "vida", "Max Mana": "mana", "Health Per Time": "reg_vida", "Mana Per Time": "reg_mana",
        "Physical Protection": "prot_fisica", "Magical Protection": "prot_magica", "Movement Speed": "velocidad",
        "Base Attack Speed": "vel_ataque_base", "Attack Speed Percent": "vel_ataque_pct", "Inhand Power": "dano_ataque"}
out, warn = {}, []
for g in gods:
    k = g["k"]; f1, f10, f20 = (os.path.join(LVL, f"{k}_{n}.html") for n in (1, 10, 20))
    if not all(os.path.exists(f) for f in (f1, f20)): warn.append(f"{k}: faltan niveles"); continue
    a, b = lvl(f1), lvl(f20); c = lvl(f10) if os.path.exists(f10) else None
    rec = {"base": {}, "por_nivel": {}}
    for en, es in KEYS.items():
        if en not in a or en not in b: continue
        rec["base"][es] = a[en]; per = round((b[en] - a[en]) / 19, 4); rec["por_nivel"][es] = per
        if c and en in c and abs(a[en] + 9 * per - c[en]) > 0.6: warn.append(f"{k} {en}: nivel 10 no cuadra ({c[en]} vs {a[en] + 9 * per:.2f})")
    bi = os.path.join(INFO, f"{k}.html")
    if os.path.exists(bi):
        ba = basic(bi)
        if ba: rec["basico"] = ba
    bb = rec.setdefault("basico", {"tipo": ""})
    if "fuerza" not in bb:  # la wiki: todos los dioses escalan sus básicos 100% con Fuerza y 20% con Inteligencia
        bb.update(fuerza=1.0, inteligencia=0.2, por_defecto=True)
    raro = rec["base"].get("vida", 0) < 300 or "prot_fisica" not in rec["base"]
    rec.update(parche_verificado=PARCHE, fuente=f"https://smite2.live/god/{k}/info", pendiente_verificar=raro)
    if raro: rec["nota"] = "La fuente trae stats base incompletos o de relleno para este dios."
    out[g["s"]] = rec
doc = {"_como_editar": "Generado con tools/gen_stats.py. 'base' es el nivel 1 y 'por_nivel' lo que suma cada nivel (crece en línea recta, comprobado con el nivel 10). 'basico.escalado' es el texto del juego para el ataque básico.",
       "dioses": out}
json.dump(doc, open(os.path.join(root, "src", "curado", "stats_base.json"), "w", encoding="utf8"), ensure_ascii=False, indent=1)
from collections import Counter
print(len(out), "dioses; avisos:", warn[:15], len(warn))
print(Counter((v.get("basico", {}).get("fuerza"), v.get("basico", {}).get("inteligencia")) for v in out.values()).most_common(12))
print("sin escalado:", [k for k, v in out.items() if "fuerza" not in v.get("basico", {})])
