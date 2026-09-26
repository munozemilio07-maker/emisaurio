# Torre de Python

Un juego de mazmorras 8-bit para aprender Python desde cero. La torre tiene
**40 pisos** repartidos en **8 zonas**; cada piso es una lección con su
explicación, un ejemplo que puedes ejecutar y una misión en la que escribes
código Python de verdad. Si tu código cumple la misión, el caballero vence al
enemigo y se abre la escalera al siguiente piso. Cada quinto piso es un jefe
que mezcla todo lo de su zona.

| Zona | Tema | Pisos |
|------|------|-------|
| Mazmorras de la Entrada | print, variables, tipos, operadores | 1–5 |
| Cripta de las Runas | textos, f-strings, índices, input | 6–10 |
| Salón de las Decisiones | comparaciones, if / elif / else, and / or / not | 11–15 |
| Catacumbas del Eterno Retorno | for, while, acumuladores, break / continue | 16–20 |
| Armería de las Colecciones | listas, métodos, diccionarios, tuplas | 21–25 |
| Biblioteca del Nigromante | funciones, parámetros, return, recursión | 26–30 |
| Laboratorio del Alquimista | comprensiones, enumerate / zip, try / except, módulos, lambda | 31–35 |
| Cima del Dragón | clases, métodos, `__str__`, herencia | 36–40 |

## Cómo jugar

Abre `index.html` en el navegador (doble clic basta). Necesita internet la
primera vez: el Python que se ejecuta es CPython real compilado a WebAssembly
([Pyodide](https://pyodide.org)), que se descarga de jsDelivr.

- **ATACAR / Ctrl+Enter** ejecuta tu código y comprueba la misión.
- **PISTA** da una ayuda sin revelar la respuesta.
- **SOLUCIÓN** se desbloquea tras 2 intentos fallidos.
- El progreso y tu código se guardan en el navegador.
- Los errores de Python se explican en español, indicando la línea.
- Si escribes un bucle infinito, la torre lo detiene y te avisa.
