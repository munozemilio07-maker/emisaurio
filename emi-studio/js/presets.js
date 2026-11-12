// Presets: plataformas, formatos, filtros, estilos de texto y transiciones.

// Formatos de lienzo (aspecto del proyecto)
export const ASPECTS = [
  { id: '9:16', label: '9:16 Vertical', w: 1080, h: 1920, hint: 'TikTok · Reels · Shorts · Stories' },
  { id: '16:9', label: '16:9 Horizontal', w: 1920, h: 1080, hint: 'YouTube · Twitch · LinkedIn' },
  { id: '1:1', label: '1:1 Cuadrado', w: 1080, h: 1080, hint: 'Feed Instagram · Facebook' },
  { id: '4:5', label: '4:5 Retrato', w: 1080, h: 1350, hint: 'Feed Instagram · Facebook · X' },
  { id: '3:4', label: '3:4 Retrato', w: 1080, h: 1440, hint: 'Carrusel Instagram 2025+' },
  { id: '2:3', label: '2:3 Pin', w: 1000, h: 1500, hint: 'Pinterest' },
  { id: '4:3', label: '4:3 Clásico', w: 1440, h: 1080, hint: 'Presentaciones · retro' },
  { id: '21:9', label: '21:9 Cine', w: 2560, h: 1080, hint: 'Look cinematográfico' },
];

