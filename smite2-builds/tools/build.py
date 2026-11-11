"""Une src/hub.src.html con src/data.json y escribe hub.html."""
import os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = open(os.path.join(root, "src", "hub.src.html"), encoding="utf8").read()
data = open(os.path.join(root, "src", "data.json"), encoding="utf8").read().replace("</", "<\\/")
assert "/*__DATA__*/null" in src
open(os.path.join(root, "hub.html"), "w", encoding="utf8").write(src.replace("/*__DATA__*/null", data))
print("hub.html listo")
