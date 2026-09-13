import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { BootFailure } from '@/features/shell/BootFailure';
import { getDb } from '@/lib/storage/mosaicDb';
import { hydrateStores } from '@/stores/hydrateStores';

const root = createRoot(document.getElementById('root')!);

// Nothing renders until the stores hold what is on disk, so the first paint is the real one.
getDb()
  .boot()
  .then((boot) => {
    hydrateStores(boot);
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
