import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyHomepageReleaseDestination } from './site-release-destination.mjs';
const latest = 'https://github.com/ShruggieTech/glitchpad/releases/latest';
const tag = 'https://github.com/shruggietech/glitchpad/releases/tag/v0.2.1';
const page = (url) => '<a href="' + url + '">Download</a>';
const fetcher =
  (url = tag, ok = true) =>
  async () => ({
    ok,
    status: ok ? 200 : 404,
    url,
    body: { cancel: async () => {} },
  });
test('approved latest anchor resolves to exact published version', async () => {
  assert.equal(
    await verifyHomepageReleaseDestination(page(latest), '0.2.1', fetcher()),
    tag,
  );
});
test('exact tag anchor accepts repository casing', async () => {
  assert.equal(
    await verifyHomepageReleaseDestination(
      page(tag.replace('/shruggietech/', '/ShruggieTech/')),
      '0.2.1',
      fetcher(),
    ),
    tag,
  );
});
test('unquoted HTML anchor remains an actual destination', async () => {
  assert.equal(
    await verifyHomepageReleaseDestination(
      '<a href=' + latest + '>Download</a>',
      '0.2.1',
      fetcher(),
    ),
    tag,
  );
});
for (const [label, url, ok] of [
  ['older version', tag.replace('0.2.1', '0.1.4'), true],
  ['external redirect', 'https://example.com/releases/tag/v0.2.1', true],
  ['failed HTTP response', tag, false],
])
  test('rejects ' + label, async () => {
    await assert.rejects(
      () =>
        verifyHomepageReleaseDestination(
          page(latest),
          '0.2.1',
          fetcher(url, ok),
        ),
      /release destination/u,
    );
  });
for (const [label, html] of [
  [
    'wrong repository',
    '<a href="https://github.com/other/glitchpad/releases/latest">Download</a>',
  ],
  [
    'query override',
    '<a href="https://github.com/ShruggieTech/glitchpad/releases/latest?other=1">Download</a>',
  ],
  ['script URL', '<a href="javascript:alert(1)">Download</a>'],
  [
    'plain text',
    '<p>https://github.com/shruggietech/glitchpad/releases/tag/v0.2.1</p>',
  ],
  [
    'quoted attribute fake',
    '<a data-note=\' href="https://github.com/ShruggieTech/glitchpad/releases/latest"\'>Download</a>',
  ],
  [
    'script text fake',
    '<script>const example = \'<a href="https://github.com/ShruggieTech/glitchpad/releases/latest">Download</a>\';</script>',
  ],
  [
    'comment',
    '<!--<a href="https://github.com/ShruggieTech/glitchpad/releases/latest">Download</a>-->',
  ],
  [
    'data attribute',
    '<a data-href="https://github.com/ShruggieTech/glitchpad/releases/latest">Download</a>',
  ],
  [
    'HTTP protocol',
    '<a href="http://github.com/ShruggieTech/glitchpad/releases/latest">Download</a>',
  ],
  [
    'userinfo',
    '<a href="https://someone@github.com/ShruggieTech/glitchpad/releases/latest">Download</a>',
  ],
  [
    'inert template',
    '<template><a href="https://github.com/ShruggieTech/glitchpad/releases/latest">Download</a></template>',
  ],
  [
    'duplicate href first wins',
    '<a href="https://example.com" href="https://github.com/ShruggieTech/glitchpad/releases/latest">Download</a>',
  ],
])
  test('rejects ' + label + ' before fetching', async () => {
    let called = false;
    await assert.rejects(
      () =>
        verifyHomepageReleaseDestination(html, '0.2.1', async () => {
          called = true;
          return fetcher()();
        }),
      /release destination/u,
    );
    assert.equal(called, false);
  });
test('malformed version is refused before fetching', async () => {
  await assert.rejects(
    () =>
      verifyHomepageReleaseDestination(page(latest), '../../main', fetcher()),
    /release destination/u,
  );
});
