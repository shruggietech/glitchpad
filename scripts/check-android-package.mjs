import { execFile as execFileCallback } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const execFile = promisify(execFileCallback);
const sortedUnique = (values) => [...new Set(values)].sort();
const attributeValues = (xml, name) =>
  sortedUnique(
    [...xml.matchAll(new RegExp(`android:${name}="([^"]+)"`, 'gu'))].map(
      (match) => match[1],
    ),
  );

export function parseManifestXml(xml) {
  const manifest = xml.match(/<manifest\b([^>]*)>/u)?.[1] ?? '';
  const usesSdk = xml.match(/<uses-sdk\b([^>]*)\/?\s*>/u)?.[1] ?? '';
  const application = xml.match(/<application\b([^>]*)>/u)?.[1] ?? '';
  const value = (source, name) =>
    source.match(new RegExp(`(?:android:)?${name}="([^"]+)"`, 'u'))?.[1];
  const exportedComponents = [];
  const publicComponentXml = [];
  for (const match of xml.matchAll(
    /<(activity|activity-alias|service|receiver|provider)\b([^>]*)(?:\/>|>([\s\S]*?)<\/\1\s*>)/gu,
  )) {
    const attributes = match[2];
    const isPermissionProtected = [
      'permission',
      'readPermission',
      'writePermission',
    ].some((name) => value(attributes, name));
    if (value(attributes, 'exported') === 'true' && !isPermissionProtected) {
      exportedComponents.push(value(attributes, 'name') ?? '<unnamed>');
      publicComponentXml.push(match[0]);
    }
  }
  const publicSurface = publicComponentXml.join('\n');
  const fileProviderAttributes = [...xml.matchAll(/<provider\b([^>]*)>/gu)]
    .map((match) => match[1])
    .find(
      (attributes) =>
        value(attributes, 'name') === 'androidx.core.content.FileProvider',
    );
  return {
    application_id: value(manifest, 'package'),
    version_code: Number(value(manifest, 'versionCode')),
    version_name: value(manifest, 'versionName'),
    min_sdk: Number(value(usesSdk, 'minSdkVersion')),
    target_sdk: Number(value(usesSdk, 'targetSdkVersion')),
    permissions: attributeValues(
      xml.match(/<manifest\b[\s\S]*?<application\b/u)?.[0] ?? xml,
      'name',
    ).filter((name) => name.startsWith('android.permission.')),
    actions: attributeValues(publicSurface, 'name').filter((name) =>
      name.startsWith('android.intent.action.'),
    ),
    categories: attributeValues(publicSurface, 'name').filter((name) =>
      name.startsWith('android.intent.category.'),
    ),
    schemes: attributeValues(publicSurface, 'scheme'),
    media_types: attributeValues(publicSurface, 'mimeType'),
    extensions: attributeValues(publicSurface, 'pathSuffix').map((extension) =>
      extension.replace(/^\./u, ''),
    ),
    exported_components: sortedUnique(exportedComponents),
    application_label: value(application, 'label'),
    launcher_icon: value(application, 'icon'),
    data_extraction_rules: value(application, 'dataExtractionRules'),
    full_backup_content: value(application, 'fullBackupContent'),
    file_provider: fileProviderAttributes
      ? {
          name: value(fileProviderAttributes, 'name'),
          authority: value(fileProviderAttributes, 'authorities'),
          exported: value(fileProviderAttributes, 'exported') === 'true',
          grant_uri_permissions:
            value(fileProviderAttributes, 'grantUriPermissions') === 'true',
        }
      : null,
    debuggable: value(application, 'debuggable') === 'true',
    cleartext_traffic: value(application, 'usesCleartextTraffic') === 'true',
  };
}

