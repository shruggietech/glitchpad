import { access, readFile, writeFile } from 'node:fs/promises';

const packageSource = JSON.parse(await readFile('../package.json', 'utf8'));
const sourceRevision =
  process.env.GLITCHPAD_SOURCE_REVISION ?? process.env.GITHUB_SHA ?? 'local';
const releaseUrl = `https://github.com/ShruggieTech/glitchpad/releases/tag/v${packageSource.version}`;

await access('out');
await writeFile('out/.nojekyll', '');
await writeFile('out/CNAME', 'glitchpad.com\n');
await writeFile(
  'out/deployment.json',
  `${JSON.stringify(
    {
      productVersion: packageSource.version,
      sourceRevision,
      builtAt: new Date().toISOString(),
      releaseUrl,
    },
    null,
    2,
  )}\n`,
);

const homepage = await readFile('out/index.html', 'utf8');
for (const required of [
  'Glitchpad',
  'https://glitchpad.com',
  'social-preview',
]) {
  if (!homepage.includes(required))
    throw new Error(`static homepage is missing ${required}`);
}
console.log(
  'Static export carries Pages markers, canonical metadata, social preview, and deployment provenance.',
);
