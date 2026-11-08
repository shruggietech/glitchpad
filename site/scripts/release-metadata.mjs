export function deploymentReleaseMetadata(version, publishedTag = '') {
  if (!/^\d+\.\d+\.\d+$/u.test(version))
    throw new Error('Invalid target release version');
  if (publishedTag && publishedTag !== 'v' + version)
    throw new Error('The published tag must match the target release version');
  return {
    releaseUrl:
      'https://github.com/ShruggieTech/glitchpad/releases/' +
      (publishedTag ? 'tag/' + publishedTag : 'latest'),
    releaseTag: publishedTag || null,
    publicationContext: publishedTag ? 'published_tag' : 'source_preview',
  };
}
