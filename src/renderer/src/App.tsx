import { AppTooltipProvider } from '@/components/ui-kit';
import { useNoSelectionBehindLayers } from '@/components/useNoSelectionBehindLayers';
import { AppShell } from '@/features/shell/AppShell';
import { useScrollbarReveal } from '@/lib/scrollbarReveal';

function App() {
  useNoSelectionBehindLayers();
  useScrollbarReveal();

  return (
    <AppTooltipProvider>
      <AppShell />
    </AppTooltipProvider>
  );
}

export default App;
