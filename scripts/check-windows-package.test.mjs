import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

import {
  checkWindowsConfiguration,
  classifyPackageSize,
  validatePortableSmokeContract,
  validateOfficialWindowsEvidence,
  validateWindowsEvidence,
} from './check-windows-package.mjs';
import { generateWindowsSbom } from './generate-windows-sbom.mjs';

const repositoryRoot = new URL('../', import.meta.url).pathname.replace(
  /^\/(?:[A-Za-z]:)/u,
  (value) => value.slice(1),
);
const contract = JSON.parse(
  await readFile(
    join(repositoryRoot, 'packaging', 'windows', 'package-contract.json'),
    'utf8',
  ),
);
const digest = 'a'.repeat(64);
const sourceCommit = 'b'.repeat(40);

function candidate() {
  return {
    schema_version: 1,
    version: '0.2.1',
    platform: 'windows',
    architecture: 'x86_64',
    source_commit: sourceCommit,
    workflow_identity:
      'shruggietech/glitchpad/.github/workflows/windows-package.yml@refs/tags/v0.2.1',
    official: false,
    gate_status: 'candidate_valid',
    artifacts: contract.artifacts.map((artifact) => ({
      ...artifact,
      sha256: digest,
      bytes: 1024,
      size_classification: 'pass',
      signature_status: 'not_applicable_unsigned_candidate',
    })),
    portable_inventory: contract.portable_required_files.map(
      (relative_path) => ({
        relative_path,
        sha256: digest,
        bytes: 1,
      }),
    ),
  };
}

