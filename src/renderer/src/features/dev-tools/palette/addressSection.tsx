import { formatViewAddress } from '@/features/view-address/formatViewAddress';
import type { ViewPlace } from '@/features/view-address/viewPlace';
import { formatShortDate } from '@shared/time/formatTime';
import type { TemplateSummary } from '@shared/types/db';
import { AddressRow } from './AddressRow';
import type { PaletteSection } from './paletteSection';
import type { AddressCheck } from './useAddressCheck';

const describeTemplate = (template: TemplateSummary) =>
  `${template.versionCount} versions, made ${formatShortDate(template.createdAt)}`;

/** A row that goes nowhere, saying why. */
function failedSection(address: string, error: string): PaletteSection {
  return {
    heading: 'Address',
    rows: [
      {
        value: 'address-error',
        onSelect: () => {},
        isDisabled: true,
        content: <AddressRow address={address} description={error} isError />,
      },
    ],
  };
}

/**
 * A pasted address, as one row that goes there; or why it can't, which goes nowhere. When
 * templates share its name, a row for each.
 */
export function buildAddressSection(
  text: string,
  check: AddressCheck,
  onGo: (place: ViewPlace, templateId?: string) => void
): PaletteSection {
  if ('error' in check) return failedSection(text.trim(), check.error);
  const { place, resolution } = check;
  const address = formatViewAddress(place);
  if (!resolution) return { heading: 'Address', rows: [], note: 'Checking…' };
  if ('error' in resolution) return failedSection(address, resolution.error);
  if ('sameName' in resolution) {
    return {
      heading: 'Address',
      note: `${resolution.sameName.length} templates have that name. Choose one.`,
      rows: resolution.sameName.map((template) => ({
        value: `address-${template.id}`,
        onSelect: () => onGo(place, template.id),
        content: <AddressRow address={address} description={describeTemplate(template)} />,
      })),
    };
  }
  return {
    heading: 'Address',
    rows: [
      {
        value: 'address',
        onSelect: () => onGo(place),
        content: <AddressRow address={address} description="Goes there." />,
      },
    ],
  };
}
