import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/im-fell-english-sc/latin-400.css';
import '@fontsource/im-fell-english/latin-400.css';
import '@fontsource/im-fell-english/latin-400-italic.css';
import '@fontsource/alegreya-sans/latin-400.css';
import '@fontsource/alegreya-sans/latin-500.css';
import '@fontsource/alegreya-sans/latin-700.css';
import '@fontsource/jetbrains-mono/latin-500.css';
import '@fontsource/jetbrains-mono/latin-700.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import './styles/tokens.css';
import './styles/app.css';
import './styles/map.css';
import { App } from './App';
import { startSync } from './state/sync';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
if (!import.meta.env.VITE_ARTIFACT) startSync();