export function validateReleasePosture(inventory, contract) {
  const posture = contract.manifest_posture;
  if (!posture) throw new Error('Android contract has no manifest posture');
  if (inventory.debuggable || inventory.cleartext_traffic)
    throw new Error('Android package is not hardened for release');
  for (const [key, expected] of [
    ['application_label', posture.application_label],
    ['launcher_icon', posture.launcher_icon],
    ['data_extraction_rules', posture.data_extraction_rules],
    ['full_backup_content', posture.full_backup_content],
  ]) {
    const isCompiledResource =
      inventory.application_id &&
      /^@ref\/0x[0-9a-f]+$/u.test(inventory[key] ?? '');
    if (inventory[key] !== expected && !isCompiledResource)
      throw new Error(`Android ${key} posture mismatch`);
  }
  const provider = inventory.file_provider;
  const acceptedAuthorities = inventory.application_id
    ? [posture.file_provider_authority]
    : [posture.file_provider_authority, '${applicationId}.fileprovider'];
  if (
    !provider ||
    provider.name !== posture.file_provider ||
    !acceptedAuthorities.includes(provider.authority) ||
    provider.exported ||
    !provider.grant_uri_permissions
  ) {
    throw new Error('Android file provider posture mismatch');
  }
}

export function validateContract(contract) {
  if (contract.schema_version !== 1 || contract.platform !== 'android')
    throw new Error('invalid Android package contract identity');
  if (
    contract.official?.certificate_sha256_environment !==
    'ANDROID_SIGNING_CERT_SHA256'
  )
    throw new Error(
      'Android contract must bind the official certificate fingerprint',
    );
  const roles = contract.artifacts?.map(({ role }) => role).sort();
  if (
    contract.artifacts?.length !== 3 ||
    JSON.stringify(roles) !== JSON.stringify(['arm64', 'play', 'universal'])
  )
    throw new Error(
      'Android contract must define exactly three artifact roles',
    );
  if (new Set(contract.artifacts.map(({ name }) => name)).size !== 3)
    throw new Error('Android artifact names must be unique');
  return contract;
}

function assertExactSet(actual, expected, label) {
  const observed = sortedUnique(actual);
  const governed = sortedUnique(expected);
  if (JSON.stringify(observed) !== JSON.stringify(governed))
    throw new Error(
      `${label} mismatch: expected ${governed.join(', ')}, observed ${observed.join(', ')}`,
    );
}

export function validateIntentSurface(inventory, intentMap) {
  for (const permission of intentMap.forbidden_permissions)
    if (inventory.permissions.includes(permission))
      throw new Error(`forbidden Android permission: ${permission}`);
  for (const action of intentMap.forbidden_actions)
    if (inventory.actions.includes(action))
      throw new Error(`forbidden Android action: ${action}`);
  for (const scheme of intentMap.forbidden_schemes)
    if (inventory.schemes.includes(scheme))
      throw new Error(`forbidden Android scheme: ${scheme}`);
  for (const mediaType of intentMap.forbidden_media_types)
    if (inventory.media_types.includes(mediaType))
      throw new Error(`forbidden Android media type: ${mediaType}`);
  assertExactSet(inventory.actions, intentMap.actions, 'Android action');
  assertExactSet(
    inventory.categories,
    intentMap.categories,
    'Android category',
  );
  assertExactSet(inventory.schemes, intentMap.schemes, 'Android scheme');
  assertExactSet(
    inventory.media_types,
    intentMap.media_types,
    'Android media type',
  );
  assertExactSet(
    inventory.extensions,
    intentMap.extensions,
    'Android extension',
  );
  assertExactSet(
    inventory.exported_components.map((name) =>
      name === '.MainActivity'
        ? 'com.shruggietech.glitchpad.MainActivity'
        : name,
    ),
    ['com.shruggietech.glitchpad.MainActivity'],
    'Android exported component',
  );
}

export function classifyUniversalApkSize(sizeBytes, contract) {
  if (sizeBytes > contract.size_budget.universal_apk_hard_limit_bytes)
    throw new Error('universal APK exceeds the hard limit');
  return sizeBytes <= contract.size_budget.universal_apk_target_bytes
    ? 'within_target'
    : 'target_miss';
}

