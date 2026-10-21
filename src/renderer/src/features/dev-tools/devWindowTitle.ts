/** The window's title in a development build: DEV, then what is under way, such as a load. */
export function showDevWindowTitle(underWay?: string): void {
  document.title = underWay ? `Mosaic DEV · ${underWay}` : 'Mosaic DEV';
}
