import test from 'node:test';
import assert from 'node:assert/strict';

import { resizeRectangle } from '../apps/under-routing/js/resize.js';

function drag(corner) {
  return {
    corner,
    startX: 10,
    startY: 20,
    startWidth: 100,
    startHeight: 60,
  };
}

test('resizes a rectangle from its southeast corner', () => {
  const rectangle = {};
  resizeRectangle(rectangle, drag('se'), 25, 15);
  assert.deepEqual(rectangle, { x: 10, y: 20, width: 125, height: 75 });
});

test('resizes a rectangle from its northwest corner while fixing the opposite corner', () => {
  const rectangle = {};
  resizeRectangle(rectangle, drag('nw'), 20, 10);
  assert.deepEqual(rectangle, { x: 30, y: 30, width: 80, height: 50 });
});

test('normalizes dimensions when a handle crosses the opposite corner', () => {
  const rectangle = {};
  resizeRectangle(rectangle, drag('ne'), -130, 80);
  assert.deepEqual(rectangle, { x: -20, y: 80, width: 30, height: 20 });
});

test('preserves a minimum visible size', () => {
  const rectangle = {};
  resizeRectangle(rectangle, drag('se'), -98, -59, 4);
  assert.deepEqual(rectangle, { x: 10, y: 20, width: 4, height: 4 });
});