export function validateArtifactInventories(
  inventories,
  contract,
  intentMap,
  authority,
) {
  validateContract(contract);
  if (inventories.length !== 3)
    throw new Error(
      'Android package set must contain exactly three inventories',
    );
  const certificates = new Set();
  for (const declared of contract.artifacts) {
    const inventory = inventories.find(({ role }) => role === declared.role);
    if (!inventory || inventory.kind !== declared.kind)
      throw new Error(`missing ${declared.role} ${declared.kind} inventory`);
    assertExactSet(
      inventory.abis,
      declared.required_abis,
      `${declared.role} ABI`,
    );
    for (const abi of declared.forbidden_abis)
      if (inventory.abis.includes(abi))
        throw new Error(`forbidden ${declared.role} ABI: ${abi}`);
    for (const [key, expected] of [
      ['application_id', contract.application_id],
      ['version_name', contract.candidate_version],
      ['version_code', contract.version_code],
      ['min_sdk', contract.min_sdk],
      ['target_sdk', contract.target_sdk],
    ]) {
      if (inventory[key] !== expected)
        throw new Error(`${declared.role} ${key} mismatch`);
    }
    validateReleasePosture(inventory, contract);
    if (!/^[a-f0-9]{64}$/u.test(inventory.sha256))
      throw new Error(`${declared.role} has no final SHA-256 digest`);
    const requiredStatus =
      authority === 'official'
        ? contract.official.required_signature_status
        : contract.candidate_trust.signature_status;
    if (inventory.signature_status !== requiredStatus)
      throw new Error(`${declared.role} signature authority mismatch`);
    if (!/^[A-F0-9]{64}$/u.test(inventory.certificate_sha256))
      throw new Error(`${declared.role} certificate digest is invalid`);
    certificates.add(inventory.certificate_sha256);
    validateIntentSurface(inventory, intentMap);
    if (declared.role === 'universal')
      inventory.size_classification = classifyUniversalApkSize(
        inventory.size_bytes,
        contract,
      );
  }
  if (certificates.size !== 1)
    throw new Error('Android artifacts must share one signing certificate');
  return inventories;
}

export function validateEvidenceManifest(evidence, contract, authority) {
  if (
    evidence.schema_version !== 1 ||
    evidence.platform !== 'android' ||
    evidence.version !== contract.candidate_version
  )
    throw new Error('Android evidence identity mismatch');
  if (evidence.authority !== authority)
    throw new Error('Android evidence authority mismatch');
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(evidence.source_commit))
    throw new Error('Android evidence source commit is invalid');
  if (
    evidence.artifacts?.length !== 3 ||
    new Set(evidence.artifacts.map(({ role }) => role)).size !== 3
  )
    throw new Error('Android evidence must bind exactly three artifacts');
  for (const declared of contract.artifacts) {
    const artifact = evidence.artifacts.find(
      ({ role }) => role === declared.role,
    );
    if (
      !artifact ||
      artifact.name !== declared.name ||
      artifact.inventory !== `${declared.role}-inventory.json`
    )
      throw new Error(`Android evidence ${declared.role} binding mismatch`);
  }
  if (
    evidence.sbom !== 'glitchpad-android.cdx.json' ||
    evidence.provenance !== 'provenance.json'
  )
    throw new Error('Android evidence document binding mismatch');
  if (
    authority === 'candidate' &&
    evidence.publication_status !== contract.candidate_trust.publication_status
  )
    throw new Error(
      'candidate Android evidence must remain blocked from publication',
    );
  return evidence;
}

function normalizeCertificate(output) {
  const digest = output
    .match(/(?:SHA-256 digest:|SHA256:)\s*([A-Fa-f0-9:]{64,95})/u)?.[1]
    ?.replaceAll(':', '')
    .toUpperCase();
  if (!digest || digest.length !== 64)
    throw new Error(
      'could not read Android signing certificate SHA-256 digest',
    );
  return digest;
}

export function validateJarSignatureOutput(output) {
  if (
    /jar is unsigned|unsigned entries|not integrity-checked/iu.test(output) ||
    !/jar verified\./iu.test(output)
  )
    throw new Error('Android app bundle is not cryptographically signed');
}

export function validateSigningAuthority(
  certificateSha256,
  authority,
  contract,
  environment = process.env,
) {
  if (authority === 'candidate')
    return contract.candidate_trust.signature_status;
  if (authority !== 'official')
    throw new Error('unknown Android signing authority');
  const variable = contract.official?.certificate_sha256_environment;
  const expected = environment[variable]?.replaceAll(':', '').toUpperCase();
  if (!variable || !expected || !/^[A-F0-9]{64}$/u.test(expected))
    throw new Error(
      'trusted official Android certificate fingerprint is not provisioned',
    );
  if (certificateSha256 !== expected)
    throw new Error(
      'Android artifact certificate does not match the official signing authority',
    );
  return contract.official.required_signature_status;
}

