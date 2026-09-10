import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

import {
  classifyUniversalApkSize,
  parseManifestXml,
  validateArtifactInventories,
  validateContract,
  validateEvidenceManifest,
  validateIntentSurface,
  validateJarSignatureOutput,
  validateReleasePosture,
  validateSigningAuthority,
  verifyEvidenceFiles,
} from './check-android-package.mjs';
import { generateAndroidSbom } from './generate-android-sbom.mjs';

const contract = {
  schema_version: 1,
  platform: 'android',
  candidate_version: '0.1.2',
  application_id: 'com.shruggietech.glitchpad',
  version_code: 1002,
  min_sdk: 24,
  target_sdk: 36,
  build_tools_version: '36.0.0',
  manifest_posture: {
    application_label: '@string/app_name',
    launcher_icon: '@mipmap/ic_launcher',
    data_extraction_rules: '@xml/backup_rules',
    full_backup_content: '@xml/backup_rules_legacy',
    file_provider: 'androidx.core.content.FileProvider',
    file_provider_authority: 'com.shruggietech.glitchpad.fileprovider',
  },
  artifacts: [
    {
      kind: 'apk',
      role: 'universal',
      name: 'universal.apk',
      required_abis: ['arm64-v8a', 'x86_64'],
      forbidden_abis: ['x86'],
    },
    {
      kind: 'apk',
      role: 'arm64',
      name: 'arm64.apk',
      required_abis: ['arm64-v8a'],
      forbidden_abis: ['x86', 'x86_64'],
    },
    {
      kind: 'aab',
      role: 'play',
      name: 'play.aab',
      required_abis: ['arm64-v8a', 'x86_64'],
      forbidden_abis: ['x86'],
    },
  ],
  size_budget: {
    universal_apk_target_bytes: 40,
    universal_apk_hard_limit_bytes: 65,
  },
  candidate_trust: {
    signature_status: 'candidate_valid',
    publication_status: 'blocked_candidate',
  },
  official: {
    certificate_sha256_environment: 'ANDROID_SIGNING_CERT_SHA256',
    required_signature_status: 'official_valid',
    required_evidence: [
      'SHA256SUMS',
      'android-package-manifest.json',
      'glitchpad-android.cdx.json',
      'provenance.json',
      'LICENSE',
      'NOTICE',
      'THIRD_PARTY_NOTICES.txt',
    ],
  },
};

const intentMap = {
  schema_version: 2,
  actions: [
    'android.intent.action.MAIN',
    'android.intent.action.SEND',
    'android.intent.action.VIEW',
  ],
  categories: [
    'android.intent.category.BROWSABLE',
    'android.intent.category.DEFAULT',
    'android.intent.category.LAUNCHER',
  ],
  schemes: ['content'],
  media_types: ['text/markdown', 'text/plain', 'text/vnd.mermaid'],
  extensions: [],
  intent_filters: [
    {
      id: 'view-exact-content',
      actions: ['android.intent.action.VIEW'],
      categories: ['android.intent.category.DEFAULT'],
      schemes: ['content'],
      authorities: [],
      media_types: ['text/markdown', 'text/plain', 'text/vnd.mermaid'],
      extensions: [],
    },
  ],
  generic_media_types: ['application/octet-stream'],
  generic_media_type_policy: 'reject_without_exact_supported_type',
  forbidden_permissions: ['android.permission.MANAGE_EXTERNAL_STORAGE'],
  forbidden_actions: ['android.intent.action.SEND_MULTIPLE'],
  forbidden_schemes: ['file'],
  forbidden_media_types: ['*/*'],
};

