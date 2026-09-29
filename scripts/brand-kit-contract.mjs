export const releasePin = Object.freeze({
  packageId: 'glitchpad-brand-1.1.1-bb2.0.3',
  archiveName: 'glitchpad-brand-1.1.1-bb2.0.3.zip',
  archiveSha256: '4cedc498d58fe6a8e7573b4c18ca97b95e27bf96c4e0eeb88712dff6545543f3',
  sourceManifestSha256: 'e32b6211e698a4ca47c8c547a5d64975e22bb623c62e8b31fcc494a7df086910',
  integratedManifestSha256: 'a6688b0d8a81aaa2e7d6a168fd5f09e8c60d24c089aa2a0ce7ee6eeb7302c217',
  sourceRevision: '115bd423f0656b6006b0719d1838da8286afb5e4',
  recoverySha256: 'f8ae954806e9797cbde8270a0660dc16dd6c4018df03f8003ca95e633efc073f',
  releaseTag: 'v2.0.3',
  releaseUrl: 'https://github.com/shruggietech/shruggie-brand/releases/tag/v2.0.3',
  brandVersion: '1.1.1',
  canonVersion: '1.3.0',
  compilerVersion: '2.0.3',
  eguiAdapterVersion: '1.0.2',
  governedFileCount: 321,
});

export const legalFileDigests = Object.freeze({
  LICENSE: 'cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30',
  'LICENSE-BRAND.md': 'bd1107a804108bbe02955ca64000945322a6fc2456b45b795dac11a253c0023a',
  NOTICE: 'd919688fd2c931500447418b628dfd0acf4d82c88d7eb392692bb629f7d0193f',
});

export const integratedCopies = [
  ['fonts/woff2/Geist-Regular.woff2', 'site/public/fonts/Geist-Regular.woff2'],
  ['fonts/woff2/Geist-Medium.woff2', 'site/public/fonts/Geist-Medium.woff2'],
  ['fonts/woff2/GeistMono-Regular.woff2', 'site/public/fonts/GeistMono-Regular.woff2'],
  ['fonts/woff2/SpaceGrotesk-Medium.woff2', 'site/public/fonts/SpaceGrotesk-Medium.woff2'],
  ['fonts/woff2/SpaceGrotesk-Bold.woff2', 'site/public/fonts/SpaceGrotesk-Bold.woff2'],
  ['fonts/licenses/OFL-Geist.txt', 'site/public/fonts/OFL-Geist.txt'],
  ['fonts/licenses/OFL-Space-Grotesk.txt', 'site/public/fonts/OFL-Space-Grotesk.txt'],
  ['logos/svg/glitchpad-horizontal-color.svg', 'site/public/logos/glitchpad-horizontal-color.svg'],
  ['logos/svg/glitchpad-horizontal-light.svg', 'site/public/logos/glitchpad-horizontal-light.svg'],
  ['logos/svg/glitchpad-horizontal-black.svg', 'site/public/logos/glitchpad-horizontal-black.svg'],
  ['logos/svg/glitchpad-horizontal-white.svg', 'site/public/logos/glitchpad-horizontal-white.svg'],
  ['logos/png/glitchpad-social-preview-1280.png', 'site/public/social-preview.png'],
  ['logos/svg/glitchpad-mark-color.svg', 'site/public/logos/glitchpad-mark-color.svg'],
  ['icons/web/favicon.svg', 'site/public/favicon.svg'],
  ['icons/web/favicon.ico', 'site/public/favicon.ico'],
  ['icons/web/favicon-16x16.png', 'site/public/favicon-16x16.png'],
  ['icons/web/favicon-32x32.png', 'site/public/favicon-32x32.png'],
  ['icons/web/apple-touch-icon.png', 'site/public/apple-touch-icon.png'],
  ['icons/web/android-chrome-192x192.png', 'site/public/android-chrome-192x192.png'],
  ['icons/web/android-chrome-512x512.png', 'site/public/android-chrome-512x512.png'],
  ['icons/web/maskable-icon-192x192.png', 'site/public/maskable-icon-192x192.png'],
  ['icons/web/maskable-icon-512x512.png', 'site/public/maskable-icon-512x512.png'],
  ['icons/web/site.webmanifest', 'site/public/site.webmanifest'],
  ['icons/web/favicon.svg', 'apps/glitchpad/public/favicon.svg'],
  ['icons/web/favicon-32x32.png', 'crates/glitchpad-host/icons/32x32.png'],
  ['icons/web/favicon-128x128.png', 'crates/glitchpad-host/icons/128x128.png'],
  ['icons/web/favicon-256x256.png', 'crates/glitchpad-host/icons/128x128@2x.png'],
  ['icons/web/favicon-512x512.png', 'crates/glitchpad-host/icons/icon.png'],
  ['icons/windows/classic/app.ico', 'crates/glitchpad-host/icons/icon.ico'],
  ['icons/apple/macos/AppIcon.icns', 'crates/glitchpad-host/icons/icon.icns'],
  ['icons/android/play-store/google-play-512.png', 'crates/glitchpad-host/icons/android/play-store/google-play-512.png'],
];

export const androidResources = [
  'drawable-nodpi/ic_launcher_foreground.png',
  'drawable-nodpi/ic_launcher_monochrome.png',
  'drawable/ic_launcher_background.xml',
  'mipmap-anydpi-v26/ic_launcher.xml',
  'mipmap-mdpi/ic_launcher.png',
  'mipmap-hdpi/ic_launcher.png',
  'mipmap-xhdpi/ic_launcher.png',
  'mipmap-xxhdpi/ic_launcher.png',
  'mipmap-xxxhdpi/ic_launcher.png',
  'values/ic_launcher_colors.xml',
];

export function isSafeBrandPath(path) {
  return (
    typeof path === 'string' &&
    path.length > 0 &&
    !path.startsWith('/') &&
    !path.includes('\\') &&
    !path.includes(':') &&
    !path.includes('\0') &&
    path.split('/').every((segment) => segment && segment !== '.' && segment !== '..')
  );
}