async function run(program, arguments_) {
  const { stdout, stderr } = await execFile(program, arguments_, {
    maxBuffer: 16 * 1024 * 1024,
  });
  return `${stdout}${stderr}`;
}

async function inspectArtifact(path, declared, authority, contract) {
  const entries = (await run('unzip', ['-Z1', path]))
    .split(/\r?\n/u)
    .filter(Boolean);
  const manifestXml =
    declared.kind === 'apk'
      ? await run('apkanalyzer', ['manifest', 'print', path])
      : await run('java', [
          '-jar',
          process.env.BUNDLETOOL_JAR ?? '/opt/android/bundletool.jar',
          'dump',
          'manifest',
          `--bundle=${path}`,
          '--module=base',
        ]);
  let signatureOutput;
  if (declared.kind === 'apk') {
    const sdkRoot = process.env.ANDROID_SDK_ROOT ?? process.env.ANDROID_HOME;
    const apksigner = sdkRoot
      ? join(sdkRoot, 'build-tools', contract.build_tools_version, 'apksigner')
      : 'apksigner';
    signatureOutput = await run(apksigner, [
      'verify',
      '--verbose',
      '--print-certs',
      path,
    ]);
  } else {
    const verification = await run('jarsigner', ['-verify', path]);
    validateJarSignatureOutput(verification);
    signatureOutput = `${verification}\n${await run('keytool', ['-printcert', '-jarfile', path])}`;
  }
  const certificateSha256 = normalizeCertificate(signatureOutput);
  const facts = parseManifestXml(manifestXml);
  const abis = sortedUnique(
    entries
      .map(
        (entry) =>
          entry.match(
            /(?:^|\/)lib\/(arm64-v8a|armeabi-v7a|x86|x86_64)\//u,
          )?.[1],
      )
      .filter(Boolean),
  );
  const bytes = await readFile(path);
  return {
    ...facts,
    artifact_name: declared.name,
    role: declared.role,
    kind: declared.kind,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    size_bytes: bytes.length,
    abis,
    signature_status: validateSigningAuthority(
      certificateSha256,
      authority,
      contract,
    ),
    certificate_sha256: certificateSha256,
  };
}

function parseArguments(arguments_) {
  const values = { artifacts: [] };
  for (let index = 0; index < arguments_.length; index += 2) {
    const flag = arguments_[index];
    const value = arguments_[index + 1];
    if (!value) throw new Error(`missing value for ${flag}`);
    if (flag === '--artifact') {
      const separator = value.indexOf('=');
      values.artifacts.push({
        role: value.slice(0, separator),
        path: value.slice(separator + 1),
      });
    } else values[flag.slice(2).replaceAll('-', '_')] = value;
  }
  return values;
}