// Plataformas de destino. maxDur en segundos (límites públicos aproximados; pueden cambiar).
export const PLATFORMS = [
  { id: 'tiktok', name: 'TikTok', icon: '♪', aspect: '9:16', w: 1080, h: 1920, fps: 30, mbps: 10, format: 'mp4-h264', maxDur: 600, sweet: [15, 60], color: '#ff0050' },
  { id: 'reels', name: 'Instagram Reels', icon: '◎', aspect: '9:16', w: 1080, h: 1920, fps: 30, mbps: 8, format: 'mp4-h264', maxDur: 180, sweet: [7, 90], color: '#e1306c' },
  { id: 'shorts', name: 'YouTube Shorts', icon: '▶', aspect: '9:16', w: 1080, h: 1920, fps: 60, mbps: 12, format: 'mp4-h264', maxDur: 180, sweet: [15, 60], color: '#ff0000' },
  { id: 'story', name: 'Instagram / FB Stories', icon: '◔', aspect: '9:16', w: 1080, h: 1920, fps: 30, mbps: 6, format: 'mp4-h264', maxDur: 60, sweet: [5, 15], color: '#c13584' },
  { id: 'snap', name: 'Snapchat Spotlight', icon: '☺', aspect: '9:16', w: 1080, h: 1920, fps: 30, mbps: 6, format: 'mp4-h264', maxDur: 60, sweet: [5, 30], color: '#fffc00' },
  { id: 'fbreels', name: 'Facebook Reels', icon: 'f', aspect: '9:16', w: 1080, h: 1920, fps: 30, mbps: 8, format: 'mp4-h264', maxDur: 90, sweet: [15, 60], color: '#1877f2' },
  { id: 'whatsapp', name: 'Estado WhatsApp', icon: '✆', aspect: '9:16', w: 720, h: 1280, fps: 30, mbps: 3, format: 'mp4-h264', maxDur: 60, sweet: [5, 30], color: '#25d366' },
  { id: 'igfeed', name: 'Instagram Feed 4:5', icon: '▣', aspect: '4:5', w: 1080, h: 1350, fps: 30, mbps: 8, format: 'mp4-h264', maxDur: 3600, sweet: [15, 60], color: '#833ab4' },
  { id: 'igsquare', name: 'Instagram Cuadrado', icon: '■', aspect: '1:1', w: 1080, h: 1080, fps: 30, mbps: 8, format: 'mp4-h264', maxDur: 3600, sweet: [15, 60], color: '#fd1d1d' },
  { id: 'yt1080', name: 'YouTube 1080p', icon: '▶', aspect: '16:9', w: 1920, h: 1080, fps: 30, mbps: 12, format: 'mp4-h264', maxDur: 43200, sweet: [180, 1200], color: '#ff0000' },
  { id: 'yt1440', name: 'YouTube 2K', icon: '▶', aspect: '16:9', w: 2560, h: 1440, fps: 30, mbps: 24, format: 'mp4-h264', maxDur: 43200, sweet: [180, 1200], color: '#ff0000' },
  { id: 'yt4k', name: 'YouTube 4K', icon: '▶', aspect: '16:9', w: 3840, h: 2160, fps: 30, mbps: 45, format: 'mp4-h264', maxDur: 43200, sweet: [180, 1200], color: '#ff0000' },
  { id: 'yt4k60', name: 'YouTube 4K 60fps', icon: '▶', aspect: '16:9', w: 3840, h: 2160, fps: 60, mbps: 60, format: 'mp4-h264', maxDur: 43200, sweet: [180, 1200], color: '#ff0000' },
  { id: 'x', name: 'X (Twitter)', icon: '𝕏', aspect: '16:9', w: 1920, h: 1080, fps: 30, mbps: 8, format: 'mp4-h264', maxDur: 140, sweet: [15, 45], color: '#e7e9ea' },
  { id: 'xvert', name: 'X Retrato', icon: '𝕏', aspect: '4:5', w: 1080, h: 1350, fps: 30, mbps: 8, format: 'mp4-h264', maxDur: 140, sweet: [15, 45], color: '#e7e9ea' },
  { id: 'linkedin', name: 'LinkedIn', icon: 'in', aspect: '16:9', w: 1920, h: 1080, fps: 30, mbps: 8, format: 'mp4-h264', maxDur: 900, sweet: [30, 90], color: '#0a66c2' },
  { id: 'fbfeed', name: 'Facebook Feed', icon: 'f', aspect: '4:5', w: 1080, h: 1350, fps: 30, mbps: 8, format: 'mp4-h264', maxDur: 14400, sweet: [15, 60], color: '#1877f2' },
  { id: 'pinterest', name: 'Pinterest', icon: 'P', aspect: '2:3', w: 1000, h: 1500, fps: 30, mbps: 6, format: 'mp4-h264', maxDur: 900, sweet: [6, 30], color: '#e60023' },
  { id: 'twitch', name: 'Twitch / Kick', icon: '◢', aspect: '16:9', w: 1920, h: 1080, fps: 60, mbps: 8, format: 'mp4-h264', maxDur: 3600, sweet: [20, 60], color: '#9146ff' },
  { id: 'vimeo', name: 'Vimeo 4K', icon: 'V', aspect: '16:9', w: 3840, h: 2160, fps: 30, mbps: 50, format: 'mp4-hevc', maxDur: 43200, sweet: [60, 900], color: '#1ab7ea' },
  { id: 'cine', name: 'Cine 21:9', icon: '◫', aspect: '21:9', w: 2560, h: 1080, fps: 24, mbps: 20, format: 'mp4-h264', maxDur: 43200, sweet: [30, 600], color: '#d4af37' },
  { id: 'custom', name: 'Personalizado', icon: '⚙', aspect: null, w: 0, h: 0, fps: 30, mbps: 10, format: 'mp4-h264', maxDur: 1e9, sweet: [0, 1e9], color: '#8b8b9e' },
];

