import { contextBridge } from 'electron';

// The only door between the sandboxed renderer and the main process. Storage (`db`)
// and secrets arrive in later PRs as narrow, typed methods — never raw IPC or Node.
contextBridge.exposeInMainWorld('mosaic', {
  platform: process.platform,
});
