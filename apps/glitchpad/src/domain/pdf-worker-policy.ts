/** Applied only inside the PDF worker after compatibility/engine initialization. */
export function lockPdfWorkerDynamicCode(scope: typeof globalThis): void {
  const rejectEvaluation = function (): never {
    throw new Error('PDF dynamic code is disabled');
  };
  const nativeFunction = scope.Function;
  Object.defineProperty(rejectEvaluation, 'prototype', {
    value: nativeFunction.prototype,
  });
  // Preserve ordinary function methods while removing callable constructor paths.
  for (const prototype of [
    nativeFunction.prototype,
    Object.getPrototypeOf(async function () {}),
    Object.getPrototypeOf(function* () {}),
    Object.getPrototypeOf(async function* () {}),
  ]) {
    Object.defineProperty(prototype, 'constructor', {
      value: rejectEvaluation,
      writable: false,
      configurable: false,
    });
  }
  Object.defineProperty(scope, 'Function', {
    value: rejectEvaluation,
    writable: false,
    configurable: false,
  });
  Object.defineProperty(scope, 'eval', {
    value: rejectEvaluation,
    writable: false,
    configurable: false,
  });
  const timeout = scope.setTimeout.bind(scope),
    interval = scope.setInterval.bind(scope);
  scope.setTimeout = ((
    handler: TimerHandler,
    delay?: number,
    ...args: unknown[]
  ) => {
    if (typeof handler !== 'function') return rejectEvaluation();
    return timeout(handler, delay, ...args);
  }) as typeof setTimeout;
  scope.setInterval = ((
    handler: TimerHandler,
    delay?: number,
    ...args: unknown[]
  ) => {
    if (typeof handler !== 'function') return rejectEvaluation();
    return interval(handler, delay, ...args);
  }) as typeof setInterval;
}

/** All bytes and static resources arrive over the owner-controlled message port. */
export function lockPdfWorkerExternalResources(scope: typeof globalThis): void {
  const rejectResource = function (): never {
    throw new Error('PDF worker external resources are disabled');
  };
  for (const name of ['importScripts', 'Worker', 'SharedWorker', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'WebTransport']) {
    Object.defineProperty(scope, name, { value: rejectResource, writable: false, configurable: false });
  }
  Object.defineProperty(scope, 'fetch', {
    value: () => Promise.reject(new Error('PDF worker external resources are disabled')),
    writable: false,
    configurable: false,
  });
}