function inventory(role, kind, abis) {
  return {
    artifact_name: `${role}.${kind}`,
    role,
    kind,
    sha256: 'a'.repeat(64),
    size_bytes: role === 'universal' ? 39 : 20,
    application_id: contract.application_id,
    version_name: contract.candidate_version,
    version_code: contract.version_code,
    min_sdk: contract.min_sdk,
    target_sdk: contract.target_sdk,
    abis,
    permissions: ['android.permission.INTERNET'],
    actions: intentMap.actions,
    categories: intentMap.categories,
    schemes: intentMap.schemes,
    media_types: intentMap.media_types,
    extensions: intentMap.extensions,
    intent_filters: intentMap.intent_filters.map(
      ({ id: _id, ...filter }) => filter,
    ),
    exported_components: ['com.shruggietech.glitchpad.MainActivity'],
    application_label: '@string/app_name',
    launcher_icon: '@mipmap/ic_launcher',
    data_extraction_rules: '@xml/backup_rules',
    full_backup_content: '@xml/backup_rules_legacy',
    file_provider: {
      name: 'androidx.core.content.FileProvider',
      authority: 'com.shruggietech.glitchpad.fileprovider',
      exported: false,
      grant_uri_permissions: true,
    },
    debuggable: false,
    cleartext_traffic: false,
    signature_status: 'candidate_valid',
    certificate_sha256: 'B'.repeat(64),
  };
}

test('contract requires exactly the three governed artifact roles', () => {
  assert.doesNotThrow(() => validateContract(contract));
  assert.throws(
    () =>
      validateContract({
        ...contract,
        official: {
          ...contract.official,
          certificate_sha256_environment: 'UNTRUSTED_VARIABLE',
        },
      }),
    /official certificate fingerprint/u,
  );
  assert.throws(
    () =>
      validateContract({
        ...contract,
        artifacts: contract.artifacts.slice(0, 2),
      }),
    /artifact roles/u,
  );
});

test('manifest parser extracts release identity and public surface', () => {
  const parsed = parseManifestXml(
    `<?xml version="1.0"?><manifest package="com.shruggietech.glitchpad" android:versionCode="1002" android:versionName="0.1.2" xmlns:android="http://schemas.android.com/apk/res/android"><uses-sdk android:minSdkVersion="24" android:targetSdkVersion="36"/><uses-permission android:name="android.permission.INTERNET"/><application android:debuggable="false" android:usesCleartextTraffic="false"><activity android:name="com.shruggietech.glitchpad.MainActivity" android:exported="true"><intent-filter><action android:name="android.intent.action.VIEW"/><category android:name="android.intent.category.DEFAULT"/><data android:scheme="content" android:mimeType="text/markdown" android:pathSuffix=".md"/></intent-filter></activity></application></manifest>`,
  );
  assert.equal(parsed.application_id, contract.application_id);
  assert.equal(parsed.version_code, 1002);
  assert.deepEqual(parsed.permissions, ['android.permission.INTERNET']);
  assert.deepEqual(parsed.schemes, ['content']);
  assert.deepEqual(parsed.intent_filters, [
    {
      actions: ['android.intent.action.VIEW'],
      categories: ['android.intent.category.DEFAULT'],
      schemes: ['content'],
      authorities: [],
      media_types: ['text/markdown'],
      extensions: ['md'],
    },
  ]);
  assert.throws(
    () =>
      parseManifestXml(
        `<?xml version="1.0"?><manifest package="com.shruggietech.glitchpad" xmlns:android="http://schemas.android.com/apk/res/android"><application><activity android:name="com.shruggietech.glitchpad.MainActivity" android:exported="true"><intent-filter><action android:name="android.intent.action.VIEW"/><category android:name="android.intent.category.DEFAULT"/><data android:scheme="content" android:sspPrefix="opaque"/></intent-filter></activity></application></manifest>`,
      ),
    /unsupported Android intent-filter data attribute: sspPrefix/u,
  );
});

test('manifest parser excludes permission-protected exported library components', () => {
  const parsed = parseManifestXml(
    `<?xml version="1.0"?><manifest package="com.shruggietech.glitchpad" xmlns:android="http://schemas.android.com/apk/res/android"><application><activity android:name="com.shruggietech.glitchpad.MainActivity" android:exported="true"><intent-filter><action android:name="android.intent.action.VIEW"/></intent-filter></activity><receiver android:name="androidx.profileinstaller.ProfileInstallReceiver" android:permission="android.permission.DUMP" android:exported="true"><intent-filter><action android:name="androidx.profileinstaller.action.INSTALL_PROFILE"/></intent-filter></receiver></application></manifest>`,
  );
  assert.deepEqual(parsed.exported_components, [
    'com.shruggietech.glitchpad.MainActivity',
  ]);
  assert.deepEqual(parsed.actions, ['android.intent.action.VIEW']);
});

