/* eslint-disable no-console */
import { promisify } from 'util';
import fs from 'fs';
import Jimp from 'jimp';
import decode from '../src/index.ts';

const readStdin = () =>
  new Promise((resolve) => {
    const result: Buffer[] = [];

    process.stdin.on('readable', () => {
      let chunk: string | Buffer;

      while ((chunk = process.stdin.read())) {
        if (Buffer.isBuffer(chunk)) {
          result.push(chunk);
        }
      }
    });

    process.stdin.on('end', () => {
      resolve(Buffer.concat(result));
    });
  });

const createImage = promisify(
  (
    { data, width, height }: { data: ArrayBuffer; width: number; height: number },
    callback: (err: unknown, image?: any) => void
  ) => {
    try {
      new Jimp({ data: Buffer.from(data), width, height }, callback);
    } catch (e) {
      callback(e);
    }
  }
);

const toJpeg = async ({
  data,
  width,
  height,
}: {
  data: ArrayBuffer;
  width: number;
  height: number;
}) => {
  const image = await createImage({ data, width, height });
  return image.quality(100).getBufferAsync(Jimp.MIME_JPEG);
};

(async () => {
  const buffer = await readStdin();
  const images = await decode.all({ buffer });

  console.log('found %s images', images.length);

  for (let i in images) {
    console.log('decoding image', +i + 1);
    const image = images[i];
    fs.writeFileSync(`./result-${+i + 1}.jpg`, await toJpeg(await image.decode()));
  }
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
