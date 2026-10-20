import { useEffect, useState } from 'react';
import type { DevToolArgs } from '@shared/types/devTools';
import type { DevToolStep, StepOption } from '../devTool';

/**
 * A step's choices, read for the choices made before it (a template's versions). Null while
 * they load, so the list never shows another step's.
 */
export function useStepOptions(step: DevToolStep | null, args: DevToolArgs): StepOption[] | null {
  const [loaded, setLoaded] = useState<{ step: DevToolStep; options: StepOption[] } | null>(null);
  useEffect(() => {
    if (!step) return;
    let isCurrent = true;
    void step.listOptions(args).then((options) => {
      if (isCurrent) setLoaded({ step, options });
    });
    return () => {
      isCurrent = false;
    };
  }, [step, args]);
  return loaded && loaded.step === step ? loaded.options : null;
}
