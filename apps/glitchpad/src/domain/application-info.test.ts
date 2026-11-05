import { expect, it } from 'vitest';
import { applicationInfo } from './application-info';
it('accepts native installed facts and preserves unavailable build identity', () => {
  expect(
    applicationInfo({
      package_identifier: 'com.shruggietech.glitchpad',
      version: '0.2.0',
      version_code: 2000,
      channel: 'debug',
      platform: 'android',
      build_commit: null,
    }),
  ).toEqual({
    package_identifier: 'com.shruggietech.glitchpad',
    version: '0.2.0',
    version_code: 2000,
    channel: 'debug',
    platform: 'android',
    build_commit: null,
  });
});
it('rejects missing or invented package facts instead of substituting frontend metadata', () => {
  expect(() => applicationInfo({ version: '0.2.0' })).toThrow();
  expect(() =>
    applicationInfo({
      package_identifier: 'app',
      version: '0.2.0',
      version_code: -1,
      channel: 'release',
      platform: 'android',
      build_commit: null,
    }),
  ).toThrow();
});
