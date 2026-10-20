import { useEffect, useState } from 'react';
import { looksLikeViewAddress, parseViewAddress } from '@/features/view-address/parseViewAddress';
import type { Resolution } from '@/features/view-address/resolveViewPlace';
import { checkViewPlace } from '@/features/view-address/viewAddress';
import type { ViewPlace } from '@/features/view-address/viewPlace';

/** A typed address: what it says, and whether that view exists (undefined while checking). */
export type AddressCheck =
  | { error: string }
  | { place: ViewPlace; resolution: Resolution | undefined };

function readAddress(text: string) {
  return looksLikeViewAddress(text) ? parseViewAddress(text) : null;
}

/** Null for typing that isn't an address, which the palette searches its tools for instead. */
export function useAddressCheck(text: string): AddressCheck | null {
  const [checked, setChecked] = useState<{ text: string; resolution: Resolution } | null>(null);
  useEffect(() => {
    const parsed = readAddress(text);
    if (!parsed || 'error' in parsed) return;
    let isCurrent = true;
    void checkViewPlace(parsed.place).then((resolution) => {
      if (isCurrent) setChecked({ text, resolution });
    });
    return () => {
      isCurrent = false;
    };
  }, [text]);
  const parsed = readAddress(text);
  if (!parsed) return null;
  if ('error' in parsed) return parsed;
  return {
    place: parsed.place,
    resolution: checked?.text === text ? checked.resolution : undefined,
  };
}