export async function verifyEvidenceFiles(
  directory,
  evidence,
  contract,
  authority,
  inventories,
) {
  for (const name of contract.official.required_evidence)
    await access(join(directory, name));
  const sums = await readFile(join(directory, 'SHA256SUMS'), 'utf8');
  const expectedSums = `${evidence.artifacts
    .map(({ sha256: digest, name }) => `${digest}  ${name}`)
    .sort()
    .join('\n')}\n`;
  if (sums !== expectedSums)
    throw new Error(
      'Android checksum file is not the exact final-artifact set',
    );
  for (const artifact of evidence.artifacts) {
    const path = join(directory, artifact.name);
    const bytes = await readFile(path);
    const observed = createHash('sha256').update(bytes).digest('hex');
    if (observed !== artifact.sha256 || bytes.length !== artifact.size_bytes)
      throw new Error(`final-byte evidence mismatch for ${artifact.name}`);
    const expectedInventory = inventories.find(
      ({ role }) => role === artifact.role,
    );
    const recordedInventory = JSON.parse(
      await readFile(join(directory, artifact.inventory), 'utf8'),
    );
    if (JSON.stringify(recordedInventory) !== JSON.stringify(expectedInventory))
      throw new Error(`inventory evidence mismatch for ${artifact.name}`);
  }
  const provenance = JSON.parse(
    await readFile(join(directory, evidence.provenance), 'utf8'),
  );
  const expectedDigests = Object.fromEntries(
    evidence.artifacts.map(({ role, sha256: digest }) => [role, digest]),
  );
  if (
    provenance.platform !== 'android' ||
    provenance.version !== evidence.version ||
    provenance.source_commit !== evidence.source_commit ||
    provenance.authority !== authority ||
    provenance.publication_status !== evidence.publication_status ||
    JSON.stringify(provenance.artifact_digests) !==
      JSON.stringify(expectedDigests)
  )
    throw new Error('Android provenance binding mismatch');
  const sbom = JSON.parse(
    await readFile(join(directory, evidence.sbom), 'utf8'),
  );
  const properties = new Map(
    sbom.metadata?.properties?.map(({ name, value }) => [name, value]),
  );
  if (
    sbom.bomFormat !== 'CycloneDX' ||
    sbom.metadata?.component?.version !== evidence.version ||
    properties.get('glitchpad:source_commit') !== evidence.source_commit
  )
    throw new Error('Android SBOM identity mismatch');
  for (const [role, digest] of Object.entries(expectedDigests))
    if (properties.get(`glitchpad:artifact:${role}:sha256`) !== digest)
      throw new Error(`Android SBOM ${role} digest mismatch`);
  for (const name of ['LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES.txt']) {
    const source =
      name === 'THIRD_PARTY_NOTICES.txt'
        ? resolve('packaging/android/THIRD_PARTY_NOTICES.txt')
        : resolve(name);
    if (
      !Buffer.from(await readFile(join(directory, name))).equals(
        Buffer.from(await readFile(source)),
      )
    )
      throw new Error(`Android ${name} evidence mismatch`);
  }
  const serialized = await Promise.all(
    contract.official.required_evidence
      .filter((name) => name.endsWith('.json'))
      .map((name) => readFile(join(directory, name), 'utf8')),
  );
  if (
    serialized.some((value) =>
      /(?:storePassword|keyPassword|ANDROID_KEY|keystore\.jks)/iu.test(value),
    )
  )
    throw new Error('Android evidence contains signing-secret material');
}

async function main() {
  const values = parseArguments(process.argv.slice(2));
  const contractPath =
    values.contract ?? 'packaging/android/package-contract.json';
  const intentPath = values.intent_map ?? 'packaging/android/intent-map.json';
  const authority = values.authority ?? 'candidate';
  const [contract, intentMap] = await Promise.all([
    readFile(resolve(contractPath), 'utf8').then(JSON.parse),
    readFile(resolve(intentPath), 'utf8').then(JSON.parse),
  ]);
  validateContract(contract);
  if (values.source_manifest) {
    const inventory = parseManifestXml(
      await readFile(resolve(values.source_manifest), 'utf8'),
    );
    validateIntentSurface(inventory, intentMap);
    validateReleasePosture(inventory, contract);
    console.log('Android source package policy passed.');
    return;
  }
  let artifacts = values.artifacts;
  if (values.directory)
    artifacts = contract.artifacts.map((declared) => ({
      role: declared.role,
      path: join(resolve(values.directory), declared.name),
    }));
  if (artifacts.length !== 3)
    throw new Error(
      'provide exactly three --artifact role=path values or --directory',
    );
  const inventories = [];
  for (const declared of contract.artifacts) {
    const supplied = artifacts.find(({ role }) => role === declared.role);
    if (!supplied) throw new Error(`missing ${declared.role} artifact path`);
    inventories.push(
      await inspectArtifact(
        resolve(supplied.path),
        declared,
        authority,
        contract,
      ),
    );
  }
  validateArtifactInventories(inventories, contract, intentMap, authority);
  const output = resolve(
    values.output ?? values.directory ?? 'artifacts/android',
  );
  await mkdir(output, { recursive: true });
  if (values.directory) {
    const evidence = JSON.parse(
      await readFile(join(output, 'android-package-manifest.json'), 'utf8'),
    );
    validateEvidenceManifest(evidence, contract, authority);
    await verifyEvidenceFiles(
      output,
      evidence,
      contract,
      authority,
      inventories,
    );
  } else {
    for (const inventory of inventories)
      await writeFile(
        join(output, `${inventory.role}-inventory.json`),
        `${JSON.stringify(inventory, null, 2)}\n`,
        'utf8',
      );
  }
  console.log(`Android package validation passed for ${authority} authority.`);
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
