import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/im-fell-english-sc/400.css';
import '@fontsource/im-fell-english/400.css';
import '@fontsource/im-fell-english/400-italic.css';
import '@fontsource/alegreya-sans/400.css';
import '@fontsource/alegreya-sans/500.css';
import '@fontsource/alegreya-sans/700.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/700.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import './styles/tokens.css';
import './styles/app.css';
import './styles/map.css';
import { App } from './App';
import { startSync } from './state/sync';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
startSync();
