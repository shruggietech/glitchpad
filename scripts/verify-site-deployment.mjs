import { readFile } from 'node:fs/promises';

const baseUrl = new URL(
  process.env.GLITCHPAD_SITE_URL ?? 'https://glitchpad.com',
);
const expectedVersion = process.env.GLITCHPAD_EXPECTED_VERSION;
const expectedRevision = process.env.GLITCHPAD_EXPECTED_REVISION;
const documentation = JSON.parse(
  await readFile('site/lib/generated/documentation.json', 'utf8'),
);

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

  if (documentation.productVersion !== expectedVersion)
    throw new Error('documentation manifest has the wrong product version');
  const representativeSections = [
    documentation.sections[0],
    documentation.sections[18],
    documentation.sections[37],
  ];
  const [
    home,
    docs,
    compatibility,
    earlySection,
    middleSection,
    finalSection,
    colorLockup,
    lightLockup,
  ] =
    await Promise.all([
      fetchText('/'),
      fetchText(documentation.introductionRoute),
      fetchText(documentation.compatibilityRoute),
      ...representativeSections.map(({ route }) => fetchText(route)),
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
  if (!docs.includes(`v${expectedVersion}`))
    throw new Error(`production docs are missing v${expectedVersion}`);
  if (!docs.includes('Technical Specification authority'))
    throw new Error('production docs are missing the authority introduction');
  if (!docs.includes(`<tr><td>Product version</td><td>${expectedVersion}</td></tr>`))
    throw new Error(
      `production documentation is missing product version ${expectedVersion}`,
    );
  if (
    !compatibility.includes('Technical specification moved') ||
    !compatibility.includes('href="/docs"') ||
    /TS-FR-\d{3}|Table of Contents/.test(compatibility)
  )
    throw new Error('production legacy documentation route is not a clean forwarder');
  for (const [section, source] of representativeSections.map((section, index) => [
    section,
    [earlySection, middleSection, finalSection][index],
  ])) {
    const expectedTitle = `${section.number}. ${section.title}`;
    if (!source.includes(expectedTitle))
      throw new Error(`production section is missing ${expectedTitle}`);
    if (!source.includes(`https://glitchpad.com${section.route}`))
      throw new Error(`production section metadata is missing ${section.route}`);
  }
  if (!earlySection.includes('flowchart TB'))
    throw new Error('production early section is missing its Mermaid source');
  if (!finalSection.includes('Appendix K. Release documentation pass checklist'))
    throw new Error('production final section is incomplete');
  if (
    !middleSection.includes(documentation.sections[17].route) ||
    !middleSection.includes(documentation.sections[19].route)
  )
    throw new Error('production previous/next navigation is incomplete');
  for (const section of documentation.sections) {
    if (!middleSection.includes(section.route))
      throw new Error(`production sidebar is missing ${section.route}`);
  }
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