// Formatos de exportación. kind: video | audio | gif | image | text
export const FORMATS = [
  { id: 'mp4-h264', label: 'MP4 · H.264', ext: 'mp4', kind: 'video', container: 'mp4', v: 'avc', a: ['aac', 'opus'], note: 'Compatible con todo' },
  { id: 'mp4-hevc', label: 'MP4 · H.265/HEVC', ext: 'mp4', kind: 'video', container: 'mp4', v: 'hevc', a: ['aac', 'opus'], note: '~40% más ligero' },
  { id: 'mp4-av1', label: 'MP4 · AV1', ext: 'mp4', kind: 'video', container: 'mp4', v: 'av1', a: ['aac', 'opus'], note: 'Máxima eficiencia' },
  { id: 'mov-h264', label: 'MOV · H.264', ext: 'mov', kind: 'video', container: 'mov', v: 'avc', a: ['aac', 'pcm-s16'], note: 'Apple / Final Cut' },
  { id: 'mov-hevc', label: 'MOV · HEVC', ext: 'mov', kind: 'video', container: 'mov', v: 'hevc', a: ['aac', 'pcm-s16'], note: 'iPhone nativo' },
  { id: 'webm-vp9', label: 'WebM · VP9', ext: 'webm', kind: 'video', container: 'webm', v: 'vp9', a: ['opus'], note: 'Web abierta' },
  { id: 'webm-av1', label: 'WebM · AV1', ext: 'webm', kind: 'video', container: 'webm', v: 'av1', a: ['opus'], note: 'Web, ultra eficiente' },
  { id: 'webm-vp8', label: 'WebM · VP8', ext: 'webm', kind: 'video', container: 'webm', v: 'vp8', a: ['opus'], note: 'Máxima compatibilidad web' },
  { id: 'mkv-h264', label: 'MKV · H.264', ext: 'mkv', kind: 'video', container: 'mkv', v: 'avc', a: ['opus', 'aac', 'flac'], note: 'Archivo / OBS' },
  { id: 'mkv-av1', label: 'MKV · AV1', ext: 'mkv', kind: 'video', container: 'mkv', v: 'av1', a: ['opus', 'flac'], note: 'Archivo eficiente' },
  { id: 'ts-h264', label: 'MPEG-TS · H.264', ext: 'ts', kind: 'video', container: 'ts', v: 'avc', a: ['aac'], note: 'Broadcast / IPTV' },
  { id: 'gif', label: 'GIF animado', ext: 'gif', kind: 'gif', note: 'Memes, stickers' },
  { id: 'mp3', label: 'MP3', ext: 'mp3', kind: 'audio', container: 'mp3', a: ['mp3'], note: 'Audio universal' },
  { id: 'm4a', label: 'M4A · AAC', ext: 'm4a', kind: 'audio', container: 'mp4', a: ['aac'], note: 'Audio Apple' },
  { id: 'aac', label: 'AAC (ADTS)', ext: 'aac', kind: 'audio', container: 'adts', a: ['aac'], note: 'Audio crudo' },
  { id: 'wav', label: 'WAV', ext: 'wav', kind: 'audio', container: 'wav', a: ['pcm-s16'], note: 'Sin pérdida' },
  { id: 'flac', label: 'FLAC', ext: 'flac', kind: 'audio', container: 'flac', a: ['flac'], note: 'Sin pérdida comprimido' },
  { id: 'ogg', label: 'OGG · Opus', ext: 'ogg', kind: 'audio', container: 'ogg', a: ['opus'], note: 'Podcast / web' },
  { id: 'png', label: 'PNG (fotograma)', ext: 'png', kind: 'image', mime: 'image/png', note: 'Miniatura / portada' },
  { id: 'jpg', label: 'JPG (fotograma)', ext: 'jpg', kind: 'image', mime: 'image/jpeg', note: 'Miniatura ligera' },
  { id: 'webp', label: 'WebP (fotograma)', ext: 'webp', kind: 'image', mime: 'image/webp', note: 'Miniatura web' },
  { id: 'srt', label: 'Subtítulos SRT', ext: 'srt', kind: 'text', note: 'Para YouTube / Vimeo' },
  { id: 'vtt', label: 'Subtítulos VTT', ext: 'vtt', kind: 'text', note: 'Web' },
];

// Ajustes de color por defecto
export const DEFAULT_COLOR = { exposure: 0, contrast: 0, saturation: 0, temp: 0, tint: 0, hue: 0, sepia: 0, blur: 0, vignette: 0, grain: 0, sharpen: 0, preset: 'none' };

