import { access, readFile, writeFile } from 'node:fs/promises';

await access('out');
await writeFile('out/.nojekyll', '');
await writeFile('out/CNAME', 'glitchpad.com\n');

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
  'Static export carries .nojekyll, CNAME, canonical metadata, and social preview.',
);
