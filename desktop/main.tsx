import { StrictMode, useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { GameHome } from '@/app/page';
import { GameMap } from '@/app/map/page';
import '@/app/globals.css';

function DesktopApp() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const update = () => setPath(window.location.pathname);
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);
  const navigate = useCallback((next: string) => {
    window.history.pushState({}, '', next);
    setPath(next);
  }, []);
  const replace = useCallback((next: string) => {
    window.history.replaceState({}, '', next);
    setPath(next);
  }, []);
  return path === '/map' ? <GameMap navigate={navigate} replace={replace} /> : <GameHome navigate={navigate} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DesktopApp />
  </StrictMode>,
);
