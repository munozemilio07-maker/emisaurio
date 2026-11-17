"""Prepara los archivos intermedios que usan gen_joust.py y gen.py (no van al repo).

    python3 tools/prep_fuente.py <carpeta_de_trabajo>

En <carpeta_de_trabajo> deben estar:
  dl/items_latest.js   script de datos de https://smite2.live/items (búscalo en el HTML de cualquier página)
  dl/gods.html         https://smite2.live/gods

Escribe en la misma carpeta:
  items.json   índice de objetos por slug. Si dos objetos se llaman igual (pasa cuando la
               tienda trae una versión nueva todavía desactivada), gana la que está activa.
  gods.json    dioses publicados (sin los marcados como «Unreleased»).
"""
import html, json, os, re, sys

W = sys.argv[1]
slug = lambda n: re.sub(r"[^a-z0-9]+", "-", n.lower().replace("'", "").replace("’", "")).strip("-")

raw = open(os.path.join(W, "dl", "items_latest.js"), encoding="utf8").read()
db, _ = json.JSONDecoder().raw_decode(raw[raw.find("{"):])
items = {}
for k, v in db.items():
    if "data" not in v: continue
    x = v["data"]; key = slug(x["name"])
    if key in items and items[key]["en"] and not x.get("is_enabled"): continue
    desc = re.sub(r"<br\s*/?>", " / ", x.get("description") or "")
    desc = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", desc))).strip()
    items[key] = dict(name=x["name"], type=x.get("type"), tier=x.get("tier"), cost=x.get("total_gold_cost") or 0, icon=x.get("icon"),
                      stats=[(st["StatTag"], st["Value"]) for st in x.get("stats", [])], desc=desc, en=x.get("is_enabled"), tags=x.get("sorting_tags"))
json.dump(items, open(os.path.join(W, "items.json"), "w"))

g = open(os.path.join(W, "dl", "gods.html"), encoding="utf8", errors="replace").read()
gods = []
for b in re.split(r'<div class="god-container"', g)[1:]:
    m = re.search(r'href="/god/([^"?]+)"', b)
    if not m or "unreleased-god" in b: continue
    title = re.search(r'text-amber-400">([^<]+)<', b); pan = re.search(r'pantheons/icons/[^"]+"\s+alt="([^"]+)"', b)
    gods.append(dict(key=m.group(1), name=html.unescape(re.search(r'id="god-name-\d+"[^>]*title="([^"]+)"', b).group(1)),
                     filt=html.unescape(re.search(r'data-filters="([^"]*)"', b).group(1)), unrel=False,
                     title=html.unescape(title.group(1)) if title else "", pan=pan.group(1) if pan else ""))
json.dump(gods, open(os.path.join(W, "gods.json"), "w"))
print(len(items), "objetos;", len(gods), "dioses publicados")
