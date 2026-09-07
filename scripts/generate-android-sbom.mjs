import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateDesktopSbom } from './generate-windows-sbom.mjs';

export function parseMavenDependencies(report) {
  const dependencies = new Map();
  const pattern =
    /(?:^|\s)([A-Za-z0-9_.-]+):([A-Za-z0-9_.-]+):([A-Za-z0-9_.+\-]+)(?:\s|$)/gmu;
  for (const match of report.matchAll(pattern)) {
    const [, group, name, version] = match;
    const purl = `pkg:maven/${group}/${name}@${version}`;
    dependencies.set(purl, {
      type: 'library',
      'bom-ref': purl,
      name,
      group,
      version,
      purl,
    });
  }
  return [...dependencies.values()].sort((left, right) =>
    left.purl.localeCompare(right.purl),
  );
}

export function generateAndroidSbom(
  metadata,
  pnpmListing,
  sourceCommit,
  gradleReport,
  artifactDigests,
  { version = '0.1.0' } = {},
) {
  const base = generateDesktopSbom(metadata, pnpmListing, sourceCommit, {
    platform: 'Android',
    version,
  });
  const components = new Map(
    base.components.map((component) => [component['bom-ref'], component]),
  );
  for (const component of parseMavenDependencies(gradleReport))
    components.set(component['bom-ref'], component);
  const digestProperties = Object.entries(artifactDigests)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([role, digest]) => {
      if (!/^[a-f0-9]{64}$/u.test(digest))
        throw new Error(`Android SBOM requires a SHA-256 digest for ${role}`);
      return { name: `glitchpad:artifact:${role}:sha256`, value: digest };
    });
  return {
    ...base,
    metadata: {
      ...base.metadata,
      component: {
        type: 'application',
        name: 'Glitchpad for Android',
        version,
      },
      properties: [...base.metadata.properties, ...digestProperties],
    },
    components: [...components.values()].sort((left, right) =>
      left['bom-ref'].localeCompare(right['bom-ref']),
    ),
  };
}

async function main() {
  const [
    metadataPath,
    pnpmListingPath,
    gradleReportPath,
    digestPath,
    outputPath,
    sourceCommit,
  ] = process.argv.slice(2);
  if (
    !metadataPath ||
    !pnpmListingPath ||
    !gradleReportPath ||
    !digestPath ||
    !outputPath ||
    !sourceCommit
  ) {
    throw new Error(
      'usage: generate-android-sbom.mjs <cargo-metadata.json> <pnpm-list.json> <gradle-dependencies.txt> <artifact-digests.json> <output.json> <source-commit>',
    );
  }
  const [metadata, pnpmListing, gradleReport, artifactDigests] =
    await Promise.all([
      readFile(resolve(metadataPath), 'utf8').then(JSON.parse),
      readFile(resolve(pnpmListingPath), 'utf8').then(JSON.parse),
      readFile(resolve(gradleReportPath), 'utf8'),
      readFile(resolve(digestPath), 'utf8').then(JSON.parse),
    ]);
  const bom = generateAndroidSbom(
    metadata,
    pnpmListing,
    sourceCommit,
    gradleReport,
    artifactDigests,
  );
  await writeFile(
    resolve(outputPath),
    `${JSON.stringify(bom, null, 2)}\n`,
    'utf8',
  );
  console.log(`Wrote ${bom.components.length} Android CycloneDX components.`);
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
