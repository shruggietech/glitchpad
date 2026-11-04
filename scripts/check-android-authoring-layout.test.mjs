import assert from 'node:assert/strict';
import test from 'node:test';
import {
  auditSurfaceColors,
  assertSurfaceContrast,
} from './check-s046-surface-contrast.mjs';
import {
  assertAuthoringMeasurement,
  assertNativeAuthoringMeasurement,
  assertNativeObservation,
  assertDiagnosticMeasurement,
} from './check-android-authoring-layout.mjs';

const measured = () => ({
  viewport: { left: 0, top: 0, width: 360, height: 640 },
  document: {
    left: 0,
    top: 32,
    right: 360,
    bottom: 640,
    width: 360,
    height: 608,
  },
  trigger: {
    left: 220,
    top: 580,
    right: 348,
    bottom: 628,
    width: 128,
    height: 48,
  },
  paddingBottom: 64,
  actions: [
    {
      label: 'New Markdown',
      left: 180,
      right: 348,
      top: 520,
      bottom: 568,
      width: 168,
      height: 48,
      visibleWidth: 168,
      visibleHeight: 48,
      hit: true,
    },
  ],
});

test('audits each action rather than accepting one representative target', () => {
  const actual = measured();
  assert.doesNotThrow(() => assertAuthoringMeasurement(actual));
  actual.actions.push({ ...actual.actions[0], label: 'Open file', width: 30 });
  assert.throws(() => assertAuthoringMeasurement(actual), /Open file.*48/u);
});

test('rejects offscreen, clipped, and input-occluded choices independently', () => {
  for (const mutation of [
    { right: 370 },
    { visibleHeight: 24 },
    { hit: false },
  ]) {
    const actual = measured();
    Object.assign(actual.actions[0], mutation);
    assert.throws(() => assertAuthoringMeasurement(actual));
  }
});

test('requires document clearance for actual floating control height', () => {
  const actual = measured();
  actual.trigger.top = 550;
  assert.throws(() => assertAuthoringMeasurement(actual), /reserve/u);
  actual.paddingBottom = 96;
  assert.doesNotThrow(() => assertAuthoringMeasurement(actual));
});

test('native Add audit rejects browser-visible but physically occluded targets and duplicated insets', () => {
  const actual = measured();
  actual.frameCount = 1;
  actual.nativeApplied = true;
  actual.nativeCurrent = true;
  actual.nativeVisible = { left: 0, top: 48, right: 320, bottom: 640 };
  actual.nativeRemaining = { right: 40, bottom: 0 };
  actual.expectedRemaining = { right: 40, bottom: 0 };
  actual.actions[0].label = 'Add document';
  assert.throws(
    () => assertNativeAuthoringMeasurement(actual),
    /native visible frame/u,
  );
  actual.actions[0].left = 140;
  actual.actions[0].right = 308;
  assert.doesNotThrow(() => assertNativeAuthoringMeasurement(actual));
  actual.nativeRemaining.right = 80;
  assert.doesNotThrow(() => assertNativeAuthoringMeasurement(actual));
  assert.throws(() => assertNativeObservation(actual), /twice/u);
});

const diagnosticMeasured = () => ({
  inactiveAddInvisible: true,
  addReservedHeight: 48,
  frameCount: 1,
  visible: { left: 0, top: 48, right: 320, bottom: 592 },
  actions: [
    'Close diagnostics',
    'Save previewed bundle',
    'Share previewed bundle',
    'Clear diagnostics',
  ].map((label) => ({
    label,
    left: 16,
    top: 100,
    right: 216,
    bottom: 144,
    width: 200,
    height: 44,
    hit: true,
  })),
  preview: [
    {
      end: 'first',
      character: '{',
      top: 200,
      bottom: 211,
      clipTop: 180,
      clipBottom: 570,
      hit: true,
    },
    {
      end: 'last',
      character: '}',
      top: 540,
      bottom: 551,
      clipTop: 180,
      clipBottom: 570,
      hit: true,
    },
  ],
  previewUnchanged: true,
  remainingBottom: 48,
  expectedRemainingBottom: 48,
});

