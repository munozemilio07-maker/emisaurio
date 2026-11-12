# Emisaurio Studio

Un editor de video que funciona dentro de tu navegador y en tu propia computadora. No pone marca de agua, no tiene suscripción y no gasta créditos de IA. Tus videos nunca salen de tu equipo.

## Cómo abrirlo

1. Descarga esta carpeta (`emi-studio`).
2. Ábrelo con doble clic:
   - **Windows:** `Iniciar (Windows).bat`
   - **Mac:** `Iniciar (Mac).command` (la primera vez: clic derecho → Abrir)
   - **Linux / con Python:** `python3 servidor.py`
3. Se abre en tu navegador en `http://localhost:8765`. Usa **Chrome, Edge o Brave** actualizados, porque la exportación necesita WebCodecs.

> El editor no funciona si abres `index.html` con doble clic. Los navegadores bloquean los módulos cargados desde `file://`, así que usa siempre los lanzadores.

## Qué mejora frente a Filmora (según las reseñas)

| Queja frecuente sobre Filmora | En Emisaurio Studio |
|---|---|
| Marca de agua en la versión gratis | Nunca hay marca de agua |
| Créditos de IA que se agotan y cobros por renovación automática | Gratis y local, sin cuentas |
| Va lento con 4K o con videos largos | Exportación fotograma a fotograma con WebCodecs y aceleración por hardware |
| Pocos ajustes para cada red social | 22 destinos con resolución, fps y bitrate ya ajustados, más avisos de duración |
| Los videos horizontales quedan mal en formato vertical | Fondo desenfocado automático y zonas seguras de TikTok/Reels/Shorts |

## Etapas

- [x] **Etapa 1: la base.** Importar video, foto y audio, vista previa, línea de tiempo (mover, recortar, dividir, imán, varias pistas), formatos de proyecto (9:16, 16:9, 1:1, 4:5, 3:4, 2:3, 4:3, 21:9), velocidad, volumen, fundidos, encuadre, transformar, deshacer/rehacer y exportación.
- [x] **Etapa 2: modo viral.** Botón «Optimizar mi video» en 1 clic, subtítulos automáticos con Whisper local (palabra resaltada, emojis, 5 estilos, SRT), cortes de silencio, zoom alterno en cortes, ganchos de los primeros 3 s, barra de progreso, beats de la música, «Voz clara», volumen a −14 LUFS, bajar la música al hablar, 18 filtros con vista previa, auto-color, 15 transiciones, 10 estilos de texto animado y Modo Fácil / Modo Pro.
- [x] **Extra: sonido viral de TikTok.** Pista «Sonido guía» que se escucha al editar pero no se exporta, detección de BPM y beats, cortes al ritmo y montaje al ritmo, e instrucciones de en qué segundo recortar el sonido dentro de TikTok.
- [x] **Etapa 3: autoguardado y «Mis proyectos».** Todo se guarda solo, también tus archivos (hasta 2 GB cada uno). Al abrir, se recupera el último proyecto. Puedes duplicar, borrar y volver a vincular archivos que falten.
- [ ] Etapa 4: editar con el texto, quitar muletillas, buscar en lo dicho, armar desde guion
- [ ] Etapa 5: zooms y efectos de sonido automáticos, puntuación viral, clips automáticos
- [ ] Etapa 6: reencuadre con cara, aislar personas, croma, multicámara automática
- [ ] Etapa 7 (Pro): fotogramas clave con curvas, curvas de color y LUTs, máscaras y seguimiento
- [ ] Etapa 8: limpieza de voz con RNNoise e igualado de diálogos

El detalle de qué copiamos de cada editor de pago está en [INVESTIGACION.md](INVESTIGACION.md).

> Los proyectos se guardan en el navegador para la dirección `http://localhost:8765`. Ábrelo siempre con los lanzadores y en el mismo navegador para ver tus proyectos.

> Los subtítulos automáticos descargan el modelo de IA (≈80 MB) **una sola vez** y necesitan internet esa primera vez. Después funcionan sin conexión.

## Formatos de exportación

- **Video:** MP4 (H.264 / HEVC / AV1), MOV (H.264 / HEVC), WebM (VP9 / AV1 / VP8), MKV (H.264 / AV1), MPEG‑TS
- **Animación:** GIF
- **Audio:** MP3, M4A (AAC), AAC, WAV, FLAC, OGG (Opus)
- **Imagen:** PNG, JPG o WebP del fotograma actual (para miniaturas)
- **Subtítulos:** SRT y VTT

Los formatos que tu navegador no puede codificar aparecen en gris.

## Atajos

`Espacio` reproducir · `S` dividir · `Supr` eliminar · `Shift+Supr` eliminar y cerrar hueco · `Ctrl+D` duplicar · `Ctrl+Z` deshacer · `←/→` fotograma · `I/O` bucle · `Ctrl+rueda` zoom

## Créditos

[Mediabunny](https://mediabunny.dev) (MPL‑2.0) para la lectura y escritura de archivos multimedia. [gifenc](https://github.com/mattdesl/gifenc) (MIT) para los GIF.
