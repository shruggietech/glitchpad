import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:http';
import {
  appendFile,
  mkdir,
  readFile,
  readdir,
  writeFile,
} from 'node:fs/promises';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { installNativeSeams } from './check-android-authoring-layout.mjs';
import { auditSurfaceColors } from './check-s046-surface-contrast.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const tolerance = 0.6;
export function assertTaskControlMeasurement(row) {
  assert.equal(row.frameCount, 1, 'Task must retain the real single AppFrame');
  assert.ok(
    row.name && row.name.trim(),
    'Each real control needs an accessible name',
  );
  if (row.passive) {
    assert.equal(row.tag, 'INPUT');
    assert.equal(row.type, 'checkbox');
    assert.equal(row.disabled, true);
    assert.equal(row.readOnly, true);
    assert.match(row.name, /^(Completed|Incomplete) task$/u);
    return;
  }
  assert.ok(
    row.width >= 48 - tolerance && row.height >= 48 - tolerance,
    row.name + ' needs a48px-equivalent target',
  );
  assert.ok(
    row.left >= row.visible.left - tolerance &&
      row.right <= row.visible.right + tolerance &&
      row.top >= row.visible.top - tolerance &&
      row.bottom <= row.visible.bottom + tolerance,
    row.name + ' must fit the actual modeled native visible frame',
  );
  assert.ok(
    row.clipWidth >= row.width - tolerance &&
      row.clipHeight >= row.height - tolerance,
    row.name + ' must be completely reachable after ordinary scrolling',
  );
  assert.equal(row.hit, true, row.name + ' must receive actual pointer input');
  if (!row.disabled)
    assert.equal(row.focus, true, row.name + ' must receive usable focus');
}

// Only native storage/source/clipboard boundaries are supplied. React, CodeMirror,
// parsing, actions and task surfaces are the actual production bundle.
export function installDocumentToolsSeams(mode = 'system') {
  const original = window.__TAURI_INTERNALS__.invoke;
  const sources = new Map();
  let serial = 0;
  window.__toolsChoice = 'text';
  window.__toolsReadOnly = false;
  window.__toolsLastSourceId = null;
  window.__toolsClipboard = null;
  window.__toolsRecoveryCalls = [];
  const recoveryEntry = {
    record_id: 's047-layout-recovery',
    display_hint: 'Untitled.txt',
    updated_unix_ms: Date.now(),
    expires_unix_ms: Date.now() + 86400000,
    committed_bytes: 12,
    status: 'available',
  };
  const text = 'cat Cat scatter cat\nsecond line\n';
  const markdown =
    '# Heading\n\nFind body body. [destination](https://example.com/path) [email](mailto:fixture@example.com) [fragment](#heading) [unknown fragment](#missing-section)\n\n- [x] done\n- [ ] todo\n\nFootnote[^one].\n\n[^one]: Footnote text.\n\n~~~mermaid\nflowchart TB\n  Alpha --> Beta\n~~~\n';
  const diagram = 'flowchart TB\n  Alpha[Alpha] --> Beta[Beta]\n';
  function source(kind) {
    const id = 'tools-' + ++serial;
    const writable = kind !== 'large' && !window.__toolsReadOnly;
    window.__toolsLastSourceId = id;
    const content =
      kind === 'markdown'
        ? markdown
        : kind === 'mermaid'
          ? diagram
          : kind === 'large'
            ? 'target\n' + 'section line\n'.repeat(2700000)
            : text;
    const bytes = new TextEncoder().encode(content);
    const name =
      kind === 'markdown'
        ? 'tools.md'
        : kind === 'mermaid'
          ? 'tools.mmd'
          : kind === 'large'
            ? 'large.log'
            : 'tools.txt';
    const identity = {
      authority: 'synthetic',
      scope: 's047-browser',
      token: id,
      strength: 'strong',
    };
    const revision = {
      identity,
      byte_length: bytes.length,
      modified_unix_nanos: '1000000000',
      change_token: null,
    };
    const descriptor = {
      identity,
      restoration_reference: null,
      display_name: name,
      claimed_media_type: 'text/plain',
      byte_length: bytes.length,
      modified_unix_ms: 1000,
      kind: 'document_uri',
      capabilities: {
        read: true,
        seek: true,
        stream: true,
        metadata: true,
        observe_revision: false,
        revalidate: false,
        watch: false,
        write: writable,
        replace_atomically: false,
        persistent_permission: false,
        rename: false,
        observe_deletion: false,
        reopen: true,
        reveal_location: false,
      },
    };
    const summary = {
      source_id: id,
      descriptor,
      external_revision: revision,
      delivery_kind: 'open_document',
      grant: {
        read: true,
        write: writable,
        persisted_read: false,
        persisted_write: false,
        restorable: false,
      },
    };
    sources.set(id, { summary, bytes });
    return summary;
  }
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: async function (value) {
        window.__toolsClipboard = value;
      },
    },
  });
  window.__TAURI_INTERNALS__.invoke = async function (command, args) {
    args = args || {};
    if (mode === 'recovery' && command.endsWith('_recovery')) {
      window.__toolsRecoveryCalls.push(command);
      if (command === 'inventory_recovery') return [[recoveryEntry], 0, 0];
      if (command === 'remove_recovery') return true;
    }
    if (command === 'write_android_clipboard') {
      window.__toolsClipboard = args.text;
      return;
    }
    if (command === 'application_info')
      return {
        package_identifier: 'synthetic.browser.only',
        version: '0.2.0',
        version_code: 1,
        channel: 'browser-fixture',
        platform: 'android',
        build_commit: null,
      };
    if (command === 'application_notices')
      return 'Synthetic browser notice fixture. Native offline notice proof is separate.';
    if (command === 'reset_application_state') return true;
    if (command === 'open_external_link') return null;
    if (command === 'open_android_document')
      return source(window.__toolsChoice);
    if (command === 'identify_image_source') return null;
    if (command === 'read_android_range') {
      const value = sources.get(args.sourceId);
      if (!value) throw Error('fixture_source_missing');
      const end = Math.min(value.bytes.length, args.offset + args.length);
      if (args.binary) {
        const payload = value.bytes.slice(args.offset, end);
        const frame = new Uint8Array(payload.length + 1);
        frame[0] = end >= value.bytes.length ? 1 : 0;
        frame.set(payload, 1);
        return frame.buffer;
      }
      return {
        source_id: args.sourceId,
        offset: args.offset,
        bytes: Array.from(value.bytes.slice(args.offset, end)),
        end_of_source: end >= value.bytes.length,
      };
    }
    if (command === 'query_android_metadata') {
      const value = sources.get(args.sourceId);
      if (!value) throw Error('fixture_source_missing');
      return {
        source_id: args.sourceId,
        external_revision: value.summary.external_revision,
        display_name: value.summary.descriptor.display_name,
        source_kind: 'document_uri',
        byte_length: value.bytes.length,
        modified_unix_nanos: '1000000000',
        created_unix_nanos: null,
        accessed_unix_nanos: null,
        write_state: value.summary.descriptor.capabilities.write
          ? 'writable'
          : 'read_only',
        identity_confidence: 'strong',
      };
    }
    if (command === 'start_android_integrity') {
      const value = sources.get(args.sourceId);
      const digest = Array.from(
        new Uint8Array(await crypto.subtle.digest('SHA-256', value.bytes)),
      )
        .map(function (byte) {
          return byte.toString(16).padStart(2, '0');
        })
        .join('');
      return {
        request_id: args.requestId,
        source_id: args.sourceId,
        state: 'ready',
        processed_bytes: value.bytes.length,
        total_bytes: value.bytes.length,
        sha256: digest,
        external_revision: value.summary.external_revision,
        error_code: null,
      };
    }
    if (command === 'cancel_android_integrity') return null;
    return original(command, args);
  };
}

function controlIndex(scope, label) {
  const nodes = Array.from(document.querySelectorAll(scope));
  return nodes.findIndex(function (node) {
    return (
      node.getAttribute('aria-label') === label ||
      node.textContent.trim() === label ||
      (node.firstElementChild &&
        node.firstElementChild.textContent.trim() === label)
    );
  });
}
export function applyTaskControlClipping(row) {
  let left = Math.max(row.left, row.visible.left);
  let right = Math.min(row.right, row.visible.right);
  let top = Math.max(row.top, row.visible.top);
  let bottom = Math.min(row.bottom, row.visible.bottom);
  const ancestors = row.ancestors || [];
  const establishesFixedContainer = function (ancestor) {
    return (
      ['transform', 'perspective', 'filter', 'backdropFilter'].some(
        function (property) {
          return ancestor[property] && ancestor[property] !== 'none';
        },
      ) ||
      /\b(layout|paint|strict|content)\b/.test(ancestor.contain || '') ||
      /\b(transform|perspective|filter)\b/.test(ancestor.willChange || '')
    );
  };
  let fixedToViewport = false;
  for (let index = 0; index < ancestors.length; index++) {
    const ancestor = ancestors[index];
    if (/auto|scroll|hidden|clip/.test(ancestor.overflowX || '')) {
      left = Math.max(left, ancestor.left);
      right = Math.min(right, ancestor.right);
    }
    if (/auto|scroll|hidden|clip/.test(ancestor.overflowY || '')) {
      top = Math.max(top, ancestor.top);
      bottom = Math.min(bottom, ancestor.bottom);
    }
    if (
      ancestor.position === 'fixed' &&
      !ancestors.slice(index + 1).some(establishesFixedContainer)
    ) {
      fixedToViewport = true;
      break;
    }
  }
  return {
    ...row,
    clipWidth: Math.max(0, right - left),
    clipHeight: Math.max(0, bottom - top),
    viewportFixedPortal: fixedToViewport,
  };
}

