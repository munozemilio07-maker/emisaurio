"""Genera src/curado/items_catalogo.json e img/items_all.webp desde el catálogo de Smite2.live.

Es el catálogo completo de objetos (stats, texto y etiquetas de la tienda del juego).
Lo escrito a mano (necesidades, counters, cuándo comprar) vive aparte en items_guia.json
y este script NO lo toca.

Necesita archivos que NO están en el repo:
    python3 tools/gen_items.py <items_latest.js> <carpeta_cache_iconos> [parche]
items_latest.js es el script de datos que carga https://smite2.live/items.
"""
import html, json, os, re, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from es import ES
from PIL import Image
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JS, CACHE = sys.argv[1], sys.argv[2]; PARCHE = sys.argv[3] if len(sys.argv) > 3 else "OB47"
raw = open(JS, encoding="utf8").read()
db, _ = json.JSONDecoder().raw_decode(raw[raw.find("{"):])
db = {k: v["data"] for k, v in db.items() if "data" in v}
slug = lambda n: re.sub(r"[^a-z0-9]+", "-", n.lower().replace("'", "").replace("’", "")).strip("-")
id2slug = {k: slug(v["name"]) for k, v in db.items()}

def texto(d):
    d = re.sub(r"<br\s*/?>", "\n", d or "")
    d = html.unescape(re.sub(r"<[^>]+>", "", d))
    lines = [re.sub(r"\s+", " ", l).strip() for l in d.split("\n")]
    return "\n".join(l for l in lines if l)

TIPO = {"Passive": "pasivo", "Active": "activo", "Starter": "inicial", "Relic": "reliquia", "Consumable": "consumible", "Curio": "consumible"}
out = []
for k, x in db.items():
    if not x.get("is_enabled") or x.get("type") not in TIPO: continue
    tags = x.get("tags") or {}
    cat = [c.lower() for c in tags.get("Category", [])]
    filt = [f for f in tags.get("Filter", [])]
    nivel = next((t.upper().replace("TIER", "T") for t in cat if t.startswith("tier")), "")
    tipo = TIPO[x["type"]]
    categoria = ("reliquia" if tipo == "reliquia" else "inicial" if tipo == "inicial" else "consumible" if tipo == "consumible"
                 else "de_un_dios" if "godspecific" in cat else "ofensivo" if "offensive" in cat else "defensivo" if "defensive" in cat
                 else "hibrido" if "hybrid" in cat else "otro")
    s = slug(x["name"]); es = ES.get(s, ("", ""))
    rec = {"id": s, "nombre": x["name"].strip(), "nombre_es": es[0], "tipo": tipo, "nivel": nivel, "categoria": categoria,
           "costo": round(x.get("total_gold_cost") or 0),
           "stats": [[st["StatTag"], st["Value"], st.get("DisplayName") or st["StatTag"]] for st in x.get("stats", [])],
           "filtros": [f for f in filt if not f.startswith("Role.")], "roles": [f[5:] for f in filt if f.startswith("Role.")],
           "componentes": [id2slug[str(r)] for r in x.get("recipes", []) if str(r) in id2slug],
           "texto_en": texto(x.get("description")), "descripcion_es": es[1], "_icon": x.get("icon"),
           "parche_verificado": PARCHE, "fuente": "https://smite2.live/items", "pendiente_verificar": False}
    out.append(rec)
orden = {"T3": 0, "": 1, "T2": 2, "T1": 3}
out.sort(key=lambda r: (orden.get(r["nivel"], 9), r["nombre"]))
ids = {r["id"] for r in out}
for r in out: r["componentes"] = [c for c in r["componentes"] if c in ids]
os.makedirs(CACHE, exist_ok=True)
COLS, T = 20, 64
sheet = Image.new("RGB", (COLS * T, ((len(out) + COLS - 1) // COLS) * T), (10, 10, 16))
for i, r in enumerate(out):
    fn = os.path.join(CACHE, r["id"] + ".webp")
    if not os.path.exists(fn) or os.path.getsize(fn) < 300:
        subprocess.run(["curl", "-sS", "-A", "Mozilla/5.0", "--max-time", "30", "-o", fn, f"https://static.smite2.live/smite2/items/icons/{r.pop('_icon')}.webp"])
    r.pop("_icon", None); r["i"] = i
    try:
        im = Image.open(fn).convert("RGBA"); bg = Image.new("RGBA", im.size, (16, 16, 24, 255)); bg.alpha_composite(im)
        sheet.paste(bg.convert("RGB").resize((T, T), Image.LANCZOS), ((i % COLS) * T, (i // COLS) * T))
    except Exception as e:
        print("sin ícono:", r["id"], e); r["pendiente_verificar"] = True
sheet.save(os.path.join(root, "img", "items_all.webp"), quality=84, method=6)
doc_head = {"_como_editar": "Catálogo generado desde la fuente: no lo edites para agregar consejos (eso va en items_guia.json). Sí puedes corregir un dato tras un parche. 'filtros' son las etiquetas de la tienda del juego. 'i' es la posición en img/items_all.webp.",
            "hoja": {"archivo": "img/items_all.webp", "columnas": COLS, "filas": sheet.height // T}}
with open(os.path.join(root, "src", "curado", "items_catalogo.json"), "w", encoding="utf8") as fh:
    fh.write("{\n" + ",\n".join(f' {json.dumps(k, ensure_ascii=False)}: {json.dumps(v, ensure_ascii=False)}' for k, v in doc_head.items()) + ',\n "items": [\n')
    fh.write(",\n".join("  " + json.dumps(r, ensure_ascii=False) for r in out)); fh.write("\n ]\n}\n")
from collections import Counter
print(len(out), "objetos;", Counter(r["categoria"] for r in out), Counter(r["nivel"] for r in out), "con nombre_es:", sum(1 for r in out if r["nombre_es"]))
print(sorted(Counter(f for r in out for f in r["filtros"]).items(), key=lambda x: -x[1]))
