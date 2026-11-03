const failure = () =>
  new Error('production homepage release destination is invalid');
const tailFor = (value) => {
  try {
    const url = new URL(value);
    const parts = url.pathname.split('/');
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'github.com' ||
      url.port ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      parts[1]?.toLowerCase() !== 'shruggietech' ||
      parts[2]?.toLowerCase() !== 'glitchpad'
    )
      return null;
    return '/' + parts.slice(3).join('/');
  } catch {
    return null;
  }
};

const rawElements = new Set([
  'script',
  'style',
  'textarea',
  'title',
  'xmp',
  'iframe',
  'noembed',
  'noframes',
  'noscript',
]);

// Read anchor attributes without treating quoted values, raw text or inert templates as elements.
function anchorDestinations(home) {
  const tokens =
    /<!--[\s\S]*?(?:-->|$)|<![^>]*>|<\?[^>]*>|<(\/?)([a-z][a-z0-9:-]*)(?=[\s/>])((?:"[^"]*"|'[^']*'|[^'">])*)>/giu;
  const attribute =
    /([^\s=/>"'<]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>]+)))?/gy;
  const destinations = [];
  let raw = null;
  let templates = 0;
  for (const token of home.matchAll(tokens)) {
    if (!token[2]) continue;
    const closing = token[1] === '/';
    const name = token[2].toLowerCase();
    if (raw) {
      if (closing && name === raw) raw = null;
      continue;
    }
    if (!closing && rawElements.has(name)) {
      raw = name;
      continue;
    }
    if (name === 'template') {
      templates = Math.max(0, templates + (closing ? -1 : 1));
      continue;
    }
    if (templates || closing || name !== 'a') continue;
    const attributes = token[3];
    let offset = 0;
    while (offset < attributes.length) {
      while (/\s/u.test(attributes[offset] ?? '') && offset < attributes.length)
        offset++;
      if (offset === attributes.length || attributes[offset] === '/') break;
      attribute.lastIndex = offset;
      const entry = attribute.exec(attributes);
      if (!entry) break;
      offset = attribute.lastIndex;
      if (entry[1].toLowerCase() === 'href') {
        destinations.push(entry[2] ?? entry[3] ?? entry[4] ?? '');
        break; // HTML uses the first occurrence of a duplicate attribute.
      }
    }
  }
  return destinations;
}

/** Verify the approved homepage release anchor and its exact published-tag destination. */
export async function verifyHomepageReleaseDestination(
  home,
  version,
  fetcher = fetch,
) {
  if (!/^\d+\.\d+\.\d+$/u.test(version)) throw failure();
  const expected = '/releases/tag/v' + version;
  const destinations = anchorDestinations(home);
  const destination = destinations.find((value) =>
    [expected, '/releases/latest'].includes(tailFor(value)),
  );
  if (!destination) throw failure();
  const response = await fetcher(destination, {
    redirect: 'follow',
    headers: {
      'cache-control': 'no-cache',
      'user-agent': 'glitchpad-deployment-verifier',
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (response.body) await response.body.cancel();
  if (!response.ok || tailFor(response.url) !== expected) throw failure();
  return response.url;
}
