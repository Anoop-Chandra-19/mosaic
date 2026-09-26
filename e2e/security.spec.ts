import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import { withApp } from './launch';

const mosaic = withApp();

test('the renderer runs with the Chromium OS sandbox enabled', async () => {
  const { app, page } = mosaic();
  const disabledSwitches = await app.evaluate(({ app }) =>
    ['no-sandbox', 'disable-seccomp-filter-sandbox', 'disable-namespace-sandbox'].filter((name) =>
      app.commandLine.hasSwitch(name)
    )
  );
  expect(disabledSwitches).toEqual([]);

  const win = await app.browserWindow(page);
  const rendererPid = await win.evaluate((win) => win.webContents.getOSProcessId());
  expect(rendererPid).toBeGreaterThan(0);
  if (process.platform === 'linux') {
    // Inspect the renderer, not main: missing Node globals alone do not prove OS sandboxing.
    const status = fs.readFileSync(`/proc/${rendererPid}/status`, 'utf8');
    expect(status).toMatch(/^NoNewPrivs:\s+1$/m);
    expect(status).toMatch(/^Seccomp:\s+2$/m);
  } else {
    // Electron exposes OS sandbox status directly on macOS and Windows.
    const sandboxed = await app.evaluate(
      ({ app }, pid) => app.getAppMetrics().find((metric) => metric.pid === pid)?.sandboxed,
      rendererPid
    );
    expect(sandboxed).toBe(true);
  }
});

test('preload is isolated from the page, which has no Node or raw IPC access', async () => {
  const { page } = mosaic();
  const session = await page.context().newCDPSession(page);
  const contexts: { id: number; name: string; auxData?: { frameId?: string } }[] = [];
  session.on('Runtime.executionContextCreated', ({ context }) => contexts.push(context));

  try {
    const { frameTree } = await session.send('Page.getFrameTree');
    await session.send('Runtime.enable');
    const preload = contexts.find(
      (context) =>
        context.name === 'Electron Isolated Context' &&
        context.auxData?.frameId === frameTree.frame.id
    );
    expect(preload, 'The main frame must have a separate preload context').toBeDefined();

    // Set a private global in the real preload context, without changing the production bridge.
    const { result, exceptionDetails } = await session.send('Runtime.evaluate', {
      contextId: preload!.id,
      expression: 'globalThis.preloadIsolationProbe = true',
      returnByValue: true,
    });
    expect(exceptionDetails).toBeUndefined();
    expect(result.value).toBe(true);

    const renderer = await page.evaluate(async () => ({
      platform: window.mosaic.platform,
      exposedGlobals: [
        'require',
        'process',
        'Buffer',
        'ipcRenderer',
        'preloadIsolationProbe',
      ].filter((name) => name in globalThis),
      rawIpc: ['invoke', 'send', 'on'].filter((name) => name in window.mosaic),
      boot: await window.mosaic.db.boot(),
    }));
    expect(renderer.platform).toBe(process.platform);
    expect(renderer.exposedGlobals).toEqual([]);
    expect(renderer.rawIpc).toEqual([]);
    expect(renderer.boot.ok).toBe(true);
  } finally {
    await session.detach();
  }
});

test('CSP blocks remote connections before they reach the network', async () => {
  const { page } = mosaic();
  const probeUrl = 'https://mosaic-csp.invalid/probe';
  const attemptedRequests: string[] = [];
  // A missing CSP must fail the test, but must not make a real external request.
  await page.context().route(probeUrl, async (route) => {
    attemptedRequests.push(route.request().url());
    await route.abort();
  });

  const connection = await page.evaluate(async (url) => {
    type Violation = { directive: string; blockedUri: string; disposition: string };
    let onViolation: (event: SecurityPolicyViolationEvent) => void;
    let timeout: ReturnType<typeof setTimeout>;
    const violation = new Promise<Violation | null>((resolve) => {
      onViolation = (event) => {
        if (event.blockedURI === url) {
          resolve({
            directive: event.effectiveDirective,
            blockedUri: event.blockedURI,
            disposition: event.disposition,
          });
        }
      };
      document.addEventListener('securitypolicyviolation', onViolation);
      timeout = setTimeout(() => resolve(null), 3_000);
    });
    try {
      const outcome = await fetch(url).then(
        () => 'reached',
        () => 'blocked'
      );
      return { outcome, violation: await violation };
    } finally {
      clearTimeout(timeout!);
      document.removeEventListener('securitypolicyviolation', onViolation!);
    }
  }, probeUrl);

  expect(connection).toEqual({
    outcome: 'blocked',
    violation: { directive: 'connect-src', blockedUri: probeUrl, disposition: 'enforce' },
  });
  expect(attemptedRequests).toEqual([]);
});
