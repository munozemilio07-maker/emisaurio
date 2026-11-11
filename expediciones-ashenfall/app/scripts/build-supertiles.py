"""Cose los tiles z4 y z6 en "supertiles" de 2048 px para la vista previa (Artifact).
Uso: python3 scripts/build-supertiles.py <carpeta de salida>
Escribe <salida>/tiles/<capa>/s4|s6/x/y.webp y src/data/supertiles.json."""
import json, os, sys
from PIL import Image
out = sys.argv[1]
man = {}
for layer in ('surface', 'dowdun'):
    for z in (4, 6):
        key = f'{layer}/s{z}'; man[key] = []; n_side = 2 ** z // 8
        for sx in range(n_side):
            for sy in range(n_side):
                im = Image.new('RGBA', (2048, 2048), (0, 0, 0, 0)); n = 0
                for dx in range(8):
                    for dy in range(8):
                        f = f'public/tiles/{layer}/{z}/{sx*8+dx}/{sy*8+dy}.webp'
                        if os.path.exists(f): im.paste(Image.open(f).convert('RGBA'), (dx*256, dy*256)); n += 1
                if not n: continue
                d = f'{out}/tiles/{layer}/s{z}/{sx}'; os.makedirs(d, exist_ok=True)
                im.save(f'{d}/{sy}.webp', quality=78, method=4)
                man[key].append(f'{sx}/{sy}')
json.dump(man, open('src/data/supertiles.json', 'w'))
print({k: len(v) for k, v in man.items()})
