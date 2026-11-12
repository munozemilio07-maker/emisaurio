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
- [ ] Etapa 2: textos animados y subtítulos automáticos (Whisper local)
- [ ] Etapa 3: filtros, ajustes de color, transiciones y movimientos de cámara
- [ ] Etapa 4: Copiloto de sugerencias (silencios, ritmo, ganchos, ducking, sonoridad)
- [ ] Etapa 5: autoguardado de proyectos, plantillas y pulido final

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