test('intent validation rejects wildcard, file scheme, broad storage, and extra exported components', () => {
  const valid = inventory('universal', 'apk', ['arm64-v8a', 'x86_64']);
  assert.doesNotThrow(() => validateIntentSurface(valid, intentMap));
  assert.throws(
    () =>
      validateIntentSurface(valid, {
        ...intentMap,
        generic_media_type_policy: 'accept_by_suffix',
      }),
    /resolver policy contract/u,
  );
  assert.throws(
    () =>
      validateIntentSurface(
        { ...valid, media_types: [...valid.media_types, '*/*'] },
        intentMap,
      ),
    /media type/u,
  );
  assert.throws(
    () =>
      validateIntentSurface(
        { ...valid, schemes: ['content', 'file'] },
        intentMap,
      ),
    /scheme/u,
  );
  assert.throws(
    () =>
      validateIntentSurface(
        {
          ...valid,
          permissions: ['android.permission.MANAGE_EXTERNAL_STORAGE'],
        },
        intentMap,
      ),
    /permission/u,
  );
  assert.throws(
    () =>
      validateIntentSurface(
        {
          ...valid,
          exported_components: [...valid.exported_components, 'BadReceiver'],
        },
        intentMap,
      ),
    /exported component/u,
  );
  assert.throws(
    () =>
      validateIntentSurface(
        {
          ...valid,
          intent_filters: valid.intent_filters.map((filter) => ({
            ...filter,
            authorities: [],
          })),
        },
        {
          ...intentMap,
          intent_filters: intentMap.intent_filters.map((filter) => ({
            ...filter,
            authorities: ['*'],
          })),
        },
      ),
    /intent-filter group/u,
  );
  assert.throws(
    () =>
      validateIntentSurface(
        {
          ...valid,
          extensions: ['md'],
          intent_filters: valid.intent_filters.map((filter) => ({
            ...filter,
            authorities: [],
            extensions: ['md'],
          })),
        },
        {
          ...intentMap,
          extensions: ['md'],
          intent_filters: intentMap.intent_filters.map((filter) => ({
            ...filter,
            authorities: [],
            extensions: ['md'],
          })),
        },
      ),
    /ignored without an authority/u,
  );
});

test('artifact inventories enforce role ABIs, identity, shared certificate, and release posture', () => {
  const inventories = [
    inventory('universal', 'apk', ['arm64-v8a', 'x86_64']),
    inventory('arm64', 'apk', ['arm64-v8a']),
    inventory('play', 'aab', ['arm64-v8a', 'x86_64']),
  ];
  assert.doesNotThrow(() =>
    validateArtifactInventories(inventories, contract, intentMap, 'candidate'),
  );
  assert.throws(
    () =>
      validateArtifactInventories(
        inventories.map((value, index) =>
          index === 1 ? { ...value, abis: ['arm64-v8a', 'x86_64'] } : value,
        ),
        contract,
        intentMap,
        'candidate',
      ),
    /ABI/u,
  );
  assert.throws(
    () =>
      validateArtifactInventories(
        inventories.map((value, index) =>
          index === 2
            ? { ...value, certificate_sha256: 'C'.repeat(64) }
            : value,
        ),
        contract,
        intentMap,
        'candidate',
      ),
    /certificate/u,
  );
});

test('app bundle signature validation rejects unsigned or ambiguous jarsigner output', () => {
  assert.doesNotThrow(() => validateJarSignatureOutput('jar verified.'));
  assert.throws(
    () => validateJarSignatureOutput('jar is unsigned.'),
    /not cryptographically signed/u,
  );
  assert.throws(
    () => validateJarSignatureOutput('verification completed'),
    /not cryptographically signed/u,
  );
  assert.throws(
    () =>
      validateJarSignatureOutput(
        'jar verified. This jar contains unsigned entries which have not been integrity-checked.',
      ),
    /not cryptographically signed/u,
  );
});

