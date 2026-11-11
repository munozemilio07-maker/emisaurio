import { useEffect } from 'react';
import { MapView } from './map/MapView';
import { Panel } from './features/Panel';
import { Settings } from './features/Settings';
import { Chat } from './features/Chat';
import { useStore } from './state/store';

export function App() {
  const theme = useStore((s) => s.theme);
  useEffect(() => {
    if (theme === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <div className="app">
      <MapView />
      <Panel />
      <Chat />
      <Settings />
    </div>
  );
}