// Filtros (looks). Cada uno es un conjunto de ajustes de color, editables después.
export const LOOKS = [
  { id: 'none', name: 'Original', c: {} },
  { id: 'cine', name: 'Cine', c: { contrast: 0.18, saturation: -0.12, temp: 0.12, vignette: 0.35, grain: 0.12 } },
  { id: 'tealorange', name: 'Teal & Orange', c: { contrast: 0.15, saturation: 0.2, temp: 0.28, tint: -0.1, vignette: 0.2 } },
  { id: 'vivid', name: 'Vívido', c: { saturation: 0.45, contrast: 0.12, exposure: 0.03 } },
  { id: 'moody', name: 'Moody', c: { exposure: -0.12, saturation: -0.28, temp: -0.18, contrast: 0.12, vignette: 0.45 } },
  { id: 'golden', name: 'Hora dorada', c: { temp: 0.45, saturation: 0.15, exposure: 0.05, vignette: 0.15 } },
  { id: 'cold', name: 'Ártico', c: { temp: -0.45, saturation: -0.05, contrast: 0.08 } },
  { id: 'noir', name: 'Noir B/N', c: { saturation: -1, contrast: 0.4, vignette: 0.5, grain: 0.2 } },
  { id: 'mono', name: 'B/N suave', c: { saturation: -1, contrast: 0.05 } },
  { id: 'vintage', name: 'Vintage', c: { sepia: 0.35, contrast: -0.05, temp: 0.25, vignette: 0.4, grain: 0.25 } },
  { id: 'film', name: 'Film desvaído', c: { contrast: -0.2, exposure: 0.06, sepia: 0.12, saturation: -0.1, grain: 0.18 } },
  { id: 'pastel', name: 'Pastel', c: { exposure: 0.1, contrast: -0.18, saturation: -0.12, tint: 0.1 } },
  { id: 'neon', name: 'Neón nocturno', c: { saturation: 0.6, temp: -0.35, tint: 0.25, contrast: 0.22 } },
  { id: 'vhs', name: 'Retro VHS', c: { sepia: 0.15, saturation: 0.3, blur: 0.6, grain: 0.4, contrast: 0.1 } },
  { id: 'cyber', name: 'Cyberpunk', c: { tint: 0.4, temp: -0.2, saturation: 0.4, contrast: 0.25, vignette: 0.3 } },
  { id: 'clean', name: 'Limpio (vlog)', c: { exposure: 0.06, saturation: 0.12, contrast: 0.06, sharpen: 0.3 } },
  { id: 'drama', name: 'Drama', c: { contrast: 0.45, saturation: -0.2, exposure: -0.05, vignette: 0.55 } },
  { id: 'food', name: 'Comida', c: { saturation: 0.3, temp: 0.2, exposure: 0.06, sharpen: 0.3 } },
];

export const FONTS = ['Inter', 'Montserrat', 'Poppins', 'Bebas Neue', 'Anton', 'Space Grotesk', 'Playfair Display', 'Permanent Marker', 'Pacifico', 'Bangers', 'Caveat', 'Oswald'];

export const DEFAULT_TEXT = {
  content: 'Tu texto aquí', font: 'Montserrat', weight: 800, size: 0.065, color: '#ffffff',
  stroke: '#000000', strokeW: 0, shadow: 0.5, bg: 'none', bgColor: '#000000', bgAlpha: 0.6,
  align: 'center', upper: false, italic: false, lineH: 1.15, letter: 0,
  animIn: 'pop', animOut: 'fade', highlight: '#ffd400', maxW: 0.86,
};

// Estilos de texto rápidos
export const TEXT_STYLES = [
  { id: 'impact', name: 'IMPACTO', s: { font: 'Anton', weight: 400, size: 0.09, upper: true, strokeW: 0.12, stroke: '#000', shadow: 0.6, animIn: 'pop' } },
  { id: 'tiktok', name: 'Estilo TikTok', s: { font: 'Montserrat', weight: 900, size: 0.06, bg: 'box', bgColor: '#ffffff', bgAlpha: 1, color: '#000000', shadow: 0, animIn: 'pop' } },
  { id: 'neon', name: 'Neón', s: { font: 'Bebas Neue', weight: 400, size: 0.1, color: '#5ef2ff', shadow: 1.6, animIn: 'blur', upper: true } },
  { id: 'minimal', name: 'Minimal', s: { font: 'Inter', weight: 500, size: 0.045, letter: 0.08, upper: true, shadow: 0.2, animIn: 'fade' } },
  { id: 'elegant', name: 'Elegante', s: { font: 'Playfair Display', weight: 700, size: 0.07, italic: true, shadow: 0.4, animIn: 'slide-up' } },
  { id: 'marker', name: 'Marcador', s: { font: 'Permanent Marker', weight: 400, size: 0.07, color: '#ffd400', strokeW: 0.08, stroke: '#000', animIn: 'bounce' } },
  { id: 'pill', name: 'Píldora', s: { font: 'Poppins', weight: 700, size: 0.05, bg: 'pill', bgColor: '#7c3aed', bgAlpha: 0.95, shadow: 0, animIn: 'slide-up' } },
  { id: 'comic', name: '¡Cómic!', s: { font: 'Bangers', weight: 400, size: 0.1, color: '#ffef00', strokeW: 0.14, stroke: '#e11d48', animIn: 'pop', letter: 0.03 } },
  { id: 'hand', name: 'A mano', s: { font: 'Caveat', weight: 700, size: 0.08, shadow: 0.3, animIn: 'typewriter' } },
  { id: 'lower', name: 'Rótulo (lower third)', s: { font: 'Space Grotesk', weight: 700, size: 0.04, bg: 'box', bgColor: '#0b0b12', bgAlpha: 0.85, align: 'left', animIn: 'slide-right' } },
];

