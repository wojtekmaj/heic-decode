/* eslint-env mocha */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { promisify } from 'node:util';
import toUint8 from 'buffer-to-uint8array';
import libheif from 'libheif-js';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import root from 'rootrequire';
import decode from '../src/index.ts';
import lib from '../src/lib.ts';

const readFile = promisify(fs.readFile);

describe('heic-decode (default wasm bundle)', () => {
  runTests(decode);
});

describe('heic-decode (js)', () => {
  const { one, all } = lib(libheif);
  const decode = one;
  (decode as any).all = all;

  runTests(decode);
});

function runTests(decode: any) {
  const readControl = async (
    name: string
  ): Promise<{ data: ArrayBuffer; width: number; height: number }> => {
    const buffer = await readFile(path.resolve(root, `temp/${name}`));
    const { data, width, height } = PNG.sync.read(buffer);

    return { data, width, height };
  };

  const compare = (
    expected: ArrayBuffer,
    actual: ArrayBuffer | Uint8ClampedArray,
    width: number,
    height: number,
    errString = 'actual image did not match control image'
  ) => {
    const result = pixelmatch(
      toUint8(Buffer.from(expected)),
      toUint8(actual),
      null,
      width,
      height,
      {
        threshold: 0.1,
      }
    );

    // allow 5% of pixels to be different
    assert(result < width * height * 0.05, errString);
  };

  it('exports a function', () => {
    assert.equal(typeof decode, 'function');
    assert.equal(typeof decode.all, 'function');
  });

  it('can decode a known image', async () => {
    const control = await readControl('0002-control.png');
    const buffer = await readFile(path.resolve(root, 'temp', '0002.heic'));
    const { width, height, data } = await decode({ buffer });

    assert.equal(width, control.width);
    assert.equal(height, control.height);
    assert(data instanceof Uint8ClampedArray);

    compare(control.data, data, control.width, control.height);
  });

  it('can decode multiple images inside a single file', async () => {
    const buffer = await readFile(path.resolve(root, 'temp', '0003.heic'));
    const images = await decode.all({ buffer });

    assert.equal(images.length, 3);
    assert.equal(typeof images.dispose, 'function');

    const controls = await Promise.all([
      readControl('0003-0-control.png'),
      readControl('0003-1-control.png'),
    ]);

    for (let { i, control } of [
      { i: 0, control: controls[0] },
      { i: 1, control: controls[1] },
      { i: 2, control: controls[1] },
    ]) {
      assert.equal(typeof images[i].decode, 'function');
      assert.equal(images[i].width, control.width);
      assert.equal(images[i].height, control.height);

      const image = await images[i].decode();

      assert.equal(image.width, control.width);
      assert.equal(image.height, control.height);
      assert.equal(image.data instanceof Uint8ClampedArray, true);

      compare(
        control.data,
        image.data,
        control.width,
        control.height,
        `actual image at index ${i} did not match control`
      );
    }

    images.dispose();
  });

  it('throws if data other than a HEIC image is passed in', async () => {
    const buffer = Buffer.from(Math.random().toString() + Math.random().toString());

    try {
      await decode({ buffer });
      throw new Error('decoding succeeded when it was expected to fail');
    } catch (e) {
      assert.equal(e instanceof TypeError, true);
      assert.equal((e as TypeError).message, 'input buffer is not a HEIC image');
    }
  });
}