test('repository Windows package configuration is internally consistent', async () => {
  assert.deepEqual(await checkWindowsConfiguration(repositoryRoot), {
    capabilityCount: 31,
    artifactCount: 2,
  });
});
test('Windows lifecycle policy rejects removal of content-first release assertions', async () => {
  const [lifecycle, installerLifecycle, workflow] = await Promise.all([
    readFile(
      join(repositoryRoot, 'scripts', 'windows', 'test-portable-lifecycle.ps1'),
      'utf8',
    ),
    readFile(
      join(
        repositoryRoot,
        'scripts',
        'windows',
        'test-installer-lifecycle.ps1',
      ),
      'utf8',
    ),
    readFile(
      join(repositoryRoot, '.github', 'workflows', 'windows-package.yml'),
      'utf8',
    ),
  ]);
  assert.equal(validatePortableSmokeContract(lifecycle, workflow), true);
  assert.throws(
    () =>
      validatePortableSmokeContract(
        lifecycle.replace("markdown_governed_corpus = 'pass'", ''),
        workflow,
      ),
    /portable smoke lifecycle omits/u,
  );
  assert.throws(
    () =>
      validatePortableSmokeContract(
        lifecycle.replaceAll('S046_GOVERNED_RAW_SENTINEL', 'missing-sentinel'),
        workflow,
      ),
    /portable smoke lifecycle omits/u,
  );
  assert.throws(
    () =>
      validatePortableSmokeContract(
        lifecycle.replace(
          '-PassThru -WindowStyle Normal',
          '-PassThru -WindowStyle Hidden',
        ),
        workflow,
      ),
    /primary window must launch visibly/u,
  );
  assert.throws(
    () =>
      validatePortableSmokeContract(
        lifecycle.replace("conditional_tabs = 'pass'", ''),
        workflow,
      ),
    /portable smoke lifecycle omits/u,
  );
  assert.throws(
    () =>
      validatePortableSmokeContract(
        lifecycle.replace("geometry_scale_125 = 'pass'", ''),
        workflow,
      ),
    /portable smoke lifecycle omits/u,
  );
  assert.throws(
    () =>
      validatePortableSmokeContract(
        lifecycle,
        workflow.replaceAll(
          's038-installed-editable.md',
          's038-portable-editable.md',
        ),
      ),
    /Windows workflow omits/u,
  );
  assert.throws(
    () =>
      validatePortableSmokeContract(
        lifecycle,
        workflow.replace(
          '- name: Promote truthful community evidence',
          '- name: Late community evidence promotion',
        ),
      ),
    /promotion and receipt binding are out of order/u,
  );
  assert.throws(
    () =>
      validatePortableSmokeContract(
        lifecycle,
        workflow.replace(
          'puppeteer browsers install chrome-headless-shell',
          'echo browser unavailable',
        ),
      ),
    /Windows final-byte validation omits/u,
  );
  assert.throws(
    () =>
      validatePortableSmokeContract(
        lifecycle,
        workflow.replace('--official --artifact-root artifacts/windows', ''),
      ),
    /Windows final-byte validation omits/u,
  );
  assert.throws(
    () =>
      validatePortableSmokeContract(
        lifecycle.replaceAll(
          'System.Text.Json.JsonDocument',
          'System.Text.Json.JsonNode',
        ),
        workflow,
      ),
    /Windows Markdown lifecycle omits/u,
  );
  assert.throws(
    () =>
      validatePortableSmokeContract(
        lifecycle.replaceAll(
          "GetProperty('source_commit').GetString()",
          "GetProperty('sourceCommit').GetString()",
        ),
        workflow,
      ),
    /Windows Markdown lifecycle omits/u,
  );
  assert.throws(
    () =>
      validatePortableSmokeContract(
        lifecycle.replace(
          'Click-AutomationElement $Process $item $Name',
          'Invoke-AutomationElement $Process $item $Name',
        ),
        workflow,
      ),
    /Windows Markdown lifecycle omits/u,
  );
  assert.throws(
    () =>
      validatePortableSmokeContract(
        lifecycle.replace('        catch { }', ''),
        workflow,
      ),
    /Windows Markdown lifecycle omits/u,
  );
  assert.throws(
    () =>
      validatePortableSmokeContract(
        lifecycle.replace('Wait-FileText $Path $savedText', ''),
        workflow,
      ),
    /Windows Markdown lifecycle omits/u,
  );
  assert.throws(
    () =>
      validatePortableSmokeContract(
        lifecycle.replace(
          "Invoke-DocumentCommand $Process 'Save' 'Ctrl+S'",
          '',
        ),
        workflow,
      ),
    /Windows Markdown lifecycle omits/u,
  );
  assert.throws(
    () =>
      validatePortableSmokeContract(
        lifecycle.replace(
          "Invoke-NamedButton $Process 'Document tools'",
          "Invoke-NamedButton $Process 'Menu'",
        ),
        workflow,
      ),
    /Windows Markdown lifecycle omits/u,
  );
  assert.throws(
    () =>
      validatePortableSmokeContract(
        lifecycle.replace('[Regex]::Escape($Shortcut)', ''),
        workflow,
      ),
    /Windows Markdown lifecycle omits/u,
  );
  assert.throws(
    () =>
      validatePortableSmokeContract(
        lifecycle.replace('$bounds = $Element.Current.BoundingRectangle', ''),
        workflow,
      ),
    /Windows Markdown lifecycle omits/u,
  );
  assert.throws(
    () =>
      validatePortableSmokeContract(
        lifecycle.replace(
          '$item = Wait-ActionableNamedElement $Process $Name',
          '$item = Wait-NamedElement $Process $Name',
        ),
        workflow,
      ),
    /Windows Markdown lifecycle omits/u,
  );
  assert.match(
    installerLifecycle,
    /Wait-RenderedMarkdownHeading \$associationProcess 'S035 Minimal Markdown 5E8A'/u,
  );
});

test('desktop lifecycle observes the active modal and preserves document action routing', async () => {
  const [lifecycle, menu, app] = await Promise.all([
    readFile(
      join(repositoryRoot, 'scripts/windows/test-portable-lifecycle.ps1'),
      'utf8',
    ),
    readFile(
      join(repositoryRoot, 'apps/glitchpad/src/components/ApplicationMenu.tsx'),
      'utf8',
    ),
    readFile(join(repositoryRoot, 'apps/glitchpad/src/App.tsx'), 'utf8'),
  ]);
  assert.match(menu, /title="Application menu"/u);
  assert.match(menu, /title="Document tools"/u);
  assert.ok(app.includes('inert={'));
  assert.ok(
    lifecycle.includes(
      'Wait-WindowText $Process $pausedText -Seconds 20 -PollMilliseconds 250',
    ),
  );
  assert.ok(
    !lifecycle.includes(
      '[System.Windows.Automation.AutomationElement]::Compare',
    ),
    'Compare is declared on Automation, not AutomationElement',
  );
  assert.ok(
    lifecycle.includes('[System.Windows.Automation.Automation]::Compare'),
  );
  const geometry = lifecycle.slice(
    lifecycle.indexOf('function Assert-MenuGeometry('),
    lifecycle.indexOf('function Wait-DeviceScaleMarker('),
  );
  const disclosed = geometry.slice(
    geometry.indexOf("Invoke-NamedButton $Process 'Menu'"),
    geometry.indexOf("SendWait('{ESC}')"),
  );
  assert.ok(!disclosed.includes("Wait-NamedButton $Process 'Menu'"));
  assert.ok(!disclosed.includes(' $DocumentName'));
  assert.ok(
    disclosed.includes("Find-LargestNamedElement $window 'Application menu'"),
  );
  assert.ok(
    disclosed.includes("Wait-NamedButton $Process 'Close Application menu'"),
  );
  const output = execFileSync(
    'pwsh',
    [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-File',
      join(repositoryRoot, 'scripts/windows/test-portable-menu.ps1'),
    ],
    { encoding: 'utf8', windowsHide: true },
  );
  assert.match(
    output,
    /Portable modal coordinator and document route fixtures passed/u,
  );
});

