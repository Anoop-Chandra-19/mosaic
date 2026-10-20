import { ADDRESS_DIALOGS, ADDRESS_READINGS, ADDRESS_TOURS, type ViewPlace } from './viewPlace';

/** Between an address's parts. */
export const ADDRESS_SEPARATOR = ' / ';

function listAddressParts(place: ViewPlace): (string | undefined)[] {
  switch (place.kind) {
    case 'start':
      return ['start'];
    case 'editor': {
      const dialog = place.dialog ? ` + ${ADDRESS_DIALOGS[place.dialog]}` : '';
      return ['editor', `${place.template}${dialog}`];
    }
    case 'history': {
      if (!place.version) return ['history', place.template];
      const compared = place.base ? `${place.version} vs ${place.base}` : place.version;
      return [
        'history',
        place.template,
        compared,
        place.reading && ADDRESS_READINGS[place.reading],
      ];
    }
    case 'review':
      return ['review', place.template, place.suggestion ? `suggestion ${place.suggestion}` : ''];
    case 'settings':
      return ['settings', place.section];
    case 'tour':
      return ['tour', ADDRESS_TOURS[place.tour], `step ${place.step}`];
  }
}

/** "history / Tailored for Kestrel / v12 vs v11 / changes": a view in words, to read back. */
export function formatViewAddress(place: ViewPlace): string {
  return listAddressParts(place).filter(Boolean).join(ADDRESS_SEPARATOR);
}