test('diagnostic audit rejects the actual below-native-frame control and an unreadable final JSON line', () => {
  const measured = diagnosticMeasured();
  assert.doesNotThrow(() => assertDiagnosticMeasurement(measured));
  measured.actions[2].top = 596.1875;
  measured.actions[2].bottom = 640.1875;
  assert.throws(
    () => assertDiagnosticMeasurement(measured),
    /Share.*native visible frame/u,
  );
  const unreadable = diagnosticMeasured();
  unreadable.preview[1].top = 591.09375;
  unreadable.preview[1].bottom = 602.09375;
  assert.throws(
    () => assertDiagnosticMeasurement(unreadable),
    /last JSON line/u,
  );
});

test('diagnostic audit preserves actual input hits, immutable preview and single inset application', () => {
  for (const mutate of [
    (value) => {
      value.actions[0].hit = false;
    },
    (value) => {
      value.previewUnchanged = false;
    },
    (value) => {
      value.remainingBottom = 96;
    },
  ]) {
    const measured = diagnosticMeasured();
    mutate(measured);
    assert.throws(() => assertDiagnosticMeasurement(measured));
  }
});

function surfaceMeasurement() {
  return {
    os: 'light',
    preference: 'light',
    observedTheme: 'light',
    observedOsLight: true,
    previewUnchanged: true,
    errors: [],
    samples: [
      'decision',
      'decision_pending',
      'diagnostics',
      'diagnostics_pending',
    ].flatMap((stage) => {
      const kinds = stage.startsWith('decision')
        ? ['heading', 'body', 'status']
        : ['heading', 'body', 'status', 'json'];
      return [
        ...kinds,
        ...Array(stage.startsWith('decision') ? 3 : 4).fill('action'),
      ].map((kind) => ({
        stage,
        kind,
        foreground: 'rgb(10, 10, 10)',
        background: 'rgb(248, 248, 246)',
        behind: 'rgb(248, 248, 246)',
        opacity: 1,
        expectedForeground: '#0A0A0A',
        disabled: kind === 'action' && stage.endsWith('_pending'),
      }));
    }),
  };
}

test('the contrast gate rejects the observed white JSON and white action text on light backgrounds', () => {
  const measured = surfaceMeasurement();
  const json = measured.samples.find((sample) => sample.kind === 'json');
  Object.assign(json, {
    foreground: 'rgb(255, 255, 255)',
    expectedForeground: '#FFFFFF',
    background: 'rgb(255, 255, 255)',
  });
  measured.samples = auditSurfaceColors(measured.samples);
  assert.equal(
    measured.samples.find((sample) => sample.kind === 'json').contrast,
    1,
  );
  assert.throws(() => assertSurfaceContrast(measured), /json contrast=1/u);
  const actions = surfaceMeasurement();
  const action = actions.samples.find((sample) => sample.kind === 'action');
  Object.assign(action, {
    foreground: 'rgb(255, 255, 255)',
    expectedForeground: '#FFFFFF',
    background: 'rgb(229, 231, 234)',
  });
  actions.samples = auditSurfaceColors(actions.samples);
  assert.throws(() => assertSurfaceContrast(actions), /action contrast=/u);
});

test('the contrast gate requires the persisted explicit preference and its canonical foreground', () => {
  const measured = surfaceMeasurement();
  measured.samples = auditSurfaceColors(measured.samples);
  assert.doesNotThrow(() => assertSurfaceContrast(measured));
  measured.observedTheme = 'system';
  assert.throws(() => assertSurfaceContrast(measured), /persisted app theme/u);
  const inheritedWhite = surfaceMeasurement();
  inheritedWhite.samples[0].foreground = 'rgb(255, 255, 255)';
  inheritedWhite.samples[0].background = 'rgb(11, 12, 13)';
  inheritedWhite.samples = auditSurfaceColors(inheritedWhite.samples);
  assert.throws(
    () => assertSurfaceContrast(inheritedWhite),
    /app preference through inherited AppFrame color/u,
  );
});

test('the contrast gate retains disabled measurements while requiring every enabled action and text kind', () => {
  const measured = surfaceMeasurement();
  for (const sample of measured.samples)
    if (sample.disabled) sample.opacity = 0.2;
  measured.samples = auditSurfaceColors(measured.samples);
  assert.ok(
    measured.samples.some((sample) => sample.disabled && sample.contrast < 4.5),
  );
  assert.doesNotThrow(() => assertSurfaceContrast(measured));
  measured.samples = measured.samples.filter(
    (sample) => !(sample.stage === 'diagnostics' && sample.kind === 'status'),
  );
  assert.throws(
    () => assertSurfaceContrast(measured),
    /measure actual status/u,
  );
});
