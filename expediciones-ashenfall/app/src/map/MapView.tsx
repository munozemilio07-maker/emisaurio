import { useEffect, useMemo, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MapContainer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet/dist/leaflet.css';
import { ALL, BY_ID, KIND_COLOR, TILES, search } from '../data';
import type { LayerId, Stop } from '../types';
import { activeLayer, currentRoute, routeStops, useStore, type Route } from '../state/store';
import { ASHENFALL_CRS, WORLD_BOUNDS } from './crs';
import { StopCard } from '../features/StopCard';
import superTiles from '../data/supertiles.json';

const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Vista previa (Artifact): hay un tope de archivos, así que el detalle fino va en
 * "supertiles" de 2048 px (8×8 tiles de z6 cosidos) en vez de miles de tiles sueltos.
 */
const SUPER = import.meta.env.VITE_ARTIFACT ? (superTiles as Record<string, string[]>) : null;
function makeSuper(id: LayerId, z: 4 | 6, opts: L.TileLayerOptions) {
  const have = new Set(SUPER?.[`${id}/s${z}`] ?? []);
  const layer = L.tileLayer('', {
    tileSize: 2048, zoomOffset: -3, minNativeZoom: z, maxNativeZoom: z, minZoom: z === 6 ? 4.5 : TILES.minZoom, maxZoom: TILES.maxZoom + 1,
    noWrap: true, bounds: WORLD_BOUNDS, keepBuffer: 0, errorTileUrl: BLANK, ...opts,
  });
  layer.getTileUrl = (c: L.Coords) => (have.has(`${c.x}/${c.y}`) ? `${import.meta.env.BASE_URL}tiles/${id}/s${z}/${c.x}/${c.y}.webp` : BLANK);
  return layer;
}

/** TileLayer que solo pide los tiles que existen según el manifiesto (sin 404 ni tiles vacíos). */
function makeTiles(id: LayerId, opts: L.TileLayerOptions) {
  const table = TILES.layers[id]?.tiles ?? {};
  const layer = L.tileLayer('', {
    tileSize: 256, minZoom: TILES.minZoom, maxNativeZoom: TILES.maxZoom, maxZoom: TILES.maxZoom + 1,
    noWrap: true, bounds: WORLD_BOUNDS, keepBuffer: 3, errorTileUrl: BLANK, ...opts,
  });
  layer.getTileUrl = (c: L.Coords) =>
    table[c.z]?.[c.x]?.includes(c.y) ? `${import.meta.env.BASE_URL}tiles/${id}/${c.z}/${c.x}/${c.y}.webp` : BLANK;
  return layer;
}

/** La ruta activa como texto estable (los selectores de zustand no deben crear objetos nuevos). */
const routeKeyOf = (s: Parameters<typeof currentRoute>[0]) => {
  const r = currentRoute(s);
  return r.type === 'exp' ? `e:${r.number}` : `q:${r.key}`;
};
const parseRouteKey = (k: string): Route =>
  k.startsWith('e:') ? { type: 'exp', number: Number(k.slice(2)) } : { type: 'quest', key: k.slice(2) };

/** Espacio que tapa el panel (izquierda en escritorio, abajo en móvil). */
function panelPadding(): { tl: L.PointExpression; br: L.PointExpression } {
  const el = document.querySelector<HTMLElement>('[data-panel]');
  const m = 36;
  if (!el) return { tl: [m, m], br: [m, m] };
  const r = el.getBoundingClientRect();
  const wide = window.matchMedia('(min-width: 900px)').matches;
  return wide ? { tl: [r.right + m, m + 20], br: [m + 30, m] } : { tl: [m, m + 30], br: [m, Math.max(m, window.innerHeight - r.top + 20)] };
}

function Layers() {
  const map = useMap();
  const layer = useStore(activeLayer);
  const refs = useRef<{ surface: L.Layer; dowdun: L.Layer } | null>(null);

  useEffect(() => {
    // Base borrosa (zoom 4, siempre precacheada): el mapa nunca queda en negro
    // mientras cargan los tiles nítidos, ni sin conexión.
    const base = (SUPER
      ? makeSuper('surface', 4, { className: 'tiles-surface', zIndex: 0 })
      : makeTiles('surface', { className: 'tiles-surface', zIndex: 0, maxNativeZoom: 4, keepBuffer: 1 })).addTo(map);
    const surface = (SUPER
      ? makeSuper('surface', 6, { className: 'tiles-surface', zIndex: 1 })
      : makeTiles('surface', { className: 'tiles-surface', zIndex: 1 })).addTo(map);
    const dowdun = SUPER
      ? L.layerGroup([makeSuper('dowdun', 4, { zIndex: 2 }), makeSuper('dowdun', 6, { zIndex: 3 })])
      : makeTiles('dowdun', { className: 'tiles-dowdun', zIndex: 2 });
    refs.current = { surface, dowdun };
    return () => { base.remove(); surface.remove(); dowdun.remove(); };
  }, [map]);

  useEffect(() => {
    const r = refs.current;
    if (!r) return;
    const under = layer === 'dowdun';
    map.getContainer().classList.toggle('is-underground', under);
    if (under) r.dowdun.addTo(map); else r.dowdun.remove();
  }, [map, layer]);
  return null;
}

/** Todas las demás paradas del mapa, tenues: el "atlas" de fondo. */
function Atlas() {
  const map = useMap();
  const routeKey = useStore(routeKeyOf);
  const route = useMemo(() => parseRouteKey(routeKey), [routeKey]);
  const layer = useStore(activeLayer);
  const done = useStore((s) => s.done);
  const hideDone = useStore((s) => s.hideDone);
  const kinds = useStore((s) => s.kinds);
  const tab = useStore((s) => s.tab);
  const query = useStore((s) => s.query);
  const pendingOnly = useStore((s) => s.pendingOnly);
  const renderer = useMemo(() => L.canvas({ padding: 0.3, tolerance: 6 }), []);

  useEffect(() => {
    const group = L.layerGroup().addTo(map);
    const inRoute = new Set(routeStops(route).map((s) => s.markerId));
    const searching = tab === 'search' && (query.trim() !== '' || kinds.length > 0 || pendingOnly);
    const hits = searching ? new Set(search({ text: query, kinds, pending: pendingOnly, done }).map((l) => l.stop.markerId)) : null;
    for (const { stop, exp } of ALL) {
      if (stop.layer !== layer) continue;
      const isDone = !!done[stop.markerId];
      const hit = hits?.has(stop.markerId) ?? false;
      if (inRoute.has(stop.markerId) && !hit) continue;
      if (!hits && kinds.length && !kinds.includes(stop.kind)) continue;
      if (hideDone && isDone && !hit) continue;
      const m = L.circleMarker([stop.lat, stop.lng], {
        renderer, radius: hit ? 6.5 : 3.6, weight: hit ? 2 : 1, color: '#0c0a07',
        fillColor: KIND_COLOR[stop.kind],
        fillOpacity: hits ? (hit ? 1 : 0.12) : isDone ? 0.22 : 0.62,
        opacity: hits ? (hit ? 1 : 0.15) : isDone ? 0.3 : 0.8,
      });
      m.bindTooltip(`${stop.title} · Exp. ${exp.number}`, { direction: 'top', offset: [0, -4], className: 'tip' });
      m.on('click', (e) => { L.DomEvent.stopPropagation(e); useStore.getState().select(stop.markerId, { fromMap: true }); });
      group.addLayer(m);
    }
    return () => { group.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, routeKey, layer, done, hideDone, kinds, tab, query, pendingOnly, renderer]);
  return null;
}

function pinIcon(n: number, s: Stop, isDone: boolean, selected: boolean) {
  return L.divIcon({
    className: '',
    iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -14],
    html: `<div class="pin${isDone ? ' is-done' : ''}${selected ? ' is-sel' : ''}" style="--k:${KIND_COLOR[s.kind]}"><span>${isDone ? '✓' : n}</span></div>`,
  });
}

/** La ruta activa: línea que se dibuja, pines numerados y clustering de los amontonados. */
function RouteLayer() {
  const map = useMap();
  const routeKey = useStore(routeKeyOf);
  const route = useMemo(() => parseRouteKey(routeKey), [routeKey]);
  const layer = useStore(activeLayer);
  const done = useStore((s) => s.done);
  const hideDone = useStore((s) => s.hideDone);
  const kinds = useStore((s) => s.kinds);
  const selected = useStore((s) => s.selected);
  const focus = useStore((s) => s.focus);
  const fit = useStore((s) => s.fit);
  const popup = useRef<{ p: L.Popup; root: Root; el: HTMLDivElement } | null>(null);
  const drawn = useRef('');

  // Popup con una tarjeta de React (se crea una sola vez)
  useEffect(() => {
    const el = document.createElement('div');
    const root = createRoot(el);
    const p = L.popup({ className: 'stop-popup', maxWidth: 300, minWidth: 230, autoPan: false, closeButton: true });
    p.setContent(el);
    popup.current = { p, root, el };
    const onClose = (e: L.PopupEvent) => { if (e.popup === p) useStore.getState().clearSelection(); };
    map.on('popupclose', onClose);
    return () => { map.off('popupclose', onClose); p.remove(); setTimeout(() => root.unmount()); };
  }, [map]);

  // Línea + pines
  useEffect(() => {
    const stops = routeStops(route);
    const visible = stops
      .map((s, i) => ({ s, n: i + 1 }))
      .filter(({ s }) => s.layer === layer);
    const pts = visible.map(({ s }) => L.latLng(s.lat, s.lng));
    const animate = drawn.current !== routeKey + layer && !reducedMotion();
    drawn.current = routeKey + layer;

    const ink = L.polyline(pts, { className: `route-ink${animate ? ' is-drawing' : ''}`, interactive: false }).addTo(map);
    const dash = L.polyline(pts, { className: `route-dash${animate ? ' is-drawing' : ''}`, interactive: false }).addTo(map);
    ink.getElement()?.setAttribute('pathLength', '1');

    const group = L.markerClusterGroup({
      maxClusterRadius: 20, showCoverageOnHover: false, spiderfyOnMaxZoom: true, spiderfyDistanceMultiplier: 1.6,
      zoomToBoundsOnClick: true, animate: !reducedMotion(), chunkedLoading: false,
      iconCreateFunction: (c) => L.divIcon({
        className: '', iconSize: [38, 38], iconAnchor: [19, 19],
        html: `<div class="pin-cluster"><span>${c.getChildCount()}</span></div>`,
      }),
    });
    let loose: L.Marker | null = null;
    for (const { s, n } of visible) {
      const isDone = !!done[s.markerId];
      if (hideDone && isDone && s.markerId !== selected) continue;
      if (kinds.length && !kinds.includes(s.kind) && s.markerId !== selected) continue;
      const m = L.marker([s.lat, s.lng], {
        icon: pinIcon(n, s, isDone, s.markerId === selected), title: `${n}. ${s.title}`,
        zIndexOffset: s.markerId === selected ? 1000 : isDone ? -200 : 0, keyboard: false,
      });
      m.on('click', () => useStore.getState().select(s.markerId, { fromMap: true, fly: false }));
      // El pin seleccionado nunca se agrupa: siempre queda a la vista
      if (s.markerId === selected) { m.addTo(map); loose = m; } else group.addLayer(m);
    }
    group.addTo(map);
    return () => { ink.remove(); dash.remove(); group.remove(); loose?.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, routeKey, layer, done, hideDone, kinds, selected]);

  // Popup de la parada seleccionada
  useEffect(() => {
    const pp = popup.current;
    if (!pp) return;
    if (!selected) { if (pp.p.isOpen()) pp.p.close(); return; }
    const loc = BY_ID.get(selected);
    if (!loc) return;
    pp.root.render(<StopCard id={selected} />);
    pp.p.setLatLng([loc.stop.lat, loc.stop.lng]);
    if (!pp.p.isOpen()) pp.p.openOn(map);
  }, [map, selected, layer]);

  // Volar a una parada
  useEffect(() => {
    if (!focus) return;
    const loc = BY_ID.get(focus.id);
    if (!loc) return;
    const z = Math.max(map.getZoom(), 5.5);
    const pad = panelPadding();
    const tl = L.point(pad.tl), br = L.point(pad.br);
    // desplaza el centro para que la parada quede en la zona visible
    // …y un poco por debajo del centro, para que quepa la ficha encima
    const lift = Math.min(110, map.getSize().y * 0.14);
    const target = map.unproject(map.project([loc.stop.lat, loc.stop.lng], z).subtract(tl.subtract(br).divideBy(2)).subtract([0, lift]), z);
    if (reducedMotion()) map.setView(target, z, { animate: false });
    else map.flyTo(target, z, { duration: 0.7 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, focus?.n]);

  // Centrar la ruta
  useEffect(() => {
    const stops = routeStops(currentRoute(useStore.getState())).filter((s) => s.layer === activeLayer(useStore.getState()));
    if (!stops.length) return;
    const pad = panelPadding();
    const b = L.latLngBounds(stops.map((s) => [s.lat, s.lng] as [number, number]));
    map.fitBounds(b, { paddingTopLeft: pad.tl, paddingBottomRight: pad.br, maxZoom: 5.5, animate: !reducedMotion() && fit > 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, fit]);

  return null;
}

function Controls() {
  const map = useMap();
  const layer = useStore(activeLayer);
  const set = useStore((s) => s.set);
  return (
    <div className="map-controls" onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
      <button type="button" aria-label="Acercar" onClick={() => map.zoomIn()}>+</button>
      <button type="button" aria-label="Alejar" onClick={() => map.zoomOut()}>−</button>
      <button type="button" aria-label="Centrar la ruta" title="Centrar la ruta" onClick={() => set({ fit: useStore.getState().fit + 1 })}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
      </button>
      <button
        type="button" className={`layer-toggle${layer === 'dowdun' ? ' is-on' : ''}`} aria-pressed={layer === 'dowdun'}
        title="Cambiar entre la superficie y el subterráneo de Dowdun"
        onClick={() => set({ layerMode: layer === 'dowdun' ? 'surface' : 'dowdun', selected: null })}
      >
        {layer === 'dowdun' ? 'Subterráneo' : 'Superficie'}
      </button>
    </div>
  );
}

export function MapView() {
  return (
    <MapContainer
      className="map" crs={ASHENFALL_CRS} center={[50000, 145000]} zoom={2}
      minZoom={1} maxZoom={7} zoomSnap={0.25} zoomDelta={0.5} wheelPxPerZoomLevel={90}
      zoomControl={false} attributionControl={false}
      maxBounds={WORLD_BOUNDS.pad(0.25)} maxBoundsViscosity={0.7}
    >
      <Layers />
      <Atlas />
      <RouteLayer />
      <Controls />
    </MapContainer>
  );
}
