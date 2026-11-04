import assert from 'node:assert/strict';
import test from 'node:test';
import { assertAuthoringMeasurement } from './check-android-authoring-layout.mjs';

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