test('official signing authority requires the trusted certificate fingerprint', () => {
  const certificate = 'B'.repeat(64);
  assert.equal(
    validateSigningAuthority(certificate, 'candidate', contract, {}),
    'candidate_valid',
  );
  assert.equal(
    validateSigningAuthority(certificate, 'official', contract, {
      ANDROID_SIGNING_CERT_SHA256: certificate,
    }),
    'official_valid',
  );
  assert.throws(
    () => validateSigningAuthority(certificate, 'official', contract, {}),
    /not provisioned/u,
  );
  assert.throws(
    () =>
      validateSigningAuthority(certificate, 'official', contract, {
        ANDROID_SIGNING_CERT_SHA256: 'C'.repeat(64),
      }),
    /does not match/u,
  );
});

test('release posture requires approved resources, backup rules, and a private file provider', () => {
  const valid = inventory('universal', 'apk', ['arm64-v8a', 'x86_64']);
  assert.doesNotThrow(() => validateReleasePosture(valid, contract));
  assert.throws(
    () =>
      validateReleasePosture(
        { ...valid, file_provider: { ...valid.file_provider, exported: true } },
        contract,
      ),
    /file provider/u,
  );
  assert.throws(
    () =>
      validateReleasePosture(
        { ...valid, full_backup_content: undefined },
        contract,
      ),
    /backup_content/u,
  );
});

test('universal APK size distinguishes target, target miss, and hard rejection', () => {
  assert.equal(classifyUniversalApkSize(40, contract), 'within_target');
  assert.equal(classifyUniversalApkSize(41, contract), 'target_miss');
  assert.throws(() => classifyUniversalApkSize(66, contract), /hard limit/u);
});

test('evidence manifest binds exactly three final artifacts and candidate authority', () => {
  const evidence = {
    schema_version: 1,
    platform: 'android',
    version: '0.1.2',
    source_commit: 'a'.repeat(40),
    authority: 'candidate',
    publication_status: 'blocked_candidate',
    artifacts: contract.artifacts.map(({ role, name }) => ({
      role,
      name,
      sha256: 'a'.repeat(64),
      size_bytes: 1,
      inventory: `${role}-inventory.json`,
    })),
    sbom: 'glitchpad-android.cdx.json',
    provenance: 'provenance.json',
    generated_at: '2026-09-06T12:00:00.000Z',
  };
  assert.doesNotThrow(() =>
    validateEvidenceManifest(evidence, contract, 'candidate'),
  );
  assert.throws(
    () =>
      validateEvidenceManifest(
        { ...evidence, authority: 'official' },
        contract,
        'candidate',
      ),
    /authority/u,
  );
  assert.throws(
    () =>
      validateEvidenceManifest(
        {
          ...evidence,
          artifacts: evidence.artifacts.map((artifact, index) =>
            index === 0 ? { ...artifact, name: 'wrong.apk' } : artifact,
          ),
        },
        contract,
        'candidate',
      ),
    /binding/u,
  );
});

