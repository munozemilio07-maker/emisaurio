"""Genera src/curado/efectos_habilidades.json desde las fichas de habilidades de Smite2.live.

OJO: sobrescribe el archivo. Si ya lo editaste a mano, no lo corras (o respalda antes).
Necesita una carpeta con las páginas https://smite2.live/god/<Key>/info guardadas como
<Key>.html, que NO está en el repo:

    python3 tools/gen_efectos.py <carpeta_con_html> [parche]
"""
import html, json, os, re, sys
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = sys.argv[1]; PARCHE = sys.argv[2] if len(sys.argv) > 2 else "OB47"
gods = json.load(open(os.path.join(root, "src", "data.json"), encoding="utf8"))["gods"]

ETIQUETAS = {
 "stun": {"nombre": "Aturden", "nombre_en": "Stun", "descripcion": "Aturdimiento: no puedes moverte ni actuar."},
 "root": {"nombre": "Enraízan", "nombre_en": "Root", "descripcion": "Enraizamiento: no puedes moverte, pero sí atacar."},
 "silencio": {"nombre": "Silencian", "nombre_en": "Silence", "descripcion": "Silencio: no puedes usar habilidades."},
 "desplaza": {"nombre": "Levantan, jalan o empujan", "nombre_en": "Knock up, pull or push", "descripcion": "Te mueven a la fuerza: levantar, jalar, empujar o atraer."},
 "slow": {"nombre": "Ralentizan", "nombre_en": "Slow", "descripcion": "Ralentización: te mueves más lento."},
 "otro_control": {"nombre": "Otro control", "nombre_en": "Other crowd control", "descripcion": "Desarme, mesmerizar, miedo, provocación, ceguera, locura, lisiar y similares."},
 "area": {"nombre": "Daño en área", "nombre_en": "Area damage", "descripcion": "Hace daño a varios enemigos a la vez."},
 "curacion": {"nombre": "Curan", "nombre_en": "Heal", "descripcion": "Cura al dios o a sus aliados."},
 "escudo": {"nombre": "Escudan", "nombre_en": "Shield", "descripcion": "Da un escudo de vida."},
 "movilidad": {"nombre": "Movilidad", "nombre_en": "Mobility", "descripcion": "Salto, embestida o teletransporte."},
 "inmunidad": {"nombre": "Inmunidad a control", "nombre_en": "CC immunity", "descripcion": "Te vuelve inmune al control durante la habilidad."},
}
OTROS = {"Cripple": "Lisia (sin habilidades de movimiento)", "Disarm": "Desarma", "Mesmerize": "Mesmeriza", "Fear": "Asusta", "Feared": "Asusta", "Taunted": "Provoca",
         "Blind": "Ciega", "Madness": "Enloquece", "Polymorph": "Transforma", "Banish": "Destierra", "Intoxicate": "Embriaga", "Tremble": "Hace temblar"}
AREA = re.compile(r"\benemies\b|\ball enemies\b|\barea\b|\baround you\b|\bcone\b|\bradius\b|\bexplod", re.I)

def parse(s):
    heads = [(m.start(), html.unescape(m.group(1)).strip()) for m in re.finditer(r"data-ability-heading>([^<]+)<", s)]
    for i, (pos, name) in enumerate(heads):
        blk = s[pos:heads[i + 1][0] if i + 1 < len(heads) else len(s)]
        ty = re.search(r'ability-type-name">([^<]+)<', blk); ty = ty.group(1).strip() if ty else ""
        body = re.sub(r'<div class="aspect-description.*?</div>', "", blk, flags=re.S)
        dc = re.search(r'description-container">(.*?)(?:<ul|<p class="font-normal text-sm text-gray-400 None"><b>NOTE|<table|$)', body, re.S)
        seg = html.unescape(dc.group(1) if dc else body[:3000])
        cls = set(re.findall(r'class="((?:CC|Movement|Heal|Shield|Damage)[^"]*)"', seg))
        txt = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html.unescape(seg))).strip()
        yield name, ty, cls, txt

