import { invoke } from '@tauri-apps/api/core';
export interface ApplicationInfo {
  package_identifier: string;
  version: string;
  version_code: number | null;
  channel: string;
  platform: string;
  build_commit: string | null;
}
export function applicationInfo(value: unknown): ApplicationInfo {
  if (!value || typeof value !== 'object')
    throw new Error('Installed application information is unavailable');
  const r = value as Record<string, unknown>;
  for (const k of ['package_identifier', 'version', 'channel', 'platform'])
    if (typeof r[k] !== 'string' || !r[k])
      throw new Error('Invalid installed application information');
  if (
    r.version_code !== null &&
    (!Number.isSafeInteger(r.version_code) || Number(r.version_code) < 0)
  )
    throw new Error('Invalid package version code');
  if (r.build_commit !== null && typeof r.build_commit !== 'string')
    throw new Error('Invalid native build identity');
  return r as unknown as ApplicationInfo;
}
export interface ApplicationInfoGateway {
  info(): Promise<ApplicationInfo>;
  notices(): Promise<string>;
}
export const nativeApplicationInfoGateway: ApplicationInfoGateway = {
  info: async () => applicationInfo(await invoke<unknown>('application_info')),
  notices: () => invoke<string>('application_notices'),
};
export const applicationDestinations = [
  { label: 'Official documentation', target: 'https://glitchpad.com/docs' },
  {
    label: 'GitHub repository',
    target: 'https://github.com/ShruggieTech/glitchpad',
  },
  {
    label: 'Report an issue',
    target: 'https://github.com/ShruggieTech/glitchpad/issues/new/choose',
  },
  { label: 'ShruggieTech', target: 'https://shruggie.tech/' },
] as const;
