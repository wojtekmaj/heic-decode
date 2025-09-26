import type libheifType from 'libheif-js/wasm-bundle.js';
import type { HeifImage } from 'libheif-js/wasm-bundle.js';

const uint8ArrayUtf8ByteString = (array: Uint8Array, start: number, end: number) => {
  return String.fromCharCode(...array.slice(start, end));
};

// brands explained: https://github.com/strukturag/libheif/issues/83
// code adapted from: https://github.com/sindresorhus/file-type/blob/6f901bd82b849a85ca4ddba9c9a4baacece63d31/core.js#L428-L438
const isHeic = (buffer: Uint8Array) => {
  const brandMajor = uint8ArrayUtf8ByteString(buffer, 8, 12).replace('\0', ' ').trim();

  switch (brandMajor) {
    case 'mif1':
      return true; // {ext: 'heic', mime: 'image/heif'};
    case 'msf1':
      return true; // {ext: 'heic', mime: 'image/heif-sequence'};
    case 'heic':
    case 'heix':
      return true; // {ext: 'heic', mime: 'image/heic'};
    case 'hevc':
    case 'hevx':
      return true; // {ext: 'heic', mime: 'image/heic-sequence'};
  }

  return false;
};

const decodeImage = async (
  image: HeifImage
): Promise<{ width: number; height: number; data: Uint8ClampedArray }> => {
  const width = image.get_width();
  const height = image.get_height();

  const { data } = await new Promise<{ data: Uint8ClampedArray }>((resolve, reject) => {
    image.display(
      { data: new Uint8ClampedArray(width * height * 4), width, height },
      (displayData) => {
        if (!displayData) {
          return reject(new Error('HEIF processing error'));
        }

        resolve(displayData);
      }
    );
  });

  return { width, height, data };
};

type DecodeOneResult = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

type DecodeAllResult = {
  width: number;
  height: number;
  decode: () => Promise<DecodeOneResult>;
}[];

export default function lib(libheif: typeof libheifType): {
  one: (options: { buffer: Uint8Array }) => Promise<DecodeOneResult>;
  all: (options: { buffer: Uint8Array }) => Promise<DecodeAllResult>;
} {
  async function decodeBuffer({
    buffer,
    all,
  }: {
    buffer: Uint8Array;
    all: true;
  }): Promise<DecodeAllResult>;
  async function decodeBuffer({
    buffer,
    all,
  }: {
    buffer: Uint8Array;
    all: false;
  }): Promise<DecodeOneResult>;
  async function decodeBuffer({ buffer, all }: { buffer: Uint8Array; all: boolean }) {
    if (!isHeic(buffer)) {
      throw new TypeError('input buffer is not a HEIC image');
    }

    // wait for module to be initialized
    // currently it is synchronous but it might be async in the future
    await libheif.ready;

    const decoder = new libheif.HeifDecoder();
    const data = decoder.decode(buffer);

    const dispose = () => {
      for (const image of data) {
        image.free();
      }

      decoder.decoder.delete();
    };

    if (!data.length) {
      throw new Error('HEIF image not found');
    }

    if (!all) {
      try {
        return await decodeImage(data[0]!);
      } finally {
        dispose();
      }
    }

    return Object.defineProperty(
      data.map((image) => {
        return {
          width: image.get_width(),
          height: image.get_height(),
          decode: async () => await decodeImage(image),
        };
      }),
      'dispose',
      {
        enumerable: false,
        configurable: false,
        writable: false,
        value: dispose,
      }
    );
  }

  return {
    one: async ({ buffer }: { buffer: Uint8Array }) => await decodeBuffer({ buffer, all: false }),
    all: async ({ buffer }: { buffer: Uint8Array }) => await decodeBuffer({ buffer, all: true }),
  };
}
