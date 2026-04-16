import { useEffect } from 'react';
import { AppShell } from '@/features/shell/AppShell';

const SCROLLBAR_IDLE_MS = 900;
const SCROLL_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'PageUp',
  'PageDown',
  'Home',
  'End',
  ' ',
  'Spacebar',
]);

function App() {
  useEffect(() => {
    const root = document.documentElement;
    let hideTimeout: number | undefined;

    const clearHideTimeout = () => {
      if (hideTimeout === undefined) {
        return;
      }

      window.clearTimeout(hideTimeout);
      hideTimeout = undefined;
    };

    const activateScrollbar = () => {
      root.dataset.scrollbarActive = 'true';
      clearHideTimeout();
      hideTimeout = window.setTimeout(() => {
        root.removeAttribute('data-scrollbar-active');
        hideTimeout = undefined;
      }, SCROLLBAR_IDLE_MS);
    };

    const handleKeydown = (event: KeyboardEvent) => {
      if (SCROLL_KEYS.has(event.key)) {
        activateScrollbar();
      }
    };

    window.addEventListener('scroll', activateScrollbar, { capture: true, passive: true });
    window.addEventListener('wheel', activateScrollbar, { passive: true });
    window.addEventListener('touchmove', activateScrollbar, { passive: true });
    window.addEventListener('keydown', handleKeydown);

    return () => {
      clearHideTimeout();
      root.removeAttribute('data-scrollbar-active');
      window.removeEventListener('scroll', activateScrollbar, true);
      window.removeEventListener('wheel', activateScrollbar);
      window.removeEventListener('touchmove', activateScrollbar);
      window.removeEventListener('keydown', handleKeydown);
    };
  }, []);

  return <AppShell />;
}

export default App;
