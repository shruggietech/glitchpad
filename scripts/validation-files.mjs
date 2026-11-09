import { readdir } from 'node:fs/promises';
import { extname, join, relative, sep } from 'node:path';

function compareNames(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export async function collectMarkdownFiles(
  repositoryRoot,
  { excludedDirectories = new Set(), excludedPaths = new Set() } = {},
) {
  const files = [];
  const privateSessionDirectory = join(repositoryRoot, '.codex-tmp');

  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => compareNames(left.name, right.name));

    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (path === privateSessionDirectory) continue;
      if (entry.isDirectory()) {
        if (
          !excludedDirectories.has(entry.name) &&
          !excludedPaths.has(repositoryPath(repositoryRoot, path))
        )
          await visit(path);
      } else if (
        entry.isFile() &&
        extname(entry.name).toLowerCase() === '.md' &&
        !excludedPaths.has(repositoryPath(repositoryRoot, path))
      ) {
        files.push(path);
      }
    }
  }

  await visit(repositoryRoot);
  return files;
}

export function repositoryPath(repositoryRoot, path) {
  return relative(repositoryRoot, path).split(sep).join('/');
}
