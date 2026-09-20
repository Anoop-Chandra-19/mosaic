import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { BootFailure } from '@/features/shell/BootFailure';
import { getDb } from '@/lib/storage/mosaicDb';
import { hydrateStores } from '@/stores/hydrateStores';
import { useTemplateStore } from '@/stores/templateStore';

const root = createRoot(document.getElementById('root')!);

// Nothing renders until the stores hold what is on disk, so the first paint is the real one.
getDb()
  .boot()
  .then((boot) => {
    hydrateStores(boot);
    // On the way out, the draft is saved and then kept as a version: undo does not survive
    // quitting, so this is the only record left of an editing session nobody named.
    window.mosaic.app.onFlushRequest(() => useTemplateStore.getState().snapshotOpenDraft());
    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  })
  .catch((error: unknown) => {
    console.error(error);
    root.render(<BootFailure message={(error as Error).message} />);
  });
