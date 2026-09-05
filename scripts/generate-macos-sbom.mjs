import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateDesktopSbom } from './generate-windows-sbom.mjs';

export function generateMacosSbom(metadata, pnpmListing, sourceCommit) {
  return generateDesktopSbom(metadata, pnpmListing, sourceCommit, {
    platform: 'macOS',
  });
}

async function main() {
  const [metadataPath, pnpmListingPath, outputPath, sourceCommit] =
    process.argv.slice(2);
  if (!metadataPath || !pnpmListingPath || !outputPath || !sourceCommit) {
    throw new Error(
      'usage: generate-macos-sbom.mjs <cargo-metadata.json> <pnpm-list.json> <output.json> <source-commit>',
    );
  }
  const [metadata, pnpmListing] = await Promise.all([
    readFile(resolve(metadataPath), 'utf8').then(JSON.parse),
    readFile(resolve(pnpmListingPath), 'utf8').then(JSON.parse),
  ]);
  const bom = generateMacosSbom(metadata, pnpmListing, sourceCommit);
  await writeFile(
    resolve(outputPath),
    `${JSON.stringify(bom, null, 2)}\n`,
    'utf8',
  );
  console.log(`Wrote ${bom.components.length} CycloneDX components.`);
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
