import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Supporting device commands must fail when a disconnected emulator stops responding. */
export function runBoundedAdb(args, { executable = 'adb', timeoutMs = 60_000, maxBuffer = 32 * 1024 * 1024 } = {}) {
  const result = spawnSync(executable, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    windowsHide: true,
    timeout: timeoutMs,
    killSignal: 'SIGKILL',
    maxBuffer,
  });
  return {
    ...result,
    status: result.error?.code === 'ETIMEDOUT' ? 124 : result.status ?? 1,
    stdout: result.stdout ?? Buffer.alloc(0),
    stderr: result.stderr ?? Buffer.alloc(0),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const result = runBoundedAdb(args);
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  if (result.error || result.status !== 0) {
    process.stderr.write('android_adb_command_failed=' + JSON.stringify({ operation: args.slice(0, 3), status: result.status, error_code: result.error?.code ?? null, signal: result.signal }) + '\n');
  }
  process.exitCode = result.status;
}
