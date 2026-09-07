import { StrictMode, useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { GameHome } from '@/app/page';
import { GameMap } from '@/app/map/page';
import { navigationPath, currentRoute } from '@/lib/ui/desktop-route';
import '@/app/globals.css';

function DesktopApp() {
  const [path, setPath] = useState(currentRoute(window.location.pathname,window.location.hash));
  useEffect(() => {
    const update = () => setPath(currentRoute(window.location.pathname,window.location.hash));
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);
  const navigate = useCallback((next: string) => {
    window.history.pushState({}, '', navigationPath(next));
    setPath(next);
  }, []);
  const replace = useCallback((next: string) => {
    window.history.replaceState({}, '', navigationPath(next));
    setPath(next);
  }, []);
  return path === '/map' ? <GameMap navigate={navigate} replace={replace} /> : <GameHome navigate={navigate} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DesktopApp />
  </StrictMode>,
);
