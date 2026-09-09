const baseUrl = new URL(
  process.env.GLITCHPAD_SITE_URL ?? 'https://glitchpad.com',
);
const expectedVersion = process.env.GLITCHPAD_EXPECTED_VERSION;
const expectedRevision = process.env.GLITCHPAD_EXPECTED_REVISION;

if (!expectedVersion || !/^\d+\.\d+\.\d+$/.test(expectedVersion))
  throw new Error('GLITCHPAD_EXPECTED_VERSION must be a semantic version');
if (!expectedRevision || !/^[0-9a-f]{40}$/.test(expectedRevision))
  throw new Error('GLITCHPAD_EXPECTED_REVISION must be a full commit SHA');

async function fetchText(path) {
  const url = new URL(path, baseUrl);
  url.searchParams.set('verify', expectedRevision);
  const response = await fetch(url, {
    headers: {
      'cache-control': 'no-cache',
      'user-agent': 'glitchpad-deployment-verifier',
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.text();
}

function visibleText(html) {
  return html
    .replaceAll(/<!--.*?-->/gs, '')
    .replaceAll(/<[^>]+>/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

async function verifyExpectedDeployment() {
  const provenance = JSON.parse(await fetchText('/deployment.json'));
  if (provenance.productVersion !== expectedVersion)
    throw new Error(
      `production version ${provenance.productVersion} != ${expectedVersion}`,
    );
  if (provenance.sourceRevision !== expectedRevision)
    throw new Error(
      `production revision ${provenance.sourceRevision} != ${expectedRevision}`,
    );
  const expectedReleaseUrl = `https://github.com/ShruggieTech/glitchpad/releases/tag/v${expectedVersion}`;
  if (provenance.releaseUrl !== expectedReleaseUrl)
    throw new Error('production provenance has the wrong release destination');
  if (!Number.isFinite(Date.parse(provenance.builtAt)))
    throw new Error('production provenance has an invalid build timestamp');

  const [home, docs, specification, colorLockup, lightLockup] =
    await Promise.all([
      fetchText('/'),
      fetchText('/docs'),
      fetchText('/docs/technical-specification'),
      fetchText('/logos/glitchpad-horizontal-color.svg'),
      fetchText('/logos/glitchpad-horizontal-light.svg'),
    ]);
  for (const expected of [
    'View your files.',
    'A fast, cross-platform viewer and editor for local files.',
    'A ShruggieTech project.',
    `/releases/tag/v${expectedVersion}`,
  ]) {
    if (!home.includes(expected))
      throw new Error(`production homepage is missing ${expected}`);
  }
  if (!visibleText(docs).includes(`v${expectedVersion}`))
    throw new Error(`production docs are missing v${expectedVersion}`);
  if (
    !visibleText(specification).includes(`Product version ${expectedVersion}`)
  )
    throw new Error(
      `production specification is missing product version ${expectedVersion}`,
    );
  for (const [name, asset] of [
    ['color lockup', colorLockup],
    ['light lockup', lightLockup],
  ]) {
    if (
      !asset.includes('<svg') ||
      !asset.includes('data-square-enclosure="true"')
    )
      throw new Error(`production ${name} is incomplete`);
  }
}

async function waitForExpectedDeployment() {
  let lastError;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      await verifyExpectedDeployment();
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 6)
        await new Promise((resolve) => setTimeout(resolve, 10_000));
    }
  }
  throw lastError;
}

await waitForExpectedDeployment();
console.log(`Production ${expectedVersion} at ${expectedRevision} verified.`);