test('Markdown recovery stays intrinsic and avoids unsupported Chrome 69 globals', async () => {
  const [documentSurface, markdownSurface, worker, styles, shellLayout] =
    await Promise.all([
      readFile(
        join(
          repositoryRoot,
          'apps',
          'glitchpad',
          'src',
          'components',
          'DocumentSurface.tsx',
        ),
        'utf8',
      ),
      readFile(
        join(
          repositoryRoot,
          'apps',
          'glitchpad',
          'src',
          'components',
          'MarkdownSurface.tsx',
        ),
        'utf8',
      ),
      readFile(
        join(
          repositoryRoot,
          'apps',
          'glitchpad',
          'src',
          'domain',
          'markdown-worker.ts',
        ),
        'utf8',
      ),
      readFile(
        join(repositoryRoot, 'apps', 'glitchpad', 'src', 'styles.css'),
        'utf8',
      ),
      readFile(
        join(repositoryRoot, 'scripts', 'check-shell-layout.mjs'),
        'utf8',
      ),
    ]);
  assert.match(documentSurface, /Retry preview/u);
  assert.match(documentSurface, /attempt:\s*recoveryAttempt \+ 1/u);
  assert.match(
    styles,
    /\.markdown-failure,\s*\.document-render-failure\s*\{[^}]*grid-auto-rows:\s*max-content[^}]*align-content:\s*start/u,
  );
  assert.match(
    styles,
    /@media \(max-width: 640px\), \(pointer: coarse\)[\s\S]*\.document-render-failure button,[\s\S]*\.markdown-recovery-banner button\s*\{[\s\S]*min-height:\s*44px/u,
  );
  assert.match(shellLayout, /documentSurface\.scrollTop = 37/u);
  assert.match(shellLayout, /before\.scrollTop > 0/u);
  assert.doesNotMatch(markdownSurface, /Object\.hasOwn\(/u);
  assert.doesNotMatch(markdownSurface, /queueMicrotask\(/u);
  assert.match(documentSurface, /lifecycleFailureProbe/u);
  assert.match(markdownSurface, /LifecycleMarkdownFailure/u);
  assert.match(
    markdownSurface,
    /lifecycleFailureProbe && recoveryAttempt === 0/u,
  );
  assert.doesNotMatch(worker, /globalThis/u);
});

test('size classification preserves exact S018 boundaries', () => {
  assert.equal(
    classifyPackageSize(
      contract.size_budget.target_bytes,
      contract.size_budget,
    ),
    'pass',
  );
  assert.equal(
    classifyPackageSize(
      contract.size_budget.target_bytes + 1,
      contract.size_budget,
    ),
    'warning',
  );
  assert.equal(
    classifyPackageSize(
      contract.size_budget.hard_limit_bytes,
      contract.size_budget,
    ),
    'warning',
  );
  assert.equal(
    classifyPackageSize(
      contract.size_budget.hard_limit_bytes + 1,
      contract.size_budget,
    ),
    'failure',
  );
});

test('a complete unsigned candidate passes candidate mode', () => {
  assert.equal(validateWindowsEvidence(candidate(), contract), true);
});

test('an unsigned candidate can never pass official mode', () => {
  assert.throws(
    () => validateWindowsEvidence(candidate(), contract, { official: true }),
    /live final-byte and Authenticode verification/u,
  );
});

test('a self-asserted official manifest cannot bypass live verification', () => {
  const evidence = candidate();
  evidence.official = true;
  evidence.gate_status = 'official_valid';
  evidence.event = 'push_tag';
  evidence.tag = 'v0.2.1';
  evidence.evidence_files = [...contract.official.required_evidence];
  evidence.artifacts = evidence.artifacts.map((artifact) => ({
    ...artifact,
    signature_status: 'valid',
    timestamp_status: 'valid',
    signature_sha256: artifact.sha256,
  }));
  assert.throws(
    () => validateWindowsEvidence(evidence, contract, { official: true }),
    /live final-byte and Authenticode verification/u,
  );
});

test('official community mode binds unsigned final bytes and recorded trust evidence', async () => {
  const root = await mkdtemp(join(tmpdir(), 'glitchpad-signature-'));
  try {
    await mkdir(join(root, 'portable'));
    const evidence = candidate();
    evidence.official = true;
    evidence.gate_status = 'official_valid';
    evidence.event = 'push_tag';
    evidence.tag = 'v0.2.1';
    evidence.evidence_files = [...contract.official.required_evidence];
    for (const artifact of evidence.artifacts) {
      const bytes = Buffer.from(artifact.kind);
      await writeFile(join(root, artifact.name), bytes);
      artifact.sha256 = createHash('sha256').update(bytes).digest('hex');
      artifact.bytes = bytes.length;
      artifact.signature_status = 'not_signed';
      artifact.timestamp_status = 'valid';
    }
    for (const entry of evidence.portable_inventory) {
      const bytes = Buffer.from(entry.relative_path);
      await writeFile(join(root, 'portable', entry.relative_path), bytes);
      entry.sha256 = createHash('sha256').update(bytes).digest('hex');
      entry.bytes = bytes.length;
    }
    const observed = {
      status: 'Valid',
      signer_subject: contract.official.publisher_subject,
      signer_thumbprint: 'a'.repeat(40),
      timestamp_subject: 'CN=Timestamp Authority',
      timestamp_thumbprint: 'b'.repeat(40),
    };
    const installer = evidence.artifacts.find(({ kind }) => kind === 'nsis');
    const portable = evidence.artifacts.find(
      ({ kind }) => kind === 'portable_zip',
    );
    const portableExecutable = evidence.portable_inventory.find(
      ({ relative_path }) => relative_path === 'Glitchpad.exe',
    );
    installer.signature_sha256 = installer.sha256;
    portable.signature_sha256 = portableExecutable.sha256;
    const signatures = {
      schema_version: 1,
      artifacts: [
        { kind: 'nsis', sha256: installer.sha256, ...observed },
        {
          kind: 'portable_executable',
          sha256: portableExecutable.sha256,
          ...observed,
        },
      ],
    };
    const manifestBytes = Buffer.from(JSON.stringify(evidence));
    await writeFile(join(root, 'windows-package-manifest.json'), manifestBytes);
    await writeFile(
      join(root, 'SHA256SUMS'),
      `${evidence.artifacts.map(({ sha256, name }) => `${sha256}  ${name}`).join('\n')}\n`,
    );
    await writeFile(
      join(root, 'glitchpad-windows.cdx.json'),
      JSON.stringify({
        bomFormat: 'CycloneDX',
        specVersion: '1.6',
        metadata: {
          component: {
            name: 'Glitchpad for Windows',
            version: evidence.version,
          },
          properties: [
            { name: 'glitchpad:source_commit', value: evidence.source_commit },
          ],
        },
        components: [
          { 'bom-ref': 'pkg:cargo/glitchpad-core@0.2.1' },
          { 'bom-ref': 'pkg:npm/react@19.2.8' },
        ],
      }),
    );
    await writeFile(
      join(root, 'provenance.json'),
      JSON.stringify({
        schema_version: 1,
        predicate_type: 'https://slsa.dev/provenance/v1',
        candidate_only: false,
        repository: 'shruggietech/glitchpad',
        source_commit: evidence.source_commit,
        workflow_identity: evidence.workflow_identity,
        subjects: evidence.artifacts.map(({ name, sha256 }) => ({
          name,
          sha256,
        })),
      }),
    );
    const passed = Object.fromEntries(
      [
        'install',
        'launch',
        'command_line',
        'association',
        'read',
        'edit',
        'save',
        'metadata',
        'recovery',
        'uninstall',
        'portable',
        'cleanup',
        'performance',
      ].map((key) => [key, 'pass']),
    );
    const manualPassed = Object.fromEntries(
      [
        'dialog',
        'drag_drop',
        'save_as',
        'print',
        'keyboard',
        'focus',
        'text_scale',
        'forced_colors',
        'screen_reader',
      ].map((key) => [key, 'pass']),
    );
    manualPassed.screen_reader = 'unavailable_owner_decision_2026_11_02';
    await writeFile(
      join(root, 'clean-machine-receipt.json'),
      JSON.stringify({
        schema_version: 1,
        candidate_manifest_sha256: createHash('sha256')
          .update(manifestBytes)
          .digest('hex'),
        windows: {
          edition: 'Windows 11 Pro',
          build: '26100',
          architecture: 'x86_64',
          webview2_version: '1.0.0',
        },
        automated: passed,
        manual: manualPassed,
        content_free: true,
        completed_utc: new Date().toISOString(),
      }),
    );
    await writeFile(
      join(root, 'signature-evidence.json'),
      JSON.stringify(signatures),
    );
    await writeFile(
      join(root, 'community-trust-evidence.json'),
      JSON.stringify({
        schema_version: 1,
        trust_state: 'unsigned_community',
        source_commit: evidence.source_commit,
        artifacts: evidence.artifacts.map(({ name }) => ({
          name,
          signature_status: 'not_signed',
        })),
      }),
    );
    assert.equal(
      await validateOfficialWindowsEvidence(evidence, contract, {
        artifactRoot: root,
        authenticodeInspector: async () => observed,
      }),
      true,
    );
    await writeFile(join(root, installer.name), 'tampered');
    await assert.rejects(
      validateOfficialWindowsEvidence(evidence, contract, {
        artifactRoot: root,
        authenticodeInspector: async () => observed,
      }),
      /final bytes do not match nsis/u,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('portable inventory rejects traversal, case collisions, and extra executables', () => {
  for (const relative_path of [
    '../Glitchpad.exe',
    'C:/Glitchpad.exe',
    'bin\\Glitchpad.exe',
    'evil.exe',
  ]) {
    const evidence = candidate();
    evidence.portable_inventory.push({
      relative_path,
      sha256: digest,
      bytes: 1,
    });
    assert.throws(
      () => validateWindowsEvidence(evidence, contract),
      /unsafe|unexpected executable/u,
    );
  }
  const collision = candidate();
  collision.portable_inventory.push({
    relative_path: 'glitchpad.EXE',
    sha256: digest,
    bytes: 1,
  });
  assert.throws(
    () => validateWindowsEvidence(collision, contract),
    /case-colliding/u,
  );
});

test('missing notices, bad size results, and secret-shaped evidence fail closed', () => {
  const badCommit = candidate();
  badCommit.source_commit = 'c'.repeat(39);
  assert.throws(
    () => validateWindowsEvidence(badCommit, contract),
    /source commit is invalid/u,
  );
  const missing = candidate();
  missing.portable_inventory.pop();
  assert.throws(
    () => validateWindowsEvidence(missing, contract),
    /portable inventory omits/u,
  );
  const oversized = candidate();
  oversized.artifacts[0].bytes = contract.size_budget.hard_limit_bytes + 1;
  oversized.artifacts[0].size_classification = 'failure';
  assert.throws(
    () => validateWindowsEvidence(oversized, contract),
    /invalid size result/u,
  );
  const secret = candidate();
  secret.note = 'client_secret';
  assert.throws(
    () => validateWindowsEvidence(secret, contract),
    /secret-shaped/u,
  );
});

test('Windows SBOM combines Cargo and transitive production JavaScript dependencies', () => {
  const bom = generateWindowsSbom(
    {
      packages: [
        {
          name: 'glitchpad-core',
          version: '0.2.1',
          source: null,
          license: 'Apache-2.0',
        },
      ],
    },
    [
      {
        dependencies: {
          react: {
            version: '19.2.4',
            dependencies: { scheduler: { version: '0.27.0' } },
          },
        },
      },
    ],
    sourceCommit,
  );
  assert.deepEqual(bom.components.map(({ name }) => name).sort(), [
    'glitchpad-core',
    'react',
    'scheduler',
  ]);
  assert.ok(
    bom.components
      .find(({ name }) => name === 'react')
      ?.purl.startsWith('pkg:npm/'),
  );
  assert.deepEqual(bom.metadata.properties, [
    { name: 'glitchpad:source_commit', value: sourceCommit },
  ]);
});
