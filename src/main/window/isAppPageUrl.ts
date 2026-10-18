/**
 * Whether a frame's URL is the app's own page: the built `index.html`, or Vite's dev server
 * during `bun run dev`. A `blob:` URL takes the origin of the page that made it, so the
 * protocol is checked too.
 */
export function isAppPageUrl(url: string, devServerUrl: string | undefined): boolean {
  const { protocol, origin } = new URL(url);
  if (protocol === 'file:') return true;
  if (devServerUrl === undefined) return false;
  const devServer = new URL(devServerUrl);
  return protocol === devServer.protocol && origin === devServer.origin;
}
