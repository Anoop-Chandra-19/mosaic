import { useEffect } from 'react';
import { devService } from '../devService';
import { useDevToolsStore } from '../devToolsStore';
import { formatDevWindowTitle } from './devSwitches';
import { showMeasuredBoxOutlines } from './outlineMeasuredBoxes';
import { keepViewForReopen, reopenLastView } from './reopenView';

let keptSwitchesLoad: Promise<void> | null = null;

/**
 * The switches main kept, once a launch: the view to reopen is gone to before the
 * switches are on, so keeping the view starts from there and not from the view launched on.
 */
function loadKeptSwitches(): Promise<void> {
  keptSwitchesLoad ??= (async () => {
    const switches = await devService.readSwitches();
    if (!switches) return;
    if (switches.reopenView) await reopenLastView();
    useDevToolsStore.setState({ switches });
  })();
  return keptSwitchesLoad;
}

/**
 * What the switches do in the page, and the window's title saying which are on. Slow and
 * reduced motion are main's to apply.
 */
export function useDevSwitches(): void {
  const switches = useDevToolsStore((s) => s.switches);
  const underWay = useDevToolsStore((s) => s.underWay);

  useEffect(() => {
    void loadKeptSwitches();
  }, []);
  useEffect(() => {
    document.title = formatDevWindowTitle(switches, underWay);
  }, [switches, underWay]);
  useEffect(() => showMeasuredBoxOutlines(switches.outlineBoxes), [switches.outlineBoxes]);
  useEffect(() => (switches.reopenView ? keepViewForReopen() : undefined), [switches.reopenView]);
}