out = []
for g in gods:
    f = os.path.join(SRC, g["k"] + ".html")
    if not os.path.exists(f): print("falta", g["k"]); continue
    for name, ty, cls, txt in parse(open(f, encoding="utf8", errors="replace").read()):
        if ty == "BASIC" or "Basic Attack" in name: continue
        m = re.match(r"ABILITY (\d)", ty)
        ranura = m.group(1) if m else "P" if ty == "PASSIVE" else "otra"
        ef, det = [], {}
        por_texto = []
        def tiene(clave, marcado, patron):
            if marcado: ef.append(clave)
            elif re.search(patron, txt): ef.append(clave); por_texto.append(clave)
        tiene("stun", "CC.Hard.Stun" in cls, r"\bStun(s|ned|ning)?\b")
        tiene("root", bool(cls & {"CC.Hard.Root", "CC.Hard.Rooted"}), r"\bRoot(s|ed|ing)?\b")
        tiene("silencio", any(c.endswith("Silence") for c in cls), r"\bSilenc(e|es|ed|ing)\b")
        mv = [c.split(".")[-1] for c in cls if c.split(".")[-1] in ("Knockup", "Knockback", "Vortex", "Pull")]
        if mv:
            ef.append("desplaza")
            det["desplaza"] = "Jala" if re.search(r"\bPull", txt) else "Levanta" if re.search(r"Knock(ed|ing|s)? ?Up", txt, re.I) else "Atrae" if "Vortex" in mv else "Empuja"
        tiene("slow", "CC.Soft.Slow" in cls, r"\bSlow(s|ed|ing)?\b")
        ot = sorted({OTROS[c.split(".")[-1]] for c in cls if c.split(".")[-1] in OTROS})
        if ot: ef.append("otro_control"); det["otro_control"] = ", ".join(ot)
        dano = any(c.startswith("Damage") for c in cls)
        area = dano and bool(AREA.search(txt))
        if area: ef.append("area")
        if "Heal" in cls and re.search(r"\bHeal", txt): ef.append("curacion")
        if "Shield" in cls: ef.append("escudo")
        if "Movement" in cls: ef.append("movilidad")
        if "CC.Immunity" in cls: ef.append("inmunidad")
        rec = {"dios": g["s"], "ranura": ranura, "nombre": name, "efectos": ef}
        if det: rec["detalle"] = det
        if area: rec["area_inferida"] = True
        if por_texto: rec["inferido_por_texto"] = por_texto
        if ranura == "otra": rec["tipo_fuente"] = ty
        rec["texto_en"] = txt if len(txt) <= 240 else txt[:240].rsplit(" ", 1)[0] + "…"
        rec.update(parche_verificado=PARCHE, fuente=f"https://smite2.live/god/{g['k']}/info", pendiente_verificar=ranura == "otra")
        out.append(rec)

doc = {"_como_editar": "Un registro por habilidad. 'dios' es el slug de data.json (el mismo de cards/<slug>.webp). 'ranura': P, 1, 2, 3, 4 u 'otra'. 'efectos' usa las claves de 'etiquetas'. Para una etiqueta nueva, agrégala en 'etiquetas' y úsala en 'efectos'.",
       "etiquetas": ETIQUETAS, "habilidades": out}
dst = os.path.join(root, "src", "curado", "efectos_habilidades.json")
with open(dst, "w", encoding="utf8") as fh:
    fh.write('{\n "_como_editar": ' + json.dumps(doc["_como_editar"], ensure_ascii=False) + ',\n "etiquetas": ' + json.dumps(ETIQUETAS, ensure_ascii=False, indent=1).replace("\n", "\n ") + ',\n "habilidades": [\n')
    fh.write(",\n".join("  " + json.dumps(r, ensure_ascii=False) for r in out))
    fh.write("\n ]\n}\n")
from collections import Counter
print(len(out), "habilidades;", Counter(e for r in out for e in r["efectos"]).most_common())
print("pendientes:", [(r["dios"], r["nombre"], r["tipo_fuente"]) for r in out if r["pendiente_verificar"]])
