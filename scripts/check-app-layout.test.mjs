import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertTaskControlMeasurement,
  applyTaskControlClipping,
} from './check-app-layout.mjs';
const valid = () => ({
  name: 'Find',
  frameCount: 1,
  width: 48,
  height: 48,
  left: 24,
  top: 24,
  right: 72,
  bottom: 72,
  clipWidth: 48,
  clipHeight: 48,
  visible: { left: 0, top: 0, right: 320, bottom: 240 },
  hit: true,
  focus: true,
  disabled: false,
});
test('accepts an actual complete reachable control measurement', () =>
  assert.doesNotThrow(() => assertTaskControlMeasurement(valid())));
for (const [label, patch] of [
  ['undersized', { height: 47 }],
  ['outside-native-frame', { right: 321 }],
  ['clipped', { clipHeight: 47 }],
  ['occluded', { hit: false }],
  ['unfocusable', { focus: false }],
  ['unnamed', { name: '' }],
  ['second-frame', { frameCount: 2 }],
  ['forged-passive', { passive: true, tag: 'BUTTON' }],
])
  test('rejects ' + label, () =>
    assert.throws(() => assertTaskControlMeasurement({ ...valid(), ...patch })),
  );
test('disabled controls still need complete geometry but cannot receive focus', () =>
  assert.doesNotThrow(() =>
    assertTaskControlMeasurement({ ...valid(), disabled: true, focus: false }),
  ));
test('only read-only task checkboxes have a passive disposition', () =>
  assert.doesNotThrow(() =>
    assertTaskControlMeasurement({
      ...valid(),
      name: 'Completed task',
      tag: 'INPUT',
      type: 'checkbox',
      readOnly: true,
      disabled: true,
      passive: true,
      width: 13,
      height: 13,
    }),
  ));

const fixedPortalRow = () => ({
  ...valid(),
  top: 555,
  bottom: 603,
  visible: { left: 0, top: 24, right: 320, bottom: 616 },
  ancestors: [
    {
      left: 1,
      right: 319,
      top: 431,
      bottom: 615,
      overflowY: 'auto',
      position: 'static',
    },
    {
      left: 0,
      right: 320,
      top: 0,
      bottom: 640,
      overflowY: 'visible',
      position: 'fixed',
    },
    {
      left: 0,
      right: 320,
      top: -73,
      bottom: 567,
      overflowY: 'hidden',
      position: 'relative',
      transform: 'none',
    },
  ],
});
test('viewport-fixed portal escapes the non-containing scrolled frame while retaining full native bounds', () => {
  const measured = applyTaskControlClipping(fixedPortalRow());
  assert.equal(measured.clipHeight, 48);
  assert.equal(measured.viewportFixedPortal, true);
  assert.doesNotThrow(() => assertTaskControlMeasurement(measured));
});
test('a real task-body clip still rejects controls within a fixed portal', () => {
  const row = fixedPortalRow();
  row.ancestors[0].bottom = 580;
  const measured = applyTaskControlClipping(row);
  assert.equal(measured.clipHeight, 25);
  assert.throws(() => assertTaskControlMeasurement(measured));
});
test('a transformed ancestor contains a fixed portal and keeps its actual clipping', () => {
  const row = fixedPortalRow();
  row.ancestors[2].transform = 'matrix(1,0,0,1,0,0)';
  const measured = applyTaskControlClipping(row);
  assert.equal(measured.clipHeight, 12);
  assert.equal(measured.viewportFixedPortal, false);
  assert.throws(() => assertTaskControlMeasurement(measured));
});
