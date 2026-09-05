import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const npmPurl = (name, version) => `pkg:npm/${encodeURIComponent(name)}@${encodeURIComponent(version)}`;

export function generateWindowsSbom(metadata, pnpmListing) {
  const components = new Map();
  for (const { name, version, source, license } of metadata.packages) {
    const reference = `pkg:cargo/${encodeURIComponent(name)}@${encodeURIComponent(version)}`;
    components.set(reference, {
      type: 'library',
      'bom-ref': reference,
      name,
      version,
      ...(license ? { licenses: [{ expression: license }] } : {}),
      ...(source ? { purl: reference } : {}),
    });
  }

  const visitDependencies = (dependencies = {}) => {
    for (const [name, dependency] of Object.entries(dependencies)) {
      if (!dependency || typeof dependency.version !== 'string') continue;
      const reference = npmPurl(name, dependency.version);
      components.set(reference, {
        type: 'library',
        'bom-ref': reference,
        name,
        version: dependency.version,
        purl: reference,
        ...(dependency.license ? { licenses: [{ expression: dependency.license }] } : {}),
      });
      visitDependencies(dependency.dependencies);
      visitDependencies(dependency.optionalDependencies);
    }
  };
  for (const workspace of Array.isArray(pnpmListing) ? pnpmListing : [pnpmListing]) {
    visitDependencies(workspace?.dependencies);
    visitDependencies(workspace?.optionalDependencies);
  }

  return {
    bomFormat: 'CycloneDX',
    specVersion: '1.6',
    version: 1,
    metadata: {
      component: {
        type: 'application',
        name: 'Glitchpad for Windows',
        version: '0.1.0',
      },
    },
    components: [...components.values()].sort((left, right) => left['bom-ref'].localeCompare(right['bom-ref'])),
  };
}

async function main() {
  const [metadataPath, pnpmListingPath, outputPath] = process.argv.slice(2);
  if (!metadataPath || !pnpmListingPath || !outputPath) {
    throw new Error('usage: generate-windows-sbom.mjs <cargo-metadata.json> <pnpm-list.json> <output.json>');
  }
  const [metadata, pnpmListing] = await Promise.all([
    readFile(resolve(metadataPath), 'utf8').then(JSON.parse),
    readFile(resolve(pnpmListingPath), 'utf8').then(JSON.parse),
  ]);
  const bom = generateWindowsSbom(metadata, pnpmListing);
  await writeFile(resolve(outputPath), `${JSON.stringify(bom, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${bom.components.length} CycloneDX components.`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
