# Qué hace únicos a los editores de pago (investigación, noviembre 2026)

Revisé Premiere Pro, DaVinci Resolve, Final Cut Pro, CapCut Pro, Descript, Opus Clip, Submagic, Captions y Filmora 15. La tabla dice qué funciones los distinguen y si Emisaurio puede replicarlas **en tu equipo, sin créditos**.

**Leyenda:** ✅ se puede hacer local · 🟡 versión parcial · ❌ requiere IA generativa en la nube (fuera de alcance por ahora)

## Edición inteligente

| Función | Quién la tiene | ¿Emisaurio? | Cómo |
|---|---|---|---|
| Editar el video borrando texto de la transcripción | Premiere Pro, Descript | ✅ | Whisper ya da tiempos por palabra; borrar palabras = cortes con cierre de hueco |
| Quitar muletillas ("eh", "este", "o sea") y pausas | Premiere Pro, Descript (Underlord) | ✅ | Diccionario de muletillas en español/inglés + silencios ya detectados |
| Armar la línea de tiempo desde un guion (IntelliScript) | DaVinci Resolve 20 | 🟡 | Comparar el guion con la transcripción de cada clip y ordenar las mejores tomas |
| Buscar en tu material por lo que se dice | Premiere (Media Intelligence) | 🟡 | Búsqueda en transcripciones. La búsqueda visual ("playa al atardecer") sería muy pesada en el navegador |
| Clips cortos automáticos desde un video largo | Opus Clip, Filmora (Smart Short Clips) | 🟡 | Puntuar fragmentos por gancho, preguntas, números, energía y risas en la transcripción |
| Puntuación de viralidad | Opus Clip | 🟡 | Puntuación explicada por reglas: gancho, ritmo de cortes, duración, subtítulos, volumen y zonas seguras |
| Asistente que edita por chat | Filmora AI Mate, Captions, Descript Underlord | ❌ | Necesita un modelo de lenguaje grande |

## Estilo de creador (lo que hace "pegar" los shorts)

| Función | Quién la tiene | ¿Emisaurio? | Cómo |
|---|---|---|---|
| Zooms automáticos en las palabras fuertes | Submagic, Captions, Opus | ✅ | Picos de volumen + palabras clave de la transcripción |
| Efectos de sonido automáticos (whoosh, pop, riser) | Submagic, Captions | ✅ | Sonidos sintetizados en el propio navegador, así no hay problemas de derechos |
| Subtítulos animados | DaVinci, CapCut, Submagic | ✅ | Ya hecho (etapa 2) |
| B-roll automático | Opus, Captions | ❌ / 🟡 | Generarlo requiere nube. Sí podemos sugerir clips de tu propia biblioteca |

## Imagen

| Función | Quién la tiene | ¿Emisaurio? | Cómo |
|---|---|---|---|
| Reencuadre automático siguiendo a la persona | CapCut, Opus | ✅ | Detección de caras local (MediaPipe) al pasar de 16:9 a 9:16 |
| Aislar personas sin pantalla verde | Final Cut (Magnetic Mask), DaVinci (Magic Mask), CapCut | 🟡 | Segmentación de personas local. Objetos arbitrarios, no |
| Croma (pantalla verde) | Todos | ✅ | Filtro por color en la GPU (WebGL) |
| Seguimiento de movimiento / planar tracking | Filmora, DaVinci | 🟡 | Seguimiento de un punto o zona para pegar textos o difuminar |
| Fotogramas clave con curvas | Filmora, Premiere, DaVinci | ✅ | Editor de keyframes con ease |
| Curvas de color, ruedas, LUTs .cube | DaVinci, Premiere, Final Cut | ✅ | WebGL |
| Alargar un clip con IA (Generative Extend / AI Extend) | Premiere, Filmora 15 | ❌ | Video generativo en la nube |
| Corregir la mirada a cámara (Eye Contact) | Descript, Captions | ❌ | Modelo generativo |

## Audio

| Función | Quién la tiene | ¿Emisaurio? | Cómo |
|---|---|---|---|
| Normalizar a LUFS | Filmora 15, Premiere | ✅ | Ya hecho |
| Limpiar la voz / quitar ruido (Studio Sound, Voice Isolation, Enhance Speech) | Descript, DaVinci, Premiere | 🟡 | Supresión de ruido RNNoise en WebAssembly. No "regenera" la voz como Descript, pero quita bien el ruido de fondo |
| Igualar el sonido entre clips (Dialogue Matcher) | DaVinci 20 | 🟡 | Igualar la sonoridad y el EQ de cada clip a uno de referencia |
| Cambio automático de cámara según quién habla (Multicam SmartSwitch) | DaVinci 20 | ✅ | Sincronizar ángulos por el audio y cambiar al micrófono que suena más fuerte |

