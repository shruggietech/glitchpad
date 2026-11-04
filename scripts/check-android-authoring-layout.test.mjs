import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertAuthoringMeasurement,
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
