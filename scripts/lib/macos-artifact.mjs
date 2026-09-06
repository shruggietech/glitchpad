import { createHash } from 'node:crypto';
import { lstat, readFile, readdir, readlink } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

export function digestApplicationInventory(inventory) {
  return sha256(Buffer.from(JSON.stringify(inventory)));
}

export async function collectApplicationInventory(applicationRoot) {
  const root = resolve(applicationRoot);
  const inventory = [];
  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const path = join(directory, entry.name);
      const relativePath = relative(root, path).split(sep).join('/');
      if (
        !relativePath ||
        relativePath.startsWith('../') ||
        relativePath.includes('\\')
      )
        throw new Error('unsafe application inventory path');
      const information = await lstat(path);
      if (information.isDirectory()) await visit(path);
      else if (information.isSymbolicLink()) {
        const linkTarget = await readlink(path);
        if (
          linkTarget.startsWith('/') ||
          linkTarget.split(/[\\/]/u).includes('..')
        )
          throw new Error(`unsafe application symlink:${relativePath}`);
        inventory.push({
          relative_path: relativePath,
          kind: 'symlink',
          role: 'link',
          link_target: linkTarget,
        });
      } else if (information.isFile()) {
        const bytes = await readFile(path);
        const executable = (information.mode & 0o111) !== 0;
        inventory.push({
          relative_path: relativePath,
          kind: 'file',
          role: executable ? 'executable' : 'resource',
          bytes: bytes.length,
          sha256: sha256(bytes),
          executable,
        });
      } else throw new Error(`unsupported application entry:${relativePath}`);
    }
  }
  await visit(root);
  const folded = inventory.map(({ relative_path }) =>
    relative_path.toLowerCase(),
  );
  if (new Set(folded).size !== folded.length)
    throw new Error('case-colliding application inventory');
  return inventory;
}