## Lo que nadie resuelve bien (y es nuestra oportunidad)

- **Créditos y suscripciones.** Descript, CapCut Pro, Opus y Captions cobran las funciones de IA en créditos. En Emisaurio todo corre en tu equipo.
- **Privacidad.** Tus videos no se suben a ningún servidor.
- **Reseñas de Descript:** el corte automático a veces es demasiado agresivo, y conviene poder revisarlo antes de aplicarlo. Aquí cada corte automático se previsualiza y se puede deshacer.

## Plan de etapas

1. **Etapa 3:** autoguardado y "Mis proyectos" ✓
2. **Etapa 4:** editar con el texto, quitar muletillas, buscar en lo dicho, armar desde guion ✓
3. **Etapa 5:** zooms y efectos de sonido automáticos, puntuación viral, clips automáticos
4. **Etapa 6:** reencuadre con cara, aislar personas, croma, multicámara automática
5. **Etapa 7 (Pro):** fotogramas clave con curvas, curvas de color y LUTs, máscaras y seguimiento
6. **Etapa 8:** limpieza de voz con RNNoise e igualado de diálogos

## Fuentes

- Premiere Pro: [Adobe — Novedades](https://helpx.adobe.com/premiere-pro/using/whats-new-cs6.html), [NewscastStudio](https://www.newscaststudio.com/2025/04/03/adobe-brings-generative-extend-media-intelligence-to-premiere-pro), [No Film School](https://nofilmschool.com/adobe-generative-media-tool), [RedShark News — texto y muletillas](https://redsharknews.com/how-to-delete-pauses-and-filler-words-with-text-based-editing), [Creative COW](https://creativecow.net/adobe-unveils-powerful-new-ai-and-3d-features-in-adobe-premiere-pro-and-adobe-after-effects-enhanced-storage-in-frame-io/)
- DaVinci Resolve 20: [Blackmagic Design](https://www.blackmagicdesign.com/media/partial/release/20250404-02), [Newsshooter](https://www.newsshooter.com/2025/04/04/blackmagic-design-davinci-resolve-20-announced-with-100-new-features-including-ai-enhancements/), [Digital Production](https://digitalproduction.com/2025/04/23/davinci-resolve-20-beta-ai-edits-so-you-can-panic-about-something-else/)
- Final Cut Pro 11: [Apple Newsroom](https://www.apple.com/newsroom/2024/11/final-cut-pro-11-begins-a-new-chapter-for-video-editing-on-mac), [9to5Mac](https://9to5mac.com/2024/11/13/apple-releases-final-cut-pro-11-with-spatial-video-editing-ai-captions-and-more/)
- CapCut: [CapCut — Standard vs Pro](https://capcut.com/resource/capcut-standard-vs-pro), [vidpros](https://vidpros.com/capcut-pro-vs-free/), [FluxNote](https://fluxnote.io/guides/capcut-ai-features-free-vs-paid-2026)
- Descript: [Muletillas](https://www.descript.com/tools/remove-filler-from-audio), [Studio Sound](https://www.descript.com/studio-sound?lmref=Bwbv0g), [Eye Contact](https://www.descript.com/es/eye-contact), [Chase Jarvis — Underlord](https://chasejarvis.com/blog/descript-underlord-ai/)
- Opus Clip y Submagic: [Opus](https://www.opus.pro/blog/best-video-clipping-tools), [Submagic vs Opus](https://www.submagic.co/alternatives/opus-clip), [Castmagic — reseña de Opus](https://www.castmagic.io/software-reviews/opus-clip), [The CMO](https://thecmo.com/tools/opusclip-review/)
- Captions: [Edit with AI](https://captions.ai/features/edit-with-ai), [Shotkit](https://shotkit.com/captions-ai-review/)
- Filmora 15: [Filmora — versiones](https://filmora.wondershare.com/guide/latest-versions-and-features.html), [TechRadar](https://techradar.com/computing/creative-software/wondershare-filmora-ai-video-editor-2026-review), [Gizmodo — AI Mate](https://gizmodo.com/ai-mate-in-wondershare-filmora-v15-a-new-era-of-intelligent-video-creation-2000700107)
