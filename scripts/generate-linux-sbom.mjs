import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateDesktopSbom } from './generate-windows-sbom.mjs';

export function generateLinuxSbom(metadata, pnpmListing, sourceCommit) {
  return generateDesktopSbom(metadata, pnpmListing, sourceCommit, {
    platform: 'Linux',
  });
}

async function main() {
  const [metadataPath, pnpmListingPath, outputPath, sourceCommit] =
    process.argv.slice(2);
  if (!metadataPath || !pnpmListingPath || !outputPath || !sourceCommit) {
    throw new Error(
      'usage: generate-linux-sbom.mjs <cargo-metadata.json> <pnpm-list.json> <output.json> <source-commit>',
    );
  }
  const [metadata, pnpmListing] = await Promise.all([
    readFile(resolve(metadataPath), 'utf8').then(JSON.parse),
    readFile(resolve(pnpmListingPath), 'utf8').then(JSON.parse),
  ]);
  const bom = generateLinuxSbom(metadata, pnpmListing, sourceCommit);
  await writeFile(resolve(outputPath), `${JSON.stringify(bom, null, 2)}\n`, 'utf8');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