// Estilos de subtítulos (se aplican a todo el track de subtítulos)
export const CAPTION_STYLES = [
  { id: 'hormozi', name: 'Viral amarillo', s: { font: 'Montserrat', weight: 900, size: 0.074, upper: true, color: '#ffffff', highlight: '#ffd400', strokeW: 0.16, stroke: '#000', shadow: 0.6, animIn: 'pop', animOut: 'none' } },
  { id: 'clean', name: 'Limpio', s: { font: 'Inter', weight: 700, size: 0.05, color: '#ffffff', highlight: '#ffffff', bg: 'box', bgColor: '#000000', bgAlpha: 0.55, shadow: 0, animIn: 'none', animOut: 'none' } },
  { id: 'green', name: 'Verde pop', s: { font: 'Poppins', weight: 800, size: 0.07, upper: true, color: '#ffffff', highlight: '#39ff88', strokeW: 0.14, stroke: '#000', animIn: 'pop', animOut: 'none' } },
  { id: 'karaoke', name: 'Karaoke', s: { font: 'Bebas Neue', weight: 400, size: 0.09, upper: true, color: '#9aa0b5', highlight: '#ffffff', shadow: 1, animIn: 'none', animOut: 'none' } },
  { id: 'box', name: 'Caja palabra', s: { font: 'Montserrat', weight: 900, size: 0.07, upper: true, color: '#ffffff', highlight: '#a855f7', hlBox: true, strokeW: 0.1, stroke: '#000', animIn: 'none', animOut: 'none' } },
];

export const TRANSITIONS = [
  { id: 'none', name: 'Corte' },
  { id: 'fade', name: 'Fundido' },
  { id: 'dip-black', name: 'A negro' },
  { id: 'dip-white', name: 'Flash blanco' },
  { id: 'slide-left', name: 'Deslizar ←' },
  { id: 'slide-up', name: 'Deslizar ↑' },
  { id: 'push', name: 'Empujar' },
  { id: 'zoom-in', name: 'Zoom in' },
  { id: 'zoom-out', name: 'Zoom out' },
  { id: 'wipe', name: 'Barrido' },
  { id: 'circle', name: 'Círculo' },
  { id: 'blur', name: 'Desenfoque' },
  { id: 'whip', name: 'Whip pan' },
  { id: 'spin', name: 'Giro' },
  { id: 'glitch', name: 'Glitch' },
];

export const ANIMS_IN = [['none', 'Ninguna'], ['fade', 'Fundido'], ['pop', 'Pop'], ['slide-up', 'Subir'], ['slide-right', 'Desde izquierda'], ['bounce', 'Rebote'], ['zoom', 'Zoom'], ['blur', 'Enfoque'], ['typewriter', 'Palabra a palabra']];
export const ANIMS_OUT = [['none', 'Ninguna'], ['fade', 'Fundido'], ['pop', 'Encoger'], ['slide-up', 'Subir'], ['blur', 'Desenfocar']];

export const MOTIONS = [['none', 'Ninguno'], ['zoom-in', 'Zoom lento in (Ken Burns)'], ['zoom-out', 'Zoom lento out'], ['pan-left', 'Paneo ←'], ['pan-right', 'Paneo →'], ['punch', 'Zoom de impacto'], ['shake', 'Temblor']];

export const GRADIENTS = [
  ['#7c3aed', '#ec4899'], ['#0ea5e9', '#22d3ee'], ['#f97316', '#facc15'], ['#111827', '#374151'],
  ['#10b981', '#3b82f6'], ['#f43f5e', '#7c3aed'], ['#000000', '#000000'], ['#ffffff', '#e5e7eb'],
];
