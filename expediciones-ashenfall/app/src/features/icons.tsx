import type { Kind } from '../types';
import { KIND_COLOR } from '../data';

const PATHS: Record<Kind, string> = {
  cofre: 'M3 10a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8H3zM3 12h18M12 11v3',
  lore: 'M6 4h10a2 2 0 0 1 2 2v14H8a2 2 0 0 1-2-2zM6 18a2 2 0 0 1 2-2h10M10 8h5M10 11h5',
  mision: 'M12 4v10M12 18v.5',
  vault: 'M5 21V10a7 7 0 0 1 14 0v11zM12 3v18M9 14h.5M14.5 14h.5',
  jefe: 'M12 3a7 7 0 0 0-7 7c0 2.6 1.3 4.4 3 5.5V19h8v-3.5c1.7-1.1 3-2.9 3-5.5a7 7 0 0 0-7-7zM9.5 11h.5M14 11h.5M10.5 19v-2M13.5 19v-2',
  secreto: 'M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  npc: 'M12 4a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM5 20c.6-3.6 3.4-6 7-6s6.4 2.4 7 6',
  viaje: 'M12 2l6 10-6 10-6-10zM6 12h12',
};

export function KindIcon({ kind, size = 16 }: { kind: Kind; size?: number }) {
  return (
    <svg className="kind-icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" style={{ color: KIND_COLOR[kind] }}>
      <path d={PATHS[kind]} fill="none" stroke="currentColor" strokeWidth={kind === 'mision' ? 3 : 1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Compass({ size = 44 }: { size?: number }) {
  return (
    <svg className="compass" viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <circle cx="32" cy="32" r="29" fill="none" stroke="currentColor" strokeWidth="1" opacity=".55" />
      <circle cx="32" cy="32" r="24" fill="none" stroke="currentColor" strokeWidth=".6" strokeDasharray="1 3" opacity=".7" />
      <path d="M32 4l5 23 23 5-23 5-5 23-5-23-23-5 23-5z" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M32 4l5 23H27z" fill="var(--accent)" />
      <path d="M32 60l-5-23h10z" fill="currentColor" opacity=".35" />
      <path d="M14 14l11 8M50 14l-11 8M14 50l11-8M50 50l-11-8" stroke="currentColor" strokeWidth=".8" opacity=".6" />
      <circle cx="32" cy="32" r="2.2" fill="currentColor" />
    </svg>
  );
}

const I = (d: string) => ({ size = 18 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
    <path d={d} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
export const IconBack = I('M15 5l-7 7 7 7');
export const IconNext = I('M9 5l7 7-7 7');
export const IconClose = I('M6 6l12 12M18 6L6 18');
export const IconGear = I('M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14.200 3h-4.400l-.4 2.600a7 7 0 0 0-2 1.200l-2.300-.9-2 3.400 2 1.500a7 7 0 0 0 0 2.400l-2 1.500 2 3.400 2.300-.9a7 7 0 0 0 2 1.200l.4 2.600h4.400l.4-2.600a7 7 0 0 0 2-1.200l2.300.9 2-3.400-2-1.500c.07-.4.1-.8.1-1.200z');
export const IconChat = I('M4 5h16v11H9l-5 4z');
export const IconSearch = I('M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM16 16l4.500 4.500');
export const IconLink = I('M14 4h6v6M20 4l-9 9M18 14v6H4V6h6');
export const IconSend = I('M4 12l16-8-6 16-3-7z');
export const IconTarget = I('M12 3v3M12 18v3M3 12h3M18 12h3M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z');
