"""Arma hub.html a partir de la plantilla y los datos.

    python3 tools/build.py

Lee:
  src/hub.src.html      plantilla (HTML + CSS + JS)
  src/data.json         datos generados por el crawler (no editar a mano)
  src/curado/*.json     contenido escrito a mano; cada archivo es opcional

Cada archivo de src/curado/ entra en la página como CURADO.<nombre_del_archivo>.
Si un archivo falta, está vacío o tiene JSON inválido, se avisa y el build sigue.
"""
import json
import os
import sys

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src_dir = os.path.join(root, "src")
cur_dir = os.path.join(src_dir, "curado")

# Archivos que la página sabe mostrar. Uno que falte se trata como vacío.
ESPERADOS = ["efectos_habilidades", "combos", "sinergias", "items_guia", "chat_rapido"]


def incrustable(texto):
    """Evita que un '</script>' dentro de los datos cierre la etiqueta."""
    return texto.replace("</", "<\\/")


plantilla = open(os.path.join(src_dir, "hub.src.html"), encoding="utf8").read()
data = open(os.path.join(src_dir, "data.json"), encoding="utf8").read()

curado = {}
avisos = []
nombres = list(ESPERADOS)
if os.path.isdir(cur_dir):
    for f in sorted(os.listdir(cur_dir)):
        if f.endswith(".json") and f[:-5] not in nombres:
            nombres.append(f[:-5])
for nombre in nombres:
    ruta = os.path.join(cur_dir, nombre + ".json")
    if not os.path.exists(ruta):
        avisos.append(f"{nombre}.json no existe: esa sección sale vacía")
        continue
    texto = open(ruta, encoding="utf8").read().strip()
    if not texto:
        avisos.append(f"{nombre}.json está vacío: esa sección sale vacía")
        continue
    try:
        curado[nombre] = json.loads(texto)
    except json.JSONDecodeError as e:
        avisos.append(f"{nombre}.json tiene un error de JSON (línea {e.lineno}, columna {e.colno}): se omite")

for marca in ("/*__DATA__*/null", "/*__CURADO__*/null"):
    if marca not in plantilla:
        sys.exit(f"Falta la marca {marca} en src/hub.src.html")

salida = plantilla.replace("/*__DATA__*/null", incrustable(data))
salida = salida.replace("/*__CURADO__*/null", incrustable(json.dumps(curado, ensure_ascii=False, separators=(",", ":"))))
open(os.path.join(root, "hub.html"), "w", encoding="utf8").write(salida)

print(f"hub.html listo ({len(salida) // 1024} KB). Curado: {', '.join(curado) or 'nada'}")
for a in avisos:
    print("  aviso:", a)