test('final evidence rejects extra checksums and mutated inventories', async (context) => {
  const directory = await mkdtemp(
    join(tmpdir(), 'glitchpad-android-evidence-'),
  );
  context.after(() => rm(directory, { recursive: true, force: true }));
  const inventories = contract.artifacts.map(
    ({ role, kind, required_abis: abis }) => inventory(role, kind, abis),
  );
  const artifacts = [];
  for (const [index, declared] of contract.artifacts.entries()) {
    const bytes = Buffer.from(`artifact-${declared.role}`);
    const digest = createHash('sha256').update(bytes).digest('hex');
    await writeFile(join(directory, declared.name), bytes);
    await writeFile(
      join(directory, `${declared.role}-inventory.json`),
      `${JSON.stringify(inventories[index], null, 2)}\n`,
      'utf8',
    );
    artifacts.push({
      role: declared.role,
      name: declared.name,
      sha256: digest,
      size_bytes: bytes.length,
      inventory: `${declared.role}-inventory.json`,
    });
  }
  const evidence = {
    schema_version: 1,
    platform: 'android',
    version: contract.candidate_version,
    source_commit: 'a'.repeat(40),
    authority: 'candidate',
    publication_status: 'blocked_candidate',
    artifacts,
    sbom: 'glitchpad-android.cdx.json',
    provenance: 'provenance.json',
  };
  const digests = Object.fromEntries(
    artifacts.map(({ role, sha256 }) => [role, sha256]),
  );
  const sums = `${artifacts
    .map(({ sha256, name }) => `${sha256}  ${name}`)
    .sort()
    .join('\n')}\n`;
  await writeFile(join(directory, 'SHA256SUMS'), sums, 'utf8');
  await writeFile(
    join(directory, 'android-package-manifest.json'),
    `${JSON.stringify(evidence)}\n`,
    'utf8',
  );
  await writeFile(
    join(directory, 'provenance.json'),
    `${JSON.stringify({ platform: 'android', version: contract.candidate_version, source_commit: evidence.source_commit, authority: 'candidate', publication_status: 'blocked_candidate', artifact_digests: digests })}\n`,
    'utf8',
  );
  await writeFile(
    join(directory, 'glitchpad-android.cdx.json'),
    `${JSON.stringify({ bomFormat: 'CycloneDX', metadata: { component: { version: contract.candidate_version }, properties: [{ name: 'glitchpad:source_commit', value: evidence.source_commit }, ...Object.entries(digests).map(([role, value]) => ({ name: `glitchpad:artifact:${role}:sha256`, value }))] } })}\n`,
    'utf8',
  );
  for (const name of ['LICENSE', 'NOTICE'])
    await copyFile(resolve(name), join(directory, name));
  await copyFile(
    resolve('packaging/android/THIRD_PARTY_NOTICES.txt'),
    join(directory, 'THIRD_PARTY_NOTICES.txt'),
  );

  await assert.doesNotReject(() =>
    verifyEvidenceFiles(
      directory,
      evidence,
      contract,
      'candidate',
      inventories,
    ),
  );
  await writeFile(
    join(directory, 'SHA256SUMS'),
    `${sums}${'f'.repeat(64)}  stale.apk\n`,
    'utf8',
  );
  await assert.rejects(
    () =>
      verifyEvidenceFiles(
        directory,
        evidence,
        contract,
        'candidate',
        inventories,
      ),
    /exact final-artifact set/u,
  );
  await writeFile(join(directory, 'SHA256SUMS'), sums, 'utf8');
  await writeFile(join(directory, 'universal-inventory.json'), '{}\n', 'utf8');
  await assert.rejects(
    () =>
      verifyEvidenceFiles(
        directory,
        evidence,
        contract,
        'candidate',
        inventories,
      ),
    /inventory evidence mismatch/u,
  );
});

test('Android SBOM includes Cargo, npm, and Maven runtime components deterministically', () => {
  const bom = generateAndroidSbom(
    {
      packages: [
        {
          name: 'glitchpad-core',
          version: '0.1.2',
          license: 'Apache-2.0',
          source: 'registry+https://github.com/rust-lang/crates.io-index',
        },
      ],
    },
    [{ dependencies: { react: { version: '19.1.1', license: 'MIT' } } }],
    'a'.repeat(40),
    'androidx.core:core-ktx:1.17.0\ncom.fasterxml.jackson.core:jackson-databind:2.15.3 -> 2.13.5\ncom.google.android.material:material:1.14.0\n',
    { universal: 'b'.repeat(64), arm64: 'c'.repeat(64), play: 'd'.repeat(64) },
  );
  assert.equal(bom.bomFormat, 'CycloneDX');
  assert.deepEqual(
    bom.components
      .map(({ purl }) => purl)
      .filter(Boolean)
      .sort(),
    [
      'pkg:cargo/glitchpad-core@0.1.2',
      'pkg:maven/androidx.core/core-ktx@1.17.0',
      'pkg:maven/com.fasterxml.jackson.core/jackson-databind@2.13.5',
      'pkg:maven/com.google.android.material/material@1.14.0',
      'pkg:npm/react@19.1.1',
    ],
  );
});
