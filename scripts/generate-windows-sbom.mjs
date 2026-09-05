import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const [metadataPath, outputPath] = process.argv.slice(2);
if (!metadataPath || !outputPath) {
  throw new Error('usage: generate-windows-sbom.mjs <cargo-metadata.json> <output.json>');
}

const metadata = JSON.parse(await readFile(resolve(metadataPath), 'utf8'));
const components = metadata.packages
  .map(({ name, version, source, license }) => ({
    type: 'library',
    'bom-ref': `pkg:cargo/${encodeURIComponent(name)}@${encodeURIComponent(version)}`,
    name,
    version,
    ...(license ? { licenses: [{ expression: license }] } : {}),
    ...(source ? { purl: `pkg:cargo/${encodeURIComponent(name)}@${encodeURIComponent(version)}` } : {}),
  }))
  .sort((left, right) => left['bom-ref'].localeCompare(right['bom-ref']));

const bom = {
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
  components,
};

await writeFile(resolve(outputPath), `${JSON.stringify(bom, null, 2)}\n`, 'utf8');
console.log(`Wrote ${components.length} CycloneDX components.`);