export async function captureTaskControl(page, selector, index) {
  await page.evaluate(function () {
    return new Promise(function (resolve) {
      requestAnimationFrame(function () {
        requestAnimationFrame(resolve);
      });
    });
  });
  await page.waitForFunction(function () {
    const open = Array.from(
      document.querySelectorAll('.task-surface[data-state="open"]'),
    );
    const node = open.length
      ? open[open.length - 1]
      : document.querySelector('.add-document');
    return (
      !node ||
      (node.getAttribute('data-native-viewport') === 'true' &&
        Number(node.getAttribute('data-native-viewport-width')) ===
          innerWidth &&
        Number(node.getAttribute('data-native-viewport-height')) ===
          innerHeight)
    );
  });
  const measurement = await page.evaluate(
    function (selector, index) {
      let node = document.querySelectorAll(selector)[index];
      if (!node) throw Error('Required control missing');
      if (node.tagName === 'LABEL' && node.control) node = node.control;
      const target =
        node.type === 'checkbox' && node.closest('label')
          ? node.closest('label')
          : node;
      target.scrollIntoView({ block: 'center', inline: 'nearest' });
      if (!node.disabled) node.focus();
      const rect = target.getBoundingClientRect();
      const native = window.__toolsVisible || {
        left: 0,
        top: 0,
        right: innerWidth,
        bottom: innerHeight,
      };
      const hit = document.elementFromPoint(
        (rect.left + rect.right) / 2,
        (rect.top + rect.bottom) / 2,
      );
      const labelled = (node.getAttribute('aria-labelledby') || '')
        .split(/\s+/)
        .map(function (id) {
          const item = document.getElementById(id);
          return item ? item.textContent : '';
        })
        .join(' ');
      const labels = node.labels
        ? Array.from(node.labels)
            .map(function (label) {
              return label.textContent.trim();
            })
            .join(' ')
        : '';
      const name =
        node.getAttribute('aria-label') ||
        labelled ||
        labels ||
        node.textContent.trim() ||
        node.getAttribute('placeholder') ||
        node.getAttribute('title');
      const passive =
        node.type === 'checkbox' && node.disabled && node.readOnly;
      const style = getComputedStyle(node);
      function background(element) {
        while (element) {
          const color = getComputedStyle(element).backgroundColor;
          if (color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent')
            return color;
          element = element.parentElement;
        }
        return 'rgb(255,255,255)';
      }
      return {
        name,
        tag: node.tagName,
        type: node.type,
        readOnly: node.readOnly === true,
        role: node.getAttribute('role'),
        disabled: node.disabled === true,
        checked: node.type === 'checkbox' ? node.checked : null,
        expanded: node.getAttribute('aria-expanded'),
        invalid: node.getAttribute('aria-invalid'),
        passive,
        frameCount: document.querySelectorAll('[data-bb-app-frame]').length,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
        visible: native,
        hit: hit === target || target.contains(hit),
        hitTag: hit ? hit.tagName : null,
        hitClass: hit ? hit.className : null,
        ancestors: (function () {
          const rows = [];
          for (
            let parent = target.parentElement;
            parent;
            parent = parent.parentElement
          ) {
            const style = getComputedStyle(parent),
              box = parent.getBoundingClientRect();
            rows.push({
              tag: parent.tagName,
              className: parent.className,
              left: box.left,
              right: box.right,
              width: box.width,
              top: box.top,
              bottom: box.bottom,
              height: box.height,
              scrollLeft: parent.scrollLeft,
              clientWidth: parent.clientWidth,
              scrollWidth: parent.scrollWidth,
              paddingLeft: style.paddingLeft,
              paddingRight: style.paddingRight,
              display: style.display,
              overflowX: style.overflowX,
              overflowY: style.overflowY,
              position: style.position,
              transform: style.transform,
              perspective: style.perspective,
              filter: style.filter,
              backdropFilter: style.backdropFilter,
              contain: style.contain,
              willChange: style.willChange,
              flex: style.flex,
            });
          }
          return rows;
        })(),
        focus: document.activeElement === node,
        foreground: style.color,
        background: background(node),
        behind: background(node.parentElement),
        opacity: Number(style.opacity),
        expectedForeground: style.color,
      };
    },
    selector,
    index,
  );
  return applyTaskControlClipping(measurement);
}

export function nativeTapTargetScript(nativeSource, name, selector) {
  const method = nativeSource.slice(
    nativeSource.indexOf('private fun tapNativeControlOnce('),
  );
  const script =
    /val script = """\s*\n([\s\S]*?)\n\s*"""\.trimIndent\(\)/u.exec(method);
  assert.ok(
    script,
    'Actual native control-target script must remain extractable',
  );
  return script[1]
    .replaceAll('NAME', () => JSON.stringify(name))
    .replaceAll('SELECTOR', () => JSON.stringify(selector));
}

export async function checkAppLayout({
  receiptPath = '',
  distDir = join(root, 'apps/glitchpad/dist'),
  sourceCommit = null,
  legacy = false,
  onlyProfile = '',
  onlyGroup = '',
} = {}) {
  if (sourceCommit !== null) assert.match(sourceCommit, /^[a-f0-9]{40}$/u);
  const appRoot = resolve(distDir);
  const index = await readFile(join(appRoot, 'index.html'));
  const assets = [];
  for (const name of (await readdir(join(appRoot, 'assets'))).sort())
    if (/\.(js|css)$/.test(name))
      assets.push({
        name,
        sha256: createHash('sha256')
          .update(await readFile(join(appRoot, 'assets', name)))
          .digest('hex'),
      });
  const server = createServer(async function (request, response) {
    try {
      const url = new URL(request.url, 'http://127.0.0.1');
      const path = resolve(
        appRoot,
        '.' +
          decodeURIComponent(
            url.pathname === '/' ? '/index.html' : url.pathname,
          ),
      );
      if (!path.startsWith(appRoot + sep)) {
        response.writeHead(403);
        response.end();
        return;
      }
      const bytes = await readFile(path);
      response.writeHead(200, {
        'Content-Type':
          {
            '.html': 'text/html',
            '.js': 'text/javascript',
            '.css': 'text/css',
            '.svg': 'image/svg+xml',
            '.woff2': 'font/woff2',
          }[extname(path)] || 'application/octet-stream',
      });
      response.end(bytes);
    } catch {
      response.writeHead(404);
      response.end();
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = 'http://127.0.0.1:' + server.address().port;
  const require = createRequire(
    new URL('../apps/glitchpad/package.json', import.meta.url),
  );
  const ts = require('typescript');
  const implementation = legacy
    ? await import('/tmp/glitchpad-browser-compat/client/node_modules/puppeteer-core/index.js')
    : await import('puppeteer');
  const puppeteer = implementation.default;
  const browser = await puppeteer.launch({
    headless: legacy ? true : 'shell',
    ...(legacy
      ? {
          executablePath:
            '/tmp/glitchpad-browser-compat/chromium/linux-576753/chrome-linux/chrome',
        }
      : {}),
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const version = await browser.version();
  if (legacy)
    assert.match(
      version,
      /69\.0\.3497\.0/,
      'Legacy evidence must identify actual Chromium69',
    );
  const sourcePaths = [
    'apps/glitchpad/src/App.tsx',
    'apps/glitchpad/src/styles.css',
    'apps/glitchpad/src/components/TaskSurface.tsx',
    'apps/glitchpad/src/components/TaskSurface.css',
    'apps/glitchpad/src/components/RecoveryResolution.tsx',
    'apps/glitchpad/src/components/AppFrameHostBridge.tsx',
    'apps/glitchpad/src/components/TextEditorSurface.tsx',
    'apps/glitchpad/src/components/MarkdownSurface.tsx',
    'apps/glitchpad/src/components/MermaidSurface.tsx',
    'apps/glitchpad/src/components/LargeTextSurface.tsx',
    'apps/glitchpad/src/components/MetadataInspector.tsx',
    'apps/glitchpad/src/components/PreferencesPanel.tsx',
    'apps/glitchpad/src/components/DocumentTools.css',
    'apps/glitchpad/src/domain/commands.ts',
    'apps/glitchpad/src/domain/drafts.ts',
    'apps/glitchpad/src/domain/metadata.ts',
    'apps/glitchpad/src/runtime-polyfills.ts',
    'scripts/check-app-layout.mjs',
    'crates/glitchpad-host/gen/android/app/src/androidTest/java/com/shruggietech/glitchpad/source/AndroidDeliveryInstrumentedTest.kt',
  ];
  const observedSources = await Promise.all(
    sourcePaths.map(async function (path) {
      return {
        path,
        sha256: createHash('sha256')
          .update(await readFile(join(root, path)))
          .digest('hex'),
      };
    }),
  );
  const nativeTapSource = await readFile(
    join(
      root,
      'crates/glitchpad-host/gen/android/app/src/androidTest/java/com/shruggietech/glitchpad/source/AndroidDeliveryInstrumentedTest.kt',
    ),
    'utf8',
  );
  const cases = [],
    failures = [];
  async function install(page, fn, args) {
    const code = ts.transpileModule(
      '(' +
        fn.toString() +
        ')(' +
        JSON.stringify(args === undefined ? 'system' : args) +
        ');',
      {
        compilerOptions: {
          target: ts.ScriptTarget.ES2018,
          module: ts.ModuleKind.ESNext,
        },
      },
    ).outputText;
    await page.evaluateOnNewDocument(code);
  }
  const profiles = [
    { name: 'narrow', width: 320, height: 640 },
    { name: 'landscape', width: 640, height: 360 },
    { name: 'short', width: 480, height: 240 },
    { name: 'ime-model', width: 360, height: 420 },
    { name: 'already-consumed', width: 320, height: 592, consumed: true },
    { name: 'wide', width: 1024, height: 768 },
  ];
  const groups = [
    'editor',
    'draft',
    'markdown',
    'mermaid',
    'large',
    'metadata',
    'preferences',
    'recovery',
  ];
  try {
    for (const profile of profiles) {
      if (onlyProfile && profile.name !== onlyProfile) continue;
      for (const scale of [1, 2])
        for (const group of groups) {
          if (onlyGroup && group !== onlyGroup) continue;
          const page = await browser.newPage();
          const row = {
            profile,
            text_scale: scale,
            group,
            controls: [],
            outcomes: [],
            errors: [],
          };
          cases.push(row);
          try {
            await page.setViewport({
              width: profile.width,
              height: profile.height,
              deviceScaleFactor: 1,
              isMobile: true,
              hasTouch: true,
            });
            await page.setUserAgent(
              'Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36',
            );
            row.console_errors = [];
            page.on('console', async function (message) {
              if (message.type() !== 'error' || row.console_errors.length >= 8)
                return;
              const values = [];
              for (const argument of message.args()) {
                try {
                  values.push(
                    await page.evaluate(function (value) {
                      return value && typeof value.message === 'string'
                        ? value.message
                        : String(value);
                    }, argument),
                  );
                } catch {
                  values.push('console_argument_unavailable');
                }
              }
              row.console_errors.push({
                text: message.text().slice(0, 1024),
                values: values.map(function (value) {
                  return String(value).slice(0, 1024);
                }),
              });
            });
            page.on('pageerror', function (error) {
              row.errors.push(error.message);
            });
            await install(
              page,
              installNativeSeams,
              scale === 1 ? 'dark' : 'light',
            );
            await install(
              page,
              installDocumentToolsSeams,
              group === 'recovery' ? 'recovery' : 'system',
            );
            await page.goto(origin, { waitUntil: 'load' });
            await page.waitForSelector('.add-document-trigger');
            await page.evaluate(
              function (profile, scale) {
                document.documentElement.style.fontSize = scale * 100 + '%';
                const top = 24,
                  right = profile.name === 'landscape' ? 48 : 0,
                  bottom = profile.consumed ? 0 : 24;
                window.__toolsVisible = {
                  left: 0,
                  top,
                  right: innerWidth - right,
                  bottom: innerHeight - bottom,
                };
                window.__diagnosticNativeViewport = {
                  webview_screen: {
                    left: 17,
                    top: 29,
                    right: 17 + innerWidth * 2,
                    bottom: 29 + innerHeight * 2,
                  },
                  visible_screen: {
                    left: 17,
                    top: 29 + top * 2,
                    right: 17 + (innerWidth - right) * 2,
                    bottom: 29 + (innerHeight - bottom) * 2,
                  },
                  view_width: innerWidth * 2,
                  view_height: innerHeight * 2,
                  density: 2,
                };
                window.dispatchEvent(new Event('resize'));
              },
              profile,
              scale,
            );
            const audit = async function (scope, stage) {
              const count = await page.$$eval(scope, function (nodes) {
                return nodes.length;
              });
              assert.ok(count > 0, 'Actual ' + stage + ' controls must exist');
              for (let i = 0; i < count; i++) {
                const visible = await page.evaluate(
                  function (s, i) {
                    const n = document.querySelectorAll(s)[i];
                    const r = n.getBoundingClientRect();
                    return (
                      r.width > 0 &&
                      r.height > 0 &&
                      getComputedStyle(n).visibility !== 'hidden' &&
                      !n.closest('[hidden]') &&
                      !n.closest('[aria-hidden="true"]') &&
                      !n.closest('[inert]')
                    );
                  },
                  scope,
                  i,
                );
                if (!visible) continue;
                const measured = await captureTaskControl(page, scope, i);
                measured.stage = stage;
                row.controls.push(measured);
                try {
                  assertTaskControlMeasurement(measured);
                } catch (error) {
                  failures.push({
                    profile: profile.name,
                    text_scale: scale,
                    group,
                    stage,
                    message: error.message,
                    measurement: measured,
                  });
                }
              }
            };
            const click = async function (
              label,
              scope = 'button,[role=link],summary',
            ) {
              const i = await page.evaluate(controlIndex, scope, label);
              assert.ok(i >= 0, 'Actual action exists: ' + label);
              const m = await captureTaskControl(page, scope, i);
              row.controls.push({ ...m, stage: 'activate' });
              assertTaskControlMeasurement(m);
              await page.mouse.click(
                (m.left + m.right) / 2,
                (m.top + m.bottom) / 2,
              );
            };
            const command = async function (label) {
              await click('Document tools');
              await page.waitForSelector('.document-tools-menu');
              await click(label, '.document-tools-menu button');
              await page.waitForSelector('.document-tools-menu', {
                hidden: true,
              });
              if (['Undo', 'Redo'].includes(label)) {
                await page.waitForFunction(function () {
                  return (
                    document.activeElement ===
                    document.querySelector('.document-tools-trigger')
                  );
                });
                row.outcomes.push({
                  id: label === 'Undo' ? 'CTRL-027' : 'CTRL-028',
                  route: 'menu',
                  opener_focus: true,
                });
              }
            };
            const assertMarkdownSource = async function (stage) {
              await page.waitForSelector(
                '.markdown-source-mode:not([hidden]) .cm-content',
              );
              await page.evaluate(function () {
                return new Promise(function (resolve) {
                  requestAnimationFrame(function () {
                    requestAnimationFrame(resolve);
                  });
                });
              });
              const measured = await page.evaluate(function () {
                const source = document.querySelector(
                  '.markdown-source-mode:not([hidden])',
                );
                const editor = source.querySelector('.cm-content');
                const scroller = source.querySelector('.cm-scroller');
                const surface = source.closest('.document-surface');
                const rect = scroller.getBoundingClientRect();
                const area = surface.getBoundingClientRect();
                const content = editor.getBoundingClientRect();
                const visible = window.__toolsVisible;
                const left = Math.max(content.left, rect.left, visible.left);
                const top = Math.max(content.top, rect.top, visible.top);
                const right = Math.min(
                  content.right,
                  rect.right,
                  visible.right,
                );
                const bottom = Math.min(
                  content.bottom,
                  rect.bottom,
                  visible.bottom,
                );
                const x = left + Math.min(16, (right - left) / 2);
                const y = top + Math.min(13.5, (bottom - top) / 2);
                const hit = document.elementFromPoint(x, y);
                const hidden = Array.from(
                  source.parentElement.querySelectorAll(
                    '.markdown-surface[hidden]',
                  ),
                ).map(function (node) {
                  const box = node.getBoundingClientRect();
                  return {
                    display: getComputedStyle(node).display,
                    width: box.width,
                    height: box.height,
                  };
                });
                const box = function (node) {
                  const r = node.getBoundingClientRect();
                  return {
                    left: r.left,
                    top: r.top,
                    right: r.right,
                    bottom: r.bottom,
                    width: r.width,
                    height: r.height,
                  };
                };
                const shell = box(document.querySelector('.app-shell'));
                const chrome = box(document.querySelector('.shell-chrome'));
                const workarea = {
                  left: shell.left,
                  top: chrome.bottom,
                  right: shell.right,
                  bottom: shell.bottom,
                  width: shell.width,
                  height: shell.bottom - chrome.bottom,
                };
                const statusNode = document.querySelector('.command-result');
                const feedback = statusNode
                  ? {
                      rect: box(statusNode),
                      display: getComputedStyle(statusNode).display,
                      text: statusNode.textContent,
                      visible: document
                        .querySelector('.app-shell')
                        .getAttribute('data-command-result-visible'),
                    }
                  : null;
                const outer = [];
                for (
                  let n = scroller;
                  n && n !== document.documentElement;
                  n = n.parentElement
                )
                  outer.push({
                    className: n.className,
                    rect: box(n),
                    gridRows: getComputedStyle(n).gridTemplateRows,
                  });
                const labelledBy = surface.getAttribute('aria-labelledby');
                return {
                  fixedWorkarea: workarea,
                  fullWorkareaRatio: rect.height / workarea.height,
                  frame: box(document.querySelector('[data-bb-app-frame]')),
                  shell: shell,
                  chrome: chrome,
                  outer: outer,
                  feedback: feedback,
                  width: rect.width,
                  height: rect.height,
                  clientHeight: scroller.clientHeight,
                  left: rect.left,
                  top: rect.top,
                  right: rect.right,
                  bottom: rect.bottom,
                  visible: visible,
                  surfaceWidth: area.width,
                  surfaceHeight: area.height,
                  ratio: rect.height / area.height,
                  x: x,
                  y: y,
                  hit: hit === editor || editor.contains(hit),
                  hitClass: hit && hit.className,
                  name:
                    surface.getAttribute('aria-label') ||
                    (labelledBy &&
                      document.getElementById(labelledBy) &&
                      document.getElementById(labelledBy).textContent),
                  hiddenModes: hidden,
                };
              });
              row.source_mode_viewports ??= [];
              row.source_mode_viewports.push({ stage, ...measured });
              assert.ok(
                measured.width >= 48 - tolerance &&
                  measured.height >= 48 - tolerance &&
                  measured.clientHeight > 0,
                'Markdown source requires an actual reachable editor viewport',
              );
              assert.ok(
                measured.ratio >= 0.7,
                'Markdown source viewport must own at least70% of actual document area',
              );
              assert.ok(
                measured.left >= measured.visible.left - tolerance &&
                  measured.top >= measured.visible.top - tolerance &&
                  measured.right <= measured.visible.right + tolerance &&
                  measured.bottom <= measured.visible.bottom + tolerance,
                'Markdown source viewport must fit the actual modeled native frame',
              );
              assert.equal(
                measured.hit,
                true,
                'Markdown source input point must hit the actual current editor',
              );
              assert.ok(
                measured.fullWorkareaRatio >= 0.7,
                'Current source must retain at least70% of the full document workarea after transitions: ' +
                  measured.fullWorkareaRatio,
              );
              assert.ok(
                measured.name,
                'Current source surface requires an actual mounted accessible name',
              );
              for (const mode of measured.hiddenModes) {
                assert.equal(
                  mode.display,
                  'none',
                  'A retained hidden Markdown mode must not occupy document space',
                );
                assert.equal(mode.width, 0);
                assert.equal(mode.height, 0);
              }
              return measured;
            };
            const exerciseDiagramTools = async function (scope) {
              const canvasSelector = scope + ' .diagram-canvas';
              await page.waitForFunction(
                function (selector) {
                  const canvas = document.querySelector(selector);
                  return canvas && canvas.dataset.previewReady === 'true';
                },
                {},
                canvasSelector,
              );
              await click('More diagram tools', scope + ' button');
              const buttons =
                '.task-surface[data-state="open"].diagram-tools button';
              await page.waitForSelector(buttons);
              await audit(buttons, 'diagram-tools');
              const viewport = function () {
                return page.$eval(canvasSelector, function (node) {
                  return {
                    mode: node.dataset.viewportMode,
                    scale: Number(node.dataset.viewportScale),
                  };
                });
              };
              await click('Fit', buttons);
              assert.equal((await viewport()).mode, 'fit');
              const fitted = (await viewport()).scale;
              assert.ok(fitted > 0);
              await click('Zoom in', buttons);
              const enlarged = await viewport();
              assert.equal(enlarged.mode, 'custom');
              assert.ok(Math.abs(enlarged.scale - fitted * 1.25) < 0.000001);
              await click('Zoom out', buttons);
              assert.ok(Math.abs((await viewport()).scale - fitted) < 0.000001);
              await click('Fit', buttons);
              assert.equal((await viewport()).mode, 'fit');
              await click('Close Diagram tools', buttons);
              await page.waitForFunction(function () {
                return (
                  document.activeElement &&
                  document.activeElement.getAttribute('aria-label') ===
                    'More diagram tools'
                );
              });
              row.outcomes.push({
                id: 'CTRL-032/033/064',
                scope: scope,
                more_fit_zoom: true,
                same_viewport_effects: true,
              });
            };
            const fill = async function (selector, value) {
              await page.waitForSelector(selector);
              await page.$eval(selector, function (node) {
                node.scrollIntoView({ block: 'center', inline: 'nearest' });
                node.focus();
              });
              await page.keyboard.down('Control');
              await page.keyboard.press('a');
              await page.keyboard.up('Control');
              if (value) await page.keyboard.type(value);
              else await page.keyboard.press('Backspace');
            };
            const open = async function (kind) {
              await page.evaluate(function (kind) {
                window.__toolsChoice = kind;
              }, kind);
              await click('Add document');
              await page.waitForSelector('.add-document-menu');
              await click('Open file', '.add-document-menu button');
              await page.waitForFunction(function () {
                const n = document.querySelector('.document-surface');
                return n && n.matches('[id^="panel-android-"]');
              });
            };
            if (group === 'recovery') {
              await page.waitForSelector(
                '.resolution-dialog[data-state="open"]',
              );
              await audit('.resolution-dialog button', 'recovery-decision');
              row.recovery_surface = await page.$eval(
                '.resolution-dialog',
                function (node) {
                  const r = node.getBoundingClientRect();
                  return {
                    left: r.left,
                    top: r.top,
                    right: r.right,
                    bottom: r.bottom,
                    max_height: getComputedStyle(node).maxHeight,
                    visible: window.__toolsVisible,
                  };
                },
              );
              const recoverySurface = row.recovery_surface;
              assert.ok(
                recoverySurface.left >=
                  recoverySurface.visible.left - tolerance &&
                  recoverySurface.top >=
                    recoverySurface.visible.top - tolerance &&
                  recoverySurface.right <=
                    recoverySurface.visible.right + tolerance &&
                  recoverySurface.bottom <=
                    recoverySurface.visible.bottom + tolerance,
                'Recovery task must fit the actual modeled native visible frame',
              );

              const labels = await page.$$eval(
                '.resolution-dialog button',
                function (nodes) {
                  return Array.from(nodes).map(function (node) {
                    return node.textContent.trim();
                  });
                },
              );
              assert.deepEqual(labels, [
                'Recover',
                'Decline recovery',
                'Not now',
              ]);
              await click('Not now', '.resolution-dialog button');
              await page.waitForSelector('.resolution-dialog', {
                hidden: true,
              });
              const calls = await page.evaluate(function () {
                return window.__toolsRecoveryCalls;
              });
              assert.ok(calls.includes('inventory_recovery'));
              assert.equal(
                calls.includes('remove_recovery'),
                false,
                'Not now must retain the recovery record',
              );
              assert.equal(
                calls.includes('load_recovery'),
                false,
                'Not now must defer opening the record',
              );
              row.outcomes.push({
                recovery_actions: labels,
                not_now_dismissed: true,
                record_retained: true,
                native_boundary: 'synthetic_recovery_inventory',
              });
              assert.deepEqual(row.errors, []);
              row.status = 'passed';
              continue;
            }
            if (group === 'draft') {
              await click('Add document');
              await page.waitForSelector('.add-document-menu');
              await click('New text file', '.add-document-menu button');
            } else
              await open(
                group === 'markdown'
                  ? 'markdown'
                  : group === 'mermaid'
                    ? 'mermaid'
                    : group === 'large'
                      ? 'large'
                      : 'text',
              );
            await page.waitForSelector(
              group === 'mermaid'
                ? '.diagram-canvas'
                : group === 'markdown'
                  ? '.markdown-document h1'
                  : group === 'large'
                    ? '.large-text-content'
                    : '.cm-scroller',
            );
            await page.evaluate(function () {
              return new Promise(function (resolve) {
                requestAnimationFrame(function () {
                  requestAnimationFrame(resolve);
                });
              });
            });
            row.identity_color = await page.$eval(
              '.active-document-identity',
              function (node) {
                const style = getComputedStyle(node);
                let ancestor = node;
                let background;
                while (ancestor) {
                  const painted = getComputedStyle(ancestor).backgroundColor;
                  if (
                    painted !== 'rgba(0, 0, 0, 0)' &&
                    painted !== 'transparent'
                  ) {
                    background = painted;
                    break;
                  }
                  ancestor = ancestor.parentElement;
                }
                if (!background)
                  throw Error('Document identity has no painted background');
                return {
                  name: 'Document identity',
                  foreground: style.color,
                  background,
                  behind: background,
                  opacity: Number(style.opacity),
                  expectedForeground: getComputedStyle(document.documentElement)
                    .getPropertyValue('--gl-fg')
                    .trim(),
                };
              },
            );
            row.frame_position_before = await page.$eval(
              '[data-bb-app-frame]',
              function (node) {
                const box = node.getBoundingClientRect();
                return {
                  left: box.left,
                  top: box.top,
                  width: box.width,
                  height: box.height,
                };
              },
            );
            row.add_clearance = await page.evaluate(function () {
              const frame = document.querySelector('[data-bb-app-frame]');
              const surface = document.querySelector('.document-surface');
              const trigger = document.querySelector('.add-document-trigger');
              return {
                measured: Number.parseFloat(
                  getComputedStyle(frame).getPropertyValue(
                    '--gl-add-document-clearance',
                  ),
                ),
                padding: Number.parseFloat(
                  getComputedStyle(surface).paddingBottom,
                ),
                header: !!trigger.closest('.shell-chrome'),
                triggerHeight: trigger.getBoundingClientRect().height,
              };
            });
            assert.ok(
              Number.isFinite(row.add_clearance.measured),
              'Actual Add clearance must have a measured authority',
            );
            assert.ok(
              Math.abs(
                row.add_clearance.padding - row.add_clearance.measured,
              ) <= tolerance,
              'Document space must consume actual measured Add clearance exactly once',
            );
            if (row.add_clearance.header)
              assert.equal(
                row.add_clearance.measured,
                0,
                'Header Add must not reserve a bottom dock',
              );
            else
              assert.ok(
                row.add_clearance.measured >=
                  row.add_clearance.triggerHeight - tolerance,
                'A floating Add must retain measured obstruction clearance',
              );
            row.document_viewport = await page.evaluate(function (group) {
              const selector =
                group === 'markdown'
                  ? '.markdown-document'
                  : group === 'mermaid'
                    ? '.diagram-canvas'
                    : group === 'large'
                      ? '.large-text-content'
                      : '.cm-scroller';
              const node = document.querySelector(selector);
              if (!node) return null;
              const rect = node.getBoundingClientRect();
              const documentArea = document
                .querySelector('.document-surface')
                .getBoundingClientRect();
              const ancestors = [];
              for (
                let current = node;
                current && current !== document.documentElement;
                current = current.parentElement
              ) {
                const box = current.getBoundingClientRect();
                const style = getComputedStyle(current);
                ancestors.push({
                  className: current.className,
                  top: box.top,
                  bottom: box.bottom,
                  height: box.height,
                  display: style.display,
                  flex: style.flex,
                  gridRows: style.gridTemplateRows,
                  paddingTop: style.paddingTop,
                  paddingBottom: style.paddingBottom,
                  overflowY: style.overflowY,
                });
              }
              return {
                selector,
                width: rect.width,
                height: rect.height,
                clientHeight: node.clientHeight,
                documentHeight: documentArea.height,
                ratio: rect.height / documentArea.height,
                ancestors,
              };
            }, group);
            assert.ok(
              row.document_viewport &&
                row.document_viewport.width > 0 &&
                row.document_viewport.height > 0 &&
                row.document_viewport.clientHeight > 0,
              'The current document must retain a nonzero viewing/editing viewport before tools open',
            );
            assert.ok(
              row.document_viewport.ratio >= 0.7,
              'The current viewport must own at least70% of actual document area: ' +
                row.document_viewport.ratio,
            );
            if (group === 'draft') {
              assert.equal(
                await page.$eval('.cm-content', function (node) {
                  return node.getAttribute('contenteditable');
                }),
                'true',
              );
              await page.$eval('.cm-content', function (node) {
                node.focus();
              });
              await page.keyboard.type('draft current');
              await page.evaluate(function () {
                window.__draftEnter = null;
                document.addEventListener(
                  'keydown',
                  function (event) {
                    if (event.key === 'Enter')
                      window.__draftEnter = {
                        editor: Boolean(event.target.closest('.cm-content')),
                        prevented: event.defaultPrevented,
                        trusted: event.isTrusted,
                        code: event.code,
                      };
                  },
                  { once: true },
                );
              });
              await page.keyboard.press('Enter');
              await page.waitForFunction(function () {
                return (
                  Array.from(document.querySelectorAll('.cm-content .cm-line'))
                    .map(function (node) {
                      return node.textContent;
                    })
                    .join('\n') === 'draft current\n'
                );
              });
              row.enter_observation = await page.evaluate(function () {
                return {
                  event: window.__draftEnter,
                  lines: Array.from(
                    document.querySelectorAll('.cm-content .cm-line'),
                  ).map(function (n) {
                    return n.textContent;
                  }),
                  focus:
                    document.activeElement && document.activeElement.className,
                  inert: Boolean(
                    document.activeElement &&
                    document.activeElement.closest('[inert]'),
                  ),
                };
              });
              await page.keyboard.type('second');
              await command('Copy');
              await page.waitForFunction(function () {
                return window.__toolsClipboard !== null;
              });
              row.draft_copy = await page.evaluate(function () {
                return window.__toolsClipboard;
              });
              assert.equal(row.draft_copy, 'draft current\nsecond');
              assert.equal(
                await page.$$eval('.cm-content .cm-line', function (nodes) {
                  return nodes
                    .map(function (node) {
                      return node.textContent;
                    })
                    .join('\n');
                }),
                'draft current\nsecond',
              );
              row.outcomes.push({
                id: 'CTRL-006/041',
                cold_new_text: true,
                exact_multiline: true,
              });
              await click('Add document');
              await page.waitForSelector('.add-document-menu');
              await click('New Markdown', '.add-document-menu button');
              const source = await assertMarkdownSource('cold-new-markdown');
              await page.mouse.click(source.x, source.y);
              assert.equal(
                await page.$eval(
                  '.markdown-source-mode:not([hidden]) .cm-content',
                  function (node) {
                    return document.activeElement === node;
                  },
                ),
                true,
                'Real Markdown pointer input must focus the editor',
              );
              await page.keyboard.type('Markdown draft');
              await page.keyboard.press('Enter');
              await page.waitForFunction(function () {
                return (
                  Array.from(
                    document.querySelectorAll(
                      '.markdown-source-mode:not([hidden]) .cm-content .cm-line',
                    ),
                  )
                    .map(function (node) {
                      return node.textContent;
                    })
                    .join('\n') === 'Markdown draft\n'
                );
              });
              await page.keyboard.type('second line');
              const exactSource = await page.$$eval(
                '.markdown-source-mode:not([hidden]) .cm-content .cm-line',
                function (nodes) {
                  return nodes
                    .map(function (node) {
                      return node.textContent;
                    })
                    .join('\n');
                },
              );
              assert.equal(exactSource, 'Markdown draft\nsecond line');
              await command('Copy');
              assert.equal(
                await page.evaluate(function () {
                  return window.__toolsClipboard;
                }),
                exactSource,
              );
              await command('Read');
              await page.waitForSelector(
                '.markdown-rendered-mode:not([hidden]) .markdown-document p',
              );
              await command('Edit');
              await assertMarkdownSource('cold-draft-after-read-edit');
              assert.equal(
                await page.$$eval(
                  '.markdown-source-mode:not([hidden]) .cm-content .cm-line',
                  function (nodes) {
                    return nodes
                      .map(function (node) {
                        return node.textContent;
                      })
                      .join('\n');
                  },
                ),
                exactSource,
              );
              row.outcomes.push({
                id: 'CTRL-005/041/054',
                cold_new_markdown: true,
                actual_pointer_keyboard: true,
                rapid_enter_without_wait: true,
                authoritative_copy: true,
                exact_multiline: true,
                read_edit_retains_bytes: true,
              });
            } else if (group === 'editor') {
              await page.waitForSelector('.cm-content');
              await command('Document details');
              await audit(
                '.editor-details-task select,.editor-details-task button',
                'language',
              );
              const languages = await page.$eval(
                '[aria-label="Language mode"]',
                function (node) {
                  return Array.from(node.options).map(function (option) {
                    return option.value;
                  });
                },
              );
              assert.equal(languages.length, 11);
              const sourceBeforeLanguage = await page.$$eval(
                '.cm-content .cm-line',
                function (nodes) {
                  return Array.from(nodes)
                    .map(function (node) {
                      return node.textContent;
                    })
                    .join('\n');
                },
              );
              for (const language of [...languages, 'automatic']) {
                await page.select('[aria-label="Language mode"]', language);
                await page.evaluate(function () {
                  return new Promise(function (resolve) {
                    requestAnimationFrame(function () {
                      requestAnimationFrame(resolve);
                    });
                  });
                });
                assert.equal(
                  await page.$eval(
                    '[aria-label="Language mode"]',
                    function (node) {
                      return node.value;
                    },
                  ),
                  language,
                  'Language selection must retain its actual value after effects settle',
                );
              }
              assert.equal(
                await page.$$eval('.cm-content .cm-line', function (nodes) {
                  return Array.from(nodes)
                    .map(function (node) {
                      return node.textContent;
                    })
                    .join('\n');
                }),
                sourceBeforeLanguage,
                'Language changes must retain exact current source',
              );
              row.outcomes.push({
                id: 'CTRL-043',
                choices: languages,
                automatic_restored: true,
                source_unchanged: true,
              });
              await click('Close Document details');
              await command('Search');
              await page.waitForSelector('.cm-search');
              await fill('.cm-search input[name=search]', 'cat');
              await page.evaluate(function () {
                window.__toolsTabs = [];
                window.__toolsTabObserver = function (event) {
                  if (event.key === 'Tab')
                    window.__toolsTabs.push({
                      shift: event.shiftKey,
                      prevented: event.defaultPrevented,
                    });
                };
                document.addEventListener('keydown', window.__toolsTabObserver);
              });
              await page.keyboard.press('Tab');
              assert.equal(
                await page.$eval(
                  '.cm-search input[name=search]',
                  function (node) {
                    return node === document.activeElement;
                  },
                ),
                false,
              );
              await page.keyboard.down('Shift');
              await page.keyboard.press('Tab');
              await page.keyboard.up('Shift');
              assert.equal(
                await page.$eval(
                  '.cm-search input[name=search]',
                  function (node) {
                    return node === document.activeElement;
                  },
                ),
                true,
              );
              assert.deepEqual(
                await page.evaluate(function () {
                  document.removeEventListener(
                    'keydown',
                    window.__toolsTabObserver,
                  );
                  return window.__toolsTabs;
                }),
                [
                  { shift: false, prevented: false },
                  { shift: true, prevented: false },
                ],
              );
              assert.equal(
                await page.$$eval('.cm-content .cm-line', function (nodes) {
                  return nodes
                    .map(function (node) {
                      return node.textContent;
                    })
                    .join('\n');
                }),
                'cat Cat scatter cat\nsecond line\n',
              );
              row.outcomes.push({
                id: 'CTRL-029-case-4/CTRL-030-case-4',
                auxiliary_tab_focus: true,
                auxiliary_shift_tab_focus: true,
                exact_source_unchanged: true,
              });
              await page.keyboard.press('Tab');
              await page.waitForFunction(function () {
                return document
                  .getElementById('editor-search-results')
                  .textContent.includes('4 matches');
              });
              await audit('.cm-search input,.cm-search button', 'find');
              await click('Match case', '.cm-search label');
              await page.waitForFunction(function () {
                return document
                  .getElementById('editor-search-results')
                  .textContent.includes('3 matches');
              });
              await click('Whole word', '.cm-search label');
              await page.waitForFunction(function () {
                return document
                  .getElementById('editor-search-results')
                  .textContent.includes('2 matches');
              });
              await click('Regular expression', '.cm-search label');
              await fill('.cm-search input[name=search]', '[');
              await page.keyboard.press('Tab');
              await page.waitForFunction(function () {
                return document
                  .getElementById('editor-search-results')
                  .textContent.includes('Invalid regular expression');
              });
              row.outcomes.push({
                id: 'CTRL-044-048',
                counts: [4, 3, 2],
                invalid_regex: true,
              });
              await fill('.cm-search input[name=search]', 'cat');
              await page.keyboard.press('Tab');
              await click('Regular expression', '.cm-search label');
              await fill('.cm-search input[name=replace]', 'dog');
              await page.keyboard.press('Tab');
              const textOfEditor = function () {
                return page.$$eval('.cm-content .cm-line', function (lines) {
                  return Array.from(lines)
                    .map(function (line) {
                      return line.textContent;
                    })
                    .join('\n');
                });
              };
              const originalText = 'cat Cat scatter cat\nsecond line\n';
              assert.equal(await textOfEditor(), originalText);
              await click('Select all matches', '.cm-search button');
              assert.equal(
                await page.$eval('.cm-editor', function (node) {
                  return Number(node.dataset.editorSelectionCount);
                }),
                2,
              );
              await click('Next', '.cm-search button');
              const range = await page.$eval('.cm-editor', function (node) {
                return {
                  from: Number(node.dataset.editorSelectionFrom),
                  to: Number(node.dataset.editorSelectionTo),
                };
              });
              assert.equal(originalText.slice(range.from, range.to), 'cat');
              await click('Replace next', '.cm-search button');
              assert.equal(
                await textOfEditor(),
                originalText.slice(0, range.from) +
                  'dog' +
                  originalText.slice(range.to),
              );
              await click('Close search', '.cm-search button');
              await command('Undo');
              assert.equal(await textOfEditor(), originalText);
              await command('Search');
              await page.waitForSelector('.cm-search');
              await fill('.cm-search input[name=replace]', 'dog');
              await page.keyboard.press('Tab');
              await click('Replace all', '.cm-search button');
              const replacedText = 'dog Cat scatter dog\nsecond line\n';
              assert.equal(await textOfEditor(), replacedText);
              await click('Close search', '.cm-search button');
              await command('Undo');
              assert.equal(await textOfEditor(), originalText);
              await command('Redo');
              assert.equal(await textOfEditor(), replacedText);
              await command('Go to line');
              await page.waitForSelector(
                '.task-surface input[inputmode=numeric]',
              );
              await audit('.task-surface input,.task-surface button', 'line');
              await fill('.task-surface input[inputmode=numeric]', '999');
              await click('Go', '.task-surface button');
              await page.waitForSelector('[aria-invalid=true]');
              await fill('.task-surface input[inputmode=numeric]', '2');
              await click('Go', '.task-surface button');
              await page.waitForFunction(function () {
                const node = document.querySelector('.cm-editor');
                return node && Number(node.dataset.editorSelectionFrom) === 20;
              });
              await command('Go to line');
              await fill('.task-surface input[inputmode=numeric]', '1');
              await click('Cancel', '.task-surface button');
              assert.equal(
                await page.$eval('.cm-editor', function (node) {
                  return Number(node.dataset.editorSelectionFrom);
                }),
                20,
              );
              row.outcomes.push({
                id: 'CTRL-049-053',
                replacement_history: true,
                invalid_line: true,
              });
            } else if (group === 'markdown') {
              await page.waitForSelector(
                '.markdown-rendered-mode:not([hidden]) .markdown-document h1',
              );
              await page.waitForFunction(function () {
                const figure = document.querySelector('.embedded-mermaid');
                const canvas =
                  figure &&
                  figure.querySelector(
                    '.diagram-canvas[data-preview-ready=true]',
                  );
                const image = canvas && canvas.querySelector('img');
                return Boolean(
                  image && image.complete && image.naturalWidth > 0,
                );
              });
              await audit(
                '.markdown-document [role=link],.markdown-document button,.markdown-document input',
                'links',
              );
              await click('unknown fragment', '.markdown-document [role=link]');
              await page.waitForFunction(function () {
                return Array.from(
                  document.querySelectorAll('[role=alert]'),
                ).some(function (node) {
                  return (
                    node.textContent ===
                    'The linked section is not available in this document.'
                  );
                });
              });
              row.fragment_feedback_viewport = await page.evaluate(function () {
                const article = document
                  .querySelector('.markdown-document')
                  .getBoundingClientRect();
                const surface = document
                  .querySelector('.document-surface')
                  .getBoundingClientRect();
                return {
                  height: article.height,
                  surface_height: surface.height,
                  ratio: article.height / surface.height,
                };
              });
              assert.ok(
                row.fragment_feedback_viewport.ratio >= 0.7,
                'Fragment feedback must preserve at least70% of actual document area',
              );
              row.fragment_feedback_words = [];
              for (const edge of ['first', 'last']) {
                const word = await page.evaluate(function (edge) {
                  const notice = document.querySelector(
                    '.markdown-fragment-feedback',
                  );
                  const article = notice.closest('.markdown-document');
                  const text = notice.firstChild;
                  const range = document.createRange();
                  range.setStart(
                    text,
                    edge === 'first' ? 0 : Math.max(0, text.length - 9),
                  );
                  range.setEnd(text, edge === 'first' ? 3 : text.length);
                  const initial = range.getBoundingClientRect(),
                    box = article.getBoundingClientRect();
                  article.scrollTop = Math.max(
                    0,
                    article.scrollTop +
                      initial.top -
                      box.top -
                      (article.clientHeight - initial.height) / 2,
                  );
                  const result = range.getBoundingClientRect(),
                    current = article.getBoundingClientRect();
                  const hit = document.elementFromPoint(
                    (result.left + result.right) / 2,
                    (result.top + result.bottom) / 2,
                  );
                  return {
                    edge: edge,
                    left: result.left,
                    right: result.right,
                    top: result.top,
                    bottom: result.bottom,
                    width: result.width,
                    height: result.height,
                    hit: hit === notice || notice.contains(hit),
                    visible: {
                      left: Math.max(current.left, window.__toolsVisible.left),
                      right: Math.min(
                        current.right,
                        window.__toolsVisible.right,
                      ),
                      top: Math.max(current.top, window.__toolsVisible.top),
                      bottom: Math.min(
                        current.bottom,
                        window.__toolsVisible.bottom,
                      ),
                    },
                  };
                }, edge);
                row.fragment_feedback_words.push(word);
                assert.ok(
                  word.width > 0 &&
                    word.height > 0 &&
                    word.left >= word.visible.left - tolerance &&
                    word.right <= word.visible.right + tolerance &&
                    word.top >= word.visible.top - tolerance &&
                    word.bottom <= word.visible.bottom + tolerance &&
                    word.hit,
                  'Fragment feedback ' +
                    edge +
                    ' word must be readable through ordinary article scrolling',
                );
              }
              assert.equal(
                await page.evaluate(function () {
                  return location.hash;
                }),
                '',
              );
              await click('fragment', '.markdown-document [role=link]');
              await page.waitForFunction(function () {
                return !Array.from(
                  document.querySelectorAll('[role=alert]'),
                ).some(function (node) {
                  return (
                    node.textContent ===
                    'The linked section is not available in this document.'
                  );
                });
              });
              row.outcomes.push({
                id: 'CTRL-057-case-7',
                unknown_fragment_feedback: true,
                valid_fragment_clears_feedback: true,
              });
              const footnoteNames = await page.evaluate(function () {
                return {
                  reference: document
                    .querySelector('[data-footnote-ref]')
                    .getAttribute('aria-label'),
                  backlink: document
                    .querySelector('[data-footnote-backref]')
                    .getAttribute('aria-label'),
                };
              });
              assert.equal(footnoteNames.reference, 'Footnote reference');
              assert.equal(
                footnoteNames.backlink,
                'Return to footnote reference',
              );
              await click(
                footnoteNames.reference,
                '.markdown-document [role=link]',
              );
              assert.equal(
                await page.evaluate(function () {
                  return (
                    document.activeElement.id ===
                    document
                      .querySelector('[data-footnote-ref]')
                      .getAttribute('title')
                      .slice(1)
                  );
                }),
                true,
              );
              await click(
                footnoteNames.backlink,
                '.markdown-document [role=link]',
              );
              assert.equal(
                await page.evaluate(function () {
                  return (
                    document.activeElement ===
                    document.querySelector('[data-footnote-ref]')
                  );
                }),
                true,
              );
              row.outcomes.push({
                id: 'CTRL-057',
                footnote_names: footnoteNames,
                reference_and_backlink_focus: true,
              });
              await exerciseDiagramTools('.embedded-mermaid');
              await command('Search');
              await fill('.markdown-search input', 'body');
              await audit(
                '.markdown-search input,.markdown-search button',
                'rendered-find',
              );
              await click('Next', '.markdown-search button');
              await click('Previous', '.markdown-search button');
              await click('Close search', '.markdown-search button');
              await command('Outline');
              await audit('.task-surface button', 'outline');
              await click('Heading', '.markdown-outline button');
              await page.waitForFunction(function () {
                return (
                  document.activeElement &&
                  document.activeElement.tagName === 'H1'
                );
              });
              row.frame_position_after_outline = await page.$eval(
                '[data-bb-app-frame]',
                function (node) {
                  const box = node.getBoundingClientRect();
                  return {
                    left: box.left,
                    top: box.top,
                    width: box.width,
                    height: box.height,
                  };
                },
              );
              assert.ok(
                Math.abs(
                  row.frame_position_after_outline.top -
                    row.frame_position_before.top,
                ) <= tolerance &&
                  Math.abs(
                    row.frame_position_after_outline.left -
                      row.frame_position_before.left,
                  ) <= tolerance,
                'Outline navigation must keep the outer AppFrame stationary',
              );
              const nativeLinkTargets = [];
              for (const destination of [
                'https://example.com/path',
                'mailto:fixture@example.com',
              ]) {
                const selector =
                  '.markdown-document button[title=' +
                  JSON.stringify(destination) +
                  ']';
                const name = await page.$eval(selector, function (node) {
                  return node.textContent.trim();
                });
                const target = await page.evaluate(
                  nativeTapTargetScript(nativeTapSource, name, selector),
                );
                assert.equal(
                  target.found,
                  true,
                  'Actual native selector must resolve the full link name: ' +
                    name,
                );
                assert.ok(
                  target.width >= 48 - tolerance &&
                    target.height >= 48 - tolerance &&
                    target.fully_visible &&
                    target.hit &&
                    !target.disabled,
                  'Native selector must retain the real usable control target',
                );
                nativeLinkTargets.push({ destination, name, target });
              }
              row.outcomes.push({
                id: 'CTRL-056',
                native_selector_targets: nativeLinkTargets,
                scope:
                  'Actual Kotlin selector against production React markup; no Android touch dispatched',
              });
              const linkDocumentId = await page.$eval(
                '.document-surface',
                (n) => n.id,
              );
              for (const link of [
                {
                  name: 'destination External destination https://example.com/path',
                  destination: 'https://example.com/path',
                },
                {
                  name: 'email External destination mailto:fixture@example.com',
                  destination: 'mailto:fixture@example.com',
                },
              ]) {
                for (const route of ['Cancel', 'Escape']) {
                  await click(link.name, '.markdown-document button');
                  await page.waitForFunction(
                    function (destination) {
                      const dialog = document.querySelector(
                        '.markdown-link-task[data-state="open"]',
                      );
                      return (
                        !!dialog &&
                        dialog.querySelector('.markdown-link-destination')
                          .textContent === destination
                      );
                    },
                    {},
                    link.destination,
                  );
                  if (route === 'Cancel')
                    await audit('.task-surface button', 'external-link');
                  if (route === 'Cancel')
                    await click('Cancel', '.task-surface button');
                  else await page.keyboard.press('Escape');
                  await page.waitForFunction(
                    function (name, documentId) {
                      const opener = Array.from(
                        document.querySelectorAll('.markdown-document button'),
                      ).find((n) => n.textContent.trim() === name);
                      return (
                        !document.querySelector('.markdown-link-task') &&
                        !!opener &&
                        document.activeElement === opener &&
                        document.querySelector('.document-surface').id ===
                          documentId
                      );
                    },
                    {},
                    link.name,
                    linkDocumentId,
                  );
                  row.outcomes.push({
                    id: 'CTRL-060',
                    route,
                    destination: link.destination,
                    opener_focus: true,
                    document_identity_retained: true,
                    limit:
                      'Real browser Cancel/Escape lifecycle; native Back qualification is separate.',
                  });
                }
              }
              await click('View source', '.embedded-mermaid button');
              await assertMarkdownSource('embedded-view-source');
              await command('Copy');
              await page.waitForFunction(function () {
                return (
                  window.__toolsClipboard ===
                  '~~~mermaid\nflowchart TB\n  Alpha --> Beta\n~~~'
                );
              });
              await command('Read');
              await page.waitForSelector(
                '.markdown-rendered-mode:not([hidden]) .markdown-document h1',
              );
              row.outcomes.push({
                id: 'CTRL-062',
                embedded_valid_preview: true,
                exact_selected_fence: true,
              });
              const retainedArticle = await page.$(
                '.markdown-rendered-mode:not([hidden]) .markdown-document',
              );
              const retainedArticlePosition = await page.evaluate(function (
                node,
              ) {
                return { top: node.scrollTop, left: node.scrollLeft };
              }, retainedArticle);
              await command('Edit');
              await assertMarkdownSource('document-edit');
              const before = await page.$eval('.cm-content', function (n) {
                return n.textContent;
              });
              await command('Read');
              await page.waitForSelector(
                '.markdown-rendered-mode:not([hidden]) .markdown-document h1',
              );
              await page.waitForFunction(function () {
                const active = document.activeElement;
                const rect = active && active.getBoundingClientRect();
                return (
                  !!active &&
                  active !== document.body &&
                  !active.closest('[hidden],[inert],[aria-hidden=true]') &&
                  !!rect &&
                  rect.width > 0 &&
                  rect.height > 0
                );
              });
              const articleRetention = await page.evaluate(function (original) {
                const current = document.querySelector(
                  '.markdown-rendered-mode:not([hidden]) .markdown-document',
                );
                const active = document.activeElement;
                const rect = active && active.getBoundingClientRect();
                return {
                  same: current === original,
                  top: current.scrollTop,
                  left: current.scrollLeft,
                  usableFocus:
                    !!active &&
                    active !== document.body &&
                    !active.closest('[hidden],[inert],[aria-hidden=true]') &&
                    !!rect &&
                    rect.width > 0 &&
                    rect.height > 0,
                };
              }, retainedArticle);
              row.normal_read_edit_retention = articleRetention;
              assert.equal(
                articleRetention.same,
                true,
                'Normal Read/Edit must retain the actual rendered article',
              );
              assert.equal(
                articleRetention.top,
                retainedArticlePosition.top,
                'Normal Read/Edit must retain rendered vertical position',
              );
              assert.equal(
                articleRetention.left,
                retainedArticlePosition.left,
                'Normal Read/Edit must retain rendered horizontal position',
              );
              assert.equal(
                articleRetention.usableFocus,
                true,
                'Normal Read/Edit must retain usable foreground focus',
              );
              await retainedArticle.dispose();
              await command('Edit');
              assert.equal(
                await page.$eval('.cm-content', function (n) {
                  return n.textContent;
                }),
                before,
              );
              row.outcomes.push({
                id: 'CTRL-034/054-062/115',
                modes: true,
                outline_focus: true,
                external_cancel: true,
                passive_tasks: true,
              });
            } else if (group === 'mermaid') {
              await page.waitForSelector('.diagram-image');
              await exerciseDiagramTools('.mermaid-surface');
              await command('Search');
              await fill('.mermaid-search input', 'Alpha');
              await audit(
                '.mermaid-search input,.mermaid-search button',
                'diagram-find',
              );
              await click('Next match', '.mermaid-search button');
              await click('Previous match', '.mermaid-search button');
              assert.ok(
                (
                  await page.$eval('.mermaid-search mark', function (n) {
                    return n.textContent;
                  })
                ).includes('Alpha'),
              );
              await click('Close search', '.mermaid-search button');
              await command('Edit');
              await page.waitForSelector('.cm-content');
              await command('Read');
              const sourceBeforeCopy = await page.$eval(
                '.document-surface',
                function (node) {
                  return node.id;
                },
              );
              await page.evaluate(function () {
                window.__toolsReadOnly = true;
                window.__toolsChoice = 'mermaid';
              });
              await click('Add document');
              await page.waitForSelector('.add-document-menu');
              await click('Open file', '.add-document-menu button');
              await page.waitForFunction(
                function (previous) {
                  return (
                    document.querySelector('.document-surface').id !== previous
                  );
                },
                {},
                sourceBeforeCopy,
              );
              await page.waitForSelector(
                '.mermaid-rendered-mode[data-performance-ready=true]',
              );
              const originalProvider = await page.evaluate(function () {
                return window.__toolsLastSourceId;
              });
              const sourceBytes = await page.evaluate(function (id) {
                return window.__TAURI_INTERNALS__.invoke('read_android_range', {
                  sourceId: id,
                  offset: 0,
                  length: 65536,
                });
              }, originalProvider);
              await command('Edit a copy');
              row.copy_phase = 'editable_copy';
              await page.waitForSelector('.document-tools-menu', {
                hidden: true,
              });
              await page.waitForSelector(
                '.mermaid-source-mode .cm-content[contenteditable=true]',
              );
              const copyTarget = await captureTaskControl(
                page,
                '.mermaid-source-mode .cm-content',
                0,
              );
              row.copy_target = copyTarget;
              const copyPoint = await page.$eval(
                '.mermaid-source-mode .cm-content',
                function (node) {
                  const r = node.getBoundingClientRect();
                  const s = node
                    .closest('.cm-scroller')
                    .getBoundingClientRect();
                  const left = Math.max(r.left, s.left, 0),
                    right = Math.min(r.right, s.right, innerWidth),
                    top = Math.max(r.top, s.top, 0),
                    bottom = Math.min(r.bottom, s.bottom, innerHeight);
                  const x = left + Math.min(16, (right - left) / 2),
                    y = top + Math.min(16, (bottom - top) / 2),
                    hit = document.elementFromPoint(x, y);
                  return { x, y, hit: hit === node || node.contains(hit) };
                },
              );
              assert.equal(
                copyPoint.hit,
                true,
                'Mermaid source input must use an actual visible editor point',
              );
              await page.mouse.click(copyPoint.x, copyPoint.y);
              await page.keyboard.down('Control');
              await page.keyboard.press('a');
              await page.keyboard.up('Control');
              await page.keyboard.type('flowchart TB');
              row.copy_phase = 'typed_header';
              await page.waitForFunction(function () {
                return (
                  Array.from(
                    document.querySelectorAll(
                      '.mermaid-source-mode .cm-content .cm-line',
                    ),
                  )
                    .map(function (n) {
                      return n.textContent;
                    })
                    .join('\n') === 'flowchart TB'
                );
              });
              await page.keyboard.press('Enter');
              row.copy_enter_observation = await page.evaluate(function () {
                const editor = document.querySelector(
                  '.mermaid-source-mode .cm-content',
                );
                const node = editor && editor.closest('.cm-editor');
                return {
                  text: Array.from(
                    editor ? editor.querySelectorAll('.cm-line') : [],
                  )
                    .map(function (n) {
                      return n.textContent;
                    })
                    .join('\n'),
                  focused: document.activeElement === editor,
                  active: document.activeElement
                    ? document.activeElement.getAttribute('aria-label')
                    : null,
                  from: node
                    ? node.getAttribute('data-editor-selection-from')
                    : null,
                  to: node
                    ? node.getAttribute('data-editor-selection-to')
                    : null,
                };
              });
              row.copy_phase = 'first_newline';
              await page.waitForFunction(function () {
                return (
                  Array.from(
                    document.querySelectorAll(
                      '.mermaid-source-mode .cm-content .cm-line',
                    ),
                  )
                    .map(function (n) {
                      return n.textContent;
                    })
                    .join('\n') === 'flowchart TB\n'
                );
              });
              await page.keyboard.type('  Alpha --> CopyResult');
              const copiedText = 'flowchart TB\n  Alpha --> CopyResult';
              row.copy_phase = 'exact_source';
              row.copy_observation = await page.evaluate(function () {
                const root = document.querySelector('.mermaid-surface');
                const editor = document.querySelector(
                  '.mermaid-source-mode .cm-content',
                );
                return {
                  mode: root ? root.className : null,
                  text: Array.from(
                    editor ? editor.querySelectorAll('.cm-line') : [],
                  )
                    .map(function (n) {
                      return n.textContent;
                    })
                    .join('\n'),
                  focused: document.activeElement === editor,
                };
              });
              await page.waitForFunction(
                function (expected) {
                  return (
                    Array.from(
                      document.querySelectorAll(
                        '.mermaid-source-mode .cm-content .cm-line',
                      ),
                    )
                      .map(function (n) {
                        return n.textContent;
                      })
                      .join('\n') === expected
                  );
                },
                {},
                copiedText,
              );
              const copyState = await page.$eval(
                '.mermaid-source-mode .cm-editor',
                function (node) {
                  window.__mermaidCopyEditor = node;
                  return {
                    from: node.dataset.editorSelectionFrom,
                    to: node.dataset.editorSelectionTo,
                    undo: node.dataset.editorUndoDepth,
                    redo: node.dataset.editorRedoDepth,
                  };
                },
              );
              row.copy_phase = 'preview_ready';
              await page.waitForSelector(
                '.mermaid-source-mode[data-performance-ready=true]',
              );
              row.copy_phase = 'render_copy';
              await command('Read');
              await page.waitForFunction(async function () {
                const image = document.querySelector(
                  '.mermaid-rendered-mode .diagram-canvas img',
                );
                if (!image || !image.complete || image.naturalWidth === 0)
                  return false;
                const svg = await fetch(image.src)
                  .then(function (r) {
                    return r.text();
                  })
                  .catch(function () {
                    return '';
                  });
                return svg.includes('CopyResult');
              });
              await command('Edit');
              await page.waitForSelector(
                '.mermaid-source-mode .cm-content[contenteditable=true]',
              );
              const restoredCopy = await page.$eval(
                '.mermaid-source-mode .cm-editor',
                function (node) {
                  return {
                    same: node === window.__mermaidCopyEditor,
                    text: Array.from(node.querySelectorAll('.cm-line'))
                      .map(function (n) {
                        return n.textContent;
                      })
                      .join('\n'),
                    state: {
                      from: node.dataset.editorSelectionFrom,
                      to: node.dataset.editorSelectionTo,
                      undo: node.dataset.editorUndoDepth,
                      redo: node.dataset.editorRedoDepth,
                    },
                  };
                },
              );
              assert.equal(
                restoredCopy.same,
                true,
                'Mermaid copy Read/Edit must retain the actual source editor',
              );
              assert.equal(restoredCopy.text, copiedText);
              assert.deepEqual(restoredCopy.state, copyState);
              const originalAfterCopy = await page.evaluate(function (id) {
                return window.__TAURI_INTERNALS__.invoke('read_android_range', {
                  sourceId: id,
                  offset: 0,
                  length: 65536,
                });
              }, originalProvider);
              assert.deepEqual(
                originalAfterCopy.bytes,
                sourceBytes.bytes,
                'Editing a Mermaid copy must preserve the independent original source bytes',
              );
              row.outcomes.push({
                id: 'CTRL-034/062-063',
                mermaid_copy: true,
                rendered_copy_label: 'CopyResult',
                exact_source: copiedText,
                retained_editor_and_history: true,
                original_unchanged: true,
              });
              row.outcomes.push({
                id: 'CTRL-034/062-063',
                matching_label: true,
                modes: true,
              });
            } else if (group === 'large') {
              await page.waitForFunction(function () {
                const n = document.querySelector('.large-text-content');
                return n && n.textContent.startsWith('target');
              });
              await command('Large text tools');
              await audit(
                '.large-text-task input,.large-text-task button',
                'large-tools',
              );
              await click('Next section');
              await click('Previous section');
              await click('Copy visible section');
              await page.waitForFunction(function () {
                return window.__toolsClipboard !== null;
              });
              assert.equal(
                await page.evaluate(function () {
                  return (
                    window.__toolsClipboard ===
                    document.querySelector('.large-text-content').textContent
                  );
                }),
                true,
              );
              await fill('.large-text-controls input[inputmode=numeric]', '0');
              await click('Go to line');
              await page.waitForFunction(function () {
                return document
                  .getElementById('large-text-status')
                  .textContent.includes('positive whole');
              });
              row.outcomes.push({
                id: 'CTRL-083-088',
                sections: true,
                exact_copy: true,
                invalid_line: true,
              });
            } else if (group === 'metadata') {
              await command('File information');
              await page.waitForSelector('.metadata-content');
              await audit(
                '.task-surface button,.metadata-content summary',
                'metadata',
              );
              await click('Copy File name');
              await page.waitForFunction(function () {
                return window.__toolsClipboard === 'tools.txt';
              });
              await click('Disclose External revision');
              await audit(
                '.metadata-copy-confirmation button',
                'sensitive-copy',
              );
              await click('Cancel', '.metadata-copy-confirmation button');
              await page.waitForFunction(function () {
                return (
                  document.activeElement &&
                  document.activeElement.getAttribute('aria-label') ===
                    'Disclose External revision'
                );
              });
              await click('Disclose External revision');
              await page.waitForSelector('.metadata-copy-confirmation');
              const sensitiveValue = await page.$eval(
                '.metadata-copy-confirmation',
                function (node) {
                  return node
                    .closest('.metadata-fact')
                    .querySelector('.metadata-value').textContent;
                },
              );
              await click('Copy External revision');
              await page.waitForFunction(
                function (value) {
                  return window.__toolsClipboard === value;
                },
                {},
                sensitiveValue,
              );
              const canExpand = await page.evaluate(function () {
                const control = document.querySelector(
                  '[aria-label="Expand information"]',
                );
                return Boolean(
                  control &&
                  control.getBoundingClientRect().width > 0 &&
                  getComputedStyle(control).visibility !== 'hidden',
                );
              });
              if (canExpand) {
                const collapsed = await page.$eval(
                  '.file-info-task',
                  function (node) {
                    return node.getBoundingClientRect().height;
                  },
                );
                await click('Expand information');
                await page.waitForSelector('.file-info-task.expanded');
                const expanded = await page.$eval(
                  '.file-info-task',
                  function (node) {
                    return node.getBoundingClientRect().height;
                  },
                );
                assert.ok(expanded >= collapsed);
                await click('Collapse information');
                await page.waitForFunction(function () {
                  return !document.querySelector('.file-info-task.expanded');
                });
              } else {
                row.outcomes.push({
                  id: 'CTRL-091',
                  disposition: 'wide_nonmodal_information',
                  expand_control_exposed: false,
                });
              }
              await click('Copy available information');
              await page.waitForFunction(function () {
                return (
                  window.__toolsClipboard !== null &&
                  window.__toolsClipboard.indexOf('External revision') < 0
                );
              });
              await click('Calculate SHA-256');
              await page.waitForFunction(function () {
                return document
                  .querySelector('.metadata-content')
                  .textContent.includes('SHA-256');
              });
              row.outcomes.push({
                id: 'CTRL-089-096',
                exact_name_copy: true,
                confirmation_cancel: true,
                expansion: canExpand,
              });
            } else {
              await click('Menu');
              await click('Preferences', '.application-menu button');
              await page.waitForSelector('.preferences-content');
              await audit(
                '.task-surface button,.preferences-content input,.preferences-content select',
                'preferences',
              );
              const themes = ['light', 'dark', 'system'];
              for (const theme of themes)
                await page.select('.preferences-content select', theme);
              await fill('.preferences-content input[type=number]', '');
              await page.keyboard.press('Tab');
              assert.equal(
                await page.$eval(
                  '.preferences-content input[type=number]',
                  function (n) {
                    return n.getAttribute('aria-invalid');
                  },
                ),
                'true',
              );
              await fill('.preferences-content input[type=number]', '24');
              await page.keyboard.press('Tab');
              await click('Reset preferences');
              await audit(
                '.task-surface[data-state=open] button',
                'reset-confirm',
              );
              const waitForResetOpener = async () =>
                page.waitForFunction(function () {
                  const active = document.activeElement;
                  const owner = active && active.closest('[role=dialog]');
                  return (
                    !!active &&
                    active.tagName === 'BUTTON' &&
                    active.textContent.trim() === 'Reset preferences' &&
                    !!owner &&
                    owner.querySelector('h2').textContent === 'Preferences'
                  );
                });
              await click('Cancel reset');
              await waitForResetOpener();
              for (const route of ['Escape', 'header Close']) {
                await click('Reset preferences');
                await page.waitForFunction(function () {
                  const group = document.querySelector(
                    '[aria-label="Reset preferences?"][role=group]',
                  );
                  const dialog = group && group.closest('[role=dialog]');
                  return (
                    !!dialog &&
                    dialog.getAttribute('data-state') === 'open' &&
                    dialog.contains(document.activeElement)
                  );
                });
                if (route === 'Escape') await page.keyboard.press('Escape');
                else await click('Close Reset preferences?');
                await waitForResetOpener();
              }
              await click('Reset preferences');
              await click('Reset settings');
              await page.waitForFunction(function () {
                return document
                  .querySelector('.preferences-content')
                  .textContent.includes('Preferences reset.');
              });
              await waitForResetOpener();
              row.outcomes.push({
                id: 'CTRL-097-104',
                theme_choices: themes,
                numeric_draft: true,
                reset_cancel_and_success: true,
                reset_focus_routes: [
                  'Cancel',
                  'Escape',
                  'header Close',
                  'completion',
                ],
              });
            }
            assert.deepEqual(row.errors, [], 'Production task must not throw');
            row.status = 'passed';
          } catch (error) {
            row.status = 'failed';
            row.message = error.message;
            row.failed_snapshot = await page
              .evaluate(function () {
                return {
                  body_length: document.body.textContent.length,
                  panels: Array.from(
                    document.querySelectorAll('[role=tabpanel]'),
                  ).map(function (n) {
                    return { id: n.id, hidden: n.hidden };
                  }),
                  alerts: Array.from(
                    document.querySelectorAll('[role=alert]'),
                  ).map(function (n) {
                    return n.textContent;
                  }),
                  nativeAdd: document.querySelector('.add-document')
                    ? document
                        .querySelector('.add-document')
                        .getAttribute('data-native-viewport')
                    : null,
                };
              })
              .catch(function () {
                return null;
              });
            failures.push({
              profile: profile.name,
              text_scale: scale,
              group,
              stage: 'task',
              message: error.message,
            });
          } finally {
            console.log(
              JSON.stringify({
                profile: profile.name,
                text_scale: scale,
                group,
                status: row.status,
                message: row.message,
              }),
            );
            if (receiptPath) {
              await mkdir(dirname(resolve(receiptPath)), { recursive: true });
              await appendFile(
                receiptPath + '.rows.jsonl',
                JSON.stringify({
                  browser: version,
                  row,
                  failures: failures.filter(function (failure) {
                    return (
                      failure.profile === row.profile.name &&
                      failure.text_scale === row.text_scale &&
                      failure.group === row.group
                    );
                  }),
                }) + '\n',
                'utf8',
              );
            }
            await page.close();
          }
        }
    }
    const colors = cases.flatMap(function (row) {
      return row.controls
        .concat(row.identity_color ? [row.identity_color] : [])
        .filter(function (c) {
          return !c.disabled && !c.passive;
        })
        .map(function (c) {
          return {
            name: c.name,
            profile: row.profile.name,
            text_scale: row.text_scale,
            group: row.group,
            foreground: c.foreground,
            background: c.background,
            behind: c.behind,
            opacity: c.opacity,
            expectedForeground: c.expectedForeground,
          };
        });
    });
    let audited = [];
    try {
      audited = auditSurfaceColors(colors);
    } catch (error) {
      failures.push({ stage: 'contrast_evaluation', message: error.message });
    }
    for (const sample of audited) {
      if (sample.name === 'Document identity' && !sample.canonical_foreground)
        failures.push({
          profile: sample.profile,
          text_scale: sample.text_scale,
          group: sample.group,
          stage: 'identity_foreground',
          name: sample.name,
        });
      if (!Number.isFinite(sample.contrast) || sample.contrast < 4.5)
        failures.push({
          profile: sample.profile,
          text_scale: sample.text_scale,
          group: sample.group,
          stage: 'contrast',
          name: sample.name,
          contrast: sample.contrast,
        });
    }
    for (const row of cases)
      if (
        failures.some(function (failure) {
          return (
            failure.profile === row.profile.name &&
            failure.text_scale === row.text_scale &&
            failure.group === row.group
          );
        })
      )
        row.status = 'failed';
    const receipt = {
      schema_version: 1,
      evidence_class: 'supplemental_headless_production_react_browser',
      status: failures.length ? 'failed' : 'passed',
      source_commit: sourceCommit,
      observed_sources_at_start: observedSources,
      browser: version,
      inert_supported: await (async function () {
        const capabilityPage = await browser.newPage();
        const supported = await capabilityPage.evaluate(function () {
          return 'inert' in HTMLElement.prototype;
        });
        await capabilityPage.close();
        return supported;
      })(),
      index_sha256: createHash('sha256').update(index).digest('hex'),
      assets,
      cases,
      failures,
      contrast: audited,
      limits: [
        'Native/clipboard/storage sources are synthetic boundaries; no APK, AndroidIME, predictiveBack, screenreader or installed-package proof.',
        'Font/root and contracted viewport profiles model text/inset obstruction; actual native qualification remains independent.',
      ],
    };
    if (receiptPath) {
      await mkdir(dirname(resolve(receiptPath)), { recursive: true });
      await writeFile(
        receiptPath,
        JSON.stringify(receipt, null, 2) + '\n',
        'utf8',
      );
    }
    assert.equal(
      failures.length,
      0,
      'Composed document task audit failed ' +
        failures.length +
        ' rows; all failures retained in receipt',
    );
    return receipt;
  } finally {
    await browser.close();
    server.closeAllConnections();
    await new Promise(function (resolve) {
      server.close(resolve);
    });
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const argument = function (name) {
    const i = process.argv.indexOf(name);
    return i < 0 ? '' : process.argv[i + 1] || '';
  };
  const receipt = await checkAppLayout({
    receiptPath: argument('--receipt'),
    distDir: argument('--dist') || undefined,
    sourceCommit: argument('--source-commit') || null,
    legacy: process.argv.includes('--legacy'),
    onlyProfile: argument('--profile'),
    onlyGroup: argument('--group'),
  });
  console.log(
    'Verified ' +
      receipt.cases.length +
      ' actual production document task/profile rows. Browser evidence only.',
  );
}
