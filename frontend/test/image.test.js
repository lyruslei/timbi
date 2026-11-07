import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitSize } from '../lib/image.js';

test('landscape phone photo shrinks to 1024 wide', () => assert.deepEqual(fitSize(4032, 3024), { w: 1024, h: 768 }));
test('portrait shrinks to 1024 tall', () => assert.deepEqual(fitSize(3024, 4032), { w: 768, h: 1024 }));
test('small photo is not enlarged', () => assert.deepEqual(fitSize(640, 480), { w: 640, h: 480 }));
test('custom max', () => assert.deepEqual(fitSize(2000, 1000, 500), { w: 500, h: 250 }));
